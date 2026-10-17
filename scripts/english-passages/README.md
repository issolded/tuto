# Reading passages (E levels): write, gate, review

Offline tooling. Nothing here runs in the app, and no passage is used until a person approves it.
Design: `docs/ENGLISH-SKILL-LADDERS.md` (E), `docs/ENGLISH-LITERACY-ARCHITECTURE.md` §6–8.

```
premises.mjs   our own abstract situations (books give the shape of a situation, never text)
spec.mjs       level numbers (length, vocabulary, question operations) + the safety categories
gate.mjs       deterministic: vocabulary vs Cambridge YLE lists, blocklists, UK/US words, sizes, evidence
agents.mjs     writer (gemini-3.5-flash), safety reviewer (gemini-3.1-pro, run twice),
               pedagogy reviewer (gemini-3.8-flash), blind solver (gemma-4-31b, no answer key)
check.mjs      the whole check on one item → pass / revise / regenerate
run.mjs        write → check → repair loop (≤4 rounds) → out/<level>-<stamp>/REVIEW.md
traps.mjs      hand-written items with one planted problem each + clean controls
trap-check.mjs measures the reviewers on the traps (recall, false alarms)
```

```sh
node scripts/english-passages/trap-check.mjs     # measure the reviewers first
node scripts/english-passages/run.mjs E3 5 0     # level, count, first premise
```

The Gemini key is read from `../tuto-app/server/.env` unless `GEMINI_API_KEY` is set. Models can be
swapped with `GEN_MODEL`, `SAFETY_MODEL`, `PED_MODEL`, `SOLVER_MODEL`.

Rules the code enforces:
- A safety flag is never repaired; the passage is written again from nothing.
- A question a solver answers 3/3 **without** the passage is rejected: it measures common sense, not reading.
- A question the solver misses **with** the passage (either of 2 runs) is sent back.
- Every reviewer answers a fixed rubric with quotes; a person reads every passage that passes.

Limits: all models are Google's (the only key here), so reviewer independence is partial; the trap set
says how much the reviewers catch, not that they catch everything. "Passed" means "worth a person's time".

## First trial (2026-10-17)

Trap set (`trap-check.mjs`, 24 items): the safety reviewer caught **15/15** planted problems with the
right category (once with gemini-3.1-pro, once with its fallback gemini-3.8-flash, the preview model
dropping connections), and raised **no** safety flag on the 5 clean items once "regional" became a note.
The word gate alone saw 7/15. Pedagogy traps 4/4. The clean items still drew pedagogy flags (the blind
solver guessed "two books" without the text; reasons not marked with because/so): by our own rules my
hand-written "clean" items were not clean.

Generation, what changed and why:
1. Questions answerable from common sense dominated (solver 3/3 without the text). Telling the writer
   "make it need the text" did not work. Now: plan questions first → the solver tries the plan with no
   story → options with a favourite are re-planned → the code draws which option is true → the story is
   written to that draw. Run 4: 6/6 passed every automatic check.
2. Reading them: three of six had reasons true only because the text says so ("the dog found the cat
   because he walked on the grass"). Added `reason_makes_sense` and `story_quality` to the pedagogy rubric;
   re-reviewed, it rejects those three and keeps the other three.
3. The three it keeps are acceptable, not good. The weak link is the writer (gemini-3.5-flash under a
   tight word list), not the filters.

Open: a stronger writer; answers still copied word for word (`word-match` is a warning, not a fail);
the review sheet is for a person and nothing is approved yet; E4 untried.

## Second trial (2026-10-17 evening): story first, pro writer

- Plan-first gave collages with every writer (sentences that exist to host a question). Default is now
  `STRATEGY=story`: the writer (gemini-3.1-pro, `WRITER_KEY`, its own daily quota of 250) writes the story
  and questions; a guessed question gets new wrong options once; the right option's place is drawn by lot.
- The strong blind solver (gemma-4-31b) guesses most questions without the text. Alone that is now a
  note; it is a problem only when the pedagogy reviewer also says common sense answers it.
- "false-fact" applies only to information texts (it was flagging story events).
- Result: 8/8 passed (`out/E3-2026-10-171841`), and on reading they are real little stories. Weak spots:
  odd paraphrased options ("In a room for family films"), several guessable questions, one unchecked
  fact ("the snake is slow"), one safeguarding note (a child alone in an old man's room) for a person.
- Outside writers: `make-prompt.mjs` writes the prompt (docs/ENGLISH-PASSAGE-PROMPT.md), `check-file.mjs`
  runs their JSON through the same checks.
- Preview: `/english-reading-preview` (src/screens/EnglishReadingPreview.jsx), fed by `export-preview.mjs`.

## Third round (2026-10-17 night): word policy and the reviewer comparison

- E3 words (product decision, CLAUDE.md): Starters + Movers + `BASE_WORDS` (25 everyday words of telling);
  everything else is a content word, at most 2 per passage, counted by headword over title, text and
  questions. Astra's first eight under it: 6 pass, 2 have 3 content words.
- Pedagogy rubric: `reason_logical` (does the reason really cause it) and `key_adds_info` (does the right
  option say more than the text), and passage `logic_ok`, as separate checks.
- `reviewer-set.mjs` / `compare-reviewers.mjs`: 12 items, 9 with a known fault (most found by a person after
  the reviewer passed them), 3 clean, 2 runs each. gemini-3.1-pro 18/18 faults, 0/6 false alarms;
  gemini-3.8-flash 12/18; gemini-3.5-flash 11/18; neither flash model saw "less water, so the box is strong".
  Two items labelled clean at first were flagged by pro on both runs and, on reading, are faults (Astra's
  corrected chair; the snail putting every apple back): relabelled with that note. The pedagogy reviewer
  is now pro (`REVIEW_KEY`), falling back to gemini-3.8-flash on quota, recorded in the output.
- Caveat: pro now both writes and reviews our own passages (separate calls, no shared reasoning); for
  outside writers (Astra) there is no such overlap.
