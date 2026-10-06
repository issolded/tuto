import test from 'node:test'
import assert from 'node:assert/strict'
import { questionShareMean } from '../../server/mathGems.js'

const q = (correct, help_used = false) => ({ correct, help_used })

test('unaided right is a whole share, helped right a half, wrong or skipped nothing', () => {
  // The session played in the browser check: help-then-right, right, retry-then-right, skipped
  // after help, right, help-then-right, then four rights. 7.5 of 10.
  const attempts = [q(true, true), q(true), q(true, true), q(false, true), q(true), q(true, true), q(true), q(true), q(true), q(true)]
  assert.equal(questionShareMean(attempts, 10), 0.75)
})

test('a perfect unaided session pays in full and a session of misses pays nothing', () => {
  assert.equal(questionShareMean(Array.from({ length: 10 }, () => q(true)), 10), 1)
  assert.equal(questionShareMean(Array.from({ length: 10 }, () => q(false, true)), 10), 0)
})

test('help does not make a wrong answer worth anything, and right only ever counts once', () => {
  assert.equal(questionShareMean([q(false), q(false, true)], 2), 0)
  assert.equal(questionShareMean([q(true, true), q(true, true)], 2), 0.5)
})

test('a record that does not cover every question is not paid on', () => {
  assert.equal(questionShareMean([q(true)], 10), null)
  assert.equal(questionShareMean(undefined, 10), null)
  assert.equal(questionShareMean([q(true)], 0), null)
  assert.equal(questionShareMean([q(true)], '1.5'), null)
})

test('a correct flag that is not literally true does not count', () => {
  assert.equal(questionShareMean([{ correct: 'yes' }, { correct: 1 }], 2), 0)
})

import { sessionGems, PAPER_BONUS } from '../../server/mathGems.js'

test('paper pays a fifth more than the same session on screen, by the same rounding the card shows', () => {
  assert.equal(PAPER_BONUS, 1.2)
  assert.equal(sessionGems({ max: 30, share: 1, scale: 1 }), 30)
  assert.equal(sessionGems({ max: 30, share: 1, scale: 1, paper: true }), 36)
  assert.equal(sessionGems({ max: 45, share: 1, scale: 1, paper: true }), Math.round(45 * 1.2))
  // The same session, 8 of 10 right and nothing helped.
  assert.equal(sessionGems({ max: 30, share: 0.8, scale: 0.87 }), 24)
  assert.equal(sessionGems({ max: 30, share: 0.8, scale: 0.87, paper: true }), 29)
  // No per-question record: the session-level scale decides, with a third off for help.
  assert.equal(sessionGems({ max: 30, share: null, scale: 1, helpUsed: 2 }), Math.round(30 * 0.67))
  assert.equal(sessionGems({ max: 30, share: null, scale: 1, paper: true }), 36)
  // Nothing right pays nothing, on paper too.
  assert.equal(sessionGems({ max: 30, share: 0, scale: 0.33, paper: true }), 0)
})
