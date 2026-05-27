import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { hashPin } from '../lib/hash'
import TutoMascot from '../components/TutoMascot'

const TASK_LABELS = {
  math:    { label: 'My Math',    emoji: '🔢' },
  reading: { label: 'My Books',   emoji: '📚' },
  writing: { label: 'My Stories', emoji: '✏️' },
  chore:   { label: 'My House',   emoji: '🏠' },
  story:   { label: 'My Stories', emoji: '📖' },
  bonus:   { label: 'Bonus Gift', emoji: '🎁' },
}

function isToday(dateStr) {
  return new Date(dateStr).toDateString() === new Date().toDateString()
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, color: '#2D2D2D', marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  )
}

function EmptyCard({ text }) {
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', fontSize: 13, fontWeight: 700, color: '#7A7A9A', textAlign: 'center' }}>
      {text}
    </div>
  )
}

function SubmissionCard({ sub, onApprove, onReject }) {
  const meta = TASK_LABELS[sub.task_type] || { label: 'Task', emoji: '⭐' }
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 24 }}>{meta.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#2D2D2D' }}>{meta.label}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#B0A090' }}>
            {sub.created_at ? new Date(sub.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#FF6B35' }}>+{sub.gems_earned ?? 0} ⭐</div>
      </div>
      {sub.media_url && (
        <img src={sub.media_url} alt="submission" style={{ width: '100%', borderRadius: 10, maxHeight: 200, objectFit: 'cover' }} />
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onApprove}
          style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 12, background: '#2EC486', color: 'white', fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
        >✓ Approve</button>
        <button
          onClick={onReject}
          style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 12, background: '#FF3B30', color: 'white', fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
        >✕ Reject</button>
      </div>
    </div>
  )
}

// ── Shared bottom-sheet wrapper ───────────────────────────────────────────────
function ModalSheet({ onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: 'white', width: '100%', maxWidth: 430, borderRadius: '32px 32px 0 0', padding: '28px 28px 44px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ width: 40, height: 4, background: '#E8E8F0', borderRadius: 4, alignSelf: 'center', marginBottom: 4 }} />
        {children}
      </div>
    </div>
  )
}

// ── Compact PIN pad ───────────────────────────────────────────────────────────
function PinPad({ value, onChange }) {
  const add = d => { if (value.length < 4) onChange(value + d) }
  const del = () => onChange(value.slice(0, -1))
  const btn = { background: '#FFF0E8', border: 'none', borderRadius: 14, height: 58, fontSize: 20, fontWeight: 800, color: '#2D2D2D', cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ display: 'flex', gap: 14 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: value.length > i ? '#FF6B35' : '#FFE8D4', transition: 'background 0.15s' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, width: '100%', maxWidth: 240 }}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} onClick={() => add(String(n))} style={btn}>{n}</button>
        ))}
        <div />
        <button onClick={() => add('0')} style={btn}>0</button>
        <button onClick={del} style={{ ...btn, fontSize: 16, color: '#FF6B35' }}>⌫</button>
      </div>
    </div>
  )
}

// ── Change PIN modal ──────────────────────────────────────────────────────────
function ChangePinModal({ childId, parentId, onClose }) {
  const [phase, setPhase] = useState('enter')
  const [pin, setPin]     = useState('')
  const [confirm, setConfirm] = useState('')
  const [errMsg, setErrMsg]   = useState('')
  const [done, setDone]       = useState(false)

  const handleInput = (val) => {
    if (phase === 'enter') {
      setPin(val)
      if (val.length === 4) setTimeout(() => setPhase('confirm'), 280)
    } else {
      setConfirm(val)
      if (val.length === 4) {
        if (val === pin) {
          savePin(pin)
        } else {
          setErrMsg("PINs don't match. Try again.")
          setTimeout(() => { setPin(''); setConfirm(''); setPhase('enter'); setErrMsg('') }, 900)
        }
      }
    }
  }

  const savePin = async (newPin) => {
    const pin_hash = await hashPin(newPin)
    if (parentId) {
      const { data: siblings } = await supabase
        .from('children').select('pin_hash').eq('parent_id', parentId).neq('id', childId)
      if (siblings?.some(s => s.pin_hash === pin_hash)) {
        setErrMsg('This PIN is already used by another child. Choose a different one.')
        setTimeout(() => { setPin(''); setConfirm(''); setPhase('enter'); setErrMsg('') }, 1500)
        return
      }
    }
    await supabase.from('children').update({ pin_hash }).eq('id', childId)
    setDone(true)
    setTimeout(onClose, 1400)
  }

  return (
    <ModalSheet onClose={onClose}>
      {done ? (
        <div style={{ textAlign: 'center', fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#2EC486', padding: '16px 0' }}>
          PIN updated! ✅
        </div>
      ) : (
        <>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#2D2D2D' }}>
              {phase === 'enter' ? 'Enter new PIN 🔐' : 'Confirm PIN 🔁'}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#7A7A9A', marginTop: 4 }}>
              {phase === 'enter' ? 'Choose a 4-digit PIN' : 'Enter the same PIN again'}
            </div>
          </div>
          {errMsg && (
            <div style={{ background: '#FFE8E8', color: '#CC0000', borderRadius: 12, padding: '10px 16px', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>{errMsg}</div>
          )}
          <PinPad value={phase === 'enter' ? pin : confirm} onChange={handleInput} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#7A7A9A', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', padding: '4px 0' }}>Cancel</button>
        </>
      )}
    </ModalSheet>
  )
}

// ── Edit Child modal ──────────────────────────────────────────────────────────
function EditChildModal({ child, onClose, onSaved }) {
  const [name, setName] = useState(child.name)
  const [age,  setAge]  = useState(child.age)
  const [avatar, setAvatar] = useState(child.avatar_url || null)
  const [preview, setPreview] = useState(child.avatar_url?.startsWith('http') ? child.avatar_url : null)
  const [saving, setSaving]   = useState(false)
  const [error,  setError]    = useState('')
  const fileRef = useRef(null)

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAvatar(file)
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const save = async () => {
    if (!name.trim()) return setError('Name is required.')
    if (!age || +age < 1 || +age > 18) return setError('Enter a valid age (1–18).')
    setSaving(true); setError('')

    let avatar_url = child.avatar_url
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
    } else if (avatar === '👧' || avatar === '👦') {
      avatar_url = avatar
    }

    const { error: dbErr } = await supabase.from('children').update({ name: name.trim(), age: +age, avatar_url }).eq('id', child.id)
    if (dbErr) { setError(dbErr.message); setSaving(false); return }
    onSaved({ ...child, name: name.trim(), age: +age, avatar_url })
  }

  const abtn = (active) => ({
    width: 68, height: 68, borderRadius: '50%',
    border: `3px solid ${active ? '#FF6B35' : '#FFE8D4'}`,
    background: '#FFF0E8', fontSize: 28, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', padding: 0, transition: 'border-color 0.2s',
  })
  const isPhoto = avatar instanceof File || (typeof avatar === 'string' && avatar?.startsWith('http'))

  return (
    <ModalSheet onClose={onClose}>
      <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#2D2D2D' }}>Edit Child ✏️</div>

      {/* Avatar picker */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
        <button style={abtn(avatar === '👧')} onClick={() => { setAvatar('👧'); setPreview(null) }}>👧</button>
        <button style={abtn(avatar === '👦')} onClick={() => { setAvatar('👦'); setPreview(null) }}>👦</button>
        <button style={abtn(isPhoto)} onClick={() => fileRef.current?.click()}>
          {preview ? <img src={preview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📷'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      </div>

      {/* Name */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#FF6B35', letterSpacing: '0.8px', marginBottom: 6 }}>NAME</div>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          style={{ width: '100%', padding: '12px 16px', border: '2px solid #FFE8D4', borderRadius: 14, fontSize: 15, fontFamily: 'Nunito, sans-serif', fontWeight: 700, color: '#2D2D2D', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Age */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#FF6B35', letterSpacing: '0.8px', marginBottom: 6 }}>AGE</div>
        <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '2px solid #FFE8D4', borderRadius: 14, padding: '8px 14px', gap: 12 }}>
          <button onClick={() => setAge(a => Math.max(1, a - 1))} style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF0E8', border: 'none', fontSize: 20, fontWeight: 800, color: '#FF6B35', cursor: 'pointer' }}>−</button>
          <div style={{ flex: 1, textAlign: 'center', fontFamily: "'Baloo 2', cursive", fontSize: 28, fontWeight: 900, color: '#2D2D2D' }}>{age}</div>
          <button onClick={() => setAge(a => Math.min(18, a + 1))} style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF0E8', border: 'none', fontSize: 20, fontWeight: 800, color: '#FF6B35', cursor: 'pointer' }}>+</button>
        </div>
      </div>

      {error && <div style={{ color: '#FF6B35', fontSize: 13, fontWeight: 700 }}>{error}</div>}
      <button onClick={save} disabled={saving}
        style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 16, background: '#FF6B35', color: 'white', fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
      <button onClick={onClose}
        style={{ width: '100%', padding: '10px', border: 'none', borderRadius: 16, background: 'none', color: '#7A7A9A', fontFamily: 'Nunito, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        Cancel
      </button>
    </ModalSheet>
  )
}

// ── Remove Child modal ────────────────────────────────────────────────────────
function RemoveConfirmModal({ child, onClose, onConfirm }) {
  const [removing, setRemoving] = useState(false)

  const doRemove = async () => {
    setRemoving(true)
    await supabase.from('children').delete().eq('id', child.id)
    onConfirm()
  }

  return (
    <ModalSheet onClose={onClose}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 44 }}>⚠️</div>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#2D2D2D' }}>Remove {child.name}?</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#7A7A9A', lineHeight: 1.6 }}>
          This will permanently delete {child.name}'s profile, gems, and all activity. This cannot be undone.
        </div>
      </div>
      <button onClick={doRemove} disabled={removing}
        style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 16, background: '#FF3B30', color: 'white', fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, cursor: removing ? 'not-allowed' : 'pointer' }}>
        {removing ? 'Removing...' : `Yes, remove ${child.name}`}
      </button>
      <button onClick={onClose}
        style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 16, background: '#F5F5F5', color: '#7A7A9A', fontFamily: 'Nunito, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        Cancel
      </button>
    </ModalSheet>
  )
}

export default function ParentChildDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [child, setChild] = useState(null)
  const [gems, setGems] = useState(null)
  const [submissions, setSubmissions] = useState(null)
  const [rewards, setRewards] = useState(null)
  const [showPinModal,    setShowPinModal]    = useState(false)
  const [showEditModal,   setShowEditModal]   = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('children').select('*').eq('id', id).single(),
      supabase.from('bt_ledger').select('amount').eq('child_id', id),
      supabase.from('submissions').select('*').eq('child_id', id).order('created_at', { ascending: false }),
      supabase.from('rewards').select('*').eq('child_id', id).order('gems'),
    ]).then(([{ data: childData }, { data: ledgerData }, { data: subData }, { data: rewardData }]) => {
      setChild(childData)
      setGems((ledgerData || []).reduce((sum, r) => sum + (r.amount || 0), 0))
      setSubmissions(subData || [])
      setRewards(rewardData || [])
    })
  }, [id])

  const loading = !child || gems === null || submissions === null || rewards === null

  const pending   = (submissions || []).filter(s => s.status === 'pending')
  const todayDone = (submissions || []).filter(s => s.status === 'approved' && isToday(s.created_at))

  async function handleApprove(sub) {
    await Promise.all([
      supabase.from('submissions').update({ status: 'approved' }).eq('id', sub.id),
      supabase.from('bt_ledger').insert({ child_id: id, amount: sub.gems_earned ?? 30, reason: sub.task_type || 'task' }),
    ])
    setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'approved' } : s))
    setGems(prev => (prev ?? 0) + (sub.gems_earned ?? 30))
  }

  async function handleReject(subId) {
    await supabase.from('submissions').update({ status: 'rejected' }).eq('id', subId)
    setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, status: 'rejected' } : s))
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#FFF8F0' }}>
      <TutoMascot size={100} />
    </div>
  )

  return (
    <div style={{ background: '#FFF8F0', minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: '#FF6B35', padding: '52px 24px 28px', borderRadius: '0 0 32px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <button
            onClick={() => nav('/parent/dashboard', { state: { updatedChild: child } })}
            style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >←</button>
          <div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, fontWeight: 900, color: 'white', lineHeight: 1.1 }}>{child.name}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{child.age} years old</div>
          </div>
        </div>

        {/* Gem balance */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.25)', borderRadius: 20, padding: '8px 18px' }}>
          <span style={{ fontSize: 20 }}>⭐</span>
          <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: 'white' }}>{gems} Gems</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '24px 20px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Pending approvals */}
        <Section title={`⏳ Pending Approvals${pending.length > 0 ? ` (${pending.length})` : ''}`}>
          {pending.length === 0 ? (
            <EmptyCard text="No pending tasks — all caught up! ✅" />
          ) : (
            pending.map(sub => (
              <SubmissionCard
                key={sub.id}
                sub={sub}
                onApprove={() => handleApprove(sub)}
                onReject={() => handleReject(sub.id)}
              />
            ))
          )}
        </Section>

        {/* Today's completed tasks */}
        <Section title="✅ Completed Today">
          {todayDone.length === 0 ? (
            <EmptyCard text="Nothing completed yet today." />
          ) : (
            todayDone.map(sub => {
              const meta = TASK_LABELS[sub.task_type] || { label: 'Task', emoji: '⭐' }
              return (
                <div key={sub.id} style={{ background: 'white', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <span style={{ fontSize: 22 }}>{meta.emoji}</span>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 800, color: '#2D2D2D' }}>{meta.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#2EC486' }}>+{sub.gems_earned ?? 0} ⭐</div>
                </div>
              )
            })
          )}
        </Section>

        {/* Reward goals */}
        <Section title="🏆 Reward Goals">
          {rewards.length === 0 ? (
            <EmptyCard text="No reward goals set yet." />
          ) : (
            rewards.map(r => {
              const pct = r.gems > 0 ? Math.min(100, Math.round((gems / r.gems) * 100)) : 0
              const ready = gems >= r.gems
              return (
                <div key={r.id} style={{ background: 'white', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 26 }}>{r.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#2D2D2D' }}>{r.name}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#C8900A' }}>⭐ {r.gems} gems needed</div>
                    </div>
                    {ready && <span style={{ fontSize: 20 }}>🎉</span>}
                  </div>
                  <div style={{ background: '#F5F0D0', borderRadius: 8, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: ready ? '#2EC486' : 'linear-gradient(90deg, #FF6B35, #FFD93D)', borderRadius: 8, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: ready ? '#2EC486' : '#7A7A9A' }}>
                    {ready ? 'Ready to claim! 🎉' : `${Math.max(0, r.gems - gems)} more gems to go`}
                  </div>
                </div>
              )
            })
          )}
        </Section>

        {/* Settings group */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { icon: '⚙️', label: 'Task Settings',  sub: 'Adjust gem amounts per task',  onClick: () => nav(`/parent/child/${id}/settings`) },
            { icon: '✏️', label: 'Edit Child',      sub: 'Change name, age or avatar',   onClick: () => setShowEditModal(true) },
            { icon: '🔐', label: 'Change PIN',      sub: 'Set a new 4-digit PIN',         onClick: () => setShowPinModal(true) },
          ].map(({ icon, label, sub, onClick }) => (
            <button key={label} onClick={onClick}
              style={{ background: 'white', border: '2px solid #FFD3C2', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', width: '100%' }}
            >
              <span style={{ fontSize: 22 }}>{icon}</span>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: '#2D2D2D' }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#7A7A9A', marginTop: 2 }}>{sub}</div>
              </div>
              <span style={{ fontSize: 18, color: '#C0C0D0' }}>›</span>
            </button>
          ))}

          {/* Remove Child — separate, red */}
          <button onClick={() => setShowRemoveModal(true)}
            style={{ background: 'none', border: '2px solid #FFD0CC', borderRadius: 16, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}
          >
            <span style={{ fontSize: 16 }}>🗑️</span>
            <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 14, fontWeight: 800, color: '#FF3B30' }}>Remove Child</span>
          </button>
        </div>
      </div>

      {showPinModal && child && (
        <ChangePinModal childId={id} parentId={child.parent_id} onClose={() => setShowPinModal(false)} />
      )}
      {showEditModal && child && (
        <EditChildModal
          child={child}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => { setChild(updated); setShowEditModal(false) }}
        />
      )}
      {showRemoveModal && child && (
        <RemoveConfirmModal
          child={child}
          onClose={() => setShowRemoveModal(false)}
          onConfirm={() => nav('/parent/dashboard', { state: { removedId: child.id } })}
        />
      )}
    </div>
  )
}
