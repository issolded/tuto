# Tuto native mobile — first review build

Isolated additive project. No existing web/backend file is modified. Base reviewed:
`c9df7b34efc629acf0bcbc7abfa2612fd014bcac`.

## Run
Open `mobile/` in Android Studio with JDK 17, Android SDK 35 and Gradle 8.11.1.
Or install Gradle 8.11.1 and run:

```
gradle :shared:jvmTest :androidApp:assembleDebug :androidApp:lintDebug
```

APK: `androidApp/build/outputs/apk/debug/androidApp-debug.apk`.
Package: `app.tuto.mobile.preview` (separate preview identity).
CI builds on the `mobile/native-tablet-preview` branch only. No deployment or production secrets.

## Implemented
- Kotlin/Jetpack Compose UI, no WebView.
- Classic pastel and reference-inspired Morph Studio design, persistent user selection.
- Native vector mascot: original simplified illustration, not a reproduction of the reference's 3D artwork.
- Width-based tablet rail / phone bottom navigation, expanded two-column home, flexible question grid, scrollable content, no orientation lock.
- Turkish/English shell; persisted theme and display name.
- Offline sample practice: addition/subtraction within 20 and AB/AAB patterns, hints and answer feedback.
- Process-restart recovery; local session/ledger written together; completion credits once.
- Local preview Gem history and screen-time requests; no live account changes.
- Optional device-local Android usage-access reading for Roblox. **No app blocking**; Android aggregate usage can lag.
- Shared Kotlin Multiplatform domain and invariant tests. Android and JVM targets; iOS framework targets available on macOS.

## Not a full migration
Preview content and rewards are explicitly separate from production. No authenticated live
account integration, AI conversation UI, camera/homework upload, books/stories/drawings,
full mathematics engine, parent approval or actual screen-time enforcement yet.
The sample generator is not a port of mathTemplates and is not a claim of full curriculum coverage.
No iOS app or signed iOS build has been produced. iOS UI and Screen Time integration remain platform-specific work.
Do not release this package as a production client.

## Migration boundary
Production code remains intact. Next development should use a staging backend implementing:
1. Signed child/device sessions after PIN verification; identity is not a child UUID.
2. Server-owned question sessions, answer verification, family/version/variant provenance.
3. Atomic idempotent attempt/reward recording keyed by session, including retry/offline rules.
4. Reward entitlement distinct from measured minutes and platform enforcement.
5. Typed API responses for native renderers. Reuse existing JS generators server-side rather than maintaining a second production learning engine.

iOS: reuse `shared` models, session rules and platform interfaces with a SwiftUI client.
On macOS: `gradle :shared:linkDebugFrameworkIosSimulatorArm64`.
Android-specific settings and usage APIs stay in androidApp.

## Review checklist
Both themes: phone portrait, tablet portrait/landscape, split screen, large system text.
Switch themes without losing balance. Complete a session, rotate/restart, verify one reward.
Try a hint, inspect independent success count. Resume a partial session. Spend only earned Gems.
Deny/revoke usage access; the UI must show no measurement, not invented usage.
Compare Morph art with supplied reference: palette/composition are represented; bespoke 3D assets are outstanding.

Build/test results must be read from Actions. Source creation alone is not proof of a successful APK or passing device test.
