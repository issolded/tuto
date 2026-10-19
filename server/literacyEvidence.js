// English ladder evidence on the server: store raw answers, rebuild the state from them, keep the parent events,
// decide whether VR may be offered. The rules live in ./literacy (a byte copy of src/lib/literacy, npm run
// puzzle:sync); this file only reads and writes rows. Tables: server/migrations/2026-10-19_english_literacy_evidence.sql.
//
// Nothing here sends a message or touches a child screen. Until the migration is run every read comes back empty
// and every write reports `missing`, so callers keep working.

import { replay, summary, RULES_VERSION } from './literacy/ladder.js'
import { decideVrOffer } from './literacy/vrOffer.js'

// PostgREST says "relation does not exist" (42P01) or, through the schema cache, PGRST205.
export const tableMissing = (error) => !!error && (error.code === '42P01' || error.code === 'PGRST205'
  || /does not exist|schema cache/i.test(error.message || ''))

// One answer as the ladder records it -> one english_literacy_attempts row. `day` is the child's local date.
export function attemptRow(childId, a) {
  return {
    child_id: childId,
    session_id: a.session ?? null,
    day: a.day,
    track: a.track,
    step: typeof a.step === 'number' ? a.step : Number(String(a.step).replace(a.track, '')),
    skill: a.skill,
    grp: a.group,
    family: a.family,
    item: a.item ?? null,
    format: a.format ?? null,
    correct: !!a.correct,
    independent: a.independent !== false,
    hints_used: a.hintsUsed ?? 0,
    wrong_tries: a.wrongTries ?? 0,
    content_version: a.contentVersion ?? null,
    rule_version: a.ruleVersion ?? RULES_VERSION,
  }
}

// The row back into the attempt replay() reads.
export function attemptFromRow(r) {
  return {
    track: r.track, step: r.step, skill: r.skill, group: r.grp, family: r.family, item: r.item, format: r.format,
    correct: r.correct, independent: r.independent, session: r.session_id, day: r.day,
    contentVersion: r.content_version, ruleVersion: r.rule_version,
  }
}

export async function saveAttempt(db, childId, attempt) {
  const { error } = await db.from('english_literacy_attempts').insert(attemptRow(childId, attempt))
  if (tableMissing(error)) return { ok: false, missing: true }
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function loadAttempts(db, childId) {
  const { data, error } = await db.from('english_literacy_attempts').select('*')
    .eq('child_id', childId).order('created_at', { ascending: true })
  if (tableMissing(error)) return { rows: [], missing: true }
  if (error) throw new Error(error.message)
  return { rows: data || [] }
}

// The child's ladder state, rebuilt from every stored answer under today's rules. Never stored.
export async function literacyState(db, child, { skills = {} } = {}) {
  const { rows, missing } = await loadAttempts(db, child.id)
  const state = replay(rows.map(attemptFromRow), { age: child.age, stop: null, skills })
  return { state, summary: summary(state), answers: rows.length, missing: !!missing }
}

export async function loadEvents(db, childId) {
  const { data, error } = await db.from('english_parent_events').select('*')
    .eq('child_id', childId).order('created_at', { ascending: true })
  if (tableMissing(error)) return { events: [], missing: true }
  if (error) throw new Error(error.message)
  return { events: data || [] }
}

export async function appendEvents(db, childId, list) {
  if (!list.length) return { ok: true }
  const { error } = await db.from('english_parent_events').insert(list.map(e => ({
    child_id: childId, kind: e.kind, subject: e.subject ?? null, detail: e.detail ?? {}, rule_version: e.rule_version ?? null,
  })))
  if (tableMissing(error)) return { ok: false, missing: true }
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// What Tuto would do about VR for this child now. `write: false` (the default) is a dry run: the decision and the
// events it would write are returned, nothing is stored. With `write: true` the events are appended, which is what
// makes an offer happen at most once per level. No message is sent either way: the parent message comes later.
export async function vrDecision(db, child, { write = false, skills = {} } = {}) {
  const [{ state }, { events, missing }] = await Promise.all([literacyState(db, child, { skills }), loadEvents(db, child.id)])
  const decision = decideVrOffer({ state, vr: child.english_vr ?? null, events })
  if (write && !missing && decision.append.length) {
    const w = await appendEvents(db, child.id, decision.append)
    return { ...decision, written: w.ok }
  }
  return { ...decision, written: false, eventsMissing: !!missing }
}
