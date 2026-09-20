import test from 'node:test'
import assert from 'node:assert/strict'
import { readRules, validRules, newDemo, status, demoAction, canRedeem } from '../screenControl.js'
const rules = () => readRules()
const demo = () => newDemo(new Date(2026, 8, 21, 16, 0).getTime())
test('validates integer budgets, caps and overnight schedule boundaries', () => {
  assert.equal(validRules(rules()), true)
  for (const patch of [{ cap: 10 }, { weekday: -1 }, { weekday: 2.5 }, { gemsPerMinute: 0 }, { bedStart: '24:00' }, { bedEnd: '20:30' }]) assert.equal(validRules({ ...rules(), ...patch }), false)
  assert.equal(status(rules(), { ...demo(), now: new Date(2026, 8, 21, 21).getTime() }).reason, 'bedtime')
  assert.equal(status(rules(), { ...demo(), now: new Date(2026, 8, 22, 6).getTime() }).reason, 'bedtime')
  assert.equal(status(rules(), { ...demo(), now: new Date(2026, 8, 22, 7).getTime() }).reason, 'ready')
  assert.equal(status(rules(), { ...demo(), now: new Date(2026, 8, 22, 8).getTime() }).reason, 'school')
})
test('budget counts timed use only and stops exactly at exhaustion', () => {
  let d = { ...demo(), used: 29 * 60 + 50, running: true }
  d = demoAction(rules(), d, { type: 'tick', seconds: 60 })
  assert.equal(d.used, 1800); assert.equal(d.running, false); assert.equal(status(rules(), d).reason, 'empty')
  const allowed = demoAction(rules(), { ...demo(), app: 'tuto', running: true, paused: true }, { type: 'tick', seconds: 60 })
  assert.equal(allowed.used, 0); assert.equal(status(rules(), allowed).reason, 'allowed')
})
test('request approval spends sample Gems once, rejection never spends', () => {
  const r = rules(); let d = demoAction(r, demo(), { type: 'request' })
  assert.equal(d.gems, 100); assert.ok(d.pending)
  assert.deepEqual(demoAction(r, d, { type: 'request' }), d)
  assert.equal(demoAction(r, d, { type: 'reject' }).gems, 100)
  d = demoAction(r, d, { type: 'approve' })
  assert.equal(d.gems, 90); assert.equal(d.earned, 5); assert.equal(d.pending, null)
  assert.deepEqual(demoAction(r, d, { type: 'approve' }), d)
})
test('limits cannot be bypassed by redemption, bonus or changed rules', () => {
  const r = { ...rules(), cap: 60 }
  assert.equal(canRedeem(r, { ...demo(), earned: 30 }), false)
  assert.equal(canRedeem(r, { ...demo(), gems: 1 }), false)
  assert.equal(canRedeem(r, { ...demo(), paused: true }), false)
  assert.equal(canRedeem(r, { ...demo(), used: 1800 }), true)
  assert.equal(demoAction(r, { ...demo(), bonus: 29 }, { type: 'bonus' }).bonus, 30)
  let d = demoAction(r, demo(), { type: 'request' })
  assert.deepEqual(demoAction({ ...r, earnedCap: 0 }, d, { type: 'approve' }), d)
})
test('school excludes weekends, bedtime interrupts playback, midnight resets daily usage', () => {
  const r = rules()
  assert.equal(status(r, { ...demo(), now: new Date(2026, 8, 20, 10).getTime() }).reason, 'ready')
  const bedtime = demoAction(r, { ...demo(), now: new Date(2026, 8, 21, 20, 29, 50).getTime(), running: true }, { type: 'tick', seconds: 60 })
  assert.equal(bedtime.used, 10); assert.equal(bedtime.running, false)
  const midnight = demoAction({ ...r, bedtime: false }, { ...demo(), now: new Date(2026, 8, 21, 23, 59, 59).getTime(), used: 1200, earned: 10, gems: 80 }, { type: 'tick', seconds: 1 })
  assert.equal(midnight.used, 0); assert.equal(midnight.earned, 0); assert.equal(midnight.gems, 80)
})
test('automatic approval grants budget but cannot spend during protected hours', () => {
  const r = { ...rules(), approval: false }
  const d = demoAction(r, demo(), { type: 'request' })
  assert.equal(d.earned, 5); assert.equal(d.gems, 90)
  const sleeping = { ...demo(), now: new Date(2026, 8, 21, 21).getTime() }
  assert.deepEqual(demoAction(r, sleeping, { type: 'request' }), sleeping)
})
