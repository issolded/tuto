// English ladder lab sitting: an INTERNAL way for real answers to reach the evidence store before any child screen
// exists. Off unless the server runs with LITERACY_LAB=1; not linked from any card; pays no gems; sends nothing to a
// parent. The server deals each question from the catalog (the ladder picks the step), keeps the key, marks the
// answer and writes it to english_literacy_attempts.
//
//   POST /api/lab/literacy/:childId/next          { sitting_id?, min_status? }  -> the next question (key kept back)
//   POST /api/lab/literacy/sittings/:id/answer    { item_id, answers: [{ question_id, chosen }], hints_used }
//   GET  /api/lab/literacy/:childId/state                                       -> ladder summary + VR decision (dry run)
//
// Only text sources are dealt here: the literacy engine, the VR engine, the sentence bank and the reading texts.
// Listening, pictures and the trial set need audio or art the lab does not serve; their steps are skipped (gaps).

import crypto from 'node:crypto'
import { DateTime } from 'luxon'
import { nextProbe, RULES_VERSION } from './literacy/ladder.js'
import { entriesFor } from './literacy/catalog.js'
import { SENTENCE_ITEMS, SENTENCE_REVISION } from './literacy/sentenceBank.js'
import { generateItem as literacyItem } from './literacy/engine.js'
import STORIES from './literacy/readingStories.generated.json' with { type: 'json' }
import READING from './literacy/readingPreview.generated.json' with { type: 'json' }
import { literacyState, saveAttempt, vrDecision, loadAttempts } from './literacyEvidence.js'

export const LAB_ON = () => process.env.LITERACY_LAB === '1'
const SITTING_LENGTH = 10
const TEXTS = { 'reading-stories-200': STORIES.items, 'reading-passages': READING.items }
const SUPPORTED = new Set(['literacy-engine', 'vr-engine', 'sentence-bank', 'reading-stories-200', 'reading-passages'])

const supported = (minStatus) => (track, step) =>
  entriesFor(track, step, { minStatus }).some(e => SUPPORTED.has(e.source) && !(e.source === 'literacy-engine' && e.ref?.skill === 'build'))

// One source for the step, like catalog.pick but only among sources this lab can serve.
function pickSource(track, step, seed, { minStatus, avoid }) {
  const list = entriesFor(track, step, { minStatus })
    .filter(e => SUPPORTED.has(e.source) && !(e.source === 'literacy-engine' && e.ref?.skill === 'build'))
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
export async function dealItem(track, step, pick) {
  const base = { track, step, source: pick.source, format: pick.format }
  if (pick.source === 'sentence-bank') {
    const it = SENTENCE_ITEMS.find(x => x.id === pick.id)
    return { ...base, id: it.id, contentVersion: SENTENCE_REVISION, prompt: it.prompt,
      questions: [{ id: 'q0', options: it.options, key: [it.key], skill: step, group: it.id, family: 'sentence-bank', explain: it.feedback.text }] }
  }
  if (TEXTS[pick.source]) {
    const it = TEXTS[pick.source].find(x => x.id === pick.id)
    return { ...base, id: it.id, contentVersion: `${pick.source}:${it.id}`, passage: { title: it.title, text: it.passage },
      questions: it.questions.map((q, i) => ({
        id: `q${i}`, stem: q.stem, options: q.options.map((text, j) => ({ id: `o${j}`, text })), key: [`o${q.answer}`],
        // One text is one group: three questions give a skill one unit (ladder.js), each skill keeps its own.
        skill: q.op, group: `text:${it.id}`, family: pick.source, explain: q.evidence,
      })) }
  }
  if (pick.source === 'literacy-engine') {
    const q = literacyItem(pick.ref.skill, pick.ref.seed)
    return { ...base, id: `lit:${pick.ref.skill}:${pick.ref.seed}`, contentVersion: `${q.contentVersion}/${q.engineVersion}`,
      prompt: { text: q.prompt, stem: q.stem ?? null }, passage: q.passage ?? null,
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
        prompt: { stem_key: q.stem_key, ...q.prompt, pick: q.pick },
        // The answer word is the group: the same word met again under another seed is the same word.
        questions: [{ id: 'q0', options, key: q.correct.map(j => `o${j}`), skill: pick.ref.type, group: `vr:${pick.ref.type}:${answer}`,
          family: `vr:${pick.ref.type}`, explain: null }] }
    }
    return null
  }
  return null
}

export function publicItem(item) {
  return {
    id: item.id, track: item.track, step: item.step, format: item.format, prompt: item.prompt ?? null, passage: item.passage ?? null,
    questions: item.questions.map(q => ({ id: q.id, stem: q.stem ?? null, options: q.options, pick: q.key.length })),
  }
}

// Right only if exactly the key was chosen.
export function judge(question, chosen) {
  const got = [].concat(chosen ?? []).map(String).sort()
  const key = [...question.key].sort()
  return got.length === key.length && got.every((c, i) => c === key[i])
}

export function mountLiteracyLab(app, { supabase, tzForChild }) {
  const sittings = new Map()
  const gate = (req, res, next) => (LAB_ON() ? next() : res.status(404).json({ error: 'not found' }))
  app.use('/api/lab/literacy', gate)

  const childOf = async (id) => (await supabase.from('children').select('*').eq('id', id).maybeSingle()).data

  app.post('/api/lab/literacy/:childId/next', async (req, res) => {
    try {
      const child = await childOf(req.params.childId)
      if (!child) return res.status(404).json({ error: 'child not found' })
      const minStatus = ['draft', 'checked', 'approved'].includes(req.body?.min_status) ? req.body.min_status : 'checked'
      let sitting = sittings.get(req.body?.sitting_id)
      if (!sitting || sitting.childId !== child.id) {
        sitting = { id: crypto.randomUUID(), childId: child.id, minStatus, items: new Map(), dealt: 0 }
        sittings.set(sitting.id, sitting)
        if (sittings.size > 200) sittings.delete(sittings.keys().next().value)
      }
      if (sitting.dealt >= SITTING_LENGTH) return res.json({ sitting_id: sitting.id, done: true })
      const { state, missing } = await literacyState(supabase, child)
      if (missing) return res.status(503).json({ error: 'run server/migrations/2026-10-19_english_literacy_evidence.sql first' })
      const probe = nextProbe(state, { has: supported(sitting.minStatus), session: sitting.id })
      if (!probe) return res.json({ sitting_id: sitting.id, done: true, reason: 'no content at this status' })
      const { rows } = await loadAttempts(supabase, child.id)
      // Bank items already met (a text is stored as its group `text:<id>`) are not dealt again.
      const avoid = new Set(rows.map(r => String(r.grp).replace(/^text:/, '')))
      let item = null
      for (let k = 0; k < 8 && !item; k++) {
        const pick = pickSource(probe.track, probe.step, crypto.randomInt(1, 2 ** 30), { minStatus: sitting.minStatus, avoid })
        if (pick) item = await dealItem(probe.track, probe.step, pick)
      }
      if (!item) return res.status(500).json({ error: `could not deal ${probe.step}` })
      item.dealtId = crypto.randomUUID()
      sitting.items.set(item.dealtId, item)
      sitting.dealt++
      res.json({ sitting_id: sitting.id, n: sitting.dealt, of: SITTING_LENGTH, easy: probe.easy, item: { ...publicItem(item), id: item.dealtId } })
    } catch (err) {
      console.error('[LITERACY-LAB]', err.message)
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/lab/literacy/sittings/:id/answer', async (req, res) => {
    try {
      const sitting = sittings.get(req.params.id)
      if (!sitting) return res.status(404).json({ error: 'sitting not found' })
      const item = sitting.items.get(req.body?.item_id)
      if (!item) return res.status(404).json({ error: 'item not found' })
      if (item.answered) return res.status(409).json({ error: 'already answered' })
      const given = new Map((req.body?.answers || []).map(a => [a.question_id, a.chosen]))
      if (item.questions.some(q => !given.has(q.id))) return res.status(400).json({ error: 'answer every question' })
      item.answered = true
      const hinted = Number(req.body?.hints_used) > 0
      const day = DateTime.now().setZone(await tzForChild(sitting.childId)).toISODate()
      const results = []
      for (const q of item.questions) {
        const correct = judge(q, given.get(q.id))
        const saved = await saveAttempt(supabase, sitting.childId, {
          track: item.track, step: item.step, skill: q.skill, group: q.group, family: q.family,
          item: `${item.id}#${q.id}`, format: item.format, correct, independent: !hinted,
          hintsUsed: hinted ? 1 : 0, session: sitting.id, day, contentVersion: item.contentVersion, ruleVersion: RULES_VERSION,
        })
        if (!saved.ok) return res.status(saved.missing ? 503 : 500).json({ error: saved.error || 'migration not run' })
        results.push({ question_id: q.id, correct, key: q.key, explain: q.explain })
      }
      res.json({ results })
    } catch (err) {
      console.error('[LITERACY-LAB]', err.message)
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/lab/literacy/:childId/state', async (req, res) => {
    try {
      const child = await childOf(req.params.childId)
      if (!child) return res.status(404).json({ error: 'child not found' })
      const [{ summary, answers, missing }, vr] = await Promise.all([literacyState(supabase, child), vrDecision(supabase, child)])
      res.json({ answers, missing, summary, vr })
    } catch (err) {
      console.error('[LITERACY-LAB]', err.message)
      res.status(500).json({ error: err.message })
    }
  })
}
