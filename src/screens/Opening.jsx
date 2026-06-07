import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PC, FONT, SHADOW, PCSS, Icon, TutoMascot } from '../lib/parentUI'

export default function Opening() {
  const nav = useNavigate()

  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'pcss-opening'
    el.textContent = PCSS
    if (!document.getElementById('pcss-opening')) document.head.appendChild(el)
    return () => { document.getElementById('pcss-opening')?.remove() }
  }, [])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100dvh', background: PC.bg, padding: '60px 26px 52px', gap: 0,
    }}>
      {/* mascot + glow */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <div style={{
          position: 'absolute', inset: -30,
          background: 'radial-gradient(circle, rgba(63,183,172,.22) 0%, transparent 72%)',
          borderRadius: '50%', pointerEvents: 'none',
        }} />
        <div style={{ animation: 'tcFloat 3.6s ease-in-out infinite', position: 'relative' }}>
          <TutoMascot size={148} color={PC.teal} />
        </div>
      </div>

      {/* wordmark */}
      <div style={{
        fontFamily: FONT, fontWeight: 800, fontSize: 42, color: PC.ink,
        letterSpacing: '-1.4px', lineHeight: 1, marginBottom: 10,
      }}>
        tuto
      </div>
      <div style={{
        fontFamily: FONT, fontWeight: 600, fontSize: 15.5, color: PC.inkSoft,
        textAlign: 'center', lineHeight: 1.55, marginBottom: 52,
      }}>
        Learn, earn, have fun!<br />Every task brings you closer to a reward.
      </div>

      {/* role cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 380 }}>
        {/* parent */}
        <button className="tc-press tc-tap" onClick={() => nav('/parent/login')} style={{
          background: '#fff', border: 'none', borderRadius: 22, padding: '18px 20px',
          display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer',
          boxShadow: SHADOW, width: '100%',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, background: PC.tealBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name="user" size={26} color={PC.teal} />
          </div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 17, color: PC.ink }}>Parent Login</div>
            <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 2 }}>Manage &amp; approve tasks</div>
          </div>
          <Icon name="chevron" size={20} color={PC.inkFaint} />
        </button>

        {/* child */}
        <button className="tc-press tc-tap"
          onClick={() => nav(localStorage.getItem('family_code') ? '/child' : '/setup')}
          style={{
            background: '#fff', border: 'none', borderRadius: 22, padding: '18px 20px',
            display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer',
            boxShadow: SHADOW, width: '100%',
          }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, background: PC.amberBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name="sparkle" size={26} color={PC.amber} />
          </div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 17, color: PC.ink }}>Child Login</div>
            <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 2 }}>Complete tasks, earn Gems!</div>
          </div>
          <Icon name="chevron" size={20} color={PC.inkFaint} />
        </button>
      </div>
    </div>
  )
}
