// Single source of truth for each gem-earning task's default reward — the
// starting point a parent can later change per child in TaskSettings. Both
// TaskSettings.jsx (the real settings) and ParentOnboarding.jsx (the "here's
// what each activity earns" hint text) read from this instead of each
// hardcoding their own copy of the numbers.
//
// `variable: true` means the actual amount is decided by a server-side score
// (reading/math/writing) rather than paid flat — callers use this to show
// "up to N" instead of a bare number.
export const TASK_DEFAULTS = {
  reading:  { gems: 30, variable: true, daily_cap: 3 },
  math:     { gems: 30, variable: true, daily_cap: 3 },
  writing:  { gems: 30, variable: true, daily_cap: 3 },
  // Homework had no cap: with approval off, or on autopilot, every photo paid. Counted by the day
  // the homework was sent, so approving a week's backlog at once is not capped as one day.
  homework: { gems: 25, variable: false, daily_cap: 3 },
  drawing:  { gems: 20, variable: false, daily_cap: 2 },
  // Shape & pattern puzzles (NVR). Scored and paid on the server, like maths.
  puzzle:   { gems: 30, variable: true, daily_cap: 3 },
}

// "Up to 30 gems · 3/day" / "25 gems" — the exact phrasing used anywhere this
// needs to be shown to a parent. The cap used to read "(up to 2/day)", which
// repeated "up to" twice in one badge and made the string long enough to force
// the onboarding grid wider than the screen.
export function gemHint(key) {
  const meta = TASK_DEFAULTS[key]
  if (!meta) return ''
  const base = meta.variable ? `Up to ${meta.gems} gems` : `${meta.gems} gems`
  return meta.daily_cap ? `${base} · ${meta.daily_cap}/day` : base
}
