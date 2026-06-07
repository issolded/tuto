import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { hashPin } from '../lib/hash'
import {
  PC, FONT, SHADOW, SHADOW_SM, PCSS,
  Btn, Card, Field, Toggle, Pill, BottomSheet, Icon, TaskIcon, PinPad, Confetti, TutoMascot,
} from '../lib/parentUI'

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'

const DEFAULT_REWARDS = [
  { emoji: '🎮', label: 'Roblox 30min', gems: 30,  lockTitle: true,  hint: '💡 30 mins of playtime' },
  { emoji: '📺', label: 'TV 1 hour',    gems: 60,  lockTitle: true,  hint: '💡 1 hour of screen time' },
  { emoji: '🧸', label: 'New toy',      gems: 500, lockTitle: false, hint: '💡 Something special to save up for!' },
]

const TASKS_META = [
  { key: 'reading', label: 'My Books' },
  { key: 'math',    label: 'My Math' },
  { key: 'writing', label: 'My Stories' },
  { key: 'chore',   label: 'My House' },
]

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ step, total = 10 }) {
  return (
    <div style={{ padding: '52px 24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 800, color: PC.inkFaint, letterSpacing: '.6px' }}>STEP {step} OF {total}</span>
        <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 800, color: PC.inkFaint }}>{Math.round(step / total * 100)}%</span>
      </div>
      <div style={{ height: 6, background: PC.tealBg, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${step / total * 100}%`,
          background: `linear-gradient(90deg, ${PC.teal}, ${PC.tealDeep})`,
          borderRadius: 8, transition: 'width .45s cubic-bezier(.34,1.56,.64,1)',
        }} />
      </div>
    </div>
  )
}

export default function ParentOnboarding() {
  const nav = useNavigate()

  const [step,            setStep]            = useState(1)
  const [childName,       setChildName]       = useState('')
  const [age,             setAge]             = useState(7)
  const [tasks,           setTasks]           = useState({ reading: true, math: true, writing: true, chore: true })
  const [rewards,         setRewards]         = useState(DEFAULT_REWARDS.map(r => ({ ...r })))
  const [whatsapp,        setWhatsapp]        = useState('')
  const [notifChannel,    setNotifChannel]    = useState(null)
  const [emailNotif,      setEmailNotif]      = useState(true)
  const [pushNotif,       setPushNotif]       = useState(true)
  const [codeCopied,      setCodeCopied]      = useState(false)
  const [waPhone,         setWaPhone]         = useState('')
  const [waSending,       setWaSending]       = useState(false)
  const [waVerifySent,    setWaVerifySent]    = useState(false)
  const [waError,         setWaError]         = useState('')
  const [pin,             setPin]             = useState('')
  const [pinConfirm,      setPinConfirm]      = useState('')
  const [pinPhase,        setPinPhase]        = useState('enter')
  const [pinError,        setPinError]        = useState('')
  const [deviceMode,      setDeviceMode]      = useState(null)
  const [familyCode,      setFamilyCode]      = useState(null)
  const [addingReward,    setAddingReward]    = useState(false)
  const [editingLabelIdx, setEditingLabelIdx] = useState(null)
  const [newReward,       setNewReward]       = useState({ emoji: '⭐', label: '', gems: '' })
  const [saving,          setSaving]          = useState(false)
  const [saveError,       setSaveError]       = useState('')
  const [user,            setUser]            = useState(null)

  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'pcss-onboarding'
    el.textContent = PCSS
    if (!document.getElementById('pcss-onboarding')) document.head.appendChild(el)
    return () => { document.getElementById('pcss-onboarding')?.remove() }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => {
    if ((step !== 5 && step !== 10) || !user) return
    const load = async () => {
      const { data } = await supabase.from('parents').select('family_code').eq('id', user.id).single()
      if (data?.family_code) {
        setFamilyCode(data.family_code)
      } else {
        const code = Math.random().toString(36).substring(2, 10).toUpperCase()
        await supabase.from('parents').update({ family_code: code }).eq('id', user.id)
        setFamilyCode(code)
      }
    }
    load()
  }, [step, user])

  const hasRobloxReward = rewards.some(r => r.label.toLowerCase().includes('roblox'))

  const next = () => setStep(s => s + 1)
  const back = () => {
    if (step === 6 || step === 7) {
      setPinPhase('enter'); setPin(''); setPinConfirm(''); setPinError('')
    }
    if (step === 9 && !hasRobloxReward) { setStep(7); return }
    setStep(s => s - 1)
  }

  const handlePinInput = async val => {
    if (pinPhase === 'enter') {
      setPin(val)
      if (val.length === 4) setTimeout(() => setPinPhase('confirm'), 300)
    } else {
      setPinConfirm(val)
      if (val.length === 4) {
        if (val === pin) {
          if (user) {
            const pin_hash = await hashPin(pin)
            const { data: existing } = await supabase
              .from('children').select('pin_hash').eq('parent_id', user.id)
            if (existing?.some(c => c.pin_hash === pin_hash)) {
              setPinError('This PIN is already used by another child. Choose a different one.')
              setTimeout(() => { setPin(''); setPinConfirm(''); setPinPhase('enter'); setPinError('') }, 1500)
              return
            }
          }
          setTimeout(next, 300)
        } else {
          setPinError("PINs don't match — try again.")
          setTimeout(() => { setPin(''); setPinConfirm(''); setPinPhase('enter'); setPinError('') }, 900)
        }
      }
    }
  }

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
        .select()
        .single()
      if (cErr) throw cErr

      const active = rewards.filter(r => r.label.trim())
      if (active.length) {
        await supabase.from('rewards').insert(active.map(r => ({ child_id: child.id, icon: r.emoji, name: r.label.trim(), bt_cost: r.gems })))
      }

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      await supabase.from('parents').update({
        email_notifications: emailNotif,
        push_notifications: pushNotif,
        timezone,
        ...(whatsapp.trim() && { whatsapp_phone: whatsapp.trim() }),
        ...(notifChannel && { notification_channel: notifChannel }),
      }).eq('id', uid.id)

      fetch(`${SERVER}/api/send-welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: uid.id }),
      }).catch(() => {})

      if (deviceMode === 'separate') {
        setSaving(false)
        setStep(10)
      } else {
        nav('/parent/dashboard')
      }
    } catch (err) {
      setSaveError(err.message || 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  const updateReward = (i, field, val) =>
    setRewards(prev => prev.map((r, idx) => idx !== i ? r : {
      ...r, [field]: field === 'gems' ? (parseInt(val) || 0) : val,
    }))

  const confirmAddReward = () => {
    if (!newReward.label.trim()) return
    setRewards(prev => [...prev, { ...newReward, gems: parseInt(newReward.gems) || 0 }])
    setNewReward({ emoji: '⭐', label: '', gems: '' })
    setAddingReward(false)
  }

  const showBack = step > 1 && step < 9

  return (
    <div style={{ background: PC.bg, minHeight: '100dvh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column', fontFamily: FONT }}>

      {step > 1 && <ProgressBar step={step} />}

      {showBack && (
        <button className="tc-press tc-tap" onClick={back} style={{
          alignSelf: 'flex-start', width: 42, height: 42, borderRadius: 14,
          background: '#fff', border: `1.5px solid ${PC.line}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', margin: '14px 20px 0', boxShadow: SHADOW_SM,
        }}>
          <Icon name="back" size={20} color={PC.ink} />
        </button>
      )}

      <div className="tc-scroll" style={{
        flex: 1, padding: step === 1 ? '0 24px 48px' : '18px 24px 48px',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* ── STEP 1: Welcome ──────────────────────────────────────────────────── */}
        {step === 1 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, textAlign: 'center', paddingTop: 48, position: 'relative', overflow: 'hidden' }}>
            <Confetti n={14} />
            <div style={{ animation: 'tcFloat 3s ease-in-out infinite' }}>
              <TutoMascot size={190} color={PC.teal} />
            </div>
            <div className="tc-up">
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 32, color: PC.ink, lineHeight: 1.2, letterSpacing: '-.5px' }}>
                Welcome to Tuto! 🎉
              </div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 15, color: PC.inkSoft, marginTop: 10, lineHeight: 1.6 }}>
                Let's set things up for your child.<br />Takes about 2 minutes.
              </div>
            </div>
            <Btn onClick={next} style={{ maxWidth: 280, marginTop: 4 }}>Get Started →</Btn>
          </div>
        )}

        {/* ── STEP 2: Child Info ────────────────────────────────────────────────── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 24, color: PC.ink, lineHeight: 1.3, letterSpacing: '-.3px' }}>
              Tell me about your child! 👶
            </div>
            <Field label="Child's name">
              <input className="tc-input" value={childName} onChange={e => setChildName(e.target.value)} placeholder="e.g. Zeynep" />
            </Field>
            <Field label="Age">
              <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: `1.5px solid ${PC.line}`, borderRadius: 16, padding: '10px 18px', gap: 16 }}>
                <button className="tc-press" onClick={() => setAge(a => Math.max(1, a - 1))} style={{ width: 46, height: 46, borderRadius: 14, background: PC.tealBg, border: 'none', fontSize: 24, fontWeight: 800, color: PC.tealDeep, cursor: 'pointer', fontFamily: FONT }}>−</button>
                <div style={{ flex: 1, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 36, color: PC.ink }}>{age}</div>
                <button className="tc-press" onClick={() => setAge(a => Math.min(18, a + 1))} style={{ width: 46, height: 46, borderRadius: 14, background: PC.tealBg, border: 'none', fontSize: 24, fontWeight: 800, color: PC.tealDeep, cursor: 'pointer', fontFamily: FONT }}>+</button>
              </div>
            </Field>
            <Btn onClick={next} disabled={!childName.trim()}>Next →</Btn>
          </div>
        )}

        {/* ── STEP 3: Tasks ────────────────────────────────────────────────────── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 24, color: PC.ink, lineHeight: 1.3, letterSpacing: '-.3px' }}>What will {childName} work on? 🌟</div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 6 }}>Choose the activities that earn Gems. You can change these anytime.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {TASKS_META.map(({ key, label }) => (
                <button key={key} className="tc-press tc-tap" onClick={() => setTasks(t => ({ ...t, [key]: !t[key] }))} style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px',
                  background: tasks[key] ? PC[key + 'Bg'] : '#fff',
                  border: `1.5px solid ${tasks[key] ? PC[key] : PC.line}`,
                  borderRadius: 20, cursor: 'pointer', transition: 'all .18s', textAlign: 'left',
                }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: tasks[key] ? PC[key + 'Bg'] : PC.field, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <TaskIcon type={key} size={24} />
                  </div>
                  <span style={{ flex: 1, fontFamily: FONT, fontWeight: 800, fontSize: 15.5, color: PC.ink }}>{label}</span>
                  <div style={{
                    width: 26, height: 26, borderRadius: 8,
                    background: tasks[key] ? PC.teal : PC.line,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background .18s', flexShrink: 0,
                  }}>
                    {tasks[key] && <Icon name="check" size={14} color="#fff" sw={2.5} />}
                  </div>
                </button>
              ))}
            </div>
            <Btn onClick={next} disabled={!Object.values(tasks).some(Boolean)}>Next →</Btn>
          </div>
        )}

        {/* ── STEP 4: Rewards ──────────────────────────────────────────────────── */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 24, color: PC.ink, lineHeight: 1.3, letterSpacing: '-.3px' }}>Set up {childName}'s rewards! 🎁</div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 6 }}>Adjust the Gems needed for each reward.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rewards.map((r, i) => {
                const pct     = ((Math.min(Math.max(r.gems, 10), 1000) - 10) / 990) * 100
                const trackBg = `linear-gradient(to right, ${PC.teal} ${pct}%, ${PC.line} ${pct}%)`
                const isEditingLabel = editingLabelIdx === i

                return (
                  <Card key={i} pad={14} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 22, flexShrink: 0, width: 28, textAlign: 'center' }}>{r.emoji}</span>

                      {r.lockTitle ? (
                        <span style={{ flex: 1, fontFamily: FONT, fontSize: 14, fontWeight: 700, color: PC.ink }}>{r.label}</span>
                      ) : isEditingLabel ? (
                        <input autoFocus value={r.label} onChange={e => updateReward(i, 'label', e.target.value)}
                          onBlur={() => setEditingLabelIdx(null)} onKeyDown={e => e.key === 'Enter' && setEditingLabelIdx(null)}
                          placeholder="e.g. Lego set, new game..."
                          style={{ flex: 1, border: 'none', borderBottom: `2px solid ${PC.teal}`, outline: 'none', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: PC.ink, background: 'transparent', minWidth: 0, paddingBottom: 2 }} />
                      ) : (
                        <span onClick={() => !r.lockTitle && setEditingLabelIdx(i)}
                          style={{ flex: 1, fontFamily: FONT, fontSize: 14, fontWeight: 700, color: PC.ink, cursor: 'text', borderBottom: `2px dashed ${PC.line}`, paddingBottom: 2 }}>
                          {r.label || <span style={{ color: PC.inkFaint }}>Tap to name…</span>}
                        </span>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: PC.tealBg, borderRadius: 12, padding: '5px 10px', flexShrink: 0 }}>
                        <input type="number" value={r.gems} onChange={e => updateReward(i, 'gems', e.target.value)}
                          style={{ width: 52, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, fontSize: 14, fontWeight: 800, color: PC.tealDeep, textAlign: 'right' }} />
                        <span style={{ fontSize: 14 }}>💎</span>
                      </div>

                      <button className="tc-press tc-tap" onClick={() => setRewards(p => p.filter((_, idx) => idx !== i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}>
                        <Icon name="close" size={18} color={PC.inkFaint} />
                      </button>
                    </div>

                    <input type="range" min={10} max={1000} step={10}
                      value={Math.min(Math.max(r.gems, 10), 1000)}
                      onChange={e => updateReward(i, 'gems', e.target.value)}
                      className="tc-slider" style={{ background: trackBg }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: -4 }}>
                      <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: PC.inkFaint }}>10</span>
                      <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: PC.inkFaint }}>1000</span>
                    </div>
                    {r.hint && <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: PC.inkSoft }}>{r.hint}</div>}
                  </Card>
                )
              })}
            </div>

            <button className="tc-press tc-tap" onClick={() => setAddingReward(true)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'none', border: `2px dashed ${PC.line}`, borderRadius: 18,
              padding: '12px 16px', cursor: 'pointer', color: PC.tealDeep,
              fontFamily: FONT, fontSize: 14, fontWeight: 800,
            }}>+ Add reward</button>

            <Btn onClick={next}>Next →</Btn>
          </div>
        )}

        {/* ── STEP 5: Notifications ────────────────────────────────────────────── */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 24, color: PC.ink, lineHeight: 1.3, letterSpacing: '-.3px' }}>Stay connected 👨‍👩‍👧</div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 6 }}>Choose how you want to be notified about {childName || 'your child'}'s progress</div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              {/* Telegram */}
              <button className="tc-press tc-tap" onClick={() => setNotifChannel('telegram')} style={{
                flex: 1, padding: '20px 12px',
                background: notifChannel === 'telegram' ? '#E3F2FD' : '#fff',
                border: `2px solid ${notifChannel === 'telegram' ? '#229ED9' : PC.line}`,
                borderRadius: 20, cursor: 'pointer', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                transition: 'all .18s',
              }}>
                <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" alt="Telegram" style={{ width: 44, height: 44 }} />
                <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 800, color: PC.ink }}>Telegram</div>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: `2px solid ${notifChannel === 'telegram' ? '#229ED9' : PC.line}`,
                  background: notifChannel === 'telegram' ? '#229ED9' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all .18s',
                }}>
                  {notifChannel === 'telegram' && <Icon name="check" size={10} color="#fff" sw={3} />}
                </div>
              </button>

              {/* WhatsApp */}
              <button className="tc-press tc-tap" onClick={() => { setNotifChannel('whatsapp'); setWaVerifySent(false); setWaError('') }} style={{
                flex: 1, padding: '20px 12px',
                background: notifChannel === 'whatsapp' ? PC.greenBg : '#fff',
                border: `2px solid ${notifChannel === 'whatsapp' ? PC.green : PC.line}`,
                borderRadius: 20, cursor: 'pointer', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                transition: 'all .18s',
              }}>
                <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" style={{ width: 44, height: 44 }} />
                <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 800, color: PC.ink }}>WhatsApp</div>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: `2px solid ${notifChannel === 'whatsapp' ? PC.green : PC.line}`,
                  background: notifChannel === 'whatsapp' ? PC.green : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all .18s',
                }}>
                  {notifChannel === 'whatsapp' && <Icon name="check" size={10} color="#fff" sw={3} />}
                </div>
              </button>
            </div>

            {/* Telegram detail */}
            {notifChannel === 'telegram' && (
              <Card pad={20} className="tc-fade" style={{ border: `2px solid #229ED9` }}>
                <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: PC.ink, lineHeight: 1.6, marginBottom: 14 }}>
                  1. Open Telegram and message <span style={{ color: '#229ED9', fontWeight: 800 }}>@TutoParentBot</span><br />
                  2. Send <strong>/start</strong>, then enter your family code:
                </div>
                {familyCode ? (
                  <button className="tc-press" onClick={() => { navigator.clipboard.writeText(familyCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000) }}
                    style={{ background: '#E3F2FD', border: `1.5px solid ${codeCopied ? PC.green : '#229ED9'}`, borderRadius: 14, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', width: '100%' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 900, color: PC.ink, letterSpacing: 4 }}>{familyCode}</span>
                    <span style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 800, color: codeCopied ? PC.green : '#229ED9' }}>{codeCopied ? '✅ Copied!' : '📋 Copy'}</span>
                  </button>
                ) : (
                  <div style={{ background: '#E3F2FD', borderRadius: 14, padding: 14, textAlign: 'center', fontFamily: FONT, fontSize: 13, color: '#229ED9', fontWeight: 700 }}>Loading code…</div>
                )}
                <Btn onClick={next} style={{ marginTop: 14 }}>I've connected Telegram ✅</Btn>
              </Card>
            )}

            {/* WhatsApp detail */}
            {notifChannel === 'whatsapp' && (
              <Card pad={20} className="tc-fade" style={{ border: `2px solid ${PC.green}` }}>
                {waVerifySent ? (
                  <>
                    <div style={{ textAlign: 'center', fontSize: 36, marginBottom: 12 }}>📱</div>
                    <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: PC.green, textAlign: 'center', lineHeight: 1.7, marginBottom: 14 }}>
                      We just sent you a message on WhatsApp!<br />Check your WhatsApp and come back here.
                    </div>
                    <Btn onClick={next}>Yes, I got it! ✅</Btn>
                  </>
                ) : (
                  <>
                    <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: PC.ink, marginBottom: 10 }}>Enter your WhatsApp number:</div>
                    <input className="tc-input" type="tel" placeholder="+905XXXXXXXXX" value={waPhone}
                      onChange={e => { setWaPhone(e.target.value); setWaError('') }} style={{ marginBottom: waError ? 8 : 14 }} />
                    {waError && <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: PC.danger, marginBottom: 10 }}>{waError}</div>}
                    <Btn disabled={!waPhone.trim() || waSending} onClick={async () => {
                      if (!user) return setWaError('Not logged in.')
                      setWaSending(true); setWaError('')
                      try {
                        const res = await fetch(`${SERVER}/api/send-welcome-whatsapp`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ phoneNumber: waPhone.trim(), childName: childName || 'your child', parentId: user.id }),
                        })
                        const data = await res.json()
                        if (!res.ok) throw new Error(data.error || 'Server error')
                        setWaVerifySent(true)
                      } catch (e) {
                        setWaError(e.message)
                      } finally {
                        setWaSending(false)
                      }
                    }}>{waSending ? 'Sending…' : 'Connect WhatsApp 📲'}</Btn>
                  </>
                )}
              </Card>
            )}

            <div style={{ height: 1, background: PC.line }} />

            {/* Additional notifications */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 800, color: PC.inkFaint, letterSpacing: '.6px' }}>ADDITIONAL NOTIFICATIONS</div>

              <Card pad={14} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 22 }}>📧</span>
                <span style={{ fontFamily: FONT, flex: 1, fontSize: 14, fontWeight: 700, color: PC.ink }}>Email notifications</span>
                <Toggle on={emailNotif} onClick={() => setEmailNotif(v => !v)} />
              </Card>

              <Card pad={14} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 22 }}>🔔</span>
                <span style={{ fontFamily: FONT, flex: 1, fontSize: 14, fontWeight: 700, color: PC.ink }}>Push notifications</span>
                <Toggle on={pushNotif} onClick={() => setPushNotif(v => !v)} />
              </Card>
            </div>

            {!notifChannel && (
              <Btn variant="ghost" onClick={next}>Skip for now</Btn>
            )}
          </div>
        )}

        {/* ── STEP 6: PIN ──────────────────────────────────────────────────────── */}
        {step === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 24, color: PC.ink, letterSpacing: '-.3px' }}>
                {pinPhase === 'enter' ? 'Create a PIN for your child 🔐' : 'Confirm the PIN 🔁'}
              </div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 6 }}>
                {pinPhase === 'enter' ? 'Your child will enter this to log in.' : 'Enter the same 4 digits again.'}
              </div>
            </div>
            {pinError && (
              <div style={{ background: PC.dangerBg, color: PC.danger, borderRadius: 14, padding: '10px 20px', fontFamily: FONT, fontSize: 13, fontWeight: 700, textAlign: 'center', width: '100%' }}>
                {pinError}
              </div>
            )}
            <PinPad value={pinPhase === 'enter' ? pin : pinConfirm} onChange={handlePinInput} />
          </div>
        )}

        {/* ── STEP 7: Device Setup ─────────────────────────────────────────────── */}
        {step === 7 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 24, color: PC.ink, lineHeight: 1.3, letterSpacing: '-.3px' }}>
              How will {childName} use Tuto? 📱
            </div>

            <button className="tc-press tc-tap" onClick={() => { setDeviceMode('separate'); setStep(hasRobloxReward ? 8 : 9) }} style={{
              display: 'flex', alignItems: 'flex-start', gap: 16, padding: '20px 18px',
              background: deviceMode === 'separate' ? PC.tealBg : '#fff',
              border: `2px solid ${deviceMode === 'separate' ? PC.teal : PC.line}`,
              borderRadius: 22, cursor: 'pointer', textAlign: 'left', transition: 'all .18s',
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: deviceMode === 'separate' ? PC.teal : PC.field, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="phone" size={24} color={deviceMode === 'separate' ? '#fff' : PC.inkSoft} />
              </div>
              <div>
                <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 800, color: PC.ink, marginBottom: 4 }}>Separate device</div>
                <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: PC.inkSoft, lineHeight: 1.5 }}>I'll scan a QR code to connect {childName}'s device</div>
              </div>
            </button>

            <button className="tc-press tc-tap" onClick={() => { setDeviceMode('same'); setStep(hasRobloxReward ? 8 : 9) }} style={{
              display: 'flex', alignItems: 'flex-start', gap: 16, padding: '20px 18px',
              background: deviceMode === 'same' ? PC.tealBg : '#fff',
              border: `2px solid ${deviceMode === 'same' ? PC.teal : PC.line}`,
              borderRadius: 22, cursor: 'pointer', textAlign: 'left', transition: 'all .18s',
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: deviceMode === 'same' ? PC.teal : PC.field, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="swap" size={24} color={deviceMode === 'same' ? '#fff' : PC.inkSoft} />
              </div>
              <div>
                <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 800, color: PC.ink, marginBottom: 4 }}>Same device</div>
                <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: PC.inkSoft, lineHeight: 1.5 }}>{childName} will switch to their profile from here</div>
              </div>
            </button>
          </div>
        )}

        {/* ── STEP 8: Roblox ───────────────────────────────────────────────────── */}
        {step === 8 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ fontSize: 64, textAlign: 'center', marginTop: 8 }}>🎮</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, color: PC.ink, lineHeight: 1.3, letterSpacing: '-.3px' }}>Want me to open Roblox automatically?</div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 6, lineHeight: 1.5 }}>I'll add screen time when your child earns enough Gems.</div>
            </div>
            <Card pad={16} style={{ background: PC.tealBg, width: '100%', boxShadow: 'none' }}>
              <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 800, color: PC.tealDeep, marginBottom: 4 }}>How it works</div>
              <div style={{ fontFamily: FONT, fontSize: 13, color: PC.tealDeep, lineHeight: 1.5 }}>When your child spends Gems on "Roblox 30min", Tuto will automatically launch the app and start a countdown timer.</div>
            </Card>
            <div style={{ width: '100%' }}>
              <Btn variant="outline" disabled style={{ opacity: 0.4 }}>Yes, connect Roblox</Btn>
              <div style={{ textAlign: 'center', fontFamily: FONT, fontSize: 11, color: PC.inkFaint, fontWeight: 600, marginTop: 6 }}>Coming soon</div>
            </div>
            <Btn variant="ghost" onClick={next}>Skip for now</Btn>
          </div>
        )}

        {/* ── STEP 9: All Done ─────────────────────────────────────────────────── */}
        {step === 9 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, textAlign: 'center', position: 'relative', overflow: 'hidden', paddingTop: 48 }}>
            <Confetti n={16} />
            <div style={{ animation: 'tcFloat 3s ease-in-out infinite' }}>
              <TutoMascot size={180} color={PC.teal} />
            </div>
            <div className="tc-up">
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: PC.ink, lineHeight: 1.2, letterSpacing: '-.5px' }}>All set! 🎉</div>
              <div style={{ fontFamily: FONT, fontSize: 17, fontWeight: 700, color: PC.teal, marginTop: 10 }}>
                {childName || 'Your child'} is ready to start earning Gems!
              </div>
            </div>
            {saveError && (
              <div style={{ background: PC.dangerBg, color: PC.danger, borderRadius: 14, padding: '10px 20px', fontFamily: FONT, fontSize: 13, fontWeight: 700 }}>{saveError}</div>
            )}
            <Btn onClick={handleFinish} disabled={saving} style={{ maxWidth: 280 }}>
              {saving ? 'Saving…' : "Let's Go! 🚀"}
            </Btn>
          </div>
        )}

        {/* ── STEP 10: QR Code ─────────────────────────────────────────────────── */}
        {step === 10 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 24, color: PC.ink, lineHeight: 1.3, letterSpacing: '-.3px' }}>Connect {childName}'s device 📲</div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 6 }}>Scan this on {childName}'s device to connect it</div>
            </div>
            {familyCode ? (
              <div style={{ background: '#fff', borderRadius: 22, padding: 20, boxShadow: SHADOW }}>
                <QRCodeSVG
                  value={`https://tuto-blue.vercel.app/setup?code=${familyCode}`}
                  size={220}
                  bgColor="#FFFFFF"
                  fgColor={PC.ink}
                  level="M"
                />
              </div>
            ) : (
              <div style={{ width: 260, height: 260, background: PC.tealBg, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: PC.tealDeep }}>Loading…</div>
              </div>
            )}
            {familyCode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: PC.tealBg, borderRadius: 10, padding: '6px 14px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: PC.tealDeep, letterSpacing: 2 }}>{familyCode}</span>
                </div>
                <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12, color: PC.inkFaint }}>manual code</span>
              </div>
            )}
            <Btn onClick={() => nav('/parent/dashboard')}>Go to Dashboard →</Btn>
          </div>
        )}
      </div>

      {/* ── Add reward sheet ──────────────────────────────────────────────────── */}
      {addingReward && (
        <BottomSheet onClose={() => setAddingReward(false)}>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: PC.ink }}>Add a reward 🎁</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <input value={newReward.emoji} onChange={e => setNewReward(r => ({ ...r, emoji: e.target.value }))}
              style={{ width: 56, padding: '12px 4px', border: `1.5px solid ${PC.line}`, borderRadius: 14, fontSize: 24, textAlign: 'center', outline: 'none', background: PC.tealBg, fontFamily: FONT }} />
            <input value={newReward.label} onChange={e => setNewReward(r => ({ ...r, label: e.target.value }))} placeholder="Reward name"
              className="tc-input" style={{ flex: 1 }} />
          </div>
          <Field label="Gems required 💎">
            <input className="tc-input" type="number" placeholder="30" value={newReward.gems}
              onChange={e => setNewReward(r => ({ ...r, gems: e.target.value }))} />
          </Field>
          <Btn onClick={confirmAddReward} disabled={!newReward.label.trim()}>Add reward</Btn>
          <Btn variant="ghost" onClick={() => setAddingReward(false)}>Cancel</Btn>
        </BottomSheet>
      )}
    </div>
  )
}
