# Android native validation — 6 October 2026

Branch: `codex/android-complete`. Android only; production web/backend was not deployed.

## Confirmed baseline

Source `126694a3af80f71d5ba6d5bae6261b8b6d1a4542` passed both jobs in https://github.com/issolded/tuto/actions/runs/37481528885:
- 18 JVM tests, APK build and lint.
- 10 Pixel Tablet API35 tests, including the full maths sitting followed by unaided reinforcement, sibling/PIN, puzzle, English, draft recreation, homework/drawing routes, parent lock, half pictograms and place-value borrowing.

The Google OAuth follow-up adds two JVM tests and one Android callback test. Its CI outcome must be recorded separately; a compiled or added test is not a passed device test.

## Live verification limits

Native modules are documented in [NATIVE_MODULES_2026-10-06.md](NATIVE_MODULES_2026-10-06.md). Device tests use isolated transports, not real family records. A disposable family/account and an approved WhatsApp recipient are needed to verify live auth/RLS, private photo upload, model evaluation, rewards/approvals and message delivery. Google OAuth also requires the redirect configuration in [ANDROID_AUTH_SETUP.md](ANDROID_AUTH_SETUP.md).

Native presentation and some interaction sequences differ from the browser. Legacy photographed drafts become a typed copy. Full process-death/offline photo-session recovery is not implemented. Debug signatures can differ between machines/runs; no production signing key was configured. Do not describe this as a fully verified E2E release.

## Obsolete preview

The obsolete android-preview release397715776 and APK593265107 were deleted in https://github.com/issolded/tuto/actions/runs/37477802302; the subsequent release listing was empty. Source history/tags are retained. No new rolling preview is published.
