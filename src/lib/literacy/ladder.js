// English ladder engine: where a child stands on each track (docs/ENGLISH-SKILL-LADDERS.md) and what to ask
// next. Pure and deterministic: no model, no database, no clock (callers pass the session id). The state is
// plain JSON the server stores per child; every rule that decides a level is here, never in a prompt.
//
//   start({ age, stop, perTrack })       -> state      where each track begins (docs/ENGLISH-AGE-EXPECTATIONS.md)
//   nextProbe(state, { has, session })   -> { track, step } | null    what to ask next
//   record(state, attempt)               -> state      one answer
//   summary(state, { age })              -> per track: step, status, what may be said to a parent
//
// Two phases per track.
//   placing: a bracket search. `lo` is the highest step passed (two right answers net, or one right confirmed
//            by a right answer above it), `hi` the lowest step answered wrong twice (one miss can be a slip; one
//            right answer can be a guess: three options, one in three). The next probe is between them; placement ends when they meet
//            or after MAX_PLACING answers. A child who cannot answer the first step is placed at it, with
//            `floor` set: "below our first step" is reported as that, not as a level.
//   placed:   practice at the placed step and, now and then, one step up. RULES.promote independent right
//            answers in a row at the step above, over at least two sessions, move the child up; RULES.demote
//            misses among the last answers at the placed step move them down.
// Only independent answers count (first try, no hint, no help): helped answers are practice, never evidence.
// A track is "provisional" right after placement and "settled" once its step has held across sessions.

export const TRACKS = { A: 5, B: 6, Ca: 4, Cd: 6, D: 6, E: 5 }
export const TRACK_ORDER = ['A', 'B', 'Ca', 'Cd', 'D', 'E']

// Tunable in one place; the pilot sets the real numbers.
export const RULES = {
  MAX_PLACING: 6,             // answers per track before placement stops anyway
  WRONG_TO_CLOSE: 2,          // misses at a step before it counts as "too hard" while placing
  STRUGGLE: 2,                // misses in a row in a session -> the next question is an easy one
  PROMOTE: 3,                 // right in a row one step up, in >= 2 sessions -> move up
  DEMOTE: 3, DEMOTE_OF: 4,    // misses among the last DEMOTE_OF at the placed step -> move down
  SETTLE: 3, SETTLE_SESSIONS: 2,   // right answers at the placed step, in >= this many sessions -> settled
  STRETCH_EVERY: 4,           // once placed: every 4th question on a track tries the step above
}

// docs/ENGLISH-AGE-EXPECTATIONS.md — per age: [solid, introduced] step number per track (0 = not expected yet).
export const AGE_TABLE = {
  5: { A: [4, 4], B: [0, 0], Ca: [0, 0], Cd: [0, 0], D: [1, 1], E: [0, 0] },
  6: { A: [4, 5], B: [1, 2], Ca: [1, 2], Cd: [1, 2], D: [1, 3], E: [1, 1] },
  7: { A: [5, 5], B: [2, 3], Ca: [2, 3], Cd: [2, 4], D: [3, 4], E: [1, 3] },
  8: { A: [5, 5], B: [3, 4], Ca: [3, 4], Cd: [4, 4], D: [4, 5], E: [3, 4] },
  9: { A: [5, 5], B: [4, 5], Ca: [4, 4], Cd: [4, 5], D: [5, 5], E: [4, 4] },
  10: { A: [5, 5], B: [5, 5], Ca: [4, 4], Cd: [5, 6], D: [5, 6], E: [4, 5] },
  11: { A: [5, 5], B: [5, 6], Ca: [4, 4], Cd: [6, 6], D: [6, 6], E: [5, 5] },
}
export const ageRow = age => AGE_TABLE[Math.max(5, Math.min(11, Math.floor(age)))]

// Onboarding slider stops for a child learning English (Cambridge YLE levels); 'native' = the age table.
export const STOPS = {
  none: { A: 1, B: 1, Ca: 1, Cd: 1, D: 1, E: 1 },
  words: { A: 1, B: 1, Ca: 1, Cd: 1, D: 1, E: 1 },
  sentences: { A: 3, B: 2, Ca: 2, Cd: 1, D: 2, E: 1 },
  school: { A: 4, B: 3, Ca: 3, Cd: 3, D: 3, E: 2 },
}
const READING = new Set(['B', 'Ca', 'Cd', 'D', 'E'])

const clamp = (t, s) => Math.max(1, Math.min(TRACKS[t], s))
const id = (t, s) => `${t}${s}`

// Where each track begins. stop: one of STOPS, 'native', or null when the parent left it to Tuto ("you decide").
// perTrack: a detailed parent's own starting steps ({ B: 3 }); still only a start.
export function start({ age, stop = null, perTrack = {} }) {
  const row = ageRow(age)
  const tracks = {}
  for (const t of TRACK_ORDER) {
    let first
    if (perTrack[t]) first = perTrack[t]
    else if (stop === 'native') first = row[t][0] || 1
    else if (stop && STOPS[stop]) first = READING.has(t) ? Math.min(STOPS[stop][t], row[t][1] || 1) : STOPS[stop][t]
    // Nobody chose: the middle of a wide bracket (age-solid, capped low for the youngest), so one right answer
    // can try a hard one and one wrong answer can drop to the floor.
    else first = Math.max(1, Math.min(row[t][0] || 1, Math.ceil(TRACKS[t] / 2)))
    tracks[t] = { phase: 'placing', status: 'unknown', step: clamp(t, first), lo: 0, hi: TRACKS[t] + 1, misses: {}, history: [], floor: false }
  }
  return { version: 1, age, stop, tracks, probes: 0 }
}

// What to ask next. has(track, step) says whether the content bank can serve that step now; a step it cannot
// serve is skipped (and reported by `gaps`), so missing content never stalls the child.
export function nextProbe(state, { has = () => true, session } = {}) {
  const last = recentInSession(state, session)
  const struggling = last.length >= RULES.STRUGGLE && last.slice(-RULES.STRUGGLE).every(a => !a.correct)
  const order = [...TRACK_ORDER].sort((a, b) => weight(state.tracks[a]) - weight(state.tracks[b]) || TRACK_ORDER.indexOf(a) - TRACK_ORDER.indexOf(b))
  for (const t of order) {
    const tr = state.tracks[t]
    let want = target(tr, t)
    // After two misses in a row the next question is one the child should get: the highest step already
    // answered right on this track, or the first step. A run of failures is not a first impression to keep.
    if (struggling) want = Math.max(1, tr.lo || 1)
    for (const s of [want, ...[...Array(TRACKS[t]).keys()].map(i => i + 1).filter(x => x !== want).sort((x, y) => Math.abs(x - want) - Math.abs(y - want))]) {
      if (has(t, id(t, s))) return { track: t, step: id(t, s), easy: struggling }
    }
  }
  return null
}

// Tracks with fewer answers come first; placed tracks wait behind placing ones.
function weight(tr) { return (tr.phase === 'placing' ? 0 : 100) + tr.history.length }

function target(tr, t) {
  if (tr.phase === 'placing') return tr.step
  const n = tr.history.filter(h => h.independent).length
  return n % RULES.STRETCH_EVERY === RULES.STRETCH_EVERY - 1 && tr.step < TRACKS[t] ? tr.step + 1 : tr.step
}

function recentInSession(state, session) {
  if (session == null) return []
  return TRACK_ORDER.flatMap(t => state.tracks[t].history).filter(h => h.session === session).sort((a, b) => a.n - b.n)
}

// One answer. attempt: { track, step ('B3' or 3), item, format, correct, independent, session }.
// Returns a new state; the old one is not changed.
export function record(state, attempt) {
  const s = structuredClone(state)
  const t = attempt.track
  const tr = s.tracks[t]
  const step = typeof attempt.step === 'number' ? attempt.step : Number(String(attempt.step).replace(t, ''))
  s.probes += 1
  tr.history.push({ n: s.probes, step, item: attempt.item ?? null, format: attempt.format ?? null, correct: !!attempt.correct,
    independent: attempt.independent !== false, session: attempt.session ?? null })
  if (attempt.independent === false) return s            // practice, not evidence

  if (tr.phase === 'placing') {
    const tally = stepTally(tr)
    tr.lo = 0; tr.hi = TRACKS[t] + 1
    for (let k = 1; k <= TRACKS[t]; k++) if (passed(tally, k, TRACKS[t])) tr.lo = k
    for (let k = TRACKS[t]; k > tr.lo; k--) if (tooHard(tally, k)) tr.hi = k
    const placingAnswers = tr.history.filter(h => h.independent).length
    if (tr.hi - tr.lo <= 1 || placingAnswers >= RULES.MAX_PLACING) {
      tr.phase = 'placed'
      tr.status = 'provisional'
      // Stopped by the cap before the bracket closed: the highest step with more right than wrong answers
      // (the most likely level), not only the confirmed one; placed-phase rules correct it either way.
      let best = tr.lo
      if (tr.hi - tr.lo > 1) for (let k = tr.lo + 1; k < tr.hi; k++) if ((tally[k]?.right || 0) > (tally[k]?.wrong || 0)) best = k
      tr.floor = best === 0
      tr.step = clamp(t, best || 1)
    } else {
      // Right at an unconfirmed step -> go higher (a right answer up there confirms this one too);
      // wrong -> one step down; otherwise halfway between what is known.
      const k = tally[step] || { right: 0, wrong: 0 }
      if (attempt.correct) tr.step = clamp(t, Math.max(step + 1, Math.ceil((tr.lo + tr.hi) / 2)))
      else tr.step = clamp(t, step - 1)
      if (tr.step >= tr.hi) tr.step = tr.hi - 1            // never ask what is known to be too hard
      if (tr.step <= tr.lo) tr.step = tr.lo + 1            // nor what is known to be passed
      if (!attempt.correct && k.right && !k.wrong) tr.step = step
    }
    return s
  }

  // placed
  const indep = tr.history.filter(h => h.independent)
  if (step === tr.step + 1) {
    const above = indep.filter(h => h.step === tr.step + 1)
    const run = trailing(above, h => h.correct)
    if (run.length >= RULES.PROMOTE && new Set(run.map(h => h.session)).size >= 2) {
      tr.step += 1; tr.status = 'provisional'; tr.floor = false
    }
  } else if (step === tr.step) {
    const at = indep.filter(h => h.step === tr.step).slice(-RULES.DEMOTE_OF)
    if (at.length >= RULES.DEMOTE && at.filter(h => !h.correct).length >= RULES.DEMOTE && tr.step > 1) {
      tr.step -= 1; tr.status = 'provisional'
    } else {
      const right = indep.filter(h => h.step === tr.step && h.correct)
      if (right.length >= RULES.SETTLE && new Set(right.map(h => h.session)).size >= RULES.SETTLE_SESSIONS) tr.status = 'settled'
    }
  }
  return s
}

// Placing evidence per step. Three-option items are guessed right one time in three, so one right answer is
// not enough to call a step passed, as one wrong answer is not enough to call it too hard.
function stepTally(tr) {
  const out = {}
  for (const h of tr.history) if (h.independent) {
    const k = (out[h.step] ||= { right: 0, wrong: 0 })
    h.correct ? k.right++ : k.wrong++
  }
  return out
}
// Passed: two right answers more than wrong ones, or one right with a right answer on a higher step and no
// miss here. A right answer above confirms the steps below it (the ladder is ordered).
function passed(tally, k, top) {
  const here = tally[k] || { right: 0, wrong: 0 }
  if (here.right - here.wrong >= 2) return true
  if (here.right >= 1 && here.wrong === 0) for (let j = k + 1; j <= top; j++) if ((tally[j]?.right || 0) > (tally[j]?.wrong || 0)) return true
  for (let j = k + 1; j <= top; j++) if (passed2(tally, j)) return true
  return false
}
const passed2 = (tally, j) => (tally[j]?.right || 0) - (tally[j]?.wrong || 0) >= 2
function tooHard(tally, k) {
  const here = tally[k] || { right: 0, wrong: 0 }
  return here.wrong >= RULES.WRONG_TO_CLOSE && here.wrong > here.right
}

function trailing(list, ok) {
  const out = []
  for (let i = list.length - 1; i >= 0 && ok(list[i]); i--) out.unshift(list[i])
  return out
}

// Steps the bank could not serve: what the content work has to fill.
export function gaps(has) {
  return TRACK_ORDER.flatMap(t => [...Array(TRACKS[t]).keys()].map(i => id(t, i + 1))).filter(st => !has(st.match(/^[A-Z][a-z]?/)[0], st))
}

// What may be said about each track. A parent hears about a track only from `provisional` on; `settled`
// is said plainly, `provisional` as a first observation. `vsAge` compares with the age table's solid step
// and is only meaningful for a child whose English is native (the caller knows the slider stop).
export function summary(state, { age = state.age } = {}) {
  const row = ageRow(age)
  const out = {}
  for (const t of TRACK_ORDER) {
    const tr = state.tracks[t]
    const answers = tr.history.filter(h => h.independent).length
    const solid = row[t][0]
    out[t] = {
      step: tr.phase === 'placed' ? id(t, tr.step) : null,
      status: tr.status,
      floor: tr.floor,
      answers,
      sessions: new Set(tr.history.map(h => h.session)).size,
      canSay: tr.status !== 'unknown',
      vsAge: tr.phase !== 'placed' || !solid ? null : tr.step > row[t][1] ? 'above' : tr.step >= solid ? 'on' : 'below',
      // Share of the track climbed, 0-1: lets "reading is ahead of listening" be said for any child.
      height: tr.phase === 'placed' ? +(tr.step / TRACKS[t]).toFixed(2) : null,
    }
  }
  return out
}
