import { generateProblem } from './mathTemplates.js'

// The kind of a question, read off its operand key: the parts that are not numbers. "time" holds
// reading a clock, 24-hour time and how long a lesson lasted ('time:h24', 'tbetween', ...), and passing one
// proves nothing about another, so a review asks the same KIND again with new numbers.
// Shapes are the one place where the key's second part is a detail, not the kind: "poly:square:right" and
// "poly:rhombus:right" ask the same thing (how many right angles), so only the last part counts.
export function questionKind(key) {
  const text = String(key ?? '')
  const parts = text.split(':').filter(x => !/\d/.test(x))
  // The operation lives inside the numeric parts ('5/9×1/6' multiplies, '2 7/8÷4 4/5' divides) and
  // dropping those parts dropped the operation with them: a missed fraction product came back as a
  // fraction quotient. The operators that appear are part of the kind. Only the four operation signs:
  // a plain hyphen is a minus sign on a number, not an operation, and would split one kind into two.
  const ops = [...new Set(text.match(/[+−×÷]/g) || [])].sort().join('')
  const base = parts[0] === 'poly' ? `poly:${parts.at(-1)}` : parts.slice(0, 3).join(':')
  return ops ? `${base}|${ops}` : base
}

// The operation signs the child sees in a question: × and ÷ wherever they stand, and + and − only as an
// operation between two things ("5 + 3"), not as the sign of a number ("b = −5"). The key cannot always
// say it ("(−6) − (−16)" and "(−2)²" share a key kind), so the sentence is held to it as well.
export function operationSigns(text) {
  const t = String(text ?? '')
  const spaced = (t.match(/(?<=\S) ([+−]) (?=\S)/g) || []).map(x => x.trim())
  return [...new Set([...(t.match(/[×÷]/g) || []), ...spaced])].sort().join('')
}

// A fresh question of the same kind as `src` (a generated problem), or null if that kind cannot be
// drawn at this level (same key kind AND the same operation signs on screen). It never falls back to a DIFFERENT kind: it first looks for new numbers, and
// failing that accepts the same numbers again (a cube net has no numbers to change), which is still the
// same skill. The wording is deliberately not avoided: a kind whose sentence never changes ("How many
// minutes are there between these two times?") can only vary in its picture.
//
// `topic` is the TEMPLATE topic the session drew it from (templateTopicFor of the curriculum entry), not
// `src.topic`: a template may label its problems with another topic ('counting' draws number lines
// labelled 'place-value'), and drawing from the label gives questions of a different topic altogether.
export function sameKindProblem(src, { topic = src.topic, usedOperands = null, language = 'en', maxChars = 0, tries = 2500 } = {}) {
  const want = questionKind(src.operandKey)
  const wantSigns = operationSigns(src.question_text)
  const draw = (avoid) => {
    for (let i = 0; i < tries; i++) {
      const c = generateProblem(topic, src.level, avoid, language, { maxChars })
      if (questionKind(c.operandKey) === want && operationSigns(c.question_text) === wantSigns) return c
    }
    return null
  }
  return draw(usedOperands) || draw(null)
}
