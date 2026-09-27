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
node mobile/prepare-assets.mjs           # drawing guides (not used by a native screen yet)
cd mobile && gradle :androidApp:assembleDebug
```

`-PtutoServer=https://…` points the app at another server (default: production Railway).
CI: `.github/workflows/tuto-mobile-preview.yml` (push to `mobile/native-tablet-preview`, or run by hand);
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

## Status

Native and working against the real server: family code, PIN, home (today, streak, Gems, goal),
maths. Every other activity (reading, stories, drawings, puzzles, homework, tree, Gems/goals
screens) shows "coming to the tablet soon" until it is ported. Not yet: the welcome bonus the web's
PIN screen writes, refreshing the child's language and settings without signing in again.
