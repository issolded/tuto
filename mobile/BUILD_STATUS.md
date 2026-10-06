# Android native validation — 6 October 2026

Branch: `codex/android-complete`. Tested source: `7c9cb3a6dcbd0c0a8d8eff79445323f163254baa`.
CI: https://github.com/issolded/tuto/actions/runs/37486144183

## Passed automated gates

- Android APK build, lint and all 20 JVM tests.
- All 11 Pixel Tablet API35 tests, zero failures/skips.
- The Google callback test now passes including activity teardown. The callback is consumed directly while retaining the activity's original launch intent.
- Maths reinforcement is checked after an originally hinted question: the new unaided answer sends clean help flags and wrong-try counts.
- Shared maths generation covers 162 age/language sessions; same-skill review checks cover 27 questions. CI also checks puzzle rendering.

Tablet coverage includes family/sibling PIN, maths completion/reinforcement, puzzle retry/hint/skip/review, English completion, library draft recreation/save, homework/drawing navigation, parent lock/re-entry, worked steps, half pictograms, place-value borrowing and guarded OAuth intent routing. These tests use isolated API transports; they are not live Google/Storage/model/WhatsApp E2E tests.

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
