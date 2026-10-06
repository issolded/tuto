// Screen time on the server, with no database and no clock in it (tested by
// scripts/tests/screen-time.test.mjs). The rules live in parents.prefs.screen_control_web,
// written by the parent's Screen time tab; the model reads them through screenTimeContext and
// changes exactly one thing, today's extra time, through applyScreenExtra.

export const SCREEN_EXTRA_MAX = 120

// Adds n minutes (or clears) today's extra for one child. Returns the whole next prefs object,
// so the caller can compare-and-swap it against the prefs it read. Never touches anything else
// in prefs, and never touches the child's other rules.
export function applyScreenExtra(prefs, childId, today, n, clear = false) {
  const base = prefs || {}
  const all = base.screen_control_web || {}
  const rules = all[childId] || {}
  const already = rules.extra?.date === today ? Number(rules.extra.minutes) || 0 : 0
  const total = clear ? 0 : already + n
  if (total > SCREEN_EXTRA_MAX) {
    return { ok: false, refusal: { error: 'over the daily extra limit', alreadyToday: already,
      mostYouCanAdd: Math.max(0, SCREEN_EXTRA_MAX - already), limit: SCREEN_EXTRA_MAX } }
  }
  const next = { ...base, screen_control_web: { ...all, [childId]: { ...rules, extra: total ? { date: today, minutes: total } : null } } }
  return { ok: true, next, total }
}

// The parent's screen-time rules for one child, as a sentence the model can repeat. Mirrors the
// defaults in src/lib/screenControl.js for fields a rule set saved earlier does not carry.
export function screenTimeContext(r, today) {
  if (!r) return 'not set up yet (web trial — rules only, nothing on the device is measured or blocked)'
  const v = (k, d) => (r[k] ?? d)
  const parts = [
    `weekdays ${v('weekday', 30)} min, weekends ${v('weekend', 60)} min, daily maximum ${v('cap', 120)} min including Gem time`,
    v('school', true) ? `school hours ${v('schoolStart', '08:00')}-${v('schoolEnd', '15:00')} on weekdays (games closed)` : 'no school hours',
    v('bedtime', true) ? `bedtime ${v('bedStart', '20:30')}-${v('bedEnd', '07:00')} every day (games closed)` : 'no bedtime',
    `extra time with Gems: ${v('gemsPerMinute', 2)} gems a minute, up to ${v('earnedCap', 30)} min a day${v('approval', true) ? ', parent approves each' : ''}`,
  ]
  if (r.learnFirst) parts.push(`learn first: games open after ${v('learnNeed', 1)} finished task(s) that day`)
  if (r.holiday && r.holidayFrom && r.holidayTo) parts.push(r.holidayTo < today
    ? `holiday mode was set for ${r.holidayFrom}..${r.holidayTo} (over)`
    : `holiday mode ${r.holidayFrom}..${r.holidayTo}: no school hours, weekend time every day`)
  if (r.extra?.date === today && r.extra.minutes > 0) parts.push(`+${r.extra.minutes} extra min given for today`)
  return `${parts.join('; ')}. Web trial: rules only — nothing on the device is measured or blocked yet, so there is no usage to report.`
}

