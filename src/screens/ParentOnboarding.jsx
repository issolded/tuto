import { LANGS, t as childT } from '../lib/i18n'
import { useT, useUiLang, uiLang, pt } from '../lib/parentI18n'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { hashPin } from '../lib/hash'
import { gemHint, CAP_RANGE, TASK_DEFAULTS } from '../lib/taskDefaults'
import {
  PC, FONT, SHADOW, SHADOW_SM, PCSS,
  Btn, Card, Field, Pill, BottomSheet, Icon, TaskIcon, PinPad, Confetti, TutoMascot,
} from '../lib/parentUI'

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'

// The presets carry dictionary keys, resolved once the translator exists. `kind` is what the
// auto-launch step matches on: it used to find this row by looking for "video game" inside the
// label, which is a rule that holds only while the label is English — the first translated
// preset would have skipped step 8 in silence.
const DEFAULT_REWARDS = [
  { emoji: '🎮', kind: 'game', labelKey: 'ob_rw_game', gems: 30,  lockTitle: true,  hintKey: 'ob_rw_game_h' },
  { emoji: '📺',               labelKey: 'ob_rw_tv',   gems: 60,  lockTitle: true,  hintKey: 'ob_rw_tv_h' },
  // A toy is bought once. Screen time comes round again every week — that difference is a
  // column on the reward now, and the presets are where a family first meets it.
  { emoji: '🧸',               labelKey: 'ob_rw_toy',  gems: 500, lockTitle: false, hintKey: 'ob_rw_toy_h', recurring: false },
]

// Natural phrasing for the "if {child} does X and Y" example on the rewards
// step — separate from the task label ("My Math") since a sentence needs a
// verb, not a nav-item name.
const TASK_EXAMPLE_PHRASE = {
  reading: 'ob_ex_reading', math: 'ob_ex_math', writing: 'ob_ex_writing',
  homework: 'ob_ex_homework', drawing: 'ob_ex_drawing',
}

const TASKS_META = [
  { key: 'reading' }, { key: 'math' }, { key: 'writing' }, { key: 'homework' }, { key: 'drawing' },
]

// Step 3's activity-picker tile grid — per design_handoff_onboarding_step3/.
// Separate from TASKS_META (which Step 4's earning example still uses) since
// these tiles carry extra design-only fields (desc, tint, bg) that step
// doesn't need.
// The tile NAME is the child's own tile name, read from the child dictionary at render; only
// the blurb under it belongs to the parent.
const STEP3_TASKS = [
  { key: 'reading',  desc: 'ob_t_reading',  tint: '#8f74d6', bg: '#E8E0FF' },
  { key: 'math',     desc: 'ob_t_math',     tint: '#4f97dd', bg: '#D4EDFF' },
  { key: 'writing',  desc: 'ob_t_writing',  tint: '#46ac7d', bg: '#D4F5E0' },
  { key: 'homework', desc: 'ob_t_homework', tint: '#e0952f', bg: '#FFF1CF' },
  { key: 'drawing',  desc: 'ob_t_drawing',  tint: '#c96aa8', bg: '#EFE3FF', wide: true },
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
  const s = useT()
  return (
    <div style={{ padding: '52px 24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 800, color: PC.inkFaint, letterSpacing: '.6px' }}>{s('ob_step_of', { n: step, total })}</span>
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

// Step 3's per-day dial, one per chosen activity. It lives OUTSIDE the tile's <button> — a
// button inside a button is invalid HTML, and every tap on − or + would toggle the tile off —
// so the grid cell is a wrapper and the tile and this sit inside it.
function CapStepper({ value, onChange, tint, disabled }) {
  const s = useT()
  const btn = {
    width: 26, height: 26, borderRadius: 9, border: `1.5px solid ${PC.line}`, background: '#fff',
    cursor: disabled ? 'default' : 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 15,
    color: PC.inkSoft, lineHeight: 1, padding: 0,
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
      marginTop: 8, padding: '6px 9px', background: '#fff',
      border: `1.5px solid ${PC.line}`, borderRadius: 14,
      opacity: disabled ? 0.45 : 1, transition: 'opacity .16s',
    }}>
      <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11.5, color: PC.inkSoft, minWidth: 0 }}>
        {s('ob_per_day')}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <button type="button" disabled={disabled} style={btn}
          onClick={() => onChange(Math.max(CAP_RANGE.min, value - 1))}>−</button>
        <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14.5, color: tint, minWidth: 14, textAlign: 'center' }}>
          {value}
        </span>
        <button type="button" disabled={disabled} style={btn}
          onClick={() => onChange(Math.min(CAP_RANGE.max, value + 1))}>+</button>
      </div>
    </div>
  )
}

export default function ParentOnboarding() {
  const s = useT()
  const lang = useUiLang()
  const nav = useNavigate()

  const [step,            setStep]            = useState(1)
  const [childName,       setChildName]       = useState('')
  const [age,             setAge]             = useState(7)
  // The language the CHILD is spoken to in — separate from anything the parent reads. The
  // column has existed all along and onboarding wrote 'en' into it unconditionally, so a child
  // who speaks only Turkish got an English app with English questions.
  const [childLang,       setChildLang]       = useState('en')
  const [tasks,           setTasks]           = useState({ reading: true, math: true, writing: true, homework: true, drawing: true })
  // How many of each a day earn gems. Set here rather than left to a default the parent meets
  // later by surprise — the limit applies from the child's very first day, so it is chosen on
  // the same screen as the activities. Changeable afterwards in Task settings or by asking Tuto.
  const [caps,            setCaps]            = useState(
    Object.fromEntries(Object.entries(TASK_DEFAULTS).map(([k, v]) => [k, v.daily_cap]))
  )
  // Resolved once, at mount, rather than on every render: from here on the label is a value the
  // parent can edit, and re-deriving it from the key would throw their edit away.
  const [rewards, setRewards] = useState(() =>
    DEFAULT_REWARDS.map(r => ({ ...r, label: pt(r.labelKey, uiLang()), hint: pt(r.hintKey, uiLang()) })))
  const [notifChannel,    setNotifChannel]    = useState(null)
  const [waCode,          setWaCode]          = useState(null)
  const [waLink,          setWaLink]          = useState(null)
  const [waConnected,     setWaConnected]     = useState(false)
  const [waError,         setWaError]         = useState('')
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

  const videoGameReward = rewards.find(r => r.kind === 'game')

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
      if (!res.ok) throw new Error(data.error || s('ob_server_error'))
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
              setPinError(s('db_err_pin_dupe'))
              setTimeout(() => { setPin(''); setPinConfirm(''); setPinPhase('enter'); setPinError('') }, 1500)
              return
            }
          }
          setTimeout(next, 300)
        } else {
          setPinError(s('ob_pin_mismatch'))
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
      if (!uid) throw new Error(s('ob_not_logged_in'))

      const pin_hash = await hashPin(pin)
      const { data: child, error: cErr } = await supabase
        .from('children')
        // Step 3 asks which activities earn Gems and its answers were collected into
        // `tasks` and then dropped — nothing here ever wrote task_settings, so a parent who
        // switched everything except Maths off still had a child seeing every tile. The
        // shape matches what TaskSettings writes later, so the two agree from the start.
        .insert({
          parent_id: uid.id, name: childName.trim(), age, pin_hash, language: childLang,
          task_settings: Object.fromEntries(
            Object.keys(tasks).map(k => [k, { gems: TASK_DEFAULTS[k].gems, active: !!tasks[k], daily_cap: caps[k] }])
          ),
        })
        .select()
        .single()
      if (cErr) throw cErr

      const active = rewards.filter(r => r.label.trim())
      if (active.length) {
        await supabase.from('rewards').insert(active.map(r => ({ child_id: child.id, icon: r.emoji, name: r.label.trim(), bt_cost: r.gems, recurring: r.recurring !== false })))
      }

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      // timezone matters more than it looks: quiet hours are read in it, so a parent who
      // never reaches this line gets their evening measured in UTC.
      // prefs.language as well as the timezone: a Google sign-up never passes through
      // ParentSignup, so this is the only place that path can carry the splash screen's choice
      // onto the account. Read-modify-write, because the column holds keys this screen does not
      // know about.
      const { data: prow } = await supabase.from('parents').select('prefs').eq('id', uid.id).maybeSingle()
      await supabase.from('parents').update({
        timezone,
        prefs: { ...(prow?.prefs || {}), language: uiLang() },
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
      setSaveError(err.message || s('ob_went_wrong'))
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
                {s('ob_welcome')}
              </div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 15, color: PC.inkSoft, marginTop: 10, lineHeight: 1.6 }}>
                {s('ob_welcome_b')}<br />{s('ob_welcome_c')}
              </div>
            </div>
            <Btn onClick={next} style={{ maxWidth: 280, marginTop: 4 }}>{s('ob_get_started')}</Btn>
          </div>
        )}

        {/* ── STEP 2: Child Info ────────────────────────────────────────────────── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 24, color: PC.ink, lineHeight: 1.3, letterSpacing: '-.3px' }}>
              {s('ob_about_child')}
            </div>
            <Field label={s('db_child_name')}>
              <input className="tc-input" value={childName} onChange={e => setChildName(e.target.value)} placeholder={s('ob_child_name_ph')} />
            </Field>
            <Field label={s('db_age')}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: `1.5px solid ${PC.line}`, borderRadius: 16, padding: '10px 18px', gap: 16 }}>
                <button className="tc-press" onClick={() => setAge(a => Math.max(1, a - 1))} style={{ width: 46, height: 46, borderRadius: 14, background: PC.tealBg, border: 'none', fontSize: 24, fontWeight: 800, color: PC.tealDeep, cursor: 'pointer', fontFamily: FONT }}>−</button>
                <div style={{ flex: 1, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 36, color: PC.ink }}>{age}</div>
                <button className="tc-press" onClick={() => setAge(a => Math.min(18, a + 1))} style={{ width: 46, height: 46, borderRadius: 14, background: PC.tealBg, border: 'none', fontSize: 24, fontWeight: 800, color: PC.tealDeep, cursor: 'pointer', fontFamily: FONT }}>+</button>
              </div>
            </Field>
            <Field label={s('ob_child_lang_q')}>
              <div style={{ display: 'flex', gap: 10 }}>
                {LANGS.map(l => ({ id: l.code, label: l.label, flag: l.flag })).map(o => {
                  const on = childLang === o.id
                  return (
                    <button key={o.id} className="tc-press tc-tap" onClick={() => setChildLang(o.id)} style={{
                      flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      background: on ? PC.tealBg : '#fff', border: `2px solid ${on ? PC.teal : PC.line}`,
                      borderRadius: 16, padding: '14px 10px', cursor: 'pointer',
                      fontFamily: FONT, fontWeight: 800, fontSize: 15, color: on ? PC.tealDeep : PC.inkSoft,
                      transition: 'border-color .16s, background .16s',
                    }}>
                      <span style={{ fontSize: 20 }}>{o.flag}</span>{o.label}
                    </button>
                  )
                })}
              </div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkSoft, marginTop: 8, lineHeight: 1.45 }}>
                {s('ob_child_lang_b', { name: childName.trim() || s('ts_your_child') })}
              </div>
            </Field>
            <Btn onClick={next} disabled={!childName.trim()}>{s('ob_next')}</Btn>
          </div>
        )}

        {/* ── STEP 3: Tasks ────────────────────────────────────────────────────── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 25, color: PC.ink, lineHeight: 1.25, letterSpacing: '-.4px' }}>{s('ob_where_grow', { name: childName })}</div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13.5, color: PC.inkSoft, marginTop: 7, lineHeight: 1.5 }}>{s('ob_where_grow_b')}</div>
            </div>

            {/* minmax(0, 1fr) rather than 1fr: a grid track's implicit min-width is auto, so it
                refuses to shrink below its content — and the gem badge below sets nowrap, which
                makes its min-content the whole string. "Up to 30 gems (up to 3/day)" on both
                cards pushed the two columns past the viewport and the whole step scrolled
                sideways. minmax(0, …) lets the tracks shrink; the badge wraps instead. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 13, marginTop: 22 }}>
              {STEP3_TASKS.map(t => {
                const on = !!tasks[t.key]
                return (
                  <div key={t.key} style={{ gridColumn: t.wide ? '1 / -1' : 'auto', minWidth: 0 }}>
                  <button className="tc-press tc-tap" onClick={() => setTasks(prev => ({ ...prev, [t.key]: !prev[t.key] }))} style={{
                    width: '100%',
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
                    <div style={{ fontFamily: FONT, fontSize: 17, fontWeight: 800, color: PC.ink }}>{childT(`task_${t.key}`, lang)}</div>
                    <div style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: PC.inkSoft, lineHeight: 1.4, marginTop: -2 }}>{s(t.desc)}</div>
                    <span style={{
                      alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: t.bg, color: t.tint, borderRadius: 11, padding: '4px 10px',
                      fontFamily: FONT, fontSize: 12, fontWeight: 800, lineHeight: 1.35, maxWidth: '100%',
                    }}>💎 {gemHint(t.key, s)}</span>
                  </button>
                  <CapStepper
                    value={caps[t.key]}
                    onChange={v => setCaps(prev => ({ ...prev, [t.key]: v }))}
                    tint={t.tint}
                    disabled={!on}
                  />
                  </div>
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
                  <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: PC.ink }}>{s('ob_tree')}</div>
                  <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkSoft, marginTop: 3, lineHeight: 1.45 }}>
                    {s('ob_tree_b')}
                  </div>
                  <span style={{ display: 'inline-block', marginTop: 6, fontFamily: FONT, fontSize: 11, fontWeight: 800, color: '#3a9d72', background: '#E6F5EC', borderRadius: 8, padding: '2px 8px' }}>{s('ob_always_on')}</span>
                </div>
              </div>
            </div>

            <Btn onClick={next} disabled={!Object.values(tasks).some(Boolean)} style={{ marginTop: 26 }}>{s('ob_next')}</Btn>
          </div>
        )}

        {/* ── STEP 4: Rewards ──────────────────────────────────────────────────── */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 24, color: PC.ink, lineHeight: 1.3, letterSpacing: '-.3px' }}>{s('ob_rewards', { name: childName })}</div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 6 }}>{s('ob_rewards_b')}</div>
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
                      <span>{s('ob_earn_q', { name: childName })}</span>
                      <span style={{ transform: showEarnExample ? 'rotate(90deg)' : 'none', transition: 'transform .18s', display: 'flex' }}>
                        <Icon name="chevron" size={14} color={PC.tealDeep} />
                      </span>
                    </button>
                    {showEarnExample && (
                      <div style={{
                        fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkSoft, lineHeight: 1.5,
                        marginTop: 8, background: PC.tealBg, borderRadius: 14, padding: '10px 12px',
                      }}>
                        {s('ob_earn_ex', {
                          name: childName,
                          a: s(TASK_EXAMPLE_PHRASE[enabled[0].key]),
                          b: s(TASK_EXAMPLE_PHRASE[enabled[1].key]),
                          upto: variable ? s('ob_upto') : '',
                          total,
                        })}
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
                          placeholder={s('ob_name_ph')}
                          style={{ flex: 1, border: 'none', borderBottom: `2px solid ${PC.teal}`, outline: 'none', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: PC.ink, background: 'transparent', minWidth: 0, paddingBottom: 2 }} />
                      ) : (
                        <span onClick={() => !r.lockTitle && setEditingLabelIdx(i)}
                          style={{ flex: 1, fontFamily: FONT, fontSize: 14, fontWeight: 700, color: PC.ink, cursor: 'text', borderBottom: `2px dashed ${PC.line}`, paddingBottom: 2 }}>
                          {r.label || <span style={{ color: PC.inkFaint }}>{s('ob_tap_to_name')}</span>}
                        </span>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: PC.tealBg, borderRadius: 12, padding: '5px 10px', flexShrink: 0 }}>
                        {/* Width follows the digits. It was fixed at 52px, which fits four —
                            a 10000-gem reward lost its last zero. The slack matters: `ch` is
                            the width of a zero and the other digits run slightly wider, so the
                            bare count clips by a pixel. */}
                        <input type="number" value={r.gems} onChange={e => updateReward(i, 'gems', e.target.value)}
                          className="tc-numplain"
                          style={{ width: `calc(${Math.max(4, String(r.gems ?? '').length)}ch + 8px)`, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, fontSize: 14, fontWeight: 800, color: PC.tealDeep, textAlign: 'right' }} />
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
            }}>{s('ob_add_reward')}</button>

            <Btn onClick={next}>{s('ob_next')}</Btn>
          </div>
        )}

        {/* ── STEP 5: Notifications ────────────────────────────────────────────── */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 24, color: PC.ink, lineHeight: 1.3, letterSpacing: '-.3px' }}>{s('ob_chat')}</div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 6, lineHeight: 1.5 }}>{s('ob_chat_b', { name: childName || s('ts_your_child') })}</div>
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
                  1. {s('ob_tg_1')} <span style={{ color: '#229ED9', fontWeight: 800 }}>@TutoParentBot</span><br />
                  2. {s('ob_tg_2')} <strong>/start</strong>{s('ob_tg_3')}
                </div>
                {familyCode ? (
                  <button className="tc-press" onClick={() => { navigator.clipboard.writeText(familyCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000) }}
                    style={{ background: '#E3F2FD', border: `1.5px solid ${codeCopied ? PC.green : '#229ED9'}`, borderRadius: 14, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', width: '100%' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 900, color: PC.ink, letterSpacing: 4 }}>{familyCode}</span>
                    <span style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 800, color: codeCopied ? PC.green : '#229ED9' }}>{codeCopied ? s('db_copied') : s('db_copy')}</span>
                  </button>
                ) : (
                  <div style={{ background: '#E3F2FD', borderRadius: 14, padding: 14, textAlign: 'center', fontFamily: FONT, fontSize: 13, color: '#229ED9', fontWeight: 700 }}>{s('ob_loading_code')}</div>
                )}
                <Btn onClick={next} style={{ marginTop: 14 }}>{s('ob_tg_done')}</Btn>
              </Card>
            )}

            {/* WhatsApp detail */}
            {notifChannel === 'whatsapp' && (
              <Card pad={20} className="tc-fade" style={{ border: `2px solid ${PC.green}` }}>
                {waConnected ? (
                  <>
                    <div style={{ textAlign: 'center', fontSize: 36, marginBottom: 12 }}>🎉</div>
                    <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: PC.green, textAlign: 'center', lineHeight: 1.7, marginBottom: 14 }}>
                      {s('ob_wa_connected')}
                    </div>
                    <Btn onClick={next}>{s('ob_continue')}</Btn>
                  </>
                ) : waLink ? (
                  <>
                    <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: PC.ink, lineHeight: 1.6, marginBottom: 14 }}>
                      {s('db_wa_steps')}
                    </div>
                    <a href={waLink} target="_blank" rel="noreferrer" className="tc-press"
                      style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '14px 16px', background: PC.green, borderRadius: 14, fontFamily: FONT, fontSize: 14, fontWeight: 800, color: '#fff' }}>
                      {s('db_wa_open')}
                    </a>
                    <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: PC.inkFaint, textAlign: 'center', marginTop: 12 }}>
                      {s('db_wa_waiting')}
                    </div>
                  </>
                ) : (
                  <div style={{ fontFamily: FONT, fontSize: 13, color: PC.inkFaint, textAlign: 'center' }}>{waError || s('loading')}</div>
                )}
              </Card>
            )}

            <div style={{ height: 1, background: PC.line }} />

            {/* There were two toggles here, for email and push. Both were written to `parents`
                and read by nothing — there is no email or push channel, only the one chosen
                above. Asking a parent to decide something that cannot happen is worse than not
                asking. How much Tuto writes is a real choice, but not one anybody can make
                before they have heard from it once. */}
            <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: PC.inkSoft, lineHeight: 1.6, textAlign: 'center' }}>
              {s('ob_settings_later')}
            </div>

            {!notifChannel && (
              <Btn variant="ghost" onClick={next}>{s('ob_skip')}</Btn>
            )}
          </div>
        )}

        {/* ── STEP 6: PIN ──────────────────────────────────────────────────────── */}
        {step === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 24, color: PC.ink, letterSpacing: '-.3px' }}>
                {pinPhase === 'enter' ? s('ob_pin_create') : s('ob_pin_confirm')}
              </div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 6 }}>
                {pinPhase === 'enter' ? s('ob_pin_create_b') : s('ob_pin_confirm_b')}
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
              {s('ob_device_q', { name: childName })}
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
                <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 800, color: PC.ink, marginBottom: 4 }}>{s('ob_dev_separate')}</div>
                <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: PC.inkSoft, lineHeight: 1.5 }}>{s('ob_dev_separate_b', { name: childName })}</div>
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
                <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 800, color: PC.ink, marginBottom: 4 }}>{s('ob_dev_same')}</div>
                <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: PC.inkSoft, lineHeight: 1.5 }}>{s('ob_dev_same_b', { name: childName })}</div>
              </div>
            </button>
          </div>
        )}

        {/* ── STEP 8: Game auto-launch ─────────────────────────────────────────── */}
        {step === 8 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ fontSize: 64, textAlign: 'center', marginTop: 8 }}>🎮</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, color: PC.ink, lineHeight: 1.3, letterSpacing: '-.3px' }}>{s('ob_game_q')}</div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 6, lineHeight: 1.5 }}>{s('ob_game_b')}</div>
            </div>
            <Card pad={16} style={{ background: PC.tealBg, width: '100%', boxShadow: 'none' }}>
              <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 800, color: PC.tealDeep, marginBottom: 4 }}>{s('ob_how_works')}</div>
              <div style={{ fontFamily: FONT, fontSize: 13, color: PC.tealDeep, lineHeight: 1.5 }}>{s('ob_how_works_b', { reward: videoGameReward?.label ?? s('ob_rw_game') })}</div>
            </Card>
            <div style={{ width: '100%' }}>
              <Btn variant="outline" disabled style={{ opacity: 0.4 }}>{s('ob_yes_connect')}</Btn>
              <div style={{ textAlign: 'center', fontFamily: FONT, fontSize: 11, color: PC.inkFaint, fontWeight: 600, marginTop: 6 }}>{s('ob_coming_soon')}</div>
            </div>
            <Btn variant="ghost" onClick={next}>{s('ob_skip')}</Btn>
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
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: PC.ink, lineHeight: 1.2, letterSpacing: '-.5px' }}>{s('ob_all_set')}</div>
              <div style={{ fontFamily: FONT, fontSize: 17, fontWeight: 700, color: PC.teal, marginTop: 10 }}>
                {s('ob_ready', { name: childName || s('ob_your_child') })}
              </div>
            </div>
            {saveError && (
              <div style={{ background: PC.dangerBg, color: PC.danger, borderRadius: 14, padding: '10px 20px', fontFamily: FONT, fontSize: 13, fontWeight: 700 }}>{saveError}</div>
            )}
            <Btn onClick={handleFinish} disabled={saving} style={{ maxWidth: 280 }}>
              {saving ? s('saving') : s('ob_lets_go')}
            </Btn>
          </div>
        )}

        {/* ── STEP 10: QR Code ─────────────────────────────────────────────────── */}
        {step === 10 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 24, color: PC.ink, lineHeight: 1.3, letterSpacing: '-.3px' }}>{s('ob_connect_dev', { name: childName })}</div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 6 }}>{s('ob_connect_dev_b', { name: childName })}</div>
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
                <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: PC.tealDeep }}>{s('loading')}</div>
              </div>
            )}
            {familyCode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: PC.tealBg, borderRadius: 10, padding: '6px 14px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: PC.tealDeep, letterSpacing: 2 }}>{familyCode}</span>
                </div>
                <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12, color: PC.inkFaint }}>{s('db_manual_code')}</span>
              </div>
            )}
            <Btn onClick={() => nav('/parent/dashboard')}>{s('ob_go_dashboard')}</Btn>
          </div>
        )}
      </div>

      {/* ── Add reward sheet ──────────────────────────────────────────────────── */}
      {addingReward && (
        <BottomSheet onClose={() => setAddingReward(false)}>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: PC.ink }}>{s('ob_add_reward_t')}</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <input value={newReward.emoji} onChange={e => setNewReward(r => ({ ...r, emoji: e.target.value }))}
              style={{ width: 56, padding: '12px 4px', border: `1.5px solid ${PC.line}`, borderRadius: 14, fontSize: 24, textAlign: 'center', outline: 'none', background: PC.tealBg, fontFamily: FONT }} />
            <input value={newReward.label} onChange={e => setNewReward(r => ({ ...r, label: e.target.value }))} placeholder={s('ob_reward_name')}
              className="tc-input" style={{ flex: 1 }} />
          </div>
          <Field label={s('ob_gems_required')}>
            <input className="tc-input" type="number" placeholder="30" value={newReward.gems}
              onChange={e => setNewReward(r => ({ ...r, gems: e.target.value }))} />
          </Field>
          <Btn onClick={confirmAddReward} disabled={!newReward.label.trim()}>{s('ob_add')}</Btn>
          <Btn variant="ghost" onClick={() => setAddingReward(false)}>{s('cancel')}</Btn>
        </BottomSheet>
      )}
    </div>
  )
}
