// Topics a parent leaves out of the maths sessions: the rules (server/mathSkip.js) and the session
// plan that has to honour them (src/lib/mathCurriculum.js planSession).
import test from 'node:test'
import assert from 'node:assert/strict'
import { activeSkips, addSkip, removeSkip, skipIds, clampWeeks, yearTopicIds, describeSkips,
         SKIP_DEFAULT_WEEKS, SKIP_MAX_WEEKS, SKIP_MAX_TOPICS } from '../../server/mathSkip.js'
import { planSession } from '../../src/lib/mathCurriculum.js'
import { BRITISH_CURRICULUM } from '../../src/lib/gemini.js'

const NOW = Date.parse('2026-10-06T12:00:00Z')
const WEEK = 7 * 24 * 60 * 60 * 1000

test('a skip lasts 4 weeks by default and never more than 12', () => {
  assert.equal(clampWeeks(undefined), SKIP_DEFAULT_WEEKS)
  assert.equal(clampWeeks('banana'), SKIP_DEFAULT_WEEKS)
  assert.equal(clampWeeks(0), SKIP_DEFAULT_WEEKS)
  assert.equal(clampWeeks(2), 2)
  assert.equal(clampWeeks(40), SKIP_MAX_WEEKS)
  const { entry } = addSkip([], 'y3_fractions', undefined, NOW)
  assert.equal(Date.parse(entry.until) - NOW, 4 * WEEK)
})

test('a skip ends by itself', () => {
  const { list } = addSkip([], 'y3_fractions', 1, NOW)
  assert.deepEqual(skipIds(list, NOW + 6 * 24 * 3600 * 1000), ['y3_fractions'])
  assert.deepEqual(skipIds(list, NOW + 8 * 24 * 3600 * 1000), [])
})

test('skipping the same topic again extends it instead of adding a second entry', () => {
  const first = addSkip([], 'y3_fractions', 1, NOW).list
  const again = addSkip(first, 'y3_fractions', 6, NOW + WEEK)
  assert.equal(again.list.length, 1)
  assert.equal(Date.parse(again.list[0].until) - (NOW + WEEK), 6 * WEEK)
})

test('at most three topics at once, and extending one is never refused', () => {
  let list = []
  for (const id of ['y3_fractions', 'y3_time', 'y3_geometry']) list = addSkip(list, id, 4, NOW).list
  assert.equal(list.length, SKIP_MAX_TOPICS)
  const refused = addSkip(list, 'y3_division', 4, NOW)
  assert.equal(refused.error, 'too_many')
  assert.equal(addSkip(list, 'y3_time', 8, NOW).error, undefined)
  // an expired entry frees its place
  assert.equal(addSkip(list, 'y3_division', 4, NOW + 5 * WEEK).error, undefined)
})

test('unknown topics and malformed rows are ignored', () => {
  assert.equal(addSkip([], 'y3_nonsense', 4, NOW).error, 'unknown_topic')
  const junk = [null, {}, { topic_id: 'y3_time' }, { topic_id: 'nope', until: '2030-01-01' }, { topic_id: 'y3_time', until: 'not a date' }]
  assert.deepEqual(activeSkips(junk, NOW), [])
})

test('bringing topics back', () => {
  const list = addSkip(addSkip([], 'y3_fractions', 4, NOW).list, 'y3_time', 4, NOW).list
  assert.deepEqual(removeSkip(list, 'y3_time', NOW).list.map(e => e.topic_id), ['y3_fractions'])
  assert.equal(removeSkip(list, 'y3_time', NOW).removed, 1)
  assert.equal(removeSkip(list, 'all', NOW).list.length, 0)
  assert.equal(removeSkip(list, 'y3_geometry', NOW).removed, 0)
})

test('year topics follow the dial: 6 is Year 3, 15 is Year 8', () => {
  assert.ok(yearTopicIds(6).length >= 6 && yearTopicIds(6).every(id => id.startsWith('y3_')))
  assert.ok(yearTopicIds(15).every(id => id.startsWith('y8_')))
  assert.ok(yearTopicIds(14).every(id => id.startsWith('y7_')))
})

test('topics are described in the parent’s language, with the end date', () => {
  const { list } = addSkip([], 'y3_fractions', 4, NOW)
  assert.equal(describeSkips(list, 'tr', NOW)[0].name, 'Kesirler ve onda birler')
  assert.equal(describeSkips(list, 'en', NOW)[0].until, '2026-11-03')
})

// 8-year-old = Year 3 in the curriculum.
const AGE = 8
const ids = BRITISH_CURRICULUM.year3.topics.map(t => t.id)

test('a session never contains a skipped topic, whatever else asks for it', () => {
  const skip = ['y3_fractions', 'y3_time']
  for (let i = 0; i < 300; i++) {
    const plan = planSession(AGE, 10, [], { skipTopicIds: skip, focusTopicId: 'y3_fractions', weakTopicIds: ['y3_time', 'y3_division'] })
    assert.equal(plan.length, 10)
    assert.ok(plan.every(t => !skip.includes(t.id)))
    assert.ok(plan.some(t => t.id === 'y3_division'), 'the weak topic that is not skipped still gets its slot')
  }
})

test('without a skip every topic of the year can come up', () => {
  const seen = new Set()
  for (let i = 0; i < 300; i++) for (const t of planSession(AGE, 10, [], {})) seen.add(t.id)
  assert.deepEqual([...seen].sort(), [...ids].sort())
})

test('a skip list that would empty the year is ignored rather than breaking the session', () => {
  const plan = planSession(AGE, 10, [], { skipTopicIds: ids })
  assert.equal(plan.length, 10)
})
