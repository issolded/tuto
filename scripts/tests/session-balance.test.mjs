import test from 'node:test'
import assert from 'node:assert/strict'
import { planSession, strandOf } from '../../src/lib/mathCurriculum.js'

// The spare slots of a session go to the strand it has least of. Year 6 names five number or
// algebra topics out of seven, and random spares made seven of ten questions number in most
// sessions (two ratio and two algebra in one sitting was the report). Bond's 10-11 tests are a
// third shape, a third number, a fifth data.
test('an 11-year-old session is never more than half number', () => {
  for (let i = 0; i < 2000; i++) {
    const plan = planSession(11, 10, [], {})
    assert.equal(plan.length, 10)
    assert.ok(plan.filter(t => strandOf(t.id) === 'number').length <= 5)
    assert.equal(new Set(plan.map(t => t.id)).size, 7, 'every topic still appears')
  }
})

test('a parent focus still takes its slots', () => {
  for (let i = 0; i < 500; i++) {
    const plan = planSession(11, 10, [], { focusTopicId: 'y6_ratio' })
    assert.ok(plan.filter(t => t.id === 'y6_ratio').length >= 3)
  }
})
