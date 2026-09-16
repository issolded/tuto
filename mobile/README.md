# Tuto native mobile — first review build

Isolated additive project. No existing web/backend file is modified. Base reviewed:
`c9df7b34efc629acf0bcbc7abfa2612fd014bcac`.

## Run
Open `mobile/` in Android Studio with JDK 17, Android SDK 35 and Gradle 8.11.1.
Or install Gradle 8.11.1 and run:

```
node prepare-assets.mjs
gradle :shared:jvmTest :androidApp:assembleDebug :androidApp:lintDebug
```

APK: `androidApp/build/outputs/apk/debug/androidApp-debug.apk`.
Package: `app.tuto.mobile.preview` (separate preview identity).
CI builds on the `mobile/native-tablet-preview` branch only. No deployment or production secrets.

## Implemented
- Android Kotlin/Jetpack Compose and iOS SwiftUI clients; no WebView.
- Classic pastel and reference-inspired Morph Studio design, persistent user selection.
- Native vector mascot: original simplified illustration, not a reproduction of the reference's 3D artwork.
- Bottom navigation on both tablet and phone, expanded two-column home, flexible question grid, scrollable content, no orientation lock.
- Turkish/English shell; persisted theme and display name.
- Offline sample practice: addition/subtraction within 20 and AB/AAB patterns, hints and answer feedback.
- Process-restart recovery; local session/ledger written together; completion credits once.
- Local preview Gem history and screen-time requests; no live account changes.
- Optional device-local Android usage-access reading for Roblox. **No app blocking**; Android aggregate usage can lag.
- Shared Kotlin Multiplatform domain and invariant tests. Android and JVM targets; iOS framework targets available on macOS.

## Not a full migration
Preview content and rewards are explicitly separate from production. No authenticated live
account integration, AI conversation UI, camera/homework upload, live books/stories/drawings sync,
full mathematics engine, parent approval or actual screen-time enforcement yet.
The sample generator is not a port of mathTemplates and is not a claim of full curriculum coverage.
The iPhone/iPad SwiftUI client lives in `iosApp/`. See its README for simulator builds.
No signed device IPA or TestFlight distribution has been produced; Screen Time integration remains outstanding.
Do not release this package as a production client.

## Migration boundary
Production code remains intact. Next development should use a staging backend implementing:
1. Signed child/device sessions after PIN verification; identity is not a child UUID.
2. Server-owned question sessions, answer verification, family/version/variant provenance.
3. Atomic idempotent attempt/reward recording keyed by session, including retry/offline rules.
4. Reward entitlement distinct from measured minutes and platform enforcement.
5. Typed API responses for native renderers. Reuse existing JS generators server-side rather than maintaining a second production learning engine.

iOS: the SwiftUI client uses `shared` generation, scoring and wallet rules through PreviewBridge.
On macOS: `gradle :shared:linkDebugFrameworkIosSimulatorArm64`.
Android-specific settings and usage APIs stay in androidApp.

## Review checklist
Both themes: phone portrait, tablet portrait/landscape, split screen, large system text.
Switch themes without losing balance. Complete a session, rotate/restart, verify one reward.
Try a hint, inspect independent success count. Resume a partial session. Spend only earned Gems.
Deny/revoke usage access; the UI must show no measurement, not invented usage.
Compare Morph art with supplied reference: palette/composition are represented; bespoke 3D assets are outstanding.

Build/test results must be read from Actions. Source creation alone is not proof of a successful APK or passing device test.

## Studio design preview 0.2

Android now uses bottom navigation at every width, English by default, bundled Fredoka/Nunito fonts, and a reference-inspired illustrated home. Classic and Morph remain selectable.

New native screens: own-book reading tracker; autosaved story drafts and saved story reader; existing drawing collection with audited English instructions and a persistent finger/stylus sketchbook; self-recorded daily contribution tree and archive; homework notes; local goal selection; three age bands of Science starter investigations with answer explanations. These are usable device-local flows, not live Supabase content or AI assessment. A tree record never credits Gems or impersonates parental approval.

Production books are child-specific database records, not bundled ebooks. Add your own book to test the reading tracker. Science has nine authored starter investigations across three age bands, not full curriculum coverage. Maths/NVR retain the previous starter practice engines; the separate NVR branch was not merged.

Before building, run `node prepare-assets.mjs` from mobile. It packages repository drawing guides read-only and excludes the unpublished robot/master sets. Fonts are bundled offline under SIL OFL; see licenses/. Generated studio art is bundled in Android resources. No runtime asset downloads are required.

This design update targets Android. The existing iOS preview has not yet received these new screens.
