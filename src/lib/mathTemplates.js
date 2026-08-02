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
function rangeForLevel(level) {
  const l = Math.min(Math.max(Number(level) || 1, 1), 15)
  return { min: 1, max: 4 + l * 3 } // level 1: 1-7, level 15: 1-49
}

// ─── Addition ───────────────────────────────────────────────────────────────

function additionTemplate(level) {
  const { min, max } = rangeForLevel(level)
  const a = randInt(min, max)
  const b = randInt(min, max)
  const correct_answer = a + b

  return {
    topic: 'addition',
    level,
    question_text: `${a} + ${b} = ?`,
    format: 'numeric',
    correct_answer,
    operandKey: pairKey(a, b),
    hint_steps: [
      `Try counting on from ${a}.`,
      `Count ${b} more starting at ${a}: ${a}, ${Array.from({ length: b }, (_, i) => a + i + 1).join(', ')}.`,
    ],
  }
}

// ─── Subtraction ────────────────────────────────────────────────────────────

function subtractionTemplate(level) {
  const { min, max } = rangeForLevel(level)
  // Keep it non-negative: a is the larger operand.
  const a = randInt(min + 1, max + 1)
  const b = randInt(min, a - 1)
  const correct_answer = a - b

  return {
    topic: 'subtraction',
    level,
    question_text: `${a} - ${b} = ?`,
    format: 'numeric',
    correct_answer,
    operandKey: pairKey(a, b),
    hint_steps: [
      `Start at ${a} and take away ${b}.`,
      `Count back ${b} from ${a}: ${Array.from({ length: b }, (_, i) => a - i - 1).join(', ')}.`,
    ],
  }
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
  const tables = Number(level) >= 10 ? [3, 4, 6, 7, 8, 9] : [2, 5, 10]
  const table = pick(tables)
  const other = randInt(2, 10)
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
  const l = Number(level) || 1
  const denominators = l >= 12 ? [2, 3, 4, 5, 6, 8, 10] : [2, 3, 4, 5]
  const d = pick(denominators)
  const multiplier = randInt(2, l >= 12 ? 10 : 8)
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
    visual: { kind: 'share', total: N, groups: d, highlight: 1 },
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
  // Division occupies a single rung, so there is nothing to scale between — it just needs
  // enough room not to repeat itself: 5 x 8 = 40 problems rather than the previous 20.
  const b = pick([2, 3, 4, 5, 6])
  const multiplier = randInt(2, 9)
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
    visual: { kind: 'share', total: a, groups: b },
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

const REGISTRY = {
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
