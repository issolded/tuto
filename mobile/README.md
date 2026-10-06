# Tuto native — Android

Current module implementation and remaining parity differences: [NATIVE_MODULES_2026-10-06.md](NATIVE_MODULES_2026-10-06.md).

English, reading/library, stories, homework, drawing, parent flows and newer maths flows now have native implementations on this branch. Validation is in progress; this is not a complete-release claim.

## Previous baseline (superseded implementation scope)

# Tuto native — Android child app

The child side of Tuto as a native Android (Jetpack Compose) tablet app, talking to the same
Express server as the web app. The iOS preview in `iosApp/` is older and not updated by this work.

## Build

JDK 17, Android SDK 35, Gradle 8.11.1, Node 22. From the repo root:

```
npm ci --ignore-scripts                 # the web app's dependencies (React, for the figures)
npm ci --prefix mobile/engine            # esbuild + quickjs-emscripten
node mobile/engine/build.mjs             # engine, dictionary and animations -> androidApp/src/main/assets
node mobile/engine/qjs-test.mjs          # the engine in real QuickJS: every age, 3 languages
node mobile/prepare-assets.mjs           # drawing guides and public client configuration
cd mobile && gradle :androidApp:assembleDebug
```

`-PtutoServer=https://…` points the app at another server (default: production Railway).
CI: `.github/workflows/tuto-mobile-preview.yml` (native development branches, or run by hand);
it builds, lints, and runs `TabletTest` on a Pixel Tablet emulator.

## How it fits together

- **Server.** Only the endpoints the web's child screens use: `/api/family/:code/children`,
  `/verify-pin`, `/api/children/:id/today-summary`, `/math-plan`, `/math-session`. The server still
  decides Gems, caps and level; the app never writes a reward itself (`data/Api.kt`).
- **Maths is the web's engine.** `engine/entry.jsx` bundles `src/lib/mathCurriculum.js`,
  `src/lib/mathTemplates.js` and the web's figure components (`MathGeometry`, `MathChart`,
  `MathFigure`, `ClockFace`) rendered to SVG. The app runs the bundle in QuickJS
  (`data/MathEngine.kt`) and draws the SVG with AndroidSVG. There is no Kotlin copy of the
  templates to drift. Five HTML-laid figures (count, pictogram, shapes, prices, digital) are drawn
  natively in `ui/Figure.kt`.
- **Words.** The child's dictionary is `src/lib/i18n.js`, exported to `assets/i18n.json` at build
  time; language is `children.language`. Tablet-only words use `Strings.say(en, tr, es)`.
- **Tuto and the icons** are the Lottie files from `design/native-icons` (`fox.json`: idle 0-120,
  cheer 120-168; task icons: idle 0-90, done 90-120). Motion stops when animations are off.
- **Rules kept from the web:** 8 and under get help and a retry after a wrong answer and may skip
  once helped; 9 and over get one attempt and the answer with its reason. Recently asked topics and
  operands are remembered so questions do not repeat.

## Status — 2026-10-06

The real-server native source was recovered from `claude/practical-franklin-xigneu` at
`6468f58`, not the older offline `mobile/native-tablet-preview` branch. The current web
`main` at `11869e7` has been merged into `codex/android-complete` and published to GitHub.

Implemented native routes: family setup, selected child/PIN, home, maths, puzzles,
Gems/reward goals and account switching/settings. The selected child now accompanies the PIN request; the current
server's puzzle retry response no longer advances to the next question. Failed home
refreshes preserve the last known balance and show an error instead of inventing zero.
Setup, PIN, home cards and maths adapt to the actual window and font scale.

**Not a complete release.** English, reading, library/archive, stories/cloud drafts,
drawings, homework, tree/contributions, settings, activity history and the latest
maths/English help and reinforcement flows still need native implementation. Puzzle hints, skip and reinforcement start/finish/decline are now connected. Maths paper mode and scratchpad
are also missing. Merging web sources does not port React screens to Compose.

The user's offline dummy APK was withdrawn. No replacement incomplete APK is being
delivered. The CI publishes validation artifacts only; the old automatic rolling preview
release job has been removed. A complete Android build is the sole delivery target.

Backend WhatsApp Business integration exists. End-to-end delivery to a verified test
recipient has not been exercised here. The source-level inventory of every web route is in `WEB_PARITY_AUDIT_2026-10-06.md`.
Native device tests require an Android device or
an accelerated emulator; this local environment has no KVM.

## Validation in this workspace

- Web engine in real QuickJS: 162 maths sessions, no short sessions or skipped questions.
- Puzzle SVG rendering: 11,492 figures, zero missing.
- Family selection/code and answer retry server rules: 16 tests passed.
- Shared Kotlin tests: 5 passed.
- Android debug app and instrumentation APK compile; lint: zero errors, six warnings.
- Pixel Tablet API 35 instrumentation: 4 tests passed in GitHub CI. These use an
  injected test API, not production accounts. Physical-device testing remains pending.

2026-10-06 follow-up: four Android JVM puzzle state tests pass. The isolated real-server
puzzle matrix (age 8, EN/TR/ES) also passes, including review decisions, caps and captured
parent notifications. Home/goals/settings now use bottom navigation, never a left rail.
The selected-child forgot-PIN action and reward-request failure feedback are implemented.
Pixel Tablet emulator tests have now passed; live WhatsApp delivery remains untested.
See `BUILD_STATUS.md` for the exact tested commit, CI link and validation limits.
