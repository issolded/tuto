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
  reading:  { gems: 30, variable: true },
  math:     { gems: 30, variable: true },
  writing:  { gems: 30, variable: true },
  homework: { gems: 25, variable: false },
  drawing:  { gems: 20, variable: false, daily_cap: 2 },
}

// "Up to 30 gems" / "10 gems" / "20 gems (up to 2/day)" — the exact phrasing
// used anywhere this needs to be shown to a parent.
export function gemHint(key) {
  const meta = TASK_DEFAULTS[key]
  if (!meta) return ''
  const base = meta.variable ? `Up to ${meta.gems} gems` : `${meta.gems} gems`
  return meta.daily_cap ? `${base} (up to ${meta.daily_cap}/day)` : base
}
