import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n'
import TutoMascot from '../components/TutoMascot'
import { EnglishStem } from '../components/EnglishView'
import { EMOJI_ART } from '../lib/puzzleArt.generated'

// The child's English ladder sitting (docs/ENGLISH-SKILL-LADDERS.md): ten questions, one at a time, the step chosen
// by the ladder on the server from the child's own answers. The server deals each question and keeps its key
// (server/literacyLab.js); this screen shows the words and pictures and sends what was chosen. A reading text comes
// with its questions together and is answered as one. Everything here is English (user decision 2026-10-17).
// Gems come from the English card's setting and its daily limit, shared with word puzzles (server/index.js).

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'
const ROSE = '#D9577A'
const INK = '#241f3a'
const INK_SOFT = '#8d83ad'
const GREEN = '#4cb685'
const FRED = "'TrRound', 'Fredoka', 'Baloo 2', sans-serif"
const FLOW_BG = 'linear-gradient(172deg,#FFF1F4 0%,#FADBE3 100%)'
const CSS = `
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
.lt-press:active { transform: scale(.96) !important; }
.lt-scroll { overflow-y: auto; min-height: 0; }
.lt-scroll::-webkit-scrollbar { display: none; }
`

async function post(path, body) {
  const res = await fetch(`${SERVER}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  if (!res.ok) throw new Error(String(res.status))
  return res.json()
}

// Plays recordings one after another (a talk, then its question). One player for the screen: a new tap stops the old.
const player = { audio: null, token: 0 }
function play(urls) {
  const list = [].concat(urls || []).filter(Boolean)
  player.audio?.pause()
  const token = ++player.token
  const step = (i) => {
    if (i >= list.length || token !== player.token) return
    const a = new Audio(list[i])
    player.audio = a
    a.onended = () => step(i + 1)
    a.play().catch(() => {})       // blocked autoplay: the 🔊 button plays it on a tap
  }
  step(0)
}
const stopAudio = () => { player.token++; player.audio?.pause() }

const Picture = ({ emoji, size = 72 }) => (EMOJI_ART[emoji]
  ? <img src={EMOJI_ART[emoji]} alt="" draggable={false} style={{ width: size, height: size }} />
  : <span style={{ fontSize: size * 0.8 }}>{emoji}</span>)

// One question's answer area: options (words or pictures), or letter tiles for a word to build.
function Answer({ q, value, onChange, result }) {
  if (q.mode === 'build') {
    const used = value || []
    const word = used.map(id => q.letters.find(l => l.id === id).letter).join('')
    return (
      <div>
        <div aria-live="polite" style={{
          minHeight: 56, borderRadius: 16, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: FRED, fontSize: 30, letterSpacing: 6, color: result ? (result.correct ? GREEN : ROSE) : INK, marginBottom: 12,
        }}>{word || '…'}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {q.letters.map(l => (
            <button key={l.id} className="lt-press" disabled={!!result || used.includes(l.id)} onClick={() => onChange([...used, l.id])}
              style={{ width: 56, height: 56, borderRadius: 16, border: 'none', background: used.includes(l.id) ? 'rgba(255,255,255,.4)' : 'white',
                fontFamily: FRED, fontSize: 26, color: INK, boxShadow: '0 3px 10px rgba(40,30,70,.1)', cursor: 'pointer' }}>{l.letter}</button>
          ))}
        </div>
        {!result && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}>
            <button onClick={() => onChange(used.slice(0, -1))} disabled={!used.length} style={smallBtn}>Undo</button>
            <button onClick={() => onChange([])} disabled={!used.length} style={smallBtn}>Clear</button>
          </div>
        )}
        {result && !result.correct && <div style={{ textAlign: 'center', marginTop: 10, color: INK, fontWeight: 700 }}>It is <span style={{ color: GREEN }}>{result.key[0]}</span>.</div>}
      </div>
    )
  }
  const pictures = q.options.some(o => o.picture)
  const sounds = q.options.every(o => o.audio && !o.text && !o.picture)
  const need = q.pick || 1
  return (
    <div style={{ display: 'grid', gridTemplateColumns: pictures ? '1fr 1fr' : '1fr', gap: 10 }}>
      {q.options.map(o => {
        const chosen = (value || []).includes(o.id)
        const right = result && result.key.includes(o.id)
        const wrong = result && chosen && !right
        return (
          <button key={o.id} className="lt-press" disabled={!!result}
            onClick={() => { if (o.audio) play(o.audio); onChange(need === 1 ? [o.id] : chosen ? value.filter(x => x !== o.id) : [...(value || []), o.id].slice(-need)) }}
            style={{
              borderRadius: 18, padding: pictures ? '14px 8px' : '14px 16px', textAlign: pictures || sounds ? 'center' : 'left', cursor: 'pointer',
              background: right ? '#E4F6EC' : wrong ? '#FCE4EA' : 'white', fontSize: 17, color: INK, fontWeight: 600,
              border: `3px solid ${right ? GREEN : wrong ? ROSE : chosen ? ROSE : 'transparent'}`, boxShadow: '0 3px 10px rgba(40,30,70,.07)',
            }}>
            {o.picture ? <Picture emoji={o.picture.emoji} /> : sounds ? <>🔊 {q.options.indexOf(o) + 1}</> : o.text}
          </button>
        )
      })}
    </div>
  )
}
const smallBtn = { border: 'none', background: 'rgba(255,255,255,.85)', borderRadius: 12, padding: '8px 16px', fontWeight: 700, color: INK, cursor: 'pointer' }

export default function LiteracyScreen() {
  const nav = useNavigate()
  const [child] = useState(() => JSON.parse(localStorage.getItem('child') || 'null'))
  const [step, setStep] = useState('loading')       // loading | welcome | question | result | error
  const [sittingId, setSittingId] = useState(null)
  const [item, setItem] = useState(null)
  const [n, setN] = useState(0)
  const [of, setOf] = useState(10)
  const [values, setValues] = useState({})          // question id -> chosen ids (or tile ids)
  const [results, setResults] = useState(null)      // question id -> { correct, key, explain }
  const [busy, setBusy] = useState(false)
  const [score, setScore] = useState({ right: 0, answered: 0 })
  const [quote, setQuote] = useState(null)          // { gems, will_pay } from the first question
  const [paid, setPaid] = useState(null)            // { gems_earned, capped } at the end

  const load = (id, extra = {}) => post(`/api/children/${child.id}/literacy/next`, { sitting_id: id, ...extra })
  // Sound: unknown until the first listening question, then the child's answer for the rest of the sitting.
  // "I can't use sound now" is not a wrong answer: listening is skipped and stays unknown (rev. 3).
  const [audioOk, setAudioOk] = useState(null)
  const autoPlayed = useRef(null)
  function apply(r) {
    setBusy(false)
    setSittingId(r.sitting_id)
    setOf(r.of || 10)
    if (r.gems != null) setQuote({ gems: r.gems, will_pay: r.will_pay })
    if (r.done) { setPaid({ gems_earned: r.gems_earned || 0, capped: !!r.capped }); setStep('result'); return }
    setItem(r.item); setN(r.n); setValues({}); setResults(null)
    setStep(s => (s === 'loading' ? 'welcome' : 'question'))
  }
  const fail = () => { setBusy(false); setStep('error') }
  function next(id = sittingId, extra = {}) {
    stopAudio()
    setBusy(true)
    load(id, extra).then(apply, fail)
  }
  function noSound() {
    setAudioOk(false)
    next(sittingId, { no_audio: true, discard_item: item.id })
  }
  // A listening question plays itself once when it appears (if the browser allows it).
  useEffect(() => {
    if (step === 'question' && audioOk && item?.prompt?.listen && autoPlayed.current !== item.id) {
      autoPlayed.current = item.id
      play(item.prompt.audio)
    }
  }, [step, audioOk, item])

  useEffect(() => {
    if (!child?.id) { nav('/child', { replace: true }); return }
    load(null).then(apply, fail)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function send(skipped = false) {
    if (busy || results) return
    setBusy(true)
    try {
      const answers = item.questions.map(q => {
        const v = values[q.id] || []
        return { question_id: q.id, chosen: q.mode === 'build' ? v.map(id => q.letters.find(l => l.id === id).letter).join('') : v }
      })
      const r = await post(`/api/literacy-sittings/${sittingId}/answer`, { item_id: item.id, answers, skipped })
      const byId = Object.fromEntries(r.results.map(x => [x.question_id, x]))
      setResults(byId)
      setScore(s => ({ right: s.right + r.results.filter(x => x.correct).length, answered: s.answered + r.results.length }))
    } catch { setStep('error') } finally { setBusy(false) }
  }

  const ready = item && item.questions.every(q => {
    const v = values[q.id] || []
    return q.mode === 'build' ? v.length === q.letters.length : v.length === (q.pick || 1)
  })
  const wrap = { background: FLOW_BG, height: '100dvh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column', fontFamily: "'Nunito', sans-serif", overflow: 'hidden' }
  const primary = { background: ROSE, color: 'white', border: 'none', borderRadius: 20, padding: '15px 40px', fontFamily: FRED, fontSize: 19, fontWeight: 600, cursor: 'pointer', boxShadow: '0 10px 28px rgba(170,50,85,.3)' }
  const back = (
    <button onClick={() => nav('/child/home')} aria-label="Back" style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(255,255,255,0.85)', border: 'none', fontSize: 19, color: INK, fontWeight: 800, cursor: 'pointer', boxShadow: '0 3px 10px rgba(40,30,70,.1)' }}>←</button>
  )
  const center = (children) => (
    <div style={wrap}><style>{CSS}</style>
      <div style={{ padding: '42px 18px 0' }}>{back}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '0 26px 60px', textAlign: 'center' }}>{children}</div>
    </div>
  )

  if (step === 'loading') return center(<TutoMascot size={130} expression="thinking" color={ROSE} style={{ animation: 'float 2s ease-in-out infinite' }} />)
  if (step === 'error') return center(<>
    <TutoMascot size={120} expression="default" color={ROSE} />
    <div style={{ fontFamily: FRED, fontSize: 19, color: INK }}>Something went wrong.</div>
    <button className="lt-press" style={primary} onClick={() => { setStep('loading'); next(sittingId) }}>Try again</button>
  </>)
  if (step === 'welcome') return center(<>
    <TutoMascot size={140} expression="excited" color={ROSE} style={{ animation: 'float 3s ease-in-out infinite' }} />
    <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 21, color: INK, lineHeight: 1.5 }}>Ten questions in English. Some are easy, some are hard. That is fine!</div>
    {quote && (
      <div style={{ background: quote.will_pay ? ROSE : 'rgba(255,255,255,.8)', color: quote.will_pay ? '#fff' : INK_SOFT, borderRadius: 11, padding: '4px 13px', fontFamily: FRED, fontWeight: 600, fontSize: 13 }}>
        {quote.will_pay ? <>⭐ {t('math_up_to_gems', 'en')} {quote.gems} {t('math_gems_word', 'en')}</> : <>🌙 {t('puzzle_no_gems', 'en')}</>}
      </div>
    )}
    <button className="lt-press" style={primary} onClick={() => setStep('question')}>{t('math_lets_go', 'en')}</button>
  </>)
  if (step === 'result') return center(<>
    <TutoMascot size={130} expression="proud" color={ROSE} style={{ animation: 'float 3s ease-in-out infinite' }} />
    <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 22, color: INK }}>All done!</div>
    <div style={{ background: 'white', borderRadius: 20, padding: '14px 26px', fontFamily: FRED, fontSize: 19, color: INK }}>
      {score.right} of {score.answered} right
    </div>
    {paid && (paid.gems_earned > 0
      ? <div style={{ fontFamily: FRED, fontSize: 22, color: ROSE, fontWeight: 600 }}>+{paid.gems_earned} ⭐</div>
      : paid.capped ? <div style={{ fontSize: 15, color: INK_SOFT }}>🌙 {t('puzzle_no_gems', 'en')}</div> : null)}
    <button className="lt-press" style={primary} onClick={() => nav('/child/home')}>Done</button>
  </>)

  // ── sound check, before the first listening question ──
  if (item?.prompt?.listen && audioOk === null) return center(<>
    <TutoMascot size={120} expression="excited" color={ROSE} />
    <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 21, color: INK }}>Now some listening!</div>
    <button className="lt-press" onClick={() => play(item.prompt.instruction_audio || item.prompt.audio[0])} style={{ ...primary, background: 'white', color: ROSE }}>🔊 Play a sound</button>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 300 }}>
      <button className="lt-press" onClick={() => { stopAudio(); setAudioOk(true) }} style={primary}>I can hear it</button>
      <button className="lt-press" onClick={noSound} disabled={busy} style={{ ...smallBtn, padding: '14px 18px', fontSize: 16 }}>I can't use sound now</button>
    </div>
  </>)

  // ── question ──
  const p = item.prompt || {}
  const vrItem = p.stem_key ? { type: p.type, prompt: p.vr, pick: p.pick } : null
  const allRight = results && Object.values(results).every(r => r.correct)
  return (
    <div style={wrap}><style>{CSS}</style>
      <div style={{ padding: '42px 18px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {back}
        <div style={{ flex: 1, height: 10, borderRadius: 6, background: 'rgba(255,255,255,.7)' }}>
          <div style={{ width: `${(n / of) * 100}%`, height: '100%', borderRadius: 6, background: ROSE }} />
        </div>
        <span style={{ fontFamily: FRED, color: INK_SOFT, fontSize: 15 }}>{n}/{of}</span>
      </div>
      <div className="lt-scroll" style={{ flex: 1, padding: '6px 18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {item.passage && (
          <div style={{ background: 'white', borderRadius: 20, padding: '16px 18px', boxShadow: '0 4px 14px rgba(40,30,70,.06)' }}>
            {item.passage.title && <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 18, color: INK, marginBottom: 6 }}>{item.passage.title}</div>}
            <div style={{ fontSize: 17, lineHeight: 1.6, color: INK }}>{item.passage.text}</div>
          </div>
        )}
        <div style={{ fontFamily: FRED, fontSize: 19, color: INK, lineHeight: 1.45 }}>
          {p.listen ? (
            <div style={{ textAlign: 'center' }}>
              {p.instruction && <div style={{ fontSize: 15, color: INK_SOFT, marginBottom: 6 }}>{p.instruction}</div>}
              <button className="lt-press" onClick={() => play(p.audio)} style={{ ...primary, padding: '18px 34px', fontSize: 22 }}>🔊 Listen</button>
              <div style={{ fontSize: 14, color: INK_SOFT, marginTop: 8 }}>Tap to hear it again.</div>
            </div>
          ) : vrItem ? <>{t(p.stem_key, 'en')}<div style={{ marginTop: 8 }}><EnglishStem item={vrItem} lang="en" /></div></>
            : <>
              {p.instruction && <div style={{ fontSize: 15, color: INK_SOFT, marginBottom: 6 }}>{p.instruction}</div>}
              {p.picture && <div style={{ textAlign: 'center' }}><Picture emoji={p.picture.emoji} size={110} /></div>}
              {p.context && <div style={{ fontSize: 17, marginBottom: 6 }}>{p.context}</div>}
              {p.text && <div style={{ fontSize: p.instruction ? 30 : 19, textAlign: p.instruction ? 'center' : 'left' }}>{p.text}</div>}
              {p.stem && <div style={{ fontSize: 20, marginTop: 6, letterSpacing: 1 }}>{p.stem}</div>}
              {p.ask && <div style={{ fontSize: 17, marginTop: 8 }}>{p.ask}</div>}
            </>}
        </div>
        {item.questions.map(q => (
          <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {q.stem && <div style={{ fontWeight: 700, fontSize: 17, color: INK }}>{q.stem}</div>}
            <Answer q={q} value={values[q.id]} onChange={v => setValues(s => ({ ...s, [q.id]: v }))} result={results?.[q.id]} />
          </div>
        ))}
        {results && !allRight && item.questions.some(q => results[q.id]?.explain && !results[q.id].correct && q.mode !== 'build') && (
          <div style={{ background: 'white', borderRadius: 16, padding: '12px 16px', fontSize: 15, color: INK }}>
            {item.questions.filter(q => results[q.id] && !results[q.id].correct && results[q.id].explain).map(q => (
              <div key={q.id}>✓ {results[q.id].explain}{results[q.id].explain_audio && <button onClick={() => play(results[q.id].explain_audio)} aria-label="Hear it" style={{ ...smallBtn, marginLeft: 8, padding: '4px 10px' }}>🔊</button>}</div>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: '10px 18px 26px', display: 'flex', gap: 10, justifyContent: 'center', flexShrink: 0 }}>
        {!results ? <>
          <button className="lt-press" onClick={() => send(true)} disabled={busy} style={{ ...smallBtn, padding: '14px 18px', fontSize: 15 }}>{t('rd_skip', 'en')}</button>
          <button className="lt-press" onClick={() => send(false)} disabled={!ready || busy} style={{ ...primary, opacity: ready ? 1 : 0.5 }}>Send</button>
        </> : (
          <button className="lt-press" onClick={() => next()} disabled={busy} style={{ ...primary, background: allRight ? GREEN : ROSE }}>
            {allRight ? 'Great! Next' : 'Next'}
          </button>
        )}
      </div>
    </div>
  )
}
