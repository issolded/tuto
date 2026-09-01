import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { hashPin } from '../lib/hash'
import {
  PC, FONT, SHADOW, SHADOW_SM, PCSS,
  TopBar, Btn, Card, Field, Toggle, Pill, Avatar, BottomSheet, Icon,
} from '../lib/parentUI'

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'

let _childrenCache = null

// ── Add child bottom sheet ────────────────────────────────────────────────────
function AddChildSheet({ parentId, siblings = [], onClose, onSaved }) {
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [avatar, setAvatar] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const fileRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAvatar(file)
    const reader = new FileReader()
    reader.onload = ev => setAvatarPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const save = async () => {
    if (!name.trim()) return setError('Name is required.')
    if (!age || isNaN(age) || +age < 1 || +age > 18) return setError('Enter a valid age (1–18).')
    if (!/^\d{4}$/.test(pin)) return setError('PIN must be 4 digits.')
    setLoading(true); setError('')

    let avatar_url = null
    if (avatar instanceof File) {
      try {
        const ext = avatar.name.split('.').pop() || 'jpg'
        const path = `avatars/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage.from('submissions').upload(path, avatar, { upsert: true })
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
      setError('This PIN is already used by another child. Choose a different one.')
      setLoading(false)
      return
    }
    const { data, error: dbError } = await supabase
      .from('children')
      .insert({ parent_id: parentId, name: name.trim(), age: +age, pin_hash, ...(avatar_url && { avatar_url }) })
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
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 21, color: PC.ink }}>Add a child 🧒</div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 18 }}>
        <button className="tc-press" style={avatarBtnStyle(avatar === 'girl')} onClick={() => { setAvatar('girl'); setAvatarPreview(null) }}>👧</button>
        <button className="tc-press" style={avatarBtnStyle(avatar === 'boy')}  onClick={() => { setAvatar('boy');  setAvatarPreview(null) }}>👦</button>
        <button className="tc-press" style={avatarBtnStyle(avatar instanceof File)} onClick={() => fileRef.current?.click()}>
          {avatarPreview
            ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name="camera" size={26} color={PC.inkSoft} />}
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
      </div>

      <Field label="Child's name">
        <input className="tc-input" type="text" placeholder="e.g. Emma" value={name}
          onChange={e => { setName(e.target.value); setError('') }} />
      </Field>

      <Field label="Age">
        <input className="tc-input" type="number" placeholder="8" min="1" max="18" value={age}
          onChange={e => { setAge(e.target.value); setError('') }} />
      </Field>

      <Field label="4-digit PIN">
        <input className="tc-input" type="password" placeholder="••••" maxLength={4} inputMode="numeric"
          value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError('') }}
          style={{ letterSpacing: 6 }} />
      </Field>

      {error && <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.danger }}>{error}</div>}

      <Btn onClick={save} disabled={loading}>{loading ? 'Saving…' : 'Save'}</Btn>
      <Btn variant="ghost" onClick={onClose} disabled={loading}>Cancel</Btn>
    </BottomSheet>
  )
}

// ── Child row ────────────────────────────────────────────────────────────────
function ChildRow({ child, onClick }) {
  return (
    <Card onClick={onClick} pad={16} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <Avatar child={child} size={52} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16.5, color: PC.ink }}>{child.name}</div>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 1 }}>{child.age} years old</div>
        {child.gems != null && (
          <div style={{ marginTop: 7 }}>
            <Pill bg={PC.amberBg} color={PC.amber}>⭐ {child.gems ?? 0}</Pill>
          </div>
        )}
      </div>
      <Icon name="chevron" size={20} color={PC.inkFaint} />
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
  { id: 'quiet',    title: 'Only if something worries me', body: 'Nothing else. You look in the app when you want to.' },
  { id: 'required', title: 'And when I need you',          body: 'Plus anything that is waiting on your approval.' },
  { id: 'all',      title: 'Everything',                   body: 'Plus each activity as it is finished.' },
]

// Reward claims and goal requests are deliberately not here — those spend real-world things, so
// there is nothing Tuto can decide on the parent's behalf.
const APPROVAL_TYPES = [
  { id: 'submission',   label: 'Homework',     body: 'Photos of finished homework' },
  { id: 'drawing',      label: 'Drawings',     body: 'Photos of finished drawings' },
  { id: 'contribution', label: 'Helping out',  body: 'Jobs done around the house' },
]

// Presets rather than a free field: the parent reaching for this is on their way out of the
// door. The server caps a window at eight hours anyway, so nothing here can ask for more.
const AUTOPILOT_PRESETS = [
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '4 hours', minutes: 240 },
]

function LevelRow({ level, selected, onClick }) {
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
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: PC.ink }}>{level.title}</div>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkSoft, marginTop: 2, lineHeight: 1.45 }}>{level.body}</div>
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
export default function ParentDashboard() {
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

  const displayName = user?.user_metadata?.full_name || user?.email || 'Parent'

  return (
    <div style={{ background: PC.bg, minHeight: '100dvh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      <div className="tc-scroll" style={{ flex: 1, padding: '8px 22px 32px' }}>

        {/* greeting */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 2px 0' }}>
          <div>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13.5, color: PC.inkSoft }}>Welcome back 👋</div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 26, color: PC.ink, letterSpacing: '-.5px', marginTop: 2 }}>{displayName}</div>
          </div>
          <button className="tc-press tc-tap" onClick={logout} aria-label="Sign out"
            style={{ width: 46, height: 46, borderRadius: 15, background: '#fff', border: `1.5px solid ${PC.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: SHADOW_SM }}>
            <Icon name="logout" size={21} color={PC.inkSoft} />
          </button>
        </div>

        {/* summary strip */}
        <Card pad={16} style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 14, background: `linear-gradient(120deg, ${PC.teal}, ${PC.tealDeep})`, boxShadow: '0 16px 32px -14px rgba(63,183,172,.6)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,.85)' }}>Children</div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: '#fff', lineHeight: 1.1, marginTop: 2 }}>{children.length}</div>
            <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: 'rgba(255,255,255,.85)', marginTop: 3 }}>
              {children.length === 1 ? 'child registered' : 'children registered'}
            </div>
          </div>
          <div style={{ width: 62, height: 62, borderRadius: 20, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="user" size={30} color="#fff" />
          </div>
        </Card>

        {/* children section */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 2px 12px' }}>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: PC.ink }}>My children</div>
          <button className="tc-press tc-tap" onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: PC.tealBg, color: PC.tealDeep, border: 'none', borderRadius: 11, padding: '8px 13px', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            <Icon name="plus" size={16} color={PC.tealDeep} sw={2.4} /> Add
          </button>
        </div>

        {children.length === 0 ? (
          <Card pad={32} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, border: `2px dashed ${PC.line}`, boxShadow: 'none' }}>
            <div style={{ fontSize: 46 }}>🧒</div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: PC.ink }}>No children yet</div>
            <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: PC.inkSoft, textAlign: 'center' }}>Add your child to start the learning journey.</div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {children.map(child => <ChildRow key={child.id} child={child} onClick={() => nav(`/parent/child/${child.id}`)} />)}
          </div>
        )}

        {/* device setup */}
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: PC.ink, margin: '26px 2px 12px' }}>Set up a device</div>
        <Card pad={18}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: PC.tealBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="qr" size={23} color={PC.tealDeep} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 15, color: PC.ink }}>Child device</div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkSoft, marginTop: 1 }}>Scan a QR code to connect it</div>
            </div>
            <Btn full={false} variant={showQR ? 'soft' : 'outline'} onClick={() => setShowQR(v => !v)} style={{ padding: '10px 16px', fontSize: 14 }}>
              {showQR ? 'Hide' : 'Show QR'}
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
                <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12, color: PC.inkFaint }}>manual code</span>
              </div>
            </div>
          )}
        </Card>

        {/* notifications */}
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: PC.ink, margin: '26px 2px 12px' }}>Notifications</div>
        <Card pad={18} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Connecting both is useful and the difference is not obvious: updates go to ONE
              channel, but a question is answered wherever it was asked. Without this a parent
              connects the second one and reads the first going quiet as something broken. */}
          <div style={{
            background: PC.tealBg, borderRadius: 14, padding: '12px 14px',
            fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.tealDeep, lineHeight: 1.5,
          }}>
            Your <strong>primary</strong> channel is where {children.length === 1 ? `${children[0].name}'s` : "your children's"} updates
            arrive. You can message Tuto on either one at any time — questions are always answered
            where you asked them.
          </div>

          {/* Telegram */}
          <NotifRow
            icon="✈️"
            label="Telegram"
            connected={!!notifData.telegramChatId}
            status={notifData.telegramChatId ? 'Connected' : 'Not connected'}
            action={!notifData.telegramChatId
              ? <Btn full={false} variant="soft" onClick={() => setShowTelegramSetup(s => !s)} style={{ padding: '8px 13px', fontSize: 13 }}>{showTelegramSetup ? 'Cancel' : 'Connect'}</Btn>
              : waConnected
                ? <button className="tc-press tc-tap" onClick={() => updateChannel('telegram')} style={{ background: notifData.channel === 'telegram' ? PC.teal : PC.tealBg, border: 'none', borderRadius: 10, padding: '7px 12px', fontSize: 12, fontWeight: 700, color: notifData.channel === 'telegram' ? '#fff' : PC.tealDeep, cursor: 'pointer', fontFamily: FONT }}>{notifData.channel === 'telegram' ? '★ Primary' : 'Set primary'}</button>
                : null}
          />

          {showTelegramSetup && !notifData.telegramChatId && (
            <div className="tc-fade" style={{ background: PC.tealBg, borderRadius: 15, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, marginTop: -6 }}>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.ink, lineHeight: 1.6 }}>
                Message <b style={{ color: '#229ED9' }}>@TutoParentBot</b>, send <b>/start</b>, then paste your code:
              </div>
              {familyCode && (
                <button className="tc-press" onClick={() => { navigator.clipboard.writeText(familyCode); setTelegramCodeCopied(true); setTimeout(() => setTelegramCodeCopied(false), 2000) }}
                  style={{ background: '#fff', border: `1.5px solid ${telegramCodeCopied ? PC.green : PC.teal}`, borderRadius: 13, padding: '12px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'border-color .2s' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 800, color: PC.ink, letterSpacing: 3 }}>{familyCode}</span>
                  <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12.5, color: telegramCodeCopied ? PC.green : PC.tealDeep }}>{telegramCodeCopied ? '✅ Copied!' : '📋 Copy'}</span>
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
            status={waConnected ? 'Connected' : 'Not connected'}
            action={!waConnected
              ? <Btn full={false} variant="soft" onClick={() => { setShowWaSetup(s => !s); if (!waLink) startWaConnect() }} style={{ padding: '8px 13px', fontSize: 13 }}>{showWaSetup ? 'Cancel' : 'Connect'}</Btn>
              : notifData.telegramChatId
                ? <button className="tc-press tc-tap" onClick={() => updateChannel('whatsapp')} style={{ background: notifData.channel === 'whatsapp' ? PC.green : PC.greenBg, border: 'none', borderRadius: 10, padding: '7px 12px', fontSize: 12, fontWeight: 700, color: notifData.channel === 'whatsapp' ? '#fff' : PC.green, cursor: 'pointer', fontFamily: FONT }}>{notifData.channel === 'whatsapp' ? '★ Primary' : 'Set primary'}</button>
                : null}
          />

          {showWaSetup && !waConnected && (
            <div className="tc-fade" style={{ background: PC.greenBg, borderRadius: 15, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, marginTop: -6 }}>
              {waLink ? (
                <>
                  <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.ink, lineHeight: 1.6 }}>
                    Tap below to open WhatsApp with a pre-filled message, then hit send.
                  </div>
                  <a href={waLink} target="_blank" rel="noreferrer" className="tc-press"
                    style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '13px 16px', background: PC.green, borderRadius: 14, fontFamily: FONT, fontSize: 14, fontWeight: 800, color: '#fff' }}>
                    Open WhatsApp 📲
                  </a>
                  <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: PC.inkFaint, textAlign: 'center' }}>Waiting for your message…</div>
                </>
              ) : (
                <div style={{ fontFamily: FONT, fontSize: 13, color: PC.inkFaint, textAlign: 'center' }}>{waError || 'Loading…'}</div>
              )}
            </div>
          )}
        </Card>

        {/* how much Tuto writes */}
        {prefs && (
          <>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: PC.ink, margin: '26px 2px 12px' }}>How much I write</div>
            <Card pad={18} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* autopilot — first, because while it runs it overrides everything below it */}
              <div>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14.5, color: PC.ink }}>I'm busy for a while</div>
                <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkSoft, marginTop: 2, marginBottom: 13, lineHeight: 1.45 }}>
                  I'll approve homework, drawings and jobs myself and stay quiet until you're back.
                  Reward claims and new goals still wait for you, and anything that worries me still
                  comes through.
                </div>

                {autopilotOn ? (
                  <div className="tc-fade" style={{ background: PC.peachBg, borderRadius: 13, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, fontFamily: FONT, fontWeight: 700, fontSize: 13.5, color: PC.ink, lineHeight: 1.45 }}>
                      On until {new Date(autopilotEnds).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                      <div style={{ fontWeight: 600, fontSize: 12, color: PC.inkSoft, marginTop: 2 }}>
                        I'll tell you what I handled when it ends.
                      </div>
                    </div>
                    <Btn full={false} variant="soft" onClick={endAutopilot} style={{ padding: '8px 13px', fontSize: 13 }}>I'm back</Btn>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 9 }}>
                    {AUTOPILOT_PRESETS.map(p => (
                      <Btn key={p.minutes} full={false} variant="outline" onClick={() => startAutopilot(p.minutes)}
                        style={{ flex: 1, padding: '9px 6px', fontSize: 13 }}>{p.label}</Btn>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: PC.line }} />

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
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13.5, color: PC.ink }}>Every session</div>
                    <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12, color: PC.inkFaint, marginTop: 1, lineHeight: 1.45 }}>
                      Turn this off and I'll tell you about the first one each day, not all three.
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
                  I won't tell you when something needs approving — and until you open the app, the
                  gems wait too. If you'd rather I just handled some of them, turn them off below.
                </div>
              )}

              <div style={{ height: 1, background: PC.line }} />

              {/* quiet hours */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14.5, color: PC.ink }}>Quiet hours</div>
                    <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkSoft, marginTop: 2, lineHeight: 1.45 }}>
                      I won't write between these hours. Anything that worries me still comes through.
                    </div>
                  </div>
                  <Toggle on={!!quiet} onClick={() => savePrefs({ quiet_hours: quiet ? null : { start: '21:00', end: '08:00' } })} />
                </div>
                {quiet && (
                  <div className="tc-fade" style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12 }}>
                    <TimeInput value={quiet.start || ''} onChange={v => savePrefs({ quiet_hours: { ...quiet, start: v } })} />
                    <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.inkFaint }}>to</span>
                    <TimeInput value={quiet.end || ''} onChange={v => savePrefs({ quiet_hours: { ...quiet, end: v } })} />
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: PC.line }} />

              {/* per-type approvals */}
              <div>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14.5, color: PC.ink }}>Ask me first</div>
                <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkSoft, marginTop: 2, marginBottom: 13, lineHeight: 1.45 }}>
                  Turn one off and I'll approve it myself and add the gems. You'll still see it — I
                  just won't stop and ask.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 13, opacity: autopilotOn ? 0.45 : 1 }}>
                  {APPROVAL_TYPES.map(t => {
                    const on = prefs?.approval_required?.[t.id] !== false
                    return (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: PC.ink }}>{t.label}</div>
                          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12, color: PC.inkFaint, marginTop: 1 }}>{t.body}</div>
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
                You can change any of this by just telling me, too.
              </div>
            </Card>
          </>
        )}
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
