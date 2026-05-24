import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'
import { supabase } from '../lib/supabase'

const ACCENT = '#FF6B35'

const FLOAT_CSS = `
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-10px); }
}
`

const TASKS = [
  { emoji: '📖', bg: '#E8E0FF', name: 'My Books',   gem: 30, route: '/child/library',             type: 'reading' },
  { emoji: '🔢', bg: '#D4EDFF', name: 'My Math',    gem: 30, route: '/child/task',                type: 'math'    },
  { emoji: '✏️', bg: '#D4F5E0', name: 'My Stories', gem: 30, route: '/child/stories',            type: 'writing' },
  { emoji: '🏠', bg: '#FFE8D4', name: 'My House',   gem: 10, route: '/child/task',                type: 'chore'   },
]

const NAV = [
  { icon: '🏠', label: 'Home',    active: true,  route: '/child/home'    },
  { icon: '📚', label: 'Library', active: false, route: '/child/library' },
  { icon: '⭐', label: 'Gems',    active: false, route: null             },
  { icon: '🏆', label: 'Goals',   active: false, route: '/child/goals'  },
]

export default function ChildHome() {
  const nav = useNavigate()
  const child = JSON.parse(sessionStorage.getItem('tuto_child') || 'null')
  const [gems, setGems] = useState(null)

  useEffect(() => {
    if (!child?.id) return

    const fetchGems = async () => {
      const { data } = await supabase
        .from('bt_ledger')
        .select('amount')
        .eq('child_id', child.id)
      setGems((data || []).reduce((sum, r) => sum + (r.amount || 0), 0))
    }
    fetchGems()

    const channel = supabase
      .channel(`gems-${child.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bt_ledger', filter: `child_id=eq.${child.id}` },
        (payload) => setGems(prev => (prev ?? 0) + (payload.new.amount || 0))
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  return (
    <div style={{ background: '#F8F8FF', minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <style>{FLOAT_CSS}</style>

      {/* ── Header ── */}
      <div style={{
        background: '#EDE8FF',
        padding: '52px 20px 24px',
        borderRadius: '0 0 32px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        {/* Greeting + gems */}
        <div>
          <div style={{ fontSize: 13, color: '#9B8FC0', fontWeight: 600, marginBottom: 4 }}>
            Good morning ☀️
          </div>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 28, fontWeight: 800, color: '#2D2560', lineHeight: 1.2, marginBottom: 14 }}>
            Hello, {child?.name ?? 'Friend'}!
          </div>
          {/* Gem pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'white',
            borderRadius: 20,
            padding: '6px 14px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
          }}>
            <span style={{ fontSize: 17 }}>⭐</span>
            <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: ACCENT }}>
              {gems === null ? '...' : gems} Gems
            </span>
          </div>
        </div>

        {/* Tuto mascot */}
        <TutoMascot
          size={140}
          style={{ flexShrink: 0, animation: 'float 3s ease-in-out infinite', marginLeft: 8 }}
        />
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '24px 20px 20px', flex: 1 }}>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: '#2D2560', marginBottom: 16 }}>
          Ready to earn? 🌟
        </div>

        {/* 2×2 task grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {TASKS.map((t, i) => (
            <button
              key={i}
              onClick={() => nav(t.route, { state: t })}
              style={{
                background: t.bg,
                borderRadius: 24,
                border: 'none',
                padding: '20px 12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                aspectRatio: '1',
                transition: 'transform 0.15s ease',
              }}
              onTouchStart={e => e.currentTarget.style.transform = 'scale(0.96)'}
              onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span style={{ fontSize: 48, lineHeight: 1 }}>{t.emoji}</span>
              <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: '#2D2560', textAlign: 'center', lineHeight: 1.2 }}>
                {t.name}
              </span>
              <span style={{
                background: 'rgba(255,255,255,0.60)',
                borderRadius: 10,
                padding: '3px 10px',
                fontFamily: "'Baloo 2', cursive",
                fontSize: 12,
                fontWeight: 800,
                color: ACCENT,
              }}>
                +{t.gem} Gems
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Bottom Nav ── */}
      <div style={{
        background: 'white',
        padding: '10px 4px 28px',
        display: 'flex',
        justifyContent: 'space-around',
        borderTop: '1px solid #F0F0FA',
      }}>
        {NAV.map(({ icon, label, active, route }) => (
          <button
            key={label}
            onClick={() => route && nav(route)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '8px 14px',
              borderRadius: 16,
              background: active ? '#EDE8FF' : 'none',
              border: 'none',
              cursor: route ? 'pointer' : 'default',
              minWidth: 60,
            }}
          >
            <span style={{ fontSize: 22 }}>{icon}</span>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              color: active ? '#7C5CBF' : '#A0A0BC',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
            }}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
