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
| Parent | Password sign-in/signup/reset, Google PKCE/callback, encrypted session, parent lock on re-entry, family code, child/PIN/language setup, task rewards/caps/bonus, pending decisions and private photos, rewards/gifts/deductions, weekly reports, chat, notifications/quiet hours/autopilot, WhatsApp/Telegram connection, screen-plan settings |
| Maths | Current bundled web engine, retry/help at every age, same-kind review questions, paper transcription with child confirmation, scratchpad, count/group/share/clock manipulatives, pending final-save recovery; follow-up adds steps/jumps/fractions/coins/tally/pictogram/fill/sorting and six guided place-value modes, shape counting and literal arithmetic counters |
| Tablet | Native Compose, bottom home navigation, adaptive existing home/math layouts, constrained/scrollable feature pages, rotation-owned state |

## Deliberate boundaries and remaining differences

- No fake scores, photos, balances, rewards, preview data or simulated Android app blocking are used in production flows. Screen controls edit the same family plan as the browser and explicitly describe their limits.
- Google OAuth now uses PKCE and the Android callback. The redirect must be allowed in Supabase and a real Google flow must be checked before calling it verified; see ANDROID_AUTH_SETUP.md. Password sign-in and email reset remain available.
- The browser's complete topic-specific interactive maths helper suite is not yet reproduced: native has template hint steps, shared question figures and the manipulatives listed above. All six guided place-value modes and shape/arithmetic counters are now implemented. Some exact web guess-driven interaction sequences still differ. This is a remaining parity task, not an access blocker.
- Library uses a native list/reader instead of the web's illustrated room/page-turn presentation. Older photographed story drafts open as a new typed copy so the original is retained; this differs from editing the old photo workflow in place.
- Parent detail/history layouts are simplified. Puzzle history now reuses the native SVG question renderer. Screen-plan labels are translated into English, Turkish and Spanish.
- Draft text is recovered on process restart. Other in-flight photo/session state survives rotation via ViewModel but is not a complete cross-process offline queue. Math/reading server endpoints lack a request idempotency key, so a lost successful response remains an existing backend retry risk.
- No real family record was written and no parent message was sent during tests. A disposable family and an approved test messaging recipient are required to verify real auth/RLS, storage, model calls, deployed migrations and WhatsApp delivery together.
- No production backend deployment or database migration was performed. Stable production APK signing is not configured; CI debug certificates may differ between runs.

## Validation

Tested source `7c9cb3a6dcbd0c0a8d8eff79445323f163254baa`: https://github.com/issolded/tuto/actions/runs/37486144183

- Android APK build/lint and all 20 JVM tests passed.
- All 11 Pixel Tablet API35 tests passed, with no failures/skips.
- Coverage includes sibling/PIN, full maths plus unaided reinforcement, puzzle flows, English completion, draft recreation/save, homework/drawing navigation, parent re-entry, signed-decimal worked steps, half pictograms, borrowing and guarded OAuth callback routing.
- Shared engine: 162 sessions across ages/languages, no short sessions or skipped required figures. Same-skill review: 27 questions.
- Earlier clipped-action, keyboard/selection and OAuth activity-teardown failures were reproduced and resolved by successful subsequent runs. Exact current scope/limits are recorded in BUILD_STATUS.md.
- All device/API tests use isolated test transports. Real auth/RLS, uploads, model evaluation and WhatsApp delivery are still unverified.

The obsolete dummy release and APK were actually deleted. No new rolling preview is published; do not label the validation artifact a fully verified live E2E release.
