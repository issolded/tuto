import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n'
import TutoMascot from '../components/TutoMascot'
import { useIsTablet } from '../components/Shell'
import { EnglishStem } from '../components/EnglishView'
import { useFeedbackHaptics } from '../lib/nativeShell'
import { preload, itemAudio, play, stop as stopAudio } from '../lib/literacyAudio'
import { ROSE, INK, INK_SOFT, GREEN, FRED, NUNITO, Picture, SoundButton, OptionFace, LiteracyReviewList } from '../components/LiteracyReview'
import { rightAnswer } from '../lib/literacyAnswer'

// The child's English ladder sitting (docs/ENGLISH-SKILL-LADDERS.md): ten questions, one at a time, the step chosen
// by the ladder on the server from the child's own answers. The server deals each question and keeps its key
// (server/literacyLab.js); this screen shows the words and pictures and sends what was chosen. A reading text comes
// with its questions together and is answered as one. Everything here is English (user decision 2026-10-17).
// Gems come from the English card's setting and its daily limit, shared with word puzzles (server/index.js).
//
// The shape is the VR sitting's (EnglishScreen): the rose header, the flash after an answer (a right one moves on,
// a wrong one holds with the answer and waits for a tap), the result card with every answer, then practice.
// While the flash is up the next question is already being fetched, and its recordings with it.

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'
const ORANGE = '#f79433'
const FLOW_BG = 'linear-gradient(172deg,#FFF1F4 0%,#FADBE3 100%)'
const CSS = `
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
@keyframes pop { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes flashIn { 0% { opacity: 0; } 15% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
@keyframes flashHold { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleIn { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes lt-bob { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }
@keyframes lt-spin { to { transform: rotate(360deg); } }
.lt-press:active { transform: scale(.96) !important; }
.lt-scroll { overflow-y: auto; min-height: 0; }
.lt-scroll::-webkit-scrollbar { display: none; }
.lt-feedback > * { flex-shrink: 0; }
`

async function post(path, body) {
  const res = await fetch(`${SERVER}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  if (!res.ok) throw new Error(String(res.status))
  return res.json()
}

const Spinner = ({ color = '#fff', size = 20 }) => (
  <span aria-label="Loading" style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', border: `3px solid ${color}`, borderRightColor: 'transparent', animation: 'lt-spin .7s linear infinite', verticalAlign: 'middle' }} />
)

// The steps a practice round would come from: one per step that had a miss, at most five (server/literacyLab.js).
const practiceCount = (log) => Math.min(5, new Set(log.filter(e => Object.values(e.results).some(r => !r.correct)).map(e => `${e.track}${e.step}`)).size)

function encouragementKey(right, total) {
  const acc = total ? right / total : 0
  return total && right === total ? 'english_enc_perfect' : acc >= 0.8 ? 'english_enc_high' : acc >= 0.5 ? 'english_enc_mid' : 'english_enc_low'
}

// One question's answer area: options (words, pictures or sounds), or letter tiles for a word to build.
function Answer({ q, value, onChange, result, big }) {
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
            onClick={() => { if (o.audio) play(o.audio, `opt:${o.id}`); onChange(need === 1 ? [o.id] : chosen ? value.filter(x => x !== o.id) : [...(value || []), o.id].slice(-need)) }}
            style={{
              borderRadius: 16, padding: pictures ? '14px 8px' : '13px 16px', textAlign: pictures || sounds ? 'center' : 'left', cursor: 'pointer',
              background: right ? '#e9f8f0' : wrong ? '#fdecee' : chosen ? '#fff0f3' : 'white',
              fontFamily: NUNITO, fontWeight: 800, fontSize: big ? 21 : 18, color: '#12131A', overflowWrap: 'anywhere',
              border: `3px solid ${right ? GREEN : wrong ? '#E2586A' : chosen ? '#e0607e' : '#DCD9EA'}`, boxShadow: '0 4px 12px rgba(120,40,70,.08)',
              transition: 'transform .12s ease, border-color .12s ease', transform: chosen && !result ? 'scale(1.02)' : undefined,
            }}>
            <OptionFace q={q} o={o} size={big ? 96 : 72} />
          </button>
        )
      })}
    </div>
  )
}
const smallBtn = { border: 'none', background: 'rgba(255,255,255,.85)', borderRadius: 12, padding: '8px 16px', fontFamily: FRED, fontWeight: 600, fontSize: 15, color: INK, cursor: 'pointer' }

export default function LiteracyScreen() {
  const nav = useNavigate()
  const isTablet = useIsTablet()
  const [child] = useState(() => JSON.parse(localStorage.getItem('child') || 'null'))
  const [step, setStep] = useState('loading')       // loading | welcome | question | result | error
  const [sittingId, setSittingId] = useState(null)
  const [item, setItem] = useState(null)
  const [n, setN] = useState(0)
  const [of, setOf] = useState(10)
  const [values, setValues] = useState({})          // question id -> chosen ids (or tile ids)
  const [results, setResults] = useState(null)      // question id -> { correct, key, explain }
  const [flash, setFlash] = useState(null)          // { correct, skipped } while the overlay is up
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState([])                // every answered item, for the result list
  const [quote, setQuote] = useState(null)          // { gems, will_pay } from the first question
  const [paid, setPaid] = useState(null)            // { gems_earned, capped } at the end
  const [practice, setPractice] = useState(false)   // a practice round: no gems, not evidence
  const [confirmLeave, setConfirmLeave] = useState(false)
  const prefetched = useRef(null)                   // the next question, asked for while the flash is up
  const advanceTimer = useRef(null)
  useFeedbackHaptics(flash, paid?.gems_earned)

  const load = (id, extra = {}) => post(`/api/children/${child.id}/literacy/next`, { sitting_id: id, ...extra })
  // Sound: unknown until the first listening question, then the child's answer for the rest of the sitting.
  // "I can't use sound now" is not a wrong answer: listening is skipped and stays unknown (rev. 3).
  const [audioOk, setAudioOk] = useState(null)
  function apply(r) {
    setBusy(false)
    setSittingId(r.sitting_id)
    setOf(r.of || 10)
    if (r.gems != null) setQuote({ gems: r.gems, will_pay: r.will_pay })
    if (r.done) { setPaid({ gems_earned: r.gems_earned || 0, capped: !!r.capped }); setStep('result'); return }
    preload(itemAudio(r.item))
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
  // After the flash: the question fetched while it was up, or (if that failed) fetched now.
  function advance() {
    clearTimeout(advanceTimer.current)
    setFlash(null)
    stopAudio()
    const p = prefetched.current
    prefetched.current = null
    setBusy(true)
    ;(p ? p.catch(() => load(sittingId)) : load(sittingId)).then(apply, fail)
  }

  useEffect(() => {
    if (!child?.id) { nav('/child', { replace: true }); return }
    load(null).then(apply, fail)
    return () => { clearTimeout(advanceTimer.current); stopAudio() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function send(skipped = false) {
    if (busy || results) return
    setBusy(true)
    stopAudio()
    try {
      const answers = item.questions.map(q => {
        const v = values[q.id] || []
        return { question_id: q.id, chosen: q.mode === 'build' ? v.map(id => q.letters.find(l => l.id === id).letter).join('') : v }
      })
      const r = await post(`/api/literacy-sittings/${sittingId}/answer`, { item_id: item.id, answers, skipped })
      const byId = Object.fromEntries(r.results.map(x => [x.question_id, x]))
      // The next question is asked for now, so it is there when the child is done looking at this one.
      prefetched.current = load(sittingId).then(nx => { if (!nx.done) preload(itemAudio(nx.item)); return nx })
      prefetched.current.catch(() => {})
      setResults(byId)
      setLog(l => [...l, { track: item.track, step: item.step, item, skipped,
        answers: Object.fromEntries(answers.map(a => [a.question_id, skipped ? null : a.chosen])), results: byId }])
      const allRight = r.results.every(x => x.correct)
      setFlash({ correct: allRight, skipped })
      if (allRight) advanceTimer.current = setTimeout(advance, 1400)
    } catch { setStep('error') } finally { setBusy(false) }
  }

  async function startPractice() {
    setStep('loading')
    setLog([])
    setPractice(true)
    try {
      const r = await post(`/api/literacy-sittings/${sittingId}/practice`)
      apply(r)
      if (!r.done) setStep('question')        // no welcome: the child just said yes to it
    } catch { fail() }
  }

  const ready = item && item.questions.every(q => {
    const v = values[q.id] || []
    return q.mode === 'build' ? v.length === q.letters.length : v.length === (q.pick || 1)
  })
  const wrap = { background: FLOW_BG, height: '100dvh', maxWidth: isTablet ? 760 : 430, margin: '0 auto', display: 'flex', flexDirection: 'column', fontFamily: NUNITO, overflow: 'hidden', position: 'relative' }
  const primary = { background: ROSE, color: 'white', border: 'none', borderRadius: 20, padding: '15px 44px', fontFamily: FRED, fontSize: 19, fontWeight: 600, cursor: 'pointer', boxShadow: '0 10px 28px rgba(170,50,85,.3)' }
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

  // ── result: the score, the gems, every answer, then practice (as maths and the VR sitting) ──
  if (step === 'result') {
    const total = log.reduce((s, e) => s + Object.keys(e.results).length, 0)
    const right = log.reduce((s, e) => s + Object.values(e.results).filter(r => r.correct).length, 0)
    const accuracy = total ? Math.round((right / total) * 100) : 0
    const toPractise = practice ? 0 : practiceCount(log)
    const done = (
      <button className="lt-press" onClick={() => nav('/child/home')} style={{ ...primary, borderRadius: 18, padding: '16px 22px', fontSize: 18, marginTop: 4 }}>{t('math_done', 'en')}! 🏠</button>
    )
    return (
      <div style={wrap}><style>{CSS}</style>
        <div style={{ background: ROSE, padding: '34px 24px 26px', borderRadius: '0 0 32px 32px', textAlign: 'center', flexShrink: 0 }}>
          <TutoMascot size={108} expression="proud" color="#fff" style={{ animation: 'float 3s ease-in-out infinite', display: 'inline-block' }} />
          <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 18, color: 'white', marginTop: 6, lineHeight: 1.5, padding: '0 8px' }}>
            {practice ? (total && right === total ? 'Every one! Practice makes perfect 💪' : 'Good practice! 💪') : t(encouragementKey(right, total), 'en')}
          </div>
        </div>
        <div className="lt-scroll" style={{ flex: 1, padding: '16px 18px 26px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ background: 'white', borderRadius: 22, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 16px rgba(0,0,0,.05)', animation: 'fadeUp 0.4s ease both' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 11, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '.6px' }}>{t('math_score', 'en')}</div>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 40, color: accuracy >= 80 ? GREEN : ORANGE, lineHeight: 1.05 }}>{accuracy}%</div>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: INK_SOFT, marginTop: 2 }}>{right} / {total} {t('math_correct', 'en')}</div>
            </div>
            {!practice && paid && <>
              <div style={{ width: 1, height: 56, background: '#eee' }} />
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 11, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '.6px' }}>
                  {paid.capped ? t('math_capped', 'en') : t('math_earned', 'en')}
                </div>
                <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 40, color: ORANGE, lineHeight: 1.05 }}>{paid.capped ? '🌙' : `+${paid.gems_earned}`}</div>
                <div style={{ fontWeight: 700, fontSize: 12.5, color: INK_SOFT, marginTop: 2 }}>{paid.capped ? t('math_come_back', 'en') : `${t('math_gems_word', 'en')} ⭐`}</div>
              </div>
            </>}
          </div>

          {toPractise > 0 && (
            <div style={{ background: 'white', borderRadius: 22, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 4px 16px rgba(0,0,0,.05)', animation: 'fadeUp 0.4s ease 0.12s both' }}>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 16.5, color: INK, lineHeight: 1.4, textAlign: 'center' }}>
                Let's practise the tricky ones — {toPractise} new {toPractise === 1 ? 'question' : 'questions'}.
              </div>
              <div style={{ textAlign: 'center', fontFamily: FRED, fontWeight: 600, fontSize: 14, color: INK_SOFT }}>No gems this time, but it makes you stronger 💪</div>
              <button className="lt-press" onClick={startPractice} style={{ ...primary, borderRadius: 16, padding: '14px 20px', fontSize: 18, width: '100%' }}>Practise ({toPractise})</button>
              <button className="lt-press" onClick={() => nav('/child/home')} style={{ background: 'none', border: 'none', color: INK_SOFT, fontFamily: FRED, fontWeight: 600, fontSize: 15, padding: 8, cursor: 'pointer' }}>Not now</button>
            </div>
          )}

          {log.length > 0 && (
            <div style={{ animation: 'fadeUp 0.4s ease 0.08s both' }}>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 16, color: INK, marginBottom: 10 }}>{t('math_your_answers', 'en')}</div>
              <LiteracyReviewList entries={log} />
            </div>
          )}
          {toPractise === 0 && done}
        </div>
      </div>
    )
  }

  // ── sound check, before the first listening question ──
  if (item?.prompt?.listen && audioOk === null) return center(<>
    <TutoMascot size={120} expression="excited" color={ROSE} />
    <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 21, color: INK }}>Now some listening!</div>
    <SoundButton urls={item.prompt.instruction_audio || item.prompt.audio[0]} playKey="check" label="Play a sound" size="lg" tone="white" />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 300 }}>
      <button className="lt-press" onClick={() => { stopAudio(); setAudioOk(true) }} style={primary}>I can hear it</button>
      <button className="lt-press" onClick={noSound} disabled={busy} style={{ ...smallBtn, padding: '14px 18px', fontSize: 16 }}>I can't use sound now</button>
    </div>
  </>)

  // ── question ──
  const p = item.prompt || {}
  const vrItem = p.stem_key ? { type: p.type, prompt: p.vr, pick: p.pick } : null
  const missed = results ? item.questions.filter(q => results[q.id] && !results[q.id].correct) : []
  const pct = ((n - (results ? 0 : 1)) / of) * 100
  return (
    <>
      {confirmLeave && (
        <div onClick={() => setConfirmLeave(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,40,.55)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '26px 26px 0 0', padding: '26px 22px 30px', width: '100%', maxWidth: 430, display: 'flex', flexDirection: 'column', gap: 10, animation: 'scaleIn .2s ease both' }}>
            <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 21, color: INK, textAlign: 'center' }}>{t('math_leave_title', 'en')}</div>
            <div style={{ fontFamily: FRED, fontWeight: 500, fontSize: 15, color: INK_SOFT, textAlign: 'center', lineHeight: 1.5 }}>{t('math_leave_body', 'en')}</div>
            <button className="lt-press" onClick={() => setConfirmLeave(false)} style={{ marginTop: 8, background: ROSE, color: '#fff', border: 'none', borderRadius: 16, padding: 15, fontFamily: FRED, fontSize: 17, fontWeight: 600, cursor: 'pointer' }}>{t('math_leave_stay', 'en')}</button>
            <button className="lt-press" onClick={() => nav('/child/home')} style={{ background: 'none', color: INK_SOFT, border: 'none', padding: 11, fontFamily: FRED, fontSize: 15.5, fontWeight: 600, cursor: 'pointer' }}>{t('math_leave_go', 'en')}</button>
          </div>
        </div>
      )}

      <div style={wrap}><style>{CSS}</style>
        {/* The flash maths and the VR sitting give an answer. A right one moves on by itself; a wrong one holds,
            shows the right answer (and, for a listen, the button to hear it again) and waits for a tap. */}
        {flash && (
          <div onClick={() => { if (!flash.correct) advance() }} style={{
            position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto',
            background: flash.correct ? 'rgba(76,182,133,.94)' : 'rgba(247,148,51,.94)',
            animation: flash.correct ? 'flashIn 1.4s ease both' : 'flashHold .22s ease both',
            padding: '24px 26px', cursor: flash.correct ? 'default' : 'pointer',
          }}>
            <div className="lt-feedback" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <div style={{ fontSize: 78, animation: 'pop .35s ease both' }}>{flash.correct ? '⭐' : '💪'}</div>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: flash.correct ? 30 : 22, color: 'white', textAlign: 'center', lineHeight: 1.45 }}>
                {flash.correct ? t('math_yes', 'en') : flash.skipped ? 'No problem!' : t('math_not_this', 'en')}
              </div>
              {!flash.correct && missed.map(q => {
                const ans = rightAnswer(q, results[q.id])
                return (
                  <div key={q.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, maxWidth: 440, animation: 'pop .35s ease .1s both' }}>
                    {item.questions.length > 1 && q.stem && <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 17, color: 'white', textAlign: 'center', opacity: .95 }}>{q.stem}</div>}
                    <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 18, color: 'white', opacity: .92 }}>{t('math_answer_is', 'en')}</div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {(ans.pictures || []).map(e => <span key={e} style={{ background: '#fff', borderRadius: 18, padding: 8, display: 'inline-flex' }}><Picture emoji={e} size={80} /></span>)}
                      {ans.text && <span style={{ background: '#fff', color: INK, borderRadius: 16, padding: '12px 20px', fontFamily: NUNITO, fontWeight: 800, fontSize: 22, textAlign: 'center' }}>{ans.text}</span>}
                      {ans.audio && <SoundButton urls={ans.audio} playKey={`explain:${q.id}`} label="Hear it" size="sm" tone="white" />}
                    </div>
                    {ans.extra && <div style={{ background: 'rgba(255,255,255,.2)', borderRadius: 16, padding: '12px 16px', fontFamily: FRED, fontWeight: 600, fontSize: 16, color: 'white', textAlign: 'center', lineHeight: 1.45 }}>{ans.extra}</div>}
                  </div>
                )
              })}
              {!flash.correct && p.listen && (
                <SoundButton urls={p.audio} playKey="again" label="Listen again" playingLabel="Listening…" size="md" tone="white" />
              )}
              {!flash.correct && (
                <div style={{ fontFamily: FRED, fontWeight: 600, marginTop: 8, fontSize: 15, color: 'white', opacity: .8 }}>Tap to carry on</div>
              )}
            </div>
          </div>
        )}

        <div style={{ background: ROSE, padding: '40px 20px 18px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setConfirmLeave(true)} aria-label="Back" style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(255,255,255,.22)', border: 'none', fontSize: 17, color: '#fff', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>←</button>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.32)', borderRadius: 8, height: 10, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'white', borderRadius: 8, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 15, color: 'rgba(255,255,255,.95)', flexShrink: 0 }}>{practice ? '💪 ' : ''}{n} / {of}</div>
          </div>
        </div>

        <div className="lt-scroll" style={{ flex: 1, padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {item.passage && (
            <div style={{ background: 'white', borderRadius: 20, padding: '16px 18px', boxShadow: '0 4px 14px rgba(40,30,70,.06)' }}>
              {item.passage.title && <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 18, color: INK, marginBottom: 6 }}>{item.passage.title}</div>}
              <div style={{ fontFamily: NUNITO, fontWeight: 600, fontSize: isTablet ? 19 : 17, lineHeight: 1.6, color: INK }}>{item.passage.text}</div>
            </div>
          )}
          <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 19, color: INK, lineHeight: 1.45 }}>
            {p.listen ? (
              // Nothing plays until the child taps: the ring then shows how much of the recording is left.
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <SoundButton urls={p.audio} playKey="listen" label="Listen" playingLabel="Listening…" size="lg" />
                <div style={{ fontSize: 14, color: INK_SOFT, marginTop: 10 }}>Tap to hear it. You can hear it again.</div>
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
              {q.stem && <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 18, color: INK }}>{q.stem}</div>}
              <Answer q={q} value={values[q.id]} onChange={v => setValues(s => ({ ...s, [q.id]: v }))} result={results?.[q.id]} big={isTablet} />
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 18px 26px', display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
          {!results ? <>
            <button className="lt-press" onClick={() => send(true)} disabled={busy} style={{ ...smallBtn, padding: '14px 18px' }}>{t('rd_skip', 'en')}</button>
            <button className="lt-press" onClick={() => send(false)} disabled={!ready || busy} style={{ ...primary, minWidth: 140, opacity: ready || busy ? 1 : 0.45 }}>
              {busy ? <Spinner /> : t('puzzle_send', 'en')}
            </button>
          </> : busy ? <Spinner color={ROSE} size={28} /> : null}
        </div>
      </div>
    </>
  )
}
