// Runs the English engine against itself, without a browser. `npm run english:check`.
//
// The same position scripts/puzzle-audit.mjs holds for the non-verbal engine: a generated bank
// has no author to review it, so the review has to be a program. Non-zero exit on any failure,
// so it can gate a commit.
//
// What it checks, and why each one is here rather than trusted:
//
//   1. every item passes validateItem          the engine already discards failures, so a
//                                              failure HERE means generateItem returned
//                                              something it should not have
//   2. every printed word clears the band bar   the quiet failure: a generator reaching below
//                                              its own band produces readable-looking
//                                              questions a child cannot read
//   3. no word the blocklist forbids            the loudest failure, and one that has already
//                                              happened once — a lowercasing bug put a racial
//                                              slur into an options list
//   4. sessions do not repeat themselves        ten questions, ten different questions
//   5. every type can still be generated        a lexicon rebuild that starves a type should
//                                              fail loudly, not silently drop it from sittings
//   6. answers are spread across the options    a bank whose answer is always (c) is not a
//                                              test of anything

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  BANDS, BAND_KEYS, BOOK_COVERAGE, VARIETIES, POOL_LIMITS,
  generateItem, generateSession, validateItem, itemSignature,
} from '../src/lib/englishTemplates.js'
import { WORD_Z, LEXICON_META, SYLLABLES, SUFFIXED } from '../src/lib/englishLexicon.generated.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PER_TYPE = Number(process.argv[2]) || 300

const failures = []
let VARIETY = ''
const fail = (msg) => failures.push(`[${VARIETY}] ${msg}`)

/**
 * The words of an item's sentence, with any hole in it filled back in first.
 *
 * Tokenising the sentence as printed is wrong, and wrong in a way that reads as an engine bug:
 * "he could not control the sin___g of his legs" tokenises to `sin`, which is on the
 * blocklist, and "pre___ably, he missed the train" to `ably`, which is Zipf 2.7. Neither word
 * is in the question — both are fragments of `sinking` and `presumably` with the middle cut
 * out. What has to be checked is the sentence the builder screened.
 */
function sentenceWords(item) {
  if (!item.prompt.sentence) return []
  const whole = item.prompt.masked && item.rule.word
    ? item.prompt.sentence.replace(item.prompt.masked, item.rule.word)
    : item.prompt.sentence
  return whole.toLowerCase().match(/[a-z']+/g) || []
}

// ── the blocklist, read from source rather than from the lexicon ──────────────────────────
// Deliberately re-read here instead of trusting that the build applied it. The build is the
// thing under test; an audit that asks the build whether the build worked is not an audit.
//
// All three sources, not just the hand-written one. The published lists carry words the
// hand-written list does not, ninety of which were in the lexicon when they were first
// compared — checking only blocklist.txt here would have left the audit blind to exactly the
// class of word it exists to catch.
const vendor = (f) => JSON.parse(readFileSync(join(ROOT, 'scripts/english/vendor', f), 'utf8'))
const cuss = vendor('cuss.json')
const BLOCKED = new Set([
  ...readFileSync(join(ROOT, 'scripts/english/blocklist.txt'), 'utf8')
    .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')),
  ...readFileSync(join(ROOT, 'scripts/english/vendor/ldnoobw-en.txt'), 'utf8')
    .split('\n').map(l => l.trim()),
  // Score 0 is context-dependent, not profane — `banana`, `church`, `blind`, `angry` — and
  // the lexicon keeps those on purpose. Asserting against them here would fail the build for
  // doing the right thing.
  ...Object.keys(cuss).filter(w => cuss[w] >= 1),
].filter(w => /^[a-z]+$/.test(w)))

// Three of the counts are per-variety objects, so they print as a pair rather than as
// "[object Object]".
const count = (v) => (typeof v === 'object'
  ? Object.entries(v).map(([a, b]) => `${a} ${b}`).join('/') : v)
console.log(`lexicon built ${LEXICON_META.built} · `
  + Object.entries(LEXICON_META.counts).map(([k, v]) => `${count(v)} ${k}`).join(' · '))
console.log(`blocklist ${BLOCKED.size} entries · ${PER_TYPE} items per type\n`)

// Both varieties, because they are not the same question bank. Three types answer
// differently in each — 880 words rhyme differently and 58 homophone groups exist in only one
// — and a bank that is sound in British is not thereby sound in American.
for (const variety of VARIETIES) {
VARIETY = variety
for (const bandKey of BAND_KEYS) {
  const band = BANDS[bandKey]
  console.log(`── ${variety} · band ${bandKey} ${'─'.repeat(45 - bandKey.length)}`)

  const positions = {}
  let total = 0

  // The band's OWN types, not every type in the module. The 9-10 and 11-12 books do not pose
  // the letter puzzles and the 8-9 book does not pose prefixes or missing vowels; sweeping all
  // of them against all three bands measured questions no child would ever be asked, and hid
  // which band is actually thin.
  for (const type of band.types) {
    let made = 0
    let tries = 0
    let rare = 0
    let blocked = 0
    const answers = new Set()
    const sigs = new Set()

    for (let s = 1; made < PER_TYPE && tries < PER_TYPE * 300; tries++, s += 7919) {
      const item = generateItem(bandKey, type, s | 0, { variety })
      if (!item) continue
      made++

      const problem = validateItem(item)
      if (problem) fail(`${bandKey}/${type} seed ${item.seed}: ${problem}`)

      sigs.add(itemSignature(item))
      for (const i of item.correct) answers.add(item.options[i].text)
      // Position drift is only a question for the a–e lines. A word grid has twelve cells and
      // two answers; there is no "option c" to drift towards.
      if (item.options.length === band.options && item.pick === 1) {
        positions[item.correct[0]] = (positions[item.correct[0]] || 0) + 1
        total++
      }

      // Two different things get printed and they are held to different rules.
      //
      // WORDS — the stem, the host words of the letter types, the words inside a sentence, and
      // the options everywhere except the letter types — must clear the band's readable bar.
      //
      // LETTER GROUPS — the options of letter-pair, shared-letters and hidden-word — are not
      // words and have no business being measured as ones. `arb`, `ane` and `alb` are all in
      // WordNet and all Zipf 2.6, and all three were flagged as unreadable vocabulary when
      // what they actually are is three letters that do not fit the blank. That is the point
      // of them.
      //
      // The blocklist applies to both, and that difference is what matters: a letter group
      // never has to be READABLE, but it must never be a word a child should not be shown.
      // Types whose options are SPELLINGS rather than words. The letter puzzles offer three
      // letters; the word-formation types offer a right spelling against wrong ones, and the
      // wrong ones are the whole question — `leaded` for the past tense of `lead`, `childs`
      // for the plural of `child`. Measuring those against the band's reading level asks
      // whether a child can read a word that is not supposed to be a word.
      // The new families add two more kinds of option that are not vocabulary: codes, letters,
      // sums and names (the letter puzzles), and forms inside a sentence (`could of`,
      // `cheapest`, `girls' school`). Neither is measured as a word. Their tables are
      // hand-written and read, which is also why `cygnet` and `gosling` — the book's own
      // answers, and rare by frequency — are not failures here.
      const letterType = ['letter-pair', 'shared-letters', 'hidden-word',
        'plural', 'past-tense', 'suffix', 'root-word', 'prefix-antonym',
        'missing-vowel', 'letter-code', 'front-letter', 'join-letter', 'letter-analogy',
        'letter-sum', 'logic-grid', 'pair-meaning', 'analogy', 'apostrophe', 'misspelt',
        'ending', 'ie-ei', 'silent-letter', 'contraction', 'homophone-cloze',
        'grammar-cloze', 'comparative', 'singular', 'gender', 'collective',
        'proverb'].includes(type)
      const tableType = ['analogy', 'logic-grid', 'apostrophe', 'contraction',
        'homophone-cloze', 'grammar-cloze', 'comparative', 'gender', 'collective',
        'proverb'].includes(type)
      const words = tableType ? [] : [
        item.prompt.word,
        ...(item.rule.words || []),
        item.rule.answer,
        item.rule.word,
        ...(letterType ? [] : item.options.map(o => o.text)),
        ...sentenceWords(item),
      ].filter(Boolean)
      const groups = letterType ? item.options.map(o => o.text) : []

      for (const w of [...words, ...groups]) {
        if (BLOCKED.has(w)) { blocked++; fail(`${bandKey}/${type} seed ${item.seed}: blocked word "${w}"`) }
      }
      for (const w of words) {
        if (WORD_Z[w] !== undefined && WORD_Z[w] < band.option && w.length > 2) {
          rare++
          fail(`${bandKey}/${type} seed ${item.seed}: "${w}" is Zipf ${(WORD_Z[w] / 10).toFixed(1)}`)
        }
      }
    }

    const pct = tries ? Math.round((made / tries) * 100) : 0
    const line = `  ${type.padEnd(16)} ${String(made).padStart(4)}/${String(tries).padEnd(6)}`
      + ` yield ${String(pct).padStart(3)}%   ${String(answers.size).padStart(4)} answers`
      + `   ${String(sigs.size).padStart(4)} distinct`
    console.log(line + (rare ? `   ⚠ ${rare} rare` : '') + (blocked ? `   ✖ ${blocked} blocked` : ''))

    if (made === 0) fail(`${bandKey}/${type}: generated nothing in ${tries} tries`)
    // A type that can only ever say a handful of things is a type a child exhausts in a week.
    // The floor is 40 rather than a token number because a real one was found at 29: odd-two
    // held its five words to the filler bar and came down to nine usable groups.
    //
    // Counted in distinct QUESTIONS, not distinct answers. For most types those are nearly the
    // same number, and for three of them they are not remotely: the answer to a
    // prefix-antonym question is one of nine prefixes and the answer to a missing-vowel
    // question is one of five vowels. Counting answers called those the two thinnest types in
    // the module when they are among the widest — 184 and 297 distinct questions.
    // A hand-written table can only say as many things as it has rows; its floor is its size.
    const floor = Math.min(40, POOL_LIMITS[type] ?? 40)
    if (made >= PER_TYPE && sigs.size < floor) {
      fail(`${bandKey}/${type}: only ${sigs.size} distinct questions across ${made} items`)
    }
  }

  // ── answer position ─────────────────────────────────────────────────────────────────────
  // With five options an even spread is 20% each. A bank that drifts teaches the drift.
  const spread = Object.entries(positions)
    .sort(([a], [b]) => a - b)
    .map(([i, n]) => `${'abcde'[i]} ${Math.round((n / total) * 100)}%`)
  console.log(`  answer position: ${spread.join('  ')}`)
  for (const [i, n] of Object.entries(positions)) {
    const share = n / total
    if (share < 0.10 || share > 0.32) {
      fail(`${bandKey}: answer lands on ${'abcde'[i]} ${Math.round(share * 100)}% of the time`)
    }
  }

  // ── sittings ────────────────────────────────────────────────────────────────────────────
  let short = 0
  let repeated = 0
  for (let i = 0; i < 200; i++) {
    const session = generateSession(bandKey, 10, 1000 + i * 7919, { variety })
    if (session.length < 10) short++
    const sigs = new Set(session.map(itemSignature))
    if (sigs.size !== session.length) repeated++
  }
  console.log(`  200 sittings: ${short} short, ${repeated} with a repeat`)
  if (short) fail(`${bandKey}: ${short} sittings could not reach 10 questions`)
  if (repeated) fail(`${bandKey}: ${repeated} sittings repeated a question`)

  // ── coverage ────────────────────────────────────────────────────────────────────────────
  // BOOK_COVERAGE.missing is one-directional and must stay honest: an entry naming a type that
  // now exists is a stale note, and stale notes are how a module stops knowing what it lacks.
  const cover = BOOK_COVERAGE[bandKey]
  if (!cover) fail(`${bandKey}: no BOOK_COVERAGE entry`)
  else {
    for (const note of cover.missing) {
      const named = band.types.find(t => note.toLowerCase().startsWith(t))
      if (named) fail(`${bandKey}: BOOK_COVERAGE still lists "${named}" as missing, but it generates`)
    }
    console.log(`  book: ${cover.missing.length} categories still not covered`)
  }
  console.log()
}
}

// ── regressions found by blind review ────────────────────────────────────────────────────
// These are semantic failures that the lexicon agrees with, so the generic checks above could
// never catch them: WordNet itself supplied the bad relationship. Keep the concrete seeds that
// exposed each class beside the structural assertion that prevents it returning.
{
  const apostrophe = generateItem('10-11', 'apostrophe', 4079202, { variety: 'uk' })
  const apostropheAnswer = apostrophe?.correct.map(i => apostrophe.options[i].text)
  if (!apostropheAnswer?.includes("princess's crown")) {
    failures.push(`[regression] apostrophe seed 4079202 does not accept princess's crown`)
  }
  const singularClass = generateItem('10-11', 'apostrophe', 69, { variety: 'uk' })
  const pluralClasses = generateItem('10-11', 'apostrophe', 44, { variety: 'uk' })
  if (!singularClass?.correct.map(i => singularClass.options[i].text).includes("class's trip")
    || !pluralClasses?.correct.map(i => pluralClasses.options[i].text).includes("classes' concert")) {
    failures.push('[regression] class/classes possessives no longer distinguish singular and plural')
  }

  const ambiguous = new Set(["I'd", "she's", "who's", "there's", "what's", "she'd"])
  for (let seed = 1; seed <= 2000; seed++) {
    const item = generateItem('10-11', 'contraction', seed, { variety: 'uk' })
    if (item?.prompt.expand && ambiguous.has(item.prompt.word)) {
      failures.push(`[regression] contraction seed ${seed} treats ${item.prompt.word} as unambiguous`)
      break
    }
  }

  const rhyme = generateItem('7-8', 'rhyme-synonym', 9055460, { variety: 'uk' })
  if (rhyme?.options.some(o => o.why === 'means-only')) {
    failures.push('[regression] rhyme-synonym seed 9055460 teaches a false meaning-only label')
  }

  const forbiddenSense = [
    ['9-10', 129, 'each club played six home games', 'nine'],
    ['9-10', 558, "don't recognize them", 'mother'],
    ['11-12', 934, 'job applicants', 'sieve'],
    ['9-10', 136, 'Republican Party', 'blast'],
    ['9-10', 37, 'load the truck', 'laden'],
  ]
  for (const [band, seed, sentence, answer] of forbiddenSense) {
    const item = generateItem(band, 'sense', seed, { variety: 'uk' })
    const answers = item?.correct.map(i => item.options[i].text) || []
    if (item?.prompt.sentence.includes(sentence) || answers.includes(answer)) {
      failures.push(`[regression] ${band}/sense seed ${seed} still emits ${sentence} / ${answer}`)
    }
  }

  const forbiddenForms = [
    ['8-9', 'plural', 21843, 'penny'],
    ['8-9', 'plural', 21028, 'fish'],
    ['9-10', 'past-tense', 19235, 'beat'],
    ['9-10', 'past-tense', 5543, 'may'],
    ['9-10', 'suffix', 60474, 'tense'],
    ['11-12', 'missing-vowel', 11900, 'imprisoned'],
  ]
  for (const [band, type, seed, word] of forbiddenForms) {
    const item = generateItem(band, type, seed, { variety: 'uk' })
    const printed = [item?.prompt.word, item?.rule.word, item?.rule.of, item?.rule.single]
    if (printed.includes(word)) {
      failures.push(`[regression] ${band}/${type} seed ${seed} still emits ${word}`)
    }
  }

  for (const seed of [7810, 14112]) {
    const item = generateItem('10-11', 'prefix-antonym', seed, { variety: 'uk' })
    if (item?.prompt.word === 'like') {
      failures.push(`[regression] 10-11/prefix-antonym seed ${seed} asks ambiguous bare "like"`)
    }
  }
  const comparative = generateItem('10-11', 'comparative', 1, { variety: 'uk' })
  if (comparative?.prompt.sentence !== 'This one is ___ than that one.') {
    failures.push('[regression] comparative seed 1 uses a frame that may not fit its adjective')
  }

  const ambiguousHomophones = [
    [845, 'desert'], [16881, 'bow'], [14560, 'read'], [29752, 'close'], [40091, 'route'],
  ]
  for (const [seed, word] of ambiguousHomophones) {
    const item = generateItem('8-9', 'homophone', seed, { variety: 'us' })
    const answer = item?.correct.map(i => item.options[i].text) || []
    if (item?.prompt.word === word || answer.includes(word)) {
      failures.push(`[regression] us homophone seed ${seed} still asks ambiguous "${word}"`)
    }
  }

  const badRhymePrompts = [[1689, 'mall'], [8652, 'one']]
  for (const [seed, word] of badRhymePrompts) {
    const item = generateItem('8-9', 'rhyme', seed, { variety: 'uk' })
    const answer = item?.correct.map(i => item.options[i].text) || []
    if (item?.prompt.word === word || answer.includes(word)) {
      failures.push(`[regression] uk rhyme seed ${seed} still uses source-specific "${word}"`)
    }
  }

  const ialPairs = [
    ['commerce', 'commercial'], ['face', 'facial'], ['finance', 'financial'],
    ['office', 'official'], ['prejudice', 'prejudicial'], ['province', 'provincial'],
    ['race', 'racial'], ['sacrifice', 'sacrificial'],
  ]
  for (const [base, derived] of ialPairs) {
    const row = SUFFIXED.find(([a, b]) => a === base && b === derived)
    if (!row || row[2] !== 'ial') {
      failures.push(`[regression] suffix builder labels ${base} → ${derived} as ${row?.[2] || 'missing'}, not ial`)
    }
  }
}

// ── the one check in this file that is not self-referential ──────────────────
// Everything above reads the same generated tables the generator reads, so it can prove a
// question is consistent with the lexicon and can never prove the LEXICON is right. An
// outside re-audit made exactly that point, having found `nefarious` filed as three syllables
// — a wrong entry that passed every check here, because every check here believed it.
//
// The build now keeps a syllable count only where two independently compiled pronunciation
// dictionaries agree on it. That is the only independent evidence available offline, so this
// asserts the guarantee still holds rather than trusting that nobody removed it.
{
  const uk = Object.keys(SYLLABLES.uk), us = Object.keys(SYLLABLES.us)
  if (uk.length !== us.length) {
    failures.push(`[lexicon] syllable tables differ in size: uk ${uk.length}, us ${us.length}`)
  }
  const disagree = uk.filter(w => SYLLABLES.us[w] !== SYLLABLES.uk[w])
  if (disagree.length) {
    failures.push(`[lexicon] ${disagree.length} words are kept with counts the two dictionaries `
      + `disagree on, e.g. ${disagree.slice(0, 5).map(w => `${w} (uk ${SYLLABLES.uk[w]}, us ${SYLLABLES.us[w]})`).join(', ')}`)
  } else {
    console.log(`phonics: ${count(uk.length)} words, both dictionaries agree on every count`)
  }
}

if (failures.length) {
  console.error(`✖ ${failures.length} failures\n`)
  for (const f of failures.slice(0, 40)) console.error('  ' + f)
  if (failures.length > 40) console.error(`  … and ${failures.length - 40} more`)
  process.exit(1)
}
console.log('✓ all checks passed')
