// The parent app's bottom tabs.
//
// Deliberately three, not four: screen control would be the obvious fourth, but it enforces
// nothing on a device yet, and a tab is a claim that something is one of the app's main jobs.
// It gets a tab when it is real; until then it lives on the child it belongs to.
//
// Shaped after the kids app's BottomNav — same fixed bar, same maxWidth hand-off — so the two
// halves of the product navigate the same way even though they look nothing alike.
import { useNavigate, useLocation } from 'react-router-dom'
import { PC, FONT, TEXT, SPACE, RADIUS, TAP, Icon } from '../lib/parentUI'
import { useT } from '../lib/parentI18n'

const PARENT_TABS = [
  { id: 'children', icon: 'user',  labelKey: 'nav_children', route: '/parent/dashboard' },
  { id: 'reports',  icon: 'chart', labelKey: 'nav_reports',  route: '/parent/reports' },
  { id: 'settings', icon: 'gear',  labelKey: 'db_settings',  route: '/parent/settings' },
]

// Which tab a path belongs to, so a screen pushed on top of a tab (a child, screen control)
// keeps that tab lit rather than lighting none. Module-local: this file exports a component
// and nothing else, which is what React Fast Refresh needs.
function tabForPath(pathname) {
  if (pathname.startsWith('/parent/reports')) return 'reports'
  if (pathname.startsWith('/parent/settings')) return 'settings'
  if (pathname.startsWith('/parent/child') || pathname.startsWith('/parent/dashboard')) return 'children'
  return null
}

export default function ParentNav({ active }) {
  const nav = useNavigate()
  const loc = useLocation()
  const s = useT()
  const current = active || tabForPath(loc.pathname)

  return (
    <nav className="tc-pnav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      margin: '0 auto',
      background: PC.card,
      borderRadius: `${RADIUS.xl}px ${RADIUS.xl}px 0 0`,
      boxShadow: '0 -6px 20px rgba(40,55,75,.07)',
      padding: `${SPACE.s2}px ${SPACE.s2}px calc(${SPACE.s5}px + env(safe-area-inset-bottom, 0px))`,
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
    }}>
      {PARENT_TABS.map(({ id, icon, labelKey, route }) => {
        const on = current === id
        return (
          <button key={id} onClick={() => nav(route)} aria-current={on ? 'page' : undefined}
            style={{
              flex: 1, minHeight: TAP.min, background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: `${SPACE.s1}px ${SPACE.s2}px`, fontFamily: FONT,
            }}>
            <Icon name={icon} size={23} color={on ? PC.tealInk : PC.inkFaint} />
            <span style={{ ...TEXT.caption, color: on ? PC.tealInk : PC.inkFaint }}>{s(labelKey)}</span>
          </button>
        )
      })}
    </nav>
  )
}
