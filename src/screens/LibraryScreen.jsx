import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'
import StoryCover from '../components/StoryCover'
import BookShelfGrid from '../components/BookShelfGrid'
import BottomNav from '../components/BottomNav'
import BookOpenTransition from '../components/BookOpenTransition'
import { supabase, getChildStories } from '../lib/supabase'

const ACCENT = '#FF6B35'

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

const STORY_BG_COLORS = ['#E8E0FF', '#D4F5E0', '#FFF0D4', '#D4E8FF', '#FFD4E8', '#F0FFD4']

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
  const [stories, setStories] = useState(null)
  const [jiggling, setJiggling] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId]   = useState(null)
  const [confirmCompleteId, setConfirmCompleteId] = useState(null)
  const [deletingId, setDeletingId]     = useState(null)
  const [completingId, setCompletingId] = useState(null)
  const [celebrationTitle, setCelebrationTitle] = useState(null)
  const [opening, setOpening] = useState(null) // { story, fallbackColor } — book-open transition before entering the editor

  useEffect(() => {
    if (!child?.id) { setBooks([]); setStories([]); return }
    supabase
      .from('books')
      .select('*')
      .eq('child_id', child.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setBooks(data ?? []))
      .catch(() => setBooks([]))
    getChildStories(child.id)
      .then(data => setStories(data))
      .catch(() => setStories([]))
  }, [])

  async function handleDeleteConfirm() {
    const id = confirmDeleteId
    setConfirmDeleteId(null)
    setJiggling(false)
    setDeletingId(id)
    setTimeout(async () => {
      setDeletingId(null)
      setBooks(prev => prev.filter(b => b.id !== id))
      await supabase.from('books').delete().eq('id', id)
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
      <div style={{ background: 'white', padding: '52px 20px 18px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 1px 0 #EBEBEB' }}>
        <button
          onClick={e => { e.stopPropagation(); nav('/child/home') }}
          style={{ width: 40, height: 40, borderRadius: 12, background: '#F5F5F5', border: 'none', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1A1A2E' }}
        >←</button>
        <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#1A1A2E' }}>My Library 📚</span>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 16px 80px', flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

        {/* ── Books by child ── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: '#1A1A2E' }}>
              📖 Books by {child?.name ?? 'You'}
            </div>
            <button
              onClick={e => { e.stopPropagation(); nav('/child/stories', { state: { from: '/child/library' } }) }}
              style={{ background: '#E8E0FF', color: '#6C63FF', border: 'none', borderRadius: 12, padding: '6px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Baloo 2', cursive" }}
            >
              ✏️ Write
            </button>
          </div>

          {stories === null ? (
            <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A0A0BC', fontSize: 14 }}>Loading...</div>
          ) : stories.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 20, padding: '24px 20px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✏️</div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, color: '#1A1A2E', marginBottom: 12 }}>No stories yet!</div>
              <button
                onClick={e => { e.stopPropagation(); nav('/child/stories', { state: { from: '/child/library' } }) }}
                style={{ background: '#6C63FF', color: 'white', border: 'none', borderRadius: 14, padding: '11px 22px', fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
              >
                Write your first story →
              </button>
            </div>
          ) : (
            <BookShelfGrid
              items={stories}
              renderItem={(story, i) => (
                <StoryCover key={story.id} story={story} fallbackColor={STORY_BG_COLORS[i % STORY_BG_COLORS.length]} childName={child?.name} onTap={() => setOpening({ story, fallbackColor: STORY_BG_COLORS[i % STORY_BG_COLORS.length] })} />
              )}
            />
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#E8E8EE', marginBottom: 28 }} />

        {/* ── Books from other authors ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: '#1A1A2E' }}>
              📚 Books from Other Authors
            </div>
            <button
              onClick={e => { e.stopPropagation(); nav('/child/reading') }}
              style={{ background: '#FFE8D4', color: ACCENT, border: 'none', borderRadius: 12, padding: '6px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Baloo 2', cursive" }}
            >
              + Add
            </button>
          </div>

          {books === null ? (
            <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A0A0BC', fontSize: 14 }}>Loading...</div>
          ) : books.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 20, padding: '24px 20px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📚</div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, color: '#1A1A2E', marginBottom: 12 }}>No books yet!</div>
              <button
                onClick={e => { e.stopPropagation(); nav('/child/reading') }}
                style={{ background: ACCENT, color: 'white', border: 'none', borderRadius: 14, padding: '11px 22px', fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
              >
                Add your first book →
              </button>
            </div>
          ) : (
            <>
              {inProgress.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: '#1A1A2E', marginBottom: 12 }}>
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
                  <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: '#1A1A2E', marginBottom: 10 }}>
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

      <BottomNav active="library" fixed />

      {opening && (
        <BookOpenTransition
          key={opening.story.id}
          story={opening.story}
          childName={child?.name}
          fallbackColor={opening.fallbackColor}
          onClose={() => setOpening(null)}
          onEdit={() => nav('/child/stories', { state: { story: opening.story, from: '/child/library' } })}
        />
      )}
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
      {jiggling && !busy && (
        <Badge onClick={e => { e.stopPropagation(); onDeleteRequest() }} color="#FF3B30" style={{ top: 4, right: 4 }}>−</Badge>
      )}
      {jiggling && !busy && onCompleteRequest && (
        <Badge onClick={e => { e.stopPropagation(); onCompleteRequest() }} color="#2EC486" style={{ top: 4, left: 4 }}>✓</Badge>
      )}
      <div style={{ position: 'relative', borderRadius: '20px 20px 0 0', overflow: 'hidden', aspectRatio: '2/3', background: '#F0EBE3' }}>
        {book.cover_url ? (
          <img src={book.cover_url} alt={book.title} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44 }}>📖</div>
        )}
        {book.completed && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: '#2EC486', borderRadius: 8, padding: '2px 7px', fontSize: 12, fontWeight: 800, color: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>✅</div>
        )}
      </div>
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
    <div onClick={e => { e.stopPropagation(); onCancel() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 28 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 28, padding: '32px 24px 24px', width: '100%', maxWidth: 320, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>📚</div>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#1A1A2E', marginBottom: 8 }}>Remove this book?</div>
        <div style={{ fontSize: 14, color: '#7A7A9A', fontWeight: 600, marginBottom: 28, lineHeight: 1.5 }}>Are you sure you want to remove this book from your library?</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '14px', border: 'none', borderRadius: 14, background: '#F0F0F5', color: '#1A1A2E', fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '14px', border: 'none', borderRadius: 14, background: '#FF3B30', color: 'white', fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(255,59,48,0.35)' }}>Remove</button>
        </div>
      </div>
    </div>
  )
}

// ─── Confirm complete modal ────────────────────────────────────────────────────

function ConfirmCompleteModal({ onConfirm, onCancel }) {
  return (
    <div onClick={e => { e.stopPropagation(); onCancel() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 28 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 32, padding: '28px 24px 24px', width: '100%', maxWidth: 320, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', textAlign: 'center' }}>
        <TutoMascot size={90} />
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 21, fontWeight: 800, color: '#1A1A2E', margin: '12px 0 24px', lineHeight: 1.4 }}>
          Wow, did you really finish the whole book? 🎉
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={onConfirm} style={{ padding: '16px', border: 'none', borderRadius: 16, background: '#2EC486', color: 'white', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(46,196,134,0.35)' }}>Yes, I read it all! 📚</button>
          <button onClick={onCancel} style={{ padding: '14px', border: 'none', borderRadius: 16, background: '#F0F0F5', color: '#7A7A9A', fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>Not yet...</button>
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
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 200, overflow: 'hidden' }}>
        {CONFETTI.map((p, i) => (
          <div key={i} style={{ position: 'absolute', left: p.left, bottom: '28%', width: 13, height: 13, borderRadius: '50%', background: p.color, animation: `confettiFly 1.1s ease-out ${p.delay} forwards` }} />
        ))}
      </div>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', padding: '0 20px 32px', zIndex: 150, pointerEvents: 'none' }}>
        <div style={{ animation: 'toastSlideUp 0.4s ease-out forwards', width: '100%', maxWidth: 390, background: 'linear-gradient(135deg, #2EC486 0%, #1DB974 100%)', borderRadius: 24, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 12px 40px rgba(46,196,134,0.45)', pointerEvents: 'auto' }}>
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
