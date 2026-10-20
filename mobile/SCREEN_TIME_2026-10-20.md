# Android screen time integration — validation in progress

Branch: codex/android-screen-time. Based on Android 78ba7e5 and main 18e2f57.

## Deployment order
1. User runs server/migrations/2026-10-20_device_screen_time.sql in Supabase SQL Editor. Existing math skip also requires 2026-10-06_math_skip.sql if not already applied.
2. Deploy the backend and parent web changes together. New routes fail visibly when the tables are absent; no fabricated measurements.
3. Install the validated APK. Parent → child → Screen time → Link Android creates a single-use, 10-minute pairing code. Enter it in that child's tablet Settings → Screen time. Accept the disclosure and enable notifications, Usage Access, and Tuto Accessibility.
4. Set limits in the parent app, sync on the tablet and refresh parent status until the saved revision is acknowledged.

## Implemented contract
Parent JWT + child ownership protects policy, device and usage routes. Device endpoints require a separate random 256-bit token, encrypted in Android Keystore and stored hashed server-side. Child UUID/family code alone cannot read or submit device usage. Pairing is one-use with an atomic conditional update; revocation invalidates the token. Tables have RLS with no anon/authenticated grants; only server service role accesses them.

Usage is cumulative per device/local date/package, uploaded idempotently. Android retains 93 days for retry; daily/weekly/monthly reports use the chosen date range. Unknown/unreceived periods are not displayed as zero measurements. All-device totals are sums of device usage, not deduplicated person-time. The pilot measures foreground activity, not attention or video content; PiP/split-screen may undercount. Usage metadata only; no view contents, messages, screenshots or credentials are collected by Accessibility.

Rules default disabled. Netflix, YouTube and Roblox share a daily weekday/weekend budget with individual limits and an allowed hours window (including overnight). Tuto is reported but outside the selected entertainment budget. Android retains last downloaded policy offline. Device-wide binding does not change when a child switches educational PINs. Native parent and web parent edit the same policy endpoint. Revision conflicts reject stale saves.

## Explicit limits and remaining gates
- Migration and deployed server are required before real-device pairing; do not claim deployed until verified.
- Accessibility shielding is not OS package suspension. Parents/children can disable permissions, force stop or uninstall; reports expose last heartbeat and permission state, not tamper-proof guarantees.
- Small video windows, browser equivalents of YouTube, multi-user profiles, device clock changes and Samsung process management need physical-device acceptance. No browser/domain filtering is implemented.
- Native parent has no device-revoke button yet; web parent supports revocation. Category groups, temporary bonus minutes and Gem conversion are next scope; not silently connected to the legacy web demo/chat give_screen_time tool. Old demo prefs are not migrated or enforced.
- Background sync uses WorkManager (~15-minute scheduling, not exact). With Accessibility active it attempts roughly every minute. Remote changes require connectivity; no immediate offline-unlock promise.
- Visible notification permission is required to measure/enforce in this pilot. Revoking permission stops measurement; history is partial, not a zero.
- Play Accessibility declaration and monitoring disclosure review are needed before Play distribution. This is a development APK, not store approval.

## Main → native parity
All 11 main commits through 18e2f57 merged. Rebuild bundles current math templates, hints, skip filtering, sectors drawings and dictionaries. Kotlin maps skip/review topic IDs. Native help draws picture descriptors, uses 60dp step keys, marks the asked value, hides changed place-value digits; question asks split through the shared splitAsk helper. English rhyme/synonym uses both checklist lines. Parent native includes the math-skip controls. Server reminders/task activation/English variety remain shared backend behavior. iOS shell code is preserved by merge but is not an Android implementation target.

Tests and final CI evidence will be recorded after execution. No live-family writes or notifications performed during development.
