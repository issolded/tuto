import { useEffect } from 'react'

// The iOS app (mobile/iosShell) loads this site in a WKWebView and appends
// "TutoShell/<version>" to the user agent. Keep shell-specific behaviour here.
export const inShell = typeof navigator !== 'undefined' && /\bTutoShell\//.test(navigator.userAgent)

// Google refuses OAuth inside a web view, so the shell runs it in the system
// sign-in sheet and needs the redirect to come back to its own scheme
// (Shell.callbackScheme in mobile/iosShell/Sources/App.swift). Supabase must
// allow `app.tuto.mobile://**` as a redirect URL, or it falls back to the Site URL.
export function oauthRedirect(path) {
  return inShell ? `app.tuto.mobile://auth${path}` : window.location.origin + path
}

// Taptic feedback through the shell ('success' | 'error' | 'warning' | 'light' | 'selection').
// A no-op in the browser and in shell builds older than the handler.
export function haptic(kind) {
  if (!inShell) return
  try { window.webkit.messageHandlers.tutoHaptic.postMessage(kind) } catch { /* no handler */ }
}

// One buzz per answer overlay and one when a sitting pays out gems.
export function useFeedbackHaptics(flash, gemsEarned) {
  useEffect(() => { if (flash) haptic(flash.skipped ? 'light' : flash.correct ? 'success' : 'error') }, [flash])
  useEffect(() => { if (gemsEarned > 0) haptic('success') }, [gemsEarned])
}
