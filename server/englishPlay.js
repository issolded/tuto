// How one English question is played, as pure functions: the endpoints in index.js keep the state
// and the rows. The rule is maths' "one try, then help":
//   - a right answer settles the question; a hint or an earlier wrong try makes it count half,
//   - the FIRST wrong answer with no hint looked at gives the question back (nothing is revealed),
//   - a wrong answer after a hint, a second wrong answer, or "I don't know" settles it as wrong:
//     the right words and the explanation are shown.

export const MAX_HINT = 3

export function newPlayState() {
  return { tries: 0, hints: 0, level: 0, eliminated: [], settled: null }
}

// `chosen` is a sorted list of option indices; `correct` the item's. Mutates `state`.
export function judgeAnswer(state, { correct, chosen, skip }) {
  if (state.settled) return { status: 'settled' }
  const right = !skip && chosen.length === correct.length && correct.every(i => chosen.includes(i))
  if (right) {
    state.settled = 'right'
    return { status: 'right', helped: state.tries > 0 || state.hints > 0 }
  }
  if (!skip) state.tries += 1
  if (!skip && state.tries === 1 && state.hints === 0) return { status: 'retry' }
  state.settled = 'wrong'
  return { status: 'wrong' }
}

// The rung to show next, and the bookkeeping that a hint was looked at (which is all that costs).
export function nextHintLevel(state) {
  state.level = Math.min(MAX_HINT, state.level + 1)
  state.hints = Math.max(state.hints, 1)
  return state.level
}

// What the sitting paid for one question as a share of a whole one.
export const questionShare = (a) => (a?.correct === true ? ((a.wrong_tries > 0 || a.hints_used > 0) ? 0.5 : 1) : 0)

// The review's questions: the ones that went wrong or were skipped, then the ones found only with
// help. mathReview.js's reviewCandidates works on this shape, so an English attempt is mapped to it.
export function asReviewAttempt(a, skillName) {
  const helped = a.wrong_tries > 0 || a.hints_used > 0
  return {
    source: 'template', topic_id: a.type, topic_name: skillName, idx: a.question_index,
    correct: a.correct === true, wrong_tries: a.wrong_tries || 0,
    help_shown: a.hints_used > 0, help_used: helped,
  }
}
