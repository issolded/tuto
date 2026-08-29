import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getChildGems } from '../lib/supabase'
import { NAV_ITEMS, NavIcon } from './BottomNav'
import { t, childLang } from '../lib/i18n'

const ACCENT = '#f79433'
const INK_SOFT = '#b6aecb'
const FRED = "'TrRound', 'Fredoka', 'Baloo 2', sans-serif"

// Tablet-landscape's left rail — same NAV_ITEMS/icons as BottomNav, laid out
// vertically, with the gem pill pinned to the bottom instead of living in
// ChildHome's header (the header itself isn't part of the rail).
export default function RailNav({ active }) {
  const lang = childLang(JSON.parse(localStorage.getItem('child') || 'null'))
  const nav = useNavigate()
  const child = JSON.parse(localStorage.getItem('child') || 'null')
  const [gems, setGems] = useState(null)

  useEffect(() => {
    if (!child?.id) return
    getChildGems(child.id).then(setGems)
    const channel = supabase
      .channel(`gems-rail-${child.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bt_ledger', filter: `child_id=eq.${child.id}` },
        (payload) => setGems(prev => (prev ?? 0) + (payload.new.amount || 0))
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  return (
    <nav style={{
      width: 230, flexShrink: 0, background: '#fff', display: 'flex', flexDirection: 'column',
      padding: '32px 16px', gap: 4, boxShadow: '6px 0 20px rgba(40,30,70,.07)',
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV_ITEMS.map(({ id, labelKey, route }) => {
          const isActive = id === active
          const color = isActive ? ACCENT : INK_SOFT
          return (
            <button key={id} onClick={() => nav(route)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: isActive ? 'rgba(247,148,51,.10)' : 'none',
                border: 'none', borderRadius: 14, cursor: 'pointer', padding: '12px 14px', textAlign: 'left',
              }}>
              <NavIcon id={id} color={color} />
              <span style={{ fontFamily: FRED, fontWeight: 600, fontSize: 15, color }}>{t(labelKey, lang)}</span>
            </button>
          )
        })}
      </div>
      <button onClick={() => nav('/child/gems')}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: '#FFF8E0', border: 'none', borderRadius: 999, padding: '10px 14px', cursor: 'pointer',
        }}>
        <span style={{ fontSize: 18 }}>⭐</span>
        <span style={{ fontFamily: FRED, fontWeight: 600, fontSize: 16, color: ACCENT }}>
          {gems === null ? '…' : gems}
        </span>
      </button>
    </nav>
  )
}
