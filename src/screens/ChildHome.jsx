import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'
import { supabase, getChildGems } from '../lib/supabase'

const ACCENT = '#f79433'
const INK = '#241f3a'
const INK_SOFT = '#8d83ad'
const LILAC = '#e7ddf6'
const FRED = "'Fredoka', sans-serif"

const HOME_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap');
@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
.tuto-card{ transition: transform .13s ease, box-shadow .13s ease; }
.tuto-card:hover{ transform: translateY(-3px); box-shadow: 0 12px 22px rgba(40,30,70,.15); }
.tuto-card:active{ transform: scale(.97); }
.tuto-gempill{ transition: transform .12s ease; }
.tuto-gempill:active{ transform: scale(.95); }
`

const DEFAULT_TASK_GEMS = { reading: 30, math: 30, writing: 30, chore: 10 }

const BASE_TASKS = [
  { emoji: '📖', bg: '#E8E0FF', name: 'My Books',   route: '/child/library', type: 'reading' },
  { emoji: '🔢', bg: '#D4EDFF', name: 'My Math',    route: '/child/math',    type: 'math'    },
  { emoji: '✏️', bg: '#D4F5E0', name: 'My Stories', route: '/child/stories', type: 'writing' },
  { emoji: '🏠', bg: '#FFE8D4', name: 'My House',   route: '/child/task',    type: 'chore'   },
]

const NAV = [
  { id: 'home',    label: 'Home',    active: true,  route: '/child/home'    },
  { id: 'library', label: 'Library', active: false, route: '/child/library' },
  { id: 'gems',    label: 'Gems',    active: false, route: '/child/gems'    },
  { id: 'goals',   label: 'Goals',   active: false, route: '/child/goals'   },
]

function NavIcon({ id, color }) {
  const s = { width: 26, height: 26 }
  if (id === 'home')    return <svg style={s} viewBox="0 0 24 24" fill="none"><path d="M4 11l8-7 8 7" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 10v9h12v-9" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
  if (id === 'library') return <svg style={s} viewBox="0 0 24 24" fill="none"><path d="M5 5h6a2 2 0 012 2v12a2 2 0 00-2-2H5z" stroke={color} strokeWidth="2.2" strokeLinejoin="round"/><path d="M19 5h-6a2 2 0 00-2 2v12a2 2 0 012-2h6z" stroke={color} strokeWidth="2.2" strokeLinejoin="round"/></svg>
  if (id === 'gems')    return <svg style={s} viewBox="0 0 24 24" fill="none"><path d="M12 4l2.4 5 5.6.6-4 4 1 5.4-5-2.8-5 2.8 1-5.4-4-4 5.6-.6z" stroke={color} strokeWidth="2.2" strokeLinejoin="round"/></svg>
  return <svg style={s} viewBox="0 0 24 24" fill="none"><path d="M7 4h10v3a5 5 0 01-10 0z" stroke={color} strokeWidth="2.2" strokeLinejoin="round"/><path d="M7 5H4v2a3 3 0 003 3M17 5h3v2a3 3 0 01-3 3M9 16h6M10 16v4M14 16v4M8 20h8" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

export default function ChildHome() {
  const nav = useNavigate()
  const child = JSON.parse(localStorage.getItem('child') || 'null')
  const [gems, setGems] = useState(null)

  const ts = child?.task_settings || {}
  const TASKS = BASE_TASKS
    .filter(t => (ts[t.type]?.active ?? true))
    .map(t => ({ ...t, gem: ts[t.type]?.gems ?? DEFAULT_TASK_GEMS[t.type] }))

  useEffect(() => {
    if (!localStorage.getItem('family_code')) { nav('/setup', { replace: true }); return }
    if (!child?.id) { nav('/child', { replace: true }); return }

    getChildGems(child.id).then(setGems)

    const channel = supabase
      .channel(`gems-${child.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bt_ledger', filter: `child_id=eq.${child.id}` },
        (payload) => setGems(prev => (prev ?? 0) + (payload.new.amount || 0))
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  return (
    <div style={{
      minHeight: '100vh', maxWidth: 430, margin: '0 auto',
      background: LILAC, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: "'Nunito', sans-serif",
    }}>
      <style>{HOME_CSS}</style>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '54px 22px 18px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: INK_SOFT, marginBottom: 3 }}>Good morning ☀️</div>
            <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 28, color: INK, lineHeight: 1.1, letterSpacing: '-.4px', whiteSpace: 'nowrap' }}>
              Hello, {child?.name ?? 'Friend'}!
            </div>
          </div>
          <button className="tuto-gempill" onClick={() => nav('/child/gems')}
            style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#fff', border: 'none', borderRadius: 999, padding: '8px 14px',
              boxShadow: '0 3px 10px rgba(40,30,70,.12)', cursor: 'pointer',
            }}>
            <span style={{ fontSize: 16 }}>⭐</span>
            <span style={{ fontFamily: FRED, fontWeight: 600, fontSize: 17, color: ACCENT }}>
              {gems === null ? '…' : gems}
            </span>
          </button>
        </div>

        <div style={{ position: 'relative', height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0 2px' }}>
          <div style={{ position: 'absolute', width: 184, height: 184, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.95) 30%, rgba(255,255,255,0) 72%)' }} />
          <TutoMascot size={150} style={{ position: 'relative', zIndex: 1, animation: 'float 3s ease-in-out infinite' }} />
        </div>

        <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 18, color: INK, margin: '8px 2px 13px' }}>
          Ready to earn? 🌟
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
          {TASKS.map((t, i) => (
            <button key={i} className="tuto-card" onClick={() => nav(t.route, { state: t })}
              style={{
                background: '#fff', border: 'none', borderRadius: 22, padding: '12px 12px 13px',
                display: 'flex', flexDirection: 'column', gap: 7, cursor: 'pointer', textAlign: 'left',
                boxShadow: '0 6px 16px rgba(40,30,70,.09)',
              }}>
              <div style={{ background: t.bg, height: 84, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 44, lineHeight: 1 }}>{t.emoji}</span>
              </div>
              <h3 style={{ fontFamily: FRED, fontWeight: 600, fontSize: 18, color: INK, margin: '2px 0 0' }}>{t.name}</h3>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: t.bg, borderRadius: 10, padding: '3px 10px',
                  fontFamily: FRED, fontWeight: 600, fontSize: 13, color: ACCENT,
                }}>
                  <span style={{ fontSize: 12 }}>⭐</span>+{t.gem}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <nav style={{
        flexShrink: 0, background: '#fff', borderRadius: '24px 24px 0 0',
        padding: '12px 14px 22px', display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        boxShadow: '0 -6px 20px rgba(40,30,70,.07)',
      }}>
        {NAV.map(({ id, label, active, route }) => {
          const color = active ? ACCENT : '#b6aecb'
          return (
            <button key={id} onClick={() => route && nav(route)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', cursor: route ? 'pointer' : 'default', padding: '2px 8px',
              }}>
              <NavIcon id={id} color={color} />
              <span style={{ fontFamily: FRED, fontWeight: 500, fontSize: 12, color }}>{label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
