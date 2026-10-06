# New module validation pending

Version 0.5.0 adds the modules documented in [NATIVE_MODULES_2026-10-06.md](NATIVE_MODULES_2026-10-06.md). The confirmed CI run below is historical and does not validate those additions. New results will be recorded separately.

# Android validation — 2026-10-06

Branch: `codex/android-complete`.
Tested source: `3217f87af424684394284cc025679ccef95cf35c`.
Version: `0.4.0-native-validation` (version code 4).
CI: https://github.com/issolded/tuto/actions/runs/37461523253

The former offline preview is withdrawn. Its older Android/iOS CI results do not
validate this app. This branch uses the live web backend by default, with native
Compose screens, the web maths/puzzle rendering engines and the animated Tuto avatar.

## Confirmed

- Source published through the connected GitHub account with the user's approval.
- Published tree matches the locally tested source (before the version-only bump).
- Local version 4 APK and instrumentation APK build successfully.
- GitHub Android job passed: APK build, 5 shared tests, 4 puzzle state tests and lint.
- CI lint: 0 errors, 11 warnings (dependency/API notices, icon/backup configuration,
  and SharedPreferences style suggestions).
- Engine checks passed; validation APK and test reports are available as CI artifacts.

## Device validation

Pixel Tablet (API 35) instrumentation passed: 4 tests, 0 failures, 0 ignored.
Coverage: selected sibling/PIN recovery, a full maths sitting, puzzle retry/hint/skip
and review decline, completed puzzle review and bottom navigation.
Seven captured images were inspected (setup, home, maths/question/result, puzzle
welcome/feedback/result); the inspected landscape views show usable controls.
Some captures lag a state transition, so screenshot filenames alone are not proof
of the named question state. Portrait, split screen, large font and physical-device
coverage remain pending.
Device tests use an injected fake API with real Compose screens and bundled engines;
they are not production account or WhatsApp delivery tests.

## Release scope

This is **not a complete web-parity release**. See `WEB_PARITY_AUDIT_2026-10-06.md`
for the route inventory and missing English, reading/library, stories/drawings,
homework, tree, history, parent and newer maths flows. No incomplete APK is being
presented as the requested finished native app. iOS is outside this task.

Real-account E2E and WhatsApp delivery still require a disposable test family and
an explicitly approved test recipient. No real family records or messages were
used by the validation above.
