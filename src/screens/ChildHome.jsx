import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'
import BottomNav from '../components/BottomNav'
import { supabase, getChildGems, drawingStepUrl } from '../lib/supabase'

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
  { bg: '#E8E0FF', name: 'My Books',   route: '/child/library', type: 'reading' },
  { bg: '#D4EDFF', name: 'My Math',    route: '/child/math',    type: 'math'    },
  { bg: '#D4F5E0', name: 'My Stories', route: '/child/stories', type: 'writing' },
  { bg: '#FFE8D4', name: 'My Tree',    route: '/child/task',    type: 'chore'   },
]

const TASK_ACCENT = { reading: '#a98ce6', math: '#5aa9e6', writing: '#6cc28a', chore: '#f3a35a' }

function TaskIcon({ type, c }) {
  if (type === 'reading') return (
    <svg width="60" height="60" viewBox="0 0 64 64" fill="none"><path d="M32 16 C26 12 18 12 12 15 L12 48 C18 45 26 45 32 49 C38 45 46 45 52 48 L52 15 C46 12 38 12 32 16 Z" fill="#fff" stroke="#20201e" strokeWidth="4" strokeLinejoin="round"/><path d="M32 16 L32 49" stroke="#20201e" strokeWidth="4" strokeLinecap="round"/><path d="M18 24 H27 M18 31 H27 M37 24 H46 M37 31 H46" stroke={c} strokeWidth="3.4" strokeLinecap="round"/></svg>
  )
  if (type === 'math') return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none"><rect x="12" y="12" width="40" height="40" rx="11" fill="#fff" stroke="#20201e" strokeWidth="4"/><path d="M22 24 H30 M26 20 V28" stroke={c} strokeWidth="3.6" strokeLinecap="round"/><path d="M35 24 H43" stroke={c} strokeWidth="3.6" strokeLinecap="round"/><circle cx="25" cy="40" r="2.4" fill={c}/><circle cx="31" cy="40" r="2.4" fill={c}/><path d="M36 37 L43 44 M43 37 L36 44" stroke={c} strokeWidth="3.4" strokeLinecap="round"/></svg>
  )
  if (type === 'writing') return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none"><path d="M40 12 L52 24 L28 48 L16 48 L16 36 Z" fill="#fff" stroke="#20201e" strokeWidth="4" strokeLinejoin="round"/><path d="M36 16 L48 28" stroke="#20201e" strokeWidth="4" strokeLinecap="round"/><path d="M16 48 L24 40" stroke="#20201e" strokeWidth="4" strokeLinecap="round"/><path d="M30 30 L40 40" stroke={c} strokeWidth="3.4" strokeLinecap="round"/></svg>
  )
  if (type === 'chore') return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none">
      <rect x="29" y="42" width="6" height="14" rx="2" fill="#A9744F" stroke="#20201e" strokeWidth="3"/>
      <path d="M16 36 C12 26 20 18 32 20 C44 18 52 26 48 36 C52 42 46 48 38 46 C34 50 30 50 26 46 C18 48 12 42 16 36 Z" fill="#fff" stroke="#20201e" strokeWidth="4" strokeLinejoin="round"/>
      <circle cx="25" cy="30" r="3.4" fill={c}/>
      <circle cx="34" cy="26" r="3.4" fill={c}/>
      <circle cx="40" cy="34" r="3.4" fill={c}/>
      <circle cx="29" cy="38" r="3.4" fill={c}/>
    </svg>
  )
  return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none"><path d="M14 30 L32 14 L50 30 L50 50 L14 50 Z" fill="#fff" stroke="#20201e" strokeWidth="4" strokeLinejoin="round"/><path d="M10 32 L32 12 L54 32" stroke="#20201e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><rect x="27" y="38" width="10" height="12" rx="1.5" fill={c}/></svg>
  )
}

// Homework tile icon — worksheet sheet + camera badge (see design handoff).
// The tile art is the age band's drawing character, not a generic icon — see
// heroArt() in the design prototype. For 6-8 that character IS the finished cat
// sketch, so it comes from the same Storage panels the guided steps use.
// The 9-11 (otter) and 12-15 (anime) sets don't exist yet; until they do those
// bands fall back to the prototype's pencil glyph.
function DrawingsIcon({ age }) {
  if (age == null || age <= 8) {
    return <img src={drawingStepUrl('cat', '6-8', 8)} alt=""
      style={{ width: 66, height: 66, objectFit: 'contain' }} />
  }
  return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none">
      <path d="M14 50 L18 38 L44 12 L52 20 L26 46 Z" fill="#fff" stroke="#20201e" strokeWidth="4" strokeLinejoin="round"/>
      <path d="M40 16 L48 24" stroke="#20201e" strokeWidth="4"/>
      <path d="M14 50 L20 48" stroke="#20201e" strokeWidth="4" strokeLinecap="round"/>
      <path d="M12 56 q6 -4 12 0" stroke="#20201e" strokeWidth="3.4" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

function HomeworkIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none">
      <rect x="14" y="8" width="30" height="40" rx="5" fill="#fff" stroke="#20201e" strokeWidth="4"/>
      <path d="M21 20h16M21 28h16M21 36h10" stroke="#f79433" strokeWidth="3.4" strokeLinecap="round"/>
      <rect x="34" y="34" width="22" height="17" rx="4" fill="#f79433" stroke="#20201e" strokeWidth="4"/>
      <circle cx="45" cy="43" r="4.5" fill="#fff" stroke="#20201e" strokeWidth="3"/>
      <path d="M40 34l1.6-3h6.8L50 34" stroke="#20201e" strokeWidth="3.4" strokeLinejoin="round"/>
    </svg>
  )
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
            <button key={i} className="tuto-card" onClick={() => nav(t.route, { state: { ...t, from: '/child/home' } })}
              style={{
                background: '#fff', border: 'none', borderRadius: 22, padding: '12px 12px 13px',
                display: 'flex', flexDirection: 'column', gap: 7, cursor: 'pointer', textAlign: 'left',
                boxShadow: '0 6px 16px rgba(40,30,70,.09)',
              }}>
              <div style={{ background: t.bg, height: 84, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TaskIcon type={t.type} c={TASK_ACCENT[t.type]} />
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

          {/* My Homework — full-width, no reward pill (reward is pending/parent-set) */}
          <button className="tuto-card" onClick={() => nav('/child/homework')}
            style={{
              gridColumn: '1 / -1',
              background: '#fff', border: 'none', borderRadius: 22, padding: 12,
              display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14,
              cursor: 'pointer', textAlign: 'left', boxShadow: '0 6px 16px rgba(40,30,70,.09)',
            }}>
            <div style={{ width: 82, height: 82, flex: '0 0 auto', background: '#FFF1CF', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HomeworkIcon />
            </div>
            <h3 style={{ fontFamily: FRED, fontWeight: 600, fontSize: 18, color: INK, margin: 0 }}>My Homework</h3>
          </button>

          {/* My Drawings — same full-width shape as My Homework. No reward pill:
              the amount is decided server-side and capped per day. */}
          <button className="tuto-card" onClick={() => nav('/child/drawings')}
            style={{
              gridColumn: '1 / -1',
              background: '#fff', border: 'none', borderRadius: 22, padding: 12,
              display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14,
              cursor: 'pointer', textAlign: 'left', boxShadow: '0 6px 16px rgba(40,30,70,.09)',
            }}>
            <div style={{ width: 82, height: 82, flex: '0 0 auto', background: '#EFE3FF', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DrawingsIcon age={child?.age} />
            </div>
            <h3 style={{ fontFamily: FRED, fontWeight: 600, fontSize: 18, color: INK, margin: 0 }}>My Drawings</h3>
          </button>
        </div>
      </div>

      <BottomNav active="home" />
    </div>
  )
}
