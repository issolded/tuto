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
  BANDS, BAND_KEYS, BOOK_COVERAGE,
  generateItem, generateSession, validateItem, itemSignature,
} from '../src/lib/englishTemplates.js'
import { WORD_Z, LEXICON_META } from '../src/lib/englishLexicon.generated.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PER_TYPE = Number(process.argv[2]) || 300

const failures = []
const fail = (msg) => failures.push(msg)

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

console.log(`lexicon built ${LEXICON_META.built} · `
  + Object.entries(LEXICON_META.counts).map(([k, v]) => `${v} ${k}`).join(' · '))
console.log(`blocklist ${BLOCKED.size} entries · ${PER_TYPE} items per type\n`)

for (const bandKey of BAND_KEYS) {
  const band = BANDS[bandKey]
  console.log(`── band ${bandKey} ${'─'.repeat(52 - bandKey.length)}`)

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
      const item = generateItem(bandKey, type, s | 0)
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
      const letterType = ['letter-pair', 'shared-letters', 'hidden-word',
        'plural', 'past-tense', 'suffix', 'root-word', 'prefix-antonym',
        'missing-vowel'].includes(type)
      const words = [
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
    if (made >= PER_TYPE && sigs.size < 40) {
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
    const session = generateSession(bandKey, 10, 1000 + i * 7919)
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

if (failures.length) {
  console.error(`✖ ${failures.length} failures\n`)
  for (const f of failures.slice(0, 40)) console.error('  ' + f)
  if (failures.length > 40) console.error(`  … and ${failures.length - 40} more`)
  process.exit(1)
}
console.log('✓ all checks passed')
