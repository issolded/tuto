import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getChildStories, getStoryIdeas, saveChildStory, saveSpellingErrors, uploadStoryCover, deleteChildStory } from '../lib/supabase'
import { validateStoryInput, transcribeStory, evaluateStory, checkTitleSpelling } from '../lib/gemini'
import TutoMascot from '../components/TutoMascot'
import StoryCover from '../components/StoryCover'
import BookOpenTransition from '../components/BookOpenTransition'
import FlippingBook from '../components/FlippingBook'


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
@keyframes spin {
  to { transform: rotate(360deg); }
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
const BG_YOUNG = '#e3f3ea'
const COVER_COLORS = ['#B5EAD7','#C5DFFF','#FFD4E8','#FFF3A3','#D9CCFF','#FFDFB5','#B5EEE8','#FFD4D4']

// Dolch Pre-Primer through Grade 3 + common Fry words (~210 words).
// Used to filter spelling corrections shown to ≤10 — only show words the
// child is expected to know at this level (sight-word standard).
const SIGHT_WORDS = new Set([
  'a','and','away','big','blue','can','come','down','find','for','funny','go',
  'help','here','i','in','is','it','jump','little','look','make','me','my',
  'not','one','play','red','run','said','see','the','three','to','two','up',
  'we','where','yellow','you',
  'all','am','are','at','ate','be','black','brown','but','came','did','do',
  'eat','four','get','good','have','he','into','like','must','new','no','now',
  'on','our','out','please','pretty','ran','ride','saw','say','she','so','soon',
  'that','there','they','this','too','under','want','was','well','went','what',
  'white','who','will','with','yes',
  'after','again','an','any','ask','as','by','could','every','fly','from','give',
  'going','had','has','her','him','his','how','just','know','let','live','may',
  'of','old','once','open','over','put','round','some','stop','take','thank',
  'them','then','think','walk','were','when',
  'always','around','because','been','before','best','both','buy','call','cold',
  'does','fast','first','five','found','gave','goes','green','its','made',
  'many','off','or','pull','read','right','sing','sit','sleep','tell','their',
  'these','those','upon','us','use','very','wash','which','why','wish','work',
  'would','write','your',
  'about','better','bring','carry','clean','cut','done','draw','drink','eight',
  'fall','far','full','got','grow','hold','hot','hurt','if','keep','kind',
  'laugh','light','long','much','myself','never','only','own','pick','seven',
  'shall','show','six','small','start','ten','today','together','try','warm',
  'each','other','more','number','way','people','water','day','time',
  'part','place','year','back','most','hand','high','move',
])

function ConfirmDeleteStoryModal({ onConfirm, onCancel, deleting }) {
  return (
    <div onClick={e => { e.stopPropagation(); !deleting && onCancel() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 28 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 28, padding: '32px 24px 24px', width: '100%', maxWidth: 320, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🗑️</div>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#2D5016', marginBottom: 8 }}>Delete this story?</div>
        <div style={{ fontSize: 14, color: '#6A9956', fontWeight: 600, marginBottom: 28, lineHeight: 1.5 }}>This can't be undone.</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} disabled={deleting} style={{ flex: 1, padding: '14px', border: 'none', borderRadius: 14, background: '#F0FFF4', color: '#2D5016', fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} disabled={deleting} style={{ flex: 1, padding: '14px', border: 'none', borderRadius: 14, background: '#FF3B30', color: 'white', fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(255,59,48,0.35)', opacity: deleting ? 0.6 : 1 }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

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
  const location = useLocation()
  const child = JSON.parse(localStorage.getItem('child') || 'null')

  const [loadingStories, setLoadingStories] = useState(true)
  const [ideasLoading, setIdeasLoading] = useState(true)
  const [stories, setStories] = useState([])
  const [ideas, setIdeas] = useState([])
  const [ideasLoading, setIdeasLoading] = useState(true)
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

  // filtered errors shown highlighted in the ≤10 gentle editor
  const [youngErrors, setYoungErrors] = useState([])

  // editing an existing story (from LibraryScreen / My Stories)
  const [storyId, setStoryId] = useState(null)
  const [editingCompleted, setEditingCompleted] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editOrigin, setEditOrigin] = useState('/child/library')
  const [confirmDeleteStory, setConfirmDeleteStory] = useState(false)
  const [deletingStory, setDeletingStory] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [opening, setOpening] = useState(null) // { story, fallbackColor } — book-open transition before entering the editor

  // where this whole screen was entered from (Home or Library) — drives the idle-screen back button
  const listOrigin = location.state?.from || '/child/home'

  // cover composition
  const coverFileRef = useRef(null)
  const [coverColor, setCoverColor] = useState(COVER_COLORS[0])
  const [coverImageUrl, setCoverImageUrl] = useState(null)
  const [coverUploading, setCoverUploading] = useState(false)

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

  // Initialize editor when entering spelling or gentle-spelling step
  useEffect(() => {
    if (!editorRef.current || !evalResult) return
    if (step === 'spelling') {
      editableTextRef.current = evalResult.transcribed_text || ''
      editorRef.current.innerHTML = buildSpellingHTML(editableTextRef.current, evalResult.spelling_errors || [], spellingState, activeError)
    } else if (step === 'gentle-spelling') {
      editableTextRef.current = evalResult.transcribed_text || ''
      editorRef.current.innerHTML = buildSpellingHTML(editableTextRef.current, youngErrors, spellingState, activeError)
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh highlights after popup interactions (cursor already lost, safe to update)
  useEffect(() => {
    if (!editorRef.current || !evalResult) return
    if (step === 'spelling') {
      editorRef.current.innerHTML = buildSpellingHTML(editableTextRef.current, evalResult.spelling_errors || [], spellingState, activeError)
    } else if (step === 'gentle-spelling') {
      editorRef.current.innerHTML = buildSpellingHTML(editableTextRef.current, youngErrors, spellingState, activeError)
    }
  }, [spellingState, activeError]) // eslint-disable-line react-hooks/exhaustive-deps

  const startEvaluation = async () => {
    setStep('evaluating')
    try {
      const { transcribed_text, uncertain_words } = await transcribeStory(photos, 'en')
      if (!transcribed_text) throw new Error('transcription empty')
      const evalData = await evaluateStory(transcribed_text, chosenIdea?.topic || '', child?.age || 7, 'en')
      const result = { ...evalData, transcribed_text, uncertain_words: uncertain_words || [] }
      setEvalResult(result)
      console.log('[transcribeStory] transcribed_text:', transcribed_text)
      console.log('[transcribeStory] uncertain_words:', result.uncertain_words)
      console.log('[evaluateStory] spelling_errors:', result.spelling_errors)
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

  // ── Cover photo upload ────────────────────────────────────────────────────
  const handleCoverPhoto = async (file) => {
    if (!file || !child?.id) return
    setCoverUploading(true)
    try {
      const url = await uploadStoryCover(child.id, file)
      setCoverImageUrl(url)
    } catch (err) {
      console.error('[cover upload]', err.message)
    }
    setCoverUploading(false)
  }

  // ── ≤10 gentle editor helpers ─────────────────────────────────────────────

  const startGentleEditor = () => {
    const age = Number(child?.age) || 7
    const cap = age <= 7 ? 2 : 4
    // Convert uncertain_words {word, index} → buildSpellingHTML-compatible {wrong, correct, index}.
    // wrong === correct === word: the highlight marks the model's guess for confirmation only;
    // no automatic replacement is applied unless the child explicitly fixes it in the editor.
    const uncertain = (evalResult?.uncertain_words || [])
      .slice(0, cap)
      .map(u => ({ wrong: u.word, correct: u.word, index: u.index }))
    setYoungErrors(uncertain)
    setSpellingState(uncertain.map(() => 'pending'))
    setStep('gentle-spelling')
  }

  const finishYoungEditor = async (status = 'completed') => {
    // Save exactly what the editor contains — child's own writing preserved.
    const editorText = editorRef.current?.innerText || editableTextRef.current || evalResult?.transcribed_text || ''
    const savedText = buildCorrectedText(editorText, youngErrors, spellingState)
    setSaveError(null)
    if (child?.id) {
      try {
        const saved = await saveChildStory(child.id, {
          storyId,
          title: displayTitle, topic: chosenIdea?.topic || '',
          transcribed_text: editorText, corrected_text: savedText,
          status, gems_earned: evalResult?.gems_earned || 0,
        })
        if (saved.story) {
          setStories(prev => storyId ? prev.map(s => s.id === storyId ? saved.story : s) : [saved.story, ...prev])
          if (!storyId) setStoryId(saved.story.id)
        }
        if (saved.gems_awarded != null) setEvalResult(prev => ({ ...prev, gems_earned: saved.gems_awarded }))
      } catch (err) {
        console.error('[finishYoungEditor] save failed:', err.message)
        setSaveError(err.message)
        return
      }
    }
    if (status === 'in_progress' || editingCompleted) {
      nav('/child/library')
    } else {
      setStep('done')
    }
  }

  // ──────────────────────────────────────────────────────────────────────────

  const finishStory = async (status) => {
    const baseText = editableTextRef.current || evalResult?.transcribed_text || ''
    const corrected = buildCorrectedText(baseText, evalResult?.spelling_errors || [], spellingState)
    setSaveError(null)
    if (child?.id) {
      try {
        const saved = await saveChildStory(child.id, {
          storyId,
          title: displayTitle, topic: chosenIdea?.topic || '',
          transcribed_text: baseText, corrected_text: corrected,
          status, gems_earned: evalResult?.gems_earned || 0,
        })
        if (saved.story) {
          setStories(prev => storyId ? prev.map(s => s.id === storyId ? saved.story : s) : [saved.story, ...prev])
          if (!storyId) setStoryId(saved.story.id)
        }
        if (saved.gems_awarded != null) setEvalResult(prev => ({ ...prev, gems_earned: saved.gems_awarded }))
      } catch (err) {
        console.error('[finishStory] save failed:', err.message)
        setSaveError(err.message)
        return
      }
    }
    if (status === 'in_progress' || editingCompleted) {
      nav('/child/library')
    } else {
      setStep('done')
    }
  }

  useEffect(() => {
    if (!child?.id) { setLoadingStories(false); setIdeasLoading(false); return }
    getChildStories(child.id).then(storiesData => {
      setStories(storiesData)
      setLoadingStories(false)
    }).catch(() => setLoadingStories(false))
    getStoryIdeas(child.id).then(ideasData => {
      setIdeas(ideasData)
      setIdeasLoading(false)
    }).catch(() => setIdeasLoading(false))
  }, [])

  // Open an existing story for editing (navigated from LibraryScreen, or tapped in My Stories)
  const openStoryForEdit = (story, origin) => {
    if (!story) return
    setIsEditMode(true)
    setEditOrigin(origin || '/child/library')
    const text = story.corrected_text || story.transcribed_text || ''
    setStoryId(story.id)
    setStoryTitle(story.title || '')
    setChosenIdea({ topic: story.topic || '' })
    setEditingCompleted(story.status === 'completed')
    setEvalResult({ transcribed_text: text, spelling_errors: [], gems_earned: story.gems_earned || 0, uncertain_words: [] })
    editableTextRef.current = text
    setSpellingState([])
    setYoungErrors([])
    const age = Number(child?.age) || 7
    setStep(age <= 10 ? 'gentle-spelling' : 'spelling')
  }

  // Load an existing story for editing when navigated here from LibraryScreen
  useEffect(() => {
    const story = location.state?.story
    if (!story) return
    openStoryForEdit(story, location.state?.from)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Exit edit mode back to wherever the story was opened from. When the origin is this
  // same screen (My Stories), nav() alone won't remount/reset us — reset locally too.
  const exitEditMode = () => {
    setStep('idle')
    setIsEditMode(false)
    setStoryId(null)
    setEditingCompleted(false)
    setChosenIdea(null)
    setStoryTitle('')
    if (editOrigin && editOrigin !== '/child/stories') nav(editOrigin)
  }

  const handleDeleteStory = async () => {
    if (!storyId || !child?.id) return
    setDeletingStory(true)
    setDeleteError(null)
    try {
      await deleteChildStory(child.id, storyId)
      setStories(prev => prev.filter(s => s.id !== storyId))
      setConfirmDeleteStory(false)
      exitEditMode()
    } catch (err) {
      setDeleteError(err.message)
    }
    setDeletingStory(false)
  }

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
      <div style={{ background: 'linear-gradient(180deg,#F4EFFF 0%,#E7DBFB 100%)', minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px' }}>
        <FlippingBook />
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
            <button
              onClick={() => Number(child?.age) <= 10 ? startGentleEditor() : setStep('spelling')}
              style={{ width: '100%', marginTop: 24, background: '#4cb685', border: 'none', borderRadius: 20, padding: '18px', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(76,182,133,0.35)', animation: 'fadeUp 0.4s ease 0.2s both' }}
            >
              {Number(child?.age) <= 10 ? 'Awesome! Let\'s go! 🌟' : 'Let\'s look at your story! →'}
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
          <BackBtn onClick={() => isEditMode ? exitEditMode() : setStep('encourage')} />
        </div>
        <div style={{ flex: 1, padding: '0 24px 48px' }}>
          {isEditMode ? (
            <input
              value={storyTitle}
              onChange={e => setStoryTitle(e.target.value)}
              placeholder={displayTitle}
              style={{ width: '100%', boxSizing: 'border-box', fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: '#2D5016', marginBottom: 8, border: '2px solid #A5D6A7', borderRadius: 14, padding: '8px 12px', background: 'white', outline: 'none', animation: 'fadeUp 0.35s ease both' }}
            />
          ) : (
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#2D5016', marginBottom: 8, animation: 'fadeUp 0.35s ease both' }}>
              Your story! 📖
            </div>
          )}
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
          {deleteError && (
            <div style={{ background: '#FFF0F0', border: '2px solid #FF6B6B', borderRadius: 16, padding: '12px 16px', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#CC0000' }}>
              ⚠️ Couldn't delete — please try again. ({deleteError})
            </div>
          )}
          <button onClick={goToCorrections} style={{ width: '100%', background: '#2EC486', border: 'none', borderRadius: 20, padding: '18px', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(46,196,134,0.30)', animation: 'fadeUp 0.35s ease 0.15s both' }}>
            Looks good! →
          </button>
          {isEditMode && (
            <button onClick={() => setConfirmDeleteStory(true)} style={{ width: '100%', background: 'none', border: 'none', color: '#FF3B30', fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 800, cursor: 'pointer', padding: '12px 8px' }}>
              🗑️ Delete this story
            </button>
          )}
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
        {confirmDeleteStory && (
          <ConfirmDeleteStoryModal
            deleting={deletingStory}
            onConfirm={handleDeleteStory}
            onCancel={() => setConfirmDeleteStory(false)}
          />
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
          {isEditMode ? (
            <input
              value={storyTitle}
              onChange={e => setStoryTitle(e.target.value)}
              placeholder={displayTitle}
              style={{ width: '100%', boxSizing: 'border-box', fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#2D5016', marginBottom: 16, border: '2px solid #A5D6A7', borderRadius: 14, padding: '8px 12px', background: 'white', outline: 'none', animation: 'fadeUp 0.35s ease both' }}
            />
          ) : (
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#2D5016', marginBottom: 16, animation: 'fadeUp 0.35s ease both' }}>
              {displayTitle}
            </div>
          )}
          <div style={{ background: 'white', borderRadius: 24, padding: '16px 20px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', marginBottom: 16, animation: 'fadeUp 0.35s ease 0.08s both', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <TutoMascot size={64} expression="excited" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D5016', lineHeight: 1.7, paddingTop: 8 }}>
              Here's your story with the fixes! How does it look? ✨
            </div>
          </div>
          <div style={{ background: 'white', borderRadius: 24, padding: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', marginBottom: 24, animation: 'fadeUp 0.35s ease 0.12s both' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#2D2D2D', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{corrected}</div>
          </div>
          {saveError && (
            <div style={{ background: '#FFF0F0', border: '2px solid #FF6B6B', borderRadius: 16, padding: '12px 16px', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#CC0000' }}>
              ⚠️ Couldn't save — please try again. ({saveError})
            </div>
          )}
          {deleteError && (
            <div style={{ background: '#FFF0F0', border: '2px solid #FF6B6B', borderRadius: 16, padding: '12px 16px', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#CC0000' }}>
              ⚠️ Couldn't delete — please try again. ({deleteError})
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeUp 0.35s ease 0.16s both' }}>
            <button onClick={() => finishStory('completed')} style={{ background: '#2EC486', border: 'none', borderRadius: 20, padding: '18px', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(46,196,134,0.35)' }}>
              {editingCompleted ? '💾 Save changes' : '🏆 My story is finished!'}
            </button>
            {!editingCompleted && (
              <button onClick={() => finishStory('in_progress')} style={{ background: 'white', border: '2.5px solid #A5D6A7', borderRadius: 20, padding: '16px', fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, color: '#6A9956', cursor: 'pointer' }}>
                📝 I'll finish this book later
              </button>
            )}
            {isEditMode && (
              <button onClick={() => setConfirmDeleteStory(true)} style={{ background: 'none', border: 'none', color: '#FF3B30', fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 800, cursor: 'pointer', padding: '8px' }}>
                🗑️ Delete this story
              </button>
            )}
          </div>
        </div>
        {confirmDeleteStory && (
          <ConfirmDeleteStoryModal
            deleting={deletingStory}
            onConfirm={handleDeleteStory}
            onCancel={() => setConfirmDeleteStory(false)}
          />
        )}
      </div>
    )
  }

  // ── STEP: GENTLE-SPELLING (≤10) ──────────────────────────────────────────
  if (step === 'gentle-spelling') {
    return (
      <div style={{ background: BG_YOUNG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <style>{ANIM}{`
          @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@400;600&family=Fredoka+One&display=swap');
          .story-body { font-family: 'Lexend', sans-serif !important; }
          .story-title-book { font-family: 'Fredoka One', 'Baloo 2', cursive !important; }
        `}</style>
        <div style={{ padding: '56px 24px 0' }}>
          <BackBtn onClick={() => isEditMode ? exitEditMode() : setStep('encourage')} />
        </div>
        <div style={{ flex: 1, padding: '0 24px 48px' }}>

          {/* Book-style title */}
          {isEditMode ? (
            <input
              value={storyTitle}
              onChange={e => setStoryTitle(e.target.value)}
              placeholder={displayTitle}
              className="story-title-book"
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 20, fontWeight: 400, color: '#2f9e6b', marginBottom: 6, border: '2px solid #b2dfcc', borderRadius: 14, padding: '6px 12px', background: 'white', outline: 'none', animation: 'fadeUp 0.35s ease both' }}
            />
          ) : (
            <div
              className="story-title-book"
              style={{ fontSize: 26, fontWeight: 400, color: '#2f9e6b', marginBottom: 6, lineHeight: 1.2, animation: 'fadeUp 0.35s ease both' }}
            >
              {displayTitle}
            </div>
          )}

          {/* Subtle hint */}
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6dbf94', marginBottom: 14, animation: 'fadeUp 0.35s ease 0.06s both' }}>
            {youngErrors.length > 0
              ? <>Tap the <span style={{ color: '#f79433', fontWeight: 800 }}>orange words</span> — just so I understand your story completely ✨</>
              : '✏️ Tap any word to fix it — the whole story is editable'}
          </div>

          {/* Notebook card */}
          <div
            style={{
              background: 'white',
              borderRadius: 20,
              boxShadow: '0 4px 20px rgba(47,158,107,0.12)',
              marginBottom: 20,
              overflow: 'hidden',
              animation: 'fadeUp 0.35s ease 0.1s both',
              display: 'flex',
            }}
          >
            {/* Left margin rule — notebook spine */}
            <div style={{
              width: 28,
              flexShrink: 0,
              background: '#e8f7f0',
              borderRight: '2px solid #b2dfcc',
              borderRadius: '0',
            }} />

            {/* Story text area */}
            <div style={{ flex: 1, padding: '20px 18px 20px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#4cb685', marginBottom: 10, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                ✏️ Tap any word to fix it
              </div>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="story-body"
                onInput={e => { editableTextRef.current = e.currentTarget.innerText }}
                onClick={e => {
                  const errIdx = e.target.dataset?.err
                  if (errIdx !== undefined) {
                    editorRef.current?.blur()
                    setActiveError(activeError === Number(errIdx) ? null : Number(errIdx))
                  }
                }}
                style={{
                  outline: 'none',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 2.0,
                  fontSize: 16,
                  fontWeight: 400,
                  color: '#1a3d2b',
                  minHeight: 120,
                  caretColor: '#2f9e6b',
                }}
              />
            </div>
          </div>

          {saveError && (
            <div style={{ background: '#FFF0F0', border: '2px solid #FF6B6B', borderRadius: 16, padding: '12px 16px', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#CC0000' }}>
              ⚠️ Couldn't save — please try again. ({saveError})
            </div>
          )}
          {deleteError && (
            <div style={{ background: '#FFF0F0', border: '2px solid #FF6B6B', borderRadius: 16, padding: '12px 16px', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#CC0000' }}>
              ⚠️ Couldn't delete — please try again. ({deleteError})
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeUp 0.35s ease 0.18s both' }}>
            <button
              onClick={() => finishYoungEditor('completed')}
              style={{ width: '100%', background: '#2EC486', border: 'none', borderRadius: 20, padding: '18px', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(46,196,134,0.35)' }}
            >
              {editingCompleted ? '💾 Save changes' : 'That\'s my story! 🌟'}
            </button>
            {!editingCompleted && (
              <button
                onClick={() => finishYoungEditor('in_progress')}
                style={{ width: '100%', background: 'white', border: '2.5px solid #A5D6A7', borderRadius: 20, padding: '16px', fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, color: '#6A9956', cursor: 'pointer' }}
              >
                📝 I'll finish this book later
              </button>
            )}
            {isEditMode && (
              <button onClick={() => setConfirmDeleteStory(true)} style={{ width: '100%', background: 'none', border: 'none', color: '#FF3B30', fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 800, cursor: 'pointer', padding: '8px' }}>
                🗑️ Delete this story
              </button>
            )}
          </div>
        </div>

        {/* Word popup — logic unchanged */}
        {activeError !== null && youngErrors[activeError] && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(47,158,107,0.35)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }} onClick={() => setActiveError(null)}>
            <div style={{ background: 'white', width: '100%', maxWidth: 430, borderRadius: '28px 28px 0 0', padding: '28px 24px 44px', animation: 'fadeUp 0.25s ease both' }} onClick={e => e.stopPropagation()}>
              <div style={{ width: 36, height: 4, background: '#E8E8F0', borderRadius: 4, margin: '0 auto 20px' }} />
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: '#2f9e6b', textAlign: 'center', marginBottom: 20 }}>
                I read this as <span style={{ color: '#4cb685' }}>"{youngErrors[activeError].word || youngErrors[activeError].correct}"</span> — did I get it right?
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => { setSpellingState(prev => prev.map((s, i) => i === activeError ? 'fixed' : s)); setActiveError(null) }}
                  style={{ flex: 1, background: '#4cb685', border: 'none', borderRadius: 16, padding: '14px', fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: 'white', cursor: 'pointer' }}
                >
                  ✅ Yes!
                </button>
                <button
                  onClick={() => { setSpellingState(prev => prev.map((s, i) => i === activeError ? 'not_sure' : s)); setActiveError(null) }}
                  style={{ flex: 1, background: '#F0FFF4', border: '2px solid #A5D6A7', borderRadius: 16, padding: '14px', fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: '#6A9956', cursor: 'pointer' }}
                >
                  ✏️ No, fix it
                </button>
              </div>
            </div>
          </div>
        )}
        {confirmDeleteStory && (
          <ConfirmDeleteStoryModal
            deleting={deletingStory}
            onConfirm={handleDeleteStory}
            onCancel={() => setConfirmDeleteStory(false)}
          />
        )}
      </div>
    )
  }

  // ── STEP: COVER ───────────────────────────────────────────────────────────
  if (step === 'cover') {
    const saveCover = async () => {
      if (child?.id && storyId) {
        try {
          await saveChildStory(child.id, { storyId, cover_url: coverImageUrl || null, cover_color: coverColor })
        } catch (err) {
          console.error('[saveCover]', err.message)
        }
      }
      nav('/child/library')
    }

    return (
      <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <style>{ANIM}</style>
        <div style={{ padding: '52px 24px 16px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 24, fontWeight: 800, color: '#2D5016' }}>Design your cover! 🎨</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6A9956', marginTop: 4 }}>Pick a colour, then tap the cover to add your drawing</div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 28px 48px', gap: 20 }}>

          {/* Book cover preview */}
          <div
            style={{
              width: 200, height: 300, borderRadius: 12, background: coverColor,
              position: 'relative', cursor: 'default',
              boxShadow: '4px 6px 24px rgba(0,0,0,0.18), inset -6px 0 10px rgba(0,0,0,0.07)',
              flexShrink: 0, display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Spine shadow */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 10, background: 'rgba(0,0,0,0.09)', zIndex: 1, borderRadius: '12px 0 0 12px' }} />

            {/* Title */}
            <div style={{ padding: '14px 14px 8px 18px', flexShrink: 0, zIndex: 2 }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 800, color: '#1A2E0A', textAlign: 'center', lineHeight: 1.25 }}>
                {displayTitle}
              </div>
            </div>

            {/* Image panel — tap here to pick photo */}
            <div
              onClick={() => !coverUploading && coverFileRef.current?.click()}
              style={{ flex: 1, margin: '0 10px', borderRadius: 8, overflow: 'hidden', background: 'rgba(0,0,0,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, position: 'relative' }}
            >
              {coverImageUrl && (
                <img src={coverImageUrl} alt="cover drawing" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              )}
              {coverUploading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.55)' }}>
                  <div style={{ width: 28, height: 28, border: '3px solid #C8E6C9', borderTopColor: '#2EC486', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              )}
              {!coverImageUrl && !coverUploading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 28 }}>🎨</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(45,80,22,0.5)', textAlign: 'center', padding: '0 10px', lineHeight: 1.4 }}>Tap to add a photo</span>
                </div>
              )}
            </div>

            {/* Byline */}
            <div style={{ padding: '7px 14px 12px', textAlign: 'center', zIndex: 2, flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(26,46,10,0.65)' }}>
                by {child?.name ?? 'You'}
              </span>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={coverFileRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverPhoto(f); e.target.value = '' }}
          />

          {/* Color swatches */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {COVER_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setCoverColor(c)}
                style={{
                  width: 34, height: 34, borderRadius: '50%', background: c,
                  border: 'none', cursor: 'pointer',
                  boxShadow: coverColor === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : '0 2px 6px rgba(0,0,0,0.13)',
                  transform: coverColor === c ? 'scale(1.18)' : 'scale(1)',
                  transition: 'all 0.15s ease',
                }}
              />
            ))}
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
            <button
              onClick={saveCover}
              style={{ background: '#2EC486', border: 'none', borderRadius: 20, padding: '16px', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(46,196,134,0.35)' }}
            >
              📚 Done, save my cover!
            </button>
            <button
              onClick={() => nav('/child/library')}
              style={{ background: 'none', border: 'none', color: '#6A9956', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Skip for now →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── STEP: DONE ────────────────────────────────────────────────────────────
  if (step === 'done') {
    const isYoung = Number(child?.age) <= 10
    const gems = evalResult?.gems_earned ?? 0
    const resetState = () => {
      setStep('idle'); setChosenIdea(null); setStoryTitle(''); setPhotos([])
      setEvalResult(null); setSpellingState([]); setActiveError(null)
      setYoungErrors([]); setStoryId(null); setEditingCompleted(false)
      setCoverColor(COVER_COLORS[0]); setCoverImageUrl(null)
      nav('/child/library')
    }
    return (
      <div style={{ background: isYoung ? BG_YOUNG : BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', position: 'relative', overflow: 'hidden' }}>
        <style>{ANIM}</style>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {CONFETTI_COLORS.map((c, i) => (
            <div key={i} style={{ position: 'absolute', top: '-12px', left: `${(i * 12.5) % 100}%`, width: 10, height: 10, borderRadius: '50%', background: c, animation: `confettiFall ${1.4 + (i % 4) * 0.3}s ease ${(i * 0.13) % 1.3}s infinite` }} />
          ))}
        </div>
        <TutoMascot size={180} expression="proud" style={{ animation: 'fadeUp 0.4s ease both' }} />
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 34, fontWeight: 900, color: isYoung ? '#2f9e6b' : '#2D5016', marginTop: 20, textAlign: 'center', lineHeight: 1.2, animation: 'fadeUp 0.4s ease 0.1s both' }}>
          {isYoung ? 'Amazing writing! 🎉' : 'Amazing! 🎉'}
        </div>
        <div style={{ background: 'white', borderRadius: isYoung ? 36 : 28, padding: '24px 44px', marginTop: 20, boxShadow: '0 8px 32px rgba(76,182,133,0.20)', animation: 'fadeUp 0.4s ease 0.15s both', textAlign: 'center' }}>
          <div style={{ fontSize: 56, fontWeight: 900, fontFamily: "'Baloo 2', cursive", color: '#f79433', lineHeight: 1 }}>
            +{gems}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: isYoung ? '#4cb685' : '#6A9956', marginTop: 6 }}>
            {isYoung ? `You earned ${gems} gems for your story! ⭐` : 'Gems earned! ⭐'}
          </div>
        </div>
        <button
          onClick={() => setStep('cover')}
          style={{ marginTop: 32, background: isYoung ? '#4cb685' : '#2EC486', border: 'none', borderRadius: 20, padding: '18px 36px', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(76,182,133,0.35)', animation: 'fadeUp 0.4s ease 0.2s both' }}
        >
          🎨 Design your cover!
        </button>
        <button
          onClick={resetState}
          style={{ marginTop: 10, background: 'none', border: 'none', color: isYoung ? '#4cb685' : '#6A9956', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', animation: 'fadeUp 0.4s ease 0.25s both' }}
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
        <BackBtn onClick={() => nav(listOrigin)} />
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
                <div key={story.id} style={{ animation: `fadeUp 0.35s ease ${i * 0.06}s both` }}>
                  <StoryCover story={story} fallbackColor={CARD_COLORS[i % CARD_COLORS.length]} childName={child?.name} onTap={() => setOpening({ story, fallbackColor: CARD_COLORS[i % CARD_COLORS.length] })} />
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
            {ideasLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0' }}>
                <div style={{ width: 32, height: 32, border: '3px solid #C8E6C9', borderTopColor: '#2EC486', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : ideas.length > 0 ? (
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

      {opening && (
        <BookOpenTransition
          key={opening.story.id}
          story={opening.story}
          childName={child?.name}
          fallbackColor={opening.fallbackColor}
          onClose={() => setOpening(null)}
          onEdit={() => { openStoryForEdit(opening.story, '/child/stories'); setOpening(null) }}
        />
      )}
    </div>
  )
}
