// Question generation for the puzzle (non-verbal reasoning) module.
//
// The taxonomy is the standard one — the same six question types the Bond 5-6 papers open
// with, and the same six that reappear in every age band above them. That is the design this
// file is built on: THE TYPES DO NOT CHANGE WITH AGE. What changes is how subtle the
// difference is, how many attributes move at once, and which types are unlocked. So age picks
// a BAND (a dial setting), not a set of templates — the same split src/lib/mathCurriculum.js
// makes between what a session is about and how hard it is.
//
// Written the other way — a template per age per attribute per type — this file would be six
// types × six attributes × three bands of hand-written generators. Split along its real axes
// it is six generator functions over one shared attribute vocabulary, and every combination
// comes out of the crossing for free.
//
// Shape of a question:
//   { seed, band, type, stem_key, layout, prompt: [spec|null], options: [{ spec, why }],
//     correct_index, rule: { attr, from, to } }
//
// `why` names the attribute each distractor moved, which is what lets a help panel say "bunun
// çizgileri ters yönde" instead of "yanlış". It is the same shape mathTemplates gives its
// choice-format options, and for the same reason: a child who picks one particular wrong
// answer has made one particular mistake.
//
// Nothing here calls a model. The answer is not proposed and then checked, it is the thing the
// generator built the question around — so unlike the maths path there is no mathVerify step,
// because there is no second opinion to reconcile. What IS checked is the picture:
// validateQuestion() re-derives every option's visual fingerprint and rejects a question whose
// options are not four different pictures, or whose rule turns out to be invisible. A question
// that fails is discarded and regenerated; a child never sees one.

import {
  SHAPES, FILLS, ROTATIONS, CORNERS, HALVES, SIZES, STRETCHES, INNER_NODES, ATTRIBUTES,
  makeSpec, geometryKey, attrVisible, renderFigure,
} from './puzzleFigures'
import {
  GLYPH_GROUPS, GROUP_KEYS, GLYPH_RELATIONS, RELATION_KEYS, GLYPH_ATTRIBUTES,
  makeGlyphSpec, glyphKey, groupOf, renderGlyph, fontReady,
} from './puzzleGlyphs'
import {
  ICON_GROUPS, ICON_GROUP_KEYS, ICON_ATTRIBUTES, ICON_FILLS,
  makeIconSpec, iconKey, iconGroupOf, renderIcon, iconFontReady,
} from './puzzleIcons'

export const TYPES = ['odd-one-out', 'identical', 'sequence', 'belongs', 'grid-complete', 'analogy']

// The pictorial family. Kept as its own list because it is a different KIND of question — it
// asks what a child knows about the world, not what they can see in a pattern — and the two
// should stay separable in the attempt log and in what a parent is told.
export const GLYPH_TYPES = ['glyph-odd', 'glyph-belongs', 'glyph-analogy']

// The line-drawn pictorial family. Separate from GLYPH_TYPES because it is drawn from a
// different font with a different vocabulary — and because it can do something emoji cannot:
// `icon-sequence` runs on the FILL axis, the same outline-to-solid alternation the geometric
// sequences use, on a picture of a real thing.
export const ICON_TYPES = ['icon-odd', 'icon-belongs', 'icon-sequence']

export const STEM_KEYS = {
  'odd-one-out': 'puzzle_stem_odd',
  identical: 'puzzle_stem_same',
  sequence: 'puzzle_stem_next',
  belongs: 'puzzle_stem_belongs',
  'grid-complete': 'puzzle_stem_pattern',
  analogy: 'puzzle_stem_analogy',
  'glyph-odd': 'puzzle_stem_odd',
  'glyph-belongs': 'puzzle_stem_belongs',
  'glyph-analogy': 'puzzle_stem_analogy',
  'icon-odd': 'puzzle_stem_odd',
  'icon-belongs': 'puzzle_stem_belongs',
  'icon-sequence': 'puzzle_stem_next',
}

// One fingerprint for either kind of figure, so the validator does not care which it is
// holding. The two guarantees behind them differ — see the header of puzzleGlyphs.js.
export const figureKey = (spec) =>
  (spec.kind === 'glyph' ? glyphKey(spec)
    : spec.kind === 'icon' ? iconKey(spec)
      : geometryKey(spec))

const attributesFor = (spec) =>
  (spec.kind === 'glyph' ? GLYPH_ATTRIBUTES : spec.kind === 'icon' ? ICON_ATTRIBUTES : ATTRIBUTES)

// The age dial. Every field here is a difficulty decision, and every one of them is the same
// decision at every age — only its value moves.
//
// A pool may REPEAT a value to weight it. `half` and `inner` are structural devices that take
// over the whole interior, and drawn from a flat pool they landed on two questions out of
// three — a sheet where nearly every figure is split or nested, which is not what the papers
// look like. Repeating `null` is how a band says "use this sparingly" without any generator
// needing to know which attributes are the loud ones.
//
// `noise` is the attribute count that varies among the options WITHOUT carrying the rule,
// split evenly so it can never single an option out. Without it, three of the four figures in
// an odd-one-out are literally identical, which both looks wrong and gives the answer away by
// layout rather than by reasoning. With it, a 2-2 split is provably unable to produce a second
// valid answer.
export const BANDS = {
  '5-6': {
    types: ['odd-one-out', 'identical', 'sequence'],
    glyphTypes: ['glyph-odd', 'glyph-belongs'],   // relations wait for 7-8
    iconTypes: ICON_TYPES,
    attributes: ['shape', 'fill', 'half', 'inner', 'dots', 'corner'],
    noise: 2,
    shapes: ['circle', 'triangle', 'square', 'hexagon'],
    fills: ['none', 'solid'],
    rotations: [0, 90, 180, 270],
    sizes: [1],
    stretches: [1],           // "same sides, different proportions" is a 7-8 idea
    halves: [null, null, null, 'tl', 'br'],
    inners: [null, null, null, ...INNER_NODES.slice(1, 4)],
    dots: [0, 2, 4],          // a 2-vs-4 difference is countable at a glance; 3-vs-4 is not
    corners: [null, 'tl', 'br'],
    seqPeriod: 2,             // dolu / boş / dolu / boş — the alternation the 5-6 papers open on
    seqLength: 4,
  },
  '7-8': {
    types: ['odd-one-out', 'identical', 'sequence', 'belongs', 'grid-complete'],
    glyphTypes: GLYPH_TYPES,
    iconTypes: ICON_TYPES,
    attributes: ['shape', 'fill', 'rotation', 'size', 'stretch', 'half', 'inner', 'dots', 'corner'],
    noise: 2,
    shapes: ['circle', 'triangle', 'square', 'pentagon', 'hexagon', 'arrow'],
    fills: ['none', 'solid', 'hatch-45', 'hatch-90'],
    rotations: [0, 90, 180, 270],
    sizes: [0.82, 1],
    stretches: [1, 1, 0.62],
    halves: [null, null, ...HALVES.slice(1)],
    inners: [null, null, ...INNER_NODES.slice(1)],
    dots: [0, 1, 2, 3],
    corners: [null, 'tl', 'tr', 'bl', 'br'],
    seqPeriod: 3,
    seqLength: 5,
  },
  '9-11': {
    types: TYPES,
    glyphTypes: GLYPH_TYPES,
    iconTypes: ICON_TYPES,
    attributes: ATTRIBUTES,
    noise: 2,
    shapes: SHAPES,
    fills: FILLS,
    rotations: ROTATIONS,
    sizes: SIZES,
    stretches: STRETCHES,
    halves: [null, ...HALVES.slice(1)],
    inners: [null, ...INNER_NODES.slice(1)],
    dots: [0, 1, 2, 3, 4, 5],
    corners: CORNERS,
    seqPeriod: 4,
    seqLength: 5,
  },
}

export const BAND_KEYS = Object.keys(BANDS)

export function bandForAge(age) {
  const n = Number(age) || 7
  if (n <= 6) return '5-6'
  if (n <= 8) return '7-8'
  return '9-11'
}

// Seeded so a question is reproducible from its seed alone. When a child hits a figure that
// looks wrong, the attempt row is enough to put that exact picture back on screen — which is
// the thing a generated bank of images can never offer, because nothing there knows why it
// came out the way it did.
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = (r, arr) => arr[Math.floor(r() * arr.length)]

// Attribute values are mostly scalars, but `inner` is a node. Anywhere values are counted or
// compared as strings, they go through here.
const valueKey = (v) => (v && typeof v === 'object' ? JSON.stringify(v) : String(v))
const pool = (band, attr) => ({
  shape: band.shapes, fill: band.fills, rotation: band.rotations,
  size: band.sizes, stretch: band.stretches, half: band.halves,
  inner: band.inners, dots: band.dots, corner: band.corners,
}[attr])

// Another value for `attr` that is guaranteed to change the picture of `spec`. Returns null
// when the pool has nothing visibly different to offer — a hexagon whose rotations are all
// multiples of 60, a circle asked to rotate — and the caller then picks a different rule
// rather than shipping a question with no visible answer.
function otherValue(r, band, spec, attr) {
  const candidates = pool(band, attr)
    .filter(v => v !== spec[attr] && attrVisible(spec, attr, v))
  return candidates.length ? pick(r, candidates) : null
}

function randomSpec(r, band) {
  return makeSpec({
    shape: pick(r, band.shapes),
    fill: pick(r, band.fills),
    rotation: pick(r, band.rotations),
    size: pick(r, band.sizes),
    stretch: pick(r, band.stretches),
    half: pick(r, band.halves),
    inner: pick(r, band.inners),
    dots: pick(r, band.dots),
    corner: pick(r, band.corners),
  })
}

// Attributes whose value can be moved on THIS spec and be seen. Checked per spec, not per
// band: `dots` is a real attribute until the shape is carrying none and the pool offers none.
function usableAttrs(r, band, spec, exclude = []) {
  return band.attributes.filter(a => !exclude.includes(a) && otherValue(r, band, spec, a) !== null)
}

// The two patterns noise is dealt out in. Both are even splits, which is the whole point — a
// 2-2 distribution cannot make any single option the odd one, so noise can never compete with
// the rule for the answer. They are also ORTHOGONAL, which matters just as much and is less
// obvious: dealing two noise attributes with the same pattern leaves two options identical in
// every field, and four options that are not four different pictures is a broken question
// however sound the rule is. Crossed, they give every option its own combination while each
// attribute on its own still splits evenly.
const NOISE_PATTERNS = [i => i % 2, i => Math.floor(i / 2) % 2]

// Returns how many noise attributes it managed to place — callers that need their options to
// be visibly distinct check it rather than assuming.
function applyNoise(r, band, specs, ruleAttr) {
  let used = 0
  for (const attr of usableAttrs(r, band, specs[0], [ruleAttr])) {
    if (used >= Math.min(band.noise, NOISE_PATTERNS.length)) break
    const alt = otherValue(r, band, specs[0], attr)
    if (alt === null) continue
    const values = [specs[0][attr], alt]
    const pattern = NOISE_PATTERNS[used]
    specs.forEach((s, i) => { s[attr] = values[pattern(i)] })
    used++
  }
  return used
}

// ── generators ────────────────────────────────────────────────────────────────
// Each returns a question or null. Returning null is normal and cheap: it means the random
// draw did not offer a rule that could be seen, and generateQuestion simply draws again.

function genOddOneOut(r, band, seed) {
  const base = randomSpec(r, band)
  const attrs = usableAttrs(r, band, base)
  if (!attrs.length) return null
  const ruleAttr = pick(r, attrs)
  const oddValue = otherValue(r, band, base, ruleAttr)
  if (oddValue === null) return null

  const specs = [0, 1, 2, 3].map(() => ({ ...base }))
  const oddIndex = Math.floor(r() * 4)
  // Two crossed noise attributes are what make the three non-odd figures three different
  // pictures rather than three copies. Without both, the question is either malformed or
  // gives itself away by layout, so a draw that cannot place them is discarded.
  if (applyNoise(r, band, specs, ruleAttr) < 2) return null
  specs[oddIndex][ruleAttr] = oddValue

  return {
    seed, type: 'odd-one-out', layout: 'options-only', prompt: [],
    options: specs.map((spec, i) => ({ spec, why: i === oddIndex ? null : ruleAttr })),
    correct_index: oddIndex,
    rule: { attr: ruleAttr, from: base[ruleAttr], to: oddValue },
  }
}

function genIdentical(r, band, seed) {
  const target = randomSpec(r, band)
  const attrs = usableAttrs(r, band, target)
  if (attrs.length < 3) return null
  const chosen = attrs.slice().sort(() => r() - 0.5).slice(0, 3)
  const options = [{ spec: { ...target }, why: null }]
  for (const attr of chosen) {
    const alt = otherValue(r, band, target, attr)
    if (alt === null) return null
    options.push({ spec: { ...target, [attr]: alt }, why: attr })
  }
  const order = shuffle(r, [0, 1, 2, 3])
  const shuffled = order.map(i => options[i])
  return {
    seed, type: 'identical', layout: 'target', prompt: [target],
    options: shuffled,
    correct_index: order.indexOf(0),
    rule: { attr: 'identity', from: null, to: null },
  }
}

function genSequence(r, band, seed) {
  const base = randomSpec(r, band)
  const attrs = usableAttrs(r, band, base)
  if (!attrs.length) return null
  const ruleAttr = pick(r, attrs)
  const values = pool(band, ruleAttr).filter(v => v === base[ruleAttr] || attrVisible(base, ruleAttr, v))
  const period = Math.min(band.seqPeriod, values.length)
  if (period < 2) return null

  // A cycle rather than an increment: an increment runs out of pool (dots cannot go past 5)
  // and a run that hits the ceiling stops being the rule it started as.
  const cycle = shuffle(r, values.slice()).slice(0, period)
  const at = i => makeSpec({ ...base, [ruleAttr]: cycle[i % period] })

  const n = band.seqLength
  const prompt = Array.from({ length: n }, (_, i) => at(i))
  const answer = at(n)

  const options = [{ spec: answer, why: null }]
  // The strongest distractor in a sequence is the item that just went past — a child reading
  // the run as "more of the same" lands exactly there.
  const near = at(n - 1)
  if (geometryKey(near) !== geometryKey(answer)) options.push({ spec: near, why: ruleAttr })
  for (const attr of usableAttrs(r, band, answer, [ruleAttr])) {
    if (options.length >= 4) break
    const alt = otherValue(r, band, answer, attr)
    if (alt !== null) options.push({ spec: { ...answer, [attr]: alt }, why: attr })
  }
  while (options.length < 4) {
    const alt = otherValue(r, band, answer, ruleAttr)
    if (alt === null) return null
    const cand = { ...answer, [ruleAttr]: alt }
    if (options.some(o => geometryKey(o.spec) === geometryKey(cand))) return null
    options.push({ spec: cand, why: ruleAttr })
  }

  const order = shuffle(r, [0, 1, 2, 3])
  return {
    seed, type: 'sequence', layout: 'row', prompt,
    options: order.map(i => options[i]),
    correct_index: order.indexOf(0),
    rule: { attr: ruleAttr, from: cycle[0], to: cycle[n % period] },
  }
}

function genBelongs(r, band, seed) {
  const base = randomSpec(r, band)
  const attrs = usableAttrs(r, band, base)
  if (!attrs.length) return null
  const ruleAttr = pick(r, attrs)

  // Three figures that share the rule value and differ in noise; the child picks the fourth
  // member of that set. It is odd-one-out read from the other end, which is exactly how the
  // papers present it — and it is validated by the same rule, so all three distractors take
  // the SAME wrong value. Three different wrong values would leave the rule attribute
  // isolating every option at once and the set with no defensible single answer.
  const oddValue = otherValue(r, band, base, ruleAttr)
  if (oddValue === null) return null

  const prompt = [0, 1, 2].map(() => ({ ...base }))
  if (applyNoise(r, band, prompt, ruleAttr) < 2) return null

  const specs = [0, 1, 2, 3].map(() => ({ ...base }))
  const keepIndex = Math.floor(r() * 4)
  if (applyNoise(r, band, specs, ruleAttr) < 2) return null
  specs.forEach((s, i) => { if (i !== keepIndex) s[ruleAttr] = oddValue })

  // The answer must be a NEW member of the set, not one of the three already on display —
  // otherwise the child can match pictures instead of reading the rule.
  const promptKeys = new Set(prompt.map(geometryKey))
  if (promptKeys.has(geometryKey(specs[keepIndex]))) return null

  return {
    seed, type: 'belongs', layout: 'row', prompt,
    options: specs.map((spec, i) => ({ spec, why: i === keepIndex ? null : ruleAttr })),
    correct_index: keepIndex,
    rule: { attr: ruleAttr, from: base[ruleAttr], to: oddValue },
  }
}

function genGridComplete(r, band, seed) {
  const base = randomSpec(r, band)
  const attrs = usableAttrs(r, band, base)
  if (attrs.length < 2) return null
  const [rowAttr, colAttr] = shuffle(r, attrs.slice()).slice(0, 2)
  const rowAlt = otherValue(r, band, base, rowAttr)
  const colAlt = otherValue(r, band, base, colAttr)
  if (rowAlt === null || colAlt === null) return null

  // 2×2: one attribute is what the row means, the other is what the column means, and the
  // missing cell is the only combination not yet shown.
  const cell = (ri, ci) => makeSpec({
    ...base,
    [rowAttr]: ri ? rowAlt : base[rowAttr],
    [colAttr]: ci ? colAlt : base[colAttr],
  })
  const answer = cell(1, 1)
  const prompt = [cell(0, 0), cell(0, 1), cell(1, 0), null]

  const options = [
    { spec: answer, why: null },
    { spec: cell(0, 1), why: rowAttr },   // right column, wrong row
    { spec: cell(1, 0), why: colAttr },   // right row, wrong column
    { spec: cell(0, 0), why: 'both' },    // neither
  ]
  const keys = options.map(o => geometryKey(o.spec))
  if (new Set(keys).size !== 4) return null

  const order = shuffle(r, [0, 1, 2, 3])
  return {
    seed, type: 'grid-complete', layout: 'grid2x2', prompt,
    options: order.map(i => options[i]),
    correct_index: order.indexOf(0),
    rule: { attr: `${rowAttr}+${colAttr}`, from: null, to: null },
  }
}

function genAnalogy(r, band, seed) {
  const a = randomSpec(r, band)
  const attrs = usableAttrs(r, band, a)
  if (!attrs.length) return null
  const ruleAttr = pick(r, attrs)
  const to = otherValue(r, band, a, ruleAttr)
  if (to === null) return null

  // The transform has to mean the same thing on both sides, so it is "set this attribute to
  // this value" rather than "change it somehow" — otherwise A→B and C→? are two different
  // rules that happen to look alike.
  const b = { ...a, [ruleAttr]: to }
  const cAttrs = usableAttrs(r, band, a, [ruleAttr])
  if (!cAttrs.length) return null
  const cShift = otherValue(r, band, a, cAttrs[0])
  if (cShift === null) return null
  const c = { ...a, [cAttrs[0]]: cShift }
  if (c[ruleAttr] !== a[ruleAttr]) return null
  const answer = { ...c, [ruleAttr]: to }

  const options = [
    { spec: answer, why: null },
    { spec: { ...c }, why: ruleAttr },          // transform not applied
    { spec: { ...b }, why: cAttrs[0] },         // transform applied to the wrong figure
    { spec: { ...a }, why: 'both' },
  ]
  if (new Set(options.map(o => geometryKey(o.spec))).size !== 4) return null

  const order = shuffle(r, [0, 1, 2, 3])
  return {
    seed, type: 'analogy', layout: 'analogy', prompt: [a, b, c, null],
    options: order.map(i => options[i]),
    correct_index: order.indexOf(0),
    rule: { attr: ruleAttr, from: a[ruleAttr], to },
  }
}

// ── glyph generators ──────────────────────────────────────────────────────────
// A separate small family rather than the six bent to fit. A glyph cannot be hatched, split
// or nested — the only things that can vary are WHICH glyph, how many, how big and which way
// up — so the geometric generators would spend most of their attribute vocabulary finding
// nothing to move. What glyphs bring instead is the two families the shapes cannot reach:
// category membership, and relations between things in the world.

function genGlyphCategory(r, band, seed, type) {
  const groups = shuffle(r, GROUP_KEYS.slice())
  const [inKey, outKey] = groups
  const inSet = shuffle(r, GLYPH_GROUPS[inKey].glyphs.slice())
  const outSet = shuffle(r, GLYPH_GROUPS[outKey].glyphs.slice())
  if (inSet.length < 4 || outSet.length < 3) return null

  const spec = (glyph) => makeGlyphSpec({ glyph, group: groupOf(glyph) })

  if (type === 'glyph-belongs') {
    // Three of a kind on show, and the child picks the fourth member. The three wrong options
    // all come from ONE other group, for the same reason the shape version does it: three
    // different wrong groups would leave every option isolated on the rule and the set with
    // no single defensible answer.
    const prompt = inSet.slice(0, 3).map(spec)
    const options = [spec(inSet[3]), ...outSet.slice(0, 3).map(spec)]
    const order = shuffle(r, [0, 1, 2, 3])
    return {
      seed, type, layout: 'row', prompt,
      options: order.map(i => ({ spec: options[i], why: i === 0 ? null : 'group' })),
      correct_index: order.indexOf(0),
      rule: { attr: 'group', from: inKey, to: outKey },
    }
  }

  const oddIndex = Math.floor(r() * 4)
  const specs = inSet.slice(0, 4).map(spec)
  specs[oddIndex] = spec(outSet[0])
  return {
    seed, type: 'glyph-odd', layout: 'options-only', prompt: [],
    options: specs.map((s, i) => ({ spec: s, why: i === oddIndex ? null : 'group' })),
    correct_index: oddIndex,
    rule: { attr: 'group', from: inKey, to: outKey },
  }
}

function genGlyphAnalogy(r, band, seed) {
  const relKey = pick(r, RELATION_KEYS)
  const rel = GLYPH_RELATIONS[relKey]
  const pairs = shuffle(r, rel.pairs.slice())
  if (pairs.length < 2) return null
  const [[a, b], [c, answer]] = pairs

  // Distractors are drawn from the OTHER halves of the same relation, so a child cannot get
  // there by noticing that three options are food and one is not — every option is the kind of
  // thing the relation produces, and only one is what THIS pair produces.
  const others = pairs.slice(2).map(p => p[1])
    .concat(RELATION_KEYS.filter(k => k !== relKey).flatMap(k => GLYPH_RELATIONS[k].pairs.map(p => p[1])))

  // …but "other half of another pair" is not far enough. The tables chain: 🐔→🥚 is `produces`
  // and 🥚→🐣 is `becomes`, so offering 🐣 against 🐔 gives a child a second answer they can
  // defend. Anything reachable from the prompt term in two steps across ALL relations is out.
  // The tables are meant to be edited by hand, and this is the ambiguity hand-editing creates.
  const reach = new Set([c])
  for (let step = 0; step < 2; step++) {
    for (const key of RELATION_KEYS) {
      for (const [from, to] of GLYPH_RELATIONS[key].pairs) {
        if (reach.has(from)) reach.add(to)
      }
    }
  }
  const pool = shuffle(r, [...new Set(others)]
    .filter(g => g !== answer && g !== b && g !== a && !reach.has(g)))
  if (pool.length < 3) return null

  const spec = (glyph) => makeGlyphSpec({ glyph, group: groupOf(glyph) })
  const options = [spec(answer), ...pool.slice(0, 3).map(spec)]
  const order = shuffle(r, [0, 1, 2, 3])
  return {
    seed, type: 'glyph-analogy', layout: 'analogy',
    prompt: [spec(a), spec(b), spec(c), null],
    options: order.map(i => ({ spec: options[i], why: i === 0 ? null : 'relation' })),
    correct_index: order.indexOf(0),
    rule: { attr: `relation:${relKey}`, from: a, to: answer },
  }
}

// ── icon generators ───────────────────────────────────────────────────────────

function genIconCategory(r, band, seed, type) {
  const [inKey, outKey] = shuffle(r, ICON_GROUP_KEYS.slice())
  const inSet = shuffle(r, ICON_GROUPS[inKey].icons.slice())
  const outSet = shuffle(r, ICON_GROUPS[outKey].icons.slice())
  if (inSet.length < 4 || outSet.length < 3) return null

  // One fill across the whole set. Letting it vary here would put a second attribute in play
  // on a question whose rule is category, and the validator would rightly call that ambiguous.
  const fill = pick(r, ICON_FILLS)
  const spec = (icon) => makeIconSpec({ icon, fill, group: iconGroupOf(icon) })

  if (type === 'icon-belongs') {
    const prompt = inSet.slice(0, 3).map(spec)
    const options = [spec(inSet[3]), ...outSet.slice(0, 3).map(spec)]
    const order = shuffle(r, [0, 1, 2, 3])
    return {
      seed, type, layout: 'row', prompt,
      options: order.map(i => ({ spec: options[i], why: i === 0 ? null : 'group' })),
      correct_index: order.indexOf(0),
      rule: { attr: 'group', from: inKey, to: outKey },
    }
  }

  const oddIndex = Math.floor(r() * 4)
  const specs = inSet.slice(0, 4).map(spec)
  specs[oddIndex] = spec(outSet[0])
  return {
    seed, type: 'icon-odd', layout: 'options-only', prompt: [],
    options: specs.map((s, i) => ({ spec: s, why: i === oddIndex ? null : 'group' })),
    correct_index: oddIndex,
    rule: { attr: 'group', from: inKey, to: outKey },
  }
}

// The one the emoji family cannot do. A picture of a real thing, alternating outline and
// solid — the same device the 5-6 papers open with, on a candle instead of a circle.
function genIconSequence(r, band, seed) {
  const group = pick(r, ICON_GROUP_KEYS)
  const icons = shuffle(r, ICON_GROUPS[group].icons.slice())
  if (icons.length < 2) return null

  // Two rules are offered and one is picked, because a sheet where every icon sequence is the
  // same alternation reads as one question asked four times.
  const onFill = r() < 0.6
  const n = band.seqLength
  const at = (i) => (onFill
    ? makeIconSpec({ icon: icons[0], fill: ICON_FILLS[i % 2], group })
    : makeIconSpec({ icon: icons[i % 2], fill: 0, group }))

  const prompt = Array.from({ length: n }, (_, i) => at(i))
  const answer = at(n)
  const near = at(n - 1)

  const options = [{ spec: answer, why: null }, { spec: near, why: onFill ? 'fill' : 'icon' }]
  const alt = icons[2] ?? icons[1]
  options.push({
    spec: onFill
      ? makeIconSpec({ icon: alt, fill: answer.fill, group })
      : makeIconSpec({ icon: answer.icon, fill: 1, group }),
    why: onFill ? 'icon' : 'fill',
  })
  options.push({
    spec: onFill
      ? makeIconSpec({ icon: alt, fill: near.fill, group })
      : makeIconSpec({ icon: near.icon, fill: 1, group }),
    why: 'both',
  })
  if (new Set(options.map(o => iconKey(o.spec))).size !== 4) return null

  const order = shuffle(r, [0, 1, 2, 3])
  return {
    seed, type: 'icon-sequence', layout: 'row', prompt,
    options: order.map(i => options[i]),
    correct_index: order.indexOf(0),
    rule: { attr: onFill ? 'fill' : 'icon', from: null, to: null },
  }
}

function shuffle(r, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const GENERATORS = {
  'odd-one-out': genOddOneOut,
  identical: genIdentical,
  sequence: genSequence,
  belongs: genBelongs,
  'grid-complete': genGridComplete,
  analogy: genAnalogy,
  'glyph-odd': (r, band, seed) => genGlyphCategory(r, band, seed, 'glyph-odd'),
  'glyph-belongs': (r, band, seed) => genGlyphCategory(r, band, seed, 'glyph-belongs'),
  'glyph-analogy': genGlyphAnalogy,
  'icon-odd': (r, band, seed) => genIconCategory(r, band, seed, 'icon-odd'),
  'icon-belongs': (r, band, seed) => genIconCategory(r, band, seed, 'icon-belongs'),
  'icon-sequence': genIconSequence,
}

// ── validation ────────────────────────────────────────────────────────────────

// The last gate before a child sees a question, and the reason this module can promise what a
// generated bank cannot: the rule is known here, so it can be checked rather than trusted.
// Returns null when the question is sound, or a string naming what is wrong with it.
export function validateQuestion(q) {
  if (!q || !Array.isArray(q.options) || q.options.length !== 4) return 'options != 4'
  if (!(q.correct_index >= 0 && q.correct_index < 4)) return 'correct_index out of range'

  const keys = q.options.map(o => figureKey(o.spec))
  if (new Set(keys).size !== 4) return 'two options draw the same picture'

  // A prompt cell that is already the answer makes the question a memory test, and in
  // `identical` it would put the target next to its own copy.
  if (q.type === 'identical') {
    const target = figureKey(q.prompt[0])
    if (target !== keys[q.correct_index]) return 'target does not match the answer'
    if (keys.filter(k => k === target).length !== 1) return 'more than one option matches the target'
  }

  // A glyph analogy is sound when the answer is the only option the relation actually reaches;
  // the distractors are the other halves of other pairs, so the test is that none of them is
  // this pair's partner by a second route.
  if (q.type === 'glyph-analogy') {
    const [a, , c] = q.prompt
    if (!a || !c) return 'analogy is missing a term'
    if (q.options.some((o, i) => i !== q.correct_index && o.spec.glyph === q.options[q.correct_index].spec.glyph)) {
      return 'a distractor repeats the answer'
    }
  }

  // Odd-one-out is the only type whose soundness is a property of the option SET rather than
  // of the answer: exactly one attribute may split 3-1, and no other attribute may isolate a
  // single option, or the question has two defensible answers.
  if (['odd-one-out', 'belongs', 'glyph-odd', 'glyph-belongs', 'icon-odd', 'icon-belongs'].includes(q.type)) {
    const specs = q.options.map(o => o.spec)
    let splits = 0
    // Glyph figures carry none of the geometric attributes, so counting over the shape list
    // would find one undefined value four times, register no split at all, and fail every
    // glyph question for the wrong reason.
    const attrs = attributesFor(specs[0])
    for (const attr of attrs) {
      const counts = {}
      // `inner` holds a node, not a scalar, and String() flattens every one of them to
      // "[object Object]" — which would have made four different nested figures look like one
      // value and quietly disabled this whole check for the attribute that needs it most.
      for (const s of specs) {
        const k = valueKey(s[attr])
        counts[k] = (counts[k] || 0) + 1
      }
      const singles = Object.values(counts).filter(c => c === 1).length
      if (singles === 1 && Object.keys(counts).length === 2) splits++
      // `glyph` is the identity of the picture, so in a glyph question every option differs on
      // it by design — that is not an ambiguity, it is what makes four distinct pictures.
      else if (singles > 0 && Object.keys(counts).length > 2 && attr !== 'glyph' && attr !== 'icon') {
        return `attribute ${attr} isolates an option`
      }
    }
    if (['odd-one-out', 'glyph-odd', 'icon-odd'].includes(q.type) && splits !== 1) {
      return `${splits} attributes split 3-1`
    }
  }

  for (const cell of q.prompt) {
    if (cell && !figureKey(cell)) return 'unrenderable prompt cell'
  }
  return null
}

// ── entry points ──────────────────────────────────────────────────────────────

export function generateQuestion(bandKey, type, seed) {
  const band = BANDS[bandKey]
  if (!band) throw new Error(`unknown band ${bandKey}`)
  // Glyph questions are drawn from the same pool but in a fixed minority: they are the loud,
  // easy-to-like ones, and a sheet that is mostly emoji stops being a reasoning test and
  // becomes a picture quiz. One in four, which is roughly the papers' own ratio — the first
  // two of Bond's eight papers carry none at all.
  // A pictorial question is only offered when the font that draws it has arrived. Without the
  // gate the fallback is not a missing picture but a wrong one — see fontReady().
  const glyphTypes = fontReady() ? band.glyphTypes : []
  const iconTypes = iconFontReady() ? band.iconTypes : []
  const pictorial = [...glyphTypes, ...iconTypes]
  const all = [...band.types, ...pictorial]
  const types = type && all.includes(type)
    ? [type]
    : (pictorial.length && rng(seed + 13)() < 0.3 ? pictorial : band.types)

  // A rejected draw costs nothing but a retry, so the loop is generous. It has never needed
  // more than a handful of rounds in the lab; the cap exists so a future band that is too
  // narrow to satisfy its own rules fails loudly instead of hanging.
  for (let i = 0; i < 60; i++) {
    const r = rng(seed + i * 7919)
    const t = types[Math.floor(rng(seed + i)() * types.length)]
    const q = GENERATORS[t](r, band, seed + i * 7919)
    if (q && !validateQuestion(q)) return { ...q, band: bandKey, stem_key: STEM_KEYS[q.type] }
  }
  return null
}

export function generateSession(bandKey, count = 10, seed = Date.now()) {
  const out = []
  const seen = new Set()
  for (let i = 0; out.length < count && i < count * 40; i++) {
    const q = generateQuestion(bandKey, null, seed + i * 104729)
    if (!q) continue
    // Two questions built on the same rule and the same base figure read as the same question
    // even when every number behind them differs.
    const sig = `${q.type}|${q.rule.attr}|${figureKey(q.options[q.correct_index].spec)}`
    if (seen.has(sig)) continue
    seen.add(sig)
    out.push(q)
  }
  return out
}

export { renderFigure, renderGlyph, renderIcon }
