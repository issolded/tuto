// Shared cover composition for story cards: cover_color background + title (top) +
// image panel (middle, cover_url or pencil placeholder) + byline (bottom).
// Used by LibraryScreen's "Books by {child}" grid and StoriesScreen's "My Stories" grid
// so the two never drift apart again. Also reused as the swinging "cover face" inside
// BookOpenTransition — StoryCoverFace is the inner composition with no card chrome
// (background/shadow/aspect-ratio), so the transition can size/transform it independently.

export function StoryCoverFace({ story, childName, titleSize = 11, byTextSize = 9 }) {
  const hasImage = !!story.cover_url
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Title */}
      <div style={{ padding: '10px 14px 6px 14px', flexShrink: 0 }}>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: titleSize, fontWeight: 800, color: '#1A2E0A', textAlign: 'center', lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {story.title || 'Untitled Story'}
        </div>
      </div>

      {/* Image panel */}
      <div style={{ position: 'relative', flex: 1, margin: '0 8px', borderRadius: 10, overflow: 'hidden', background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {hasImage ? (
          <img src={story.cover_url} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <span style={{ fontSize: 28 }}>✏️</span>
        )}
        {story.status === 'in_progress' && (
          <div style={{ position: 'absolute', bottom: 4, right: 4, background: '#FF6B35', borderRadius: 6, padding: '2px 6px', fontSize: 9, fontWeight: 800, color: 'white', zIndex: 3 }}>In Progress</div>
        )}
      </div>

      {/* Byline */}
      {childName && (
        <div style={{ padding: '5px 14px 9px', textAlign: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: byTextSize, fontWeight: 700, color: 'rgba(26,46,10,0.55)' }}>by {childName}</span>
        </div>
      )}
    </div>
  )
}

export default function StoryCover({ story, fallbackColor, childName, onTap }) {
  const bg = story.cover_color || fallbackColor
  return (
    <div onClick={onTap} style={{ position: 'relative', aspectRatio: '2/3', background: bg, borderRadius: 20, boxShadow: '0 4px 18px rgba(0,0,0,0.09)', overflow: 'hidden', cursor: onTap ? 'pointer' : 'default' }}>
      {/* Spine */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: 'rgba(0,0,0,0.07)', zIndex: 1 }} />

      <div style={{ zIndex: 2, position: 'absolute', inset: 0 }}>
        <StoryCoverFace story={story} childName={childName} />
      </div>
    </div>
  )
}
