import { useState } from 'react'
import { StoryCoverFace } from './StoryCover'

const LINES_WIDTHS = ['62%', '90%', '80%', '94%', '55%', '86%']

function FillerLines() {
  return (
    <div style={{ padding: '26px 22px', display: 'flex', flexDirection: 'column', gap: 11 }}>
      {LINES_WIDTHS.map((w, i) => (
        <span key={i} style={{ display: 'block', height: 4, borderRadius: 3, background: '#dcccee', width: w }} />
      ))}
    </div>
  )
}

// Full-screen "open the book" transition: a child's StoryCover swings open on its
// left edge (matching the Dribbble "History" reference) to reveal the reading page
// underneath, set in the same book type as the gentle-spelling editor. Mount this
// fresh (give it a changing `key` from the caller) each time a cover is tapped —
// the CSS keyframe animation plays automatically on mount, no replay bookkeeping needed.
// Stays open on the reading page afterward — it does NOT auto-navigate; the caller's
// onEdit only fires when the child taps the "Edit" button.
export default function BookOpenTransition({ story, childName, fallbackColor, onClose, onEdit }) {
  const [isOpen, setIsOpen] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const text = story.corrected_text || story.transcribed_text || ''
  const bg = story.cover_color || fallbackColor

  return (
    <div style={{ position: 'fixed', inset: 0, maxWidth: 430, margin: '0 auto', background: 'linear-gradient(180deg,#F4EFFF 0%,#E7DBFB 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30, zIndex: 200 }}>
      <style>{`
        @keyframes botSwingOpen {
          0%   { transform: rotateY(0deg) translateZ(6px); opacity: 1; }
          60%  { opacity: 1; }
          82%  { opacity: 0; }
          100% { transform: rotateY(-158deg) translateZ(6px); opacity: 0; }
        }
        .bot-cover  { animation: botSwingOpen 1.05s cubic-bezier(.4,.05,.2,1) forwards; }
        .bot-leaf1  { animation: botSwingOpen 1.05s cubic-bezier(.4,.05,.2,1) .16s forwards; }
        .bot-leaf2  { animation: botSwingOpen 1.05s cubic-bezier(.4,.05,.2,1) .32s forwards; }
        @media (prefers-reduced-motion: reduce) {
          .bot-cover, .bot-leaf1, .bot-leaf2 { animation: none !important; opacity: 0 !important; }
        }
      `}</style>

      <div style={{ position: 'absolute', top: 120, left: 0, right: 0, textAlign: 'center', fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: 74, letterSpacing: 6, color: '#fff', opacity: 0.45, pointerEvents: 'none' }}>story</div>

      <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 14, left: 18, width: 38, height: 38, borderRadius: '50%', border: 'none', background: '#fff', color: '#241f3a', fontSize: 17, cursor: 'pointer', boxShadow: '0 3px 10px rgba(40,30,70,.14)', zIndex: 5 }}>✕</button>

      <div style={{ width: 300, height: 430, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: 1700, perspectiveOrigin: '50% 46%', position: 'relative', zIndex: 2 }}>
        <div style={{ position: 'relative', width: 250, height: 348, transformStyle: 'preserve-3d', transform: 'rotateX(2deg)' }}>

          {/* Reading page — the child's own writing, under everything */}
          <div style={{ position: 'absolute', inset: 0, background: '#fff8ef', borderRadius: '5px 13px 13px 5px', boxShadow: 'inset 12px 0 26px -18px rgba(120,90,60,.55), 0 22px 44px -16px rgba(40,30,70,.42)', padding: '24px 22px 26px 30px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 9, background: 'linear-gradient(90deg, rgba(120,90,60,.22), rgba(120,90,60,.04))' }} />
            <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: 21, color: '#2f9e6b', lineHeight: 1.12, marginBottom: 3 }}>{story.title || 'Untitled Story'}</div>
            <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 11, color: '#6dbf94', marginBottom: 13 }}>by {childName}</div>
            <div style={{ fontFamily: "'Lexend', sans-serif", fontSize: 13, lineHeight: 1.78, color: '#1a3d2b', whiteSpace: 'pre-wrap', flex: 1, minHeight: 0, overflow: 'hidden' }}>{text}</div>
          </div>

          {/* Flipping leaves (motion only, fade out as the cover swings) */}
          <div className="bot-leaf2" style={{ position: 'absolute', inset: 0, transformOrigin: 'left center', borderRadius: '5px 13px 13px 5px', overflow: 'hidden', transform: 'rotateY(0deg) translateZ(6px)', background: '#fff8ef', boxShadow: 'inset 11px 0 20px -16px rgba(120,90,60,.45)' }}>
            <FillerLines />
          </div>
          <div
            className="bot-leaf1"
            onAnimationEnd={() => setIsOpen(true)}
            style={{ position: 'absolute', inset: 0, transformOrigin: 'left center', borderRadius: '5px 13px 13px 5px', overflow: 'hidden', transform: 'rotateY(0deg) translateZ(6px)', background: '#fff8ef', boxShadow: 'inset 11px 0 20px -16px rgba(120,90,60,.45)' }}
          >
            <FillerLines />
          </div>

          {/* Cover face — the exact StoryCover composition, swinging open */}
          <div className="bot-cover" style={{ position: 'absolute', inset: 0, transformOrigin: 'left center', borderRadius: '5px 13px 13px 5px', overflow: 'hidden', transform: 'rotateY(0deg) translateZ(6px)', background: bg, boxShadow: 'inset 14px 0 30px -20px rgba(0,0,0,.4), 0 22px 44px -16px rgba(40,30,70,.42)', zIndex: 5 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 7, background: 'rgba(0,0,0,.09)' }} />
            <StoryCoverFace story={story} childName={childName} titleSize={17} byTextSize={11} />
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', position: 'relative', zIndex: 2, opacity: isOpen ? 1 : 0, transform: isOpen ? 'translateY(0)' : 'translateY(8px)', transition: 'all 0.4s ease' }}>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: 20, color: '#8a6bd4' }}>{story.title || 'Untitled Story'}</div>
        <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 500, fontSize: 13, color: '#8d83ad', marginTop: 3 }}>
          Written by {childName} · ⭐ {story.gems_earned || 0} gems
        </div>
        <button
          onClick={onEdit}
          style={{ marginTop: 16, background: '#2EC486', border: 'none', borderRadius: 16, padding: '12px 28px', fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 14px rgba(46,196,134,0.35)' }}
        >
          ✏️ Edit
        </button>
      </div>
    </div>
  )
}
