// Single source of truth for each gem-earning task's defaults — the starting
// point a parent can later change per child, in onboarding (step 3), in
// TaskSettings, or by asking Tuto in chat. Both ParentOnboarding.jsx and
// TaskSettings.jsx read from this instead of each hardcoding their own copy of
// the numbers. The server keeps its own mirror (TASK_DEFAULT_GEMS /
// TASK_DEFAULT_CAPS in server/index.js) because the two halves deploy
// independently — change one, change the other.
//
// `variable: true` means the actual amount is decided by a server-side score
// (reading/math/writing) rather than paid flat — callers use this to show
// "up to N" instead of a bare number.
//
// `daily_cap` is how many sessions a day earn gems. EVERY task has one: the
// limit was always enforced server-side for maths, reading, writing and
// drawing, but only drawing had a dial for it, so the other three sat at a
// number no parent had chosen and none could see.
export const TASK_DEFAULTS = {
  reading:  { gems: 30, variable: true,  daily_cap: 3 },
  math:     { gems: 30, variable: true,  daily_cap: 3 },
  writing:  { gems: 30, variable: true,  daily_cap: 3 },
  homework: { gems: 25, variable: false, daily_cap: 3 },
  drawing:  { gems: 20, variable: false, daily_cap: 2 },
}

// How far the per-day dial travels. 0 is deliberately not reachable from the UI:
// a parent who wants a task to stop earning turns the task off, which also stops
// showing it to the child — a cap of 0 would leave the tile there paying nothing.
export const CAP_RANGE = { min: 1, max: 10 }

// "Up to 30 gems" / "25 gems" — the exact phrasing used anywhere this needs to be
// shown to a parent. The per-day figure used to be glued onto the end of this
// string ("Up to 30 gems · 3/day"); it is a control of its own now, next to the
// badge, so the badge says what one session is worth and nothing else.
export function gemHint(key) {
  const meta = TASK_DEFAULTS[key]
  if (!meta) return ''
  return meta.variable ? `Up to ${meta.gems} gems` : `${meta.gems} gems`
}

// The sentence under the per-day dial. Same promise every time — the child is
// never blocked, the work is always kept — worded for what they actually made.
export function capNote(key) {
  return {
    reading:  'Extra reading still counts, it just stops earning gems.',
    math:     'Extra sessions still count, they just stop earning gems.',
    writing:  'Extra stories are still saved, just without gems.',
    homework: 'Extra homework is still saved, just without gems.',
    drawing:  'Extra drawings are still saved, just without gems.',
  }[key] || 'Anything past this is still saved, just without gems.'
}
