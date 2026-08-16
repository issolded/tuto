import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'
import { useIsTablet } from '../components/Shell'
import { generateCurriculumQuestions, evaluateMath, maxQuestionChars } from '../lib/gemini'
import { generateProblem, SHAPES, isCountable } from '../lib/mathTemplates'
import { findBadAnswers } from '../lib/mathVerify'
import { numeralise } from '../lib/numerals'
import { t } from '../lib/i18n'
import { planSession, templateTopicFor, startingLevelForAge, clampLevelToAge, yearLabelForAge } from '../lib/mathCurriculum'

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'

// A pull-to-refresh in the middle of a session used to throw the questions away — they are
// generated once and cannot be regenerated identically, so the child lost the work and the
// answers already given. sessionStorage, not localStorage: this should survive a reload of the
// same tab and nothing more. A half-finished session found a day later is not worth resuming.
const SESSION_KEY = 'tuto_math_session_v1'
const SESSION_TTL_MS = 2 * 60 * 60 * 1000
const ANSWERING_STEPS = ['paper_questions', 'screen_questions']

function readSavedSession(childId) {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
    if (!s || s.childId !== (childId ?? null)) return null
    if (!s.savedAt || Date.now() - s.savedAt > SESSION_TTL_MS) return null
    if (!ANSWERING_STEPS.includes(s.step)) return null
    if (!Array.isArray(s.questions) || !s.questions.length) return null
    // Every question already answered means the snapshot was taken as the evaluation started.
    // Resuming there would re-ask a finished session, so let it go rather than guess.
    if ((s.userAnswers?.length ?? 0) >= s.questions.length) return null
    return s
  } catch { return null }
}

// ── Design tokens (6–8 skin) ────────────────────────────────────────────────
const MATH      = '#5aa9e6'
const MATH_DEEP = '#3d8fcf'
const INK       = '#241f3a'
const INK_SOFT  = '#8d83ad'
const GREEN     = '#4cb685'
const ORANGE    = '#f79433'
const FRED      = "'TrRound', 'Fredoka', 'Baloo 2', sans-serif"
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

// Geometry sat at 11, above multiplication and division, from when it was LLM-written and
// really an addition question wearing shape vocabulary. Now that the shape is drawn and
// the child counts what they see, its true difficulty is plain: counting to 8 for one
// shape, to 16 for two — and every mark is on screen to be counted. So it belongs between
// the "up to 10" pair and the "up to 20" pair, which also keeps each add/subtract pair
// together. Everything from Addition up to 20 down to Division shifts one rung later.
// A question the child could not read: laid out in columns, marked up, or simply too long
// for the one line it is given. Deliberately conservative — dropping a question costs the
// session one slot, showing an unreadable one costs the child the answer.
function isUnreadable(q) {
  return q.includes('|') || /\n/.test(q) || /^\s*[-*#]\s/m.test(q) || q.length > 320
}

// Mirrors HelpPanel's own isPlus/isMinus/pattern detection — used to decide, before
// HelpPanel ever renders, whether showing help would actually show something. Keeps the
// auto-help-on-wrong-answer trigger from popping up an empty "draw it in the air" panel
// for topics (old LLM path, no template) that have no real helper.
// The arrow walkthrough can only handle a pattern that advances by a constant step.
// The final arrow has no "to" number, so its expected value is inferred from the others —
// which silently breaks on alternating patterns. "3, 6, 5, 8, 7, 10, __?" (+3, −1, …) was
// walking the child off the last 10 with +3 toward 13, when the answer is 9. It was not
// even completable: the −1 arrows expect a negative number and the keypad has no minus.
// Such patterns fall through to step hints, which describe the real rule.
function constantPatternStep(question) {
  const nums = (question.match(/\d+/g) || []).map(Number)
  if (nums.length < 3) return null // need two diffs before "constant" means anything
  const step = nums[1] - nums[0]
  if (step === 0) return null
  for (let i = 2; i < nums.length; i++) {
    if (nums[i] - nums[i - 1] !== step) return null
  }
  return step
}

// One comparison for the whole screen. The per-question check and the final marking used to
// each have their own: a tolerance in one, strict equality in the other. They agree today only
// because a typed "62.5" parses to exactly 62.5 — the moment either side is computed rather
// than parsed, a child would be told "correct" mid-session and marked wrong in the results.
function sameAnswer(given, expected) {
  // A skipped question stores null, and Number('') is 0 — so without this a skip would count
  // as correct against an answer of 0. No answer is not an answer.
  if (given === null || given === undefined || String(given).trim() === '') return false
  const a = Number(String(given).trim())
  const b = Number(expected)
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-9
}

// Children are asked "how many steps?", so they type a count and the arrow shows which
// way it goes — a descending pattern was previously unanswerable for the same reason.
const stepLabel = (n) => `${n < 0 ? '−' : '+'}${Math.abs(n)}`

function hasRealHelp(question, questionType, templateTopic, hintSteps, visual) {
  if (templateTopic) {
    // Addition and subtraction used to be unconditionally helpable because they were only ever
    // posed within 20, where the panel's one-emoji-per-unit drawing is the whole point. The
    // dial now reaches four digits, and sixty-two circles on screen is not help — past what a
    // child would count, the template's written steps carry it instead.
    if (templateTopic === 'addition' || templateTopic === 'subtraction') {
      const nums = (question.match(/\d+/g) || []).map(Number)
      return isCountable(nums[0], nums[1]) || (hintSteps?.length ?? 0) > 0
    }
    return !!visual || (hintSteps?.length ?? 0) > 0
  }
  // A constant-step pattern gets the interactive arrow walkthrough; anything else needs
  // the steps to explain the real rule.
  if (questionType === 'pattern') {
    return constantPatternStep(question) !== null || (hintSteps?.length ?? 0) > 0
  }
  // Model-written steps understand the problem; prefer them over any text guess (see
  // the precedence note in HelpPanel).
  if ((hintSteps?.length ?? 0) > 0) return true
  // No steps: the counting visual is only safe for a literal symbolic equation, where
  // the two parsed numbers really are the operands. Word problems are never inferred —
  // their numbers may need transforming first — and "Sides of a pentagon + Corners of a
  // triangle = ?" has a "+" with no digits at all, which used to open an empty panel.
  return questionType === 'symbolic'
    && (question.match(/\d+/g) || []).length >= 2
    && (question.includes('+') || question.includes('-'))
}

// The generator can only avoid repeats it is told about, and it was never told: the
// call site passed a literal empty array, so every session started from a blank slate.
// Measured across 3 consecutive generations per level, same child: "5, 10, 15, 20, __?"
// came back in 3 of 3 level-12 sessions, and level 11 returned "Sides of a pentagon +
// Sides of a triangle = ?" verbatim twice — a child practising daily would just re-answer
// the same handful of questions.
//
// Recent questions live in localStorage rather than the DB: no migration, and a child
// answers on one device anyway. Keyed per child+level so the avoid-list stays relevant to
// what is actually being generated. Only the template path has its own dedup (operandKey),
// so this covers the LLM path.
// Two kinds of recent memory, one implementation. 'seen' holds question text for the LLM
// path, which is told not to repeat it. 'keys' holds template operandKeys — the underlying
// number pair, independent of the names and wording around it — which seed the generator's
// avoid set. Templates only ever deduped inside a single batch, so the same "1/4 of 20"
// came back the moment a child started a second session.
const SEEN_CAP = 20

// Every age gets the same length. Five was set when a session was five of the same sum;
// ten topics is what makes it read as a quiz rather than a drill.
const QUESTIONS_PER_SESSION = 10
const seenKey = (kind, childId, level) => `tuto_math_${kind}_${childId || 'anon'}_${level}`

function readSeen(kind, childId, level) {
  try {
    const v = JSON.parse(localStorage.getItem(seenKey(kind, childId, level)) || '[]')
    return Array.isArray(v) ? v.filter(q => typeof q === 'string') : []
  } catch { return [] }
}

function rememberSeen(kind, childId, level, items) {
  try {
    const next = [...readSeen(kind, childId, level), ...(items || []).filter(Boolean)].slice(-SEEN_CAP)
    localStorage.setItem(seenKey(kind, childId, level), JSON.stringify(next))
  } catch { /* private mode / quota — repeated questions are a nuisance, not a failure */ }
}

function getWelcomeMsg(age, language) {
  const n = Number(age)
  if (n <= 7)  return t('math_welcome_young', language)
  if (n <= 10) return t('math_welcome_mid', language)
  return t('math_welcome_older', language)
}

function getScoreMsg(pct, age, language) {
  const n = Number(age)
  const band = pct >= 80 ? 'hi' : pct >= 60 ? 'mid' : pct >= 40 ? 'low' : 'vlow'
  const who = n <= 7 ? 'young' : n <= 10 ? 'mid' : 'older'
  return t(`score_${band}_${who}`, language)
}


// ── Number keyboard ──────────────────────────────────────────────────────────

// The point key appears only for questions whose answer actually has one. Every answer used
// to be a positive whole number, so there was no key and a four-character limit; curriculum
// topics like Decimals and Percentages need both. Showing the key on every question instead
// would put a decimal point in front of a five-year-old counting apples.
function NumberKeyboard({ value, onChange, onSubmit, disabled, allowDecimal = false }) {
  const ROWS = [['7','8','9'], ['4','5','6'], ['1','2','3'], allowDecimal ? ['⌫','0','.','✓'] : ['⌫','0','✓']]
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
                  // One point only, and never as the first character.
                  else if (key === '.') { if (value.length && !value.includes('.')) onChange(v => v + '.') }
                  else if (value.length < 7) onChange(v => v + key)
                }}
                style={{
                  width: row.length > 3 ? 62 : 70, height: row.length > 3 ? 62 : 70, borderRadius: '50%', border: 'none',
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

// ── Fractions, written the way they are taught ───────────────────────────────
// "1/2" on one line is a reading puzzle before it is a maths one: three characters where the
// teacher drew one number, and an eight-year-old reads it as two separate numbers. Stacked, it
// is the shape they already know. Display only — questions are still generated, stored and
// marked as plain text, so nothing downstream has to learn about this.
function Frac({ n, d }) {
  return (
    <span style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
      verticalAlign: 'middle', margin: '0 3px', lineHeight: 1.12,
    }}>
      <span style={{ fontSize: '.74em', padding: '0 3px' }}>{n}</span>
      <span style={{ alignSelf: 'stretch', height: 2, background: 'currentColor', borderRadius: 2 }} />
      <span style={{ fontSize: '.74em', padding: '0 3px' }}>{d}</span>
    </span>
  )
}

const FRACTION_RE = /(\d{1,3})\/(\d{1,3})/g

// Strict on purpose: no digit or slash may touch either side, so a division written "8 / 2"
// and a stray "1/2/3" are left exactly as they are. Division questions use ÷ anyway, which is
// what makes a bare slash safe to read as a fraction at all.
function MathText({ text }) {
  if (typeof text !== 'string' || !text.includes('/')) return text ?? null
  const parts = []
  let last = 0
  for (const m of text.matchAll(FRACTION_RE)) {
    const before = text[m.index - 1] ?? ''
    const after  = text[m.index + m[0].length] ?? ''
    if (/[\d/]/.test(before) || /[\d/]/.test(after)) continue
    parts.push(text.slice(last, m.index), <Frac key={m.index} n={m[1]} d={m[2]} />)
    last = m.index + m[0].length
  }
  if (!parts.length) return text
  parts.push(text.slice(last))
  return <>{parts}</>
}

// ── Step hints (template-engine problems with no dedicated visual yet) ────────
// Gradual reveal — nudge, then half, then the full worked step — built straight from
// the template's own hint_steps, never a separate hand-written explanation.

function StepHints({ question, hintSteps, revealed, onReveal, showMore, moreHint }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <div style={{
        fontFamily: FRED, fontWeight: 600, fontSize: 16, color: INK, textAlign: 'center', lineHeight: 1.5,
        background: 'rgba(90,169,230,.08)', borderRadius: 16, padding: '12px 16px', width: '100%',
      }}>
        <MathText text={question} />
      </div>
      {hintSteps.slice(0, revealed).map((h, i) => (
        <div key={i} style={{
          fontFamily: FRED, fontWeight: 500, fontSize: 14, color: INK_SOFT, textAlign: 'center',
          background: '#f0edf8', borderRadius: 12, padding: '10px 14px', width: '100%',
          animation: 'pop 0.25s ease both',
        }}>
          <MathText text={h} />
        </div>
      ))}
      {revealed < hintSteps.length && (
        <button
          className="math-press"
          onClick={onReveal}
          style={{
            background: MATH, color: 'white', border: 'none', borderRadius: 14,
            padding: '10px 20px', fontFamily: FRED, fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}
        >
          {revealed === 0 ? showMore : moreHint}
        </button>
      )}
    </div>
  )
}

// ── Help Panel ────────────────────────────────────────────────────────────────

// Geometry questions show the shape, so the child counts what they can see instead of
// recalling that a pentagon has five of anything. Squares and rectangles are given
// explicitly because the regular-polygon formula would stand them on a corner; the rest
// are regular polygons drawn point-up.
function shapePoints(kind, r) {
  if (kind === 'square')    return [[-r, -r], [r, -r], [r, r], [-r, r]]
  if (kind === 'rectangle') return [[-r * 1.35, -r * 0.75], [r * 1.35, -r * 0.75], [r * 1.35, r * 0.75], [-r * 1.35, r * 0.75]]
  const n = SHAPES[kind]
  return Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2
    return [r * Math.cos(a), r * Math.sin(a)]
  })
}

// `lit` is how far the child has counted — that many corners (or side midpoints) glow, so
// counting has a visible place-marker instead of being done in the head.
function ShapeSVG({ kind, size = 92, ask, lit = 0, showMarks = false }) {
  const r = size * 0.36
  const c = size / 2
  const pts = shapePoints(kind, r)
  const path = pts.map(([x, y]) => `${(c + x).toFixed(1)},${(c + y).toFixed(1)}`).join(' ')
  const marks = ask === 'sides'
    ? pts.map(([x, y], i) => {
        const [nx, ny] = pts[(i + 1) % pts.length]
        return [c + (x + nx) / 2, c + (y + ny) / 2]
      })
    : pts.map(([x, y]) => [c + x, c + y])

  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <polygon points={path} fill="#eaf3fc" stroke={MATH} strokeWidth={3} strokeLinejoin="round" />
      {showMarks && marks.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i < lit ? 7 : 5}
          fill={i < lit ? GREEN : '#fff'} stroke={i < lit ? GREEN : MATH} strokeWidth={2.5} />
      ))}
    </svg>
  )
}

// Division and fractions are the same picture — deal a total into equal groups — so one
// component covers levels 9, 10 and 15. Each tap deals a full round, one item to every
// group, because that is what "shared equally" actually means; the answer then reads
// straight off a single group. All numbers come from the template's `visual` descriptor,
// never parsed from the question text.
function ShareVisual({ total, groups, highlight, dealt, onDeal, label }) {
  const perGroup = dealt / groups          // dealt only ever advances a whole round
  const remaining = total - dealt
  const dot = total > 18 ? 11 : 14

  const Dot = ({ faded }) => (
    <span style={{
      width: dot, height: dot, borderRadius: '50%',
      background: faded ? '#d9d2ee' : MATH, display: 'inline-block',
    }} />
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
      <button
        className="math-press"
        onClick={remaining > 0 ? onDeal : undefined}
        disabled={remaining === 0}
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center', alignItems: 'center',
          maxWidth: 250, minHeight: 44, padding: '10px 14px', borderRadius: 16,
          border: `2px dashed ${remaining > 0 ? ORANGE : '#ded8f0'}`,
          background: remaining > 0 ? '#fff7ef' : 'transparent',
          cursor: remaining > 0 ? 'pointer' : 'default',
        }}
      >
        {remaining > 0
          ? Array.from({ length: remaining }).map((_, i) => <Dot key={i} />)
          : <span style={{ fontFamily: FRED, fontSize: 13, fontWeight: 600, color: INK_SOFT }}>✓</span>}
      </button>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {Array.from({ length: groups }).map((_, g) => {
          const isPicked = highlight && g < highlight
          return (
            <div key={g} style={{
              minWidth: 52, minHeight: 52, padding: '8px 9px', borderRadius: 15,
              border: `2px solid ${isPicked ? GREEN : '#ded8f0'}`,
              background: isPicked ? `${GREEN}14` : '#fff',
              display: 'flex', flexWrap: 'wrap', gap: 4,
              alignItems: 'center', justifyContent: 'center',
            }}>
              {perGroup === 0
                ? <Dot faded />
                : Array.from({ length: perGroup }).map((_, i) => <Dot key={i} />)}
            </div>
          )
        })}
      </div>

      {label && (
        <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 13, color: INK_SOFT, textAlign: 'center' }}>
          {label}
        </div>
      )}
    </div>
  )
}

function HelpPanel({ question, questionType, templateTopic, hintSteps, visual, onDone, onHelpUsed, language }) {
  const tr = language === 'tr'
  const t = tr ? {
    title:          'Haydi birlikte bakalım! 🧸',
    countTab:       'Sayalım',
    showTab:        'Göster',
    tapInstruction: 'Kaç tanesini çıkartacaksın?',
    countInstruction: 'Hepsini say!',
    ready:          'Anladım, tekrar deniyorum! 💪',
    nowCount:       'Şimdi kalanları say! 🔢',
    whichNext:      'Hangi sayı geliyor sence?',
    startLabel:     'başla',
    shareTap:       'Herkese birer tane ver! 👐',
    shareDone:      'Herkes eşit aldı! Şimdi bir grubu say 🔢',
    sharePick:      'İşte bir grup — kaç tane var?',
    shapeTap:       'Dokundukça say — her seferinde biri yanar 👆',
    shapeDone:      'Hepsini saydın! Kaç tane ettiler?',
    timesTap:       'Her grubu tek tek getir 👆',
    timesDone:      'Bak, hepsi eşit! Toplam kaç eder?',
    showHint:       'İpucu göster',
    moreHint:       'Daha fazla ipucu',
  } : {
    title:          'Let\'s look together! 🧸',
    countTab:       'Count',
    showTab:        'Show',
    tapInstruction: 'How many will you take away?',
    countInstruction: 'Count them all!',
    ready:          'Got it, let me try again! 💪',
    nowCount:       'Now count what\'s left! 🔢',
    whichNext:      'What number comes next?',
    startLabel:     'start',
    shareTap:       'Give one to each! 👐',
    shareDone:      'Everyone got the same! Now count one group 🔢',
    sharePick:      'That is one group — how many in it?',
    shapeTap:       'Tap to count — one lights up each time 👆',
    shapeDone:      'You counted them all! How many was that?',
    timesTap:       'Bring in one group at a time 👆',
    timesDone:      'See — every group is the same! How many altogether?',
    showHint:       'Show help',
    moreHint:       'More help',
  }

  const nums    = question.match(/\d+/g)?.map(Number) || []
  const n0 = nums[0] ?? 0
  const n1 = nums[1] ?? 0

  // Problems sourced from the template engine (mathTemplates.js) know their own topic —
  // use that directly instead of guessing from question text/regex.
  //
  // On the LLM path there is no such ground truth, and guessing from the text is not
  // merely unhelpful, it teaches the wrong method: "2 cookies are triangles and 1 is a
  // pentagon, how many corners in total?" has two parsable numbers and the word "total",
  // so the old guess drew 2 + 1 = 3 when the answer is 2×3 + 1×5 = 11. The numbers in a
  // word problem are not necessarily the operands of the computation. Model-written
  // hint_steps are produced with an understanding of the problem, so they take
  // precedence; the counting visual is kept only as a fallback for literal symbolic
  // equations, where the text genuinely IS the sum.
  const canTrustText = questionType === 'symbolic' && nums.length >= 2 && !(hintSteps?.length > 0)
  // Same gate as hasRealHelp: the emoji drawing only stands in for numbers a child would
  // actually count, otherwise the panel falls through to the written steps below.
  const drawable = isCountable(n0, n1)
  const isPlus  = templateTopic ? (templateTopic === 'addition' && drawable)    : (canTrustText && question.includes('+') && drawable)
  const isMinus = templateTopic ? (templateTopic === 'subtraction' && drawable) : (canTrustText && question.includes('-') && drawable)
  // Only a constant-step pattern can be walked arrow by arrow (see constantPatternStep);
  // an alternating one falls through to the steps like any other question.
  const patternStep = questionType === 'pattern' ? constantPatternStep(question) : null
  const usesArrowUI = patternStep !== null
  // A template-supplied descriptor is ground truth, so it outranks the step hints —
  // seeing 12 dealt into 3 groups beats reading about it.
  const share = visual?.kind === 'share' ? visual : null
  const shapes = visual?.kind === 'shapes' ? visual : null
  const counting = visual?.kind === 'count' ? visual : null
  // Both multiplication framings draw the same way — rows of a grid, or groups in a row —
  // so they share one path and differ only in how the rows are spaced and labelled.
  const times = (visual?.kind === 'groups' || visual?.kind === 'array') ? visual : null
  const timesRows = times ? (times.kind === 'array' ? times.rows : times.groups) : 0
  const timesPer  = times ? (times.kind === 'array' ? times.cols : times.per) : 0
  const hasStepHints = !isPlus && !isMinus && !usesArrowUI && !share && !shapes && !times && !counting && hintSteps?.length > 0

  const bigNums = (n0 > 15 || n1 > 15) || (questionType === 'word' && !isPlus && !isMinus)

  const [activeTab,    setActiveTab]    = useState('count')
  const [touched,      setTouched]      = useState(new Set())
  const [activeArrow,  setActiveArrow]  = useState(null)
  const [arrowInput,   setArrowInput]   = useState('')
  const [solvedArrows, setSolvedArrows] = useState({})
  const [tutoBubble,   setTutoBubble]   = useState(null)
  const [hintsRevealed, setHintsRevealed] = useState(0) // gradual reveal: nudge → half → full
  const [dealt,         setDealt]         = useState(0) // items handed out in the sharing visual

  useEffect(() => { if (bigNums) setActiveTab('show') }, [])

  // Count/Show (dot-counting, bar, number-line) is the help itself — just opening the
  // panel already showed it, no extra click needed, so it counts as "used" on mount.
  // StepHints counts separately, only once "Show help" is actually tapped (see onReveal).
  useEffect(() => { if (isPlus || isMinus || usesArrowUI || share || shapes || times || counting) onHelpUsed?.() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const allTouched  = isPlus  && (n0 + n1) > 0 && touched.size === (n0 + n1)
  const doneRemoval = isMinus && n1 > 0 && touched.size === n1

  const toggle = (key) => {
    setTouched(prev => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) }
      else { if (isMinus && next.size >= n1) return prev; next.add(key) }
      return next
    })
  }

  // ── Sayalım content ──────────────────────────────────────────────────────
  let sayalim

  if (counting) {
    // Counting out loud is exactly the skill, so the help is the act itself: one lights up
    // per tap and the tally keeps the child's place, which is the whole difficulty at this
    // age — not the numbers, but losing track of which ones are already counted.
    const total = counting.n
    const done = dealt >= total
    sayalim = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <div style={{
          fontFamily: FRED, fontWeight: 600, fontSize: 14, color: INK,
          background: 'rgba(90,169,230,.1)', borderRadius: 14, padding: '8px 14px',
          textAlign: 'center', maxWidth: 260,
        }}>
          {done ? t.shapeDone : t.shapeTap}
        </div>
        <div
          onClick={() => setDealt(d => Math.min(total, d + 1))}
          style={{ display: 'flex', gap: 9, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 280, cursor: done ? 'default' : 'pointer' }}
        >
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} style={{ fontSize: 32, lineHeight: 1, opacity: i < dealt ? 1 : 0.3, transition: 'opacity .15s' }}>
              {counting.item}
            </span>
          ))}
        </div>
        <div style={{ fontFamily: FRED, fontWeight: 700, fontSize: 22, color: done ? GREEN : MATH_DEEP }}>{dealt}</div>
      </div>
    )
  } else if (times) {
    // Revealed a row at a time — the point of multiplication is that every group is the
    // same size, which only lands if you watch equal rows appear one after another.
    const shown = Math.min(timesRows, dealt)
    const done = shown >= timesRows
    // Stays faithful to the wording — "9 rows of 2" really does show 9 rows — so with
    // factors up to 12 the dots shrink rather than the layout reflowing into a lie.
    const tDot = (timesRows > 6 || timesPer > 8) ? 10 : 14
    const tGap = timesRows > 6 ? 4 : 7
    sayalim = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <div style={{
          fontFamily: FRED, fontWeight: 600, fontSize: 14, color: INK,
          background: 'rgba(90,169,230,.1)', borderRadius: 14, padding: '8px 14px',
          textAlign: 'center', maxWidth: 260,
        }}>
          {done ? t.timesDone : t.timesTap}
        </div>
        <button
          className="math-press"
          onClick={done ? undefined : () => setDealt(d => Math.min(timesRows, d + 1))}
          style={{
            display: 'flex', flexDirection: 'column', gap: tGap, padding: '12px 14px',
            borderRadius: 16, border: `2px dashed ${done ? '#ded8f0' : ORANGE}`,
            background: done ? 'transparent' : '#fff7ef',
            cursor: done ? 'default' : 'pointer',
          }}
        >
          {Array.from({ length: timesRows }).map((_, r) => (
            <div key={r} style={{ display: 'flex', gap: 5, justifyContent: 'center', opacity: r < shown ? 1 : 0.12 }}>
              {Array.from({ length: timesPer }).map((_, c) => (
                <span key={c} style={{
                  width: tDot, height: tDot,
                  borderRadius: '50%', background: r < shown ? MATH : '#d9d2ee', display: 'inline-block',
                }} />
              ))}
            </div>
          ))}
        </button>
        <div style={{ fontFamily: FRED, fontWeight: 700, fontSize: 15, color: done ? GREEN : MATH_DEEP }}>
          {shown} × {timesPer}
        </div>
      </div>
    )
  } else if (shapes) {
    // Tapping counts one more mark, so the child's place is held on screen rather than in
    // their head — the same job the dot-tapping does for addition.
    const totals = shapes.shapes.map(s => SHAPES[s])
    const all = totals.reduce((a, b) => a + b, 0)
    const done = dealt >= all
    let left = dealt
    sayalim = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <div style={{
          fontFamily: FRED, fontWeight: 600, fontSize: 14, color: INK,
          background: 'rgba(90,169,230,.1)', borderRadius: 14, padding: '8px 14px',
          textAlign: 'center', maxWidth: 260,
        }}>
          {done ? t.shapeDone : t.shapeTap}
        </div>
        <div
          onClick={() => setDealt(d => Math.min(all, d + 1))}
          style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', cursor: done ? 'default' : 'pointer' }}
        >
          {shapes.shapes.map((s, i) => {
            const lit = Math.max(0, Math.min(totals[i], left))
            left -= totals[i]
            return <ShapeSVG key={i} kind={s} size={104} ask={shapes.ask} lit={lit} showMarks />
          })}
        </div>
        <div style={{ fontFamily: FRED, fontWeight: 700, fontSize: 20, color: done ? GREEN : MATH_DEEP }}>
          {dealt}
        </div>
      </div>
    )
  } else if (share) {
    const done = dealt >= share.total
    sayalim = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <div style={{
          fontFamily: FRED, fontWeight: 600, fontSize: 14, color: INK,
          background: 'rgba(90,169,230,.1)', borderRadius: 14, padding: '8px 14px',
          textAlign: 'center', maxWidth: 260,
        }}>
          {done ? (share.highlight ? t.sharePick : t.shareDone) : t.shareTap}
        </div>
        <ShareVisual
          total={share.total}
          groups={share.groups}
          highlight={done ? share.highlight : 0}
          dealt={dealt}
          onDeal={() => setDealt(d => Math.min(share.total, d + share.groups))}
        />
      </div>
    )
  } else if (usesArrowUI) {
    const diff = patternStep
    const arrowCount = nums.length
    const allArrowsSolved = Object.keys(solvedArrows).length === arrowCount

    const handleArrowTap = (i) => {
      if (solvedArrows[i] !== undefined) return
      const from = nums[i]
      const toNum = nums[i + 1]
      const toDisplay = toNum !== undefined ? toNum : '?'
      setActiveArrow(i)
      setArrowInput('')
      setTutoBubble(tr
        ? `${from}'den ${toDisplay}'ye kaç adım?`
        : `${from} to ${toDisplay} — how many steps?`)
    }

    const confirmArrow = (i, input) => {
      const from = nums[i]
      const toNum = nums[i + 1]
      const expected = toNum !== undefined ? toNum - from : diff
      // The child is asked "how many steps?", so they answer with a count. Comparing
      // against the signed value made every descending pattern unanswerable — the
      // keypad has no minus key.
      if (Number(input) === Math.abs(expected)) {
        const newSolved = { ...solvedArrows, [i]: expected }
        setSolvedArrows(newSolved)
        setActiveArrow(null)
        setArrowInput('')
        if (Object.keys(newSolved).length === arrowCount) {
          setTutoBubble(tr
            ? `${nums[nums.length - 1]}'dan sonra ne gelir? Şimdi yaz! 💪`
            : `So what comes after ${nums[nums.length - 1]}? Type it in! 💪`)
        } else {
          const nextTo = nums[i + 2]
          setTutoBubble(tr
            ? (nextTo !== undefined
                ? `Evet! ${stepLabel(expected)}. Peki ${toNum}'den ${nextTo}'ye?`
                : `Evet! ${stepLabel(expected)}. O zaman ${nums[nums.length - 1]}'dan sonra ne gelir?`)
            : (nextTo !== undefined
                ? `Yes! ${stepLabel(expected)}. Now ${toNum} to ${nextTo}?`
                : `Yes! ${stepLabel(expected)}. So what comes after ${nums[nums.length - 1]}?`))
        }
      } else {
        const toDisplay = toNum !== undefined ? toNum : '?'
        setTutoBubble(tr
          ? `Tekrar dene! ${from}'den ${toDisplay}'ye say 🔢`
          : `Try again! Count from ${from} to ${toDisplay} 🔢`)
        setArrowInput('')
      }
    }

    sayalim = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <div style={{
          fontFamily: FRED, fontWeight: 600, fontSize: 14, color: INK,
          background: 'rgba(90,169,230,.1)', borderRadius: 14, padding: '8px 14px',
          textAlign: 'center', maxWidth: 260,
        }}>
          {tutoBubble || t.whichNext}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: 4 }}>
          {nums.map((n, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, background: MATH, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: FRED, fontWeight: 600, fontSize: 20,
                boxShadow: '0 4px 12px rgba(90,169,230,.35)',
              }}>{n}</div>
              <div
                onClick={() => handleArrowTap(i)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
                  cursor: solvedArrows[i] !== undefined ? 'default' : 'pointer',
                  userSelect: 'none',
                }}
              >
                <span style={{
                  fontFamily: FRED, fontWeight: 700, fontSize: 11, lineHeight: 1,
                  color: solvedArrows[i] !== undefined ? GREEN : activeArrow === i ? MATH : ORANGE,
                }}>
                  {solvedArrows[i] !== undefined ? stepLabel(solvedArrows[i]) : '?'}
                </span>
                <span style={{
                  fontSize: 15, lineHeight: 1,
                  color: solvedArrows[i] !== undefined ? GREEN : activeArrow === i ? MATH : INK_SOFT,
                }}>→</span>
              </div>
            </div>
          ))}
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            border: `3px dashed ${allArrowsSolved ? GREEN : ORANGE}`,
            background: allArrowsSolved ? `${GREEN}15` : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FRED, fontWeight: 600, fontSize: 26, color: allArrowsSolved ? GREEN : ORANGE,
          }}>?</div>
        </div>

        {activeArrow !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'center' }}>
            <div style={{
              fontFamily: FRED, fontSize: 24, fontWeight: 700, color: INK,
              background: '#f0edf8', borderRadius: 12, padding: '5px 20px', minWidth: 56, textAlign: 'center',
            }}>
              {arrowInput || '?'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center', maxWidth: 216 }}>
              {['1','2','3','4','5','6','7','8','9','0','⌫','✓'].map(k => (
                <button
                  key={k}
                  className="math-press"
                  onClick={() => {
                    if (k === '⌫') { setArrowInput(v => v.slice(0, -1)); return }
                    if (k === '✓') { if (arrowInput) confirmArrow(activeArrow, arrowInput); return }
                    if (arrowInput.length < 2) setArrowInput(v => v + k)
                  }}
                  style={{
                    width: k === '✓' || k === '⌫' ? 48 : 36, height: 36,
                    borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontFamily: FRED, fontWeight: 600, fontSize: 15,
                    background: k === '✓' ? GREEN : k === '⌫' ? ORANGE : '#e8e4f5',
                    color: k === '✓' || k === '⌫' ? 'white' : INK,
                  }}
                >{k}</button>
              ))}
            </div>
          </div>
        )}
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
              opacity: touched.has(i) ? 0.4 : 1, transition: 'opacity 0.15s',
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
      </div>
    )
  } else if (hasStepHints) {
    sayalim = (
      <StepHints question={question} hintSteps={hintSteps} revealed={hintsRevealed} onReveal={() => { setHintsRevealed(r => Math.min(hintSteps.length, r + 1)); onHelpUsed?.() }} showMore={t.showHint} moreHint={t.moreHint} />
    )
  } else {
    // Unreachable in practice — HelpPanel only mounts when hasRealHelp() (MathScreen)
    // is true, which is exactly isPlus || isMinus || pattern || hasStepHints. Kept as a
    // defensive no-render instead of the old "draw it in the air" filler, which showed
    // no real help and could imply the wrong operation.
    sayalim = null
  }

  // ── Göster content ────────────────────────────────────────────────────────
  const _svgW = 260, _barH = 36, _gap = 10, _br = 9
  let goster

  if (counting) {
    goster = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 280 }}>
          {Array.from({ length: counting.n }).map((_, i) => (
            <span key={i} style={{ fontSize: 30, lineHeight: 1, position: 'relative' }}>
              {counting.item}
              <span style={{ position: 'absolute', bottom: -9, left: '50%', transform: 'translateX(-50%)', fontFamily: FRED, fontSize: 11, fontWeight: 700, color: MATH_DEEP }}>{i + 1}</span>
            </span>
          ))}
        </div>
      </div>
    )
  } else if (times) {
    // The whole array at once, with each row counted down the side — the child reads off
    // how many rows and how many in each, and does the multiplying themselves.
    goster = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'center' }}>
        {Array.from({ length: timesRows }).map((_, r) => (
          <div key={r} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontFamily: FRED, fontSize: 11, fontWeight: 700, color: INK_SOFT, width: 16, textAlign: 'right' }}>{r + 1}</span>
            {Array.from({ length: timesPer }).map((_, c) => (
              <span key={c} style={{
                width: timesPer > 8 ? 11 : 14, height: timesPer > 8 ? 11 : 14,
                borderRadius: '50%', background: MATH, display: 'inline-block',
              }} />
            ))}
          </div>
        ))}
        <div style={{ fontFamily: FRED, fontWeight: 700, fontSize: 15, color: MATH_DEEP, marginTop: 2 }}>
          {timesRows} × {timesPer} = ?
        </div>
      </div>
    )
  } else if (shapes) {
    // Every mark already lit, so the picture states the count without stating the total.
    goster = (
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
        {shapes.shapes.map((s, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <ShapeSVG kind={s} size={104} ask={shapes.ask} lit={SHAPES[s]} showMarks />
            <span style={{ fontFamily: FRED, fontWeight: 700, fontSize: 16, color: GREEN }}>{SHAPES[s]}</span>
          </div>
        ))}
      </div>
    )
  } else if (share) {
    // Already shared out, so the child reads the result rather than doing the dealing —
    // the equation is written with a "?" so it still stops short of the answer.
    goster = (
      <ShareVisual
        total={share.total}
        groups={share.groups}
        highlight={share.highlight}
        dealt={share.total}
        onDeal={undefined}
        // Division reads as plain notation, which needs no translating. A fraction has no
        // tidy notation for "one of these groups", so it describes the picture instead —
        // the highlighted group is the answer.
        label={share.highlight
          ? (tr ? `${share.total} sayısı ${share.groups} eşit grupta` : `${share.total} in ${share.groups} equal groups`)
          : `${share.total} ÷ ${share.groups} = ?`}
      />
    )
  } else if (usesArrowUI) {
    const diff = patternStep
    const allPts = [...nums, null]   // null = ?
    const nlW = 280, nlH = 82
    const lpad = 22, rpad = 22
    const step = allPts.length > 1 ? (nlW - lpad - rpad) / (allPts.length - 1) : 0
    const lineY = 55, arcH = 20, dotR = 7
    goster = (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg width={nlW} height={nlH}>
          <line x1={lpad} y1={lineY} x2={nlW - rpad} y2={lineY} stroke="#c8c2e0" strokeWidth={2} />
          {allPts.slice(0, -1).map((_, i) => {
            const x1 = lpad + i * step, x2 = lpad + (i + 1) * step, mx = (x1 + x2) / 2
            return (
              <g key={i}>
                <path d={`M ${x1} ${lineY} Q ${mx} ${lineY - arcH} ${x2} ${lineY}`}
                  fill="none" stroke={ORANGE} strokeWidth={2} />
                <text x={mx} y={lineY - arcH - 4} textAnchor="middle"
                  fill={ORANGE} fontFamily="Fredoka, sans-serif" fontWeight="600" fontSize="12">{stepLabel(diff)}</text>
              </g>
            )
          })}
          {allPts.map((val, i) => {
            const cx = lpad + i * step
            const isLast = i === allPts.length - 1
            return isLast ? (
              <g key={i}>
                <circle cx={cx} cy={lineY} r={dotR} fill={GREEN} opacity={0.18} />
                <circle cx={cx} cy={lineY} r={dotR} fill="none" stroke={GREEN} strokeWidth={2} strokeDasharray="4 2" />
                <text x={cx} y={lineY + 4} textAnchor="middle"
                  fill={GREEN} fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="11">?</text>
              </g>
            ) : (
              <g key={i}>
                <circle cx={cx} cy={lineY} r={dotR} fill={MATH} />
                <text x={cx} y={lineY + 19} textAnchor="middle"
                  fill={MATH} fontFamily="Fredoka, sans-serif" fontWeight="600" fontSize="12">{val}</text>
              </g>
            )
          })}
        </svg>
      </div>
    )
  } else if (isPlus && n0 > 0 && n1 > 0) {
    const total  = n0 + n1
    const blueW  = Math.round((n0 / total) * _svgW)
    const orangeW = _svgW - blueW
    goster = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <svg width={_svgW} height={_barH * 2 + _gap}>
          <rect x={0} y={0} width={_svgW} height={_barH} rx={_br} fill={`${GREEN}22`} />
          <rect x={0} y={0} width={_svgW} height={_barH} rx={_br} fill="none" stroke={GREEN} strokeWidth={2.5} strokeDasharray="6 3" />
          <text x={_svgW / 2} y={_barH / 2 + 6} textAnchor="middle"
            fill={GREEN} fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="20">?</text>
          <rect x={0} y={_barH + _gap} width={blueW - 1} height={_barH} rx={_br} fill={MATH} />
          {blueW > 28 && <text x={(blueW - 1) / 2} y={_barH + _gap + _barH / 2 + 6} textAnchor="middle"
            fill="white" fontFamily="Fredoka, sans-serif" fontWeight="600" fontSize="15">{n0}</text>}
          <rect x={blueW + 1} y={_barH + _gap} width={orangeW - 1} height={_barH} rx={_br} fill={ORANGE} />
          {orangeW > 28 && <text x={blueW + 1 + (orangeW - 1) / 2} y={_barH + _gap + _barH / 2 + 6} textAnchor="middle"
            fill="white" fontFamily="Fredoka, sans-serif" fontWeight="600" fontSize="15">{n1}</text>}
        </svg>
        <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 16, color: INK }}>
          <span style={{ color: MATH }}>{n0}</span>{' + '}
          <span style={{ color: ORANGE }}>{n1}</span>{' = '}
          <span style={{ color: GREEN, fontSize: 22 }}>?</span>
        </div>
      </div>
    )
  } else if (isMinus && n0 > 0) {
    const total   = n0 + n1
    const orangeW = total > 0 ? Math.round((n1 / total) * _svgW) : Math.round(_svgW * 0.5)
    const greenW  = _svgW - orangeW
    goster = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <svg width={_svgW} height={_barH * 2 + _gap}>
          <rect x={0} y={0} width={_svgW} height={_barH} rx={_br} fill={MATH} />
          <text x={_svgW / 2} y={_barH / 2 + 6} textAnchor="middle"
            fill="white" fontFamily="Fredoka, sans-serif" fontWeight="600" fontSize="15">{n0}</text>
          <rect x={0} y={_barH + _gap} width={orangeW - 1} height={_barH} rx={_br} fill={ORANGE} />
          {orangeW > 28 && <text x={(orangeW - 1) / 2} y={_barH + _gap + _barH / 2 + 6} textAnchor="middle"
            fill="white" fontFamily="Fredoka, sans-serif" fontWeight="600" fontSize="15">{n1}</text>}
          {greenW > 4 && <rect x={orangeW + 1} y={_barH + _gap} width={greenW - 1} height={_barH} rx={_br} fill={`${GREEN}22`} />}
          {greenW > 4 && <rect x={orangeW + 1} y={_barH + _gap} width={greenW - 1} height={_barH} rx={_br} fill="none" stroke={GREEN} strokeWidth={2.5} strokeDasharray="6 3" />}
          {greenW > 28 && <text x={orangeW + 1 + (greenW - 1) / 2} y={_barH + _gap + _barH / 2 + 6} textAnchor="middle"
            fill={GREEN} fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="20">?</text>}
        </svg>
        <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 16, color: INK }}>
          <span style={{ color: MATH }}>{n0}</span>{' − '}
          <span style={{ color: ORANGE }}>{n1}</span>{' = '}
          <span style={{ color: GREEN, fontSize: 22 }}>?</span>
        </div>
      </div>
    )
  } else if (hasStepHints) {
    goster = (
      <StepHints question={question} hintSteps={hintSteps} revealed={hintsRevealed} onReveal={() => { setHintsRevealed(r => Math.min(hintSteps.length, r + 1)); onHelpUsed?.() }} showMore={t.showHint} moreHint={t.moreHint} />
    )
  } else {
    // Unreachable in practice — see the matching note on the `sayalim` fallback above.
    goster = null
  }

  const showDoneBtn = activeTab === 'show'
    || bigNums
    || (usesArrowUI && Object.keys(solvedArrows).length === nums.length)
    || (!isPlus && !isMinus)
    || (isMinus && doneRemoval)
    || (isPlus && allTouched)

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

      {/* Count/Show only when the two tabs actually differ — for step-hint problems
          (no dedicated visual yet) both tabs render the same content, so a tab switcher
          would just be a confusing no-op toggle; show a single panel instead. */}
      {!hasStepHints && (
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
      )}

      <div style={{ minHeight: 140 }}>
        {hasStepHints ? sayalim : (
          <>
            {activeTab === 'count' && sayalim}
            {activeTab === 'show'  && goster}
          </>
        )}
      </div>

      {showDoneBtn && (
        <button
          className="math-press"
          onClick={onDone}
          style={{
            background: MATH, color: 'white', border: 'none', borderRadius: 16,
            padding: '14px 22px', fontFamily: FRED, fontSize: 17, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 6px 18px rgba(61,143,207,.34)', width: '100%',
            animation: 'pop 0.25s ease both',
          }}
        >
          {t.ready}
        </button>
      )}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function MathScreen() {
  const nav   = useNavigate()
  const isTablet = useIsTablet()
  const child    = JSON.parse(localStorage.getItem('child') || 'null')
  const age      = child?.age || 7
  const language = child?.language || 'en'

  // Read once, before any state is created: a reload lands here with the session it lost.
  const saved = useMemo(() => readSavedSession(child?.id), [])

  const [step,          setStep]         = useState(saved?.step ?? 'welcome')
  const [mode,          setMode]         = useState(saved?.mode ?? null)        // 'paper' | 'screen'
  const [level,         setLevel]        = useState(saved?.level ?? null)
  const [questions,     setQuestions]    = useState(saved?.questions ?? [])
  const [correctAns,    setCorrectAns]   = useState(saved?.correctAns ?? [])
  const [qTypes,        setQTypes]       = useState(saved?.qTypes ?? [])
  const [topic,         setTopic]        = useState(saved?.topic ?? '')
  const [qIdx,          setQIdx]         = useState(saved?.qIdx ?? 0)
  const [userAnswers,   setUserAnswers]  = useState(saved?.userAnswers ?? [])
  const [input,         setInput]        = useState('')
  const [flash,         setFlash]        = useState(null)        // { correct, answer }
  const [evalResult,    setEvalResult]   = useState(null)
  const [leveledUp,     setLeveledUp]    = useState(false)
  const [helpUsed,      setHelpUsed]     = useState(saved?.helpUsed ?? false)
  const [helpVisible,   setHelpVisible]  = useState(false)
  const [hintOpenFor,   setHintOpenFor]  = useState(null)  // question index whose optional hint is showing
  const [weighting,     setWeighting]    = useState({ focusTopicId: null, weakTopicIds: [] })
  const [confirmLeave,  setConfirmLeave] = useState(false)  // asked before a half-finished session is thrown away
  const [skippable,     setSkippable]    = useState(() => new Set(saved?.skippable ?? [])) // questions where help has been shown, so moving on is allowed
  const [helpUsedQs,    setHelpUsedQs]   = useState(() => new Set(saved?.helpUsedQs ?? [])) // distinct question indices where help was actually shown/used this session
  const [templateProblems, setTemplateProblems] = useState(saved?.templateProblems ?? []) // per-question { topic, hint_steps } when sourced from mathTemplates.js; empty = old LLM path
  const [llmHints,      setLlmHints]     = useState(saved?.llmHints ?? [])         // per-question hint_steps for the LLM path, where there is no template to read them from
  const [answerFormats, setAnswerFormats] = useState(saved?.answerFormats ?? [])       // 'integer' | 'decimal' per question — decides whether the keypad offers a point
  const [curriculumTopics, setCurriculumTopics] = useState(saved?.curriculumTopics ?? []) // the curriculum entry each question came from

  const fileRef    = useRef(null)
  const flashTimer = useRef(null)
  const prefetch   = useRef(null)   // a session being built ahead of the child choosing a mode

  // ── Start: pick mode then generate questions ─────────────────────────────
  //
  // A session used to be five questions on ONE thing, because the level chose the subject and
  // each rung named a single operation. The child's year now chooses the subject — all of it —
  // and the level only says how hard. So a session is assembled topic by topic: drawn from a
  // code template where one genuinely fits that topic, and from a single model call covering
  // everything else at once.
  //
  // Building is separated from starting because it does not depend on the mode: paper and
  // screen ask the same questions and only differ in how they are presented. That is what
  // lets the work begin while the child is still reading the welcome screen, instead of after
  // they have chosen — two model calls run back to back here (write, then verify), and the
  // child used to watch all of it.
  //
  // Nothing here writes state or records anything as seen. A session that is built and never
  // played must leave no trace, so both are the caller's job once a session is actually used.
  const buildSession = async (lvl, w) => {
    const slots = planSession(age, QUESTIONS_PER_SESSION, readSeen('topics', child?.id, 'curriculum'), w)
      .map(t => ({ curriculum: t, templateTopic: templateTopicFor(t) }))
    if (!slots.length) return null

    // Track operand pairs across the batch AND across recent sessions, so the same (a,b) —
    // and therefore the same answer — never comes back a question or a day later.
    const usedOperands = new Set(readSeen('keys', child?.id, lvl))
    for (const slot of slots) {
      if (!slot.templateTopic) continue
      const p = generateProblem(slot.templateTopic, lvl, usedOperands, language)
      usedOperands.add(p.operandKey)
      slot.problem = p
      slot.question = p.question_text
      slot.answer = p.correct_answer
      slot.format = 'integer'
    }

    const llmSlots = slots.filter(s => !s.templateTopic)
    let llmQuestions = []
    if (llmSlots.length) {
      try {
        const result = await generateCurriculumQuestions(
          age, lvl, llmSlots.map(s => s.curriculum), readSeen('seen', child?.id, 'curriculum'), language,
        )
        llmSlots.forEach((slot, i) => {
          const q = result.questions?.[i]
          const a = result.answers?.[i]
          if (typeof q !== 'string' || !q.trim() || !Number.isFinite(Number(a))) return
          // The question is drawn as one run of plain text, so anything laid out in columns
          // arrives as a wall: a statistics question came back as a markdown table and read
          // "Team | Week 1 | Week 2 | Week 3 | Week 4 Strikers | 4 | 6 | 3 | 5 Defenders |...".
          // The prompt forbids it; this is what enforces it.
          if (isUnreadable(q)) return
          // Children testing this could not get past "eight hundred and forty five" — the
          // reading stopped them before the arithmetic did, and the topic was recorded as a
          // weakness. The prompt asks for digits; this makes sure of it.
          slot.question = numeralise(q, language)
          slot.answer = Number(a)
          slot.format = result.answer_formats?.[i] === 'decimal' ? 'decimal' : 'integer'
          slot.hints = Array.isArray(result.hint_steps?.[i])
            ? result.hint_steps[i].map(h => numeralise(h, language))
            : null
        })
        // The model writes the question and its answer together, and until now nothing ever
        // disagreed with it. A wrong answer here is worse than a missing question: the child
        // solves it correctly, is told they are wrong, and the topic is recorded as a
        // weakness. Anything that fails verification is dropped and refilled from a template.
        const filled = llmSlots.filter(s => typeof s.question === 'string' && s.question.trim())
        const bad = new Set(await findBadAnswers(filled.map(s => ({ question: s.question, answer: s.answer })), language))
        // Length is a property of the question rather than of its answer, so it is checked here
        // and not in findBadAnswers. Enforced in code because a limit left to the model drifts
        // back to whatever the prose allows: the old prompt asked for under 300 characters and
        // got paragraphs of story ending in 18 - 12, which is a reading test, not a maths one.
        const cap = maxQuestionChars(age)
        filled.forEach((s, i) => { if (s.question.length > cap) bad.add(i) })
        for (const i of bad) {
          const slot = filled[i]
          const why = slot.question.length > cap
            ? `too long (${slot.question.length} > ${cap} chars)`
            : 'the answer did not check out'
          console.warn(`[VERIFY] dropped a question — ${why}: ${slot.question}`)
          const fallbackTopic = slot.curriculum?.templateTopic ?? slot.templateTopic
          const p = fallbackTopic ? generateProblem(fallbackTopic, lvl, usedOperands, language) : null
          if (p) {
            usedOperands.add(p.operandKey)
            slot.problem = p; slot.question = p.question_text; slot.answer = p.correct_answer
            slot.format = 'integer'; slot.hints = null
          } else {
            slot.question = null
          }
        }

        llmQuestions = llmSlots.filter(s => s.question).map(s => s.question)
      } catch (e) {
        // A model that will not answer costs the child the topics only it can pose, not the
        // whole session — the template questions below are already generated and correct.
        console.error('generateCurriculumQuestions:', e)
      }
    }

    // Slots the model skipped or malformed are dropped rather than shown blank.
    const ready = slots.filter(s => typeof s.question === 'string' && s.question.trim())
    if (!ready.length) return null
    return { ready, llmQuestions, level: lvl }
  }

  // Put a built session on screen. Everything with a lasting effect lives here rather than in
  // buildSession, so a prepared session the child walks away from costs nothing.
  const adoptSession = ({ ready, llmQuestions, level: lvl }, selectedMode) => {
    rememberSeen('seen', child?.id, 'curriculum', llmQuestions)
    rememberSeen('keys', child?.id, lvl, ready.map(s => s.problem?.operandKey))
    rememberSeen('topics', child?.id, 'curriculum', ready.map(s => s.curriculum.id))

    setQuestions(ready.map(s => s.question))
    setCorrectAns(ready.map(s => s.answer))
    setAnswerFormats(ready.map(s => s.format))
    setQTypes(ready.map(() => null))
    setCurriculumTopics(ready.map(s => s.curriculum))
    setTopic(ready[0]?.curriculum?.name || 'math')
    setTemplateProblems(ready.map(s => s.problem ?? null))
    setLlmHints(ready.map(s => s.hints ?? null))
    setStep(selectedMode === 'paper' ? 'paper_questions' : 'screen_questions')
  }

  // Begin preparing as soon as the level is known. `result` is what makes the loading screen
  // skippable: if it is already there when the mode is chosen, the questions go up on the same
  // tick and the child never sees a spinner at all.
  const startPrefetch = (lvl, w) => {
    if (prefetch.current) return
    const entry = { result: null, promise: null }
    entry.promise = buildSession(lvl, w)
      .then(built => { entry.result = built; return built })
      .catch(e => { console.error('prefetch:', e); return null })
    prefetch.current = entry
  }

  // Level, per-topic standing and any focus a parent asked for — one call, one authority. The
  // level used to be read straight from math_progress in the browser; the other two have no
  // client-side source, and fetching them together is what keeps the figure the parent is told
  // and the figure this screen builds a session from the same figure.
  useEffect(() => {
    // A restored session already has its questions; building another would waste a model call
    // and hand the child a session they did not ask for.
    const resuming = !!saved
    if (!child?.id) {
      const lvl = startingLevelForAge(age)
      setLevel(lvl)
      if (!resuming) startPrefetch(lvl, { focusTopicId: null, weakTopicIds: [] })
      return
    }
    ;(async () => {
      try {
        const res = await fetch(`${SERVER}/api/children/${child.id}/math-plan`)
        if (!res.ok) throw new Error(`server ${res.status}`)
        const plan = await res.json()
        // Clamped to the child's year here rather than trusted as stored: levels written under
        // the old meaning of the dial are still in the table, and one of them had a
        // seven-year-old on 15. The clamped value is what gets sent back when the session
        // saves, so a stale level corrects itself the first time a child plays.
        const lvl = clampLevelToAge(plan?.level, age)
        const w = {
          focusTopicId: plan?.focus?.topic_id ?? null,
          weakTopicIds: Array.isArray(plan?.weak_topic_ids) ? plan.weak_topic_ids : [],
        }
        setLevel(lvl)
        setWeighting(w)
        // Started here, not on the mode screen: the two model calls need longer than the
        // child takes to choose, and the welcome screen is the only slack there is.
        if (!resuming) startPrefetch(lvl, w)
      } catch (e) {
        // A session with no weighting is still a good session; one that will not start is not.
        console.error('math-plan:', e)
        const lvl = startingLevelForAge(age)
        setLevel(lvl)
        if (!resuming) startPrefetch(lvl, { focusTopicId: null, weakTopicIds: [] })
      }
    })()
    return () => clearTimeout(flashTimer.current)
  }, [])

  const effectiveLevel = level ?? startingLevelForAge(age)

  // Snapshot only while questions are on screen. 'loading' and 'evaluating' are in-flight and
  // 'result' is already saved server-side, so none of them is a state worth coming back to.
  useEffect(() => {
    if (!ANSWERING_STEPS.includes(step)) return
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        savedAt: Date.now(), childId: child?.id ?? null,
        step, mode, level, questions, correctAns, qTypes, topic, qIdx, userAnswers,
        answerFormats, curriculumTopics, templateProblems, llmHints, helpUsed,
        skippable: [...skippable], helpUsedQs: [...helpUsedQs],
      }))
    } catch { /* private mode or quota — the session simply will not survive a reload */ }
  }, [step, mode, level, questions, correctAns, qTypes, topic, qIdx, userAnswers,
      answerFormats, curriculumTopics, templateProblems, llmHints, helpUsed, skippable, helpUsedQs])

  // Reaching any of these means the session is over or was never started, and a snapshot left
  // behind would resume a session the child has already finished.
  useEffect(() => {
    if (step === 'welcome' || step === 'mode' || step === 'result') {
      try { sessionStorage.removeItem(SESSION_KEY) } catch { /* nothing to clean up */ }
    }
  }, [step])

  // What this session can actually pay. The two mode cards promised "+30 Gems" and
  // "+20 Gems", which stopped being true when the amount moved to the server: it pays the
  // parent's configured figure scaled by how the child did, and the mode no longer changes
  // it at all. Reading the same setting the server reads keeps the promise honest — and it
  // is a maximum, because accuracy scales it.
  const maxGems = Number.isFinite(child?.task_settings?.math?.gems)
    ? Math.max(0, Math.trunc(child.task_settings.math.gems))
    : 30

  const startLoading = async (selectedMode) => {
    setMode(selectedMode)
    setHelpUsedQs(new Set())

    const entry = prefetch.current
    // Consumed either way: a session is played once, and a second run must build its own.
    prefetch.current = null

    if (entry?.result) { adoptSession(entry.result, selectedMode); return }

    setStep('loading')
    const built = entry?.promise
      ? await entry.promise
      : await buildSession(effectiveLevel, weighting).catch(e => { console.error('buildSession:', e); return null })
    if (!built) { setStep('mode'); return }
    adoptSession(built, selectedMode)
  }

  // ── Screen mode: submit one answer ───────────────────────────────────────
  const submitScreenAnswer = () => {
    if (!input || flash) return
    const isCorrect  = sameAnswer(input, correctAns[qIdx])
    const newAnswers = [...userAnswers, Number(String(input).trim())]

    const tProblem = templateProblems[qIdx]
    const canHelp = hasRealHelp(questions[qIdx] || '', qTypes[qIdx], tProblem?.topic, tProblem?.hint_steps ?? llmHints[qIdx], tProblem?.visual)
    if (!isCorrect && Number(age) <= 8 && canHelp) {
      setHelpVisible(true)
      setHelpUsed(true)
      // Help does not end the question — the child tries again — so under nine a wrong answer
      // was unreachable: the same question came back until it was right, and every session
      // finished at 100%. That is a loop for the child and a broken signal for everything
      // downstream, because the levelling rule only ever saw a perfect score. Once help has
      // been shown, moving on becomes possible.
      setSkippable(prev => { const next = new Set(prev); next.add(qIdx); return next })
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

  // Moving on without getting it right. Recorded as WRONG, deliberately: a question the child
  // could not answer is not a question they answered, and the whole point is that the score
  // starts telling the truth again.
  const skipScreenQuestion = () => {
    if (flash) return
    setHelpVisible(false)
    setInput('')
    const newAnswers = [...userAnswers, null]
    setFlash({ correct: false, answer: correctAns[qIdx], skipped: true })
    flashTimer.current = setTimeout(() => {
      setFlash(null)
      setUserAnswers(newAnswers)
      if (qIdx + 1 >= questions.length) doScreenEval(newAnswers)
      else { setQIdx(i => i + 1); setHintOpenFor(null) }
    }, 900)
  }

  // ── Screen mode: evaluate locally ────────────────────────────────────────
  const doScreenEval = async (finalAnswers) => {
    setStep('evaluating')
    const numCorrect = finalAnswers.filter((a, i) => sameAnswer(a, correctAns[i])).length
    const accuracy   = Math.round((numCorrect / questions.length) * 100)

    const results = questions.map((q, i) => ({
      question: q, correct_answer: correctAns[i],
      child_answer: finalAnswers[i],
      correct: sameAnswer(finalAnswers[i], correctAns[i]),
    }))
    const evalData = {
      results, score: accuracy, accuracy, topic,
      encouragement: getScoreMsg(accuracy, age, language),
    }
    // Both the reward and the level come back from the server, so the screen shows what was
    // actually banked — including 0 once the daily cap is reached, rather than a number the
    // child never got — and only celebrates a level the child actually moved to.
    const saved = await saveResults(evalData)
    if (saved?.level_change === 'up') setLeveledUp(true)
    setEvalResult({ ...evalData, gems_earned: saved ? saved.gems_earned : null, level_change: saved?.level_change ?? 'same' })
    setStep('result')
  }

  // ── Paper mode: send photo to Gemini ─────────────────────────────────────
  const doPaperEval = async (file) => {
    setStep('evaluating')
    try {
      const result   = await evaluateMath([file], questions, correctAns, age, effectiveLevel, language)
      // The model echoes the questions back and the result list used to be built from that
      // echo, so a misread question was shown to the child as one they had been asked —
      // in testing, a photo of different sums produced a list of sums the app never set.
      // We know what was asked and what the answers were, so only the child's answer and
      // the mark are taken from the model, matched up by position.
      const marks = Array.isArray(result.results) ? result.results : []
      const pinned = questions.map((q, i) => ({
        question: q,
        correct_answer: correctAns[i],
        child_answer: marks[i]?.child_answer ?? '—',
        correct: marks[i]?.correct === true,
      }))
      const saved = await saveResults({ ...result, results: pinned })
      if (saved?.level_change === 'up') setLeveledUp(true)
      setEvalResult({ ...result, results: pinned, gems_earned: saved ? saved.gems_earned : null })
      setStep('result')
    } catch (e) {
      console.error('evaluateMath:', e)
      const fallback = {
        results: questions.map((q, i) => ({ question: q, correct_answer: correctAns[i], child_answer: '?', correct: false })),
        score: 70, accuracy: 70,
        topic, encouragement: "Great effort! Keep going! 🌟",
      }
      const saved = await saveResults(fallback)
      setEvalResult({ ...fallback, gems_earned: saved ? saved.gems_earned : null })
      setStep('result')
    }
  }

  // ── Persist to Supabase ───────────────────────────────────────────────────
  // The session is recorded by the server, which decides the reward: it is the only side
  // that can read the parent's configured amount, count what has already been earned today
  // against the daily cap, and tell the parent it happened. The browser used to do all of
  // this itself — picking the number and writing bt_ledger with the anon key — which meant
  // the parent's setting was never applied and nothing limited repeat sessions.
  // Returns the awarded amount so the result screen shows what was actually banked.
  const saveResults = async (evalData) => {
    if (!child?.id) return 0
    // Accuracy is counted from the marks that are actually shown, not from the figure the
    // model reported alongside them — otherwise a session can display "2 / 5 correct" and
    // record 80%, and the reward follows the number nobody saw.
    const numCorrect = (evalData.results || []).filter(r => r.correct).length
    const derivedAccuracy = questions.length ? Math.round((numCorrect / questions.length) * 100) : 0
    try {
      const res = await fetch(`${SERVER}/api/children/${child.id}/math-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // The level the child came IN on. The server decides where they end up — it can
          // see the sessions before this one, which is what dampening needs.
          level: effectiveLevel,
          // The topics actually covered. The server used to derive this from the level,
          // which was right while the level chose the subject — it no longer does, and a
          // session now spans several topics rather than drilling one. The parent's chat
          // agent reads this column to answer "what has she been working on", so it has to
          // say what really happened.
          topics: [...new Set(curriculumTopics.map(t => t?.name).filter(Boolean))],
          school_year: yearLabelForAge(age),
          // Every question, with the curriculum topic it came from and how it went. The
          // session row records one accuracy figure across eight topics, which cannot answer
          // "which topic is she weak at" or "what did she get wrong" — the two things a parent
          // actually asks. Sent per question so the server can keep the raw record.
          attempts: (evalData.results || []).map((r, i) => {
            const topic = curriculumTopics[i]
            if (!topic?.id) return null
            return {
              topic_id: topic.id,
              topic_name: topic.name ?? null,
              source: templateProblems[i] ? 'template' : 'llm',
              question: questions[i] ?? null,
              // Paper mode has no typed answer — the model read the page — so this is null
              // there rather than invented.
              child_answer: r?.child_answer == null ? null : String(r.child_answer),
              correct: !!r?.correct,
              help_used: helpUsedQs.has(i),
            }
          }).filter(Boolean),
          questions_total: questions.length,
          questions_correct: numCorrect,
          accuracy: derivedAccuracy,
          help_used: helpUsedQs.size,
          // Paper mode only — the model's read on how the work went, and what to try next.
          gemini_notes: evalData.gemini_notes || null,
          next_session: evalData.next_session || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'server error')
      return data
    } catch (e) {
      // null, not 0: a session that never reached the server is not the same as one that
      // legitimately earned nothing, and showing "+0 Gems" for it hides the loss from the
      // child — they answered five questions and no progress was recorded at all.
      console.error('saveResults:', e)
      return null
    }
  }

  // ── Shared container ──────────────────────────────────────────────────────
  const wrap = {
    background: FLOW_BG, minHeight: '100vh', maxWidth: isTablet ? 1180 : 430,
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
          {getWelcomeMsg(age, language)}
        </div>
        {/* The school year is deliberately not shown here. It is a curriculum label written for
            adults, and on a bad day it reads to a child as a verdict. The parent still sees it. */}
        <button
          className="math-press"
          onClick={() => setStep('mode')}
          style={{
            background: MATH, color: 'white', border: 'none', borderRadius: 20,
            padding: '17px 54px', fontFamily: FRED, fontSize: 20, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 10px 28px rgba(61,143,207,.42)', marginTop: 4,
          }}
        >{t('math_lets_go', language)}</button>
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
          {t('math_mode_title', language)}
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
          <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 21, color: INK }}>{t('math_on_paper', language)}</div>
          <div style={{
            alignSelf: 'flex-start', background: MATH, color: '#fff',
            borderRadius: 11, padding: '4px 13px', fontFamily: FRED, fontWeight: 600, fontSize: 13,
          }}>⭐ {t('math_up_to_gems', language)} {maxGems} {t('math_gems_word', language)}</div>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: INK_SOFT, lineHeight: 1.5, marginTop: 2 }}>
            {t('math_paper_desc', language)}
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
          <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 21, color: INK }}>{t('math_on_screen', language)}</div>
          <div style={{
            alignSelf: 'flex-start', background: GREEN, color: '#fff',
            borderRadius: 11, padding: '4px 13px', fontFamily: FRED, fontWeight: 600, fontSize: 13,
          }}>⭐ {t('math_up_to_gems', language)} {maxGems} {t('math_gems_word', language)}</div>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: INK_SOFT, lineHeight: 1.5, marginTop: 2 }}>
            {t('math_screen_desc', language)}
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
          {t(step === 'loading' ? 'math_preparing' : 'math_checking', language)}
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

  // Leaving throws away everything answered so far — the session is only saved at the end —
  // and the back arrow sits next to the progress bar where a thumb lands. Asked, not assumed.
  // Declared above both question screens because both render it: it used to sit between them,
  // so paper_questions read it before initialisation.
  const leaveSheet = confirmLeave ? (
    <div
      onClick={() => setConfirmLeave(false)}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20,16,40,.55)', zIndex: 60,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: '26px 26px 0 0', padding: '26px 22px 30px',
        width: '100%', maxWidth: 430, display: 'flex', flexDirection: 'column', gap: 10,
        animation: 'scaleIn .2s ease both',
      }}>
        <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 21, color: INK, textAlign: 'center' }}>
          {t('math_leave_title', language)}
        </div>
        <div style={{ fontFamily: FRED, fontWeight: 500, fontSize: 15, color: INK_SOFT, textAlign: 'center', lineHeight: 1.5 }}>
          {t('math_leave_body', language)}
        </div>
        <button className="math-press" onClick={() => setConfirmLeave(false)} style={{
          marginTop: 8, background: MATH, color: '#fff', border: 'none', borderRadius: 16,
          padding: '15px', fontFamily: FRED, fontSize: 17, fontWeight: 600, cursor: 'pointer',
        }}>{t('math_leave_stay', language)}</button>
        <button className="math-press" onClick={() => nav('/child/home')} style={{
          background: 'none', color: INK_SOFT, border: 'none', borderRadius: 16,
          padding: '11px', fontFamily: FRED, fontSize: 15.5, fontWeight: 600, cursor: 'pointer',
        }}>{t('math_leave_go', language)}</button>
      </div>
    </div>
  ) : null

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: paper_questions
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'paper_questions') return (
    <>
    {leaveSheet}
    <div style={{ ...wrap, overflow: 'hidden' }}>
      <style>{ANIM}</style>

      <div style={{ background: MATH, padding: '16px 22px 18px', borderRadius: '0 0 26px 26px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11, background: 'rgba(255,255,255,.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, color: '#fff', fontWeight: 800, cursor: 'pointer',
          }}
            onClick={() => setConfirmLeave(true)}
          >←</div>
          <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 21, color: '#fff' }}>{t('math_paper_title', language)}</div>
        </div>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,.85)', marginTop: 6, marginLeft: 45 }}>
          {t('math_paper_now', language)}
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
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: isWord ? 17 : 22, color: INK, lineHeight: 1.5 }}>
                  <MathText text={q} />
                </div>
                {/* Paper mode had no hints at all: the child on screen could ask for a nudge and
                    the child with a pencil could not, for the same question. Same first step,
                    same cost — it counts as help either way. */}
                {(() => {
                  const steps = templateProblems[i]?.hint_steps ?? llmHints[i]
                  if (!Array.isArray(steps) || !steps.length) return null
                  const open = hintOpenFor === i
                  return (
                    <div>
                      <button
                        className="math-press"
                        onClick={() => {
                          if (open) { setHintOpenFor(null); return }
                          setHintOpenFor(i)
                          setHelpUsedQs(prev => { const next = new Set(prev); next.add(i); return next })
                          setHelpUsed(true)
                        }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none',
                          background: open ? 'rgba(247,148,51,.16)' : 'rgba(60,120,200,.07)',
                          color: ORANGE, borderRadius: 999, padding: '5px 12px', cursor: 'pointer',
                          fontFamily: FRED, fontWeight: 600, fontSize: 13.5,
                        }}
                      >💡 {t('math_paper_hint', language)} <span style={{ fontSize: 11 }}>{open ? '▲' : '▼'}</span></button>
                      {open && (
                        <div style={{
                          marginTop: 6, background: 'rgba(60,120,200,.06)', borderRadius: 12,
                          padding: '9px 12px', fontFamily: FRED, fontWeight: 600, fontSize: 14,
                          color: INK_SOFT, lineHeight: 1.45,
                        }}>{steps[0]}</div>
                      )}
                    </div>
                  )
                })()}
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
          {t('math_paper_ready', language)}
        </button>
      </div>
    </div>
    </>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: screen_questions
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'screen_questions') {
    const q      = questions[qIdx] || ''
    const isWord = qTypes[qIdx] === 'word' || q.length > 35
    const pct    = (qIdx / questions.length) * 100
    const qVisual = templateProblems[qIdx]?.visual
    const questionShapes = qVisual?.kind === 'shapes' ? qVisual.shapes : null
    // Counting shows the objects themselves — the whole question is what is in front of
    // them, so a child who cannot yet read "How many do you see?" can still answer it.
    const questionCount = qVisual?.kind === 'count' ? qVisual : null

    return (
      <>
      {leaveSheet}
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
              {flash.correct ? t('math_yes', language) : `${t('math_almost', language)} ${flash.answer} 💪`}
            </div>
          </div>
        )}

        {/* Progress header */}
        <div style={{ background: MATH, padding: '16px 20px 18px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              onClick={() => helpVisible ? setHelpVisible(false) : setConfirmLeave(true)}
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
              templateTopic={templateProblems[qIdx]?.topic}
              hintSteps={templateProblems[qIdx]?.hint_steps ?? llmHints[qIdx]}
              visual={templateProblems[qIdx]?.visual}
              onDone={() => { setHelpVisible(false); setInput('') }}
              onHelpUsed={() => setHelpUsedQs(prev => { const next = new Set(prev); next.add(qIdx); return next })}
              language={language}
            />
          ) : (
            <>
              {/* Question card — a question can carry a picture (geometry shows the shape
                  rather than naming it), so the text sits under whatever it illustrates. */}
              <div key={qIdx} style={{
                background: 'white', borderRadius: 22, padding: '26px 24px', textAlign: 'center',
                boxShadow: '0 8px 28px rgba(60,120,200,.14)', animation: 'scaleIn 0.3s ease both',
                minHeight: isWord ? 120 : 84, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 14,
              }}>
                {questionShapes && (
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {questionShapes.map((s, i) => <ShapeSVG key={i} kind={s} size={96} />)}
                  </div>
                )}
                {questionCount && (
                  <div style={{ display: 'flex', gap: 9, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 300 }}>
                    {Array.from({ length: questionCount.n }).map((_, i) => (
                      <span key={i} style={{ fontSize: 34, lineHeight: 1 }}>{questionCount.item}</span>
                    ))}
                  </div>
                )}
                <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: isWord ? 18 : (questionShapes || questionCount ? 20 : 32), color: INK, lineHeight: 1.55 }}>
                  <MathText text={q} />
                </div>
              </div>

              {/* Optional hint — the child can ask BEFORE answering, which is the only way an
                  older child could get one at all: the help panel opens on a wrong answer and
                  only under nine. Just the first step, never the rest: a template's second step
                  counts out the numbers and would hand over the answer. */}
              {(() => {
                const steps = templateProblems[qIdx]?.hint_steps ?? llmHints[qIdx]
                if (!Array.isArray(steps) || !steps.length) return null
                const open = hintOpenFor === qIdx
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <button
                      className="math-press"
                      onClick={() => {
                        if (open) { setHintOpenFor(null); return }
                        setHintOpenFor(qIdx)
                        // Same cost as being shown help after a wrong answer — the server docks
                        // a third for either, so asking early is never the cheaper trick.
                        setHelpUsedQs(prev => { const next = new Set(prev); next.add(qIdx); return next })
                        setHelpUsed(true)
                      }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none',
                        background: open ? 'rgba(247,148,51,.16)' : 'rgba(255,255,255,.72)',
                        color: ORANGE, borderRadius: 999, padding: '8px 16px', cursor: 'pointer',
                        fontFamily: FRED, fontWeight: 600, fontSize: 15,
                        boxShadow: '0 3px 10px rgba(60,120,200,.08)', transition: 'background .16s',
                      }}
                    >
                      💡 {language === 'tr' ? 'İpucu' : 'Hint'} <span style={{ fontSize: 12 }}>{open ? '▲' : '▼'}</span>
                    </button>
                    {open && (
                      <div style={{
                        background: 'rgba(255,255,255,.9)', borderRadius: 16, padding: '13px 17px',
                        fontFamily: FRED, fontWeight: 600, fontSize: 15.5, color: INK_SOFT,
                        lineHeight: 1.5, textAlign: 'center', animation: 'scaleIn .22s ease both',
                      }}>{steps[0]}</div>
                    )}
                  </div>
                )
              })()}

              {skippable.has(qIdx) && !flash && (
                <button
                  className="math-press"
                  onClick={skipScreenQuestion}
                  style={{
                    alignSelf: 'center', border: 'none', background: 'rgba(255,255,255,.72)',
                    color: INK_SOFT, borderRadius: 999, padding: '9px 18px', cursor: 'pointer',
                    fontFamily: FRED, fontWeight: 600, fontSize: 15,
                    boxShadow: '0 3px 10px rgba(60,120,200,.08)',
                  }}
                >{language === 'tr' ? 'Bunu geç →' : 'Skip this one →'}</button>
              )}

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
                allowDecimal={answerFormats[qIdx] === 'decimal'}
              />
            </>
          )}
        </div>
      </div>
      </>
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
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 11, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '.6px' }}>{t('math_score', language)}</div>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 40, color: accuracy >= 80 ? GREEN : ORANGE, lineHeight: 1.05 }}>
                {accuracy}%
              </div>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: INK_SOFT, marginTop: 2 }}>{numCorrect} / {questions.length} {t('math_correct', language)}</div>
            </div>
            <div style={{ width: 1, height: 56, background: '#eee' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 11, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '.6px' }}>{t('math_earned', language)}</div>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 40, color: ORANGE, lineHeight: 1.05 }}>
                {evalResult.gems_earned == null ? '—' : `+${evalResult.gems_earned}`}
              </div>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: INK_SOFT, marginTop: 2 }}>
                {evalResult.gems_earned == null ? t('math_save_failed', language) : `${t('math_gems_word', language)} ⭐`}
              </div>
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
                {t('math_new_level', language)}
              </div>
            </div>
          )}

          {/* Per-question results */}
          {results.length > 0 && (
            <div>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 15, color: INK, margin: '2px 2px 8px' }}>
                {t('math_your_answers', language)}
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
                      <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 15, color: INK, lineHeight: 1.45 }}><MathText text={r.question} /></div>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: r.correct ? GREEN : INK_SOFT, marginTop: 3 }}>
                        {t('math_your_answer', language)} {r.child_answer ?? '—'}
                      </div>
                      {!r.correct && (
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: ORANGE, marginTop: 2 }}>
                          {t('math_answer_was', language)} {r.correct_answer} 💡
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
            {t('math_done', language)}! 🏠
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
