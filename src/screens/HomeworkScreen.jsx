import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'
import { submitHomework } from '../lib/supabase'

// "My Homework" — child photographs finished homework (up to 15 pages) and
// sends it. The child ONLY ever sees "it arrived"; Tuto's observations,
// possible errors and suggestions are never shown here (that's a rule, not a
// preference). Reward stays pending until the parent approves. Built in the
// 6–8 chunky-cute skin (the production target).
const INK = '#20201e'
const INK_SOFT = '#8d83ad'
const ORANGE = '#f79433'
const SKY = '#d4e4fb'
const MINT = '#d4eed9'
const FRED = "'Fredoka', sans-serif"
const MAX_PHOTOS = 15

const HW_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@700;800&display=swap');
@keyframes hw-pop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}}
@keyframes hw-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.hw-pop{animation:hw-pop .32s cubic-bezier(.3,1.4,.5,1) both;}
.hw-iconbtn{transition:transform .12s;} .hw-iconbtn:active{transform:scale(.94);}
.hw-addtile{transition:transform .12s,border-color .12s;}
.hw-addtile:hover{border-color:${ORANGE};transform:translateY(-2px);}
.hw-cta{transition:transform .1s;} .hw-cta:active{transform:translateY(2px);}
`

function CameraIcon({ size = 20, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="7" width="18" height="13" rx="3" stroke={color} strokeWidth="2" />
      <circle cx="12" cy="13.5" r="3.4" stroke={color} strokeWidth="2" />
      <path d="M8 7l1.4-2.2h5.2L16 7" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

export default function HomeworkScreen() {
  const nav = useNavigate()
  const child = JSON.parse(localStorage.getItem('child') || 'null')
  const fileRef = useRef(null)
  const [photos, setPhotos] = useState([]) // { file, url }
  const [screen, setScreen] = useState('upload') // 'upload' | 'sent'
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!child?.id) { nav('/child', { replace: true }); return }
  }, [])

  // Revoke object URLs on unmount to avoid leaking blob previews.
  useEffect(() => () => { photos.forEach(p => URL.revokeObjectURL(p.url)) }, [])

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []).filter(f => f.type.startsWith('image/'))
    if (!incoming.length) return
    setPhotos(prev => {
      const room = MAX_PHOTOS - prev.length
      const next = incoming.slice(0, room).map(file => ({ file, url: URL.createObjectURL(file) }))
      return [...prev, ...next]
    })
  }

  function removePhoto(idx) {
    setPhotos(prev => {
      const p = prev[idx]
      if (p) URL.revokeObjectURL(p.url)
      return prev.filter((_, i) => i !== idx)
    })
  }

  async function handleSend() {
    if (!photos.length || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await submitHomework(child.id, photos.map(p => p.file))
      setScreen('sent')
    } catch (err) {
      setError(err.message || 'Gönderilemedi, tekrar dener misin?')
    } finally {
      setSubmitting(false)
    }
  }

  function done() {
    photos.forEach(p => URL.revokeObjectURL(p.url))
    setPhotos([])
    nav('/child/home')
  }

  const count = photos.length
  const helper = count === 0
    ? 'Add at least one photo'
    : `${count} ${count === 1 ? 'photo' : 'photos'} ready ✓`

  // ── Sent (pending approval) ─────────────────────────────────────────────────
  if (screen === 'sent') {
    return (
      <div style={wrap(MINT)}>
        <style>{HW_CSS}</style>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 26px', textAlign: 'center' }}>
          <div style={{ position: 'relative', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TutoMascot size={160} expression="excited" color="#79cf86" style={{ animation: 'hw-float 3s ease-in-out infinite' }} />
          </div>
          <h2 style={{ fontFamily: FRED, fontWeight: 600, fontSize: 30, color: INK, margin: '6px 0 8px' }}>Great job! 🎉</h2>
          <p style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 16, color: '#5f5872', lineHeight: 1.5, margin: 0, maxWidth: 250 }}>
            I sent your homework to your grown-up to check.
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 999, padding: '11px 18px', marginTop: 20, boxShadow: '0 6px 16px rgba(40,30,70,.12)', fontFamily: FRED, fontWeight: 600, fontSize: 15, color: INK }}>
            <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#f5d35f', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>⏳</span>
            Waiting for ✔ · then ⭐
          </div>
        </div>
        <div style={{ flex: '0 0 auto', padding: '14px 22px 22px' }}>
          <button className="hw-cta" onClick={done} style={ctaStyle(false)}>Done</button>
        </div>
      </div>
    )
  }

  // ── Upload ──────────────────────────────────────────────────────────────────
  return (
    <div style={wrap(SKY)}>
      <style>{HW_CSS}</style>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        style={{ display: 'none' }}
        onChange={e => { addFiles(e.target.files); e.target.value = '' }}
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 22px 0' }}>
        {/* top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0 2px' }}>
          <button className="hw-iconbtn" onClick={() => nav('/child/home')} style={iconBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 17, color: INK }}>My Homework</div>
          <div style={{ width: 42 }} />
        </div>

        {/* prompt */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 20, padding: '13px 16px', boxShadow: '0 6px 16px rgba(40,30,70,.10)', marginTop: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', boxShadow: '0 4px 10px rgba(239,133,31,.4)' }}>
            <CameraIcon />
          </div>
          <span style={{ fontFamily: FRED, fontWeight: 500, fontSize: 16, color: INK, lineHeight: 1.3 }}>
            Take a photo of your finished homework!
          </span>
        </div>

        {/* photo grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
          {photos.map((p, i) => (
            <div key={p.url} className="hw-pop" style={{ position: 'relative', aspectRatio: '1', borderRadius: 20, overflow: 'hidden', background: '#eadff9', border: '3px solid #fff', boxShadow: '0 5px 14px rgba(40,30,70,.10)' }}>
              <img src={p.url} alt={`page ${i + 1}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <button onClick={() => removePhoto(i)} aria-label="remove" style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%', background: 'rgba(32,32,30,.72)', border: 'none', color: '#fff', fontSize: 16, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
          ))}
          {count < MAX_PHOTOS && (
            <button className="hw-addtile" onClick={() => fileRef.current?.click()} style={{ border: '3px dashed #c4bdd0', background: 'rgba(255,255,255,.45)', borderRadius: 20, aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', color: '#8d7fb0', fontFamily: FRED, fontWeight: 600, fontSize: 14 }}>
              <CameraIcon size={34} color="currentColor" />
              Add photo
            </button>
          )}
        </div>

        <div style={{ textAlign: 'center', fontFamily: FRED, fontWeight: 500, fontSize: 13, color: INK_SOFT, marginTop: 10 }}>
          {helper}
        </div>
        {error && (
          <div style={{ textAlign: 'center', fontFamily: FRED, fontWeight: 600, fontSize: 13, color: '#d05a4e', marginTop: 8 }}>
            {error}
          </div>
        )}
      </div>

      {/* footer */}
      <div style={{ flex: '0 0 auto', padding: '14px 22px 22px' }}>
        <button className="hw-cta" onClick={handleSend} disabled={count === 0 || submitting} style={ctaStyle(count === 0 || submitting)}>
          {submitting ? 'Sending…' : 'Send to Tuto'}
        </button>
      </div>
    </div>
  )
}

function wrap(bg) {
  return {
    minHeight: '100vh', maxWidth: 430, margin: '0 auto',
    background: bg, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    fontFamily: "'Nunito', sans-serif",
  }
}

const iconBtn = {
  width: 42, height: 42, borderRadius: '50%', background: '#fff', border: 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 3px 10px rgba(40,30,70,.10)', cursor: 'pointer',
}

function ctaStyle(disabled) {
  return {
    width: '100%', border: 'none', borderRadius: 20, padding: 17,
    fontFamily: FRED, fontWeight: 600, fontSize: 20, color: '#fff',
    background: disabled ? '#d7cfe6' : ORANGE,
    boxShadow: disabled ? 'none' : '0 8px 18px rgba(239,133,31,.45)',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
