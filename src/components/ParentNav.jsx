// The parent app's bottom tabs.
//
// Four. Screen time got its tab on 2026-10-04 by the user's call, ahead of the native app that
// will enforce it; until then that tab carries its own "web trial" banner, because a tab is a
// claim that something is one of the app's main jobs and this one is not doing it on a device yet.
//
// Drawn to match the prototype these were chosen from: a flat bar sitting on the content with
// a single hairline above it, not a floating rounded card. The kids app's BottomNav is the
// rounded one on purpose — the two halves of the product are meant to feel different, and
// this half is the calm one.
//
// Emoji glyphs, also from the prototype, and already how the rest of the parent app names
// things (👧 on the child cards, ✈ and 💬 on the channels). An inactive tab is the same glyph
// at 40% so the row reads as one set rather than as three different drawings.
import { useNavigate, useLocation } from 'react-router-dom'
import { PC, FONT, SPACE, TAP } from '../lib/parentUI'
import { useT } from '../lib/parentI18n'
import { useAskUnseen } from '../lib/parentAsk'
import { haptic } from '../lib/nativeShell'

const PARENT_TABS = [
  { id: 'children', glyph: '👧', labelKey: 'nav_children', route: '/parent/dashboard' },
  // Tuto's own tab: the same conversation the parent has on Telegram/WhatsApp. Reports moved
  // under each child (a week is always one child's week), so this place went to the product's
  // heart rather than to a second list of numbers.
  { id: 'tuto',     glyph: '💬', labelKey: 'nav_tuto',     route: '/parent/tuto' },
  { id: 'screen',   glyph: '⏱️', labelKey: 'nav_screen',   route: '/parent/screen-time' },
  { id: 'settings', glyph: '⚙️', labelKey: 'db_settings',  route: '/parent/settings' },
]

// Which tab a path belongs to, so a screen pushed on top of a tab (a child, screen control)
// keeps that tab lit rather than lighting none. Module-local: this file exports a component
// and nothing else, which is what React Fast Refresh needs.
function tabForPath(pathname) {
  if (pathname.startsWith('/parent/tuto')) return 'tuto'
  // A report is one child's week, opened from that child: it lives under Children.
  if (pathname.startsWith('/parent/reports')) return 'children'
  // Before /parent/settings: the child-view trial still lives under that path.
  if (pathname.startsWith('/parent/screen-time') || pathname.startsWith('/parent/settings/screen-control')) return 'screen'
  if (pathname.startsWith('/parent/settings')) return 'settings'
  if (pathname.startsWith('/parent/child') || pathname.startsWith('/parent/dashboard')) return 'children'
  return null
}

export default function ParentNav({ active }) {
  const nav = useNavigate()
  const loc = useLocation()
  const s = useT()
  const current = active || tabForPath(loc.pathname)
  // An answer that landed while the parent was on another tab: a dot until they open Tuto.
  const unseen = useAskUnseen()

  return (
    <nav className="tc-pnav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, viewTransitionName: 'tt-bottom-nav',
      margin: '0 auto',
      background: PC.card,
      borderTop: `1px solid ${PC.line}`,
      padding: `${SPACE.s2}px 3px calc(${SPACE.s3}px + env(safe-area-inset-bottom, 0px))`,
      display: 'flex', alignItems: 'stretch',
    }}>
      {PARENT_TABS.map(({ id, glyph, labelKey, route }) => {
        const on = current === id
        return (
          <button key={id} onClick={() => { haptic('selection'); nav(route) }} role="tab" aria-selected={on}
            aria-label={id === 'tuto' && unseen > 0 ? `${s(labelKey)} · ${s('tt_new_answer')}` : undefined}
            style={{
              flex: 1, minHeight: TAP.min, background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, padding: '4px 1px', fontFamily: FONT,
            }}>
            <span aria-hidden="true" style={{ fontSize: 19, lineHeight: 1, opacity: on ? 1 : 0.4, position: 'relative' }}>
              {glyph}
              {id === 'tuto' && unseen > 0 && !on && (
                <span style={{ position: 'absolute', top: -2, right: -6, width: 9, height: 9, borderRadius: 999, background: PC.danger, border: `2px solid ${PC.card}` }} />
              )}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '-.01em',
              color: on ? PC.tealInk : PC.inkFaint,
            }}>{s(labelKey)}</span>
          </button>
        )
      })}
    </nav>
  )
}
