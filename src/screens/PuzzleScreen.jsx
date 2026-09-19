import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t, childLang } from '../lib/i18n'
import TutoMascot from '../components/TutoMascot'
import { useIsTablet } from '../components/Shell'
import { Figure, Prompt, CodeChip } from '../components/PuzzleView'
import { ensureIconFont } from '../lib/puzzleIcons'

// The child's shape & pattern puzzles (NVR). Ten questions from the child's age band, one at a
// time, each marked the moment it is answered.
//
// This screen never knows the answers. The server generates the sheet, sends the figures to draw
// with nothing that says which option is right, and checks each tap against the question it
// regenerates from its own seed (server/index.js, "Puzzle sessions"). So the score, the gems and
// the parent's message are all decided there; this only draws and asks.
//
// It is built the way MathScreen is — the same welcome with Tuto, the same coloured header with
// the progress bar, the same full-screen flash after an answer, the same leave sheet and result
// card, the same words where the meaning is the same (math_* keys). A child moving between the
// two should meet one app, not two; the first cut had its own look and its own vocabulary.

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'

const TEAL      = '#2BA59A'
const INK       = '#241f3a'
const INK_SOFT  = '#8d83ad'
const GREEN     = '#4cb685'
const ORANGE    = '#f79433'
const FRED      = "'TrRound', 'Fredoka', 'Baloo 2', sans-serif"
const FLOW_BG   = 'linear-gradient(172deg,#E8F8F6 0%,#CDEEEA 100%)'
const COLORS    = { ok: GREEN, bad: '#E2586A', dim: INK_SOFT }

const ANIM = `
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
@keyframes pop { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes flashIn { 0% { opacity: 0; } 15% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
@keyframes flashHold { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleIn { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
.pz-press:active { transform: scale(.96) !important; }
.pz-scroll { overflow-y: auto; min-height: 0; }
.pz-scroll::-webkit-scrollbar { display: none; }
`

// The icon font decides whether the sheet may contain icon questions, and the server has to be
// told before it builds the sheet. A font that has not arrived in a few seconds is treated as
// absent: the child gets a sheet of shapes and emoji rather than a spinner.
function iconFontWithin(ms) {
  return Promise.race([
    ensureIconFont().catch(() => false),
    new Promise(resolve => setTimeout(() => resolve(false), ms)),
  ])
}

async function post(path, body) {
  const res = await fetch(`${SERVER}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

// Where each of five options sits on a phone: the corners and the middle of a 3×3, as on a die.
const DICE_CELLS = [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]]

// What Tuto says over the result. Maths gets a line from the model; there is nothing here for a
// model to read, so it is chosen by score.
function encouragementKey(correct, total) {
  const acc = total ? correct / total : 0
  return total && correct === total ? 'puzzle_enc_perfect'
    : acc >= 0.8 ? 'puzzle_enc_high' : acc >= 0.5 ? 'puzzle_enc_mid' : 'puzzle_enc_low'
}

export default function PuzzleScreen() {
  const nav = useNavigate()
  const isTablet = useIsTablet()
  const [child] = useState(() => JSON.parse(localStorage.getItem('child') || 'null'))
  const language = childLang(child)
  // One figure size for the whole card (see PuzzleView). 60 is the phone size the lab settled
  // on; a tablet has the room to draw them bigger, and the rule is only that they match.
  const px = isTablet ? 84 : 60

  const [step, setStep] = useState('loading')   // loading | welcome | questions | finishing | result | error
  const [session, setSession] = useState(null)
  const [qIdx, setQIdx] = useState(0)
  const [answers, setAnswers] = useState([])      // per question: { correct, chosen_index, correct_index }
  const [pending, setPending] = useState(false)
  // The option the child has chosen and not yet sent. A tap used to BE the answer, and a child who
  // saw the mistake a moment later had no way back; now a tap selects, another tap moves it, and
  // the send button commits — the same pick-then-✓ that maths has on its keypad.
  const [picked, setPicked] = useState(null)
  const [answerFailed, setAnswerFailed] = useState(false)
  const [flash, setFlash] = useState(null)        // { correct, correct_index } while the overlay is up
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [result, setResult] = useState(null)
  const advanceTimer = useRef(null)

  const wrap = {
    background: FLOW_BG, minHeight: '100vh', maxWidth: isTablet ? 1180 : 430,
    margin: '0 auto', display: 'flex', flexDirection: 'column', fontFamily: "'Nunito', sans-serif",
  }
  const shell = { ...wrap, height: '100dvh', minHeight: 0, overflow: 'hidden' }

  function fetchSession() {
    return iconFontWithin(4000).then(icons => post(`/api/children/${child.id}/puzzle-session`, { icons }))
  }
  function begin(s) {
    setSession(s)
    setQIdx(0)
    setAnswers([])
    setResult(null)
    setStep('welcome')
  }
  function retry() {
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
      setResult(await post(`/api/puzzle-sessions/${session.session_id}/finish`))
      setStep('result')
    } catch {
      setStep('error')
    }
  }

  function advance() {
    clearTimeout(advanceTimer.current)
    setFlash(null)
    setPicked(null)
    if (qIdx >= total - 1) finish()
    else setQIdx(qIdx + 1)
  }

  function select(i) {
    if (pending || answers[qIdx]) return
    setPicked(i)
    setAnswerFailed(false)
  }

  async function send() {
    const i = picked
    if (i === null || pending || answers[qIdx]) return
    setPending(true)
    setAnswerFailed(false)
    try {
      const r = await post(`/api/puzzle-sessions/${session.session_id}/answer`, { question_index: qIdx, chosen_index: i })
      setAnswers(prev => { const next = prev.slice(); next[qIdx] = r; return next })
      setFlash({ correct: r.correct, correct_index: r.correct_index })
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
    background: TEAL, color: 'white', border: 'none', borderRadius: 20,
    padding: '17px 54px', fontFamily: FRED, fontSize: 20, fontWeight: 600,
    cursor: 'pointer', boxShadow: '0 10px 28px rgba(31,122,114,.38)',
  }

  // ── loading / finishing ────────────────────────────────────────────────────
  if (step === 'loading' || step === 'finishing') return (
    <div style={wrap}>
      <style>{ANIM}</style>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: 40 }}>
        <TutoMascot size={140} expression="thinking" color={TEAL} style={{ animation: 'float 2s ease-in-out infinite' }} />
        <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 20, color: INK, textAlign: 'center' }}>
          {t(step === 'loading' ? 'puzzle_preparing' : 'math_checking', language)}
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              width: 11, height: 11, borderRadius: '50%', background: TEAL, display: 'inline-block',
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
        <TutoMascot size={130} expression="default" color={TEAL} />
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
        <TutoMascot size={150} expression="excited" color={TEAL} style={{ animation: 'float 3s ease-in-out infinite' }} />
        <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 21, color: INK, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
          {t('puzzle_welcome', language)}
        </div>
        <div style={{
          background: session.will_pay ? TEAL : 'rgba(255,255,255,.8)', color: session.will_pay ? '#fff' : INK_SOFT,
          borderRadius: 11, padding: '4px 13px', fontFamily: FRED, fontWeight: 600, fontSize: 13,
        }}>
          {session.will_pay
            ? <>⭐ {t('math_up_to_gems', language)} {session.gems} {t('math_gems_word', language)}</>
            : <>🌙 {t('puzzle_no_gems', language)}</>}
        </div>
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
        <div style={{ background: TEAL, padding: '18px 24px 26px', borderRadius: '0 0 32px 32px', textAlign: 'center', flexShrink: 0 }}>
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

          {/* One row per puzzle, as maths lists its sums: what was asked, what the child picked,
              and the right one where they differ. A row of ticks said how many, not which — and
              a wrong answer is only worth something next to the figure that was right. */}
          <div style={{ animation: 'fadeUp 0.4s ease 0.08s both' }}>
            <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 16, color: INK, marginBottom: 10 }}>{t('math_your_answers', language)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {answers.map((a, i) => {
                const pq = session.questions[i]
                const mini = (o) => o && (o.spec ? <Figure spec={o.spec} px={34} colors={COLORS} />
                  : <CodeChip code={o.code} px={26} colors={COLORS} />)
                return (
                  <div key={i} style={{
                    background: 'white', borderRadius: 15, padding: '11px 15px',
                    display: 'flex', alignItems: 'flex-start', gap: 11,
                    boxShadow: '0 3px 12px rgba(31,122,114,.07)',
                    animation: `fadeUp 0.35s ease ${0.1 + i * 0.05}s both`,
                  }}>
                    <span style={{ fontSize: 19, flexShrink: 0, marginTop: 1 }}>{a?.correct ? '✅' : '🔄'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 15, color: INK, lineHeight: 1.45 }}>
                        {i + 1}. {t(pq.stem_key, language)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontWeight: 700, fontSize: 12.5, color: a?.correct ? GREEN : INK_SOFT }}>{t('math_your_answer', language)}</span>
                          {mini(pq.options[a?.chosen_index])}
                        </div>
                        {a && !a.correct && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ fontWeight: 700, fontSize: 12.5, color: ORANGE }}>{t('math_answer_was', language)}</span>
                            {mini(pq.options[a.correct_index])}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <button className="pz-press" onClick={() => nav('/child/home')} style={{
            background: TEAL, color: 'white', border: 'none', borderRadius: 18, padding: '16px 22px',
            fontFamily: FRED, fontSize: 18, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(31,122,114,.34)', marginTop: 4,
          }}>{t('math_done', language)}! 🏠</button>
        </div>
      </div>
    )
  }

  // ── questions ──────────────────────────────────────────────────────────────
  const q = session?.questions?.[qIdx]
  if (!q) return <div style={wrap}><style>{ANIM}</style></div>
  const answer = answers[qIdx]
  const dice = !isTablet && q.options.length === 5
  const pct = ((qIdx + (answer ? 1 : 0)) / total) * 100
  const rightOption = flash && q.options[flash.correct_index]

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
              marginTop: 8, background: TEAL, color: '#fff', border: 'none', borderRadius: 16,
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
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
            background: flash.correct ? 'rgba(76,182,133,.94)' : 'rgba(247,148,51,.94)',
            animation: flash.correct ? 'flashIn 1.4s ease both' : 'flashHold .22s ease both',
            padding: '0 26px', cursor: flash.correct ? 'default' : 'pointer',
          }}>
            <div style={{ fontSize: 78, animation: 'pop .35s ease both' }}>{flash.correct ? '⭐' : '💪'}</div>
            <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: flash.correct ? 30 : 22, color: 'white', textAlign: 'center', lineHeight: 1.45 }}>
              {flash.correct ? t('math_yes', language) : t('math_almost', language)}
            </div>
            {!flash.correct && rightOption && (
              <>
                <div style={{ animation: 'pop .35s ease .1s both' }}>
                  {rightOption.spec ? <Figure spec={rightOption.spec} px={px + 20} />
                    : <CodeChip code={rightOption.code} px={px + 20} />}
                </div>
                <div style={{ fontFamily: FRED, fontWeight: 600, marginTop: 8, fontSize: 15, color: 'white', opacity: .8 }}>
                  {language === 'tr' ? 'Devam etmek için dokun' : 'Tap to carry on'}
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ background: TEAL, padding: '16px 20px 18px', flexShrink: 0 }}>
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
            background: 'white', borderRadius: 22, padding: '22px 20px', boxShadow: '0 8px 28px rgba(31,122,114,.14)',
            animation: 'scaleIn 0.3s ease both', flexShrink: 0,
          }}>
            <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 21, color: INK, lineHeight: 1.4, marginBottom: 14 }}>
              {t(q.stem_key, language)}
            </div>
            <Prompt q={q} px={px} colors={COLORS} />
          </div>

          {/* The options are the keypad: under the question card, in their own place, each one
              a button. Five on a phone do not fit a row, and wrapping them four-and-one left the
              fifth alone under the rest like an afterthought; they are laid out as the five on a
              die instead. A tablet has the width for all five in a line. */}
          <div style={dice ? {
            display: 'grid', gridTemplateColumns: 'repeat(3, max-content)', gap: '4px 14px', justifyContent: 'center',
          } : { display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {q.options.map((o, i) => (
              <button key={i} className="pz-press" onClick={() => select(i)} disabled={pending || !!answer}
                style={{
                  ...(dice ? { gridRow: DICE_CELLS[i][0], gridColumn: DICE_CELLS[i][1] } : {}),
                  background: 'none', border: 0, padding: 0, cursor: answer ? 'default' : 'pointer', borderRadius: 14,
                  transition: 'transform .12s ease, opacity .12s ease, box-shadow .12s ease',
                  ...(picked === i
                    ? { transform: 'scale(1.08)', boxShadow: `0 0 0 4px ${TEAL}, 0 8px 20px rgba(31,122,114,.3)` }
                    : { opacity: pending ? 0.45 : 1, boxShadow: '0 4px 14px rgba(31,122,114,.12)' }),
                }}>
                {o.spec ? <Figure spec={o.spec} px={px} colors={COLORS} />
                  : <CodeChip code={o.code} px={px} colors={COLORS} />}
              </button>
            ))}
          </div>

          <button className="pz-press" onClick={send} disabled={picked === null || pending || !!answer} style={{
            ...primaryBtn, alignSelf: 'center', marginTop: 4,
            opacity: picked === null ? 0.4 : 1, cursor: picked === null ? 'default' : 'pointer',
            boxShadow: picked === null ? 'none' : primaryBtn.boxShadow, transition: 'opacity .15s ease',
          }}>{pending ? '…' : t('puzzle_send', language)}</button>

          {answerFailed && (
            <div style={{ background: '#FFF3E0', borderRadius: 18, padding: '14px 17px', display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ fontSize: 25 }}>😕</span>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: INK, lineHeight: 1.45 }}>{t('puzzle_failed', language)}</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
