// English content catalog: which source can serve which ladder step (docs/ENGLISH-SKILL-LADDERS.md), in
// which answer format, how much of it, and how far it has been reviewed. Labels only: nothing here makes a
// question (the server asks the source), so the heavy engines are not imported.
//
// The ladder engine asks has(track, step); a child screen passes minStatus 'approved', the lab 'draft'.
//
// status, lowest to highest:
//   draft     written, not checked by code (or checked, but never tried with a child and the source says so)
//   checked   passed automatic checks (tests, gates, blind solver); no person has approved it
//   approved  a person approved it; for anything with audio, every recording approved too
// The verbal reasoning engine's items are live for children, but which ladder step a type serves is read from
// the ladder document and was never measured, so those entries are `checked`, not `approved`.

import { TRIAL_ITEMS } from './trialSet.js'
import { LISTENING } from './listeningBank.js'
import READING from './readingPreview.generated.json' with { type: 'json' }
import { SENTENCES } from './sentenceBank.js'

export const STATUS = ['draft', 'checked', 'approved']
const atLeast = (s, min) => STATUS.indexOf(s) >= STATUS.indexOf(min)
const steps = s => ({ track: s.match(/^[A-Z][a-z]?/)[0], step: s })

// Generators: one entry per (step, type). `count: null` = generated, effectively unlimited for the ladder.
// A generator can return nothing for a seed (the VR engine's `sense` keeps only hand-read answers, about half
// of seeds): the server tries the next seed.
const VR = 'vr-engine'      // src/lib/englishTemplates.js generateItem(band, type, seed): live English card
const LIT = 'literacy-engine'   // src/lib/literacy/engine.js generateItem(skill, seed): Codex pilot lab
const PIC = 'picture-words'     // src/lib/literacy/pictureWords.js pictureItem(kind, seed): Starters noun -> 4 pictures
const GENERATED = [
  // ── A1 / B1: a word heard or read -> one of four pictures ──
  { source: PIC, step: 'A1', format: 'listen-picture', ref: { kind: 'listen' }, note: '32 Starters nouns drawn in the project; recordings not approved' },
  { source: PIC, step: 'B1', format: 'read-picture', ref: { kind: 'read' }, note: '32 Starters nouns drawn in the project' },
  // ── B: written word meaning ──
  { source: LIT, step: 'B2', format: 'read-choice', ref: { skill: 'meaning' }, note: 'word -> definition; reading load is the definition' },
  { source: LIT, step: 'B2', format: 'read-choice', ref: { skill: 'cloze' } },
  { source: VR, step: 'B2', format: 'read-choice', ref: { type: 'odd-two', band: '7-8' }, note: '"which TWO" adds a reasoning load; a single odd one out would be cleaner' },
  { source: VR, step: 'B3', format: 'read-choice', ref: { type: 'antonym', band: '7-8' } },
  { source: VR, step: 'B3', format: 'read-choice', ref: { type: 'synonym', band: '7-8' } },
  { source: VR, step: 'B4', format: 'read-choice', ref: { type: 'synonym', band: '8-9' } },
  { source: VR, step: 'B4', format: 'read-choice', ref: { type: 'antonym', band: '8-9' } },
  { source: VR, step: 'B5', format: 'read-choice', ref: { type: 'sense', band: '8-9' }, note: 'about 1 seed in 2' },
  { source: VR, step: 'B5', format: 'read-choice', ref: { type: 'odd-synonym', band: '9-10' }, note: 'drop options that differ by form (worst) at this step' },
  { source: VR, step: 'B6', format: 'read-choice', ref: { type: 'synonym', band: '11-12' } },
  { source: VR, step: 'B6', format: 'read-choice', ref: { type: 'definition', band: '11-12' } },
  // ── Cd: the right form ──
  { source: LIT, step: 'Cd1', format: 'read-choice', ref: { skill: 'be' } },
  { source: LIT, step: 'Cd1', format: 'read-choice', ref: { skill: 'plural' } },
  { source: LIT, step: 'Cd2', format: 'read-choice', ref: { skill: 'capital' } },
  { source: LIT, step: 'Cd2', format: 'read-choice', ref: { skill: 'punctuation' }, note: 'the comma option is a weak distractor' },
  { source: VR, step: 'Cd3', format: 'read-choice', ref: { type: 'past-tense', band: '9-10' }, note: 'words should be filtered to the step (swim yes, rarer verbs no)' },
  { source: VR, step: 'Cd4', format: 'read-choice', ref: { type: 'grammar-cloze', band: '10-11' } },
  { source: VR, step: 'Cd4', format: 'read-choice', ref: { type: 'comparative', band: '10-11' } },
  { source: VR, step: 'Cd4', format: 'read-choice', ref: { type: 'contraction', band: '10-11' } },
  { source: VR, step: 'Cd5', format: 'read-choice', ref: { type: 'apostrophe', band: '10-11' } },
  { source: VR, step: 'Cd5', format: 'read-choice', ref: { type: 'homophone-cloze', band: '10-11' } },
  // ── D: spelling ──
  { source: LIT, step: 'D1', format: 'build', ref: { skill: 'build' }, note: 'today from a definition; the step wants a picture (reading otherwise)' },
  { source: LIT, step: 'D2', format: 'read-choice', ref: { skill: 'missing' }, note: 'distractor letters are random today; should come from the target sound' },
  { source: VR, step: 'D3', format: 'read-choice', ref: { type: 'plural', band: '8-9' }, note: 'filter words to the step' },
  { source: VR, step: 'D4', format: 'read-choice', ref: { type: 'suffix', band: '9-10' }, note: 'makes an item for about 1 seed in 5 (all bands 15-22%)' },
  { source: VR, step: 'D4', format: 'read-choice', ref: { type: 'missing-vowel', band: '10-11' } },
  { source: VR, step: 'D5', format: 'read-choice', ref: { type: 'silent-letter', band: '10-11' } },
  { source: VR, step: 'D5', format: 'read-choice', ref: { type: 'ie-ei', band: '10-11' } },
  { source: VR, step: 'D5', format: 'read-choice', ref: { type: 'ending', band: '10-11' } },
  { source: VR, step: 'D6', format: 'read-choice', ref: { type: 'misspelt', band: '10-11' } },
  // ── E: reading ──
  { source: LIT, step: 'E2', format: 'passage', ref: { skill: 'detail' }, note: '6 short texts in the lab' },
  { source: LIT, step: 'E2', format: 'passage', ref: { skill: 'sequence' }, note: '"what happened first": comprehension, not ordering evidence' },
].map(e => ({ ...e, ...steps(e.step), kind: 'generator', count: null, status: 'checked' }))

// Banks: written items, counted.
const bank = (source, list, status, note) => {
  const by = new Map()
  for (const it of list) {
    const key = `${it.step}|${it.format}`
    if (!by.has(key)) by.set(key, { source, ...steps(it.step), format: it.format, kind: 'bank', status, note, ids: [] })
    by.get(key).ids.push(it.id)
  }
  return [...by.values()].map(e => ({ ...e, count: e.ids.length }))
}
const BANKS = [
  ...bank('trial-set', TRIAL_ITEMS.map(i => ({ id: i.id, step: i.step, format: i.mode })), 'draft',
    'the 36-item trial set: editorial, not tried with a child; audio not approved'),
  ...bank('listening-bank', LISTENING.map(i => ({ id: i.id, step: i.step, format: 'listen-answer' })), 'checked',
    'blind-solver and safety checked; audio not approved'),
  ...bank('sentence-bank', SENTENCES.map(i => ({ id: i.id, step: i.step, format: 'read-choice' })), 'checked',
    'src/lib/literacy/sentenceBank.js: vocabulary, safety and blind-solver checked; not approved'),
  ...bank('reading-passages', READING.items.map(i => ({ id: i.id, step: i.level, format: 'passage' })), 'checked',
    'scripts/english-passages candidates: passed automatic checks, not approved by a person'),
]

export const CATALOG = [...BANKS, ...GENERATED]

export function entriesFor(track, step, { minStatus = 'approved' } = {}) {
  return CATALOG.filter(e => e.track === track && e.step === step && atLeast(e.status, minStatus))
}
// For the ladder engine: nextProbe(state, { has: hasContent('approved') }).
export const hasContent = (minStatus = 'approved') => (track, step) => entriesFor(track, step, { minStatus }).length > 0

// One source for a probe, deterministic from the seed: a bank item, or a generator reference with a seed.
// Sources at a step take turns by seed, so one generator cannot crowd out a small bank.
export function pick(track, step, seed, { minStatus = 'approved', avoid = new Set() } = {}) {
  const list = entriesFor(track, step, { minStatus })
  if (!list.length) return null
  const e = list[seed % list.length]
  if (e.kind === 'bank') {
    const free = e.ids.filter(i => !avoid.has(i))
    if (!free.length) return null
    return { source: e.source, format: e.format, track, step, id: free[Math.floor(seed / list.length) % free.length] }
  }
  return { source: e.source, format: e.format, track, step, ref: { ...e.ref, seed } }
}

// Per step: sources, how many, best status. What the content work has to fill.
export function coverage() {
  const out = {}
  for (const e of CATALOG) {
    const k = (out[e.step] ||= { step: e.step, track: e.track, sources: [], items: 0, generated: false, best: 'draft', formats: new Set() })
    k.sources.push(`${e.source}${e.ref ? ':' + (e.ref.type || e.ref.skill) : ''}`)
    if (e.count == null) k.generated = true; else k.items += e.count
    if (STATUS.indexOf(e.status) > STATUS.indexOf(k.best)) k.best = e.status
    k.formats.add(e.format)
  }
  return out
}
