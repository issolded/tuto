// Isolated math template-engine pilot. Pure code, no LLM calls, no images.
// Wired into production MathScreen for arithmetic topics — see templateTopicForLevel()
// there. Also has its own isolated sandbox: src/screens/MathLab.jsx.
//
// Problem shape:
//   { topic, level, question_text, format: 'numeric', correct_answer, hint_steps: [],
//     operandKey }
// operandKey identifies the underlying number pair (independent of phrasing/names) so a
// caller generating several problems in one batch can dedupe — see generateProblem's
// `avoid` param.
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
  }
}

function multArrayVariant(a, b, name, object) {
  return {
    question_text: `${name} arranges ${object} in ${a} rows of ${b}. How many ${object} in total?`,
    hint_steps: [
      `That's an array: ${a} rows, with ${b} ${object} in each row.`,
      `${a} rows of ${b} is ${a} × ${b}.`,
    ],
  }
}

function multReadingVariant(a, b, name) {
  return {
    question_text: `${name} reads ${b} pages a day for ${a} days. How many pages does ${name} read in total?`,
    hint_steps: [
      `${name} reads for ${a} days, ${b} pages each day.`,
      `That's ${a} days × ${b} pages: ${a} × ${b}.`,
    ],
  }
}

const MULT_VARIANTS = [multGroupsVariant, multArrayVariant, multReadingVariant]

function multiplicationWordTemplate(level) {
  const { max } = rangeForLevel(level)
  // Keep both factors small-ish even at high levels — word problems get unreadable
  // with huge totals — independent cap from the additive range, but wider than before
  // so higher levels still feel harder.
  const factorMax = Math.min(12, Math.max(3, Math.floor(max / 2)))
  const a = randInt(2, factorMax)
  const b = randInt(2, factorMax)
  const correct_answer = a * b
  const name = pick(MULT_NAMES)
  const object = pick(MULT_OBJECTS)
  const variant = pick(MULT_VARIANTS)
  const { question_text, hint_steps } = variant(a, b, name, object)

  return {
    topic: 'multiplication-word',
    level,
    question_text,
    format: 'numeric',
    correct_answer,
    operandKey: pairKey(a, b),
    hint_steps,
  }
}

// ─── Fraction of a number ───────────────────────────────────────────────────
// d is the denominator (2, 3, or 4); N is always a multiple of d so the answer is a
// whole number — no decimals/rounding to reason about at this level.

function fractionOfNumberTemplate(level) {
  const d = pick([2, 3, 4])
  const multiplier = randInt(2, 6)
  const N = d * multiplier
  const correct_answer = N / d

  return {
    topic: 'fraction-of-number',
    level,
    question_text: `What is 1/${d} of ${N}?`,
    format: 'numeric',
    correct_answer,
    operandKey: pairKey(d, N),
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
  const b = pick([2, 3, 4, 5])
  const multiplier = randInt(2, 6)
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
    // Stops at method, never states the final share — the child does that last step.
    hint_steps: [
      `${a} shared into ${b} equal groups.`,
      `Split ${a} into ${b} groups: ${a} ÷ ${b}.`,
    ],
  }
}

// ─── Registry ───────────────────────────────────────────────────────────────

const REGISTRY = {
  addition: additionTemplate,
  subtraction: subtractionTemplate,
  'multiplication-word': multiplicationWordTemplate,
  'fraction-of-number': fractionOfNumberTemplate,
  'division-word': divisionWordTemplate,
}

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
