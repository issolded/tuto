import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { hashPin } from '../lib/hash'
import {
  PC, FONT, SHADOW_SM, PCSS,
  TopBar, Btn, Card, Field, Pill, Avatar, BottomSheet, Icon, TaskIcon, SectionHead, PinPad, Confetti, TutoMascot,
} from '../lib/parentUI'

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'

const TASK_LABELS = {
  math:    { label: 'My Math',    type: 'math' },
  reading: { label: 'My Books',   type: 'reading' },
  writing: { label: 'My Stories', type: 'writing' },
  chore:   { label: 'My House',   type: 'chore' },
  story:   { label: 'My Stories', type: 'writing' },
  bonus:   { label: 'Bonus Gift', type: null },
}

const REWARD_EMOJIS = ['🎮','🍦','🎬','🧸','📱','🎁','🏖️','🎨','🚲','⚽','🎤','📚','🍕','🎡','🛹']

function isToday(dateStr) {
  return new Date(dateStr).toDateString() === new Date().toDateString()
}

// Groups a flat pending list into per-local-day buckets (newest day first —
// items already arrive created_at-desc from the backend). Consistent with
// the child-facing MyTree diary grouping, so parent, child, and Telegram all
// agree on what "today" vs. an older pending means.
function groupByDate(items, todayDate) {
  const groups = []
  for (const c of items) {
    const key = c.date || todayDate
    let g = groups.find(g => g.date === key)
    if (!g) { g = { date: key, isToday: key === todayDate, items: [] }; groups.push(g) }
    g.items.push(c)
  }
  return groups
}

// "June 29" style label for a past day's group header (yyyy-MM-dd, local).
function formatGroupDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'long' })
}

// ── Submission card ───────────────────────────────────────────────────────────
function SubmissionCard({ sub, onApprove, onReject, onOpenPhoto }) {
  const meta = TASK_LABELS[sub.task_type] || { label: 'Task', type: null }
  const displayGems = sub.gems_earned ?? sub.suggested_gems ?? 0
  const time = sub.created_at ? new Date(sub.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <Card pad={14} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: meta.type ? PC[meta.type + 'Bg'] : PC.amberBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {meta.type
            ? <TaskIcon type={meta.type} size={22} />
            : <span style={{ fontSize: 20 }}>⭐</span>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: PC.ink }}>{meta.label}</div>
          {sub.task_description && (
            <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 1 }}>{sub.task_description}</div>
          )}
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12, color: PC.inkFaint, marginTop: 2 }}>{time}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: PC.amber }}>+{displayGems} ⭐</div>
          {sub.task_type === 'chore' && sub.suggested_gems != null && (
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 10, color: PC.reading }}>🤖 AI suggested</div>
          )}
        </div>
      </div>
      {(() => {
        // Homework can carry up to 15 pages — show them all, not just the first.
        const photos = sub.photo_urls?.length ? sub.photo_urls : (sub.media_url ? [sub.media_url] : [])
        if (!photos.length) return null
        if (photos.length === 1) {
          return (
            <img src={photos[0]} alt="submission" onClick={() => onOpenPhoto?.(photos, 0)}
              style={{ width: '100%', borderRadius: 12, maxHeight: 200, objectFit: 'cover', cursor: 'zoom-in' }} />
          )
        }
        return (
          <div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {photos.map((url, i) => (
                <img key={url} src={url} alt={`page ${i + 1}`} onClick={() => onOpenPhoto?.(photos, i)}
                  style={{ width: 96, height: 96, flex: '0 0 auto', borderRadius: 12, objectFit: 'cover', cursor: 'zoom-in' }} />
              ))}
            </div>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11.5, color: PC.inkFaint, marginTop: 4 }}>
              {photos.length} pages · tap to enlarge
            </div>
          </div>
        )
      })()}
      {sub.child_note && (
        <div style={{ background: PC.readingBg, borderRadius: 12, padding: '10px 14px', fontFamily: FONT, fontSize: 13, fontWeight: 600, color: PC.reading, lineHeight: 1.4 }}>
          💬 {sub.child_note}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn onClick={onApprove} color={PC.green} style={{ flex: 1, padding: '11px', fontSize: 14 }}>✓ Approve</Btn>
        <Btn onClick={onReject} variant="danger" style={{ flex: 1, padding: '11px', fontSize: 14 }}>✕ Reject</Btn>
      </div>
    </Card>
  )
}

// ── Full-size photo viewer ────────────────────────────────────────────────────
// Tap a submission photo to see the original (the card only shows a cropped
// thumbnail). Arrows page through multi-page homework.
function PhotoLightbox({ urls, index, onClose, onIndex }) {
  const many = urls.length > 1
  const navBtn = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
    background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: 26, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(12,14,20,.93)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <img src={urls[index]} alt={`photo ${index + 1}`} onClick={e => e.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain', borderRadius: 12 }} />
      <button onClick={onClose} aria-label="Close" style={{
        position: 'absolute', top: 14, right: 14, width: 40, height: 40, borderRadius: '50%',
        border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: 18,
      }}>✕</button>
      {many && (
        <>
          <button aria-label="Previous" onClick={e => { e.stopPropagation(); onIndex((index - 1 + urls.length) % urls.length) }}
            style={{ ...navBtn, left: 10 }}>‹</button>
          <button aria-label="Next" onClick={e => { e.stopPropagation(); onIndex((index + 1) % urls.length) }}
            style={{ ...navBtn, right: 10 }}>›</button>
          <div style={{
            position: 'absolute', bottom: 22, left: 0, right: 0, textAlign: 'center',
            fontFamily: FONT, fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,.85)',
          }}>{index + 1} / {urls.length}</div>
        </>
      )}
    </div>
  )
}

// ── Contribution diary card ────────────────────────────────────────────────────
const CONTRIBUTION_DOT_COLORS = {
  self_care: PC.peach,
  household: PC.green,
  family:    PC.teal,
  outside:   PC.amber,
}

function ContributionDateHeader({ isToday, dateStr }) {
  return (
    <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: PC.inkFaint, padding: '2px 2px' }}>
      {isToday ? 'Today' : formatGroupDate(dateStr)}
    </div>
  )
}

function ContributionCard({ c, onApprove, onReject }) {
  return (
    <Card pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: CONTRIBUTION_DOT_COLORS[c.category] || PC.green, flexShrink: 0 }} />
      <div style={{ flex: 1, fontFamily: FONT, fontWeight: 700, fontSize: 14, color: PC.ink }}>{c.label}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="tc-press tc-tap" onClick={onApprove}
          style={{ background: PC.greenBg, color: PC.green, border: 'none', borderRadius: 11, padding: '8px 12px', fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>✓</button>
        <button className="tc-press tc-tap" onClick={onReject}
          style={{ background: PC.dangerBg, color: PC.danger, border: 'none', borderRadius: 11, padding: '8px 12px', fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>✕</button>
      </div>
    </Card>
  )
}

// ── Change PIN sheet ──────────────────────────────────────────────────────────
function ChangePinSheet({ childId, parentId, onClose }) {
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
    <BottomSheet onClose={onClose}>
      {done ? (
        <div style={{ textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 20, color: PC.green, padding: '16px 0' }}>
          PIN updated! ✅
        </div>
      ) : (
        <>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: PC.ink }}>
              {phase === 'enter' ? 'Enter new PIN 🔐' : 'Confirm PIN 🔁'}
            </div>
            <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 4 }}>
              {phase === 'enter' ? 'Choose a 4-digit PIN' : 'Enter the same PIN again'}
            </div>
          </div>
          {errMsg && (
            <div style={{ background: PC.dangerBg, color: PC.danger, borderRadius: 12, padding: '10px 16px', fontFamily: FONT, fontSize: 13, fontWeight: 700, textAlign: 'center' }}>{errMsg}</div>
          )}
          <PinPad value={phase === 'enter' ? pin : confirm} onChange={handleInput} />
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </>
      )}
    </BottomSheet>
  )
}

// ── Edit child sheet ──────────────────────────────────────────────────────────
function EditChildSheet({ child, onClose, onSaved }) {
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

  const isPhoto = avatar instanceof File || (typeof avatar === 'string' && avatar?.startsWith('http'))
  const abtn = (active) => ({
    width: 68, height: 68, borderRadius: '50%',
    border: `2.5px solid ${active ? PC.teal : PC.line}`,
    background: active ? PC.tealBg : PC.field,
    fontSize: 28, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', padding: 0, transition: 'border-color .18s',
  })

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: PC.ink }}>Edit child ✏️</div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
        <button className="tc-press" style={abtn(avatar === '👧')} onClick={() => { setAvatar('👧'); setPreview(null) }}>👧</button>
        <button className="tc-press" style={abtn(avatar === '👦')} onClick={() => { setAvatar('👦'); setPreview(null) }}>👦</button>
        <button className="tc-press" style={abtn(isPhoto)} onClick={() => fileRef.current?.click()}>
          {preview ? <img src={preview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="camera" size={26} color={PC.inkSoft} />}
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      </div>

      <Field label="Name">
        <input className="tc-input" type="text" value={name} onChange={e => { setName(e.target.value); setError('') }} />
      </Field>

      <Field label="Age">
        <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: `1.5px solid ${PC.line}`, borderRadius: 16, padding: '10px 16px', gap: 14 }}>
          <button className="tc-press" onClick={() => setAge(a => Math.max(1, a - 1))} style={{ width: 44, height: 44, borderRadius: 13, background: PC.tealBg, border: 'none', color: PC.tealDeep, fontSize: 22, fontWeight: 700, cursor: 'pointer' }}>−</button>
          <div style={{ flex: 1, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 32, color: PC.ink }}>{age}</div>
          <button className="tc-press" onClick={() => setAge(a => Math.min(18, a + 1))} style={{ width: 44, height: 44, borderRadius: 13, background: PC.tealBg, border: 'none', color: PC.tealDeep, fontSize: 22, fontWeight: 700, cursor: 'pointer' }}>+</button>
        </div>
      </Field>

      {error && <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.danger }}>{error}</div>}
      <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Btn>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
    </BottomSheet>
  )
}

// ── Add reward sheet ──────────────────────────────────────────────────────────
function AddRewardSheet({ childId, onClose, onSaved }) {
  const [icon,   setIcon]   = useState('🎁')
  const [name,   setName]   = useState('')
  const [btCost, setBtCost] = useState(50)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const save = async () => {
    if (!name.trim()) return setError('Give this goal a name.')
    setSaving(true); setError('')
    const { error: dbErr } = await supabase.from('rewards').insert({
      child_id: childId, icon, name: name.trim(), bt_cost: btCost,
    })
    if (dbErr) { setError(dbErr.message); setSaving(false); return }
    onSaved()
  }

  const pct = ((btCost - 5) / (200 - 5)) * 100
  const trackBg = `linear-gradient(to right, ${PC.amber} ${pct}%, ${PC.line} ${pct}%)`

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: PC.ink }}>Add goal 🏆</div>

      <Field label="Icon">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {REWARD_EMOJIS.map(e => (
            <button key={e} className="tc-press" onClick={() => setIcon(e)}
              style={{ width: 42, height: 42, borderRadius: 12, border: `2px solid ${icon === e ? PC.teal : PC.line}`, background: icon === e ? PC.tealBg : '#fff', fontSize: 22, cursor: 'pointer' }}>
              {e}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Goal name">
        <input className="tc-input" type="text" value={name} onChange={e => { setName(e.target.value); setError('') }}
          placeholder="e.g. Roblox time, Ice cream…" />
      </Field>

      <Field label={`Gem cost — ⭐ ${btCost} gems`}>
        <input type="range" min={5} max={200} step={5} value={btCost}
          onChange={e => setBtCost(Number(e.target.value))}
          className="tc-slider" style={{ background: trackBg }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: PC.inkFaint }}>5</span>
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: PC.inkFaint }}>200</span>
        </div>
      </Field>

      {error && <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.danger }}>{error}</div>}
      <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add goal'}</Btn>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
    </BottomSheet>
  )
}

// ── Remove confirm sheet ──────────────────────────────────────────────────────
function RemoveSheet({ child, onClose, onConfirm }) {
  const [removing, setRemoving] = useState(false)

  const doRemove = async () => {
    setRemoving(true)
    await supabase.from('children').delete().eq('id', child.id)
    onConfirm()
  }

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 44 }}>⚠️</div>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: PC.ink }}>Remove {child.name}?</div>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, lineHeight: 1.6 }}>
          This will permanently delete {child.name}'s profile, gems, and all activity. This cannot be undone.
        </div>
      </div>
      <Btn variant="danger" onClick={doRemove} disabled={removing}>
        {removing ? 'Removing…' : `Yes, remove ${child.name}`}
      </Btn>
      <Btn variant="outline" onClick={onClose}>Cancel</Btn>
    </BottomSheet>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ParentChildDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [child, setChild] = useState(null)
  const [gems, setGems] = useState(null)
  const [submissions, setSubmissions] = useState(null)
  const [contributions, setContributions] = useState(null)
  const [contributionsTodayDate, setContributionsTodayDate] = useState(null)
  const [rewards, setRewards] = useState(null)
  const [justApproved, setJustApproved] = useState(false)
  const [lightbox, setLightbox] = useState(null) // { urls, index } — full-size photo viewer
  const [showPinModal,    setShowPinModal]    = useState(false)
  const [showEditModal,   setShowEditModal]   = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [showAddReward,   setShowAddReward]   = useState(false)

  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'pcss-child-detail'
    el.textContent = PCSS
    if (!document.getElementById('pcss-child-detail')) document.head.appendChild(el)
    return () => { document.getElementById('pcss-child-detail')?.remove() }
  }, [])

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('children').select('*').eq('id', id).single(),
      supabase.from('bt_ledger').select('amount').eq('child_id', id),
      supabase.from('submissions').select('*').eq('child_id', id).order('created_at', { ascending: false }),
      supabase.from('rewards').select('*').eq('child_id', id).order('bt_cost'),
      // scope=pending ignores period/month entirely — a pending contribution
      // must stay visible here until approved/rejected, no matter which
      // month it was logged in (see server/index.js for why scope=month
      // would silently drop it once the month rolls over).
      fetch(`${SERVER}/api/contributions?child_id=${id}&scope=pending`).then(r => r.json()),
    ]).then(([{ data: childData }, { data: ledgerData }, { data: subData }, { data: rewardData }, contribData]) => {
      setChild(childData)
      setGems((ledgerData || []).reduce((sum, r) => sum + (r.amount || 0), 0))
      setSubmissions(subData || [])
      setRewards(rewardData || [])
      setContributions(contribData?.contributions || [])
      setContributionsTodayDate(contribData?.todayDate ?? null)
    })
  }, [id])

  const loading = !child || gems === null || submissions === null || rewards === null || contributions === null

  const pending   = (submissions || []).filter(s => s.status === 'pending')
  const todayDone = (submissions || []).filter(s => s.status === 'approved' && isToday(s.created_at))
  // Backend scopes the fetch to status='pending', but approve/reject flip
  // status optimistically in local state — still need this filter so an
  // item disappears from the list the moment it's actioned.
  const pendingContributions = (contributions || []).filter(c => c.status === 'pending')
  const pendingContributionGroups = groupByDate(pendingContributions, contributionsTodayDate)

  async function handleApprove(sub) {
    const earnedGems = sub.gems_earned ?? sub.suggested_gems ?? 30
    await Promise.all([
      supabase.from('submissions').update({ status: 'approved', gems_earned: earnedGems }).eq('id', sub.id),
      supabase.from('bt_ledger').insert({ child_id: id, amount: earnedGems, reason: sub.task_type || 'task' }),
    ])
    setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'approved', gems_earned: earnedGems } : s))
    setGems(prev => (prev ?? 0) + earnedGems)
    setJustApproved(true)
    setTimeout(() => setJustApproved(false), 2200)
  }

  async function handleReject(subId) {
    await supabase.from('submissions').update({ status: 'rejected' }).eq('id', subId)
    setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, status: 'rejected' } : s))
  }

  // Diary approvals never touch bt_ledger — gems for contributions are
  // computed separately in the end-of-month review, by design.
  async function handleApproveContribution(c) {
    await fetch(`${SERVER}/api/contributions/${c.id}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_id: child.parent_id }),
    })
    setContributions(prev => prev.map(x => x.id === c.id ? { ...x, status: 'approved' } : x))
  }

  async function handleRejectContribution(c) {
    await fetch(`${SERVER}/api/contributions/${c.id}/reject`, { method: 'POST' })
    setContributions(prev => prev.map(x => x.id === c.id ? { ...x, status: 'rejected' } : x))
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: PC.bg }}>
      <TutoMascot size={96} color={PC.teal} />
    </div>
  )

  return (
    <div style={{ background: PC.bg, minHeight: '100dvh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column', fontFamily: FONT, position: 'relative' }}>
      {justApproved && <Confetti n={16} />}
      {lightbox && (
        <PhotoLightbox
          urls={lightbox.urls}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndex={i => setLightbox(lb => ({ ...lb, index: i }))}
        />
      )}

      <TopBar
        title={child.name}
        sub={`${child.age} years old`}
        onBack={() => nav('/parent/dashboard', { state: { updatedChild: child } })}
      />

      <div className="tc-scroll" style={{ flex: 1, padding: '4px 20px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* profile card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 2px 0' }}>
          <Avatar child={child} size={62} />
          <div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: PC.ink }}>{child.name}</div>
            <div style={{ marginTop: 6 }}>
              <Pill bg={PC.amberBg} color={PC.amber}>⭐ {gems} gems</Pill>
            </div>
          </div>
        </div>

        {/* pending approvals */}
        <div>
          <SectionHead>
            ⏳ Pending{pending.length > 0 ? ` (${pending.length})` : ''}
          </SectionHead>
          {pending.length === 0 ? (
            <Card pad={14} style={{ textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.inkSoft }}>
              All caught up! ✅
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pending.map(sub => (
                <SubmissionCard key={sub.id} sub={sub} onApprove={() => handleApprove(sub)} onReject={() => handleReject(sub.id)}
                  onOpenPhoto={(urls, index) => setLightbox({ urls, index })} />
              ))}
            </div>
          )}
        </div>

        {/* diary contributions — every open pending, any month, grouped by day */}
        <div>
          <SectionHead>
            🌱 Ev katkıları{pendingContributions.length > 0 ? ` (${pendingContributions.length})` : ''}
          </SectionHead>
          {pendingContributionGroups.length === 0 ? (
            <Card pad={14} style={{ textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.inkSoft }}>
              Bekleyen katkı yok.
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendingContributionGroups.map(g => (
                <div key={g.date} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <ContributionDateHeader isToday={g.isToday} dateStr={g.date} />
                  {g.items.map(c => (
                    <ContributionCard key={c.id} c={c} onApprove={() => handleApproveContribution(c)} onReject={() => handleRejectContribution(c)} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* completed today */}
        <div>
          <SectionHead>✅ Completed today</SectionHead>
          {todayDone.length === 0 ? (
            <Card pad={14} style={{ textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.inkSoft }}>Nothing completed yet today.</Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayDone.map(sub => {
                const meta = TASK_LABELS[sub.task_type] || { label: 'Task', type: null }
                return (
                  <Card key={sub.id} pad={12} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: meta.type ? PC[meta.type + 'Bg'] : PC.amberBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {meta.type ? <TaskIcon type={meta.type} size={20} /> : <span style={{ fontSize: 18 }}>⭐</span>}
                    </div>
                    <div style={{ flex: 1, fontFamily: FONT, fontWeight: 800, fontSize: 14, color: PC.ink }}>{meta.label}</div>
                    <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: PC.green }}>+{sub.gems_earned ?? 0} ⭐</div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* reward goals */}
        <div>
          <SectionHead action={
            <button className="tc-press tc-tap" onClick={() => setShowAddReward(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: PC.amberBg, color: PC.amber, border: 'none', borderRadius: 11, padding: '7px 12px', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              <Icon name="plus" size={14} color={PC.amber} sw={2.4} /> Add
            </button>
          }>🏆 Reward goals</SectionHead>

          {rewards.length === 0 ? (
            <Card pad={14} style={{ textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.inkSoft }}>No reward goals set yet.</Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rewards.map(r => {
                const pct = r.bt_cost > 0 ? Math.min(100, Math.round((gems / r.bt_cost) * 100)) : 0
                const ready = gems >= r.bt_cost
                return (
                  <Card key={r.id} pad={14} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 26 }}>{r.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: PC.ink }}>{r.name}</div>
                        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: PC.amber }}>⭐ {r.bt_cost} gems needed</div>
                      </div>
                      {ready && <span style={{ fontSize: 20 }}>🎉</span>}
                      <button className="tc-press tc-tap" onClick={async () => { await supabase.from('rewards').delete().eq('id', r.id); setRewards(prev => prev.filter(x => x.id !== r.id)) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                        <Icon name="trash" size={18} color={PC.inkFaint} />
                      </button>
                    </div>
                    <div style={{ background: PC.line, borderRadius: 8, height: 7, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: ready ? PC.green : `linear-gradient(90deg, ${PC.teal}, ${PC.peach})`, borderRadius: 8, transition: 'width .6s ease' }} />
                    </div>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: ready ? PC.green : PC.inkSoft }}>
                      {ready ? 'Ready to claim! 🎉' : `${Math.max(0, r.bt_cost - gems)} more gems to go`}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* settings */}
        <div>
          <SectionHead>Settings</SectionHead>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: 'gear',  label: 'Task settings',  sub: 'Adjust gem amounts per task', onClick: () => nav(`/parent/child/${id}/settings`) },
              { icon: 'edit',  label: 'Edit child',      sub: 'Change name, age or avatar',  onClick: () => setShowEditModal(true) },
              { icon: 'lock',  label: 'Change PIN',      sub: 'Set a new 4-digit PIN',        onClick: () => setShowPinModal(true) },
            ].map(({ icon, label, sub, onClick }) => (
              <Card key={label} onClick={onClick} pad={14} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 42, height: 42, borderRadius: 13, background: PC.tealBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={icon} size={21} color={PC.teal} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 15, color: PC.ink }}>{label}</div>
                  <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkSoft, marginTop: 1 }}>{sub}</div>
                </div>
                <Icon name="chevron" size={18} color={PC.inkFaint} />
              </Card>
            ))}

            <button className="tc-press tc-tap" onClick={() => setShowRemoveModal(true)}
              style={{ background: PC.dangerBg, border: 'none', borderRadius: 16, padding: '13px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', marginTop: 2 }}>
              <Icon name="trash" size={18} color={PC.danger} />
              <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: PC.danger }}>Remove child</span>
            </button>
          </div>
        </div>
      </div>

      {showPinModal && child && (
        <ChangePinSheet childId={id} parentId={child.parent_id} onClose={() => setShowPinModal(false)} />
      )}
      {showEditModal && child && (
        <EditChildSheet
          child={child}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => { setChild(updated); setShowEditModal(false) }}
        />
      )}
      {showRemoveModal && child && (
        <RemoveSheet
          child={child}
          onClose={() => setShowRemoveModal(false)}
          onConfirm={() => nav('/parent/dashboard', { state: { removedId: child.id } })}
        />
      )}
      {showAddReward && (
        <AddRewardSheet
          childId={id}
          onClose={() => setShowAddReward(false)}
          onSaved={async () => {
            const { data } = await supabase.from('rewards').select('*').eq('child_id', id).order('bt_cost')
            setRewards(data || [])
            setShowAddReward(false)
          }}
        />
      )}
    </div>
  )
}
