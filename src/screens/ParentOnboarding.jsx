import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'
import { supabase } from '../lib/supabase'
import { hashPin } from '../lib/hash'

const CSS = `
@keyframes confettiFall {
  0%   { transform: translateY(0) rotate(0deg);     opacity: 1; }
  100% { transform: translateY(260px) rotate(720deg); opacity: 0; }
}
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-10px); }
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
`

const PRP  = '#7C5CBF'
const LPRP = '#EDE8FF'
const BG   = '#F8F5FF'

const DEFAULT_REWARDS = [
  { emoji: '🎮', label: 'Roblox 30min', gems: 30  },
  { emoji: '📺', label: 'TV 1 hour',    gems: 60  },
  { emoji: '🧸', label: 'New toy',      gems: 500 },
]

const TASKS_META = [
  { key: 'reading', emoji: '📚', label: 'My Books',   bg: '#E8E0FF' },
  { key: 'math',    emoji: '🔢', label: 'My Math',    bg: '#D4EDFF' },
  { key: 'writing', emoji: '✏️', label: 'My Stories', bg: '#D4F5E0' },
  { key: 'chore',   emoji: '🏠', label: 'My House',   bg: '#FFE8D4' },
]

// ─── Shared UI ────────────────────────────────────────────────────────────────

function ProgressBar({ step, total = 8 }) {
  return (
    <div style={{ padding: '52px 24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#9B8FC0', letterSpacing: '0.8px' }}>STEP {step} OF {total}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#9B8FC0' }}>{Math.round(step / total * 100)}%</span>
      </div>
      <div style={{ height: 6, background: LPRP, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${step / total * 100}%`,
          background: `linear-gradient(90deg, #9B7FD4, ${PRP})`,
          borderRadius: 8,
          transition: 'width 0.45s cubic-bezier(0.34,1.56,0.64,1)',
        }} />
      </div>
    </div>
  )
}

function BigBtn({ children, onClick, disabled, outline, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: '15px 24px',
      background: outline ? 'transparent' : (disabled ? '#C8BDE0' : PRP),
      color: outline ? PRP : 'white',
      border: outline ? `2px solid ${PRP}` : 'none',
      borderRadius: 20, fontSize: 16, fontWeight: 800,
      fontFamily: 'Nunito, sans-serif',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'opacity 0.2s',
      ...style,
    }}>{children}</button>
  )
}

function GhostBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', color: '#9B8FC0',
      fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '8px 0',
      fontFamily: 'Nunito, sans-serif',
    }}>{children}</button>
  )
}

function FieldLabel({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 800, color: PRP, letterSpacing: '0.8px', marginBottom: 8 }}>{children}</div>
}

function Input({ value, onChange, placeholder, type = 'text', style = {} }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{
      width: '100%', padding: '13px 18px',
      border: '2px solid #E8E0FF', borderRadius: 16,
      fontSize: 16, fontFamily: 'Nunito, sans-serif', fontWeight: 700, color: '#2D2560',
      background: 'white', outline: 'none', boxSizing: 'border-box', ...style,
    }} />
  )
}

// ─── PIN Pad ─────────────────────────────────────────────────────────────────

function PinPad({ value, onChange }) {
  const add = d => { if (value.length < 4) onChange(value + d) }
  const del = () => onChange(value.slice(0, -1))
  const btn = {
    background: LPRP, border: 'none', borderRadius: 18, height: 64,
    fontSize: 22, fontWeight: 800, color: '#2D2560', cursor: 'pointer',
    fontFamily: 'Nunito, sans-serif',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <div style={{ display: 'flex', gap: 16 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 18, height: 18, borderRadius: '50%',
            background: value.length > i ? PRP : LPRP,
            transition: 'background 0.2s, transform 0.15s',
            transform: value.length > i ? 'scale(1.2)' : 'scale(1)',
          }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%', maxWidth: 264 }}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} onClick={() => add(String(n))} style={btn}>{n}</button>
        ))}
        <div />
        <button onClick={() => add('0')} style={btn}>0</button>
        <button onClick={del} style={{ ...btn, fontSize: 18, color: PRP }}>⌫</button>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ParentOnboarding() {
  const nav = useNavigate()

  const [step,         setStep]         = useState(1)
  const [childName,    setChildName]    = useState('')
  const [age,          setAge]          = useState(7)
  const [tasks,        setTasks]        = useState({ reading: true, math: true, writing: true, chore: true })
  const [rewards,      setRewards]      = useState(DEFAULT_REWARDS.map(r => ({ ...r })))
  const [whatsapp,     setWhatsapp]     = useState('')
  const [pin,          setPin]          = useState('')
  const [pinConfirm,   setPinConfirm]   = useState('')
  const [pinPhase,     setPinPhase]     = useState('enter')
  const [pinError,     setPinError]     = useState('')
  const [addingReward, setAddingReward] = useState(false)
  const [newReward,    setNewReward]    = useState({ emoji: '⭐', label: '', gems: 0 })
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState('')
  const [user,         setUser]         = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  const next = () => setStep(s => s + 1)
  const back = () => {
    // Reset PIN state whenever leaving step 6 or 7
    if (step === 6 || step === 7) {
      setPinPhase('enter'); setPin(''); setPinConfirm(''); setPinError('')
    }
    setStep(s => s - 1)
  }

  // ── PIN entry logic ───────────────────────────────────────────────────────
  const handlePinInput = val => {
    if (pinPhase === 'enter') {
      setPin(val)
      if (val.length === 4) setTimeout(() => setPinPhase('confirm'), 300)
    } else {
      setPinConfirm(val)
      if (val.length === 4) {
        if (val === pin) {
          setTimeout(next, 300)
        } else {
          setPinError("PINs don't match — try again.")
          setTimeout(() => {
            setPin(''); setPinConfirm(''); setPinPhase('enter'); setPinError('')
          }, 900)
        }
      }
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleFinish = async () => {
    if (saving) return
    setSaving(true); setSaveError('')
    try {
      let uid = user
      if (!uid) {
        const { data: { user: u } } = await supabase.auth.getUser()
        uid = u; setUser(u)
      }
      if (!uid) throw new Error('Not logged in. Please sign in and try again.')

      const pin_hash = await hashPin(pin)
      const { data: child, error: cErr } = await supabase
        .from('children')
        .insert({ parent_id: uid.id, name: childName.trim(), age, pin_hash, language: 'en' })
        .select().single()
      if (cErr) throw cErr

      const active = rewards.filter(r => r.label.trim())
      if (active.length) {
        await supabase.from('rewards').insert(
          active.map(r => ({ child_id: child.id, emoji: r.emoji, name: r.label.trim(), gems: r.gems }))
        )
      }

      if (whatsapp.trim()) {
        await supabase.from('profiles').upsert({ id: uid.id, whatsapp_phone: whatsapp.trim() })
      }

      nav('/parent/dashboard')
    } catch (err) {
      setSaveError(err.message || 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  // ── Reward helpers ────────────────────────────────────────────────────────
  const updateReward = (i, field, val) =>
    setRewards(prev => prev.map((r, idx) => idx !== i ? r : {
      ...r, [field]: field === 'gems' ? (parseInt(val) || 0) : val,
    }))

  const confirmAddReward = () => {
    if (!newReward.label.trim()) return
    setRewards(prev => [...prev, { ...newReward }])
    setNewReward({ emoji: '⭐', label: '', gems: 0 })
    setAddingReward(false)
  }

  const showBack = step > 1 && step < 8

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <style>{CSS}</style>

      {step > 1 && step < 8 && <ProgressBar step={step} />}

      {showBack && (
        <button onClick={back} style={{
          alignSelf: 'flex-start', background: 'none', border: 'none',
          fontSize: 24, color: '#9B8FC0', cursor: 'pointer', margin: '14px 20px 0', padding: '4px 8px',
        }}>←</button>
      )}

      <div style={{
        flex: 1,
        padding: (step === 1 || step === 8) ? '0 24px 48px' : '18px 24px 48px',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* ── STEP 1: Welcome ──────────────────────────────────────────────── */}
        {step === 1 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, textAlign: 'center', paddingTop: 48 }}>
            <TutoMascot size={200} expression="excited" style={{ animation: 'float 3s ease-in-out infinite' }} />
            <div style={{ animation: 'fadeUp 0.5s ease' }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 32, fontWeight: 800, color: '#2D2560', lineHeight: 1.2 }}>
                Welcome to Tuto! 🎉
              </div>
              <div style={{ fontSize: 15, color: '#9B8FC0', fontWeight: 600, marginTop: 10, lineHeight: 1.6 }}>
                Let's set things up for your child.<br />Takes about 2 minutes.
              </div>
            </div>
            <BigBtn onClick={next} style={{ maxWidth: 280, marginTop: 4 }}>Get Started →</BigBtn>
          </div>
        )}

        {/* ── STEP 2: Child Info ────────────────────────────────────────────── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 24, fontWeight: 800, color: '#2D2560', lineHeight: 1.3 }}>
              Tell me about your child! 👶
            </div>
            <div>
              <FieldLabel>CHILD'S NAME</FieldLabel>
              <Input value={childName} onChange={e => setChildName(e.target.value)} placeholder="e.g. Zeynep" />
            </div>
            <div>
              <FieldLabel>AGE</FieldLabel>
              <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '2px solid #E8E0FF', borderRadius: 16, padding: '10px 18px', gap: 16 }}>
                <button onClick={() => setAge(a => Math.max(1, a - 1))} style={{ width: 44, height: 44, borderRadius: 14, background: LPRP, border: 'none', fontSize: 24, fontWeight: 800, color: PRP, cursor: 'pointer' }}>−</button>
                <div style={{ flex: 1, textAlign: 'center', fontFamily: "'Baloo 2', cursive", fontSize: 34, fontWeight: 900, color: '#2D2560' }}>{age}</div>
                <button onClick={() => setAge(a => Math.min(18, a + 1))} style={{ width: 44, height: 44, borderRadius: 14, background: LPRP, border: 'none', fontSize: 24, fontWeight: 800, color: PRP, cursor: 'pointer' }}>+</button>
              </div>
            </div>
            <BigBtn onClick={next} disabled={!childName.trim()}>Next →</BigBtn>
          </div>
        )}

        {/* ── STEP 3: Tasks ─────────────────────────────────────────────────── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 24, fontWeight: 800, color: '#2D2560', lineHeight: 1.3 }}>Which activities do you want? ✨</div>
              <div style={{ fontSize: 13, color: '#9B8FC0', fontWeight: 600, marginTop: 6 }}>Your child will see these on their home screen.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {TASKS_META.map(({ key, emoji, label, bg }) => (
                <button key={key} onClick={() => setTasks(t => ({ ...t, [key]: !t[key] }))} style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '16px 20px',
                  background: tasks[key] ? bg : 'white',
                  border: `2px solid ${tasks[key] ? 'transparent' : '#E8E0FF'}`,
                  borderRadius: 20, cursor: 'pointer', transition: 'all 0.18s', textAlign: 'left',
                }}>
                  <span style={{ fontSize: 30 }}>{emoji}</span>
                  <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: '#2D2560', fontFamily: 'Nunito, sans-serif' }}>{label}</span>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: tasks[key] ? PRP : '#E8E0FF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.18s', flexShrink: 0,
                  }}>
                    {tasks[key] && <span style={{ color: 'white', fontSize: 14, fontWeight: 900 }}>✓</span>}
                  </div>
                </button>
              ))}
            </div>
            <BigBtn onClick={next} disabled={!Object.values(tasks).some(Boolean)}>Next →</BigBtn>
          </div>
        )}

        {/* ── STEP 4: Rewards ───────────────────────────────────────────────── */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 24, fontWeight: 800, color: '#2D2560', lineHeight: 1.3 }}>What can your child earn Gems for? 💎</div>
              <div style={{ fontSize: 13, color: '#9B8FC0', fontWeight: 600, marginTop: 6 }}>Tap any field to edit.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rewards.map((r, i) => (
                <div key={i} style={{ background: 'white', border: '2px solid #E8E0FF', borderRadius: 18, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input value={r.emoji} onChange={e => updateReward(i, 'emoji', e.target.value)}
                    style={{ width: 36, border: 'none', outline: 'none', fontSize: 22, textAlign: 'center', background: 'transparent', cursor: 'text' }} />
                  <input value={r.label} onChange={e => updateReward(i, 'label', e.target.value)} placeholder="Reward name"
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, fontWeight: 700, color: '#2D2560', fontFamily: 'Nunito, sans-serif', background: 'transparent', minWidth: 0 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: LPRP, borderRadius: 12, padding: '4px 8px', flexShrink: 0 }}>
                    <input type="number" value={r.gems} onChange={e => updateReward(i, 'gems', e.target.value)}
                      style={{ width: 44, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontWeight: 800, color: PRP, fontFamily: 'Nunito, sans-serif', textAlign: 'right' }} />
                    <span style={{ fontSize: 13 }}>💎</span>
                  </div>
                  <button onClick={() => setRewards(p => p.filter((_, idx) => idx !== i))}
                    style={{ background: 'none', border: 'none', color: '#C8B8D8', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 2px' }}>×</button>
                </div>
              ))}
            </div>
            <button onClick={() => setAddingReward(true)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'none', border: '2px dashed #C8B8D8', borderRadius: 18,
              padding: '12px 16px', cursor: 'pointer', color: PRP,
              fontSize: 14, fontWeight: 800, fontFamily: 'Nunito, sans-serif',
            }}>+ Add reward</button>
            <BigBtn onClick={next}>Next →</BigBtn>
          </div>
        )}

        {/* ── STEP 5: WhatsApp ──────────────────────────────────────────────── */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 24, fontWeight: 800, color: '#2D2560', lineHeight: 1.3 }}>Get notified on WhatsApp 📱</div>
              <div style={{ fontSize: 13, color: '#9B8FC0', fontWeight: 600, marginTop: 6 }}>We'll message you when your child completes a task.</div>
            </div>
            <div style={{ background: LPRP, borderRadius: 20, padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 24 }}>💬</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#5B4B8A', lineHeight: 1.5 }}>
                "{childName || 'Your child'} just finished My Books and earned 30 Gems! 🎉"
              </span>
            </div>
            <div>
              <FieldLabel>PHONE NUMBER (OPTIONAL)</FieldLabel>
              <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+1 555 000 0000" type="tel" />
              <div style={{ fontSize: 12, color: '#B0A0CC', fontWeight: 600, marginTop: 6, paddingLeft: 2 }}>Include country code, e.g. +1, +44, +90</div>
            </div>
            <BigBtn onClick={next}>Next →</BigBtn>
            <GhostBtn onClick={next}>Skip for now</GhostBtn>
          </div>
        )}

        {/* ── STEP 6: PIN ───────────────────────────────────────────────────── */}
        {step === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 24, fontWeight: 800, color: '#2D2560' }}>
                {pinPhase === 'enter' ? 'Create a PIN for your child 🔐' : 'Confirm the PIN 🔁'}
              </div>
              <div style={{ fontSize: 13, color: '#9B8FC0', fontWeight: 600, marginTop: 6 }}>
                {pinPhase === 'enter' ? 'Your child will enter this to log in.' : 'Enter the same 4 digits again.'}
              </div>
            </div>
            {pinError && (
              <div style={{ background: '#FFE8E8', color: '#CC0000', borderRadius: 14, padding: '10px 20px', fontSize: 13, fontWeight: 700, textAlign: 'center', width: '100%' }}>
                {pinError}
              </div>
            )}
            <PinPad value={pinPhase === 'enter' ? pin : pinConfirm} onChange={handlePinInput} />
          </div>
        )}

        {/* ── STEP 7: Roblox ───────────────────────────────────────────────── */}
        {step === 7 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ fontSize: 64, textAlign: 'center', marginTop: 8 }}>🎮</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#2D2560', lineHeight: 1.3 }}>Want me to open Roblox automatically?</div>
              <div style={{ fontSize: 13, color: '#9B8FC0', fontWeight: 600, marginTop: 6, lineHeight: 1.5 }}>I'll add screen time when your child earns enough Gems.</div>
            </div>
            <div style={{ background: LPRP, borderRadius: 20, padding: '16px 18px', width: '100%' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: PRP, marginBottom: 4 }}>How it works</div>
              <div style={{ fontSize: 13, color: '#7C5CBF', lineHeight: 1.5 }}>When your child spends Gems on "Roblox 30min", Tuto will automatically launch the app and start a countdown timer.</div>
            </div>
            <div style={{ width: '100%' }}>
              <BigBtn outline disabled style={{ opacity: 0.4 }}>Yes, connect Roblox</BigBtn>
              <div style={{ textAlign: 'center', fontSize: 11, color: '#C0B0D0', fontWeight: 600, marginTop: 6 }}>Coming soon</div>
            </div>
            <GhostBtn onClick={next}>Skip for now</GhostBtn>
          </div>
        )}

        {/* ── STEP 8: All Done ─────────────────────────────────────────────── */}
        {step === 8 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, textAlign: 'center', position: 'relative', overflow: 'hidden', paddingTop: 48 }}>
            {['#FF6B35','#FFD93D','#7C5CBF','#2EC486','#FF6B8B','#6BBFD4','#FFB5C8','#B5A0E8','#FF6B35','#2EC486','#FFD93D','#7C5CBF'].map((color, i) => (
              <div key={i} style={{
                position: 'absolute', width: 10, height: 10, borderRadius: '50%', background: color,
                left: `${4 + i * 8.5}%`, top: '-14px',
                animation: `confettiFall ${1.1 + (i % 5) * 0.22}s ease-in ${i * 0.1}s infinite`,
                pointerEvents: 'none',
              }} />
            ))}
            <TutoMascot size={180} expression="excited" style={{ animation: 'float 3s ease-in-out infinite' }} />
            <div style={{ animation: 'fadeUp 0.5s ease' }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 30, fontWeight: 800, color: '#2D2560', lineHeight: 1.2 }}>All set! 🎉</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: PRP, marginTop: 10 }}>
                {childName || 'Your child'} is ready to start earning Gems!
              </div>
              <div style={{ fontSize: 14, color: '#9B8FC0', fontWeight: 600, marginTop: 6 }}>Hand the device to your child 📱</div>
            </div>
            {saveError && (
              <div style={{ background: '#FFE8E8', color: '#CC0000', borderRadius: 14, padding: '10px 20px', fontSize: 13, fontWeight: 700 }}>{saveError}</div>
            )}
            <BigBtn onClick={handleFinish} disabled={saving} style={{ maxWidth: 280 }}>
              {saving ? 'Saving...' : "Let's Go! 🚀"}
            </BigBtn>
          </div>
        )}
      </div>

      {/* ── Add reward bottom sheet ────────────────────────────────────────── */}
      {addingReward && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ background: 'white', width: '100%', maxWidth: 430, borderRadius: '32px 32px 0 0', padding: '24px 24px 44px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 40, height: 4, background: '#E8E0FF', borderRadius: 4, alignSelf: 'center', marginBottom: 4 }} />
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#2D2560' }}>Add a Reward 🎁</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <input value={newReward.emoji} onChange={e => setNewReward(r => ({ ...r, emoji: e.target.value }))}
                style={{ width: 52, padding: '12px 4px', border: '2px solid #E8E0FF', borderRadius: 14, fontSize: 24, textAlign: 'center', outline: 'none', background: LPRP }} />
              <input value={newReward.label} onChange={e => setNewReward(r => ({ ...r, label: e.target.value }))} placeholder="Reward name"
                style={{ flex: 1, padding: '12px 16px', border: '2px solid #E8E0FF', borderRadius: 14, fontSize: 15, fontFamily: 'Nunito, sans-serif', fontWeight: 700, color: '#2D2560', outline: 'none' }} />
            </div>
            <div>
              <FieldLabel>GEMS REQUIRED 💎</FieldLabel>
              <Input value={newReward.gems} onChange={e => setNewReward(r => ({ ...r, gems: parseInt(e.target.value) || 0 }))} type="number" placeholder="30" />
            </div>
            <BigBtn onClick={confirmAddReward} disabled={!newReward.label.trim()}>Add Reward</BigBtn>
            <GhostBtn onClick={() => setAddingReward(false)}>Cancel</GhostBtn>
          </div>
        </div>
      )}
    </div>
  )
}
