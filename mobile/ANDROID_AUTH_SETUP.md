# Android Google sign-in setup

Native callback: `app.tuto.mobile://auth/callback`

In the existing Supabase project's Authentication → URL Configuration → Redirect URLs, add this exact URL. Retain the current web redirect URLs and Site URL. The existing Google provider must remain enabled. No service-role key, Google client secret or parent password belongs in the APK.

The Android button opens the system browser and requests a PKCE authorization code. A random verifier is encrypted with Android Keystore and expires after 10 minutes. Only the exact callback URI with one code is accepted; implicit fragment tokens, foreign hosts, duplicate codes and expired flows are rejected. The app exchanges the code with Supabase and loads the authenticated parent's own profile before unlocking. Leaving the parent area cancels a pending flow.

The URL-allowlist change and real Google-provider login cannot be verified with the current access. Automated tests cover the PKCE vector, invalid callbacks, Android deep-link routing and the initiated-flow guard with an isolated test transport.

Live verification still needs a disposable test family/account and an explicitly approved WhatsApp test recipient. Check Google return, parent ownership, child PIN, private photo upload, evaluation, reward/approval and actual notification receipt. No real family records or messages have been used for automated tests.

References:
- https://supabase.com/docs/guides/auth/native-mobile-deep-linking
- https://supabase.com/docs/guides/auth/sessions/pkce-flow
