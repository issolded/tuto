// Topics a parent has asked Tuto to leave out of the maths sessions for a while ("they have not
// done fractions at school yet"). The mirror image of math_focus: a focus leans on one topic, a
// skip takes one out. Tuto assesses; the parent knows what the child has been taught, and this is
// where that knowledge comes in without touching the level or the accuracy figures.
//
// Rules live here, in code, so the model only has to understand what the parent meant:
//   · it always ends — 4 weeks unless the parent says otherwise, 12 at most — because a skip nobody
//     remembers is a topic silently never assessed;
//   · at most 3 topics at once, so a session still spans the year;
//   · one entry per topic: skipping it again extends it rather than adding a second — and an
//     extension never takes the topic past 12 weeks from when it was FIRST left out (`since`), so
//     "12 at most" holds across extensions and not only per request;
//   · it is never silently over: a couple of days before the end Tuto asks the parent once
//     (remindersDue / reminderText below; the sweep in index.js sends it and marks `reminded_at`).
import { TOPIC_IDS, localTopicName } from './topicNames.js'
import { say } from './lang.js'

export const SKIP_DEFAULT_WEEKS = 4
export const SKIP_MAX_WEEKS = 12
export const SKIP_MAX_TOPICS = 3
const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
// How long before the end the parent is asked. Two days so there is a daytime moment on each of them
// (the sweep only writes 09:00–20:00 in the parent's zone, and quiet hours or autopilot can hold it).
export const REMIND_BEFORE_MS = 2 * DAY_MS
// Extending by less than a week is not worth offering: the reminder does not suggest it.
const MIN_EXTENSION_MS = WEEK_MS

const validEntry = e => e && typeof e.topic_id === 'string' && TOPIC_IDS.includes(e.topic_id) && !Number.isNaN(Date.parse(e.until))

// The entries still in force at `now`. Expired and malformed ones are simply not returned.
export function activeSkips(list, now = Date.now()) {
  return (Array.isArray(list) ? list : []).filter(e => validEntry(e) && Date.parse(e.until) > now)
}

export const skipIds = (list, now = Date.now()) => activeSkips(list, now).map(e => e.topic_id)

export function clampWeeks(weeks) {
  const n = Math.round(Number(weeks))
  return Number.isFinite(n) && n >= 1 ? Math.min(n, SKIP_MAX_WEEKS) : SKIP_DEFAULT_WEEKS
}

// → { list } with the topic added (or extended), or { error } when the rule says no.
export function addSkip(list, topicId, weeks, now = Date.now()) {
  if (!TOPIC_IDS.includes(topicId)) return { error: 'unknown_topic' }
  const current = activeSkips(list, now)
  const existing = current.find(e => e.topic_id === topicId)
  const others = current.filter(e => e.topic_id !== topicId)
  if (others.length >= SKIP_MAX_TOPICS) return { error: 'too_many', max: SKIP_MAX_TOPICS, skipped: others.map(e => e.topic_id) }
  const w = clampWeeks(weeks)
  const since = existing ? sinceOf(existing) : now
  const cap = since + SKIP_MAX_WEEKS * WEEK_MS
  const until = Math.min(now + w * WEEK_MS, cap)
  if (existing && until <= Date.parse(existing.until)) {
    return { error: 'at_max', until: existing.until, latest: new Date(cap).toISOString() }
  }
  // A new entry, so `reminded_at` goes with the old one: the new end date gets its own reminder.
  const entry = { topic_id: topicId, set_at: new Date(now).toISOString(), since: new Date(since).toISOString(),
                  until: new Date(until).toISOString(), weeks: w, source: 'parent',
                  ...(until < now + w * WEEK_MS ? { capped: true } : {}) }
  return { list: [...others, entry], entry }
}

// When the topic was first left out. Entries written before `since` existed fall back to set_at.
export function sinceOf(e) {
  const t = Date.parse(e.since ?? e.set_at)
  return Number.isNaN(t) ? Date.parse(e.until) - (e.weeks || SKIP_DEFAULT_WEEKS) * WEEK_MS : t
}

// The latest an entry may still be pushed to, and whether pushing it is worth offering.
export const latestUntil = e => sinceOf(e) + SKIP_MAX_WEEKS * WEEK_MS
export const canExtend = e => latestUntil(e) - Date.parse(e.until) >= MIN_EXTENSION_MS

// The entries whose parent should be asked now: still in force, ending within REMIND_BEFORE_MS, not
// asked yet. An entry set (or extended) inside that window is not asked about at all — the parent
// has just chosen its end date and been told it.
export function remindersDue(list, now = Date.now()) {
  return activeSkips(list, now).filter(e => {
    const askAt = Date.parse(e.until) - REMIND_BEFORE_MS
    return !e.reminded_at && now >= askAt && Date.parse(e.set_at ?? e.since) <= askAt
  })
}

// The same list with `reminded_at` written on the given topics. Expired entries are dropped on the
// way, as every other write does.
export function markReminded(list, topicIds, now = Date.now()) {
  const ids = new Set(topicIds)
  return activeSkips(list, now).map(e => (ids.has(e.topic_id) ? { ...e, reminded_at: new Date(now).toISOString() } : e))
}

// The reminder, in the parent's language. Written here rather than by the model: it says what will
// happen on a date if nobody answers, and that has to be exactly what the code does. `date` is the
// end date already formatted for the parent; `topic` the topic's name in their language.
export function reminderText(lang, { child, topic, date, weeksAgo, daysAgo, extendable }) {
  const ago = weeksAgo >= 1
    ? say(lang, `${weeksAgo} week${weeksAgo === 1 ? '' : 's'} ago`, `${weeksAgo} hafta önce`, `Hace ${weeksAgo} semana${weeksAgo === 1 ? '' : 's'}`)
    : say(lang, `${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`, `${daysAgo} gün önce`, `Hace ${daysAgo} día${daysAgo === 1 ? '' : 's'}`)
  const head = say(lang,
    `${ago} we left "${topic}" out of ${child}'s maths sessions. It comes back on ${date}.`,
    `${ago} ${child} için "${topic}" konusunu matematik oturumlarından çıkarmıştık. ${date} tarihinde geri geliyor.`,
    `${ago} sacamos «${topic}» de las sesiones de matemáticas de ${child}. Vuelve el ${date}.`)
  const ask = extendable
    ? say(lang,
        'If school has covered it, shall I bring it back now — or keep it out a while longer?',
        'Okulda işlendiyse şimdi geri ekleyeyim mi, yoksa bir süre daha çıkarılmış mı kalsın?',
        'Si ya lo han visto en el colegio, ¿lo vuelvo a añadir ahora o lo dejamos fuera un tiempo más?')
    : say(lang,
        `It can't be kept out any longer (${SKIP_MAX_WEEKS} weeks is the most), but if school has covered it I can bring it back now.`,
        `Daha fazla uzatamıyorum (en fazla ${SKIP_MAX_WEEKS} hafta), ama okulda işlendiyse şimdi geri ekleyebilirim.`,
        `No puedo dejarlo fuera más tiempo (${SKIP_MAX_WEEKS} semanas como máximo), pero si ya lo han visto en el colegio puedo añadirlo ahora.`)
  const tail = say(lang,
    `If I don't hear from you, it comes back on ${date} as planned.`,
    `Cevap gelmezse ${date} tarihinde planlandığı gibi geri gelir.`,
    `Si no me dices nada, vuelve el ${date} como estaba previsto.`)
  return `${head} ${ask} ${tail}`
}

// topicId 'all' brings every topic back. → { list, removed }.
export function removeSkip(list, topicId, now = Date.now()) {
  const current = activeSkips(list, now)
  const kept = topicId === 'all' ? [] : current.filter(e => e.topic_id !== topicId)
  return { list: kept, removed: current.length - kept.length }
}

// The curriculum year's topic ids for a child whose level band tops out at `hi` (the dial's base
// for the year: 2, 4, … 14, and 15 for Year 8). Same mapping as mathLevelBand in index.js.
export function yearTopicIds(hi) {
  const year = hi >= 15 ? 8 : Math.round(hi / 2)
  return TOPIC_IDS.filter(id => id.startsWith(`y${year}_`))
}

// What the model and the panel are shown: id, the name in the parent's language, and when it ends.
export function describeSkips(list, lang, now = Date.now()) {
  return activeSkips(list, now).map(e => ({
    topic_id: e.topic_id, name: localTopicName(e.topic_id, e.topic_id, lang), until: e.until.slice(0, 10),
    since: new Date(sinceOf(e)).toISOString().slice(0, 10),
    latest_until: new Date(latestUntil(e)).toISOString().slice(0, 10),
    ...(e.reminded_at ? { parent_reminded: e.reminded_at.slice(0, 10) } : {}),
  }))
}
