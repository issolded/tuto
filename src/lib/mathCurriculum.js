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
// an age. The generator even took a `topicId` that would have used it, and nothing ever passed
// one — the taxonomy was written and never fed. That generator has since been deleted.
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

// The dial is not free to wander. Once level stopped choosing the subject it stopped having
// any bound, and levels stored under the old meaning came through unchanged: a seven-year-old
// sitting on 15 because the ladder had once carried her there got Year 2's topics — the right
// topics — at the top of the number range, which is where "31099 + 17807" came from, next to
// seven stars to count.
//
// A year owns exactly two rungs and the number ranges step between years, not within them —
// so the band is [base-1, base]. Allowing base+1 crossed the boundary: it put a Year 2 child,
// whose curriculum says "addition within 100", on "552 + 256".
//
// That leaves the dial with little to do inside a year, which is the honest position: the
// meaningful unit of difficulty here is the school year. Moving between years is a decision
// worth surfacing to a parent rather than one a run of good sessions makes silently.
export function clampLevelToAge(level, age) {
  const base = BASE_LEVEL_FOR_YEAR[ageToSchoolYear(age)] ?? 6
  const n = Number(level)
  if (!Number.isFinite(n)) return base
  return Math.min(Math.max(Math.round(n), base - 1), base)
}

export function yearLabelForAge(age) {
  return BRITISH_CURRICULUM[ageToSchoolYear(age)]?.label ?? ''
}

// Picks the topics for one session. Every topic in the year gets used before any is used
// twice, and topics carried over from recent sessions go last — so consecutive sessions
// differ even when the year has fewer topics than the session has questions.
// `weighting` is what makes a session respond to the child rather than just rotate. A topic a
// parent has asked for takes three of the ten slots; each topic the child is measurably weak on
// takes one extra. Both are capped together, because the whole reason a session spans the
// year's topics is breadth — drilling the weak one until it is fixed would rebuild the single
// -topic worksheet the ladder used to hand out.
const FOCUS_SLOTS = 3
const MAX_WEIGHTED_SLOTS = 5

export function planSession(age, count, recentTopicIds = [], weighting = {}) {
  const topics = BRITISH_CURRICULUM[ageToSchoolYear(age)]?.topics ?? []
  if (!topics.length) return []

  const byId = new Map(topics.map(t => [t.id, t]))
  const weighted = []
  const focus = weighting.focusTopicId ? byId.get(weighting.focusTopicId) : null
  if (focus) for (let i = 0; i < Math.min(FOCUS_SLOTS, count); i++) weighted.push(focus)
  for (const id of weighting.weakTopicIds || []) {
    if (weighted.length >= Math.min(MAX_WEIGHTED_SLOTS, count)) break
    const t = byId.get(id)
    // The focus already has its slots; giving it more for also being weak would crowd the rest.
    if (t && t !== focus) weighted.push(t)
  }
  const remaining = Math.max(0, count - weighted.length)

  const recent = new Set(recentTopicIds)
  const fresh = topics.filter(t => !recent.has(t.id))
  const seen = topics.filter(t => recent.has(t.id))
  const ordered = [...shuffle(fresh), ...shuffle(seen)]

  const plan = []
  while (plan.length < remaining) {
    // A year with eight topics and a ten-question session covers all eight, then comes back
    // round for two. Re-shuffling each lap keeps which two from being the same every time.
    const lap = plan.length === 0 ? ordered : shuffle(topics)
    for (const t of lap) {
      if (plan.length >= remaining) break
      plan.push(t)
    }
  }
  // Interleaved rather than front-loaded: three fraction questions in a row reads as a
  // punishment, the same three spread through the session read as a session.
  return shuffle([...weighted, ...plan])
}

function shuffle(list) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
