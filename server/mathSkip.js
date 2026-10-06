// Topics a parent has asked Tuto to leave out of the maths sessions for a while ("they have not
// done fractions at school yet"). The mirror image of math_focus: a focus leans on one topic, a
// skip takes one out. Tuto assesses; the parent knows what the child has been taught, and this is
// where that knowledge comes in without touching the level or the accuracy figures.
//
// Rules live here, in code, so the model only has to understand what the parent meant:
//   · it always ends — 4 weeks unless the parent says otherwise, 12 at most — because a skip nobody
//     remembers is a topic silently never assessed;
//   · at most 3 topics at once, so a session still spans the year;
//   · one entry per topic: skipping it again extends it rather than adding a second.
import { TOPIC_IDS, localTopicName } from './topicNames.js'

export const SKIP_DEFAULT_WEEKS = 4
export const SKIP_MAX_WEEKS = 12
export const SKIP_MAX_TOPICS = 3
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

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
  const others = current.filter(e => e.topic_id !== topicId)
  if (others.length >= SKIP_MAX_TOPICS) return { error: 'too_many', max: SKIP_MAX_TOPICS, skipped: others.map(e => e.topic_id) }
  const w = clampWeeks(weeks)
  const entry = { topic_id: topicId, set_at: new Date(now).toISOString(), until: new Date(now + w * WEEK_MS).toISOString(), weeks: w, source: 'parent' }
  return { list: [...others, entry], entry }
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
  }))
}
