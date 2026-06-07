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

// ── Dashboard ────────────────────────────────────────────────────────────────
export default function ParentDashboard() {
  const nav = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [children, setChildren] = useState(_childrenCache || [])
  const [showModal, setShowModal] = useState(false)
  const [familyCode, setFamilyCode] = useState(null)
  const [showQR, setShowQR] = useState(false)
  const [notifData, setNotifData] = useState({ telegramChatId: null, whatsappPhone: null, channel: null })
  const [showTelegramSetup, setShowTelegramSetup] = useState(false)
  const [showWaSetup, setShowWaSetup] = useState(false)
  const [waPhone, setWaPhone] = useState('')
  const [waSending, setWaSending] = useState(false)
  const [waVerifySent, setWaVerifySent] = useState(false)
  const [waError, setWaError] = useState('')
  const [telegramCodeCopied, setTelegramCodeCopied] = useState(false)

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
      .select('family_code, telegram_chat_id, whatsapp_phone, notification_channel')
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
      channel: data?.notification_channel || null,
    })
  }

  const updateChannel = async (ch) => {
    setNotifData(d => ({ ...d, channel: ch }))
    if (user) await supabase.from('parents').update({ notification_channel: ch }).eq('id', user.id)
  }

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

          {/* Telegram */}
          <NotifRow
            icon="✈️"
            label="Telegram"
            connected={!!notifData.telegramChatId}
            status={notifData.telegramChatId ? 'Connected' : 'Not connected'}
            action={!notifData.telegramChatId
              ? <Btn full={false} variant="soft" onClick={() => setShowTelegramSetup(s => !s)} style={{ padding: '8px 13px', fontSize: 13 }}>{showTelegramSetup ? 'Cancel' : 'Connect'}</Btn>
              : notifData.whatsappPhone
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

          {/* WhatsApp */}
          <NotifRow
            icon="💬"
            label="WhatsApp"
            connected={!!notifData.whatsappPhone}
            status={notifData.whatsappPhone ? notifData.whatsappPhone : 'Not connected'}
            action={!notifData.whatsappPhone
              ? <Btn full={false} variant="soft" onClick={() => { setShowWaSetup(s => !s); setWaVerifySent(false); setWaError('') }} style={{ padding: '8px 13px', fontSize: 13 }}>{showWaSetup ? 'Cancel' : 'Add number'}</Btn>
              : notifData.telegramChatId
                ? <button className="tc-press tc-tap" onClick={() => updateChannel('whatsapp')} style={{ background: notifData.channel === 'whatsapp' ? PC.green : PC.greenBg, border: 'none', borderRadius: 10, padding: '7px 12px', fontSize: 12, fontWeight: 700, color: notifData.channel === 'whatsapp' ? '#fff' : PC.green, cursor: 'pointer', fontFamily: FONT }}>{notifData.channel === 'whatsapp' ? '★ Primary' : 'Set primary'}</button>
                : null}
          />

          {showWaSetup && !notifData.whatsappPhone && (
            <div className="tc-fade" style={{ background: PC.greenBg, borderRadius: 15, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, marginTop: -6 }}>
              {waVerifySent ? (
                <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.green, textAlign: 'center' }}>
                  📲 Verification sent! Check your WhatsApp
                </div>
              ) : (
                <>
                  <input
                    type="tel"
                    placeholder="+905XXXXXXXXX"
                    value={waPhone}
                    onChange={e => { setWaPhone(e.target.value); setWaError('') }}
                    className="tc-input"
                  />
                  {waError && <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: PC.danger }}>{waError}</div>}
                  <button
                    disabled={!waPhone.trim() || waSending}
                    onClick={async () => {
                      if (!user) return
                      setWaSending(true); setWaError('')
                      try {
                        const res = await fetch(`${SERVER}/api/verify-whatsapp`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ phoneNumber: waPhone.trim(), parentId: user.id }),
                        })
                        const json = await res.json()
                        if (!res.ok) throw new Error(json.error || 'Server error')
                        setWaVerifySent(true)
                        setNotifData(d => ({ ...d, whatsappPhone: waPhone.trim(), channel: d.channel || 'whatsapp' }))
                      } catch (e) {
                        setWaError(e.message)
                      } finally {
                        setWaSending(false)
                      }
                    }}
                    className="tc-press"
                    style={{ padding: '13px 16px', background: waSending || !waPhone.trim() ? PC.inkFaint : PC.green, border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 800, color: '#fff', cursor: waSending || !waPhone.trim() ? 'not-allowed' : 'pointer', fontFamily: FONT }}>
                    {waSending ? 'Sending…' : 'Connect WhatsApp 📲'}
                  </button>
                </>
              )}
            </div>
          )}
        </Card>
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
