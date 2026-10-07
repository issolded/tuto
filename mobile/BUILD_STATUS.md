# Android native validation — 6 October 2026

Branch: `codex/android-complete`. Tested source: `17382a5780f4732e82d6914dfa22bf3af562e804`.
CI: https://github.com/issolded/tuto/actions/runs/37507713039

## Passed automated gates

- Android APK build, lint and all 20 JVM tests.
- All 14 Pixel Tablet API35 tests in each of two environments (default and 16 KiB), zero failures/skips. The 16 KiB environment reported PAGE_SIZE=16384.
- The Google callback test now passes including activity teardown. The callback is consumed directly while retaining the activity's original launch intent.
- Maths reinforcement is checked after an originally hinted question: the new unaided answer sends clean help flags and wrong-try counts.
- Shared maths generation covers 162 age/language sessions; same-skill review checks cover 27 questions. CI also checks puzzle rendering.

Tablet coverage includes family/sibling PIN, maths completion/reinforcement, puzzle retry/hint/skip/review, English completion, library draft recreation/save, homework/drawing navigation, parent lock/re-entry, worked steps, half pictograms, place-value borrowing and guarded OAuth intent routing. These tests use isolated API transports; they are not live Google/Storage/model/WhatsApp E2E tests.

## Photo follow-up and user device test

Version 6 / 0.5.1-native-validation bounds inline photos to oriented JPEG derivatives (max 1600px and 640 KiB per photo). Reading, handwriting/paper maths, drawings and covers use these derivatives. Private Storage originals and homework EXIF remain unchanged. Three Android media tests cover the 15-page JSON budget, EXIF rotation/original preservation, and invalid photos. The first tablet job failed downloading the emulator before any tests; the failed job was rerun and all 14 tests passed.

The installation blocker is resolved; the exact Google Play setting was not recorded. This does not validate the later 16 KiB rebuild as an installation fix.

## 16 KiB compatibility follow-up (0.5.2)

Source `17382a5780f4732e82d6914dfa22bf3af562e804`, CI https://github.com/issolded/tuto/actions/runs/37507713039 rebuilds the pinned QuickJS JNI sources with NDK r28. Build, lint, all 20 JVM tests, APK signature verification, ELF/RELRO and ZIP alignment checks passed. All four packaged 64-bit native libraries pass the 16 KiB gate.

Both tablet jobs initially failed downloading the emulator archive before any tests. Only failed jobs were restarted; both passed all 14 tests on unchanged source. The 16 KiB environment explicitly reported PAGE_SIZE=16384. Version 7 / 0.5.2-native-validation is available for device acceptance; live family/provider/WhatsApp acceptance remains open. The downloaded artifact ZIP matches the CI digest; APK SHA256 is `917a3e957547368d4b5fae3548ce7f0413fbec057391e25232a18935bcb56fd3`.

## Remaining live setup and verification

1. Verify that Supabase allows `app.tuto.mobile://auth/callback`. Keep the current web URLs. See [ANDROID_AUTH_SETUP.md](ANDROID_AUTH_SETUP.md).
2. Supply access to a disposable test family/account and an explicitly approved WhatsApp test recipient.
3. Verify real parent login/ownership, child PIN, private photo upload, evaluation, reward/approval and actual message receipt.

No real family was modified, no parent message was sent, and no backend deployment/migration was performed. The production web remains unchanged.

Native presentation and some helper interaction sequences differ from the browser. Legacy photographed story drafts become a typed copy. Full process-death/offline photo-session recovery is not implemented. Debug signatures can differ between build machines/runs; no production signing key was configured. This is validated native code, not a claim that live E2E acceptance is complete.

## Obsolete preview

The obsolete android-preview release397715776 and APK593265107 were deleted in https://github.com/issolded/tuto/actions/runs/37477802302. The release listing was then empty; source history/tags remain. No new rolling preview release is published.

## Source persistence

The local execution environment disconnected during the OAuth work. The complete follow-up was reconstructed against the published source, committed to GitHub and validated there. The tested GitHub source above is authoritative; reconcile any older uncommitted local OAuth edits before resuming local work.


## 7 October 2026 — 0.7.0 Bookshelf (local revision, not published)

Native-only redesign: white high-resolution fox clips (greeting, thinking, running hint entrance, success, reading); goal remainder and larger Gem balance; task-selection motion; a single Library destination with book-shaped covers on shelves, actual completed-record milestones and reading nook; hints reveal the companion on demand. SVG roots no longer inherit browser sizing; native rendering uses explicit ink and a measured software bitmap.

Local Kotlin and instrumentation compilation passed. Local ARM64 APK, lint, 15 Android JVM tests and 5 shared JVM tests passed. QuickJS engine checks and 27 same-skill review questions passed; 11,492 puzzle SVG markup outputs were nonempty (this is NOT a pixel-render pass). New Android pixel tests are compiled but not executed: this environment has no KVM and the software API 35 emulator segfaulted during boot. No real family E2E or final tablet screenshots verified.

Public GitHub upload of the generated mascot assets was rejected by automatic approval review, including after checking prior native-branch publishing authorization. No new remote commit, CI run or production backend/web deploy was made. User confirmation for publication to public issolded/tuto, codex/android-complete is required by that review. The APK is a local test build connected to the existing backend, not a production-signed release; signing certificate continuity with the previously installed APK is not established.


## 7 October — publication and device follow-up

User explicitly approved public code/mascot publication. Commit 735f82a was published to codex/android-complete. CI run 37627113002 passed build/lint/JVM/APK integrity gates. The default tablet failed downloading the emulator. The 16 KiB tablet ran 19 tests: 17 passed; pixel rendering of embedded SVG data images and HEVC mascot frame decoding failed. Follow-up in this revision embeds SVG vectors as nested viewports and transcodes mascot video to H.264 Baseline. Device gates are being rerun; prior 0.7.0 APK is superseded for acceptance. No production web/backend changes.

The 0.7.1 follow-up passed local compile, lint and JVM tests. After the user requested continuation, publication succeeded: source da3e60329ebe2e9549bc60014d761788f5216bdd, CI run 37649661317. Device validation is running. Do not distribute the prior locally repackaged 0.7.1 artifact: ZIP integrity verification failed; the retained downloadable artifact was restored to the earlier integrity-verified 0.7.0 CI APK until replacement by the new CI build.


## 0.7.1 final automated validation — 7 October 2026

Source da3e60329ebe2e9549bc60014d761788f5216bdd, CI https://github.com/issolded/tuto/actions/runs/37649661317: build/lint and 20 JVM tests passed; both API 35 tablet jobs passed 19/19 tests each. The 16 KiB job reported PAGE_SIZE=16384. Embedded SVG pixel tests and all five video-frame/poster decode tests passed. Library and book-detail screenshots were inspected; screenshot capture timing is not evidence of every transient animation. No live family E2E or physical Samsung acceptance is claimed.

The delivered 0.7.1 APK is the CI artifact, not the unsuccessful local repack. Downloaded archive SHA256 matches CI: 929d22b8cf280bbc4cb63b8076eabfb88b28a25fb16fd12c9fb2104994b8c9c4. APK signature and all four native library 16 KiB alignment checks passed again after download. APK is a debug validation build connected to the existing backend; installed-certificate continuity is not established.
