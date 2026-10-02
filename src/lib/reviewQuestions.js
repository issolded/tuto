import { generateProblem } from './mathTemplates.js'

// The kind of a question, read off its operand key: the parts that are not numbers. "time" holds
// reading a clock, 24-hour time and how long a lesson lasted ('time:h24', 'tbetween', ...), and passing one
// proves nothing about another, so a review asks the same KIND again with new numbers.
// Shapes are the one place where the key's second part is a detail, not the kind: "poly:square:right" and
// "poly:rhombus:right" ask the same thing (how many right angles), so only the last part counts.
export function questionKind(key) {
  const parts = String(key ?? '').split(':').filter(x => !/\d/.test(x))
  return parts[0] === 'poly' ? `poly:${parts.at(-1)}` : parts.slice(0, 3).join(':')
}

// A fresh question of the same kind as `src` (a generated problem), or null if that kind cannot be
// drawn at this level. It never falls back to a DIFFERENT kind: it first looks for new numbers, and
// failing that accepts the same numbers again (a cube net has no numbers to change), which is still the
// same skill. The wording is deliberately not avoided: a kind whose sentence never changes ("How many
// minutes are there between these two times?") can only vary in its picture.
//
// `topic` is the TEMPLATE topic the session drew it from (templateTopicFor of the curriculum entry), not
// `src.topic`: a template may label its problems with another topic ('counting' draws number lines
// labelled 'place-value'), and drawing from the label gives questions of a different topic altogether.
export function sameKindProblem(src, { topic = src.topic, usedOperands = null, language = 'en', maxChars = 0, tries = 2500 } = {}) {
  const want = questionKind(src.operandKey)
  const draw = (avoid) => {
    for (let i = 0; i < tries; i++) {
      const c = generateProblem(topic, src.level, avoid, language, { maxChars })
      if (questionKind(c.operandKey) === want) return c
    }
    return null
  }
  return draw(usedOperands) || draw(null)
}
