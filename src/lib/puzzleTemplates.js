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
  SHAPES, FILLS, ROTATIONS, CORNERS, HALVES, SIZES, STRETCHES, INNER_NODES, POSITIONS, ATTRIBUTES,
  makeSpec, geometryKey, attrVisible, normalizeSpec, renderFigure, mirrorSpec, hasLineOfSymmetry, samePicture,
} from './puzzleFigures.js'
import {
  GLYPH_GROUPS, GROUP_KEYS, GLYPH_RELATIONS, RELATION_KEYS, GLYPH_ATTRIBUTES,
  GLYPH_TRAITS, TRAIT_KEYS, traitValue, traitConflict,
  makeGlyphSpec, glyphKey, groupOf, renderGlyph,
} from './puzzleGlyphs.js'
import {
  ICON_GROUPS, ICON_GROUP_KEYS, ICON_ATTRIBUTES, ICON_FILLS,
  makeIconSpec, iconKey, iconGroupOf, renderIcon, iconFontReady, fillIsLive,
} from './puzzleIcons.js'

export const TYPES = ['odd-one-out', 'identical', 'sequence', 'belongs', 'grid-complete', 'analogy', 'reflection', 'symmetry', 'code']

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
  code: 'puzzle_stem_code',
  symmetry: 'puzzle_stem_symmetry',
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
//   7-8   — read against Bond 11+ Assessment Papers 7-8. What that reading changed is recorded
//           at the band itself and under `sources`: the material is pictures almost end to end
//           where this band had been 70% abstract shapes, its odd-one-out questions turn on a
//           property rather than a category, and its sequences cycle whole pictures. The types
//           that came out of it — glyph-trait, glyph-sequence, reflection — are all from that
//           book. What is still missing from it: hidden shapes (paper 1 questions 25-27), and
//           reflections on pictures rather than on abstract figures.
//   8-9   — read against Bond 11+ Assessment Papers 8-9. The turn in the series: half picture
//           story-sequences and analogies, half abstract shape cycles, arrows through 45° and
//           circles in four shadings. Position, period-4 cycles and the 45° dial all arrive
//           here because that paper has them.
//   9-10  — read against Bond NVR 10 Minute Tests 9-10. Its Test 2 is Coded Shapes, which is
//           where `code` comes from and why codes are not held back to 10-11.
//   10-11 — read against Bond NVR 10 Minute Tests 10-11, and still the band that falls
//           furthest short. That book covers analogies, codes and sequences, cubes, hidden
//           shapes, similarities and symmetry. Codes now exist; cube nets, hidden shapes and
//           symmetry now exist; cube nets and hidden shapes do not, and hidden shapes needs
//           composite line drawings we cannot draw. Its figures are composite where ours are one shape
//           with nesting and four satellites, and its analogies compose two or three changes
//           where ours move one.
//
//           So this band is still nearer 9-10 in difficulty than 10-11, and the gap is worth
//           closing before anyone that age uses it. What it no longer is: the only band above
//           eight. It used to be, under the name 9-11, answering to two books at once.
//
// A pool may REPEAT a value to weight it. `half` and `inner` are structural devices that take
// over the whole interior, and drawn from a flat pool they landed on two questions out of
// three — a sheet where nearly every figure is split or nested, which is not what the papers
// look like. Repeating `null` is how a band says "use this sparingly" without any generator
// needing to know which attributes are the loud ones.
//
// `sources` is the mix of vocabularies, as plain weights: 7/2/1 reads as "of ten questions,
// seven are shapes, two icons, one emoji". Written as a ratio you can hold against the book
// rather than a probability, and each band's is held against a different book — because the
// balance is NOT a progression from pictures to shapes, which is what this file assumed until
// the 5-6 and 7-8 papers were read side by side.
//
// It goes abstract, then pictorial, then abstract again.
//
//   5-6   is the most abstract material in the series bar the oldest: hatched circles, hexagons,
//         arrow grids, noughts-and-crosses, flags on poles. Paper 5 is ten abstract questions and
//         five pictorial, and all five pictorial ones are in the ANALOGY section.
//   7-8   is pictures almost end to end. Of the thirty questions in paper 1, one is abstract.
//         Everything else is a drawing of a real thing — tools, instruments, glasses, animals,
//         scenes of someone doing something.
//   9-11  goes back to shapes, and further: codes, cube nets, symmetry, hidden figures. The
//         two 10 Minute Tests books split that range and this file follows them.
//
// Which reads as a real teaching order rather than a drift. The youngest child is shown pure
// pattern, with pictures used only where the question needs world knowledge. Then at seven the
// material moves into the world and asks what things are for. Then it abstracts again, harder.
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
    // `analogy` and `grid-complete` are here because the book has them and this band did not.
    // Paper 5 question 11 is a 2×2 grid of noughts and crosses with one cell missing, and
    // questions 12 and 13 are abstract analogies — a pentagon of dots to a column of dots, an
    // outlined triangle to a filled one. Both were reaching only the oldest band.
    types: ['odd-one-out', 'identical', 'sequence', 'grid-complete', 'analogy'],
    // Every pictorial type this band has, and glyph-analogy is here on the book's authority
    // rather than a guess. It used to be held back with a note saying relations wait for 7-8;
    // paper 5 question 11 is a bee, a jar of honey, a hen, and what a hen gives you, which is
    // the `produces` relation exactly, and question 14 is a sun-hat for the sun and a helmet for
    // a bicycle. The 5-6 analogy section is where this book puts its pictures, and it is half
    // the section.
    glyphTypes: GLYPH_TYPES.filter(t => t !== 'glyph-trait'),
    iconTypes: ICON_TYPES,
    // Left where it was, and now for a reason rather than by default: paper 5 runs ten abstract
    // questions to five pictorial, which is what 7/2/1 already says.
    sources: { geometric: 7, icon: 2, glyph: 1 },
    options: 4,               // the 5-6 papers offer a–d; every band above them offers a–e
    attributes: ['shape', 'fill', 'half', 'inner', 'dots', 'corner'],
    // Noise only, never a rule — see applyNoise. Without them a question about a dot had nothing
    // to make its four figures different pictures except changing their outline. Rotation alone
    // was not enough: it is invisible on the circle and the square, which carry most marks, and
    // barred outright on a corner question (NEEDS_FIXED), so 77% of mark questions still changed
    // shape. Size is the other thing the papers' figures do while the question is about something
    // else — the same figure, bigger or smaller.
    noise: ['rotation', 'size'],
    shapes: ['circle', 'triangle', 'square', 'hexagon'],
    fills: ['none', 'solid'],
    rotations: [0, 90, 180, 270],
    // Mostly full size, so the band still looks like its papers; the small one exists for noise.
    sizes: [1, 1, SIZES[0]],
    stretches: [1],           // "same sides, different proportions" is a 7-8 idea
    halves: [null, null, null, 'tl', 'br'],
    inners: [null, null, null, ...INNER_NODES.slice(1, 4)],
    dots: [0, 2, 4],          // a 2-vs-4 difference is countable at a glance; 3-vs-4 is not
    corners: [null, 'tl', 'br'],
    // No satellites at this age. Four parts inside one outline, three alike and one not, is a
    // lot of figure to hold at once, and the 5-6 papers put their Position questions on a single
    // moving element rather than a set. The pool still exists because randomSpec draws from
    // every pool; a band turns an attribute off by offering it nothing else to be.
    positions: [null],
    analogySteps: 1,
    seqPeriod: 2,             // dolu / boş / dolu / boş — the alternation the 5-6 papers open on
    seqLength: 4,
    seqSteps: 1,                // one thing moving: find the period and copy
  },
  '7-8': {
    types: ['odd-one-out', 'identical', 'sequence', 'belongs', 'grid-complete', 'analogy', 'reflection'],
    // No glyph-trait below 9-10. What is left of the trait table is visible in the drawing, but
    // reading a property off a picture and holding it against four others is the hardest thing
    // the pictorial family asks, and this band is where a child meets pictures at all. The
    // category question (four instruments and a fruit) is the same shape of question with
    // nothing to know.
    glyphTypes: GLYPH_TYPES.filter(t => t !== 'glyph-trait'),
    iconTypes: ICON_TYPES,
    // Inverted. This band ran at 70% abstract shapes, which is the 5-6 balance applied to the
    // one age where the book does the opposite: twenty-nine of paper 1's thirty questions are
    // drawings of real things. A seven-year-old working here was being given the wrong material
    // with the right difficulty dial on it.
    //
    // Not the book's own 97%, though, and the 20% held back is doing a job rather than hedging.
    // Reflections and grid-completion exist in this engine only in the geometric vocabulary, and
    // both are 7-8 categories in the book — paper 1 closes on three reflections. So the abstract
    // fifth is carrying pictorial categories we cannot yet draw, not adding abstraction. When a
    // pictorial reflection exists, this moves again.
    sources: { geometric: 2, icon: 3, glyph: 5 },
    options: 5,
    attributes: ['shape', 'fill', 'rotation', 'size', 'stretch', 'half', 'inner', 'dots', 'corner', 'position'],
    shapes: ['circle', 'triangle', 'square', 'pentagon', 'hexagon', 'arrow'],
    fills: ['none', 'solid', 'hatch-45', 'hatch-90'],
    rotations: [0, 90, 180, 270],
    sizes: SIZES,
    stretches: [1, 1, 0.62],
    halves: [null, null, ...HALVES.slice(1)],
    inners: [null, null, ...INNER_NODES.slice(1)],
    dots: [0, 1, 2, 3],
    corners: [null, 'tl', 'tr', 'bl', 'br'],
    positions: [null, null, ...POSITIONS.slice(1)],
    analogySteps: 1,
    seqPeriod: 3,
    seqLength: 5,
    seqSteps: 1,                // one thing moving: find the period and copy
  },
  // The turn. Read against Bond 11+ Assessment Papers 8-9, and it is the band where the series
  // changes direction: paper 1 runs five picture sequences (a post office queue, a wash going
  // out, biscuits going in the oven) straight into a shape cycle, a run of arrows turning
  // through 45°, squares divided four ways and circles in four shadings. Half pictures, half
  // abstract, which is what `sources` says.
  //
  // It is also where several things this engine had reach their real age. Question 18 is two
  // diamonds arranged differently — Position, on abstract figures. Questions 19, 20 and 24 are
  // period-4 cycles of shape, of symbol and of shading. Question 21 turns an arrow through 45°
  // rather than 90°. So the dial goes up on all four at once, and the pools here are the 7-8
  // ones with the ceilings taken off.
  '8-9': {
    types: ['odd-one-out', 'identical', 'sequence', 'belongs', 'grid-complete', 'analogy', 'reflection'],
    // No glyph-sequence from here up. A run of emoji can only cycle WHICH picture — there is
    // nothing about an emoji to alternate alongside it — so it stays the one-axis run these
    // bands have outgrown. The icon runs carry the pictorial sequence instead: they have a fill
    // axis, so they can do what the shapes do.
    glyphTypes: GLYPH_TYPES.filter(t => t !== 'glyph-sequence' && t !== 'glyph-trait'),   // trait: see 7-8
    iconTypes: ICON_TYPES,
    sources: { geometric: 5, icon: 3, glyph: 2 },
    options: 5,
    attributes: ['shape', 'fill', 'rotation', 'size', 'stretch', 'half', 'inner', 'dots', 'corner', 'position'],
    shapes: SHAPES,
    fills: FILLS,
    rotations: ROTATIONS,
    sizes: SIZES,
    stretches: [1, 1, 0.62],
    halves: [null, null, ...HALVES.slice(1)],
    inners: [null, null, ...INNER_NODES.slice(1)],
    dots: [0, 0, 1, 2, 3, 4],
    corners: CORNERS,
    positions: [null, null, ...POSITIONS.slice(1)],
    analogySteps: 1,
    seqPeriod: 4,
    seqLength: 6,
    seqSteps: 2,                // two: the cycle AND something alternating
  },
  // Split in two, because one band was answering to two books and neither of them properly.
  // bandForAge used to send every child of nine and over here, to a dial calibrated against
  // nothing in particular — and the two 10 Minute Tests books are not the same material.
  //
  // Codes begin HERE, not at 10-11: Test 2 of the 9-10 book is called Coded Shapes, six of its
  // ten tests work on composite figures, and the 10-11 book carries the same category harder.
  // The difference between the two bands is how much is moving at once rather than how fine the
  // distinctions are: 10-11 is more geometric (8/1/1 against 7/2/1), narrows figures both ways
  // rather than one, and carries five dots where this band stops at four.
  //
  // It used to be size: two sizes here and three at 10-11. Both bands now offer the same two,
  // because the third value was the 0.82 in the middle and nobody could see it — see SIZES.
  '9-10': {
    types: TYPES,
    glyphTypes: GLYPH_TYPES.filter(t => t !== 'glyph-sequence'),   // see 8-9
    iconTypes: ICON_TYPES,
    sources: { geometric: 7, icon: 2, glyph: 1 },
    options: 5,
    attributes: ATTRIBUTES,
    shapes: SHAPES,
    fills: FILLS,
    rotations: ROTATIONS,
    sizes: SIZES,
    stretches: [1, 1, 0.62],
    halves: [null, null, ...HALVES.slice(1)],
    inners: [null, null, ...INNER_NODES.slice(1)],
    dots: [0, 0, 1, 2, 3, 4],
    corners: CORNERS,
    positions: [null, null, ...POSITIONS.slice(1)],
    analogySteps: 2,
    seqPeriod: 4,
    seqLength: 6,
    seqSteps: 2,                // two: the cycle AND something alternating
  },
  '10-11': {
    types: TYPES,
    glyphTypes: GLYPH_TYPES.filter(t => t !== 'glyph-sequence'),   // see 8-9
    iconTypes: ICON_TYPES,
    sources: { geometric: 8, icon: 1, glyph: 1 },   // the older the child, the more abstract
    options: 5,
    attributes: ATTRIBUTES,
    shapes: SHAPES,
    fills: FILLS,
    rotations: ROTATIONS,
    sizes: SIZES,
    stretches: STRETCHES,
    // All three pools weight "nothing" the way the younger bands do, and for the same reason
    // twice over.
    //
    // `corner` needs a PLAIN interior: normalizeSpec gives a half-split and a nested node the
    // whole inside, so a corner mark survives only on a figure that is neither split nor nested
    // nor dotted. Weighting dots alone was not enough — with one null in nine inners and one in
    // five halves, the chance of a plain ground was under half a percent, and over 4000 draws
    // `corner` carried no rule at all. It was configured and did nothing, which is what the
    // dead-attribute check is for; the check found it the moment codes took a share of the band
    // and pushed it over the line, but it had been dying for a while.
    //
    // And a band where eight figures in nine are nested and four in five are split is uniformly
    // busy, which is not what the papers look like at any age.
    halves: [null, null, ...HALVES.slice(1)],
    inners: [null, null, null, ...INNER_NODES.slice(1)],
    dots: [0, 0, 0, 1, 2, 3, 4, 5],
    corners: CORNERS,
    positions: [null, null, ...POSITIONS.slice(1)],
    analogySteps: 2,
    seqPeriod: 4,
    // Six shown rather than five, as the 8-9 book does it. A period-4 cycle shown five long
    // gives the child exactly one element of confirmation that the run has begun again; the
    // papers give two, and at a period this long that is the difference between reading a cycle
    // and guessing one.
    seqLength: 6,
    seqSteps: 2,                // two: the cycle AND something alternating
  },
}

export const BAND_KEYS = Object.keys(BANDS)

// What each band answers to, and what it still cannot do — as data rather than prose, so the
// audit can check it. A note in a comment saying "no symmetry yet" stays there forever after
// symmetry ships; a `missing` entry naming a type that now exists fails the run.
//
// `missing` is one-directional: what the BOOK has and this engine does not. It is the honest
// half of the calibration, since `types` already says what a band poses and nothing said what it
// was leaving out. It is NOT a list of differences — a band may also pose something its book
// does not, and the 5-6 band does: the papers never ask "which one belongs with these", and it
// is offered there anyway as odd-one-out read backwards, which a five-year-old can do.
export const BOOK_COVERAGE = {
  '5-6': {
    book: 'Bond Assessment Papers: Non-verbal Reasoning 5-6 (J M Bond)',
    // Nothing. Every category in these papers is posed, which is what "calibrated question by
    // question" was supposed to mean and now has a check behind it.
    missing: [],
  },
  '7-8': {
    book: 'Bond 11+ Assessment Papers: Non-verbal Reasoning 7-8 (Andrew Baines)',
    missing: [
      'hidden shapes (paper 1 q25-27) — a small shape embedded in the lines of a bigger picture',
      'reflections of PICTURES rather than of abstract figures (paper 1 q28-30)',
      'story sequences — five drawings of someone doing something in order',
    ],
  },
  '8-9': {
    book: 'Bond 11+ Assessment Papers: Non-verbal Reasoning 8-9 (Andrew Baines)',
    missing: [
      'story sequences (paper 1 q13-17) — five drawings of someone doing something in order',
    ],
  },
  '9-10': {
    book: 'Bond 10 Minute Tests: Non-verbal Reasoning 9-10 (Alison Primrose)',
    missing: [
      'composite figures — its shapes are assemblies of parts where ours are one outline with\n'
      + '        four satellites, so a part cannot have its own shape, fill or size',
    ],
  },
  '10-11': {
    book: 'Bond 10 Minute Tests: Non-verbal Reasoning 10-11 (Alison Primrose)',
    missing: [
      'cube nets — which folded cube matches this net',
      'hidden shapes',
      'composite figures, as at 9-10',
    ],
  },
}

export function bandForAge(age) {
  const n = Number(age) || 7
  if (n <= 6) return '5-6'
  if (n <= 8) return '7-8'
  if (n <= 9) return '8-9'
  if (n <= 10) return '9-10'
  return '10-11'
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

// Which attributes differ between two figures AS DRAWN, sorted. A transform question — analogy,
// grid — names the attributes it moves, and the picture has to move exactly those: setting one
// can suppress another (a half-split clears a nested node, a new shape drops satellites it has
// no room for), and then the child sees a second change the rule never mentions. Compared on
// the normalised spec, so a suppressed field counts as changed, which is what the child sees.
const drawnDiff = (a, b) => {
  const na = normalizeSpec(a)
  const nb = normalizeSpec(b)
  return ATTRIBUTES.filter(x => valueKey(na[x]) !== valueKey(nb[x])).sort().join('+')
}
const sameAttrs = (list) => list.slice().sort().join('+')
const pool = (band, attr) => ({
  shape: band.shapes, fill: band.fills, rotation: band.rotations,
  size: band.sizes, stretch: band.stretches, half: band.halves,
  inner: band.inners, dots: band.dots, corner: band.corners, position: band.positions,
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
    position: pick(r, band.positions),
  })
}

// Attributes whose value can be moved on THIS spec and be seen. Checked per spec, not per
// band: `dots` is a real attribute until the shape is carrying none and the pool offers none.
function usableAttrs(r, band, spec, exclude = [], from = band.attributes) {
  return from.filter(a => !exclude.includes(a) && otherValue(r, band, spec, a) !== null)
}

// normalizeSpec resolves unreadable combinations by precedence — a half-split owns the whole
// interior, then a nested node, then marks. Read backwards, that is a list of what must be OUT
// OF THE WAY for each attribute to be visible at all, and it is needed in two places, so it is
// written once here.
const NEEDS_CLEAR = {
  fill: ['half', 'position', 'inner', 'dots', 'corner'],
  dots: ['half', 'position', 'inner', 'corner'],
  corner: ['half', 'position', 'inner', 'dots'],
  inner: ['half', 'position'],
  position: ['half'],
}
const EMPTY = { half: null, inner: null, dots: 0, corner: null, position: null }
const clearedFor = (attr) => Object.fromEntries((NEEDS_CLEAR[attr] || []).map(a => [a, EMPTY[a]]))

// A different kind of dependency, and one the engine had no way to say. NEEDS_CLEAR is about an
// attribute ERASING another. This is about an attribute being MEANINGLESS unless another is held
// still — the figures have to share a frame before "where is it" can be compared at all.
//
// `position` names a slot in the figure's own space, so a mark at `bl` on a figure turned 90° is
// drawn where `br` would be on an upright one. Deal rotation as noise across five options and
// the four that share a slot show their mark in four different places, while the odd one may
// land exactly where one of them did. Every check passed such a question: all five are different
// pictures, and the specs really do split 4-1 on position. Only the child, looking at it, could
// tell there was nothing to see. Over 60000 draws, 1242 of the 1244 position questions were like
// this — not an edge case, the normal case.
//
// `stretch` is the second entry, for a reason that looks different and is the same: a narrowing
// is applied in the FIGURE's frame and the rotation is applied after it, so a narrowed hexagon
// turned 45° is squeezed along a diagonal. Move both in one question and the row that says
// "narrower" and the column that says "turned" compound into a silhouette that reads as neither
// — a grid whose answer was right by both readings and unreadable by eye (10-11 seed 210458).
// Turning and narrowing are each fine on their own, and either may be the thing held still while
// the other moves; what they may not do is move together.
//
// And `position` was never the only slot. `corner` names a corner of the figure and `half` names
// a diagonal half of it, both in the figure's own frame, and both were being dealt rotation as
// noise: the specs agreed "top-left" on the three non-answers while the screen showed three
// different corners. Measured by reading the mark's direction off the drawing, 81-87% of corner
// and half odd-one-outs from 7-8 up had no single figure that stood out — the same failure the
// note above describes for position, which had been fixed for position alone.
export const NEEDS_FIXED = {
  position: ['rotation', 'flip'],
  corner: ['rotation', 'flip'],
  half: ['rotation', 'flip'],
  stretch: ['rotation'],
  rotation: ['stretch', 'position', 'corner', 'half'],
}

// Both directions of that table: `a` may not move in a question that moves `b`, whichever way
// round they were written.
const movesWith = (attr) => NEEDS_FIXED[attr] || []
const heldApart = (a, b) => movesWith(a).includes(b) || movesWith(b).includes(a)

// Pick the RULE FIRST, then draw a figure that can carry it — which is the opposite of what
// every generator here used to do, and the difference is not subtle.
//
// Drawing a figure first and asking what it can vary sounds neutral and is not: an attribute
// that works on any figure is offered every time, and one with prerequisites is offered only on
// the rare figure that happens to meet them. `corner` needs a ground that is not split, not
// nested and not dotted, and with the oldest band's pools that came to under half a percent.
// Measured over 4000 draws per band, `stretch` carried 744 rules and `corner` carried 2; the
// three bands starved corner at 19, 1 and 2, and dots at 298, 9 and 20. Every one of those is a
// dial in the config that does nothing, and the dead-attribute check could not see it because
// "did it happen at all" is true at 1 in 4000.
//
// So the wanted attribute is chosen evenly, its suppressors are cleared rather than waited for,
// and only the shape is left to chance — a corner needs a shape with a corner, and a third of
// the pool has one.
function ruleAndBase(r, band, exclude = []) {
  for (const attr of shuffle(r, band.attributes.filter(a => !exclude.includes(a)))) {
    for (let i = 0; i < 12; i++) {
      const base = makeSpec({ ...randomSpec(r, band), ...clearedFor(attr) })
      if (otherValue(r, band, base, attr) !== null) return { base, attr }
    }
  }
  return null
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
  // Noise may not land on anything that would HIDE the rule. A corner question is posed on a
  // figure deliberately cleared of splits and nesting, and noise dealing `half` across the
  // options puts the split straight back on two of them — where normalizeSpec then removes the
  // corner, and the picture no longer splits the way the specs say. validateQuestion catches
  // that and throws the draw away, so before this the cost was not a broken question but a
  // rejected one, over and over, on exactly the attributes that were already rarest.
  // A noise value has to leave the rule INTACT ON THE DRAWN FIGURE, not merely avoid the
  // attributes that obviously erase it. Noise dealing `shape` a triangle on a `position`
  // question takes the satellites away with it, because only three of the six shapes have an
  // interior wide enough to hold them — the attribute is not in NEEDS_CLEAR and erases the rule
  // anyway. Asking normalizeSpec settles every such case at once, including ones nobody has
  // thought of, and turns what used to be a rejected draw into a noise value not chosen.
  const keepsRule = (attr, v) => {
    const s = specs[0]
    if (!ruleAttr || !(ruleAttr in s)) return true
    return valueKey(normalizeSpec({ ...s, [attr]: v })[ruleAttr]) === valueKey(s[ruleAttr])
  }

  // …and the outline is held still when the rule is a MARK. A question whose answer is "the one
  // with a dot inside" was dealt two triangles and two circles as noise (5-6 seed 483268): every
  // check passed it — shape split 2-2, fill split 2-2, only `inner` split 3-1 — and on screen the
  // rule was the smallest thing there while the noise was the loudest. The papers never do that:
  // when they ask about a mark, the four figures are the same figure.
  //
  // So noise is taken quietest-first when the rule is a mark: turning, size and proportion
  // before fill, fill before a half-split, and the outline last of all. Held back rather than
  // barred, because forbidding the loud ones outright emptied an eighth of 5-6's draws.
  //
  // And a band may offer attributes as noise that it never poses as a RULE (`band.noise`). 5-6's
  // rule list has no quiet attribute in it at all — shape, fill, half and three marks — so every
  // mark question it built changed the outline, 100% of them, whatever order the list was taken
  // in. Turning a figure is not something the 5-6 papers ask about; it is something their
  // figures do while the question is about something else.
  const MARKS = ['inner', 'dots', 'corner', 'position']
  const TIER = { shape: 3, half: 2, fill: 1 }
  const barred = [ruleAttr, ...(NEEDS_CLEAR[ruleAttr] || []), ...(NEEDS_FIXED[ruleAttr] || [])]
  const noisePool = [...band.attributes, ...(band.noise || []).filter(a => !band.attributes.includes(a))]
  const candidates = usableAttrs(r, band, specs[0], barred, noisePool)
  if (MARKS.includes(ruleAttr)) candidates.sort((a, b) => (TIER[a] || 0) - (TIER[b] || 0))
  for (const attr of candidates) {
    if (used >= want) break
    const alt = otherValue(r, band, specs[0], attr)
    if (alt === null || !keepsRule(attr, alt)) continue
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
  const drawn = ruleAndBase(r, band)
  if (!drawn) return null
  const { base, attr: ruleAttr } = drawn
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
  const drawn = ruleAndBase(r, band)
  if (!drawn) return null
  const { base, attr: ruleAttr } = drawn
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

  // A SECOND thing happening, where the band asks for one. A run that cycles one attribute is
  // the easiest question in the engine: the child finds the period and copies. Bond's own runs
  // from 8-9 up put two things in motion — the shape cycles while the shading alternates — and
  // then the child has to carry both to the next place. Ours moved one at every age.
  //
  // The second axis alternates, which is the only period that composes with the first inside a
  // prompt this long: the run repeats every lcm(period, 2) figures, and the prompt has to SHOW
  // a repeat or there is no period to find. At period 4 that is 4 against a prompt of 6; at an
  // odd period it would be 2×period, which does not fit, and the run stays single-axis.
  let second = null
  if (band.seqSteps > 1 && period % 2 === 0) {
    const barred = [ruleAttr, ...(NEEDS_CLEAR[ruleAttr] || []), ...movesWith(ruleAttr)]
    for (const attr of usableAttrs(r, band, base, barred)) {
      if (heldApart(attr, ruleAttr) || (NEEDS_CLEAR[attr] || []).includes(ruleAttr)) continue
      const alt = otherValue(r, band, base, attr)
      if (alt === null) continue
      // Visible on EVERY figure of the cycle, not just the base: an attribute the rule's own
      // values suppress on one term alternates invisibly there, and the run stops alternating.
      const live = cycle.every(v => {
        const s = { ...base, [ruleAttr]: v }
        return geometryKey({ ...s, [attr]: alt }) !== geometryKey(s)
          && valueKey(normalizeSpec({ ...s, [attr]: alt })[ruleAttr]) === valueKey(v)
      })
      if (live) { second = { attr, values: [base[attr], alt] }; break }
    }
  }
  const at = i => makeSpec({
    ...base,
    [ruleAttr]: cycle[i % period],
    ...(second ? { [second.attr]: second.values[i % 2] } : {}),
  })

  const n = band.seqLength
  const prompt = Array.from({ length: n }, (_, i) => at(i))
  const answer = at(n)

  const want = band.options
  const options = [{ spec: answer, why: null }]
  // The strongest distractor in a sequence is the item that just went past — a child reading
  // the run as "more of the same" lands exactly there.
  const near = at(n - 1)
  if (geometryKey(near) !== geometryKey(answer)) options.push({ spec: near, why: ruleAttr })
  // With two axes there is a mistake that does not exist with one: carrying the cycle across and
  // forgetting what alternates. It is the strongest distractor in the set, so it comes first.
  if (second) {
    const halfRight = makeSpec({ ...answer, [second.attr]: second.values[(n + 1) % 2] })
    if (!options.some(o => geometryKey(o.spec) === geometryKey(halfRight))) {
      options.push({ spec: halfRight, why: second.attr })
    }
  }
  for (const attr of usableAttrs(r, band, answer, [ruleAttr, ...(second ? [second.attr] : [])])) {
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
    rule: {
      attr: second ? `${ruleAttr}+${second.attr}` : ruleAttr,
      from: cycle[0],
      to: cycle[n % period],
    },
  }
}

function genBelongs(r, band, seed) {
  const drawn = ruleAndBase(r, band)
  if (!drawn) return null
  const { base, attr: ruleAttr } = drawn

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

  // 2×2: one attribute is what the row means, the other is what the column means, and the
  // missing cell is the only combination not yet shown.
  const cellOf = (rowAttr, rowAlt, colAttr, colAlt) => (ri, ci) => makeSpec({
    ...base,
    [rowAttr]: ri ? rowAlt : base[rowAttr],
    [colAttr]: ci ? colAlt : base[colAttr],
  })
  // Along the top row only the column attribute may change on the page, down the left column
  // only the row attribute, and the same into the blank. A shape that cannot hold the satellites
  // or the corner mark the base carried drops them as a side effect, and a grid whose top row
  // changes two things has no single reading. Pairs are tried in turn rather than the draw
  // thrown away, because at 5-6 the pools are narrow enough that a whole redraw often lands on
  // the same kind of base again.
  let found = null
  const tries = shuffle(r, attrs.slice())
  for (let i = 0; i < tries.length && !found; i++) {
    for (let j = 0; j < tries.length && !found; j++) {
      if (i === j) continue
      const [rowAttr, colAttr] = [tries[i], tries[j]]
      if (heldApart(rowAttr, colAttr)) continue
      const rowAlt = otherValue(r, band, base, rowAttr)
      const colAlt = otherValue(r, band, base, colAttr)
      if (rowAlt === null || colAlt === null) continue
      const cell = cellOf(rowAttr, rowAlt, colAttr, colAlt)
      if (drawnDiff(cell(0, 0), cell(0, 1)) !== colAttr || drawnDiff(cell(1, 0), cell(1, 1)) !== colAttr) continue
      if (drawnDiff(cell(0, 0), cell(1, 0)) !== rowAttr || drawnDiff(cell(0, 1), cell(1, 1)) !== rowAttr) continue
      found = { rowAttr, colAttr, cell }
    }
  }
  if (!found) return null
  const { rowAttr, colAttr, cell } = found
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
    const spare = shuffle(r, usableAttrs(r, band, answer, [rowAttr, colAttr]))
      .filter(a => !heldApart(a, rowAttr) && !heldApart(a, colAttr))
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
  const drawn = ruleAndBase(r, band)
  if (!drawn) return null
  const { base: a, attr: ruleAttr } = drawn
  const to = otherValue(r, band, a, ruleAttr)
  if (to === null) return null

  // A SECOND change, where the band asks for one. Bond's analogies at 9-10 and above do not move
  // one thing — they turn a figure and shade it and shrink it, and the child has to carry all of
  // it across to the second pair. Ours moved exactly one attribute at every age, which is the
  // 5-6 form of the question wearing an older band's pools.
  //
  // The second attribute must not be one that would SUPPRESS the first, or applying both leaves
  // the first invisible and the analogy silently becomes a one-step question again.
  const steps = [{ attr: ruleAttr, to }]
  if (band.analogySteps > 1) {
    const barred = [ruleAttr, ...(NEEDS_CLEAR[ruleAttr] || []), ...movesWith(ruleAttr)]
    // Shuffled, not taken in order. `usableAttrs` returns the band's list in the band's order and
    // `shape` heads it, so picking the first usable one put `shape` in essentially every two-step
    // rule — twelve analogies rendered, twelve of them `something+shape`. The same slip is one
    // line down, where the attribute that makes C differ from A was also always the first.
    const second = shuffle(r, usableAttrs(r, band, a, barred)
      .filter(x => !(NEEDS_CLEAR[x] || []).includes(ruleAttr) && !heldApart(x, ruleAttr)))
      .map(x => [x, otherValue(r, band, a, x)])
      .find(([, v]) => v !== null)
    if (!second) return null
    steps.push({ attr: second[0], to: second[1] })
  }
  const apply = (spec) => {
    const out = { ...spec }
    for (const s of steps) out[s.attr] = s.to
    return out
  }
  const moved = steps.map(s => s.attr)

  // The transform has to mean the same thing on both sides, so it is "set these attributes to
  // these values" rather than "change them somehow" — otherwise A→B and C→? are two different
  // rules that happen to look alike.
  const b = apply(a)
  // What makes C differ from A may not be something that SUPPRESSES a step. Shift `half` on an
  // analogy whose rule moves `dots` and normalizeSpec takes the dots off C, so the second pair
  // starts from a figure that already differs from A on the very thing being carried across —
  // and the child is asked to apply a change that has nowhere to land.
  // Held apart from the steps too, and not only cleared: C differing from A on `rotation` while
  // the step is `stretch` puts the same compounded silhouette in the second pair — the child
  // applies "narrower" to a figure that is already turned, and the narrowing lands on a diagonal.
  const cAttrs = shuffle(r, usableAttrs(r, band, a, moved))
    .filter(x => !moved.some(m => (NEEDS_CLEAR[m] || []).includes(x) || heldApart(m, x)))
  if (!cAttrs.length) return null
  const cShift = otherValue(r, band, a, cAttrs[0])
  if (cShift === null) return null
  const c = { ...a, [cAttrs[0]]: cShift }
  // Compared on the DRAWN figure, not the raw spec. The table above names the suppressions it
  // knows; this catches the ones it does not, which is how the audit found this in the first
  // place — the specs agreed on `dots` while the pictures did not.
  if (moved.some(x => valueKey(normalizeSpec(c)[x]) !== valueKey(normalizeSpec(a)[x]))) return null
  const answer = apply(c)
  // Both steps have to SURVIVE on the answer. One can still erase the other through a route
  // NEEDS_CLEAR does not name — the shape carrying them changed too — and then the pair shows
  // two changes while the answer shows one.
  if (moved.some(x => valueKey(normalizeSpec(answer)[x]) !== valueKey(answer[x]))) return null
  // And on BOTH pairs the drawing changes in exactly the steps — no fewer, no more — and each
  // step is visible on its own. The checks above look at the steps' own fields; this looks at
  // the picture. It is what was missing when a `dots+rotation` rule drew an A with no dots (too
  // small to count, and they took the hatching with them) beside a B with none either, so the
  // child saw a shading change the rule did not name and a dot change that was not there.
  const shown = sameAttrs(moved)
  if (drawnDiff(a, b) !== shown || drawnDiff(c, answer) !== shown) return null
  if (steps.some(st => geometryKey({ ...b, [st.attr]: a[st.attr] }) === geometryKey(b)
    || geometryKey({ ...answer, [st.attr]: c[st.attr] }) === geometryKey(answer))) return null

  const options = [
    { spec: answer, why: null },
    { spec: { ...c }, why: ruleAttr },          // transform not applied
    { spec: { ...b }, why: cAttrs[0] },         // transform applied to the wrong figure
    { spec: { ...a }, why: 'both' },
  ]
  // With two steps there is a mistake that does not exist with one: carrying half the transform
  // across. It is the strongest distractor in the set, so it is offered before the spares below.
  if (steps.length > 1) {
    const half = { ...c, [steps[0].attr]: steps[0].to }
    if (!options.some(o => geometryKey(o.spec) === geometryKey(half))) {
      options.push({ spec: half, why: steps[1].attr })
    }
  }
  while (options.length < band.options) {
    const spare = shuffle(r, usableAttrs(r, band, answer, moved))
      .filter(at => !moved.some(m => heldApart(m, at)))
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
    rule: { attr: moved.join('+'), from: a[ruleAttr], to },
  }
}

// Which one of these has a line of symmetry? Symmetry is one of the six categories the 10-11
// book covers and the engine reached none of it.
//
// It costs almost nothing, because the test already exists in the negative: `reflection` throws
// away any figure whose mirror image is itself, since there is then nothing to see. That
// discarded set IS the answer set here. One predicate, read the other way round.
//
// Both directions are posed. Four symmetrical figures and one that is not asks the child to spot
// the broken one, which is the harder reading; one symmetrical among four that are not is the
// plainer one. The papers use both — and each direction carries ITS OWN STEM. There was one
// stem, "which one has a line of symmetry?", and in the harder direction it marked the one
// figure that had none, so half of these questions told a child the right answer was wrong.
//
// "A line of symmetry" is any line, not the figure's own vertical. The predicate here used to be
// "toggling flip gives the same picture", which is that one axis, so a hexagon turned 45° could
// sit among the "no symmetry" options. See hasLineOfSymmetry.
const isSymmetric = hasLineOfSymmetry

function genSymmetry(r, band, seed) {
  const want = band.options
  // Draw a pool of figures and sort them by the predicate, rather than trying to construct a
  // symmetrical figure directly — whether a figure comes out symmetrical depends on its shape,
  // rotation, fill angle, split, marks and satellites all at once, and geometryKey is the only
  // thing that knows.
  const yes = []
  const no = []
  for (let i = 0; i < 90 && (yes.length < want || no.length < want); i++) {
    const spec = randomSpec(r, band)
    const bucket = isSymmetric(spec) ? yes : no
    if (bucket.some(s => geometryKey(s) === geometryKey(spec))) continue
    bucket.push(spec)
  }
  const oddIsSymmetric = r() < 0.5
  const [few, many] = oddIsSymmetric ? [yes, no] : [no, yes]
  if (!few.length || many.length < want - 1) return null

  const specs = [...many.slice(0, want - 1), few[0]]
  if (new Set(specs.map(geometryKey)).size !== want) return null

  const order = shuffle(r, indices(want))
  const oddAt = want - 1
  return {
    seed, type: 'symmetry', layout: 'options-only', prompt: [],
    stem_key: oddIsSymmetric ? 'puzzle_stem_symmetry' : 'puzzle_stem_symmetry_none',
    options: order.map(i => ({ spec: specs[i], why: i === oddAt ? null : 'symmetry' })),
    correct_index: order.indexOf(oddAt),
    rule: { attr: 'symmetry', from: !oddIsSymmetric, to: oddIsSymmetric },
  }
}

// Codes. Two of the ten topic tests in Bond's 10-11 book, and the engine had none of it.
//
// Five figures are shown, each labelled with a two-letter code. The first letter says what one
// attribute is doing and the second says what another is doing, drawn from DISJOINT alphabets so
// a child can tell which letter is about which — that is the book's own convention and it is
// what makes the question readable at all. Then a sixth figure, and the child picks its code.
//
// This is the one question type whose OPTIONS ARE NOT PICTURES. Everything else in this file
// offers five figures; a code question offers five strings. The alternative was to invert it —
// show a code and ask which figure it describes — which keeps the shape of every other question
// and is not what the book asks, because it only ever tests the mapping in one direction.
//
// Two conditions make it reasoning rather than recall, and both are enforced rather than hoped
// for:
//
//   Every value the answer uses must already be on display with its letter. Otherwise the child
//   is asked for a letter nothing on the page could have taught them, which is not a hard
//   question, it is an unanswerable one.
//
//   The answer's COMBINATION must be one the prompt does not show. If it were shown, the child
//   finds the matching picture and copies its code, and the question measures whether they can
//   spot two identical drawings. The whole point is to learn each letter from a different figure
//   and put them together.
//
// Nine combinations, five shown, and the answer from the four that are not.
const CODE_LETTERS = [['A', 'B', 'C'], ['X', 'Y', 'Z']]

function genCode(r, band, seed) {
  const base = randomSpec(r, band)
  const attrs = shuffle(r, usableAttrs(r, band, base))
  if (attrs.length < 2) return null

  // Each axis needs three values that are three different pictures, not merely three different
  // spec fields — the same requirement `sequence` has, for the same reason.
  const valuesFor = (attr) => {
    const seen = new Set([geometryKey(base)])
    const out = [base[attr]]
    for (const v of pool(band, attr)) {
      if (out.length >= 3) break
      if (!attrVisible(base, attr, v)) continue
      const k = geometryKey({ ...base, [attr]: v })
      if (seen.has(k)) continue
      seen.add(k)
      out.push(v)
    }
    return out.length === 3 ? out : null
  }

  let axes = null
  for (let i = 0; i < attrs.length && !axes; i++) {
    for (let j = i + 1; j < attrs.length && !axes; j++) {
      if (heldApart(attrs[i], attrs[j])) continue
      const a = valuesFor(attrs[i])
      const b = valuesFor(attrs[j])
      if (a && b) axes = [{ attr: attrs[i], values: a }, { attr: attrs[j], values: b }]
    }
  }
  if (!axes) return null

  const figure = (i, j) => makeSpec({
    ...base, [axes[0].attr]: axes[0].values[i], [axes[1].attr]: axes[1].values[j],
  })
  const codeOf = (i, j) => CODE_LETTERS[0][i] + CODE_LETTERS[1][j]

  const cells = shuffle(r, [0, 1, 2].flatMap(i => [0, 1, 2].map(j => [i, j])))
  const shown = cells.slice(0, 5)
  const rest = cells.slice(5)

  // Coverage, checked and not assumed: five of nine cells can easily miss a whole row, and then
  // one of the three letters never appears on the page.
  const covers = (k) => new Set(shown.map(c => c[k])).size === 3
  if (!covers(0) || !covers(1)) return null

  const [ai, aj] = pick(r, rest)
  const answer = codeOf(ai, aj)

  // The near misses, which are the mistakes the question is about: the right first letter with
  // the wrong second, and the wrong first with the right second. A child who read only one of
  // the two axes lands on exactly these.
  const wrong = shuffle(r, [
    ...[0, 1, 2].filter(j => j !== aj).map(j => ({ code: codeOf(ai, j), why: 'second' })),
    ...[0, 1, 2].filter(i => i !== ai).map(i => ({ code: codeOf(i, aj), why: 'first' })),
    ...cells.filter(([i, j]) => i !== ai && j !== aj).map(([i, j]) => ({ code: codeOf(i, j), why: 'both' })),
  ])
  const options = [{ code: answer, why: null }]
  for (const w of wrong) {
    if (options.length >= band.options) break
    if (options.some(o => o.code === w.code)) continue
    options.push(w)
  }
  if (options.length < band.options) return null

  const order = shuffle(r, indices(band.options))
  return {
    seed, type: 'code', layout: 'code',
    prompt: [...shown.map(([i, j]) => figure(i, j)), figure(ai, aj)],
    promptLabels: [...shown.map(([i, j]) => codeOf(i, j)), '?'],
    options: order.map(i => options[i]),
    correct_index: order.indexOf(0),
    rule: { attr: `code:${axes[0].attr}+${axes[1].attr}`, from: null, to: answer },
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
//
// The answer is mirrorSpec(base), not `flip` toggled — those agree only at 0° and 180°, and this
// generator used to pose the second as the first. See the note on mirrorSpec.
function genReflection(r, band, seed) {
  const base = randomSpec(r, band)
  const answer = makeSpec(mirrorSpec(base))
  // Symmetric about the vertical axis — a circle, an unmarked square — and there is nothing to
  // see. This is the whole gate, and it is the drawn figure that is asked rather than the spec.
  if (samePicture(answer, base)) return null

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
  //
  // Not its SHAPE, though, unless there is nothing else to move. A square among four hexagons is
  // eliminated without thinking about mirrors at all, so it costs the question one of its five
  // options and teaches nothing — and it is what this picked, being the first attribute in the
  // list. Every other attribute keeps the same object and asks the child to look at it.
  while (options.length < band.options) {
    const movable = shuffle(r, usableAttrs(r, band, answer))
      .map(a => [a, otherValue(r, band, answer, a)])
      .filter(([, v]) => v !== null)
    const spare = movable.find(([a]) => a !== 'shape') ?? movable[0]
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
  // same alternation reads as one question asked four times. The fill axis is only offered when
  // the icon carrying it HAS a solid form — the whole `symbol` group is strokes, and a run built
  // on filling a × would be six identical figures. validateQuestion would reject it, so this is
  // not a correctness fix; it stops a tenth of the draws being spent discovering the same thing
  // over and over.
  const onFill = fillIsLive(icons[0]) && r() < 0.6
  const n = band.seqLength
  // The icon axis honours the band's period. It used to alternate between two icons at every
  // age, whatever the band declared, so a 10-year-old and a 5-year-old got the same run — while
  // Bond 8-9 question 20 cycles four symbols and question 19 four shapes. The fill axis stays at
  // two because outline and solid are all there is; a period is only as long as its pool.
  const period = onFill ? 2 : Math.min(band.seqPeriod, icons.length)
  if (period < 2) return null
  // A SECOND thing happening, where the band asks for one — the same step the geometric runs
  // take at 8-9 (see genSequence). The icons cycle and the fill alternates underneath them, so
  // the child has to carry both. It needs every icon in the cycle to HAVE a solid form, and an
  // even period, so that the whole run still repeats inside the prompt.
  //
  // The cycle is drawn from the icons that HAVE one, rather than from the group in the order it
  // was shuffled: fourteen of the forty-seven icons draw the same at either end of the fill axis
  // (FILL_DOES_NOTHING), and asking for four live ones out of a shuffled six came up empty every
  // time — the two-axis run existed in the code and never once reached a child.
  const live = icons.filter(fillIsLive)
  const alternateFill = !onFill && band.seqSteps > 1 && period % 2 === 0 && live.length >= period
  const run = alternateFill ? live : icons
  const at = (i) => (onFill
    ? makeIconSpec({ icon: icons[0], fill: ICON_FILLS[i % 2], group })
    : makeIconSpec({ icon: run[i % period], fill: alternateFill ? ICON_FILLS[i % 2] : 0, group }))

  const prompt = Array.from({ length: n }, (_, i) => at(i))
  const answer = at(n)
  const near = at(n - 1)

  const options = [{ spec: answer, why: null }, { spec: near, why: onFill ? 'fill' : 'icon' }]
  // Right icon, wrong fill: the child who followed the cycle and missed what alternates.
  if (alternateFill) {
    const halfRight = makeIconSpec({ icon: answer.icon, fill: ICON_FILLS[(n + 1) % 2], group })
    if (!options.some(o => iconKey(o.spec) === iconKey(halfRight))) options.push({ spec: halfRight, why: 'fill' })
  }
  // The rest of the set: the same two mistakes on another icon, then whatever the group has
  // left. Written against the ANSWER's own fill rather than a hardcoded 1 — with the fill axis
  // alternating under the cycle, "the answer with fill 1" is sometimes the answer itself, and a
  // two-axis run was built and thrown away as "two options draw the same picture" every single
  // time. The whole feature existed and never reached a child.
  const other = (fill) => ICON_FILLS[(ICON_FILLS.indexOf(fill) + 1) % ICON_FILLS.length]
  const alt = run[2] ?? run[1]
  const add = (spec, why) => {
    if (!options.some(o => iconKey(o.spec) === iconKey(spec))) options.push({ spec, why })
  }
  add(onFill
    ? makeIconSpec({ icon: alt, fill: answer.fill, group })
    : makeIconSpec({ icon: answer.icon, fill: other(answer.fill), group }), onFill ? 'icon' : 'fill')
  add(onFill
    ? makeIconSpec({ icon: alt, fill: near.fill, group })
    : makeIconSpec({ icon: near.icon, fill: other(near.fill), group }), 'both')
  // Two icons and two fills give exactly four distinct options; a fifth needs a third icon.
  for (let k = 0; options.length < band.options; k++) {
    if (k >= run.length * ICON_FILLS.length) return null
    add(makeIconSpec({ icon: run[k % run.length], fill: ICON_FILLS[Math.floor(k / run.length) % ICON_FILLS.length], group }),
      onFill ? 'icon' : 'fill')
  }
  if (new Set(options.map(o => iconKey(o.spec))).size !== options.length) return null

  const order = shuffle(r, indices(options.length))
  return {
    seed, type: 'icon-sequence', layout: 'row', prompt,
    options: order.map(i => options[i]),
    correct_index: order.indexOf(0),
    rule: { attr: onFill ? 'fill' : alternateFill ? 'icon+fill' : 'icon', from: null, to: null },
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
  code: genCode,
  symmetry: genSymmetry,
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

  // A code question's options are STRINGS, not figures, so every check below — which is about
  // pictures being distinguishable — has nothing to hold. It gets its own short list instead of
  // an exemption, because the same properties still matter: the options must be different from
  // each other, every figure on display must be drawable, and each figure must carry its label.
  if (q.type === 'code') {
    const codes = q.options.map(o => o.code)
    if (codes.some(c => typeof c !== 'string')) return 'a code option carries no code'
    if (new Set(codes).size !== n) return 'two options offer the same code'
    if (q.promptLabels?.length !== q.prompt.length) return 'a prompt figure has no label'
    if (q.prompt.some(c => !c || !geometryKey(c))) return 'unrenderable prompt cell'
    // Two figures on display with the same picture but different labels is a contradiction the
    // child cannot resolve; with the SAME label it is a freebie. Either way the page is wrong.
    const keys = q.prompt.map(geometryKey)
    if (new Set(keys).size !== keys.length) return 'two figures in the prompt draw the same picture'
    return null
  }

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
  // And without the key's rounding, for figures: two keys a tenth apart can be one picture. See
  // samePicture.
  const figs = q.options.map(o => o.spec).filter(sp => !sp.kind)
  for (let i = 0; i < figs.length; i++) {
    for (let j = i + 1; j < figs.length; j++) {
      if (samePicture(figs[i], figs[j])) return 'two options draw the same picture'
    }
  }

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
    // Counted on the NORMALIZED spec — the picture — and not the raw one. The two disagree
    // whenever an attribute is suppressed on some options and not others, and the raw reading
    // then describes a set that was never drawn. A `position` question makes this routine: only
    // three of the six shapes have an interior wide enough for satellites, so noise dealing
    // `shape` leaves specs that all say position 'bl' while two figures show satellites and
    // three show none.
    //
    // Today's noise vectors happen to keep that harmless — no noise column has a singleton, so a
    // suppressed column cannot isolate an option either. But that is an argument about the
    // current table, not a property of the check, and the same argument was made before about
    // `half` erasing `inner` and was wrong. Counting the drawn figure needs no argument.
    const specs = q.options.map(o => (o.spec.kind ? o.spec : normalizeSpec(o.spec)))
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
  // An icon question is only offered when the font that draws it has arrived. Without the gate
  // the fallback is not a missing picture but a wrong one — see iconFontReady(). Glyphs are
  // drawings shipped in the bundle (puzzleArt.generated.js) and have nothing to wait for.
  const available = [
    { types: band.types, weight: band.sources.geometric },
    { types: iconFontReady() ? band.iconTypes : [], weight: band.sources.icon },
    { types: band.glyphTypes, weight: band.sources.glyph },
  ].filter(s => s.types.length && s.weight > 0)

  // Geometric is the FLOOR, whatever weight the band gives it. This became load-bearing the
  // moment 7-8 was inverted: that band is four-fifths pictures, and the pictorial types are
  // exactly the ones behind the font gate. A band that leaned entirely on them would hand back
  // nothing at all when a font failed to arrive — not a smaller session, an empty one, and the
  // gate that exists to protect the answer key would have become the thing that broke the
  // screen. Shapes need no font, so they carry the sheet when nothing else can, and the child
  // gets an abstract session instead of a blank one.
  if (!available.length) available.push({ types: band.types, weight: 1 })

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
    // A generator may pick the stem itself when one type is asked two ways (symmetry).
    if (q && !validateQuestion(q)) return { ...q, band: bandKey, stem_key: q.stem_key ?? STEM_KEYS[q.type] }
  }
  return null
}

// What makes two questions THE SAME QUESTION, rather than the same numbers. Two built on the
// same rule with the same answer read alike even when everything behind them differs, so this is
// deliberately coarser than the drawn figures — as drawn, essentially every question in a month
// is unique, which is true and says nothing about whether a sheet feels repetitive.
//
// Exported because the audit measures the repeat rate and must measure the thing that is
// actually deduplicated. It did not: it built its own signature out of JSON.stringify(spec)
// while this one used figureKey. A geometric spec carries its noise attributes into
// stringification and a glyph spec has none to carry, so the audit's version counted a
// shapes-heavy band as far more varied than a pictures-heavy one for no reason a child would
// recognise. Read that way, inverting 7-8 looked like it cut variety from 549 to 357; read the
// way the deduper reads it, 7-8 sits at 354 against 5-6's 356, which is the same sheet.
//
// `from` and `to` belong in it. Without them every glyph-odd with the same answer was one
// question, so four vehicles and an apple blocked four instruments and an apple from the same
// session — different questions about the same picture. Including them puts 7-8 at 449.
export function questionSignature(q) {
  const v = (x) => (x && typeof x === 'object' ? JSON.stringify(x) : String(x))
  const answer = q.options[q.correct_index]
  // A code question's answer is a string and has no figure. Its identity is the pair of
  // attributes it encodes plus the figure being asked about, which is the last prompt cell —
  // the letters themselves say nothing, since A means a different thing in every question.
  const id = answer.spec ? figureKey(answer.spec) : figureKey(q.prompt[q.prompt.length - 1])
  return `${q.type}|${q.rule.attr}|${v(q.rule.from)}>${v(q.rule.to)}|${id}`
}

export function generateSession(bandKey, count = 10, seed = Date.now()) {
  const out = []
  const seen = new Set()
  for (let i = 0; out.length < count && i < count * 40; i++) {
    const q = generateQuestion(bandKey, null, seed + i * 104729)
    if (!q) continue
    const sig = questionSignature(q)
    if (seen.has(sig)) continue
    seen.add(sig)
    out.push(q)
  }
  return out
}

export { renderFigure, renderGlyph, renderIcon }
