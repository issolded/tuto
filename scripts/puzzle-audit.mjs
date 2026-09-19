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
//   · three in four mirror questions marked a figure that was not the mirror image, and half the
//     symmetry questions asked for the figure WITH a line and marked the one without. Both
//     passed here, because the checks re-derived the answer with the generator's own idea of a
//     mirror. Found by a review from outside the code (Codex), not by this file — which is why
//     the answer checks now read the drawing (scripts/lib/drawn-geometry.mjs), and why every
//     one of them is itself tested by moving the key to a wrong option and expecting a finding.
//
// Nothing here calls a model or a network. It is deterministic: the same seeds every run, so a
// regression is a diff and not a coin flip.

import { installStubFonts } from './lib/stub-fonts.mjs'

// The pictorial question types are withheld unless their pinned font has loaded, which is
// correct and means node would otherwise exercise only a third of the engine. The stub is a
// FontFaceSet faithful enough for src/lib/fontGate.js — see the note there.
installStubFonts()

const { BANDS, BAND_KEYS, BOOK_COVERAGE, NEEDS_FIXED, figureKey, generateQuestion, generateSession, validateQuestion, questionSignature } =
  await import('../src/lib/puzzleTemplates.js')
const { groupOf, GLYPH_GROUPS, GLYPH_RELATIONS, POSED_TRAIT_KEYS: TRAIT_KEYS, traitValue, traitConflict } =
  await import('../src/lib/puzzleGlyphs.js')
const { iconGroupOf, ICON_GROUPS } = await import('../src/lib/puzzleIcons.js')
const { ATTRIBUTES, geometryKey, normalizeSpec } = await import('../src/lib/puzzleFigures.js')
const { drawn, mirrorImage, sameDrawing, hasLineOfSymmetry } = await import('./lib/drawn-geometry.mjs')

const DRAWS = Number(process.env.PUZZLE_AUDIT_DRAWS || 4000)
const findings = []
const fail = (band, kind, detail) => findings.push(`[${band}] ${kind}: ${detail}`)

const val = (v) => (v && typeof v === 'object' ? JSON.stringify(v) : String(v))
const grp = (s) => (s.kind === 'glyph' ? groupOf(s.glyph) : s.kind === 'icon' ? iconGroupOf(s.icon) : null)
const sourceOf = (t) => (t.startsWith('glyph') ? 'glyph' : t.startsWith('icon') ? 'icon' : 'geometric')

// `why` labels that name a property computed from the figure rather than a field stored on it.
const DERIVED_LABELS = new Set(['symmetry', 'flip', 'group', 'trait', 'relation', 'order'])

// How to read a rule attribute off one figure. A SLOT attribute — a half, a corner mark, the
// filled satellite — is read off the DRAWING, as the direction the mark sits from the centre of
// the box, because that is what the child compares. The spec said "top-left" on three figures
// turned three different ways, and the checks agreed with the spec for as long as they read it.
const SLOT_TAG = { half: 'half', corner: 'c', position: 'P' }
function readRule(attr) {
  if (!SLOT_TAG[attr]) return (s) => val(s[attr])
  return (s) => {
    const p = drawn(s).points.find(pt => pt.tag === SLOT_TAG[attr])
    return p ? String(((Math.round(Math.atan2(p.y - 50, p.x - 50) * 180 / Math.PI / 45) * 45) + 360) % 360) : 'none'
  }
}

// Whether the marked answer is the one the page implies, read the way a child has to read it.
// Returns null when it is, or what is wrong.
function answerProblem(q) {
  const ans = q.options[q.correct_index].spec
  const others = q.options.filter((_, k) => k !== q.correct_index).map(o => o.spec)
  let why = null

  if (q.type === 'odd-one-out') {
    const v = readRule(q.rule.attr)
    if (others.some(s => v(s) === v(ans))) why = 'the answer shares the rule value with a distractor'
    else if (new Set(others.map(v)).size !== 1) why = 'the three non-answers do not agree'
  } else if (q.type === 'analogy') {
    // Read off the page. Whatever changes from A to B, as drawn, is the transform; the answer is
    // C with that carried across, and it must be the only option that is. The rule is then held
    // to the picture: a step it names has to be one of the changes the child can see, and the
    // picture may not change anything the rule does not name. The old check compared the named
    // steps' fields and nothing else, so an option that got the steps right and moved a third
    // attribute passed as the answer too.
    const [a, b, c] = q.prompt
    const n = (s) => normalizeSpec(s)
    const diff = (x, y) => ATTRIBUTES.filter(k => val(n(x)[k]) !== val(n(y)[k]))
    const across = diff(a, b)
    const steps = q.rule.attr.split('+')
    const blank = { ...c }
    for (const k of across) blank[k] = b[k]
    if (across.slice().sort().join() !== steps.slice().sort().join()) {
      why = `the rule says ${steps.join('+')} and A→B shows ${across.join('+') || 'nothing'}`
    } else if (diff(c, ans).sort().join() !== across.slice().sort().join()) {
      why = `A→B shows ${across.join('+')} and C→answer shows ${diff(c, ans).join('+') || 'nothing'}`
    } else if (geometryKey(ans) !== geometryKey(blank)) why = 'the answer is not C with the A→B change carried across'
    else if (others.some(s => geometryKey(s) === geometryKey(blank))) why = 'a distractor is also C with the change carried across'
    else {
      // Each step has to be visible by itself — a field can change on two specs that draw the
      // same picture, and then the step is in the rule and not on the page.
      for (const x of steps) {
        if (geometryKey({ ...b, [x]: a[x] }) === geometryKey(b)) { why = `the step ${x} is not visible between A and B`; break }
        if (geometryKey({ ...ans, [x]: c[x] }) === geometryKey(ans)) { why = `the step ${x} is not visible between C and the answer`; break }
      }
    }
  } else if (q.type === 'symmetry') {
    // Read against the STEM, which is what the child reads — not against `rule`, which only the
    // generator reads. The check used to compare the answer with the distractors and never
    // asked which side the question was on, so "which one has a line of symmetry?" with the one
    // figure WITHOUT a line marked correct passed every time.
    //
    // And the line is any line. The old predicate toggled `flip`, which tests one axis — the
    // figure's own vertical — and filed a hexagon turned 45° as having no symmetry at all.
    const wantSymmetric = { puzzle_stem_symmetry: true, puzzle_stem_symmetry_none: false }[q.stem_key]
    const sym = (s) => hasLineOfSymmetry(s)
    if (wantSymmetric === undefined) why = `stem ${q.stem_key} does not say which side is asked`
    else if (sym(ans) !== wantSymmetric) why = `the stem asks for ${wantSymmetric ? 'a figure with' : 'the figure without'} a line of symmetry and the answer is not one`
    else if (others.some(s => sym(s) === wantSymmetric)) why = 'a distractor also answers the stem'
  } else if (q.type === 'code') {
    // Rebuilt from the page alone, the way a child has to: read each shown figure's two
    // attribute values off its label, then look up the figure being asked about. Three ways
    // this can be wrong and all three are silent — the letters are not a function of the
    // attribute (the same value labelled two ways), a value in the answer never appears
    // labelled anywhere (unanswerable, not hard), or the figure being asked about is already
    // on display (a lookup, not reasoning).
    const [a1, a2] = q.rule.attr.slice(5).split('+')
    const ask = q.prompt[q.prompt.length - 1]
    const shown = q.prompt.slice(0, -1)
    const labels = q.promptLabels.slice(0, -1)
    const m1 = new Map(); const m2 = new Map()
    shown.forEach((s, k) => { m1.set(val(s[a1]), labels[k][0]); m2.set(val(s[a2]), labels[k][1]) })
    const clash = shown.find((s, k) => m1.get(val(s[a1])) !== labels[k][0] || m2.get(val(s[a2])) !== labels[k][1])
    if (clash) why = 'a letter is not a function of the attribute it encodes'
    else if (!m1.has(val(ask[a1]))) why = `the answer's ${a1} value never appears with a letter`
    else if (!m2.has(val(ask[a2]))) why = `the answer's ${a2} value never appears with a letter`
    else if (q.options[q.correct_index].code !== m1.get(val(ask[a1])) + m2.get(val(ask[a2]))) {
      why = `the answer is ${q.options[q.correct_index].code}, the prompt implies ${m1.get(val(ask[a1])) + m2.get(val(ask[a2]))}`
    } else if (shown.some(s => geometryKey(s) === geometryKey(ask))) {
      why = 'the figure being asked about is already on display, so its code can be copied'
    }
  } else if (q.type === 'reflection') {
    // Re-derived rather than taken on trust, and the second line is the one that matters: a
    // figure symmetric about the vertical axis IS its own mirror image, so the question would
    // have a correct answer and four distractors that are all equally correct-looking, with
    // nothing on screen to tell them apart.
    //
    // The mirror is taken in SCREEN space, across the dashed vertical line the lab draws — see
    // scripts/lib/drawn-geometry.mjs for why it may not be `flip` toggled on the spec.
    const want = mirrorImage(drawn(q.prompt[0]))
    if (!sameDrawing(drawn(ans), want)) why = 'the answer is not the prompt seen in a vertical mirror'
    else if (others.some(s => sameDrawing(drawn(s), want))) why = 'a distractor is also the mirror image'
    else if (sameDrawing(drawn(q.prompt[0]), want)) why = 'the figure is its own mirror image'
  } else if (q.type === 'glyph-trait') {
    // The category reading and the property reading are both checked, because the question is
    // only about the property while the category says nothing. Then every OTHER trait of that
    // group is asked whether it singles out a different picture — the second defensible answer
    // that total partitions exist to make findable.
    const key = q.rule.attr.split(':')[1]
    const v = (s) => traitValue(key, s.glyph)
    const glyphs = q.options.map(o => o.spec.glyph)
    if (v(ans) === null) why = `the answer ${ans.glyph} is outside trait ${key}`
    else if (others.some(s => v(s) === v(ans))) why = 'a distractor is on the answer\'s side of the trait'
    else if (new Set(others.map(v)).size !== 1) why = 'the non-answers do not agree on the trait'
    else if (new Set(q.options.map(o => grp(o.spec))).size !== 1) {
      why = 'the options are not all one group, so the category answers it'
    } else {
      const clash = traitConflict(glyphs, key, ans.glyph)
      if (clash) why = `trait ${clash} singles out a different option`
    }
  } else if (q.type === 'glyph-odd' || q.type === 'icon-odd') {
    if (others.some(s => grp(s) === grp(ans))) why = `the answer's group ${grp(ans)} is shared`
    else if (new Set(others.map(grp)).size !== 1) why = 'the three non-answers are not one group'
  } else if (q.type === 'belongs') {
    const v = readRule(q.rule.attr)
    const want = v(q.prompt[0])
    if (q.prompt.some(s => v(s) !== want)) why = 'the prompt figures do not agree on the rule'
    else if (v(ans) !== want) why = 'the answer does not match the prompt'
    else if (others.some(s => v(s) === want)) why = 'a distractor also belongs'
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
  } else if (q.type === 'grid-complete') {
    // Read off the three cells the way a child does: whatever changes along the top row is what
    // a column means, whatever changes down the left column is what a row means, and the blank
    // is the top-left cell with both carried in. If one attribute changes both ways the grid has
    // no single reading.
    const [tl, tr, bl] = q.prompt
    const n = (s) => normalizeSpec(s)
    const across = Object.keys(tl).filter(k => val(n(tr)[k]) !== val(n(tl)[k]))
    const down = Object.keys(tl).filter(k => val(n(bl)[k]) !== val(n(tl)[k]))
    const blank = { ...tl }
    for (const k of across) blank[k] = tr[k]
    for (const k of down) blank[k] = bl[k]
    if (!across.length || !down.length) why = 'a row or column of the grid shows no change'
    else if (across.some(k => down.includes(k))) why = 'one attribute changes both across and down'
    else if (geometryKey(ans) !== geometryKey(blank)) why = 'the answer is not what the row and column imply'
    else if (others.some(s => geometryKey(s) === geometryKey(blank))) why = 'a distractor is also what the grid implies'
  } else if (q.type === 'sequence' || q.type === 'icon-sequence' || q.type === 'glyph-sequence') {
    // Nothing else in the pipeline ever looks at the prompt, so a run with no visible rule in
    // it reaches a child unchallenged.
    const keys = q.prompt.map(figureKey)
    if (new Set(keys).size < 2) why = `the prompt is ${q.prompt.length} identical figures`

    // A picture cycle is the one sequence whose answer can be re-derived from the prompt
    // alone, so it is, rather than taken on the generator's word. The period is read back off
    // the run — the smallest p that the whole prompt repeats on — and the next term is then
    // the one p places before the end. It also catches a prompt that is not periodic at all,
    // which would leave a child with a run that has no next term.
    //
    // Read off the drawn pictures, so it holds for every sequence family and not only glyphs —
    // shape and icon runs had no answer check at all until the mutation check below asked.
    // A progression (7-8) is not periodic: each figure is the last moved one step. Re-derived the
    // same way — the step read off the run, the next term computed, the answer checked against it.
    if (!why && q.rule?.step !== undefined) {
      const a = q.rule.attr
      const v = q.prompt.map(s => normalizeSpec(s)[a])
      const d = (x, y) => (a === 'rotation' ? (((y - x) % 360) + 540) % 360 - 180 : y - x)
      const steps = v.slice(1).map((x, i) => d(v[i], x))
      const next = { ...q.prompt[q.prompt.length - 1], [a]: a === 'rotation' ? (v[v.length - 1] + steps[0] + 360) % 360 : v[v.length - 1] + steps[0] }
      if (steps.some(x => x !== steps[0]) || !steps[0]) why = 'the run does not move by one steady step'
      else if (geometryKey(ans) !== geometryKey(next)) why = 'the answer is not the next step of the run'
      else if (others.some(s => geometryKey(s) === geometryKey(next))) why = 'a distractor is also the next step'
    } else if (!why) {
      const p = keys.map((_, k) => k).slice(1).find(k => keys.every((c, i) => i < k || c === keys[i - k]))
      const next = p && keys[keys.length - p]
      if (!p) why = 'the prompt does not repeat on any period'
      else if (figureKey(ans) !== next) why = `the cycle of ${p} gives a different picture from the answer`
      else if (others.some(s => figureKey(s) === next)) why = 'a distractor is also the next term'
    }
    if (!why && q.type === 'glyph-sequence') {
      if (new Set(q.options.map(o => grp(o.spec))).size !== 1) {
        why = 'the options are not all from one group, so the run is answerable by category'
      }
    }
  }

  return why
}

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

  // ── every question offers the number of options the band declares ───────────
  // The 5-6 papers use a–d and every band above them a–e. A generator that quietly produces
  // four where the band says five is not caught anywhere else: every other check reads the
  // length off the question itself and agrees with whatever it finds.
  for (const q of qs) {
    if (q.options.length !== BANDS[band].options) {
      fail(band, 'options', `${q.type} offers ${q.options.length}, band declares ${BANDS[band].options}`)
      break
    }
  }

  // ── every type can be built, and none of them favours a slot ─────────────────
  // Both questions are asked of each type DIRECTLY rather than of the sweep above, because the
  // sweep deals types in the band's declared mix and the rare ones come out too thin to judge.
  // Read off a 4000-draw sweep, glyph-belongs got about 140 draws, where one slot landing at 12%
  // against an even 20% is under three of its own standard deviations — noise, reported as a
  // finding. Asked directly for its own sample it is flat to a tenth of a percent.
  //
  // 2500 is enough to judge a slot bias well outside noise — at five options a seven-point
  // deviation is nine standard deviations — without the run growing without limit as bands are
  // added. Five bands times fourteen types is already a third of a million questions.
  const PER_TYPE = 2500
  for (const t of [...BANDS[band].types, ...BANDS[band].glyphTypes, ...BANDS[band].iconTypes]) {
    let built = 0
    const counts = new Array(BANDS[band].options).fill(0)
    for (let i = 0; i < PER_TYPE; i++) {
      const q = generateQuestion(band, t, 50_000 + i * 17)
      if (q) { built++; counts[q.correct_index]++ }
    }
    if (built < PER_TYPE) { fail(band, 'type', `${t} built ${built}/${PER_TYPE}`); continue }

    // Even is 1/n, and a slot is suspicious when it is half again above that or a third below —
    // 25%/12.5% at four options, 20%/10% at five, rather than one pair of numbers pretending to
    // fit both. At this sample either bound is a long way outside noise.
    const even = 1 / counts.length
    const hi = Math.max(...counts) / built
    const lo = Math.min(...counts) / built
    if (hi > even * 1.5 || lo < even * 0.65) {
      fail(band, 'answer-position', `${t}: ${counts.map(c => (c / built * 100).toFixed(0) + '%').join('/')} of ${built}`)
    }
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

  // ── every attribute the band lists carries a real share of the rules ────────
  // This asked "did it happen at all", which is true at one draw in four thousand — and that is
  // what `corner` was doing in two of the three bands, with `dots` at nine. An attribute a child
  // meets once a year is configured, not used, and the check passed it for years.
  //
  // The bar is a TENTH of an even share rather than a third, because these attributes are not
  // equals and should not be forced to be. `corner` needs a ground that is not split, nested or
  // dotted, so it will always be rarer than `size`, which works on anything. A tenth is low
  // enough to allow that and high enough that one-in-four-thousand fails it by a hundredfold.
  const attrCount = {}
  let attrTotal = 0
  for (const q of qs) {
    for (const attr of BANDS[band].attributes) {
      if (q.rule.attr === attr || q.rule.attr.split(/[+:]/).includes(attr)) {
        attrCount[attr] = (attrCount[attr] || 0) + 1
        attrTotal++
      }
    }
  }
  const evenShare = 1 / BANDS[band].attributes.length
  for (const attr of BANDS[band].attributes) {
    const share = (attrCount[attr] || 0) / attrTotal
    if (share < evenShare / 10) {
      fail(band, 'starved-attribute',
        `${attr} carries ${(share * 100).toFixed(2)}% of the rules, even is ${(evenShare * 100).toFixed(0)}%`)
    }
  }

  // ── every GROUP can actually be the subject of a question ───────────────────
  // A category question needs as many members inside the group as the band offers options, and
  // one fewer outside it. A group with three members can therefore be neither the set nor the
  // foil once a band offers five — and `music` and `sport` sat out every band above 5-6 on
  // exactly that arithmetic, for as long as those bands have existed.
  //
  // Nothing saw it. The type check asks whether icon-odd can be built, and it can, out of the
  // other five groups; the mix check counts icons, not which icons. A vocabulary the config
  // lists and no question can reach is the same failure as a dead attribute, one level up.
  for (const [label, groups, types] of [
    ['glyph', GLYPH_GROUPS, BANDS[band].glyphTypes.filter(t => t === 'glyph-odd' || t === 'glyph-belongs')],
    ['icon', ICON_GROUPS, BANDS[band].iconTypes.filter(t => t === 'icon-odd' || t === 'icon-belongs')],
  ]) {
    if (!types.length) continue
    for (const [key, g] of Object.entries(groups)) {
      const members = (g.glyphs ?? g.icons).length
      if (members < BANDS[band].options) {
        fail(band, 'unreachable-group',
          `${label} group ${key} has ${members} members, so it can never be the set in a band of ${BANDS[band].options}`)
      }
    }
  }

  // ── and so is every trait, which is a separate question ──────────────────────
  // A trait can be starved by something no attribute can be: the conflict filter. `flies` was
  // configured, correct, and reachable, and still landed on 3% of its own type against an even
  // share of 12% -- because of the thirty-five ways to pick four non-fliers only five avoid
  // colliding with another vehicle trait, and one draw per question threw the rest away. That is
  // a rule a child would meet once in several hundred sessions, which is the same as not having
  // it, and nothing above would have said so. Measured per type, not over the sheet, for the
  // reason the position check is.
  if (BANDS[band].glyphTypes.includes('glyph-trait')) {
    const byTrait = {}
    let n = 0
    for (let i = 0; i < 4000; i++) {
      const q = generateQuestion(band, 'glyph-trait', 61_000 + i * 11)
      if (!q) continue
      n++
      byTrait[q.rule.attr.slice(6)] = (byTrait[q.rule.attr.slice(6)] || 0) + 1
    }
    for (const key of TRAIT_KEYS) {
      const share = (byTrait[key] || 0) / n
      // A third of an even share. Below that a trait is configured rather than used.
      if (share < (1 / TRAIT_KEYS.length) / 3) {
        fail(band, 'starved-trait', `${key} carries ${(share * 100).toFixed(1)}% of glyph-trait, even is ${(100 / TRAIT_KEYS.length).toFixed(0)}%`)
      }
    }
  }

  // ── the answer really answers the question ───────────────────────────────────
  for (const q of qs) {
    const why = answerProblem(q)
    if (why) { fail(band, 'answer', `${q.type} (rule ${q.rule.attr}): ${why}`); break }
  }

  // ── and every check above can tell the answer from a wrong option ───────────
  // A check that passes a question whose key has been moved to a distractor is not checking
  // the answer. That is how the mirror questions got through: the check toggled `flip` the way
  // the generator did, so it agreed with whatever the generator marked. Asked per type, directly,
  // for the reason the position check is — and a type with no answer check at all fails here
  // rather than passing silently, which is what sequences and grids were doing.
  //
  // Only the generator's OWN answer has to pass first; the mutation is then every other slot.
  const PER_TYPE_ANSWER = 400
  for (const t of [...BANDS[band].types, ...BANDS[band].glyphTypes, ...BANDS[band].iconTypes]) {
    let wrong = null
    for (let i = 0; i < PER_TYPE_ANSWER && !wrong; i++) {
      const q = generateQuestion(band, t, 70_000 + i * 23)
      if (!q) continue
      const why = answerProblem(q)
      if (why) { wrong = `seed ${q.seed}: ${why}`; fail(band, 'answer', `${t} (rule ${q.rule.attr}) ${wrong}`); break }
      for (let k = 0; k < q.options.length; k++) {
        if (k === q.correct_index) continue
        if (!answerProblem({ ...q, correct_index: k })) {
          wrong = `seed ${q.seed}: the check also accepts option ${k} as the answer`
          fail(band, 'answer-check', `${t} (rule ${q.rule.attr}) ${wrong}`)
          break
        }
      }
    }
  }

  // ── no question moves two attributes that have to be read against each other ─
  // NEEDS_FIXED names the pairs: `position` is a slot in the figure's own frame and means
  // nothing while the figure turns; `stretch` is applied before the rotation, so narrowing and
  // turning at once give a silhouette that reads as neither. Generators bar these pairs at four
  // separate points (grid's two axes, an analogy's second step, what makes C differ from A, the
  // spare distractors, a code's two axes) and this is the one place that says so once.
  for (const q of qs) {
    const moving = q.rule.attr.split(/[+:]/)
    const clash = moving.find(a => moving.some(b => (NEEDS_FIXED[a] || []).includes(b)))
    if (clash) {
      fail(band, 'held-apart', `${q.type} moves ${q.rule.attr} — ${clash} has to be held still while the other moves`)
      break
    }
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
    // A code question's options are strings and have no spec at all, so there is no attribute
    // for a label to name. Checked before `ans.kind`, which would throw on undefined.
    if (!ans || ans.kind) continue
    let wrong = null
    if (q.options[q.correct_index].why) wrong = 'the correct option carries a why label'
    q.options.forEach((o, k) => {
      if (wrong || k === q.correct_index || !o.why || o.why === 'both') return
      // A label may name a DERIVED property rather than a stored one. `symmetry` is not a field
      // on any spec — it is a question asked of the drawn figure, whether mirroring it gives the
      // same picture — so requiring it to be a spec key reported every symmetry question as
      // broken. The glyph and icon families have labels like this too (`group`, `trait`,
      // `relation`, `order`) and escape only because their specs carry a `kind` and are skipped
      // above; the geometric ones had no such exit.
      if (DERIVED_LABELS.has(o.why)) return
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
  // Measured with the engine's OWN signature, which is the point: this is a check on the
  // deduplication, and it used to build a rival signature out of JSON.stringify(spec). A
  // geometric spec stringifies with all its noise attributes and a glyph spec has none, so that
  // version rated a shapes-heavy band far more varied than a pictures-heavy one for a reason no
  // child would recognise — and made inverting 7-8 look like it cut variety by a third.
  const seen = new Set()
  let sameDay = 0, total = 0
  for (let day = 0; day < 30; day++) {
    const today = new Set()
    for (let s = 0; s < 2; s++) {
      for (const q of generateSession(band, 10, day * 1000 + s * 37 + 5)) {
        const sig = questionSignature(q)
        total++
        if (today.has(sig)) sameDay++
        today.add(sig); seen.add(sig)
      }
    }
  }
  if (sameDay > total * 0.02) fail(band, 'repeats', `${sameDay} repeats within a day over ${total} questions`)
  console.log(`${band.padEnd(6)} ${qs.length} draws · mix ${Object.entries(mix).map(([k, v]) => `${k} ${(v / qs.length * 100).toFixed(0)}%`).join(' ')} · 30 days: ${seen.size} distinct of ${total}, ${sameDay} same-day repeat`)
}

// ── what each band says it cannot do is still true ───────────────────────────
// BOOK_COVERAGE records, per band, what its book has that this engine does not. Written as a
// comment it would outlive the gap — a note saying "no symmetry yet" reads the same the day
// symmetry ships and for years afterwards. Written as data it can be checked: every band must
// name its book, and no `missing` line may name a type the band now poses.
for (const band of BAND_KEYS) {
  const cover = BOOK_COVERAGE[band]
  if (!cover?.book) { findings.push(`[${band}] coverage: no book recorded`); continue }
  const posed = [...BANDS[band].types, ...BANDS[band].glyphTypes, ...BANDS[band].iconTypes]
  for (const line of cover.missing) {
    const claimed = line.split('—')[0].trim().split(/[ (]/)[0].toLowerCase()
    if (posed.some(t => t === claimed || t.endsWith(`-${claimed}`))) {
      findings.push(`[${band}] coverage: "${line}" is listed as missing, but ${claimed} is posed`)
    }
  }
}

// ── the gate fails closed ─────────────────────────────────────────────────────
// With no font, every icon type must disappear rather than render as empty boxes. Glyph questions
// stay: their art ships in the bundle and needs no font (puzzleArt.generated.js).
delete globalThis.document
const closed = generateSession('7-8', 40, 3)
if (closed.some(q => sourceOf(q.type) === 'icon')) {
  findings.push('[gate] icon questions leaked through with no font loaded')
}
// And it fails closed to SOMETHING. `every` on an empty array is true, so this check would have
// passed a band that produced no questions at all — which stopped being hypothetical when 7-8
// was inverted to four-fifths pictures, since every pictorial type sits behind the gate this
// check closes. A child with a slow font is owed a smaller sheet, not an empty one.
if (closed.length < 40) {
  findings.push(`[gate] only ${closed.length} of 40 questions survived with no font loaded`)
}

if (findings.length) {
  console.error(`\n✗ ${findings.length} finding${findings.length > 1 ? 's' : ''}:`)
  for (const f of findings) console.error(`  ${f}`)
  process.exit(1)
}
console.log('\n✓ no findings')
