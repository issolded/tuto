# Tuto native — Android

Native Kotlin/Compose child and parent screens using the same backend as the current browser app. Android only; iOS is outside this work. Source: `codex/android-complete`, based on web `11869e7` and native `6468f58`.

## Current scope

Family code, selected-child PIN/recovery, animated Tuto, adaptive tablet home and maths, bottom navigation, goals, English, reading/library/archive, typed and transcribed stories, homework, drawing, tree/diary, activity history and parent account/settings flows are implemented. Photos support gallery, camera and ordered cropping. Production flows use real API/Storage calls; test transports exist only in tests.

Maths uses current browser templates and figures, signed/decimal entry, help/retry, same-skill reinforcement, scratchpad, photographed paper answers with transcription confirmation, and pending final-save recovery. Topic helpers include worked steps, jumps, groups/sharing/filling, fractions, money, charts, sorting and place value. See [NATIVE_MODULES_2026-10-06.md](NATIVE_MODULES_2026-10-06.md) for precise scope and differences.

## Build

Requires JDK 17, Android SDK 35, Gradle 8.11.1 and Node 22. From the repository root:

```sh
npm ci --ignore-scripts
npm ci --prefix mobile/engine
node mobile/engine/build.mjs
node mobile/prepare-assets.mjs
cd mobile
gradle :shared:jvmTest :androidApp:testDebugUnitTest :androidApp:assembleDebug :androidApp:lintDebug
```

`-PtutoServer=https://…` overrides the default Railway backend. `mobile/public-config.json` contains only the deployed public Supabase client configuration, never a service-role key. Parent credentials are encrypted using Android Keystore; child requests do not inherit parent authorization.

The validation workflow builds both APKs, runs engine checks and JVM/lint gates, then runs tablet instrumentation on a Pixel Tablet API 35 emulator. Device tests use isolated API transports: a pass is not a live-account E2E result. This workspace lacks accelerated Android emulation, so device checks run in CI.

## Architecture

- `engine/entry.jsx` bundles the web maths curriculum/templates and SVG figure components. QuickJS runs this bundle; AndroidSVG/native figures render it. Maths generators are not copied into Kotlin.
- English and puzzle sessions, hints, decisions and rewards use the server session protocols. The server remains authoritative for rewards/caps/levels.
- The EN/TR/ES dictionary is exported from `src/lib/i18n.js`. Child language is `children.language`; native-only copy uses `Strings.say`.
- The animated avatar and task icons come from `design/native-icons`; motion respects disabled system animations.
- ViewModels own active requests and rotation state. Typed drafts and pending maths completion have device recovery; arbitrary in-flight photo/session state is not a full process-death/offline queue.

## Delivery boundary

The obsolete `android-preview` release and its APK were deleted on 6 October 2026 (cleanup run `37477802302`); source history is retained. The development workflow does not publish a rolling preview release. The target is one verified Android build, not another dummy app.

Live auth/RLS, private uploads, model evaluation and actual parent WhatsApp delivery still need a disposable test family and an approved test recipient. OAuth/deep-link login is not implemented: password login and email reset are available. Some native presentation and helper interaction details differ from the web. No production backend deploy or database migration was performed.

Do not describe a validation artifact as a complete E2E release. Debug APK signatures may differ between CI runs; an installed older preview may not accept an in-place update. Do not remove a real installed app without preserving its local unsynced work. A production signing key is not configured.

See [BUILD_STATUS.md](BUILD_STATUS.md) for exact CI/source evidence and [WEB_PARITY_AUDIT_2026-10-06.md](WEB_PARITY_AUDIT_2026-10-06.md) for the historical route inventory.
