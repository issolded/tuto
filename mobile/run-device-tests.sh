#!/usr/bin/env bash
# Retain screenshots even when a device assertion fails.
cd "$(dirname "$0")" || exit 1
if [ "${1:-default}" = "google_apis_ps16k" ]; then
  tuto_page_size=$(adb shell getconf PAGE_SIZE | tr -d '\r')
  echo "Emulator page size: $tuto_page_size"
  [ "$tuto_page_size" = "16384" ] || exit 1
fi
gradle :androidApp:connectedDebugAndroidTest --stacktrace -Pandroid.injected.androidTest.leaveApksInstalledAfterRun=true
tuto_test_status=$?
adb pull /sdcard/Android/data/app.tuto.mobile.preview/files/screenshots mobile-screenshots || true
exit "$tuto_test_status"
