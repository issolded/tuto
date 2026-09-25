// Question generation for the English module (verbal reasoning, no comprehension passages).
//
// Modelled on Bond 11+ English and Verbal Reasoning 10 Minute Tests 8-9 (Michellejoy Hughes),
// the way src/lib/puzzleTemplates.js is modelled on the Bond non-verbal papers — and built the
// same way: a generator per question TYPE over one shared vocabulary. Five bands now, one per
// Bond book: 7-8 (Verbal Reasoning Assessment Papers), 8-9 (English and Verbal Reasoning 10
// Minute Tests), 9-10 (English Assessment Papers), 10-11 (English Assessment Papers + the 11+
// Multiple-choice Pack) and 11-12 (10 Minute Tests English). Each band names its own types —
// the books are different subjects, not one subject at five levels (see WORD_TYPES).
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
  SYLLABLES, RIMES, RHYME_GROUPS, HOMOPHONES, SPELLING, SUFFIXED, PREFIXED, PLURALS, PASTS,
  DEFINITIONS, FAMILIAR, LEXICON_META,
} from './englishLexicon.generated.js'
import {
  RELATIONS, LOGIC_SCENES, ORDER_SCENES, NAMES, POSSESSIVES, MISSPELLINGS, CONTRACTIONS,
  HOMOPHONE_SETS, HOMOPHONE_CLOZE, GRAMMAR_CLOZE, COMPARATIVES, GENDER_PAIRS, COLLECTIVES,
  PROVERBS, SILENT_PATTERNS, ENDING_GROUPS, RHYME_CLUES, PAIR_SYNONYMS, PAIR_ANTONYMS,
  SYNONYM_GROUPS, GRID_OPPOSITES, SENSE_ANSWERS,
} from './englishTables.js'

const CONCRETE = new Set([
  'noun.animal', 'noun.artifact', 'noun.body', 'noun.food', 'noun.object', 'noun.plant',
  'noun.substance', 'noun.person', 'noun.shape', 'noun.feeling', 'noun.time', 'noun.quantity',
  'verb.motion', 'verb.contact', 'verb.consumption', 'verb.body', 'verb.perception',
  'verb.creation', 'verb.competition', 'verb.emotion', 'adj.all',
])

const concrete = (w) => CONCRETE.has(WORD_LEX[w])

// ── how familiar a word has to be ─────────────────────────────────────────────────────────
//
// Frequency cannot see age. `policy`, `research`, `analysis`, `development` and `security` are
// all commoner than `pillow`, and all of them were reaching the 8-9 band as the word a child
// is asked about. What they have in common is register, not rarity: they are the vocabulary of
// work and the news.
//
// Two lists together decide it. Dale-Chall is the age anchor — 2471 of this lexicon's words
// are on it, known to 80% of nine- and ten-year-olds — and the concrete lexical files are the
// other half, because `tortoise`, `bicycle` and `saucepan` are words a child knows that a
// list of 2942 could never hold all of. A word that is neither is a word about an abstraction
// somebody else cares about.
//
// Measured against the youngest band before this existed: 49% of the words it printed were
// outside Dale-Chall, and reading the list showed why — `president`, `policy`, `technology`,
// `contract`, `percent`, `analysis`.
const FAMILIAR_SET = new Set(FAMILIAR)

// `concrete` minus `adj.all`, which is 5,700 adjectives and admits `pending`, `inclined`,
// `tremendous` and `vexatious` along with `happy` and `quick`. A noun can earn its place by
// being a thing — `tortoise`, `bicycle`, `saucepan` — but an adjective has no such test, so an
// adjective has to be on Dale-Chall or it is not a word this band asks about.
const FAMILIAR_LEX = new Set([...CONCRETE].filter(x => x !== 'adj.all'))
const familiar = (w) => FAMILIAR_SET.has(w) || FAMILIAR_LEX.has(WORD_LEX[w])



// ── which English ─────────────────────────────────────────────────────────────────────────
//
// Not a language — the child's language is already an axis, and this is a third one. Two
// things move with it and only one of them is obvious.
//
// SPELLING is the obvious one: a child in the United States writes `color`, and in the types
// where spelling is the answer — suffix, plural, past tense, missing vowel — the module would
// mark the spelling they were taught as the mistake.
//
// SOUND is the one that actually changes the answers. `calm` rhymes with `arm` in British and
// not in American; `bath` rhymes with `math` in American and not in British; `flaw` and
// `floor` are homophones in British, `oar` and `ore` in American. Measured over this lexicon,
// 880 words (5%) rhyme differently, and British has 49 homophone groups American does not
// against 9 the other way. A rhyme question generated in the wrong variety does not look
// wrong — it looks like a question with no right answer on the page.
//
// The default is British because all three books are, the 11+ is a British exam, and every
// band threshold was measured against them. It is a default, not an assumption.
export const VARIETIES = ['uk', 'us']
export const DEFAULT_VARIETY = 'uk'

/** The spelling of a word in the given variety — itself, unless it is one of the 87 pairs. */
export const spell = (w, variety) => (SPELLING[w] ? SPELLING[w][variety] : w)

/** True when this word is spelled the other way round in this variety, so it must not appear. */
const wrongSpelling = (w, variety) => !!SPELLING[w] && SPELLING[w][variety] !== w

// The blocklist at runtime, not only at build time. Everything drawn FROM the lexicon is
// already clean — the builder never put a blocked word in it. The letter types do not draw
// from the lexicon: they assemble three letters, and three letters spell something unfortunate
// about once in every three hundred items. The audit found `ass`, `pee`, `tit`, `hoe` and
// `gin` sitting in options lists, each one a letter group that happened to be a word.
const BANNED = new Set([...BLOCKED, 'imprisoned'])

// Words that make an example SENTENCE unsuitable although each is fine on its own. The build
// screens sentences against scripts/english/sentence-topics.txt; these were found after the
// last build — "they dug a pit to bury the body" reached a nine-year-old as the sentence for
// `pit` — and are also in that file, so the next build drops the sentences at source.
const DARK_SENTENCE = new Set(['bury', 'buried', 'burial', 'burying', 'smoking'])
const DARK_SENTENCE_PATTERNS = [
  /\bclinton\b/i, /\brepublican party\b/i, /\bjob applicants?\b/i,
  /\bfather children\b/i, /\bdon't recognize them\b/i,
  /\bgood husband for your daughter\b/i, /\bsuitable for their son\b/i,
  /\bproblem children\b/i, /\bburden of proof\b/i, /\bprosecution\b/i,
  /\bearthquake losses?\b/i, /\bhard left to the chin\b/i,
]
const BAD_SENSE_PAIRS = new Set([
  'club|nine', 'load|laden', 'bad|tough', 'heart|spirit', 'screen|sieve',
])
// Every available sentence for these stems is either misleading without its wider context or
// unsuitable for a child-facing bank. Keeping the whole stem out is safer than playing
// whack-a-mole with one answer while another synonym from the same sense remains.
const BAD_SENSE_WORDS = new Set(['club'])
// Generated definition records whose dominant lemma/POS does not match the stored gloss, or
// whose gloss is unsuitable for the child-facing bank. Examples: `despite` received the noun
// definition of spite; `swept` received "sweep across"; `centre` received a French place sense.
const BAD_DEFINITION_WORDS = new Set([
  'bipolar', 'boyfriend', 'centre', 'despite', 'few', 'progressive', 'psycho',
  'swept', 'united', 'viii', 'willing', 'written', 'years',
])
// WordNet records every attested inflection, including specialist senses and alternative
// plurals. Those are not automatically fair "write the plural" questions: `fish/fishes`,
// `penny/pence` and `index/indexes` all have another defensible answer, while `infos` and
// `beefs` are sense shifts rather than primary-school spelling rules.
const BAD_PLURAL_WORDS = new Set([
  'beef', 'fish', 'fry', 'hash', 'index', 'info', 'may', 'money', 'nobody', 'penny',
  'polish', 'say', 'security', 'somebody', 'staff', 'stuff', 'trash',
])
// `beaten` is a participle, not the simple past of `beat`; `might` is not a mechanical past
// tense of modal `may` in the sense this question tests.
const BAD_PAST_WORDS = new Set(['beat', 'may'])
// Generated derivations can share spelling without being a teachable base+suffix relation.
const BAD_SUFFIX_PAIRS = new Set(['tense|tensor'])
// A bare base is not a fair prefix question when the table itself gives it two answers.
// `dislike` is the opposite of the verb `like`; `unlike` belongs to a different sense/POS.
// Without a sentence the child cannot know which relation the generator selected.
const PREFIXES_BY_BASE = new Map()
for (const [base, whole, prefix] of PREFIXED) {
  const variants = PREFIXES_BY_BASE.get(base) || new Set()
  variants.add(`${whole}|${prefix}`)
  PREFIXES_BY_BASE.set(base, variants)
}
const AMBIGUOUS_PREFIX_BASES = new Set(
  [...PREFIXES_BY_BASE].filter(([, variants]) => variants.size > 1).map(([base]) => base),
)
const sentenceProblem = (sentence) => {
  const dark = (sentence.toLowerCase().match(/[a-z]+/g) || []).find(w => DARK_SENTENCE.has(w))
  if (dark) return `the sentence is about "${dark}"`
  if (DARK_SENTENCE_PATTERNS.some(re => re.test(sentence))) {
    return 'the sentence has an unsuitable topic'
  }
  return null
}

// The lexical files a filler option may come from. WordNet sorts every sense into one of 45 of
// these, and the split that matters here is not part of speech but whether a nine-year-old has
// ever met the word. The first build drew fillers from the whole list at Zipf 2.8 and produced
// lines like `medal … demography … dilution … parameter`: five options, four of which a child
// cannot read, which tests nothing and teaches nothing. What is left in is the concrete half —
// things, animals, food, plants, bodies, places, feelings — plus the verbs of doing and moving.

// The verbal-reasoning family — the Bond 8-9 book's taxonomy, which is what this engine was
// built from.
export const VR_TYPES = [
  'synonym', 'antonym', 'sense', 'odd-two', 'word-grid',
  'letter-pair', 'shared-letters', 'hidden-word',
]

// The word-knowledge family, from the 9-10 and 11-12 books.
//
// These are a different SUBJECT, not a harder version of the same one, and that is the single
// most important thing to know about this file now. The 8-9 book is called "English and Verbal
// Reasoning" and asks about relationships between words. The 9-10 book is an "Assessment
// Papers English" and the 11-12 book a "10 Minute Tests English": both are grammar, spelling
// and word formation — plurals, suffixes, root words, rhyme, homophones, parts of speech.
//
// So the claim this engine opened with, that the types do not change with age and only the
// dial does, is false across these three books. It was true of the non-verbal papers it was
// copied from. Here a band names its own types, which BANDS could already express.
export const WORD_TYPES = [
  'odd-synonym', 'definition', 'rhyme', 'homophone', 'syllables',
  'plural', 'past-tense', 'suffix', 'prefix-antonym', 'root-word', 'missing-vowel',
]

// The letter-and-word puzzles of Bond's Verbal Reasoning 7-8 — what words are MADE of rather
// than what they mean. See the section above GENERATORS.
export const YOUNG_VR_TYPES = [
  'anagram-pair', 'letter-code', 'front-letter', 'alpha-order', 'join-letter', 'change-pattern',
  'word-ladder', 'not-from-letters', 'letter-analogy', 'analogy', 'rhyme-synonym',
  'compound-front', 'pair-meaning', 'logic-grid', 'unscramble', 'letters-in-order', 'letter-sum',
]

// Spelling and grammar with one right form, from Bond English 10-11 and the 11+
// Multiple-choice Test Papers.
export const GRAMMAR_TYPES = [
  'apostrophe', 'misspelt', 'ending', 'ie-ei', 'silent-letter', 'contraction',
  'homophone-cloze', 'grammar-cloze', 'comparative', 'singular', 'gender', 'collective', 'proverb',
]

export const TYPES = [...VR_TYPES, ...WORD_TYPES, ...YOUNG_VR_TYPES, ...GRAMMAR_TYPES]

export const STEM_KEYS = {
  synonym: 'eng_stem_synonym',
  antonym: 'eng_stem_antonym',
  sense: 'eng_stem_sense',
  'odd-two': 'eng_stem_odd_two',
  'word-grid': 'eng_stem_grid',
  'letter-pair': 'eng_stem_letter_pair',
  'shared-letters': 'eng_stem_shared',
  'hidden-word': 'eng_stem_hidden',
  'odd-synonym': 'eng_stem_odd_synonym',
  definition: 'eng_stem_definition',
  rhyme: 'eng_stem_rhyme',
  homophone: 'eng_stem_homophone',
  syllables: 'eng_stem_syllables',
  plural: 'eng_stem_plural',
  'past-tense': 'eng_stem_past',
  suffix: 'eng_stem_suffix',
  'prefix-antonym': 'eng_stem_prefix',
  'root-word': 'eng_stem_root',
  'missing-vowel': 'eng_stem_vowel',
  'anagram-pair': 'eng_stem_anagram_pair',
  'letter-code': 'eng_stem_letter_code',
  'front-letter': 'eng_stem_front_letter',
  'alpha-order': 'eng_stem_alpha_order',
  'join-letter': 'eng_stem_join_letter',
  'change-pattern': 'eng_stem_change_pattern',
  'word-ladder': 'eng_stem_word_ladder',
  'not-from-letters': 'eng_stem_not_from_letters',
  'letter-analogy': 'eng_stem_letter_analogy',
  analogy: 'eng_stem_analogy',
  'rhyme-synonym': 'eng_stem_rhyme_synonym',
  'compound-front': 'eng_stem_compound_front',
  'pair-meaning': 'eng_stem_pair_meaning',
  'logic-grid': 'eng_stem_logic',
  unscramble: 'eng_stem_unscramble',
  'letters-in-order': 'eng_stem_letters_in_order',
  'letter-sum': 'eng_stem_letter_sum',
  apostrophe: 'eng_stem_apostrophe',
  misspelt: 'eng_stem_misspelt',
  ending: 'eng_stem_ending',
  'ie-ei': 'eng_stem_ie_ei',
  'silent-letter': 'eng_stem_silent',
  contraction: 'eng_stem_contraction',
  'homophone-cloze': 'eng_stem_cloze',
  'grammar-cloze': 'eng_stem_cloze',
  comparative: 'eng_stem_cloze',
  singular: 'eng_stem_singular',
  gender: 'eng_stem_gender',
  collective: 'eng_stem_collective',
  proverb: 'eng_stem_proverb',
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
  // ── 7-8 ─────────────────────────────────────────────────────────────────────────────────
  // J M Bond's Verbal Reasoning Assessment Papers 7-8: 22 papers of 30, read end to end. Before
  // this band existed a seven-year-old got the 8-9 book's letter-pair and hidden-word puzzles
  // with a lower frequency bar, which is a harder book with smaller words — not the book for
  // their age. This one asks what words are MADE of: codes, anagrams, a letter that starts four
  // words, the word between TEN and FIN. Its meaning questions are the plain ones (closest,
  // most opposite, odd two out), kept from the older family.
  '7-8': {
    book: 'Bond Verbal Reasoning Assessment Papers 7-8 (J M Bond)',
    types: [...YOUNG_VR_TYPES, 'synonym', 'antonym', 'odd-two'],
    options: 5,
    // Every dial a notch above 8-9: the book's words are `dog`, `pen`, `bus`, `cold`, `book`.
    answer: 40,
    option: 32,
    stem: 42,
    stemMax: 55,
    familiarOnly: true,
    filler: 44,
    gridSize: 12,
    mask: [2, 3],
    syllables: [1, 2],
    hidden: 42,
  },

  '8-9': {
    book: 'Bond 11+ English and Verbal Reasoning 10 Minute Tests 8-9 (Michellejoy Hughes)',
    // This band's book is the only one of the three that is a VERBAL REASONING paper, so it is
    // the only one that poses word-relationship puzzles. The word-knowledge types are offered
    // alongside them because its own Missing Letters tests are already half way there, and
    // because a nine-year-old who can find a hidden word can certainly pluralise `child`.
    types: [...VR_TYPES, 'odd-synonym', 'definition', 'rhyme', 'homophone', 'plural'],
    syllables: [2, 3],
    // The three-letter word a hidden-word question hides. Held high and falling with age,
    // because it is the ANSWER: the book's own are `low`, `owe`, `tea`, `tin`, `ant`, `ice`.
    hidden: 40,
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
    // The youngest band asks only about words a child of that age has met — Dale-Chall or
    // concrete. The older two do not, because their books do not: the 11-12 paper asks about
    // `vexatious` and `respite`.
    familiarOnly: true,
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

  // ── 9-10 ────────────────────────────────────────────────────────────────────────────────
  // A different book and a different subject. Bond's 9-10 title is an Assessment Paper in
  // ENGLISH: grammar, spelling and word formation, where the 8-9 title was English AND VERBAL
  // REASONING. Its non-passage questions are plurals, suffixes, root words, rhyme, homophones,
  // synonym-odd-one-out, parts of speech and tense — almost none of which the 8-9 book asks.
  //
  // So the band drops most of the puzzle types rather than making them harder. `odd-two`,
  // `word-grid`, `letter-pair`, `shared-letters` and `hidden-word` are not in this paper; what
  // it keeps of the old family is the plain vocabulary work (`synonym`, `antonym`, `sense`),
  // which every one of these books asks in some form.
  '9-10': {
    book: 'Bond Assessment Papers: English 9-10 Book 1 (Sarah Lindsay)',
    types: ['synonym', 'antonym', 'sense', 'odd-synonym', 'definition', 'rhyme', 'homophone',
      'syllables', 'plural', 'past-tense', 'suffix', 'root-word'],
    options: 5,
    // A year above 8-9 on every dial. The book's own vocabulary carries it: `onomatopoeic`,
    // `possessive`, `sacrifices`, `relative clause`.
    answer: 34,
    option: 26,
    stem: 38,
    stemMax: 55,
    filler: 40,
    gridSize: 12,
    mask: [2, 3, 4],
    syllables: [2, 3, 4],
    hidden: 40,
    pluralFamiliarOnly: true,
  },

  // ── 10-11 ───────────────────────────────────────────────────────────────────────────────
  // Bond English Assessment Papers 10-11 Book 1 (10 papers of 100) and the 11+ English
  // Multiple-choice Test Papers Pack 2 (four papers). The first is nearly all written answers;
  // the second is Bond's own answer to how that material goes multiple-choice — find the
  // misspelt word, choose the word that makes the sentence Standard English — and its shapes
  // are the ones used. Before this band, an eleven-year-old was given the 11-12 book.
  '10-11': {
    book: 'Bond English Assessment Papers 10-11 Book 1 + 11+ English Multiple-choice Test Papers Pack 2',
    types: ['synonym', 'antonym', 'odd-synonym', 'definition', 'homophone', 'plural',
      'past-tense', 'suffix', 'prefix-antonym', 'root-word', 'missing-vowel',
      'alpha-order', ...GRAMMAR_TYPES],
    options: 5,
    answer: 32,
    option: 25,
    stem: 36,
    stemMax: 55,
    filler: 38,
    gridSize: 12,
    mask: [3, 4],
    syllables: [3, 4],
    hidden: 38,
    pluralFamiliarOnly: true,
    // "Put these words in alphabetical order: procure, procession, proclaim, proceed, process,
    // processor." Five words that share their first three letters.
    alphaShared: 3,
  },

  // ── 11-12 ───────────────────────────────────────────────────────────────────────────────
  // The 10 Minute Tests for 11+/12+, which sorts its own tests into Spelling, Vocabulary,
  // Sentences, Comprehension and Mixed. Sentences and Comprehension need a passage bank and
  // are out; Spelling and Vocabulary are what this band poses.
  //
  // It is the first band to ask `prefix-antonym` and `missing-vowel`, both straight out of the
  // paper: "write an antonym for each of these words by adding a prefix", and a spelling test
  // that blanks one unstressed vowel — `signific_nt`, `profici_nt`, `poign_nt` — which is
  // precisely the letter nobody can hear.
  '11-12': {
    book: 'Bond 10 Minute Tests: English 11+-12+ (Sarah Lindsay)',
    types: ['synonym', 'antonym', 'sense', 'odd-synonym', 'definition', 'rhyme', 'homophone',
      'syllables', 'plural', 'past-tense', 'suffix', 'prefix-antonym', 'root-word',
      'missing-vowel'],
    // `campus`, `radius`, `criterion` — the book asks these here and nowhere earlier.
    latinPlurals: true,
    options: 5,
    answer: 30,
    option: 24,
    stem: 34,
    stemMax: 55,
    filler: 36,
    gridSize: 12,
    mask: [3, 4],
    syllables: [3, 4, 5],
    hidden: 38,
  },
}

export const BAND_KEYS = Object.keys(BANDS)

// Types built from a hand-written table can only pose as many different questions as the table
// has rows. The audit's variety floor reads this, so a short table is a known size rather than
// a failure — and a table that SHRINKS below it still fails.
export const POOL_LIMITS = {
  proverb: PROVERBS.length,
  'grammar-cloze': GRAMMAR_CLOZE.length,
}

// What the book has that this engine does not — data rather than a comment, so the audit can
// check it and so it cannot quietly go stale after a type ships. Same contract as the puzzle
// engine's BOOK_COVERAGE.
export const BOOK_COVERAGE = {
  '7-8': {
    book: BANDS['7-8'].book,
    missing: [
      'sentence completion — "The (dog, baby, kitten) was put in its (bucket, net, pram)": three\n'
      + '        brackets per sentence and one sensible reading. Needs written sentences',
      'change one word so the sentence makes sense, and find the two words that swapped places —\n'
      + '        both need a sentence bank and a check that only one repair works',
      'the four-letter word hidden across two words ("extra time" → rati is not; "hotel by"\n'
      + '        → elby is not) — needs sentences written so exactly one span is a word',
      'remove or add one letter with a clue ("BREAK, a part of a bird" → beak) — needs clues a\n'
      + '        seven-year-old can read, which WordNet definitions are not',
      'time, date and age puzzles ("If May 1st is a Thursday…", "Meera is half as old as John")\n'
      + '        — arithmetic, and the maths module already asks it',
      'number sequences, crosswords, weather-map reading, "a TREE always has (roots)"',
      'sorting words into two labelled groups — a drag-and-drop, not a choice of five',
    ],
  },
  '10-11': {
    book: BANDS['10-11'].book,
    missing: [
      'comprehension — every paper opens with a passage (Phantom Tollbooth, Alice, Anne Frank,\n'
      + '        Walt Whitman) and most marks hang off it. Deliberate: that is the Reading module',
      'punctuation — the Pack 2 section that asks which extract shows the missing mark, and the\n'
      + '        book\'s "rewrite this passage correctly". Needs written passages',
      'sentence rewriting: reported speech, active/passive, question/statement, double\n'
      + '        negatives, clauses and conjunctions, fronted adverbials',
      'word class in a sentence (underline the preposition, the object, the pronoun)',
      'similes, metaphors, formal register, abbreviations, onomatopoeia — open answers',
      'forming nouns and adjectives from a word in bold (Greece → Greek, begin → beginning)',
      'words that would not have been used 200 years ago; words that apply to both sexes',
    ],
  },
  '9-10': {
    book: BANDS['9-10'].book,
    missing: [
      'comprehension — every paper opens with a passage or a poem and most of its marks\n'
      + '        hang off it. Deliberate, as at 8-9: that work belongs to the Reading module',
      'punctuation — missing commas, apostrophes in plural possessives',
      'clauses — underline the clause, join two short sentences into one',
      'parts of speech and tense IN A SENTENCE (noun or verb, past/present/future), which\n'
      + '        needs a sentence bank rather than a word list',
      'masculine/feminine pairs, collective nouns, the young of animals — small hand-written\n'
      + '        tables, not derivable from WordNet',
      'onomatopoeia, similes, silent letters, abbreviations and contractions',
      'compound words — "write two compound words that begin with..."',
    ],
  },
  '11-12': {
    book: BANDS['11-12'].book,
    missing: [
      'comprehension — four of the twenty tests, plus the Sentences tests which quote a passage',
      'sentence work: indirect speech, double negatives, clauses, formal register, adding\n'
      + '        punctuation to an unpunctuated paragraph. All need written sentences',
      'prepositions and pronouns identified inside a passage',
      'alphabetical ordering, mnemonics, similes, definitions written by the child',
      'archaic-to-modern word pairs ("write the modern version of each of these")',
    ],
  },
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
  if (n <= 8) return '7-8'
  if (n <= 9) return '8-9'
  if (n <= 10) return '9-10'
  if (n <= 11) return '10-11'
  return '11-12'
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

/** May this word be the thing a question is ABOUT, or its answer, in this band? */
const askable = (band, w) => z(w) >= band.answer && (!band.familiarOnly || familiar(w))

/** The bar for a distractor that is doing a JOB — an opposite, a rhyme, another sense.
 *
 *  Looser than the filler bar everywhere else, because a word that traps a specific mistake
 *  earns the right to be rarer: the book offers `hardy` against `early`. In the youngest band
 *  it is not looser, because the trap only works on a word the child can read, and at the
 *  option bar this was offering eight-year-olds `beholder` against `border`, `shortstop`
 *  against `top` and `drainage` against `image`. */
const trapBar = (band) => (band.familiarOnly ? band.filler : band.option)

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
  // And the same word wearing a PREFIX, which the startsWith test cannot see: a rhyme
  // question offered `equal` as the word that rhymes with `unequal`.
  if (long.endsWith(short) && long.length - short.length <= 4) return true
  // And a compound built on it: `science/neuroscience`, `lap/overlap`. Asking which word
  // rhymes with `science` and answering `neuroscience` is not a question about sound.
  if (short.length >= 4 && (long.endsWith(short) || long.startsWith(short))) return true
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

// Candidate filler words, by band and part of speech.
//
// Memoised for the reason sharedLetterIndex is, and this is the same bug in four more places:
// it filters all 19,000 words of the lexicon and it was doing that once per QUESTION. synonym,
// antonym, sense and word-grid all ran at about 1.3ms against odd-two's 0.02ms, and this line
// was the whole difference.
const FILLER_POOLS = new Map()

function fillerPool(band, pos) {
  const key = `${band.filler}|${pos || ''}|${band.familiarOnly ? 'fam' : ''}`
  if (FILLER_POOLS.has(key)) return FILLER_POOLS.get(key)
  const common = Object.keys(WORD_Z).filter(
    w => z(w) >= band.filler && w.length >= 4 && w.length <= 9
      && (!pos || partOfSpeech(w) === pos)
      // The youngest band's fillers come from Dale-Chall alone, with no concrete escape. The
      // escape exists so that the thing a question is ABOUT can be `tortoise` or `saucepan`,
      // words a child knows that a list of 2,942 cannot hold all of. A filler is not about
      // anything — it makes up the numbers — so it can afford to be squarely known, and
      // without that `beholder`, `bacteria` and `drainage` were still on eight-year-olds'
      // lines by way of being concrete nouns.
      && (!band.familiarOnly || FAMILIAR_SET.has(w)))
  // Concreteness is the preference and the part of speech is the requirement, in that order —
  // and the order was learned by getting it wrong. Demanding both starved the verbs: WORD_LEX
  // records one lexical file per word, and of the common words it files as verbs only 34 are
  // in the concrete list against 983 adjectives and 545 nouns. Every sense question with a
  // verb answer failed for want of four verbs to sit beside it, and the type collapsed onto
  // the handful of words with noun answers. Below forty candidates the concrete filter is
  // dropped and frequency carries the line on its own.
  const narrow = common.filter(concrete)
  const pool = narrow.length >= 40 ? narrow : common
  FILLER_POOLS.set(key, pool)
  return pool
}

function fillers(r, band, avoid, count, like) {
  const { synonyms, antonyms } = index()
  // Fillers share the ANSWER's part of speech. Every options line in the book is one part of
  // speech throughout — `bear` is offered `sit run stand find make`, five verbs — and the
  // reason is not tidiness: a child scanning `needs … teen, seventh, inevitably, capable,
  // want` does not have to know what any of them mean to find the only noun-ish one. A line
  // that mixes classes gives the answer away to whoever is not reading.
  const pool = fillerPool(band, like ? partOfSpeech(like) : null)
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
  // A bare word gives no context with which to select a rare WordNet sense. Use the
  // hand-reviewed pairs in every band: WordNet otherwise calls `fix` a synonym of `get`,
  // `vacuum` a synonym of `vacancy`, and `bring` a synonym of `work`.
  const source = PAIR_SYNONYMS.map(ws => [null, ws])
  const usable = source.filter(([, ws]) => ws.filter(w => askable(band, w)).length >= 2)
  if (!usable.length) return null
  const [, words] = pickOne(r, usable)
  const good = shuffle(r, words.filter(w => askable(band, w)))
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
  const opp = [...(antonyms.get(stem) || [])].filter(w => z(w) >= trapBar(band) && !related(w, answer))
  if (opp.length) { const w = pickOne(r, opp); distractors.push({ text: w, why: 'opposite' }); avoid.add(w) }

  // The book's other trap: something that sounds like the stem. `early … e hardy`.
  const rhymes = (byRhyme.get(stem.slice(-3)) || [])
    .filter(w => w !== stem && z(w) >= trapBar(band) && !related(w, stem) && !related(w, answer))
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
  // The same context rule applies to opposites. The curated relation excludes WordNet's
  // contextual pairs (`safe / out`, `planar / cubic`) and gender counterparts (`aunt / uncle`).
  const pairs = PAIR_ANTONYMS.filter(([a, b]) => askable(band, a) && askable(band, b))
  if (!pairs.length) return null
  const [a, b] = pickOne(r, pairs)
  const [stem, answer] = r() < 0.5 ? [a, b] : [b, a]

  const avoid = new Set([stem, answer])
  const distractors = []

  // For an OPPOSITE question the trap is a word that means the SAME — the book does this every
  // time it can: `difficult … a tricky b complex`. A child reading the instruction too fast
  // picks it, which is a different mistake from not knowing the word.
  const same = [...(synonyms.get(stem) || [])].filter(w => z(w) >= trapBar(band) && !related(w, answer))
  if (same.length) { const w = pickOne(r, same); distractors.push({ text: w, why: 'same-meaning' }); avoid.add(w) }

  const rhymes = (byRhyme.get(stem.slice(-3)) || [])
    .filter(w => w !== stem && z(w) >= trapBar(band) && !related(w, stem) && !related(w, answer))
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
  // The book's most-asked question. WordNet supplies the polysemous word, its sentence and its
  // candidate synonyms, but a synset does not guarantee sentence-level substitution. Answers
  // therefore pass through the hand-reviewed SENSE_ANSWERS table; the other senses still make
  // useful distractors.
  const words = Object.keys(SENSES).filter(
    w => z(w) >= band.stem && z(w) <= band.stemMax && SENSES[w].length >= 2
      && !BAD_SENSE_WORDS.has(w) && (!band.familiarOnly || familiar(w)))
  if (!words.length) return null
  const word = pickOne(r, words)
  const senses = SENSES[word]

  const withAnswer = senses.filter(s => SENSE_ANSWERS[s[1]] && !sentenceProblem(s[1])
    && s[2].some(x => SENSE_ANSWERS[s[1]].includes(x) && z(x) >= band.answer
      && !BAD_SENSE_PAIRS.has(`${word}|${x}`)
      && !glossMismatch(x, s[3])))
  if (!withAnswer.length) return null
  const chosenIndex = senses.indexOf(pickOne(r, withAnswer))
  const chosen = senses[chosenIndex]
  const [, sentence, syns, definition, far] = chosen
  const answer = pickOne(r, syns.filter(x => SENSE_ANSWERS[sentence].includes(x)
    && z(x) >= band.answer
    && !BAD_SENSE_PAIRS.has(`${word}|${x}`) && !glossMismatch(x, definition)))
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
        if (z(cand) < trapBar(band) || avoid.has(cand)) continue
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
  // A floor of its own, never below Zipf 3.4. Five words are printed and there is no stem to
  // anchor them, so the oldest band's answer bar of 3.0 was putting `topper`, `haw`, `dahl`
  // and `laguna` on the line — real words, and nothing a child can group. At 3.4 all four go
  // and 39 groups remain against 21 at the next step up.
  const floor = Math.max(band.answer, 34)
  const inGroup = (c) => c[2].filter(
    w => z(w) >= floor && concrete(w) && (WORD_LEX[w] || '').startsWith('noun.'))
  // WordNet categories may overlap in ordinary language. `container / vessel`, `body part /
  // external body part`, and the botanical `herb` category (which includes bananas and
  // pineapples) made questions with four or five defensible answers.
  const excluded = new Set(['herb.n.01'])
  const overlappingPairs = new Set([
    'body_part.n.01|external_body_part.n.01',
    'container.n.01|vessel.n.03',
  ])
  const overlaps = (a, b) => overlappingPairs.has([a[0], b[0]].sort().join('|'))
  const usable = CATEGORIES
    .map((c, i) => [i, c])
    .filter(([, c]) => !excluded.has(c[0]) && inGroup(c).length >= 3)
  if (!usable.length) return null
  const [inIdx, inCat] = pickOne(r, usable)
  const inside = shuffle(r, inGroup(inCat)).slice(0, 3)

  // The two outsiders share a category with EACH OTHER. Picked at random they read as two
  // strays and the question answers itself; the book's own line is `lamb calf foal donkey pig`,
  // where the odd two are both animals and it is the "young" that separates them.
  const outsiders = (c) => inGroup(c).filter(w => !catsOf.get(w)?.has(inIdx))
  const others = usable.filter(([i, c]) => i !== inIdx && !overlaps(inCat, c)
    && outsiders(c).length >= 2)
  if (!others.length) return null
  const [, outCat] = pickOne(r, others)
  const outside = shuffle(r, outsiders(outCat)).slice(0, 2)
  if (outside.length < 2 || inside.length < 3) return null
  // No two words on the line may be the same word. `chimpanzee` and `chimp` were appearing
  // together, and so were `lagoon` and `laguna` — a clipping and a variant spelling, which
  // the lexicon keeps apart because they are separate lemmas and a child does not.
  const line = [...inside, ...outside]
  for (let i = 0; i < line.length; i++) {
    for (let j = i + 1; j < line.length; j++) {
      if (sameWordDifferentEnding(line[i], line[j])) return null
    }
  }

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

// The grid's own pool: shorter words than a filler line allows, because a 4 x 3 block reads
// better with them. Memoised like the rest.
const GRID_POOLS = new Map()

function gridPool(band) {
  const key = `${band.filler}|${band.familiarOnly ? 'fam' : ''}`
  if (!GRID_POOLS.has(key)) {
    GRID_POOLS.set(key, Object.keys(WORD_Z).filter(
      w => z(w) >= band.filler && concrete(w) && w.length >= 3 && w.length <= 9
        && (!band.familiarOnly || FAMILIAR_SET.has(w))))
  }
  return GRID_POOLS.get(key)
}

function genWordGrid(r, band, seed) {
  // The book's grid: twelve words in a 4 × 3 block, and a question that wants TWO of them.
  // Everything that is not an answer has to be safely unrelated to the target AND to the two
  // answers, because a grid gives the child twelve chances to find a second right answer.
  const { synonyms, antonyms } = index()
  const wantOpposite = r() < 0.5

  const candidates = wantOpposite
    ? Object.entries(GRID_OPPOSITES)
    : SYNONYM_GROUPS.flatMap(group => group.map(target => [target, group.filter(w => w !== target)]))
  const usable = candidates.filter(([target, hits]) => z(target) >= band.stem
    && z(target) <= band.stemMax && (!band.familiarOnly || familiar(target))
    && hits.filter(w => askable(band, w)).length >= 2)
  if (!usable.length) return null
  const [target, hits] = pickOne(r, usable)
  const answers = shuffle(r, hits.filter(w => askable(band, w))).slice(0, 2)
  if (!answers) return null

  const avoid = new Set([target, ...answers])
  // Anything a child could argue for is a second answer, so the filler test is the union of
  // both relations, in both directions.
  const clash = (w) => related(w, target)
    || answers.some(a => related(w, a))
    || synonyms.get(target)?.has(w) || antonyms.get(target)?.has(w)
  const filler = []
  const pool = gridPool(band)
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
  const wantOpposite = r() < 0.5
  const source = wantOpposite ? PAIR_ANTONYMS : PAIR_SYNONYMS
  const pairs = source.flatMap(([a, b]) => [[a, b], [b, a]]).filter(([stem, answer]) =>
    z(stem) >= band.stem && z(stem) <= band.stemMax
      && (!band.familiarOnly || familiar(stem)) && z(answer) >= band.answer
      && answer.length >= 5 && answer.length <= 10)
  if (!pairs.length) return null
  const [stem, answer] = pickOne(r, pairs)

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
// The sound types and the spelling type each scan a whole table per question, and each was
// doing it on every call — the same bug the filler pools had, in four more places. It stayed
// invisible while the plural list was 66 entries and showed up when a sitting went from
// 0.72ms to 7.67ms. Keyed by band and variety, because both change what survives the filter.
const SOUND_POOLS = new Map()

function soundPool(key, build) {
  if (!SOUND_POOLS.has(key)) SOUND_POOLS.set(key, build())
  return SOUND_POOLS.get(key)
}

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

// The three-letter words that can hide, and the words they can hide in. Memoised like the
// rest: this walked the whole lexicon AND the whole example list, per question.
//
// The host has to be a concrete word, not merely a readable one. Every word in "the bipolar
// distribution of certain species" clears the frequency bar and the sentence still means
// nothing to a nine-year-old; `bipolar` is what put it there. A sentence about a thing tends to
// be a sentence a child can picture.
const HIDDEN_POOLS = new Map()

function hiddenWordPools(band) {
  const key = `${band.option}|${band.answer}`
  if (!HIDDEN_POOLS.has(key)) {
    HIDDEN_POOLS.set(key, {
      // The hidden word is the ANSWER and the book is explicit that it must be a word —
      // its own are `low`, `owe`, `tea`, `tin`, `ant`, `ice`, all between Zipf 3.5 and 6.5.
      // At the option bar this was answering `roc`, `ani`, `pap`, `arb` and `dit`, which are
      // in a dictionary and in no child's head.
      three: new Set(Object.keys(WORD_Z).filter(
        w => w.length === 3 && z(w) >= band.hidden && !BANNED.has(w))),
      hosts: Object.keys(EXAMPLES).filter(
        w => z(w) >= band.answer && concrete(w) && w.length >= 6 && w.length <= 11),
    })
  }
  return HIDDEN_POOLS.get(key)
}

function genHiddenWord(r, band, seed) {
  // "The tooth fairy had placed a coin under her pil___." — and the three letters that go in
  // are themselves a word (`low`). Two conditions at once, which is what makes it the book's
  // hardest letter type, and the sentence is what tells the child which word is wanted.
  const { three, hosts } = hiddenWordPools(band)
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


// ── the word-knowledge family ─────────────────────────────────────────────────────────────
//
// Eleven generators for the 9-10 and 11-12 books. What they have in common, and what makes
// them different from everything above, is where the distractors come from: in the verbal
// reasoning types a wrong option is another WORD, and the child has to know what words mean.
// Here the best wrong option is usually the RULE APPLIED NAIVELY — `beauty` + `ful` is
// `beautyful`, the plural of `child` is `childs`, the past tense of `run` is `runned`. That is
// the mistake the question exists to catch, so it has to be on the page.

const REGULAR_PLURAL = (w) => (
  /(s|x|z|ch|sh)$/.test(w) ? w + 'es'
    : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies'
      : w + 's')

const REGULAR_PAST = (w) => (
  w.endsWith('e') ? w + 'd'
    : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ied'
      : w + 'ed')

/** Every rhyme key a word has, across its pronunciations. */
const rimesOf = (w, variety) => RIMES[variety]?.[w] || []
const rhymes = (a, b, variety) => rimesOf(a, variety).some(k => rimesOf(b, variety).includes(k))

/** Would a CHILD call these two a rhyme, whatever the dictionary says?
 *
 *  The rhyme key runs from the last STRESSED vowel, and the dictionaries mark one stress per
 *  word. So `overlap` is filed as ˈəʊvəlap, its key is the whole word, and it does not rhyme
 *  with `flap` — which is how `overlap` came to be offered as a wrong answer to "what rhymes
 *  with flap". Nobody would mark that wrong.
 *
 *  The test is deliberately asymmetric: strict for choosing the ANSWER, which must be a real
 *  rhyme by the last stressed vowel, and generous for rejecting a DISTRACTOR, where sharing
 *  the last three letters and the last vowel sound is enough to disqualify it. An option a
 *  child could defend has no business on the page. */
const couldPassForRhyme = (a, b, variety) => {
  if (rhymes(a, b, variety)) return true
  if (a.length < 3 || b.length < 3) return false
  if (a.slice(-3) !== b.slice(-3)) return false
  // A word this dictionary has no pronunciation for cannot be judged, and NOT KNOWING is not
  // the same as SOUNDING DIFFERENT. It was: `underground` has no UK entry, so it fell through
  // as "does not pass for a rhyme" and was offered against `bound` as a spelled-alike trap —
  // when it rhymes perfectly. Unknown now disqualifies a word from being that trap, which is
  // the generous direction this test is supposed to lean in for distractors.
  const unknown = (w) => !rimesOf(w, variety)?.[0]
  if (unknown(a) || unknown(b)) return true
  const tail = (w) => {
    const [k] = rimesOf(w, variety)
    if (!k) return null
    // The same vowel set the lexicon builder uses, read off the two dictionaries: seventeen
    // symbols including `ɝ`, and not the length mark `ː`.
    const vowels = [...k].map((ch, i) => ('ɪəiɛʊæɑaeoɔuɐɒʌɜɝ'.includes(ch) ? i : -1))
      .filter(i => i >= 0)
    return vowels.length ? k.slice(vowels[vowels.length - 1]) : k
  }
  const ta = tail(a)
  return !!ta && ta === tail(b)
}
const syllablesOf = (w, variety) => SYLLABLES[variety]?.[w]

function genOddSynonym(r, band, seed) {
  // The 9-10 book: "Underline one word in each group which is not a synonym for the rest."
  // Four words that mean nearly the same and one that does not — the mirror image of odd-two,
  // which groups by what a thing IS rather than by what a word MEANS.
  // The table itself is the age/readability review, so do not re-apply Dale-Chall here. It omits
  // ordinary words such as cheerful, enormous and miniature and left 8-9 with one repeating
  // group. The frequency floor still rises with the band.
  const usable = SYNONYM_GROUPS.filter(ws => ws.every(w => z(w) >= band.answer))
  if (!usable.length) return null
  const words = pickOne(r, usable)
  const inside = shuffle(r, words)
  if (inside.length < 4) return null
  // Same rule as odd-two: a synset holds `chimpanzee` and `chimp`, and a line that shows both
  // is asking a child to tell one word from itself.
  for (let i = 0; i < inside.length; i++) {
    for (let j = i + 1; j < inside.length; j++) {
      if (sameWordDifferentEnding(inside[i], inside[j])) return null
    }
  }

  // The outsider must be unrelated to ALL four, not merely to the one it was checked against.
  const avoid = new Set(inside)
  const outsider = fillers(r, band, avoid, 1, inside[0])[0]
  if (!outsider) return null
  if (inside.some(w => related(w, outsider) || sharesNeighbour(w, outsider))) return null

  const rows = shuffle(r, [
    { text: outsider, why: null },
    ...inside.map(text => ({ text, why: 'same-meaning' })),
  ])
  return {
    seed, band: null, type: 'odd-synonym', stem_key: STEM_KEYS['odd-synonym'],
    prompt: {},
    options: rows,
    correct: rows.map((o, i) => (o.why === null ? i : -1)).filter(i => i >= 0),
    pick: 1,
    rule: { kind: 'odd-synonym', group: inside },
  }
}

/**
 * Does this definition read as a VERB — "make more attractive by adding ornament", "give an
 * education to", "to travel for the purpose of discovery"?
 *
 * WordNet files a participle under its verb's gloss, and the lexicon kept that gloss beside the
 * adjective: `decorated` was defined as "make more attractive by adding ornament, colour, etc.",
 * whose grammatical answer is `decorate`. A child who knows exactly what the definition means
 * is then marked right only by choosing a word that does not fit it. 106 entries had this
 * shape. "to a great extent or degree" is the other use of `to` and is fine — it is how an
 * adverb is defined.
 */
// The verbs WordNet glosses open with whose MAIN sense the lexicon files as a noun or an
// adjective — `make` is filed under "a make of car", so the lexicon alone said "make more
// attractive…" was not a verb.
const GLOSS_VERBS = new Set(['be', 'make', 'give', 'take', 'put', 'bring', 'cause', 'come', 'go',
  'get', 'have', 'keep', 'set', 'remove', 'move', 'become', 'turn', 'carry', 'hold', 'place',
  'form', 'change', 'show', 'fail', 'free', 'rid', 'supply', 'provide', 'express', 'declare'])

function glossReadsAsVerb(d) {
  const [first, second] = d.split(/[ ,;]+/)
  const isVerb = (w) => GLOSS_VERBS.has(w) || (WORD_LEX[w] || '').startsWith('verb')
  return isVerb(first) || (first === 'to' && isVerb(second))
}

// How an ADJECTIVE's definition opens. A participle filed as an adjective (`learned`, `crooked`,
// `distracted`, `expected`) whose definition does not open like this is carrying its verb's
// gloss — "gain knowledge or skills", "bend or cause to bend" — which the verb list above
// cannot catch word by word.
const ADJ_GLOSS = /^(having|not|being|of|in|on|at|full|showing|marked|characterized|made|done|very|a|an|the|used|capable|relating|lacking|affected|resembling|containing|able|with|without|covered|filled|caused|feeling|so|causing|given|free|set|fixed|provided|possessing|exhibiting|serving|well|highly|fully|completely|thoroughly|deeply|easily|by|from|out|no|more|most|less|too|\()/

/** True when the definition cannot be answered by this word as written. */
function glossMismatch(w, d) {
  const pos = partOfSpeech(w)
  if (pos !== 'verb' && glossReadsAsVerb(d)) return true
  // An inflected verb against its base form's gloss: "settle into a position" is `settle`, not
  // `settled`, whatever the lexicon files `settled` under.
  const base = /ied$/.test(w) ? w.slice(0, -3) + 'y' : /ed$/.test(w) ? w.slice(0, -2) : null
  if (base && (base in WORD_Z || (base + 'e') in WORD_Z) && glossReadsAsVerb(d)) return true
  return pos === 'adj' && /ed$/.test(w) && !ADJ_GLOSS.test(d)
}

function genDefinition(r, band, seed) {
  // "Write one word for each definition." WordNet is a dictionary, so for once the question and
  // its answer are the same lookup — and the distractors are ordinary words of the same class,
  // as the book's are.
  // The definition questions were gated on their answer and not on themselves. An
  // eight-year-old was shown "place of business where professional or clerical duties are
  // performed" and asked for `office` — an answer they know, inside a question they cannot
  // read. The lexicon carries the flag, because deciding it here meant asking whether each
  // word is in the lexicon, and "not in it, so wave it through" is backwards: `larvae` is not
  // a lemma and is not easy.
  const words = Object.keys(DEFINITIONS).filter(
    w => askable(band, w) && (!band.familiarOnly || DEFINITIONS[w][1])
      && !BAD_DEFINITION_WORDS.has(w) && !glossMismatch(w, DEFINITIONS[w][0]))
  if (!words.length) return null
  const word = pickOne(r, words)
  const avoid = new Set([word])
  const distractors = fillers(r, band, avoid, band.options - 1, word)
    .map(text => ({ text, why: 'unrelated' }))
  if (distractors.length < band.options - 1) return null
  // A distractor the definition also describes is a second answer. The definition is WordNet's
  // own words for this sense, so anything sharing that sense is a candidate.
  if (distractors.some(d => related(d.text, word) || sharesNeighbour(d.text, word))) return null

  return {
    seed, band: null, type: 'definition', stem_key: STEM_KEYS.definition,
    prompt: { definition: DEFINITIONS[word][0] },
    ...layOut(r, band, [word], distractors),
    pick: 1,
    rule: { kind: 'definition', word },
  }
}

function genRhyme(r, band, seed) {
  // "Write a word that rhymes with each of the following." Rhyme is the one thing in this whole
  // module that WordNet cannot answer at all; it comes from CMUdict, read non-rhotically so
  // that `calm` rhymes with `arm` as it does in the book.
  // Held to the FILLER bar, not the answer bar. Both words on a rhyme question are printed
  // and both are read, as on an odd-two line — and the answer bar let through `hap`, `dada`
  // and `nous`, which are words a dictionary knows and a child does not.
  const table = RHYME_GROUPS[band.variety]
  // A stem with two pronunciations is a stem with two rhyme sets, and a child who says the
  // other one is looking at a page where nothing rhymes. British `garage` is both /ˈɡærɑːʒ/
  // and /ˈɡærɪdʒ/, so it rhymes with `massage` and with `carriage`, and the question can only
  // print one of them as the answer.
  const ok = (w) => z(w) >= band.filler && !wrongSpelling(w, band.variety)
    && (RIMES[band.variety]?.[w] || []).length === 1
    && (!band.familiarOnly || familiar(w))
  const keys = Object.keys(table).filter(k => table[k].filter(ok).length >= 2)
  if (!keys.length) return null
  const key = pickOne(r, keys)
  const group = shuffle(r, table[key].filter(ok))
  const [stem, answer] = group
  if (!stem || !answer || sameWordDifferentEnding(stem, answer)) return null

  const avoid = new Set([stem, answer])
  const distractors = []
  // The trap English is famous for: spelled alike, said differently. `bough` and `cough`,
  // `comb` and `bomb`. A child who reads the ending instead of hearing it picks this.
  // Indexed by final trigram rather than scanned: the look-alike is always a word ending in
  // the same three letters, and finding it by walking twenty thousand words per question is
  // what made this the slowest generator in the module.
  const byTail = soundPool(`tail|${band.filler}|${band.variety}`, () => {
    const out = new Map()
    for (const w of Object.keys(WORD_Z)) {
      if (w.length < 3 || z(w) < band.filler || wrongSpelling(w, band.variety)) continue
      const k = w.slice(-3)
      if (!out.has(k)) out.set(k, [])
      out.get(k).push(w)
    }
    return out
  })
  const lookalikes = (byTail.get(stem.slice(-3)) || []).filter(
    w => w !== stem && !couldPassForRhyme(w, stem, band.variety))
  if (lookalikes.length) {
    const w = pickOne(r, lookalikes)
    distractors.push({ text: w, why: 'looks-alike' })
    avoid.add(w)
  }
  for (const w of fillers(r, band, avoid, band.options - 1 - distractors.length, answer)) {
    if (couldPassForRhyme(w, stem, band.variety)) continue
    distractors.push({ text: w, why: 'unrelated' })
    avoid.add(w)
  }
  if (distractors.length < band.options - 1) return null

  return {
    seed, band: null, type: 'rhyme', stem_key: STEM_KEYS.rhyme,
    prompt: { word: stem },
    ...layOut(r, band, [answer], distractors),
    pick: 1,
    rule: { kind: 'rhyme', of: stem, key, variety: band.variety },
  }
}

function genHomophone(r, band, seed) {
  // "Write a homophone for each of these words." `their / there`, `bare / bear`.
  const table = HOMOPHONES[band.variety]
  // The ANSWER bar, not the filler bar. Both were raised together when rhyme answers turned up
  // `hap`, `dada` and `nous`, and that reasoning was about rhyme: its pool is the whole
  // lexicon. The homophone pool is 280 curated groups, and holding it to the filler bar threw
  // away `air/heir`, `brake/break`, `cellar/seller`, `cereal/serial`, `cite/sight/site`,
  // `cue/queue`, `dear/deer`, `dual/duel` and `fair/fare` — 92 groups down to 32, and the ones
  // lost are the ones the 11+ papers actually ask.
  // A spelling with two pronunciations cannot be a context-free homophone question. The US
  // dictionary groups the verb pronunciation of `desert` with `dessert`, the past tense of
  // `read` with `red`, and one pronunciation of `bow` with `beau`; the printed bare word does
  // not tell the child which pronunciation was selected.
  const ok = (w) => z(w) >= band.answer && !wrongSpelling(w, band.variety)
    && rimesOf(w, band.variety).length === 1
    && (!band.familiarOnly || familiar(w))
  const groups = soundPool(`homo|${band.answer}|${band.variety}`,
    () => table.map(g => g.filter(ok)).filter(g => g.length >= 2))
  if (!groups.length) return null
  const group = shuffle(r, pickOne(r, groups))
  const [stem, answer] = group
  if (!stem || !answer) return null

  const avoid = new Set(group)
  const distractors = []
  // Rhymes-but-is-not — the near miss. `bare / bear` are homophones; `bore` only rhymes.
  // Everything that rhymes with the stem, from the rhyme index rather than from a scan of the
  // lexicon — and `table.find` inside that scan made it a scan of the homophone list too.
  const homoOf = soundPool(`homoindex|${band.variety}`, () => {
    const out = new Map()
    for (const g of table) for (const w of g) out.set(w, g)
    return out
  })
  const near = (RIMES[band.variety]?.[stem] || [])
    .flatMap(k => RHYME_GROUPS[band.variety][k] || [])
    .filter(w => z(w) >= band.filler && !avoid.has(w) && !wrongSpelling(w, band.variety)
      && !group.some(g => (homoOf.get(g) || []).includes(w)))
  if (near.length) {
    const w = pickOne(r, near)
    distractors.push({ text: w, why: 'rhyme' })
    avoid.add(w)
  }
  for (const w of fillers(r, band, avoid, band.options - 1 - distractors.length, answer)) {
    distractors.push({ text: w, why: 'unrelated' })
    avoid.add(w)
  }
  if (distractors.length < band.options - 1) return null

  return {
    seed, band: null, type: 'homophone', stem_key: STEM_KEYS.homophone,
    prompt: { word: stem },
    ...layOut(r, band, [answer], distractors),
    pick: 1,
    rule: { kind: 'homophone', of: stem, group, variety: band.variety },
  }
}

function genSyllables(r, band, seed) {
  // "Complete the table by writing in words that have 3, 4 or 5 syllables." Asked the other way
  // round, because the book's form is a free write: which of these five has N?
  const n = pickOne(r, band.syllables)
  const table = SYLLABLES[band.variety]
  const byCount = soundPool(`syl|${band.answer}|${band.variety}`, () => {
    const out = new Map()
    for (const w of Object.keys(table)) {
      if (z(w) < band.answer || !concrete(w) || wrongSpelling(w, band.variety)) continue
      const k = table[w]
      if (!out.has(k)) out.set(k, [])
      out.get(k).push(w)
    }
    return out
  })
  const right = byCount.get(n) || []
  const wrong = [n - 2, n - 1, n + 1, n + 2].flatMap(k => byCount.get(k) || [])
  if (right.length < 1 || wrong.length < band.options - 1) return null
  const answer = pickOne(r, right)
  const avoid = new Set([answer])
  const distractors = []
  for (const w of shuffle(r, wrong)) {
    if (distractors.length >= band.options - 1) break
    if (avoid.has(w) || sameWordDifferentEnding(w, answer)) continue
    avoid.add(w)
    distractors.push({ text: w, why: `syllables-${table[w]}` })
  }
  if (distractors.length < band.options - 1) return null

  return {
    seed, band: null, type: 'syllables', stem_key: STEM_KEYS.syllables,
    prompt: { count: n },
    ...layOut(r, band, [answer], distractors),
    pick: 1,
    rule: { kind: 'syllables', count: n, variety: band.variety },
  }
}

function genPlural(r, band, seed) {
  // "Write each of these words in its plural form." Only the words a rule gets wrong are worth
  // asking about, so the lexicon holds no `cat -> cats`; and the naive rule is the distractor
  // that matters, because `childs` is the answer a child actually writes.
  // Latin and Greek plurals are held back to the band whose book asks them: the 9-10 paper
  // asks `thief` and `baby`, and `campus`, `radius` and `criterion` do not appear until 11-12.
  const pairs = PLURALS.filter(([a, b, rule]) => askable(band, a) && !BANNED.has(b)
    && !BAD_PLURAL_WORDS.has(a) && (!band.pluralFamiliarOnly || familiar(a))
    && (rule !== 'latin' || band.latinPlurals))
  if (!pairs.length) return null
  const [single, answer, rule] = pickOne(r, pairs)
  const naive = REGULAR_PLURAL(single)
  const avoid = new Set([answer, naive])
  // The wrong answers are the OTHER rules applied to this word, which is the mistake the
  // question is about: `valleys` written `vallies`, `roofs` written `rooves`, `pianos`
  // written `pianoes`. When the naive rule happens to be the right answer — the whole point
  // of the `s-after-*` entries — it is not offered twice.
  const distractors = naive === answer ? [] : [{ text: naive, why: 'the-rule-applied-blindly' }]
  const shapes = [single + 's', single + 'es', single + 'en',
    single.slice(0, -1) + 'ies', single.slice(0, -1) + 'ves', single.slice(0, -2) + 'i',
    single.endsWith('f') ? single.slice(0, -1) + 'ves' : single + 'ves',
    single.endsWith('fe') ? single.slice(0, -2) + 'ves' : single + 'oes']
  for (const w of shuffle(r, shapes)) {
    if (distractors.length >= band.options - 1) break
    // Cutting a word down produces words: `genius` minus two letters is `geni`, `white` minus
    // one is `whit`, and both are on the blocklist. Everything this file INVENTS has to be
    // screened, not only what it looks up.
    if (avoid.has(w) || w === answer || w.length < 3 || BANNED.has(w)) continue
    avoid.add(w)
    distractors.push({ text: w, why: 'not-a-word' })
  }
  if (distractors.length < band.options - 1) return null

  return {
    seed, band: null, type: 'plural', stem_key: STEM_KEYS.plural,
    prompt: { word: single },
    ...layOut(r, band, [answer], distractors),
    pick: 1,
    rule: { kind: 'plural', of: single, rule },
  }
}

function genPastTense(r, band, seed) {
  // "Fill each gap by writing the past tense of the verb in bold." Same shape as the plural:
  // the irregular form against the rule applied blindly.
  const pairs = PASTS.filter(([a, b]) => z(a) >= band.answer && !BANNED.has(b)
    && !BAD_PAST_WORDS.has(a))
  if (!pairs.length) return null
  const [base, answer] = pickOne(r, pairs)
  const naive = REGULAR_PAST(base)
  if (naive === answer) return null
  const avoid = new Set([answer, naive])
  const distractors = [{ text: naive, why: 'the-rule-applied-blindly' }]
  const shapes = [base + 'ed', base + 'd', base + 't', base + base.slice(-1) + 'ed',
    base + 'en', base.slice(0, -1) + 'ed']
  for (const w of shuffle(r, shapes)) {
    if (distractors.length >= band.options - 1) break
    if (avoid.has(w) || w === answer || w.length < 3 || BANNED.has(w)) continue
    avoid.add(w)
    distractors.push({ text: w, why: 'not-a-word' })
  }
  if (distractors.length < band.options - 1) return null

  return {
    seed, band: null, type: 'past-tense', stem_key: STEM_KEYS['past-tense'],
    prompt: { word: base },
    ...layOut(r, band, [answer], distractors),
    pick: 1,
    rule: { kind: 'past-tense', of: base },
  }
}

function genSuffix(r, band, seed) {
  // "Add the suffix ful to each of these words. Make any spelling changes necessary." The
  // spelling change IS the question — `beauty` + `ful` is `beautiful`, not `beautyful` — so the
  // lexicon only keeps pairs where something changed, and the naive join is option one.
  const pairs = SUFFIXED.filter(
    ([a, b]) => z(a) >= band.answer && z(b) >= band.option && !BANNED.has(b)
      && !BAD_SUFFIX_PAIRS.has(`${a}|${b}`))
  if (!pairs.length) return null
  const [base, answer, suffix] = pickOne(r, pairs)
  const naive = base + suffix
  if (naive === answer) return null
  const avoid = new Set([answer, naive])
  const distractors = [{ text: naive, why: 'the-rule-applied-blindly' }]
  // Every plausible way to join the two, because the ones that collide with real words have
  // to be thrown away and four candidates left the type starved — it was finding a clean
  // question once in fifty tries.
  const shapes = [
    base.slice(0, -1) + suffix,
    base + 'e' + suffix,
    base + base.slice(-1) + suffix,
    base.slice(0, -1) + 'i' + suffix,
    base.slice(0, -1) + 'y' + suffix,
    base.slice(0, -2) + suffix,
    base + 'a' + suffix,
    base.slice(0, -1) + 'e' + suffix,
    base + suffix.slice(1),
    base + suffix[0] + suffix,
  ]
  for (const w of shuffle(r, shapes)) {
    if (distractors.length >= band.options - 1) break
    if (avoid.has(w) || w === answer || w.length < 4 || w in WORD_Z || BANNED.has(w)) continue
    avoid.add(w)
    distractors.push({ text: w, why: 'not-a-word' })
  }
  if (distractors.length < band.options - 1) return null

  return {
    seed, band: null, type: 'suffix', stem_key: STEM_KEYS.suffix,
    prompt: { word: base, suffix },
    ...layOut(r, band, [answer], distractors),
    pick: 1,
    rule: { kind: 'suffix', of: base, suffix },
  }
}

function genPrefixAntonym(r, band, seed) {
  // "Write an antonym for each of these words by adding a prefix." The options are the prefixes
  // themselves, which is what makes it a question about English rather than about vocabulary:
  // the child knows the word means the opposite, and has to know it is `impossible` and not
  // `unpossible`.
  const pairs = PREFIXED.filter(([a, b]) => z(a) >= band.answer && z(b) >= band.option
    && !AMBIGUOUS_PREFIX_BASES.has(a))
  if (!pairs.length) return null
  const [stem, whole, prefix] = pickOne(r, pairs)
  const others = ['un', 'in', 'im', 'dis', 'non', 'mis', 'il', 'ir', 'anti']
    .filter(p => p !== prefix && !(p + stem in WORD_Z))
  const distractors = shuffle(r, others).slice(0, band.options - 1)
    .map(text => ({ text, why: 'wrong-prefix' }))
  if (distractors.length < band.options - 1) return null

  return {
    seed, band: null, type: 'prefix-antonym', stem_key: STEM_KEYS['prefix-antonym'],
    prompt: { word: stem },
    ...layOut(r, band, [prefix], distractors),
    pick: 1,
    rule: { kind: 'prefix-antonym', of: stem, answer: whole },
  }
}

let ROOTS = null

function genRootWord(r, band, seed) {
  // "Underline the root word for each of these words." `displacement` is `place`, `unhappy` is
  // `happy`. Built from the affixed pairs the lexicon already holds, so the root is asserted
  // rather than guessed off the spelling.
  // The root has to be a ROOT — a word with nothing left to take off. Stripping one affix is
  // not enough: `unopposed` minus `un` is `opposed`, which is `oppose` plus `ed`, and a blind
  // test picked exactly that out as the one question with two defensible answers. The book's
  // own examples strip all the way down: `displacement` is `place`, `quickly` is `quick`.
  if (!ROOTS) {
    // A root is a word with nothing left to take off, and being absent from the derived lists
    // is not enough to prove that: `opposed` is `oppose` + `d` and no list here records the
    // plain inflections, so `unopposed -> opposed` survived the first attempt. The test is
    // direct — strip each ending in turn and see whether a word is left.
    const INFLECTIONS = ['ed', 'd', 'ing', 'ly', 'ness', 'ment', 'ion', 'tion', 'ous', 'able',
      'ible', 'ive', 'er', 'est', 'al', 'ity', 'ance', 'ence', 'ist', 'ful', 'less', 's']
    const decomposable = (w) => INFLECTIONS.some((suf) => {
      if (!w.endsWith(suf) || w.length - suf.length < 3) return false
      const stem = w.slice(0, -suf.length)
      return stem in WORD_Z || (stem + 'e') in WORD_Z || (stem + 'y') in WORD_Z
    })
    ROOTS = [
      ...SUFFIXED.map(([base, whole]) => [whole, base]),
      ...PREFIXED.map(([base, whole]) => [whole, base]),
    ].filter(([, base]) => !decomposable(base))
  }
  const candidates = ROOTS.filter(([whole, base]) => z(base) >= band.answer && z(whole) >= band.option)
  if (!candidates.length) return null
  const [whole, answer] = pickOne(r, candidates)
  const avoid = new Set([whole, answer])
  const distractors = []
  // Pieces of the word itself: the near-misses a child produces by cutting in the wrong place.
  // Cuts a child could actually make: the word shortened from the END, or the root with one
  // letter too many or too few. Slicing off the FRONT gives `epentance` and `ntance`, which
  // nobody would write and which a child eliminates without reading the question.
  const cuts = [whole.slice(0, answer.length), whole.slice(0, answer.length + 1),
    whole.slice(0, -1), whole.slice(0, -2), answer + 'e', answer.slice(0, -1)]
  for (const w of shuffle(r, cuts)) {
    if (distractors.length >= band.options - 1) break
    if (!w || avoid.has(w) || w.length < 3 || w === answer || BANNED.has(w)) continue
    avoid.add(w)
    distractors.push({ text: w, why: 'cut-in-the-wrong-place' })
  }
  for (const w of fillers(r, band, avoid, band.options - 1 - distractors.length, answer)) {
    distractors.push({ text: w, why: 'unrelated' })
  }
  if (distractors.length < band.options - 1) return null

  return {
    seed, band: null, type: 'root-word', stem_key: STEM_KEYS['root-word'],
    prompt: { word: whole },
    ...layOut(r, band, [answer], distractors),
    pick: 1,
    rule: { kind: 'root-word', of: whole },
  }
}

function genMissingVowel(r, band, seed) {
  // "Fill in the missing letter in each word." The 11-12 book's spelling test: `signific_nt`,
  // `repugn_nt`, `profici_nt` — always an unstressed vowel, which is exactly the letter nobody
  // can hear. Five options and five vowels, so the options ARE the alphabet's vowels.
  const VOWELS = ['a', 'e', 'i', 'o', 'u']
  const pool = soundPool(`vowel|${band.answer}`, () => Object.keys(WORD_Z).filter(
    w => z(w) >= band.answer && w.length >= 6 && w.length <= 12 && !BANNED.has(w)))
  if (!pool.length) return null
  for (let tries = 0; tries < 60; tries++) {
    const word = pickOne(r, pool)
    // Positions holding a vowel, never the first or last letter.
    const spots = []
    for (let i = 1; i < word.length - 1; i++) if (VOWELS.includes(word[i])) spots.push(i)
    if (!spots.length) continue
    const at = pickOne(r, spots)
    const truth = word[at]
    // Exactly one vowel may make a real word, or the question has two answers — `bat`, `bet`,
    // `bit`, `bot` and `but` are all words and that blank is not a question.
    const alternatives = VOWELS.filter(v => v !== truth
      && (word.slice(0, at) + v + word.slice(at + 1)) in WORD_Z)
    if (alternatives.length) continue
    const masked = word.slice(0, at) + '_' + word.slice(at + 1)
    const rows = shuffle(r, VOWELS.map(v => ({ text: v, why: v === truth ? null : 'not-a-word' })))
    return {
      seed, band: null, type: 'missing-vowel', stem_key: STEM_KEYS['missing-vowel'],
      prompt: { masked },
      options: rows,
      correct: rows.map((o, i) => (o.why === null ? i : -1)).filter(i => i >= 0),
      pick: 1,
      rule: { kind: 'missing-vowel', word },
    }
  }
  return null
}


// ── the letter-and-word puzzles (Bond Verbal Reasoning 7-8) ───────────────────────────────
//
// Seventeen generators for the youngest band, from J M Bond's Verbal Reasoning Assessment
// Papers 7-8 (22 papers × 30 questions, read end to end). That book is a different animal from
// every other one this engine was built from: it hardly asks what words MEAN. It asks what they
// are MADE of — which two use the same letters, which letter starts all four, what BAT is in a
// code where TABLE is 12345, which word sits between TEN and FIN. That is exactly the kind of
// question a lexicon can answer with certainty, so almost all of it is generated here.
//
// Where the whole family stands on one idea: a letter puzzle has an answer that can be CHECKED,
// not argued. Every validator below recomputes the answer from the prompt and counts how many
// options satisfy it. The words these puzzles make are read against `anyWord`, which is
// deliberately generous — the lexicon holds lemmas, so `cats` is not in it, and a distractor
// that spells `cats` is a second right answer to a child whatever the lexicon says.

const MEMO = new Map()
const memo = (key, build) => {
  if (!MEMO.has(key)) MEMO.set(key, build())
  return MEMO.get(key)
}

const plainWord = (w) => /^[a-z]+$/.test(w) && !BANNED.has(w) && !SPELLING[w]

/** Is this string an English word in any form a child would recognise — lemma or inflection?
 *  Used to disqualify distractors, so it leans towards yes. */
function anyWord(w) {
  if (!w || BANNED.has(w)) return !!w && w in WORD_Z
  if (w in WORD_Z) return true
  const base = [
    w.endsWith('s') && w.slice(0, -1), w.endsWith('es') && w.slice(0, -2),
    w.endsWith('ies') && w.slice(0, -3) + 'y', w.endsWith('ed') && w.slice(0, -2),
    w.endsWith('ed') && w.slice(0, -1), w.endsWith('ing') && w.slice(0, -3),
    w.endsWith('ing') && w.slice(0, -3) + 'e', w.endsWith('er') && w.slice(0, -2),
    w.endsWith('er') && w.slice(0, -1), w.endsWith('est') && w.slice(0, -3),
    w.endsWith('ly') && w.slice(0, -2),
  ]
  return base.some(b => b && b.length >= 2 && b in WORD_Z)
}

/** Short words a child reads, for building letter puzzles out of.
 *
 *  In the youngest band this is Dale-Chall and nothing else — not `familiar()`, which also lets
 *  in any concrete noun. That escape is right for a meaning question, where `saucepan` is a
 *  word a child knows; it is wrong here, where the puzzle picks words by their LETTERS and so
 *  finds every short word the lexicon has. The first sample unscrambled ANCT into `cant` and
 *  put `mike` on an alphabetical-order line. */
const kidWords = (band, min, max, bar = band.answer) => memo(
  `kid|${bar}|${min}|${max}|${band.familiarOnly ? 1 : 0}`,
  () => Object.keys(WORD_Z).filter(w => plainWord(w) && w.length >= min && w.length <= max
    && z(w) >= bar && (!band.familiarOnly || FAMILIAR_SET.has(w))))

const letterKey = (w) => [...w].sort().join('')

/** How many letters two words share, counted with repeats. */
function sharedCount(a, b) {
  const pool = [...b]
  let n = 0
  for (const ch of a) {
    const i = pool.indexOf(ch)
    if (i >= 0) { n++; pool.splice(i, 1) }
  }
  return n
}

/** Can `small` be spelled from the letters of `big`, each letter used once? */
const spellableFrom = (small, big) => sharedCount(small, big) === small.length

const ALPHA = 'abcdefghijklmnopqrstuvwxyz'

/** A result row shaped like every other generator's. */
function finish(r, type, seed, prompt, answers, distractors, rule, count) {
  const rows = [
    ...answers.map(text => ({ text, why: null })),
    ...distractors.slice(0, count - answers.length),
  ]
  if (rows.length < count) return null
  const shuffled = shuffle(r, rows)
  return {
    seed, band: null, type, stem_key: STEM_KEYS[type],
    prompt,
    options: shuffled,
    correct: shuffled.map((o, i) => (o.why === null ? i : -1)).filter(i => i >= 0),
    pick: answers.length,
    rule,
  }
}

function genAnagramPair(r, band, seed) {
  // "Underline the two words which are made from the same letters. TAR: ATE TAR TEA ALE ARE."
  // The wrong three are the book's kind too: each one a letter away from the pair, so the child
  // has to check the letters rather than notice which words look alike.
  const words = kidWords(band, 3, 5)
  const groups = memo(`anagram|${band.answer}|${band.familiarOnly}`, () => {
    const m = new Map()
    for (const w of words) {
      const k = letterKey(w)
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(w)
    }
    return [...m.values()].filter(g => g.length >= 2)
  })
  if (!groups.length) return null
  const [a, b] = shuffle(r, pickOne(r, groups))
  const key = letterKey(a)
  const near = shuffle(r, words.filter(w => w.length === a.length && letterKey(w) !== key
    && sharedCount(w, a) >= a.length - 1))
  const picked = []
  for (const w of near) {
    if (picked.length >= 3) break
    // No second pair among the wrong three, or the question has two answers.
    if (picked.some(p => letterKey(p) === letterKey(w))) continue
    if (sameWordDifferentEnding(w, a) || sameWordDifferentEnding(w, b)) continue
    picked.push(w)
  }
  if (picked.length < 3) return null
  return finish(r, 'anagram-pair', seed, {}, [a, b],
    picked.map(text => ({ text, why: 'one-letter-different' })),
    { kind: 'anagram-pair', words: [a, b] }, 5)
}

function genLetterCode(r, band, seed) {
  // "If the code for TABLE is 1 2 3 4 5, what are the codes for BAT, EAT, LATE?" and the other
  // way round: "The letters SADM are 1 2 3 4 in code. What does 1 2 3 stand for?"
  const keys = kidWords(band, 4, 6).filter(w => new Set(w).size === w.length)
  if (!keys.length) return null
  const key = pickOne(r, keys)
  const letters = new Set(key)
  const targets = kidWords(band, 3, 5).filter(w => w !== key
    && [...w].every(c => letters.has(c)) && !sameWordDifferentEnding(w, key))
  if (targets.length < 3) return null
  const code = (w) => [...w].map(c => key.indexOf(c) + 1).join(' ')
  const decode = targets.length >= 5 && r() < 0.5

  if (decode) {
    const picks = []
    for (const w of shuffle(r, targets)) {
      if (picks.length >= 5) break
      if (picks.some(p => sameWordDifferentEnding(p, w))) continue
      picks.push(w)
    }
    if (picks.length < 5) return null
    const [answer, ...rest] = picks
    return finish(r, 'letter-code', seed,
      { key: key.toUpperCase(), keyCode: code(key), code: code(answer), decode: true },
      [answer], rest.map(text => ({ text, why: 'other-code' })),
      { kind: 'letter-code', key, word: answer, decode: true }, 5)
  }

  const answer = pickOne(r, targets)
  const right = code(answer)
  const digits = right.split(' ')
  const seen = new Set([right])
  const wrong = []
  const tryAdd = (arr, why) => {
    const s = arr.join(' ')
    if (seen.has(s)) return
    seen.add(s)
    wrong.push({ text: s, why })
  }
  // The book's traps are the ones a child makes: the right digits in the wrong order, and a
  // digit read off the neighbouring letter.
  tryAdd([...digits].reverse(), 'wrong-order')
  for (let i = 0; i + 1 < digits.length; i++) {
    const d = [...digits]
    ;[d[i], d[i + 1]] = [d[i + 1], d[i]]
    tryAdd(d, 'wrong-order')
  }
  for (let i = 0; i < digits.length; i++) {
    for (const delta of [1, -1]) {
      const v = Number(digits[i]) + delta
      if (v < 1 || v > key.length) continue
      const d = [...digits]
      d[i] = String(v)
      tryAdd(d, 'next-letter')
    }
  }
  if (wrong.length < 4) return null
  return finish(r, 'letter-code', seed,
    { key: key.toUpperCase(), keyCode: code(key), word: answer.toUpperCase() },
    [right], shuffle(r, wrong), { kind: 'letter-code', key, word: answer, decode: false }, 5)
}

function genFrontLetter(r, band, seed) {
  // "Which one letter can be added to the front of all of these words to make new words?
  // _aste _ind _ish _ater" — w. The pieces are not words themselves and do not need to be.
  const byLetter = memo(`front|${band.answer}|${band.familiarOnly}`, () => {
    const m = new Map()
    for (const w of kidWords(band, 4, 6)) {
      const tail = w.slice(1)
      if (BANNED.has(tail)) continue
      if (!m.has(w[0])) m.set(w[0], [])
      m.get(w[0]).push(tail)
    }
    return m
  })
  const letters = [...byLetter.keys()].filter(l => byLetter.get(l).length >= 8)
  if (!letters.length) return null
  const L = pickOne(r, letters)
  const tails = shuffle(r, byLetter.get(L)).slice(0, 4)
  const fits = (m) => tails.filter(t => anyWord(m + t)).length
  // The traps first: a letter that makes a word with two or three of the four is the one a
  // child picks after checking only the first piece.
  const pool = shuffle(r, ALPHA.split('').filter(m => m !== L && fits(m) < 4))
  const traps = pool.filter(m => fits(m) >= 2)
  const rest = pool.filter(m => fits(m) < 2)
  const distractors = [...traps.map(text => ({ text, why: 'fits-some' })),
    ...rest.map(text => ({ text, why: 'not-a-word' }))]
  return finish(r, 'front-letter', seed, { tails }, [L], distractors,
    { kind: 'front-letter', letter: L, words: tails.map(t => L + t) }, 5)
}

function genAlphaOrder(r, band, seed) {
  // "In each line, underline the word which would come third if the words were placed in
  // alphabetical order." At 7-8 the five start with different letters, as the book's first
  // lines do; in the 10-11 English book they share their first three letters (procure,
  // procession, proclaim, proceed, process), which is where the skill actually lives.
  const shared = band.alphaShared || 0
  let words
  if (!shared) {
    const pool = kidWords(band, 3, 7)
    words = []
    for (const w of shuffle(r, pool)) {
      if (words.length >= 5) break
      if (words.some(x => x[0] === w[0] || sameWordDifferentEnding(x, w))) continue
      words.push(w)
    }
  } else {
    const groups = memo(`alpha|${shared}|${band.option}`, () => {
      const m = new Map()
      for (const w of kidWords(band, shared + 3, 11, band.answer)) {
        const k = w.slice(0, shared)
        if (!m.has(k)) m.set(k, [])
        m.get(k).push(w)
      }
      return [...m.values()].filter(g => g.length >= 5)
    })
    if (!groups.length) return null
    words = []
    for (const w of shuffle(r, pickOne(r, groups))) {
      if (words.length >= 5) break
      if (words.some(x => x.startsWith(w) || w.startsWith(x))) continue
      words.push(w)
    }
  }
  if (words.length < 5) return null
  const nth = 2 + Math.floor(r() * 3)
  const sorted = [...words].sort()
  const answer = sorted[nth - 1]
  return finish(r, 'alpha-order', seed, { nth }, [answer],
    words.filter(w => w !== answer).map(text => ({ text, why: 'wrong-place' })),
    { kind: 'alpha-order', nth, order: sorted }, 5)
}

function genJoinLetter(r, band, seed) {
  // "Find the letter which will end the first word and start the second word. peac (h) ome."
  const words = kidWords(band, 3, 5)
  const starts = memo(`starts|${band.answer}|${band.familiarOnly}`, () => {
    const m = new Map()
    for (const w of words) {
      if (!m.has(w[0])) m.set(w[0], [])
      m.get(w[0]).push(w)
    }
    return m
  })
  const first = pickOne(r, words)
  const L = first.slice(-1)
  const second = pickOne(r, (starts.get(L) || []).filter(w => w !== first))
  if (!second) return null
  const left = first.slice(0, -1)
  const right = second.slice(1)
  if (left.length < 2 || right.length < 2 || BANNED.has(left) || BANNED.has(right)) return null
  const both = (m) => anyWord(left + m) && anyWord(m + right)
  const pool = shuffle(r, ALPHA.split('').filter(m => m !== L && !both(m)))
  const halfway = pool.filter(m => anyWord(left + m) || anyWord(m + right))
  const rest = pool.filter(m => !anyWord(left + m) && !anyWord(m + right))
  return finish(r, 'join-letter', seed, { left, right }, [L],
    [...halfway.map(text => ({ text, why: 'fits-one-side' })),
      ...rest.map(text => ({ text, why: 'not-a-word' }))],
    { kind: 'join-letter', words: [first, second] }, 5)
}

// ── change-pattern: "bind, hind  bare, hare  but, ?" ──────────────────────────────────────
// Every rule a pair of words could be following, so a question can prove its pattern is the
// only reading of the two examples. Positions are counted from both ends, because `pit → pot`
// is "change the second letter" and also "change the middle letter", and on a four-letter
// third word those two disagree.
function rulesOf(a, b) {
  const out = []
  if (a.length === b.length) {
    const diff = [...a].map((c, i) => (c !== b[i] ? i : -1)).filter(i => i >= 0)
    if (diff.length === 1) {
      const i = diff[0]
      out.push(`sub:${i}:${a[i]}:${b[i]}`, `subr:${a.length - 1 - i}:${a[i]}:${b[i]}`)
    }
  }
  if (b.length === a.length + 1) {
    for (let i = 0; i <= a.length; i++) {
      if (a.slice(0, i) + b[i] + a.slice(i) === b) {
        out.push(`ins:${i}:${b[i]}`, `insr:${a.length - i}:${b[i]}`)
      }
    }
  }
  if (a.length === b.length + 1 && a.slice(1) === b) out.push('drop')
  if (a.length > 2 && [...a].reverse().join('') === b) out.push('rev')
  return out
}

function applyRule(rule, w) {
  const [kind, n, x, y] = rule.split(':')
  const i = Number(n)
  if (kind === 'sub') return w[i] === x ? w.slice(0, i) + y + w.slice(i + 1) : null
  if (kind === 'subr') {
    const j = w.length - 1 - i
    return j >= 0 && w[j] === x ? w.slice(0, j) + y + w.slice(j + 1) : null
  }
  if (kind === 'ins') return i <= w.length ? w.slice(0, i) + x + w.slice(i) : null
  if (kind === 'insr') {
    const j = w.length - i
    return j >= 0 ? w.slice(0, j) + x + w.slice(j) : null
  }
  if (kind === 'drop') return w.slice(1)
  if (kind === 'rev') return [...w].reverse().join('')
  return null
}

function genChangePattern(r, band, seed) {
  // "Change the first word of the third pair in the same way as the other pairs to give a new
  // word." pit → pot, lit → lot, file → ? The four changes the book makes: one letter swapped
  // for another in the same place, one letter added, the first letter dropped, and the word
  // turned backwards.
  const words = kidWords(band, 3, 5)
  const set = new Set(words)
  const byRule = memo(`change|${band.answer}|${band.familiarOnly}`, () => {
    const m = new Map()
    const add = (rule, a, b) => {
      if (!m.has(rule)) m.set(rule, [])
      m.get(rule).push([a, b])
    }
    for (const a of words) {
      for (let i = 0; i < a.length; i++) {
        for (const c of ALPHA) {
          if (c === a[i]) continue
          const b = a.slice(0, i) + c + a.slice(i + 1)
          if (set.has(b)) add(`sub:${i}:${a[i]}:${c}`, a, b)
        }
      }
      for (let i = 0; i <= a.length; i++) {
        for (const c of ALPHA) {
          const b = a.slice(0, i) + c + a.slice(i)
          if (set.has(b)) add(`ins:${i}:${c}`, a, b)
        }
      }
      if (set.has(a.slice(1)) && a.length >= 4) add('drop', a, a.slice(1))
      const rev = [...a].reverse().join('')
      if (rev !== a && set.has(rev)) add('rev', a, rev)
    }
    return [...m.entries()].filter(([, pairs]) => pairs.length >= 3)
  })
  if (!byRule.length) return null
  const [rule, pairs] = pickOne(r, byRule)
  const [p1, p2, p3] = shuffle(r, pairs)
  if (new Set([p1[0], p2[0], p3[0], p1[1], p2[1], p3[1]]).size < 6) return null
  // Every rule both examples obey, applied to the third word. If two of them make different
  // real words, the examples do not settle the pattern and the question has two answers.
  const shared = rulesOf(...p1).filter(x => rulesOf(...p2).includes(x))
  const readings = new Set(shared.map(x => applyRule(x, p3[0])).filter(w => w && anyWord(w)))
  if (readings.size !== 1 || !readings.has(p3[1])) return null

  const x = p3[0]
  const answer = p3[1]
  const candidates = new Set()
  // Other one-letter changes to the third word: right idea, wrong letter or wrong place.
  for (let i = 0; i < x.length; i++) {
    for (const c of ALPHA) {
      const w = x.slice(0, i) + c + x.slice(i + 1)
      if (w !== x && set.has(w)) candidates.add(w)
    }
  }
  for (const w of words) if (w !== x && letterKey(w) === letterKey(x)) candidates.add(w)
  candidates.delete(answer)
  const distractors = shuffle(r, [...candidates]).filter(w => !readings.has(w)
    && !sameWordDifferentEnding(w, answer)).map(text => ({ text, why: 'other-change' }))
  return finish(r, 'change-pattern', seed,
    { pairs: [p1, p2], word: x }, [answer], distractors,
    { kind: 'change-pattern', rule, word: x }, 5)
}

function genWordLadder(r, band, seed) {
  // "Change the first word into the last word, by changing one letter at a time and making a
  // new, different word in the middle. TEN → TIN → FIN."
  const words = kidWords(band, 3, 4)
  const nb = memo(`ladder|${band.answer}|${band.familiarOnly}`, () => {
    const set = new Set(words)
    const m = new Map()
    for (const a of words) {
      const out = []
      for (let i = 0; i < a.length; i++) {
        for (const c of ALPHA) {
          const b = a.slice(0, i) + c + a.slice(i + 1)
          if (b !== a && set.has(b)) out.push(b)
        }
      }
      m.set(a, out)
    }
    return m
  })
  const s = pickOne(r, words)
  const mid = pickOne(r, nb.get(s) || [])
  if (!mid) return null
  const diffAt = (a, b) => [...a].findIndex((c, i) => c !== b[i])
  const ends = (nb.get(mid) || []).filter(e => e !== s && diffAt(s, mid) !== diffAt(mid, e)
    && [...s].filter((c, i) => c !== e[i]).length === 2)
  const e = pickOne(r, ends)
  if (!e) return null
  const one = (a, b) => a.length === b.length && [...a].filter((c, i) => c !== b[i]).length === 1
  const bridges = (w) => one(s, w) && one(w, e)
  const fromStart = (nb.get(s) || []).filter(w => w !== e && !bridges(w))
  const toEnd = (nb.get(e) || []).filter(w => w !== s && !bridges(w))
  const distractors = [
    ...shuffle(r, fromStart).map(text => ({ text, why: 'only-from-first' })),
    ...shuffle(r, toEnd).map(text => ({ text, why: 'only-to-last' })),
  ]
  const seen = new Set([mid, s, e])
  const uniq = distractors.filter(d => (seen.has(d.text) ? false : seen.add(d.text)))
  const mixed = shuffle(r, uniq).slice(0, 3)
  if (mixed.length < 3) return null
  return finish(r, 'word-ladder', seed, { from: s, to: e }, [mid], mixed,
    { kind: 'word-ladder', from: s, to: e, middle: mid }, 4)
}

function genNotFromLetters(r, band, seed) {
  // "Underline the one word which cannot be made from the letters of the word in capital
  // letters. HEART: the rat rot tar" — `rot`. The odd one is always ONE letter short of being
  // spellable, as the book's is, so it cannot be spotted by length or by look.
  const bigs = kidWords(band, 6, 9)
  const smalls = kidWords(band, 3, 5)
  const big = pickOne(r, bigs)
  const can = shuffle(r, smalls.filter(w => spellableFrom(w, big) && !sameWordDifferentEnding(w, big)))
  const inside = []
  for (const w of can) {
    if (inside.length >= 4) break
    if (inside.some(x => sameWordDifferentEnding(x, w))) continue
    inside.push(w)
  }
  if (inside.length < 4) return null
  const cannot = shuffle(r, smalls.filter(w => !spellableFrom(w, big)
    && sharedCount(w, big) === w.length - 1 && !inside.some(x => sameWordDifferentEnding(x, w))))
  const outsider = cannot[0]
  if (!outsider) return null
  return finish(r, 'not-from-letters', seed, { word: big }, [outsider],
    inside.map(text => ({ text, why: 'can-be-made' })),
    { kind: 'not-from-letters', word: big }, 5)
}

// Letter patterns, as the book writes them: "AB is to CD as EF is to ?", "B is to D as F is
// to ?", "BA is to DC", "AZ is to BY as CX is to ?", "A2 is to B3 as C4 is to ?".
const LETTER_PATTERNS = [
  { name: 'pair', make: (i) => ALPHA[i] + ALPHA[i + 1], span: 1 },
  { name: 'single', make: (i) => ALPHA[i], span: 0 },
  { name: 'back-pair', make: (i) => ALPHA[i + 1] + ALPHA[i], span: 1 },
  { name: 'mirror', make: (i) => ALPHA[i] + ALPHA[25 - i], span: 0, max: 12 },
  { name: 'number', make: (i) => ALPHA[i] + String(i + 2), span: 0, max: 9 },
]

function genLetterAnalogy(r, band, seed) {
  // "Fill in the missing letters. The alphabet has been written out to help you."
  const pat = pickOne(r, LETTER_PATTERNS)
  const step = pat.name === 'mirror' || pat.name === 'number' ? 1 : 1 + Math.floor(r() * 3)
  // The highest start a pattern can take and still be letters: a pair needs the letter after.
  const last = Math.min(25 - pat.span, pat.max ?? 25)
  const room = last - step
  if (room < 2) return null
  const p = Math.floor(r() * (room + 1))
  let q = Math.floor(r() * (room + 1))
  if (q === p) q = (p + step + 1) % (room + 1)
  if (q === p) return null
  const a = pat.make(p).toUpperCase()
  const b = pat.make(p + step).toUpperCase()
  const c = pat.make(q).toUpperCase()
  const answer = pat.make(q + step).toUpperCase()
  // A pattern that lands back on its own example ("PO is to SR as ML is to PO") is correct and
  // reads as a trick.
  if (answer === a || answer === b) return null
  const near = new Set()
  for (const d of [-1, 1, 2]) {
    const i = q + step + d
    if (i >= 0 && i <= last) near.add(pat.make(i).toUpperCase())
  }
  if (answer.length === 2 && /^[A-Z]{2}$/.test(answer)) near.add(answer[1] + answer[0])
  near.add(c)
  for (const x of [answer, a, b]) near.delete(x)
  return finish(r, 'letter-analogy', seed, { a, b, c }, [answer],
    shuffle(r, [...near]).map(text => ({ text, why: 'off-by-one' })),
    { kind: 'letter-analogy', pattern: pat.name, step, q }, 4)
}

function genAnalogy(r, band, seed) {
  // "Complete the following expressions by underlining the missing word. Frog is to tadpole as
  // swan is to (duckling, baby, cygnet)." The book's wrong answers are the ones this builds:
  // the same relation for another animal (duckling), a word too general to be it (baby), and
  // the word itself (dog, when the question was dog's young).
  const names = Object.keys(RELATIONS)
  const rel = pickOne(r, names)
  const table = RELATIONS[rel]
  const keys = shuffle(r, Object.keys(table))
  if (keys.length < 3) return null
  const [a, b] = keys
  const A = pickOne(r, table[a])
  const accepted = new Set(table[b])
  const B = pickOne(r, table[b])
  if (table[a].some(x => accepted.has(x))) return null
  const wrong = []
  const seen = new Set([B, ...accepted])
  const add = (text, why) => {
    if (!text || seen.has(text)) return
    seen.add(text)
    wrong.push({ text, why })
  }
  // The same word, or what the same word is in ANOTHER relation: `bark` for a dog's young.
  for (const other of shuffle(r, names)) {
    if (other !== rel && RELATIONS[other][b]) add(pickOne(r, RELATIONS[other][b]), 'other-relation')
  }
  if (rel !== 'opposite') add(b, 'the-same-word')
  for (const k of keys.slice(2)) add(pickOne(r, table[k]), 'same-relation-other-word')
  if (wrong.length < 3) return null
  return finish(r, 'analogy', seed, { a, A, b }, [B], wrong.slice(0, 3),
    { kind: 'analogy', relation: rel, word: b }, 4)
}

function genRhymeSynonym(r, band, seed) {
  // "Find a word that is similar in meaning to the word in capital letters and that rhymes with
  // the second word. CABLE, tyre → wire." Two conditions, so two traps: a word that rhymes but
  // means something else, and a word from another clue that does not rhyme. The clue and its
  // answer come from a hand-written table (englishTables.js explains why); the rhyming cue is
  // drawn from the answer's rhyme group, so the same clue is asked with a different second word.
  const v = band.variety
  const table = RHYME_GROUPS[v]
  const ok = (w) => z(w) >= band.filler && plainWord(w) && (!band.familiarOnly || FAMILIAR_SET.has(w))
    && (RIMES[v]?.[w] || []).length === 1
  const [clue, answer] = pickOne(r, RHYME_CLUES)
  const keys = RIMES[v]?.[answer] || []
  if (keys.length !== 1) return null
  const rhymers = (table[keys[0]] || []).filter(w => ok(w) && w !== answer
    && !sameWordDifferentEnding(w, answer) && !related(w, answer) && !sharesNeighbour(w, answer))
  if (rhymers.length < 2) return null
  const [cue, ...others] = shuffle(r, rhymers)
  const accepted = new Set(RHYME_CLUES.filter(([c]) => c === clue).map(([, a]) => a))
  const soundOnly = others.slice(0, 2).map(text => ({ text, why: 'rhymes-only' }))
  const otherAnswers = shuffle(r, RHYME_CLUES.map(([, a]) => a)).filter(w => !accepted.has(w)
    && !couldPassForRhyme(w, cue, v) && !related(w, answer))
  const distractors = [...soundOnly]
  for (const w of otherAnswers) {
    if (distractors.length >= 4) break
    if (distractors.some(d => d.text === w)) continue
    // This word answers another clue; it does not mean the current clue. Calling it
    // "right meaning, no rhyme" made the help panel teach a false synonym.
    distractors.push({ text: w, why: 'unrelated' })
  }
  return finish(r, 'rhyme-synonym', seed, { word: clue, rhyme: cue }, [answer], distractors,
    { kind: 'rhyme-synonym', clue, rhyme: cue, variety: v }, 5)
}

function genCompoundFront(r, band, seed) {
  // "Find a word that can be put in front of each of the following words to make new, compound
  // words. CAKE CUP POT ROOM" — TEA.
  const heads = memo(`compound|${band.answer}|${band.option}|${band.familiarOnly}`, () => {
    // The head is the answer and comes from the strict list. The tails are only read, so they
    // may be any word a child of the band knows — Dale-Chall alone left 29 usable heads.
    const short = new Set(kidWords(band, 3, 6))
    const readable = (w) => plainWord(w) && z(w) >= band.answer && (!band.familiarOnly || familiar(w))
    const m = new Map()
    for (const w of Object.keys(WORD_Z)) {
      if (!plainWord(w) || w.length < 6 || w.length > 11 || z(w) < band.option) continue
      for (let i = 3; i <= w.length - 3; i++) {
        const head = w.slice(0, i)
        const tail = w.slice(i)
        if (!short.has(head) || !readable(tail)) continue
        if (!m.has(head)) m.set(head, new Set())
        m.get(head).add(tail)
      }
    }
    return [...m.entries()].map(([h, t]) => [h, [...t]]).filter(([, t]) => t.length >= 4)
  })
  if (heads.length < 5) return null
  const [head, tails] = pickOne(r, heads)
  const shown = shuffle(r, tails).slice(0, 4)
  const makes = (h) => shown.filter(t => (h + t) in WORD_Z).length
  const others = shuffle(r, heads.map(([h]) => h).filter(h => h !== head && makes(h) < 4))
  const traps = others.filter(h => makes(h) >= 1).map(text => ({ text, why: 'fits-some' }))
  const rest = others.filter(h => makes(h) === 0).map(text => ({ text, why: 'unrelated' }))
  return finish(r, 'compound-front', seed, { tails: shown }, [head], [...traps, ...rest],
    { kind: 'compound-front', head, words: shown.map(t => head + t) }, 5)
}

function genPairMeaning(r, band, seed) {
  // "Underline the pair of words most similar in meaning: come, go / roam, wander / fear, fare"
  // and "most opposite in meaning: cup, mug / coffee, milk / hot, cold". The book's wrong pairs
  // are the useful half: an opposite pair against a same-meaning question, two things of one
  // kind (coffee, milk), and two words that only SOUND alike (fear, fare).
  const { antonyms } = index()
  const opposite = r() < 0.5
  const kid = (w) => askable(band, w) && plainWord(w)
  // Both halves of the RIGHT pair come from the strict list and a high frequency bar. WordNet's
  // relations are made for every sense of a word, and a pair shown with no sentence is read in
  // its commonest one: its antonyms offered `lie, sit` as opposites, and its synonyms `check,
  // contain`. The opposites come from the hand table for the same reason.
  const synPairs = memo('curated-syn-pairs', () => PAIR_SYNONYMS.filter(([a, b]) =>
    plainWord(a) && plainWord(b)))
  const antPairs = memo('ant-pairs', () => PAIR_ANTONYMS)
  const catPairs = memo(`cat-pairs|${band.answer}|${band.familiarOnly}`, () => {
    const out = []
    for (const [, , members] of CATEGORIES) {
      const ms = members.filter(kid)
      for (let i = 0; i + 1 < ms.length; i++) out.push([ms[i], ms[i + 1]])
    }
    return out
  })
  if (!synPairs.length || !antPairs.length || !catPairs.length) return null
  const right = pickOne(r, opposite ? antPairs : synPairs)
  const used = new Set(right)
  const clean = (p) => p.every(w => !used.has(w)) && !p.some(w => right.some(x => related(w, x)))
  const pairs = []
  const take = (pool, why) => {
    for (let i = 0; i < 20; i++) {
      const p = pickOne(r, pool)
      if (!p || !clean(p)) continue
      if (why !== 'opposite-pair' && (antonyms.get(p[0])?.has(p[1])
        || RELATIONS.opposite[p[0]]?.includes(p[1]) || RELATIONS.opposite[p[1]]?.includes(p[0]))) continue
      if (why !== 'same-meaning-pair' && related(p[0], p[1])) continue
      p.forEach(w => used.add(w))
      pairs.push({ text: `${p[0]}, ${p[1]}`, why })
      return
    }
  }
  take(opposite ? synPairs : antPairs, opposite ? 'same-meaning-pair' : 'opposite-pair')
  take(catPairs, 'same-group-pair')
  const avoid = new Set(used)
  const two = fillers(r, band, avoid, 2)
  if (two.length === 2 && !related(two[0], two[1]) && !antonyms.get(two[0])?.has(two[1])) {
    pairs.push({ text: `${two[0]}, ${two[1]}`, why: 'unrelated-pair' })
  }
  if (pairs.length < 3) return null
  return finish(r, 'pair-meaning', seed, { opposite }, [`${right[0]}, ${right[1]}`], pairs,
    { kind: 'pair-meaning', opposite, pair: right }, 4)
}

function fill(line, map) {
  return line.replace(/\{(\w+)\}/g, (_, k) => map[k])
}

function genLogicGrid(r, band, seed) {
  // "A and M use yellow paint. D and E use orange paint. A and E paint dogs. D and M paint cats.
  // Who paints yellow dogs?" Four children, split one way by the first fact and the other way by
  // the second, so every pairing of the two names exactly one of them. Or the book's other logic
  // question, the order: "Tom is smaller than Kang and Kang is smaller than Leo. Who is the
  // smallest?"
  if (r() < 0.35) {
    const scene = pickOne(r, ORDER_SCENES)
    const [x, y, w] = shuffle(r, NAMES).slice(0, 3)
    // x > y > w on the scene's `more`
    const lines = r() < 0.5
      ? [`${x} is ${scene.more} than ${y}.`, `${y} is ${scene.more} than ${w}.`]
      : [`${w} is ${scene.less} than ${y}.`, `${x} is ${scene.more} than ${y}.`]
    const askMost = r() < 0.5
    const answer = askMost ? x : w
    return finish(r, 'logic-grid', seed,
      { lines, question: `Who is the ${askMost ? scene.most : scene.least}?` },
      [answer], [x, y, w].filter(n => n !== answer).map(text => ({ text, why: 'wrong-person' })),
      { kind: 'logic-order', order: [x, y, w], most: askMost }, 3)
  }
  const scene = pickOne(r, LOGIC_SCENES)
  const [n1, n2, n3, n4] = shuffle(r, NAMES).slice(0, 4)
  const [v1a, v1b] = shuffle(r, scene.first.values)
  const [v2a, v2b] = shuffle(r, scene.second.values)
  // First fact splits {n1, n2} / {n3, n4}; the second splits {n1, n3} / {n2, n4}.
  const lines = shuffle(r, [
    fill(scene.first.line, { a: n1, b: n2, v: v1a }),
    fill(scene.first.line, { a: n3, b: n4, v: v1b }),
  ]).concat(shuffle(r, [
    fill(scene.second.line, { a: n1, b: n3, v: v2a }),
    fill(scene.second.line, { a: n2, b: n4, v: v2b }),
  ]))
  const who = { [`${v1a}|${v2a}`]: n1, [`${v1a}|${v2b}`]: n2, [`${v1b}|${v2a}`]: n3, [`${v1b}|${v2b}`]: n4 }
  const q1 = pickOne(r, [v1a, v1b])
  const q2 = pickOne(r, [v2a, v2b])
  const answer = who[`${q1}|${q2}`]
  return finish(r, 'logic-grid', seed,
    { lines, question: fill(scene.question, { v1: q1, v2: q2 }) },
    [answer], [n1, n2, n3, n4].filter(n => n !== answer).map(text => ({ text, why: 'wrong-person' })),
    { kind: 'logic-grid', who, ask: [q1, q2] }, 4)
}

function genUnscramble(r, band, seed) {
  // "Rearrange the muddled letters to make words: LELB, KEIB, HIARC, ESNP, OKHO."
  const words = kidWords(band, 4, 6).filter(w => partOfSpeech(w) === 'noun' && concrete(w))
  if (!words.length) return null
  const answer = pickOne(r, words)
  let muddled = answer
  for (let i = 0; i < 12 && (muddled === answer || anyWord(muddled)); i++) {
    muddled = shuffle(r, [...answer]).join('')
  }
  if (muddled === answer || anyWord(muddled) || BANNED.has(muddled)) return null
  const key = letterKey(answer)
  const near = shuffle(r, kidWords(band, answer.length, answer.length).filter(w =>
    letterKey(w) !== key && sharedCount(w, answer) >= answer.length - 1
    && !sameWordDifferentEnding(w, answer)))
  const picks = []
  for (const w of near) {
    if (picks.length >= 4) break
    if (picks.some(p => sameWordDifferentEnding(p, w))) continue
    picks.push(w)
  }
  return finish(r, 'unscramble', seed, { letters: muddled.toUpperCase() }, [answer],
    picks.map(text => ({ text, why: 'one-letter-different' })),
    { kind: 'unscramble', word: answer }, 5)
}

const inOrder = (w) => [...w].every((c, i) => i === 0 || w[i - 1] <= c)

function genLettersInOrder(r, band, seed) {
  // "Underline the words which have their letters in alphabetical order: DRAW BOOT LOST SPOT
  // SOCK HOST DARK LION" — boot, lost, host.
  const words = kidWords(band, 3, 5)
  const yes = words.filter(inOrder)
  const no = words.filter(w => !inOrder(w))
  if (!yes.length) return null
  const answer = pickOne(r, yes)
  // Near misses: one pair out of place, the ones that look in order at a glance.
  const nearly = (w) => {
    let breaks = 0
    for (let i = 1; i < w.length; i++) if (w[i - 1] > w[i]) breaks++
    return breaks === 1
  }
  const pool = shuffle(r, no.filter(w => w.length === answer.length || w.length === answer.length + 1))
  const traps = pool.filter(nearly).map(text => ({ text, why: 'one-out-of-order' }))
  const rest = pool.filter(w => !nearly(w)).map(text => ({ text, why: 'out-of-order' }))
  return finish(r, 'letters-in-order', seed, {}, [answer], [...traps.slice(0, 3), ...rest],
    { kind: 'letters-in-order', word: answer }, 5)
}

function genLetterSum(r, band, seed) {
  // "If a = 2, b = 3, c = 5, d = 6, find the value of c + d" and "give the answer to these
  // calculations as letters": e = 2, f = 4, g = 6, h = 8, what is g − f?
  const start = Math.floor(r() * 5) * 4
  const letters = ALPHA.slice(start, start + 4).split('')
  const asLetter = r() < 0.4
  let values
  if (asLetter) {
    const step = 1 + Math.floor(r() * 3)
    const base = 1 + Math.floor(r() * 3)
    values = letters.map((_, i) => base + step * i)
  } else {
    values = []
    while (values.length < 4) {
      const v = 1 + Math.floor(r() * 12)
      if (!values.includes(v)) values.push(v)
    }
    values.sort((a, b) => a - b)
  }
  const val = Object.fromEntries(letters.map((l, i) => [l, values[i]]))
  const pairs = []
  for (const x of letters) {
    for (const y of letters) {
      if (x === y) continue
      for (const op of ['+', '−']) {
        const res = op === '+' ? val[x] + val[y] : val[x] - val[y]
        if (res <= 0) continue
        if (asLetter && !values.includes(res)) continue
        pairs.push([x, op, y, res])
      }
    }
  }
  if (!pairs.length) return null
  const [x, op, y, res] = pickOne(r, pairs)
  const table = letters.map(l => `${l} = ${val[l]}`).join(', ')
  if (asLetter) {
    const answer = letters[values.indexOf(res)]
    return finish(r, 'letter-sum', seed, { table, sum: `${x} ${op} ${y}`, asLetter: true }, [answer],
      letters.filter(l => l !== answer).map(text => ({ text, why: 'wrong-value' })),
      { kind: 'letter-sum', val, x, op, y }, 4)
  }
  const wrong = new Set([res + 1, res - 1, op === '+' ? Math.abs(val[x] - val[y]) : val[x] + val[y], res + 2])
  wrong.delete(res)
  return finish(r, 'letter-sum', seed, { table, sum: `${x} ${op} ${y}` }, [String(res)],
    shuffle(r, [...wrong].filter(n => n > 0)).map(n => ({ text: String(n), why: 'wrong-value' })),
    { kind: 'letter-sum', val, x, op, y }, 4)
}

// ── spelling and grammar (Bond English 10-11 Book 1, and the 11+ Multiple-choice Pack 2) ─────
//
// The 10-11 English book is almost entirely WRITTEN answers — rewrite this sentence, punctuate
// that one, give a word that means. What survives the move to a choice of five is what has one
// right form and a set of predictable wrong ones, and the Multiple-choice Test Papers show
// exactly how Bond itself makes that move: "one word has been spelt incorrectly — which?",
// "choose the correct word to complete each sentence". So those are the shapes used here.
//
// Half of these are driven by the lexicon (endings, silent letters, singulars, alphabetical
// order with a shared start) and half by englishTables.js, which holds the closed facts no
// dictionary encodes: a group of lions is a pride, `could've` is not `could of`.

function genApostrophe(r, band, seed) {
  // "Rewrite each of the following, using only two words, one of which should have an
  // apostrophe. basket for a cat → cat's basket; school for girls → girls' school; hospital for
  // women → women's hospital." A regular plural ending in s takes only an apostrophe; a
  // singular ending in s still takes 's. Spelling alone cannot tell those cases apart.
  const [phrase, owner, thing, joiner, plural = false] = pickOne(r, POSSESSIVES)
  const endsS = owner.endsWith('s')
  const right = plural && endsS ? `${owner}' ${thing}` : `${owner}'s ${thing}`
  const variants = [
    [`${owner}'s ${thing}`, 'apostrophe-s-added-to-plural'],
    [`${owner} ${thing}`, 'no-apostrophe'],
    [`${owner}' ${thing}`, 'apostrophe-after-s'],
    ...(plural && endsS ? [[`${owner.slice(0, -1)}'s ${thing}`, 'singular-owner']] : []),
    ...(!plural && !endsS
      ? [[`${owner}s' ${thing}`, 'extra-s'], [`${owner}s ${thing}`, 'no-apostrophe']]
      : []),
  ]
  const seen = new Set([right])
  const wrong = []
  for (const [text, why] of shuffle(r, variants)) {
    if (seen.has(text)) continue
    seen.add(text)
    wrong.push({ text, why })
  }
  // Some singular-s rows have only two honest mistakes (`princess'`, no apostrophe), so those
  // questions deliberately show three choices rather than inventing `princesss'` as filler.
  return finish(r, 'apostrophe', seed, { phrase: `${thing} ${joiner} ${phrase}` }, [right], wrong,
    { kind: 'apostrophe', owner, thing, plural }, Math.min(5, 1 + wrong.length))
}

function genMisspelt(r, band, seed) {
  // MC Pack 2, Section 2: "One word has been spelt incorrectly. Which option shows the misspelt
  // word?" Four correctly spelled words of about the same length and difficulty around it, so
  // the wrong one is not the longest or the rarest on the line.
  const [correct, wrong] = pickOne(r, MISSPELLINGS)
  if (anyWord(wrong)) return null
  const len = correct.length
  // The four right spellings are held to the filler bar: they are there to be read and passed
  // over, and a rare one (`ironman` was the first) draws the eye away from the real mistake.
  // From Dale-Chall in every band: the first run had `mortgage` and `predecessor` beside them.
  const pool = memo('misspelt-pool', () => FAMILIAR.filter(w => plainWord(w) && w.length >= 5
    && w.length <= 13 && !MISSPELLINGS.some(([c]) => c === w)))
  const near = shuffle(r, pool.filter(w => Math.abs(w.length - len) <= 2
    && !sameWordDifferentEnding(w, correct)))
  const others = []
  for (const w of near) {
    if (others.length >= 4) break
    if (others.some(o => sameWordDifferentEnding(o, w))) continue
    others.push(w)
  }
  return finish(r, 'misspelt', seed, {}, [wrong],
    others.map(text => ({ text, why: 'spelled-right' })),
    { kind: 'misspelt', word: correct, misspelt: wrong }, 5)
}

function genEnding(r, band, seed) {
  // "Add cial or tial", "Add sure or ture", "Add ary, ery or ory", "depend_ncy, excell_nce,
  // blat_nt". The endings in a group cannot be told apart by ear, which is the whole difficulty,
  // and the check is that only one of them makes a word: `confident` is out, because
  // `confidant` is a word too.
  const groups = memo(`endings|${band.filler}`, () => {
    const out = []
    for (const group of ENDING_GROUPS) {
      for (const w of Object.keys(WORD_Z)) {
        if (!plainWord(w) || z(w) < band.filler || w.length < 6) continue
        const end = group.find(e => w.endsWith(e))
        if (!end) continue
        const stem = w.slice(0, -end.length)
        // `mis___` for `misery` and `mem___` for `memory` are correct and unreadable: too little
        // of the word is left to recognise.
        if (stem.length < 4) continue
        if (group.some(e => e !== end && anyWord(stem + e))) continue
        out.push([w, stem, end, group])
      }
    }
    return out
  })
  if (!groups.length) return null
  const [word, stem, end, group] = pickOne(r, groups)
  return finish(r, 'ending', seed, { masked: `${stem}___` }, [end],
    group.filter(e => e !== end).map(text => ({ text, why: 'sounds-the-same' })),
    { kind: 'ending', word }, group.length)
}

function genIeEi(r, band, seed) {
  // "Add ie or ei to each of these to make a word: c__ling, __ght, sh__ld, rec__ve, ach__ve."
  const words = memo(`ieei|${band.filler}`, () => Object.keys(WORD_Z).filter(w => plainWord(w)
    && z(w) >= band.filler && w.length >= 4 && (w.match(/ie|ei/g) || []).length === 1
    // Only where the two letters are ONE sound, which is what the rule is about. In `alien`,
    // `quiet`, `science` and `cookie` they are two sounds or an ending, and no rule helps.
    && !/ie$|ien|iet|ienc|eing|eity|eist/.test(w)
    && !anyWord(w.replace(/ie|ei/, m => (m === 'ie' ? 'ei' : 'ie')))))
  if (!words.length) return null
  const word = pickOne(r, words)
  const at = word.search(/ie|ei/)
  const pair = word.slice(at, at + 2)
  return finish(r, 'ie-ei', seed, { masked: word.slice(0, at) + '__' + word.slice(at + 2) }, [pair],
    [{ text: pair === 'ie' ? 'ei' : 'ie', why: 'swapped' }], { kind: 'ie-ei', word }, 2)
}

function genSilentLetter(r, band, seed) {
  // "Rewrite each word, adding the missing silent letter: hym, nock, lim, autum, bom."
  // The answer bar, with the rare ones cut by hand below it: `_rought` for `wrought` was the
  // first one out, and the filler bar left too few words for the type to vary.
  const words = memo(`silent|${band.answer}`, () => {
    const out = []
    for (const w of Object.keys(WORD_Z)) {
      if (!plainWord(w) || z(w) < band.answer || w.length < 4) continue
      for (const p of SILENT_PATTERNS) {
        if (!p.re.test(w)) continue
        const at = p.at < 0 ? w.length + p.at : p.at
        if (w[at] !== p.letter) continue
        out.push([w, at])
        break
      }
    }
    return out
  })
  if (!words.length) return null
  const [word, at] = pickOne(r, words)
  const masked = word.slice(0, at) + '_' + word.slice(at + 1)
  const shown = masked.replace('_', '')
  if (anyWord(shown)) return null
  const fits = (c) => anyWord(masked.replace('_', c))
  const pool = shuffle(r, 'bcdghklmnptw'.split('').filter(c => c !== word[at] && !fits(c)))
  return finish(r, 'silent-letter', seed, { masked }, [word[at]],
    pool.map(text => ({ text, why: 'not-a-word' })), { kind: 'silent-letter', word }, 5)
}

function genContraction(r, band, seed) {
  // "Write the two words each contraction stands for" and "Write the contraction for each of
  // these". The wrong answers are written into the table because they are specific: `could of`.
  const [short, full, wrongFull] = pickOne(r, CONTRACTIONS)
  const ambiguous = new Set(["I'd", "she's", "who's", "there's", "what's", "she'd"])
  if (!ambiguous.has(short) && r() < 0.5) {
    return finish(r, 'contraction', seed, { word: short, expand: true }, [full],
      wrongFull.map(text => ({ text, why: 'other-words' })),
      { kind: 'contraction', short, full }, 4)
  }
  // The other way: the apostrophe in the wrong place, or missing.
  const letters = short.replace("'", '')
  const variants = new Set()
  for (let i = 1; i < letters.length; i++) variants.add(letters.slice(0, i) + "'" + letters.slice(i))
  variants.add(letters)
  variants.delete(short)
  const wrong = shuffle(r, [...variants]).filter(v => !CONTRACTIONS.some(([s]) => s === v))
    .map(text => ({ text, why: 'apostrophe-in-the-wrong-place' }))
  const item = finish(r, 'contraction', seed, { word: full, expand: false }, [short], wrong,
    { kind: 'contraction', short, full }, 4)
  // The other direction asks the other question, and the instruction has to say so.
  if (item) item.stem_key = 'eng_stem_contraction_short'
  return item
}

function genHomophoneCloze(r, band, seed) {
  // "Write there, their or they're in each gap." The whole set is on offer, and the sentences
  // are written so that only one member reads.
  const [sentence, answer] = pickOne(r, HOMOPHONE_CLOZE)
  const set = Object.values(HOMOPHONE_SETS).find(s => s.includes(answer))
  if (!set) return null
  return finish(r, 'homophone-cloze', seed, { sentence }, [answer],
    set.filter(w => w !== answer).map(text => ({ text, why: 'sounds-the-same' })),
    { kind: 'homophone-cloze', sentence, fill: answer }, set.length)
}

function genGrammarCloze(r, band, seed) {
  // MC Pack 2, Section 4: "Choose the correct word or short phrase from the lists below to
  // complete each sentence. Each sentence must make sense and use Standard English."
  const [sentence, answer, wrongs] = pickOne(r, GRAMMAR_CLOZE)
  return finish(r, 'grammar-cloze', seed, { sentence }, [answer],
    wrongs.map(text => ({ text, why: 'not-standard-english' })),
    { kind: 'grammar-cloze', sentence, fill: answer }, 4)
}

function genComparative(r, band, seed) {
  // "I am going to buy this coat because it is the (cheap, more cheap, cheaper, cheapest, most
  // cheapest)." / "That idea is (silliest, more silly, most silly, more sillier, sillier) than
  // the one you had yesterday!" The five options are always the book's five: the word itself,
  // the right form, the other degree, and the two ways of doing it twice.
  const [adj, comp, sup] = pickOne(r, COMPARATIVES)
  const than = r() < 0.5
  const answer = than ? comp : sup
  const long = comp.startsWith('more ')
  const naiveComp = long ? `${adj}er` : `more ${adj}`
  const naiveSup = long ? `${adj}est` : `most ${adj}`
  const doubled = than ? (long ? `more ${adj}er` : `more ${comp}`) : (long ? `most ${adj}est` : `most ${sup}`)
  const rows = [
    [than ? sup : comp, 'wrong-degree'],
    [than ? naiveComp : naiveSup, 'wrong-way-to-compare'],
    [doubled, 'compared-twice'],
    [adj, 'not-compared'],
  ]
  const seen = new Set([answer])
  const wrong = []
  for (const [text, why] of rows) {
    if (seen.has(text)) continue
    seen.add(text)
    wrong.push({ text, why })
  }
  // The adjective is selected independently, so the frame has to work for every adjective.
  // Contextual frames produced grammatical nonsense such as “Today is younger than yesterday”
  // and “My story is stronger than yours”. These neutral frames test the form without also
  // demanding a lucky adjective–noun pairing.
  const sentence = than ? 'This one is ___ than that one.' : 'It is the ___ of them all.'
  return finish(r, 'comparative', seed, { sentence, word: adj }, [answer], wrong,
    { kind: 'comparative', word: adj, than }, 5)
}

function genSingular(r, band, seed) {
  // "Write the singular form of each word: torpedoes, calves, valleys, sheep, mice, batteries,
  // foxes, olives." The plural table read backwards, and the wrong answers are the endings
  // stripped the wrong way — `calve`, `batterie`, `torpedoe`.
  const pairs = PLURALS.filter(([a, b, rule]) => askable(band, a) && !BANNED.has(b)
    && !BAD_PLURAL_WORDS.has(a) && (!band.pluralFamiliarOnly || familiar(a))
    && b !== a && (rule !== 'latin' || band.latinPlurals))
  if (!pairs.length) return null
  const [single, plural] = pickOne(r, pairs)
  // Only the strippings this plural's ending invites: `indefe` from `indexes` is not a mistake
  // anyone makes, `calve` from `calves` and `puppie` from `puppies` are.
  const shapes = [plural.slice(0, -1), plural, plural.slice(0, -3)]
  if (plural.endsWith('es')) shapes.push(plural.slice(0, -2))
  if (plural.endsWith('ies')) shapes.push(plural.slice(0, -2), plural.slice(0, -3) + 'ey')
  if (plural.endsWith('ves')) shapes.push(plural.slice(0, -3) + 'fe', plural.slice(0, -3) + 'f', plural.slice(0, -3) + 've')
  if (!/s$/.test(plural)) shapes.push(plural + 's', plural.slice(0, -1) + 'a')
  const seen = new Set([single])
  const wrong = []
  for (const w of shuffle(r, shapes)) {
    if (!w || w.length < 2 || seen.has(w) || BANNED.has(w)) continue
    // A stripped form that is itself a word (`calve`) is a trap a child can defend.
    if (w !== plural && anyWord(w)) continue
    seen.add(w)
    wrong.push({ text: w, why: w === plural ? 'still-plural' : 'stripped-wrongly' })
  }
  return finish(r, 'singular', seed, { word: plural }, [single], wrong,
    { kind: 'singular', of: plural, single }, 4)
}

function genGender(r, band, seed) {
  // "Change the words in bold into their feminine form: son, nephew, Lord, men, Duke, hero,
  // gander." Asked in either direction when the answer is unique that way round: `lady` is the
  // feminine of both `lord` and `gentleman`, so it is never asked backwards.
  const [male, female] = pickOne(r, GENDER_PAIRS)
  const females = GENDER_PAIRS.filter(([, f]) => f === female)
  const backwards = females.length === 1 && r() < 0.35
  const ask = backwards ? female : male
  const answer = backwards ? male : female
  const accepted = new Set(GENDER_PAIRS.filter(([m, f]) => (backwards ? f === ask : m === ask))
    .map(([m, f]) => (backwards ? m : f)))
  const others = shuffle(r, GENDER_PAIRS.map(([m, f]) => (backwards ? m : f)))
    .filter(w => !accepted.has(w))
  const wrong = [...new Set(others)].slice(0, 2).map(text => ({ text, why: 'other-pair' }))
  // The rule applied blindly: -ess on everything, which is right for `host` and wrong for `duke`.
  const blind = backwards ? null : `${male}ess`
  if (blind && !accepted.has(blind)) wrong.push({ text: blind, why: 'the-rule-applied-blindly' })
  else wrong.push({ text: pickOne(r, others.slice(2)) || others[0], why: 'other-pair' })
  return finish(r, 'gender', seed, { word: ask, backwards }, [answer], wrong,
    { kind: 'gender', of: ask }, 4)
}

function genCollective(r, band, seed) {
  // "Collective nouns": a herd of cows, a gaggle of geese, a swarm of bees.
  const [noun, things] = pickOne(r, COLLECTIVES)
  const thing = pickOne(r, things)
  const accepted = new Set(COLLECTIVES.filter(([, t]) => t.includes(thing)).map(([n]) => n))
  const wrong = [...new Set(shuffle(r, COLLECTIVES.map(([n]) => n)))].filter(n => !accepted.has(n))
    .map(text => ({ text, why: 'other-group' }))
  return finish(r, 'collective', seed, { word: thing }, [noun], wrong,
    { kind: 'collective', of: thing }, 4)
}

function genProverb(r, band, seed) {
  // "Complete the following proverbs. There is no smoke without ___."
  const [sentence, answer, wrongs] = pickOne(r, PROVERBS)
  return finish(r, 'proverb', seed, { sentence }, [answer],
    wrongs.map(text => ({ text, why: 'not-the-saying' })),
    { kind: 'proverb', sentence, fill: answer }, 4)
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
  'odd-synonym': genOddSynonym,
  definition: genDefinition,
  rhyme: genRhyme,
  homophone: genHomophone,
  syllables: genSyllables,
  plural: genPlural,
  'past-tense': genPastTense,
  suffix: genSuffix,
  'prefix-antonym': genPrefixAntonym,
  'root-word': genRootWord,
  'missing-vowel': genMissingVowel,
  'anagram-pair': genAnagramPair,
  'letter-code': genLetterCode,
  'front-letter': genFrontLetter,
  'alpha-order': genAlphaOrder,
  'join-letter': genJoinLetter,
  'change-pattern': genChangePattern,
  'word-ladder': genWordLadder,
  'not-from-letters': genNotFromLetters,
  'letter-analogy': genLetterAnalogy,
  analogy: genAnalogy,
  'rhyme-synonym': genRhymeSynonym,
  'compound-front': genCompoundFront,
  'pair-meaning': genPairMeaning,
  'logic-grid': genLogicGrid,
  unscramble: genUnscramble,
  'letters-in-order': genLettersInOrder,
  'letter-sum': genLetterSum,
  apostrophe: genApostrophe,
  misspelt: genMisspelt,
  ending: genEnding,
  'ie-ei': genIeEi,
  'silent-letter': genSilentLetter,
  contraction: genContraction,
  'homophone-cloze': genHomophoneCloze,
  'grammar-cloze': genGrammarCloze,
  comparative: genComparative,
  singular: genSingular,
  gender: genGender,
  collective: genCollective,
  proverb: genProverb,
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
  // Two options that are the same word wearing different clothes — `chimpanzee/chimp`,
  // `lagoon/laguna`. Only for the types whose options are words; the letter types offer
  // letter groups, where `abi` and `aib` are not the same anything.
  // `root-word` is exempt for the opposite reason to the letter types: its answer IS the
  // stem with its endings taken off, so the check it would fail is the check it passes.
  // The new families are exempt when their options are not words standing for meanings: a code,
  // a letter, a phrase with an apostrophe, `seen` against `see` in a sentence gap, `duck`
  // against `duckling` in an analogy where offering the same word is the book's own trap.
  if (!['letter-pair', 'shared-letters', 'hidden-word', 'missing-vowel', 'prefix-antonym',
    'plural', 'past-tense', 'suffix', 'root-word', 'letter-code', 'front-letter', 'alpha-order',
    'join-letter', 'change-pattern', 'letter-analogy', 'analogy', 'pair-meaning', 'logic-grid',
    'letter-sum', ...GRAMMAR_TYPES].includes(item.type)) {
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        if (sameWordDifferentEnding(texts[i], texts[j])) {
          return `"${texts[i]}" and "${texts[j]}" are the same word`
        }
      }
    }
  }
  if (!item.correct.length) return 'no correct option'
  // One variety per question, throughout. The failure this guards against is not picking the
  // wrong spelling — it is `color` in one option and `colour` in the next.
  if (item.variety) {
    const mixed = texts.filter(t => wrongSpelling(t, item.variety))
    if (mixed.length) return `"${mixed[0]}" is the other variety's spelling`
  }
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
    const approved = PAIR_SYNONYMS.some(([a, b]) => (a === item.prompt.word && b === answers[0])
      || (b === item.prompt.word && a === answers[0]))
    if (!approved) return `"${answers[0]}" is not an approved synonym of "${item.prompt.word}"`
    for (const w of wrong) if (related(w, item.prompt.word)) return `"${w}" also means "${item.prompt.word}"`
  }
  if (item.type === 'antonym') {
    const approved = PAIR_ANTONYMS.some(([a, b]) => (a === item.prompt.word && b === answers[0])
      || (b === item.prompt.word && a === answers[0]))
    if (!approved) return `"${answers[0]}" is not an approved opposite of "${item.prompt.word}"`
    const { antonyms } = index()
    for (const w of wrong) {
      if (antonyms.get(item.prompt.word)?.has(w)) return `"${w}" is also an opposite of "${item.prompt.word}"`
    }
  }
  if (item.type === 'word-grid') {
    const { synonyms, antonyms } = index()
    const source = item.prompt.opposite ? antonyms : synonyms
    const approved = item.prompt.opposite
      ? answers.every(w => GRID_OPPOSITES[item.prompt.word]?.includes(w))
      : SYNONYM_GROUPS.some(group => group.includes(item.prompt.word)
        && answers.every(w => group.includes(w)))
    if (!approved) return 'the grid answers are not an approved relation'
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
  if (item.type === 'definition' && glossMismatch(answers[0], item.prompt.definition)) {
    return `"${answers[0]}" is not the part of speech its definition is`
  }
  if (item.type === 'definition' && BAD_DEFINITION_WORDS.has(item.rule.word)) {
    return `"${item.rule.word}" has a blocked definition record`
  }
  // Sentences screened at build time, screened again here for what the build's lists missed.
  if (item.prompt.sentence) {
    const problem = sentenceProblem(item.prompt.sentence)
    if (problem) return problem
  }
  if (item.type === 'sense') {
    if (!item.prompt.sentence.toLowerCase().includes(item.prompt.word.toLowerCase())) {
      return 'the sentence does not contain the word'
    }
    if (BAD_SENSE_PAIRS.has(`${item.prompt.word}|${answers[0]}`)) {
      return `the answer "${answers[0]}" does not replace "${item.prompt.word}" in this sentence`
    }
    if (!SENSE_ANSWERS[item.prompt.sentence]?.includes(answers[0])) {
      return `the answer "${answers[0]}" is not approved for this sentence`
    }
  }

  // ── the word-knowledge family ───────────────────────────────────────────────────────────
  // These types fail differently from the ones above. There the danger is two options that
  // MEAN the same; here it is two options that are both CORRECT ENGLISH — two spellings that
  // are each a word, two past tenses that are each used. So the checks are mechanical, and
  // that makes them absolute rather than probabilistic.
  if (item.type === 'odd-synonym') {
    const [answer] = answers
    const group = [...item.rule.group].sort()
    if (!SYNONYM_GROUPS.some(ws => [...ws].sort().every((w, i) => w === group[i]))) {
      return 'the four matching words are not an approved synonym group'
    }
    for (const w of wrong) {
      if (related(w, answer) || sharesNeighbour(w, answer)) {
        return `"${w}" and the odd one out "${answer}" share a meaning`
      }
    }
    // And the four that stay must actually share one, or there is no group to be odd against.
    const { synonyms } = index()
    for (const w of wrong) {
      if (!wrong.some(x => x !== w && synonyms.get(w)?.has(x))) return `"${w}" is in no group`
    }
  }
  if (item.type === 'rhyme') {
    const stem = item.prompt.word
    const v = item.rule.variety
    for (const w of wrong) {
      if (couldPassForRhyme(w, stem, v)) return `"${w}" could pass for a rhyme with "${stem}"`
    }
    if (!rhymes(answers[0], stem, v)) return `"${answers[0]}" does not rhyme with "${stem}" in ${v}`
  }
  if (item.type === 'homophone') {
    const group = item.rule.group
    const v = item.rule.variety
    if ([item.prompt.word, answers[0]].some(w => rimesOf(w, v).length !== 1)) {
      return 'a bare homophone word has more than one pronunciation'
    }
    for (const w of wrong) if (group.includes(w)) return `"${w}" is a homophone too`
  }
  if (item.type === 'syllables') {
    const v = item.rule.variety
    for (const w of wrong) {
      if (syllablesOf(w, v) === item.prompt.count) return `"${w}" also has ${item.prompt.count} syllables`
    }
    if (syllablesOf(answers[0], v) !== item.prompt.count) return 'the answer has the wrong syllable count'
  }
  // For plural, past tense and suffix the rule is the same and it is the strictest in the
  // file: exactly ONE option may be a word the lexicon knows. A second real word is a second
  // right answer, and these are the types where a child is being marked on spelling.
  if (item.type === 'plural' || item.type === 'past-tense' || item.type === 'suffix') {
    const real = texts.filter(t => t in WORD_Z)
    if (real.length > 1) return `${real.length} options are real words (${real.join(', ')})`
  }
  if (item.type === 'plural' && BAD_PLURAL_WORDS.has(item.rule.of)) {
    return `"${item.rule.of}" has no single unambiguous school plural`
  }
  if (item.type === 'singular' && BAD_PLURAL_WORDS.has(item.rule.single)) {
    return `"${item.rule.single}" has no single unambiguous school plural`
  }
  if (item.type === 'past-tense' && BAD_PAST_WORDS.has(item.rule.of)) {
    return `"${item.rule.of}" has no single simple-past answer here`
  }
  if (item.type === 'suffix' && BAD_SUFFIX_PAIRS.has(`${item.rule.of}|${answers[0]}`)) {
    return `"${item.rule.of}" and "${answers[0]}" are not an approved suffix pair`
  }
  if (item.type === 'prefix-antonym' && AMBIGUOUS_PREFIX_BASES.has(item.rule.of)) {
    return `"${item.rule.of}" has more than one valid prefixed form`
  }
  if (item.type === 'prefix-antonym') {
    for (const w of wrong) {
      if ((w + item.prompt.word) in WORD_Z) return `"${w}${item.prompt.word}" is also a word`
    }
  }
  if (item.type === 'root-word') {
    for (const w of wrong) {
      if (w in WORD_Z && !sameWordDifferentEnding(w, answers[0])) {
        return `"${w}" is a word too, so it could be the root`
      }
    }
  }
  if (item.type === 'missing-vowel') {
    const filled = texts.filter(v => item.prompt.masked.replace('_', v) in WORD_Z)
    if (filled.length !== 1) return `${filled.length} letters make a word`
  }
  return validateNewFamilies(item, texts, answers, wrong)
}

// ── the letter puzzles and the grammar types ─────────────────────────────────────────────
// Every one of these RECOMPUTES the answer from what is printed and counts how many options
// satisfy it. None of them asks the generator what it meant.
function validateNewFamilies(item, texts, answers, wrong) {
  const p = item.prompt
  const [answer] = answers
  const exactlyOne = (pred, what) => {
    const hits = texts.filter(pred)
    if (hits.length !== 1) return `${hits.length} options ${what} (${hits.join(', ')})`
    if (hits[0] !== answer && item.pick === 1) return `the option that ${what} is not the answer`
    return null
  }
  // A hand-written table is read once; a blocklist is maintained. Every word these types print
  // goes past the blocklist too — `hell` was a wrong answer for `he'll` and `drunk` a wrong
  // form of `drink` before this line existed.
  const printed = [...texts, p.sentence || '', p.phrase || '', ...(p.lines || [])].join(' ')
  const hit = (printed.toLowerCase().match(/[a-z]+/g) || []).find(w => BANNED.has(w))
  if (hit) return `prints the blocked word "${hit}"`
  switch (item.type) {
    case 'anagram-pair': {
      const pairs = []
      for (let i = 0; i < texts.length; i++) {
        for (let j = i + 1; j < texts.length; j++) {
          if (letterKey(texts[i]) === letterKey(texts[j])) pairs.push([texts[i], texts[j]])
        }
      }
      if (pairs.length !== 1) return `${pairs.length} pairs share their letters`
      if (!pairs[0].every(w => answers.includes(w))) return 'the pair that shares letters is not the answer'
      return null
    }
    case 'letter-pair': {
      const source = item.prompt.opposite ? PAIR_ANTONYMS : PAIR_SYNONYMS
      const approved = source.some(([a, b]) => (a === item.rule.of && b === item.rule.answer)
        || (b === item.rule.of && a === item.rule.answer))
      if (!approved) return 'the completed word is not an approved meaning pair'
      const hits = texts.filter(t => item.prompt.masked.replace(/_+/, t) in WORD_Z)
      return hits.length === 1 && hits[0] === answer
        ? null : `${hits.length} options complete the word (${hits.join(', ')})`
    }
    case 'letter-code': {
      const key = item.rule.key
      const code = (w) => [...w].map(c => key.indexOf(c) + 1).join(' ')
      if (p.decode) return exactlyOne(w => [...w].every(c => key.includes(c)) && code(w) === p.code, 'match the code')
      return exactlyOne(t => t === code(item.rule.word), 'are the code')
    }
    case 'front-letter':
      return exactlyOne(l => p.tails.every(t => anyWord(l + t)), 'start all four words')
    case 'alpha-order': {
      const sorted = [...texts].sort()
      if (sorted[p.nth - 1] !== answer) return `the answer is not word ${p.nth} in order`
      return null
    }
    case 'join-letter':
      return exactlyOne(l => anyWord(p.left + l) && anyWord(l + p.right), 'join both words')
    case 'change-pattern': {
      const [[a, b], [c, d]] = p.pairs
      const shared = rulesOf(a, b).filter(x => rulesOf(c, d).includes(x))
      if (!shared.length) return 'the two examples share no change'
      const readings = new Set(shared.map(x => applyRule(x, p.word)).filter(Boolean))
      return exactlyOne(t => readings.has(t), 'follow the pattern')
    }
    case 'word-ladder': {
      const one = (x, y) => x.length === y.length && [...x].filter((ch, i) => ch !== y[i]).length === 1
      return exactlyOne(t => one(p.from, t) && one(t, p.to), 'bridge the two words')
    }
    case 'not-from-letters':
      return exactlyOne(t => !spellableFrom(t, p.word), 'cannot be made')
    case 'letter-analogy': {
      const pat = LETTER_PATTERNS.find(x => x.name === item.rule.pattern)
      const right = pat.make(item.rule.q + item.rule.step).toUpperCase()
      if (pat.make(item.rule.q).toUpperCase() !== p.c) return 'the third term is not the pattern'
      return exactlyOne(t => t === right, 'continue the pattern')
    }
    case 'analogy': {
      const accepted = RELATIONS[item.rule.relation][p.b] || []
      if (!accepted.includes(answer)) return `"${answer}" is not what ${p.b} is`
      for (const w of wrong) if (accepted.includes(w)) return `"${w}" is right too`
      return null
    }
    case 'rhyme-synonym': {
      const v = item.rule.variety
      const accepted = RHYME_CLUES.filter(([c]) => c === p.word).map(([, a]) => a)
      if (!accepted.includes(answer) || !rhymes(answer, p.rhyme, v)) return 'the answer does not do both'
      for (const w of wrong) {
        if (accepted.includes(w)) return `"${w}" is an answer to the clue too`
        if (related(w, answer) && couldPassForRhyme(w, p.rhyme, v)) return `"${w}" means it and rhymes too`
      }
      return null
    }
    case 'compound-front':
      return exactlyOne(h => p.tails.every(t => anyWord(h + t)), 'go in front of all four')
    case 'pair-meaning': {
      const { antonyms } = index()
      const split = (t) => t.split(', ')
      const opposites = (a, b) => antonyms.get(a)?.has(b) || RELATIONS.opposite[a]?.includes(b)
        || RELATIONS.opposite[b]?.includes(a)
      if (p.opposite) return exactlyOne(t => { const [a, b] = split(t); return opposites(a, b) }, 'are opposites')
      return exactlyOne(t => { const [a, b] = split(t); return related(a, b) || sharesNeighbour(a, b) }, 'mean the same')
    }
    case 'logic-grid': {
      if (item.rule.kind === 'logic-order') {
        const [x, , w] = item.rule.order
        return answer === (item.rule.most ? x : w) ? null : 'the order does not give that answer'
      }
      const [q1, q2] = item.rule.ask
      return item.rule.who[`${q1}|${q2}`] === answer ? null : 'the facts do not give that answer'
    }
    case 'unscramble':
      return exactlyOne(t => letterKey(t) === letterKey(p.letters.toLowerCase()), 'use those letters')
    case 'letters-in-order':
      return exactlyOne(inOrder, 'are in order')
    case 'letter-sum': {
      const { val, x, op, y } = item.rule
      const res = op === '+' ? val[x] + val[y] : val[x] - val[y]
      if (p.asLetter) return exactlyOne(l => val[l] === res, 'have that value')
      return exactlyOne(t => Number(t) === res, 'are the answer')
    }
    case 'apostrophe': {
      const { owner, thing, plural } = item.rule
      const right = plural && owner.endsWith('s') ? `${owner}' ${thing}` : `${owner}'s ${thing}`
      return exactlyOne(t => t === right, 'are punctuated right')
    }
    case 'misspelt':
      return exactlyOne(t => !anyWord(t), 'are misspelt')
    case 'ending':
      return exactlyOne(e => anyWord(p.masked.replace('___', e)), 'make a word')
    case 'ie-ei':
      return exactlyOne(e => anyWord(p.masked.replace('__', e)), 'make a word')
    case 'silent-letter':
      return exactlyOne(c => anyWord(p.masked.replace('_', c)), 'make a word')
    case 'contraction': {
      const row = CONTRACTIONS.find(([sh]) => sh === item.rule.short)
      const right = p.expand ? row[1] : row[0]
      return exactlyOne(t => t === right, 'are the contraction')
    }
    case 'comparative': {
      const row = COMPARATIVES.find(([a]) => a === p.word)
      const frame = item.rule.than ? 'This one is ___ than that one.' : 'It is the ___ of them all.'
      if (p.sentence !== frame) return 'the comparative sentence does not fit every adjective'
      return exactlyOne(t => t === (item.rule.than ? row[1] : row[2]), 'are the right form')
    }
    case 'singular': {
      const hits = texts.filter(t => PLURALS.some(([a, b]) => a === t && b === p.word))
      if (hits.length !== 1 || hits[0] !== answer) return 'the singular is not uniquely on the line'
      for (const w of wrong) if (w !== p.word && anyWord(w)) return `"${w}" is a word`
      return null
    }
    case 'gender': {
      const right = GENDER_PAIRS.filter(([m, f]) => (p.backwards ? f === p.word : m === p.word))
        .map(([m, f]) => (p.backwards ? m : f))
      return exactlyOne(t => right.includes(t), 'are the pair')
    }
    case 'collective': {
      const right = COLLECTIVES.filter(([, t]) => t.includes(p.word)).map(([n]) => n)
      return exactlyOne(t => right.includes(t), 'collect it')
    }
    case 'homophone-cloze':
    case 'grammar-cloze':
    case 'proverb':
      return p.sentence.includes('___') ? null : 'the sentence has no gap'
    default:
      return null
  }
}

// ── public generation ────────────────────────────────────────────────────────────────────

export function generateItem(bandKey, type, seed, opts = {}) {
  const base = BANDS[bandKey]
  if (!base) return null
  // The variety rides on the band object rather than being threaded through every generator,
  // because every generator needs it and only three read it directly. A shallow copy per call
  // is cheap and keeps BANDS itself a constant.
  const variety = VARIETIES.includes(opts.variety) ? opts.variety : DEFAULT_VARIETY
  const band = { ...base, variety }
  const r = rng(seed)
  const kinds = type ? [type] : (opts.types || band.types)
  const kind = type || pickOne(r, kinds)
  const gen = GENERATORS[kind]
  if (!gen) return null
  const item = gen(r, band, seed)
  if (!item) return null
  item.band = bandKey
  item.variety = variety
  // Everything a question prints goes through the variety's spelling. The sound types already
  // filter it out at source; this catches the others, where a word arrives from a synset or a
  // category and carries whichever spelling WordNet happened to file it under.
  for (const o of item.options) o.text = spell(o.text, variety)
  if (item.prompt.word) item.prompt.word = spell(item.prompt.word, variety)
  // An item that fails its own check is discarded, never shown and never patched up. Same
  // contract as the puzzle engine: the caller asks again with another seed.
  if (validateItem(item)) return null
  return item
}

/** What makes two items "the same question" for the purposes of not asking it twice. */
export function itemSignature(item) {
  // The older types are keyed by their word, blanks or sentence. The letter puzzles are about
  // something else — four word-ends, two halves, a code key, a set of facts — and keying them
  // by the first three made every front-letter question with answer `p` the same question.
  const p = item.prompt
  const key = p.word || item.rule.word || (p.blanks || []).join('|') || p.sentence
    || (p.tails || p.lines || []).join('|') || [p.left, p.right, p.letters, p.phrase, p.masked,
      p.key, p.code, p.a, p.b, p.c, p.table, p.sum, p.from, p.to].filter(Boolean).join('|')
    || ''
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
