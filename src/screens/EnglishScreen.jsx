import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t, say, childLang } from '../lib/i18n'
import TutoMascot from '../components/TutoMascot'
import { useIsTablet } from '../components/Shell'
import { EnglishStem, EnglishOptions, englishWhyLines } from '../components/EnglishView'
import { EnglishReviewList } from '../components/SittingReview'
import Scratchpad from '../components/Scratchpad'
import EnglishHelpVisual from '../components/EnglishHelpVisual'

// The child's English: verbal reasoning, spelling and grammar in the Bond 11+ English books'
// formats. Ten questions from the child's age band, one at a time, each marked when it is sent.
//
// PuzzleScreen's contract and its shape: the server deals the sheet and keeps the answers
// (server/index.js, "English sessions"), this screen only shows the words and asks. Same welcome,
// header, flash, leave sheet and result card, same math_* words where the meaning is the same.
// What is new is that some questions want TWO answers ("which TWO do not belong"): a tap toggles
// an option, and Send waits until as many are chosen as the question asks for.

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'

const ROSE      = '#D9577A'
const INK       = '#241f3a'
const INK_SOFT  = '#8d83ad'
const GREEN     = '#4cb685'
const ORANGE    = '#f79433'
const FRED      = "'TrRound', 'Fredoka', 'Baloo 2', sans-serif"
const FLOW_BG   = 'linear-gradient(172deg,#FFF1F4 0%,#FADBE3 100%)'

const ANIM = `
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
@keyframes pop { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes flashIn { 0% { opacity: 0; } 15% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
@keyframes hintNudge { 0%, 100% { transform: scale(1) rotate(0); } 20% { transform: scale(1.12) rotate(-5deg); } 40% { transform: scale(1.12) rotate(5deg); } 60% { transform: scale(1.08) rotate(-3deg); } 80% { transform: scale(1.04) rotate(2deg); } }
@keyframes flashHold { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleIn { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
.pz-press:active { transform: scale(.96) !important; }
.pz-scroll { overflow-y: auto; min-height: 0; }
.pz-scroll::-webkit-scrollbar { display: none; }
.pz-feedback > * { flex-shrink: 0; }
`

async function post(path, body) {
  const res = await fetch(`${SERVER}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

// What Tuto says over the result. Maths gets a line from the model; there is nothing here for a
// model to read, so it is chosen by score.
function encouragementKey(correct, total) {
  const acc = total ? correct / total : 0
  return total && correct === total ? 'english_enc_perfect'
    : acc >= 0.8 ? 'english_enc_high' : acc >= 0.5 ? 'english_enc_mid' : 'english_enc_low'
}

export default function EnglishScreen() {
  const nav = useNavigate()
  const isTablet = useIsTablet()
  const [child] = useState(() => JSON.parse(localStorage.getItem('child') || 'null'))
  const language = childLang(child)

  const [step, setStep] = useState('loading')   // loading | welcome | questions | finishing | result | error
  const [session, setSession] = useState(null)
  const [qIdx, setQIdx] = useState(0)
  const [answers, setAnswers] = useState([])      // per question: { correct, chosen, correct_indices, why }
  const [pending, setPending] = useState(false)
  // The options chosen and not yet sent. One-answer questions: a tap moves the choice. Two-answer
  // questions: a tap toggles, and a third tap drops the oldest.
  const [picked, setPicked] = useState([])
  const [answerFailed, setAnswerFailed] = useState(false)
  const [flash, setFlash] = useState(null)        // the answer response while the overlay is up
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [result, setResult] = useState(null)
  // Help for the question on screen. `rungs` are the hints asked for so far (the server builds each
  // one when it is asked, so nothing that gives the answer is ever sent with the question);
  // `struck` the options out of play, by a hint or by a first wrong try (single-answer only).
  const [rungs, setRungs] = useState([])
  const [struck, setStruck] = useState([])
  const [hintBusy, setHintBusy] = useState(false)
  const [nudge, setNudge] = useState(false)
  const advanceTimer = useRef(null)

  const wrap = {
    background: FLOW_BG, minHeight: '100vh', maxWidth: isTablet ? 1180 : 430,
    margin: '0 auto', display: 'flex', flexDirection: 'column', fontFamily: "'Nunito', sans-serif",
  }
  const shell = { ...wrap, height: '100dvh', minHeight: 0, overflow: 'hidden' }

  function fetchSession() {
    return post(`/api/children/${child.id}/english-session`)
  }
  function begin(s) {
    setSession(s)
    setQIdx(0)
    setAnswers([])
    setResult(null)
    setStep('welcome')
  }
  function retry() {
    if (session?.review) { nav('/child/home'); return }
    setStep('loading')
    fetchSession().then(begin, () => setStep('error'))
  }

  useEffect(() => {
    if (!child?.id) { nav('/child', { replace: true }); return }
    fetchSession().then(begin, () => setStep('error'))
    return () => clearTimeout(advanceTimer.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const total = session?.questions?.length ?? 0

  async function finish() {
    setStep('finishing')
    try {
      if (session.review) {
        const r = await post(`/api/children/${child.id}/english-review/${session.session_id}/finish`)
        setResult({ review_done: true, correct: r.correct ?? 0, total: r.asked ?? total, gems_earned: r.gems_earned ?? 0 })
      } else {
        setResult(await post(`/api/english-sessions/${session.session_id}/finish`))
      }
      setStep('result')
    } catch {
      setStep('error')
    }
  }

  // The review round: fresh questions of the kinds that went wrong, dealt by the server. "Not now" lets
  // the parent's message go and the kinds carry into the next sitting.
  async function startReview() {
    const offer = result.review
    setStep('loading')
    try {
      const r = await post(`/api/children/${child.id}/english-review/${offer.id}/start`)
      begin({ ...r, review: true, will_pay: offer.gems_possible, gems: null })
    } catch { setStep('error') }
  }
  async function declineReview() {
    try { await post(`/api/children/${child.id}/english-review/${result.review.id}/decline`) } catch { /* the sweep settles it */ }
    nav('/child/home')
  }

  function advance() {
    clearTimeout(advanceTimer.current)
    setFlash(null)
    setPicked([])
    setRungs([])
    setStruck([])
    setNudge(false)
    if (qIdx >= total - 1) finish()
    else setQIdx(qIdx + 1)
  }

  function select(i) {
    if (pending || answers[qIdx] || struck.includes(i)) return
    const need = session.questions[qIdx].pick || 1
    setPicked(prev => (need === 1 ? [i]
      : prev.includes(i) ? prev.filter(x => x !== i)
        : prev.length >= need ? [...prev.slice(1), i] : [...prev, i]))
    setAnswerFailed(false)
  }

  async function skip() {
    if (pending || answers[qIdx]) return
    setPending(true)
    setAnswerFailed(false)
    try {
      const r = await post(`/api/english-sessions/${session.session_id}/answer`, { question_index: qIdx, skip: true })
      setAnswers(prev => { const next = prev.slice(); next[qIdx] = r; return next })
      setFlash({ ...r, skipped: true })
    } catch {
      setAnswerFailed(true)
    } finally {
      setPending(false)
    }
  }

  async function askHint() {
    if (hintBusy || pending || answers[qIdx] || rungs.length >= 3) return
    setHintBusy(true)
    setNudge(false)
    try {
      const h = await post(`/api/english-sessions/${session.session_id}/hint`, { question_index: qIdx, chosen: picked })
      setRungs(prev => [...prev, h])
      if (h.eliminate != null) {
        setStruck(prev => (prev.includes(h.eliminate) ? prev : [...prev, h.eliminate]))
        setPicked(prev => prev.filter(x => x !== h.eliminate))
      }
      requestAnimationFrame(() => {
        const el = document.querySelector('.pz-scroll')
        if (el && el.scrollHeight > el.clientHeight) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      })
    } catch {
      setAnswerFailed(true)
    } finally {
      setHintBusy(false)
    }
  }

  async function send() {
    const need = session.questions[qIdx].pick || 1
    if (picked.length !== need || pending || answers[qIdx]) return
    setPending(true)
    setAnswerFailed(false)
    try {
      const r = await post(`/api/english-sessions/${session.session_id}/answer`, { question_index: qIdx, chosen: picked })
      // The first wrong answer gives the question back and reveals nothing: the card greys the wrong
      // pick (when only one was asked for) and the 💡 shakes. Seven and over, as in maths.
      if (r.retry) {
        if ((session.questions[qIdx].pick || 1) === 1) setStruck(prev => [...new Set([...prev, ...picked])])
        setPicked([])
        setNudge(true)
        return
      }
      setAnswers(prev => { const next = prev.slice(); next[qIdx] = r; return next })
      setFlash(r)
      // A right answer flashes and moves on, as maths does. A wrong one stays until the child
      // taps, because it shows them the right figure and that is worth looking at.
      if (r.correct) advanceTimer.current = setTimeout(advance, 1400)
    } catch {
      setAnswerFailed(true)
    } finally {
      setPending(false)
    }
  }

  const backBtn = (onClick) => (
    <button onClick={onClick} style={{
      width: 42, height: 42, borderRadius: 14, background: 'rgba(255,255,255,0.85)', border: 'none',
      fontSize: 19, color: INK, fontWeight: 800, cursor: 'pointer', boxShadow: '0 3px 10px rgba(40,30,70,.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>←</button>
  )

  const primaryBtn = {
    background: ROSE, color: 'white', border: 'none', borderRadius: 20,
    padding: '17px 54px', fontFamily: FRED, fontSize: 20, fontWeight: 600,
    cursor: 'pointer', boxShadow: '0 10px 28px rgba(170,50,85,.38)',
  }

  // ── loading / finishing ────────────────────────────────────────────────────
  if (step === 'loading' || step === 'finishing') return (
    <div style={wrap}>
      <style>{ANIM}</style>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: 40 }}>
        <TutoMascot size={140} expression="thinking" color={ROSE} style={{ animation: 'float 2s ease-in-out infinite' }} />
        <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 20, color: INK, textAlign: 'center' }}>
          {t(step === 'loading' ? 'english_preparing' : 'math_checking', language)}
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              width: 11, height: 11, borderRadius: '50%', background: ROSE, display: 'inline-block',
              opacity: 0.4 + i * 0.25, animation: 'float 1s ease-in-out infinite', animationDelay: `${i * 0.15}s`,
            }} />
          ))}
        </div>
      </div>
    </div>
  )

  // ── error ──────────────────────────────────────────────────────────────────
  if (step === 'error') return (
    <div style={wrap}>
      <style>{ANIM}</style>
      <div style={{ position: 'absolute', top: 42, left: 18, zIndex: 10 }}>{backBtn(() => nav('/child/home'))}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '80px 26px 40px', textAlign: 'center' }}>
        <TutoMascot size={130} expression="default" color={ROSE} />
        <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 19, color: INK, lineHeight: 1.5 }}>{t('puzzle_failed', language)}</div>
        <button className="pz-press" onClick={retry} style={primaryBtn}>{t('puzzle_retry', language)}</button>
      </div>
    </div>
  )

  // ── welcome ────────────────────────────────────────────────────────────────
  if (step === 'welcome' && session) return (
    <div style={wrap}>
      <style>{ANIM}</style>
      <div style={{ position: 'absolute', top: 42, left: 18, zIndex: 10 }}>{backBtn(() => nav('/child/home'))}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 26px 40px', gap: 20, textAlign: 'center' }}>
        <TutoMascot size={150} expression="excited" color={ROSE} style={{ animation: 'float 3s ease-in-out infinite' }} />
        <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 21, color: INK, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
          {session.review
            ? say(language, 'New questions like the tricky ones!\nYou can ask for a 💡 hint any time.', 'Zorlandıklarına benzer yeni sorular!\nİstediğin zaman 💡 ipucu isteyebilirsin.', '¡Preguntas nuevas como las difíciles!\nPuedes pedir una pista 💡 cuando quieras.')
            : t('english_welcome', language)}
        </div>
        {(session.review ? session.will_pay : true) && (
          <div style={{
            background: session.will_pay ? ROSE : 'rgba(255,255,255,.8)', color: session.will_pay ? '#fff' : INK_SOFT,
            borderRadius: 11, padding: '4px 13px', fontFamily: FRED, fontWeight: 600, fontSize: 13,
          }}>
            {session.will_pay
              ? (session.review ? <>⭐ {say(language, 'A few bonus gems', 'Biraz bonus gem', 'Unos gems extra')}</> : <>⭐ {t('math_up_to_gems', language)} {session.gems} {t('math_gems_word', language)}</>)
              : <>🌙 {t('puzzle_no_gems', language)}</>}
          </div>
        )}
        <button className="pz-press" onClick={() => setStep('questions')} style={{ ...primaryBtn, marginTop: 4 }}>
          {t('math_lets_go', language)}
        </button>
      </div>
    </div>
  )

  // ── result ─────────────────────────────────────────────────────────────────
  if (step === 'result' && result) {
    const accuracy = result.total ? Math.round((result.correct / result.total) * 100) : 0
    return (
      <div style={shell}>
        <style>{ANIM}</style>
        <div style={{ background: ROSE, padding: '18px 24px 26px', borderRadius: '0 0 32px 32px', textAlign: 'center', flexShrink: 0 }}>
          <TutoMascot size={108} expression="proud" color="#fff" style={{ animation: 'float 3s ease-in-out infinite', display: 'inline-block' }} />
          <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 18, color: 'white', marginTop: 6, lineHeight: 1.5, padding: '0 8px' }}>
            {t(encouragementKey(result.correct, result.total), language)}
          </div>
        </div>

        <div className="pz-scroll" style={{ flex: 1, padding: '16px 18px 22px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{
            background: 'white', borderRadius: 22, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 4px 16px rgba(0,0,0,.05)', animation: 'fadeUp 0.4s ease both',
          }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 11, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '.6px' }}>{t('math_score', language)}</div>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 40, color: accuracy >= 80 ? GREEN : ORANGE, lineHeight: 1.05 }}>{accuracy}%</div>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: INK_SOFT, marginTop: 2 }}>{result.correct} / {result.total} {t('math_correct', language)}</div>
            </div>
            <div style={{ width: 1, height: 56, background: '#eee' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 11, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '.6px' }}>
                {result.capped ? t('math_capped', language) : t('math_earned', language)}
              </div>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 40, color: ORANGE, lineHeight: 1.05 }}>
                {result.capped ? '🌙' : `+${result.gems_earned}`}
              </div>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: INK_SOFT, marginTop: 2 }}>
                {result.capped ? t('math_come_back', language) : `${t('math_gems_word', language)} ⭐`}
              </div>
            </div>
          </div>

          {!result.review_done && (() => {
            const own = answers.filter(a => a?.correct && !a.helped).length
            const helped = answers.filter(a => a?.correct && a.helped).length
            const missed = answers.filter(a => a && !a.correct).length
            if (helped === 0 && missed === 0) return null
            const parts = [
              own > 0 && say(language, `${own} on your own`, `${own} yardımsız doğru`, `${own} sin ayuda`),
              helped > 0 && say(language, `${helped} right with a hint`, `${helped} ipucuyla doğru`, `${helped} bien con una pista`),
              missed > 0 && say(language, `${missed} to practise`, `${missed} geliştirilecek`, `${missed} por repasar`),
            ].filter(Boolean)
            return <div style={{ textAlign: 'center', fontFamily: FRED, fontWeight: 600, fontSize: 14, color: INK_SOFT, lineHeight: 1.5 }}>{parts.join(' · ')}</div>
          })()}

          {result.review && !result.review_done && (
            <div style={{ background: 'white', borderRadius: 22, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 4px 16px rgba(0,0,0,.05)', animation: 'fadeUp 0.4s ease 0.12s both' }}>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 16.5, color: INK, lineHeight: 1.4, textAlign: 'center' }}>
                {say(language, `Let's practise the tricky ones — ${result.review.count} new questions.`, `Zorlandıklarını pekiştirelim — ${result.review.count} yeni soru.`, `Repasemos las difíciles: ${result.review.count} preguntas nuevas.`)}
              </div>
              <div style={{ textAlign: 'center', fontFamily: FRED, fontWeight: 600, fontSize: 14, color: result.review.max_gems > 0 ? ORANGE : INK_SOFT }}>
                {result.review.max_gems > 0
                  ? say(language, `⭐ Up to +${result.review.max_gems} gems`, `⭐ En fazla +${result.review.max_gems} gem`, `⭐ Hasta +${result.review.max_gems} gems`)
                  : say(language, 'No gems this time, but it makes you stronger 💪', 'Bu sefer gem yok ama seni güçlendirir 💪', 'Esta vez sin gems, pero te hace más fuerte 💪')}
              </div>
              <button className="pz-press" onClick={startReview} style={{
                background: ROSE, color: 'white', border: 'none', borderRadius: 16, padding: '14px 20px',
                fontFamily: FRED, fontSize: 18, fontWeight: 600, cursor: 'pointer', boxShadow: '0 8px 20px rgba(170,50,85,.3)',
                alignSelf: 'center', width: '100%', maxWidth: 420,
              }}>{say(language, 'Practise', 'Pekiştirelim', 'Repasemos')} ({result.review.count})</button>
              <button className="pz-press" onClick={declineReview} style={{
                background: 'none', border: 'none', color: INK_SOFT, fontFamily: FRED, fontWeight: 600, fontSize: 15, padding: 8, cursor: 'pointer',
              }}>{say(language, 'Not now', 'Şimdi değil', 'Ahora no')}</button>
            </div>
          )}

          {/* One card per question: the question again, every option, the child's picks and the
              right ones marked, and for a miss why the chosen option was not it. */}
          <div style={{ animation: 'fadeUp 0.4s ease 0.08s both' }}>
            <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 16, color: INK, marginBottom: 10 }}>{t('math_your_answers', language)}</div>
            <EnglishReviewList questions={session.questions} answers={answers} lang={language} />
          </div>

          {!(result.review && !result.review_done) && (
            <button className="pz-press" onClick={() => nav('/child/home')} style={{
              background: ROSE, color: 'white', border: 'none', borderRadius: 18, padding: '16px 22px',
              fontFamily: FRED, fontSize: 18, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(170,50,85,.34)', marginTop: 4,
            }}>{t('math_done', language)}! 🏠</button>
          )}
        </div>
      </div>
    )
  }

  // ── questions ──────────────────────────────────────────────────────────────
  const q = session?.questions?.[qIdx]
  if (!q) return <div style={wrap}><style>{ANIM}</style></div>
  const answer = answers[qIdx]
  const need = q.pick || 1
  const pct = ((qIdx + (answer ? 1 : 0)) / total) * 100
  // A skipped question has nothing chosen and so no "why not" lines — only the right words.
  const rightWords = flash ? (flash.correct_indices || []).map(i => q.options[i]?.text).filter(Boolean) : []
  const whys = flash && !flash.correct ? englishWhyLines(q, flash.why, language) : []

  return (
    <>
      {confirmLeave && (
        <div onClick={() => setConfirmLeave(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(20,16,40,.55)', zIndex: 60,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: '26px 26px 0 0', padding: '26px 22px 30px',
            width: '100%', maxWidth: 430, display: 'flex', flexDirection: 'column', gap: 10, animation: 'scaleIn .2s ease both',
          }}>
            <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 21, color: INK, textAlign: 'center' }}>{t('math_leave_title', language)}</div>
            <div style={{ fontFamily: FRED, fontWeight: 500, fontSize: 15, color: INK_SOFT, textAlign: 'center', lineHeight: 1.5 }}>{t('math_leave_body', language)}</div>
            <button className="pz-press" onClick={() => setConfirmLeave(false)} style={{
              marginTop: 8, background: ROSE, color: '#fff', border: 'none', borderRadius: 16,
              padding: '15px', fontFamily: FRED, fontSize: 17, fontWeight: 600, cursor: 'pointer',
            }}>{t('math_leave_stay', language)}</button>
            <button className="pz-press" onClick={() => nav('/child/home')} style={{
              background: 'none', color: INK_SOFT, border: 'none', borderRadius: 16,
              padding: '11px', fontFamily: FRED, fontSize: 15.5, fontWeight: 600, cursor: 'pointer',
            }}>{t('math_leave_go', language)}</button>
          </div>
        </div>
      )}

      <div style={shell}>
        <style>{ANIM}</style>

        {/* The same flash maths gives an answer. A wrong one holds, shows the right figure, and
            waits for a tap. */}
        {flash && (
          <div onClick={() => { if (!flash.correct) advance() }} style={{
            position: 'fixed', inset: 0, zIndex: 300,
            overflowY: 'auto',
            background: flash.correct ? 'rgba(76,182,133,.94)' : 'rgba(247,148,51,.94)',
            animation: flash.correct ? 'flashIn 1.4s ease both' : 'flashHold .22s ease both',
            padding: '24px 26px', cursor: flash.correct ? 'default' : 'pointer',
          }}>
            {/* Center short feedback; let a long explanation grow and scroll on landscape phones. */}
            <div className="pz-feedback" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <div style={{ fontSize: 78, animation: 'pop .35s ease both' }}>{flash.correct ? '⭐' : '💪'}</div>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: flash.correct ? 30 : 22, color: 'white', textAlign: 'center', lineHeight: 1.45 }}>
                {flash.correct ? t('math_yes', language) : flash.skipped ? say(language, 'No problem!', 'Olsun!', '¡No pasa nada!') : t('math_not_this', language)}
              </div>
              {!flash.correct && rightWords.length > 0 && (
                <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 18, color: 'white', opacity: .92, marginTop: -6 }}>
                  {t(rightWords.length > 1 ? 'english_answers_are' : 'math_answer_is', language)}
                </div>
              )}
              {!flash.correct && rightWords.length > 0 && (
                <>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', animation: 'pop .35s ease .1s both' }}>
                    {rightWords.map((w, k) => (
                      <span key={k} style={{ background: '#fff', color: INK, borderRadius: 16, padding: '12px 20px', fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 24 }}>{w}</span>
                    ))}
                  </div>
                  {(flash.explain || []).length > 0 && (
                    <div style={{ background: 'rgba(255,255,255,.2)', borderRadius: 16, padding: '12px 16px', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                      {flash.explain.map((line, k) => (
                        <div key={k} style={{ fontFamily: FRED, fontWeight: 600, fontSize: 16, color: 'white', textAlign: 'center', lineHeight: 1.45 }}>{line}</div>
                      ))}
                    </div>
                  )}
                  {flash.explain_visual && <EnglishHelpVisual visual={flash.explain_visual} scale={isTablet ? 1.3 : 1} lang={language} />}
                  {whys.map((w, k) => (
                    <div key={k} style={{ fontFamily: FRED, fontWeight: 600, fontSize: 17, color: 'white', textAlign: 'center', lineHeight: 1.45, maxWidth: 420, marginTop: 6 }}>
                      {w}
                    </div>
                  ))}
                  <div style={{ fontFamily: FRED, fontWeight: 600, marginTop: 8, fontSize: 15, color: 'white', opacity: .8 }}>
                    {say(language, 'Tap to carry on', 'Devam etmek için dokun', 'Toca para seguir')}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div style={{ background: ROSE, padding: '16px 20px 18px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div onClick={() => setConfirmLeave(true)} style={{
              width: 36, height: 36, borderRadius: 11, background: 'rgba(255,255,255,.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, color: '#fff', fontWeight: 800, cursor: 'pointer', flexShrink: 0,
            }}>←</div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.32)', borderRadius: 8, height: 10, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'white', borderRadius: 8, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 15, color: 'rgba(255,255,255,.95)', flexShrink: 0 }}>
              {qIdx + 1} / {total}
            </div>
          </div>
        </div>

        <div className="pz-scroll" style={{ flex: 1, padding: '18px 20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div key={qIdx} style={{
            background: 'white', borderRadius: 22, padding: '22px 20px', boxShadow: '0 8px 28px rgba(170,50,85,.14)',
            animation: 'scaleIn 0.3s ease both', flexShrink: 0,
          }}>
            <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 21, color: INK, lineHeight: 1.4, marginBottom: need > 1 ? 4 : 14 }}>
              {t(q.stem_key, language)}
            </div>
            {need > 1 && <div style={{ fontWeight: 800, fontSize: 13, color: ROSE, marginBottom: 12 }}>{t('english_pick_two', language)}</div>}
            {/* The stem's type sizes are the lab's; the card is read at arm's length on a tablet. */}
            <div style={{ zoom: isTablet ? 1.5 : 1.2 }}><EnglishStem item={q} lang={language} /></div>
          </div>

          {/* The options are the keypad: under the question card, each one a button. */}
          <EnglishOptions item={q} states={q.options.map((_, i) => (struck.includes(i) ? 'struck' : picked.includes(i) ? 'picked' : null))}
            onPick={select} disabled={pending || !!answer} />

          {!answer && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {rungs.length < 3 && (
                <button className="pz-press" onClick={askHint} disabled={hintBusy || pending}
                  key={nudge ? 'nudge' : 'hint'} style={{
                    animation: nudge && rungs.length === 0 ? 'hintNudge .9s ease 2' : undefined,
                    display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none',
                    background: rungs.length ? 'rgba(247,148,51,.16)' : 'rgba(255,255,255,.72)',
                    color: ORANGE, borderRadius: 999, padding: '8px 16px', cursor: 'pointer',
                    fontFamily: FRED, fontWeight: 600, fontSize: 15, boxShadow: '0 3px 10px rgba(60,120,200,.08)',
                  }}>
                  💡 {rungs.length === 0 ? say(language, 'Hint', 'İpucu', 'Pista') : say(language, 'More help', 'Biraz daha', 'Más ayuda')}
                </button>
              )}
              {nudge && rungs.length === 0 && (
                <div style={{
                  background: '#fff4e0', borderRadius: 14, padding: '9px 15px', maxWidth: 320,
                  fontFamily: FRED, fontWeight: 600, fontSize: 14.5, color: '#b7720f', textAlign: 'center',
                  lineHeight: 1.4, animation: 'scaleIn .22s ease both',
                }}>
                  {say(language, 'Hmm, not quite. Tap 💡 for a hint!', 'Hmm, tam değil. 💡\'ya dokunup ipucuna bak!', 'Mmm, casi. ¡Toca 💡 para ver una pista!')}
                </div>
              )}
              {rungs.length > 0 && (
                <div style={{
                  background: 'rgba(255,255,255,.92)', borderRadius: 16, padding: isTablet ? '16px 22px' : '13px 17px', maxWidth: isTablet ? 620 : 440,
                  fontFamily: FRED, fontWeight: 600, fontSize: isTablet ? 19 : 15.5, color: INK_SOFT, lineHeight: 1.5,
                  textAlign: 'center', animation: 'scaleIn .22s ease both', display: 'flex', flexDirection: 'column', gap: 9,
                }}>
                  {rungs.map((h, k) => (
                    <div key={k}>
                      {h.level === 1 && h.text}
                      {h.level === 2 && (h.eliminate == null
                        ? say(language, 'Look at the words again, one by one.', 'Kelimelere tekrar, tek tek bak.', 'Mira las palabras otra vez, una a una.')
                        : (englishWhyLines(q, [{ index: h.eliminate, key: h.why }], language)[0]
                          || `${q.options[h.eliminate]?.text}: ${say(language, 'not this one', 'bu değil', 'esta no')}`))}
                      {h.level === 3 && (h.steps || []).map((line, j) => <div key={j} style={{ marginTop: j ? 6 : 0 }}>{line}</div>)}
                      {h.level === 3 && h.visual && <div style={{ marginTop: 10 }}><EnglishHelpVisual visual={h.visual} scale={isTablet ? 1.3 : 1} lang={language} /></div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button className="pz-press" onClick={send} disabled={picked.length !== need || pending || !!answer} style={{
            ...primaryBtn, alignSelf: 'center', marginTop: 4,
            opacity: picked.length !== need ? 0.4 : 1, cursor: picked.length !== need ? 'default' : 'pointer',
            boxShadow: picked.length !== need ? 'none' : primaryBtn.boxShadow, transition: 'opacity .15s ease',
          }}>{pending ? '…' : t('puzzle_send', language)}</button>

          {/* An honest way out: the question counts as wrong and the right words are shown.
              Only while nothing is chosen. It sat right under Send, and a child who had picked
              "far" for the opposite of "near" and reached for Send landed here — the right
              answer thrown away as "I don't know". Once something is picked they have an answer;
              Send is the button. */}
          {!answer && picked.length === 0 && (
            <button className="pz-press" onClick={skip} disabled={pending} style={{
              alignSelf: 'center', border: 'none', background: 'rgba(255,255,255,.72)', color: INK_SOFT,
              borderRadius: 999, padding: '9px 18px', cursor: 'pointer', fontFamily: FRED, fontWeight: 600, fontSize: 15,
            }}>{t('rd_skip', language)}</button>
          )}

          {answerFailed && (
            <div style={{ background: '#FFF3E0', borderRadius: 18, padding: '14px 17px', display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ fontSize: 25 }}>😕</span>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: INK, lineHeight: 1.45 }}>{t('puzzle_failed', language)}</div>
            </div>
          )}
        </div>
      </div>
      <Scratchpad key={qIdx} selector=".pz-scroll" language={language} accent={ROSE} />
    </>
  )
}
