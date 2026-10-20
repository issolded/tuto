import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { deviceScreenContext, readScreenUsage, usageTotals, visibleUsage } from '../../server/screenUsageReport.js'
import { installDeviceScreenTime } from '../../server/deviceScreenTime.js'

const NOW = new Date('2026-10-20T20:30:00Z') // Oct 21 in the policy's Dubai timezone
const row = (pkg, seconds, extra = {}) => ({
  child_id: 'child', device_id: 'tablet', day: '2026-10-21', package: pkg, label: pkg, seconds, ...extra,
})
function fixture() {
  return {
    parents: [{ id: 'parent', timezone: 'America/Los_Angeles', prefs: {} }],
    children: [{ id: 'child', parent_id: 'parent', name: 'Test child', age: 8 },
      { id: 'sibling', parent_id: 'parent', name: 'Sibling', age: 7 },
      { id: 'foreign', parent_id: 'other', name: 'Foreign child' }],
    screen_policies: [{ child_id: 'child', policy: { timezone: 'Asia/Dubai', report: { hidden: ['com.hidden.app'] } } }],
    screen_devices: [{ child_id: 'child', name: 'Tablet', last_seen: '2026-10-20T19:00:00Z',
      token_hash: 'must-not-leak', pair_hash: 'must-not-leak', status: { usage_access: true } }],
    screen_usage: [
      row('com.roblox.client', 1800), row('com.google.android.youtube', 1200),
      row('com.roblox.client', 600, { device_id: 'second' }),
      row('android', 900), row('com.hidden.app', 600),
      row('app.tuto.mobile', 300), row('app.tuto.mobile.preview', 60),
      row('com.roblox.client', 240, { day: '2026-10-20' }),
      row('com.roblox.client', 9000, { child_id: 'foreign' }),
      row('com.roblox.client', 120, { child_id: 'sibling' }),
    ],
  }
}
function fake(tables = fixture(), failTable) {
  const reads = []
  return { reads, from(name) {
    reads.push(name)
    let filters = [], columns = '*', single = false, offset = 0, end = Infinity
    const q = {
      select(c = '*') { columns = c; return q },
      eq(k, v) { filters.push(r => r[k] === v); return q },
      gte(k, v) { filters.push(r => r[k] >= v); return q },
      lte(k, v) { filters.push(r => r[k] <= v); return q },
      is(k, v) { filters.push(r => (r[k] ?? null) === v); return q },
      not(k, _, v) { filters.push(r => (r[k] ?? null) !== v); return q },
      in(k, values) { filters.push(r => values.includes(r[k])); return q },
      order() { return q }, limit(n) { end = n - 1; return q },
      range(a, b) { offset = a; end = b; return q },
      single() { single = true; return q }, maybeSingle() { single = true; return q },
      then(resolve, reject) {
        if (name === failTable) return Promise.resolve({ data: null, error: { message: 'offline' } }).then(resolve, reject)
        const rows = (tables[name] || []).filter(r => filters.every(f => f(r))).slice(offset, end + 1)
          .map(r => columns === '*' ? { ...r } : Object.fromEntries(columns.split(',').map(k => [k, r[k]])))
        return Promise.resolve({ data: single ? rows[0] || null : rows, error: null }).then(resolve, reject)
      },
      // Fail closed if code under test ever tries to write.
      insert() { throw Error('write forbidden') }, update() { throw Error('write forbidden') },
      upsert() { throw Error('write forbidden') }, delete() { throw Error('write forbidden') },
    }
    return q
  } }
}

test('real parent report route and chat agree on measured visible usage; learning stays separate', async () => {
  const db = fake(), routes = {}
  installDeviceScreenTime(Object.fromEntries(['get', 'put', 'post'].map(m => [m, (p, fn) => { routes[m + p] = fn }])), db, async () => 'parent')
  let report
  await routes['get/api/parent/children/:childId/device-screen/usage']({
    params: { childId: 'child' }, query: { from: '2026-10-21', to: '2026-10-21' },
  }, { json(body) { report = body }, status() { throw Error('route failed') } })
  const context = await deviceScreenContext(db, 'parent', 'child', NOW)
  assert.equal(context.today.totalSeconds, 3600)
  assert.deepEqual(context.today.apps.map(a => a.seconds), [2400, 1200])
  assert.equal(context.today.totalSeconds, usageTotals(visibleUsage(report.rows, fixture().screen_policies[0].policy)).total)
  assert.equal(context.today.learningSeconds, 360)
  assert.equal(context.today.from, '2026-10-21')
  assert.equal(context.yesterday.totalSeconds, 240)
  assert.equal(context.thisWeek.from, '2026-10-19')
  assert.equal(context.thisMonth.totalSeconds, 3840)
  assert.equal(context.devices[0].lastSyncedAt, '2026-10-20T19:00:00Z')
  assert.ok(!JSON.stringify(context).includes('must-not-leak'))
})

test('ownership, siblings and optional device selection cannot mix usage', async () => {
  const db = fake()
  assert.equal((await deviceScreenContext(db, 'other', 'child', NOW)).status, 'unavailable')
  assert.deepEqual(db.reads, ['children'])
  assert.equal((await deviceScreenContext(db, 'parent', 'sibling', NOW)).today.totalSeconds, 120)
  const rows = await readScreenUsage(db, 'child', { from: '2026-10-21', to: '2026-10-21', device: 'second' })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].seconds, 600)
})

test('no records, no device and failed reads stay distinct; pagination never drops the second page', async () => {
  const tables = fixture()
  tables.screen_usage = []
  assert.equal((await deviceScreenContext(fake(tables), 'parent', 'child', NOW)).status, 'no_records')
  tables.screen_devices = []
  assert.equal((await deviceScreenContext(fake(tables), 'parent', 'child', NOW)).status, 'not_paired')
  for (const name of ['children', 'screen_policies', 'screen_devices', 'screen_usage']) {
    const result = await deviceScreenContext(fake(fixture(), name), 'parent', 'child', NOW)
    assert.equal(result.status, 'unavailable')
    assert.equal(result.today, undefined)
  }
  tables.screen_usage = Array.from({ length: 1005 }, (_, i) => row('com.test.app' + i, 1))
  assert.equal((await deviceScreenContext(fake(tables), 'parent', 'child', NOW)).today.totalSeconds, 1005)
  await assert.rejects(readScreenUsage(fake(), 'child', { from: '2026-02-30', to: '2026-03-01' }), /invalid_range/)
})

test('calendar boundaries use policy timezone, including previous month and year', async () => {
  const result = await deviceScreenContext(fake(), 'parent', 'child', new Date('2026-12-31T20:30:00Z'))
  assert.equal(result.today.from, '2027-01-01')
  assert.equal(result.yesterday.from, '2026-12-31')
  assert.equal(result.thisWeek.from, '2026-12-28')
  assert.equal(result.thisMonth.from, '2027-01-01')
})

test('actual getParentContext supplies device usage to messaging and app scopes without starting the server', async () => {
  // Execute only the real context function; do not import index.js (pollers / live services).
  const src = readFileSync(new URL('../../server/index.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const start = src.indexOf('async function getParentContext(')
  const end = src.indexOf('\n}\n', start) + 2
  assert.ok(start >= 0 && end > start)
  const time = { setZone() { return this }, startOf() { return this }, endOf() { return this },
    toUTC() { return this }, toISO() { return NOW.toISOString() }, toISODate() { return '2026-10-21' } }
  const sandbox = {
    supabase: fake(), DateTime: { now: () => time }, parentLang: () => 'en',
    deviceScreenContext: (db, parent, child) => deviceScreenContext(db, parent, child, NOW),
    getTreeState: async () => null, topicStanding: async () => [], puzzleStanding: async () => [],
    englishStanding: async () => [], weekForChild: async () => ({}), weekContext: x => x,
    recentEnglishQuestions: async () => null, toLocalTimes: x => x, englishVarietyForZone: () => 'uk',
    activeSkips: () => [], yearTopicsFor: () => [], TASK_DEFAULT_GEMS: {}, VARIABLE_TASKS: new Set(),
    bonusSettings: () => ({ active: false }), BONUS_MIN_AGE: 6,
  }
  const getContext = vm.runInNewContext('(' + src.slice(start, end) + ')', sandbox)
  for (const opts of [{}, { withWeek: true }]) {
    const family = await getContext('parent', opts)
    assert.equal(family.length, 2)
    assert.equal(family[0].screenTime.today.totalSeconds, 3600)
    assert.equal(family[1].screenTime.today.totalSeconds, 120)
    assert.ok(!JSON.stringify(family).includes('web trial'))
  }
  sandbox.supabase = fake(fixture(), 'screen_usage')
  const family = await getContext('parent')
  assert.equal(family[0].name, 'Test child')
  assert.equal(family[0].screenTime.status, 'unavailable')
  assert.equal(family[0].screenTime.today, undefined)
})
