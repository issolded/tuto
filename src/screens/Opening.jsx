import { useNavigate } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'

export default function Opening() {
  const nav = useNavigate()
  return (
    <div className="screen" style={{ background: '#1A1A2E', alignItems: 'center', justifyContent: 'center', padding: '60px 32px 48px', gap: 0 }}>
      <TutoMascot size={160} />
      <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 52, fontWeight: 800, color: '#FFD93D', letterSpacing: -1, lineHeight: 1, marginBottom: 8 }}>Tuto</div>
      <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 56, fontWeight: 600, lineHeight: 1.5 }}>
        Learn, earn, have fun!<br/>Every task brings you closer to a reward.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
        <button onClick={() => nav('/parent/login')} style={{ background: '#4D96FF', border: 'none', borderRadius: 24, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', boxShadow: '0 8px 32px rgba(77,150,255,0.4)', transition: 'transform 0.2s' }}>
          <div style={{ width: 52, height: 52, background: 'rgba(255,255,255,0.2)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>👨‍👩‍👧</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>Parent Login</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>Manage & approve tasks</div>
          </div>
          <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.6)' }}>›</span>
        </button>
        <button onClick={() => nav(localStorage.getItem('family_code') ? '/child' : '/setup')} style={{ background: '#FF6B35', border: 'none', borderRadius: 24, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', boxShadow: '0 8px 32px rgba(255,107,53,0.4)', transition: 'transform 0.2s' }}>
          <div style={{ width: 52, height: 52, background: 'rgba(255,255,255,0.2)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>⭐</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>Child Login</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>Complete tasks, earn Gems!</div>
          </div>
          <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.6)' }}>›</span>
        </button>
      </div>
    </div>
  )
}
