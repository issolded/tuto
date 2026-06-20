import { useNavigate } from 'react-router-dom'

const ACCENT = '#f79433'
const INK_SOFT = '#b6aecb'
const FRED = "'Fredoka', sans-serif"

const NAV_ITEMS = [
  { id: 'home',    label: 'Home',    route: '/child/home'    },
  { id: 'library', label: 'Library', route: '/child/library' },
  { id: 'gems',    label: 'Gems',    route: '/child/gems'    },
  { id: 'goals',   label: 'Goals',   route: '/child/goals'   },
]

function NavIcon({ id, color }) {
  const s = { width: 26, height: 26 }
  if (id === 'home')    return <svg style={s} viewBox="0 0 24 24" fill="none"><path d="M4 11l8-7 8 7" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 10v9h12v-9" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
  if (id === 'library') return <svg style={s} viewBox="0 0 24 24" fill="none"><path d="M5 5h6a2 2 0 012 2v12a2 2 0 00-2-2H5z" stroke={color} strokeWidth="2.2" strokeLinejoin="round"/><path d="M19 5h-6a2 2 0 00-2 2v12a2 2 0 012-2h6z" stroke={color} strokeWidth="2.2" strokeLinejoin="round"/></svg>
  if (id === 'gems')    return <svg style={s} viewBox="0 0 24 24" fill="none"><path d="M12 4l2.4 5 5.6.6-4 4 1 5.4-5-2.8-5 2.8 1-5.4-4-4 5.6-.6z" stroke={color} strokeWidth="2.2" strokeLinejoin="round"/></svg>
  return <svg style={s} viewBox="0 0 24 24" fill="none"><path d="M7 4h10v3a5 5 0 01-10 0z" stroke={color} strokeWidth="2.2" strokeLinejoin="round"/><path d="M7 5H4v2a3 3 0 003 3M17 5h3v2a3 3 0 01-3 3M9 16h6M10 16v4M14 16v4M8 20h8" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

// Shared footer nav (Home/Library/Gems/Goals) — kept identical across all screens so it
// never visually drifts from the ChildHome version again. Pass `fixed` for screens whose
// content scrolls independently of the page (Library, Gems, Goals); ChildHome lays it out
// inline as the last flex child instead.
export default function BottomNav({ active, fixed = false }) {
  const nav = useNavigate()
  return (
    <>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap');`}</style>
    <nav style={{
      flexShrink: 0, background: '#fff', borderRadius: '24px 24px 0 0',
      padding: '12px 14px 22px', display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      boxShadow: '0 -6px 20px rgba(40,30,70,.07)',
      ...(fixed ? { position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 430, margin: '0 auto', zIndex: 100 } : {}),
    }}>
      {NAV_ITEMS.map(({ id, label, route }) => {
        const color = id === active ? ACCENT : INK_SOFT
        return (
          <button key={id} onClick={() => nav(route)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px' }}>
            <NavIcon id={id} color={color} />
            <span style={{ fontFamily: FRED, fontWeight: 500, fontSize: 12, color }}>{label}</span>
          </button>
        )
      })}
    </nav>
    </>
  )
}
