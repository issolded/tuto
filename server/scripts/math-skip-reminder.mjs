// The reminder before a skipped maths topic comes back, against the harness (the REAL index.js over an
// in-memory Supabase). Start the harness first, then run this:
//
//   cd server && node scripts/english-harness.mjs --port 3999 &
//   HARNESS=http://localhost:3999 node scripts/math-skip-reminder.mjs
//
// What it checks: the sweep asks once, in the parent's language, also at notify_level "quiet"; it does
// not write at night, in quiet hours or during autopilot, and leaves the entry unmarked so a later sweep
// asks; the message lands in the transcript; extending through set_math_skip earns a new reminder, and
// at the 12-week cap the reminder offers no extension and the tool refuses one.
import { DateTime } from 'luxon'

const B = process.env.HARNESS || 'http://localhost:3999'
const post = async (p, b) => (await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) })).json()
const get = async (p) => (await fetch(B + p)).json()
const fails = []
const ok = (c, m) => { if (!c) fails.push(m) }

const { main } = await get('/__h/families')
const DAY = 864e5, WEEK = 7 * DAY
// Noon in the family's zone (the harness seeds Europe/London), whatever the clock says now.
const noon = DateTime.now().setZone('Europe/London').set({ hour: 12, minute: 0, second: 0, millisecond: 0 }).toMillis()
const iso = t => new Date(t).toISOString()

const child = async () => (await get('/__h/table/children')).find(c => c.id === main.child)
const setSkip = (list) => post('/__h/patch', { table: 'children', id: main.child, patch: { math_skip: list } })
const setPrefs = (prefs) => post('/__h/patch', { table: 'parents', id: main.parent, patch: { prefs } })
const sent = async () => (await get('/__h/notes')).filter(([n]) => n === 'telegram.sendTelegramMessage').map(([, a]) => a[1])
const transcript = async () => (await get('/__h/table/messages')).filter(m => m.parent_id === main.parent && m.role === 'tuto').map(m => m.content)

// Four weeks of division, set 26 days before `noon`, ending a little under two days after it.
const entry = { topic_id: 'y3_division', set_at: iso(noon - 26 * DAY), since: iso(noon - 26 * DAY), until: iso(noon + 2 * DAY - 3600e3), weeks: 4, source: 'parent' }
await setSkip([entry])

// ── a quiet parent is still asked, once, in Turkish
await setPrefs({ language: 'tr', notify_level: 'quiet' })
let before = (await sent()).length
await post('/__h/remind-skips', { now: noon })
let out = (await sent()).slice(before)
ok(out.length === 1, `quiet parent: one message, got ${out.length}`)
ok(/^4 hafta önce Ada için "Bilinen tablolarla bölme" konusunu matematik oturumlarından çıkarmıştık\./.test(out[0] || ''), `TR head: ${out[0]}`)
ok(/bir süre daha/.test(out[0] || '') && /Cevap gelmezse \d+ \S+ tarihinde planlandığı gibi geri gelir\.$/.test(out[0] || ''), `TR ask/tail: ${out[0]}`)
ok((await transcript()).includes(out[0]), 'the reminder is in the transcript as a Tuto turn')
ok(!!(await child()).math_skip[0].reminded_at, 'reminded_at written')
before = (await sent()).length
await post('/__h/remind-skips', { now: noon + 3600e3 })
ok((await sent()).length === before, 'second sweep asks again')

// ── night, quiet hours and autopilot hold it without marking it
const unmarked = async (label, prefs, now) => {
  await setSkip([entry]); await setPrefs(prefs)
  const n = (await sent()).length
  await post('/__h/remind-skips', { now })
  ok((await sent()).length === n, `${label}: sent anyway`)
  ok(!(await child()).math_skip[0].reminded_at, `${label}: marked although not sent`)
}
await unmarked('night', { language: 'en' }, noon + 11 * 3600e3)             // 23:00 London
const real = DateTime.now().setZone('Europe/London')
const hh = d => real.plus({ hours: d }).toFormat('HH:mm')
await unmarked('quiet hours', { language: 'en', quiet_hours: { start: hh(-1), end: hh(1) } }, noon)
await unmarked('autopilot', { language: 'en', autopilot: { started_at: iso(Date.now() - 3600e3), until: iso(Date.now() + 3600e3) } }, noon)
// …and the next sweep, once the hold is gone, asks
await setPrefs({ language: 'en' })
before = (await sent()).length
await post('/__h/remind-skips', { now: noon })
out = (await sent()).slice(before)
ok(out.length === 1 && /^4 weeks ago we left "Division using known tables" out of Ada's maths sessions/i.test(out[0]), `EN after hold: ${out[0]}`)
ok(/keep it out a while longer/.test(out[0] || '') && /as planned\.$/.test(out[0] || ''), `EN ask/tail: ${out[0]}`)

// ── not yet due: three days out
await setSkip([{ ...entry, until: iso(noon + 3 * DAY) }])
before = (await sent()).length
await post('/__h/remind-skips', { now: noon })
ok((await sent()).length === before, 'asked three days early')

// ── at the 12-week cap: no extension offered (Spanish)
await setPrefs({ language: 'es' })
await setSkip([{ ...entry, since: iso(noon - 12 * WEEK + DAY), set_at: iso(noon - 4 * WEEK), until: iso(noon + DAY) }])
before = (await sent()).length
await post('/__h/remind-skips', { now: noon })
out = (await sent()).slice(before)
ok(out.length === 1 && /12 semanas como máximo/.test(out[0]) && !/un tiempo más/.test(out[0]), `ES at cap: ${out[0]}`)
ok(/^Hace 12 semanas sacamos/.test(out[0] || ''), `ES counts from the first day: ${out[0]}`)

// ── the tool after a reminder (real clock): extend → new end, reminder cleared; then bring back
const now = Date.now()
await setPrefs({ language: 'tr' })
await setSkip([{ ...entry, set_at: iso(now - 26 * DAY), since: iso(now - 26 * DAY), until: iso(now + DAY), reminded_at: iso(now - 3600e3) }])
const ext = await post('/__h/skip-tool', { child: main.child, topic: 'y3_division', parent: main.parent, opts: { weeks: 4 } })
const after = (await child()).math_skip.find(e => e.topic_id === 'y3_division')
ok(ext.success && !after.reminded_at && after.since === iso(now - 26 * DAY), `extend: ${JSON.stringify(ext)} ${JSON.stringify(after)}`)
const back = await post('/__h/skip-tool', { child: main.child, topic: 'y3_division', parent: main.parent, opts: { resume: true } })
ok(back.success && back.brought_back && (await child()).math_skip.length === 0, `resume: ${JSON.stringify(back)}`)
// at the cap the tool refuses
await setSkip([{ ...entry, set_at: iso(now - 4 * WEEK), since: iso(now - 12 * WEEK + DAY), until: iso(now + DAY) }])
const capped = await post('/__h/skip-tool', { child: main.child, topic: 'y3_division', parent: main.parent, opts: { weeks: 4 } })
ok(!capped.success && capped.error === 'at_max' && capped.comes_back, `at cap: ${JSON.stringify(capped)}`)

console.log(fails.length ? `FAIL\n- ${fails.join('\n- ')}` : 'math-skip reminder: all checks passed')
process.exit(fails.length ? 1 : 0)
