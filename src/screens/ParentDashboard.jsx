import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase, getTodaySummary } from '../lib/supabase'
import { hashPin } from '../lib/hash'
import { LangPicker, BirthDateField } from '../lib/parentUI'
import { ageFromBirthDate } from '../lib/age'
import { useT, adoptAccountLang } from '../lib/parentI18n'
import { usePhotoCrop } from '../components/usePhotoCrop'
import { downscale } from '../lib/image'
import {
  PC, FONT, SHADOW, SHADOW_SM, PCSS,
  TopBar, Btn, Card, Field, Toggle, Pill, Avatar, BottomSheet, Icon,
} from '../lib/parentUI'

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'

let _childrenCache = null

// ── Add child bottom sheet ────────────────────────────────────────────────────
function AddChildSheet({ parentId, siblings = [], onClose, onSaved }) {
  const s = useT()
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [avatar, setAvatar] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const fileRef = useRef(null)

  // Square, because that is the only shape an avatar is ever shown in (parentUI's Avatar is a
  // square box with object-fit: cover). Without this the frame was chosen by the CSS, which
  // centre-crops whatever it is handed — a child whose face is not in the middle of the photo
  // lost it, and nobody was ever asked.
  const { offerPhoto, cropNode } = usePhotoCrop({
    translate: s,
    inputRef: fileRef,
    accent: PC.teal,
    ratio: 1,
    onReady: blob => {
      setAvatar(blob)
      const reader = new FileReader()
      reader.onload = ev => setAvatarPreview(ev.target.result)
      reader.readAsDataURL(blob)
    },
  })

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) offerPhoto(file)
    e.target.value = ''
  }

  const save = async () => {
    if (!name.trim()) return setError(s('db_err_name'))
    const age = ageFromBirthDate(birthDate)
    if (age == null) return setError(s('db_err_birth'))
    if (!/^\d{4}$/.test(pin)) return setError(s('db_err_pin'))
    setLoading(true); setError('')

    let avatar_url = null
    if (avatar instanceof Blob) {
      try {
        // Shrunk on the way out. This path was sending the camera's full capture — several MB,
        // for a picture that is never drawn larger than 52px — while every other photo in the
        // app already went through downscale(). The extension now comes from the blob's type:
        // a cropped photo has no filename to read one off.
        const shrunk = await downscale(avatar, 512).catch(() => avatar)
        const ext = (shrunk.type || 'image/jpeg').split('/')[1] || 'jpg'
        const path = `avatars/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage.from('submissions').upload(path, shrunk, { upsert: true })
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('submissions').getPublicUrl(path)
          avatar_url = urlData.publicUrl
        }
      } catch (_) {}
    } else if (avatar === 'girl') {
      avatar_url = '👧'
    } else if (avatar === 'boy') {
      avatar_url = '👦'
    }

    const pin_hash = await hashPin(pin)
    if (siblings.some(c => c.pin_hash === pin_hash)) {
      setError(s('db_err_pin_dupe'))
      setLoading(false)
      return
    }
    const { data, error: dbError } = await supabase
      .from('children')
      .insert({ parent_id: parentId, name: name.trim(), birth_date: birthDate, age, pin_hash, ...(avatar_url && { avatar_url }) })
      .select()
      .single()
    if (dbError) { setError(dbError.message); setLoading(false); return }
    onSaved(data)
  }

  const avatarBtnStyle = (active) => ({
    width: 68, height: 68, borderRadius: '50%',
    border: `2.5px solid ${active ? PC.teal : PC.line}`,
    background: active ? PC.tealBg : PC.field,
    fontSize: 28, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', padding: 0, transition: 'border-color .18s',
  })

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 21, color: PC.ink }}>{s('db_add_child')}</div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 18 }}>
        <button className="tc-press" style={avatarBtnStyle(avatar === 'girl')} onClick={() => { setAvatar('girl'); setAvatarPreview(null) }}>👧</button>
        <button className="tc-press" style={avatarBtnStyle(avatar === 'boy')}  onClick={() => { setAvatar('boy');  setAvatarPreview(null) }}>👦</button>
        <button className="tc-press" style={avatarBtnStyle(avatar instanceof Blob)} onClick={() => fileRef.current?.click()}>
          {avatarPreview
            ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name="camera" size={26} color={PC.inkSoft} />}
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
      </div>

      <Field label={s('db_child_name')}>
        <input className="tc-input" type="text" placeholder={s('db_child_name_ph')} value={name}
          onChange={e => { setName(e.target.value); setError('') }} />
      </Field>

      <BirthDateField value={birthDate} onChange={v => { setBirthDate(v); setError('') }} s={s} />

      <Field label={s('db_pin')}>
        <input className="tc-input" type="password" placeholder="••••" maxLength={4} inputMode="numeric"
          value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError('') }}
          style={{ letterSpacing: 6 }} />
      </Field>

      {error && <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.danger }}>{error}</div>}

      <Btn onClick={save} disabled={loading}>{loading ? s('saving') : s('save')}</Btn>
      <Btn variant="ghost" onClick={onClose} disabled={loading}>{s('cancel')}</Btn>
      {cropNode}
    </BottomSheet>
  )
}

// ── Child card ───────────────────────────────────────────────────────────────
// What a parent opens the dashboard to find out, without opening the child: what they did today,
// their gems, the day's bonus, and whether anything is waiting on the parent. Today comes from the
// same summary the child's home reads, so the two never disagree.
const ACT_EMOJI = { math: '🔢', reading: '📚', writing: '✏️', drawing: '🎨', puzzle: '🧩', homework: '📸' }

function ChildCard({ child, pending, onClick }) {
  const s = useT()
  const [today, setToday] = useState(null)
  useEffect(() => { getTodaySummary(child.id).then(setToday) }, [child.id])
  const acts = Object.entries(today?.activities || {}).filter(([, n]) => n > 0)
  const b = today?.bonus
  const bDone = b?.active ? b.types.filter(k => (today.activities?.[k] || 0) > 0).length : 0
  return (
    <Card onClick={onClick} pad={16} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar child={child} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16.5, color: PC.ink }}>{child.name}</div>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 1 }}>{s('years_old', { n: child.age })}</div>
        </div>
        {today && <Pill bg={PC.amberBg} color={PC.amber}>⭐ {today.gems ?? 0}</Pill>}
        <Icon name="chevron" size={20} color={PC.inkFaint} />
      </div>
      {pending > 0 && (
        <div style={{ alignSelf: 'flex-start', background: PC.peachBg, color: PC.ink, borderRadius: 10, padding: '6px 11px', fontFamily: FONT, fontWeight: 800, fontSize: 12.5 }}>
          ⏳ {s('db_pending_n', { n: pending })}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${PC.line}`, paddingTop: 11, minHeight: 22 }}>
        <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 12, color: PC.inkFaint, textTransform: 'uppercase', letterSpacing: '.5px' }}>{s('db_today_label')}</span>
        <div style={{ flex: 1, display: 'flex', gap: 8, flexWrap: 'wrap', fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.ink }}>
          {!today ? <span style={{ color: PC.inkFaint }}>…</span>
            : acts.length ? acts.map(([k, n]) => <span key={k}>{ACT_EMOJI[k] || '•'} {n}</span>)
              : <span style={{ color: PC.inkSoft, fontWeight: 600 }}>{s('db_today_none')}</span>}
        </div>
        {b?.active && (
          <span title={s('ts_bonus_title')} style={{ fontFamily: FONT, fontWeight: 800, fontSize: 12.5, color: b.earned ? PC.green : PC.inkSoft, whiteSpace: 'nowrap' }}>
            🏅 {b.earned ? '✓' : `${bDone}/${b.types.length}`}
          </span>
        )}
      </div>
    </Card>
  )
}

// ── Notification row ─────────────────────────────────────────────────────────
function NotifRow({ icon, label, status, connected, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: PC.field, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14.5, color: PC.ink }}>{label}</div>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: connected ? PC.green : PC.inkFaint, marginTop: 2 }}>{status}</div>
      </div>
      {action}
    </div>
  )
}

// ── Notification preferences ─────────────────────────────────────────────────
// These three keys are read by the exit gate on the server (sendGate, server/index.js). Nothing
// here is cosmetic: each row decides whether a message is sent at all.
const NOTIFY_LEVELS = [
  { id: 'quiet',    title: 'db_lvl_quiet', body: 'db_lvl_quiet_b' },
  { id: 'required', title: 'db_lvl_req',   body: 'db_lvl_req_b' },
  { id: 'all',      title: 'db_lvl_all',   body: 'db_lvl_all_b' },
]

// Reward claims and goal requests are deliberately not here — those spend real-world things, so
// there is nothing Tuto can decide on the parent's behalf.
const APPROVAL_TYPES = [
  { id: 'submission',   label: 'db_ap_homework', body: 'db_ap_homework_b' },
  { id: 'drawing',      label: 'db_ap_drawings', body: 'db_ap_drawings_b' },
  { id: 'contribution', label: 'db_ap_helping',  body: 'db_ap_helping_b' },
]

// Presets rather than a free field: the parent reaching for this is on their way out of the
// door. The server caps a window at eight hours anyway, so nothing here can ask for more.
const AUTOPILOT_PRESETS = [
  { label: 'db_hour_1', minutes: 60 },
  { label: 'db_hour_2', minutes: 120 },
  { label: 'db_hour_4', minutes: 240 },
]

function LevelRow({ level, selected, onClick }) {
  const s = useT()
  return (
    <button className="tc-press tc-tap" onClick={onClick} style={{
      display: 'flex', alignItems: 'flex-start', gap: 11, textAlign: 'left', width: '100%',
      background: selected ? PC.tealBg : '#fff', cursor: 'pointer',
      border: `1.5px solid ${selected ? PC.teal : PC.line}`, borderRadius: 14, padding: '12px 14px',
      transition: 'background .18s, border-color .18s',
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
        border: `2px solid ${selected ? PC.tealDeep : '#D9DEE3'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {selected && <div style={{ width: 10, height: 10, borderRadius: '50%', background: PC.tealDeep }} />}
      </div>
      <div>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: PC.ink }}>{s(level.title)}</div>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkSoft, marginTop: 2, lineHeight: 1.45 }}>{s(level.body)}</div>
      </div>
    </button>
  )
}

function TimeInput({ value, onChange }) {
  return (
    <input type="time" value={value} onChange={e => onChange(e.target.value)} style={{
      fontFamily: FONT, fontWeight: 700, fontSize: 15, color: PC.ink,
      background: '#fff', border: `1.5px solid ${PC.line}`, borderRadius: 11,
      padding: '9px 11px', flex: 1, minWidth: 0,
    }} />
  )
}

// ── Dashboard ────────────────────────────────────────────────────────────────
// On a tablet the dashboard uses the width: children on the left, "busy for a while" beside them.
const PD_CSS = `
.pd-wrap{ max-width:430px; }
.pd-grid{ display:flex; flex-direction:column; }
@media (min-width:900px){
  .pd-wrap{ max-width:980px; }
  .pd-grid{ display:grid; grid-template-columns:1.5fr 1fr; gap:26px; align-items:start; }
}
`

export default function ParentDashboard({ view = 'dashboard' }) {
  const s = useT()
  const nav = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [children, setChildren] = useState(_childrenCache || [])
  const [showModal, setShowModal] = useState(false)
  const [familyCode, setFamilyCode] = useState(null)
  const [showQR, setShowQR] = useState(false)
  const [notifData, setNotifData] = useState({ telegramChatId: null, whatsappPhone: null, whatsappVerifiedAt: null, channel: null })
  const [showTelegramSetup, setShowTelegramSetup] = useState(false)
  const [telegramCodeCopied, setTelegramCodeCopied] = useState(false)
  const [showWaSetup, setShowWaSetup] = useState(false)
  const [waCode, setWaCode] = useState(null)
  const [waLink, setWaLink] = useState(null)
  const [waJustConnected, setWaJustConnected] = useState(false)
  const waConnected = waJustConnected || !!notifData.whatsappVerifiedAt
  const [waError, setWaError] = useState('')
  const [prefs, setPrefs] = useState(null)
  const [pendingFor, setPendingFor] = useState({})
  const [nowTs, setNowTs] = useState(Date.now())

  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'pcss-dashboard'
    el.textContent = PCSS
    if (!document.getElementById('pcss-dashboard')) document.head.appendChild(el)
    return () => { document.getElementById('pcss-dashboard')?.remove() }
  }, [])

  const updateChildren = (next) => {
    _childrenCache = next
    setChildren(next)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (!user) return

      loadParentData(user.id)
      loadOverview()

      const { updatedChild, removedId } = location.state || {}
      if (updatedChild && _childrenCache) {
        updateChildren(_childrenCache.map(c => c.id === updatedChild.id ? updatedChild : c))
      } else if (removedId && _childrenCache) {
        updateChildren(_childrenCache.filter(c => c.id !== removedId))
      } else if (!_childrenCache) {
        loadChildren(user.id)
      }
    })
  }, [])

  const loadParentData = async (uid) => {
    const { data } = await supabase
      .from('parents')
      .select('family_code, telegram_chat_id, whatsapp_phone, whatsapp_verified_at, notification_channel, prefs')
      .eq('id', uid)
      .single()

    let code = data?.family_code
    if (!code) {
      code = Math.random().toString(36).substring(2, 10).toUpperCase()
      await supabase.from('parents').update({ family_code: code }).eq('id', uid)
    }
    setFamilyCode(code)
    setNotifData({
      telegramChatId: data?.telegram_chat_id || null,
      whatsappPhone: data?.whatsapp_phone || null,
      whatsappVerifiedAt: data?.whatsapp_verified_at || null,
      channel: data?.notification_channel || null,
    })
    setPrefs(data?.prefs || {})
    // The account is the truth; the device copy is a cache of it. Without this, logging in on a
    // second device would show the screens in whatever that device happened to be set to while
    // the messages arrived in the language the account says.
    adoptAccountLang(data?.prefs?.language)
  }

  const loadOverview = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    try {
      const r = await fetch(`${SERVER}/api/parent/overview`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      const j = await r.json()
      setPendingFor(Object.fromEntries((j.children || []).map(c => [c.id, c.pending])))
    } catch { /* the cards just show no badge */ }
  }

  const updateChannel = async (ch) => {
    setNotifData(d => ({ ...d, channel: ch }))
    if (user) await supabase.from('parents').update({ notification_channel: ch }).eq('id', user.id)
  }

  // Read-modify-write on the whole jsonb, because the column holds keys this screen knows nothing
  // about (language, tone, the daily limits) and a partial write would drop them.
  const savePrefs = async (patch) => {
    const next = { ...(prefs || {}), ...patch }
    setPrefs(next)
    if (user) await supabase.from('parents').update({ prefs: next }).eq('id', user.id)
  }

  const notifyLevel = NOTIFY_LEVELS.some(l => l.id === prefs?.notify_level) ? prefs.notify_level : 'all'
  const quiet = prefs?.quiet_hours || null
  // Absent means on, matching the server: a parent who has never chosen hears about each session.
  const perTask = prefs?.notify_per_task !== false
  const approvalOff = APPROVAL_TYPES.filter(t => prefs?.approval_required?.[t.id] === false)

  const autopilotEnds = prefs?.autopilot?.until ? new Date(prefs.autopilot.until).getTime() : null
  const autopilotOn = autopilotEnds != null && autopilotEnds > nowTs
  // The end time passes on its own, so without a tick this panel would still claim to be running
  // long after the server had handed the approvals back.
  useEffect(() => {
    if (!autopilotOn) return
    const t = setInterval(() => setNowTs(Date.now()), 30000)
    return () => clearInterval(t)
  }, [autopilotOn])

  const startAutopilot = (minutes) => {
    const now = new Date()
    savePrefs({ autopilot: { started_at: now.toISOString(), until: new Date(now.getTime() + minutes * 60000).toISOString() } })
  }
  // Expired rather than erased. Deleting the key here would hand the approvals back silently —
  // the server's sweep is what writes the summary of what happened, and it only runs on a window
  // it can still see.
  const endAutopilot = () => {
    const now = Date.now()
    savePrefs({ autopilot: { ...prefs.autopilot, until: new Date(now).toISOString() } })
    // Without this the panel would keep claiming to be running until the next 30s tick, and a parent
    // who pressed "I'm back" and saw nothing change would reasonably press it again.
    setNowTs(now)
  }

  const startWaConnect = async () => {
    if (!user || waLink) return
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

  useEffect(() => {
    if (!showWaSetup || !waCode || !user) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${SERVER}/api/whatsapp/connect-status?parentId=${user.id}&code=${waCode}`)
        const data = await res.json()
        if (data.connected) {
          setWaJustConnected(true)
          setNotifData(d => ({ ...d, whatsappPhone: data.whatsappPhone, whatsappVerifiedAt: new Date().toISOString(), channel: d.channel || 'whatsapp' }))
        }
      } catch { /* keep polling */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [showWaSetup, waCode, user])

  const loadChildren = async (uid) => {
    const { data } = await supabase.from('children').select('*').eq('parent_id', uid).order('created_at')
    if (data) {
      updateChildren(data)
      if (data.length === 0) nav('/parent/onboarding')
    }
  }

  const logout = async () => {
    _childrenCache = null
    await supabase.auth.signOut()
    nav('/')
  }

  const handleSaved = (child) => {
    updateChildren([...(_childrenCache || []), child])
    setShowModal(false)
  }

  const displayName = user?.user_metadata?.full_name || user?.email || s('db_parent')

  const channelConnected = !!notifData.telegramChatId || waConnected

  // Settings, reached from the gear at the top of the dashboard: how Tuto reaches the parent,
  // when it writes, what it asks before doing, and the child's device. They were the bottom
  // three quarters of the dashboard under "How much I write", and a parent looking for
  // "settings" did not find them.
  if (view === 'settings') return (
    <div className="pd-wrap" style={{ background: PC.bg, minHeight: '100dvh', margin: '0 auto', display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      <style>{PD_CSS}</style>
      <TopBar title={s('db_settings')} onBack={() => nav('/parent/dashboard')} />
      <div className="tc-scroll" style={{ flex: 1, padding: '0 22px 32px' }}>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: PC.ink, margin: '6px 2px 12px' }}>{s('db_reach')}</div>
        <Card pad={18} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Connecting both is useful and the difference is not obvious: updates go to ONE
              channel, but a question is answered wherever it was asked. Without this a parent
              connects the second one and reads the first going quiet as something broken. */}
          <div style={{
            background: PC.tealBg, borderRadius: 14, padding: '12px 14px',
            fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.tealDeep, lineHeight: 1.5,
          }}>
            {s('db_primary_note', {
              who: children.length === 1 ? s('db_who_named', { name: children[0].name })
                 : children.length === 0 ? s('db_who_your_child')
                 : s('db_who_children'),
            })}
          </div>

          {/* Telegram */}
          <NotifRow
            icon="✈️"
            label="Telegram"
            connected={!!notifData.telegramChatId}
            status={notifData.telegramChatId ? s('db_connected') : s('db_not_connected')}
            action={!notifData.telegramChatId
              ? <Btn full={false} variant="soft" onClick={() => setShowTelegramSetup(s => !s)} style={{ padding: '8px 13px', fontSize: 13 }}>{showTelegramSetup ? s('cancel') : s('db_connect')}</Btn>
              : waConnected
                ? <button className="tc-press tc-tap" onClick={() => updateChannel('telegram')} style={{ background: notifData.channel === 'telegram' ? PC.teal : PC.tealBg, border: 'none', borderRadius: 10, padding: '7px 12px', fontSize: 12, fontWeight: 700, color: notifData.channel === 'telegram' ? '#fff' : PC.tealDeep, cursor: 'pointer', fontFamily: FONT }}>{notifData.channel === 'telegram' ? s('db_primary') : s('db_set_primary')}</button>
                : null}
          />

          {showTelegramSetup && !notifData.telegramChatId && (
            <div className="tc-fade" style={{ background: PC.tealBg, borderRadius: 15, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, marginTop: -6 }}>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.ink, lineHeight: 1.6 }}>
                {s('db_tg_steps_a')} <b style={{ color: '#229ED9' }}>@TutoParentBot</b>{s('db_tg_steps_b')} <b>/start</b>{s('db_tg_steps_c')}
              </div>
              {familyCode && (
                <button className="tc-press" onClick={() => { navigator.clipboard.writeText(familyCode); setTelegramCodeCopied(true); setTimeout(() => setTelegramCodeCopied(false), 2000) }}
                  style={{ background: '#fff', border: `1.5px solid ${telegramCodeCopied ? PC.green : PC.teal}`, borderRadius: 13, padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'border-color .2s' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 800, color: PC.ink, letterSpacing: 3 }}>{familyCode}</span>
                  <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12.5, color: telegramCodeCopied ? PC.green : PC.tealDeep }}>{telegramCodeCopied ? s('db_copied') : s('db_copy')}</span>
                </button>
              )}
            </div>
          )}

          <div style={{ height: 1, background: PC.line }} />

          {/* WhatsApp — whatsapp_phone alone doesn't mean "connected": a stale,
              never-actually-verified value can be sitting there from the old
              abandoned flow — but whatsapp_verified_at is written only when a code
              actually arrived from the number, so it survives a reload. waJustConnected
              alone meant the row read "Not connected" on every revisit. (set once THIS session's
              webhook poll confirms the match) is the real signal. */}
          <NotifRow
            icon="💬"
            label="WhatsApp"
            connected={waConnected}
            status={waConnected ? s('db_connected') : s('db_not_connected')}
            action={!waConnected
              ? <Btn full={false} variant="soft" onClick={() => { setShowWaSetup(s => !s); if (!waLink) startWaConnect() }} style={{ padding: '8px 13px', fontSize: 13 }}>{showWaSetup ? s('cancel') : s('db_connect')}</Btn>
              : notifData.telegramChatId
                ? <button className="tc-press tc-tap" onClick={() => updateChannel('whatsapp')} style={{ background: notifData.channel === 'whatsapp' ? PC.green : PC.greenBg, border: 'none', borderRadius: 10, padding: '7px 12px', fontSize: 12, fontWeight: 700, color: notifData.channel === 'whatsapp' ? '#fff' : PC.green, cursor: 'pointer', fontFamily: FONT }}>{notifData.channel === 'whatsapp' ? s('db_primary') : s('db_set_primary')}</button>
                : null}
          />

          {showWaSetup && !waConnected && (
            <div className="tc-fade" style={{ background: PC.greenBg, borderRadius: 15, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, marginTop: -6 }}>
              {waLink ? (
                <>
                  <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.ink, lineHeight: 1.6 }}>
                    {s('db_wa_steps')}
                  </div>
                  <a href={waLink} target="_blank" rel="noreferrer" className="tc-press"
                    style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '13px 16px', background: PC.green, borderRadius: 14, fontFamily: FONT, fontSize: 14, fontWeight: 800, color: '#fff' }}>
                    {s('db_wa_open')}
                  </a>
                  <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: PC.inkFaint, textAlign: 'center' }}>{s('db_wa_waiting')}</div>
                </>
              ) : (
                <div style={{ fontFamily: FONT, fontSize: 13, color: PC.inkFaint, textAlign: 'center' }}>{waError || s('loading')}</div>
              )}
            </div>
          )}
        </Card>


        {prefs && (
          <>
            <Card pad={18} style={{ marginTop: 12 }}>
              {/* Language first, because it applies to every message below — including the one
                  autopilot sends when it ends. There was no way to set this at all until now:
                  the column defaults to Turkish, and a parent who reads neither Turkish nor
                  their child's language had nothing to change. Separate from the child's
                  language on purpose — the app the child reads and the messages the parent
                  gets are two different audiences, and in plenty of families two different
                  languages. */}
              <div>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14.5, color: PC.ink }}>{s('db_lang_title')}</div>
                <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkSoft, marginTop: 2, marginBottom: 13, lineHeight: 1.45 }}>
                  {s('db_lang_sub')}
                </div>
                {/* The same control as the splash screen's, and it writes to both places: the
                    device (so the screens change now) and the account (so the messages do, and
                    so the choice follows them to their next device). */}
                <LangPicker onPick={code => savePrefs({ language: code })} />
              </div>

            </Card>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: PC.ink, margin: '26px 2px 12px' }}>{s('db_when')}</div>
            <Card pad={18} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Dimmed, not disabled, while autopilot runs: a selected row reads as "this is what
                  I'm doing now", and right now it isn't. Still editable, because a parent setting
                  this on their way out means it for when they get back. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, opacity: autopilotOn ? 0.45 : 1 }}>
                {NOTIFY_LEVELS.map(l => (
                  <LevelRow key={l.id} level={l} selected={notifyLevel === l.id} onClick={() => savePrefs({ notify_level: l.id })} />
                ))}
              </div>

              {/* Only under "Everything", because that is the only level that sends these at all.
                  Ada does three maths sessions in an afternoon; this is the difference between one
                  message and three, which is not the same question as which kinds of message. */}
              {notifyLevel === 'all' && (
                <div className="tc-fade" style={{ display: 'flex', alignItems: 'center', gap: 13, paddingLeft: 4, opacity: autopilotOn ? 0.45 : 1 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13.5, color: PC.ink }}>{s('db_every_session')}</div>
                    <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12, color: PC.inkFaint, marginTop: 1, lineHeight: 1.45 }}>
                      {s('db_every_session_b')}
                    </div>
                  </div>
                  <Toggle on={perTask} onClick={() => savePrefs({ notify_per_task: !perTask })} />
                </div>
              )}

              {/* The trap this setting can walk a parent into, said out loud rather than
                  discovered three days later: at the quietest level an approval is still
                  waiting, and the child's gems wait with it. */}
              {notifyLevel === 'quiet' && approvalOff.length < APPROVAL_TYPES.length && (
                <div style={{ background: PC.peachBg, borderRadius: 13, padding: '11px 13px', fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.ink, lineHeight: 1.5 }}>
                  {s('db_quiet_warn')}
                </div>
              )}

              <div style={{ height: 1, background: PC.line }} />

              {/* quiet hours */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14.5, color: PC.ink }}>{s('db_quiet_hours')}</div>
                    <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkSoft, marginTop: 2, lineHeight: 1.45 }}>
                      {s('db_quiet_hours_b')}
                    </div>
                  </div>
                  <Toggle on={!!quiet} onClick={() => savePrefs({ quiet_hours: quiet ? null : { start: '21:00', end: '08:00' } })} />
                </div>
                {quiet && (
                  <div className="tc-fade" style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12 }}>
                    <TimeInput value={quiet.start || ''} onChange={v => savePrefs({ quiet_hours: { ...quiet, start: v } })} />
                    <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.inkFaint }}>{s('db_to')}</span>
                    <TimeInput value={quiet.end || ''} onChange={v => savePrefs({ quiet_hours: { ...quiet, end: v } })} />
                  </div>
                )}
              </div>
            </Card>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: PC.ink, margin: '26px 2px 12px' }}>{s('db_ask_first')}</div>
            <Card pad={18} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* per-type approvals */}
              <div>
                <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkSoft, marginTop: 2, marginBottom: 13, lineHeight: 1.45 }}>
                  {s('db_ask_first_b')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 13, opacity: autopilotOn ? 0.45 : 1 }}>
                  {APPROVAL_TYPES.map(t => {
                    const on = prefs?.approval_required?.[t.id] !== false
                    return (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: PC.ink }}>{s(t.label)}</div>
                          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12, color: PC.inkFaint, marginTop: 1 }}>{s(t.body)}</div>
                        </div>
                        <Toggle on={on} onClick={() => savePrefs({
                          approval_required: { ...(prefs?.approval_required || {}), [t.id]: !on },
                        })} />
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkFaint, lineHeight: 1.5, textAlign: 'center' }}>
                {s('db_tell_me')}
              </div>
            </Card>
          </>
        )}
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: PC.ink, margin: '26px 2px 12px' }}>{s('db_setup_device')}</div>
        <Card pad={18}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: PC.tealBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="qr" size={23} color={PC.tealDeep} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 15, color: PC.ink }}>{s('db_child_device')}</div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkSoft, marginTop: 1 }}>{s('db_scan_qr')}</div>
            </div>
            <Btn full={false} variant={showQR ? 'soft' : 'outline'} onClick={() => setShowQR(v => !v)} style={{ padding: '10px 16px', fontSize: 14 }}>
              {showQR ? s('db_hide') : s('db_show_qr')}
            </Btn>
          </div>
          {showQR && familyCode && (
            <div className="tc-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginTop: 16 }}>
              <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: SHADOW_SM }}>
                <QRCodeSVG
                  value={`https://tuto-blue.vercel.app/setup?code=${familyCode}`}
                  size={186}
                  bgColor="#ffffff"
                  fgColor={PC.ink}
                  level="M"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: PC.tealBg, borderRadius: 10, padding: '6px 14px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: PC.tealDeep, letterSpacing: 3 }}>{familyCode}</span>
                </div>
                <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12, color: PC.inkFaint }}>{s('db_manual_code')}</span>
              </div>
            </div>
          )}
        </Card>

      </div>
    </div>
  )

  return (
    <div className="pd-wrap" style={{ background: PC.bg, minHeight: '100dvh', margin: '0 auto', display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      <style>{PD_CSS}</style>
      <div className="tc-scroll" style={{ flex: 1, padding: '8px 22px 32px' }}>

        {/* greeting, with Settings named — the gear is where everything that is not today went */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 2px 0' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13.5, color: PC.inkSoft }}>{s('db_welcome')}</div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 26, color: PC.ink, letterSpacing: '-.5px', marginTop: 2 }}>{displayName}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="tc-press tc-tap" onClick={() => nav('/parent/settings')}
              style={{ height: 46, borderRadius: 15, background: '#fff', border: `1.5px solid ${PC.line}`, display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px', cursor: 'pointer', boxShadow: SHADOW_SM, fontFamily: FONT, fontWeight: 800, fontSize: 13.5, color: PC.ink }}>
              <span style={{ fontSize: 17 }}>⚙️</span>{s('db_settings')}
            </button>
            <button className="tc-press tc-tap" onClick={logout} aria-label={s('db_signout')}
              style={{ width: 46, height: 46, borderRadius: 15, background: '#fff', border: `1.5px solid ${PC.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: SHADOW_SM }}>
              <Icon name="logout" size={21} color={PC.inkSoft} />
            </button>
          </div>
        </div>

        {/* Nowhere for Tuto to write yet: said here, once, until it is done. */}
        {user && !channelConnected && (
          <Card pad={14} onClick={() => nav('/parent/settings')} style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, background: PC.peachBg, border: 'none', boxShadow: 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: 22 }}>💬</span>
            <div style={{ flex: 1, fontFamily: FONT, fontWeight: 700, fontSize: 13.5, color: PC.ink, lineHeight: 1.4 }}>{s('db_connect_reminder')}</div>
            <Icon name="chevron" size={18} color={PC.inkFaint} />
          </Card>
        )}

        <div className="pd-grid">
          <div>
            {/* children — each card says what the parent opens the app to find out */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '22px 2px 12px' }}>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: PC.ink }}>{s('db_my_children')}</div>
              <button className="tc-press tc-tap" onClick={() => setShowModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: PC.tealBg, color: PC.tealDeep, border: 'none', borderRadius: 11, padding: '8px 13px', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                <Icon name="plus" size={16} color={PC.tealDeep} sw={2.4} /> {s('db_add')}
              </button>
            </div>
            {children.length === 0 ? (
              <Card pad={32} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, border: `2px dashed ${PC.line}`, boxShadow: 'none' }}>
                <div style={{ fontSize: 46 }}>🧒</div>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: PC.ink }}>{s('db_no_children')}</div>
                <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: PC.inkSoft, textAlign: 'center' }}>{s('db_no_children_b')}</div>
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {children.map(child => <ChildCard key={child.id} child={child} pending={pendingFor[child.id]} onClick={() => nav(`/parent/child/${child.id}`)} />)}
              </div>
            )}
          </div>

          {/* "I'm busy for a while" is a thing a parent does, not a setting they keep — so it
              lives on the dashboard, next to the children it is about. */}
          {prefs && (
            <div>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: PC.ink, margin: '22px 2px 12px' }}>{s('db_busy')}</div>
              <Card pad={18}>
              {/* autopilot — first of the message settings, because while it runs it overrides
                  everything below it */}
              <div>
                <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkSoft, marginTop: 2, marginBottom: 13, lineHeight: 1.45 }}>
                  {s('db_busy_sub')}
                </div>

                {autopilotOn ? (
                  <div className="tc-fade" style={{ background: PC.peachBg, borderRadius: 13, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, fontFamily: FONT, fontWeight: 700, fontSize: 13.5, color: PC.ink, lineHeight: 1.45 }}>
                      {s('db_on_until', { time: new Date(autopilotEnds).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}
                      <div style={{ fontWeight: 600, fontSize: 12, color: PC.inkSoft, marginTop: 2 }}>
                        {s('db_will_tell')}
                      </div>
                    </div>
                    <Btn full={false} variant="soft" onClick={endAutopilot} style={{ padding: '8px 13px', fontSize: 13 }}>{s('db_im_back')}</Btn>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 9 }}>
                    {AUTOPILOT_PRESETS.map(p => (
                      <Btn key={p.minutes} full={false} variant="outline" onClick={() => startAutopilot(p.minutes)}
                        style={{ flex: 1, padding: '9px 6px', fontSize: 13 }}>{s(p.label)}</Btn>
                    ))}
                  </div>
                )}
              </div>

              </Card>
            </div>
          )}
        </div>
      </div>

      {showModal && user && (
        <AddChildSheet
          parentId={user.id}
          siblings={children}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
