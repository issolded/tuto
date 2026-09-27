// The web app's own maths engine, bundled for the Android app (mobile/engine/build.mjs).
//
// There is one maths engine and it is the web's: the same curriculum plan, the same templates and
// the same figures. The Android app runs this bundle in QuickJS and only draws what it returns.
// A second engine written in Kotlin would drift from this one the first time a template was fixed
// on the web, and the templates are fixed often.
//
// Everything crosses the bridge as JSON: Kotlin calls TutoMath.buildSession(json) and gets a JSON
// string back. Figures are rendered here, with the web's React components, to SVG markup — so a
// chart or a clock on the tablet is drawn by exactly the code that draws it in the browser.
import { renderToStaticMarkup } from 'react-dom/server'
import MathGeometry from '../../src/components/MathGeometry'
import MathChart from '../../src/components/MathChart'
import MathFigure from '../../src/components/MathFigure'
import ClockFace from '../../src/components/ClockFace'
import { generateProblem } from '../../src/lib/mathTemplates'
import { planSession, templateTopicFor, startingLevelForAge, clampLevelToAge, yearLabelForAge } from '../../src/lib/mathCurriculum'
import { maxQuestionChars } from '../../src/lib/gemini'

// Figures the tablet draws itself: they are rows of emoji or a few labelled boxes laid out as
// HTML on the web, and an SVG renderer cannot lay out HTML. Everything else arrives as SVG.
const NATIVE_KINDS = new Set(['count', 'pictogram', 'shapes', 'prices', 'digital'])

function figure(visual, lang) {
  if (!visual) return null
  if (NATIVE_KINDS.has(visual.kind)) return { native: visual.kind }
  const el = visual.kind === 'clock' && visual.ask !== 'span'
    ? <ClockFace hour={visual.hour} minute={visual.minute} size={220} language={lang} />
    : (
      <>
        <MathGeometry visual={visual} language={lang} />
        <MathChart visual={visual} language={lang} />
        <MathFigure visual={visual} language={lang} />
      </>
    )
  const html = renderToStaticMarkup(el)
  // Some visuals belong to the help panel only (share, groups, array): the question card draws
  // nothing for them on the web either, and neither does the tablet.
  if (!html.trim()) return { none: true }
  const start = html.indexOf('<svg')
  const end = html.lastIndexOf('</svg>')
  if (start < 0 || end < 0) return null
  // One figure is one <svg>. Anything with two side by side would lose the second here, so it is
  // treated as not drawable and the question is not asked on the tablet.
  if (html.indexOf('<svg', start + 4) >= 0) return null
  return { svg: html.slice(start, end + 6) }
}

// A question is only asked if its picture can be drawn. The web asks nothing it cannot draw
// either; the tablet's list of drawable pictures is the same apart from HTML layouts it draws natively.
function drawable(p, lang) {
  if (!p.visual) return { ok: true, fig: null }
  let fig = null
  try { fig = figure(p.visual, lang) } catch (e) { return { ok: false, error: String(e && e.message || e) } }
  return { ok: !!fig, fig }
}

// Same comparison as MathScreen's sameAnswer: numbers compare as numbers, option text as text,
// and an empty answer is never right.
export function sameAnswer(given, expected) {
  if (given === null || given === undefined || String(given).trim() === '') return false
  const a = Number(String(given).trim())
  const b = Number(expected)
  if (!Number.isFinite(b)) return String(given).trim() === String(expected).trim()
  return Number.isFinite(a) && Math.abs(a - b) < 1e-9
}

// opts: { age, level (from /math-plan, may be null), weighting: { focusTopicId, weakTopicIds },
//         lang, seenTopics: [curriculum ids], seenKeys: [operand keys], count }
export function buildSession(opts) {
  const age = Number(opts.age) || 7
  const lang = opts.lang || 'en'
  const level = clampLevelToAge(opts.level ?? null, age) ?? startingLevelForAge(age)
  const weighting = opts.weighting || { focusTopicId: null, weakTopicIds: [] }
  const slots = planSession(age, opts.count || 10, opts.seenTopics || [], weighting)
    .map(t => ({ curriculum: t, templateTopic: templateTopicFor(t) }))
  const cap = maxQuestionChars(age)
  const usedOperands = new Set(opts.seenKeys || [])
  const usedTexts = new Set()
  const skipped = []

  const make = (templateTopic) => {
    // A handful of tries: a template draws its numbers at random, and a draw whose picture the
    // tablet cannot show is simply drawn again.
    for (let i = 0; i < 8; i++) {
      const p = generateProblem(templateTopic, level, usedOperands, lang, { maxChars: cap, avoidText: usedTexts })
      if (!p) return null
      const d = drawable(p, lang)
      if (d.ok) return { p, fig: d.fig && !d.fig.none ? d.fig : null }
    }
    return null
  }

  for (const slot of slots) {
    if (!slot.templateTopic) { skipped.push({ topic: slot.curriculum?.name, why: 'no template' }); continue }
    const got = make(slot.templateTopic)
    if (!got) { skipped.push({ topic: slot.curriculum?.name, why: 'figure not drawable' }); continue }
    slot.got = got
    usedOperands.add(got.p.operandKey)
    usedTexts.add(got.p.question_text)
  }

  // A slot left empty borrows a topic from the rest of this child's session, carrying that
  // topic's curriculum entry so the answer is recorded against what was really asked.
  const spares = slots.filter(s => s.got)
  for (const slot of slots) {
    if (slot.got || !spares.length) continue
    const spare = spares[Math.floor(Math.random() * spares.length)]
    const got = make(spare.templateTopic)
    if (!got) continue
    slot.curriculum = spare.curriculum
    slot.got = got
    usedOperands.add(got.p.operandKey)
    usedTexts.add(got.p.question_text)
  }

  const questions = slots.filter(s => s.got).map(s => {
    const p = s.got.p
    return {
      topic_id: s.curriculum?.id ?? null,
      topic_name: s.curriculum?.name ?? null,
      template: p.topic,
      question: p.question_text,
      answer: p.correct_answer,
      format: p.format === 'choice' ? 'choice' : p.format === 'decimal' ? 'decimal' : 'integer',
      options: Array.isArray(p.options) ? p.options.map(o => ({ value: String(o.value), label: String(o.label ?? o.value), why: o.why ?? null })) : null,
      hints: Array.isArray(p.hint_steps) ? p.hint_steps.map(String) : [],
      operand_key: p.operandKey ?? null,
      visual: p.visual ?? null,
      figure: s.got.fig,
    }
  })
  return { level, school_year: yearLabelForAge(age), questions, skipped }
}

// The Kotlin side only ever calls these three, with and for JSON strings.
globalThis.TutoMath = {
  buildSession: (json) => JSON.stringify(buildSession(JSON.parse(json))),
  sameAnswer: (given, expected) => sameAnswer(given, expected),
  // For tests and debugging: what the tablet would draw for one visual.
  figure: (json, lang) => JSON.stringify(figure(JSON.parse(json), lang || 'en')),
  startingLevel: (age) => startingLevelForAge(Number(age)),
}
