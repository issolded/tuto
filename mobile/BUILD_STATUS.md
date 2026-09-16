# Verified preview builds

Branch: mobile/native-tablet-preview. Production web/backend files unchanged.

iOS source commit: 5ec7e1187c28d880b312d4ab49e948e70e2cc9a3
Successful CI: https://github.com/issolded/tuto/actions/runs/35076488854
- SwiftUI simulator app compiled for arm64.
- iPhone 17 Pro and iPad Pro 13-inch (M5), iOS 26.2 simulators.
- Two state/reward integration tests and one UI test passed on each device.
- UI test covers theme selection, device rotation, five answers, completion and restart persistence.
- Captured Morph home/settings/result screenshots inspected; no blocking overlap in these views.
- This is limited preview validation, not complete device/accessibility coverage.
- Artifact: tuto-ios-simulator (simulator .app, not a signed device IPA).

Android successful regression CI:
https://github.com/issolded/tuto/actions/runs/35075460410
Build, shared tests, lint and Pixel Tablet theme test passed.

Scope: offline child preview, Classic/Morph themes, sample practice, local Gem ledger.
No live accounts, native parent app, AI assistant, parent approval delivery or app blocking.
Physical iOS distribution needs signing and provisioning; TestFlight is not configured.
