import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, storageClient, PHOTO_BUCKET } from '../lib/supabase'
import TutoMascot from '../components/TutoMascot'
import { TreeArt, Sprig } from '../components/TreeArt'

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'

// Category → visual theme only (color/bg/fallback icon). The actual list of
// cards a child sees comes from the backend (contribution_cards table) —
// see the `cards` state in MyTree below.
const CATS = {
  self_care: { color: '#5aa9e6', bg: '#E4F1FC', icon: '🛏️' },
  household: { color: '#e89a39', bg: '#FBEFD8', icon: '🍽️' },
  family:    { color: '#ef7d9d', bg: '#FBE4EC', icon: '🤝' },
  outside:   { color: '#54b487', bg: '#DEF2E7', icon: '🌿' },
}

const GOAL_BY_BAND = { young: 12, mid: 18, mature: 24 }
// Daily tree: tree reaches full size at this many contributions in a single day
const DAY_FULL = 4

function bandFor(age) {
  if (age == null) return 'young'
  if (age <= 8) return 'young'
  if (age <= 11) return 'mid'
  return 'mature'
}

const MICRO_COPY = {
  young: 'Nice! I’ll check this with your parent 🌱',
  mid: 'Logged it! Your parent will confirm soon 🌱',
  mature: 'Logged — your parent will confirm it.',
}

const TODAY_LABEL = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

// Groups a flat list into per-local-day buckets, preserving the newest-first
// order the backend already sorted them in. Items without a `date` (freshly
// added, optimistic or just-saved) are assumed to belong to today.
function groupEntriesByDate(entries, todayDate) {
  const groups = []
  for (const e of entries) {
    const key = e.date || todayDate
    let g = groups.find(g => g.date === key)
    if (!g) { g = { date: key, isToday: key === todayDate, items: [] }; groups.push(g) }
    g.items.push(e)
  }
  return groups
}

// "June 29" style label for a past day's group header (yyyy-MM-dd, local).
function formatPastDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'long' })
}

// Diary photos are photos of a child's home and room — same sensitivity as a
// chore photo, so they follow the same route: uploaded DIRECTLY to the PRIVATE
// bucket, and only the storage PATH is sent on. They used to go to the public
// 'submissions' bucket via getPublicUrl, which left them world-readable.
// The server reads the path back, screens the image, and deletes it on block.
async function uploadDiaryPhoto(file, childId) {
  const ext = (file.type || '').includes('png') ? 'png' : 'jpg'
  const path = `${childId ?? 'anonymous'}/diary/${Date.now()}.${ext}`
  const { error } = await storageClient.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })
  if (error) throw error
  return path
}

// ── shared pieces ──────────────────────────────────────────────────────────────

function EntryRow({ category, label, status, fresh, photoUrl, canAddPhoto, onAttachPhoto, attaching }) {
  const C = CATS[category] || CATS.outside
  const fileRef = useRef()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px',
      borderBottom: '1px dashed #E7DABF',
      animation: fresh ? 'ttPop .42s cubic-bezier(.2,.9,.3,1.2) both' : 'none',
    }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{C.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 15, color: '#4a3f2e' }}>{label}</div>
        <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 11.5, color: status === 'approved' ? '#37a06f' : '#b9892f' }}>
          {status === 'approved' ? '✓ Approved' : '◷ Waiting for approval'}
        </div>
        {/* Offered only after the entry exists, so adding a card stays one tap
            and the photo is genuinely optional. */}
        {photoUrl ? (
          <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 11, color: '#8a7f6a', marginTop: 2 }}>📷 Photo added</div>
        ) : canAddPhoto && (
          <>
            <button onClick={() => fileRef.current?.click()} disabled={attaching} style={{
              marginTop: 3, border: 'none', background: 'none', padding: 0, cursor: attaching ? 'default' : 'pointer',
              fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11, color: attaching ? '#b3a894' : '#37a06f',
            }}>
              {attaching ? 'Sending photo…' : '📷 Add a photo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) onAttachPhoto(f); e.target.value = '' }} />
          </>
        )}
      </div>
      <div style={{
        width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
        background: status === 'approved' ? '#4cb685' : 'transparent',
        color: status === 'approved' ? '#fff' : '#b9892f',
        boxShadow: status === 'approved' ? '0 4px 10px rgba(76,182,133,.4)' : 'none',
      }}>
        {status === 'approved' ? '✓' : '◷'}
      </div>
    </div>
  )
}

// Tapping a card that allows a photo opens this first, so the child is ASKED
// rather than having to notice a small button on the row afterwards. Adding
// without a photo is one tap from here, so the photo stays optional.
function CardPhotoSheet({ card, onCancel, onAdd, busy }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  if (!card) return null
  const C = CATS[card.category] || CATS.outside

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(40,45,35,.38)' }}>
      <div style={{
        width: '100%', maxWidth: 430, background: '#FFFDF7',
        borderRadius: '22px 22px 0 0', padding: '20px 18px calc(20px + env(safe-area-inset-bottom))',
        animation: 'ttPop .3s cubic-bezier(.2,.9,.3,1.2) both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 38, height: 38, borderRadius: 13, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>{card.icon || C.icon}</span>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 17, color: '#4a3f2e' }}>{card.label}</div>
        </div>

        <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, color: '#8a7f6a', marginTop: 14 }}>
          Want to show a photo? It's up to you.
        </div>

        {preview ? (
          <div style={{ position: 'relative', marginTop: 10 }}>
            <img src={preview} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 14 }} />
            <button onClick={() => setFile(null)} disabled={busy} style={{
              position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', border: 'none',
              background: 'rgba(30,30,25,.66)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
            }}>✕</button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={busy} style={{
            width: '100%', marginTop: 10, padding: '16px', borderRadius: 15,
            border: '2.5px dashed #C9BDA0', background: '#FFF9EC', cursor: busy ? 'default' : 'pointer',
            fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 15, color: '#8a7f6a',
          }}>📷 Take a photo</button>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); e.target.value = '' }} />

        <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
          <button onClick={onCancel} disabled={busy} style={{
            padding: '13px 16px', borderRadius: 14, border: '1.5px solid #E7DABF', background: '#fff',
            fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13.5, color: '#8a7f6a', cursor: busy ? 'default' : 'pointer',
          }}>Cancel</button>
          <button onClick={() => onAdd(file)} disabled={busy} style={{
            flex: 1, padding: '13px 16px', borderRadius: 14, border: 'none',
            background: busy ? '#A9CFB9' : '#37a06f', color: '#fff',
            fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 16, cursor: busy ? 'default' : 'pointer',
            boxShadow: busy ? 'none' : '0 5px 14px rgba(55,160,111,.36)',
          }}>
            {busy ? 'Sending…' : file ? 'Add with photo' : 'Add without a photo'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DiaryDateHeader({ isToday, dateStr }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 16px 6px' }}>
      <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: isToday ? '#37a06f' : '#b9892f' }}>
        {isToday ? 'Today' : 'Waiting'}
      </span>
      <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 600, fontSize: isToday ? 17 : 15, color: '#4a3f2e' }}>
        {isToday ? TODAY_LABEL : formatPastDate(dateStr)}
      </span>
    </div>
  )
}

function MatureDateHeader({ isToday, dateStr }) {
  return (
    <div style={{ fontWeight: 800, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6c7c72', paddingTop: 10, paddingBottom: 4 }}>
      {isToday ? 'Today' : formatPastDate(dateStr)}
    </div>
  )
}

function MatureRow({ category, label, status, fresh }) {
  const C = CATS[category] || CATS.outside
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 2px', borderBottom: '1px solid #E0E6E1',
      animation: fresh ? 'ttPop .42s cubic-bezier(.2,.9,.3,1.2) both' : 'none',
    }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: C.color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 500, fontSize: 14.5, color: '#27332c' }}>{label}</div>
        <div style={{ fontWeight: 800, fontSize: 11, color: '#6c7c72', marginTop: 1 }}>{status === 'approved' ? 'Approved' : 'Sent for approval'}</div>
      </div>
      <span style={{
        fontWeight: 800, fontSize: 10.5, padding: '4px 9px', borderRadius: 999,
        background: status === 'approved' ? '#E2F0E9' : '#FBEFD8',
        color: status === 'approved' ? '#2f8f6b' : '#b9892f',
      }}>
        {status === 'approved' ? 'Approved' : 'Pending'}
      </span>
    </div>
  )
}

function SugCard({ card, onAdd, wide }) {
  const bg = CATS[card.category]?.bg || '#FBEFD8'
  return (
    <button onClick={() => onAdd(card)} style={{
      display: 'flex', alignItems: 'center', gap: wide ? 10 : 6, flexDirection: wide ? 'row' : 'column',
      width: wide ? '100%' : undefined, justifyContent: wide ? 'flex-start' : 'center',
      background: '#FFFDF7', border: '1.5px solid #E7DABF', borderRadius: 15, padding: wide ? '12px 14px' : '14px 8px',
      cursor: 'pointer', textAlign: wide ? 'left' : 'center',
    }}>
      <span style={{ width: 32, height: 32, borderRadius: 11, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{card.icon}</span>
      <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 500, fontSize: wide ? 13.5 : 12.5, color: '#4a3f2e', flex: wide ? 1 : undefined }}>{card.label}</span>
      {wide && <span style={{ color: '#37a06f', fontSize: 17, fontWeight: 600 }}>+</span>}
    </button>
  )
}

function FreeTextComposer({ prominent, onSubmit, photoUrl, onAttachPhoto, onRemovePhoto, uploading, submitting }) {
  const [text, setText] = useState('')
  const fileRef = useRef()
  const busy = submitting || uploading

  const submit = () => {
    if (busy) return
    const trimmed = text.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setText('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 9, background: prominent ? '#fff' : '#FFFDF7',
          border: `1.5px ${prominent ? 'solid' : 'dashed'} ${prominent ? '#E0E6E1' : '#E7DABF'}`, borderRadius: 14, padding: '11px 13px',
          opacity: busy ? 0.7 : 1,
        }}>
          <span style={{ fontSize: 15 }}>✏️</span>
          <input
            value={text}
            disabled={busy}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            placeholder={prominent ? 'What did you do to help?' : 'Did something else? Write it here'}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: "'Baloo 2', cursive", fontWeight: 500, fontSize: 13.5, color: '#4a3f2e' }}
          />
          <button onClick={() => fileRef.current?.click()} disabled={busy} title="Add a photo (optional)"
            style={{ background: 'none', border: 'none', cursor: busy ? 'default' : 'pointer', fontSize: 16, opacity: 0.6, flexShrink: 0 }}>📷</button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onAttachPhoto(f) }} />
        </div>
        {prominent && (
          <button onClick={submit} disabled={!text.trim() || busy} style={{
            width: 48, height: 48, borderRadius: 14, border: 'none', background: '#2f8f6b', color: '#fff', fontSize: 20, flexShrink: 0,
            cursor: text.trim() && !busy ? 'pointer' : 'default', opacity: text.trim() && !busy ? 1 : 0.5, boxShadow: '0 8px 18px rgba(47,143,107,.34)',
          }}>↑</button>
        )}
      </div>
      {!prominent && text && (
        <button onClick={submit} disabled={busy} style={{
          alignSelf: 'flex-end', border: 'none', background: '#4cb685', color: '#fff', borderRadius: 12, padding: '7px 16px',
          fontFamily: "'Baloo 2', cursive", fontWeight: 700, fontSize: 13, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
        }}>
          Add ✓
        </button>
      )}
      {submitting && <div style={{ fontSize: 11, fontWeight: 700, color: '#9B8FC0' }}>Sending…</div>}
      {uploading && <div style={{ fontSize: 11, fontWeight: 700, color: '#9B8FC0' }}>Uploading photo…</div>}
      {photoUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 700, color: '#37a06f' }}>
          📷 Photo attached
          <button onClick={onRemovePhoto} style={{ border: 'none', background: 'none', color: '#b9892f', cursor: 'pointer', fontWeight: 800 }}>✕</button>
        </div>
      )}
    </div>
  )
}

function Micro({ show, msg }) {
  return (
    <div style={{
      position: 'fixed', left: '50%', bottom: show ? 22 : -120, transform: 'translateX(-50%)', maxWidth: 380, width: 'calc(100% - 32px)',
      transition: 'bottom .42s cubic-bezier(.2,.9,.3,1.2)', background: '#fff', borderRadius: 18, padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 14px 34px -10px rgba(40,60,40,.3)', zIndex: 50,
    }}>
      <TutoMascot size={42} expression="proud" color="#4cb685" />
      <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 13.5, color: '#2D2560', lineHeight: 1.3 }}>{msg}</div>
    </div>
  )
}

function BackButton({ onClick, dark }) {
  return (
    <button onClick={onClick} style={{
      background: dark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.5)', border: 'none', width: 38, height: 38, borderRadius: 12,
      fontSize: 17, color: dark ? '#27332c' : '#37a06f', cursor: 'pointer', flexShrink: 0,
    }}>←</button>
  )
}

// ── forest strip (6-11 bands) ───────────────────────────────────────────────────

// "July 4" style label for the forest strip's tap tooltip (yyyy-MM-dd, local).
function formatStripDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'long' })
}

function ForestStrip({ monthForest, monthTreeCount }) {
  const [tooltip, setTooltip] = useState(null)
  const [anchor, setAnchor] = useState({ left: 0, top: 0 })
  // { date, left } once the tooltip's real width is measured and clamped to
  // the strip's bounds — null/stale-date means "not measured for this tooltip yet"
  const [measured, setMeasured] = useState(null)
  const containerRef = useRef(null)
  const tooltipRef = useRef(null)
  // days this month that have at least one contribution
  const plantedDays = (monthForest || []).filter(d => d.count > 0)

  // Close on any tap outside a forest-day button — including taps elsewhere
  // in this same strip (header, badge, footer copy).
  useEffect(() => {
    if (!tooltip) return
    const handlePointerDown = (e) => {
      if (!e.target.closest('[data-forest-day]')) setTooltip(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [tooltip])

  // Clamp the tooltip inside the strip's own width so it never spills past
  // the edge of the app's content area (looked like a torn/split frame when
  // a tree near the left edge centered a wide tooltip half off-screen).
  // Runs before paint, so the un-clamped position is never visible.
  useLayoutEffect(() => {
    if (!tooltip || !tooltipRef.current || !containerRef.current) return
    const PAD = 6
    const tooltipWidth = tooltipRef.current.offsetWidth
    const containerWidth = containerRef.current.offsetWidth
    const desired = anchor.left - tooltipWidth / 2
    const clamped = Math.min(Math.max(desired, PAD), containerWidth - tooltipWidth - PAD)
    setMeasured({ date: tooltip, left: clamped })
  }, [tooltip, anchor])

  if (!plantedDays.length && monthTreeCount === 0) {
    return (
      <div style={{ textAlign: 'center', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 12, color: '#9B8FC0', padding: '8px 0 4px' }}>
        🌱 Yardım etmek ağacını büyütür
      </div>
    )
  }

  const selected = plantedDays.find(d => d.date === tooltip)
  const isMeasured = measured?.date === tooltip

  function handleDayClick(e, date) {
    if (tooltip === date) { setTooltip(null); return }
    const containerRect = containerRef.current.getBoundingClientRect()
    const btnRect = e.currentTarget.getBoundingClientRect()
    setAnchor({
      left: btnRect.left - containerRect.left + btnRect.width / 2,
      top: btnRect.top - containerRect.top,
    })
    setTooltip(date)
  }

  return (
    // position:relative here (not on the scrolling row below) so the tooltip
    // is a sibling of the scroll row, not a descendant clipped by it — the
    // row's overflowX:'auto' implicitly makes its overflowY 'auto' too,
    // which was clipping a tooltip that popped up *inside* the row.
    <div ref={containerRef} style={{ paddingBottom: 6, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 }}>
        <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 11, color: '#7a6a4c', letterSpacing: '.04em', textTransform: 'uppercase' }}>Bu ay</span>
        <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11.5, color: '#37a06f', background: 'rgba(76,182,133,.14)', padding: '4px 10px', borderRadius: 999 }}>
          🌳 {monthTreeCount} ağaç
        </span>
      </div>
      {selected && (
        // anchored to the tapped tree's own position (measured at click time),
        // then clamped to the strip's bounds once its real width is known.
        <div ref={tooltipRef} style={{
          position: 'absolute',
          left: isMeasured ? measured.left : anchor.left,
          top: anchor.top - 8,
          transform: isMeasured ? 'translateY(-100%)' : 'translate(-50%, -100%)',
          visibility: isMeasured ? 'visible' : 'hidden',
          zIndex: 30,
          background: '#fff', borderRadius: 10, padding: '6px 12px', boxShadow: '0 6px 18px rgba(0,0,0,.16)',
          fontFamily: 'Nunito, sans-serif', color: '#4a3f2e', whiteSpace: 'nowrap',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
        }}>
          <span style={{ fontWeight: 700, fontSize: 11 }}>{formatStripDate(selected.date)}</span>
          <span style={{ fontWeight: 800, fontSize: 10.5, color: '#37a06f' }}>{selected.count} {selected.count === 1 ? 'contribution' : 'contributions'}</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {plantedDays.map(d => {
          const isOpen = tooltip === d.date
          // friendly date label: day number
          const dayNum = d.date.slice(8)
          return (
            <button
              key={d.date}
              data-forest-day
              onClick={(e) => handleDayClick(e, d.date)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, borderRadius: 8,
                outline: isOpen ? '2px solid #4cb685' : 'none', outlineOffset: 1,
              }}
            >
              <TreeArt size={36} fruits={DAY_FULL} target={DAY_FULL} style={{ display: 'block' }} />
              <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 9, color: '#7a6a4c' }}>{dayNum}</span>
            </button>
          )
        })}
      </div>
      <div style={{ textAlign: 'center', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 11.5, color: '#9B8FC0', paddingTop: 6 }}>
        🌱 Yardım etmek ağacını büyütür
      </div>
    </div>
  )
}

// ── forest archive overlay (fox → past months/years, 6-11 bands) ───────────────

function monthLabel(year, month) {
  const raw = new Date(year, month - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function ArchiveMonthCard({ month, isOpen, onToggle }) {
  const days = Array.isArray(month.contributions) ? month.contributions.filter(d => (d.count ?? 0) > 0) : []
  return (
    <div onClick={onToggle} style={{
      background: '#fff', borderRadius: 16, padding: '12px 14px', marginBottom: 9, cursor: 'pointer',
      boxShadow: '0 3px 12px rgba(40,55,40,.07)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 15, color: '#4a3f2e' }}>{monthLabel(month.year, month.month)}</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 12, color: '#37a06f', background: 'rgba(76,182,133,.14)', padding: '3px 10px', borderRadius: 999 }}>
          🌳 {month.trees}
        </span>
      </div>
      {isOpen && days.length > 0 && (
        <div style={{ marginTop: 10, padding: '10px 8px 6px', background: 'linear-gradient(180deg,#F4FAF0,#E8F4E6)', borderRadius: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 2 }}>
          {days.map((d, i) => <TreeArt key={d.date || i} size={22} fruits={d.count} target={DAY_FULL} />)}
        </div>
      )}
    </div>
  )
}

function ArchiveYearRow({ year }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,.7)', borderRadius: 16, padding: '13px 15px', marginBottom: 9 }}>
      <TreeArt size={30} fruits={DAY_FULL} target={DAY_FULL} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 15, color: '#4a3f2e' }}>{year.year}</div>
        <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 12, color: '#37a06f' }}>{year.trees} ağaç yetiştirdin 🌳</div>
      </div>
    </div>
  )
}

function ForestArchive({ open, onClose, data, loading, error }) {
  const [openMonthKey, setOpenMonthKey] = useState(null)
  const months = data?.months || []
  const years = data?.years || []
  const allTime = data?.allTimeTrees ?? 0
  const empty = !loading && !error && months.length === 0 && years.length === 0

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', justifyContent: 'center', pointerEvents: open ? 'auto' : 'none' }}>
      <div style={{
        width: '100%', maxWidth: 430, height: '100%',
        background: 'linear-gradient(180deg,#F2F8EE 0%,#E3F1E4 100%)',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateY(0)' : 'translateY(101%)',
        transition: 'transform .46s cubic-bezier(.3,.9,.3,1)',
      }}>
        <div style={{ flex: '0 0 auto', padding: '18px 18px 10px', position: 'relative' }}>
          <button onClick={onClose} title="Bugüne dön" style={{ position: 'absolute', top: 18, right: 18, width: 34, height: 34, borderRadius: 12, border: 'none', cursor: 'pointer', background: '#fff', color: '#37a06f', fontSize: 16, boxShadow: '0 2px 8px rgba(40,60,40,.12)' }}>✕</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 42 }}>
            <span style={{ fontSize: 24 }}>🦊</span>
            <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 14, color: '#4a3f2e', lineHeight: 1.3 }}>Tilki büyüttüğün ormanı takip ediyor</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 14 }}>
            <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 36, color: '#37a06f', letterSpacing: '-1px' }}>{allTime}</span>
            <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#7a6a4c' }}>ağaç yetiştirdin 🌳</span>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 16px 24px' }}>
          {loading && (
            <div style={{ textAlign: 'center', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, color: '#9B8FC0', padding: '30px 0' }}>Ormanlar yükleniyor…</div>
          )}
          {!loading && error && (
            <div style={{ textAlign: 'center', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, color: '#9B8FC0', padding: '30px 0' }}>Ormanlar şu an yüklenemedi. Biraz sonra tekrar dene 🦊</div>
          )}
          {empty && (
            <div style={{ textAlign: 'center', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, color: '#9B8FC0', padding: '30px 0' }}>Henüz geçmiş bir orman yok — bu ay büyümeye devam et! 🌱</div>
          )}
          {months.length > 0 && (
            <div style={{ paddingTop: 4 }}>
              {months.map(m => {
                const key = `${m.year}-${m.month}`
                return <ArchiveMonthCard key={key} month={m} isOpen={openMonthKey === key} onToggle={() => setOpenMonthKey(k => k === key ? null : key)} />
              })}
            </div>
          )}
          {years.length > 0 && (
            <>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 13, color: '#7a6a4c', padding: '12px 2px 8px' }}>Önceki yıllar</div>
              {years.map(y => <ArchiveYearRow key={y.year} year={y} />)}
            </>
          )}
          {!empty && !loading && !error && (
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 11.5, color: '#9B8FC0', padding: '10px 20px 0', lineHeight: 1.5 }}>
              Tilki büyüttüğün her ormanı saklıyor 🦊🌲
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── intro (6-8 only, shown once) ────────────────────────────────────────────────

function Intro({ onContinue }) {
  return (
    <div style={{
      background: 'linear-gradient(178deg,#EAF7EE 0%,#D2EEDF 100%)', minHeight: '100dvh', maxWidth: 430, margin: '0 auto',
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`@keyframes ttFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '6px 28px 30px', gap: 16 }}>
        <div style={{ animation: 'ttFloat 4.5s ease-in-out infinite' }}>
          <TutoMascot size={130} expression="default" color="#4cb685" />
        </div>
        <div style={{ background: '#fff', borderRadius: 24, padding: '20px 22px', boxShadow: '0 16px 36px -14px rgba(45,80,40,.3), 0 3px 10px rgba(0,0,0,.05)', maxWidth: 282 }}>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 20, color: '#241f3a', marginBottom: 8 }}>Meet your tree! 🌳</div>
          <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 14, color: '#8d83ad', lineHeight: 1.55 }}>
            Every kind thing you do — at home or out in the world — grows a new <b style={{ color: '#37a06f' }}>leaf</b>. Do a little each day and watch your tree grow big.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 12.5, color: '#37a06f', background: 'rgba(76,182,133,.14)', padding: '7px 14px', borderRadius: 999 }}>
          🌱 A new tree starts every month
        </div>
      </div>
      <div style={{ padding: '0 24px 26px' }}>
        <button onClick={onContinue} style={{
          width: '100%', border: 'none', borderRadius: 20, padding: 16, cursor: 'pointer', background: '#4cb685', color: '#fff',
          fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 17, boxShadow: '0 10px 26px rgba(76,182,133,.42)',
        }}>
          Let's grow my tree! →
        </button>
      </div>
    </div>
  )
}

// ── 6-8 · "My Tree" (primary) ───────────────────────────────────────────────────

function BandYoung({ groups, todayCount, monthForest, monthTreeCount, remaining, onAdd, composer, nav, onOpenArchive }) {
  return (
    <div style={{ background: 'linear-gradient(178deg,#EAF7EE 0%,#D7F0E2 100%)', minHeight: '100dvh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px 4px' }}>
        <BackButton onClick={() => nav('/child/home')} />
        <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 23, color: '#37a06f' }}>My Tree 🌳</div>
        <button onClick={onOpenArchive} title="Geçmiş ormanlar" style={{ width: 38, height: 38, borderRadius: '50%', background: '#DCF2E7', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, cursor: 'pointer' }}>🦊</button>
      </div>
      {/* Tree block */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 4 }}>
        <TreeArt size={186} fruits={todayCount} target={DAY_FULL} />
        <div style={{ marginTop: -6, fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 12.5, color: '#37a06f', background: 'rgba(76,182,133,.15)', padding: '6px 14px', borderRadius: 999 }}>
          🌱 {todayCount} {todayCount === 1 ? 'leaf' : 'leaves'} today
        </div>
      </div>
      {/* Forest strip — between tree and diary, always visible */}
      <div style={{ padding: '8px 16px 4px' }}>
        <ForestStrip monthForest={monthForest} monthTreeCount={monthTreeCount} />
      </div>
      {/* Diary paper — flex:1 fills remaining space, scrolls internally */}
      <div style={{ flex: 1, minHeight: 0, padding: '4px 16px 24px' }}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 14, background: 'radial-gradient(120% 100% at 30% 0%, #FFFCF3, #FBF5E7 55%, #F6EFDD)', boxShadow: 'inset 4px 0 10px -8px rgba(0,0,0,.12)' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
            {groups.map(g => (
              <div key={g.date}>
                <DiaryDateHeader isToday={g.isToday} dateStr={g.date} />
                {g.items.map(e => <EntryRow key={e.id} {...e} />)}
              </div>
            ))}
            <div style={{ paddingTop: 12 }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 500, fontSize: 13, color: '#7a6a4c', marginBottom: 8 }}>Did you help today? Tap one 👇</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                {remaining.map(card => <SugCard key={card.id} card={card} onAdd={onAdd} />)}
              </div>
              {remaining.length === 0 && (
                <div style={{ textAlign: 'center', fontFamily: "'Baloo 2', cursive", fontWeight: 500, fontSize: 13, color: '#9B8FC0', padding: '10px 0 2px' }}>Wonderful day! 🌟</div>
              )}
              <div style={{ marginTop: 10 }}>{composer}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 9-11 · intermediate ─────────────────────────────────────────────────────────

function BandMid({ groups, todayCount, monthForest, monthTreeCount, remaining, onAdd, composer, nav, onOpenArchive }) {
  return (
    <div style={{ background: 'linear-gradient(178deg,#EAF4F0 0%,#DCEDE4 100%)', minHeight: '100dvh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px 4px' }}>
        <BackButton onClick={() => nav('/child/home')} />
        <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 20, color: '#37a06f' }}>My Tree 🌳</div>
        <button onClick={onOpenArchive} title="Geçmiş ormanlar" style={{ width: 38, height: 38, borderRadius: '50%', background: '#DCF2E7', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer' }}>🦊</button>
      </div>
      {/* Tree progress strip */}
      <div style={{ margin: '6px 16px 4px', padding: '12px 14px', background: 'rgba(255,255,255,.66)', border: '1.5px solid rgba(255,255,255,.9)', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 6px 18px rgba(40,70,55,.08)' }}>
        <TreeArt size={92} fruits={todayCount} target={DAY_FULL} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 15, color: '#241f3a', marginBottom: 9 }}>{todayCount} {todayCount === 1 ? 'leaf' : 'leaves'} today</div>
          <div style={{ height: 9, borderRadius: 999, background: 'rgba(55,160,111,.18)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, (todayCount / DAY_FULL) * 100)}%`, borderRadius: 999, background: 'linear-gradient(90deg,#6BBF59,#4cb685)', transition: 'width .5s ease' }} />
          </div>
        </div>
      </div>
      {/* Forest strip — between tree strip and diary, always visible */}
      <div style={{ padding: '8px 16px 4px' }}>
        <ForestStrip monthForest={monthForest} monthTreeCount={monthTreeCount} />
      </div>
      {/* Diary paper */}
      <div style={{ flex: 1, minHeight: 0, padding: '4px 16px 24px' }}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 14, background: 'radial-gradient(120% 100% at 30% 0%, #FFFCF3, #FBF5E7 55%, #F6EFDD)', boxShadow: 'inset 4px 0 10px -8px rgba(0,0,0,.12)' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
            {groups.map(g => (
              <div key={g.date}>
                <DiaryDateHeader isToday={g.isToday} dateStr={g.date} />
                {g.items.map(e => <EntryRow key={e.id} {...e} />)}
              </div>
            ))}
            <div style={{ paddingTop: 12 }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 500, fontSize: 13, color: '#7a6a4c', marginBottom: 8 }}>Add to today</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {remaining.map(card => <SugCard key={card.id} card={card} onAdd={onAdd} wide />)}
                {remaining.length === 0 && (
                  <div style={{ textAlign: 'center', fontFamily: "'Baloo 2', cursive", fontWeight: 500, fontSize: 13, color: '#9B8FC0', padding: '4px 0' }}>All caught up — nice work! 🌟</div>
                )}
              </div>
              <div style={{ marginTop: 10 }}>{composer}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 12-15 · "My Part" (mature) ──────────────────────────────────────────────────

function BandMature({ groups, monthCount, remaining, onAdd, composer, nav }) {
  return (
    <div style={{ background: 'linear-gradient(180deg,#F5F7F4 0%,#EAEFEA 100%)', minHeight: '100dvh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 8px' }}>
        <BackButton onClick={() => nav('/child/home')} dark />
        <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 22, color: '#27332c' }}>My Part 💪</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sprig size={26} color="#2f8f6b" />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 16, color: '#2f8f6b', lineHeight: 1 }}>{monthCount}</div>
            <div style={{ fontWeight: 800, fontSize: 9, letterSpacing: '.1em', color: '#6c7c72', textTransform: 'uppercase', marginTop: 1 }}>this month</div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 22px 90px' }}>
        <div style={{ padding: '4px 0 14px' }}>{composer}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingBottom: 18 }}>
          <span style={{ fontWeight: 800, fontSize: 11, color: '#6c7c72' }}>Quick add</span>
          {remaining.map(card => (
            <button key={card.id} onClick={() => onAdd(card)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1.5px solid #E0E6E1',
              borderRadius: 999, padding: '7px 12px', cursor: 'pointer', fontFamily: "'Baloo 2', cursive", fontWeight: 500, fontSize: 12.5, color: '#27332c',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: card.color || CATS[card.category]?.color }} />{card.label}
            </button>
          ))}
          {remaining.length === 0 && <span style={{ fontWeight: 700, fontSize: 12, color: '#6c7c72' }}>— all added today</span>}
        </div>
        {groups.length === 0 && <div style={{ fontSize: 13, fontWeight: 600, color: '#6c7c72', padding: '6px 0' }}>Nothing logged yet today.</div>}
        {groups.map(g => (
          <div key={g.date}>
            <MatureDateHeader isToday={g.isToday} dateStr={g.date} />
            {g.items.map(e => <MatureRow key={e.id} {...e} />)}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── entry point ──────────────────────────────────────────────────────────────────

export default function MyTree() {
  const nav = useNavigate()
  const child = JSON.parse(localStorage.getItem('child') || 'null')
  const band = bandFor(child?.age)

  const [showIntro, setShowIntro] = useState(() => band === 'young' && !localStorage.getItem(`myTreeIntroSeen_${child?.id}`))
  const [entries, setEntries] = useState([])
  const [cards, setCards] = useState([])
  const [approvedMonth, setApprovedMonth] = useState(0)
  const [treeData, setTreeData] = useState({ today: 0, monthForest: [], monthTreeCount: 0, todayDate: null })
  const [loadError, setLoadError] = useState(false)
  const [moderationError, setModerationError] = useState(false)
  const [photoError, setPhotoError] = useState(null)
  const [attachingPhotoId, setAttachingPhotoId] = useState(null)
  const [photoCard, setPhotoCard] = useState(null)  // card awaiting the photo sheet
  const [sheetBusy, setSheetBusy] = useState(false)
  const [submittingFreeText, setSubmittingFreeText] = useState(false)
  const [micro, setMicro] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [archiveData, setArchiveData] = useState(null)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [archiveError, setArchiveError] = useState(false)
  const microTimer = useRef()

  useEffect(() => {
    if (!child?.id) return
    let cancelled = false

    const fetchContributions = () => {
      Promise.all([
        // scope=month still needed for mature band's total-approved-count badge
        fetch(`${SERVER}/api/contributions?child_id=${child.id}&scope=month`).then(r => r.json()),
        // /api/tree is the single source of truth for today's count, forest, and diary list
        fetch(`${SERVER}/api/tree?child_id=${child.id}`).then(r => r.json()),
      ]).then(([monthData, treeResp]) => {
        if (cancelled) return
        // listItems (diary list) now come from /api/tree — every open pending
        // (any date) + today's approved, each tagged with its own local day.
        setEntries(treeResp?.listItems ?? [])
        const monthList = monthData?.contributions || []
        setApprovedMonth(monthList.filter(c => c.status === 'approved').length)
        setTreeData({
          today: treeResp?.today ?? 0,
          monthForest: treeResp?.monthForest ?? [],
          monthTreeCount: treeResp?.monthTreeCount ?? 0,
          todayDate: treeResp?.todayDate ?? null,
        })
      }).catch(() => {
        if (!cancelled) setLoadError(true)
      })
    }

    fetchContributions()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchContributions()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [child?.id])

  useEffect(() => {
    if (!child?.id) return
    let cancelled = false
    fetch(`${SERVER}/api/cards?child_id=${child.id}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setCards(data?.cards || []) })
      .catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [child?.id])

  if (!child?.id) {
    nav('/child/home')
    return null
  }

  // entries now spans every open pending (any date) plus today's approved —
  // group by local day so old pendings show under their own date, not today's.
  const rawGroups = groupEntriesByDate(entries, treeData.todayDate)
  const todayItems = rawGroups.find(g => g.isToday)?.items ?? []

  // Which entries may be photographed. Driven by the card's photo_ok flag, so
  // "I made my bed" can be shown off and "diş fırçalama" is never asked for.
  // Free-text entries match no card — they get the composer's own camera.
  const photoOkKeys = new Set(
    cards.filter(c => c.photo_ok !== false).map(c => `${c.category}::${c.label}`),
  )
  // Bind the per-row photo handlers here so the age-band components can keep
  // spreading the entry straight into EntryRow.
  const groups = rawGroups.map(g => ({
    ...g,
    items: g.items.map(e => ({
      ...e,
      canAddPhoto: !e.photo_url && !String(e.id).startsWith('opt-') && photoOkKeys.has(`${e.category}::${e.label}`),
      attaching: attachingPhotoId === e.id,
      onAttachPhoto: file => attachEntryPhoto(e.id, file),
    })),
  }))

  // Track "used today" by card identity (category+label), not category alone —
  // multiple cards can share a category, and using one must not hide the others.
  // Scoped to today's items only: an old pending from a past day must not hide
  // a card the child hasn't used yet today.
  const usedTodayKeys = new Set(todayItems.map(e => `${e.category}::${e.label}`))
  const remaining = cards.filter(c => !usedTodayKeys.has(`${c.category}::${c.label}`))
  const fruits = approvedMonth      // still used by BandMature monthCount
  const monthCount = approvedMonth  // BandMature only (12-15 — unchanged)

  const showMicro = () => {
    setMicro(true)
    clearTimeout(microTimer.current)
    microTimer.current = setTimeout(() => setMicro(false), 3400)
  }

  // Cards are pre-defined, safe labels — no moderation, so the optimistic
  // pending row can appear instantly and is always trustworthy.
  async function addCardEntry(category, label, source, photoPath) {
    const optimisticId = `opt-${Date.now()}`
    const usedPhoto = photoPath || photoUrl
    setEntries(prev => [{ id: optimisticId, category, label, status: 'pending', fresh: true }, ...prev])
    showMicro()
    setPhotoUrl(null)

    try {
      const res = await fetch(`${SERVER}/api/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: child.id, label, category, source, photo_url: usedPhoto || undefined }),
      })
      // The photo can be rejected by the image gate even though the card label
      // is safe — roll the optimistic row back and say why.
      if (res.status === 400) {
        const body = await res.json().catch(() => ({}))
        if (body.error === 'photo_rejected') {
          setEntries(prev => prev.filter(e => e.id !== optimisticId))
          setPhotoError(body.message || "Couldn't send that photo.")
          setTimeout(() => setPhotoError(null), 4000)
          return
        }
        throw new Error(body.error || 'request failed')
      }
      if (!res.ok) throw new Error('request failed')
      const saved = await res.json()
      setEntries(prev => prev.map(e => e.id === optimisticId ? { ...saved, fresh: true } : e))
    } catch {
      setEntries(prev => prev.filter(e => e.id !== optimisticId))
      setLoadError(true)
      setTimeout(() => setLoadError(false), 3000)
    }
  }

  // Free text goes through server-side moderation, so it must NOT appear as a
  // pending row until the backend has actually accepted it — otherwise a
  // rejected entry flashes "waiting for approval" before disappearing.
  async function addFreeTextEntry(label) {
    const usedPhoto = photoUrl
    setSubmittingFreeText(true)
    setPhotoUrl(null)
    try {
      const res = await fetch(`${SERVER}/api/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: child.id, label, source: 'free_text', photo_url: usedPhoto || undefined }),
      })
      if (res.status === 400) {
        const body = await res.json().catch(() => ({}))
        if (body.error === 'inappropriate') {
          setModerationError(true)
          setTimeout(() => setModerationError(false), 3500)
          return
        }
        if (body.error === 'photo_rejected') {
          setPhotoError(body.message || "Couldn't send that photo.")
          setTimeout(() => setPhotoError(null), 4000)
          return
        }
        throw new Error(body.error || 'request failed')
      }
      if (!res.ok) throw new Error('request failed')
      const saved = await res.json()
      setEntries(prev => [{ ...saved, fresh: true }, ...prev])
      showMicro()
    } catch {
      setLoadError(true)
      setTimeout(() => setLoadError(false), 3000)
    } finally {
      setSubmittingFreeText(false)
    }
  }

  // Photo added AFTER the entry was logged (the "📷 Add a photo" row button).
  async function attachEntryPhoto(entryId, file) {
    setAttachingPhotoId(entryId)
    try {
      const path = await uploadDiaryPhoto(file, child.id)
      const res = await fetch(`${SERVER}/api/contributions/${entryId}/photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_url: path }),
      })
      if (res.status === 400) {
        const body = await res.json().catch(() => ({}))
        setPhotoError(body.message || "Couldn't send that photo.")
        setTimeout(() => setPhotoError(null), 4000)
        return
      }
      if (!res.ok) throw new Error('request failed')
      const saved = await res.json()
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, photo_url: saved.photo_url } : e))
    } catch {
      setLoadError(true)
      setTimeout(() => setLoadError(false), 3000)
    } finally {
      setAttachingPhotoId(null)
    }
  }

  // A card that allows a photo asks first; the rest go straight in, as before.
  const handleAddCard = (card) => {
    if (card.photo_ok !== false) { setPhotoCard(card); return }
    addCardEntry(card.category, card.label, 'card')
  }

  // "Add" from the sheet — with or without a photo.
  async function addCardFromSheet(file) {
    const card = photoCard
    if (!card) return
    setSheetBusy(true)
    try {
      let path = null
      if (file) {
        try {
          path = await uploadDiaryPhoto(file, child.id)
        } catch {
          // Upload failed — don't silently drop the whole contribution, log it
          // without the photo and let the row's button offer a retry.
          setPhotoError("Couldn't send that photo — added without it.")
          setTimeout(() => setPhotoError(null), 4000)
        }
      }
      setPhotoCard(null)
      await addCardEntry(card.category, card.label, 'card', path)
    } finally {
      setSheetBusy(false)
    }
  }
  const handleAddFreeText = (text) => addFreeTextEntry(text)

  const handleAttachPhoto = async (file) => {
    setUploadingPhoto(true)
    try {
      const url = await uploadDiaryPhoto(file, child.id)
      setPhotoUrl(url)
    } catch {
      // photo is optional — silently drop on failure, entry can still be logged without it
    } finally {
      setUploadingPhoto(false)
    }
  }

  const openArchive = () => {
    setShowArchive(true)
    setArchiveLoading(true)
    setArchiveError(false)
    fetch(`${SERVER}/api/tree/archive?child_id=${child.id}`)
      .then(r => r.json())
      .then(data => setArchiveData(data))
      .catch(() => setArchiveError(true))
      .finally(() => setArchiveLoading(false))
  }

  if (showIntro) {
    return (
      <Intro onContinue={() => {
        localStorage.setItem(`myTreeIntroSeen_${child.id}`, '1')
        setShowIntro(false)
      }} />
    )
  }

  const composer = (
    <FreeTextComposer
      prominent={band === 'mature'}
      onSubmit={handleAddFreeText}
      photoUrl={photoUrl}
      uploading={uploadingPhoto}
      submitting={submittingFreeText}
      onAttachPhoto={handleAttachPhoto}
      onRemovePhoto={() => setPhotoUrl(null)}
    />
  )

  return (
    <>
      <style>{`@keyframes ttPop{0%{transform:scale(.7);opacity:0}60%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}`}</style>
      {loadError && (
        <div style={{ position: 'fixed', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: '#FFF0EE', color: '#D63030', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 12.5, padding: '8px 16px', borderRadius: 12, boxShadow: '0 4px 14px rgba(0,0,0,.12)' }}>
          ⚠️ Couldn't reach the server — try again in a bit.
        </div>
      )}
      {moderationError && (
        <div style={{ position: 'fixed', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: '#FFF6E2', color: '#9B6E1A', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 12.5, padding: '8px 16px', borderRadius: 12, boxShadow: '0 4px 14px rgba(0,0,0,.12)' }}>
          Couldn't add that — try writing something else.
        </div>
      )}
      {photoError && (
        <div style={{ position: 'fixed', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: '#FFF6E2', color: '#9B6E1A', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 12.5, padding: '8px 16px', borderRadius: 12, boxShadow: '0 4px 14px rgba(0,0,0,.12)' }}>
          {photoError}
        </div>
      )}
      {band === 'young' && (
        <BandYoung groups={groups} todayCount={treeData.today} monthForest={treeData.monthForest} monthTreeCount={treeData.monthTreeCount} remaining={remaining} onAdd={handleAddCard} composer={composer} nav={nav} onOpenArchive={openArchive} />
      )}
      {band === 'mid' && (
        <BandMid groups={groups} todayCount={treeData.today} monthForest={treeData.monthForest} monthTreeCount={treeData.monthTreeCount} remaining={remaining} onAdd={handleAddCard} composer={composer} nav={nav} onOpenArchive={openArchive} />
      )}
      {band === 'mature' && (
        <BandMature groups={groups} monthCount={monthCount} remaining={remaining} onAdd={handleAddCard} composer={composer} nav={nav} />
      )}
      <Micro show={micro} msg={MICRO_COPY[band]} />
      {/* every band adds cards, so the photo sheet is not band-scoped */}
      <CardPhotoSheet card={photoCard} busy={sheetBusy}
        onCancel={() => { if (!sheetBusy) setPhotoCard(null) }} onAdd={addCardFromSheet} />
      {band !== 'mature' && (
        <ForestArchive open={showArchive} onClose={() => setShowArchive(false)} data={archiveData} loading={archiveLoading} error={archiveError} />
      )}
    </>
  )
}
