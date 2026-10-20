import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'

// The English card's door (docs/ENGLISH-SKILL-LADDERS.md, "Navigasyon ve sözel akıl yürütme"): one card, like maths.
// A child with word puzzles (VR) switched on chooses between English and Word puzzles; everyone else goes straight
// into English. Inside the English section everything on screen is English (user decision 2026-10-17).

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'
const ROSE = '#D9577A'
const INK = '#241f3a'
const INK_SOFT = '#8d83ad'
const FRED = "'TrRound', 'Fredoka', 'Baloo 2', sans-serif"
const FLOW_BG = 'linear-gradient(172deg,#FFF1F4 0%,#FADBE3 100%)'

export default function EnglishMenu() {
  const nav = useNavigate()
  const [child] = useState(() => JSON.parse(localStorage.getItem('child') || 'null'))
  const [menu, setMenu] = useState(null)

  useEffect(() => {
    if (!child?.id) { nav('/child', { replace: true }); return }
    fetch(`${SERVER}/api/children/${child.id}/english-menu`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(m => (m.vr ? setMenu(m) : nav('/child/english/learn', { replace: true })))
      // The menu could not be read: the card as it was before the ladder, word puzzles.
      .catch(() => nav('/child/english/words', { replace: true }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const card = (emoji, title, line, to, tint) => (
    <button className="pz-press" onClick={() => nav(to)} style={{
      width: '100%', background: 'white', border: 'none', borderRadius: 24, padding: '20px 20px',
      display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left', cursor: 'pointer',
      boxShadow: '0 6px 20px rgba(170,50,85,.12)',
    }}>
      <span style={{ width: 62, height: 62, borderRadius: 18, background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0 }}>{emoji}</span>
      <span>
        <span style={{ display: 'block', fontFamily: FRED, fontWeight: 600, fontSize: 21, color: INK }}>{title}</span>
        <span style={{ display: 'block', fontSize: 14, color: INK_SOFT, marginTop: 2 }}>{line}</span>
      </span>
    </button>
  )

  return (
    <div style={{ background: FLOW_BG, minHeight: '100dvh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column', fontFamily: "'Nunito', sans-serif" }}>
      <style>{'.pz-press:active { transform: scale(.97) !important; }'}</style>
      <div style={{ padding: '42px 18px 0' }}>
        <button onClick={() => nav('/child/home')} aria-label="Back" style={{
          width: 42, height: 42, borderRadius: 14, background: 'rgba(255,255,255,0.85)', border: 'none',
          fontSize: 19, color: INK, fontWeight: 800, cursor: 'pointer', boxShadow: '0 3px 10px rgba(40,30,70,.1)',
        }}>←</button>
      </div>
      {menu && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 22px 40px', gap: 18 }}>
          <TutoMascot size={120} expression="excited" color={ROSE} />
          <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 21, color: INK, textAlign: 'center' }}>What would you like to do?</div>
          {card('📖', 'English', 'Words, sentences and short stories', '/child/english/learn', '#FBDDE5')}
          {card('🧩', 'Word puzzles', 'Codes, letters and word riddles', '/child/english/words', '#E3F1FF')}
        </div>
      )}
    </div>
  )
}
