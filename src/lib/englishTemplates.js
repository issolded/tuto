// Question generation for the English module (verbal reasoning, no comprehension passages).
//
// Modelled on Bond 11+ English and Verbal Reasoning 10 Minute Tests 8-9 (Michellejoy Hughes),
// the way src/lib/puzzleTemplates.js is modelled on the Bond non-verbal papers — and built the
// same way: a generator per question TYPE over one shared vocabulary, so age picks a dial
// setting rather than a set of templates. Only the 8-9 band exists today; the bands above and
// below it are threshold changes in BANDS, not new code.
//
// The one real difference from the puzzle engine, and it decides everything else here: there,
// content was DRAWN — geometry is infinite, free, and means the same thing in every language.
// Here content is a LEXICON. The generator is thin; what carries the module is the data under
// it (src/lib/englishLexicon.generated.js, built once from WordNet by
// scripts/english/build_lexicon.py). Nothing in this file calls a model, at generation time or
// ever: a question costs nothing and takes under a millisecond, exactly like a puzzle.
//
// What the book actually asks, once its nine comprehension passages are set aside (they belong
// to the Reading module, which has real books in it):
//
//   synonym / antonym       a word, five options, pick the closest or the opposite
//   sense                   "What does 'bear' mean as used in this sentence?" — the book's
//                           most-asked type, 24 of them
//   odd-two                 five words, TWO of which are not in the group
//   word-grid               a grid of twelve words; find the TWO that mean X
//   letter-pair             tired → sl__py: complete the word so it matches the one on the left
//   shared-letters          the same three letters finish both of these words
//   hidden-word             a three-letter WORD hides inside a longer one: pil___ → low
//
// Shape of an item:
//   { seed, band, type, stem_key, prompt: {...}, options: [{ text, why }],
//     correct: [index], pick, rule: {...} }
//
// `pick` is how many options the child selects — one, except for odd-two and word-grid, which
// the book always asks in twos. `correct` is a list for the same reason.
//
// `why` names WHY a wrong option is wrong, and it is the whole reason the distractors are
// generated rather than sampled. Look at what the book does with `early`:
//
//     early    a premature   b late   c delay   d tardy   e hardy
//
// Three of those four wrong answers are about LATENESS — the opposite of the word — and the
// fourth rhymes with it. That is not five words pulled from a hat; each one is a specific
// misreading made available to the child. So a distractor here carries its kind ('opposite',
// 'rhyme', 'same-group', 'other-sense', 'unrelated'), which is what lets a help panel say
// "that one means the opposite" instead of "wrong", the same job `why` does in the puzzle
// engine's options.
//
// And the check the whole thing stands on: validateItem() proves an item has exactly ONE
// defensible answer. WordNet will happily offer `reply` as a distractor for `question` whose
// answer is `answer` — two words that are synonyms of each other. Without that check this
// engine produces plausible-looking questions with two right answers, which is worse than
// producing none.

import {
  WORD_Z, WORD_LEX, SYNSETS, ANTONYMS, CATEGORIES, SENSES, EXAMPLES, KINSHIP, BLOCKED,
  LEXICON_META,
} from './englishLexicon.generated.js'

// The blocklist at runtime, not only at build time. Everything drawn FROM the lexicon is
// already clean — the builder never put a blocked word in it. The letter types do not draw
// from the lexicon: they assemble three letters, and three letters spell something unfortunate
// about once in every three hundred items. The audit found `ass`, `pee`, `tit`, `hoe` and
// `gin` sitting in options lists, each one a letter group that happened to be a word.
const BANNED = new Set(BLOCKED)

// The lexical files a filler option may come from. WordNet sorts every sense into one of 45 of
// these, and the split that matters here is not part of speech but whether a nine-year-old has
// ever met the word. The first build drew fillers from the whole list at Zipf 2.8 and produced
// lines like `medal … demography … dilution … parameter`: five options, four of which a child
// cannot read, which tests nothing and teaches nothing. What is left in is the concrete half —
// things, animals, food, plants, bodies, places, feelings — plus the verbs of doing and moving.
const CONCRETE = new Set([
  'noun.animal', 'noun.artifact', 'noun.body', 'noun.food', 'noun.object', 'noun.plant',
  'noun.substance', 'noun.person', 'noun.shape', 'noun.feeling', 'noun.time', 'noun.quantity',
  'verb.motion', 'verb.contact', 'verb.consumption', 'verb.body', 'verb.perception',
  'verb.creation', 'verb.competition', 'verb.emotion', 'adj.all',
])

const concrete = (w) => CONCRETE.has(WORD_LEX[w])

export const TYPES = [
  'synonym', 'antonym', 'sense', 'odd-two', 'word-grid',
  'letter-pair', 'shared-letters', 'hidden-word',
]

export const STEM_KEYS = {
  synonym: 'eng_stem_synonym',
  antonym: 'eng_stem_antonym',
  sense: 'eng_stem_sense',
  'odd-two': 'eng_stem_odd_two',
  'word-grid': 'eng_stem_grid',
  'letter-pair': 'eng_stem_letter_pair',
  'shared-letters': 'eng_stem_shared',
  'hidden-word': 'eng_stem_hidden',
}

// ── bands ────────────────────────────────────────────────────────────────────────────────
//
// `answer` and `option` are Zipf frequencies ×10 — the scale WORD_Z stores, where 50 is `sad`
// and 30 is `hutch`. Both numbers are measured rather than chosen: the 598 real words the Bond
// 8-9 book uses as options have their 5th percentile at Zipf 2.86, so 28 keeps 95% of the
// book's own vocabulary. The answer sits higher than the distractors on purpose, and that gap
// is the book's habit too — it will offer `goslings` (1.86) as a wrong answer but never as a
// right one. A child should not lose a mark for not knowing the word they did not pick.
//
// A band is a dial setting, not a template set. 5-6 and 10-11 are these same generators with
// `answer`/`option` moved and a `types` line — which is the claim this file has to keep true,
// so nothing below reads `band.key`.
export const BANDS = {
  '8-9': {
    book: 'Bond 11+ English and Verbal Reasoning 10 Minute Tests 8-9 (Michellejoy Hughes)',
    types: TYPES,
    options: 5,              // the book offers a–e throughout
    answer: 36,              // Zipf ×10: the answer must be a word a nine-year-old reads
    option: 28,              // distractors may be rarer, as the book's are
    // The word the question is ABOUT — the one printed on the left of a synonym line, or
    // quoted in a sense question. It has a ceiling as well as a floor, and the ceiling is the
    // interesting half: above Zipf 5.5 a word is grammar rather than vocabulary, and WordNet's
    // sentences for it read as riddles ("he has the one but will need a two and three to go").
    // The floor is higher than the answer's because a child who cannot read the QUESTION has
    // not been asked one — `peripheral`, `patronage`, `organism` were all stems once.
    stem: 40,
    stemMax: 55,
    // Filler options — the ones that carry no trap and exist to make five. They are held
    // HIGHER than the answer, not lower, which looks backwards and is not: a distractor that
    // earns its place (an opposite, a rhyme, another sense) may be rare because the child is
    // being asked something by it. A filler is only there to be dismissed, and a filler the
    // child cannot read is dismissed for the wrong reason — it narrows five options to two
    // without testing anything. `medal … demography … dilution` was a two-horse race.
    filler: 42,
    gridSize: 12,            // the book's word grids are 4 × 3
    // How many letters the letter types hide. The book's 8-9 tests use three and four.
    mask: [2, 3, 4],
  },
}

export const BAND_KEYS = Object.keys(BANDS)

// What the book has that this engine does not — data rather than a comment, so the audit can
// check it and so it cannot quietly go stale after a type ships. Same contract as the puzzle
// engine's BOOK_COVERAGE.
export const BOOK_COVERAGE = {
  '8-9': {
    book: BANDS['8-9'].book,
    missing: [
      'comprehension (tests 1, 4, 9, 13, 16, 18, 22, 26) — deliberate: a passage written to\n'
      + '        be quizzed is a worse version of what the Reading module already does with real books',
      'cloze paragraphs — a paragraph with six blanks and a word pool. Needs written\n'
      + '        paragraphs; WordNet has sentences, not passages',
      'jumbled sentence with one extra word ("garden the in bathroom trees tall were there") —\n'
      + '        needs a sentence bank, and a check that no OTHER sentence can be made from the words',
      'word class (noun / verb / adjective / conjunction / pronoun) matching',
    ],
  },
}

export function bandForAge(age) {
  const n = Number(age) || 8
  if (n <= 9) return '8-9'
  return '8-9'
}

// ── seeded randomness ────────────────────────────────────────────────────────────────────
// Same generator as the puzzle engine, for the same reason: an attempt row carries a seed, and
// the seed alone has to put the exact question back on screen.
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pickOne = (r, arr) => arr[Math.floor(r() * arr.length)]

function shuffle(r, arr) {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ── indexes over the lexicon ─────────────────────────────────────────────────────────────
// Built once on first use. The generated file is a few flat arrays; every generator below
// wants them the other way round (word → what it belongs to), and rebuilding that per question
// would be the only slow thing in the module.

let INDEX = null

function index() {
  if (INDEX) return INDEX

  // Two synonym relations, and keeping them apart is the point.
  //
  //   `synonyms`  the dominance-gated one, from SYNSETS — what questions are BUILT from. A
  //               pair here is two words a child would agree mean the same thing.
  //   `kin`       everything WordNet links in any sense at all — what questions are CHECKED
  //               against. Far too loose to ask (`man = piece` is in it), exactly right to
  //               forbid: `catch → get` once shipped with `grab` as a wrong option because
  //               the gated index could not see the sense they share.
  const synonyms = new Map()
  const link = (a, b) => {
    if (!synonyms.has(a)) synonyms.set(a, new Set())
    synonyms.get(a).add(b)
  }
  for (const [, words] of SYNSETS) {
    for (const a of words) for (const b of words) if (a !== b) link(a, b)
  }
  const kin = new Map(Object.entries(KINSHIP).map(([w, list]) => [w, new Set(list)]))

  const antonyms = new Map()
  for (const [a, b] of ANTONYMS) {
    if (!antonyms.has(a)) antonyms.set(a, new Set())
    if (!antonyms.has(b)) antonyms.set(b, new Set())
    antonyms.get(a).add(b)
    antonyms.get(b).add(a)
  }

  // word → categories it sits in, so a distractor can be checked for "is this actually in the
  // group I am claiming it is outside of".
  const catsOf = new Map()
  CATEGORIES.forEach(([key, , members], i) => {
    for (const w of members) {
      if (!catsOf.has(w)) catsOf.set(w, new Set())
      catsOf.get(w).add(i)
    }
    void key
  })

  // Words grouped by their last three letters, for rhyme distractors. `early → hardy` is the
  // book's own trick and it is the one distractor kind that is purely mechanical.
  const byRhyme = new Map()
  for (const w of Object.keys(WORD_Z)) {
    if (w.length < 4) continue
    const k = w.slice(-3)
    if (!byRhyme.has(k)) byRhyme.set(k, [])
    byRhyme.get(k).push(w)
  }

  INDEX = { synonyms, antonyms, catsOf, byRhyme, kin }
  return INDEX
}

const z = (w) => WORD_Z[w] || 0

/**
 * One word wearing two endings: `happy/happily`, `run/running`, `unity/unitary`, `suck/sucking`.
 *
 * Kept apart from `related` because the two answer different questions, and conflating them
 * cost a whole generator: `related` was used to reject a synonym question whose two words were
 * the same word, and since a synonym question's stem and answer come out of ONE synset, every
 * one of them is "related" by definition. The engine produced nothing at all for ninety
 * thousand seeds.
 *
 * WordNet links none of these pairs — it has no morphology — so this is the only thing that
 * catches them.
 */
export function sameWordDifferentEnding(a, b) {
  if (a === b) return true
  const short = a.length <= b.length ? a : b
  const long = a.length <= b.length ? b : a
  if (long.startsWith(short) && long.length - short.length <= 3) return true
  // Near-stems, which the prefix test misses because neither word contains the other: `unity /
  // unitary / unitarian` appeared on one line as three separate options. Four shared opening
  // letters on two words of similar length is one word twice.
  if (short.length >= 5 && a.slice(0, 4) === b.slice(0, 4) && Math.abs(a.length - b.length) <= 4) return true
  return false
}

/**
 * Two words that are not synonyms but keep the same company.
 *
 * WordNet links words to SENSES, and two words can both belong to a third word's senses
 * without ever sharing one of their own. That is not a curiosity, it is the last way a
 * question gets two right answers: asked what `piece` means in "he needed a piece of granite",
 * this answered `part` and offered `bit` and `slice` as mistakes. All three are right. WordNet
 * does not link `bit` to `part` directly, so `related` saw nothing — but all three are
 * neighbours of `piece`, which is exactly what makes them competing readings of it.
 *
 * The measurement is sharp enough to be a rule rather than a threshold: across the pairs on
 * that question, every bad one shared at least one neighbour and every good one shared none
 * (`duck/duration`, `barrel/remark`, `garage/sight` — all zero).
 */
export function sharesNeighbour(a, b) {
  const { kin } = index()
  const ka = kin.get(a)
  const kb = kin.get(b)
  if (!ka || !kb) return false
  const [small, large] = ka.size <= kb.size ? [ka, kb] : [kb, ka]
  for (const w of small) if (large.has(w)) return true
  return false
}

/** Two words a child could defend as meaning the same thing — the relation that makes a
 *  question ambiguous. Deliberately generous: a shared sense in ANY reading counts, and so
 *  does being the same word twice. */
export function related(a, b) {
  if (a === b) return true
  const { synonyms, kin } = index()
  if (synonyms.get(a)?.has(b) || kin.get(a)?.has(b)) return true
  return sameWordDifferentEnding(a, b)
}

// ── building option lists ────────────────────────────────────────────────────────────────

const COMMON_NOUNS_FALLBACK = [
  'garden', 'window', 'pencil', 'bottle', 'jacket', 'kitchen', 'basket', 'letter',
  'corner', 'button', 'ticket', 'pocket', 'village', 'carpet', 'ladder', 'puddle',
]

/** Pull filler words nobody could argue for: common enough to read, unrelated to everything
 *  already on the line. The book uses these too — `medal … b mess c boss` — and they are what
 *  keeps a five-option line from being a two-horse race. */
/** The part of speech of a word's main sense: 'noun', 'verb', 'adj', 'adv'. */
const partOfSpeech = (w) => (WORD_LEX[w] || '').split('.')[0]

function fillers(r, band, avoid, count, like) {
  const { synonyms, antonyms } = index()
  // Fillers share the ANSWER's part of speech. Every options line in the book is one part of
  // speech throughout — `bear` is offered `sit run stand find make`, five verbs — and the
  // reason is not tidiness: a child scanning `needs … teen, seventh, inevitably, capable,
  // want` does not have to know what any of them mean to find the only noun-ish one. A line
  // that mixes classes gives the answer away to whoever is not reading.
  const pos = like ? partOfSpeech(like) : null
  const common = Object.keys(WORD_Z).filter(
    w => z(w) >= band.filler && w.length >= 4 && w.length <= 9
      && (!pos || partOfSpeech(w) === pos))
  // Concreteness is the preference and the part of speech is the requirement, in that order —
  // and the order was learned by getting it wrong. Demanding both starved the verbs: WORD_LEX
  // records one lexical file per word, and of the common words it files as verbs only 34 are
  // in the concrete list against 983 adjectives and 545 nouns. Every sense question with a
  // verb answer failed for want of four verbs to sit beside it, and the type collapsed onto
  // the handful of words with noun answers. Below forty candidates the concrete filter is
  // dropped and frequency carries the line on its own.
  const narrow = common.filter(concrete)
  const pool = narrow.length >= 40 ? narrow : common
  const out = []
  for (let tries = 0; out.length < count && tries < count * 60; tries++) {
    const w = pickOne(r, pool.length ? pool : COMMON_NOUNS_FALLBACK)
    if (!w || avoid.has(w) || out.includes(w)) continue
    if ([...avoid].some(a => related(a, w))) continue
    if ([...avoid].some(a => synonyms.get(w)?.has(a) || antonyms.get(w)?.has(a))) continue
    out.push(w)
  }
  return out
}

/** Assemble the five options, shuffle them, and report where the answers landed. */
function layOut(r, band, answers, distractors) {
  const rows = [
    ...answers.map(text => ({ text, why: null })),
    ...distractors.slice(0, band.options - answers.length),
  ]
  const shuffled = shuffle(r, rows)
  return {
    options: shuffled,
    correct: shuffled.map((o, i) => (o.why === null ? i : -1)).filter(i => i >= 0),
  }
}

const VOWELS = 'aeiou'
const CONSONANTS = 'bcdfghjklmnprstvw'

/** The visible pieces a mask leaves behind, e.g. `as___nt` -> ['as', 'nt'].
 *
 *  Cutting letters out of a word makes new short words out of what is left, and a child reads
 *  what is on the page rather than the word it came from. The engine already refuses to print
 *  a banned word as an option or as an answer; this is the third place one can appear.
 */
const visiblePieces = (masked) => masked.split(/_+/).filter(Boolean)

/**
 * Letter groups that could pass for the right one.
 *
 * The book's wrong answers are never random: for `rhythm` it offers `ithe itit hyth hith itth`
 * — every one of them the same shape as the answer, three or four letters that look like they
 * belong inside an English word. Rolling the alphabet produces `xbo`, `jrm`, `qvk`, which a
 * child eliminates without reading the question, and then five options are really two.
 *
 * So distractors are built FROM the answer: swap two of its letters, move a vowel, replace one
 * letter with another of the same kind. Each is checked against the blank it goes in — a group
 * that also makes a real word would be a second right answer, which validateItem would catch
 * anyway, but catching it here means the item is not thrown away for it.
 */
function plausibleLetters(r, truth, fits, count) {
  const out = []
  const seen = new Set([truth])
  const swap = (s, i, j) => {
    const a = s.split('')
    ;[a[i], a[j]] = [a[j], a[i]]
    return a.join('')
  }
  const moves = [
    () => (truth.length > 1 ? swap(truth, 0, truth.length - 1) : truth),
    () => (truth.length > 2 ? swap(truth, 1, 2) : truth),
    () => {
      const i = Math.floor(r() * truth.length)
      const bank = VOWELS.includes(truth[i]) ? VOWELS : CONSONANTS
      return truth.slice(0, i) + bank[Math.floor(r() * bank.length)] + truth.slice(i + 1)
    },
    () => {
      const i = Math.floor(r() * truth.length)
      const bank = VOWELS.includes(truth[i]) ? CONSONANTS : VOWELS
      return truth.slice(0, i) + bank[Math.floor(r() * bank.length)] + truth.slice(i + 1)
    },
  ]
  for (let tries = 0; out.length < count && tries < 400; tries++) {
    const cand = pickOne(r, moves)()
    if (!cand || cand.length !== truth.length || seen.has(cand)) continue
    if (BANNED.has(cand) || fits(cand)) continue
    seen.add(cand)
    out.push({ text: cand, why: 'not-a-word' })
  }
  return out
}

// ── generators ───────────────────────────────────────────────────────────────────────────
//
// Each returns an item or null. Null is normal and cheap: a generator that cannot find a clean
// question for the seed it was given says so, and generateSession asks again with the next
// seed. Nothing here settles for a question it had to bend a rule to build.

function genSynonym(r, band, seed) {
  const { antonyms, byRhyme } = index()
  const usable = SYNSETS.filter(([, ws]) => ws.filter(w => z(w) >= band.answer).length >= 2)
  if (!usable.length) return null
  const [, words] = pickOne(r, usable)
  const good = shuffle(r, words.filter(w => z(w) >= band.answer))
  const [stem, answer] = good
  if (!stem || !answer) return null
  // `suck / sucking` came out of one synset and made a question with no content. The lexicon
  // already drops spelling variants and plurals; this catches the rest of the same word wearing
  // a different ending, which only shows up once two of a synset's words are picked together.
  // NOT `related` — see its note: in a synonym question the stem and the answer are related by
  // construction, and using it here silenced the generator entirely.
  if (sameWordDifferentEnding(stem, answer)) return null

  const avoid = new Set([stem, answer])
  const distractors = []

  // The book's favourite trap, and the honest one: the opposite of the word. A child who has
  // the right idea and the wrong direction picks this, and that is worth knowing about.
  const opp = [...(antonyms.get(stem) || [])].filter(w => z(w) >= band.option && !related(w, answer))
  if (opp.length) { const w = pickOne(r, opp); distractors.push({ text: w, why: 'opposite' }); avoid.add(w) }

  // The book's other trap: something that sounds like the stem. `early … e hardy`.
  const rhymes = (byRhyme.get(stem.slice(-3)) || [])
    .filter(w => w !== stem && z(w) >= band.option && !related(w, stem) && !related(w, answer))
  if (rhymes.length) { const w = pickOne(r, rhymes); distractors.push({ text: w, why: 'rhyme' }); avoid.add(w) }

  for (const w of fillers(r, band, avoid, band.options - 1 - distractors.length, answer)) {
    distractors.push({ text: w, why: 'unrelated' })
  }
  if (distractors.length < band.options - 1) return null

  return {
    seed, band: null, type: 'synonym', stem_key: STEM_KEYS.synonym,
    prompt: { word: stem },
    ...layOut(r, band, [answer], distractors),
    pick: 1,
    rule: { kind: 'synonym', of: stem },
  }
}

function genAntonym(r, band, seed) {
  const { synonyms, byRhyme } = index()
  const pairs = ANTONYMS.filter(([a, b]) => z(a) >= band.answer && z(b) >= band.answer)
  if (!pairs.length) return null
  const [a, b] = pickOne(r, pairs)
  const [stem, answer] = r() < 0.5 ? [a, b] : [b, a]

  const avoid = new Set([stem, answer])
  const distractors = []

  // For an OPPOSITE question the trap is a word that means the SAME — the book does this every
  // time it can: `difficult … a tricky b complex`. A child reading the instruction too fast
  // picks it, which is a different mistake from not knowing the word.
  const same = [...(synonyms.get(stem) || [])].filter(w => z(w) >= band.option && !related(w, answer))
  if (same.length) { const w = pickOne(r, same); distractors.push({ text: w, why: 'same-meaning' }); avoid.add(w) }

  const rhymes = (byRhyme.get(stem.slice(-3)) || [])
    .filter(w => w !== stem && z(w) >= band.option && !related(w, stem) && !related(w, answer))
  if (rhymes.length) { const w = pickOne(r, rhymes); distractors.push({ text: w, why: 'rhyme' }); avoid.add(w) }

  for (const w of fillers(r, band, avoid, band.options - 1 - distractors.length, answer)) {
    distractors.push({ text: w, why: 'unrelated' })
  }
  if (distractors.length < band.options - 1) return null

  return {
    seed, band: null, type: 'antonym', stem_key: STEM_KEYS.antonym,
    prompt: { word: stem },
    ...layOut(r, band, [answer], distractors),
    pick: 1,
    rule: { kind: 'antonym', of: stem },
  }
}

function genSense(r, band, seed) {
  // The book's most-asked question, and the one WordNet was made for: a polysemous word comes
  // with a sentence per sense AND the synonyms of each sense, so the question, its answer and
  // its distractors are one lookup. Nothing is hand-written and nothing is guessed.
  const words = Object.keys(SENSES).filter(
    w => z(w) >= band.stem && z(w) <= band.stemMax && SENSES[w].length >= 2)
  if (!words.length) return null
  const word = pickOne(r, words)
  const senses = SENSES[word]

  const withAnswer = senses.filter(s => s[2].some(x => z(x) >= band.answer))
  if (!withAnswer.length) return null
  const chosenIndex = senses.indexOf(pickOne(r, withAnswer))
  const chosen = senses[chosenIndex]
  const [, sentence, syns, definition, far] = chosen
  const answer = pickOne(r, syns.filter(x => z(x) >= band.answer))
  // "What does `listed` mean?" answered `list` is not a question about meaning, it is the same
  // word with its ending taken off.
  //
  // `sameWordDifferentEnding` and NOT `related` — the same mistake this file already made once
  // in genSynonym, made again here and caught by counting where the candidates went: 395 of
  // 535 words died on this line. A sense question's answer shares a sense with the word by
  // definition, because that shared sense IS the answer, so `related` rejects every question
  // the type can ask. The two tests are one line apart and they are opposites: one asks "are
  // these the same word", the other "do these mean the same thing", and only the first is a
  // reason to throw the question away.
  if (sameWordDifferentEnding(answer, word)) return null

  const avoid = new Set([word, answer])
  const distractors = []
  // Another sense of the same word — but only one the lexicon marks as FAR from this one.
  // That restriction is the whole correctness of the type. Every sense of a word is a thing
  // the word means, so a near sense is not a wrong answer, it is a second right one: asked
  // what `protection` meant in "a sense of peace and protection in his new home", this offered
  // `shelter` as the answer and `security` as a mistake. `far` is built in the lexicon from
  // Wu-Palmer distance; see scripts/english/build_lexicon.py.
  for (const j of shuffle(r, far || [])) {
    const other = senses[j]
    if (!other || other === chosen) continue
    {
      for (const cand of shuffle(r, other[2])) {
        if (z(cand) < band.option || avoid.has(cand)) continue
        if (related(cand, answer) || sharesNeighbour(cand, answer)) continue
        distractors.push({ text: cand, why: 'other-sense' })
        avoid.add(cand)
        break
      }
    }
    if (distractors.length >= band.options - 2) break
  }
  for (const w of fillers(r, band, avoid, band.options - 1 - distractors.length, answer)) {
    distractors.push({ text: w, why: 'unrelated' })
  }
  if (distractors.length < band.options - 1) return null

  return {
    seed, band: null, type: 'sense', stem_key: STEM_KEYS.sense,
    prompt: { word, sentence },
    ...layOut(r, band, [answer], distractors),
    pick: 1,
    rule: { kind: 'sense', of: word, definition },
  }
}

function genOddTwo(r, band, seed) {
  const { catsOf } = index()
  // Concrete members only. WordNet's hypernym tree is full of groups a child cannot see —
  // `measure / step / parking` really do share an ancestor, and nobody nine years old is going
  // to find it. A group question is only a question when the group is one you could point at.
  // Nouns only, at the answer bar. Two corrections, in the order they were found.
  //
  // NOUNS: `temporary` sat in a line of workers, because WordNet has a noun sense for it and
  // the concrete list admits adjectives for the option lines elsewhere. A group of things is a
  // group of nouns.
  //
  // THE BAR: this was raised to the filler bar first, to keep `incumbent` and `diplomat` away
  // from `mouse, squirrel, rat`, and that left nine usable groups and 29 distinct answers in
  // three hundred questions — a child would meet the same five words in a week. The book does
  // not hold its own lines that high: `lamb calf foal donkey pig` has `foal` at Zipf 2.8. At
  // the answer bar there are 25 groups and 115 words, and they read like the book's: pizza /
  // curry / soup / salad, mouse / rat / squirrel, breakfast / lunch / dinner.
  const inGroup = (c) => c[2].filter(
    w => z(w) >= band.answer && concrete(w) && (WORD_LEX[w] || '').startsWith('noun.'))
  const usable = CATEGORIES
    .map((c, i) => [i, c])
    .filter(([, c]) => inGroup(c).length >= 3)
  if (!usable.length) return null
  const [inIdx, inCat] = pickOne(r, usable)
  const inside = shuffle(r, inGroup(inCat)).slice(0, 3)

  // The two outsiders share a category with EACH OTHER. Picked at random they read as two
  // strays and the question answers itself; the book's own line is `lamb calf foal donkey pig`,
  // where the odd two are both animals and it is the "young" that separates them.
  const outsiders = (c) => inGroup(c).filter(w => !catsOf.get(w)?.has(inIdx))
  const others = usable.filter(([i, c]) => i !== inIdx && outsiders(c).length >= 2)
  if (!others.length) return null
  const [, outCat] = pickOne(r, others)
  const outside = shuffle(r, outsiders(outCat)).slice(0, 2)
  if (outside.length < 2 || inside.length < 3) return null
  if (inside.some(w => outside.includes(w))) return null

  const rows = shuffle(r, [
    ...inside.map(text => ({ text, why: 'same-group' })),
    ...outside.map(text => ({ text, why: null })),
  ])
  return {
    seed, band: null, type: 'odd-two', stem_key: STEM_KEYS['odd-two'],
    prompt: {},
    options: rows,
    correct: rows.map((o, i) => (o.why === null ? i : -1)).filter(i => i >= 0),
    pick: 2,
    rule: { kind: 'category', group: inCat[1], outsiders: outCat[1] },
  }
}

function genWordGrid(r, band, seed) {
  // The book's grid: twelve words in a 4 × 3 block, and a question that wants TWO of them.
  // Everything that is not an answer has to be safely unrelated to the target AND to the two
  // answers, because a grid gives the child twelve chances to find a second right answer.
  const { synonyms, antonyms } = index()
  const wantOpposite = r() < 0.5

  let target = null
  let answers = null
  const source = wantOpposite ? antonyms : synonyms
  const candidates = [...source.keys()].filter(w => z(w) >= band.stem && z(w) <= band.stemMax)
  for (let tries = 0; tries < 40 && !answers; tries++) {
    const w = pickOne(r, candidates)
    const hits = [...(source.get(w) || [])].filter(x => z(x) >= band.answer)
    if (hits.length >= 2) {
      target = w
      answers = shuffle(r, hits).slice(0, 2)
    }
  }
  if (!answers) return null

  const avoid = new Set([target, ...answers])
  // Anything a child could argue for is a second answer, so the filler test is the union of
  // both relations, in both directions.
  const clash = (w) => related(w, target)
    || answers.some(a => related(w, a))
    || synonyms.get(target)?.has(w) || antonyms.get(target)?.has(w)
  const filler = []
  const pool = Object.keys(WORD_Z).filter(
    w => z(w) >= band.filler && concrete(w) && w.length >= 3 && w.length <= 9)
  for (let tries = 0; filler.length < band.gridSize - 2 && tries < 2000; tries++) {
    const w = pickOne(r, pool)
    if (!w || avoid.has(w) || filler.includes(w) || clash(w)) continue
    filler.push(w)
    avoid.add(w)
  }
  if (filler.length < band.gridSize - 2) return null

  const cells = shuffle(r, [
    ...answers.map(text => ({ text, why: null })),
    ...filler.map(text => ({ text, why: 'unrelated' })),
  ])
  return {
    seed, band: null, type: 'word-grid', stem_key: STEM_KEYS['word-grid'],
    prompt: { word: target, opposite: wantOpposite },
    options: cells,
    correct: cells.map((o, i) => (o.why === null ? i : -1)).filter(i => i >= 0),
    pick: 2,
    rule: { kind: wantOpposite ? 'grid-opposite' : 'grid-similar', of: target },
  }
}

function genLetterPair(r, band, seed) {
  // `tired  sl__py` — the book's Test 5. A meaning question and a spelling question at once,
  // and it needs no sentence, which is why it is in the first set of types.
  const { synonyms, antonyms } = index()
  const wantOpposite = r() < 0.5
  const source = wantOpposite ? antonyms : synonyms
  const keys = [...source.keys()].filter(w => z(w) >= band.stem && z(w) <= band.stemMax)
  if (!keys.length) return null

  let stem = null
  let answer = null
  for (let tries = 0; tries < 60 && !answer; tries++) {
    const w = pickOne(r, keys)
    const hits = [...(source.get(w) || [])]
      .filter(x => z(x) >= band.answer && x.length >= 5 && x.length <= 10)
    if (hits.length) { stem = w; answer = pickOne(r, hits) }
  }
  if (!answer) return null

  // Leave at least three letters showing. `foremost → f___t` is not a question: three of the
  // five letters of `first` are gone and what is left fits a dozen words. The book never takes
  // more than half — `tired → sl__py` hides two of six.
  const maskLen = pickOne(r, band.mask.filter(m => answer.length - m >= 3 && m < answer.length - 1))
  if (!maskLen) return null
  // Never mask the first letter: the book always leaves it, and without it the child is not
  // completing a word, they are guessing one.
  const at = 1 + Math.floor(r() * (answer.length - maskLen - 1))
  const masked = answer.slice(0, at) + '_'.repeat(maskLen) + answer.slice(at + maskLen)
  const truth = answer.slice(at, at + maskLen)
  // The RIGHT answer can spell something too, and it is the one option a child is certain to
  // read: `speech` hides `pee`, `classic` hides `ass`, `beginning` hides `gin`. Screening the
  // distractors was not enough.
  if (BANNED.has(truth) || visiblePieces(masked).some(p => BANNED.has(p))) return null

  // Distractors are letter groups, not words, so the only test that matters is that no other
  // option also produces a real word in the blank — otherwise the item has two answers.
  const alts = plausibleLetters(
    r, truth,
    (cand) => (answer.slice(0, at) + cand + answer.slice(at + maskLen)) in WORD_Z,
    band.options - 1)
  if (alts.length < band.options - 1) return null

  return {
    seed, band: null, type: 'letter-pair', stem_key: STEM_KEYS['letter-pair'],
    prompt: { word: stem, masked, opposite: wantOpposite },
    ...layOut(r, band, [truth], alts),
    pick: 1,
    rule: { kind: wantOpposite ? 'letters-opposite' : 'letters-similar', of: stem, answer },
  }
}

// Every three-letter middle that two different words share, with where it sits in each.
//
// Memoised per band, and it has to be. The index runs over roughly four thousand words and
// genSharedLetters was rebuilding it on EVERY call. That was invisible while the audit asked
// for three hundred questions per type, and became the slowest thing in the module the first
// time anything asked for sixty thousand — the only generator whose cost did not scale with
// the number of questions but with the number of questions times the size of the lexicon.
// The server will be generating sittings back to back.
//
// Both host words are printed and both are read, so they are held to the readable bar like an
// odd-two line rather than the answer bar: `ideology / theology` share `eol` and share nothing
// a nine-year-old has met.
const SHARED_INDEX = new Map()

function sharedLetterIndex(band) {
  const key = String(band.filler)
  if (SHARED_INDEX.has(key)) return SHARED_INDEX.get(key)
  const maskLen = 3
  const words = Object.keys(WORD_Z).filter(w => z(w) >= band.filler && w.length >= 5 && w.length <= 9)
  // Index every word by (prefix, suffix) around a hidden middle of maskLen letters; any two
  // words sharing a middle are a question.
  const byMiddle = new Map()
  for (const w of words) {
    for (let at = 1; at + maskLen < w.length; at++) {
      const mid = w.slice(at, at + maskLen)
      if (!byMiddle.has(mid)) byMiddle.set(mid, [])
      byMiddle.get(mid).push([w, at])
    }
  }
  const usable = [...byMiddle.entries()].filter(([, list]) =>
    new Set(list.map(([w]) => w)).size >= 2)
  SHARED_INDEX.set(key, usable)
  return usable
}

function genSharedLetters(r, band, seed) {
  const maskLen = 3
  const usable = sharedLetterIndex(band)
  if (!usable.length) return null

  const [truth, list] = pickOne(r, usable)
  if (BANNED.has(truth)) return null
  const chosen = []
  for (const [w, at] of shuffle(r, list)) {
    if (chosen.some(c => c.word === w || related(c.word, w))) continue
    const masked = w.slice(0, at) + '_'.repeat(maskLen) + w.slice(at + maskLen)
    if (visiblePieces(masked).some(x => BANNED.has(x))) continue
    chosen.push({ word: w, masked })
    if (chosen.length === 2) break
  }
  if (chosen.length < 2) return null

  // Has to fail in BOTH blanks — a group that completes one of the two words is a real second
  // answer to half the question, and reads to the child as a mistake in the question.
  const alts = plausibleLetters(
    r, truth,
    (cand) => chosen.some(c => c.masked.replace('_'.repeat(maskLen), cand) in WORD_Z),
    band.options - 1)
  if (alts.length < band.options - 1) return null

  return {
    seed, band: null, type: 'shared-letters', stem_key: STEM_KEYS['shared-letters'],
    prompt: { blanks: chosen.map(c => c.masked) },
    ...layOut(r, band, [truth], alts),
    pick: 1,
    rule: { kind: 'shared-letters', words: chosen.map(c => c.word) },
  }
}

function genHiddenWord(r, band, seed) {
  // "The tooth fairy had placed a coin under her pil___." — and the three letters that go in
  // are themselves a word (`low`). Two conditions at once, which is what makes it the book's
  // hardest letter type, and the sentence is what tells the child which word is wanted.
  const three = new Set(Object.keys(WORD_Z).filter(
    w => w.length === 3 && z(w) >= band.option && !BANNED.has(w)))
  // The host has to be a concrete word, not merely a readable one. Every word in "the bipolar
  // distribution of certain species" clears the frequency bar and the sentence still means
  // nothing to a nine-year-old; `bipolar` is what put it there. A sentence about a thing tends
  // to be a sentence a child can picture.
  const hosts = Object.keys(EXAMPLES).filter(
    w => z(w) >= band.answer && concrete(w) && w.length >= 6 && w.length <= 11)
  if (!hosts.length) return null

  const found = []
  for (const w of shuffle(r, hosts).slice(0, 400)) {
    for (let at = 1; at + 3 < w.length; at++) {
      const mid = w.slice(at, at + 3)
      if (three.has(mid)) found.push([w, at, mid])
    }
    if (found.length > 30) break
  }
  if (!found.length) return null
  const [word, at, truth] = pickOne(r, found)
  if (BANNED.has(truth) || BANNED.has(word)) return null
  if (visiblePieces(word.slice(0, at) + '___' + word.slice(at + 3)).some(p => BANNED.has(p))) return null

  const sentence = EXAMPLES[word]
  // The builder screens every sentence, but it screens them as strings and this one is about
  // to have a hole cut in it — belt and braces on the one path where the text is rewritten.
  if ((sentence.toLowerCase().match(/[a-z']+/g) || []).some(w => BANNED.has(w))) return null
  const masked = word.slice(0, at) + '___' + word.slice(at + 3)
  // The sentence has the whole word in it — blank that out too or the question answers itself.
  const blanked = sentence.replace(new RegExp(`\\b${word}\\b`, 'i'), masked)
  if (blanked === sentence) return null

  const avoid = new Set([truth])
  const alts = []
  // Distractors are real three-letter WORDS, as the book's are — the child is choosing between
  // words, and the test is which one also completes the longer one.
  for (const cand of shuffle(r, [...three])) {
    if (alts.length >= band.options - 1) break
    if (avoid.has(cand)) continue
    if ((word.slice(0, at) + cand + word.slice(at + 3)) in WORD_Z) continue
    avoid.add(cand)
    alts.push({ text: cand, why: 'not-a-word' })
  }
  if (alts.length < band.options - 1) return null

  return {
    seed, band: null, type: 'hidden-word', stem_key: STEM_KEYS['hidden-word'],
    prompt: { sentence: blanked, masked },
    ...layOut(r, band, [truth], alts),
    pick: 1,
    rule: { kind: 'hidden-word', word },
  }
}

const GENERATORS = {
  synonym: genSynonym,
  antonym: genAntonym,
  sense: genSense,
  'odd-two': genOddTwo,
  'word-grid': genWordGrid,
  'letter-pair': genLetterPair,
  'shared-letters': genSharedLetters,
  'hidden-word': genHiddenWord,
}

// ── validation ───────────────────────────────────────────────────────────────────────────

/**
 * Returns a string naming the problem, or null when the item is sound.
 *
 * This is the counterpart to the puzzle engine's validateQuestion, and it exists for the same
 * reason in a different medium. There, the danger was two options that DRAW the same. Here it
 * is two options that MEAN the same — and the lexicon hands us those unprompted: asked for
 * distractors for `question` (answer `query`) it will happily offer `answer` and `reply`.
 *
 * Every generator above is written not to do that. This runs anyway, on every item, because
 * the generators reason about the relation they used and this reasons about all of them.
 */
export function validateItem(item) {
  if (!item) return 'no item'
  const texts = item.options.map(o => o.text)
  if (new Set(texts).size !== texts.length) return 'duplicate option'
  if (!item.correct.length) return 'no correct option'
  if (item.correct.length !== item.pick) return `pick ${item.pick} but ${item.correct.length} correct`
  if (item.options.some(o => !o.text)) return 'empty option'

  const answers = item.correct.map(i => texts[i])
  const wrong = texts.filter((_, i) => !item.correct.includes(i))

  // A wrong option that means the same as a right one is a second right answer.
  if (item.type === 'synonym' || item.type === 'sense' || item.type === 'word-grid') {
    for (const w of wrong) {
      for (const a of answers) {
        if (related(w, a)) return `"${w}" is a synonym of the answer "${a}"`
        if (sharesNeighbour(w, a)) return `"${w}" keeps the same company as the answer "${a}"`
      }
    }
  }
  // Same test for the stem itself: an option that means what the QUESTION word means is either
  // the answer or a broken distractor, never a clean wrong one.
  if (item.type === 'synonym') {
    for (const w of wrong) if (related(w, item.prompt.word)) return `"${w}" also means "${item.prompt.word}"`
  }
  if (item.type === 'antonym') {
    const { antonyms } = index()
    for (const w of wrong) {
      if (antonyms.get(item.prompt.word)?.has(w)) return `"${w}" is also an opposite of "${item.prompt.word}"`
    }
  }
  if (item.type === 'word-grid') {
    const { synonyms, antonyms } = index()
    const source = item.prompt.opposite ? antonyms : synonyms
    for (const w of wrong) {
      if (source.get(item.prompt.word)?.has(w)) return `grid filler "${w}" is also an answer`
    }
  }
  if (item.type === 'odd-two') {
    const { catsOf } = index()
    const insiders = texts.filter((_, i) => !item.correct.includes(i))
    const shared = insiders
      .map(w => catsOf.get(w) || new Set())
      .reduce((acc, s) => (acc === null ? new Set(s) : new Set([...acc].filter(x => s.has(x)))), null)
    if (!shared || !shared.size) return 'the three "same" words share no category'
    // And the outsiders must not be in it, or the question has four or five right answers.
    for (const a of answers) {
      for (const c of shared) if (catsOf.get(a)?.has(c)) return `"${a}" is in the group too`
    }
  }
  // For the letter types the test is mechanical and absolute: exactly one option may produce a
  // real word in the blank.
  if (item.type === 'letter-pair' || item.type === 'hidden-word') {
    const masked = item.prompt.masked
    const hits = texts.filter(t => masked.replace(/_+/, t) in WORD_Z)
    if (hits.length !== 1) return `${hits.length} options complete the word (${hits.join(', ')})`
  }
  if (item.type === 'shared-letters') {
    for (const blank of item.prompt.blanks) {
      const hits = texts.filter(t => blank.replace(/_+/, t) in WORD_Z)
      if (hits.length !== 1) return `${hits.length} options complete "${blank}"`
    }
  }
  if (item.type === 'sense') {
    if (!item.prompt.sentence.toLowerCase().includes(item.prompt.word.toLowerCase())) {
      return 'the sentence does not contain the word'
    }
  }
  return null
}

// ── public generation ────────────────────────────────────────────────────────────────────

export function generateItem(bandKey, type, seed, opts = {}) {
  const band = BANDS[bandKey]
  if (!band) return null
  const r = rng(seed)
  const kinds = type ? [type] : (opts.types || band.types)
  const kind = type || pickOne(r, kinds)
  const gen = GENERATORS[kind]
  if (!gen) return null
  const item = gen(r, band, seed)
  if (!item) return null
  item.band = bandKey
  // An item that fails its own check is discarded, never shown and never patched up. Same
  // contract as the puzzle engine: the caller asks again with another seed.
  if (validateItem(item)) return null
  return item
}

/** What makes two items "the same question" for the purposes of not asking it twice. */
export function itemSignature(item) {
  const key = item.prompt.word || item.rule.word || (item.prompt.blanks || []).join('|')
    || item.prompt.sentence || ''
  return `${item.type}:${key}:${item.correct.map(i => item.options[i].text).sort().join('+')}`
}

/** The word or group an item is ABOUT, so one sitting does not circle the same idea. */
function topicKey(item) {
  if (item.rule.kind === 'category') return `cat:${item.rule.group}`
  return item.prompt.word ? `w:${item.prompt.word}` : null
}

const PER_TYPE = 3

export function generateSession(bandKey, count = 10, seed = Date.now(), opts = {}) {
  const band = BANDS[bandKey]
  if (!band) return []
  const out = []
  const seen = new Set()
  const topics = new Set()
  const perType = {}
  // Two passes, as the puzzle engine does: the first holds the per-type and per-topic caps so a
  // sitting is varied, the second drops them rather than return a short sitting.
  for (const capped of [true, false]) {
    for (let i = 0; out.length < count && i < count * 60; i++) {
      const item = generateItem(bandKey, null, (seed + i * 104729) | 0, opts)
      if (!item) continue
      const sig = itemSignature(item)
      if (seen.has(sig)) continue
      const topic = topicKey(item)
      if (capped && (perType[item.type] || 0) >= PER_TYPE) continue
      if (capped && topic && topics.has(topic)) continue
      seen.add(sig)
      if (topic) topics.add(topic)
      perType[item.type] = (perType[item.type] || 0) + 1
      out.push(item)
    }
  }
  return out
}

export { LEXICON_META, WORD_Z }
