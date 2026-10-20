// English ladder sittings: the server deals each question from the catalog (the ladder picks the step), keeps the
// key, marks the answer and writes it to english_literacy_attempts. Two doors onto the same sitting:
//
//   the child's English card (always on; index.js loads this module on first use)
//     GET  /api/children/:childId/english-menu       -> { vr, gems, will_pay }   "Word puzzles" too? what it pays
//     POST /api/children/:childId/literacy/next      { sitting_id? } -> the next question (key kept back)
//     POST /api/literacy-sittings/:id/answer         { item_id, answers: [{ question_id, chosen }], skipped }
//   the internal lab (LITERACY_LAB=1 only)
//     POST /api/lab/literacy/:childId/next           { sitting_id?, min_status? }
//     POST /api/lab/literacy/sittings/:id/answer
//     GET  /api/lab/literacy/:childId/state          -> ladder summary + VR decision (dry run)
//
// Gems from the English card's own setting, one daily limit for both kinds of sitting (index.js payLiteracy).
// No parent message yet. Sources: the literacy engine, the VR engine, the sentence bank, the reading texts
// and the picture words (B1 read a word -> picture, D1 picture -> build the word). Listening needs approved audio and
// Ca1 needs scene art: those steps are gaps for now. A sitting lives in memory: a restart loses the question on
// screen, never a stored answer.

import crypto from 'node:crypto'
import { DateTime } from 'luxon'
import { nextProbe, RULES_VERSION } from './literacy/ladder.js'
import { entriesFor, TEXT_ONLY_BLIND } from './literacy/catalog.js'
import { LISTENING_ITEMS, listenClip } from './literacy/listeningBank.js'
import AUDIO from './literacy/audioManifest.generated.json' with { type: 'json' }
import { SENTENCE_ITEMS, SENTENCE_REVISION } from './literacy/sentenceBank.js'
import { generateItem as literacyItem } from './literacy/engine.js'
import { pictureItem, pictureBuildItem } from './literacy/pictureWords.js'
import STORIES from './literacy/readingStories.generated.json' with { type: 'json' }
import READING from './literacy/readingPreview.generated.json' with { type: 'json' }
import { literacyState, saveAttempt, vrDecision, loadAttempts } from './literacyEvidence.js'

export const LAB_ON = () => process.env.LITERACY_LAB === '1'
export const SITTING_LENGTH = 10
const CHILD_MIN_STATUS = 'checked'
const TEXTS = { 'reading-stories-200': STORIES.items, 'reading-passages': READING.items }
const SUPPORTED = new Set(['literacy-engine', 'vr-engine', 'sentence-bank', 'reading-stories-200', 'reading-passages', 'picture-words', 'listening-bank'])
// The literacy engine's build is from a definition (a reading load); D1 is served by the picture build instead.
// Listening (track A) needs sound: a sitting where the child said "I can't use sound now" is dealt none.
const LISTENS = e => e.source === 'listening-bank' || (e.source === 'picture-words' && e.ref?.kind === 'listen')
const servable = (e, { audio = true } = {}) => SUPPORTED.has(e.source) && !(e.source === 'literacy-engine' && e.ref?.skill === 'build')
  && (audio || !LISTENS(e))

const supported = (minStatus, opts) => (track, step) => entriesFor(track, step, { minStatus }).some(e => servable(e, opts))

// A recording's public address, or null. Only clips that passed the automatic check (status ok, no issues): the
// recordings are on the card by user decision 2026-10-20 without a person approving each one. File names are
// content hashes, so the address says nothing about the answer.
const AUDIO_BASE = `${process.env.SUPABASE_URL || ''}/storage/v1/object/public/`
export function audioUrl(clip, variety = 'uk') {
  const m = AUDIO[`${clip}:${variety}`] || AUDIO[`${clip}:uk`]
  return m && m.status === 'ok' && !m.issues?.length ? AUDIO_BASE + m.file : null
}

// One source for the step, like catalog.pick but only among sources a sitting can serve.
function pickSource(track, step, seed, { minStatus, avoid, audio = true }) {
  const list = entriesFor(track, step, { minStatus }).filter(e => servable(e, { audio }))
  if (!list.length) return null
  const e = list[seed % list.length]
  if (e.kind === 'bank') {
    const free = e.ids.filter(i => !avoid.has(i))
    if (!free.length) return null
    return { source: e.source, format: e.format, id: free[Math.floor(seed / list.length) % free.length] }
  }
  return { source: e.source, format: e.format, ref: { ...e.ref, seed } }
}

// A dealt item: questions with options and keys. Each question carries the evidence fields the ladder records.
// Keys stay on the server; publicItem() is what is sent.
export async function dealItem(track, step, pick, { avoid = new Set(), variety = 'uk' } = {}) {
  const base = { track, step, source: pick.source, format: pick.format }
  if (pick.source === 'sentence-bank') {
    const it = SENTENCE_ITEMS.find(x => x.id === pick.id)
    return { ...base, id: it.id, contentVersion: SENTENCE_REVISION, prompt: it.prompt,
      questions: [{ id: 'q0', options: it.options, key: [it.key], skill: step, group: it.id, family: 'sentence-bank', explain: it.feedback.text }] }
  }
  if (pick.source === 'listening-bank') {
    const it = LISTENING_ITEMS.find(x => x.id === pick.id)
    const talk = audioUrl(listenClip.talk(it.id), variety)
    const question = audioUrl(listenClip.question(it.id), variety)
    const options = it.choices.map(c => ({ id: c.id, audio: audioUrl(c.audio, variety) }))
    if (!talk || !question || options.some(o => !o.audio)) return null      // a missing or flagged clip: not dealt
    // Everything is heard, nothing read: the options are sounds, the text appears only in the feedback.
    return { ...base, id: it.id, contentVersion: `listening:${it.id}`,
      prompt: { audio: [talk, question], instruction_audio: audioUrl(listenClip.instruction(), variety), listen: true },
      questions: [{ id: 'q0', options, key: [it.key], skill: step, group: it.id, family: 'listening-bank', explain: it.feedback,
        explain_audio: audioUrl(listenClip.feedback(it.id), variety) }] }
  }
  if (TEXTS[pick.source]) {
    const it = TEXTS[pick.source].find(x => x.id === pick.id)
    // A question a solver answered without the text is not evidence of reading: only text-dependent ones are asked.
    const asked = it.questions.map((q, i) => [q, i]).filter(([q]) => (q.blindRight ?? 0) <= TEXT_ONLY_BLIND || pick.source !== 'reading-stories-200')
    if (!asked.length) return null
    return { ...base, id: it.id, contentVersion: `${pick.source}:${it.id}`, passage: { title: it.title, text: it.passage },
      questions: asked.map(([q, i]) => ({
        id: `q${i}`, stem: q.stem, options: q.options.map((text, j) => ({ id: `o${j}`, text })), key: [`o${q.answer}`],
        // One text is one group: three questions give a skill one unit (ladder.js), each skill keeps its own.
        skill: q.op, group: `text:${it.id}`, family: pick.source, explain: q.evidence,
      })) }
  }
  if (pick.source === 'picture-words') {
    const words = new Set([...avoid].filter(a => a.startsWith('word:')).map(a => a.slice(5)))
    if (pick.ref.kind === 'build') {
      const it = pictureBuildItem(pick.ref.seed, { avoid: words })
      if (!it) return null
      return { ...base, id: it.id, contentVersion: 'picture-words-1', prompt: { ...it.prompt, instruction: it.instruction.text },
        questions: [{ id: 'q0', mode: 'build', letters: it.letters, key: [it.key], skill: 'build-picture', group: `word:${it.key}`,
          family: 'picture-build', explain: it.key }] }
    }
    const listen = pick.ref.kind === 'listen'
    const it = pictureItem(listen ? 'listen' : 'read', pick.ref.seed, { avoid: words })
    if (!it) return null
    if (listen) {
      const word = audioUrl(it.prompt.audio, variety)
      if (!word) return null
      return { ...base, id: it.id, contentVersion: 'picture-words-1',
        prompt: { audio: [word], instruction_audio: audioUrl(it.instruction.audio, variety), listen: true },
        questions: [{ id: 'q0', options: it.options, key: [it.key], skill: 'listen-picture', group: `word:${it.key}`,
          family: 'picture-listen', explain: it.key, explain_audio: word }] }
    }
    return { ...base, id: it.id, contentVersion: 'picture-words-1', prompt: { text: it.prompt.text, instruction: it.instruction.text },
      questions: [{ id: 'q0', options: it.options, key: [it.key], skill: 'read-picture', group: `word:${it.key}`,
        family: 'picture-words', explain: it.key }] }
  }
  if (pick.source === 'literacy-engine') {
    const q = literacyItem(pick.ref.skill, pick.ref.seed)
    return { ...base, id: `lit:${pick.ref.skill}:${pick.ref.seed}`, contentVersion: `${q.contentVersion}/${q.engineVersion}`,
      prompt: { text: q.prompt, stem: q.stem ?? null }, passage: q.passage ? { title: q.passage.title, text: q.passage.sentences.join(' ') } : null,
      questions: [{ id: 'q0', options: q.options, key: q.options.filter(o => o.text === q.answer).map(o => o.id),
        skill: pick.ref.skill, group: q.family, family: `lit:${pick.ref.skill}`, explain: q.explanation }] }
  }
  if (pick.source === 'vr-engine') {
    const { generateItem } = await import('./english/englishTemplates.js')
    for (let k = 0; k < 20; k++) {
      const q = generateItem(pick.ref.band, pick.ref.type, pick.ref.seed + k)
      if (!q) continue
      const options = q.options.map((o, j) => ({ id: `o${j}`, text: o.text }))
      const answer = q.correct.map(j => q.options[j].text).sort().join('+')
      return { ...base, id: `vr:${pick.ref.band}:${pick.ref.type}:${q.seed}`, contentVersion: `english-engine:${pick.ref.band}`,
        prompt: { stem_key: q.stem_key, type: q.type, vr: q.prompt, pick: q.pick },
        // The answer word is the group: the same word met again under another seed is the same word.
        questions: [{ id: 'q0', options, key: q.correct.map(j => `o${j}`), skill: pick.ref.type, group: `vr:${pick.ref.type}:${answer}`,
          family: `vr:${pick.ref.type}`, explain: q.correct.map(j => q.options[j].text).join(', ') }] }
    }
    return null
  }
  return null
}

export function publicItem(item) {
  return {
    id: item.id, track: item.track, step: item.step, format: item.format, prompt: item.prompt ?? null, passage: item.passage ?? null,
    questions: item.questions.map(q => (q.mode === 'build'
      ? { id: q.id, mode: 'build', letters: q.letters }
      : { id: q.id, stem: q.stem ?? null, options: q.options, pick: q.key.length })),
  }
}

// Right only if exactly the key was chosen; a built word is right if the letters spell it.
export function judge(question, chosen) {
  if (question.mode === 'build') return String(chosen ?? '').trim().toLowerCase() === question.key[0]
  const got = [].concat(chosen ?? []).map(String).sort()
  const key = [...question.key].sort()
  return got.length === key.length && got.every((c, i) => c === key[i])
}

const sittings = new Map()

// Is English (the card) switched on for this child? Same task setting as the VR card: one card.
function englishActive(child) {
  const ts = child?.task_settings?.english
  return ts?.active !== false
}

async function childOf(supabase, id) {
  return (await supabase.from('children').select('*').eq('id', id).maybeSingle()).data
}

async function nextFor(supabase, child, { sittingId, minStatus, pay = null, quote = null, noAudio = false, discard = null, variety = 'uk' }) {
  let sitting = sittings.get(sittingId)
  let fresh = false
  if (!sitting || sitting.childId !== child.id) {
    fresh = true
    sitting = { id: crypto.randomUUID(), childId: child.id, minStatus, items: new Map(), dealt: 0, right: 0, answered: 0, shares: 0, paid: null }
    sittings.set(sitting.id, sitting)
    if (sittings.size > 500) sittings.delete(sittings.keys().next().value)
  }
  // "I can't use sound now": no listening for the rest of this sitting, and the listening question on screen is
  // put back unanswered (it does not count towards the ten).
  if (noAudio) sitting.noAudio = true
  const back = discard && sitting.items.get(discard)
  if (back && !back.answered) { sitting.items.delete(discard); sitting.dealt-- }
  const head = { sitting_id: sitting.id, of: SITTING_LENGTH, ...(fresh && quote ? await quote(child) : {}) }
  const finished = async (extra = {}) => {
    if (pay && !sitting.paid) sitting.paid = await pay(child, sitting)
    return { ...head, done: true, right: sitting.right, answered: sitting.answered, ...(sitting.paid || {}), ...extra }
  }
  if (sitting.dealt >= SITTING_LENGTH) return finished()
  const { state, missing } = await literacyState(supabase, child)
  if (missing) return { error: [503, 'english ladder tables missing'] }
  const probe = nextProbe(state, { has: supported(sitting.minStatus, { audio: !sitting.noAudio }), session: sitting.id })
  if (!probe) return finished({ reason: 'no content' })
  const { rows } = await loadAttempts(supabase, child.id)
  // Bank items and words already met (a text is stored as `text:<id>`, a word as `word:<w>`) are not dealt again.
  const avoid = new Set(rows.flatMap(r => [String(r.grp), String(r.grp).replace(/^text:/, '')]))
  for (const it of sitting.items.values()) for (const q of it.questions) avoid.add(String(q.group))
  let item = null
  for (let k = 0; k < 8 && !item; k++) {
    const pick = pickSource(probe.track, probe.step, crypto.randomInt(1, 2 ** 30), { minStatus: sitting.minStatus, avoid, audio: !sitting.noAudio })
    if (pick) item = await dealItem(probe.track, probe.step, pick, { avoid, variety })
  }
  if (!item) return { error: [500, `could not deal ${probe.step}`] }
  item.dealtId = crypto.randomUUID()
  sitting.items.set(item.dealtId, item)
  sitting.dealt++
  return { ...head, n: sitting.dealt, easy: probe.easy, item: { ...publicItem(item), id: item.dealtId } }
}

async function answerFor(supabase, tzForChild, sittingId, body) {
  const sitting = sittings.get(sittingId)
  if (!sitting) return { error: [404, 'sitting not found'] }
  const item = sitting.items.get(body?.item_id)
  if (!item) return { error: [404, 'item not found'] }
  if (item.answered) return { error: [409, 'already answered'] }
  const skipped = body?.skipped === true
  const given = new Map((body?.answers || []).map(a => [a.question_id, a.chosen]))
  if (!skipped && item.questions.some(q => !given.has(q.id))) return { error: [400, 'answer every question'] }
  item.answered = true
  // "I don't know" is an honest wrong answer, independent: nothing was shown before it.
  const hinted = Number(body?.hints_used) > 0
  const day = DateTime.now().setZone(await tzForChild(sitting.childId)).toISODate()
  const results = []
  for (const q of item.questions) {
    const correct = !skipped && judge(q, given.get(q.id))
    const saved = await saveAttempt(supabase, sitting.childId, {
      track: item.track, step: item.step, skill: q.skill, group: q.group, family: q.family,
      item: `${item.id}#${q.id}`, format: item.format, correct, independent: !hinted,
      hintsUsed: hinted ? 1 : 0, session: sitting.id, day, contentVersion: item.contentVersion, ruleVersion: RULES_VERSION,
    })
    if (!saved.ok) return { error: [saved.missing ? 503 : 500, saved.error || 'english ladder tables missing'] }
    sitting.answered++
    if (correct) sitting.right++
    // Gems per question, as the VR sitting: right with no help is a whole share, wrong or "I don't know" none.
    // A reading text's questions each count here (fair to the child), though the evidence counts the text once.
    if (correct && !hinted) sitting.shares++
    results.push({ question_id: q.id, correct, key: q.key, explain: q.explain, explain_audio: q.explain_audio ?? null })
  }
  return { results }
}

const send = (res, out) => (out.error ? res.status(out.error[0]).json({ error: out.error[1] }) : res.json(out))

// The child's door. Called from index.js after a lazy import, so a load failure here never takes the server down.
export function childHandlers({ supabase, tzForChild, gems = null, varietyFor = null }) {
  return {
    async menu(req, res) {
      const child = await childOf(supabase, req.params.childId)
      if (!child) return res.status(404).json({ error: 'child not found' })
      // Column missing (migration not run) = the card as it was: Word puzzles on.
      const vr = child.english_vr === undefined ? true : !!child.english_vr?.enabled
      res.json({ active: englishActive(child), vr })
    },
    async next(req, res) {
      const child = await childOf(supabase, req.params.childId)
      if (!child) return res.status(404).json({ error: 'child not found' })
      if (!englishActive(child)) return res.status(403).json({ error: 'English is switched off for this child' })
      const variety = varietyFor ? await varietyFor(child) : (child.english_variety === 'us' ? 'us' : 'uk')
      send(res, await nextFor(supabase, child, {
        sittingId: req.body?.sitting_id, minStatus: CHILD_MIN_STATUS, pay: gems?.pay, quote: gems?.quote,
        noAudio: req.body?.no_audio === true, discard: req.body?.discard_item ?? null, variety,
      }))
    },
    async answer(req, res) {
      send(res, await answerFor(supabase, tzForChild, req.params.id, req.body))
    },
  }
}

export function mountLiteracyLab(app, { supabase, tzForChild }) {
  const gate = (req, res, next) => (LAB_ON() ? next() : res.status(404).json({ error: 'not found' }))
  app.use('/api/lab/literacy', gate)
  const guard = (fn) => async (req, res) => {
    try { await fn(req, res) } catch (err) { console.error('[LITERACY-LAB]', err.message); res.status(500).json({ error: err.message }) }
  }
  app.post('/api/lab/literacy/:childId/next', guard(async (req, res) => {
    const child = await childOf(supabase, req.params.childId)
    if (!child) return res.status(404).json({ error: 'child not found' })
    const minStatus = ['draft', 'checked', 'approved'].includes(req.body?.min_status) ? req.body.min_status : 'checked'
    send(res, await nextFor(supabase, child, { sittingId: req.body?.sitting_id, minStatus, noAudio: req.body?.no_audio === true, discard: req.body?.discard_item ?? null, variety: child.english_variety === 'us' ? 'us' : 'uk' }))
  }))
  app.post('/api/lab/literacy/sittings/:id/answer', guard(async (req, res) => send(res, await answerFor(supabase, tzForChild, req.params.id, req.body))))
  app.get('/api/lab/literacy/:childId/state', guard(async (req, res) => {
    const child = await childOf(supabase, req.params.childId)
    if (!child) return res.status(404).json({ error: 'child not found' })
    const [{ summary, answers, missing }, vr] = await Promise.all([literacyState(supabase, child), vrDecision(supabase, child)])
    res.json({ answers, missing, summary, vr })
  }))
}
