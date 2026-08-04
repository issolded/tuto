// What a maths session is ABOUT.
//
// This used to be decided by the level ladder: rung 6 was "Subtraction up to 20", so a
// ten-year-old — who starts at rung 6 — practised subtraction, and only subtraction, every
// session. Reaching the ladder's top rung took nine rungs at two good sessions each, and the
// top rung was "1/4 of 28". A whole year's curriculum was compressed into one rope of mostly
// arithmetic, and a child could climb it for a week without meeting area, place value,
// decimals or order of operations at all.
//
// Meanwhile BRITISH_CURRICULUM has sat in gemini.js since early on: 49 topics across Year 1
// to Year 6, each with a description written to be handed to a model, each already mapped to
// an age. `generateMathQuestions` even takes the `topicId` that would have used it. Nothing
// ever passed one. The taxonomy was written and never fed.
//
// So the two jobs are separated here:
//   - AGE decides the curriculum — a ten-year-old gets Year 5's eight topics, all of them.
//   - LEVEL decides the difficulty within those topics, and nothing else.
//
// A session draws across topics rather than drilling one, which is what makes a quiz look
// like a quiz instead of a worksheet.
import { BRITISH_CURRICULUM, ageToSchoolYear } from './gemini'

// Which curriculum topics a code template can actually express, decided one topic at a time.
//
// The obvious shortcut — match on the topic's `operations` tags — is wrong in a way that is
// hard to see and easy to ship: "Decimals and Percentages" is tagged `fractions`, so it would
// draw "What is 1/4 of 28?"; "Numbers to 1,000,000" is tagged `counting`, so it would draw a
// picture of seven apples. The question would look fine and teach the wrong thing, which is
// exactly the failure the help panel had when it inferred a method from question text.
//
// So a template is used only where it genuinely represents the topic, and the model gets
// everything else. That leaves the deterministic core — guaranteed-correct answers and the
// visual help panels — holding the early years, where the help matters most because the child
// is under eight, and the model carrying the later years, where our templates do not reach:
// tables stop at 12, so Year 6's long multiplication is not something code here can pose.
const TEMPLATE_FOR_TOPIC = {
  y1_place_value: 'counting',
  y1_addition: 'addition',
  y1_subtraction: 'subtraction',
  y1_fractions: 'fraction-of-number',
  y1_shapes: 'geometry',

  y2_place_value: 'counting',
  y2_addition: 'addition',
  y2_subtraction: 'subtraction',
  y2_multiplication: 'multiplication-word',
  y2_division: 'division-word',
  y2_fractions: 'fraction-of-number',

  y3_addition: 'addition',
  y3_subtraction: 'subtraction',
  y3_multiplication: 'multiplication-word',
  y3_division: 'division-word',
  y3_fractions: 'fraction-of-number',
  y3_geometry: 'geometry',

  y4_addition: 'addition',
  y4_subtraction: 'subtraction',
  y4_multiplication: 'multiplication-word',
  y4_division: 'division-word',
  y4_fractions: 'fraction-of-number',
  y4_geometry: 'geometry',

  y5_addition: 'addition',
  y5_multiplication: 'multiplication-word',
  y5_division: 'division-word',
  y5_fractions: 'fraction-of-number',

  // Deliberately absent, and it is worth saying why rather than leaving a silent gap:
  // money and time (no template), place value past 100 (the counting template draws objects),
  // measurement, area and perimeter, statistics, decimals and percentages, angles beyond
  // sides-and-corners, algebra, ratio, and all of Year 6.
}

export function templateTopicFor(topic) {
  return TEMPLATE_FOR_TOPIC[topic?.id] ?? null
}

// Where a year sits on the 1–15 difficulty dial. The dial is kept because math_progress, the
// parent screens and the levelling rules are all built on it — but it now means "how hard",
// not "about what", so a child starts at their year's footing rather than at whichever rung
// happened to name an operation they could do.
const BASE_LEVEL_FOR_YEAR = { year1: 2, year2: 4, year3: 6, year4: 8, year5: 10, year6: 12 }

export function startingLevelForAge(age) {
  return BASE_LEVEL_FOR_YEAR[ageToSchoolYear(age)] ?? 6
}

export function yearLabelForAge(age) {
  return BRITISH_CURRICULUM[ageToSchoolYear(age)]?.label ?? ''
}

// Picks the topics for one session. Every topic in the year gets used before any is used
// twice, and topics carried over from recent sessions go last — so consecutive sessions
// differ even when the year has fewer topics than the session has questions.
export function planSession(age, count, recentTopicIds = []) {
  const topics = BRITISH_CURRICULUM[ageToSchoolYear(age)]?.topics ?? []
  if (!topics.length) return []

  const recent = new Set(recentTopicIds)
  const fresh = topics.filter(t => !recent.has(t.id))
  const seen = topics.filter(t => recent.has(t.id))
  const ordered = [...shuffle(fresh), ...shuffle(seen)]

  const plan = []
  while (plan.length < count) {
    // A year with eight topics and a ten-question session covers all eight, then comes back
    // round for two. Re-shuffling each lap keeps which two from being the same every time.
    const lap = plan.length === 0 ? ordered : shuffle(topics)
    for (const t of lap) {
      if (plan.length >= count) break
      plan.push(t)
    }
  }
  return plan
}

function shuffle(list) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
