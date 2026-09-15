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
// `why` names the ATTRIBUTE a wrong option is judged on — what lets a help panel say "bunun
// çizgileri ters yönde" instead of "yanlış". Same shape mathTemplates gives its choice-format
// options, and for the same reason: a child who picks one particular wrong answer has made one
// particular mistake.
//
// The sentence built around that attribute differs by type, and a panel has to know which it
// is holding, because the two are opposites:
//
//   identical, sequence, grid-complete, analogy — the option MOVED that attribute away from
//     what the question wanted. "Bunun dolgusu farklı."
//   odd-one-out — the option SHARES that attribute with the others, which is exactly why it is
//     not the odd one. "Bunun dolgusu diğerleriyle aynı."
//   belongs, and the glyph/icon families — the option does not share it, which is why it does
//     not belong. "Bu, diğerleriyle aynı gruptan değil."
//
// `why` is null on the correct option, and 'both' where two attributes are wrong at once.
//
// Nothing here calls a model. The answer is not proposed and then checked, it is the thing the
// generator built the question around — so unlike the maths path there is no mathVerify step,
// because there is no second opinion to reconcile. What IS checked is the picture:
// validateQuestion() re-derives every option's visual fingerprint and rejects a question whose
// options are not all different pictures, or whose rule turns out to be invisible. A question
// that fails is discarded and regenerated; a child never sees one.

// Explicit .js on these three, as in puzzleGlyphs and puzzleIcons, so the whole engine stays
// importable by plain node: scripts/puzzle-audit.mjs runs every check against it without a
// bundler, and anything server-side would need the same.
import {
  SHAPES, FILLS, ROTATIONS, CORNERS, HALVES, SIZES, STRETCHES, INNER_NODES, ATTRIBUTES,
  makeSpec, geometryKey, attrVisible, normalizeSpec, renderFigure,
} from './puzzleFigures.js'
import {
  GLYPH_GROUPS, GROUP_KEYS, GLYPH_RELATIONS, RELATION_KEYS, GLYPH_ATTRIBUTES,
  GLYPH_TRAITS, TRAIT_KEYS, traitValue, traitConflict,
  makeGlyphSpec, glyphKey, groupOf, renderGlyph, fontReady,
} from './puzzleGlyphs.js'
import {
  ICON_GROUPS, ICON_GROUP_KEYS, ICON_ATTRIBUTES, ICON_FILLS,
  makeIconSpec, iconKey, iconGroupOf, renderIcon, iconFontReady,
} from './puzzleIcons.js'

export const TYPES = ['odd-one-out', 'identical', 'sequence', 'belongs', 'grid-complete', 'analogy', 'reflection']

// The pictorial family. Kept as its own list because it is a different KIND of question — it
// asks what a child knows about the world, not what they can see in a pattern — and the two
// should stay separable in the attempt log and in what a parent is told.
export const GLYPH_TYPES = ['glyph-odd', 'glyph-trait', 'glyph-belongs', 'glyph-sequence', 'glyph-analogy']

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
  reflection: 'puzzle_stem_mirror',
  'glyph-odd': 'puzzle_stem_odd',
  'glyph-trait': 'puzzle_stem_odd',
  'glyph-belongs': 'puzzle_stem_belongs',
  'glyph-sequence': 'puzzle_stem_next',
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
// WHAT EACH BAND IS CALIBRATED AGAINST, because the names overclaim otherwise:
//
//   5-6   — read against Bond Assessment Papers 5-6. The six types, the distractor logic, the
//           filled/outline alternation and the "one attribute at a time" rule all come from
//           those papers and were checked question by question.
//   7-8   — extrapolated. The same six types with the dial turned up. Nobody has held it
//           against the 7-8 papers.
//   9-11  — extrapolated, and known to fall well short of the real thing. Bond's 10-11
//           material covers six categories: analogies, codes and sequences, cubes, hidden
//           shapes, similarities and symmetry. This engine reaches parts of three of them.
//           It has no codes (two of that book's ten topic tests), no cube nets, no hidden
//           shapes and no symmetry; its analogies and sequences move one attribute where the
//           real ones compose two or three; and its figures are one shape with nesting where
//           the real ones are composite line drawings. Its questions also offer four options
//           against the papers' five.
//
//           So this band is nearer 7-8 in difficulty than 10-11. bandForAge sends every child
//           of nine and over to it, which is the right structure and the wrong content, and
//           the gap is worth closing before anyone that age uses it.
//
// A pool may REPEAT a value to weight it. `half` and `inner` are structural devices that take
// over the whole interior, and drawn from a flat pool they landed on two questions out of
// three — a sheet where nearly every figure is split or nested, which is not what the papers
// look like. Repeating `null` is how a band says "use this sparingly" without any generator
// needing to know which attributes are the loud ones.
//
// `sources` is the mix of vocabularies, as plain weights: 7/2/1 reads as "of ten questions,
// seven are shapes, two icons, one emoji". Written as a ratio you can hold against the book
// rather than a probability — the papers open with two entirely abstract sets and bring
// pictures in later, and the 9-11 band tilts further that way for the same reason.
//
// `options` is how many answers a question offers. The 5-6 papers use a–d and every band above
// them a–e, which is not a cosmetic difference: the noise that keeps the options distinct
// without competing with the rule has to be dealt differently for five — see NOISE_VECTORS.
//
// The number of NOISE attributes each band needs follows from that count rather than being
// stated: noise varies among the options without carrying the rule, and it takes two attributes
// to keep four options apart and three to keep five apart. Without it, the non-answers are
// literally identical, which both looks wrong and gives the answer away by layout rather than
// by reasoning.
export const BANDS = {
  '5-6': {
    types: ['odd-one-out', 'identical', 'sequence'],
    // Relations wait for 7-8; a picture cycle does not -- the 5-6 papers open on alternation.
    glyphTypes: ['glyph-odd', 'glyph-belongs', 'glyph-sequence'],
    iconTypes: ICON_TYPES,
    sources: { geometric: 7, icon: 2, glyph: 1 },
    options: 4,               // the 5-6 papers offer a–d; every band above them offers a–e
    attributes: ['shape', 'fill', 'half', 'inner', 'dots', 'corner'],
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
    types: ['odd-one-out', 'identical', 'sequence', 'belongs', 'grid-complete', 'reflection'],
    glyphTypes: GLYPH_TYPES,
    iconTypes: ICON_TYPES,
    sources: { geometric: 7, icon: 2, glyph: 1 },
    options: 5,
    attributes: ['shape', 'fill', 'rotation', 'size', 'stretch', 'half', 'inner', 'dots', 'corner'],
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
    sources: { geometric: 8, icon: 1, glyph: 1 },   // the older the child, the more abstract
    options: 5,
    attributes: ATTRIBUTES,
    shapes: SHAPES,
    fills: FILLS,
    rotations: ROTATIONS,
    sizes: SIZES,
    stretches: STRETCHES,
    halves: [null, ...HALVES.slice(1)],
    inners: [null, ...INNER_NODES.slice(1)],
    // Weighted toward none. A figure carries dots or a corner mark, never both, so a pool that
    // is five-sixths dotted starves `corner` out entirely — over 4000 draws it never once
    // carried a rule, which is a dial in the config that does nothing. It also keeps the
    // hardest band's figures from being uniformly busy.
    dots: [0, 0, 0, 1, 2, 3, 4, 5],
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

// How noise is dealt across the options, as one binary vector per option.
//
// Two properties have to hold at once, and getting them both is why this is a table rather
// than a formula. Every COLUMN — one noise attribute across all the options — must have no
// singleton, or that attribute singles an option out and competes with the rule for the
// answer. Every ROW must be distinct, or two options are the same picture.
//
// With four options that is easy: two attributes split 2-2 and cross to give four combinations.
// With FIVE it is not, and the obvious extension fails. Five cannot be split evenly in two, so
// a column is 3-2 at best; and two binary columns only offer four combinations, so one pair of
// options always collides. It takes three columns, chosen so that each sums to 3 and all five
// rows differ — which the papers get away with informally because a reader judges an
// odd-one-out on the one property the others SHARE, and treats incidental differences as
// scenery. This engine cannot rely on that judgement, so it builds sets where there is nothing
// to judge.
const NOISE_VECTORS = {
  // Three is the PROMPT row of a `belongs` question rather than an option set. Those figures
  // are on display, not answerable, so they only have to be three different pictures — the
  // no-singleton rule exists to stop noise competing for an answer, and nothing here is
  // answering. With three rows and binary columns it could not hold anyway.
  3: [[0, 0], [0, 1], [1, 0]],
  4: [[0, 0], [0, 1], [1, 0], [1, 1]],
  5: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0], [1, 1, 1]],
}

// Returns how many noise attributes it managed to place — callers that need their options to
// be visibly distinct check it against what their option count requires.
function applyNoise(r, band, specs, ruleAttr) {
  const vectors = NOISE_VECTORS[specs.length]
  if (!vectors) return 0
  const want = vectors[0].length
  let used = 0
  for (const attr of usableAttrs(r, band, specs[0], [ruleAttr])) {
    if (used >= want) break
    const alt = otherValue(r, band, specs[0], attr)
    if (alt === null) continue
    const values = [specs[0][attr], alt]
    specs.forEach((s, i) => { s[attr] = values[vectors[i][used]] })
    used++
  }
  return used
}

// How many noise attributes a set of this size needs before its options are all different.
const noiseNeeded = (n) => (NOISE_VECTORS[n]?.[0].length ?? 2)

const indices = (n) => Array.from({ length: n }, (_, i) => i)

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

  const n = band.options
  const specs = indices(n).map(() => ({ ...base }))
  const oddIndex = Math.floor(r() * n)
  // Crossed noise attributes are what make the non-odd figures different pictures rather than
  // copies of each other. Without the full set, the question is either malformed or gives
  // itself away by layout, so a draw that cannot place them is discarded.
  if (applyNoise(r, band, specs, ruleAttr) < noiseNeeded(n)) return null
  specs[oddIndex][ruleAttr] = oddValue

  return {
    seed, type: 'odd-one-out', layout: 'options-only', prompt: [],
    options: specs.map((spec, i) => ({ spec, why: i === oddIndex ? null : ruleAttr })),
    correct_index: oddIndex,
    rule: { attr: ruleAttr, from: base[ruleAttr], to: oddValue },
  }
}

function genIdentical(r, band, seed) {
  const n = band.options
  const target = randomSpec(r, band)
  const attrs = usableAttrs(r, band, target)
  if (attrs.length < n - 1) return null
  const chosen = shuffle(r, attrs.slice()).slice(0, n - 1)
  const options = [{ spec: { ...target }, why: null }]
  for (const attr of chosen) {
    const alt = otherValue(r, band, target, attr)
    if (alt === null) return null
    options.push({ spec: { ...target, [attr]: alt }, why: attr })
  }
  const order = shuffle(r, indices(n))
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
  // The cycle's values must be distinct AS PICTURES, and pairwise — not merely distinct from
  // the base figure, which is all attrVisible can tell you. Two ways that went wrong, both
  // shipped, both invisible to every check downstream because nothing else in the pipeline
  // ever looks at the prompt:
  //
  //   A band pool may REPEAT a value to weight it — `half` and `inner` carry three nulls each
  //   in band 5-6 so structural devices stay rare. Every other caller reads the pool through
  //   otherValue, where a repeat just makes that value likelier, which is the point. Building a
  //   cycle out of it drew [null, null] and produced four identical figures.
  //
  //   And a square rotated 45°, 135°, 225° and 315° is four times the same picture. Each of
  //   them differs from a base at 0°, so each passed attrVisible individually, and the run came
  //   out constant.
  //
  // Keying on the rendered figure settles both at once.
  const seen = new Set()
  const values = []
  for (const v of pool(band, ruleAttr)) {
    if (v !== base[ruleAttr] && !attrVisible(base, ruleAttr, v)) continue
    const k = geometryKey({ ...base, [ruleAttr]: v })
    if (seen.has(k)) continue
    seen.add(k)
    values.push(v)
  }
  const period = Math.min(band.seqPeriod, values.length)
  if (period < 2) return null

  // A cycle rather than an increment: an increment runs out of pool (dots cannot go past 5)
  // and a run that hits the ceiling stops being the rule it started as.
  const cycle = shuffle(r, values.slice()).slice(0, period)
  const at = i => makeSpec({ ...base, [ruleAttr]: cycle[i % period] })

  const n = band.seqLength
  const prompt = Array.from({ length: n }, (_, i) => at(i))
  const answer = at(n)

  const want = band.options
  const options = [{ spec: answer, why: null }]
  // The strongest distractor in a sequence is the item that just went past — a child reading
  // the run as "more of the same" lands exactly there.
  const near = at(n - 1)
  if (geometryKey(near) !== geometryKey(answer)) options.push({ spec: near, why: ruleAttr })
  for (const attr of usableAttrs(r, band, answer, [ruleAttr])) {
    if (options.length >= want) break
    const alt = otherValue(r, band, answer, attr)
    if (alt !== null) options.push({ spec: { ...answer, [attr]: alt }, why: attr })
  }
  while (options.length < want) {
    const alt = otherValue(r, band, answer, ruleAttr)
    if (alt === null) return null
    const cand = { ...answer, [ruleAttr]: alt }
    if (options.some(o => geometryKey(o.spec) === geometryKey(cand))) return null
    options.push({ spec: cand, why: ruleAttr })
  }

  const order = shuffle(r, indices(want))
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

  const n = band.options
  const prompt = [0, 1, 2].map(() => ({ ...base }))
  if (applyNoise(r, band, prompt, ruleAttr) < 2) return null

  const specs = indices(n).map(() => ({ ...base }))
  const keepIndex = Math.floor(r() * n)
  if (applyNoise(r, band, specs, ruleAttr) < noiseNeeded(n)) return null
  specs.forEach((s, i) => { if (i !== keepIndex) s[ruleAttr] = oddValue })

  // The answer must be a NEW member of the set, not one of the three already on display —
  // otherwise the child can match pictures instead of reading the rule.
  const promptKeys = new Set(prompt.map(geometryKey))
  if (promptKeys.has(geometryKey(specs[keepIndex]))) return null

  // Shuffled, and that is not cosmetic. The prompt and the options are dealt the same noise
  // patterns over the same indices, so the option at slot k carried the same combination as
  // prompt[k] — and whenever the kept option was one of the first three, the guard above threw
  // the whole draw away. Only slot 3 reliably survived. Measured over 4000 draws the answer
  // landed 0% / 36% / 15% / 49%: a child who learned "never the first one" would have scored
  // well above chance without reading a single figure, and the attempt log would have recorded
  // that as understanding.
  const order = shuffle(r, indices(n))
  return {
    seed, type: 'belongs', layout: 'row', prompt,
    options: order.map(i => ({ spec: specs[i], why: i === keepIndex ? null : ruleAttr })),
    correct_index: order.indexOf(keepIndex),
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

  // A 2×2 grid only offers four cells, so a fifth option has to come from somewhere else: the
  // answer with a third attribute moved. It is a weaker distractor than the three cell
  // confusions, which is the right shape — those are the mistakes the question is about.
  const options = [
    { spec: answer, why: null },
    { spec: cell(0, 1), why: rowAttr },   // right column, wrong row
    { spec: cell(1, 0), why: colAttr },   // right row, wrong column
    { spec: cell(0, 0), why: 'both' },    // neither
  ]
  while (options.length < band.options) {
    const spare = usableAttrs(r, band, answer, [rowAttr, colAttr])
      .map(a => [a, otherValue(r, band, answer, a)])
      .find(([, v]) => v !== null)
    if (!spare) return null
    const cand = { ...answer, [spare[0]]: spare[1] }
    if (options.some(o => geometryKey(o.spec) === geometryKey(cand))) return null
    options.push({ spec: cand, why: spare[0] })
  }
  const keys = options.map(o => geometryKey(o.spec))
  if (new Set(keys).size !== options.length) return null

  const order = shuffle(r, indices(options.length))
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
  while (options.length < band.options) {
    const spare = usableAttrs(r, band, answer, [ruleAttr])
      .map(at => [at, otherValue(r, band, answer, at)])
      .find(([, v]) => v !== null)
    if (!spare) return null
    const cand = { ...answer, [spare[0]]: spare[1] }
    if (options.some(o => geometryKey(o.spec) === geometryKey(cand))) return null
    options.push({ spec: cand, why: spare[0] })
  }
  if (new Set(options.map(o => geometryKey(o.spec))).size !== options.length) return null

  const order = shuffle(r, indices(options.length))
  return {
    seed, type: 'analogy', layout: 'analogy', prompt: [a, b, c, null],
    options: order.map(i => options[i]),
    correct_index: order.indexOf(0),
    rule: { attr: ruleAttr, from: a[ruleAttr], to },
  }
}

// Which of these five is the figure on the left, seen in the mirror? Bond 7-8 closes paper 1
// with three of them and every band above it carries the category, and the engine had none —
// puzzleFigures has supported `flip` since the beginning and nothing but the analogy transform
// ever used it.
//
// The note there explains why it is not in ATTRIBUTES and the reason still holds: a flip
// interacts with rotation, and a right-pointing arrow flipped is the same picture as one turned
// through 180°. What makes it safe HERE is that it is not being dealt as noise among other
// attributes — it is the whole question, and geometryKey settles every case of the interaction
// by looking at the drawn result. A figure whose mirror image is itself gives no question and is
// discarded; a distractor that collides with the answer takes the draw with it.
function genReflection(r, band, seed) {
  const base = randomSpec(r, band)
  const answer = makeSpec({ ...base, flip: !base.flip })
  // Symmetric about the vertical axis — a circle, an unmarked square — and there is nothing to
  // see. This is the whole gate, and it is the drawn figure that is asked rather than the spec.
  if (geometryKey(answer) === geometryKey(base)) return null

  const turned = (spec, by) => makeSpec({ ...spec, rotation: (spec.rotation + by + 360) % 360 })

  // The mistakes the question is about, in the order the papers make them. Turning instead of
  // mirroring is the big one and it gets two entries, since a child who does it may turn either
  // way; not transforming at all is the next.
  const options = [
    { spec: answer, why: null },
    { spec: makeSpec({ ...base }), why: 'flip' },
    { spec: turned(base, 180), why: 'flip' },
    { spec: turned(answer, 90), why: 'rotation' },
  ]
  // The last distractor is a true mirror with something else moved, which is the one that asks
  // whether the child checked the figure as well as its handedness.
  while (options.length < band.options) {
    const spare = usableAttrs(r, band, answer)
      .map(a => [a, otherValue(r, band, answer, a)])
      .find(([, v]) => v !== null)
    if (!spare) return null
    options.push({ spec: makeSpec({ ...answer, [spare[0]]: spare[1] }), why: spare[0] })
  }
  if (new Set(options.map(o => geometryKey(o.spec))).size !== options.length) return null

  const order = shuffle(r, indices(options.length))
  return {
    seed, type: 'reflection', layout: 'mirror', prompt: [base],
    options: order.map(i => options[i]),
    correct_index: order.indexOf(0),
    rule: { attr: 'flip', from: base.flip, to: answer.flip },
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
  const n = band.options
  const inSet = shuffle(r, GLYPH_GROUPS[inKey].glyphs.slice())
  const outSet = shuffle(r, GLYPH_GROUPS[outKey].glyphs.slice())
  if (inSet.length < n || outSet.length < n - 1) return null

  const spec = (glyph) => makeGlyphSpec({ glyph, group: groupOf(glyph) })

  if (type === 'glyph-belongs') {
    // Three of a kind on show, and the child picks the fourth member. The three wrong options
    // all come from ONE other group, for the same reason the shape version does it: three
    // different wrong groups would leave every option isolated on the rule and the set with
    // no single defensible answer.
    const prompt = inSet.slice(0, 3).map(spec)
    const options = [spec(inSet[3]), ...outSet.slice(0, n - 1).map(spec)]
    const order = shuffle(r, indices(n))
    return {
      seed, type, layout: 'row', prompt,
      options: order.map(i => ({ spec: options[i], why: i === 0 ? null : 'group' })),
      correct_index: order.indexOf(0),
      rule: { attr: 'group', from: inKey, to: outKey },
    }
  }

  const oddIndex = Math.floor(r() * n)
  const specs = inSet.slice(0, n).map(spec)
  specs[oddIndex] = spec(outSet[0])
  return {
    seed, type: 'glyph-odd', layout: 'options-only', prompt: [],
    options: specs.map((s, i) => ({ spec: s, why: i === oddIndex ? null : 'group' })),
    correct_index: oddIndex,
    rule: { attr: 'group', from: inKey, to: outKey },
  }
}

// Odd one out on a PROPERTY rather than a category, which is how the 7-8 papers nearly always
// ask it: five things of the same kind, one of which does something the others do not. Four
// vehicles that stay on the ground and an aeroplane; four instruments you do not blow and a
// trumpet. The existing glyph-odd — four fruit and a bus — is the easier question and belongs to
// the younger band; this is the one a seven-year-old is being taught to see.
//
// Both directions are posed. Four with the property and one without reads as "which one cannot",
// four without and one with as "which one can", and they are not the same question to a child.
function genGlyphTrait(r, band, seed) {
  const want = band.options
  // Whichever side has enough members to fill the question is the majority; the odd one comes
  // from the other. A trait whose sides are both big enough offers the question in both
  // directions and they are listed separately, so neither is the default.
  const candidates = shuffle(r, TRAIT_KEYS.flatMap((key) => {
    const t = GLYPH_TRAITS[key]
    return [[t.yes, t.no], [t.no, t.yes]]
      .filter(([many, few]) => many.length >= want - 1 && few.length >= 1)
      .map(([many, few]) => ({ key, many, few }))
  }))

  for (const { key, many, few } of candidates) {
    // Several draws per candidate rather than one, because rejection here is not rare and the
    // cost of it falling to the caller is a rule that quietly disappears. `flies` has three
    // fliers against seven that do not, and of the thirty-five ways to pick four non-fliers only
    // five avoid a collision with another trait — so one draw per question put it on 3% of the
    // sheet against an even share of 12%, which is the dead rule the audit exists to catch,
    // arriving by a route the audit was not looking at. Re-drawing the SET instead of the
    // question leaves the choice of trait where it was made.
    for (let attempt = 0; attempt < 8; attempt++) {
      const majority = shuffle(r, many.slice()).slice(0, want - 1)
      const odd = pick(r, few)
      const glyphs = [...majority, odd]

      // The reason traits are written as total partitions. A second property of the same group
      // that singles out a DIFFERENT picture gives the child a second defensible answer, and
      // they would be marked wrong for giving it.
      if (traitConflict(glyphs, key, odd)) continue

      const trait = GLYPH_TRAITS[key]
      const spec = (glyph) => makeGlyphSpec({
        glyph, group: trait.group, trait: traitValue(key, glyph),
      })
      const order = shuffle(r, indices(want))
      const oddAt = glyphs.length - 1
      return {
        seed, type: 'glyph-trait', layout: 'options-only', prompt: [],
        options: order.map(i => ({ spec: spec(glyphs[i]), why: i === oddAt ? null : 'trait' })),
        correct_index: order.indexOf(oddAt),
        rule: { attr: `trait:${key}`, from: traitValue(key, majority[0]), to: traitValue(key, odd) },
      }
    }
  }
  return null
}

// A cycle of pictures. This is Bond 7-8 paper 1 question 16 almost exactly — recorder, guitar,
// saxophone, piano, recorder, guitar, and what comes next — and paper 1 question 14 with a
// period of two. It is worth naming what makes it different from the geometric `sequence`
// beside it, because they look like the same question: there, the run moves ONE ATTRIBUTE of
// one figure and the child reads a property changing; here the figures are unrelated pictures
// and the only thing to read is the ORDER. A child can be fluent at one and blank at the other,
// which is a distinction the attempt log should keep.
//
// Every option comes from the group the cycle is drawn from, which is what the papers do and is
// not decoration: one instrument among four fruit would be answerable by category, and the
// question would stop being about order at all.
function genGlyphSequence(r, band, seed) {
  const group = pick(r, GROUP_KEYS)
  const members = shuffle(r, GLYPH_GROUPS[group].glyphs.slice())
  const want = band.options
  // The cycle needs its own members and the option set needs enough pictures to fill itself
  // without repeating one, and the two draw from the same group.
  if (members.length < want) return null
  const period = Math.min(band.seqPeriod, members.length - 1)
  if (period < 2) return null

  const cycle = members.slice(0, period)
  const spec = (glyph) => makeGlyphSpec({ glyph, group })
  const n = band.seqLength
  const prompt = Array.from({ length: n }, (_, i) => spec(cycle[i % period]))
  const answer = cycle[n % period]
  // The same strongest distractor as every other sequence: the picture that just went past,
  // which is where a child reading the run as "more of the same" lands.
  const near = cycle[(n - 1) % period]

  // Cycle members first, then the group's non-members. A distractor from inside the cycle is
  // the harder one — it is in the run, just at the wrong point — so it is offered before a
  // picture that has not been seen at all.
  const rest = [...cycle.filter(g => g !== answer && g !== near), ...members.slice(period)]
  const glyphs = [answer, near, ...rest].slice(0, want)
  if (new Set(glyphs).size !== want) return null

  const order = shuffle(r, indices(want))
  return {
    seed, type: 'glyph-sequence', layout: 'row', prompt,
    options: order.map(i => ({ spec: spec(glyphs[i]), why: i === 0 ? null : 'order' })),
    correct_index: order.indexOf(0),
    rule: { attr: 'order', from: cycle[0], to: answer },
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
  const n = band.options
  const pool = shuffle(r, [...new Set(others)]
    .filter(g => g !== answer && g !== b && g !== a && !reach.has(g)))
  if (pool.length < n - 1) return null

  const spec = (glyph) => makeGlyphSpec({ glyph, group: groupOf(glyph) })
  const options = [spec(answer), ...pool.slice(0, n - 1).map(spec)]
  const order = shuffle(r, indices(n))
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
  const n = band.options
  const inSet = shuffle(r, ICON_GROUPS[inKey].icons.slice())
  const outSet = shuffle(r, ICON_GROUPS[outKey].icons.slice())
  if (inSet.length < n || outSet.length < n - 1) return null

  // One fill across the whole set. Letting it vary here would put a second attribute in play
  // on a question whose rule is category, and the validator would rightly call that ambiguous.
  const fill = pick(r, ICON_FILLS)
  const spec = (icon) => makeIconSpec({ icon, fill, group: iconGroupOf(icon) })

  if (type === 'icon-belongs') {
    const prompt = inSet.slice(0, 3).map(spec)
    const options = [spec(inSet[3]), ...outSet.slice(0, n - 1).map(spec)]
    const order = shuffle(r, indices(n))
    return {
      seed, type, layout: 'row', prompt,
      options: order.map(i => ({ spec: options[i], why: i === 0 ? null : 'group' })),
      correct_index: order.indexOf(0),
      rule: { attr: 'group', from: inKey, to: outKey },
    }
  }

  const oddIndex = Math.floor(r() * n)
  const specs = inSet.slice(0, n).map(spec)
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
  // Two icons and two fills give exactly four distinct options; a fifth needs a third icon.
  while (options.length < band.options) {
    const extra = icons[options.length - 1] ?? icons[(options.length + 1) % icons.length]
    const cand = makeIconSpec({ icon: extra, fill: ICON_FILLS[options.length % 2], group })
    if (options.some(o => iconKey(o.spec) === iconKey(cand))) return null
    options.push({ spec: cand, why: onFill ? 'icon' : 'fill' })
  }
  if (new Set(options.map(o => iconKey(o.spec))).size !== options.length) return null

  const order = shuffle(r, indices(options.length))
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
  reflection: genReflection,
  'glyph-odd': (r, band, seed) => genGlyphCategory(r, band, seed, 'glyph-odd'),
  'glyph-trait': genGlyphTrait,
  'glyph-belongs': (r, band, seed) => genGlyphCategory(r, band, seed, 'glyph-belongs'),
  'glyph-sequence': genGlyphSequence,
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
  // The count itself is a band decision (a–d at 5-6, a–e above it), so what is checked is that
  // it is one the noise tables can actually keep distinct — anything else means a generator
  // built a set nothing downstream can reason about.
  const n = q.options?.length
  if (!q || !Array.isArray(q.options) || !NOISE_VECTORS[n] || n < 4) return `options: ${n}`
  if (!(q.correct_index >= 0 && q.correct_index < n)) return 'correct_index out of range'

  // ONE QUESTION, ONE MATERIAL. All three vocabularies are in use, but they mix at the level of
  // a SHEET, never inside a single question — three line icons and one emoji is answered
  // correctly by "the colourful one", which is true and has nothing to do with the rule. The
  // material would be the loudest attribute on screen and drown whatever the question was
  // about, which is the failure `noise` prevents among attributes, one level up.
  //
  // It is checked here rather than left to generators because the check BELOW cannot see it:
  // attributesFor() reads the kind off the first spec, so a mixed set is counted against one
  // vocabulary and the other three options contribute `undefined` to every column. Mixed sets
  // are in fact rejected today, but by accident — `undefined` happens to split 3-1 and the
  // error names an innocent attribute. The next person to write a generator that mixes kinds
  // would be sent hunting the wrong thing.
  const kinds = new Set([...q.options.map(o => o.spec), ...q.prompt.filter(Boolean)]
    .map(s => s.kind ?? 'figure'))
  if (kinds.size !== 1) return `question mixes figure kinds: ${[...kinds].join(' + ')}`

  const keys = q.options.map(o => figureKey(o.spec))
  if (new Set(keys).size !== n) return 'two options draw the same picture'

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
  if (['odd-one-out', 'belongs', 'glyph-odd', 'glyph-trait', 'glyph-belongs', 'icon-odd', 'icon-belongs'].includes(q.type)) {
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
      // An (n-1)-to-1 split: one option alone on this attribute, the rest agreed. That is what
      // being the odd one out means, and with five options it is 4-1 rather than 3-1.
      const singles = Object.values(counts).filter(c => c === 1).length
      if (singles === 1 && Object.keys(counts).length === 2) splits++
      // `glyph` is the identity of the picture, so in a glyph question every option differs on
      // it by design — that is not an ambiguity, it is what makes four distinct pictures.
      else if (singles > 0 && Object.keys(counts).length > 2 && attr !== 'glyph' && attr !== 'icon') {
        return `attribute ${attr} isolates an option`
      }
    }
    if (['odd-one-out', 'glyph-odd', 'glyph-trait', 'icon-odd'].includes(q.type) && splits !== 1) {
      return `${splits} attributes split ${n - 1}-1`
    }
  }

  // The rule attribute has to SURVIVE on every option. Noise is chosen to be harmless, but
  // some attributes suppress others when the figure is normalised — a `half` split owns the
  // interior, so it erases an `inner` node — and noise landing on `half` while the rule was
  // `inner` left two options showing no inner at all. The raw specs still split 3-1, so the
  // check above passed, while the picture on screen split 1-1-2 and had no single answer.
  const ruleAttr = q.rule?.attr
  if (ruleAttr && !ruleAttr.includes('+') && !ruleAttr.startsWith('relation')) {
    for (const o of q.options) {
      if (o.spec.kind) break              // glyph and icon specs are not normalised this way
      if (!(ruleAttr in o.spec)) break    // `identity` and friends name no attribute
      if (valueKey(normalizeSpec(o.spec)[ruleAttr]) !== valueKey(o.spec[ruleAttr])) {
        return `the rule attribute ${ruleAttr} is suppressed on one option`
      }
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
  const available = [
    { types: band.types, weight: band.sources.geometric },
    { types: iconFontReady() ? band.iconTypes : [], weight: band.sources.icon },
    { types: fontReady() ? band.glyphTypes : [], weight: band.sources.glyph },
  ].filter(s => s.types.length && s.weight > 0)

  const all = available.flatMap(s => s.types)
  if (type && all.includes(type)) return buildOne(bandKey, band, [type], seed)
  if (!all.length) return null

  // Weighted by SOURCE, then uniform within it. Drawing uniformly over the pooled type list
  // instead would let the mix be decided by how many types each vocabulary happens to have —
  // band 5-6 has two emoji types and three icon types, so emoji would quietly get less of the
  // sheet than icons for no reason anyone chose.
  const roll = rng(seed + 13)() * available.reduce((t, s) => t + s.weight, 0)
  let acc = 0
  const source = available.find(s => (acc += s.weight) > roll) ?? available[0]
  return buildOne(bandKey, band, source.types, seed)
}

function buildOne(bandKey, band, types, seed) {

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
