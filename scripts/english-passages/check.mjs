// The full check on one finished item: gate, safety (twice, a flag in either run counts), pedagogy,
// blind solving with and without the text. Shared by the generator run and the trap-set measurement,
// so the traps test exactly the code that guards real passages.
import { gate } from './gate.mjs'
import { safetyReview, pedagogyReview, blindSolve } from './agents.mjs'

export const WITH_TEXT_RUNS = 2, NO_TEXT_RUNS = 3

export async function fullCheck(item, level, { names, skipGate = false, genre } = {}) {
  const g = gate(item, level, names)
  const out = { gate: g, safety: null, pedagogy: null, solve: null, problems: [], verdict: null }
  if (!g.ok && !skipGate) { out.problems = g.issues.map(i => `gate ${i.code}: ${i.detail}`); out.verdict = 'revise'; return out }

  const [s1, s2, ped, ...solves] = await Promise.all([
    safetyReview(item, genre), safetyReview(item, genre), pedagogyReview(item, level),
    ...Array.from({ length: WITH_TEXT_RUNS }, (_, run) => blindSolve(item, { withText: true, run })),
    ...Array.from({ length: NO_TEXT_RUNS }, (_, run) => blindSolve(item, { withText: false, run: run + 10 })),
  ])
  const flags = {}
  for (const s of [s1, s2]) for (const [k, v] of Object.entries(s.categories || {})) if (v?.flag) (flags[k] = flags[k] || []).push(v.quote)
  const other = [s1.other_concern, s2.other_concern].filter(x => x && x.trim() && !/^(none|no|n\/a)\.?$/i.test(x.trim()))
  out.safety = { flags, other, models: [s1.model, s2.model] }
  out.pedagogy = ped
  const withText = solves.slice(0, WITH_TEXT_RUNS), noText = solves.slice(WITH_TEXT_RUNS)
  out.solve = item.questions.map((_, i) => ({ withText: withText.map(r => r[i]), noText: noText.map(r => r[i]) }))

  // Regional wording is a language note, not a safety problem: the gate enforces the hard list, and the
  // reviewer's wider sense of "regional" (brilliant, practice, garden) goes to the person.
  const notes = []
  if (flags['regional-variety']) { notes.push(`regional? ${[...new Set(flags['regional-variety'])].join(' | ')}`); delete flags['regional-variety'] }
  const safetyProblems = Object.entries(flags).map(([k, q]) => `safety ${k}: ${[...new Set(q)].join(' | ')}`)
  const problems = []
  ;(ped.questions || []).forEach((q, i) => {
    for (const k of ['measures_op', 'single_correct', 'wrong_by_text', 'needs_text', 'reason_makes_sense'])
      if (q[k] === false) problems.push(`q${i + 1} pedagogy ${k}${q.note ? ` (${q.note})` : ''}`)
    // Weak distractors make an item easy, not wrong: shown to the person, not sent back.
    if (q.distractors_plausible === false) notes.push(`q${i + 1} weak distractors${q.note ? ` (${q.note})` : ''}`)
  })
  for (const k of ['natural', 'coherent', 'level_ok', 'story_quality']) if (ped.passage?.[k] === false) problems.push(`passage ${k}${ped.passage.note ? ` (${ped.passage.note})` : ''}`)
  out.solve.forEach((s, i) => {
    if (!s.withText.every(Boolean)) problems.push(`q${i + 1} solver missed it WITH the text (${s.withText.filter(Boolean).length}/${s.withText.length})`)
    // A strong model guesses far better than a seven-year-old, so its guess alone is a note. It is a
    // problem only when the reading specialist also says common sense answers it.
    if (s.noText.every(Boolean)) {
      if (ped.questions?.[i]?.needs_text === false) problems.push(`q${i + 1} solved WITHOUT the text ${s.noText.length}/${s.noText.length} (and the reviewer agrees)`)
      else notes.push(`q${i + 1} guessable by a strong model without the text`)
    }
  })
  out.problems = [...(skipGate ? g.issues.map(i => `gate ${i.code}: ${i.detail}`) : []), ...safetyProblems, ...problems]
  out.otherConcerns = other
  out.notes = notes
  // A safety flag is never repaired: the text is written again from nothing. A patched text keeps the
  // trace of what it was about. Everything else is sent back once with the list.
  out.verdict = safetyProblems.length ? 'regenerate' : problems.length ? 'revise' : 'pass'
  return out
}
