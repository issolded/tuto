// The ladder engine against simulated children: each has a true step per track and answers right below or at
// it (but slips sometimes) and wrong above it (but guesses sometimes, 1 in 3 for a three-option item).
// Fixed seeds; the numbers checked are the ones the engine promises (placement within one step, in few answers).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { start, nextProbe, record, summary, gaps, TRACKS, TRACK_ORDER, RULES } from '../../src/lib/literacy/ladder.js'

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) }

// Run one child: `perSession` answers per session until every track is placed (or a cap). Returns the state.
function run(state, truth, { seed = 1, slip = 0.1, guess = 1 / 3, perSession = 10, sessions = 4, has } = {}) {
  const r = rng(seed)
  for (let sess = 1; sess <= sessions; sess++) {
    for (let i = 0; i < perSession; i++) {
      const p = nextProbe(state, { session: sess, has })
      if (!p) return state
      const n = Number(p.step.replace(p.track, ''))
      const knows = n <= truth[p.track]
      const correct = knows ? r() > slip : r() < guess
      state = record(state, { track: p.track, step: p.step, item: `${p.step}-${sess}-${i}`, correct, session: sess })
    }
  }
  return state
}

const native8 = { A: 5, B: 3, Ca: 4, Cd: 4, D: 4, E: 3 }
const learner7 = { A: 3, B: 2, Ca: 1, Cd: 1, D: 2, E: 1 }

test('start: native child begins at the age-solid step', () => {
  const s = start({ age: 8, stop: 'native' })
  assert.deepEqual(Object.fromEntries(TRACK_ORDER.map(t => [t, s.tracks[t].step])), { A: 5, B: 3, Ca: 3, Cd: 4, D: 4, E: 3 })
})

test('start: a learner who "reads at school" is capped by age on reading tracks', () => {
  const s = start({ age: 6, stop: 'school' })
  // school stop: B3 Ca3 Cd3 D3 E2; a 6-year-old native has introduced only B2 Ca2 Cd2 D3 E1
  assert.deepEqual(Object.fromEntries(TRACK_ORDER.map(t => [t, s.tracks[t].step])), { A: 4, B: 2, Ca: 2, Cd: 2, D: 3, E: 1 })
})

test('start: a detailed parent sets single tracks; nobody chose -> middle of the bracket', () => {
  assert.equal(start({ age: 9, stop: 'sentences', perTrack: { B: 4 } }).tracks.B.step, 4)
  const s = start({ age: 9 })
  for (const t of TRACK_ORDER) assert.ok(s.tracks[t].step <= Math.ceil(TRACKS[t] / 2), `${t} starts at ${s.tracks[t].step}`)
})

// Measured 2026-10-18 (60 seeds): within one step after 4 sessions 75-96%, after 8 sessions 83-97%, after 12
// 92-99%. The weakest case is a learner at the floor: three options are guessed right one time in three.
test('placement lands within one step of the truth for most simulated children', () => {
  const cases = [
    [{ age: 8, stop: 'native' }, native8],
    [{ age: 8 }, native8],                       // nobody chose
    [{ age: 7, stop: 'sentences' }, learner7],
    [{ age: 7, stop: 'native' }, learner7],      // parent overestimates: should come down
    [{ age: 10, stop: 'none' }, { A: 5, B: 5, Ca: 4, Cd: 5, D: 5, E: 4 }],   // parent underestimates: should go up
  ]
  let within = 0, total = 0
  for (const [opts, truth] of cases) for (let seed = 1; seed <= 40; seed++) {
    const s = run(start(opts), truth, { seed, sessions: 8 })
    for (const t of TRACK_ORDER) {
      const tr = s.tracks[t]
      assert.equal(tr.phase, 'placed', `${JSON.stringify(opts)} seed ${seed}: ${t} not placed`)
      total++
      if (Math.abs(tr.step - truth[t]) <= 1) within++
    }
  }
  const share = within / total
  assert.ok(share >= 0.88, `within one step: ${(share * 100).toFixed(1)}%`)
})

test('placement is short: at most MAX_PLACING answers per track', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = run(start({ age: 9 }), { A: 5, B: 4, Ca: 4, Cd: 4, D: 5, E: 4 }, { seed })
    for (const t of TRACK_ORDER) assert.ok(s.tracks[t].history.length <= RULES.MAX_PLACING + 1)
  }
})

test('a child below the first step is placed at it with floor set', () => {
  let s = start({ age: 7, stop: 'none' })
  for (let i = 0; i < 4; i++) s = record(s, { track: 'Cd', step: 'Cd1', correct: false, session: 1 })
  assert.equal(s.tracks.Cd.phase, 'placed')
  assert.equal(s.tracks.Cd.floor, true)
  assert.equal(summary(s).Cd.step, 'Cd1')
})

test('one slip does not close a step; two misses do; one right answer is not a pass', () => {
  let s = start({ age: 8, stop: 'native' })
  s = record(s, { track: 'B', step: 'B3', correct: false, session: 1 })
  assert.equal(s.tracks.B.hi, TRACKS.B + 1, 'one miss leaves B3 open')
  assert.equal(s.tracks.B.step, 2)
  s = record(s, { track: 'B', step: 'B2', correct: true, session: 1 })
  assert.equal(s.tracks.B.lo, 0, 'one right answer at B2 is not yet a pass')
  s = record(s, { track: 'B', step: 'B3', correct: false, session: 1 })
  assert.equal(s.tracks.B.hi, 3, 'two misses close B3')
  s = record(s, { track: 'B', step: 'B2', correct: true, session: 1 })
  assert.equal(s.tracks.B.phase, 'placed')
  assert.equal(s.tracks.B.step, 2)
})

test('helped answers are recorded but never move a level', () => {
  let s = start({ age: 8, stop: 'native' })
  for (let i = 0; i < 6; i++) s = record(s, { track: 'E', step: 'E3', correct: true, independent: false, session: 1 })
  assert.equal(s.tracks.E.phase, 'placing')
  assert.equal(s.tracks.E.lo, 0)
  assert.equal(s.tracks.E.history.length, 6)
})

test('after two misses in a row the next question is an easy one', () => {
  let s = start({ age: 9, stop: 'native' })
  s = record(s, { track: 'A', step: 'A5', correct: true, session: 1 })
  s = record(s, { track: 'B', step: 'B4', correct: false, session: 1 })
  s = record(s, { track: 'Ca', step: 'Ca4', correct: false, session: 1 })
  const p = nextProbe(s, { session: 1 })
  assert.equal(p.easy, true)
  const n = Number(p.step.replace(p.track, ''))
  const tr = s.tracks[p.track]
  assert.equal(n, Math.max(1, tr.lo || 1))
})

test('promotion needs a run one step up over two sessions; demotion needs repeated misses', () => {
  let s = start({ age: 8, stop: 'native' })
  s.tracks.D = { ...s.tracks.D, phase: 'placed', status: 'provisional', step: 3, lo: 3, hi: 4 }
  for (const sess of [1, 1, 1]) s = record(s, { track: 'D', step: 'D4', correct: true, session: sess })
  assert.equal(s.tracks.D.step, 3, 'one session is not enough')
  s = record(s, { track: 'D', step: 'D4', correct: true, session: 2 })
  assert.equal(s.tracks.D.step, 4)
  for (let i = 0; i < 3; i++) s = record(s, { track: 'D', step: 'D4', correct: false, session: 3 })
  assert.equal(s.tracks.D.step, 3)
})

test('settled only after right answers at the step in two sessions', () => {
  let s = start({ age: 8, stop: 'native' })
  s.tracks.Ca = { ...s.tracks.Ca, phase: 'placed', status: 'provisional', step: 3, lo: 3, hi: 4 }
  for (let i = 0; i < 3; i++) s = record(s, { track: 'Ca', step: 'Ca3', correct: true, session: 1 })
  assert.equal(s.tracks.Ca.status, 'provisional')
  s = record(s, { track: 'Ca', step: 'Ca3', correct: true, session: 2 })
  assert.equal(s.tracks.Ca.status, 'settled')
})

test('a step the bank cannot serve is skipped, and gaps() lists it', () => {
  const has = (t, st) => !(t === 'A' && st === 'A2') && !(t === 'Ca')
  let s = start({ age: 7, stop: 'words' })
  const p = nextProbe(s, { has, session: 1 })
  assert.notEqual(p.track, 'Ca')
  const g = gaps(has)
  assert.ok(g.includes('A2') && g.includes('Ca1') && g.includes('Ca4') && !g.includes('A1'))
  s = run(s, learner7, { has, seed: 3 })
  assert.equal(s.tracks.Ca.phase, 'placing')        // never asked: stays unknown
  assert.equal(summary(s).Ca.canSay, false)
})

test('summary says nothing about an unknown track and compares placed tracks with age', () => {
  const s = run(start({ age: 8, stop: 'native' }), native8, { seed: 7 })
  const sum = summary(s)
  for (const t of TRACK_ORDER) {
    assert.equal(sum[t].canSay, true)
    assert.ok(['above', 'on', 'below'].includes(sum[t].vsAge))
  }
  assert.equal(summary(start({ age: 8 })).A.canSay, false)
})

test('record does not change the state it was given', () => {
  const s = start({ age: 8, stop: 'native' })
  const before = JSON.stringify(s)
  record(s, { track: 'A', step: 'A5', correct: true, session: 1 })
  assert.equal(JSON.stringify(s), before)
})
