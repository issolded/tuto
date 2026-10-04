// The shape of a parent's week, with no database and no clock inside it.
//
// The endpoint in index.js does the two things only it can do — prove the caller owns the
// child, and fetch the rows — then hands them here. Everything a parent actually reads
// (what was earned each day, what was done each day, how the week compares with the one
// before) is computed in this file so that it can be tested without Supabase. The bug that
// reached production was not a query but a SHAPE — a supabase result object where rows were
// expected, so `.map` threw on every request — and nothing that needs a live database can
// catch that class.

export const WEEK_TYPES = ['reading', 'math', 'writing', 'homework', 'drawing', 'puzzle', 'english']

export const blankByType = () => Object.fromEntries(WEEK_TYPES.map(k => [k, 0]))

// A supabase result ({ data, error }) and a plain array of rows both read as rows here.
// Eight sources feed this report and they do not agree: most are awaited queries destructured
// at the call site, while completedStoriesBetween hands back the result object itself.
// Normalising at the door costs nothing and removes the whole class of mistake.
export const rowsOf = (v) => (Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : [])

// `dayOf` maps a stored timestamp to the child's local ISO date; `weekDays` and `prevDays`
// are seven local ISO dates each, Monday first. Keeping the calendar outside means this
// file never has to agree with Luxon about what a week is.
export function buildWeekReport({ dayOf, weekDays, prevDays, ledger, subs, maths, stories, paintings, puzzles, englishes }) {
  const done = [
    // Submissions carry their own task_type (reading / homework); every other table IS one type.
    ...rowsOf(subs).map(r => [r.task_type, dayOf(r.created_at)]),
    ...rowsOf(maths).map(r => ['math', dayOf(r.created_at)]),
    // A story counts on the day it was FINISHED, not the day the draft was started —
    // the same rule the child's own daily summary uses.
    ...rowsOf(stories).map(r => ['writing', dayOf(r.completed_at || r.created_at)]),
    ...rowsOf(paintings).map(r => ['drawing', dayOf(r.created_at)]),
    ...rowsOf(puzzles).map(r => ['puzzle', dayOf(r.created_at)]),
    ...rowsOf(englishes).map(r => ['english', dayOf(r.created_at)]),
  ]

  const byDay = new Map()
  for (const [type, day] of done) {
    if (!WEEK_TYPES.includes(type)) continue
    if (!byDay.has(day)) byDay.set(day, blankByType())
    byDay.get(day)[type]++
  }
  const countOn = (iso) => Object.values(byDay.get(iso) || {}).reduce((a, b) => a + b, 0)

  // A capped session paid nothing on purpose: bt_ledger writes amount 0 with capped true so
  // the day reads as "worked, past the limit" rather than as an empty day. It must not be
  // added into gems — and a genuine zero that is NOT capped (a parent approving homework at
  // 0 gems) must not be read as capped either, which is why the flag is checked, not the amount.
  const gemsByDay = new Map(), cappedByDay = new Map()
  for (const r of rowsOf(ledger)) {
    const d = dayOf(r.created_at)
    if (r.capped === true) cappedByDay.set(d, (cappedByDay.get(d) || 0) + 1)
    else gemsByDay.set(d, (gemsByDay.get(d) || 0) + (r.amount || 0))
  }

  // Oldest first, Monday to Sunday — the order a bar chart reads in.
  const days = weekDays.map(iso => ({
    date: iso,
    gems: gemsByDay.get(iso) || 0,
    capped: cappedByDay.get(iso) || 0,
    sessions: countOn(iso),
    byType: byDay.get(iso) || blankByType(),
  }))
  const previousDays = prevDays.map(iso => ({ gems: gemsByDay.get(iso) || 0, sessions: countOn(iso) }))

  const sum = (rows, k) => rows.reduce((a, r) => a + r[k], 0)
  const byType = blankByType()
  for (const d of days) for (const k of WEEK_TYPES) byType[k] += d.byType[k]

  return {
    days,
    byType,
    totals: { gems: sum(days, 'gems'), sessions: sum(days, 'sessions'), capped: sum(days, 'capped') },
    previous: { gems: sum(previousDays, 'gems'), sessions: sum(previousDays, 'sessions') },
  }
}
