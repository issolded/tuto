import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'
import { supabase } from '../lib/supabase'

const ACCENT = '#FF6B35'
const BG = 'linear-gradient(160deg, #FFF3E8 0%, #FFDFC8 100%)'

const MSG = {
  not_book:       "Hmm, that doesn't look like a book cover! 😄 Show me what you're reading!",
  low_confidence: "Is this your book? Let me make sure I got it right!",
  try_again:      "I couldn't see the cover clearly... try better lighting? 📸",
}

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`

// ─── Gemini helpers ───────────────────────────────────────────────────────────

function toB64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result.split(',')[1])
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

async function geminiJSON(parts) {
  const r = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { response_mime_type: 'application/json' },
    }),
  })
  if (!r.ok) throw new Error(`API ${r.status}`)
  const d = await r.json()
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text
  return JSON.parse(text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim())
}

async function identifyCover(file) {
  const b64 = await toB64(file)
  return geminiJSON([
    { text: 'Look at this photo. Is it a book cover? Return JSON only: {"is_book": boolean, "title": string, "confidence": number between 0 and 1}' },
    { inline_data: { mime_type: file.type, data: b64 } },
  ])
}

async function readPagesAndAsk(files, title, age, language) {
  const lang = language === 'tr' ? 'Turkish' : 'English'
  const imageParts = await Promise.all(
    files.map(async f => ({ inline_data: { mime_type: f.type, data: await toB64(f) } }))
  )
  return geminiJSON([
    {
      text: `You are Tuto, a friendly reading buddy. You are looking at photos of book pages that a ${age}-year-old child just read from "${title}".
Generate exactly 5 comprehension questions ONLY based on what is visible in these page photos.
Do NOT use your knowledge of the book from training data.
Do NOT ask about parts of the book not shown in the photos.
If the photos are not book pages, return 5 simple questions about what the child can see in any illustrations shown.
If you cannot read the text clearly, ask simpler visual questions about what the child can see in the illustrations.
Base everything strictly on these specific pages shown.
Mix question types randomly: some "mc" (4 options, correct index 0-3) and some "oe" (open-ended).
Each question must have a short fun "tuto_intro" in Tuto's voice (1 sentence + emoji).
All text in ${lang}.
Return JSON only:
{
  "questions": [
    {"type":"mc","tuto_intro":"string","question":"string","options":["A","B","C","D"],"correct":0},
    {"type":"oe","tuto_intro":"string","question":"string"}
  ]
}`,
    },
    ...imageParts,
  ])
}

// ─── UI components ────────────────────────────────────────────────────────────

function Screen({ children, onBack }) {
  const nav = useNavigate()
  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '56px 24px 12px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={onBack ?? (() => nav('/child/home'))}
          style={{
            background: 'rgba(255,255,255,0.85)',
            border: 'none',
            width: 44, height: 44,
            borderRadius: 14,
            fontSize: 20,
            color: '#1A1A2E',
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
          }}
        >←</button>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#1A1A2E' }}>
          Read a Book 📖
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 24px 48px', gap: 20 }}>
        {children}
      </div>
    </div>
  )
}

function TutoBubble({ message, tutoSize = 120 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        position: 'relative',
        background: 'white',
        borderRadius: 28,
        padding: '24px 28px',
        boxShadow: '0 8px 40px rgba(255,107,53,0.13)',
        width: '100%',
      }}>
        <div style={{
          fontFamily: "'Baloo 2', cursive",
          fontSize: 20,
          fontWeight: 700,
          color: '#1A1A2E',
          lineHeight: 1.65,
          textAlign: 'center',
        }}>
          {message}
        </div>
        <div style={{
          position: 'absolute',
          bottom: -15,
          left: 40,
          width: 0,
          height: 0,
          borderLeft: '10px solid transparent',
          borderRight: '22px solid transparent',
          borderTop: '17px solid white',
        }} />
      </div>
      <TutoMascot size={tutoSize} style={{ marginTop: 4 }} />
    </div>
  )
}

function PhotoArea({ inputRef, label }) {
  return (
    <div
      onClick={() => inputRef.current.click()}
      style={{
        background: 'rgba(255,255,255,0.72)',
        borderRadius: 32,
        border: '3px dashed #FF6B35',
        padding: '56px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        cursor: 'pointer',
        boxShadow: '0 4px 28px rgba(255,107,53,0.10)',
      }}
    >
      <div style={{ fontSize: 68 }}>📚</div>
      <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 28, fontWeight: 800, color: ACCENT }}>
        Tap here!
      </div>
      <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 600, color: '#7A7A9A', textAlign: 'center' }}>
        {label}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReadingFlow() {
  const nav = useNavigate()
  const location = useLocation()
  const child = JSON.parse(sessionStorage.getItem('tuto_child') || 'null')
  const childId = child?.id
  const age = Number(child?.age) || 7
  const language = child?.language || 'en'

  const [step, setStep] = useState('checking')
  const [book, setBook] = useState(null)
  const [questions, setQuestions] = useState([])
  const [qIdx, setQIdx] = useState(0)
  const [qVisible, setQVisible] = useState(true)
  const [answers, setAnswers] = useState({})
  const [oeInput, setOeInput] = useState('')
  const [pageInput, setPageInput] = useState('')
  const [gemsEarned, setGemsEarned] = useState(0)
  const [finalCorrect, setFinalCorrect] = useState(0)
  const [error, setError] = useState('')
  const [photos, setPhotos] = useState([])           // [{ file, preview }]
  const [titleInput, setTitleInput] = useState('')
  const [pendingCoverPreview, setPendingCoverPreview] = useState(null)
  const coverRef = useRef()
  const pageRef = useRef()
  const pendingFile = useRef(null)
  const fromLibrary = useRef(!!location.state?.book)

  useEffect(() => {
    const stateBook = location.state?.book
    if (stateBook) {
      setBook(stateBook)
      setStep('page-prompt')
      return
    }
    if (!childId) { setStep('new-book'); return }
    supabase
      .from('books')
      .select('*')
      .eq('child_id', childId)
      .eq('completed', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.length) { setBook(data[0]); setStep('existing-book') }
        else setStep('new-book')
      })
      .catch(() => setStep('new-book'))
  }, [])

  useEffect(() => {
    if (step !== 'cover-success') return
    const t = setTimeout(() => setStep('book-status'), 1800)
    return () => clearTimeout(t)
  }, [step])

  async function submitCover(file) {
    if (!file) return
    setStep('cover-loading')
    setError('')
    try {
      const { is_book, title, confidence } = await identifyCover(file)
      if (!is_book) {
        setError(MSG.not_book)
        setStep('new-book')
        return
      }
      if (confidence < 0.6) {
        setError(MSG.low_confidence)
        setStep('new-book')
        return
      }
      if (childId) {
        const { data: existing } = await supabase.from('books').select('title').eq('child_id', childId)
        const dupe = (existing ?? []).some(
          b => b.title.toLowerCase().trim() === title.toLowerCase().trim()
        )
        if (dupe) {
          setError('This book is already in your library! 📚')
          setStep('new-book')
          return
        }
      }
      pendingFile.current = file
      setPendingCoverPreview(URL.createObjectURL(file))
      setTitleInput(title)
      setStep('title-confirm')
    } catch {
      setError(MSG.try_again)
      setStep('new-book')
    }
  }

  async function confirmTitle() {
    const file = pendingFile.current
    const title = titleInput.trim()
    if (!file || !title) return
    setStep('cover-loading')
    try {
      let coverUrl = null
      try {
        const path = `${childId}/covers/${Date.now()}.jpg`
        await supabase.storage.from('submissions').upload(path, file, { contentType: file.type, upsert: false })
        coverUrl = supabase.storage.from('submissions').getPublicUrl(path).data.publicUrl
      } catch { /* storage optional */ }
      const { data: newBook } = await supabase
        .from('books')
        .insert({ child_id: childId, title, cover_url: coverUrl, current_page: 0, completed: false })
        .select().single()
      setBook(newBook ?? { title, cover_url: coverUrl })
      setStep('cover-success')
    } catch {
      setError(MSG.try_again)
      setStep('new-book')
    }
  }

  function addPhoto(file) {
    if (!file) return
    setPhotos(prev => [...prev, { file, preview: URL.createObjectURL(file) }])
  }

  function removePhoto(idx) {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  async function submitAllPages() {
    if (!photos.length || !book) return
    setStep('page-loading')
    setError('')
    try {
      const { questions: qs } = await readPagesAndAsk(photos.map(p => p.file), book.title, age, language)
      setQuestions(qs ?? [])
      setQIdx(0)
      setQVisible(true)
      setAnswers({})
      setOeInput('')
      setPhotos([])
      setStep('questions')
    } catch {
      setError('Could not read the pages. Try again!')
      setStep('page-prompt')
    }
  }

  async function markCompleted() {
    if (book?.id) {
      await supabase.from('books').update({ completed: true }).eq('id', book.id)
    }
    setStep('book-done')
  }

  async function savePageNumber(skip) {
    const page = skip ? (book?.current_page ?? 0) : (parseInt(pageInput) || 0)
    if (book?.id) {
      await supabase.from('books').update({ current_page: page }).eq('id', book.id)
    }
    nav('/child/library')
  }

  function handleMC(optIdx) {
    const q = questions[qIdx]
    const correct = optIdx === q.correct
    setAnswers(p => ({ ...p, [qIdx]: optIdx }))
    setTimeout(() => advanceQ(correct ? 1 : 0), 900)
  }

  function handleOE() {
    if (!oeInput.trim()) return
    setAnswers(p => ({ ...p, [qIdx]: oeInput.trim() }))
    setOeInput('')
    advanceQ(1)
  }

  function advanceQ(earned) {
    setQVisible(false)
    const nextIdx = qIdx + 1
    const isLast = nextIdx >= questions.length
    setTimeout(() => {
      if (isLast) finishReading(earned)
      else { setQIdx(nextIdx); setQVisible(true) }
    }, 350)
  }

  async function finishReading(lastEarned) {
    const prevCorrect = Object.entries(answers).reduce((sum, [i, ans]) => {
      const q = questions[Number(i)]
      if (!q) return sum
      if (q.type === 'mc') return sum + (ans === q.correct ? 1 : 0)
      return sum + 1
    }, 0)
    const total = prevCorrect + lastEarned
    setFinalCorrect(total)
    const pct = questions.length > 0 ? total / questions.length : 0
    const gems = pct >= 0.6 ? 30 : pct >= 0.3 ? 15 : 5
    setGemsEarned(gems)
    setStep('result')
    if (childId) await supabase.from('bt_ledger').insert({ child_id: childId, amount: gems, reason: book?.title ?? 'Reading' })
    if (book?.id) await supabase.from('books').update({ current_page: (book.current_page ?? 0) + 1 }).eq('id', book.id)
    await supabase.from('submissions').insert({
      child_id: childId ?? null,
      task_type: 'reading',
      score: Math.round(pct * 100),
      gems_earned: gems,
      feedback: `Read ${book?.title ?? 'a book'}`,
      generated_questions: questions.map(q => q.question),
    })
  }

  const coverPrompt = age <= 7
    ? "Hi! I love books! 📚 Which book are you reading? Take a photo of the cover!"
    : age <= 10
    ? "New book time! 📚 Take a photo of the cover so I know what we're reading!"
    : "Starting a new book? 📚 Snap a photo of the cover first!"

  // ─── Render ────────────────────────────────────────────────────────────────

  if (step === 'checking') return (
    <Screen>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <TutoBubble message="Checking your library... 📚" />
      </div>
    </Screen>
  )

  if (step === 'new-book') return (
    <Screen>
      <TutoBubble message={error || coverPrompt} />
      <PhotoArea inputRef={coverRef} label="Take a photo of the cover" />
      <input
        ref={coverRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) submitCover(f) }}
      />
    </Screen>
  )

  if (step === 'cover-loading') return (
    <Screen>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <TutoBubble message="Let me see what book this is... 🔍" />
      </div>
    </Screen>
  )

  if (step === 'title-confirm') return (
    <Screen onBack={() => setStep('new-book')}>
      <TutoBubble message="Is this your book? 🤔" tutoSize={80} />
      {pendingCoverPreview && (
        <img
          src={pendingCoverPreview}
          alt="cover preview"
          draggable={false}
          style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.10)' }}
        />
      )}
      <div style={{ background: 'white', borderRadius: 24, padding: '20px', boxShadow: '0 4px 24px rgba(255,107,53,0.10)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 12, fontWeight: 700, color: '#7A7A9A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Book title
        </div>
        <input
          value={titleInput}
          onChange={e => setTitleInput(e.target.value)}
          style={{
            background: '#FFF8F0',
            border: '2px solid rgba(255,107,53,0.25)',
            borderRadius: 14,
            padding: '14px 16px',
            fontFamily: "'Baloo 2', cursive",
            fontSize: 17,
            fontWeight: 700,
            color: '#1A1A2E',
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
      </div>
      <button
        onClick={confirmTitle}
        disabled={!titleInput.trim()}
        style={{
          background: titleInput.trim() ? ACCENT : '#E0E0E0',
          color: 'white',
          border: 'none',
          borderRadius: 20,
          padding: '20px 24px',
          fontFamily: "'Baloo 2', cursive",
          fontSize: 20,
          fontWeight: 800,
          cursor: titleInput.trim() ? 'pointer' : 'not-allowed',
          boxShadow: titleInput.trim() ? '0 8px 24px rgba(255,107,53,0.30)' : 'none',
          width: '100%',
        }}
      >
        Yes, that's right! ✅
      </button>
    </Screen>
  )

  if (step === 'cover-success') return (
    <Screen>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <TutoBubble message="Found it! 📚" />
        <div style={{
          background: 'white',
          borderRadius: 24,
          padding: '22px 28px',
          boxShadow: '0 4px 28px rgba(255,107,53,0.12)',
          textAlign: 'center',
          width: '100%',
        }}>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#1A1A2E' }}>
            📖 {book?.title}
          </div>
        </div>
      </div>
    </Screen>
  )

  if (step === 'book-status') return (
    <Screen>
      <TutoBubble message={`"${book?.title}" — awesome choice! 🌟 Have you already read this book?`} />
      <button
        onClick={markCompleted}
        style={{
          background: '#2EC486',
          color: 'white',
          border: 'none',
          borderRadius: 20,
          padding: '20px 24px',
          fontFamily: "'Baloo 2', cursive",
          fontSize: 20,
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(46,196,134,0.30)',
          width: '100%',
        }}
      >
        Yes, I finished it! ✅
      </button>
      <button
        onClick={() => setStep('page-number')}
        style={{
          background: ACCENT,
          color: 'white',
          border: 'none',
          borderRadius: 20,
          padding: '20px 24px',
          fontFamily: "'Baloo 2', cursive",
          fontSize: 20,
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(255,107,53,0.30)',
          width: '100%',
        }}
      >
        No, I'm reading it now 📖
      </button>
    </Screen>
  )

  if (step === 'page-number') return (
    <Screen onBack={() => setStep('book-status')}>
      <TutoBubble message="Which page are you on? 📖" tutoSize={100} />
      <div style={{
        background: 'white',
        borderRadius: 24,
        padding: '24px',
        boxShadow: '0 4px 24px rgba(255,107,53,0.10)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <input
          type="number"
          value={pageInput}
          onChange={e => setPageInput(e.target.value)}
          placeholder="e.g. 42"
          min="0"
          style={{
            background: '#FFF8F0',
            border: '2px solid rgba(255,107,53,0.25)',
            borderRadius: 16,
            padding: '18px 20px',
            fontFamily: "'Baloo 2', cursive",
            fontSize: 24,
            fontWeight: 800,
            color: '#1A1A2E',
            outline: 'none',
            textAlign: 'center',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={() => savePageNumber(false)}
          disabled={!pageInput}
          style={{
            background: ACCENT,
            color: 'white',
            border: 'none',
            borderRadius: 16,
            padding: '18px',
            fontFamily: "'Baloo 2', cursive",
            fontSize: 20,
            fontWeight: 800,
            cursor: pageInput ? 'pointer' : 'not-allowed',
            opacity: pageInput ? 1 : 0.45,
            boxShadow: pageInput ? '0 8px 24px rgba(255,107,53,0.30)' : 'none',
          }}
        >
          Save →
        </button>
        <button
          onClick={() => savePageNumber(true)}
          style={{
            background: 'rgba(255,107,53,0.08)',
            color: '#7A7A9A',
            border: 'none',
            borderRadius: 16,
            padding: '14px',
            fontFamily: "'Baloo 2', cursive",
            fontSize: 17,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Skip
        </button>
      </div>
    </Screen>
  )

  if (step === 'book-done') return (
    <Screen>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <TutoBubble message="Amazing! Added to your finished books! 🏆" />
        <button
          onClick={() => nav('/child/library')}
          style={{
            background: ACCENT,
            color: 'white',
            border: 'none',
            borderRadius: 20,
            padding: '20px 24px',
            fontFamily: "'Baloo 2', cursive",
            fontSize: 20,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(255,107,53,0.35)',
            width: '100%',
          }}
        >
          Go to My Library →
        </button>
      </div>
    </Screen>
  )

  if (step === 'existing-book') return (
    <Screen>
      <TutoBubble message={`Welcome back! Ready to read more of "${book?.title}"? 📖`} />
      {book?.cover_url && (
        <img
          src={book.cover_url}
          alt="cover"
          style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.10)' }}
        />
      )}
      <button
        className="btn btn-orange"
        onClick={() => setStep('page-prompt')}
        style={{ fontSize: 20, fontWeight: 800 }}
      >
        I've been reading! →
      </button>
      <button
        className="btn btn-ghost"
        onClick={() => { setBook(null); setStep('new-book') }}
        style={{ fontSize: 20, fontWeight: 800 }}
      >
        Start a different book
      </button>
    </Screen>
  )

  if (step === 'page-prompt') return (
    <Screen onBack={() => fromLibrary.current ? nav('/child/library') : setStep('existing-book')}>
      <TutoBubble
        message={error || "Take photos of all the pages you read! Add as many as you need 📸"}
        tutoSize={80}
      />

      {/* Empty state — big tap area */}
      {photos.length === 0 && (
        <div
          onClick={() => pageRef.current.click()}
          style={{
            background: 'rgba(255,255,255,0.72)',
            borderRadius: 28,
            border: '3px dashed #FF6B35',
            padding: '48px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            cursor: 'pointer',
            boxShadow: '0 4px 28px rgba(255,107,53,0.10)',
          }}
        >
          <div style={{ fontSize: 56 }}>📸</div>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: ACCENT }}>
            Tap to add first page
          </div>
        </div>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {photos.map((p, i) => (
            <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', background: '#F0EBE3' }}>
              <img src={p.preview} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <button
                onClick={() => removePhoto(i)}
                style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.55)', color: 'white',
                  border: 'none', fontSize: 15, fontWeight: 900, lineHeight: 1,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0,
                }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Add another page */}
      {photos.length > 0 && photos.length < 10 && (
        <button
          onClick={() => pageRef.current.click()}
          style={{
            background: 'rgba(255,255,255,0.85)',
            border: '2.5px dashed #FF6B35',
            borderRadius: 18,
            padding: '16px',
            fontFamily: "'Baloo 2', cursive",
            fontSize: 17, fontWeight: 800, color: ACCENT,
            cursor: 'pointer', width: '100%',
          }}
        >
          📸 Add another page ({photos.length}/10)
        </button>
      )}

      {/* Done button */}
      {photos.length > 0 && (
        <button
          onClick={submitAllPages}
          style={{
            background: ACCENT,
            color: 'white', border: 'none', borderRadius: 20,
            padding: '20px 24px',
            fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(255,107,53,0.35)',
            width: '100%',
          }}
        >
          Done! Let's talk 📚
        </button>
      )}

      <input
        ref={pageRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) addPhoto(f)
          e.target.value = ''
        }}
      />
    </Screen>
  )

  if (step === 'page-loading') return (
    <Screen>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <TutoBubble message="Let me see what you've been reading... 🧐 I'm cooking up some questions!" />
      </div>
    </Screen>
  )

  if (step === 'questions' && questions.length > 0) {
    const q = questions[qIdx]
    const answered = answers[qIdx] !== undefined
    return (
      <Screen>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          {questions.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1, height: 6, borderRadius: 3,
                background: i < qIdx ? ACCENT : i === qIdx ? '#FFBFA0' : 'rgba(255,255,255,0.55)',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: qVisible ? 1 : 0, transition: 'opacity 0.35s ease' }}>
          <TutoBubble message={q.tuto_intro} tutoSize={80} />

          <div style={{
            background: 'white',
            borderRadius: 24,
            padding: '22px 24px',
            boxShadow: '0 4px 24px rgba(255,107,53,0.10)',
          }}>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#1A1A2E', lineHeight: 1.5 }}>
              {q.question}
            </div>
          </div>

          {q.type === 'mc' && !answered && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {q.options?.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleMC(i)}
                  style={{
                    background: 'rgba(255,255,255,0.88)',
                    border: '2px solid rgba(255,107,53,0.18)',
                    borderRadius: 18,
                    padding: '16px 20px',
                    fontFamily: "'Baloo 2', cursive",
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#1A1A2E',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                  }}
                >
                  <span style={{ color: ACCENT, marginRight: 10 }}>{String.fromCharCode(65 + i)}.</span>{opt}
                </button>
              ))}
            </div>
          )}

          {q.type === 'mc' && answered && (
            <div style={{
              background: answers[qIdx] === q.correct ? '#E8F8EE' : '#FFF0EE',
              borderRadius: 20,
              padding: '22px 24px',
              fontFamily: "'Baloo 2', cursive",
              fontSize: 22,
              fontWeight: 800,
              color: answers[qIdx] === q.correct ? '#2EC486' : '#D63030',
              textAlign: 'center',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            }}>
              {answers[qIdx] === q.correct ? '✅ Correct!' : `❌ The answer was: ${q.options?.[q.correct]}`}
            </div>
          )}

          {q.type === 'oe' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <textarea
                value={oeInput}
                onChange={e => setOeInput(e.target.value)}
                placeholder="Write your answer here..."
                rows={3}
                style={{
                  background: 'rgba(255,255,255,0.88)',
                  border: '2px solid rgba(255,107,53,0.2)',
                  borderRadius: 18,
                  padding: '16px 18px',
                  fontFamily: "'Baloo 2', cursive",
                  fontSize: 18,
                  fontWeight: 600,
                  color: '#1A1A2E',
                  resize: 'none',
                  outline: 'none',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                }}
              />
              <button
                className="btn btn-orange"
                onClick={handleOE}
                disabled={!oeInput.trim()}
                style={{ opacity: oeInput.trim() ? 1 : 0.45, fontSize: 20, fontWeight: 800 }}
              >
                Send →
              </button>
            </div>
          )}
        </div>
      </Screen>
    )
  }

  if (step === 'result') return (
    <Screen>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <TutoBubble message={`Amazing! You got ${finalCorrect} out of ${questions.length} right! 🎉`} />
        <div style={{
          background: ACCENT,
          borderRadius: 28,
          padding: '28px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          boxShadow: '0 12px 48px rgba(255,107,53,0.40)',
          width: '100%',
        }}>
          <div style={{ fontSize: 52 }}>💎</div>
          <div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
              You earned!
            </div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 44, fontWeight: 800, color: 'white', lineHeight: 1 }}>
              +{gemsEarned} Gems
            </div>
          </div>
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => nav('/child/library')}
          style={{ fontSize: 20, fontWeight: 800, width: '100%' }}
        >
          Back to My Books
        </button>
      </div>
    </Screen>
  )

  return null
}
