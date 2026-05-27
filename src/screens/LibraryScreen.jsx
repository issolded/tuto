import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'
import { supabase } from '../lib/supabase'

const ACCENT = '#FF6B35'

const NAV = [
  { icon: '🏠', label: 'Home',    route: '/child/home'    },
  { icon: '📚', label: 'Library', route: '/child/library' },
  { icon: '⭐', label: 'Gems',    route: '/child/gems'   },
  { icon: '🏆', label: 'Goals',   route: '/child/goals'  },
]

const ANIM_CSS = `
@keyframes jiggle {
  0%, 100% { transform: rotate(0deg); }
  25%       { transform: rotate(-2deg); }
  75%       { transform: rotate(2deg); }
}
@keyframes pulse {
  0%, 50%, 100% { transform: scale(1); }
  25%, 75%      { transform: scale(1.2); }
}
@keyframes shrink {
  from { transform: scale(1); opacity: 1; }
  to   { transform: scale(0); opacity: 0; }
}
@keyframes flyUp {
  0%   { transform: translateY(0) scale(1); opacity: 1; }
  55%  { transform: translateY(-36px) scale(1.04); opacity: 1;
          filter: drop-shadow(0 0 18px rgba(46,196,134,0.75)); }
  100% { transform: translateY(-90px) scale(0.85); opacity: 0; }
}
@keyframes confettiFly {
  from { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
  to   { transform: translateY(-300px) rotate(600deg) scale(0.3); opacity: 0; }
}
@keyframes toastSlideUp {
  from { transform: translateY(72px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@keyframes fadeInCard {
  from { transform: translateY(20px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
`

const CONFETTI = [
  { color: '#FF6B35', left: '12%', delay: '0s'    },
  { color: '#FFD93D', left: '26%', delay: '0.09s' },
  { color: '#2EC486', left: '41%', delay: '0.04s' },
  { color: '#6C63FF', left: '57%', delay: '0.14s' },
  { color: '#FF3B30', left: '72%', delay: '0.07s' },
  { color: '#34C0EB', left: '86%', delay: '0.11s' },
]

function useLongPress(onLongPress, ms = 600) {
  const timer = useRef(null)
  return {
    onTouchStart: () => { timer.current = setTimeout(onLongPress, ms) },
    onTouchEnd:   () => clearTimeout(timer.current),
    onTouchMove:  () => clearTimeout(timer.current),
  }
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function LibraryScreen() {
  const nav = useNavigate()
  const child = JSON.parse(localStorage.getItem('child') || 'null')
  const [books, setBooks] = useState(null)
  const [jiggling, setJiggling] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId]   = useState(null)
  const [confirmCompleteId, setConfirmCompleteId] = useState(null)
  const [deletingId, setDeletingId]     = useState(null)
  const [completingId, setCompletingId] = useState(null)
  const [celebrationTitle, setCelebrationTitle] = useState(null)

  useEffect(() => {
    if (!child?.id) { setBooks([]); return }
    supabase
      .from('books')
      .select('*')
      .eq('child_id', child.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setBooks(data ?? []))
      .catch(() => setBooks([]))
  }, [])

  async function handleDeleteConfirm() {
    const id = confirmDeleteId
    setConfirmDeleteId(null)
    setJiggling(false)
    setDeletingId(id)
    setTimeout(async () => {
      setDeletingId(null)
      setBooks(prev => prev.filter(b => b.id !== id))
      const { data, error } = await supabase.from('books').delete().eq('id', id).select()
      console.log('Deleted book id:', id)
      console.log('Error:', error)
      console.log('Data:', data)
      if (error) {
        console.error('Delete error:', error)
        alert('Could not delete: ' + error.message)
      }
    }, 320)
  }

  async function handleMarkCompleteConfirm() {
    const id = confirmCompleteId
    const title = books?.find(b => b.id === id)?.title ?? 'the book'
    setConfirmCompleteId(null)
    setJiggling(false)
    setCompletingId(id)
    setTimeout(async () => {
      setCompletingId(null)
      setBooks(prev => prev.map(b => b.id === id ? { ...b, completed: true } : b))
      setCelebrationTitle(title)
      await supabase.from('books').update({ completed: true }).eq('id', id)
    }, 430)
  }

  const lp = useLongPress(() => setJiggling(true))
  const inProgress = (books ?? []).filter(b => !b.completed)
  const completed  = (books ?? []).filter(b =>  b.completed)

  return (
    <div
      style={{ background: '#F4F4F8', minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}
      onClick={() => jiggling && setJiggling(false)}
    >
      <style>{ANIM_CSS}</style>

      {/* Header */}
      <div style={{ background: 'white', padding: '52px 20px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 0 #EBEBEB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={e => { e.stopPropagation(); nav('/child/home') }}
            style={{ width: 40, height: 40, borderRadius: 12, background: '#F5F5F5', border: 'none', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1A1A2E' }}
          >←</button>
          <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#1A1A2E' }}>My Books 📚</span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); nav('/child/reading') }}
          style={{ width: 44, height: 44, borderRadius: 14, background: ACCENT, border: 'none', fontSize: 24, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(255,107,53,0.40)', animation: 'pulse 1s ease-in-out 1' }}
        >+</button>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 16px 80px', flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 30, fontWeight: 800, color: '#1A1A2E', marginBottom: 20 }}>
          My Library 📚
        </div>

        {books === null ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <TutoMascot size={110} />
          </div>
        ) : books.length === 0 ? (
          <EmptyState onAdd={() => nav('/child/reading')} />
        ) : (
          <>
            {inProgress.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: '#1A1A2E', marginBottom: 14 }}>
                  Reading Now 📖
                </div>
                <BookGrid
                  books={inProgress}
                  jiggling={jiggling}
                  longPress={lp}
                  deletingId={deletingId}
                  completingId={completingId}
                  onDeleteRequest={id => setConfirmDeleteId(id)}
                  onCompleteRequest={id => setConfirmCompleteId(id)}
                  onTap={book => { if (!jiggling) nav('/child/reading', { state: { book } }) }}
                />
              </div>
            )}

            {completed.length > 0 && (
              <div>
                <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: '#1A1A2E', marginBottom: 10 }}>
                  Finished Books 🏆
                </div>
                <div style={{ background: 'linear-gradient(135deg, #2EC486 0%, #22A876 100%)', borderRadius: 16, padding: '14px 18px', marginBottom: 14, boxShadow: '0 4px 16px rgba(46,196,134,0.25)' }}>
                  <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: 'white' }}>
                    You've read {completed.length} book{completed.length > 1 ? 's' : ''}! Keep it up! 🌟
                  </div>
                </div>
                <BookGrid
                  books={completed}
                  jiggling={jiggling}
                  longPress={lp}
                  deletingId={deletingId}
                  completingId={null}
                  onDeleteRequest={id => setConfirmDeleteId(id)}
                  onCompleteRequest={null}
                  onTap={() => {}}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {confirmDeleteId && (
        <ConfirmDeleteModal
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {confirmCompleteId && (
        <ConfirmCompleteModal
          onConfirm={handleMarkCompleteConfirm}
          onCancel={() => setConfirmCompleteId(null)}
        />
      )}

      {/* Celebration */}
      {celebrationTitle && (
        <CelebrationToast
          title={celebrationTitle}
          onDone={() => setCelebrationTitle(null)}
        />
      )}

      {/* Bottom nav */}
      <div style={{ background: 'white', padding: '10px 4px 28px', display: 'flex', justifyContent: 'space-around', borderTop: '1px solid #F0F0E0', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100 }}>
        {NAV.map(({ icon, label, route }) => {
          const active = label === 'Library'
          return (
            <button
              key={label}
              onClick={() => route && nav(route)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 14px', borderRadius: 16, background: active ? '#FFE8D4' : 'none', border: 'none', cursor: route ? 'pointer' : 'default', minWidth: 60 }}
            >
              <span style={{ fontSize: 22 }}>{icon}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: active ? '#FF6B35' : '#A0A0BC', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Book grid ────────────────────────────────────────────────────────────────

function BookGrid({ books, jiggling, longPress, deletingId, completingId, onDeleteRequest, onCompleteRequest, onTap }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {books.map(book => (
        <BookCard
          key={book.id}
          book={book}
          jiggling={jiggling}
          longPress={longPress}
          isDeleting={deletingId === book.id}
          isCompleting={completingId === book.id}
          onDeleteRequest={() => onDeleteRequest(book.id)}
          onCompleteRequest={onCompleteRequest ? () => onCompleteRequest(book.id) : null}
          onTap={() => onTap(book)}
        />
      ))}
    </div>
  )
}

// ─── Book card ─────────────────────────────────────────────────────────────────

function BookCard({ book, jiggling, longPress, isDeleting, isCompleting, onDeleteRequest, onCompleteRequest, onTap }) {
  const busy = isDeleting || isCompleting
  const animation = isDeleting
    ? 'shrink 0.3s ease-in forwards'
    : isCompleting
    ? 'flyUp 0.42s ease-out forwards'
    : jiggling
    ? 'jiggle 0.38s ease-in-out infinite'
    : 'none'

  return (
    <div
      onClick={busy ? undefined : onTap}
      {...(busy ? {} : longPress)}
      style={{
        background: 'white',
        borderRadius: 20,
        boxShadow: '0 4px 18px rgba(0,0,0,0.09)',
        cursor: busy ? 'default' : 'pointer',
        position: 'relative',
        overflow: 'visible',
        animation,
        transformOrigin: 'center 60%',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        animationFillMode: busy ? 'forwards' : undefined,
      }}
    >
      {/* Delete badge — top right */}
      {jiggling && !busy && (
        <Badge
          onClick={e => { e.stopPropagation(); onDeleteRequest() }}
          color="#FF3B30"
          style={{ top: 4, right: 4 }}
        >−</Badge>
      )}

      {/* Mark-complete badge — top left */}
      {jiggling && !busy && onCompleteRequest && (
        <Badge
          onClick={e => { e.stopPropagation(); onCompleteRequest() }}
          color="#2EC486"
          style={{ top: 4, left: 4 }}
        >✓</Badge>
      )}

      {/* Cover — aspect ratio 2:3 */}
      <div style={{ position: 'relative', borderRadius: '20px 20px 0 0', overflow: 'hidden', aspectRatio: '2/3', background: '#F0EBE3' }}>
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44 }}>📖</div>
        )}
        {book.completed && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: '#2EC486', borderRadius: 8, padding: '2px 7px', fontSize: 12, fontWeight: 800, color: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>✅</div>
        )}
      </div>

      {/* Title + progress */}
      <div style={{ padding: '9px 10px 11px' }}>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 800, color: '#1A1A2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
          {book.title}
        </div>
        {!book.completed && (book.current_page ?? 0) > 0 && (
          <div style={{ background: '#F0F0FA', borderRadius: 4, height: 4, overflow: 'hidden', marginTop: 6 }}>
            <div style={{ width: `${Math.min(((book.current_page ?? 0) / 10) * 100, 100)}%`, height: '100%', borderRadius: 4, background: ACCENT }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Badge button ─────────────────────────────────────────────────────────────

function Badge({ onClick, color, style, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute',
        width: 44, height: 44, borderRadius: '50%',
        background: color, color: 'white',
        border: '3px solid white',
        fontSize: 20, fontWeight: 900, lineHeight: 1,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10,
        boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
        padding: 8,
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
    >{children}</button>
  )
}

// ─── Confirm delete modal ──────────────────────────────────────────────────────

function ConfirmDeleteModal({ onConfirm, onCancel }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onCancel() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 28 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: 28, padding: '32px 24px 24px', width: '100%', maxWidth: 320, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', textAlign: 'center' }}
      >
        <div style={{ fontSize: 44, marginBottom: 12 }}>📚</div>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#1A1A2E', marginBottom: 8 }}>Remove this book?</div>
        <div style={{ fontSize: 14, color: '#7A7A9A', fontWeight: 600, marginBottom: 28, lineHeight: 1.5 }}>
          Are you sure you want to remove this book from your library?
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: '14px', border: 'none', borderRadius: 14, background: '#F0F0F5', color: '#1A1A2E', fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, cursor: 'pointer' }}
          >Cancel</button>
          <button
            onClick={onConfirm}
            style={{ flex: 1, padding: '14px', border: 'none', borderRadius: 14, background: '#FF3B30', color: 'white', fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(255,59,48,0.35)' }}
          >Remove</button>
        </div>
      </div>
    </div>
  )
}

// ─── Confirm complete modal ────────────────────────────────────────────────────

function ConfirmCompleteModal({ onConfirm, onCancel }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onCancel() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 28 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: 32, padding: '28px 24px 24px', width: '100%', maxWidth: 320, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', textAlign: 'center' }}
      >
        <TutoMascot size={90} />
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 21, fontWeight: 800, color: '#1A1A2E', margin: '12px 0 24px', lineHeight: 1.4 }}>
          Wow, did you really finish the whole book? 🎉
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onConfirm}
            style={{ padding: '16px', border: 'none', borderRadius: 16, background: '#2EC486', color: 'white', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(46,196,134,0.35)' }}
          >Yes, I read it all! 📚</button>
          <button
            onClick={onCancel}
            style={{ padding: '14px', border: 'none', borderRadius: 16, background: '#F0F0F5', color: '#7A7A9A', fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
          >Not yet...</button>
        </div>
      </div>
    </div>
  )
}

// ─── Celebration toast ────────────────────────────────────────────────────────

function CelebrationToast({ title, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3400)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      {/* Confetti */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 200, overflow: 'hidden' }}>
        {CONFETTI.map((p, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.left,
              bottom: '28%',
              width: 13, height: 13,
              borderRadius: '50%',
              background: p.color,
              animation: `confettiFly 1.1s ease-out ${p.delay} forwards`,
            }}
          />
        ))}
      </div>

      {/* Toast */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', padding: '0 20px 32px', zIndex: 150, pointerEvents: 'none' }}>
        <div
          style={{
            animation: 'toastSlideUp 0.4s ease-out forwards',
            width: '100%',
            maxWidth: 390,
            background: 'linear-gradient(135deg, #2EC486 0%, #1DB974 100%)',
            borderRadius: 24,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 12px 40px rgba(46,196,134,0.45)',
            pointerEvents: 'auto',
          }}
        >
          <TutoMascot size={60} style={{ flexShrink: 0 }} />
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: 'white', lineHeight: 1.4 }}>
            Amazing! You finished<br />
            <span style={{ fontSize: 15, fontWeight: 700, opacity: 0.9 }}>{title}</span>! 🌟
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '65vh', gap: 24 }}>
      <TutoMascot size={120} />
      <div style={{ background: 'white', borderRadius: 24, padding: '22px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', width: '100%', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 700, color: '#1A1A2E', lineHeight: 1.5 }}>
          No books yet!<br />Add your first one 📖
        </div>
      </div>
      <button
        onClick={onAdd}
        style={{ background: ACCENT, color: 'white', border: 'none', borderRadius: 18, padding: '18px 0', fontFamily: "'Baloo 2', cursive", fontSize: 19, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 24px rgba(255,107,53,0.35)', width: '100%' }}
      >
        Add my first book! 🌟
      </button>
    </div>
  )
}
