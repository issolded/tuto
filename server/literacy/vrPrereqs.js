// Verbal reasoning (VR) question families and what each needs from the English ladder before it may be asked.
// Data from docs/ENGLISH-VR-PREREQUISITES.md. Draft 2 (2026-10-19): every row checked against seven real generated
// questions (scripts/english/vr-sample.mjs). Pure data; vrOffer.js decides with it.
//
//   load    what the question really asks, read from the items (not from the book's label)
//   needs   ladder steps that must be met: { B: 2, D: 1 } = track B placed above step 2 or secure at it, and D1 likewise
//   probes  checks the ladder does not have (alphabet order, case matching, relation words, sound rhyme). No probe
//           exists yet, so a family that needs one is closed.
//   answers distinct answers in 3000 seeds (scripts/english/vr-pool.mjs, 2026-10-18; content fixes re-measured 2026-10-19)
//
// FLOOR: the product rule on top of the load (user, 2026-10-18: "VR'ı açmak için bir okuryazarlık tabanı olmalı").
// Draft 2 found that most 7-8 families are letter puzzles a child can solve without knowing the words (an anagram,
// a one-letter ladder, "which word cannot be made from these letters" are all checkable letter by letter). By load
// alone they would open for a child with no English, which is not what VR is for in Tuto. So every family also needs
// the floor: reading short common words (B2) and building them (D1). The load column keeps the truth for later.

export const VR_PREREQS_VERSION = 'vr-prereqs-2'

export const FLOOR = { B: 2, D: 1 }

export const VR_FAMILIES = [
  // ── 7-8 band ──
  // Letters only: the words need not be known.
  { band: '7-8', type: 'letter-sum', load: 'letters', needs: {}, probes: [], answers: 43 },
  { band: '7-8', type: 'anagram-pair', load: 'letters', needs: {}, probes: [], answers: 154 },
  { band: '7-8', type: 'not-from-letters', load: 'letters', needs: {}, probes: [], answers: 755 },
  { band: '7-8', type: 'change-pattern', load: 'letters', needs: {}, probes: [], answers: 468 },
  { band: '7-8', type: 'word-ladder', load: 'letters', needs: {}, probes: [], answers: 433 },
  { band: '7-8', type: 'unscramble', load: 'letters', needs: {}, probes: [], answers: 214 },
  { band: '7-8', type: 'letter-code', load: 'letters', needs: {}, probes: ['case'], answers: 674 },
  // Alphabet order.
  { band: '7-8', type: 'letter-analogy', load: 'alphabet', needs: {}, probes: ['alphabet'], answers: 89 },
  { band: '7-8', type: 'alpha-order', load: 'alphabet', needs: {}, probes: ['alphabet'], answers: 1174 },
  { band: '7-8', type: 'letters-in-order', load: 'alphabet', needs: {}, probes: ['alphabet'], answers: 85 },
  // Recalling words from their spelling.
  { band: '7-8', type: 'join-letter', load: 'spelling-recall', needs: { B: 2, D: 2 }, probes: [], answers: 20 },
  { band: '7-8', type: 'front-letter', load: 'spelling-recall', needs: { B: 3, D: 2 }, probes: [], answers: 22 },
  // Reading sentences.
  { band: '7-8', type: 'logic-grid', load: 'sentences', needs: { Ca: 3 }, probes: [], answers: 24 },
  // Meaning.
  { band: '7-8', type: 'odd-two', load: 'meaning', needs: { B: 3 }, probes: [], answers: 150 },
  { band: '7-8', type: 'pair-meaning', load: 'meaning', needs: { B: 4 }, probes: [], answers: 153 },
  { band: '7-8', type: 'compound-front', load: 'meaning', needs: { B: 4 }, probes: [], answers: 31 },
  { band: '7-8', type: 'analogy', load: 'meaning', needs: { B: 3 }, probes: ['relation-words'], answers: 111 },
  { band: '7-8', type: 'rhyme-synonym', load: 'meaning+sound', needs: { B: 4 }, probes: ['rhyme-audio'], answers: 47 },
  // ── 8-9 band ──
  { band: '8-9', type: 'odd-two', load: 'meaning', needs: { B: 4 }, probes: [], answers: 203 },
  { band: '8-9', type: 'word-grid', load: 'meaning', needs: { B: 4 }, probes: [], answers: 140 },
  { band: '8-9', type: 'letter-pair', load: 'meaning+spelling', needs: { B: 4, D: 3 }, probes: [], answers: 261 },
  { band: '8-9', type: 'shared-letters', load: 'spelling-recall', needs: { B: 4, D: 4 }, probes: [], answers: 839 },
  { band: '8-9', type: 'hidden-word', load: 'sentences+spelling', needs: { B: 5, Ca: 4 }, probes: [], answers: 45 },
]

// VR levels in order. A level may be offered when a short sitting can be made without repeating itself (draft 2
// assumption): at least 5 open families at this level or below, 3 of them with 200+ distinct answers, and at least
// 3 open families of this level's own band. Counting the lower bands is what lets 8-9 open: it has only five families
// and a sitting may mix both bands.
export const VR_LEVELS = ['7-8', '8-9']
export const ENOUGH = { families: 5, wide: 3, wideAnswers: 200, ownBand: 3 }
