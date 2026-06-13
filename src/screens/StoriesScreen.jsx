import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getChildStories, getStoryIdeas, saveChildStory, saveSpellingErrors } from '../lib/supabase'
import { validateStoryInput, evaluateStory, checkTitleSpelling } from '../lib/gemini'
import TutoMascot from '../components/TutoMascot'


function getTutoMessage(age) {
  const n = Number(age) || 7
  if (n <= 7) return "I can't wait to see what happens in your story! 🤩\nGrab a pen and let your imagination run wild!\nWhen you're done, show me what you wrote!"
  if (n <= 10) return "I'm SO curious about your story! ✨\nWhere will it take me? Who will I meet?\nWrite it down and let's go on this adventure together!"
  return "Every great story starts with a single word...\nI wonder what world you'll create. 🌍\nWrite it down — I promise I'll be your first reader!"
}

const ANIM = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes confettiFall {
  0%   { transform: translateY(-10px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
}
`

const CONFETTI_COLORS = ['#FF6B35','#FFD93D','#2EC486','#7C5CBF','#4ECDC4','#FF8CC8','#A8E6CF','#FFB347']

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

function buildCorrectedText(text, errors, states) {
  let result = text
  errors.forEach((e, i) => {
    if (states[i] !== 'fixed') return
    result = result.replace(new RegExp(`\\b${escRe(e.wrong)}\\b`, 'gi'), e.correct)
  })
  return result
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildSpellingHTML(text, errors, states, activeError) {
  if (!text) return ''
  if (!errors.length) return escHtml(text)

  const wrongMap = {}
  errors.forEach((e, i) => {
    const key = e.wrong.toLowerCase().trim()
    if (!wrongMap[key]) wrongMap[key] = []
    wrongMap[key].push(i)
  })
  const seenCount = {}
  const tokens = text.split(/(\s+|[.,!?;:()\-"']+)/)

  return tokens.map(token => {
    const clean = token.toLowerCase().replace(/[^a-z0-9']/g, '')
    const candidates = wrongMap[clean]
    if (!candidates) return escHtml(token)

    seenCount[clean] = (seenCount[clean] || 0)
    const errIdx = candidates.find(ci => (errors[ci].index || 0) === seenCount[clean]) ?? candidates[0]
    seenCount[clean]++

    const state = states[errIdx] || 'pending'
    const color = state === 'fixed' ? '#2EC486' : '#FF6B35'
    const dec = state === 'not_sure' ? 'none' : 'underline'
    const bg = activeError === errIdx ? 'rgba(255,107,53,0.12)' : 'transparent'
    return `<span data-err="${errIdx}" style="color:${color};font-weight:800;cursor:pointer;text-decoration:${dec};text-decoration-color:${color};background:${bg};border-radius:4px;padding:0 2px">${escHtml(token)}</span>`
  }).join('')
}

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
  const child = JSON.parse(localStorage.getItem('child') || 'null')

  const [loadingStories, setLoadingStories] = useState(true)
  const [stories, setStories] = useState([])
  const [ideas, setIdeas] = useState([])
  const [selectedIdea, setSelectedIdea] = useState(null)
  const [showFreeText, setShowFreeText] = useState(false)
  const [freeText, setFreeText] = useState('')
  const [moderating, setModerating] = useState(false)
  const [moderationError, setModerationError] = useState(false)
  const [step, setStep] = useState('idle') // 'idle' | 'title' | 'write'
  const [chosenIdea, setChosenIdea] = useState(null)
  const [storyTitle, setStoryTitle] = useState('')
  const [photos, setPhotos] = useState([])
  const fileRef = useRef(null)
  const [evalResult, setEvalResult] = useState(null)
  const [spellingState, setSpellingState] = useState([])
  const [activeError, setActiveError] = useState(null)
  const editorRef = useRef(null)
  const editableTextRef = useRef('')
  const [checkingTitle, setCheckingTitle] = useState(false)
  const [titleSuggestion, setTitleSuggestion] = useState(null)

  const handleTitleNext = async () => {
    if (!storyTitle.trim() || checkingTitle) return
    setCheckingTitle(true)
    try {
      const result = await checkTitleSpelling(storyTitle.trim())
      if (result.has_errors && result.corrected && result.corrected !== storyTitle.trim()) {
        setTitleSuggestion(result.corrected)
      } else {
        setStep('write')
      }
    } catch {
      setStep('write')
    }
    setCheckingTitle(false)
  }

  // Initialize editor when entering spelling step
  useEffect(() => {
    if (step !== 'spelling' || !editorRef.current || !evalResult) return
    editableTextRef.current = evalResult.transcribed_text || ''
    editorRef.current.innerHTML = buildSpellingHTML(editableTextRef.current, evalResult.spelling_errors || [], spellingState, activeError)
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh highlights after popup interactions (cursor already lost, safe to update)
  useEffect(() => {
    if (step !== 'spelling' || !editorRef.current || !evalResult) return
    editorRef.current.innerHTML = buildSpellingHTML(editableTextRef.current, evalResult.spelling_errors || [], spellingState, activeError)
  }, [spellingState, activeError]) // eslint-disable-line react-hooks/exhaustive-deps

  const startEvaluation = async () => {
    setStep('evaluating')
    try {
      const result = await evaluateStory(photos, chosenIdea?.topic || '', child?.age || 7, 'en')
      setEvalResult(result)
      console.log('[evaluateStory] spelling_errors:', result.spelling_errors)
      console.log('[evaluateStory] transcribed_text:', result.transcribed_text)
      setSpellingState((result.spelling_errors || []).map(() => 'pending'))
      setStep('encourage')
    } catch {
      setStep('write')
    }
  }

  const goToCorrections = async () => {
    const errors = evalResult?.spelling_errors || []
    if (errors.length > 0 && child?.id) {
      await saveSpellingErrors(child.id, errors.map((e, i) => ({ wrong: e.wrong, correct: e.correct, state: spellingState[i] || 'pending' })))
    }
    setStep('corrected')
  }

  const finishStory = async (status) => {
    const baseText = editableTextRef.current || evalResult?.transcribed_text || ''
    const corrected = buildCorrectedText(baseText, evalResult?.spelling_errors || [], spellingState)
    if (child?.id) {
      const { story } = await saveChildStory(child.id, {
        title: displayTitle, topic: chosenIdea?.topic || '',
        transcribed_text: baseText, corrected_text: corrected,
        status, gems_earned: evalResult?.gems_earned || 0,
      })
      if (story) setStories(prev => [story, ...prev])
    }
    setStep('done')
  }

  useEffect(() => {
    if (!child?.id) { setLoadingStories(false); return }
    Promise.all([
      getChildStories(child.id),
      getStoryIdeas(child.id),
    ]).then(([storiesData, ideasData]) => {
      setStories(storiesData)
      setIdeas(ideasData)
      setLoadingStories(false)
    })
  }, [])

  const confirmIdea = (idea) => {
    setChosenIdea(idea)
    setSelectedIdea(null)
    setStoryTitle('')
    setStep('title')
  }

  const submitFreeText = async () => {
    if (!freeText.trim()) return
    setModerating(true)
    setModerationError(false)
    try {
      const result = await validateStoryInput(freeText.trim(), child?.age || 7, 'en')
      if (result.ok) {
        setChosenIdea({ emoji: '✏️', title: freeText.trim(), topic: freeText.trim() })
        setStoryTitle('')
        setStep('title')
        return
      }
      setFreeText('')
      setModerationError(true)
      setTimeout(() => setModerationError(false), 3500)
    } catch {
      setChosenIdea({ emoji: '✏️', title: freeText.trim(), topic: freeText.trim() })
      setStoryTitle('')
      setStep('title')
      return
    }
    setModerating(false)
  }

  const displayTitle = storyTitle.trim() || `${child?.name ?? 'Your'}'s Untitled Story ✨`

  // ── STEP: TITLE ────────────────────────────────────────────────────────────
  if (step === 'title') {
    return (
      <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <style>{ANIM}</style>
        <div style={{ padding: '56px 24px 0' }}>
          <BackBtn onClick={() => { setStep('idle'); setChosenIdea(null) }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 28px 48px', gap: 0 }}>
          <TutoMascot size={140} expression="excited" style={{ animation: 'fadeUp 0.4s ease both' }} />
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#2D5016', textAlign: 'center', marginTop: 20, marginBottom: 28, animation: 'fadeUp 0.4s ease 0.1s both' }}>
            What will your story be called? 📖
          </div>
          <input
            type="text"
            value={storyTitle}
            onChange={e => { setStoryTitle(e.target.value); setTitleSuggestion(null) }}
            placeholder="My amazing story..."
            autoFocus
            style={{ width: '100%', borderRadius: 18, border: '2.5px solid #A5D6A7', padding: '16px 18px', fontSize: 16, fontFamily: 'Nunito, sans-serif', fontWeight: 700, color: '#2D5016', background: 'white', outline: 'none', boxSizing: 'border-box', boxShadow: '0 2px 12px rgba(46,196,134,0.10)', animation: 'fadeUp 0.4s ease 0.15s both' }}
            onKeyDown={e => e.key === 'Enter' && storyTitle.trim() && !titleSuggestion && handleTitleNext()}
          />

          {titleSuggestion ? (
            <div style={{ width: '100%', marginTop: 16, background: 'white', borderRadius: 20, padding: '16px 18px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', animation: 'fadeUp 0.25s ease both', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <TutoMascot size={48} expression="excited" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: '#2D5016', lineHeight: 1.5 }}>
                  Did you mean: <span style={{ color: '#2EC486', fontWeight: 800 }}>"{titleSuggestion}"</span>? ✨
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setStoryTitle(titleSuggestion); setTitleSuggestion(null); setStep('write') }}
                  style={{ flex: 1, background: '#2EC486', border: 'none', borderRadius: 14, padding: '12px', fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 800, color: 'white', cursor: 'pointer' }}
                >
                  Yes, fix it!
                </button>
                <button
                  onClick={() => { setTitleSuggestion(null); setStep('write') }}
                  style={{ flex: 1, background: '#F0FFF4', border: '2px solid #A5D6A7', borderRadius: 14, padding: '12px', fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, color: '#6A9956', cursor: 'pointer' }}
                >
                  No, keep mine
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleTitleNext}
              disabled={!storyTitle.trim() || checkingTitle}
              style={{ width: '100%', marginTop: 16, background: '#2EC486', border: 'none', borderRadius: 18, padding: '16px', fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: 'white', cursor: storyTitle.trim() && !checkingTitle ? 'pointer' : 'default', opacity: storyTitle.trim() && !checkingTitle ? 1 : 0.4, boxShadow: '0 4px 16px rgba(46,196,134,0.30)', animation: 'fadeUp 0.4s ease 0.2s both' }}
            >
              {checkingTitle ? 'Checking... ✨' : 'Next →'}
            </button>
          )}
          <button
            onClick={() => { setStoryTitle(''); setTitleSuggestion(null); setStep('write') }}
            style={{ background: 'none', border: 'none', color: '#6A9956', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 14, textDecoration: 'underline', animation: 'fadeUp 0.4s ease 0.25s both' }}
          >
            I'll think of a title later
          </button>
        </div>
      </div>
    )
  }

  // ── STEP: WRITE ────────────────────────────────────────────────────────────
  if (step === 'write') {
    const addPhoto = (file) => setPhotos(prev => [...prev, file])
    const removePhoto = (i) => setPhotos(prev => prev.filter((_, idx) => idx !== i))

    return (
      <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <style>{ANIM}</style>
        <div style={{ padding: '56px 24px 0' }}>
          <BackBtn onClick={() => { setStep('title'); setPhotos([]) }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 28px 48px', gap: 0 }}>
          <div style={{ fontSize: 72, lineHeight: 1, animation: 'fadeUp 0.35s ease both' }}>{chosenIdea?.emoji ?? '✏️'}</div>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#2D5016', textAlign: 'center', marginTop: 14, marginBottom: 24, lineHeight: 1.3, animation: 'fadeUp 0.35s ease 0.08s both' }}>
            {displayTitle}
          </div>

          {/* Tuto message card */}
          <div style={{ background: 'white', borderRadius: 24, padding: '24px 20px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 24, animation: 'fadeUp 0.35s ease 0.15s both', boxSizing: 'border-box' }}>
            <TutoMascot size={100} expression={photos.length > 0 ? 'excited' : 'default'} />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2D5016', textAlign: 'center', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
              {photos.length > 0
                ? 'Great! Add more pages if you wrote more,\nor submit when you\'re ready! 🌟'
                : getTutoMessage(child?.age)}
            </div>
          </div>

          {/* Hidden file input — reset value so same file can be re-picked */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"

            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) addPhoto(file)
              e.target.value = ''
            }}
          />

          {/* Photo thumbnails */}
          {photos.length > 0 && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {photos.map((file, i) => (
                <div key={i} style={{ background: 'white', borderRadius: 16, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', animation: 'fadeUp 0.25s ease both' }}>
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Page ${i + 1}`}
                    style={{ width: 64, height: 64, objectFit: 'cover', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#2D5016', flex: 1 }}>Page {i + 1}</span>
                  <button
                    onClick={() => removePhoto(i)}
                    style={{ background: 'none', border: 'none', color: '#6A9956', fontSize: 20, cursor: 'pointer', padding: '0 16px 0 0', lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add another page — visible after first photo, max 10 */}
          {photos.length > 0 && photos.length < 10 && (
            <button
              onClick={() => fileRef.current?.click()}
              style={{ width: '100%', background: 'none', border: '2.5px dashed #A5D6A7', borderRadius: 18, padding: '14px', fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, color: '#6A9956', cursor: 'pointer', marginBottom: 14 }}
            >
              📸 Add another page
            </button>
          )}

          {/* First photo CTA */}
          {photos.length === 0 && (
            <button
              onClick={() => fileRef.current?.click()}
              style={{ width: '100%', background: '#2D5016', border: 'none', borderRadius: 20, padding: '20px', fontFamily: "'Baloo 2', cursive", fontSize: 19, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 6px 20px rgba(45,80,22,0.25)', animation: 'fadeUp 0.35s ease 0.2s both' }}
            >
              I'm ready, Tuto! 📸
            </button>
          )}

          {/* Submit */}
          {photos.length > 0 && (
            <button
              onClick={startEvaluation}
              style={{ width: '100%', background: '#2EC486', border: 'none', borderRadius: 20, padding: '18px', fontFamily: "'Baloo 2', cursive", fontSize: 19, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(46,196,134,0.35)', animation: 'fadeUp 0.25s ease both' }}
            >
              I'm done! 🎉
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── STEP: EVALUATING ──────────────────────────────────────────────────────
  if (step === 'evaluating') {
    return (
      <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '40px 28px' }}>
        <style>{ANIM}</style>
        <TutoMascot size={160} expression="thinking" style={{ animation: 'fadeUp 0.4s ease both' }} />
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#2D5016', textAlign: 'center', animation: 'fadeUp 0.4s ease 0.1s both' }}>
          Reading your story... ✨
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#6A9956', textAlign: 'center', animation: 'fadeUp 0.4s ease 0.2s both' }}>
          Just a moment!
        </div>
      </div>
    )
  }

  // ── STEP: ENCOURAGE ───────────────────────────────────────────────────────
  if (step === 'encourage') {
    const isBlocked = evalResult?.has_profanity || evalResult?.too_short
    return (
      <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <style>{ANIM}</style>
        <div style={{ padding: '56px 24px 0' }}>
          <BackBtn onClick={() => setStep('write')} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 28px 48px' }}>
          <TutoMascot size={160} expression={isBlocked ? 'default' : 'excited'} style={{ animation: 'fadeUp 0.4s ease both' }} />
          <div style={{ background: 'white', borderRadius: 28, padding: '28px 24px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', textAlign: 'center', marginTop: 24, boxSizing: 'border-box', animation: 'fadeUp 0.4s ease 0.1s both' }}>
            {evalResult?.has_profanity ? (
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: '#2D5016', lineHeight: 1.7 }}>
                Hmm, let's keep our story friendly!<br />Some words aren't great for stories. Try again? 😊
              </div>
            ) : evalResult?.too_short ? (
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: '#2D5016', lineHeight: 1.7 }}>
                Hmm, I think there's more to this story!<br />Can you write a bit more? 📝
              </div>
            ) : (
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#2D5016', lineHeight: 1.7 }}>
                {evalResult?.encouragement}
              </div>
            )}
          </div>
          {isBlocked ? (
            <button onClick={() => setStep('write')} style={{ width: '100%', marginTop: 24, background: '#2EC486', border: 'none', borderRadius: 20, padding: '18px', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(46,196,134,0.30)', animation: 'fadeUp 0.4s ease 0.2s both' }}>
              ← Go back and try again
            </button>
          ) : (
            <button onClick={() => setStep('spelling')} style={{ width: '100%', marginTop: 24, background: '#2EC486', border: 'none', borderRadius: 20, padding: '18px', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(46,196,134,0.30)', animation: 'fadeUp 0.4s ease 0.2s both' }}>
              Let's look at your story! →
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── STEP: SPELLING ────────────────────────────────────────────────────────
  if (step === 'spelling') {
    const errors = evalResult?.spelling_errors || []
    return (
      <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <style>{ANIM}</style>
        <div style={{ padding: '56px 24px 0' }}>
          <BackBtn onClick={() => setStep('encourage')} />
        </div>
        <div style={{ flex: 1, padding: '0 24px 48px' }}>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#2D5016', marginBottom: 8, animation: 'fadeUp 0.35s ease both' }}>
            Your story! 📖
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6A9956', marginBottom: 16, animation: 'fadeUp 0.35s ease 0.08s both' }}>
            {errors.length > 0
              ? <>Tap the <span style={{ color: '#FF6B35', fontWeight: 800 }}>orange words</span> to fix spelling, or edit directly if something looks wrong ✏️</>
              : 'Edit directly if something looks wrong ✏️'}
          </div>
          <div
            style={{ background: 'white', borderRadius: 24, padding: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', marginBottom: 20, animation: 'fadeUp 0.35s ease 0.1s both' }}
          >
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={e => { editableTextRef.current = e.currentTarget.innerText }}
              onClick={e => {
                const errIdx = e.target.dataset?.err
                if (errIdx !== undefined) {
                  editorRef.current?.blur()
                  setActiveError(activeError === Number(errIdx) ? null : Number(errIdx))
                }
              }}
              style={{ outline: 'none', whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: 15, fontWeight: 600, color: '#2D2D2D', minHeight: 80 }}
            />
          </div>
          <button onClick={goToCorrections} style={{ width: '100%', background: '#2EC486', border: 'none', borderRadius: 20, padding: '18px', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(46,196,134,0.30)', animation: 'fadeUp 0.35s ease 0.15s both' }}>
            Looks good! →
          </button>
        </div>

        {/* Spelling popup */}
        {activeError !== null && errors[activeError] && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,80,22,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }} onClick={() => setActiveError(null)}>
            <div style={{ background: 'white', width: '100%', maxWidth: 430, borderRadius: '28px 28px 0 0', padding: '28px 24px 44px', animation: 'fadeUp 0.25s ease both' }} onClick={e => e.stopPropagation()}>
              <div style={{ width: 36, height: 4, background: '#E8E8F0', borderRadius: 4, margin: '0 auto 20px' }} />
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: '#2D5016', textAlign: 'center', marginBottom: 20 }}>
                Did you mean <span style={{ color: '#2EC486' }}>"{errors[activeError].correct}"</span>?
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => { setSpellingState(prev => prev.map((s, i) => i === activeError ? 'fixed' : s)); setActiveError(null) }}
                  style={{ flex: 1, background: '#2EC486', border: 'none', borderRadius: 16, padding: '14px', fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: 'white', cursor: 'pointer' }}
                >
                  ✅ Yes, fix it!
                </button>
                <button
                  onClick={() => { setSpellingState(prev => prev.map((s, i) => i === activeError ? 'not_sure' : s)); setActiveError(null) }}
                  style={{ flex: 1, background: '#F0FFF4', border: '2px solid #A5D6A7', borderRadius: 16, padding: '14px', fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: '#6A9956', cursor: 'pointer' }}
                >
                  🤷 Not sure
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── STEP: CORRECTED ───────────────────────────────────────────────────────
  if (step === 'corrected') {
    const corrected = buildCorrectedText(editableTextRef.current || evalResult?.transcribed_text || '', evalResult?.spelling_errors || [], spellingState)
    return (
      <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <style>{ANIM}</style>
        <div style={{ padding: '56px 24px 0' }}>
          <BackBtn onClick={() => setStep('spelling')} />
        </div>
        <div style={{ flex: 1, padding: '0 24px 48px' }}>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#2D5016', marginBottom: 16, animation: 'fadeUp 0.35s ease both' }}>
            {displayTitle}
          </div>
          <div style={{ background: 'white', borderRadius: 24, padding: '16px 20px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', marginBottom: 16, animation: 'fadeUp 0.35s ease 0.08s both', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <TutoMascot size={64} expression="excited" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D5016', lineHeight: 1.7, paddingTop: 8 }}>
              Here's your story with the fixes! How does it look? ✨
            </div>
          </div>
          <div style={{ background: 'white', borderRadius: 24, padding: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', marginBottom: 24, animation: 'fadeUp 0.35s ease 0.12s both' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#2D2D2D', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{corrected}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeUp 0.35s ease 0.16s both' }}>
            <button onClick={() => finishStory('completed')} style={{ background: '#2EC486', border: 'none', borderRadius: 20, padding: '18px', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(46,196,134,0.35)' }}>
              🏆 My story is finished!
            </button>
            <button onClick={() => finishStory('in_progress')} style={{ background: 'white', border: '2.5px solid #A5D6A7', borderRadius: 20, padding: '16px', fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, color: '#6A9956', cursor: 'pointer' }}>
              📝 I'll add more later
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── STEP: DONE ────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', position: 'relative', overflow: 'hidden' }}>
        <style>{ANIM}</style>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {CONFETTI_COLORS.map((c, i) => (
            <div key={i} style={{ position: 'absolute', top: '-12px', left: `${(i * 12.5) % 100}%`, width: 10, height: 10, borderRadius: '50%', background: c, animation: `confettiFall ${1.4 + (i % 4) * 0.3}s ease ${(i * 0.13) % 1.3}s infinite` }} />
          ))}
        </div>
        <TutoMascot size={180} expression="proud" style={{ animation: 'fadeUp 0.4s ease both' }} />
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 34, fontWeight: 900, color: '#2D5016', marginTop: 20, animation: 'fadeUp 0.4s ease 0.1s both' }}>
          Amazing! 🎉
        </div>
        <div style={{ background: 'white', borderRadius: 28, padding: '20px 40px', marginTop: 20, boxShadow: '0 6px 24px rgba(46,196,134,0.20)', animation: 'fadeUp 0.4s ease 0.15s both', textAlign: 'center' }}>
          <div style={{ fontSize: 52, fontWeight: 900, fontFamily: "'Baloo 2', cursive", color: '#FF6B35', lineHeight: 1 }}>
            +{evalResult?.gems_earned ?? 0}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#6A9956', marginTop: 4 }}>Gems earned! ⭐</div>
        </div>
        <button
          onClick={() => {
            setStep('idle')
            setChosenIdea(null)
            setStoryTitle('')
            setPhotos([])
            setEvalResult(null)
            setSpellingState([])
            setActiveError(null)
          }}
          style={{ marginTop: 32, background: '#2EC486', border: 'none', borderRadius: 20, padding: '18px 36px', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(46,196,134,0.35)', animation: 'fadeUp 0.4s ease 0.2s both' }}
        >
          Back to My Stories
        </button>
      </div>
    )
  }

  const inProgressStory = stories.find(s => s.status === 'in_progress')
  const completedStories = stories.filter(s => s.status !== 'in_progress')

  // ── IDLE ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <style>{ANIM}</style>

      <div style={{ padding: '56px 24px 20px' }}>
        <BackBtn onClick={() => nav('/child/library')} />
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, fontWeight: 800, color: '#2D5016', lineHeight: 1.2 }}>
          {child?.name ?? 'Friend'}, the Creative Writer ✏️
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#6A9956', marginTop: 6 }}>
          {loadingStories ? 'Loading your stories...' : showFreeText ? 'What would you like to write about?' : 'Your stories and ideas below'}
        </div>
      </div>

      <div style={{ padding: '0 24px 40px', flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

        {/* In-progress story */}
        {!loadingStories && inProgressStory && (
          <div style={{ marginBottom: 20, animation: 'fadeUp 0.35s ease both' }}>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: '#2D5016', marginBottom: 10 }}>
              Continue Writing 📝
            </div>
            <button
              onClick={() => nav('/child/reading', { state: { storyId: inProgressStory.id, storyTitle: inProgressStory.title, mode: 'continue' } })}
              style={{ background: 'white', border: '3px solid #A5D6A7', borderRadius: 24, padding: '20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', boxShadow: '0 4px 16px rgba(46,196,134,0.12)', width: '100%', textAlign: 'left' }}
            >
              <span style={{ fontSize: 44 }}>🌳</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: '#2D5016', marginBottom: 4 }}>
                  {inProgressStory.title || 'Untitled Story'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6A9956' }}>Pick up where you left off →</div>
              </div>
            </button>
          </div>
        )}

        {/* Completed stories grid */}
        {!loadingStories && completedStories.length > 0 && (
          <div style={{ marginBottom: 24, animation: 'fadeUp 0.35s ease 0.07s both' }}>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: '#2D5016', marginBottom: 10 }}>
              My Stories 📚{' '}
              <span style={{ fontSize: 12, fontWeight: 600, color: '#6A9956' }}>{completedStories.length} written</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {completedStories.map((story, i) => (
                <div key={story.id} style={{ background: 'white', borderRadius: 18, overflow: 'hidden', boxShadow: '0 3px 12px rgba(0,0,0,0.08)', animation: `fadeUp 0.35s ease ${i * 0.06}s both` }}>
                  <div style={{ aspectRatio: '2/3', background: CARD_COLORS[i % CARD_COLORS.length], display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ fontSize: 36 }}>✏️</span>
                    {story.gems_earned > 0 && (
                      <div style={{ background: '#FFD93D', borderRadius: 8, padding: '2px 8px', fontSize: 10, fontWeight: 800, color: '#1A1A2E' }}>⭐ {story.gems_earned}</div>
                    )}
                  </div>
                  <div style={{ padding: '8px 10px 10px' }}>
                    <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 12, fontWeight: 800, color: '#2D5016', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {story.title || 'Untitled Story'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Divider when stories exist */}
        {!loadingStories && stories.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, animation: 'fadeUp 0.35s ease 0.14s both' }}>
            <div style={{ flex: 1, height: 1.5, background: '#C8E6C9', borderRadius: 2 }} />
            <div style={{ fontSize: 13, fontWeight: 800, color: '#6A9956' }}>Write New Story ✏️</div>
            <div style={{ flex: 1, height: 1.5, background: '#C8E6C9', borderRadius: 2 }} />
          </div>
        )}

        {/* Writing section */}
        {showFreeText ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {moderationError ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '28px 20px', background: 'white', borderRadius: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', animation: 'fadeUp 0.3s ease both' }}>
                <TutoMascot size={120} expression="default" />
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
          <>
            {ideas.length > 0 ? (
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
