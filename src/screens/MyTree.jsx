import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
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

const TODAY_LABEL = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

async function uploadDiaryPhoto(file, childId) {
  const path = `${childId ?? 'anonymous'}/diary-${Date.now()}.jpg`
  const { error } = await supabase.storage.from('submissions').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('submissions').getPublicUrl(path)
  return data.publicUrl
}

// ── shared pieces ──────────────────────────────────────────────────────────────

function EntryRow({ category, label, status, fresh }) {
  const C = CATS[category] || CATS.outside
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

function ForestStrip({ monthForest, monthTreeCount }) {
  const [tooltip, setTooltip] = useState(null)
  // days this month that have at least one contribution
  const plantedDays = (monthForest || []).filter(d => d.count > 0)

  if (!plantedDays.length && monthTreeCount === 0) {
    return (
      <div style={{ textAlign: 'center', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 12, color: '#9B8FC0', padding: '8px 0 4px' }}>
        🌱 Yardım etmek ağacını büyütür
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 }}>
        <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 11, color: '#7a6a4c', letterSpacing: '.04em', textTransform: 'uppercase' }}>Bu ay</span>
        <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11.5, color: '#37a06f', background: 'rgba(76,182,133,.14)', padding: '4px 10px', borderRadius: 999 }}>
          🌳 {monthTreeCount} ağaç
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {plantedDays.map(d => {
          const isOpen = tooltip === d.date
          // friendly date label: day number
          const dayNum = d.date.slice(8)
          return (
            <div key={d.date} style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => setTooltip(isOpen ? null : d.date)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
              >
                <TreeArt size={36} fruits={DAY_FULL} target={DAY_FULL} style={{ display: 'block' }} />
                <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 9, color: '#7a6a4c' }}>{dayNum}</span>
              </button>
              {isOpen && (
                <div style={{
                  position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
                  background: '#fff', borderRadius: 10, padding: '6px 10px', boxShadow: '0 6px 18px rgba(0,0,0,.16)',
                  fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 11, color: '#4a3f2e',
                  whiteSpace: 'nowrap', zIndex: 20,
                }}>
                  {d.date} · {d.count} katkı
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ textAlign: 'center', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 11.5, color: '#9B8FC0', paddingTop: 6 }}>
        🌱 Yardım etmek ağacını büyütür
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

function BandYoung({ entries, todayCount, monthForest, monthTreeCount, remaining, onAdd, composer, nav }) {
  return (
    <div style={{ background: 'linear-gradient(178deg,#EAF7EE 0%,#D7F0E2 100%)', minHeight: '100dvh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px 4px' }}>
        <BackButton onClick={() => nav('/child/home')} />
        <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 23, color: '#37a06f' }}>My Tree 🌳</div>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#DCF2E7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🦊</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 6 }}>
        <TreeArt size={186} fruits={todayCount} target={DAY_FULL} />
        <div style={{ marginTop: -6, fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 12.5, color: '#37a06f', background: 'rgba(76,182,133,.15)', padding: '6px 14px', borderRadius: 999 }}>
          🌱 {todayCount} {todayCount === 1 ? 'katkı' : 'katkı'} bugün
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: '12px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 14, background: 'radial-gradient(120% 100% at 30% 0%, #FFFCF3, #FBF5E7 55%, #F6EFDD)', boxShadow: 'inset 4px 0 10px -8px rgba(0,0,0,.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 16px 6px' }}>
            <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: '#37a06f' }}>Today</span>
            <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 600, fontSize: 17, color: '#4a3f2e' }}>{TODAY_LABEL}</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
            {entries.map(e => <EntryRow key={e.id} {...e} />)}
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
        <div style={{ padding: '4px 4px 8px' }}>
          <ForestStrip monthForest={monthForest} monthTreeCount={monthTreeCount} />
        </div>
      </div>
    </div>
  )
}

// ── 9-11 · intermediate ─────────────────────────────────────────────────────────

function BandMid({ entries, todayCount, monthForest, monthTreeCount, remaining, onAdd, composer, nav }) {
  return (
    <div style={{ background: 'linear-gradient(178deg,#EAF4F0 0%,#DCEDE4 100%)', minHeight: '100dvh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px 4px' }}>
        <BackButton onClick={() => nav('/child/home')} />
        <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 20, color: '#37a06f' }}>My Tree 🌳</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11.5, color: '#2f8f6b', background: 'rgba(76,182,133,.16)', padding: '6px 12px', borderRadius: 999 }}>
          🌳 {monthTreeCount} this month
        </div>
      </div>
      <div style={{ margin: '6px 16px 4px', padding: '12px 14px', background: 'rgba(255,255,255,.66)', border: '1.5px solid rgba(255,255,255,.9)', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 6px 18px rgba(40,70,55,.08)' }}>
        <TreeArt size={92} fruits={todayCount} target={DAY_FULL} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 15, color: '#241f3a', marginBottom: 9 }}>{todayCount} katkı bugün</div>
          <div style={{ height: 9, borderRadius: 999, background: 'rgba(55,160,111,.18)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, (todayCount / DAY_FULL) * 100)}%`, borderRadius: 999, background: 'linear-gradient(90deg,#6BBF59,#4cb685)', transition: 'width .5s ease' }} />
          </div>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: '10px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 14, background: 'radial-gradient(120% 100% at 30% 0%, #FFFCF3, #FBF5E7 55%, #F6EFDD)', boxShadow: 'inset 4px 0 10px -8px rgba(0,0,0,.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 16px 6px' }}>
            <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: '#37a06f' }}>Today</span>
            <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 600, fontSize: 17, color: '#4a3f2e' }}>{TODAY_LABEL}</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
            {entries.map(e => <EntryRow key={e.id} {...e} />)}
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
        <div style={{ padding: '0 4px 6px' }}>
          <ForestStrip monthForest={monthForest} monthTreeCount={monthTreeCount} />
        </div>
      </div>
    </div>
  )
}

// ── 12-15 · "My Part" (mature) ──────────────────────────────────────────────────

function BandMature({ entries, monthCount, remaining, onAdd, composer, nav }) {
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
        <div style={{ fontWeight: 800, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6c7c72', paddingBottom: 4 }}>Today</div>
        {entries.length === 0 && <div style={{ fontSize: 13, fontWeight: 600, color: '#6c7c72', padding: '6px 0' }}>Nothing logged yet today.</div>}
        {entries.map(e => <MatureRow key={e.id} {...e} />)}
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
  const [treeData, setTreeData] = useState({ today: 0, monthForest: [], monthTreeCount: 0 })
  const [loadError, setLoadError] = useState(false)
  const [moderationError, setModerationError] = useState(false)
  const [submittingFreeText, setSubmittingFreeText] = useState(false)
  const [micro, setMicro] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const microTimer = useRef()

  useEffect(() => {
    if (!child?.id) return
    let cancelled = false

    const fetchContributions = () => {
      Promise.all([
        fetch(`${SERVER}/api/contributions?child_id=${child.id}&scope=today`).then(r => r.json()),
        fetch(`${SERVER}/api/contributions?child_id=${child.id}&scope=month`).then(r => r.json()),
        fetch(`${SERVER}/api/tree?child_id=${child.id}`).then(r => r.json()),
      ]).then(([todayData, monthData, treeResp]) => {
        if (cancelled) return
        setEntries((todayData?.contributions || []).filter(c => c.status !== 'rejected'))
        const monthList = monthData?.contributions || []
        setApprovedMonth(monthList.filter(c => c.status === 'approved').length)
        setTreeData({
          today: treeResp?.today ?? 0,
          monthForest: treeResp?.monthForest ?? [],
          monthTreeCount: treeResp?.monthTreeCount ?? 0,
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

  // Track "used today" by card identity (category+label), not category alone —
  // multiple cards can share a category, and using one must not hide the others.
  const usedTodayKeys = new Set(entries.map(e => `${e.category}::${e.label}`))
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
  async function addCardEntry(category, label, source) {
    const optimisticId = `opt-${Date.now()}`
    const usedPhoto = photoUrl
    setEntries(prev => [{ id: optimisticId, category, label, status: 'pending', fresh: true }, ...prev])
    showMicro()
    setPhotoUrl(null)

    try {
      const res = await fetch(`${SERVER}/api/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: child.id, label, category, source, photo_url: usedPhoto || undefined }),
      })
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

  const handleAddCard = (card) => addCardEntry(card.category, card.label, 'card')
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
      {band === 'young' && (
        <BandYoung entries={entries} todayCount={treeData.today} monthForest={treeData.monthForest} monthTreeCount={treeData.monthTreeCount} remaining={remaining} onAdd={handleAddCard} composer={composer} nav={nav} />
      )}
      {band === 'mid' && (
        <BandMid entries={entries} todayCount={treeData.today} monthForest={treeData.monthForest} monthTreeCount={treeData.monthTreeCount} remaining={remaining} onAdd={handleAddCard} composer={composer} nav={nav} />
      )}
      {band === 'mature' && (
        <BandMature entries={entries} monthCount={monthCount} remaining={remaining} onAdd={handleAddCard} composer={composer} nav={nav} />
      )}
      <Micro show={micro} msg={MICRO_COPY[band]} />
    </>
  )
}
