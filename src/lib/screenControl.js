// Web preview only. Never imports Supabase, writes bt_ledger, or controls another app.
export const SAMPLE_APPS = ['roblox', 'youtube', 'minecraft', 'tuto']
export const DEFAULT_SCREEN_RULES = {
  weekday: 30, weekend: 60, cap: 120, gemsPerMinute: 2, earnedCap: 30,
  approval: true, bedtime: true, bedStart: '20:30', bedEnd: '07:00',
  school: true, schoolStart: '08:00', schoolEnd: '15:00',
  apps: { roblox: 'timed', youtube: 'timed', minecraft: 'timed', tuto: 'allowed' },
  // Learn first, then play: games stay closed until today's learning count reaches learnNeed.
  learnFirst: false, learnNeed: 1,
  // Holiday: inside these dates (inclusive) school hours are off and the weekend budget applies.
  holiday: false, holidayFrom: '', holidayTo: '',
  // Today only, given by a parent: { date: 'YYYY-MM-DD', minutes }. Sits on top of the daily
  // maximum on purpose — the cap governs time the child earns with Gems; this is the parent
  // overriding their own rule for one day, which is what "bugün 15 dk ver" means.
  extra: null,
}
export const EXTRA_MAX = 120
const isDay = v => /^\d{4}-\d{2}-\d{2}$/.test(v)
export function validRules(r) {
  return r && ['weekday', 'weekend', 'cap', 'earnedCap'].every(k => Number.isInteger(r[k]) && r[k] >= 0 && r[k] <= 480)
    && r.cap >= Math.max(r.weekday, r.weekend) && r.earnedCap <= r.cap
    && Number.isInteger(r.gemsPerMinute) && r.gemsPerMinute >= 1 && r.gemsPerMinute <= 100
    && ['approval', 'bedtime', 'school'].every(k => typeof r[k] === 'boolean')
    && ['bedStart', 'bedEnd', 'schoolStart', 'schoolEnd'].every(k => /^([01]\d|2[0-3]):[0-5]\d$/.test(r[k]))
    && (!r.bedtime || r.bedStart !== r.bedEnd) && (!r.school || r.schoolStart !== r.schoolEnd)
    && SAMPLE_APPS.every(k => ['timed', 'allowed', 'blocked'].includes(r.apps?.[k]))
    && r.apps.tuto === 'allowed'
    && typeof r.learnFirst === 'boolean' && Number.isInteger(r.learnNeed) && r.learnNeed >= 1 && r.learnNeed <= 5
    && typeof r.holiday === 'boolean' && (!r.holiday || (isDay(r.holidayFrom) && isDay(r.holidayTo) && r.holidayFrom <= r.holidayTo))
    && (r.extra === null || (isDay(r.extra?.date) && Number.isInteger(r.extra.minutes) && r.extra.minutes >= 0 && r.extra.minutes <= EXTRA_MAX))
}
// Saved rules predate fields added later; they are read on top of the defaults, so a rule set
// saved before "learn first" existed is still that parent's rule set, not a reset to defaults.
export function readRules(value) {
  const merged = value && typeof value === 'object'
    ? { ...DEFAULT_SCREEN_RULES, ...value, apps: { ...DEFAULT_SCREEN_RULES.apps, ...(value.apps || {}) } }
    : null
  return validRules(merged) ? structuredClone(merged) : structuredClone(DEFAULT_SCREEN_RULES)
}
// The family's calendar day, local to whoever is looking (the device here; the server uses the
// parent's time zone when it writes `extra`).
export const localDay = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export function onHoliday(r, date) {
  const day = localDay(date)
  return r.holiday && day >= r.holidayFrom && day <= r.holidayTo
}
export function isWeekendRules(r, date) { return [0, 6].includes(date.getDay()) || onHoliday(r, date) }
export function dayBudget(r, date) { return isWeekendRules(r, date) ? r.weekend : r.weekday }
export function extraToday(r, date) { return r.extra?.date === localDay(date) ? r.extra.minutes : 0 }
const dayKey = date => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
const minute = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
function inWindow(m, start, end) {
  const a = minute(start), b = minute(end)
  return a < b ? m >= a && m < b : m >= a || m < b
}
export function newDemo(now = Date.now()) {
  return { now, used: 0, earned: 0, bonus: 0, gems: 100, pending: null, paused: false, app: 'roblox', running: false, history: [] }
}
export function status(r, d) {
  const date = new Date(d.now), weekend = isWeekendRules(r, date)
  const m = date.getHours() * 60 + date.getMinutes()
  const remaining = Math.max(0, Math.min(r.cap * 60, dayBudget(r, date) * 60 + d.earned * 60 + d.bonus * 60) + extraToday(r, date) * 60 - d.used)
  let reason = 'ready'
  if (r.apps[d.app] === 'blocked') reason = 'blocked'
  else if (r.apps[d.app] === 'allowed') reason = 'allowed'
  else if (d.paused) reason = 'paused'
  else if (r.bedtime && inWindow(m, r.bedStart, r.bedEnd)) reason = 'bedtime'
  else if (r.school && !weekend && inWindow(m, r.schoolStart, r.schoolEnd)) reason = 'school'
  // d.learned is today's finished learning count, set by whoever knows it; unknown never blocks.
  else if (r.learnFirst && Number.isInteger(d.learned) && d.learned < r.learnNeed) reason = 'learn_first'
  else if (!remaining) reason = 'empty'
  return { remaining, reason, playable: ['ready', 'allowed'].includes(reason) }
}
export function canRedeem(r, d, n = 5) {
  const base = dayBudget(r, new Date(d.now))
  return Number.isInteger(n) && n > 0 && !d.pending && d.gems >= n * r.gemsPerMinute
    && d.earned + n <= r.earnedCap && base + d.earned + d.bonus + n <= r.cap
    && ['ready', 'empty'].includes(status(r, d).reason)
}
function log(d, type, n = 0) {
  return { ...d, history: [{ type, n, at: d.now }, ...d.history].slice(0, 20) }
}
export function demoAction(r, state, action) {
  let d = { ...state }
  if (action.type === 'reset') return newDemo(d.now)
  if (action.type === 'clock') return newDemo(action.now)
  if (action.type === 'learned') return Number.isInteger(action.n) && action.n !== d.learned ? { ...d, learned: action.n } : d
  if (action.type === 'app') return { ...d, app: action.app, running: false }
  if (action.type === 'play') return { ...d, running: !d.running && status(r, d).playable }
  if (action.type === 'pause') return log({ ...d, paused: !d.paused, running: false }, d.paused ? 'resumed' : 'paused')
  if (action.type === 'bonus') {
    const base = dayBudget(r, new Date(d.now))
    const n = Math.max(0, Math.min(10, r.cap - base - d.earned - d.bonus))
    return n ? log({ ...d, bonus: d.bonus + n }, 'bonus', n) : d
  }
  if (action.type === 'redeem' && canRedeem(r, d)) return log({ ...d, gems: d.gems - 5 * r.gemsPerMinute, earned: d.earned + 5 }, 'redeemed', 5)
  if (action.type === 'request') {
    if (canRedeem(r, d)) {
      if (!r.approval) return log({ ...d, gems: d.gems - 5 * r.gemsPerMinute, earned: d.earned + 5 }, 'redeemed', 5)
      return log({ ...d, pending: { cost: 5 * r.gemsPerMinute } }, 'requested', 5)
    }
    return d
  }
  if (action.type === 'reject' && d.pending) return log({ ...d, pending: null }, 'rejected')
  if (action.type === 'approve' && d.pending) {
    const base = dayBudget(r, new Date(d.now))
    if (d.gems < d.pending.cost || d.earned + 5 > r.earnedCap || base + d.earned + d.bonus + 5 > r.cap || !['ready', 'empty'].includes(status(r, d).reason)) return d
    return log({ ...d, pending: null, gems: d.gems - d.pending.cost, earned: d.earned + 5 }, 'approved', 5)
  }
  if (action.type === 'tick') {
    const seconds = Math.max(0, Math.min(300, Math.floor(action.seconds)))
    for (let i = 0; i < seconds; i++) {
      const before = status(r, d), next = d.now + 1000
      if (d.running && before.reason === 'ready') d.used++
      if (dayKey(new Date(next)) !== dayKey(new Date(d.now))) d = { ...newDemo(next), gems: d.gems, app: d.app, paused: d.paused, history: d.history }
      d.now = next
      if (!status(r, d).playable) d.running = false
    }
    return d
  }
  return d
}
