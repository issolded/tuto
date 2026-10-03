import { t, childLang } from '../lib/i18n'
// Shared cover composition for story cards: cover_color background + title (top) +
// image panel (middle, cover_url or pencil placeholder) + byline (bottom).
// Used by LibraryScreen's "Books by {child}" grid and StoriesScreen's "My Stories" grid
// so the two never drift apart again. Also reused as the swinging "cover face" inside
// BookOpenTransition — StoryCoverFace is the inner composition with no card chrome
// (background/shadow/aspect-ratio), so the transition can size/transform it independently.

export function StoryCoverFace({ story, childName, titleSize = 11, byTextSize = 9 }) {
  const lang = childLang(JSON.parse(localStorage.getItem('child') || 'null'))
  const hasImage = !!story.cover_url
  if (!hasImage) return (
    <div lang={lang} style={{ position: 'absolute', inset: '12px 12px 14px 20px', border: '1px solid rgba(57,43,92,0.22)', borderRadius: '2px 8px 8px 2px', padding: '16px 10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', color: '#342B50' }}>
      <span aria-hidden="true" style={{ fontSize: 18, opacity: 0.6 }}>✦</span>
      <div title={story.title || t('story_untitled', lang)} style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
        <span style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: (story.title?.length || 0) > 32 ? 15 : 20, fontWeight: 800, lineHeight: 1.2, textTransform: 'uppercase', overflowWrap: 'anywhere', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: (story.title?.length || 0) > 32 ? 4 : 3, WebkitBoxOrient: 'vertical' }}>{story.title || t('story_untitled', lang)}</span>
      </div>
      {childName && <span style={{ fontSize: 13, fontWeight: 700, maxWidth: '100%', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>by {childName}</span>}
      {story.status === 'in_progress' && <span style={{ marginTop: 12, background: '#FFF8EB', color: '#845015', borderRadius: 6, padding: '4px 7px', fontSize: 10, fontWeight: 800 }}>{t('story_in_progress', lang)}</span>}
    </div>
  )
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Title */}
      <div style={{ padding: '10px 14px 6px 14px', flexShrink: 0 }}>
        <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: titleSize, fontWeight: 800, color: '#1A2E0A', textAlign: 'center', lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {story.title || t('story_untitled', lang)}
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
          <div style={{ position: 'absolute', bottom: 4, right: 4, background: '#FF6B35', borderRadius: 6, padding: '2px 6px', fontSize: 9, fontWeight: 800, color: 'white', zIndex: 3 }}>{t('story_in_progress', lang)}</div>
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
    <div role={onTap ? 'button' : undefined} tabIndex={onTap ? 0 : undefined} aria-label={story.title || undefined} onClick={onTap} onKeyDown={e => { if (onTap && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onTap() } }} style={{ position: 'relative', width: '100%', aspectRatio: '2/3', background: bg, borderRadius: '4px 12px 12px 4px', boxShadow: '3px 3px 0 #F9F6EF, 5px 5px 0 #D8D1C8, 0 8px 16px rgba(40,30,65,0.12)', overflow: 'hidden', cursor: onTap ? 'pointer' : 'default' }}>
      {/* Spine */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 10, background: 'linear-gradient(90deg, rgba(40,30,65,0.22), rgba(255,255,255,0.25) 65%, rgba(40,30,65,0.1))', zIndex: 1 }} />

      <div style={{ zIndex: 2, position: 'absolute', inset: 0 }}>
        <StoryCoverFace story={story} childName={childName} />
      </div>
    </div>
  )
}
