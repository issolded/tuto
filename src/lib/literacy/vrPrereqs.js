// Verbal reasoning (VR) question families and what each needs from the English ladder before it may be asked.
// Data from docs/ENGLISH-VR-PREREQUISITES.md (draft 1, read from the generators, NOT yet reviewed against real
// items). Pure data; vrOffer.js decides with it.
//
//   needs   ladder steps that must be met: { B: 2, D: 1 } = track B placed above step 2 or secure at it, and D1 likewise
//   probes  checks the ladder does not have (alphabet order, case matching, relation words, sound rhyme). No probe
//           exists yet, so a family that needs one is never open: K0 waits for the probes and for a product decision.
//   tier    K0 alphabet, K1 short-word structure, K2 meaning, K3 the 8-9 families
//   answers distinct answers in 3000 seeds (scripts/english/vr-pool.mjs, 2026-10-18): how far the family goes before
//           a child meets the same answer again

export const VR_PREREQS_VERSION = 'vr-prereqs-1'

export const VR_FAMILIES = [
  // ── 7-8 band ──
  { band: '7-8', type: 'letter-analogy', tier: 'K0', needs: {}, probes: ['alphabet'], answers: 89 },
  { band: '7-8', type: 'letter-sum', tier: 'K0', needs: {}, probes: [], answers: 43 },
  { band: '7-8', type: 'alpha-order', tier: 'K0', needs: {}, probes: ['alphabet'], answers: 1174 },
  { band: '7-8', type: 'letters-in-order', tier: 'K0', needs: {}, probes: ['alphabet'], answers: 85 },
  { band: '7-8', type: 'letter-code', tier: 'K0', needs: {}, probes: ['alphabet', 'case'], answers: 674 },
  { band: '7-8', type: 'anagram-pair', tier: 'K1', needs: { B: 2, D: 1 }, probes: [], answers: 154 },
  { band: '7-8', type: 'join-letter', tier: 'K1', needs: { B: 2, D: 2 }, probes: [], answers: 20 },
  { band: '7-8', type: 'front-letter', tier: 'K1', needs: { B: 2, D: 2 }, probes: [], answers: 22 },
  { band: '7-8', type: 'change-pattern', tier: 'K1', needs: { B: 2, D: 1 }, probes: [], answers: 468 },
  { band: '7-8', type: 'word-ladder', tier: 'K1', needs: { B: 2, D: 1 }, probes: [], answers: 433 },
  { band: '7-8', type: 'not-from-letters', tier: 'K1', needs: { B: 2 }, probes: [], answers: 755 },
  { band: '7-8', type: 'unscramble', tier: 'K1', needs: { B: 2, D: 2 }, probes: [], answers: 214 },
  { band: '7-8', type: 'logic-grid', tier: 'K1', needs: { Ca: 3 }, probes: [], answers: 24 },
  { band: '7-8', type: 'pair-meaning', tier: 'K2', needs: { B: 3 }, probes: [], answers: 153 },
  { band: '7-8', type: 'odd-two', tier: 'K2', needs: { B: 3 }, probes: [], answers: 118 },
  { band: '7-8', type: 'compound-front', tier: 'K2', needs: { B: 3 }, probes: [], answers: 30 },
  { band: '7-8', type: 'analogy', tier: 'K2', needs: { B: 3 }, probes: ['relation-words'], answers: 111 },
  { band: '7-8', type: 'rhyme-synonym', tier: 'K2', needs: { B: 3 }, probes: ['rhyme-audio'], answers: 43 },
  // ── 8-9 band ──
  { band: '8-9', type: 'odd-two', tier: 'K3', needs: { B: 4 }, probes: [], answers: 371 },
  { band: '8-9', type: 'word-grid', tier: 'K3', needs: { B: 4 }, probes: [], answers: 140 },
  { band: '8-9', type: 'letter-pair', tier: 'K3', needs: { B: 4, D: 3 }, probes: [], answers: 261 },
  { band: '8-9', type: 'shared-letters', tier: 'K3', needs: { B: 4, D: 4 }, probes: [], answers: 839 },
  { band: '8-9', type: 'hidden-word', tier: 'K3', needs: { B: 4, Ca: 4 }, probes: [], answers: 60 },
]

// VR levels in order. A level may be offered once enough of its families are open to make a short sitting that
// does not repeat itself (draft 1 assumption: 5 open families, 3 of them with 200+ distinct answers).
export const VR_LEVELS = ['7-8', '8-9']
export const ENOUGH = { families: 5, wide: 3, wideAnswers: 200 }
