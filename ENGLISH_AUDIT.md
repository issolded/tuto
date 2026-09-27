# English module — audit handoff

**For an external reviewer. Written 21 September 2026, against `main` at `0e0d6bd`.**

Read this first, then `src/lib/englishTemplates.js`. The file heads carry the reasoning; this
document is the map, the claims, and — most importantly — **the list of things nobody has
checked**. Section 8 is where a reviewer is worth most.

---

## 1. What this is

A question generator for an English module in Tuto, a children's learning app. It produces
multiple-choice questions about English — synonyms, antonyms, plurals, rhyme, homophones,
spelling — for three age bands, in two varieties of English.

It is not shipped to children yet. It lives at `/english-lab`, an unlisted developer route,
and is not linked from any menu, wired to gems, or connected to the server.

**Three things about it decide everything else.**

**No model runs.** Not at generation time, not ever. A question is built by deterministic code
over a data file. Cost per question is zero, time is about 0.1ms, and a ten-question sitting
takes 1.5ms. Nothing here calls Gemini or anything else.

**The data carries the module, not the code.** The engine is 1,891 lines; the lexicon it reads
is 3.8MB, built once from WordNet by a Python script. Most defects found so far have been data
defects, and most of the interesting ones were in the *gates* that decide what enters the data.

**It is calibrated to three specific books**, named in `BANDS`. Where the engine and the books
disagree, the books are right; where the books do not cover something, `BOOK_COVERAGE` says so
in data rather than in a comment, and the audit fails if an entry there names a type that now
generates.

---

## 2. The source books

| band | book | what it actually is |
|---|---|---|
| 8-9 | Bond 11+ *English **and Verbal Reasoning*** 10 Minute Tests 8-9 (Michellejoy Hughes) | word-relationship puzzles |
| 9-10 | Bond Assessment Papers: *English* 9-10 Book 1 (Sarah Lindsay) | grammar, spelling, word formation |
| 11-12 | Bond 10 Minute Tests: *English* 11+–12+ (Sarah Lindsay) | same, harder, plus vocabulary |

**These are two different subjects, not three difficulty levels.** The 8-9 book asks about
relationships between words; the other two are grammar and spelling papers. The engine was
designed on the first book with a claim borrowed from the non-verbal reasoning module — that
the question types never change with age and only a dial does — and that claim is **false**
across these three books. It is now stated as false in the file head. Each band names its own
types.

The books' comprehension passages are deliberately out of scope. Tuto has a Reading module with
real books in it; a passage written to be quizzed is a worse version of that.

---

## 3. File map

### The engine

| file | lines | what it holds |
|---|---:|---|
| `src/lib/englishTemplates.js` | 1,891 | every generator, the bands, `validateItem` |
| `src/lib/englishLexicon.generated.js` | 3.8MB | **generated — do not read top to bottom, do not edit** |
| `src/screens/EnglishLab.jsx` | 455 | the lab at `/english-lab` |
| `src/lib/i18n.js` | — | 24 `eng_*` keys: the instruction wrapper, in three languages |

### The lexicon build

| file | lines | what it holds |
|---|---:|---|
| `scripts/english/build_lexicon.py` | 1,255 | the whole extraction. Run once, never in production |
| `scripts/english/blocklist.txt` | 1,222 | 1,006 hand-written entries, grouped and each group explained |
| `scripts/english/sentence-topics.txt` | 198 | safe words kept out of example sentences only |
| `scripts/english/mentionable.txt` | 62 | blocked words that may appear inside a definition |
| `scripts/english/category-skip.txt` | 34 | groups and members reviewed out by eye |
| `scripts/english/vendor/` | — | five checked-in word lists, see its README |

### Checks

| file | what it does |
|---|---|
| `scripts/english-audit.mjs` | `npm run english:check` — 300 items per type, per band, per variety |

### Vendored data (all permissive licences, all offline)

| file | what | licence |
|---|---|---|
| `ipa-en_UK.txt` / `ipa-en_US.txt` | 65k / 126k pronunciations, IPA | MIT (open-dict-data) |
| `ldnoobw-en.txt` | 403 obscene terms | CC-BY (Shutterstock) |
| `cuss.json` | 1,795 terms rated 0–2 | MIT |
| `dale-chall.json` | 2,942 words known to 80% of nine-year-olds | MIT |

WordNet 3.0 and `wordfreq` are used at build time via `nltk`; they are not vendored.

---

## 4. How to run it

```bash
npm run english:check          # the audit: 6 band-and-variety sweeps, exits non-zero on failure
npm run dev                    # then open http://localhost:5173/english-lab
```

The lab has four views: **grid** (questions, with a per-option explanation of why each wrong
answer is wrong), **audit** (the same numbers in the browser), **words** (every word the band
can print — the safety argument made visible), **coverage** (what the book has and this does
not). Band and variety are buttons.

Rebuilding the lexicon needs Python and takes about 25 seconds:

```bash
python3 -m venv .venv
.venv/bin/pip install -r scripts/english/requirements.txt
.venv/bin/python -c "import nltk; [nltk.download(x) for x in ('wordnet','names','omw-1.4')]"
.venv/bin/python scripts/english/build_lexicon.py
```

---

## 5. The 19 types

**Verbal reasoning (`VR_TYPES`, from the 8-9 book)**
`synonym` · `antonym` · `sense` ("what does *bear* mean in this sentence") · `odd-two` (two of
five do not belong) · `word-grid` (find two in a grid of twelve) · `letter-pair`
(`tired → sl__py`) · `shared-letters` (same three letters finish both) · `hidden-word`
(`pil___` → `low`)

**Word knowledge (`WORD_TYPES`, from the 9-10 and 11-12 books)**
`odd-synonym` (one of five is not a synonym) · `definition` · `rhyme` · `homophone` ·
`syllables` · `plural` · `past-tense` · `suffix` · `prefix-antonym` · `root-word` ·
`missing-vowel`

Bands pose 13, 12 and 14 of them respectively.

**The distractors are the design.** In the verbal reasoning types a wrong option is another
word, and each carries a `why` naming the mistake it catches — `opposite`, `rhyme`,
`same-meaning`, `other-sense`. In the word-knowledge types the best wrong option is **the rule
applied naively**: `beautyful`, `childs`, `writed`, `rooves`. That is the answer a child
actually writes, so it has to be on the page. The lab prints the `why` under every question.

---

## 6. What has been verified, and how

### The audit, on every commit

`npm run english:check` sweeps six band-and-variety combinations, 300 items per type. It
asserts: exactly one defensible answer; no printed word below the band's own reading level; no
blocked word anywhere, including in the letter groups the engine invents; no repeat across 200
sittings; answer position spread 19–21% across a–e; and that `BOOK_COVERAGE` has not gone
stale. It reads the blocklists from source rather than from the lexicon, because the build is
the thing under test.

### Eight blind rounds — 430 questions, 422 correct

Questions were generated, answered without the key, then scored. Every one of the eight misses
was an engine defect. They are listed here so a reviewer does not spend time rediscovering
them, and because the *kind* of defect is the useful part:

| what looked wrong | what was actually wrong |
|---|---|
| `shed ≈ shared` | CMUdict is American and cannot express British /ɑː/ vs /ɒ/. Replaced with two IPA dictionaries |
| `form ≈ spring` | the dominance gate required a word's main part of speech in only one of its two branches |
| `unopposed → opposed` | a root must have *every* affix stripped, not one |
| `duo → dui` | frequency cannot separate these; where the singular's sense ranks in the plural form can |
| `casual` counted as 2 syllables | adjacent vowels were always collapsed; `uə` is a hiatus, not a diphthong. And `ɝ` was missing from the vowel set |
| `cargo → cargos` | both are standard; the -o branch lacked the check the -f branch already had |
| `garage → carriage` | a stem with two pronunciations has two rhyme sets |
| `clear → bounce` | the antonym list had no dominance gate at all |

### Measurements that are claims, not impressions

- **Band calibration.** The 598 real option words in the 8-9 book have their 5th percentile at
  Zipf 2.86, which is where that band's bar sits.
- **Band gradient.** Mean option frequency 4.51 / 4.36 / 4.13 across the three bands, mean
  syllables 1.78 / 2.00 / 2.09 — monotonic, and **three times steeper than the books'**, whose
  own span is 0.12. The books change word *length* (5.90 → 6.48 letters) and question type,
  not frequency. See §8.
- **Age anchoring.** 100% of what the 8-9 band asks about is familiar (on Dale-Chall or a
  concrete noun), against 52% before that gate existed.
- **Variety.** 880 words (5%) rhyme differently between UK and US; British has 49 homophone
  groups American does not, against 9 the other way.
- **Pool size.** Sampled at 4,000 seeds per type: 13,000–18,500 distinct questions per
  band-and-variety, 95,205 across all six. A full sweep of one combination gave 41,164, so
  that total is a floor.
- **Speed.** A ten-question sitting: 1.48ms.

---

## 7. The safety machinery

Four lists, doing four different jobs. Getting these confused has caused more defects than
anything else in the module.

1. **`blocklist.txt`** — never anywhere. 1,600 published entries plus 1,006 hand-written, in
   named groups: profanity and slurs, sexual, violence, death, drugs, crime, bodily, illness,
   religion (removed entirely by product decision), and several groups found by review.
2. **`sentence-topics.txt`** — safe words kept out of *example sentences only*. `market` and
   `court` are words a child can be asked about; a sentence set in a market or a court is the
   six o'clock news. War, law and medicine were promoted out of this file onto the blocklist
   after review.
3. **`mentionable.txt`** — blocked words that may appear *inside a WordNet definition* without
   disqualifying the word being defined. `valley` is "a long **depression** in the surface of
   the land".
4. **`dale-chall.json`** — the only **allow**list. The age anchor.

The distinction that matters most, and that was wrong twice: **a scan over text the child never
sees must not decide what the child may be asked.** The definition scan was silently deciding
which words exist (142 common words missing, including `valley`, `cattle`, `knife`, `chew`) and
separately which words may be *related* (`hot` had no opposite, because WordNet's definition of
`cold` ends "…or refrigeration; dead"). Both are fixed; the shape of the mistake is worth
knowing when reading the gates.

**The blocklist is the authority on existence.** That is a recent change and it means the
blocklist has to be complete. Three review passes have been done against it; a fourth would
probably still find something.

---

## 8. What nobody has checked — read this part

This is where a reviewer adds value. Everything below is a known gap, not a surprise.

### 8.1 No child has seen any of this

Zero user testing. Every claim about age-appropriateness is a measurement against a word list
or my own judgement, and the youngest band is the one most likely to be wrong.

### 8.2 The difficulty gradient may be wrong in shape

Measured above: this engine separates the bands by *frequency* three times more sharply than
the books do, and does not separate them by *word length* at all, which is what the books
actually change. Nobody has decided whether that is a defect. It is the single most likely
place for a structural error.

### 8.3 Three types are thin

`odd-two` has 39 usable groups; `suffix` generates a clean question about one try in five;
`sense` has 154 words with two far-enough-apart sensed examples. All three are data problems.
`odd-two` in particular would need hand-written groups.

### 8.4 Sentences are not banded

Example sentences come from WordNet and are screened for safety, register and abstraction, but
not for age. An 8-9 hidden-word question can carry "the book underwent fundamental changes".

### 8.5 The known residue

- `casual` is two syllables in American per the dictionary and three to most people
- `rue`, `haw` and a few others survive on odd-two lines as technically-correct group members
- WordNet's sense ordering is odd for some common words, and the module trusts it in several
  places
- British/American: `program` and `realize` are kept in both varieties on purpose; `practice`
  and `practise` are kept as two words. Those three are judgement calls

### 8.6 Nothing is wired

No child screen, no server, no gems, no session persistence. When the child screen is built,
the question must be generated **server-side** and the answer must never reach the browser —
the puzzle module (`server/puzzle/`, `src/screens/PuzzleScreen.jsx`) is the pattern to copy and
is the right thing to compare this against.

### 8.7 An open product decision

Which variety a child gets — British or American — is implemented and defaulted to British, but
where the setting lives, who chooses it, and whether the default is right are undecided. Note
that the variety changes spelling and pronunciation and **does not change the curriculum**: an
American child would get British 11+ material with American spelling.

---

## 9. Specific things worth a second pair of eyes

Ordered by how much a fresh reader would help.

1. **`validateItem` in `englishTemplates.js`.** It is the one thing standing between the
   generator and a question with two right answers. Is any type's check too weak? `word-grid`
   gives a child twelve chances to find a second answer and is the most exposed.
2. **The gates in `build_lexicon.py`.** Specifically `dominant`, `near_the_front`, `primary`
   and `safe_synset(strict=)`. Every one of them has been wrong at least once, always by being
   too strict in a way that silently removed good data rather than by letting bad data in.
3. **`blocklist.txt` completeness**, now that it is the authority on existence. Read the tail
   of the lab's **words** view; that is where a problem hides.
4. **The 8-9 band as a whole.** Generate fifty questions at that band and ask whether an
   eight-year-old could read them — not answer them, read them.
5. **The `why` labels.** They are the basis of any future help panel. Are they true? An option
   labelled `rhyme` that does not rhyme would be worse than no label.

## 10. What not to spend time on

- The lexicon file itself — it is generated, and reading it proves nothing about the build
- Re-finding the eight defects in §6; they are fixed and their fixes are commented
- Performance — five generators were rebuilding indexes per question and are memoised; a
  sitting is 1.5ms
- Licensing — all five vendored lists are permissive and attributed in
  `scripts/english/vendor/README.md`; an LGPL list was used and deliberately removed

---

## 11. Commit history

Nineteen commits, `923023f` through `0e0d6bd`, all on `main`. The messages are long on purpose:
each one says what was wrong, how it was found, and what the measurement was. `git log
--oneline -- src/lib/englishTemplates.js scripts/english` is a reasonable second read after
this document.
