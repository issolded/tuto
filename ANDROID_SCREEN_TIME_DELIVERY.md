# Android screen-time delivery — 20 October 2026

Current test APK: 0.11.0-screen-time (versionCode 15).
Tested source: `4b78cf8fbeb5ae328981016a6227426a76a19544`.
Branch: `codex/android-screen-time`; PR: https://github.com/issolded/tuto/pull/27
CI: https://github.com/issolded/tuto/actions/runs/39378994905 — all three jobs passed.

## Verified
- 28 JVM tests (23 Android + 5 shared), zero failures/ignored.
- 27/27 instrumented tests on each API35 Pixel Tablet (default and 16 KiB), zero failures/skips. 16 KiB emulator reported PAGE_SIZE=16384.
- APK build, lint, v2 signature and zip/native 16 KiB alignment passed.
- SQLite instrumentation tests cover rollback of cursor and counters together, retry acknowledgements and new usage accumulated during upload.
- 151 Node tests passed, including six device API validation/ownership/pairing/revocation/revision/idempotency checks with synthetic storage.
- Production web build and focused ESLint passed. Six mocked browser scenarios: EN/TR/ES at 390 and 1180 px; no overflow/JS errors; saved rule payload verified.
- Shared engine QuickJS generation (162 sessions), same-skill review and puzzle checks passed in final CI.
- i18n audit: 115 findings, identical count to main 18e2f57; no added findings. This is not a globally clean i18n audit.

## APK integrity
- APK artifact: 12244343158; APK size: 23,772,603 bytes (23.8 MB).
- Artifact ZIP SHA256: `7769d4a3fad2f35803bfb5edd1159336dad9e3f71f2f6bc2370470cee545061e`.
- APK SHA256: `3844de34564b509866f99e1a643b29a14496c3e9fb22a36ef3836a33a47bfe5d`.
- Certificate SHA256: `e7ebfe9f310bea12f2a65b6cee4e7af386d683e08f7466b85fb15d358f403954`.
- Test-signed APK, not a store-signed production release. Upgrade compatibility with older debug signing keys was not established; preserve unsaved local drafts before any reinstall.

## Implemented
All 11 main commits through 18e2f57 are integrated with Android base 78ba7e5, with real merge ancestry. Native help figures, larger keys, reduced-motion-aware asked-value pulse, split question asks, skip/review planning, parent topic skip and English clue checklist are updated. Shared server changes remain on the branch until deployment; iOS/web-specific shell effects retain their own platform implementations.

Parent native/web controls select rules for Netflix, YouTube and Roblox: shared weekday/weekend minutes, per-app minutes, allowed/blocked modes, allowed hours and timezone. Parent-owned short-lived code pairs the child device; separate encrypted device tokens authenticate sync. Usage is stored atomically in SQLite, retained for retry and uploaded as cumulative device/day/app buckets. Dashboard reports all measured foreground apps including Tuto, daily/weekly/monthly, with device filters and permission/acknowledgement status. Server monotonic trigger prevents an old retry from reducing a total.

## Required activation and acceptance
CLAUDE.md reserves database and infrastructure operations to the user. No migration or production deployment was performed. Before real device pairing, apply `server/migrations/2026-10-20_device_screen_time.sql` and ensure `2026-10-06_math_skip.sql` is applied; then deploy backend and parent web changes. The delivered combined SQL includes both migrations in a transaction.

After deployment, pair the tablet, grant visible notification/Usage Access/Accessibility permissions, save parent rules, and verify device acknowledgement. Existing learning flows can be tested with the APK; new screen-time pairing needs the new backend.

Accessibility shielding is permission-dependent, not OS package suspension. Physical Samsung behavior, PiP/split-screen, browser equivalents and device clock changes remain acceptance limits. App categories and temporary Gem/bonus minutes are outside this pilot. No live-family writes or messages were performed. Earlier mobile status documents' pending test statements are superseded by this report; deployment/physical acceptance remain pending.
