// Isolated math template-engine pilot. Pure code, no LLM calls, no images.
// Wired into production MathScreen for arithmetic topics — see templateTopicForLevel()
// there. Also has its own isolated sandbox: src/screens/MathLab.jsx.
//
// Problem shape:
//   { topic, level, question_text, format: 'numeric', correct_answer, hint_steps: [],
//     operandKey, visual? }
// operandKey identifies the underlying number pair (independent of phrasing/names) so a
// caller generating several problems in one batch can dedupe — see generateProblem's
// `avoid` param. Note it SORTS the pair, so roles are not recoverable from it.
//
// `visual` is how a template hands its operands to the help panel with their roles intact,
// which operandKey cannot do — "3 groups of 4" and "4 groups of 3" share a key. Drawing
// from this instead of re-parsing the question text is the point: text inference is what
// previously drew 2 + 1 for a question whose answer was 2×3 + 1×5. Shapes:
//   { kind: 'share',  total, groups, highlight? }  — deal total into equal groups
//   { kind: 'groups', groups, per }                — that many equal groups of that size
//   { kind: 'array',  rows, cols }                 — a rectangular arrangement
// Optional: a template without one simply gets no visual.
//
// A "template" is a function(level) -> problem. It picks numbers, builds the question
// text, computes correct_answer in code (deterministic, no model guessing), and builds
// hint_steps from that same structure — never a separate hand-written explanation that
// could drift out of sync with the actual numbers. hint_steps stop at method, never state
// the final answer — the child does that last step themselves.

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)]
}

function pairKey(a, b) {
  return [a, b].sort((x, y) => x - y).join(',')
}

// Difficulty → operand range. Same shape for every template so registry/templates agree
// on what "level" means without each template reinventing scaling.
// The ceiling used to grow by three a rung and topped out at 49, which was coherent while the
// ladder only ever went as far as "Subtraction up to 20" — but the dial now sits a child in
// their school year, and Year 5 arithmetic is not 34 + 28. A linear ceiling put "34 + 28 = ?"
// in the same ten questions as "round 384,715 to the nearest ten thousand". It grows with the
// curriculum instead: within 20, then 100, then three digits, then four, and up.
// Indexed by level. Two rungs per school year, matching the dial's year footings in
// mathCurriculum.js (Y1→2, Y2→4, Y3→6, Y4→8, Y5→10, Y6→12): within 20, within 100, three
// digits, four digits, and beyond. This is the band a question works inside — for addition
// it caps the ANSWER, so "Addition within 20" cannot produce 17 + 16.
// The top two years are deliberately below what the curriculum's "more than 4 digits" would
// allow. Screen mode gives the child no paper to work on, and a typed answer to
// 540375 + 374852 is a wall rather than a question — the gap that made our maths feel easy
// was never magnitude (the hardest arithmetic in the quiz we were compared against was
// 456 × 7) but breadth, which the curriculum topics now supply. One array to raise if
// testing says otherwise.
const MAX_FOR_LEVEL = [20, 20, 20, 100, 100, 1000, 1000, 10000, 10000, 20000, 20000, 50000, 50000, 50000, 50000, 50000]

// Which school year's footing a level sits on — 1..6. The dial is two rungs per year, so
// this is what a template consults when its difficulty is about WHICH numbers are in play
// (tables, denominators) rather than how big they get.
function bandForLevel(level) {
  const l = Math.min(Math.max(Number(level) || 1, 1), 15)
  return Math.min(6, Math.ceil(l / 2) || 1)
}

function rangeForLevel(level) {
  const l = Math.min(Math.max(Number(level) || 1, 1), 15)
  const max = MAX_FOR_LEVEL[l]
  // The floor used to be 1 at every rung, so the very easiest question was always in play
  // no matter how high the child had climbed — a ten-year-old on "Subtraction up to 20"
  // was handed "2 - 1". Raising it with the ceiling keeps each rung inside its own band.
  return { min: Math.max(1, Math.round(max / 4)), max }
}

// Whether a pair of operands can honestly be drawn as countable objects. The addition and
// subtraction help draws one emoji per unit; that is the whole point of it for a six-year-old,
// and nonsense at 34 + 28, which would put sixty-two circles on screen and ask a child to
// count them. Past this the help falls back to the template's own written steps.
export const COUNTABLE_LIMIT = 20
export function isCountable(a, b) {
  return Number.isInteger(a) && Number.isInteger(b)
    && a >= 0 && b >= 0 && a <= COUNTABLE_LIMIT && b <= COUNTABLE_LIMIT && a + b <= 30
}

// The equal-sharing picture draws one object per unit and splits them into groups. That reads
// at 20 shared among 4; at 300 shared among 12 it is a screenful of dots nobody can count, so
// past this the help falls back to the written steps the template already carries.
const SHAREABLE_LIMIT = 48
function shareVisual(total, groups, highlight) {
  if (total > SHAREABLE_LIMIT) return null
  return highlight ? { kind: 'share', total, groups, highlight } : { kind: 'share', total, groups }
}

// ─── Addition ───────────────────────────────────────────────────────────────

function additionTemplate(level) {
  const { min, max } = rangeForLevel(level)
  // Both operands used to be drawn from the whole range, so the SUM could reach twice the
  // band's ceiling — "Addition within 20" handing over 17 + 16. The ceiling belongs to the
  // answer, so the second operand is drawn from what is left of it.
  const a = randInt(min, Math.max(min, max - min))
  const b = randInt(min, Math.max(min, max - a))
  const correct_answer = a + b

  return {
    topic: 'addition',
    level,
    question_text: `${a} + ${b} = ?`,
    format: 'numeric',
    correct_answer,
    operandKey: pairKey(a, b),
    hint_steps: countingOnSteps(a, b),
  }
}

// "Count on from 19: 20, 21, 22" is the right hint for a six-year-old and absurd once the
// numbers are in the thousands — the old version listed every single number from a+1 to a+b,
// which at this level would have written out two thousand of them. Past what a child would
// ever count, it points at the method they are actually taught instead.
function countingOnSteps(a, b) {
  if (isCountable(a, b)) {
    return [
      `Try counting on from ${a}.`,
      `Count ${b} more starting at ${a}: ${a}, ${Array.from({ length: b }, (_, i) => a + i + 1).join(', ')}.`,
    ]
  }
  return [
    'Line the two numbers up by their place value — ones under ones, tens under tens.',
    'Add each column from the right, carrying into the next when a column passes 9.',
  ]
}

// ─── Subtraction ────────────────────────────────────────────────────────────

function subtractionTemplate(level) {
  const { min, max } = rangeForLevel(level)
  // a is the larger operand, kept non-negative. Both bounds matter: drawing a uniformly
  // from the whole range put it near the floor half the time, and b then had nowhere to sit
  // but right beneath it, so 44% of "Subtraction up to 20" came out as 7 - 6 and the like.
  // a now comes from the upper part of the range and b leaves a gap, so the answer is
  // actually worth working out.
  const a = randInt(Math.max(min + 1, Math.round(max * 0.55)), max + 1)
  const b = randInt(min, Math.max(min, a - 3))
  const correct_answer = a - b

  return {
    topic: 'subtraction',
    level,
    question_text: `${a} - ${b} = ?`,
    format: 'numeric',
    correct_answer,
    operandKey: pairKey(a, b),
    hint_steps: countingBackSteps(a, b),
  }
}

// Same limit as counting on, for the same reason: counting back three thousand is not a hint.
function countingBackSteps(a, b) {
  if (isCountable(a, b)) {
    return [
      `Start at ${a} and take away ${b}.`,
      `Count back ${b} from ${a}: ${Array.from({ length: b }, (_, i) => a - i - 1).join(', ')}.`,
    ]
  }
  return [
    'Line the two numbers up by their place value — ones under ones, tens under tens.',
    'Subtract each column from the right, borrowing from the next column when you need to.',
  ]
}

// ─── Multiplication word problem ────────────────────────────────────────────
// Three different problem *shapes* (groups / array / reading-rate) so a 5-question batch
// doesn't read as the same sentence with the name swapped, plus object/name/container
// word banks so phrasing varies independently of the shape.

const MULT_NAMES = ['Mia', 'Leo', 'Sam', 'Ada', 'Theo', 'Noah', 'Zoe', 'Iris']
const MULT_OBJECTS = ['marbles', 'stickers', 'cookies', 'crayons', 'pencils', 'apples', 'shells', 'buttons']
const MULT_CONTAINERS = ['baskets', 'boxes', 'jars', 'bags', 'bowls', 'trays']

function multGroupsVariant(a, b, name, object) {
  const container = pick(MULT_CONTAINERS)
  return {
    question_text: `${name} has ${a} ${container}, each with ${b} ${object} inside. How many ${object} in total?`,
    hint_steps: [
      `${name} has ${a} ${container} — that's ${a} equal groups.`,
      `Each group has ${b}, so it's ${a} groups of ${b}: ${a} × ${b}.`,
    ],
    visual: { kind: 'groups', groups: a, per: b },
  }
}

function multArrayVariant(a, b, name, object) {
  return {
    question_text: `${name} arranges ${object} in ${a} rows of ${b}. How many ${object} in total?`,
    hint_steps: [
      `That's an array: ${a} rows, with ${b} ${object} in each row.`,
      `${a} rows of ${b} is ${a} × ${b}.`,
    ],
    visual: { kind: 'array', rows: a, cols: b },
  }
}

function multReadingVariant(a, b, name) {
  return {
    question_text: `${name} reads ${b} pages a day for ${a} days. How many pages does ${name} read in total?`,
    hint_steps: [
      `${name} reads for ${a} days, ${b} pages each day.`,
      `That's ${a} days × ${b} pages: ${a} × ${b}.`,
    ],
    // Days are the groups, pages the size — same picture as containers of objects.
    visual: { kind: 'groups', groups: a, per: b },
  }
}

const MULT_VARIANTS = [multGroupsVariant, multArrayVariant, multReadingVariant]

function multiplicationWordTemplate(level) {
  // The ladder names which tables each rung practises — "×2 ×5 ×10" low down, the harder
  // ones higher up — but both rungs used to draw factors at random from the same 2..12, so
  // neither taught what it claimed and the two rungs were indistinguishable. One factor now
  // comes from the rung's own tables; the other is a plain multiplier. Which side it lands
  // on varies, so a child does not only ever meet "n groups of 5". Factors stay small
  // deliberately: word problems get unreadable with large totals.
  // Tables are taught to twelve, and stopping the multiplier at ten left the "x2 x5 x10"
  // rung with only 24 distinct problems once operandKey folds a x b and b x a together —
  // a child doing five sessions had seen all of them.
  const tables = Number(level) >= 10 ? [3, 4, 6, 7, 8, 9] : [2, 5, 10]
  const table = pick(tables)
  const other = randInt(2, 12)
  const [a, b] = Math.random() < 0.5 ? [table, other] : [other, table]
  const correct_answer = a * b
  const name = pick(MULT_NAMES)
  const object = pick(MULT_OBJECTS)
  const variant = pick(MULT_VARIANTS)
  const { question_text, hint_steps, visual } = variant(a, b, name, object)

  return {
    topic: 'multiplication-word',
    level,
    question_text,
    format: 'numeric',
    correct_answer,
    operandKey: pairKey(a, b),
    hint_steps,
    visual,
  }
}

// ─── Fraction of a number ───────────────────────────────────────────────────
// d is the denominator (2, 3, or 4); N is always a multiple of d so the answer is a
// whole number — no decimals/rounding to reason about at this level.

function fractionOfNumberTemplate(level) {
  // `level` used to be accepted and ignored, which had two consequences: a question at
  // "Fractions & Decimals" was identical to one at "Fractions", and the topic could only
  // ever produce 3 x 5 = 15 distinct problems — so a 5-question session used a third of
  // everything there was, and the next session was bound to repeat it.
  // The one step at level 12 was the whole of the scaling, so a ten-year-old and a six-year-old
  // both got "1/3 of 6". It follows the year now: bigger denominators and bigger wholes.
  const band = bandForLevel(level)
  const denominators = band >= 5 ? [2, 3, 4, 5, 6, 8, 10, 12] : band >= 3 ? [2, 3, 4, 5, 6, 8] : [2, 3, 4]
  const d = pick(denominators)
  const multiplier = randInt(band >= 5 ? 6 : band >= 3 ? 3 : 2, band >= 5 ? 25 : band >= 3 ? 12 : 6)
  const N = d * multiplier
  const correct_answer = N / d

  return {
    topic: 'fraction-of-number',
    level,
    question_text: `What is 1/${d} of ${N}?`,
    format: 'numeric',
    correct_answer,
    operandKey: pairKey(d, N),
    // Same picture as division — split into equal groups — with one group singled out,
    // which is exactly what "1/d of N" asks for.
    visual: shareVisual(N, d, 1),
    // Stops at method, never states the final share — the child does that last step.
    hint_steps: [
      `1/${d} means splitting into ${d} equal groups.`,
      `Split ${N} into ${d} equal groups: ${N} ÷ ${d}.`,
    ],
  }
}

// ─── Division word problem ──────────────────────────────────────────────────
// b is the group count (2-5); a is always a multiple of b so the share is a whole
// number — no remainders to reason about at this level.

const DIV_NAMES = ['Mia', 'Leo', 'Sam', 'Ada', 'Theo', 'Noah', 'Zoe', 'Iris']
const DIV_ITEMS = ['candies', 'stickers', 'cookies', 'marbles', 'balloons', 'crayons', 'pencils', 'stamps']
const DIV_WHO = ['friends', 'classmates', 'kids', 'teammates']

function divisionWordTemplate(level) {
  // Division used to occupy a single rung, so it took no notice of the level at all — which
  // is why a Year 5 session could be handed "28 shared among 4". It follows the year now.
  const band = bandForLevel(level)
  const b = pick(band >= 5 ? [3, 4, 6, 7, 8, 9, 12] : band >= 3 ? [2, 3, 4, 5, 6, 8] : [2, 3, 4, 5])
  const multiplier = randInt(band >= 5 ? 6 : band >= 3 ? 3 : 2, band >= 5 ? 25 : band >= 3 ? 12 : 9)
  const a = b * multiplier
  const correct_answer = a / b
  const name = pick(DIV_NAMES)
  const items = pick(DIV_ITEMS)
  const who = pick(DIV_WHO)

  return {
    topic: 'division-word',
    level,
    question_text: `${name} has ${a} ${items}. Shared equally among ${b} ${who}. How many each?`,
    format: 'numeric',
    correct_answer,
    operandKey: pairKey(a, b),
    visual: shareVisual(a, b),
    // Stops at method, never states the final share — the child does that last step.
    hint_steps: [
      `${a} shared into ${b} equal groups.`,
      `Split ${a} into ${b} groups: ${a} ÷ ${b}.`,
    ],
  }
}

// ─── Registry ───────────────────────────────────────────────────────────────

// ── Geometry ─────────────────────────────────────────────────────────────────
// This level used to be generated by the LLM, and what came out was arithmetic wearing a
// geometry costume: "Sides of a pentagon + Corners of a triangle = ?" is 5 + 3 once you
// already know the words, so it measured whether a child had met "pentagon" — and one who
// had not was stuck on what is really an addition question. Shapes are a small closed set
// with exact properties, which is what a template does best: draw the shape and let the
// child count what is in front of them.
//
// Every simple polygon has as many corners as it has sides, so both askings share one
// number — but both words are worth meeting, and seeing that they always match is itself
// the lesson.
const SHAPES = {
  triangle: 3, square: 4, rectangle: 4, pentagon: 5, hexagon: 6, octagon: 8,
}

function geometryTemplate(level) {
  // Shapes occupy a single rung on the ladder, so difficulty does not ride on the level
  // number — the rung presents its own whole range instead. Both askings, all six shapes,
  // and a mix of one shape and two: a pair tops out at 8 + 8, and since every mark is on
  // screen and countable, that stays within reach of a child who can count to sixteen.
  const pool = Object.keys(SHAPES)
  const ask = pick(['sides', 'corners'])
  const one = ask.slice(0, -1) // "sides" → "side"
  const pair = Math.random() < 0.45

  if (!pair) {
    const shape = pick(pool)
    return {
      topic: 'geometry',
      level,
      question_text: `How many ${ask} does this shape have?`,
      format: 'numeric',
      correct_answer: SHAPES[shape],
      operandKey: `${shape}:${ask}`,
      hint_steps: [
        `Start at one ${one} and go around the shape.`,
        `Count every ${one} once — the glowing one is where you are.`,
      ],
      visual: { kind: 'shapes', shapes: [shape], ask },
    }
  }

  const a = pick(pool)
  const b = pick(pool)
  return {
    topic: 'geometry',
    level,
    question_text: `How many ${ask} do these two shapes have altogether?`,
    format: 'numeric',
    correct_answer: SHAPES[a] + SHAPES[b],
    operandKey: [a, b].sort().join('+') + `:${ask}`,
    hint_steps: [
      `Count the ${ask} of the first shape, then the second.`,
      `Add the two counts together.`,
    ],
    visual: { kind: 'shapes', shapes: [a, b], ask },
  }
}

// ── Counting ────────────────────────────────────────────────────────────────
// The first rung, for the youngest children, was the one still going to the model: the
// simplest possible task carrying an API call, a wait, and a chance of a wrong answer.
// Counting is what a template is for. Two shapes of question — count what is shown, and
// say what comes next — with the objects drawn, so a child who cannot yet read the words
// can still answer.
const COUNT_ITEMS = ['🍎', '⭐', '🐟', '🌸', '🚗', '🐛', '🍓', '🎈']

function countingTemplate(level) {
  // The template took a level and ignored it, so "Numbers to 100" drew seven apples for a
  // Year 2 child in the same session as a four-digit sum. Past the first year it is a number
  // -line topic, not a counting-objects one: one more, ten more, and the steps of 2s, 5s and
  // 10s the curriculum actually names.
  if (bandForLevel(level) >= 2) return numberLineTemplate(level)

  if (Math.random() < 0.65) {
    const n = randInt(1, 10)
    return {
      topic: 'counting',
      level,
      question_text: 'How many do you see?',
      format: 'numeric',
      correct_answer: n,
      operandKey: `count:${n}`,
      hint_steps: ['Touch each one as you say the number.', 'The last number you say is the answer.'],
      visual: { kind: 'count', n, item: pick(COUNT_ITEMS) },
    }
  }
  // "What comes after 6?" — the other half of knowing the number line, and it needs no
  // arithmetic, just the order.
  const n = randInt(1, 9)
  return {
    topic: 'counting',
    level,
    question_text: `What number comes after ${n}?`,
    format: 'numeric',
    correct_answer: n + 1,
    operandKey: `after:${n}`,
    hint_steps: [`Start at ${n} and say the next number.`, 'Counting up goes 1, 2, 3, 4, 5, 6, 7, 8, 9, 10.'],
    visual: { kind: 'count', n, item: pick(COUNT_ITEMS), upTo: true },
  }
}

// Year 2 and up: "Numbers to 100" — one/ten more and less, and counting on in 2s, 5s and 10s.
// Scaled by the band so a Year 3 child works to 1000 rather than to 20.
function numberLineTemplate(level) {
  const { max: cap } = rangeForLevel(level)
  const shape = pick(['more', 'less', 'step'])

  if (shape === 'step') {
    const step = pick([2, 5, 10])
    // The whole sequence, including the answer, has to fit the year's ceiling — a Year 2
    // sequence running 370, 380, 390, 400 is outside "Numbers to 100" even though each step
    // is right.
    const highestStart = Math.max(step, cap - step * 4)
    const start = randInt(1, Math.max(1, Math.floor(highestStart / step))) * step
    const terms = [start, start + step, start + step * 2, start + step * 3]
    return {
      topic: 'counting', level,
      question_text: `${terms.join(', ')}, __ what comes next?`,
      format: 'numeric',
      correct_answer: start + step * 4,
      operandKey: `step:${step}:${start}`,
      hint_steps: [`Look at the gap between each number.`, `Each one goes up by ${step}.`],
    }
  }

  const amount = pick([1, 10])
  const up = shape === 'more'
  // The ANSWER has to fit the ceiling too: "10 more than 99" is 109, outside a Year 2 that
  // says "numbers to 100".
  const low = amount === 10 ? 10 : 2
  const n = randInt(low, Math.max(low + 1, up ? cap - amount : cap))   // randInt is inclusive
  return {
    topic: 'counting', level,
    question_text: `What is ${amount} ${up ? 'more' : 'less'} than ${n}?`,
    format: 'numeric',
    correct_answer: up ? n + amount : n - amount,
    operandKey: `${up ? 'more' : 'less'}:${amount}:${n}`,
    hint_steps: [
      amount === 10 ? 'Ten more changes the tens digit, not the ones.' : `Start at ${n}.`,
      up ? `Count ${amount} forwards from ${n}.` : `Count ${amount} backwards from ${n}.`,
    ],
  }
}

const REGISTRY = {
  counting: countingTemplate,
  addition: additionTemplate,
  subtraction: subtractionTemplate,
  'multiplication-word': multiplicationWordTemplate,
  'fraction-of-number': fractionOfNumberTemplate,
  'division-word': divisionWordTemplate,
  geometry: geometryTemplate,
}

export { SHAPES }

export const TOPICS = Object.keys(REGISTRY)

// `avoid`: optional Set of operandKey strings already used in this batch — if the first
// roll collides, reroll (bounded) until a fresh number pair comes up. Callers building a
// multi-question batch should accumulate returned operandKeys into the same Set across
// calls; single one-off calls (e.g. MathLab) can just omit it.
export function generateProblem(topic, level, avoid = null) {
  const template = REGISTRY[topic]
  if (!template) throw new Error(`Unknown math template topic: ${topic}`)
  if (!avoid) return template(level)

  const MAX_ATTEMPTS = 30
  let problem = template(level)
  for (let attempt = 1; attempt < MAX_ATTEMPTS && avoid.has(problem.operandKey); attempt++) {
    problem = template(level)
  }
  return problem
}
