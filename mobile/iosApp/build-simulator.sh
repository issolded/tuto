#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "$(uname -m)" = arm64 ]; then
  target=IosSimulatorArm64
  framework=iosSimulatorArm64
else
  target=IosX64
  framework=iosX64
fi
gradle ":shared:linkDebugFramework${target}" :shared:jvmTest --stacktrace
mkdir -p iosApp/Frameworks
cp -R "shared/build/bin/${framework}/debugFramework/TutoCore.framework" iosApp/Frameworks/
cd iosApp
xcodegen generate
xcodebuild -project TutoPreview.xcodeproj -scheme TutoPreview -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath build CODE_SIGNING_ALLOWED=NO build-for-testing
