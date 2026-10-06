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
