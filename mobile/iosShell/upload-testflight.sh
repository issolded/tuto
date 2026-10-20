#!/bin/zsh
# Builds and uploads a TestFlight build. Bump CURRENT_PROJECT_VERSION in
# Config/Base.xcconfig first: App Store Connect refuses a build number twice.
#
# Why it looks like this: the team is an Individual account with no registered
# devices, so Xcode's automatic signing can't produce the development profile it
# wants at archive time. The archive is built unsigned and the export signs it with
# the Apple Distribution certificate in this Mac's keychain (Xcode → Settings →
# Accounts → Manage Certificates). Without a *local* distribution certificate the
# export falls back to cloud signing, and App Store Connect rejected that build
# with "Invalid Signature".
set -euo pipefail
cd "${0:A:h}"
export DEVELOPER_DIR=${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}

security find-identity -v -p codesigning | grep -q 'Apple Distribution' \
  || { echo 'No Apple Distribution certificate in the keychain (see comment above).'; exit 1; }

TEAM=$(sed -n 's/^DEVELOPMENT_TEAM *= *//p' Config/Local.xcconfig 2>/dev/null)
[[ -n $TEAM ]] || { echo 'Set DEVELOPMENT_TEAM in Config/Local.xcconfig (see Local.xcconfig.example).'; exit 1; }

xcodegen generate -q
rm -rf build/Tuto.xcarchive build/upload
xcodebuild -project Tuto.xcodeproj -scheme Tuto -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/Tuto.xcarchive \
  CODE_SIGNING_ALLOWED=NO archive -quiet

cat > build/export-upload.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>signingStyle</key><string>automatic</string>
  <key>teamID</key><string>$TEAM</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
PLIST
xcodebuild -exportArchive -archivePath build/Tuto.xcarchive -exportPath build/upload \
  -exportOptionsPlist build/export-upload.plist -allowProvisioningUpdates
