import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { hashPin } from '../lib/hash'

const PRP = '#7C5CBF'

let _childrenCache = null

function AddChildModal({ parentId, siblings = [], onClose, onSaved }) {
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [avatar, setAvatar] = useState(null)       // 'girl' | 'boy' | File
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

  const btnStyle = (active) => ({
    width: 72, height: 72, borderRadius: '50%', border: `3px solid ${active ? PRP : '#E8E0FF'}`,
    background: '#F5F0FF', fontSize: 30, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', padding: 0, transition: 'border-color 0.2s',
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'white', width: '100%', maxWidth: 430, borderRadius: '32px 32px 0 0', padding: '32px 28px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Handle */}
        <div style={{ width: 40, height: 4, background: '#E8E8F0', borderRadius: 4, alignSelf: 'center', marginBottom: 4 }} />

        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#2D2D2D' }}>Add Child 🧒</div>

        {/* Avatar picker */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
          <button style={btnStyle(avatar === 'girl')} onClick={() => { setAvatar('girl'); setAvatarPreview(null) }}>
            👧
          </button>
          <button style={btnStyle(avatar === 'boy')} onClick={() => { setAvatar('boy'); setAvatarPreview(null) }}>
            👦
          </button>
          <button style={btnStyle(avatar instanceof File)} onClick={() => fileRef.current?.click()}>
            {avatarPreview
              ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : '📷'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>

        <div className="input-wrap">
          <label>Child's Name</label>
          <input type="text" placeholder="e.g. Emma" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="input-wrap">
          <label>Age</label>
          <input type="number" placeholder="8" min="1" max="18" value={age} onChange={e => setAge(e.target.value)} />
        </div>

        <div className="input-wrap">
          <label>4-Digit PIN</label>
          <input
            type="password"
            placeholder="••••"
            maxLength={4}
            inputMode="numeric"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </div>

        {error && <div style={{ color: '#FF6B35', fontSize: 14, fontWeight: 700 }}>{error}</div>}

        <button className="btn btn-orange" onClick={save} disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </button>
        <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
      </div>
    </div>
  )
}


function ChildCard({ child, onClick }) {
  const fallback = ['🧒', '👦', '👧', '🧑'][child.name.charCodeAt(0) % 4]
  const isPhoto = child.avatar_url?.startsWith('http')
  return (
    <div
      onClick={onClick}
      style={{ background: 'white', borderRadius: 20, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', cursor: 'pointer' }}
    >
      <div style={{ width: 52, height: 52, borderRadius: 16, background: '#FFF0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, overflow: 'hidden', flexShrink: 0 }}>
        {isPhoto
          ? <img src={child.avatar_url} alt={child.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (child.avatar_url || fallback)}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#2D2D2D' }}>{child.name}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#7A7A9A', marginTop: 2 }}>{child.age} years old</div>
      </div>
      <span style={{ fontSize: 18, color: '#C0C0D0' }}>›</span>
    </div>
  )
}

export default function ParentDashboard() {
  const nav = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [children, setChildren] = useState(_childrenCache || [])
  const [showModal, setShowModal] = useState(false)
  const [familyCode, setFamilyCode] = useState(null)

  const updateChildren = (next) => {
    _childrenCache = next
    setChildren(next)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (!user) return

      loadFamilyCode(user.id)

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

  const loadFamilyCode = async (uid) => {
    const { data } = await supabase
      .from('parents')
      .select('family_code')
      .eq('id', uid)
      .single()

    if (data?.family_code) {
      setFamilyCode(data.family_code)
    } else {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase()
      await supabase.from('parents').update({ family_code: code }).eq('id', uid)
      setFamilyCode(code)
    }
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

  const displayName = user?.user_metadata?.full_name || user?.email || 'Ebeveyn'

  return (
    <div className="screen" style={{ background: '#FFF8F0' }}>
      {/* Header */}
      <div style={{ background: '#FF6B35', padding: '56px 28px 36px', borderRadius: '0 0 40px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Welcome 👋</div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, fontWeight: 800, color: 'white', lineHeight: 1.2 }}>{displayName}</div>
          </div>
          <button
            onClick={logout}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 12, padding: '10px 16px', color: 'white', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', whiteSpace: 'nowrap' }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#2D2D2D' }}>My Children</div>
          {children.length > 0 && (
            <button
              onClick={() => setShowModal(true)}
              style={{ background: '#FF6B35', border: 'none', borderRadius: 12, padding: '8px 14px', color: 'white', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}
            >
              + Add Child
            </button>
          )}
        </div>

        {children.length === 0 ? (
          <>
            <div style={{ background: 'white', borderRadius: 24, padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '2px dashed #FFD3C2' }}>
              <div style={{ fontSize: 52 }}>🧒</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#2D2D2D' }}>No children added yet</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#7A7A9A', textAlign: 'center' }}>Add your child to start the learning journey.</div>
            </div>
            <button className="btn btn-orange" onClick={() => setShowModal(true)}>+ Add First Child</button>
          </>
        ) : (
          children.map(child => <ChildCard key={child.id} child={child} onClick={() => nav(`/parent/child/${child.id}`)} />)
        )}

        {/* Setup Child Device */}
        {familyCode && (
          <div style={{ background: 'white', borderRadius: 24, padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginTop: 8 }}>
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>📱</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#2D2D2D' }}>Setup Child Device</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#7A7A9A', marginTop: 2 }}>Scan this QR code on your child's device</div>
              </div>
            </div>

            <div style={{ background: '#FAFAFA', borderRadius: 16, padding: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <QRCodeSVG
                value={`https://tuto-blue.vercel.app/setup?code=${familyCode}`}
                size={200}
                bgColor="#FAFAFA"
                fgColor="#1A1A2E"
                level="M"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ background: '#F5F0FF', borderRadius: 10, padding: '6px 14px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#6C63FF', letterSpacing: 2 }}>
                  {familyCode}
                </span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#7A7A9A' }}>manual code</div>
            </div>

            {children.length > 1 && (
              <p style={{ fontSize: 13, color: '#9999AA', fontStyle: 'italic', textAlign: 'center', marginTop: 8 }}>
                "Scan this on any device. Each child signs in with their own PIN."
              </p>
            )}
          </div>
        )}

      </div>

      {showModal && user && (
        <AddChildModal
          parentId={user.id}
          siblings={children}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
