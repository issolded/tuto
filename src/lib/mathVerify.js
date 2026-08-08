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
async function solveIndependently(questions, language) {
  const lang = language === 'tr' ? 'Turkish' : 'English'
  const prompt = `Solve each of these ${lang} maths questions. Work carefully — these are for a
child and a wrong answer will be shown to them as correct.

${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Reply with ONLY this JSON, no other text:
{"answers": [<number>, ...]}

One number per question, in order. Use a decimal point, never a comma or a fraction. If a
question is ambiguous, unanswerable, or has no single numeric answer, put null for it.`

  const data = await callGeminiJSON(prompt)
  return Array.isArray(data?.answers) ? data.answers : []
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
      const theirs = second[k]
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
