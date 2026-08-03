import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { hashPin } from '../lib/hash'
import { gemHint, TASK_DEFAULTS } from '../lib/taskDefaults'
import {
  PC, FONT, SHADOW, SHADOW_SM, PCSS,
  Btn, Card, Field, Toggle, Pill, BottomSheet, Icon, TaskIcon, PinPad, Confetti, TutoMascot,
} from '../lib/parentUI'

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'

const DEFAULT_REWARDS = [
  { emoji: '🎮', label: 'Video Game 30min', gems: 30,  lockTitle: true,  hint: '💡 30 mins of playtime' },
  { emoji: '📺', label: 'TV 1 hour',        gems: 60,  lockTitle: true,  hint: '💡 1 hour of screen time' },
  { emoji: '🧸', label: 'New toy',          gems: 500, lockTitle: false, hint: '💡 Something special to save up for!' },
]

// Natural phrasing for the "if {child} does X and Y" example on the rewards
// step — separate from the task label ("My Math") since a sentence needs a
// verb, not a nav-item name.
const TASK_EXAMPLE_PHRASE = {
  reading:  'reads a few pages of a book',
  math:     'does 1 math practice',
  writing:  'writes a story',
  homework: 'finishes homework',
  drawing:  'draws a picture',
}

const TASKS_META = [
  { key: 'reading',  label: 'My Books' },
  { key: 'math',     label: 'My Math' },
  { key: 'writing',  label: 'My Stories' },
  { key: 'homework', label: 'My Homework' },
  { key: 'drawing',  label: 'My Drawings' },
]

// Step 3's activity-picker tile grid — per design_handoff_onboarding_step3/.
// Separate from TASKS_META (which Step 4's earning example still uses) since
// these tiles carry extra design-only fields (desc, tint, bg) that step
// doesn't need.
const STEP3_TASKS = [
  { key: 'reading',  name: 'My Books',    desc: 'Builds a daily reading habit.',     tint: '#8f74d6', bg: '#E8E0FF' },
  { key: 'math',     name: 'My Math',     desc: 'Keeps number skills sharp.',        tint: '#4f97dd', bg: '#D4EDFF' },
  { key: 'writing',  name: 'My Stories',  desc: 'Grows writing & imagination.',      tint: '#46ac7d', bg: '#D4F5E0' },
  { key: 'homework', name: 'My Homework', desc: 'Makes homework a routine.',         tint: '#e0952f', bg: '#FFF1CF' },
  { key: 'drawing',  name: 'My Drawings', desc: 'Encourages creativity every day.',  tint: '#c96aa8', bg: '#EFE3FF', wide: true },
]

// Chunky filled icons matching ChildHome.jsx's TaskIcon (reading/math/writing
// are pixel-identical to that component), parameterized by tint color instead
// of ChildHome's fixed accents — Step 3 needs each tile's own tint.
function Step3Icon({ type, c }) {
  if (type === 'reading') return (
    <svg width="52" height="52" viewBox="0 0 64 64" fill="none"><path d="M32 16 C26 12 18 12 12 15 L12 48 C18 45 26 45 32 49 C38 45 46 45 52 48 L52 15 C46 12 38 12 32 16 Z" fill="#fff" stroke="#20201e" strokeWidth="4" strokeLinejoin="round"/><path d="M32 16 L32 49" stroke="#20201e" strokeWidth="4" strokeLinecap="round"/><path d="M18 24 H27 M18 31 H27 M37 24 H46 M37 31 H46" stroke={c} strokeWidth="3.4" strokeLinecap="round"/></svg>
  )
  if (type === 'math') return (
    <svg width="50" height="50" viewBox="0 0 64 64" fill="none"><rect x="12" y="12" width="40" height="40" rx="11" fill="#fff" stroke="#20201e" strokeWidth="4"/><path d="M22 24 H30 M26 20 V28" stroke={c} strokeWidth="3.6" strokeLinecap="round"/><path d="M35 24 H43" stroke={c} strokeWidth="3.6" strokeLinecap="round"/><circle cx="25" cy="40" r="2.4" fill={c}/><circle cx="31" cy="40" r="2.4" fill={c}/><path d="M36 37 L43 44 M43 37 L36 44" stroke={c} strokeWidth="3.4" strokeLinecap="round"/></svg>
  )
  if (type === 'writing') return (
    <svg width="48" height="48" viewBox="0 0 64 64" fill="none"><path d="M40 12 L52 24 L28 48 L16 48 L16 36 Z" fill="#fff" stroke="#20201e" strokeWidth="4" strokeLinejoin="round"/><path d="M36 16 L48 28" stroke="#20201e" strokeWidth="4" strokeLinecap="round"/><path d="M16 48 L24 40" stroke="#20201e" strokeWidth="4" strokeLinecap="round"/><path d="M30 30 L40 40" stroke={c} strokeWidth="3.4" strokeLinecap="round"/></svg>
  )
  if (type === 'homework') return (
    <svg width="50" height="50" viewBox="0 0 64 64" fill="none"><rect x="14" y="8" width="30" height="40" rx="5" fill="#fff" stroke="#20201e" strokeWidth="4"/><path d="M21 20h16M21 28h16M21 36h10" stroke={c} strokeWidth="3.4" strokeLinecap="round"/><rect x="34" y="34" width="22" height="17" rx="4" fill={c} stroke="#20201e" strokeWidth="4"/><circle cx="45" cy="43" r="4.5" fill="#fff" stroke="#20201e" strokeWidth="3"/><path d="M40 34l1.6-3h6.8L50 34" stroke="#20201e" strokeWidth="3.4" strokeLinejoin="round"/></svg>
  )
  // drawing
  return (
    <svg width="48" height="48" viewBox="0 0 64 64" fill="none"><path d="M40 12 L52 24 L28 48 L16 48 L16 36 Z" fill="#fff" stroke="#20201e" strokeWidth="4" strokeLinejoin="round"/><path d="M36 16 L48 28" stroke="#20201e" strokeWidth="4" strokeLinecap="round"/><circle cx="21" cy="43" r="3" fill={c}/><circle cx="30" cy="40" r="3" fill={c}/><circle cx="26" cy="47" r="3" fill={c}/></svg>
  )
}

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
  const [tasks,           setTasks]           = useState({ reading: true, math: true, writing: true, homework: true, drawing: true })
  const [rewards,         setRewards]         = useState(DEFAULT_REWARDS.map(r => ({ ...r })))
  const [notifChannel,    setNotifChannel]    = useState(null)
  const [waCode,          setWaCode]          = useState(null)
  const [waLink,          setWaLink]          = useState(null)
  const [waConnected,     setWaConnected]     = useState(false)
  const [waError,         setWaError]         = useState('')
  const [emailNotif,      setEmailNotif]      = useState(true)
  const [pushNotif,       setPushNotif]       = useState(true)
  const [codeCopied,      setCodeCopied]      = useState(false)
  const [pin,             setPin]             = useState('')
  const [pinConfirm,      setPinConfirm]      = useState('')
  const [pinPhase,        setPinPhase]        = useState('enter')
  const [pinError,        setPinError]        = useState('')
  const [deviceMode,      setDeviceMode]      = useState(null)
  const [familyCode,      setFamilyCode]      = useState(null)
  const [addingReward,    setAddingReward]    = useState(false)
  const [showEarnExample, setShowEarnExample] = useState(false)
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

  const videoGameReward = rewards.find(r => r.label.toLowerCase().includes('video game'))

  const startWaConnect = async () => {
    if (!user || waLink) return // already have a code for this session
    setWaError('')
    try {
      const res = await fetch(`${SERVER}/api/whatsapp/connect-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: user.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Server error')
      setWaCode(data.code)
      setWaLink(data.waLink)
    } catch (e) {
      setWaError(e.message)
    }
  }

  // Poll for the webhook having matched the code — the only real signal
  // that the parent actually sent the WhatsApp message.
  useEffect(() => {
    if (notifChannel !== 'whatsapp' || !waCode || !user || waConnected) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${SERVER}/api/whatsapp/connect-status?parentId=${user.id}&code=${waCode}`)
        const data = await res.json()
        if (data.connected) setWaConnected(true)
      } catch { /* keep polling */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [notifChannel, waCode, user, waConnected])

  const next = () => setStep(s => s + 1)
  const back = () => {
    if (step === 6 || step === 7) {
      setPinPhase('enter'); setPin(''); setPinConfirm(''); setPinError('')
    }
    if (step === 9 && !videoGameReward) { setStep(7); return }
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
        // Step 3 asks which activities earn Gems and its answers were collected into
        // `tasks` and then dropped — nothing here ever wrote task_settings, so a parent who
        // switched everything except Maths off still had a child seeing every tile. The
        // shape matches what TaskSettings writes later, so the two agree from the start.
        .insert({
          parent_id: uid.id, name: childName.trim(), age, pin_hash, language: 'en',
          task_settings: Object.fromEntries(
            Object.keys(tasks).map(k => [k, { gems: TASK_DEFAULTS[k].gems, active: !!tasks[k] }])
          ),
        })
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
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 25, color: PC.ink, lineHeight: 1.25, letterSpacing: '-.4px' }}>Where will {childName} grow? 🌱</div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13.5, color: PC.inkSoft, marginTop: 7, lineHeight: 1.5 }}>Choose the activities that earn Gems. You can change these anytime.</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, marginTop: 22 }}>
              {STEP3_TASKS.map(t => {
                const on = !!tasks[t.key]
                return (
                  <button key={t.key} className="tc-press tc-tap" onClick={() => setTasks(s => ({ ...s, [t.key]: !s[t.key] }))} style={{
                    gridColumn: t.wide ? '1 / -1' : 'auto',
                    position: 'relative', background: '#fff',
                    border: `2px solid ${on ? t.tint : PC.line}`,
                    borderRadius: 22, padding: '14px 14px 15px', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', flexDirection: 'column', gap: 9, transition: 'border-color .18s ease',
                    boxShadow: '0 6px 16px -10px rgba(40,55,75,.14)',
                  }}>
                    <div style={{
                      position: 'relative', height: 78, borderRadius: 16, background: t.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      filter: on ? 'none' : 'saturate(.55)', opacity: on ? 1 : 0.72, transition: 'all .16s',
                    }}>
                      <span style={{
                        position: 'absolute', top: 9, right: 9, width: 24, height: 24, borderRadius: 8,
                        background: on ? PC.teal : '#fff', border: on ? 'none' : `2px solid ${PC.line}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 6px -2px rgba(40,55,75,.2)', transition: 'all .16s',
                      }}>
                        {on && <Icon name="check" size={13} color="#fff" sw={3} />}
                      </span>
                      <Step3Icon type={t.key} c={t.tint} />
                    </div>
                    <div style={{ fontFamily: FONT, fontSize: 17, fontWeight: 800, color: PC.ink }}>{t.name}</div>
                    <div style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: PC.inkSoft, lineHeight: 1.4, marginTop: -2 }}>{t.desc}</div>
                    <span style={{
                      alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: t.bg, color: t.tint, borderRadius: 11, padding: '4px 10px',
                      fontFamily: FONT, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
                    }}>💎 {gemHint(t.key)}</span>
                  </button>
                )
              })}

              {/* My Tree isn't a gem-earning task — always on, no per-child
                  toggle exists for it — so it's shown as info, not a checkbox. */}
              <div style={{
                gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 15,
                background: '#fff', border: `1.5px dashed ${PC.line}`, borderRadius: 22, padding: '16px 18px',
              }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: '#E6F5EC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="34" height="34" viewBox="0 0 64 64" fill="none">
                    <rect x="29" y="42" width="6" height="14" rx="2" fill="#A9744F" stroke="#20201e" strokeWidth="3"/>
                    <path d="M16 36 C12 26 20 18 32 20 C44 18 52 26 48 36 C52 42 46 48 38 46 C34 50 30 50 26 46 C18 48 12 42 16 36 Z" fill="#fff" stroke="#20201e" strokeWidth="4" strokeLinejoin="round"/>
                    <circle cx="25" cy="30" r="3.2" fill="#4fb283"/>
                    <circle cx="34" cy="26" r="3.2" fill="#4fb283"/>
                    <circle cx="40" cy="34" r="3.2" fill="#4fb283"/>
                    <circle cx="29" cy="38" r="3.2" fill="#4fb283"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: PC.ink }}>My Tree 🌳</div>
                  <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkSoft, marginTop: 3, lineHeight: 1.45 }}>
                    Every kind thing they do grows a leaf — no gems, so kindness stays its own reward.
                  </div>
                  <span style={{ display: 'inline-block', marginTop: 6, fontFamily: FONT, fontSize: 11, fontWeight: 800, color: '#3a9d72', background: '#E6F5EC', borderRadius: 8, padding: '2px 8px' }}>Always on</span>
                </div>
              </div>
            </div>

            <Btn onClick={next} disabled={!Object.values(tasks).some(Boolean)} style={{ marginTop: 26 }}>Next →</Btn>
          </div>
        )}

        {/* ── STEP 4: Rewards ──────────────────────────────────────────────────── */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 24, color: PC.ink, lineHeight: 1.3, letterSpacing: '-.3px' }}>Set up {childName}'s rewards! 🎁</div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 6 }}>Adjust the Gems needed for each reward.</div>
              {(() => {
                const enabled = TASKS_META.filter(t => tasks[t.key]).slice(0, 2)
                if (enabled.length < 2) return null
                const total = enabled.reduce((sum, t) => sum + TASK_DEFAULTS[t.key].gems, 0)
                const variable = enabled.some(t => TASK_DEFAULTS[t.key].variable)
                return (
                  <div style={{ marginTop: 10 }}>
                    <button className="tc-press tc-tap" onClick={() => setShowEarnExample(v => !v)} style={{
                      display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
                      padding: 0, cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 13, color: PC.tealDeep,
                    }}>
                      <span>❓ How much can {childName} earn per day?</span>
                      <span style={{ transform: showEarnExample ? 'rotate(90deg)' : 'none', transition: 'transform .18s', display: 'flex' }}>
                        <Icon name="chevron" size={14} color={PC.tealDeep} />
                      </span>
                    </button>
                    {showEarnExample && (
                      <div style={{
                        fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkSoft, lineHeight: 1.5,
                        marginTop: 8, background: PC.tealBg, borderRadius: 14, padding: '10px 12px',
                      }}>
                        If {childName} {TASK_EXAMPLE_PHRASE[enabled[0].key]} and {TASK_EXAMPLE_PHRASE[enabled[1].key]} in a day,
                        that's {variable ? 'up to ' : ''}{total} gems — use that to gauge what each reward should cost.
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rewards.map((r, i) => {
                // 5000 covers a normal drag range, but a parent can always type
                // a bigger number directly into the gem box (updateReward has no
                // ceiling) — when they do, the slider's own max/label stretch to
                // match instead of silently capping at a stale 5000.
                const sliderMax = Math.max(5000, r.gems)
                const pct     = ((Math.min(Math.max(r.gems, 10), sliderMax) - 10) / (sliderMax - 10)) * 100
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

                    <input type="range" min={10} max={sliderMax} step={10}
                      value={Math.min(Math.max(r.gems, 10), sliderMax)}
                      onChange={e => updateReward(i, 'gems', e.target.value)}
                      className="tc-slider" style={{ background: trackBg }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: -4 }}>
                      <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: PC.inkFaint }}>10</span>
                      <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: PC.inkFaint }}>{sliderMax}</span>
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
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 24, color: PC.ink, lineHeight: 1.3, letterSpacing: '-.3px' }}>Chat with Tuto, anytime 💬</div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 6, lineHeight: 1.5 }}>No need to dig through an app — just message Tuto like you would a friend who knows {childName || 'your child'}, day or night.</div>
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
              <button className="tc-press tc-tap" onClick={() => { setNotifChannel('whatsapp'); startWaConnect() }} style={{
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
                {waConnected ? (
                  <>
                    <div style={{ textAlign: 'center', fontSize: 36, marginBottom: 12 }}>🎉</div>
                    <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: PC.green, textAlign: 'center', lineHeight: 1.7, marginBottom: 14 }}>
                      Connected! You'll get updates here from now on.
                    </div>
                    <Btn onClick={next}>Continue →</Btn>
                  </>
                ) : waLink ? (
                  <>
                    <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: PC.ink, lineHeight: 1.6, marginBottom: 14 }}>
                      Tap below to open WhatsApp with a pre-filled message, then hit send.
                    </div>
                    <a href={waLink} target="_blank" rel="noreferrer" className="tc-press"
                      style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '14px 16px', background: PC.green, borderRadius: 14, fontFamily: FONT, fontSize: 14, fontWeight: 800, color: '#fff' }}>
                      Open WhatsApp 📲
                    </a>
                    <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: PC.inkFaint, textAlign: 'center', marginTop: 12 }}>
                      Waiting for your message…
                    </div>
                  </>
                ) : (
                  <div style={{ fontFamily: FONT, fontSize: 13, color: PC.inkFaint, textAlign: 'center' }}>{waError || 'Loading…'}</div>
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

            <button className="tc-press tc-tap" onClick={() => { setDeviceMode('separate'); setStep(videoGameReward ? 8 : 9) }} style={{
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

            <button className="tc-press tc-tap" onClick={() => { setDeviceMode('same'); setStep(videoGameReward ? 8 : 9) }} style={{
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

        {/* ── STEP 8: Game auto-launch ─────────────────────────────────────────── */}
        {step === 8 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ fontSize: 64, textAlign: 'center', marginTop: 8 }}>🎮</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, color: PC.ink, lineHeight: 1.3, letterSpacing: '-.3px' }}>Want me to open the game automatically?</div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 6, lineHeight: 1.5 }}>I'll add screen time when your child earns enough Gems.</div>
            </div>
            <Card pad={16} style={{ background: PC.tealBg, width: '100%', boxShadow: 'none' }}>
              <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 800, color: PC.tealDeep, marginBottom: 4 }}>How it works</div>
              <div style={{ fontFamily: FONT, fontSize: 13, color: PC.tealDeep, lineHeight: 1.5 }}>When your child spends Gems on "{videoGameReward?.label ?? 'Video Game'}", Tuto will automatically launch the game and start a countdown timer.</div>
            </Card>
            <div style={{ width: '100%' }}>
              <Btn variant="outline" disabled style={{ opacity: 0.4 }}>Yes, connect</Btn>
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
