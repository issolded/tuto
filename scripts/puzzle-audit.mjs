// Every check on the puzzle engine that does not need a browser.
//
//   npm run puzzle:check
//
// validateQuestion, which runs before a child sees anything, asks whether a question is
// internally well formed: four different pictures, one 3-1 split, no invisible rule. This file
// asks the questions it cannot. Each section below exists because the thing it looks for
// actually shipped and was found here, not by reading the code:
//
//   · the answer to a `belongs` question never landed in the first slot, so "never the first
//     one" beat chance without reading a figure
//   · a `sequence` posed four copies of the same picture and asked what came next, because the
//     cycle was drawn from a pool that repeats values to weight them
//   · noise landed on an attribute that suppresses the rule attribute, so the picture split
//     1-1-2 while the raw specs split 3-1
//
// Nothing here calls a model or a network. It is deterministic: the same seeds every run, so a
// regression is a diff and not a coin flip.

import { installStubFonts } from './lib/stub-fonts.mjs'

// The pictorial question types are withheld unless their pinned font has loaded, which is
// correct and means node would otherwise exercise only a third of the engine. The stub is a
// FontFaceSet faithful enough for src/lib/fontGate.js — see the note there.
installStubFonts()

const { BANDS, BAND_KEYS, generateQuestion, generateSession, validateQuestion } =
  await import('../src/lib/puzzleTemplates.js')
const { groupOf, GLYPH_RELATIONS } = await import('../src/lib/puzzleGlyphs.js')
const { iconGroupOf } = await import('../src/lib/puzzleIcons.js')
const { geometryKey } = await import('../src/lib/puzzleFigures.js')

const DRAWS = Number(process.env.PUZZLE_AUDIT_DRAWS || 4000)
const findings = []
const fail = (band, kind, detail) => findings.push(`[${band}] ${kind}: ${detail}`)

const val = (v) => (v && typeof v === 'object' ? JSON.stringify(v) : String(v))
const grp = (s) => (s.kind === 'glyph' ? groupOf(s.glyph) : s.kind === 'icon' ? iconGroupOf(s.icon) : null)
const sourceOf = (t) => (t.startsWith('glyph') ? 'glyph' : t.startsWith('icon') ? 'icon' : 'geometric')

for (const band of BAND_KEYS) {
  const qs = []
  for (let i = 0; i < DRAWS; i++) {
    const q = generateQuestion(band, null, 6_100_000 + i * 79)
    if (q) qs.push(q)
  }
  if (qs.length < DRAWS * 0.98) fail(band, 'generation', `only ${qs.length} of ${DRAWS} draws produced a question`)

  // ── every question is still well formed ──────────────────────────────────────
  for (const q of qs) {
    const why = validateQuestion(q)
    if (why) { fail(band, 'invalid', `${q.type}: ${why}`); break }
  }

  // ── every type the band declares can actually be built ───────────────────────
  for (const t of [...BANDS[band].types, ...BANDS[band].glyphTypes, ...BANDS[band].iconTypes]) {
    let built = 0
    for (let i = 0; i < 200; i++) if (generateQuestion(band, t, 50_000 + i * 17)) built++
    if (built < 200) fail(band, 'type', `${t} built ${built}/200`)
  }

  // ── the mix matches what the band declares ───────────────────────────────────
  const mix = {}
  for (const q of qs) mix[sourceOf(q.type)] = (mix[sourceOf(q.type)] || 0) + 1
  const weights = BANDS[band].sources
  const totalWeight = Object.values(weights).reduce((a, c) => a + c, 0)
  for (const [src, w] of Object.entries(weights)) {
    const want = w / totalWeight
    const got = (mix[src] || 0) / qs.length
    if (Math.abs(got - want) > 0.05) {
      fail(band, 'mix', `${src} is ${(got * 100).toFixed(0)}%, declared ${(want * 100).toFixed(0)}%`)
    }
  }

  // ── the answer does not favour a slot ────────────────────────────────────────
  const slots = {}
  for (const q of qs) (slots[q.type] ??= [0, 0, 0, 0])[q.correct_index]++
  for (const [type, counts] of Object.entries(slots)) {
    const n = counts.reduce((a, c) => a + c, 0)
    if (n < 60) continue
    const hi = Math.max(...counts) / n
    const lo = Math.min(...counts) / n
    if (hi > 0.35 || lo < 0.15) {
      fail(band, 'answer-position', `${type}: ${counts.map(c => (c / n * 100).toFixed(0) + '%').join('/')} of ${n}`)
    }
  }

  // ── every attribute the band lists is actually used for something ────────────
  const rules = new Set(qs.map(q => q.rule.attr))
  for (const attr of BANDS[band].attributes) {
    if (![...rules].some(r => r === attr || r.includes(attr))) {
      fail(band, 'dead-attribute', `${attr} is configured but never carries a rule`)
    }
  }

  // ── the answer really answers the question ───────────────────────────────────
  for (const q of qs) {
    const ans = q.options[q.correct_index].spec
    const others = q.options.filter((_, k) => k !== q.correct_index).map(o => o.spec)
    let why = null

    if (q.type === 'odd-one-out') {
      const v = (s) => val(s[q.rule.attr])
      if (others.some(s => v(s) === v(ans))) why = 'the answer shares the rule value with a distractor'
      else if (new Set(others.map(v)).size !== 1) why = 'the three non-answers do not agree'
    } else if (q.type === 'glyph-odd' || q.type === 'icon-odd') {
      if (others.some(s => grp(s) === grp(ans))) why = `the answer's group ${grp(ans)} is shared`
      else if (new Set(others.map(grp)).size !== 1) why = 'the three non-answers are not one group'
    } else if (q.type === 'belongs') {
      const want = val(q.prompt[0][q.rule.attr])
      if (val(ans[q.rule.attr]) !== want) why = 'the answer does not match the prompt'
      else if (others.some(s => val(s[q.rule.attr]) === want)) why = 'a distractor also belongs'
    } else if (q.type === 'glyph-belongs' || q.type === 'icon-belongs') {
      const want = grp(q.prompt[0])
      if (q.prompt.some(c => grp(c) !== want)) why = 'the prompt figures are not one group'
      else if (grp(ans) !== want) why = `the answer is ${grp(ans)}, the prompt is ${want}`
      else if (others.some(s => grp(s) === want)) why = 'a distractor is also in the group'
    } else if (q.type === 'identical') {
      const target = geometryKey(q.prompt[0])
      if (geometryKey(ans) !== target) why = 'the answer is not the target'
      else if (others.some(s => geometryKey(s) === target)) why = 'a distractor also matches the target'
    } else if (q.type === 'glyph-analogy') {
      const [a, b, c] = q.prompt
      const rel = Object.entries(GLYPH_RELATIONS)
        .find(([, r]) => r.pairs.some(([x, y]) => x === a.glyph && y === b.glyph))?.[0]
      if (!rel) why = 'the shown pair is in no relation'
      else {
        const partner = GLYPH_RELATIONS[rel].pairs.find(([x]) => x === c.glyph)?.[1]
        if (!partner) why = `${c.glyph} has no partner under ${rel}`
        else if (ans.glyph !== partner) why = `the answer is ${ans.glyph} but ${rel} gives ${partner}`
      }
    } else if (q.type === 'sequence' || q.type === 'icon-sequence') {
      // Nothing else in the pipeline ever looks at the prompt, so a run with no visible rule in
      // it reaches a child unchallenged.
      const keys = q.prompt.map(c => (c.kind ? JSON.stringify(c) : geometryKey(c)))
      if (new Set(keys).size < 2) why = `the prompt is ${q.prompt.length} identical figures`
    }

    if (why) { fail(band, 'answer', `${q.type} (rule ${q.rule.attr}): ${why}`); break }
  }

  // ── the `why` label on each wrong option names an attribute that is real ────
  // Nothing reads these yet; a help panel will, and a label naming the wrong attribute teaches
  // a child the wrong lesson about their own mistake — worse than saying nothing. The sentence
  // differs by type (see the note in puzzleTemplates), so the test does too: in `identical` a
  // labelled option must DIFFER from the target on that attribute, while in `odd-one-out` it
  // must MATCH the other non-answers on it — the first check written here got that backwards
  // and reported three sound questions.
  for (const q of qs) {
    const ans = q.options[q.correct_index].spec
    if (ans.kind) continue
    let wrong = null
    if (q.options[q.correct_index].why) wrong = 'the correct option carries a why label'
    q.options.forEach((o, k) => {
      if (wrong || k === q.correct_index || !o.why || o.why === 'both') return
      if (!(o.why in o.spec)) { wrong = `"${o.why}" is not an attribute`; return }
      if (q.type === 'identical') {
        if (val(o.spec[o.why]) === val(ans[o.why])) wrong = `"${o.why}" matches the target on a distractor`
      } else if (q.type === 'odd-one-out') {
        const peer = q.options.find((_, j) => j !== k && j !== q.correct_index)?.spec
        if (peer && val(o.spec[o.why]) !== val(peer[o.why])) wrong = `"${o.why}" differs between two non-answers`
      }
    })
    if (wrong) { fail(band, 'why-label', `${q.type}: ${wrong}`); break }
  }

  // ── what a child actually meets, rather than a long synthetic run ────────────
  const seen = new Set()
  let sameDay = 0, total = 0
  for (let day = 0; day < 30; day++) {
    const today = new Set()
    for (let s = 0; s < 2; s++) {
      for (const q of generateSession(band, 10, day * 1000 + s * 37 + 5)) {
        const sig = `${q.type}|${q.rule.attr}|${JSON.stringify(q.options[q.correct_index].spec)}`
        total++
        if (today.has(sig)) sameDay++
        today.add(sig); seen.add(sig)
      }
    }
  }
  if (sameDay > total * 0.02) fail(band, 'repeats', `${sameDay} repeats within a day over ${total} questions`)
  console.log(`${band.padEnd(6)} ${qs.length} draws · mix ${Object.entries(mix).map(([k, v]) => `${k} ${(v / qs.length * 100).toFixed(0)}%`).join(' ')} · 30 days: ${seen.size} distinct of ${total}, ${sameDay} same-day repeat`)
}

// ── the gate fails closed ─────────────────────────────────────────────────────
// With no fonts, every pictorial type must disappear rather than render in whatever the device
// happened to have.
delete globalThis.document
const closed = generateSession('7-8', 40, 3)
if (!closed.every(q => sourceOf(q.type) === 'geometric')) {
  findings.push('[gate] pictorial questions leaked through with no font loaded')
}

if (findings.length) {
  console.error(`\n✗ ${findings.length} finding${findings.length > 1 ? 's' : ''}:`)
  for (const f of findings) console.error(`  ${f}`)
  process.exit(1)
}
console.log('\n✓ no findings')
