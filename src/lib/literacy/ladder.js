// English ladder engine: where a child stands on each track (docs/ENGLISH-SKILL-LADDERS.md) and what to ask
// next. Pure and deterministic: no model, no database, no clock (callers pass the session id and the day). The
// state is plain JSON derived from the child's raw answers; every rule that decides a level is here, never in a
// prompt.
//
//   start({ age, stop, perTrack, skills })  -> state      where each track begins (docs/ENGLISH-AGE-EXPECTATIONS.md)
//   nextProbe(state, { has, session })      -> { track, step } | null    what to ask next
//   record(state, attempt)                  -> state      one answer
//   replay(attempts, startOpts)             -> state      the same state rebuilt from the stored answers
//   summary(state, { age })                 -> per track and per skill: step, status, what may be said to a parent
//
// Two phases per track.
//   placing: a bracket search. `lo` is the highest step passed (two right units net, or one right confirmed
//            by a right unit above it), `hi` the lowest step with two wrong units (one miss can be a slip; one
//            right answer can be a guess: three options, one in three). The next probe is between them; placement
//            ends when they meet or after MAX_PLACING answers. A child who cannot answer the first step is placed
//            at it, with `floor` set: "below our first step" is reported as that, not as a level.
//   placed:   practice at the placed step and, now and then, one step up. PROMOTE right units in a row at the step
//            above, over at least two days, move the child up; DEMOTE wrong units among the last DEMOTE_OF at the
//            placed step move them down.
//
// Evidence (rev. 3, agreed with Astra 2026-10-18; docs/ENGLISH-SKILL-LADDERS.md "Navigasyon ve sözel akıl yürütme"):
//   - Only independent answers count (first try, no hint, no help): helped answers are practice, never evidence.
//   - A skill is tracked inside its track: knowing synonyms and not antonyms is two results, not an average.
//   - The unit of evidence is (step, skill, group), not the answer. A group is whatever makes answers depend on
//     each other: one reading text, one word family. Three questions on one text give a skill one unit; questions
//     on the same text about different skills still give each skill its own unit. A unit is right only if every
//     independent answer in it on its first day was right.
//   - The same group met again on a later day is a delayed repeat: stored and reported, never a new unit.
//   - `secure` means "enough independent evidence for now", not "learnt for good": it is recomputed from the
//     answers every time and can be lost. Thresholds are per track (and per skill if set), not one number for all.
//   - Every answer keeps the content version and the rule version it was judged under, so the state can be
//     rebuilt from stored answers when the rules change (replay). Parent-facing events (an offer sent, refused,
//     "don't ask again") are NOT derived here: they are permanent records kept by the server.
// A track is "provisional" right after placement and "secure" when every skill at its step is.

export const TRACKS = { A: 5, B: 6, Ca: 4, Cd: 6, D: 6, E: 5 }
export const TRACK_ORDER = ['A', 'B', 'Ca', 'Cd', 'D', 'E']

// Bump when a rule below changes what a stored answer means; stored answers keep the version they were judged by.
export const RULES_VERSION = 'ladder-4'   // ladder-3: placement capped one step above the age's introduced step; ladder-4: 8+ start at the solid step, a mastered top step (the highest with questions) is asked once a session, no track more than SESSION_SHARE items a sitting or two turns running

// Tunable in one place; the pilot sets the real numbers. None of these is a measured standard.
export const RULES = {
  MAX_PLACING: 6,             // answers per track before placement stops anyway
  WRONG_TO_CLOSE: 2,          // wrong units at a step before it counts as "too hard" while placing
  STRUGGLE: 2,                // misses in a row in a session -> the next question is an easy one
  PROMOTE: 3,                 // right units in a row one step up, on >= 2 days -> move up
  DEMOTE: 3, DEMOTE_OF: 4,    // wrong units among the last DEMOTE_OF at the placed step -> move down
  STRETCH_EVERY: 4,           // once placed: every 4th question on a track tries the step above
  // Secure, per skill at the placed step. `families` is counted across the step (two kinds of question), the rest
  // per skill. A word item is light, a reading text is heavy: one shared count would ask twelve stories.
  SECURE: { units: 6, days: 2, families: 2, accuracy: 0.8 },
  SECURE_BY_TRACK: { E: { units: 3 }, Ca: { units: 4 } },
  SECURE_BY_SKILL: {},        // e.g. { 'B3:antonym': { units: 8 } }
  // Repeated struggle on a skill: enough wrong units, on more than one day, and mostly wrong.
  STRUGGLING: { wrong: 3, days: 2, accuracy: 0.5 },
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
const stepNo = (t, step) => (typeof step === 'number' ? step : Number(String(step).replace(t, '')))

// Where each track begins. stop: one of STOPS, 'native', or null when the parent left it to Tuto ("you decide").
// perTrack: a detailed parent's own starting steps ({ B: 3 }); still only a start.
// skills: the skills each step is meant to cover ({ B3: ['synonym', 'antonym'] }). A track is secure at a step only
// when every listed skill is; without a list, the skills actually asked at that step are the list.
export function start({ age, stop = null, perTrack = {}, skills = {} }) {
  const row = ageRow(age)
  const tracks = {}
  for (const t of TRACK_ORDER) {
    let first
    if (perTrack[t]) first = perTrack[t]
    else if (stop === 'native') first = row[t][0] || 1
    else if (stop && STOPS[stop]) first = READING.has(t) ? Math.min(STOPS[stop][t], row[t][1] || 1) : STOPS[stop][t]
    // Nobody chose: under 8, the middle of a wide bracket (age-solid, capped low), so one right answer can try a hard
    // one and one wrong answer can drop to the floor. From 8 the age-solid step itself: a ten-year-old's first sitting
    // was eight questions below their age ("What's your name?").
    else first = Math.max(1, Math.min(row[t][0] || 1, age >= 8 ? TRACKS[t] : Math.ceil(TRACKS[t] / 2)))
    // Placement does not search above one step past what the age introduces (a five-year-old who guesses one synonym
    // right is not asked "the quality of being valid and rigorous"). A parent's own starting step raises the cap; once
    // placed, the normal promotion rules can take the child higher.
    const cap = clamp(t, Math.max((row[t][1] || 0) + 1, perTrack[t] || 0))
    tracks[t] = { phase: 'placing', status: 'unknown', step: clamp(t, Math.min(first, cap)), lo: 0, hi: TRACKS[t] + 1, cap, history: [], floor: false }
  }
  return { version: RULES_VERSION, age, stop, skills, tracks, probes: 0 }
}

// The state rebuilt from the stored answers, in the order they were given. This is the only way the server should
// produce a state: the stored answers are the record, the state is a reading of them under today's rules.
export function replay(attempts, startOpts) {
  return attempts.reduce((s, a) => record(s, a), start(startOpts))
}

// What to ask next. has(track, step) says whether the content bank can serve that step now; a step it cannot
// serve is skipped (and reported by `gaps`), so missing content never stalls the child.
export function nextProbe(state, { has = () => true, session } = {}) {
  const last = recentInSession(state, session)
  const struggling = last.length >= RULES.STRUGGLE && last.slice(-RULES.STRUGGLE).every(a => !a.correct)
  // The track just asked waits a turn when another can go (four A5 clips in a row while A caught up on items).
  let lastTrack = null, lastN = -1
  for (const t of TRACK_ORDER) for (const h of state.tracks[t].history) if (session != null && h.session === session && h.n > lastN) { lastN = h.n; lastTrack = t }
  const w = t => weight(state.tracks[t], topWithContent(t, has), session) + (t === lastTrack ? 50 : 0)
  const order = [...TRACK_ORDER].sort((a, b) => w(a) - w(b) || TRACK_ORDER.indexOf(a) - TRACK_ORDER.indexOf(b))
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

// Tracks with fewer answers come first; placed tracks wait behind placing ones. A track placed at its top step whose
// last answers were all right has nothing left to find out: it is asked once a session, not every other question (a
// strong ten-year-old spent four questions a sitting on A5 listening and Ca4 order).
// The top is the highest step that has questions (E5 has none yet, so E4 is the top of E).
function weight(tr, top, session) {
  const now = session == null ? [] : tr.history.filter(h => h.session === session)
  const askedNow = now.length > 0
  // No track takes more than SESSION_SHARE items of a sitting while another can go.
  const full = new Set(now.map(h => h.item ?? h.group ?? h.n)).size >= SESSION_SHARE
  // Items, not answers: a story brings three answers, a listening clip one, and counting answers kept the listening
  // track behind and asked it four times running.
  const items = new Set(tr.history.map(h => h.item ?? h.group ?? h.n)).size
  return (tr.phase === 'placing' ? 0 : 100) + items + ((mastered(tr, top) && askedNow) || full ? 1000 : 0)
}
function topWithContent(t, has) {
  for (let s = TRACKS[t]; s > 1; s--) if (has(t, id(t, s))) return s
  return 1
}
export const MASTERED_RUN = 4
export const SESSION_SHARE = 3
function mastered(tr, top) {
  if (tr.phase !== 'placed' || tr.step < top) return false
  const at = units(tr).filter(u => u.step === tr.step)
  return at.length >= MASTERED_RUN && at.slice(-MASTERED_RUN).every(u => u.correct)
}

function target(tr, t) {
  if (tr.phase === 'placing') return tr.step
  const n = tr.history.filter(h => h.independent).length
  return n % RULES.STRETCH_EVERY === RULES.STRETCH_EVERY - 1 && tr.step < TRACKS[t] ? tr.step + 1 : tr.step
}

function recentInSession(state, session) {
  if (session == null) return []
  return TRACK_ORDER.flatMap(t => state.tracks[t].history).filter(h => h.session === session).sort((a, b) => a.n - b.n)
}

// One answer. attempt:
//   { track, step ('B3' or 3), correct, independent (default true), session, day,
//     skill, group, family, item, format, contentVersion, ruleVersion }
// skill defaults to the step (one skill per step), group to the item (or the answer itself), family to the skill,
// day to the session. Returns a new state; the old one is not changed.
export function record(state, attempt) {
  const s = structuredClone(state)
  const t = attempt.track
  const tr = s.tracks[t]
  const step = stepNo(t, attempt.step)
  s.probes += 1
  const skill = attempt.skill ?? id(t, step)
  tr.history.push({
    n: s.probes, step, skill,
    group: attempt.group ?? attempt.item ?? `#${s.probes}`,
    family: attempt.family ?? skill,
    item: attempt.item ?? null, format: attempt.format ?? null,
    correct: !!attempt.correct, independent: attempt.independent !== false,
    session: attempt.session ?? null, day: attempt.day ?? attempt.session ?? null,
    contentVersion: attempt.contentVersion ?? null, ruleVersion: attempt.ruleVersion ?? RULES_VERSION,
  })
  if (attempt.independent === false) return finish(s, t)            // practice, not evidence

  if (tr.phase === 'placing') {
    const tally = stepTally(units(tr))
    tr.lo = 0; tr.hi = TRACKS[t] + 1
    for (let k = 1; k <= TRACKS[t]; k++) if (passed(tally, k, TRACKS[t])) tr.lo = k
    for (let k = TRACKS[t]; k > tr.lo; k--) if (tooHard(tally, k)) tr.hi = k
    if (tr.cap) tr.hi = Math.min(tr.hi, tr.cap + 1)                 // the search stops at the age cap
    const placingAnswers = tr.history.filter(h => h.independent).length
    if (tr.hi - tr.lo <= 1 || placingAnswers >= RULES.MAX_PLACING) {
      tr.phase = 'placed'
      tr.status = 'provisional'
      // Stopped by the cap before the bracket closed: the highest step with more right than wrong units
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
    return finish(s, t)
  }

  // placed
  const us = units(tr)
  if (step === tr.step + 1) {
    const run = trailing(us.filter(u => u.step === tr.step + 1), u => u.correct)
    if (run.length >= RULES.PROMOTE && new Set(run.map(u => u.day)).size >= 2) {
      tr.step += 1; tr.status = 'provisional'; tr.floor = false
    }
  } else if (step === tr.step) {
    const at = us.filter(u => u.step === tr.step).slice(-RULES.DEMOTE_OF)
    if (at.length >= RULES.DEMOTE && at.filter(u => !u.correct).length >= RULES.DEMOTE && tr.step > 1) {
      tr.step -= 1; tr.status = 'provisional'
    }
  }
  return finish(s, t)
}

// After every answer: a placed track is secure while every skill at its step is, provisional otherwise.
function finish(s, t) {
  const tr = s.tracks[t]
  if (tr.phase !== 'placed') return s
  const sk = skillsAt(s, t, tr.step)
  tr.status = sk.length && sk.every(k => skillStatus(s, t, tr.step, k).status === 'secure') && familiesAt(tr, tr.step) >= RULES.SECURE.families
    ? 'secure' : 'provisional'
  return s
}

// Units of evidence: independent answers grouped by (step, skill, group). The first day the group was met decides
// the unit (right only if every answer that day was right); answers on that group on later days are delayed
// repeats, kept apart. Ordered by the unit's first answer.
export function units(tr) {
  const byKey = new Map()
  const delayed = []
  for (const h of tr.history) {
    if (!h.independent) continue
    const key = `${h.step}|${h.skill}|${h.group}`
    const u = byKey.get(key)
    if (!u) byKey.set(key, { step: h.step, skill: h.skill, group: h.group, family: h.family, day: h.day, n: h.n, correct: h.correct, answers: 1 })
    else if (h.day === u.day) { u.correct = u.correct && h.correct; u.answers++ }
    else delayed.push({ step: h.step, skill: h.skill, group: h.group, day: h.day, correct: h.correct })
  }
  const list = [...byKey.values()].sort((a, b) => a.n - b.n)
  list.delayed = delayed
  return list
}

function skillsAt(s, t, step) {
  const listed = s.skills?.[id(t, step)]
  if (listed?.length) return listed
  return [...new Set(s.tracks[t].history.filter(h => h.step === step).map(h => h.skill))]
}

function familiesAt(tr, step) {
  return new Set(units(tr).filter(u => u.step === step).map(u => u.family)).size
}

function secureRule(t, step, skill) {
  return { ...RULES.SECURE, ...(RULES.SECURE_BY_TRACK[t] || {}), ...(RULES.SECURE_BY_SKILL[`${id(t, step)}:${skill}`] || {}) }
}

// One skill at one step, as a parent statement the code may pick (docs/ENGLISH-SKILL-LADDERS.md, rev. 3):
//   secure      enough independent evidence for now
//   struggling  repeated wrong units, on more than one day
//   helped      right only with help so far
//   little      some evidence, not enough to say more
//   unknown     nothing asked
export function skillStatus(s, t, step, skill) {
  const tr = s.tracks[t]
  const us = units(tr).filter(u => u.step === step && u.skill === skill)
  const right = us.filter(u => u.correct).length
  const days = new Set(us.map(u => u.day)).size
  const accuracy = us.length ? right / us.length : null
  const helpedRight = tr.history.filter(h => h.step === step && h.skill === skill && !h.independent && h.correct).length
  const delayed = units(tr).delayed.filter(d => d.step === step && d.skill === skill)
  const rule = secureRule(t, step, skill)
  let status = 'unknown'
  if (us.length >= rule.units && days >= rule.days && accuracy >= rule.accuracy) status = 'secure'
  else if (us.length - right >= RULES.STRUGGLING.wrong && days >= RULES.STRUGGLING.days && accuracy < RULES.STRUGGLING.accuracy) status = 'struggling'
  else if (helpedRight && right === 0) status = 'helped'
  else if (us.length || helpedRight) status = 'little'
  return {
    status, units: us.length, right, days, accuracy, helpedRight,
    delayed: { asked: delayed.length, right: delayed.filter(d => d.correct).length },
  }
}

// Placing evidence per step, in units. Three-option items are guessed right one time in three, so one right unit is
// not enough to call a step passed, as one wrong unit is not enough to call it too hard.
function stepTally(us) {
  const out = {}
  for (const u of us) {
    const k = (out[u.step] ||= { right: 0, wrong: 0 })
    u.correct ? k.right++ : k.wrong++
  }
  return out
}
// Passed: two right units more than wrong ones, or one right with a right unit on a higher step and no miss here.
// A right answer above confirms the steps below it (the ladder is ordered).
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

// What may be said about each track and each skill at its step. A parent hears about a track only from
// `provisional` on; `secure` is said plainly, `provisional` as a first observation. `ceiling`: secure at the top
// step, i.e. "solved our most advanced items; nothing further measured". `vsAge` compares with the age table's
// solid step and is only meaningful for a child whose English is native (the caller knows the slider stop).
// `skills` carries one statement per skill (skillStatus), so the message can name exactly what was shown.
export function summary(state, { age = state.age } = {}) {
  const row = ageRow(age)
  const out = {}
  for (const t of TRACK_ORDER) {
    const tr = state.tracks[t]
    const placed = tr.phase === 'placed'
    const solid = row[t][0]
    out[t] = {
      step: placed ? id(t, tr.step) : null,
      status: tr.status,
      floor: tr.floor,
      ceiling: placed && tr.status === 'secure' && tr.step === TRACKS[t],
      answers: tr.history.filter(h => h.independent).length,
      units: units(tr).length,
      sessions: new Set(tr.history.map(h => h.session)).size,
      days: new Set(tr.history.map(h => h.day)).size,
      canSay: tr.status !== 'unknown',
      vsAge: !placed || !solid ? null : tr.step > row[t][1] ? 'above' : tr.step >= solid ? 'on' : 'below',
      // Share of the track climbed, 0-1: lets "reading is ahead of listening" be said for any child.
      height: placed ? +(tr.step / TRACKS[t]).toFixed(2) : null,
      skills: placed ? Object.fromEntries(skillsAt(state, t, tr.step).map(k => [k, skillStatus(state, t, tr.step, k)])) : {},
    }
  }
  return out
}
