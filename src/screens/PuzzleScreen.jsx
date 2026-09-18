import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t, childLang } from '../lib/i18n'
import Shell, { useIsTablet } from '../components/Shell'
import { Figure, Prompt, CodeChip } from '../components/PuzzleView'
import { ensureIconFont } from '../lib/puzzleIcons'

// The child's shape & pattern puzzles (NVR). Ten questions from the child's age band, one at a
// time, each marked the moment it is answered.
//
// This screen never knows the answers. The server generates the sheet, sends the figures to draw
// with nothing that says which option is right, and checks each tap against the question it
// regenerates from its own seed (server/index.js, "Puzzle sessions"). So the score, the gems and
// the parent's message are all decided there; this only draws and asks.

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'

const INK = '#241f3a'
const INK_SOFT = '#8d83ad'
const PINK = '#e0668f'
const PINK_BG = '#FFE0EA'
const FRED = "'TrRound', 'Fredoka', 'Baloo 2', sans-serif"
const COLORS = { ok: '#3FBF7F', bad: '#E2586A', dim: INK_SOFT }

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

function BigButton({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        border: 'none', borderRadius: 18, padding: '14px 28px', cursor: disabled ? 'default' : 'pointer',
        background: disabled ? '#E6E1F2' : PINK, color: '#fff', fontFamily: FRED, fontWeight: 600,
        fontSize: 20, boxShadow: disabled ? 'none' : '0 5px 0 #b94d73', minWidth: 170,
      }}>{children}</button>
  )
}

function Card({ children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 24, padding: '20px 18px', boxShadow: '0 6px 16px rgba(40,30,70,.09)',
    }}>{children}</div>
  )
}

export default function PuzzleScreen() {
  const nav = useNavigate()
  const isTablet = useIsTablet()
  const [child] = useState(() => JSON.parse(localStorage.getItem('child') || 'null'))
  const lang = childLang(child)
  // One figure size for the whole card (see PuzzleView). 60 is the phone size the lab settled
  // on; a tablet has the room to draw them bigger, and the rule is only that they match.
  const px = isTablet ? 84 : 60

  const [phase, setPhase] = useState('loading')   // loading | intro | question | result | error
  const [session, setSession] = useState(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState([])       // per question: { chosen, correct, correct_index }
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState(null)
  const [answerFailed, setAnswerFailed] = useState(false)

  function fetchSession() {
    return iconFontWithin(4000).then(icons => post(`/api/children/${child.id}/puzzle-session`, { icons }))
  }
  function begin(s) {
    setSession(s)
    setIndex(0)
    setAnswers([])
    setResult(null)
    setPhase('intro')
  }
  function retry() {
    setPhase('loading')
    fetchSession().then(begin, () => setPhase('error'))
  }

  useEffect(() => {
    if (!child?.id) { nav('/child', { replace: true }); return }
    fetchSession().then(begin, () => setPhase('error'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function choose(i) {
    if (pending || answers[index]) return
    setPending(true)
    setAnswerFailed(false)
    try {
      const r = await post(`/api/puzzle-sessions/${session.session_id}/answer`, { question_index: index, chosen_index: i })
      setAnswers(prev => { const next = prev.slice(); next[index] = r; return next })
    } catch {
      setAnswerFailed(true)
    } finally {
      setPending(false)
    }
  }

  async function finish() {
    setPending(true)
    try {
      setResult(await post(`/api/puzzle-sessions/${session.session_id}/finish`))
      setPhase('result')
    } catch {
      setPhase('error')
    } finally {
      setPending(false)
    }
  }

  const q = session?.questions?.[index]
  const answer = answers[index]
  const total = session?.questions?.length ?? 0
  const last = index === total - 1

  return (
    <Shell background={PINK_BG}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '46px 18px 40px', fontFamily: "'Nunito', sans-serif" }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => nav('/child/home')} aria-label={t('puzzle_home', lang)}
            style={{
              width: 42, height: 42, borderRadius: 14, border: 'none', background: '#fff', cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(40,30,70,.12)', fontSize: 20, color: INK, flexShrink: 0,
            }}>←</button>
          <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 24, color: INK, flex: 1 }}>{t('puzzle_title', lang)}</div>
          {phase === 'question' && (
            <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 16, color: PINK }}>{index + 1}/{total}</div>
          )}
        </div>

        {phase === 'question' && (
          <div style={{ height: 8, borderRadius: 99, background: '#fff', marginBottom: 16, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${((index + (answer ? 1 : 0)) / total) * 100}%`,
              background: PINK, borderRadius: 99, transition: 'width .3s ease',
            }} />
          </div>
        )}

        {phase === 'loading' && (
          <Card><div style={{ textAlign: 'center', color: INK_SOFT, fontWeight: 700, padding: 20 }}>{t('puzzle_preparing', lang)}</div></Card>
        )}

        {phase === 'error' && (
          <Card>
            <div style={{ textAlign: 'center', color: INK, fontWeight: 700, padding: '8px 0 18px' }}>{t('puzzle_failed', lang)}</div>
            <div style={{ textAlign: 'center' }}><BigButton onClick={retry}>{t('puzzle_retry', lang)}</BigButton></div>
          </Card>
        )}

        {phase === 'intro' && session && (
          <Card>
            <div style={{ textAlign: 'center', padding: '6px 4px' }}>
              <div style={{ fontSize: 54, lineHeight: 1.1, marginBottom: 10 }}>🧩</div>
              <div style={{ color: INK, fontWeight: 700, fontSize: 17, lineHeight: 1.4, marginBottom: 14 }}>{t('puzzle_intro', lang)}</div>
              <div style={{
                display: 'inline-block', background: PINK_BG, borderRadius: 12, padding: '6px 14px', marginBottom: 20,
                fontFamily: FRED, fontWeight: 600, fontSize: 15, color: session.will_pay ? PINK : INK_SOFT,
              }}>
                {session.will_pay ? <>{t('puzzle_up_to', lang)} ⭐ {session.gems}</> : t('puzzle_no_gems', lang)}
              </div>
              <div><BigButton onClick={() => setPhase('question')}>{t('puzzle_start', lang)}</BigButton></div>
            </div>
          </Card>
        )}

        {phase === 'question' && q && (
          <Card>
            <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 21, color: INK, marginBottom: 14 }}>{t(q.stem_key, lang)}</div>

            <Prompt q={q} px={px} colors={COLORS} />

            {/* The options sit on their own panel. Drawn straight under the prompt in the same
                tiles, a run of five headphones and the five headphone options read as one block
                of ten, and nothing said where the question ended and the choice began. */}
            <div style={{
              display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8,
              background: '#FFF3F7', border: '2px dashed #F4C2D3', borderRadius: 18, padding: 12,
            }}>
              {q.options.map((o, i) => {
                const state = !answer ? null
                  : i === answer.correct_index ? 'ok'
                    : i === answer.chosen_index ? 'bad' : null
                return (
                  <button key={i} onClick={() => choose(i)} disabled={pending || !!answer}
                    style={{
                      background: 'none', border: 0, padding: 0, cursor: answer ? 'default' : 'pointer',
                      opacity: answer && !state ? 0.45 : 1, transition: 'opacity .2s ease',
                    }}>
                    {o.spec ? <Figure spec={o.spec} px={px} state={state} colors={COLORS} />
                      : <CodeChip code={o.code} state={state} px={px} colors={COLORS} />}
                  </button>
                )
              })}
            </div>

            {answerFailed && (
              <div style={{ marginTop: 14, color: COLORS.bad, fontWeight: 700 }}>{t('puzzle_failed', lang)}</div>
            )}

            {answer && (
              <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 19, color: answer.correct ? COLORS.ok : INK }}>
                  {answer.correct ? t('puzzle_right', lang) : t('puzzle_wrong', lang)}
                </div>
                <BigButton disabled={pending} onClick={() => (last ? finish() : setIndex(index + 1))}>
                  {last ? t('puzzle_see_score', lang) : t('puzzle_next', lang)}
                </BigButton>
              </div>
            )}
          </Card>
        )}

        {phase === 'result' && result && (
          <Card>
            <div style={{ textAlign: 'center', padding: '6px 4px' }}>
              <div style={{ fontSize: 54, lineHeight: 1.1, marginBottom: 8 }}>{result.capped ? '🌙' : '🎉'}</div>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 26, color: INK }}>{t('puzzle_well_done', lang)}</div>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 40, color: PINK, margin: '6px 0' }}>
                {result.correct}/{result.total} <span style={{ fontSize: 20, color: INK_SOFT }}>{t('puzzle_correct_of', lang)}</span>
              </div>
              {result.gems_earned > 0 ? (
                <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 22, color: '#f79433', marginBottom: 18 }}>
                  {t('math_earned', lang)} ⭐ {result.gems_earned}
                </div>
              ) : (
                <div style={{ color: INK_SOFT, fontWeight: 700, marginBottom: 18 }}>
                  {t('math_capped', lang)} — {t('math_come_back', lang)}
                </div>
              )}
              <BigButton onClick={() => nav('/child/home')}>{t('puzzle_home', lang)}</BigButton>
            </div>
          </Card>
        )}
      </div>
    </Shell>
  )
}
