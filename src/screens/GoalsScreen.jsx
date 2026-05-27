import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TutoMascot from '../components/TutoMascot'

const ANIM = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes glow {
  0%, 100% { box-shadow: 0 0 0 2.5px #2EC486, 0 6px 20px rgba(46,196,134,0.20); }
  50%       { box-shadow: 0 0 0 2.5px #2EC486, 0 6px 28px rgba(46,196,134,0.40); }
}
`

function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0
  return (
    <div style={{ background: '#F5F0D0', borderRadius: 10, height: 10, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #FF6B35, #FFD93D)', borderRadius: 10, transition: 'width 0.7s ease' }} />
    </div>
  )
}

function RewardCard({ reward, currentGems, index }) {
  const needed = reward.bt_cost || 0
  const ready = needed > 0 && currentGems >= needed
  const remaining = Math.max(0, needed - currentGems)

  return (
    <div style={{
      background: 'white',
      borderRadius: 24,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      animation: `${ready ? 'glow' : 'fadeUp'} ${ready ? '2s ease infinite' : `0.4s ease ${index * 0.07}s both`}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: '#FFF8E0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
          {reward.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#2D2D2D', marginBottom: 2 }}>{reward.name}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#C8900A' }}>⭐ {needed} Gems needed</div>
        </div>
        {ready && <div style={{ fontSize: 26, animation: 'fadeUp 0.3s ease both' }}>🎉</div>}
      </div>

      <ProgressBar current={currentGems} total={needed} />

      <div style={{ fontSize: 13, fontWeight: 700, color: ready ? '#2EC486' : '#7A7A9A' }}>
        {ready ? 'Ready to claim! 🎉' : `${remaining} more Gems to go!`}
      </div>
    </div>
  )
}

const NAV = [
  { icon: '🏠', label: 'Home',    route: '/child/home'    },
  { icon: '📚', label: 'Library', route: '/child/library' },
  { icon: '⭐', label: 'Gems',    route: '/child/gems'   },
  { icon: '🏆', label: 'Goals',   route: '/child/goals'  },
]

export default function GoalsScreen() {
  const nav = useNavigate()
  const child = JSON.parse(localStorage.getItem('child') || 'null')
  const [rewards, setRewards] = useState(null)
  const [gems, setGems] = useState(null)

  useEffect(() => {
    if (!child?.id) { setRewards([]); setGems(0); return }
    Promise.all([
      supabase.from('rewards').select('*').eq('child_id', child.id).order('gems'),
      supabase.from('bt_ledger').select('amount').eq('child_id', child.id),
    ]).then(([{ data: rewardData }, { data: ledgerData }]) => {
      setRewards(rewardData || [])
      setGems((ledgerData || []).reduce((sum, r) => sum + (r.amount || 0), 0))
    })
  }, [])

  const loading = rewards === null || gems === null

  return (
    <div style={{ background: '#FFF8E0', minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <style>{ANIM}</style>

      {/* Header */}
      <div style={{ background: '#FFD93D', padding: '52px 24px 28px', borderRadius: '0 0 32px 32px' }}>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 28, fontWeight: 900, color: '#2D2D2D', lineHeight: 1.1 }}>
          My Goals 🏆
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(45,45,45,0.60)', marginTop: 4 }}>
          {gems !== null ? `⭐ ${gems} Gems available` : ' '}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '24px 20px 80px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? (
          [0, 1, 2].map(i => (
            <div key={i} style={{ background: 'white', borderRadius: 24, height: 116, opacity: 0.4 + i * 0.15 }} />
          ))
        ) : rewards.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, paddingTop: 40 }}>
            <TutoMascot size={150} expression="default" style={{ animation: 'fadeUp 0.4s ease both' }} />
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: '#2D2D2D', textAlign: 'center', lineHeight: 1.6, animation: 'fadeUp 0.4s ease 0.1s both' }}>
              No goals yet!<br />Ask your parent to add some 🎯
            </div>
          </div>
        ) : (
          rewards.map((reward, i) => (
            <RewardCard key={reward.id} reward={reward} currentGems={gems} index={i} />
          ))
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ background: 'white', padding: '10px 4px 28px', display: 'flex', justifyContent: 'space-around', borderTop: '1px solid #F0F0E0', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100 }}>
        {NAV.map(({ icon, label, route }) => {
          const active = label === 'Goals'
          return (
            <button
              key={label}
              onClick={() => route && nav(route)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 14px', borderRadius: 16, background: active ? '#FFF0A0' : 'none', border: 'none', cursor: route ? 'pointer' : 'default', minWidth: 60 }}
            >
              <span style={{ fontSize: 22 }}>{icon}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: active ? '#C8900A' : '#A0A0BC', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
