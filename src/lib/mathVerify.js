// Checks the answers the model supplies with its questions, before a child sees them.
//
// Template questions carry an answer this code computed, so they are already trustworthy. The
// model's questions do not: it writes the question and the answer in one breath, and nothing
// downstream ever disagreed with it. A wrong answer there is worse than a missing question —
// the child solves it correctly, is told they are wrong, and the session records a failure
// against a topic they actually know.
//
// Two stages, cheapest first, and the decision is always this file's, never the model's:
//
//   1. Arithmetic that can be read out of the question is evaluated here and compared. No
//      call, no ambiguity — "31099 + 17807" has one answer.
//   2. Anything left (word problems, mostly) goes back to the model as a plain solve, with
//      the proposed answer withheld so it cannot simply agree with itself. Two independent
//      answers that match are kept; a mismatch is dropped.
//
// A question dropped here is replaced by a template one, so the child still gets ten.

import { callGeminiJSON } from './gemini'
import { partitionsMentally } from './mathTemplates'

// Trailing text after the numbers is common ("... = ?", "kaç eder?"), so the expression is
// matched rather than the whole string. Two operands only: three-term expressions bring
// precedence questions this is not trying to settle.
const EXPR = /(-?\d+(?:[.,]\d+)?)\s*([+\-−×x*÷/])\s*(-?\d+(?:[.,]\d+)?)/

const num = (s) => Number(String(s).replace(',', '.'))

function evaluate(a, op, b) {
  switch (op) {
    case '+': return a + b
    case '-': case '−': return a - b
    case '×': case 'x': case '*': return a * b
    case '÷': case '/': return b === 0 ? null : a / b
    default: return null
  }
}

// Whether a question can only be done with a pen. Most children answer on screen with nothing
// to write on, and a session of "8.412 - 3.202" and "9025 + 7383" came back with single digits
// lifted off the question — abandoned, not failed.
//
// Deliberately narrow: only a bare two-operand expression is judged, which is exactly the shape
// that goes wrong, and only the operand being applied is measured. Word problems are left to
// the prompt, because dropping one costs the child a topic the model is the only source of.
//
// Tables run to twelve, so a multiplier or divisor inside them is fine however it is written;
// past that it has to be round, since 1408 × 23 is column work and 1408 × 20 is not.
export function needsWrittenMethod(question) {
  const matches = [...String(question ?? '').matchAll(new RegExp(EXPR, 'g'))]
  if (matches.length !== 1) return false

  const [, , op, bRaw] = matches[0]
  const b = num(bRaw)
  if (!Number.isFinite(b)) return false
  if ('×x*÷/'.includes(op)) {
    // Two non-zero digits is a fair split to ADD and a long multiplication to multiply by, so
    // scaling gets the tighter bar: inside the tables, or round enough to be one table fact
    // and a shift. 1408 × 23 is column work; 1408 × 20 is 1408 × 2 with a zero on the end.
    const roundish = String(bRaw).replace(/[^1-9]/g, '').length <= 1
    return !(Number.isInteger(b) && Math.abs(b) <= 12) && !roundish
  }
  return !partitionsMentally(bRaw)
}

// 'agree' | 'disagree' | 'unknown'. Unknown is the honest answer for anything with more than
// one expression in it, or none — those go to stage two rather than being guessed at.
export function checkArithmetic(question, answer) {
  const text = String(question ?? '')
  const matches = [...text.matchAll(new RegExp(EXPR, 'g'))]
  if (matches.length !== 1) return 'unknown'

  const [, aRaw, op, bRaw] = matches[0]
  const value = evaluate(num(aRaw), op, num(bRaw))
  if (value === null || !Number.isFinite(value)) return 'unknown'

  const given = Number(answer)
  if (!Number.isFinite(given)) return 'disagree'
  return Math.abs(value - given) < 1e-9 ? 'agree' : 'disagree'
}

// One call for the whole batch. The proposed answers are deliberately absent from the prompt.
//
// It asks two things, because a question can be wrong in two ways. A wrong answer is caught by
// solving it again. A question with two defensible answers passes that test — both solvers pick
// the same reading — and still marks a child wrong for the other one. A real example: "Chloe
// has one coin worth 50 and one worth 10. She buys cherries for 45. How many coins does she get
// back in change?" — 15 if you read it as the value, 2 if you read it as the number of coins.
async function solveIndependently(questions, language) {
  const lang = language === 'tr' ? 'Turkish' : 'English'
  const prompt = `These are ${lang} maths questions for a child. For each one, do two things.

${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

FIRST, solve it. Work carefully — a wrong answer will be shown to the child as correct.

SECOND, judge whether a careful child could reasonably arrive at a DIFFERENT number by reading
the question another way. Be strict about this. It is ambiguous if a unit is also a countable
object ("how many coins" can mean the value or the number of coins), if it is unclear which
quantity is being asked for, or if the wording supports two readings. It is NOT ambiguous merely
because it is hard, or because a child might make a mistake.

Reply with ONLY this JSON, no other text:
{"answers": [<number>, ...], "ambiguous": [true, false, ...]}

One entry per question in each array, in order. Use a decimal point, never a comma or a
fraction. If a question is unanswerable or has no single numeric answer, put null for its
answer.`

  const data = await callGeminiJSON(prompt)
  return {
    answers: Array.isArray(data?.answers) ? data.answers : [],
    ambiguous: Array.isArray(data?.ambiguous) ? data.ambiguous : [],
  }
}

// Returns the indices that should be dropped.
//
// A verification call that fails does NOT drop anything. The evidence for dropping is a
// second answer that disagrees; a network error is not evidence, and a child staring at an
// empty session is a worse outcome than the risk this catches. A real disagreement drops.
export async function findBadAnswers(items, language = 'en') {
  const bad = []
  const needsModel = []

  items.forEach((item, i) => {
    const verdict = checkArithmetic(item.question, item.answer)
    if (verdict === 'disagree') bad.push(i)
    else if (verdict === 'unknown') needsModel.push(i)
  })

  if (!needsModel.length) return bad

  try {
    const second = await solveIndependently(needsModel.map(i => items[i].question), language)
    needsModel.forEach((itemIndex, k) => {
      // Two defensible readings means the child can be right and marked wrong, so the question
      // goes whatever the answers say.
      if (second.ambiguous[k] === true) { bad.push(itemIndex); return }

      const theirs = second.answers[k]
      if (theirs === null || theirs === undefined) return   // no opinion is not a disagreement
      const a = Number(theirs)
      const b = Number(items[itemIndex].answer)
      if (!Number.isFinite(a) || !Number.isFinite(b)) return
      if (Math.abs(a - b) >= 1e-9) bad.push(itemIndex)
    })
  } catch (err) {
    console.error('[VERIFY] second solve failed, keeping questions as generated:', err?.message ?? err)
  }

  return bad
}
