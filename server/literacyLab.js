// English ladder sittings: the server deals each question from the catalog (the ladder picks the step), keeps the
// key, marks the answer and writes it to english_literacy_attempts. Two doors onto the same sitting:
//
//   the child's English card (always on; index.js loads this module on first use)
//     GET  /api/children/:childId/english-menu       -> { vr, gems, will_pay }   "Word puzzles" too? what it pays
//     POST /api/children/:childId/literacy/next      { sitting_id? } -> the next question (key kept back)
//     POST /api/literacy-sittings/:id/answer         { item_id, answers: [{ question_id, chosen }], skipped }
//     POST /api/literacy-sittings/:id/practice       a practice round after a finished sitting (see practiceFor)
//   the internal lab (LITERACY_LAB=1 only)
//     POST /api/lab/literacy/:childId/next           { sitting_id?, min_status? }
//     POST /api/lab/literacy/sittings/:id/answer
//     GET  /api/lab/literacy/:childId/state          -> ladder summary + VR decision (dry run)
//
// Gems from the English card's own setting, one daily limit for both kinds of sitting (index.js payLiteracy).
// A finished sitting is stored as it was shown (english_literacy_sittings, migration 2026-10-21) so the gem history
// can open it again. No parent message yet. Sources: the literacy engine, the VR engine, the sentence bank, the reading texts
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
import { literacyState, saveAttempts, vrDecision, loadAttempts, tableMissing } from './literacyEvidence.js'

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

function newSitting(child, fields) {
  const sitting = { id: crypto.randomUUID(), childId: child.id, child, items: new Map(), log: [], dealt: 0, right: 0, answered: 0, shares: 0, paid: null, ...fields }
  sittings.set(sitting.id, sitting)
  if (sittings.size > 500) sittings.delete(sittings.keys().next().value)
  return sitting
}

// The finished sitting as the child saw it: each item, what was chosen, the marks. Read back by the gem history
// (index.js /review/:ledgerId). No table yet (migration not run) = nothing stored, the row just does not open.
async function storeSitting(supabase, sitting) {
  if (sitting.stored || sitting.practice || !sitting.log.length) return
  sitting.stored = true
  const { error } = await supabase.from('english_literacy_sittings').upsert({
    id: sitting.id, child_id: sitting.childId, correct: sitting.right, total: sitting.answered, items: sitting.log,
  })
  if (error && !tableMissing(error)) console.error('[LITERACY] sitting not stored:', error.message)
}

export async function storedSitting(supabase, id, childId) {
  const { data, error } = await supabase.from('english_literacy_sittings').select('*').eq('id', id).eq('child_id', childId).maybeSingle()
  if (error && !tableMissing(error)) throw new Error(error.message)
  return data || null
}

// A practice item: the next step from the round's queue (the steps the child missed), never the ladder's choice.
async function dealPractice(sitting, rows) {
  const avoid = new Set(rows.flatMap(r => [String(r.grp), String(r.grp).replace(/^text:/, '')]))
  for (const it of sitting.items.values()) for (const q of it.questions) avoid.add(String(q.group))
  while (sitting.queue.length) {
    const { track, step } = sitting.queue.shift()
    for (let k = 0; k < 8; k++) {
      const pick = pickSource(track, step, crypto.randomInt(1, 2 ** 30), { minStatus: sitting.minStatus, avoid, audio: !sitting.noAudio })
      const item = pick && await dealItem(track, step, pick, { avoid, variety: sitting.variety })
      if (item) return item
    }
  }
  return null
}

async function nextFor(supabase, child, { sittingId, minStatus, pay = null, quote = null, noAudio = false, discard = null, variety = 'uk' }) {
  let sitting = sittings.get(sittingId)
  let fresh = false
  if (!sitting || sitting.childId !== child.id) {
    fresh = true
    sitting = newSitting(child, { minStatus, variety })
  }
  // "I can't use sound now": no listening for the rest of this sitting, and the listening question on screen is
  // put back unanswered (it does not count towards the ten).
  if (noAudio) sitting.noAudio = true
  const back = discard && sitting.items.get(discard)
  if (back && !back.answered) { sitting.items.delete(discard); sitting.dealt-- }
  const of = sitting.practice ? sitting.length : SITTING_LENGTH
  const head = { sitting_id: sitting.id, of, ...(sitting.practice ? { practice: true } : {}), ...(fresh && quote ? await quote(child) : {}) }
  const finished = async (extra = {}) => {
    if (!sitting.practice) {
      // The stored copy and the gems are independent: neither waits for the other.
      const [paid] = await Promise.all([pay && !sitting.paid ? pay(child, sitting) : sitting.paid, storeSitting(supabase, sitting)])
      sitting.paid = paid
    }
    return { ...head, done: true, right: sitting.right, answered: sitting.answered, ...(sitting.paid || {}), ...extra }
  }
  if (sitting.dealt >= of) return finished()
  // The child's rows are read once per question: the ladder state and the "already met" list both come from them.
  const loaded = await loadAttempts(supabase, child.id)
  if (loaded.missing) return { error: [503, 'english ladder tables missing'] }
  let item = null
  let easy
  if (sitting.practice) {
    item = await dealPractice(sitting, loaded.rows)
    if (!item) return finished({ reason: 'no content' })
  } else {
    const { state } = await literacyState(supabase, child, { loaded })
    const probe = nextProbe(state, { has: supported(sitting.minStatus, { audio: !sitting.noAudio }), session: sitting.id })
    if (!probe) return finished({ reason: 'no content' })
    easy = probe.easy
    // Bank items and words already met (a text is stored as `text:<id>`, a word as `word:<w>`) are not dealt again.
    const avoid = new Set(loaded.rows.flatMap(r => [String(r.grp), String(r.grp).replace(/^text:/, '')]))
    for (const it of sitting.items.values()) for (const q of it.questions) avoid.add(String(q.group))
    for (let k = 0; k < 8 && !item; k++) {
      const pick = pickSource(probe.track, probe.step, crypto.randomInt(1, 2 ** 30), { minStatus: sitting.minStatus, avoid, audio: !sitting.noAudio })
      if (pick) item = await dealItem(probe.track, probe.step, pick, { avoid, variety })
    }
    if (!item) return { error: [500, `could not deal ${probe.step}`] }
  }
  item.dealtId = crypto.randomUUID()
  sitting.items.set(item.dealtId, item)
  sitting.dealt++
  return { ...head, n: sitting.dealt, easy, item: { ...publicItem(item), id: item.dealtId } }
}

// "Let's practise": after a finished sitting, fresh questions from the steps that went wrong, at most five, one per
// step. Practice is not evidence (nothing is written to the ladder: these answers are not first, unhelped meetings
// with the step's level) and pays no gems. The questions come from the same steps the ladder chose, so they are the
// child's level, not a harder or easier one.
export const PRACTICE_MAX = 5
async function practiceFor(supabase, sittingId) {
  const done = sittings.get(sittingId)
  if (!done || done.practice) return { error: [404, 'sitting not found'] }
  if (done.dealt < SITTING_LENGTH && !done.paid) return { error: [409, 'sitting not finished'] }
  if (done.practiced) return { error: [409, 'already practised'] }
  const seen = new Set()
  const queue = []
  for (const e of done.log) {
    if (!Object.values(e.results).some(r => !r.correct)) continue
    const k = `${e.track}${e.step}`
    if (seen.has(k) || queue.length >= PRACTICE_MAX) continue
    seen.add(k)
    queue.push({ track: e.track, step: e.step })
  }
  if (!queue.length) return { error: [409, 'nothing to practise'] }
  done.practiced = true
  const sitting = newSitting(done.child, { practice: true, queue, length: queue.length, minStatus: done.minStatus, variety: done.variety, noAudio: done.noAudio })
  return nextFor(supabase, done.child, { sittingId: sitting.id, minStatus: done.minStatus, variety: done.variety })
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
  // "I don't know" is an honest wrong answer, independent: nothing was shown before it.
  const hinted = Number(body?.hints_used) > 0
  const marks = item.questions.map(q => ({ q, correct: !skipped && judge(q, given.get(q.id)) }))
  // A practice round is not evidence: marked, never written.
  if (!sitting.practice) {
    sitting.tz ??= await tzForChild(sitting.childId)
    const day = DateTime.now().setZone(sitting.tz).toISODate()
    // One insert for the item (a reading text is three rows): the child waits on this before seeing the mark.
    const saved = await saveAttempts(supabase, sitting.childId, marks.map(({ q, correct }) => ({
      track: item.track, step: item.step, skill: q.skill, group: q.group, family: q.family,
      item: `${item.id}#${q.id}`, format: item.format, correct, independent: !hinted,
      hintsUsed: hinted ? 1 : 0, session: sitting.id, day, contentVersion: item.contentVersion, ruleVersion: RULES_VERSION,
    })))
    if (!saved.ok) return { error: [saved.missing ? 503 : 500, saved.error || 'english ladder tables missing'] }
  }
  item.answered = true
  const results = []
  for (const { q, correct } of marks) {
    sitting.answered++
    if (correct) sitting.right++
    // Gems per question, as the VR sitting: right with no help is a whole share, wrong or "I don't know" none.
    // A reading text's questions each count here (fair to the child), though the evidence counts the text once.
    if (correct && !hinted) sitting.shares++
    results.push({ question_id: q.id, correct, key: q.key, explain: q.explain, explain_audio: q.explain_audio ?? null })
  }
  sitting.log.push({
    track: item.track, step: item.step, item: { ...publicItem(item), id: item.dealtId }, skipped,
    answers: Object.fromEntries(item.questions.map(q => [q.id, skipped ? null : given.get(q.id) ?? null])),
    results: Object.fromEntries(results.map(r => [r.question_id, r])),
  })
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
      // Inside a sitting the child, the switch and the variety were read when it began: each question does not
      // read them again (they were three round trips before every question).
      const known = sittings.get(req.body?.sitting_id)
      let child = known?.childId === req.params.childId ? known.child : null
      let variety = known?.variety
      if (!child) {
        child = await childOf(supabase, req.params.childId)
        if (!child) return res.status(404).json({ error: 'child not found' })
        if (!englishActive(child)) return res.status(403).json({ error: 'English is switched off for this child' })
        variety = varietyFor ? await varietyFor(child) : (child.english_variety === 'us' ? 'us' : 'uk')
      }
      send(res, await nextFor(supabase, child, {
        sittingId: req.body?.sitting_id, minStatus: CHILD_MIN_STATUS, pay: gems?.pay, quote: gems?.quote,
        noAudio: req.body?.no_audio === true, discard: req.body?.discard_item ?? null, variety,
      }))
    },
    async answer(req, res) {
      send(res, await answerFor(supabase, tzForChild, req.params.id, req.body))
    },
    async practice(req, res) {
      send(res, await practiceFor(supabase, req.params.id))
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
