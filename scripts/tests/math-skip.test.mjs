// Topics a parent leaves out of the maths sessions: the rules (server/mathSkip.js) and the session
// plan that has to honour them (src/lib/mathCurriculum.js planSession).
import test from 'node:test'
import assert from 'node:assert/strict'
import { activeSkips, addSkip, removeSkip, skipIds, clampWeeks, yearTopicIds, describeSkips,
         remindersDue, markReminded, reminderText, canExtend, latestUntil, REMIND_BEFORE_MS,
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

test('extending never goes past 12 weeks from when the topic was first left out', () => {
  const first = addSkip([], 'y3_fractions', 8, NOW).list
  // six weeks in, "four more" would end at week 10 — fine, and `since` stays the first day
  const ext = addSkip(first, 'y3_fractions', 4, NOW + 6 * WEEK)
  assert.equal(Date.parse(ext.entry.until), NOW + 10 * WEEK)
  assert.equal(Date.parse(ext.entry.since), NOW)
  assert.equal(ext.entry.capped, undefined)
  // at week 9, "eight more" is cut to week 12
  const cut = addSkip(ext.list, 'y3_fractions', 8, NOW + 9 * WEEK)
  assert.equal(Date.parse(cut.entry.until), NOW + 12 * WEEK)
  assert.equal(cut.entry.capped, true)
  // and once it already ends at week 12, extending is refused, not silently accepted
  const refused = addSkip(cut.list, 'y3_fractions', 4, NOW + 11 * WEEK)
  assert.equal(refused.error, 'at_max')
  assert.equal(Date.parse(refused.latest), NOW + 12 * WEEK)
  // after it has come back, leaving it out again is a fresh start
  const fresh = addSkip(cut.list, 'y3_fractions', 4, NOW + 13 * WEEK)
  assert.equal(fresh.error, undefined)
  assert.equal(Date.parse(fresh.entry.since), NOW + 13 * WEEK)
})

test('entries written before `since` existed count from set_at', () => {
  const old = [{ topic_id: 'y3_time', set_at: new Date(NOW).toISOString(), until: new Date(NOW + 12 * WEEK).toISOString(), weeks: 12, source: 'parent' }]
  assert.equal(latestUntil(old[0]), NOW + 12 * WEEK)
  assert.equal(canExtend(old[0]), false)
  assert.equal(addSkip(old, 'y3_time', 4, NOW + 11 * WEEK).error, 'at_max')
})

test('the reminder is due in the last two days, once', () => {
  const { list } = addSkip([], 'y3_division', 4, NOW)
  const end = NOW + 4 * WEEK
  assert.deepEqual(remindersDue(list, end - REMIND_BEFORE_MS - 1), [])
  assert.deepEqual(remindersDue(list, end - REMIND_BEFORE_MS).map(e => e.topic_id), ['y3_division'])
  assert.deepEqual(remindersDue(list, end - 1).map(e => e.topic_id), ['y3_division'])
  assert.deepEqual(remindersDue(list, end), [], 'once it has ended there is nothing to ask')
  const marked = markReminded(list, ['y3_division'], end - REMIND_BEFORE_MS)
  assert.ok(marked[0].reminded_at)
  assert.deepEqual(remindersDue(marked, end - 1), [], 'asked once, never again for that end date')
})

test('extending after the reminder earns a new reminder for the new end date', () => {
  const end = NOW + 4 * WEEK
  const asked = markReminded(addSkip([], 'y3_division', 4, NOW).list, ['y3_division'], end - REMIND_BEFORE_MS)
  const ext = addSkip(asked, 'y3_division', 4, end - REMIND_BEFORE_MS + 3600e3)
  assert.equal(ext.entry.reminded_at, undefined)
  const newEnd = Date.parse(ext.entry.until)
  assert.equal(remindersDue(ext.list, newEnd - REMIND_BEFORE_MS).length, 1)
})

test('an entry set inside the reminder window is not asked about', () => {
  // Defensive: with a one-week minimum the tool cannot write one today, but a hand-edited row could.
  const end = NOW + WEEK
  const row = [{ topic_id: 'y3_time', set_at: new Date(end - 24 * 3600e3).toISOString(), since: new Date(NOW).toISOString(), until: new Date(end).toISOString(), weeks: 1 }]
  assert.deepEqual(remindersDue(row, end - 3600e3), [])
})

test('only the entries that are due are marked; the others are untouched', () => {
  let list = addSkip([], 'y3_division', 4, NOW).list
  list = addSkip(list, 'y3_time', 8, NOW).list
  const at = NOW + 4 * WEEK - REMIND_BEFORE_MS
  assert.deepEqual(remindersDue(list, at).map(e => e.topic_id), ['y3_division'])
  const marked = markReminded(list, ['y3_division'], at)
  assert.equal(marked.find(e => e.topic_id === 'y3_time').reminded_at, undefined)
})

test('the reminder says what happens with no answer, in each language, and offers more time only below the cap', () => {
  const base = { child: 'Ada', topic: 'Bölme', date: '3 Kasım', weeksAgo: 4, daysAgo: 28 }
  const tr = reminderText('tr', { ...base, extendable: true })
  assert.match(tr, /^4 hafta önce Ada için "Bölme"/)
  assert.match(tr, /bir süre daha/)
  assert.match(tr, /Cevap gelmezse 3 Kasım tarihinde planlandığı gibi geri gelir\.$/)
  const trCap = reminderText('tr', { ...base, extendable: false })
  assert.doesNotMatch(trCap, /bir süre daha/)
  assert.match(trCap, /en fazla 12 hafta/)
  const en = reminderText('en', { ...base, topic: 'Division', date: '3 November', extendable: true })
  assert.match(en, /^4 weeks ago we left "Division" out of Ada's maths sessions/)
  assert.match(en, /comes back on 3 November as planned\.$/)
  const es = reminderText('es', { ...base, topic: 'División', date: '3 de noviembre', weeksAgo: 1, extendable: false })
  assert.match(es, /^Hace 1 semana sacamos/)
  assert.match(es, /vuelve el 3 de noviembre como estaba previsto\.$/)
  assert.doesNotMatch(es, /un tiempo más/)
  assert.match(reminderText('en', { ...base, weeksAgo: 0, daysAgo: 5, extendable: true }), /^5 days ago/)
  for (const l of ['en', 'tr', 'es']) assert.doesNotMatch(reminderText(l, { ...base, extendable: true }), /undefined/)
})

test('canExtend: a week of room left is needed before more time is offered', () => {
  const at = NOW
  assert.equal(canExtend(addSkip([], 'y3_time', 4, at).entry), true)
  assert.equal(canExtend(addSkip([], 'y3_time', 11, at).entry), true)
  assert.equal(canExtend(addSkip([], 'y3_time', 12, at).entry), false)
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
