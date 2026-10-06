# Android native module implementation — 6 October 2026

Branch: `codex/android-complete`. Android only; production web/server code is unchanged.
This is implementation and validation evidence, **not a claim of live-account E2E parity**.

## Added native flows

| Area | Native implementation |
|---|---|
| English | Server session, one/two selections, retry/elimination, three hint stages, explanation visuals, finish retry, review start/finish/decline, answer recap |
| Reading/library | Real books/stories, search, completed archive, book cover identification/upload, page progress, page-photo comprehension questions, persisted reading session, server rewards |
| Stories | Typed editor, local recovery, debounced server revisioned drafts, conflict reload/new-copy options, handwritten transcription and uncertain words, story ideas, spelling corrections, assessment, completed story reader and covers |
| Homework | Camera/gallery/crop, original private uploads, date confirmation, real weekly submissions and parent review state |
| Drawing | Age-specific live catalogue, step images and instructions, free/guided upload, server review/gems, personal gallery and deletion confirmation |
| Tree | Real cards, diary contributions, private photo upload, server tree totals and forest archive |
| Parent | Password sign-in/signup/reset, encrypted session, parent lock on re-entry, family code, child/PIN/language setup, task rewards/caps/bonus, pending decisions and private photos, rewards/gifts/deductions, weekly reports, chat, notifications/quiet hours/autopilot, WhatsApp/Telegram connection, screen-plan settings |
| Maths | Current bundled web engine, retry/help at every age, same-kind review questions, paper transcription with child confirmation, scratchpad, count/group/share/clock manipulatives, pending final-save recovery |
| Tablet | Native Compose, bottom home navigation, adaptive existing home/math layouts, constrained/scrollable feature pages, rotation-owned state |

## Deliberate boundaries and remaining differences

- No fake scores, photos, balances, rewards, preview data or simulated Android app blocking are used in production flows. Screen controls edit the same family plan as the browser and explicitly describe their limits.
- Parent OAuth/deep-link login is not implemented; password sign-in and email reset are available. A Google-only account may need password setup.
- The browser's complete topic-specific interactive maths helper suite is not yet reproduced: native has template hint steps, shared question figures and the four manipulatives listed above. This is a remaining parity task, not an access blocker.
- Library uses a native list/reader instead of the web's illustrated room/page-turn presentation. Older photographed story drafts open as a new typed copy so the original is retained; this differs from editing the old photo workflow in place.
- Parent detail/history layouts are simplified; puzzle history has not yet gained the full visual question renderer. Some screen-plan labels retain the backend names pending copy refinement.
- Draft text is recovered on process restart. Other in-flight photo/session state survives rotation via ViewModel but is not a complete cross-process offline queue. Math/reading server endpoints lack a request idempotency key, so a lost successful response remains an existing backend retry risk.
- No real family record was written and no parent message was sent during tests. A disposable family and an approved test messaging recipient are required to verify real auth/RLS, storage, model calls, deployed migrations and WhatsApp delivery together.
- No production backend deployment or database migration was performed.

## Validation

- Shared engine: 162 sessions (9 ages × 3 languages × 6 runs), no short sessions or missing required figures; real QuickJS check passed.
- Review generator: 27 fresh same-skill questions; topic, operand kind and visible operation signs preserved.
- New JVM tests cover English selection/duplicate-send/retry/finish/decline and screen-rule/prefs merge contracts.
- New tablet instrumentation covers English controls, library/draft rotation/save, homework/drawing routes and parent re-authentication. Results must be recorded after CI; adding or compiling a test is not a passed device test.
- Existing baseline device run `37461523253` remains evidence only for the older four tests/source `3217f87`, not these new modules.

The earlier offline preview remains withdrawn. Version 0.5.0 is a validation build; it must not be described as the requested fully verified replacement until the remaining parity and live E2E gates are closed.
