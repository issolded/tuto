# Tuto iOS shell

A universal (iPhone + iPad) app that loads the live web app in a WKWebView.

**What needs an App Store release and what doesn't.** Anything that ships with a
Vercel/Railway deploy — screens, questions, hints, translations, the `src/lib`
engine, a whole new module — reaches this app with the deploy. Only changes in
this folder need a release: native features (Screen Time, notifications), new
permissions, the icon, the shell's own behaviour.

## Open

```bash
brew install xcodegen      # once
cd mobile/iosShell
cp Config/Local.xcconfig.example Config/Local.xcconfig   # put your Team ID in it
xcodegen generate
open Tuto.xcodeproj
```

`Tuto.xcodeproj` is generated and git-ignored: edit `project.yml` /
`Config/Base.xcconfig`, then run `xcodegen generate` again. Settings changed in
Xcode's UI are lost on the next generate.

## TestFlight

```bash
./upload-testflight.sh
```

Bump `CURRENT_PROJECT_VERSION` in `Config/Base.xcconfig` before each upload.
Needs the Apple Distribution certificate in this Mac's keychain; the script
explains why. Testers: you are an internal tester (no review); people outside
the App Store Connect team are external testers (first build of a version goes
through Beta App Review).

## Settings

| What | Where |
|---|---|
| Bundle ID (`app.tuto.mobile`), version | `Config/Base.xcconfig` |
| Site URL (production) | `TUTO_WEB_URL` in `Config/Base.xcconfig` |
| Local dev server | Scheme → Run → Arguments: enable `-TutoWebURL http://localhost:5173` (simulator only) |
| Signing team | `Config/Local.xcconfig` |

## What the shell does

- Keeps the page inside the safe area; strips behind the status bar and home
  indicator take the page's background colour.
- Session and `localStorage` persist between launches.
- Pinch zoom, link previews and the back-swipe are off (children).
- Links to other sites and `tg:`/`mailto:` open outside the app.
- `window.alert/confirm/prompt` work (WKWebView drops them otherwise).
- No connection: a native screen that retries by itself when the network returns.
- Camera for photo inputs (`<input type=file>`), permission text in EN/TR/ES.
- User agent ends with `TutoShell/<version>`; the web app reads it in
  `src/lib/nativeShell.js`.
- Debug builds are inspectable from Safari → Develop.

### Google sign-in

Google blocks OAuth inside web views. In the shell the web app sets
`redirectTo` to `app.tuto.mobile://auth/<path>`; the shell intercepts
Supabase's `/auth/v1/authorize`, runs it in `ASWebAuthenticationSession` and
loads the returned tokens back into the page.

**Needs once in Supabase:** Authentication → URL Configuration → Redirect URLs
→ add `app.tuto.mobile://**`. Without it Google sign-in in the app ends on the
website inside the sign-in sheet. Email/password sign-in does not need it.

Before App Store submission (not TestFlight): an app that offers Google
sign-in must also offer Sign in with Apple (guideline 4.8).
