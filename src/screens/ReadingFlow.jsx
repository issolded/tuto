import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'
import { useIsTablet } from '../components/Shell'
import { storageClient, submitReadingSession } from '../lib/supabase'
import { currentChildId } from '../lib/gemini'
import { t, childLang } from '../lib/i18n'

const ACCENT = '#FF6B35'
const BG = 'linear-gradient(160deg, #FFF3E8 0%, #FFDFC8 100%)'

// Gemini calls go through the backend — the API key must never ship in the
// client bundle (see src/lib/gemini.js for why).
const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'
const API_URL = `${SERVER}/api/gemini/generate`

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
      parts,
      childId: currentChildId(),
      generationConfig: { response_mime_type: 'application/json' },
    }),
  })
  if (!r.ok) throw new Error(`API ${r.status}`)
  const d = await r.json()
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text || ''
  // Gemini appends trailing prose/duplicate JSON after the closing brace
  // roughly 2/3 of the time even with response_mime_type set — slice the
  // outermost {...} instead of a naive fence strip (see parseObservation()
  // in server/prompts/homework.js for the same pattern).
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) throw new Error('no JSON object in response')
  return JSON.parse(text.slice(start, end + 1))
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
Also report "last_page_number": the printed page number on the LAST page shown, as an integer.
Most books print it in a corner or the footer. Use null if no page number is legible anywhere
in the photos — do not guess it from the order of the photos or the amount of text.
Return JSON only:
{
  "last_page_number": 42,
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

function Screen({ children, onBack, lang }) {
  const nav = useNavigate()
  const isTablet = useIsTablet()
  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: isTablet ? 1180 : 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
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
        <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#1A1A2E' }}>
          {t('rd_title', lang)}
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
          fontFamily: "'TrRound', 'Baloo 2', cursive",
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

function PhotoArea({ inputRef, label, lang }) {
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
      <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 28, fontWeight: 800, color: ACCENT }}>
        {t('rd_tap_here', lang)}
      </div>
      <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 16, fontWeight: 600, color: '#7A7A9A', textAlign: 'center' }}>
        {label}
      </div>
    </div>
  )
}

// Asked three times now — how long the book is, which page you are on, which page you stopped
// at — so it stopped being worth writing out three times.
function NumberPrompt({ value, onChange, placeholder, onSave, onSkip, saveLabel, skipLabel }) {
  return (
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
        inputMode="numeric"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        min="1"
        style={{
          background: '#FFF8F0',
          border: '2px solid rgba(255,107,53,0.25)',
          borderRadius: 16,
          padding: '18px 20px',
          fontFamily: "'TrRound', 'Baloo 2', cursive",
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
        onClick={onSave}
        disabled={!value}
        style={{
          background: ACCENT,
          color: 'white',
          border: 'none',
          borderRadius: 16,
          padding: '18px',
          fontFamily: "'TrRound', 'Baloo 2', cursive",
          fontSize: 20,
          fontWeight: 800,
          cursor: value ? 'pointer' : 'not-allowed',
          opacity: value ? 1 : 0.45,
          boxShadow: value ? '0 8px 24px rgba(255,107,53,0.30)' : 'none',
        }}
      >
        {saveLabel}
      </button>
      <button
        onClick={onSkip}
        style={{
          background: 'rgba(255,107,53,0.08)',
          color: '#7A7A9A',
          border: 'none',
          borderRadius: 16,
          padding: '14px',
          fontFamily: "'TrRound', 'Baloo 2', cursive",
          fontSize: 17,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {skipLabel}
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReadingFlow() {
  const nav = useNavigate()
  const location = useLocation()
  const child = JSON.parse(localStorage.getItem('child') || 'null')
  const childId = child?.id
  const age = Number(child?.age) || 7
  const lang = childLang(child)
  const s = (key, vars) => {
    const str = t(key, lang)
    return vars ? str.replace(/%(\w+)%/g, (m, k) => (vars[k] ?? m)) : str
  }

  const [step, setStep] = useState('checking')
  const [book, setBook] = useState(null)
  const [questions, setQuestions] = useState([])
  const [qIdx, setQIdx] = useState(0)
  const [qVisible, setQVisible] = useState(true)
  const [answers, setAnswers] = useState({})
  const [oeInput, setOeInput] = useState('')
  const [pageInput, setPageInput] = useState('')
  const [totalInput, setTotalInput] = useState('')
  // Where the child got to in this sitting. Read off the page photos when a page number is
  // legible in them, asked only when it is not — the photos are already going to the model,
  // so the common case costs nothing and the child is not interrogated about their own book.
  const [sessionPage, setSessionPage] = useState(null)
  // null until the server answers. The result screen opens before the session is saved —
  // pages upload first — and a 0 sitting there reads as "+0 Gems" for those seconds.
  const [gemsEarned, setGemsEarned] = useState(null)
  const [finalCorrect, setFinalCorrect] = useState(0)
  const [error, setError] = useState('')
  const [photos, setPhotos] = useState([])           // [{ file, preview }] — the picker
  // The pages actually submitted. `photos` is cleared as soon as the questions come back so
  // the picker is empty next time, which used to be the last anyone saw of them: they went to
  // Gemini and nowhere else. Held here so they can be stored with the finished session.
  const [pageFiles, setPageFiles] = useState([])
  const [saveFailed, setSaveFailed] = useState(false)
  const [capped, setCapped] = useState(false)
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
      // Not straight to the camera: this is the only screen that tells the child where they
      // stopped and the only one that lets them say the book is finished.
      setStep('existing-book')
      return
    }
    if (!childId) { setStep('new-book'); return }
    storageClient
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
        setError(s('rd_not_book'))
        setStep('new-book')
        return
      }
      if (confidence < 0.6) {
        setError(s('rd_low_confidence'))
        setStep('new-book')
        return
      }
      if (childId) {
        const { data: existing } = await storageClient.from('books').select('title').eq('child_id', childId)
        const dupe = (existing ?? []).some(
          b => b.title.toLowerCase().trim() === title.toLowerCase().trim()
        )
        if (dupe) {
          setError(s('rd_dupe'))
          setStep('new-book')
          return
        }
      }
      pendingFile.current = file
      setPendingCoverPreview(URL.createObjectURL(file))
      setTitleInput(title)
      setStep('title-confirm')
    } catch {
      setError(s('rd_try_again'))
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
        await storageClient.storage.from('submissions').upload(path, file, { contentType: file.type, upsert: false })
        coverUrl = storageClient.storage.from('submissions').getPublicUrl(path).data.publicUrl
      } catch { /* storage optional */ }
      const { data: newBook, error: insertError } = await storageClient
        .from('books')
        .insert({ child_id: childId, title, cover_url: coverUrl, current_page: 0, completed: false })
        .select().single()
      if (insertError) throw insertError
      setBook(newBook)
      setStep('cover-success')
    } catch {
      setError(s('rd_try_again'))
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
      const files = photos.map(p => p.file)
      const { questions: qs, last_page_number } = await readPagesAndAsk(files, book.title, age, lang)
      setQuestions(qs ?? [])
      setQIdx(0)
      setQVisible(true)
      setAnswers({})
      setOeInput('')
      setPageFiles(files)
      setPhotos([])
      // A page number below where the child already was is a misread, not a correction — the
      // model sees one corner of one photo and books repeat digits in headers and footnotes.
      const seen = Math.floor(Number(last_page_number))
      const usable = Number.isFinite(seen) && seen > (book.current_page ?? 0)
        && seen <= (book.total_pages ?? 10000)
      if (usable) { setSessionPage(seen); setStep('questions') }
      else { setPageInput(''); setStep('session-page') }
    } catch {
      setError(s('rd_pages_failed'))
      setStep('page-prompt')
    }
  }

  async function markCompleted() {
    if (book?.id) {
      await storageClient.from('books').update({ completed: true }).eq('id', book.id)
    }
    setStep('book-done')
  }

  // The number printed on the last page. Asked once, skippable, and skippable is the point:
  // without it the library shows the child which page they are on instead of a percentage,
  // which is better than a bar filled against a total someone made up.
  async function saveTotalPages(skip) {
    const total = skip ? null : Math.floor(Number(totalInput))
    if (!skip && book?.id && Number.isFinite(total) && total > 0) {
      const capped = Math.min(total, 10000)
      await storageClient.from('books').update({ total_pages: capped }).eq('id', book.id)
      setBook(b => (b ? { ...b, total_pages: capped } : b))
    }
    setPageInput('')
    setStep('page-number')
  }

  async function savePageNumber(skip) {
    if (!skip && book?.id) {
      const page = Math.floor(Number(pageInput))
      // Only ever forwards, and never past the end: a child who mistypes 420 for 42 should
      // not have their book marked as finished, and one who types 2 after reaching 60 has
      // told us where they are in a chapter, not that they un-read fifty-eight pages.
      const capped = Math.min(page, book.total_pages ?? 10000)
      if (Number.isFinite(page) && capped > (book.current_page ?? 0)) {
        await storageClient.from('books').update({ current_page: capped }).eq('id', book.id)
      }
    }
    nav('/child/library')
  }

  function handleMC(optIdx) {
    const q = questions[qIdx]
    const correct = optIdx === q.correct
    setAnswers(p => ({ ...p, [qIdx]: optIdx }))
    setTimeout(() => advanceQ(correct ? 1 : 0, optIdx), 900)
  }

  function handleOE() {
    if (!oeInput.trim()) return
    const given = oeInput.trim()
    setAnswers(p => ({ ...p, [qIdx]: given }))
    setOeInput('')
    advanceQ(1, given)
  }

  // The last answer travels with the call rather than being read back out of state: the
  // setAnswers above has not landed yet by the time the final question finishes, which is
  // why the score was already being computed as "everything before" plus a separate flag.
  function advanceQ(earned, given) {
    setQVisible(false)
    const nextIdx = qIdx + 1
    const isLast = nextIdx >= questions.length
    setTimeout(() => {
      if (isLast) finishReading(earned, given)
      else { setQIdx(nextIdx); setQVisible(true) }
    }, 350)
  }

  async function finishReading(lastEarned, lastGiven) {
    // One record of the whole round: what was asked, what the child said, and whether it
    // was right. Only the question TEXT used to be stored, in a column nothing has ever
    // read back, and the answers were not stored at all.
    const given = { ...answers, [qIdx]: lastGiven }
    const qa = questions.map((q, i) => {
      const ans = given[i]
      const isMC = q.type === 'mc'
      return {
        question: q.question,
        type: isMC ? 'mc' : 'oe',
        options: isMC ? q.options ?? null : null,
        correct_answer: isMC ? (q.options?.[q.correct] ?? null) : null,
        child_answer: isMC ? (q.options?.[ans] ?? null) : (ans ?? null),
        // Open questions are not machine-marked — answering one counts, and the parent
        // reads the actual words below. That is how the score has always been worked out.
        was_correct: isMC ? ans === q.correct : ans != null,
      }
    })

    const correct = qa.filter(a => a.was_correct).length
    setFinalCorrect(correct)
    setStep('result')

    if (!childId) { setGemsEarned(0); return }
    try {
      const result = await submitReadingSession(
        childId,
        {
          bookId: book?.id ?? null,
          bookTitle: book?.title ?? null,
          questions: questions.length,
          answers: qa,
          currentPage: sessionPage,
        },
        pageFiles,
      )
      setGemsEarned(result?.gems_earned ?? 0)
      setCapped(!!result?.capped)
      setSaveFailed(false)
    } catch (err) {
      // The reading happened; say plainly that it did not save rather than showing a
      // confident "+0 Gems", which is what the maths screen used to do when it threw.
      console.error('[reading] save failed', err)
      setGemsEarned(0)
      setSaveFailed(true)
    }
  }

  const coverPrompt = s(age <= 7 ? 'rd_cover_young' : age <= 10 ? 'rd_cover_mid' : 'rd_cover_older')

  // ─── Render ────────────────────────────────────────────────────────────────

  if (step === 'checking') return (
    <Screen lang={lang}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <TutoBubble message={s('rd_checking')} />
      </div>
    </Screen>
  )

  if (step === 'new-book') return (
    <Screen lang={lang}>
      <TutoBubble message={error || coverPrompt} />
      <PhotoArea inputRef={coverRef} label={s('rd_cover_label')} lang={lang} />
      <input
        ref={coverRef}
        type="file"
        accept="image/*"

        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) submitCover(f) }}
      />
    </Screen>
  )

  if (step === 'cover-loading') return (
    <Screen lang={lang}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <TutoBubble message={s('rd_cover_loading')} />
      </div>
    </Screen>
  )

  if (step === 'title-confirm') return (
    <Screen lang={lang} onBack={() => setStep('new-book')}>
      <TutoBubble message={s('rd_is_this')} tutoSize={80} />
      {pendingCoverPreview && (
        <img
          src={pendingCoverPreview}
          alt="cover preview"
          draggable={false}
          style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.10)' }}
        />
      )}
      <div style={{ background: 'white', borderRadius: 24, padding: '20px', boxShadow: '0 4px 24px rgba(255,107,53,0.10)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 12, fontWeight: 700, color: '#7A7A9A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {s('rd_book_title')}
        </div>
        <input
          value={titleInput}
          onChange={e => setTitleInput(e.target.value)}
          style={{
            background: '#FFF8F0',
            border: '2px solid rgba(255,107,53,0.25)',
            borderRadius: 14,
            padding: '14px 16px',
            fontFamily: "'TrRound', 'Baloo 2', cursive",
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
          fontFamily: "'TrRound', 'Baloo 2', cursive",
          fontSize: 20,
          fontWeight: 800,
          cursor: titleInput.trim() ? 'pointer' : 'not-allowed',
          boxShadow: titleInput.trim() ? '0 8px 24px rgba(255,107,53,0.30)' : 'none',
          width: '100%',
        }}
      >
        {s('rd_yes_right')}
      </button>
    </Screen>
  )

  if (step === 'cover-success') return (
    <Screen lang={lang}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <TutoBubble message={s('rd_found_it')} />
        <div style={{
          background: 'white',
          borderRadius: 24,
          padding: '22px 28px',
          boxShadow: '0 4px 28px rgba(255,107,53,0.12)',
          textAlign: 'center',
          width: '100%',
        }}>
          <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#1A1A2E' }}>
            📖 {book?.title}
          </div>
        </div>
      </div>
    </Screen>
  )

  if (step === 'book-status') return (
    <Screen lang={lang}>
      <TutoBubble message={s('rd_have_you_read', { title: book?.title ?? '' })} />
      <button
        onClick={markCompleted}
        style={{
          background: '#2EC486',
          color: 'white',
          border: 'none',
          borderRadius: 20,
          padding: '20px 24px',
          fontFamily: "'TrRound', 'Baloo 2', cursive",
          fontSize: 20,
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(46,196,134,0.30)',
          width: '100%',
        }}
      >
        {s('rd_yes_finished')}
      </button>
      <button
        onClick={() => { setTotalInput(''); setStep('total-pages') }}
        style={{
          background: ACCENT,
          color: 'white',
          border: 'none',
          borderRadius: 20,
          padding: '20px 24px',
          fontFamily: "'TrRound', 'Baloo 2', cursive",
          fontSize: 20,
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(255,107,53,0.30)',
          width: '100%',
        }}
      >
        {s('rd_no_reading')}
      </button>
    </Screen>
  )

  if (step === 'total-pages') return (
    <Screen lang={lang} onBack={() => setStep('book-status')}>
      <TutoBubble message={s('rd_total_q')} tutoSize={100} />
      <NumberPrompt
        value={totalInput}
        onChange={setTotalInput}
        placeholder={s('rd_total_ph')}
        onSave={() => saveTotalPages(false)}
        onSkip={() => saveTotalPages(true)}
        saveLabel={s('rd_save')}
        skipLabel={s('rd_skip')}
      />
    </Screen>
  )

  if (step === 'page-number') return (
    <Screen lang={lang} onBack={() => setStep('total-pages')}>
      <TutoBubble message={s('rd_page_q')} tutoSize={100} />
      <NumberPrompt
        value={pageInput}
        onChange={setPageInput}
        placeholder={s('rd_page_ph')}
        onSave={() => savePageNumber(false)}
        onSkip={() => savePageNumber(true)}
        saveLabel={s('rd_save')}
        skipLabel={s('rd_skip')}
      />
    </Screen>
  )

  // Only reached when no page number was legible in the photos. The reading is already done
  // and the questions are waiting, so this cannot be a wall: skipping leaves the book where
  // it was and goes straight on.
  if (step === 'session-page') return (
    <Screen lang={lang}>
      <TutoBubble message={s('rd_stopped_q')} tutoSize={100} />
      <NumberPrompt
        value={pageInput}
        onChange={setPageInput}
        placeholder={s('rd_page_ph')}
        onSave={() => {
          const page = Math.floor(Number(pageInput))
          if (Number.isFinite(page) && page > (book?.current_page ?? 0)) {
            setSessionPage(Math.min(page, book?.total_pages ?? 10000))
          }
          setStep('questions')
        }}
        onSkip={() => setStep('questions')}
        saveLabel={s('rd_save')}
        skipLabel={s('rd_skip')}
      />
    </Screen>
  )

  if (step === 'book-done') return (
    <Screen lang={lang}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <TutoBubble message={s('rd_added')} />
        <button
          onClick={() => nav('/child/library')}
          style={{
            background: ACCENT,
            color: 'white',
            border: 'none',
            borderRadius: 20,
            padding: '20px 24px',
            fontFamily: "'TrRound', 'Baloo 2', cursive",
            fontSize: 20,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(255,107,53,0.35)',
            width: '100%',
          }}
        >
          {s('rd_go_library')}
        </button>
      </div>
    </Screen>
  )

  if (step === 'existing-book') return (
    <Screen lang={lang} onBack={fromLibrary.current ? () => nav('/child/library') : undefined}>
      <TutoBubble message={s('rd_welcome_back', { title: book?.title ?? '' })} />
      {book?.cover_url && (
        <img
          src={book.cover_url}
          alt="cover"
          style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.10)' }}
        />
      )}
      {(book?.current_page ?? 0) > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.85)',
          borderRadius: 18,
          padding: '14px 18px',
          textAlign: 'center',
          fontFamily: "'TrRound', 'Baloo 2', cursive",
          fontSize: 17,
          fontWeight: 800,
          color: '#1A1A2E',
        }}>
          {book.total_pages > 0
            ? s('rd_last_page_of', { n: book.current_page, total: book.total_pages })
            : s('rd_last_page', { n: book.current_page })}
        </div>
      )}
      <button
        className="btn btn-orange"
        onClick={() => setStep('page-prompt')}
        style={{ fontSize: 20, fontWeight: 800 }}
      >
        {s('rd_been_reading')}
      </button>
      <button
        onClick={() => setStep('confirm-complete')}
        style={{
          background: '#2EC486',
          color: 'white',
          border: 'none',
          borderRadius: 20,
          padding: '20px 24px',
          fontFamily: "'TrRound', 'Baloo 2', cursive",
          fontSize: 20,
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(46,196,134,0.30)',
          width: '100%',
        }}
      >
        {s('rd_finished_book')}
      </button>
      <button
        className="btn btn-ghost"
        onClick={() => { setBook(null); setStep('new-book') }}
        style={{ fontSize: 20, fontWeight: 800 }}
      >
        {s('rd_other_book')}
      </button>
    </Screen>
  )

  // A finished book cannot be reopened from the library, so a mis-tap here would retire a
  // book the child is halfway through.
  if (step === 'confirm-complete') return (
    <Screen lang={lang} onBack={() => setStep('existing-book')}>
      <TutoBubble message={s('rd_finish_confirm', { title: book?.title ?? '' })} />
      <button
        onClick={markCompleted}
        style={{
          background: '#2EC486',
          color: 'white',
          border: 'none',
          borderRadius: 20,
          padding: '20px 24px',
          fontFamily: "'TrRound', 'Baloo 2', cursive",
          fontSize: 20,
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(46,196,134,0.30)',
          width: '100%',
        }}
      >
        {s('rd_finish_yes')}
      </button>
      <button
        className="btn btn-ghost"
        onClick={() => setStep('existing-book')}
        style={{ fontSize: 20, fontWeight: 800 }}
      >
        {s('rd_finish_no')}
      </button>
    </Screen>
  )

  if (step === 'page-prompt') return (
    <Screen lang={lang} onBack={() => setStep('existing-book')}>
      <TutoBubble
        message={error || s('rd_pages_prompt')}
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
          <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: ACCENT }}>
            {s('rd_tap_first_page')}
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
            fontFamily: "'TrRound', 'Baloo 2', cursive",
            fontSize: 17, fontWeight: 800, color: ACCENT,
            cursor: 'pointer', width: '100%',
          }}
        >
          {s('rd_add_another', { n: photos.length })}
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
            fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 20, fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(255,107,53,0.35)',
            width: '100%',
          }}
        >
          {s('rd_done_talk')}
        </button>
      )}

      <input
        ref={pageRef}
        type="file"
        accept="image/*"

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
    <Screen lang={lang}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <TutoBubble message={s('rd_page_loading')} />
      </div>
    </Screen>
  )

  if (step === 'questions' && questions.length > 0) {
    const q = questions[qIdx]
    const answered = answers[qIdx] !== undefined
    return (
      <Screen lang={lang}>
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
            <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#1A1A2E', lineHeight: 1.5 }}>
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
                    fontFamily: "'TrRound', 'Baloo 2', cursive",
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
              fontFamily: "'TrRound', 'Baloo 2', cursive",
              fontSize: 22,
              fontWeight: 800,
              color: answers[qIdx] === q.correct ? '#2EC486' : '#D63030',
              textAlign: 'center',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            }}>
              {answers[qIdx] === q.correct ? s('rd_correct') : s('rd_answer_was', { a: q.options?.[q.correct] ?? '' })}
            </div>
          )}

          {q.type === 'oe' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <textarea
                value={oeInput}
                onChange={e => setOeInput(e.target.value)}
                placeholder={s('rd_write_answer')}
                rows={3}
                style={{
                  background: 'rgba(255,255,255,0.88)',
                  border: '2px solid rgba(255,107,53,0.2)',
                  borderRadius: 18,
                  padding: '16px 18px',
                  fontFamily: "'TrRound', 'Baloo 2', cursive",
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
                {s('rd_send')}
              </button>
            </div>
          )}
        </div>
      </Screen>
    )
  }

  const awaitingGems = gemsEarned == null && !saveFailed

  if (step === 'result') return (
    <Screen lang={lang}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <TutoBubble message={s('rd_result', { c: finalCorrect, n: questions.length })} />
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
          <div style={{ fontSize: 52 }}>{saveFailed ? '😕' : awaitingGems ? '⏳' : capped ? '🌙' : '💎'}</div>
          <div>
            <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
              {saveFailed ? s('rd_save_failed') : awaitingGems ? s('rd_nearly') : capped ? s('rd_capped') : s('rd_earned')}
            </div>
            <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: saveFailed || capped || awaitingGems ? 22 : 44, fontWeight: 800, color: 'white', lineHeight: 1.15 }}>
              {saveFailed ? s('rd_tell_grownup') : awaitingGems ? s('rd_counting') : capped ? s('rd_come_back') : s('rd_gems', { n: gemsEarned })}
            </div>
          </div>
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => nav('/child/library')}
          style={{ fontSize: 20, fontWeight: 800, width: '100%' }}
        >
          {s('rd_back_books')}
        </button>
      </div>
    </Screen>
  )

  return null
}
