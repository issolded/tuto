import { useEffect, useState } from 'react'
import BottomNav from './BottomNav'
import RailNav from './RailNav'

const PHONE_MAX = 430
export const TABLET_MAX = 1180

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

// Single breakpoint used everywhere a screen needs to know phone vs tablet
// width, so MathScreen/StoriesScreen (which have no nav, and so render their
// own content column instead of going through <Shell>) still cap at the same
// 430/1180 as everything else.
export function useIsTablet() {
  return useMediaQuery('(min-width: 768px)')
}

// Picks the nav for a screen and caps its content column — phone and
// tablet-portrait keep the bottom tab bar (more thumb-reach at the bottom
// edge); tablet-landscape switches to a fixed left rail instead. `active` is
// the current nav id; omit it for screens with no nav item (task flows),
// which just get the responsive width cap with no nav rendered.
export default function Shell({ active, background, children }) {
  const isTablet = useIsTablet()
  const isLandscape = useMediaQuery('(orientation: landscape)')
  const useRail = isTablet && isLandscape && !!active
  const contentMax = isTablet ? TABLET_MAX : PHONE_MAX

  return (
    <div style={{ height: '100dvh', overflow: 'hidden', display: 'flex', background }}>
      {useRail && <RailNav active={active} />}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0, width: '100%', maxWidth: contentMax, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
        {active && !useRail && <BottomNav active={active} fixed maxWidth={contentMax} />}
      </div>
    </div>
  )
}
