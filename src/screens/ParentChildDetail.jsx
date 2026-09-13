import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { hashPin } from '../lib/hash'
import { useT, useUiLang } from '../lib/parentI18n'
import { usePhotoCrop } from '../components/usePhotoCrop'
import { downscale } from '../lib/image'
import { t as childT, localeFor } from '../lib/i18n'
import {
  PC, FONT, SHADOW_SM, PCSS,
  TopBar, Btn, Card, Field, Pill, Avatar, BottomSheet, Icon, TaskIcon, SectionHead, PinPad, Confetti, TutoMascot,
} from '../lib/parentUI'
import { TreeArt } from '../components/TreeArt'

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'

// The label is the CHILD's own tile name — read from the child dictionary, in the parent's
// language, so both are looking at the same word for the same activity. `bonus` is the one
// row with no tile behind it, so it carries a parent key instead.
const TASK_LABELS = {
  math:     { key: 'task_math',     type: 'math' },
  reading:  { key: 'task_reading',  type: 'reading' },
  writing:  { key: 'task_writing',  type: 'writing' },
  story:    { key: 'task_writing',  type: 'writing' },
  homework: { key: 'task_homework', type: null },
  drawing:  { key: 'task_drawing',  type: null },
  bonus:    { parentKey: 'cd_bonus', type: null },
}

// Resolves one of those rows against whichever dictionary it points at.
function taskLabel(taskType, lang, s) {
  const meta = TASK_LABELS[taskType]
  if (!meta) return taskType || s('cd_task')
  return meta.parentKey ? s(meta.parentKey) : childT(meta.key, lang)
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
function formatGroupDate(dateStr, lang) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'long' })
}

// ── Submission card ───────────────────────────────────────────────────────────
function SubmissionCard({ sub, photos = [], onApprove, onReject, onOpenPhoto }) {
  const s = useT()
  const lang = useUiLang()
  const meta = TASK_LABELS[sub.task_type] || { type: null }
  const label = taskLabel(sub.task_type, lang, s)
  const displayGems = sub.gems_earned ?? sub.suggested_gems ?? 0
  const time = sub.created_at ? new Date(sub.created_at).toLocaleTimeString(localeFor(lang), { hour: '2-digit', minute: '2-digit' }) : ''

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
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: PC.ink }}>{label}</div>
          {sub.task_description && (
            <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 1 }}>{sub.task_description}</div>
          )}
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12, color: PC.inkFaint, marginTop: 2 }}>{time}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: PC.amber }}>+{displayGems} ⭐</div>
        </div>
      </div>
      {(() => {
        // Photos arrive as short-lived signed URLs (private bucket), fetched by
        // the parent screen. Homework can carry up to 15 pages — show them all.
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
              {s('cd_pages_tap', { n: photos.length })}
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
        <Btn onClick={onApprove} color={PC.green} style={{ flex: 1, padding: '11px', fontSize: 14 }}>{s('cd_approve')}</Btn>
        <Btn onClick={onReject} variant="danger" style={{ flex: 1, padding: '11px', fontSize: 14 }}>{s('cd_reject')}</Btn>
      </div>
    </Card>
  )
}

// ── Drawings ──────────────────────────────────────────────────────────────────
// My Drawings rewards instantly with no approval, so there is nothing here for
// the parent to action — this is the transparency half: whatever the child
// photographed, the parent can see. Photos arrive as signed URLs from the
// server (the bucket is private and has no client read policy).
function PaintingsCard({ paintings, name, onOpenPhoto, onApprove, onReject }) {
  const s = useT()
  if (!paintings?.length) return null
  const pending = paintings.filter(p => p.status === 'pending')
  const settled = paintings.filter(p => p.status !== 'pending')
  const urls = paintings.map(p => p.photo).filter(Boolean)

  return (
    <div>
      <SectionHead>
        {s('cd_drawings_of', { name })}{pending.length > 0 ? s('cd_awaiting', { n: pending.length }) : ''}
      </SectionHead>

      {/* Pending ones get the full photo and the decision, because approving is
          what actually pays the reward. */}
      {pending.map(p => (
        <Card key={p.id} pad={12} style={{ marginBottom: 10 }}>
          {p.photo && (
            <img src={p.photo} alt="" onClick={() => onOpenPhoto([p.photo], 0)}
              style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, cursor: 'pointer', display: 'block' }} />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <div style={{ flex: 1, fontFamily: FONT, fontWeight: 700, fontSize: 13.5, color: PC.ink }}>
              {p.drawing_id || s('cd_own_idea')}
            </div>
            <button className="tc-press tc-tap" onClick={() => onApprove(p)}
              style={{ background: PC.greenBg, color: PC.green, border: 'none', borderRadius: 11, padding: '8px 14px', fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>✓</button>
            <button className="tc-press tc-tap" onClick={() => onReject(p)}
              style={{ background: PC.dangerBg, color: PC.danger, border: 'none', borderRadius: 11, padding: '8px 14px', fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>✕</button>
          </div>
        </Card>
      ))}

      {settled.length > 0 && (
        <Card pad={12}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {settled.slice(0, 9).map(p => (
              <button key={p.id} onClick={() => onOpenPhoto(urls, urls.indexOf(p.photo))}
                style={{ border: 'none', padding: 0, background: 'none', cursor: p.photo ? 'pointer' : 'default' }}>
                {p.photo
                  ? <img src={p.photo} alt="" loading="lazy"
                      style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10, display: 'block', opacity: p.status === 'rejected' ? .45 : 1 }} />
                  : <div style={{ width: '100%', aspectRatio: '1', borderRadius: 10, background: PC.line }} />}
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 10.5, marginTop: 3, color: p.reward_amount > 0 ? PC.amber : PC.inkFaint }}>
                  {p.status === 'rejected' ? s('cd_rejected') : p.reward_amount > 0 ? `⭐ +${p.reward_amount}` : s('cd_approved')}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Tree state ────────────────────────────────────────────────────────────────
// The parent had no way to see the tree at all — it only existed on the child's
// screen, so "how is the tree doing?" could only be asked of Tuto. Reads the
// same /api/tree the child does, so all three surfaces agree.
function TreeCard({ tree, name }) {
  const s = useT()
  if (!tree) return null
  const dayFull = tree.dayFull || 4
  const today = tree.today || 0
  const days = (tree.monthForest || []).length
  const trees = tree.monthTreeCount || 0

  return (
    <div>
      <SectionHead>{s('cd_tree_of', { name })}</SectionHead>
      <Card pad={14}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <TreeArt size={78} fruits={today} target={dayFull} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 15, color: PC.ink }}>
              {today >= dayFull
                ? s('cd_tree_full')
                : s('cd_tree_today', { n: today, total: dayFull })}
            </div>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12.5, color: PC.inkSoft, marginTop: 4 }}>
              {s('cd_tree_month', { days, trees })}
            </div>
            {/* a leaf grows only on approval — say so where the pending list is */}
            <div style={{ marginTop: 8 }}>
              <Pill bg={PC.greenBg} color={PC.green}>🌱 {s('cd_leaves_month', { n: tree.monthLeafCount ?? 0 })}</Pill>
            </div>
          </div>
        </div>
        {days > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 12 }}>
            {tree.monthForest.map(d => (
              <TreeArt key={d.date} size={20} fruits={d.count} target={dayFull} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Full-size photo viewer ────────────────────────────────────────────────────
// Tap a submission photo to see the original (the card only shows a cropped
// thumbnail). Arrows page through multi-page homework.
function PhotoLightbox({ urls, index, onClose, onIndex }) {
  const s = useT()
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
      <button onClick={onClose} aria-label={s('a_close')} style={{
        position: 'absolute', top: 14, right: 14, width: 40, height: 40, borderRadius: '50%',
        border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: 18,
      }}>✕</button>
      {many && (
        <>
          <button aria-label={s('cd_prev')} onClick={e => { e.stopPropagation(); onIndex((index - 1 + urls.length) % urls.length) }}
            style={{ ...navBtn, left: 10 }}>‹</button>
          <button aria-label={s('a_next')} onClick={e => { e.stopPropagation(); onIndex((index + 1) % urls.length) }}
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
  const s = useT()
  const lang = useUiLang()
  return (
    <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: PC.inkFaint, padding: '2px 2px' }}>
      {isToday ? s('cd_today') : formatGroupDate(dateStr, lang)}
    </div>
  )
}

function ContributionCard({ c, photo, onApprove, onReject, onOpenPhoto }) {
  return (
    <Card pad={14} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: CONTRIBUTION_DOT_COLORS[c.category] || PC.green, flexShrink: 0 }} />
        <div style={{ flex: 1, fontFamily: FONT, fontWeight: 700, fontSize: 14, color: PC.ink }}>{c.label}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="tc-press tc-tap" onClick={onApprove}
            style={{ background: PC.greenBg, color: PC.green, border: 'none', borderRadius: 11, padding: '8px 12px', fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>✓</button>
          <button className="tc-press tc-tap" onClick={onReject}
            style={{ background: PC.dangerBg, color: PC.danger, border: 'none', borderRadius: 11, padding: '8px 12px', fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>✕</button>
        </div>
      </div>
      {/* The child can attach a photo — the parent decides with it in front of
          them, instead of having to go find it on Telegram. */}
      {photo && (
        <img src={photo} alt="" onClick={() => onOpenPhoto([photo], 0)}
          style={{ width: '100%', maxHeight: 190, objectFit: 'cover', borderRadius: 12, cursor: 'pointer' }} />
      )}
    </Card>
  )
}

// ── Change PIN sheet ──────────────────────────────────────────────────────────
function ChangePinSheet({ childId, parentId, onClose }) {
  const s = useT()
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
          setErrMsg(s('cd_pin_mismatch'))
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
        setErrMsg(s('db_err_pin_dupe'))
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
          {s('cd_pin_updated')}
        </div>
      ) : (
        <>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: PC.ink }}>
              {phase === 'enter' ? s('cd_pin_new') : s('cd_pin_confirm')}
            </div>
            <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, marginTop: 4 }}>
              {phase === 'enter' ? s('cd_pin_new_b') : s('cd_pin_again')}
            </div>
          </div>
          {errMsg && (
            <div style={{ background: PC.dangerBg, color: PC.danger, borderRadius: 12, padding: '10px 16px', fontFamily: FONT, fontSize: 13, fontWeight: 700, textAlign: 'center' }}>{errMsg}</div>
          )}
          <PinPad value={phase === 'enter' ? pin : confirm} onChange={handleInput} />
          <Btn variant="ghost" onClick={onClose}>{s('cancel')}</Btn>
        </>
      )}
    </BottomSheet>
  )
}

// ── Edit child sheet ──────────────────────────────────────────────────────────
function EditChildSheet({ child, onClose, onSaved }) {
  const s = useT()
  const [name, setName] = useState(child.name)
  const [age,  setAge]  = useState(child.age)
  const [avatar, setAvatar] = useState(child.avatar_url || null)
  const [preview, setPreview] = useState(child.avatar_url?.startsWith('http') ? child.avatar_url : null)
  const [saving, setSaving]   = useState(false)
  const [error,  setError]    = useState('')
  const fileRef = useRef(null)

  // Square: see the same wiring in ParentDashboard's AddChildSheet. The avatar is only ever
  // drawn in a square box, so the frame is chosen here rather than by object-fit.
  const { offerPhoto, cropNode } = usePhotoCrop({
    translate: s,
    inputRef: fileRef,
    accent: PC.teal,
    ratio: 1,
    onReady: blob => {
      setAvatar(blob)
      const reader = new FileReader()
      reader.onload = ev => setPreview(ev.target.result)
      reader.readAsDataURL(blob)
    },
  })

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (file) offerPhoto(file)
    e.target.value = ''
  }

  const save = async () => {
    if (!name.trim()) return setError(s('db_err_name'))
    if (!age || +age < 1 || +age > 18) return setError(s('db_err_age'))
    setSaving(true); setError('')

    let avatar_url = child.avatar_url
    if (avatar instanceof Blob) {
      try {
        const shrunk = await downscale(avatar, 512).catch(() => avatar)
        const ext = (shrunk.type || 'image/jpeg').split('/')[1] || 'jpg'
        const path = `avatars/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage.from('submissions').upload(path, shrunk, { upsert: true })
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

  const isPhoto = avatar instanceof Blob || (typeof avatar === 'string' && avatar?.startsWith('http'))
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
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: PC.ink }}>{s('cd_edit_child')}</div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
        <button className="tc-press" style={abtn(avatar === '👧')} onClick={() => { setAvatar('👧'); setPreview(null) }}>👧</button>
        <button className="tc-press" style={abtn(avatar === '👦')} onClick={() => { setAvatar('👦'); setPreview(null) }}>👦</button>
        <button className="tc-press" style={abtn(isPhoto)} onClick={() => fileRef.current?.click()}>
          {preview ? <img src={preview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="camera" size={26} color={PC.inkSoft} />}
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      </div>

      <Field label={s('cd_name')}>
        <input className="tc-input" type="text" value={name} onChange={e => { setName(e.target.value); setError('') }} />
      </Field>

      <Field label={s('db_age')}>
        <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: `1.5px solid ${PC.line}`, borderRadius: 16, padding: '10px 16px', gap: 14 }}>
          <button className="tc-press" onClick={() => setAge(a => Math.max(1, a - 1))} style={{ width: 44, height: 44, borderRadius: 13, background: PC.tealBg, border: 'none', color: PC.tealDeep, fontSize: 22, fontWeight: 700, cursor: 'pointer' }}>−</button>
          <div style={{ flex: 1, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 32, color: PC.ink }}>{age}</div>
          <button className="tc-press" onClick={() => setAge(a => Math.min(18, a + 1))} style={{ width: 44, height: 44, borderRadius: 13, background: PC.tealBg, border: 'none', color: PC.tealDeep, fontSize: 22, fontWeight: 700, cursor: 'pointer' }}>+</button>
        </div>
      </Field>

      {error && <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.danger }}>{error}</div>}
      <Btn onClick={save} disabled={saving}>{saving ? s('saving') : s('cd_save_changes')}</Btn>
      <Btn variant="ghost" onClick={onClose}>{s('cancel')}</Btn>
      {cropNode}
    </BottomSheet>
  )
}

// ── Add reward sheet ──────────────────────────────────────────────────────────
// A gem grant with no task behind it — parent's own call, no pending item
// needed. Same endpoint the Telegram agent's gift_gems tool calls, so a
// parent can do this from whichever surface is at hand.
function GiftGemsSheet({ childId, childName, onClose, onGifted }) {
  const s = useT()
  const [amount, setAmount] = useState(50)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    setSending(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setError(s('cd_session_expired')); setSending(false); return }
    try {
      const res = await fetch(`${SERVER}/api/children/${childId}/gift-gems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, note: note.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Server error ${res.status}`)
      onGifted(data.amount)
    } catch (err) {
      setError(err.message)
      setSending(false)
    }
  }

  const pct = ((amount - 5) / (500 - 5)) * 100
  const trackBg = `linear-gradient(to right, ${PC.amber} ${pct}%, ${PC.line} ${pct}%)`

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: PC.ink }}>{s('cd_gift')}</div>
      <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13.5, color: PC.inkSoft, marginTop: -8 }}>
        {s('cd_gift_b', { name: childName })}
      </div>

      <Field label={s('cd_amount', { n: amount })}>
        <input type="range" min={5} max={500} step={5} value={amount}
          onChange={e => setAmount(Number(e.target.value))}
          className="tc-slider" style={{ background: trackBg }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: PC.inkFaint }}>5</span>
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: PC.inkFaint }}>500</span>
        </div>
      </Field>

      <Field label={s('cd_reason')}>
        <input className="tc-input" type="text" value={note} onChange={e => setNote(e.target.value)}
          placeholder={s('cd_reason_gift_ph')} maxLength={80} />
      </Field>

      {error && <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.danger }}>{error}</div>}
      <Btn onClick={send} disabled={sending}>{sending ? s('cd_sending') : s('cd_send_n', { n: amount })}</Btn>
      <Btn variant="ghost" onClick={onClose}>{s('cancel')}</Btn>
    </BottomSheet>
  )
}

// For when a parent already handled the reward outside the app (bought the
// toy, gave the screen time themselves) and the balance should reflect it
// without the child ever tapping Claim. Note is optional — shows in the
// child's gem history in place of the generic label when given.
function DeductGemsSheet({ childId, childName, currentGems, onClose, onDeducted }) {
  const s = useT()
  const [amount, setAmount] = useState(50)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    setSending(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setError(s('cd_session_expired')); setSending(false); return }
    try {
      const res = await fetch(`${SERVER}/api/children/${childId}/deduct-gems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, note: note.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Server error ${res.status}`)
      onDeducted(data.amount)
    } catch (err) {
      setError(err.message)
      setSending(false)
    }
  }

  const max = Math.max(5, currentGems)
  const pct = ((amount - 5) / (max - 5 || 1)) * 100
  const trackBg = `linear-gradient(to right, ${PC.danger} ${pct}%, ${PC.line} ${pct}%)`

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: PC.ink }}>{s('cd_deduct')}</div>
      <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13.5, color: PC.inkSoft, marginTop: -8 }}>
        {s('cd_deduct_b')}
      </div>

      <Field label={s('cd_amount_avail', { n: amount, have: currentGems })}>
        <input type="range" min={5} max={max} step={5} value={Math.min(amount, max)}
          onChange={e => setAmount(Number(e.target.value))}
          className="tc-slider" style={{ background: trackBg }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: PC.inkFaint }}>5</span>
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: PC.inkFaint }}>{max}</span>
        </div>
      </Field>

      <Field label={s('cd_reason')}>
        <input className="tc-input" type="text" value={note} onChange={e => setNote(e.target.value)}
          placeholder={s('cd_reason_ded_ph')} maxLength={80} />
      </Field>

      {error && <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.danger }}>{error}</div>}
      <Btn onClick={send} disabled={sending || currentGems < 5} variant="danger">{sending ? s('cd_removing') : s('cd_remove_n', { n: Math.min(amount, max) })}</Btn>
      <Btn variant="ghost" onClick={onClose}>{s('cancel')}</Btn>
    </BottomSheet>
  )
}

// Confirms a gift/deduct actually happened — the sheet closing on its own
// wasn't a clear enough signal that gems really moved.
function GemActionDoneModal({ verb, amount, childName, onClose }) {
  const s = useT()
  const isGift = verb === 'gift'
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(25,32,42,.42)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: PC.card, borderRadius: 28, padding: '30px 26px 24px', width: '100%', maxWidth: 340,
        textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,.28)', animation: 'tcSheet .3s cubic-bezier(.2,.8,.3,1) both',
      }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>{isGift ? '🫴' : '🫳'}</div>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: PC.ink, marginBottom: 6 }}>
          {isGift ? s('cd_gems_sent') : s('cd_gems_removed')}
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: PC.inkSoft, marginBottom: 22, lineHeight: 1.5 }}>
          {isGift
            ? s('cd_gems_added_to', { n: amount, name: childName })
            : s('cd_gems_taken', { n: amount, name: childName })}
        </div>
        <Btn onClick={onClose}>{s('cd_ok')}</Btn>
      </div>
    </div>
  )
}

// Adds a goal, or edits one that already exists. The same sheet does both: a goal whose cost
// turned out wrong used to have to be deleted and retyped, which threw away the progress bar
// the child had been watching.
function AddRewardSheet({ childId, reward, suggestion, onClose, onSaved }) {
  const s = useT()
  const editing = !!reward
  const [icon,   setIcon]   = useState(reward?.icon ?? suggestion?.icon ?? '🎁')
  const [name,   setName]   = useState(reward?.name ?? suggestion?.name ?? '')
  // The child's number is shown but never prefilled into the cost — a prefilled figure is
  // a price the parent has to notice and override, and the one they don't notice is theirs.
  const [btCost, setBtCost] = useState(reward?.bt_cost ?? 50)
  const [recurring, setRecurring] = useState(reward ? reward.recurring !== false : true)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const save = async () => {
    if (!name.trim()) return setError(s('cd_goal_name_req'))
    // The cost is typed now, so it can be emptied. A goal costing nothing is claimable the
    // moment it is created.
    if (!(btCost >= 10)) return setError(s('cd_goal_min'))
    setSaving(true); setError('')
    const row = { icon, name: name.trim(), bt_cost: btCost, recurring }

    // Granting a request goes through the server, which creates the goal and closes the
    // request together. Doing both from here could leave one half done.
    if (suggestion) {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setError(s('cd_sign_in_again')); setSaving(false); return }
      try {
        const r = await fetch(`${SERVER}/api/reward-suggestions/${suggestion.id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: name.trim(), icon, gems: btCost, recurring }),
        })
        const j = await r.json()
        if (!r.ok) throw new Error(j?.error === 'already_exists'
          ? s('cd_goal_exists', { name: j.existing?.name })
          : j?.error || s('cd_goal_failed'))
      } catch (err) { setError(err.message); setSaving(false); return }
      onSaved()
      return
    }

    const { error: dbErr } = editing
      ? await supabase.from('rewards').update(row).eq('id', reward.id)
      : await supabase.from('rewards').insert({ child_id: childId, ...row })
    if (dbErr) { setError(dbErr.message); setSaving(false); return }
    onSaved()
  }

  // Onboarding already settled this: the slider is for dragging, not a ceiling. It used to stop
  // at 200 here, so a parent who wanted a 600-gem goal — the thing worth saving weeks for — could
  // not enter one at all. The number is typed, and the slider's own max stretches to whatever was
  // typed rather than silently capping it.
  const sliderMax = Math.max(5000, btCost)
  const pct = ((Math.min(Math.max(btCost, 10), sliderMax) - 10) / (sliderMax - 10)) * 100
  const trackBg = `linear-gradient(to right, ${PC.amber} ${pct}%, ${PC.line} ${pct}%)`

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: PC.ink }}>
        {suggestion ? s('cd_set_price') : editing ? s('cd_edit_goal') : s('cd_add_goal')}
      </div>
      {suggestion && (
        <div style={{ background: PC.tealBg, borderRadius: 12, padding: '10px 12px', fontFamily: FONT, fontWeight: 700, fontSize: 12.5, color: PC.inkSoft, lineHeight: 1.5 }}>
          {suggestion.suggested_gems
            ? s('cd_asked_guessed', { n: suggestion.suggested_gems })
            : s('cd_asked')}
        </div>
      )}

      <Field label={s('cd_icon')}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {REWARD_EMOJIS.map(e => (
            <button key={e} className="tc-press" onClick={() => setIcon(e)}
              style={{ width: 42, height: 42, borderRadius: 12, border: `2px solid ${icon === e ? PC.teal : PC.line}`, background: icon === e ? PC.tealBg : '#fff', fontSize: 22, cursor: 'pointer' }}>
              {e}
            </button>
          ))}
        </div>
      </Field>

      <Field label={s('cd_goal_name')}>
        <input className="tc-input" type="text" value={name} onChange={e => { setName(e.target.value); setError('') }}
          placeholder={s('cd_goal_name_ph')} />
      </Field>

      <Field label={s('cd_gem_cost')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: PC.amberBg, borderRadius: 12, padding: '6px 11px', width: 'fit-content', marginBottom: 10 }}>
          <input type="number" min={10} value={btCost}
            onChange={e => setBtCost(parseInt(e.target.value) || 0)}
            className="tc-numplain"
            style={{ width: `calc(${Math.max(4, String(btCost ?? '').length)}ch + 8px)`, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, fontSize: 15, fontWeight: 800, color: PC.ink, textAlign: 'right' }} />
          <span style={{ fontSize: 14 }}>⭐</span>
        </div>
        <input type="range" min={10} max={sliderMax} step={10}
          value={Math.min(Math.max(btCost, 10), sliderMax)}
          onChange={e => setBtCost(Number(e.target.value))}
          className="tc-slider" style={{ background: trackBg }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: PC.inkFaint }}>10</span>
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: PC.inkFaint }}>{sliderMax}</span>
        </div>
      </Field>

      {/* Ada saved for a squishy toy, claimed it, we bought it — and the goal was back in her
          list the next morning. Screen time is worth earning again every week; a toy is bought
          once. Nothing in the app could tell the two apart, so every goal behaved like screen
          time. */}
      <Field label={s('cd_how_often')}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { on: true,  title: s('cd_again'), sub: s('cd_again_b') },
            { on: false, title: s('cd_once'),  sub: s('cd_once_b') },
          ].map(o => (
            <button key={String(o.on)} className="tc-press" onClick={() => setRecurring(o.on)}
              style={{
                flex: 1, textAlign: 'left', cursor: 'pointer', borderRadius: 14, padding: '10px 12px',
                border: `2px solid ${recurring === o.on ? PC.teal : PC.line}`,
                background: recurring === o.on ? PC.tealBg : '#fff',
              }}>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13, color: PC.ink }}>{o.title}</div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 11, color: PC.inkSoft, lineHeight: 1.4, marginTop: 2 }}>{o.sub}</div>
            </button>
          ))}
        </div>
      </Field>

      {error && <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.danger }}>{error}</div>}
      <Btn onClick={save} disabled={saving}>{saving ? s('saving') : suggestion ? s('cd_add_this_goal') : editing ? s('cd_save_changes') : s('cd_add_goal')}</Btn>
      <Btn variant="ghost" onClick={onClose}>{s('cancel')}</Btn>
    </BottomSheet>
  )
}

// ── Remove confirm sheet ──────────────────────────────────────────────────────
function RemoveSheet({ child, onClose, onConfirm }) {
  const s = useT()
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
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: PC.ink }}>{s('cd_remove_q', { name: child.name })}</div>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, lineHeight: 1.6 }}>
          {s('cd_remove_b', { name: child.name })}
        </div>
      </div>
      <Btn variant="danger" onClick={doRemove} disabled={removing}>
        {removing ? s('cd_removing') : s('cd_remove_yes', { name: child.name })}
      </Btn>
      <Btn variant="outline" onClick={onClose}>{s('cancel')}</Btn>
    </BottomSheet>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ParentChildDetail() {
  const s = useT()
  const lang = useUiLang()
  const { id } = useParams()
  const nav = useNavigate()
  const [child, setChild] = useState(null)
  const [gems, setGems] = useState(null)
  // Kept as rows, not just a total — "Completed today" is built from them.
  const [ledger, setLedger] = useState([])
  const [submissions, setSubmissions] = useState(null)
  const [openReading, setOpenReading] = useState(null)
  const [contributions, setContributions] = useState(null)
  const [contributionsTodayDate, setContributionsTodayDate] = useState(null)
  const [tree, setTree] = useState(null)
  const [contributionPhotos, setContributionPhotos] = useState({}) // contributionId → signed URL
  const [paintings, setPaintings] = useState([])
  const [rewards, setRewards] = useState(null)
  const [claims, setClaims] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [justApproved, setJustApproved] = useState(false)
  const [capNotice, setCapNotice] = useState('')  // "approved, but the daily limit was already spent"
  const [lightbox, setLightbox] = useState(null) // { urls, index } — full-size photo viewer
  const [photoMap, setPhotoMap] = useState({})   // submissionId → signed URLs
  const [showPinModal,    setShowPinModal]    = useState(false)
  const [showEditModal,   setShowEditModal]   = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [showAddReward,   setShowAddReward]   = useState(false)
  const [editReward,      setEditReward]      = useState(null)
  const [approveSuggestion, setApproveSuggestion] = useState(null)
  const [showGiftGems,    setShowGiftGems]    = useState(false)
  const [showDeductGems,  setShowDeductGems]  = useState(false)
  const [gemActionDone,   setGemActionDone]   = useState(null) // { verb: 'gift'|'deduct', amount }

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
      // `*` rather than a column list because one of the columns read below (`capped`,
      // marking a session that happened but earned nothing) may not exist yet: naming a
      // missing column fails the whole request, and this one request carries the gem
      // balance. With `*` the field is simply absent until the migration runs.
      supabase.from('bt_ledger').select('*').eq('child_id', id),
      supabase.from('submissions').select('*').eq('child_id', id).order('created_at', { ascending: false }),
      supabase.from('rewards').select('*').eq('child_id', id).is('archived_at', null).order('bt_cost'),
      // scope=pending ignores period/month entirely — a pending contribution
      // must stay visible here until approved/rejected, no matter which
      // month it was logged in (see server/index.js for why scope=month
      // would silently drop it once the month rolls over).
      fetch(`${SERVER}/api/contributions?child_id=${id}&scope=pending`).then(r => r.json()),
      // Same /api/tree the child's MyTree screen reads, so the parent sees the
      // tree the child sees (and the same numbers Tuto quotes on Telegram).
      fetch(`${SERVER}/api/tree?child_id=${id}`).then(r => r.json()).catch(() => null),
      fetch(`${SERVER}/api/children/${id}/reward-claims`).then(r => r.json()).catch(() => ({ claims: [] })),
      fetch(`${SERVER}/api/children/${id}/reward-suggestions`).then(r => r.json()).catch(() => ({ suggestions: [] })),
    ]).then(([{ data: childData }, { data: ledgerData }, { data: subData }, { data: rewardData }, contribData, treeResp, claimsResp, suggestResp]) => {
      setChild(childData)
      setGems((ledgerData || []).reduce((sum, r) => sum + (r.amount || 0), 0))
      setLedger(ledgerData || [])
      setSubmissions(subData || [])
      setRewards(rewardData || [])
      setContributions(contribData?.contributions || [])
      setContributionsTodayDate(contribData?.todayDate ?? null)
      setTree(treeResp)
      setClaims(claimsResp?.claims || [])
      setSuggestions(suggestResp?.suggestions || [])
    })
  }, [id])

  // The photo bucket is private, so images can't be rendered from the stored
  // value — ask the server for signed URLs (it verifies this parent owns the
  // child before minting them).
  useEffect(() => {
    const withPhotos = (submissions || []).filter(s => s.photo_urls?.length || s.media_url)
    if (!withPhotos.length) return
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      const entries = await Promise.all(withPhotos.map(async s => {
        try {
          const r = await fetch(`${SERVER}/api/submissions/${s.id}/photos`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const j = await r.json()
          return [s.id, j.photos || []]
        } catch {
          return [s.id, []]
        }
      }))
      if (!cancelled) setPhotoMap(Object.fromEntries(entries))
    })()
    return () => { cancelled = true }
  }, [submissions])

  // Drawings: signed URLs, minted only after the server checks this parent owns
  // the child. Separate from the main load because it needs the auth token.
  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      try {
        const r = await fetch(`${SERVER}/api/parent/children/${id}/paintings`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const j = await r.json()
        if (!cancelled) setPaintings(j.paintings || [])
      } catch { /* the card just stays hidden */ }
    })()
    return () => { cancelled = true }
  }, [id])

  // Contribution photos live in the private bucket too — same signed-URL dance
  // as the submission photos above.
  useEffect(() => {
    const withPhotos = (contributions || []).filter(c => c.photo_url)
    if (!withPhotos.length) return
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      const entries = await Promise.all(withPhotos.map(async c => {
        try {
          const r = await fetch(`${SERVER}/api/contributions/${c.id}/photo`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const j = await r.json()
          return [c.id, j.photo || null]
        } catch {
          return [c.id, null]
        }
      }))
      if (!cancelled) setContributionPhotos(Object.fromEntries(entries.filter(([, v]) => v)))
    })()
    return () => { cancelled = true }
  }, [contributions])

  const loading = !child || gems === null || submissions === null || rewards === null || contributions === null

  const pending   = (submissions || []).filter(s => s.status === 'pending')
  // Built from the ledger rather than from submissions. Only homework ever lands in the
  // submissions table — maths writes math_progress, stories write stories, drawings write
  // paintings — so a child could do maths, write a story and finish a drawing and the
  // parent's "Completed today" would still say nothing happened. Every one of those does
  // write a ledger row when it earns, so that is the one place they all appear.
  // Spends are negative and are excluded; the welcome bonus is not something the child did.
  // Anything that earned today, not just the reasons this file happens to know about. A
  // whitelist would hide whatever it had not been told about — the ledger already holds
  // parent adjustments ("chore", "adjustment") that would have vanished, and reading is
  // about to write another. Unknown reasons show under their own name instead.
  // Spends are negative, so they drop out; the welcome bonus is not something the child did.
  // A session that hit the day's limit belongs here too. It earned nothing, and filtering on
  // the amount alone hid it — so a parent whose child did four maths sessions was told about
  // three, which is the one number here they could be misled by.
  const todayDone = (ledger || [])
    .filter(e => (e.amount > 0 || e.capped) && isToday(e.created_at) && e.reason !== 'Welcome bonus')
    .map((e, i) => ({ id: `${e.reason}-${e.created_at}-${i}`, task_type: e.reason, gems_earned: e.amount, at: e.created_at, capped: !!e.capped }))

  // Reading is the one activity that stores what actually happened — the questions it asked,
  // what the child answered, and the pages they photographed. That record was written from
  // the very first version and read by nothing, so a parent could see "My Books +30" and
  // learn no more than that. The ledger row carries no submission id, so it is paired to the
  // session written alongside it: same child, same activity, within a minute.
  const readingSubs = (submissions || []).filter(s => s.task_type === 'reading')
  function readingDetailFor(entry) {
    if (entry.task_type !== 'reading') return null
    const t = new Date(entry.at).getTime()
    let best = null, bestGap = Infinity
    for (const sub of readingSubs) {
      const gap = Math.abs(new Date(sub.created_at).getTime() - t)
      if (gap < bestGap) { bestGap = gap; best = sub }
    }
    return bestGap <= 60_000 ? best : null
  }
  // Backend scopes the fetch to status='pending', but approve/reject flip
  // status optimistically in local state — still need this filter so an
  // item disappears from the list the moment it's actioned.
  const pendingContributions = (contributions || []).filter(c => c.status === 'pending')
  const pendingContributionGroups = groupByDate(pendingContributions, contributionsTodayDate)
  const pendingClaims = (claims || []).filter(c => c.status === 'pending')

  // Homework decisions go through the server, like drawings do. The browser used
  // to flip the status and write the bt_ledger row itself with a gem figure it
  // chose — which meant it paid the full amount however many the child had
  // already been rewarded for today, and believed whatever a tampered client
  // sent. The button says "yes"; the amount, the daily limit and the ledger are
  // the server's to decide.
  async function submissionDecision(sub, verb) {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return
    const optimistic = verb === 'approve' ? 'approved' : 'rejected'
    setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: optimistic } : s))
    try {
      const r = await fetch(`${SERVER}/api/submissions/${sub.id}/${verb}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'failed')
      const earnedGems = j.gems ?? 0
      setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: optimistic, gems_earned: earnedGems } : s))
      if (earnedGems > 0) {
        setGems(prev => (prev ?? 0) + earnedGems)
        setJustApproved(true)
        setTimeout(() => setJustApproved(false), 2200)
      } else if (verb === 'approve' && j.capped) {
        // Approved, but the day's limit was already spent. Without this the card
        // just disappears and the gem total doesn't move — which reads as a bug.
        setCapNotice(s('cd_cap_notice', { n: j.dailyCap }))
        setTimeout(() => setCapNotice(''), 7000)
      }
    } catch {
      setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'pending' } : s))
    }
  }

  const handleApprove = (sub) => submissionDecision(sub, 'approve')
  const handleReject = (subId) => submissionDecision({ id: subId }, 'reject')

  // Diary approvals never touch bt_ledger — gems for contributions are
  // computed separately in the end-of-month review, by design.
  // Drawings: the gem amount is the server's call (it also applies the daily
  // cap), so nothing about the reward is sent from here — just the decision.
  async function paintingDecision(p, verb) {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return
    const optimistic = verb === 'approve' ? 'approved' : 'rejected'
    setPaintings(prev => prev.map(x => x.id === p.id ? { ...x, status: optimistic } : x))
    try {
      const r = await fetch(`${SERVER}/api/paintings/${p.id}/${verb}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'failed')
      // Show what the server actually awarded, not what we assumed.
      setPaintings(prev => prev.map(x => x.id === p.id ? { ...x, status: optimistic, reward_amount: j.gems ?? 0 } : x))
    } catch {
      setPaintings(prev => prev.map(x => x.id === p.id ? { ...x, status: 'pending' } : x))
    }
  }
  const handleApprovePainting = (p) => paintingDecision(p, 'approve')
  const handleRejectPainting  = (p) => paintingDecision(p, 'reject')

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

  // Escrow model: the gems were already deducted when the child tapped Claim
  // (see the reward-claims POST route), so approving here changes nothing —
  // rejecting REFUNDS them back to the child.
  async function claimDecision(c, verb) {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return
    try {
      const r = await fetch(`${SERVER}/api/reward-claims/${c.id}/${verb}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'failed')
      setClaims(prev => prev.map(x => x.id === c.id ? { ...x, status: verb === 'approve' ? 'approved' : 'rejected' } : x))
      if (verb === 'reject') setGems(prev => (prev ?? 0) + c.bt_cost)
    } catch (err) {
      console.error(`[claimDecision:${verb}]`, err.message)
    }
  }
  const handleApproveClaim = (c) => claimDecision(c, 'approve')
  const handleRejectClaim  = (c) => claimDecision(c, 'reject')

  // Approving is not one tap — it opens the goal sheet, because the parent has to
  // put a price on it. Only the refusal is immediate.
  async function handleRejectSuggestion(s) {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return
    setSuggestions(prev => prev.filter(x => x.id !== s.id))
    try {
      const r = await fetch(`${SERVER}/api/reward-suggestions/${s.id}/reject`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) throw new Error('failed')
    } catch {
      setSuggestions(prev => [s, ...prev])
    }
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
        sub={s('years_old', { n: child.age })}
        onBack={() => nav('/parent/dashboard', { state: { updatedChild: child } })}
      />

      <div className="tc-scroll" style={{ flex: 1, padding: '4px 20px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* profile card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 2px 0' }}>
          <Avatar child={child} size={62} />
          <div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: PC.ink }}>{child.name}</div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Pill bg={PC.amberBg} color={PC.amber}>⭐ {s('cd_gems_pill', { n: gems })}</Pill>
              <button className="tc-press tc-tap" onClick={() => setShowGiftGems(true)}
                style={{ background: 'none', border: `1.5px solid ${PC.line}`, borderRadius: 999, padding: '5px 12px', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 12, color: PC.inkSoft }}>
                {s('cd_gift_btn')}
              </button>
              <button className="tc-press tc-tap" onClick={() => setShowDeductGems(true)} disabled={gems < 5}
                style={{ background: 'none', border: `1.5px solid ${PC.line}`, borderRadius: 999, padding: '5px 12px', cursor: gems < 5 ? 'default' : 'pointer', opacity: gems < 5 ? 0.5 : 1, fontFamily: FONT, fontWeight: 800, fontSize: 12, color: PC.inkSoft }}>
                {s('cd_deduct_btn')}
              </button>
            </div>
          </div>
        </div>

        {/* pending approvals */}
        <div>
          <SectionHead>
            {s('cd_pending')}{pending.length > 0 ? ` (${pending.length})` : ''}
          </SectionHead>
          {capNotice && (
            <Card pad={12} style={{ marginBottom: 10, background: PC.peachBg, border: 'none' }}>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12.5, color: PC.inkSoft, lineHeight: 1.45 }}>
                🌙 {capNotice} {s('cd_raise_limit')}
              </div>
            </Card>
          )}
          {pending.length === 0 ? (
            <Card pad={14} style={{ textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.inkSoft }}>
              {s('cd_all_caught_up')}
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pending.map(sub => (
                <SubmissionCard key={sub.id} sub={sub} photos={photoMap[sub.id] || []}
                  onApprove={() => handleApprove(sub)} onReject={() => handleReject(sub.id)}
                  onOpenPhoto={(urls, index) => setLightbox({ urls, index })} />
              ))}
            </div>
          )}
        </div>

        {/* drawings the child photographed — passive transparency, no approval */}
        <PaintingsCard paintings={paintings} name={child.name}
          onOpenPhoto={(urls, index) => setLightbox({ urls, index })}
          onApprove={handleApprovePainting} onReject={handleRejectPainting} />

        {/* the tree the child actually sees — same /api/tree numbers */}
        <TreeCard tree={tree} name={child.name} />

        {/* diary contributions — every open pending, any month, grouped by day */}
        <div>
          <SectionHead>
            {s('cd_contributions')}{pendingContributions.length > 0 ? ` (${pendingContributions.length})` : ''}
          </SectionHead>
          {pendingContributionGroups.length === 0 ? (
            <Card pad={14} style={{ textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.inkSoft }}>
              {s('cd_no_pending_c')}
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendingContributionGroups.map(g => (
                <div key={g.date} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <ContributionDateHeader isToday={g.isToday} dateStr={g.date} />
                  {g.items.map(c => (
                    <ContributionCard key={c.id} c={c} photo={contributionPhotos[c.id]}
                      onApprove={() => handleApproveContribution(c)} onReject={() => handleRejectContribution(c)}
                      onOpenPhoto={(urls, index) => setLightbox({ urls, index })} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* completed today */}
        <div>
          <SectionHead>{s('cd_completed')}</SectionHead>
          {todayDone.length === 0 ? (
            <Card pad={14} style={{ textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.inkSoft }}>{s('cd_nothing_today')}</Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayDone.map(sub => {
                const meta = TASK_LABELS[sub.task_type] || { type: null }
                const label = taskLabel(sub.task_type, lang, s)
                const detail = readingDetailFor(sub)
                const open = detail && openReading === sub.id
                const qa = Array.isArray(detail?.generated_questions) ? detail.generated_questions : []
                const pages = photoMap[detail?.id] || []
                return (
                  <Card key={sub.id} pad={12} style={{ display: 'flex', flexDirection: 'column', gap: open ? 12 : 0, opacity: sub.capped ? 0.85 : 1 }}>
                    <div
                      onClick={detail ? () => setOpenReading(open ? null : sub.id) : undefined}
                      className={detail ? 'tc-tap' : undefined}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: detail ? 'pointer' : 'default' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 11, background: meta.type ? PC[meta.type + 'Bg'] : PC.amberBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {meta.type ? <TaskIcon type={meta.type} size={20} /> : <span style={{ fontSize: 18 }}>⭐</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: PC.ink }}>{label}</div>
                        {detail && (
                          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12, color: PC.inkSoft, marginTop: 1 }}>
                            {detail.feedback} · {s('cd_n_correct', { n: qa.filter(q => q.was_correct).length, total: qa.length })}
                          </div>
                        )}
                        {sub.capped && (
                          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12, color: PC.inkFaint, marginTop: 1 }}>
                            {s('cd_past_limit')}
                          </div>
                        )}
                      </div>
                      {sub.capped
                        ? <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: PC.inkFaint }}>🌙</div>
                        : <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: PC.green }}>+{sub.gems_earned ?? 0} ⭐</div>}
                      {detail && (
                        <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 12, color: PC.inkFaint }}>{open ? '▲' : '▼'}</span>
                      )}
                    </div>

                    {open && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {pages.length > 0 && (
                          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                            {pages.map((url, i) => (
                              <img key={url} src={url} alt={`page ${i + 1}`} onClick={() => setLightbox({ urls: pages, index: i })}
                                style={{ width: 90, height: 90, flex: '0 0 auto', borderRadius: 12, objectFit: 'cover', cursor: 'zoom-in' }} />
                            ))}
                          </div>
                        )}
                        {qa.length === 0 ? (
                          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkFaint }}>{s('cd_no_questions')}</div>
                        ) : qa.map((q, i) => (
                          <div key={i} style={{ background: PC.readingBg, borderRadius: 12, padding: '10px 12px' }}>
                            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12.5, color: PC.ink, lineHeight: 1.35 }}>
                              {i + 1}. {q.question}
                            </div>
                            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12.5, marginTop: 4, color: q.type === 'oe' ? PC.inkSoft : q.was_correct ? PC.green : PC.danger }}>
                              {q.type === 'oe' ? '💬' : q.was_correct ? '✓' : '✕'} {q.child_answer || '—'}
                            </div>
                            {q.type === 'mc' && !q.was_correct && q.correct_answer && (
                              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12, color: PC.inkSoft, marginTop: 2 }}>
                                {s('cd_answer')} {q.correct_answer}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* goal requests — child asked for a goal, you set what it costs */}
        {suggestions.length > 0 && (
          <div>
            <SectionHead>{s('cd_goal_requests', { n: suggestions.length })}</SectionHead>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* `sg`, not `s`: the translator is called inside this row, and a map parameter
                  named `s` would shadow it. */}
              {suggestions.map(sg => (
                <Card key={sg.id} pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: PC.tealBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    {sg.icon || '🎁'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: PC.ink }}>{sg.name}</div>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: PC.inkSoft }}>
                      {sg.suggested_gems ? s('cd_thinks', { name: child.name, n: sg.suggested_gems }) : s('cd_asked_for', { name: child.name })}
                    </div>
                  </div>
                  <button className="tc-press tc-tap" onClick={() => setApproveSuggestion(sg)}
                    style={{ background: PC.greenBg, color: PC.green, border: 'none', borderRadius: 11, padding: '9px 14px', fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>✓</button>
                  <button className="tc-press tc-tap" onClick={() => handleRejectSuggestion(sg)}
                    style={{ background: PC.dangerBg, color: PC.danger, border: 'none', borderRadius: 11, padding: '9px 14px', fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>✕</button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* reward claims — child tapped "Claim", waiting on you */}
        {pendingClaims.length > 0 && (
          <div>
            <SectionHead>{s('cd_claims', { n: pendingClaims.length })}</SectionHead>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendingClaims.map(c => (
                <Card key={c.id} pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: PC.amberBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    {c.reward_icon || '🎁'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: PC.ink }}>{c.reward_name}</div>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: PC.amber }}>⭐ {c.bt_cost} gems</div>
                  </div>
                  <button className="tc-press tc-tap" onClick={() => handleApproveClaim(c)}
                    style={{ background: PC.greenBg, color: PC.green, border: 'none', borderRadius: 11, padding: '9px 14px', fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>✓</button>
                  <button className="tc-press tc-tap" onClick={() => handleRejectClaim(c)}
                    style={{ background: PC.dangerBg, color: PC.danger, border: 'none', borderRadius: 11, padding: '9px 14px', fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>✕</button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* reward goals */}
        <div>
          <SectionHead action={
            <button className="tc-press tc-tap" onClick={() => setShowAddReward(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: PC.amberBg, color: PC.amber, border: 'none', borderRadius: 11, padding: '7px 12px', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              <Icon name="plus" size={14} color={PC.amber} sw={2.4} /> {s('db_add')}
            </button>
          }>{s('cd_reward_goals')}</SectionHead>

          {rewards.length === 0 ? (
            <Card pad={14} style={{ textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.inkSoft }}>{s('cd_no_goals')}</Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rewards.map(r => {
                const pct = r.bt_cost > 0 ? Math.min(100, Math.round((gems / r.bt_cost) * 100)) : 0
                // A pending claim already has its own card + approve/reject buttons
                // above — don't also flag this one "ready to claim", that's a
                // decision already in motion, not a new one waiting to happen.
                const awaitingDecision = pendingClaims.some(c => c.reward_id === r.id)
                const ready = gems >= r.bt_cost && !awaitingDecision
                return (
                  <Card key={r.id} pad={14} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 26 }}>{r.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: PC.ink }}>{r.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: PC.amber }}>{s('cd_gems_needed', { n: r.bt_cost })}</span>
                          {r.recurring === false && (
                            <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 10.5, color: PC.inkSoft, background: PC.line, borderRadius: 7, padding: '2px 6px' }}>{s('cd_just_once')}</span>
                          )}
                        </div>
                      </div>
                      {ready && <span style={{ fontSize: 20 }}>🎉</span>}
                      <button className="tc-press tc-tap" onClick={() => setEditReward(r)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                        <Icon name="edit" size={17} color={PC.inkFaint} />
                      </button>
                      <button className="tc-press tc-tap" onClick={async () => { await supabase.from('rewards').delete().eq('id', r.id); setRewards(prev => prev.filter(x => x.id !== r.id)) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                        <Icon name="trash" size={18} color={PC.inkFaint} />
                      </button>
                    </div>
                    <div style={{ background: PC.line, borderRadius: 8, height: 7, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: ready ? PC.green : `linear-gradient(90deg, ${PC.teal}, ${PC.peach})`, borderRadius: 8, transition: 'width .6s ease' }} />
                    </div>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: ready ? PC.green : PC.inkSoft }}>
                      {awaitingDecision ? s('cd_claimed') : ready ? s('cd_ready') : s('cd_more_to_go', { n: Math.max(0, r.bt_cost - gems) })}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* settings */}
        <div>
          <SectionHead>{s('cd_settings')}</SectionHead>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: 'gear',  label: s('cd_task_settings'), sub: s('cd_task_settings_b'), onClick: () => nav(`/parent/child/${id}/settings`) },
              { icon: 'edit',  label: s('cd_edit_child').replace(' ✏️', ''), sub: s('cd_edit_child_b'), onClick: () => setShowEditModal(true) },
              { icon: 'lock',  label: s('cd_change_pin'),     sub: s('cd_change_pin_b'),     onClick: () => setShowPinModal(true) },
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
              <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: PC.danger }}>{s('cd_remove_child')}</span>
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
      {showGiftGems && child && (
        <GiftGemsSheet
          childId={id}
          childName={child.name}
          onClose={() => setShowGiftGems(false)}
          onGifted={(amount) => {
            setGems(prev => (prev ?? 0) + amount)
            setShowGiftGems(false)
            setGemActionDone({ verb: 'gift', amount })
          }}
        />
      )}
      {showDeductGems && child && (
        <DeductGemsSheet
          childId={id}
          childName={child.name}
          currentGems={gems ?? 0}
          onClose={() => setShowDeductGems(false)}
          onDeducted={(amount) => {
            setGems(prev => (prev ?? 0) - amount)
            setShowDeductGems(false)
            setGemActionDone({ verb: 'deduct', amount })
          }}
        />
      )}
      {gemActionDone && child && (
        <GemActionDoneModal
          verb={gemActionDone.verb}
          amount={gemActionDone.amount}
          childName={child.name}
          onClose={() => setGemActionDone(null)}
        />
      )}
      {(showAddReward || editReward || approveSuggestion) && (
        <AddRewardSheet
          childId={id}
          reward={editReward}
          suggestion={approveSuggestion}
          onClose={() => { setShowAddReward(false); setEditReward(null); setApproveSuggestion(null) }}
          onSaved={async () => {
            const { data } = await supabase.from('rewards').select('*').eq('child_id', id).is('archived_at', null).order('bt_cost')
            setRewards(data || [])
            if (approveSuggestion) setSuggestions(prev => prev.filter(x => x.id !== approveSuggestion.id))
            setShowAddReward(false); setEditReward(null); setApproveSuggestion(null)
          }}
        />
      )}
    </div>
  )
}
