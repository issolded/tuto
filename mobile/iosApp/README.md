# Tuto iPhone and iPad preview

SwiftUI client, iOS/iPadOS 17+. Both device families, portrait, landscape and window resizing.
Wide windows have a sidebar and two columns. Classic/Morph choices persist.
Mascot art is a simplified native illustration, not the reference's 3D artwork.

TutoCore Kotlin framework provides generation, scoring and idempotent Gem accounting.
One device-local snapshot stores questions, attempts, pending hint/answer/feedback and wallet.
No production accounts, AI assistant, parent approvals or screen-time enforcement connected.

## Build on a Mac
Install Xcode, JDK 17, Gradle 8.11.1 and XcodeGen (brew install xcodegen).
Run: bash mobile/iosApp/build-simulator.sh
Open generated mobile/iosApp/TutoPreview.xcodeproj, select an iPhone/iPad simulator, Run.
Re-run script after shared Kotlin changes. Host architecture is selected automatically.

Actions builds shared tests, Swift integration tests and UI tests on iPhone and iPad.
UI tests cover themes, rotation, completed practice and restart persistence.
Screenshots are retained inside xcresult bundles; this is not exhaustive visual QA.

Downloaded .app is SIMULATOR ONLY and matches the CI Mac architecture.
It is NOT an IPA; it cannot be installed on physical iPhone/iPad.
On a matching Mac unzip, then:
xcrun simctl install booted TutoPreview.app
xcrun simctl launch booted app.tuto.mobile.preview

Physical device: build :shared:linkDebugFrameworkIosArm64, copy that framework into
iosApp/Frameworks, regenerate project and enable signing with your own team in Xcode.
Signing is disabled by default in project.yml. No credentials are committed.
TestFlight, distribution packaging and Screen Time entitlements remain separate work.
