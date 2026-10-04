// Server side of screen time: what the chat tool writes and what the model is told.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyScreenExtra, screenTimeContext, SCREEN_EXTRA_MAX } from '../../server/screenTime.js'
import { readRules, extraToday } from '../../src/lib/screenControl.js'

const TODAY = '2026-10-04'
const prefs = () => ({ language: 'tr', notify_level: 'all', screen_control_web: {
  ada: { weekday: 45, weekend: 90, cap: 150, gemsPerMinute: 3, earnedCap: 30, approval: true, bedtime: true, bedStart: '20:30', bedEnd: '07:00', school: true, schoolStart: '08:30', schoolEnd: '15:30', apps: { roblox: 'blocked', youtube: 'timed', minecraft: 'timed', tuto: 'allowed' } },
} })

test('extra time adds up within the day and touches nothing else', () => {
  const p = prefs()
  const one = applyScreenExtra(p, 'ada', TODAY, 15)
  assert.equal(one.ok, true); assert.equal(one.total, 15)
  const two = applyScreenExtra(one.next, 'ada', TODAY, 30)
  assert.equal(two.total, 45)
  assert.equal(two.next.language, 'tr'); assert.equal(two.next.notify_level, 'all')
  assert.equal(two.next.screen_control_web.ada.weekday, 45)
  assert.equal(two.next.screen_control_web.ada.apps.roblox, 'blocked')
  assert.deepEqual(p, prefs(), 'the prefs that were read are not mutated — they are the compare-and-swap key')
})

test("yesterday's extra does not count toward today's limit", () => {
  const p = prefs(); p.screen_control_web.ada.extra = { date: '2026-10-03', minutes: 120 }
  const r = applyScreenExtra(p, 'ada', TODAY, 30)
  assert.equal(r.ok, true); assert.equal(r.total, 30)
})

test('the daily extra limit is enforced in code and says how much is left', () => {
  const p = prefs(); p.screen_control_web.ada.extra = { date: TODAY, minutes: 100 }
  const r = applyScreenExtra(p, 'ada', TODAY, 30)
  assert.equal(r.ok, false); assert.equal(r.refusal.mostYouCanAdd, 20); assert.equal(r.refusal.limit, SCREEN_EXTRA_MAX)
  assert.equal(applyScreenExtra(p, 'ada', TODAY, 20).total, 120)
})

test('clear removes today and the client reads it back as no extra', () => {
  const p = prefs(); p.screen_control_web.ada.extra = { date: TODAY, minutes: 60 }
  const r = applyScreenExtra(p, 'ada', TODAY, 0, true)
  assert.equal(r.ok, true); assert.equal(r.next.screen_control_web.ada.extra, null)
})

test('a child with no rules yet gets only the extra, and the client still reads a full valid rule set', () => {
  const r = applyScreenExtra({ language: 'en' }, 'alp', TODAY, 15)
  assert.deepEqual(r.next.screen_control_web.alp, { extra: { date: TODAY, minutes: 15 } })
  const rules = readRules(r.next.screen_control_web.alp)
  assert.equal(rules.weekday, 30, 'defaults fill the rest')
  assert.equal(extraToday(rules, new Date(2026, 9, 4, 12)), 15, 'the tab shows what the chat gave')
  assert.equal(applyScreenExtra(null, 'alp', TODAY, 15).ok, true, 'a parent with no prefs at all')
})

test('the model is told the plan, the trial, and never a usage figure', () => {
  assert.match(screenTimeContext(undefined, TODAY), /not set up/)
  const p = prefs().screen_control_web.ada
  const text = screenTimeContext({ ...p, learnFirst: true, learnNeed: 2, holiday: true, holidayFrom: '2026-10-01', holidayTo: '2026-10-10', extra: { date: TODAY, minutes: 30 } }, TODAY)
  for (const bit of ['weekdays 45 min', 'weekends 90 min', 'school hours 08:30-15:30', 'bedtime 20:30-07:00', 'after 2 finished task', 'holiday mode 2026-10-01..2026-10-10', '+30 extra min given for today', 'Web trial'])
    assert.ok(text.includes(bit), bit)
  assert.match(screenTimeContext({ ...p, holiday: true, holidayFrom: '2026-09-01', holidayTo: '2026-09-07' }, TODAY), /\(over\)/)
  assert.doesNotMatch(screenTimeContext({ ...p, extra: { date: '2026-10-03', minutes: 30 } }, TODAY), /extra min given/)
})
