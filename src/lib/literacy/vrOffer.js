// Should Tuto suggest English word puzzles (VR) to the parent now? Pure and deterministic: the ladder state
// (rebuilt from raw answers), the child's VR switch and the permanent parent events go in, one decision comes out.
// Nothing is sent from here; the caller writes the returned events and, later, the message.
// Rules: docs/ENGLISH-SKILL-LADDERS.md "Navigasyon ve sözel akıl yürütme" (rev. 3).
//
//   decideVrOffer({ state, vr, events, trial })
//     -> { action: 'none' | 'offer' | 'trial', reason, level?, families?, evidence?, append: [events to write] }
//
// - Opened by measurement, never by a parent's word about school or home language.
// - An offer is made once per VR level. Declined or unanswered, it comes back only when the NEXT level opens.
// - "Don't ask again" stops offers for good; the parent can still switch VR on by hand.
// - VR already on (by the parent, by an accepted offer, or because the child played it before): nothing to offer.
// - Trial access is not competence: a strong first probe may earn a short trial offer, `secure` still waits for days.

import { VR_FAMILIES, VR_LEVELS, ENOUGH, FLOOR, VR_PREREQS_VERSION } from './vrPrereqs.js'

// A ladder step is met when its track is placed above it, or placed at it and secure there.
export function stepMet(state, track, step) {
  const tr = state?.tracks?.[track]
  if (!tr || tr.phase !== 'placed') return false
  return tr.step > step || (tr.step === step && tr.status === 'secure')
}

// Open = the product floor (reading and building short words) and the family's own load are both met.
export function familyOpen(state, fam) {
  if (fam.probes.length) return false                   // no probe exists yet: closed, never guessed
  const need = { ...FLOOR }
  for (const [t, st] of Object.entries(fam.needs)) need[t] = Math.max(need[t] || 0, st)
  return Object.entries(need).every(([t, st]) => stepMet(state, t, st))
}

// Families open at each level, and whether the level has enough of them.
export function openFamilies(state) {
  const out = {}
  const open = VR_FAMILIES.filter(f => familyOpen(state, f))
  for (const [i, level] of VR_LEVELS.entries()) {
    const upTo = open.filter(f => VR_LEVELS.indexOf(f.band) <= i)
    const own = open.filter(f => f.band === level)
    const wide = upTo.filter(f => f.answers >= ENOUGH.wideAnswers).length
    out[level] = {
      families: own.map(f => f.type),
      enough: upTo.length >= ENOUGH.families && wide >= ENOUGH.wide && own.length >= ENOUGH.ownBand,
    }
  }
  return out
}

// Pilot trial rule (rev. 3): in two families, three new items each, all right without help. `trial` is
// { [type]: [true, false, ...] } of independent first answers to VR items asked during probing. No sitting asks
// VR items yet, so this is empty today and the rule never fires; it is here so the decision has one home.
export function trialEarned(trial = {}) {
  const strong = Object.values(trial).filter(a => a.length >= 3 && a.slice(0, 3).every(Boolean))
  return strong.length >= 2
}

const ev = (kind, subject, detail = {}) => ({ kind, subject, detail, rule_version: VR_PREREQS_VERSION })

export function decideVrOffer({ state, vr = null, events = [], trial = {} }) {
  if (vr?.enabled) return { action: 'none', reason: 'enabled', append: [] }
  if (events.some(e => e.kind === 'vr_no_more_offers')) return { action: 'none', reason: 'opted-out', append: [] }

  const open = openFamilies(state)
  const best = [...VR_LEVELS].reverse().find(l => open[l].enough) || null
  const offered = new Set(events.filter(e => e.kind === 'vr_offered').map(e => e.subject))
  const answered = new Set(events.filter(e => ['vr_offer_declined', 'vr_offer_unanswered'].includes(e.kind)).map(e => e.subject))

  if (best && !offered.has(best)) {
    // An earlier offer the parent never answered becomes "unanswered" now, so it is on record before the next one.
    const append = [...offered].filter(l => !answered.has(l)).map(l => ev('vr_offer_unanswered', l))
    const evidence = [...new Set(VR_FAMILIES.filter(f => f.band === best && open[best].families.includes(f.type))
      .flatMap(f => Object.entries(f.needs).map(([t, s]) => `${t}${s}`)))].sort()
    append.push(ev('vr_offered', best, { families: open[best].families, evidence }))
    return { action: 'offer', reason: 'level-open', level: best, families: open[best].families, evidence, append }
  }
  if (best) return { action: 'none', reason: answered.has(best) ? 'answered-at-level' : 'offered-at-level', level: best, append: [] }

  if (trialEarned(trial) && !events.some(e => e.kind === 'vr_trial_offered')) {
    return { action: 'trial', reason: 'strong-first-probe', append: [ev('vr_trial_offered', 'trial', { families: Object.keys(trial) })] }
  }
  return { action: 'none', reason: 'not-yet', append: [] }
}
