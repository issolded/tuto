# Android notebook reconstruction — 21 October 2026

User authorizes updating the main Android application, not a second package.
Base: a1a5b2b (main). Existing app ID app.tuto.mobile.preview is retained despite
its historical name. Recreated branch codex/android-notebook is not the lost
original branch; 67d5f68 / b33c58a / 59e3051 were unavailable remotely.

## Current scope
- Home / My Goals / Games / Me; monochrome line icons, white notebook shell.
- Math opens existing MathRun directly, puzzle skips the welcome screen.
- English opens the server's literacy sitting directly; text, picture, letters,
  passage groups and audio. No answer key is manufactured locally. No-audio
  discards the item as on web. Uncertain submissions cannot be blindly repeated.
- Avatar uses native SVG layers, child-keyed local preferences, colour/skin/hair,
  accessories, outfit and pet choices. Paper-white is default, optional skin tones
  follow the latest user request. Idle blink/breathing, hint entrance and pet
  follow, and completion jumps are lifecycle/reduce-motion aware.
- Stories use real records and responsive shelves; create actions remain visible
  in both active/archive modes. No stretch-to-fit room bitmap or coordinate hotspots.
- Explore contains the supplied PDF's nine Turkish review scripts (3 subjects x
  3 age bands through age 13), with local child-keyed notebook drafts. Original
  PDF calls these pilots, not validated published lessons. Initial implementation
  uses selections, ordered selection and typed explanations with explicit example
  comparison; it does NOT implement full automated assessment, drawing response,
  narration or the source JSON's interaction contract (that JSON wasn't supplied).
  The UI labels the Turkish pilot content. No Gems/mastery/cloud sync are added.
- Art image: Edouard Manet, Boating, 1874; The Met object 436947, Public Domain,
  https://www.metmuseum.org/art/collection/search/436947 . Original colours retained.
- Noto literacy images use the web's existing licensed assets.
- Patrick Hand OFL heading font; body remains Nunito for readability.

## Release gates
Do not describe this as visually identical to the approved generated concepts
without comparing actual tablet captures. Do not call simulated API tests live
family validation. Rebuilt debug signing key may differ from installed APK;
never uninstall the user's app to circumvent an update signature mismatch.
Prior 0.14 screen-control source was local and unavailable: reconciliation against
that exact build is still necessary before calling this a complete replacement.
Web/backend, database, real family data and messaging are unchanged.

## Verification of 0.16.0-notebook / versionCode 20
- Debug app and instrumentation APK assemble successfully; lint has no errors.
- 27 Android JVM tests and 5 shared JVM tests pass (32 total, no failures).
- Engine check: 162 QuickJS sessions; review check: 27 same-skill cases;
  puzzle check: 11,492 figures, no missing figures or layout failures.
- Native ELF/ZIP 16 KiB alignment passes for four 64-bit libraries; zipalign
  and APK v2 signature verification pass.
- Patrick Hand contains the checked Turkish and Spanish heading glyphs.
- The instrumentation APK includes actual-screen captures for Home, My Goals,
  Games, Me, My Stories and Explore. Building these tests is not running them.
  Tablet execution and screenshot comparison remain a release gate.
- The server-backed English help entry offers instructions, not invented answer
  hints; avatar entrance and pet follow are shown when opened.
- GitHub publication was rejected by automatic approval review because prior
  authorization covered local main-build work, not publishing source to the remote.
  No alternate push mechanism was used. A local recovery bundle is supplied.
- APK SHA256: b18a97eec0db05697aee46d6f33d10ea78838b7bda8bda24d2245b7f6d682b7e.
