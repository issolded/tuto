import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generateStoryIdeas, validateStoryInput } from '../lib/gemini'
import TutoMascot from '../components/TutoMascot'

const ANIM = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pulse {
  0%, 100% { opacity: 0.35; }
  50%       { opacity: 0.75; }
}
`

const CARD_COLORS = ['#E8F5E9', '#E3F2FD', '#FFF8E1', '#FCE4EC']
const BG = 'linear-gradient(180deg, #E8F5E9 0%, #F1F8E9 100%)'

function BackBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ background: 'rgba(46,196,134,0.15)', border: 'none', borderRadius: 12, width: 40, height: 40, fontSize: 18, cursor: 'pointer', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      ←
    </button>
  )
}

export default function StoriesScreen() {
  const nav = useNavigate()
  const child = JSON.parse(sessionStorage.getItem('tuto_child') || 'null')

  const [loadingStories, setLoadingStories] = useState(true)
  const [stories, setStories] = useState([])
  const [ideas, setIdeas] = useState(null)
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [selectedIdea, setSelectedIdea] = useState(null)
  const [showFreeText, setShowFreeText] = useState(false)
  const [freeText, setFreeText] = useState('')
  const [moderating, setModerating] = useState(false)
  const [moderationError, setModerationError] = useState(false)
  const [startNew, setStartNew] = useState(false)

  useEffect(() => {
    if (!child?.id) { setLoadingStories(false); return }
    supabase.from('stories').select('*').eq('child_id', child.id).then(({ data }) => {
      const list = data || []
      setStories(list)
      setLoadingStories(false)
      if (list.length === 0) fetchIdeas()
    })
  }, [])

  useEffect(() => {
    if (startNew && !ideas) fetchIdeas()
  }, [startNew])

  const fetchIdeas = async () => {
    setLoadingIdeas(true)
    try {
      const res = await generateStoryIdeas(child?.age || 7, 'en')
      setIdeas(res.ideas || [])
    } catch {
      setIdeas([])
    }
    setLoadingIdeas(false)
  }

  const confirmIdea = (idea) => {
    nav('/child/reading', { state: { storyTopic: idea.topic, storyTitle: idea.title, mode: 'new' } })
  }

  const submitFreeText = async () => {
    if (!freeText.trim()) return
    setModerating(true)
    setModerationError(false)
    try {
      const result = await validateStoryInput(freeText.trim(), child?.age || 7, 'en')
      if (result.ok) {
        nav('/child/reading', { state: { storyTopic: freeText.trim(), storyTitle: freeText.trim(), mode: 'new' } })
        return
      }
      setModerationError(true)
      setTimeout(() => setModerationError(false), 3500)
    } catch {
      nav('/child/reading', { state: { storyTopic: freeText.trim(), storyTitle: freeText.trim(), mode: 'new' } })
      return
    }
    setModerating(false)
  }

  const inProgress = stories.find(s => s.status === 'in_progress')
  const showDurum2 = !loadingStories && stories.length > 0 && !startNew

  // ── DURUM 2 ────────────────────────────────────────────────────────────────
  if (showDurum2) {
    return (
      <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <style>{ANIM}</style>
        <div style={{ padding: '56px 24px 24px' }}>
          <BackBtn onClick={() => nav('/child/home')} />
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, fontWeight: 800, color: '#2D5016', lineHeight: 1.2 }}>
            {child?.name ?? 'Friend'}, the Creative Writer ✏️
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#6A9956', marginTop: 6 }}>What would you like to do?</div>
        </div>

        <div style={{ padding: '0 24px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <button
            onClick={() => setStartNew(true)}
            style={{ background: 'white', border: '3px solid #A5D6A7', borderRadius: 28, padding: '32px 24px', display: 'flex', alignItems: 'center', gap: 20, cursor: 'pointer', boxShadow: '0 6px 24px rgba(46,196,134,0.15)', animation: 'fadeUp 0.35s ease both', textAlign: 'left', width: '100%' }}
          >
            <span style={{ fontSize: 56 }}>🌱</span>
            <div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#2D5016', marginBottom: 6 }}>Begin a New Story</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#6A9956' }}>Start a brand new adventure!</div>
            </div>
          </button>

          {inProgress && (
            <button
              onClick={() => nav('/child/reading', { state: { storyId: inProgress.id, storyTitle: inProgress.title, mode: 'continue' } })}
              style={{ background: 'white', border: '3px solid #C8E6C9', borderRadius: 28, padding: '32px 24px', display: 'flex', alignItems: 'center', gap: 20, cursor: 'pointer', boxShadow: '0 6px 24px rgba(46,196,134,0.10)', animation: 'fadeUp 0.35s ease 0.1s both', textAlign: 'left', width: '100%' }}
            >
              <span style={{ fontSize: 56 }}>🌳</span>
              <div>
                <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#2D5016', marginBottom: 6 }}>Continue My Story</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6A9956', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inProgress.title || 'Pick up where you left off'}
                </div>
              </div>
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── DURUM 1 ────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <style>{ANIM}</style>

      <div style={{ padding: '56px 24px 20px' }}>
        <BackBtn onClick={() => startNew ? setStartNew(false) : nav('/child/home')} />
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, fontWeight: 800, color: '#2D5016', lineHeight: 1.2 }}>
          {child?.name ?? 'Friend'}, the Creative Writer ✏️
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#6A9956', marginTop: 6 }}>
          {showFreeText ? 'What would you like to write about?' : 'Pick a story idea to get started!'}
        </div>
      </div>

      <div style={{ padding: '0 24px 40px', flex: 1 }}>
        {showFreeText ? (
          // Free text mode
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {moderationError ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '28px 20px', background: 'white', borderRadius: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', animation: 'fadeUp 0.3s ease both' }}>
                <TutoMascot size={120} expression="thinking" />
                <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: '#2D5016', textAlign: 'center' }}>
                  Hmm, let's try something a bit different! 😊
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6A9956', textAlign: 'center', lineHeight: 1.6 }}>
                  How about a story about animals, adventures, or magic?
                </div>
              </div>
            ) : (
              <>
                <textarea
                  value={freeText}
                  onChange={e => setFreeText(e.target.value)}
                  placeholder="e.g. A dragon who is afraid of fire..."
                  rows={5}
                  style={{ width: '100%', borderRadius: 20, border: '2.5px solid #A5D6A7', padding: '16px', fontSize: 15, fontFamily: 'Nunito, sans-serif', fontWeight: 600, color: '#2D5016', background: 'white', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
                />
                <button
                  onClick={submitFreeText}
                  disabled={moderating || !freeText.trim()}
                  style={{ background: '#2EC486', border: 'none', borderRadius: 20, padding: '16px', fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: 'white', cursor: freeText.trim() && !moderating ? 'pointer' : 'default', opacity: freeText.trim() ? 1 : 0.5, boxShadow: '0 4px 16px rgba(46,196,134,0.35)' }}
                >
                  {moderating ? 'Checking... ✨' : "Let's Go! 🚀"}
                </button>
              </>
            )}
            <button
              onClick={() => { setShowFreeText(false); setFreeText(''); setModerationError(false) }}
              style={{ background: 'none', border: 'none', color: '#6A9956', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textAlign: 'left' }}
            >
              ← Back to ideas
            </button>
          </div>
        ) : (
          // Idea grid mode
          <>
            {loadingIdeas ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{ background: CARD_COLORS[i], borderRadius: 24, aspectRatio: '1', animation: `pulse 1.3s ease-in-out ${i * 0.18}s infinite` }} />
                ))}
              </div>
            ) : ideas && ideas.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {ideas.map((idea, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedIdea(idea)}
                    style={{ background: CARD_COLORS[i % CARD_COLORS.length], borderRadius: 24, border: '2.5px solid transparent', padding: '20px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', aspectRatio: '1', textAlign: 'center', animation: `fadeUp 0.4s ease ${i * 0.08}s both` }}
                    onTouchStart={e => e.currentTarget.style.transform = 'scale(0.95)'}
                    onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <span style={{ fontSize: 42, lineHeight: 1 }}>{idea.emoji}</span>
                    <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 800, color: '#2D5016', lineHeight: 1.3 }}>{idea.title}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#6A9956', fontSize: 15, fontWeight: 600 }}>
                Couldn't load ideas — try your own! ✏️
              </div>
            )}

            <button
              onClick={() => setShowFreeText(true)}
              style={{ background: 'none', border: '2.5px dashed #A5D6A7', borderRadius: 20, padding: '14px', width: '100%', marginTop: 16, fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, color: '#6A9956', cursor: 'pointer' }}
            >
              ✏️ Or write your own idea
            </button>
          </>
        )}
      </div>

      {/* Topic modal */}
      {selectedIdea && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,80,22,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', width: '100%', maxWidth: 430, borderRadius: '32px 32px 0 0', padding: '32px 28px 48px', display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeUp 0.3s ease both' }}>
            <div style={{ width: 40, height: 4, background: '#E8E8F0', borderRadius: 4, alignSelf: 'center' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
              <span style={{ fontSize: 64 }}>{selectedIdea.emoji}</span>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#2D5016', lineHeight: 1.3 }}>
                {child?.name ?? 'Your'}'s story about{' '}
                <span style={{ color: '#2EC486' }}>{selectedIdea.topic}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#6A9956', lineHeight: 1.7 }}>{selectedIdea.description}</div>
            </div>
            <button
              onClick={() => confirmIdea(selectedIdea)}
              style={{ background: '#2EC486', border: 'none', borderRadius: 20, padding: '16px', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(46,196,134,0.35)' }}
            >
              Yes, let's write this! ✅
            </button>
            <button
              onClick={() => setSelectedIdea(null)}
              style={{ background: '#F0FFF4', border: 'none', borderRadius: 20, padding: '14px', fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, color: '#6A9956', cursor: 'pointer' }}
            >
              No, show me others 🔄
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
