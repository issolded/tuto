// VR offer decision (src/lib/literacy/vrOffer.js) and the server's evidence store (server/literacyEvidence.js)
// over a small in-memory table fake. Rules: docs/ENGLISH-SKILL-LADDERS.md "Navigasyon ve sözel akıl yürütme".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { start, record } from '../../src/lib/literacy/ladder.js'
import { decideVrOffer, openFamilies, stepMet, trialEarned } from '../../src/lib/literacy/vrOffer.js'
import { VR_FAMILIES } from '../../src/lib/literacy/vrPrereqs.js'
import { saveAttempt, literacyState, vrDecision, appendEvents, loadEvents, attemptRow, attemptFromRow } from '../../server/literacyEvidence.js'

// A state with the given tracks placed: { B: [3, 'secure'] } = B placed at 3, secure.
function placed(map, age = 8) {
  const s = start({ age })
  for (const [t, [step, status]] of Object.entries(map)) s.tracks[t] = { ...s.tracks[t], phase: 'placed', step, status }
  return s
}
const nativeEight = placed({ B: [3, 'secure'], D: [2, 'secure'], Ca: [3, 'secure'] })

test('a step is met above it, or at it only when secure', () => {
  assert.equal(stepMet(placed({ B: [3, 'provisional'] }), 'B', 2), true)
  assert.equal(stepMet(placed({ B: [3, 'provisional'] }), 'B', 3), false)
  assert.equal(stepMet(placed({ B: [3, 'secure'] }), 'B', 3), true)
  assert.equal(stepMet(start({ age: 8 }), 'B', 1), false, 'placing is not met')
})

test('a family that needs a probe stays closed: no probe exists yet', () => {
  const open = openFamilies(placed({ A: [5, 'secure'], B: [6, 'secure'], Ca: [4, 'secure'], Cd: [6, 'secure'], D: [6, 'secure'], E: [5, 'secure'] }))
  for (const f of VR_FAMILIES.filter(f => f.probes.length)) assert.ok(!open[f.band].families.includes(f.type), f.type)
})

test('Osman: no English yet, nothing to offer', () => {
  const d = decideVrOffer({ state: placed({ B: [1, 'provisional'], D: [1, 'provisional'] }, 8) })
  assert.equal(d.action, 'none')
  assert.equal(d.reason, 'not-yet')
})

test('enough open families at 7-8 -> one offer, written once', () => {
  const d = decideVrOffer({ state: nativeEight })
  assert.equal(d.action, 'offer')
  assert.equal(d.level, '7-8')
  assert.ok(d.families.length >= 5)
  assert.deepEqual(d.append.map(e => e.kind), ['vr_offered'])
  const again = decideVrOffer({ state: nativeEight, events: d.append })
  assert.equal(again.action, 'none')
  assert.equal(again.reason, 'offered-at-level')
})

test('declined at 7-8: not asked again until 8-9 opens', () => {
  const events = [{ kind: 'vr_offered', subject: '7-8' }, { kind: 'vr_offer_declined', subject: '7-8' }]
  assert.equal(decideVrOffer({ state: nativeEight, events }).action, 'none')
  const ahead = placed({ B: [4, 'secure'], D: [4, 'secure'], Ca: [4, 'secure'] })
  const d = decideVrOffer({ state: ahead, events })
  assert.equal(d.action, 'offer')
  assert.equal(d.level, '8-9')
  assert.deepEqual(d.append.map(e => e.kind), ['vr_offered'], 'the 7-8 offer was answered, nothing to close')
})

test('an unanswered offer is put on record before the next level is offered', () => {
  const ahead = placed({ B: [4, 'secure'], D: [4, 'secure'], Ca: [4, 'secure'] })
  const d = decideVrOffer({ state: ahead, events: [{ kind: 'vr_offered', subject: '7-8' }] })
  assert.deepEqual(d.append.map(e => [e.kind, e.subject]), [['vr_offer_unanswered', '7-8'], ['vr_offered', '8-9']])
})

test('"don\'t ask again" stops every offer; VR already on needs no offer', () => {
  assert.equal(decideVrOffer({ state: nativeEight, events: [{ kind: 'vr_no_more_offers' }] }).reason, 'opted-out')
  assert.equal(decideVrOffer({ state: nativeEight, vr: { enabled: true, source: 'existing' } }).reason, 'enabled')
})

test('trial rule: two families, three new items each, all right unaided', () => {
  assert.equal(trialEarned({ 'word-ladder': [true, true, true], 'change-pattern': [true, true, true] }), true)
  assert.equal(trialEarned({ 'word-ladder': [true, true, true], 'change-pattern': [true, false, true] }), false)
  const d = decideVrOffer({ state: start({ age: 8 }), trial: { a: [true, true, true], b: [true, true, true] } })
  assert.equal(d.action, 'trial')
  assert.equal(decideVrOffer({ state: start({ age: 8 }), trial: { a: [true, true, true], b: [true, true, true] }, events: d.append }).action, 'none')
})

// ── server/literacyEvidence.js over a fake table store ──
function fakeDb({ missing = [] } = {}) {
  const tables = {}
  let t = 0
  const from = (name) => {
    const q = { filters: [], order: null }
    const api = {
      insert(rows) {
        if (missing.includes(name)) return Promise.resolve({ error: { code: '42P01', message: `relation "${name}" does not exist` } })
        for (const r of [].concat(rows)) (tables[name] ||= []).push({ id: `${name}-${++t}`, created_at: new Date(1e12 + t).toISOString(), ...r })
        return Promise.resolve({ error: null })
      },
      select() { return api },
      eq(c, v) { q.filters.push([c, v]); return api },
      order(c, { ascending }) { q.order = [c, ascending]; return api },
      then(res, rej) {
        if (missing.includes(name)) return Promise.resolve({ data: null, error: { code: 'PGRST205', message: 'not in the schema cache' } }).then(res, rej)
        let rows = (tables[name] || []).filter(r => q.filters.every(([c, v]) => r[c] === v))
        if (q.order) rows = [...rows].sort((a, b) => (a[q.order[0]] < b[q.order[0]] ? -1 : 1) * (q.order[1] ? 1 : -1))
        return Promise.resolve({ data: rows, error: null }).then(res, rej)
      },
    }
    return api
  }
  return { from, tables }
}
const child = { id: 'c1', age: 8, english_vr: null }

test('an answer survives the trip to a row and back unchanged', () => {
  const a = { track: 'E', step: 3, skill: 'detail', group: 'story-1', family: 'story', item: 'q1', format: 'passage',
    correct: true, independent: true, session: 's1', day: '2026-10-19', contentVersion: 'v', ruleVersion: 'ladder-2' }
  const back = attemptFromRow(attemptRow('c1', a))
  for (const k of Object.keys(a)) assert.deepEqual(back[k], a[k], k)
})

test('stored answers rebuild the same state record() built live', async () => {
  const db = fakeDb()
  let live = start({ age: 8, stop: null })
  for (let i = 0; i < 12; i++) {
    const a = { track: 'B', step: 'B2', skill: 'meaning', group: `w${i}`, family: i % 2 ? 'lit:meaning' : 'sentence', correct: i % 4 !== 0, session: `s${i < 6 ? 1 : 2}`, day: i < 6 ? '2026-10-18' : '2026-10-19' }
    live = record(live, a)
    assert.equal((await saveAttempt(db, 'c1', a)).ok, true)
  }
  const { state, answers } = await literacyState(db, child)
  assert.equal(answers, 12)
  assert.deepEqual(state.tracks.B, live.tracks.B)
})

test('before the migration: reads are empty, writes say missing, nothing throws', async () => {
  const db = fakeDb({ missing: ['english_literacy_attempts', 'english_parent_events'] })
  assert.deepEqual(await saveAttempt(db, 'c1', { track: 'B', step: 2, skill: 'x', group: 'g', family: 'f', correct: true, day: '2026-10-19' }), { ok: false, missing: true })
  const s = await literacyState(db, child)
  assert.equal(s.missing, true)
  assert.equal(s.answers, 0)
  const d = await vrDecision(db, child, { write: true })
  assert.equal(d.written, false)
})

test('vrDecision: dry run writes nothing; write: true records the offer once', async () => {
  const db = fakeDb()
  const steps = { B: 3, D: 2, Ca: 3 }
  // Secure at each step: two days, two families, enough units.
  for (const [t, step] of Object.entries(steps)) {
    for (let i = 0; i < 8; i++) {
      await saveAttempt(db, 'c1', { track: t, step, skill: `${t}${step}`, group: `${t}-${i}`, family: i % 2 ? 'a' : 'b', correct: true, session: `s${i < 4 ? 1 : 2}`, day: i < 4 ? '2026-10-18' : '2026-10-19' })
    }
  }
  const { state } = await literacyState(db, child)
  for (const t of Object.keys(steps)) assert.equal(state.tracks[t].phase, 'placed', `${t} placed`)
  const dry = await vrDecision(db, child)
  assert.equal(dry.written, false)
  assert.equal((await loadEvents(db, 'c1')).events.length, 0)
  if (dry.action !== 'offer') return assert.fail(`expected an offer, got ${dry.reason}; tracks ${JSON.stringify(Object.fromEntries(Object.entries(state.tracks).map(([k, v]) => [k, [v.phase, v.step, v.status]])))}`)
  const real = await vrDecision(db, child, { write: true })
  assert.equal(real.written, true)
  assert.equal((await vrDecision(db, child, { write: true })).action, 'none')
  assert.deepEqual((await loadEvents(db, 'c1')).events.map(e => e.kind), ['vr_offered'])
})

test('appendEvents keeps what it is given', async () => {
  const db = fakeDb()
  await appendEvents(db, 'c1', [{ kind: 'vr_no_more_offers', detail: { channel: 'telegram' } }])
  const { events } = await loadEvents(db, 'c1')
  assert.equal(events[0].kind, 'vr_no_more_offers')
  assert.deepEqual(events[0].detail, { channel: 'telegram' })
})
