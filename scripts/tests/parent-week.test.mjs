// The parent's weekly report, held to the shapes its eight reads actually return.
//
// The report shipped broken because one of those reads (completedStoriesBetween) hands back
// a supabase result object instead of rows, and `.map` on it threw for every parent. No
// amount of staring found it; nothing short of a live database ran it. These tests run it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWeekReport, rowsOf, WEEK_TYPES } from '../../server/week.js'

// Monday 2026-09-21 .. Sunday 2026-09-27, with the week before it.
const WEEK = ['2026-09-21','2026-09-22','2026-09-23','2026-09-24','2026-09-25','2026-09-26','2026-09-27']
const PREV = ['2026-09-14','2026-09-15','2026-09-16','2026-09-17','2026-09-18','2026-09-19','2026-09-20']
// The endpoint's dayOf converts a stored UTC stamp to the child's local date; here the
// fixtures are already local dates, so it only needs to cut the time off.
const dayOf = (iso) => String(iso).slice(0, 10)
const build = (o) => buildWeekReport({ dayOf, weekDays: WEEK, prevDays: PREV, ...o })

test('rowsOf reads a supabase result, a bare array, and nothing at all', () => {
  assert.deepEqual(rowsOf({ data: [{ a: 1 }], error: null }), [{ a: 1 }])
  assert.deepEqual(rowsOf([{ a: 1 }]), [{ a: 1 }])
  for (const empty of [null, undefined, { data: null, error: new Error('x') }, 'nope', 7])
    assert.deepEqual(rowsOf(empty), [], `rowsOf(${JSON.stringify(empty)})`)
})

test('a supabase result where rows are expected no longer throws', () => {
  // This is the bug, written down: stories arrives as { data, error }, not as rows.
  const r = build({ stories: { data: [{ completed_at: '2026-09-23T10:00:00Z' }], error: null } })
  assert.equal(r.byType.writing, 1)
  assert.equal(r.days[2].sessions, 1)
})

test('an empty week is seven zero days, not an empty list', () => {
  const r = build({})
  assert.equal(r.days.length, 7)
  assert.deepEqual(r.days.map(d => d.date), WEEK)
  assert.deepEqual(r.totals, { gems: 0, sessions: 0, capped: 0 })
  for (const k of WEEK_TYPES) assert.equal(r.byType[k], 0)
  assert.deepEqual(Object.keys(r.days[0].byType).sort(), [...WEEK_TYPES].sort())
})

test('each table lands on its own activity type', () => {
  const at = (d) => [{ created_at: `2026-09-2${d}T09:00:00Z` }]
  const r = build({
    subs: [{ task_type: 'reading', created_at: '2026-09-21T09:00:00Z' },
           { task_type: 'homework', created_at: '2026-09-21T10:00:00Z' }],
    maths: at(2), paintings: at(3), puzzles: at(4), englishes: at(5),
    stories: [{ created_at: '2026-09-20T08:00:00Z', completed_at: '2026-09-26T08:00:00Z' }],
  })
  assert.deepEqual(r.byType, { reading: 1, homework: 1, math: 1, drawing: 1, puzzle: 1, english: 1, writing: 1 })
  assert.equal(r.totals.sessions, 7)
  // The story counts on the day it was finished, not the day its draft began — and the
  // draft day is in last week, so getting this wrong moves it out of the report entirely.
  assert.equal(r.days[5].byType.writing, 1)
  assert.equal(r.previous.sessions, 0)
})

test('an unknown task_type is dropped instead of inventing a column', () => {
  const r = build({ subs: [{ task_type: 'telepathy', created_at: '2026-09-22T09:00:00Z' }] })
  assert.equal(r.totals.sessions, 0)
  assert.deepEqual(Object.keys(r.days[1].byType).sort(), [...WEEK_TYPES].sort())
})

test('capped rows count as days worked, never as gems', () => {
  const r = build({
    ledger: { data: [
      { amount: 30, capped: false, created_at: '2026-09-21T09:00:00Z' },
      { amount: 0, capped: true, created_at: '2026-09-21T19:00:00Z' },
      // A parent approving homework for nothing: a real zero, not the limit.
      { amount: 0, capped: false, created_at: '2026-09-22T09:00:00Z' },
      // Pre-migration rows have no `capped` column at all; undefined is not the limit.
      { amount: 12, created_at: '2026-09-23T09:00:00Z' },
    ] },
  })
  assert.equal(r.totals.gems, 42)
  assert.equal(r.totals.capped, 1)
  assert.equal(r.days[0].gems, 30)
  assert.equal(r.days[0].capped, 1)
  assert.equal(r.days[1].capped, 0)
})

test('last week is summed from the same rows and kept out of this week', () => {
  const r = build({
    ledger: [{ amount: 50, created_at: '2026-09-16T09:00:00Z' }, { amount: 20, created_at: '2026-09-24T09:00:00Z' }],
    maths: [{ created_at: '2026-09-16T09:00:00Z' }, { created_at: '2026-09-24T09:00:00Z' }],
  })
  assert.deepEqual(r.totals, { gems: 20, sessions: 1, capped: 0 })
  assert.deepEqual(r.previous, { gems: 50, sessions: 1 })
})

test('activity outside both weeks is ignored rather than folded into a Monday', () => {
  const r = build({
    maths: [{ created_at: '2026-08-01T09:00:00Z' }, { created_at: '2026-12-25T09:00:00Z' }],
    ledger: [{ amount: 99, created_at: '2026-08-01T09:00:00Z' }],
  })
  assert.deepEqual(r.totals, { gems: 0, sessions: 0, capped: 0 })
  assert.deepEqual(r.previous, { gems: 0, sessions: 0 })
})

test('several sessions on one day add up on that day', () => {
  const r = build({ maths: Array.from({ length: 4 }, () => ({ created_at: '2026-09-25T09:00:00Z' })) })
  assert.equal(r.days[4].byType.math, 4)
  assert.equal(r.days[4].sessions, 4)
  assert.equal(r.byType.math, 4)
})
