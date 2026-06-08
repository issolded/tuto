import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'
import { supabase } from '../lib/supabase'
import { generateMathQuestions, evaluateMath } from '../lib/gemini'

// ── Design tokens (6–8 skin) ────────────────────────────────────────────────
const MATH      = '#5aa9e6'
const MATH_DEEP = '#3d8fcf'
const INK       = '#241f3a'
const INK_SOFT  = '#8d83ad'
const GREEN     = '#4cb685'
const ORANGE    = '#f79433'
const FRED      = "'Fredoka', sans-serif"
const FLOW_BG   = 'linear-gradient(172deg,#EAF5FF 0%,#D2E9FB 100%)'

const ANIM = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap');
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-7px); }
}
@keyframes pop {
  from { transform: scale(0.85); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
@keyframes flashIn {
  0%   { opacity: 0; }
  15%  { opacity: 1; }
  80%  { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes confettiFall {
  0%   { transform: translateY(-14px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(640px) rotate(560deg); opacity: 0; }
}
@keyframes scaleIn {
  from { transform: scale(0.85); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.math-press:active { transform: scale(.96) !important; }
.math-scroll { overflow-y: auto; }
.math-scroll::-webkit-scrollbar { display: none; }
`

const CONFETTI = [
  { color: ORANGE,    left: '8%',  delay: '0s'    },
  { color: '#FFD93D', left: '22%', delay: '0.10s' },
  { color: GREEN,     left: '36%', delay: '0.05s' },
  { color: MATH,      left: '50%', delay: '0.15s' },
  { color: '#ef6b6b', left: '64%', delay: '0.08s' },
  { color: MATH_DEEP, left: '78%', delay: '0.12s' },
  { color: '#FFD93D', left: '90%', delay: '0.03s' },
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      {ROWS.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', gap: 10 }}>
          {row.map(key => {
            const isSubmit = key === '✓'
            const isBack   = key === '⌫'
            const bg = isSubmit ? GREEN : isBack ? ORANGE : '#2c2745'
            const glow = isSubmit
              ? 'rgba(76,182,133,.4)'
              : isBack
              ? 'rgba(247,148,51,.36)'
              : 'rgba(44,39,69,.28)'
            return (
              <button
                key={key}
                disabled={disabled}
                className="math-press"
                onClick={() => {
                  if (disabled) return
                  if (isSubmit) onSubmit()
                  else if (isBack) onChange(v => v.slice(0, -1))
                  else if (value.length < 4) onChange(v => v + key)
                }}
                style={{
                  width: 70, height: 70, borderRadius: '50%', border: 'none',
                  background: bg, color: '#fff',
                  fontSize: isSubmit || isBack ? 24 : 27,
                  fontFamily: FRED, fontWeight: 600,
                  cursor: disabled ? 'default' : 'pointer',
                  opacity: disabled ? 0.45 : 1,
                  boxShadow: `0 5px 14px ${glow}`,
                  transition: 'transform 0.1s, opacity 0.15s',
                }}
              >{key}</button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Help Panel ────────────────────────────────────────────────────────────────

function HelpPanel({ question, questionType, onDone, language }) {
  const tr = language === 'tr'
  const t = tr ? {
    title:          'Hep beraber bakalım! 🧸',
    countTab:       'Sayalım',
    showTab:        'Göster',
    tapInstruction: 'Kaç tanesini çıkartacaksın?',
    countInstruction: 'Hepsini say!',
    ready:          'Anladım, tekrar deniyorum! 💪',
    nowCount:       'Şimdi kalanları say! 🔢',
    writeIt:        'Kaç tane saydın? Klavyeye yaz! 🎉',
    airTrace:       'Parmağınla havada çiz!',
    whichNext:      'Hangi sayı geliyor?',
    startLabel:     'başla',
  } : {
    title:          'Let\'s look together! 🧸',
    countTab:       'Count',
    showTab:        'Show',
    tapInstruction: 'How many will you take away?',
    countInstruction: 'Count them all!',
    ready:          'Got it, let me try again! 💪',
    nowCount:       'Now count what\'s left! 🔢',
    writeIt:        'How many did you count? Type it in! 🎉',
    airTrace:       'Draw it in the air!',
    whichNext:      'Which number comes next?',
    startLabel:     'start',
  }

  const nums    = question.match(/\d+/g)?.map(Number) || []
  const isPlus  = question.includes('+')
  const isMinus = question.includes('-')
  const n0 = nums[0] ?? 0
  const n1 = nums[1] ?? 0
  const bigNums = n0 > 12 || n1 > 12

  const [activeTab,   setActiveTab]   = useState('count')
  const [touched,     setTouched]     = useState(new Set())
  const [touchedShow, setTouchedShow] = useState(new Set())

  const totalObjs   = isPlus ? n0 + n1 : 0
  const allTouched  = isPlus  && totalObjs > 0 && touched.size === totalObjs
  const doneRemoval = isMinus && n1 > 0 && touched.size === n1

  const toggle = (key) => {
    setTouched(prev => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) }
      else { if (isMinus && next.size >= n1) return prev; next.add(key) }
      return next
    })
  }

  const toggleShow = (key) => {
    setTouchedShow(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  // ── Sayalım content ──────────────────────────────────────────────────────
  let sayalim

  if (bigNums) {
    sayalim = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', padding: '8px 0' }}>
        <span style={{ fontSize: 40 }}>✍️</span>
        <div style={{
          fontFamily: FRED, fontWeight: 600, fontSize: 17, color: INK, textAlign: 'center', lineHeight: 1.65,
          background: 'rgba(90,169,230,.08)', borderRadius: 16, padding: '14px 18px', width: '100%',
        }}>
          {t.airTrace}<br />
          <span style={{ color: MATH_DEEP, fontSize: 22 }}>{question}</span>
        </div>
      </div>
    )
  } else if (questionType === 'pattern') {
    const patternNums = nums.slice(0, -1)
    sayalim = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 16, color: INK_SOFT }}>
          {t.whichNext}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {patternNums.map((n, i) => (
            <div key={i} style={{
              width: 52, height: 52, borderRadius: 14, background: MATH, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: FRED, fontWeight: 600, fontSize: 22,
              boxShadow: '0 4px 12px rgba(90,169,230,.35)',
            }}>{n}</div>
          ))}
          <div style={{
            width: 52, height: 52, borderRadius: 14, border: `3px dashed ${ORANGE}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FRED, fontWeight: 600, fontSize: 26, color: ORANGE,
          }}>?</div>
        </div>
      </div>
    )
  } else if (isMinus) {
    sayalim = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 15, color: INK, textAlign: 'center' }}>
          {t.tapInstruction}{' '}
          <span style={{ color: ORANGE, fontSize: 20 }}>{n1}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', maxWidth: 280 }}>
          {Array.from({ length: n0 }, (_, i) => (
            <span key={i} onClick={() => toggle(i)} style={{
              fontSize: 34, cursor: 'pointer', userSelect: 'none',
              textDecoration: touched.has(i) ? 'line-through' : 'none',
              opacity: touched.has(i) ? 0.25 : 1, transition: 'opacity 0.15s',
            }}>🍎</span>
          ))}
        </div>
        {doneRemoval && (
          <div style={{
            fontFamily: FRED, fontWeight: 600, fontSize: 16, color: GREEN,
            background: 'rgba(76,182,133,.12)', borderRadius: 12, padding: '8px 16px',
            textAlign: 'center', animation: 'pop 0.3s ease both',
          }}>{t.nowCount}</div>
        )}
      </div>
    )
  } else if (isPlus) {
    sayalim = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 15, color: INK_SOFT }}>
          {t.countInstruction}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', maxWidth: 280 }}>
          {Array.from({ length: n0 }, (_, i) => {
            const k = `a${i}`
            return (
              <span key={k} onClick={() => toggle(k)} style={{
                fontSize: 34, cursor: 'pointer', userSelect: 'none', display: 'inline-block',
                filter: touched.has(k) ? 'brightness(1.5) drop-shadow(0 0 6px rgba(90,169,230,.9))' : 'none',
                transform: touched.has(k) ? 'scale(1.18)' : 'scale(1)', transition: 'all 0.15s',
              }}>🔵</span>
            )
          })}
          {Array.from({ length: n1 }, (_, i) => {
            const k = `b${i}`
            return (
              <span key={k} onClick={() => toggle(k)} style={{
                fontSize: 34, cursor: 'pointer', userSelect: 'none', display: 'inline-block',
                filter: touched.has(k) ? 'brightness(1.5) drop-shadow(0 0 6px rgba(247,148,51,.9))' : 'none',
                transform: touched.has(k) ? 'scale(1.18)' : 'scale(1)', transition: 'all 0.15s',
              }}>🟠</span>
            )
          })}
        </div>
        {allTouched && (
          <div style={{
            fontFamily: FRED, fontWeight: 600, fontSize: 16, color: GREEN,
            background: 'rgba(76,182,133,.12)', borderRadius: 12, padding: '8px 16px',
            textAlign: 'center', animation: 'pop 0.3s ease both',
          }}>{t.writeIt}</div>
        )}
      </div>
    )
  } else {
    sayalim = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        <span style={{ fontSize: 40 }}>✍️</span>
        <div style={{
          fontFamily: FRED, fontWeight: 600, fontSize: 17, color: INK, textAlign: 'center', lineHeight: 1.65,
          background: 'rgba(90,169,230,.08)', borderRadius: 16, padding: '14px 18px', width: '100%',
        }}>
          {t.airTrace}<br />
          <span style={{ color: MATH_DEEP, fontSize: 20 }}>{question}</span>
        </div>
      </div>
    )
  }

  // ── Göster content ────────────────────────────────────────────────────────
  let goster = (
    <div style={{ fontFamily: FRED, fontWeight: 500, fontSize: 15, color: INK_SOFT, textAlign: 'center', padding: '20px 0' }}>
      {question}
    </div>
  )

  if (nums.length >= 2 && n0 > 0) {
    if (isPlus) {
      const total = n0 + n1
      if (total > 0) {
        if (total <= 12) {
          // Objects: tappable circles
          goster = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 280 }}>
                {Array.from({ length: n0 }, (_, i) => {
                  const k = `ga${i}`
                  return (
                    <div key={k} onClick={() => toggleShow(k)} style={{
                      width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                      background: touchedShow.has(k) ? MATH : `${MATH}44`,
                      border: `2px solid ${MATH}`,
                      boxShadow: touchedShow.has(k) ? `0 0 10px ${MATH}99` : 'none',
                      transition: 'all 0.15s',
                    }} />
                  )
                })}
                {Array.from({ length: n1 }, (_, i) => {
                  const k = `gb${i}`
                  return (
                    <div key={k} onClick={() => toggleShow(k)} style={{
                      width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                      background: touchedShow.has(k) ? ORANGE : `${ORANGE}44`,
                      border: `2px solid ${ORANGE}`,
                      boxShadow: touchedShow.has(k) ? `0 0 10px ${ORANGE}99` : 'none',
                      transition: 'all 0.15s',
                    }} />
                  )
                })}
              </div>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 16, color: INK }}>
                <span style={{ color: MATH }}>{n0}</span>{' + '}
                <span style={{ color: ORANGE }}>{n1}</span>{' = '}
                <span style={{ color: GREEN, fontSize: 22 }}>?</span>
              </div>
            </div>
          )
        } else {
          // Number line SVG
          const svgW = 256, svgH = 76
          const lpad = 24, rpad = 24
          const lineW = svgW - lpad - rpad
          const lineY = 46
          const scale = lineW / total
          const x0    = lpad
          const xN0   = lpad + n0 * scale
          const xEnd  = lpad + total * scale
          const arrowTip = xEnd
          const arrowBase = arrowTip - 9
          goster = (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <svg width={svgW} height={svgH}>
                {/* Baseline */}
                <line x1={x0} y1={lineY} x2={xEnd} y2={lineY} stroke="#c8c2e0" strokeWidth={2} />
                {/* Tick at 0 */}
                <line x1={x0} y1={lineY - 5} x2={x0} y2={lineY + 5} stroke="#c8c2e0" strokeWidth={2} />
                <text x={x0} y={lineY + 17} textAnchor="middle"
                  fill={INK_SOFT} fontFamily="Fredoka, sans-serif" fontSize="12">0</text>
                {/* Dot at n0 */}
                <circle cx={xN0} cy={lineY} r={7} fill={MATH} />
                <text x={xN0} y={lineY - 13} textAnchor="middle"
                  fill={MATH} fontFamily="Fredoka, sans-serif" fontWeight="600" fontSize="11">{t.startLabel}</text>
                <text x={xN0} y={lineY + 17} textAnchor="middle"
                  fill={MATH} fontFamily="Fredoka, sans-serif" fontWeight="600" fontSize="12">{n0}</text>
                {/* Arrow from n0 to end */}
                <line x1={xN0 + 9} y1={lineY} x2={arrowBase} y2={lineY} stroke={ORANGE} strokeWidth={2.5} />
                <polygon points={`${arrowTip},${lineY} ${arrowBase},${lineY - 5} ${arrowBase},${lineY + 5}`} fill={ORANGE} />
                {/* +n1 label above arrow */}
                <text x={(xN0 + xEnd) / 2} y={lineY - 14} textAnchor="middle"
                  fill={ORANGE} fontFamily="Fredoka, sans-serif" fontWeight="600" fontSize="13">+{n1}</text>
                {/* "?" at end */}
                <circle cx={xEnd} cy={lineY} r={8} fill={GREEN} opacity={0.2} />
                <circle cx={xEnd} cy={lineY} r={8} fill="none" stroke={GREEN} strokeWidth={2} strokeDasharray="4 2" />
                <text x={xEnd} y={lineY + 5} textAnchor="middle"
                  fill={GREEN} fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="14">?</text>
              </svg>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 16, color: INK }}>
                <span style={{ color: MATH }}>{n0}</span>{' + '}
                <span style={{ color: ORANGE }}>{n1}</span>{' = '}
                <span style={{ color: GREEN, fontSize: 22 }}>?</span>
              </div>
            </div>
          )
        }
      }
    } else if (isMinus) {
      // Bar model for subtraction (unchanged)
      const svgW = 256, barH = 36, gap = 11, br = 9, svgH = barH * 2 + gap
      const ratio = n0 > 0 ? n1 / n0 : 0.5
      const subW  = Math.max(Math.round(ratio * svgW), 22)
      const remW  = svgW - subW
      goster = (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <svg width={svgW} height={svgH}>
            <rect x={0} y={0} width={svgW} height={barH} rx={br} fill={MATH} />
            <text x={svgW / 2} y={barH / 2 + 6} textAnchor="middle"
              fill="white" fontFamily="Fredoka, sans-serif" fontWeight="600" fontSize="15">{n0}</text>
            <rect x={0} y={barH + gap} width={subW - 2} height={barH} rx={br} fill={ORANGE} />
            {subW > 26 && <text x={(subW - 2) / 2} y={barH + gap + barH / 2 + 6} textAnchor="middle"
              fill="white" fontFamily="Fredoka, sans-serif" fontWeight="600" fontSize="15">{n1}</text>}
            {remW > 4 && <rect x={subW + 2} y={barH + gap} width={remW - 2} height={barH} rx={br} fill={GREEN} opacity={0.25} />}
            {remW > 4 && <rect x={subW + 2} y={barH + gap} width={remW - 2} height={barH} rx={br} fill="none" stroke={GREEN} strokeWidth={2} strokeDasharray="6 3" />}
            {remW > 26 && <text x={subW + 2 + (remW - 2) / 2} y={barH + gap + barH / 2 + 6} textAnchor="middle"
              fill={GREEN} fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="20">?</text>}
          </svg>
          <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 16, color: INK }}>
            <span style={{ color: MATH }}>{n0}</span>{' − '}
            <span style={{ color: ORANGE }}>{n1}</span>{' = '}
            <span style={{ color: GREEN, fontSize: 22 }}>?</span>
          </div>
        </div>
      )
    }
  }

  return (
    <div style={{
      background: 'white', borderRadius: 22, padding: '18px 16px 14px',
      boxShadow: '0 8px 28px rgba(60,120,200,.14)',
      display: 'flex', flexDirection: 'column', gap: 12,
      animation: 'scaleIn 0.3s ease both',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <TutoMascot size={80} expression="thinking" color={MATH} />
        <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 19, color: INK, textAlign: 'center' }}>
          {t.title}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 5, background: '#f0edf8', borderRadius: 13, padding: 4 }}>
        {[{ id: 'count', label: t.countTab }, { id: 'show', label: t.showTab }].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '7px 4px', border: 'none', borderRadius: 9,
              fontFamily: FRED, fontWeight: 600, fontSize: 13, cursor: 'pointer',
              background: activeTab === tab.id ? 'white' : 'transparent',
              color: activeTab === tab.id ? MATH_DEEP : INK_SOFT,
              boxShadow: activeTab === tab.id ? '0 2px 8px rgba(0,0,0,.10)' : 'none',
              transition: 'all 0.15s',
            }}
          >{tab.label}</button>
        ))}
      </div>

      <div style={{ minHeight: 140 }}>
        {activeTab === 'count' && sayalim}
        {activeTab === 'show'  && goster}
      </div>

      <button
        className="math-press"
        onClick={onDone}
        style={{
          background: MATH, color: 'white', border: 'none', borderRadius: 16,
          padding: '14px 22px', fontFamily: FRED, fontSize: 17, fontWeight: 600,
          cursor: 'pointer', boxShadow: '0 6px 18px rgba(61,143,207,.34)', width: '100%',
        }}
      >
        {t.ready}
      </button>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function MathScreen() {
  const nav   = useNavigate()
  const child    = JSON.parse(localStorage.getItem('child') || 'null')
  const age      = child?.age || 7
  const language = child?.language || 'en'

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
  const [helpUsed,      setHelpUsed]     = useState(false)
  const [helpVisible,   setHelpVisible]  = useState(false)

  const fileRef    = useRef(null)
  const flashTimer = useRef(null)

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
    const userAns    = Number(input)
    const isCorrect  = userAns === correctAns[qIdx]
    const newAnswers = [...userAnswers, userAns]

    if (!isCorrect && Number(age) <= 8) {
      setHelpVisible(true)
      setHelpUsed(true)
      setInput('')
      return
    }

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
    const baseGems   = child?.task_settings?.math?.gems ?? 20
    const gemsEarned = helpUsed ? Math.round(baseGems * 0.67) : baseGems
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

  // ── Shared container ──────────────────────────────────────────────────────
  const wrap = {
    background: FLOW_BG, minHeight: '100vh', maxWidth: 430,
    margin: '0 auto', display: 'flex', flexDirection: 'column',
    fontFamily: "'Nunito', sans-serif",
  }

  const BackBtn = ({ to }) => (
    <button
      onClick={() => to ? nav(to) : setStep('welcome')}
      style={{
        width: 42, height: 42, borderRadius: 14,
        background: 'rgba(255,255,255,0.85)', border: 'none',
        fontSize: 19, color: INK, fontWeight: 800,
        cursor: 'pointer', boxShadow: '0 3px 10px rgba(40,30,70,.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >←</button>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: welcome
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'welcome') return (
    <div style={wrap}>
      <style>{ANIM}</style>
      <div style={{ position: 'absolute', top: 42, left: 18, zIndex: 10 }}>
        <BackBtn to="/child/home" />
      </div>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '80px 26px 40px', gap: 20, textAlign: 'center',
      }}>
        <TutoMascot size={150} expression="excited" color={MATH}
          style={{ animation: 'float 3s ease-in-out infinite' }} />
        <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 21, color: INK, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
          {getWelcomeMsg(age)}
        </div>
        {level !== null && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: 'rgba(90,169,230,.16)', borderRadius: 14, padding: '8px 18px',
            fontFamily: FRED, fontWeight: 600, fontSize: 14, color: MATH_DEEP,
          }}>
            📊 {LEVEL_DESC[effectiveLevel] || 'Math Adventure'}
          </div>
        )}
        <button
          className="math-press"
          onClick={() => setStep('mode')}
          style={{
            background: MATH, color: 'white', border: 'none', borderRadius: 20,
            padding: '17px 54px', fontFamily: FRED, fontSize: 20, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 10px 28px rgba(61,143,207,.42)', marginTop: 4,
          }}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '52px 20px 10px' }}>
        <BackBtn />
        <span style={{ fontFamily: FRED, fontWeight: 600, fontSize: 22, color: INK, letterSpacing: '-.3px' }}>
          How do you want to work? 🤔
        </span>
      </div>

      <div className="math-scroll" style={{ flex: 1, padding: '4px 22px 24px', display: 'flex', flexDirection: 'column', gap: 15 }}>
        {/* Paper */}
        <button
          className="math-press"
          onClick={() => startLoading('paper')}
          style={{
            background: 'white', border: 'none', borderRadius: 26, padding: '24px 22px',
            display: 'flex', flexDirection: 'column', gap: 9, cursor: 'pointer', textAlign: 'left',
            boxShadow: '0 8px 26px rgba(60,120,200,.13)',
          }}
        >
          <span style={{ fontSize: 42 }}>✏️</span>
          <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 21, color: INK }}>On Paper</div>
          <div style={{
            alignSelf: 'flex-start', background: MATH, color: '#fff',
            borderRadius: 11, padding: '4px 13px', fontFamily: FRED, fontWeight: 600, fontSize: 13,
          }}>⭐ +30 Gems</div>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: INK_SOFT, lineHeight: 1.5, marginTop: 2 }}>
            We love pen and paper! Your brain grows every time you write! 🧠
          </div>
        </button>

        {/* Screen */}
        <button
          className="math-press"
          onClick={() => startLoading('screen')}
          style={{
            background: 'white', border: 'none', borderRadius: 26, padding: '24px 22px',
            display: 'flex', flexDirection: 'column', gap: 9, cursor: 'pointer', textAlign: 'left',
            boxShadow: '0 8px 26px rgba(60,120,200,.13)',
          }}
        >
          <span style={{ fontSize: 42 }}>📱</span>
          <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 21, color: INK }}>On Screen</div>
          <div style={{
            alignSelf: 'flex-start', background: GREEN, color: '#fff',
            borderRadius: 11, padding: '4px 13px', fontFamily: FRED, fontWeight: 600, fontSize: 13,
          }}>⭐ +20 Gems</div>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: INK_SOFT, lineHeight: 1.5, marginTop: 2 }}>
            Type your answers right here, one by one.
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
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 22, padding: 40,
      }}>
        <TutoMascot size={140} expression="thinking" color={MATH}
          style={{ animation: 'float 2s ease-in-out infinite' }} />
        <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 20, color: INK, textAlign: 'center' }}>
          {step === 'loading' ? 'Preparing your puzzles…' : 'Checking your work…'}
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              width: 11, height: 11, borderRadius: '50%', background: MATH, display: 'inline-block',
              opacity: 0.4 + i * 0.25,
              animation: 'float 1s ease-in-out infinite',
              animationDelay: `${i * 0.15}s`,
            }} />
          ))}
        </div>
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: paper_questions
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'paper_questions') return (
    <div style={{ ...wrap, overflow: 'hidden' }}>
      <style>{ANIM}</style>

      <div style={{ background: MATH, padding: '16px 22px 18px', borderRadius: '0 0 26px 26px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11, background: 'rgba(255,255,255,.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, color: '#fff', fontWeight: 800, cursor: 'pointer',
          }}
            onClick={() => setStep('mode')}
          >←</div>
          <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 21, color: '#fff' }}>My Math 🔢</div>
        </div>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,.85)', marginTop: 6, marginLeft: 45 }}>
          Now solve these on paper! ✏️
        </div>
      </div>

      <div className="math-scroll" style={{ flex: 1, padding: '16px 18px 14px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        {questions.map((q, i) => {
          const isWord = qTypes[i] === 'word' || q.length > 32
          return (
            <div key={i} style={{
              background: 'white', borderRadius: 18, padding: isWord ? '16px 18px' : '14px 18px',
              display: 'flex', alignItems: isWord ? 'flex-start' : 'center', gap: 13,
              boxShadow: '0 4px 14px rgba(60,120,200,.10)',
              animation: `fadeUp 0.35s ease ${i * 0.06}s both`,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', background: MATH, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: FRED, fontWeight: 600, fontSize: 15, flexShrink: 0,
                marginTop: isWord ? 2 : 0,
              }}>
                {i + 1}
              </div>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: isWord ? 17 : 22, color: INK, lineHeight: 1.5, flex: 1 }}>
                {q}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ flexShrink: 0, background: '#fff', padding: '14px 22px 22px', boxShadow: '0 -6px 18px rgba(40,30,70,.06)' }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) doPaperEval(f) }}
        />
        <button
          className="math-press"
          onClick={() => fileRef.current?.click()}
          style={{
            width: '100%', background: MATH, color: 'white', border: 'none',
            borderRadius: 18, padding: '16px', fontFamily: FRED, fontSize: 18, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 8px 20px rgba(61,143,207,.34)',
          }}
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
      <div style={{ ...wrap, overflow: 'hidden' }}>
        <style>{ANIM}</style>

        {/* Flash feedback overlay */}
        {flash && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 300,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
            background: flash.correct ? 'rgba(76,182,133,.94)' : 'rgba(247,148,51,.94)',
            animation: 'flashIn 1.4s ease both',
          }}>
            <div style={{ fontSize: 78, animation: 'pop .35s ease both' }}>{flash.correct ? '⭐' : '💪'}</div>
            <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 30, color: 'white', textAlign: 'center', padding: '0 28px', lineHeight: 1.4 }}>
              {flash.correct ? 'Yes! ⭐' : `Almost! The answer was ${flash.answer} 💪`}
            </div>
          </div>
        )}

        {/* Progress header */}
        <div style={{ background: MATH, padding: '16px 20px 18px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              onClick={() => nav('/child/home')}
              style={{
                width: 36, height: 36, borderRadius: 11, background: 'rgba(255,255,255,.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, color: '#fff', fontWeight: 800, cursor: 'pointer', flexShrink: 0,
              }}
            >←</div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.32)', borderRadius: 8, height: 10, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'white', borderRadius: 8, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 15, color: 'rgba(255,255,255,.95)', flexShrink: 0 }}>
              {qIdx + 1} / {questions.length}
            </div>
          </div>
        </div>

        {/* Question + keyboard */}
        <div className="math-scroll" style={{ flex: 1, padding: '18px 20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {helpVisible ? (
            <HelpPanel
              question={q}
              questionType={qTypes[qIdx]}
              onDone={() => { setHelpVisible(false); setInput('') }}
              language={language}
            />
          ) : (
            <>
              {/* Question card */}
              <div key={qIdx} style={{
                background: 'white', borderRadius: 22, padding: '26px 24px', textAlign: 'center',
                boxShadow: '0 8px 28px rgba(60,120,200,.14)', animation: 'scaleIn 0.3s ease both',
                minHeight: isWord ? 120 : 84, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: isWord ? 18 : 32, color: INK, lineHeight: 1.55 }}>
                  {q}
                </div>
              </div>

              {/* Answer display */}
              <div style={{
                background: 'white', borderRadius: 16, padding: '14px', textAlign: 'center',
                boxShadow: '0 4px 14px rgba(0,0,0,.05)', minHeight: 62,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontFamily: FRED, fontWeight: 600, fontSize: 38, color: input ? MATH : '#c8c2e0', letterSpacing: 6 }}>
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
            </>
          )}
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
              <span key={i} style={{
                position: 'absolute', left: p.left, top: '-14px',
                width: 11, height: 11, borderRadius: '50%', background: p.color, display: 'inline-block',
                animation: `confettiFall 2.6s ease-out ${p.delay} forwards`,
              }} />
            ))}
          </div>
        )}

        {/* Header */}
        <div style={{
          background: MATH, padding: '18px 24px 26px', borderRadius: '0 0 32px 32px',
          textAlign: 'center', flexShrink: 0,
        }}>
          <TutoMascot size={108} expression="proud" color="#fff"
            style={{ animation: 'float 3s ease-in-out infinite', display: 'inline-block' }} />
          <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 18, color: 'white', marginTop: 6, lineHeight: 1.5, padding: '0 8px' }}>
            {evalResult.encouragement}
          </div>
        </div>

        <div className="math-scroll" style={{ flex: 1, padding: '16px 18px 22px', display: 'flex', flexDirection: 'column', gap: 13 }}>

          {/* Score + gems card */}
          <div style={{
            background: 'white', borderRadius: 22, padding: '18px 22px',
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 4px 16px rgba(0,0,0,.05)', animation: 'fadeUp 0.4s ease both',
          }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 11, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '.6px' }}>Score</div>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 40, color: accuracy >= 80 ? GREEN : ORANGE, lineHeight: 1.05 }}>
                {accuracy}%
              </div>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: INK_SOFT, marginTop: 2 }}>{numCorrect} / {questions.length} correct</div>
            </div>
            <div style={{ width: 1, height: 56, background: '#eee' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 11, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '.6px' }}>Earned</div>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 40, color: ORANGE, lineHeight: 1.05 }}>+{evalResult.gems_earned}</div>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: INK_SOFT, marginTop: 2 }}>Gems ⭐</div>
            </div>
          </div>

          {/* Level up banner */}
          {leveledUp && (
            <div style={{
              background: `linear-gradient(135deg,${MATH} 0%,${GREEN} 100%)`,
              borderRadius: 18, padding: '15px 18px',
              display: 'flex', alignItems: 'center', gap: 13,
              animation: 'fadeUp 0.4s ease 0.08s both',
              boxShadow: '0 8px 22px rgba(61,143,207,.32)',
            }}>
              <span style={{ fontSize: 30 }}>🎉</span>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 16, color: 'white' }}>
                You unlocked a new level! 🎉
              </div>
            </div>
          )}

          {/* Per-question results */}
          {results.length > 0 && (
            <div>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 15, color: INK, margin: '2px 2px 8px' }}>
                Your answers:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {results.map((r, i) => (
                  <div key={i} style={{
                    background: 'white', borderRadius: 15, padding: '11px 15px',
                    display: 'flex', alignItems: 'flex-start', gap: 11,
                    boxShadow: '0 3px 12px rgba(60,120,200,.07)',
                    animation: `fadeUp 0.35s ease ${0.1 + i * 0.05}s both`,
                  }}>
                    <span style={{ fontSize: 19, flexShrink: 0, marginTop: 1 }}>{r.correct ? '✅' : '🔄'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 15, color: INK, lineHeight: 1.45 }}>{r.question}</div>
                      {!r.correct && (
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: ORANGE, marginTop: 3 }}>
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
            className="math-press"
            onClick={() => nav('/child/home')}
            style={{
              background: MATH, color: 'white', border: 'none', borderRadius: 18,
              padding: '16px 22px', fontFamily: FRED, fontSize: 18, fontWeight: 600,
              cursor: 'pointer', boxShadow: '0 8px 20px rgba(61,143,207,.34)', marginTop: 4,
            }}
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
        <TutoMascot size={100} expression="default" color={MATH} />
      </div>
    </div>
  )
}
