import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import TutoMascot from '../components/TutoMascot'
import BottomNav from '../components/BottomNav'

const ANIM = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
`

const REASON_LABELS = {
  math:            'My Math 🔢',
  reading:         'My Books 📚',
  writing:         'My Stories ✏️',
  chore:           'My House 🏠',
  homework:        'My Homework 📸',
  bonus:           'Bonus Gift 🎁',
  spent_roblox:    'Roblox Time 🎮',
  story:           'My Stories ✏️',
  'Welcome bonus': 'Welcome Bonus 🎉',
  welcome:         'Welcome Bonus 🎉',
}

const REASON_EMOJI = {
  math: '🔢', reading: '📚', writing: '✏️',
  chore: '🏠', homework: '📸', bonus: '🎁', spent_roblox: '🎮', story: '📖',
  'Welcome bonus': '🎉', welcome: '🎉',
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function GemsScreen() {
  const child = JSON.parse(localStorage.getItem('child') || 'null')
  const [ledger, setLedger] = useState(null)

  useEffect(() => {
    if (!child?.id) { setLedger([]); return }
    supabase
      .from('bt_ledger')
      .select('*')
      .eq('child_id', child.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        console.log('[GemsScreen] bt_ledger rows:', data)
        console.log('[GemsScreen] error:', error)
        setLedger(data || [])
      })
  }, [])

  const loading = ledger === null
  const total = (ledger || []).reduce((sum, r) => sum + (r.amount || 0), 0)

  return (
    <div style={{ background: '#FFF8E0', minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <style>{ANIM}</style>

      {/* Balance card */}
      <div style={{ background: 'linear-gradient(135deg, #FFD93D 0%, #FFB347 100%)', padding: '52px 24px 36px', borderRadius: '0 0 40px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(45,45,45,0.50)', letterSpacing: '1px', textTransform: 'uppercase' }}>
          Your Gem Balance
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
          <span style={{ fontSize: 48 }}>⭐</span>
          <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 58, fontWeight: 900, color: '#2D2D2D', lineHeight: 1 }}>
            {loading ? '—' : total}
          </span>
        </div>
      </div>

      {/* Transaction history */}
      <div style={{ flex: 1, padding: '20px 20px 80px' }}>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: '#2D2D2D', marginBottom: 14 }}>
          History
        </div>

        {loading ? (
          [0, 1, 2, 3].map(i => (
            <div key={i} style={{ background: 'white', borderRadius: 16, height: 64, marginBottom: 10, opacity: 0.35 + i * 0.12 }} />
          ))
        ) : ledger.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingTop: 36, animation: 'fadeUp 0.4s ease both' }}>
            <TutoMascot size={150} expression="default" />
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: '#2D2D2D', textAlign: 'center', lineHeight: 1.6 }}>
              No gems yet!<br />Complete a task to earn your first gems! ⭐
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ledger.map((row, i) => {
              const key = row.reason || row.source || ''
              const label = REASON_LABELS[key] || 'Task ⭐'
              const emoji = REASON_EMOJI[key] || '⭐'
              const isPositive = (row.amount || 0) >= 0
              return (
                <div
                  key={row.id ?? i}
                  style={{ background: 'white', borderRadius: 18, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', animation: `fadeUp 0.35s ease ${Math.min(i, 8) * 0.05}s both` }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: '#FFF8E0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    {emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#2D2D2D' }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#B0A090', marginTop: 2 }}>
                      {row.created_at ? formatDate(row.created_at) : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: isPositive ? '#2EC486' : '#FF6B35', fontFamily: "'Baloo 2', cursive", whiteSpace: 'nowrap' }}>
                    {isPositive ? '+' : ''}{row.amount} 💎
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <BottomNav active="gems" fixed />
    </div>
  )
}
