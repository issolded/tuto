import test from 'node:test'
import assert from 'node:assert/strict'
import { newPlayState, judgeAnswer, nextHintLevel, questionShare, asReviewAttempt, MAX_HINT } from '../../server/englishPlay.js'

const q = { correct: [2], chosen: (c) => c }

test('right first time is a whole share', () => {
  const st = newPlayState()
  const v = judgeAnswer(st, { correct: [2], chosen: [2] })
  assert.deepEqual(v, { status: 'right', helped: false })
  assert.equal(questionShare({ correct: true, wrong_tries: st.tries, hints_used: st.hints }), 1)
})

test('first wrong gives the question back, then a right answer is half', () => {
  const st = newPlayState()
  assert.equal(judgeAnswer(st, { correct: [2], chosen: [1] }).status, 'retry')
  const v = judgeAnswer(st, { correct: [2], chosen: [2] })
  assert.deepEqual(v, { status: 'right', helped: true })
  assert.equal(questionShare({ correct: true, wrong_tries: st.tries, hints_used: st.hints }), 0.5)
})

test('a second wrong settles it as wrong and pays nothing', () => {
  const st = newPlayState()
  judgeAnswer(st, { correct: [2], chosen: [1] })
  assert.equal(judgeAnswer(st, { correct: [2], chosen: [0] }).status, 'wrong')
  assert.equal(questionShare({ correct: false, wrong_tries: 2, hints_used: 0 }), 0)
})

test('a wrong answer after a hint settles at once (hint, then no second chance)', () => {
  const st = newPlayState()
  nextHintLevel(st)
  assert.equal(judgeAnswer(st, { correct: [2], chosen: [1] }).status, 'wrong')
})

test('a hint then a right answer is half', () => {
  const st = newPlayState()
  nextHintLevel(st)
  assert.deepEqual(judgeAnswer(st, { correct: [2], chosen: [2] }), { status: 'right', helped: true })
})

test('skip settles as wrong without counting a try', () => {
  const st = newPlayState()
  assert.equal(judgeAnswer(st, { correct: [2], chosen: [], skip: true }).status, 'wrong')
  assert.equal(st.tries, 0)
})

test('a settled question stays settled', () => {
  const st = newPlayState()
  judgeAnswer(st, { correct: [2], chosen: [2] })
  assert.equal(judgeAnswer(st, { correct: [2], chosen: [1] }).status, 'settled')
})

test('two answers are one set: a half-right pair is wrong', () => {
  const st = newPlayState()
  assert.equal(judgeAnswer(st, { correct: [0, 3], chosen: [0, 1] }).status, 'retry')
  assert.equal(judgeAnswer(st, { correct: [0, 3], chosen: [0, 3] }).status, 'right')
})

test('hint rungs climb to three and stop', () => {
  const st = newPlayState()
  assert.deepEqual([1, 2, 3, 4].map(() => nextHintLevel(st)), [1, 2, 3, MAX_HINT])
})

test('an English attempt maps onto the review shape', () => {
  const a = asReviewAttempt({ type: 'plural', question_index: 4, correct: true, wrong_tries: 1, hints_used: 0 }, 'grammar')
  assert.deepEqual(a, { source: 'template', topic_id: 'plural', topic_name: 'grammar', idx: 4, correct: true, wrong_tries: 1, help_shown: false, help_used: true })
})
