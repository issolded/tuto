import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'
import { supabase } from '../lib/supabase'
import { generateMathQuestions, evaluateMath } from '../lib/gemini'

const ANIM = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-10px); }
}
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.05); }
}
@keyframes flashIn {
  0%   { opacity: 0; }
  15%  { opacity: 1; }
  80%  { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes confettiFall {
  0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
}
@keyframes scaleIn {
  from { transform: scale(0.85); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
`

const CONFETTI = [
  { color: '#FF6B35', left: '7%',  delay: '0s'    },
  { color: '#FFD93D', left: '20%', delay: '0.10s' },
  { color: '#2EC486', left: '34%', delay: '0.05s' },
  { color: '#6C63FF', left: '48%', delay: '0.15s' },
  { color: '#FF3B30', left: '62%', delay: '0.08s' },
  { color: '#34C0EB', left: '76%', delay: '0.12s' },
  { color: '#FFD93D', left: '88%', delay: '0.03s' },
  { color: '#FF6B35', left: '95%', delay: '0.18s' },
]

const LEVEL_DESC = {
  1: 'Counting 1–10',       2: 'Addition up to 10',      3: 'Subtraction up to 10',
  4: 'Addition up to 20',   5: 'Subtraction up to 20',   6: 'Word Problems',
  7: 'Add & Subtract ×100', 8: 'Multiplication ×2 ×5 ×10', 9: 'Fractions',
  10: 'Division',           11: 'Geometry',              12: 'Measurement',
  13: 'Multiplication Tables', 14: 'Multi-step Problems', 15: 'Fractions & Decimals',
}

function getStartingLevel(age) {
  const n = Number(age)
  if (n <= 6)  return 1
  if (n <= 8)  return 3
  if (n <= 10) return 5
  if (n <= 12) return 8
  return 11
}

function getWelcomeMsg(age) {
  const n = Number(age)
  if (n <= 7)  return "Let's go on a number adventure! 🚀\nI'll show you some fun puzzles — just do your best!"
  if (n <= 10) return "Time to level up your math powers! ⚡\nShow me what you've got!"
  return "Ready for a challenge? 🔥\nLet's see those math skills!"
}

function getScoreMsg(pct, age) {
  const n = Number(age)
  if (pct >= 80) {
    if (n <= 7)  return "WOW! You're a math superstar! 🌟 I'm so proud of you!"
    if (n <= 10) return "Excellent work! You crushed it! 🔥 Keep those math skills sharp!"
    return "Outstanding! 🌟 Your math skills are seriously impressive!"
  }
  if (pct >= 60) {
    if (n <= 7)  return "Great job! You did really well! ⭐ Let's keep practicing!"
    if (n <= 10) return "Nice work! You're getting stronger every session! 💪"
    return "Good effort! You're making solid progress! 💡"
  }
  if (pct >= 40) {
    if (n <= 7)  return "You're trying so hard and that makes me happy! 🤗 Let's practice more!"
    if (n <= 10) return "You gave it your best! 💪 Every practice makes you better!"
    return "Keep pushing! Every challenge helps you grow! 💪"
  }
  if (n <= 7)  return "It's okay! Math takes practice and you're doing amazing! 🤗"
  if (n <= 10) return "These were tough! You'll get there with practice! 💪"
  return "Challenging problems! Persistence is the key to mastery! 🔑"
}

// ── Number keyboard ──────────────────────────────────────────────────────────

function NumberKeyboard({ value, onChange, onSubmit, disabled }) {
  const ROWS = [['7','8','9'], ['4','5','6'], ['1','2','3'], ['⌫','0','✓']]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      {ROWS.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', gap: 12 }}>
          {row.map(key => {
            const isSubmit = key === '✓'
            const isBack   = key === '⌫'
            return (
              <button
                key={key}
                disabled={disabled}
                onClick={() => {
                  if (disabled) return
                  if (isSubmit) onSubmit()
                  else if (isBack) onChange(v => v.slice(0, -1))
                  else if (value.length < 4) onChange(v => v + key)
                }}
                style={{
                  width: 82, height: 82, borderRadius: '50%', border: 'none',
                  background: isSubmit ? '#2EC486' : isBack ? '#FFD93D' : '#1A1A2E',
                  color: isBack ? '#1A1A2E' : 'white',
                  fontSize: isSubmit || isBack ? 24 : 28,
                  fontFamily: "'Baloo 2', cursive", fontWeight: 800,
                  cursor: disabled ? 'default' : 'pointer',
                  opacity: disabled ? 0.45 : 1,
                  boxShadow: isSubmit
                    ? '0 4px 16px rgba(46,196,134,0.45)'
                    : isBack
                    ? '0 4px 12px rgba(255,211,61,0.35)'
                    : '0 4px 14px rgba(26,26,46,0.25)',
                  transition: 'transform 0.1s, opacity 0.15s',
                }}
                onTouchStart={e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.92)' }}
                onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)' }}
              >{key}</button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function MathScreen() {
  const nav   = useNavigate()
  const child = JSON.parse(localStorage.getItem('child') || 'null')
  const age   = child?.age || 7

  const [step,          setStep]         = useState('welcome')
  const [mode,          setMode]         = useState(null)        // 'paper' | 'screen'
  const [level,         setLevel]        = useState(null)
  const [questions,     setQuestions]    = useState([])
  const [correctAns,    setCorrectAns]   = useState([])
  const [qTypes,        setQTypes]       = useState([])
  const [topic,         setTopic]        = useState('')
  const [qIdx,          setQIdx]         = useState(0)
  const [userAnswers,   setUserAnswers]  = useState([])
  const [input,         setInput]        = useState('')
  const [flash,         setFlash]        = useState(null)        // { correct, answer }
  const [evalResult,    setEvalResult]   = useState(null)
  const [leveledUp,     setLeveledUp]    = useState(false)

  const fileRef      = useRef(null)
  const flashTimer   = useRef(null)

  // Load level from last math_progress session
  useEffect(() => {
    if (!child?.id) { setLevel(getStartingLevel(age)); return }
    supabase
      .from('math_progress')
      .select('level')
      .eq('child_id', child.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const rec = data?.[0]
        setLevel(rec ? rec.level : getStartingLevel(age))
      })
      .catch(() => setLevel(getStartingLevel(age)))
    return () => clearTimeout(flashTimer.current)
  }, [])

  const effectiveLevel = level ?? getStartingLevel(age)

  // ── Start: pick mode then generate questions ─────────────────────────────
  const startLoading = async (selectedMode) => {
    setMode(selectedMode)
    setStep('loading')
    try {
      const prevQs = []

      const result = await generateMathQuestions(age, effectiveLevel, prevQs)
      setQuestions(result.questions   || [])
      setCorrectAns(result.answers    || [])
      setQTypes(result.question_types || [])
      setTopic(result.topic           || 'math')
      setStep(selectedMode === 'paper' ? 'paper_questions' : 'screen_questions')
    } catch (e) {
      console.error('generateMathQuestions:', e)
      setStep('mode')
    }
  }

  // ── Screen mode: submit one answer ───────────────────────────────────────
  const submitScreenAnswer = () => {
    if (!input || flash) return
    const userAns   = Number(input)
    const isCorrect = userAns === correctAns[qIdx]
    const newAnswers = [...userAnswers, userAns]

    setFlash({ correct: isCorrect, answer: correctAns[qIdx] })
    setInput('')

    flashTimer.current = setTimeout(() => {
      setFlash(null)
      setUserAnswers(newAnswers)
      if (qIdx + 1 >= questions.length) {
        doScreenEval(newAnswers)
      } else {
        setQIdx(i => i + 1)
      }
    }, 1400)
  }

  // ── Screen mode: evaluate locally ────────────────────────────────────────
  const doScreenEval = async (finalAnswers) => {
    setStep('evaluating')
    const numCorrect = finalAnswers.filter((a, i) => a === correctAns[i]).length
    const accuracy   = Math.round((numCorrect / questions.length) * 100)

    let levelChange = 'same'
    let newLevel    = effectiveLevel
    if (accuracy >= 80 && effectiveLevel < 15) { levelChange = 'up';   newLevel = effectiveLevel + 1; setLeveledUp(true) }
    else if (accuracy < 40 && effectiveLevel > 1) { levelChange = 'down'; newLevel = effectiveLevel - 1 }

    const results = questions.map((q, i) => ({
      question: q, correct_answer: correctAns[i],
      child_answer: finalAnswers[i],
      correct: finalAnswers[i] === correctAns[i],
    }))
    const gemsEarned = child?.task_settings?.math?.gems ?? 30
    const evalData = {
      results, score: accuracy, accuracy, level_change: levelChange,
      new_level: newLevel, topic,
      encouragement: getScoreMsg(accuracy, age),
      gems_earned: gemsEarned,
    }
    setEvalResult(evalData)
    await saveResults(evalData, newLevel)
    setStep('result')
  }

  // ── Paper mode: send photo to Gemini ─────────────────────────────────────
  const doPaperEval = async (file) => {
    setStep('evaluating')
    try {
      const result   = await evaluateMath([file], questions, correctAns, age, effectiveLevel)
      const newLevel = result.new_level ?? effectiveLevel
      if (result.level_change === 'up') setLeveledUp(true)
      const mathGems = child?.task_settings?.math?.gems ?? 30
      setEvalResult({ ...result, gems_earned: result.gems_earned ?? mathGems })
      await saveResults(result, newLevel)
      setStep('result')
    } catch (e) {
      console.error('evaluateMath:', e)
      const mathGems = child?.task_settings?.math?.gems ?? 30
      const fallback = {
        results: questions.map((q, i) => ({ question: q, correct_answer: correctAns[i], child_answer: '?', correct: false })),
        score: 70, accuracy: 70, level_change: 'same', new_level: effectiveLevel,
        topic, encouragement: "Great effort! Keep going! 🌟", gems_earned: mathGems,
      }
      setEvalResult(fallback)
      await saveResults(fallback, effectiveLevel)
      setStep('result')
    }
  }

  // ── Persist to Supabase ───────────────────────────────────────────────────
  const saveResults = async (evalData, newLevel) => {
    if (!child?.id) return
    const numCorrect = (evalData.results || []).filter(r => r.correct).length
    try {
      await supabase.from('math_progress').insert({
        child_id: child.id,
        session_date: new Date().toISOString().split('T')[0],
        level: newLevel,
        topic: evalData.topic || topic,
        questions_total: questions.length,
        questions_correct: numCorrect,
        accuracy: evalData.accuracy || evalData.score || 0,
        gemini_notes: evalData.gemini_notes || null,
        next_session: evalData.next_session || null,
        level_change: evalData.level_change || 'same',
      })
      if ((evalData.gems_earned || 0) > 0) {
        await supabase.from('bt_ledger').insert({
          child_id: child.id,
          amount: evalData.gems_earned,
          reason: 'math',
        })
      }
    } catch (e) {
      console.error('saveResults:', e)
    }
  }

  // ── Shared container style ────────────────────────────────────────────────
  const wrap = {
    background: '#EEF0FF', minHeight: '100vh', maxWidth: 430,
    margin: '0 auto', display: 'flex', flexDirection: 'column',
  }

  const BackBtn = ({ to }) => (
    <button
      onClick={() => to ? nav(to) : setStep('welcome')}
      style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.85)', border: 'none', fontSize: 18, cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >←</button>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: welcome
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'welcome') return (
    <div style={wrap}>
      <style>{ANIM}</style>
      <div style={{ position: 'absolute', top: 52, left: 20, zIndex: 10 }}>
        <BackBtn to="/child/home" />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 28px 40px', gap: 22, textAlign: 'center' }}>
        <div style={{ animation: 'float 3s ease-in-out infinite' }}>
          <TutoMascot size={160} expression="excited" />
        </div>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 21, fontWeight: 800, color: '#2D2560', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {getWelcomeMsg(age)}
        </div>
        {level !== null && (
          <div style={{ background: 'rgba(108,99,255,0.13)', borderRadius: 14, padding: '8px 20px', fontSize: 13, fontWeight: 800, color: '#6C63FF' }}>
            📊 {LEVEL_DESC[effectiveLevel] || 'Math Adventure'}
          </div>
        )}
        <button
          onClick={() => setStep('mode')}
          style={{ background: '#6C63FF', color: 'white', border: 'none', borderRadius: 20, padding: '18px 52px', fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 28px rgba(108,99,255,0.45)', animation: 'pulse 2s ease-in-out infinite', marginTop: 4 }}
        >Let's go! →</button>
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: mode selection
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'mode') return (
    <div style={wrap}>
      <style>{ANIM}</style>
      <div style={{ padding: '52px 24px 32px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <BackBtn />
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 24, fontWeight: 900, color: '#2D2560' }}>
            How do you want<br />to work today?
          </div>
        </div>

        {/* Paper */}
        <button
          onClick={() => startLoading('paper')}
          style={{ background: 'white', border: '3px solid #D8D0FF', borderRadius: 28, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer', textAlign: 'left', boxShadow: '0 8px 32px rgba(108,99,255,0.12)', animation: 'fadeUp 0.3s ease both' }}
        >
          <span style={{ fontSize: 44 }}>✏️</span>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 900, color: '#2D2560' }}>On Paper</div>
          <div style={{ display: 'inline-block', background: '#6C63FF', color: 'white', borderRadius: 10, padding: '4px 14px', fontSize: 13, fontWeight: 800, width: 'fit-content' }}>+30 Gems</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#7A7A9A', lineHeight: 1.5 }}>
            We love pen and paper! Your brain grows every time you write! 🧠
          </div>
        </button>

        {/* Screen */}
        <button
          onClick={() => startLoading('screen')}
          style={{ background: 'white', border: '3px solid #D8D0FF', borderRadius: 28, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer', textAlign: 'left', boxShadow: '0 8px 32px rgba(108,99,255,0.12)', animation: 'fadeUp 0.35s ease 0.05s both' }}
        >
          <span style={{ fontSize: 44 }}>📱</span>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 900, color: '#2D2560' }}>On Screen</div>
          <div style={{ display: 'inline-block', background: '#2EC486', color: 'white', borderRadius: 10, padding: '4px 14px', fontSize: 13, fontWeight: 800, width: 'fit-content' }}>+20 Gems</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#7A7A9A', lineHeight: 1.5 }}>
            Type your answers directly
          </div>
        </button>
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: loading / evaluating
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'loading' || step === 'evaluating') return (
    <div style={wrap}>
      <style>{ANIM}</style>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 40 }}>
        <div style={{ animation: 'float 2s ease-in-out infinite' }}>
          <TutoMascot size={140} expression="thinking" />
        </div>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#2D2560', textAlign: 'center' }}>
          {step === 'loading' ? 'Preparing your puzzles...' : 'Checking your work...'}
        </div>
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: paper_questions
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'paper_questions') return (
    <div style={wrap}>
      <style>{ANIM}</style>

      <div style={{ background: '#6C63FF', padding: '52px 24px 24px', borderRadius: '0 0 28px 28px' }}>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 900, color: 'white' }}>My Math 🔢</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
          Now solve these on paper! ✏️
        </div>
      </div>

      <div style={{ flex: 1, padding: '20px 20px 110px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {questions.map((q, i) => {
          const isWord = qTypes[i] === 'word' || q.length > 32
          return (
            <div key={i} style={{ background: 'white', borderRadius: 20, padding: isWord ? '20px' : '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 14, boxShadow: '0 4px 16px rgba(108,99,255,0.10)', animation: `fadeUp 0.35s ease ${i * 0.06}s both` }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#6C63FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: 'white', flexShrink: 0, marginTop: isWord ? 2 : 0 }}>
                {i + 1}
              </div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: isWord ? 16 : 22, fontWeight: 800, color: '#2D2560', lineHeight: 1.55, flex: 1 }}>
                {q}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', padding: '16px 24px 36px', borderTop: '1px solid #EEEEFA', zIndex: 100 }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) doPaperEval(f) }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          style={{ width: '100%', background: '#6C63FF', color: 'white', border: 'none', borderRadius: 20, padding: '18px', fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 28px rgba(108,99,255,0.4)' }}
        >
          I'm ready, Tuto! 📸
        </button>
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: screen_questions
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'screen_questions') {
    const q      = questions[qIdx] || ''
    const isWord = qTypes[qIdx] === 'word' || q.length > 35
    const pct    = (qIdx / questions.length) * 100

    return (
      <div style={wrap}>
        <style>{ANIM}</style>

        {/* Flash feedback overlay */}
        {flash && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: flash.correct ? 'rgba(46,196,134,0.93)' : 'rgba(255,107,53,0.93)', animation: 'flashIn 1.4s ease both' }}>
            <div style={{ fontSize: 76 }}>{flash.correct ? '⭐' : '💪'}</div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, fontWeight: 900, color: 'white', textAlign: 'center', padding: '0 28px', lineHeight: 1.4 }}>
              {flash.correct ? 'Yes! ⭐' : `Almost! The answer was ${flash.answer} 💪`}
            </div>
          </div>
        )}

        {/* Progress header */}
        <div style={{ background: '#6C63FF', padding: '52px 20px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => nav('/child/home')}
              style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >←</button>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.3)', borderRadius: 8, height: 10, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'white', borderRadius: 8, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'rgba(255,255,255,0.9)', flexShrink: 0 }}>{qIdx + 1} / {questions.length}</div>
          </div>
        </div>

        {/* Question + keyboard */}
        <div style={{ flex: 1, padding: '20px 20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Question card */}
          <div key={qIdx} style={{ background: 'white', borderRadius: 24, padding: isWord ? '28px 24px' : '28px 24px', textAlign: 'center', boxShadow: '0 8px 32px rgba(108,99,255,0.14)', animation: 'scaleIn 0.3s ease both', minHeight: isWord ? 120 : 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: isWord ? 18 : 32, fontWeight: 800, color: '#2D2560', lineHeight: 1.55 }}>
              {q}
            </div>
          </div>

          {/* Answer display */}
          <div style={{ background: 'white', borderRadius: 18, padding: '16px', textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', minHeight: 68, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 40, fontWeight: 900, color: input ? '#6C63FF' : '#D0CFF0', letterSpacing: 6 }}>
              {input || '?'}
            </span>
          </div>

          {/* Keyboard */}
          <NumberKeyboard
            value={input}
            onChange={setInput}
            onSubmit={submitScreenAnswer}
            disabled={!!flash}
          />
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: result
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'result' && evalResult) {
    const accuracy   = evalResult.accuracy || evalResult.score || 0
    const results    = evalResult.results  || []
    const numCorrect = results.filter(r => r.correct).length

    return (
      <div style={{ ...wrap, overflowY: 'auto' }}>
        <style>{ANIM}</style>

        {/* Confetti for level up */}
        {leveledUp && (
          <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50, overflow: 'hidden' }}>
            {CONFETTI.map((p, i) => (
              <div key={i} style={{ position: 'absolute', left: p.left, top: '-16px', width: 12, height: 12, borderRadius: '50%', background: p.color, animation: `confettiFall 2.8s ease-out ${p.delay} forwards` }} />
            ))}
          </div>
        )}

        {/* Header */}
        <div style={{ background: '#6C63FF', padding: '52px 24px 32px', borderRadius: '0 0 36px 36px', textAlign: 'center' }}>
          <div style={{ animation: 'float 3s ease-in-out infinite', display: 'inline-block' }}>
            <TutoMascot size={120} expression="proud" />
          </div>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: 'white', marginTop: 14, lineHeight: 1.55, padding: '0 8px' }}>
            {evalResult.encouragement}
          </div>
        </div>

        <div style={{ padding: '20px 20px 48px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Score + gems card */}
          <div style={{ background: 'white', borderRadius: 24, padding: '20px 24px', display: 'flex', gap: 12, alignItems: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', animation: 'fadeUp 0.4s ease both' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#A0A0C0', textTransform: 'uppercase', letterSpacing: 1 }}>Score</div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 44, fontWeight: 900, color: accuracy >= 80 ? '#2EC486' : accuracy >= 60 ? '#FFB347' : '#FF6B35', lineHeight: 1 }}>
                {accuracy}%
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#7A7A9A', marginTop: 4 }}>{numCorrect} / {questions.length} correct</div>
            </div>
            <div style={{ width: 1, height: 60, background: '#F0F0F0' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#A0A0C0', textTransform: 'uppercase', letterSpacing: 1 }}>Earned</div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 44, fontWeight: 900, color: '#C8900A', lineHeight: 1 }}>+{evalResult.gems_earned}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#7A7A9A', marginTop: 4 }}>Gems 💎</div>
            </div>
          </div>

          {/* Level up banner */}
          {leveledUp && (
            <div style={{ background: 'linear-gradient(135deg, #6C63FF 0%, #2EC486 100%)', borderRadius: 20, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, animation: 'fadeUp 0.4s ease 0.08s both', boxShadow: '0 8px 28px rgba(108,99,255,0.4)' }}>
              <span style={{ fontSize: 34 }}>🎉</span>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: 'white' }}>
                You unlocked a new level! 🎉
              </div>
            </div>
          )}

          {/* Per-question results */}
          {results.length > 0 && (
            <div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: '#2D2560', marginBottom: 8 }}>
                Your answers:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {results.map((r, i) => (
                  <div key={i} style={{ background: 'white', borderRadius: 16, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, animation: `fadeUp 0.35s ease ${0.1 + i * 0.05}s both` }}>
                    <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{r.correct ? '✅' : '🔄'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#2D2560', lineHeight: 1.45 }}>{r.question}</div>
                      {!r.correct && (
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#FF6B35', marginTop: 4 }}>
                          The answer was {r.correct_answer} 💡
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => nav('/child/home')}
            style={{ background: '#6C63FF', color: 'white', border: 'none', borderRadius: 20, padding: '18px', fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 28px rgba(108,99,255,0.4)', marginTop: 4 }}
          >
            Done! 🏠
          </button>
        </div>
      </div>
    )
  }

  // Fallback
  return (
    <div style={wrap}>
      <style>{ANIM}</style>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <TutoMascot size={100} expression="default" />
      </div>
    </div>
  )
}
