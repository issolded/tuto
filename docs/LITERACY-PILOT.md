# English literacy pilot

2026-10-15 · `codex/literacy-pilot` · local implementation, not deployed.
Base HEAD: `5e634845adae240c81b942ece95e39c44c7a85ac`. Existing unrelated working changes were retained.
Initial `git pull` failed because the previous branch had no upstream; no remote merge or push performed.

## Run

```sh
npm run dev -- --host 127.0.0.1 --port 5178
```

Open `/literacy-lab`. Lazy, unlisted developer route; no account, rewards, persistence or API.
The in-memory client contains answer keys by design. It must not be reused as a rewarded child
screen without the server-authoritative contract in ENGLISH-LITERACY-ARCHITECTURE.md.

## Delivered

- 100 original word/meaning records; 24 context sentences and 24 be-verb frames.
- 6 original mini passages (5 narratives and one short informational text).
- 10 skills: meanings, context words, letter assembly, missing letter, capitalization,
  punctuation, regular plurals, am/is/are, explicit text detail, first event.
- Deterministic versioned generation, per-session family deduplication, explicit exhaustion.
- Tap/keyboard letter tiles with duplicate-letter identity, undo/clear; choices, one hint,
  check/skip, feedback, evidence highlighting, results by skill, full content inventory.
- Independent/supported/incorrect-or-skipped separated. No Grade, mastery or placement claim.
- English-only reviewer interface, explicitly labelled; i18n audit exemptions limited to
  this isolated screen and its English content/engine, matching existing lab conventions.

## Verification

`npm run literacy:check`: five tests, including 5,000 generated questions, wrong-key and
option mutations, independent grammar expectations, 200 deterministic mixed sessions,
family deduplication, exhausted banks, help/skip accounting and definition answer leakage.
The source-based validator is structural; it is NOT an independent semantic proof that
all natural-language distractors are unambiguous. Content still needs human editorial review.

`PLAYWRIGHT_CORE=/path/to/playwright node scripts/literacy-ui-check.mjs`:
Chromium + WebKit, 390×844 and 1024×768; all ten skills, letter undo, correct/wrong,
hint, skip, full results, inventory, restart; no page errors, horizontal overflow or writes.
Nonlocal requests blocked. WebKit screenshot visually inspected. No physical iPad test.

Vite build exit 0; targeted ESLint and font check passed. i18n output unchanged from the
existing 115 findings. `git diff --check` passed. Full repository `npm test`: 140/140 passed (exit 0).

## Deliberate limits / next review

This is a content/interaction slice, not the adaptive planner or production integration.
Definitions impose reading load and some are too complex for an absolute beginner; there
are no pictures/audio to isolate receptive vocabulary from reading. Do not interpret
these results as pure vocabulary or phonics ability. Missing letters and tile assembly are
supported spelling tasks, not independent dictation or writing. Sequence only asks first
among three events; full sequence reconstruction remains future work.

Shared UK/US content is an authored pilot selection, not a proof covering every regional
accent or usage. No phonics, pronunciation, rhyme or regional spelling tests. No audio.
Hints are one step per item; no adaptive teaching or mastery transitions. Feedback on
context questions gives the completed sentence, not a diagnosis of why the child erred.
The bank is finite. Deduplication is within a set; new sets can repeat earlier content.
Fresh seed changes sample/order, not necessarily the underlying passage. Reload clears results.
No child efficacy, age calibration, grade equivalence or independent educator review yet.

Next: review the examples with the user, simplify/illustrate vocabulary targets, review
wrong choices, then add skill evidence/planning and introductory assessment. Production
keeps activity instructions/help in English (user decision, 2026-10-16); it needs localized app controls, server marking/auth/idempotency, approved content
revisions, SQL supplied to the user, rewards integration and native renderers.

Native impact: none now (web lab route only). No native assets rebuilt; native would require
new screen/response-mode support before this becomes a child feature.
