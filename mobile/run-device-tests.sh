#!/usr/bin/env bash
# Retain screenshots even when a device assertion fails.
cd "$(dirname "$0")" || exit 1
gradle :androidApp:connectedDebugAndroidTest --stacktrace
tuto_test_status=$?
adb pull /sdcard/Android/data/app.tuto.mobile.preview/files/screenshots mobile-screenshots || true
exit "$tuto_test_status"
