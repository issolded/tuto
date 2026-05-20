import { useNavigate } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'

const tasks = [
  { emoji: '📖', bg: '#E8F4FF', name: 'Read a Book', desc: 'Take a photo of pages + write a summary', gem: 30, type: 'reading' },
  { emoji: '✏️', bg: '#FFF3E0', name: 'Write a Story', desc: 'Write about a topic and take a photo', gem: 30, type: 'writing' },
  { emoji: '🔢', bg: '#F0FFF4', name: 'Math', desc: 'Solve 10 questions and take a photo', gem: 30, type: 'math' },
  { emoji: '🛏️', bg: '#F5F0FF', name: 'Chore', desc: 'Take a photo of the task you completed', gem: 10, type: 'chore' },
]

const goals = [
  { icon: '🎮', name: 'Roblox 30dk', needed: 100, have: 75 },
  { icon: '📺', name: 'TV 1 saat', needed: 150, have: 75 },
  { icon: '🧸', name: 'Yeni oyuncak', needed: 500, have: 75 },
]

export default function ChildHome() {
  const nav = useNavigate()
  return (
    <div style={{ background: '#FFF8F0', minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: '#FF6B35', padding: '48px 24px 60px', borderRadius: '0 0 40px 40px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginBottom: 2 }}>Good morning ☀️</div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 24, fontWeight: 800, color: 'white' }}>Ada!</div>
          </div>
          <button style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.2)', border: 'none', fontSize: 22, cursor: 'pointer' }}>👧</button>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 20, display: 'flex', alignItems: 'center', gap: 16, backdropFilter: 'blur(10px)' }}>
          <div style={{ width: 56, height: 56, background: '#FFD93D', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>⭐</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Your Gems</div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 32, fontWeight: 800, color: 'white', lineHeight: 1 }}>75 Gem</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Roblox için 25 Gem daha!</div>
          </div>
        </div>
        <TutoMascot size={70} style={{ position: 'absolute', right: 24, bottom: -24, animation: 'float 3s ease-in-out infinite' }} />
      </div>

      {/* Content */}
      <div style={{ padding: '40px 24px 24px', flex: 1 }}>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#1A1A2E', marginBottom: 16 }}>🎯 Today's Tasks</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {tasks.map((t, i) => (
            <button key={i} onClick={() => nav('/child/task', { state: t })} style={{ background: 'white', borderRadius: 24, padding: 20, display: 'flex', alignItems: 'center', gap: 16, border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', transition: 'transform 0.2s', width: '100%', textAlign: 'left' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>{t.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1A2E', marginBottom: 3 }}>{t.name}</div>
                <div style={{ fontSize: 13, color: '#7A7A9A', fontWeight: 600 }}>{t.desc}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#FF6B35' }}>+{t.gem}</div>
                <div style={{ fontSize: 11, color: '#7A7A9A', fontWeight: 700, textTransform: 'uppercase' }}>Gem</div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#1A1A2E', marginBottom: 16 }}>🏆 My Goals</div>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
          {goals.map((g, i) => (
            <div key={i} style={{ background: 'white', borderRadius: 20, padding: 16, minWidth: 140, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', flexShrink: 0 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{g.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>{g.name}</div>
              <div style={{ background: '#F0F0FA', borderRadius: 8, height: 6, marginBottom: 4, overflow: 'hidden' }}>
                <div style={{ width: `${(g.have/g.needed)*100}%`, height: '100%', borderRadius: 8, background: '#FF6B35' }} />
              </div>
              <div style={{ fontSize: 11, color: '#7A7A9A', fontWeight: 700 }}>{g.have}/{g.needed} Gem</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Nav */}
      <div style={{ background: 'white', padding: '12px 24px 28px', display: 'flex', justifyContent: 'space-around', borderTop: '1px solid #F0F0FA' }}>
        {[['🏠','Home',true],['💎','Gem History',false],['🏆','Goals',false]].map(([icon,label,active]) => (
          <button key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 16px', borderRadius: 14, background: active ? '#FFF0E8' : 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: 22 }}>{icon}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: active ? '#FF6B35' : '#7A7A9A', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
