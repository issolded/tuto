import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t, say } from '../lib/i18n'
import TutoMascot from '../components/TutoMascot'
import { useIsTablet } from '../components/Shell'
import DATA from '../lib/literacy/readingPreview.generated.json'

const DECISIONS_KEY = 'tuto_reading_decisions_v1'

// Preview of a reading-comprehension sitting (ladder level E) inside the child's English screen.
// A design preview, not the product: the passages are candidates from scripts/english-passages that
// passed the automatic checks and have NOT been approved by a person, and the answer keys are in this
// file. The real screen would get the sheet from the server and never see a key (EnglishScreen contract).
//
// What it is meant to show:
// - everything on screen inside the English section is English: story, questions, hints, and also the
//   controls and feedback (Send, I don't know, Correct, Tap to carry on) — user decision 2026-10-17,
//   replacing 2026-10-16's "controls in the child's language". The say()/t() calls stay so the strings
//   are the app's usual ones; they are asked for in English.
// - a worked example the first time, with no points
// - the story stays in reach while answering: looking back is reading, not cheating
// - one try, then help (7+): a first wrong pick is struck out; a second, or a wrong after a hint,
//   shows the right answer with the sentence that proves it, lit up in the story
// - the result separates "on your own" from "with help"

const ROSE = '#D9577A'
const INK = '#241f3a'
const INK_SOFT = '#8d83ad'
const GREEN = '#4cb685'
const ORANGE = '#f79433'
const FRED = "'TrRound', 'Fredoka', 'Baloo 2', sans-serif"
const READ = "'Nunito', sans-serif"
const FLOW_BG = 'linear-gradient(172deg,#FFF1F4 0%,#FADBE3 100%)'

const ANIM = `
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
@keyframes pop { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes flashIn { 0% { opacity: 0; } 15% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
@keyframes flashHold { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleIn { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes glow { from { background: rgba(255, 214, 102, 0); } to { background: rgba(255, 214, 102, .85); } }
.pz-press:active { transform: scale(.96) !important; }
.pz-scroll { overflow-y: auto; min-height: 0; }
.pz-scroll::-webkit-scrollbar { display: none; }
`

// The example shown once before the first story: same shape, solved, no points.
const EXAMPLE = {
  title: 'Back Home',
  passage: 'Sam walks to the park with his ball. Then he stops and runs back home, because he forgot his hat. Now he can play in the sun.',
  stem: 'Why does Sam run back home?',
  options: ['His friend calls him', 'He forgot his hat', 'It starts to rain'],
  answer: 1,
  evidence: 'he stops and runs back home, because he forgot his hat',
}

// Hints are about where to look, never the answer. Level 2 crosses out a wrong option.
const HINT1 = {
  cause: 'Find the sentence that says WHY. Look for "because" or "so".',
  detail: 'Find the sentence in the story about this.',
  sequence: 'Find both things in the story. Which one comes first?',
}

// The sentence of the passage that holds the evidence, so it can be lit up whole.
function sentences(text) {
  return text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?]["”’]?)\s+(?=["“‘]?[A-Z])/)
}
const norm = s => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim()
function evidenceSentence(text, evidence) {
  const ev = norm(evidence || '')
  return sentences(text).findIndex(s => ev && (norm(s).includes(ev) || ev.includes(norm(s))))
}

function Story({ title, passage, lit, compact, big }) {
  const parts = sentences(passage)
  return (
    <div style={{
      background: '#fffdf8', borderRadius: 22, padding: compact ? '16px 18px' : '22px 22px 24px',
      boxShadow: '0 8px 28px rgba(170,50,85,.12)', border: '2px solid #f6e7d6',
    }}>
      <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: big ? 26 : compact ? 18 : 22, color: ROSE, marginBottom: 10 }}>📖 {title}</div>
      <div lang="en" style={{ fontFamily: READ, fontWeight: 600, fontSize: big ? 23 : compact ? 17 : 20, lineHeight: 1.75, color: INK }}>
        {parts.map((s, i) => (
          <span key={i} style={{
            borderRadius: 6, padding: i === lit ? '1px 2px' : 0, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone',
            // The end state is set directly too: a CSS animation does not run in a hidden tab.
            background: i === lit ? 'rgba(255, 214, 102, .85)' : undefined,
            animation: i === lit ? 'glow .5s ease' : undefined,
          }}>{s}{i < parts.length - 1 ? ' ' : ''}</span>
        ))}
      </div>
    </div>
  )
}

function Options({ options, states, onPick, disabled, big }) {
  const tone = {
    picked: { border: ROSE, background: '#fff0f3' },
    ok: { border: GREEN, background: '#e9f8f0' },
    struck: { border: '#DCD9EA', background: '#f6f5fa', opacity: 0.45, textDecoration: 'line-through' },
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {options.map((o, i) => {
        const st = tone[states[i]] || {}
        return (
          <button key={i} lang="en" className="pz-press" disabled={disabled || states[i] === 'struck'} onClick={() => onPick?.(i)} style={{
            textAlign: 'left', padding: big ? '17px 20px' : '14px 18px', borderRadius: 16, border: `3px solid ${st.border || '#DCD9EA'}`,
            background: st.background || '#fff', color: '#12131A', fontFamily: READ, fontWeight: 800, fontSize: big ? 21 : 18,
            lineHeight: 1.35, cursor: disabled ? 'default' : 'pointer', opacity: st.opacity, textDecoration: st.textDecoration,
            boxShadow: '0 4px 12px rgba(120,40,70,.08)', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{
              width: 30, height: 30, borderRadius: 10, flexShrink: 0, background: states[i] === 'picked' ? ROSE : states[i] === 'ok' ? GREEN : '#f1eef8',
              color: states[i] === 'picked' || states[i] === 'ok' ? '#fff' : INK_SOFT, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: FRED, fontWeight: 600, fontSize: 16,
            }}>{'ABC'[i]}</span>
            {o}
          </button>
        )
      })}
    </div>
  )
}

export default function EnglishReadingPreview() {
  const nav = useNavigate()
  const isTablet = useIsTablet()
  const stories = DATA.items
  // Reviewer decisions, kept in this browser and downloaded as JSON for the repo
  // (scripts/english-passages/decisions.json). Not the product's storage: a preview tool.
  const [decisions, setDecisions] = useState(() => { try { return JSON.parse(localStorage.getItem(DECISIONS_KEY) || '{}') } catch { return {} } })
  function decide(id, verdict) {
    const note = verdict === 'rejected' ? (window.prompt('Neden? (kısa not)') || '') : ''
    const next = { ...decisions, [id]: { verdict, note, at: new Date().toISOString() } }
    setDecisions(next)
    try { localStorage.setItem(DECISIONS_KEY, JSON.stringify(next)) } catch { /* private window: kept in memory only */ }
  }
  function download() {
    const blob = new Blob([JSON.stringify({ source: DATA.source || null, decisions }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'reading-decisions.json'; a.click()
  }
  const [storyIdx, setStoryIdx] = useState(0)
  const lang = 'en'                               // the English section speaks English, whatever the app language
  const [seenExample, setSeenExample] = useState(false)
  const [step, setStep] = useState('welcome')      // welcome | example | read | questions | result
  const [qIdx, setQIdx] = useState(0)
  const [picked, setPicked] = useState(null)
  const [struck, setStruck] = useState([])
  const [tries, setTries] = useState(0)
  const [hints, setHints] = useState(0)
  const [flash, setFlash] = useState(null)         // { correct, answer, evidence }
  const [results, setResults] = useState([])       // per question: 'own' | 'help' | 'wrong'
  const [storyOpen, setStoryOpen] = useState(false)
  const [exPicked, setExPicked] = useState(null)
  // After a wrong answer: the question stays, the right option green and its sentence lit in the story.
  const [reveal, setReveal] = useState(false)

  const story = stories[storyIdx]
  const total = story?.questions.length || 0
  const q = story?.questions[qIdx]
  const litNow = useMemo(() => {
    if (!story || !q) return -1
    if ((flash && !flash.correct) || reveal) return evidenceSentence(story.passage, q.evidence)
    if (hints >= 3) return evidenceSentence(story.passage, q.evidence)
    return -1
  }, [story, q, flash, hints, reveal])

  function restart(i = storyIdx) {
    setStoryIdx(i); setStep(seenExample ? 'read' : 'welcome'); setQIdx(0); setPicked(null); setStruck([])
    setTries(0); setHints(0); setFlash(null); setReveal(false); setResults([]); setStoryOpen(false)
  }

  function send() {
    if (picked == null) return
    if (picked === q.answer) {
      setResults(r => [...r, tries === 0 && hints === 0 ? 'own' : 'help'])
      setFlash({ correct: true })
      setTimeout(() => next(), 1300)
      return
    }
    // One try, then help: the first wrong pick is struck and the child goes again.
    if (tries === 0 && hints === 0) {
      setStruck(s => [...s, picked]); setPicked(null); setTries(1); setStoryOpen(true)
      return
    }
    setResults(r => [...r, 'wrong'])
    setFlash({ correct: false })
    setStoryOpen(true)
  }
  function skip() {
    setResults(r => [...r, 'wrong'])
    setFlash({ correct: false, skipped: true })
    setStoryOpen(true)
  }
  function hint() {
    const h = hints + 1
    setHints(h)
    if (h === 2) {
      const wrong = q.options.map((_, i) => i).filter(i => i !== q.answer && !struck.includes(i))
      if (wrong.length) setStruck(s => [...s, wrong[0]])
      if (picked === wrong[0]) setPicked(null)
    }
    if (h >= 2) setStoryOpen(true)
  }
  function next() {
    setFlash(null); setReveal(false); setPicked(null); setStruck([]); setTries(0); setHints(0); setStoryOpen(false)
    if (qIdx + 1 < total) setQIdx(qIdx + 1)
    else setStep('result')
  }

  const wrap = {
    background: FLOW_BG, minHeight: '100vh', maxWidth: isTablet ? 1180 : 430, margin: '0 auto',
    display: 'flex', flexDirection: 'column', fontFamily: READ, position: 'relative',
  }
  const shell = { ...wrap, height: 'calc(100dvh - 44px)', minHeight: 0, overflow: 'hidden' }
  const primaryBtn = {
    background: ROSE, color: 'white', border: 'none', borderRadius: 20, padding: '16px 46px',
    fontFamily: FRED, fontSize: 20, fontWeight: 600, cursor: 'pointer', boxShadow: '0 10px 28px rgba(170,50,85,.38)',
  }

  // A preview bar, not part of the child's screen: which story, which app language, what this is.
  const cur = stories[storyIdx]
  const dec = cur && decisions[cur.id]
  const nDone = stories.filter(x => decisions[x.id]).length
  const mark = v => v === 'approved' ? '✅ ' : v === 'rejected' ? '❌ ' : ''
  const small = (bg) => ({ border: 'none', borderRadius: 8, padding: '5px 10px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', background: bg, color: '#fff' })
  const bar = (
    <div style={{ background: '#241f3a', color: '#fff', minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', flexWrap: 'wrap', fontSize: 12.5 }}>
      <b style={{ fontWeight: 800, opacity: .85 }}>Önizleme · {nDone}/{stories.length} karar</b>
      <span style={{ flex: 1 }} />
      <select value={storyIdx} onChange={e => restart(Number(e.target.value))} style={{ borderRadius: 8, border: 'none', padding: '4px 6px', fontSize: 12.5, maxWidth: 220 }}>
        {stories.map((s, i) => <option key={s.id} value={i}>{mark(decisions[s.id]?.verdict)}{s.level ? s.level + ' · ' : ''}{s.title}</option>)}
      </select>
      {cur && <>
        <button onClick={() => decide(cur.id, 'approved')} style={small(dec?.verdict === 'approved' ? '#2e9b6a' : 'rgba(255,255,255,.18)')}>Onayla</button>
        <button onClick={() => decide(cur.id, 'rejected')} style={small(dec?.verdict === 'rejected' ? '#c4475f' : 'rgba(255,255,255,.18)')}>Reddet</button>
      </>}
      <button onClick={download} disabled={!nDone} style={{ ...small('rgba(255,255,255,.18)'), opacity: nDone ? 1 : .4 }}>⬇ JSON</button>
      {dec?.note && <span style={{ flexBasis: '100%', opacity: .8 }}>Not: {dec.note}</span>}
      {cur && <span style={{ flexBasis: '100%', opacity: .75 }}>
        Pedagoji denetçisi: {cur.reviewer === 'pro' ? 'pro' : 'yalnız flash (pro bekliyor)'}{cur.reviewNote ? ` · Claude: ${cur.reviewNote}` : ''}
      </span>}
    </div>
  )

  if (!story) return <div style={wrap}>{bar}<div style={{ padding: 30 }}>No passages exported.</div></div>

  // ── welcome ────────────────────────────────────────────────────────────────
  if (step === 'welcome') return (
    <>{bar}
      <div style={shell}>
        <style>{ANIM}</style>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 26px', gap: 20, textAlign: 'center' }}>
          <TutoMascot size={150} expression="excited" color={ROSE} style={{ animation: 'float 3s ease-in-out infinite' }} />
          <div lang="en" style={{ fontFamily: FRED, fontWeight: 600, fontSize: 22, color: INK, lineHeight: 1.5 }}>
            Let's read a short story!<br />Then answer {total} questions.
          </div>
          <div style={{ background: 'rgba(255,255,255,.8)', color: INK_SOFT, borderRadius: 11, padding: '4px 13px', fontFamily: FRED, fontWeight: 600, fontSize: 13 }}>
            📖 {story.passage.split(/\s+/).length} words · {total} questions
          </div>
          <button className="pz-press" onClick={() => setStep(seenExample ? 'read' : 'example')} style={primaryBtn}>{t('math_lets_go', lang)}</button>
        </div>
      </div>
    </>
  )

  // ── worked example (first time only, no points) ──────────────────────────────
  if (step === 'example') {
    const done = exPicked != null
    return (
      <>{bar}
        <div style={shell}>
          <style>{ANIM}</style>
          <div style={{ background: ROSE, padding: '14px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div lang="en" style={{ fontFamily: FRED, fontWeight: 600, fontSize: 18, color: '#fff', flex: 1 }}>How it works</div>
            <div style={{ background: 'rgba(255,255,255,.25)', color: '#fff', borderRadius: 10, padding: '3px 10px', fontFamily: FRED, fontWeight: 600, fontSize: 13 }}>
              {say(lang, 'Example · no points', 'Örnek · puan yok', 'Ejemplo · sin puntos')}
            </div>
          </div>
          <div className="pz-scroll" style={{ flex: 1, padding: '18px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            <div lang="en" style={{ fontFamily: FRED, fontWeight: 600, fontSize: 17, color: INK_SOFT, textAlign: 'center' }}>
              1. Read the story. 2. Read the question. 3. Find the answer in the story.
            </div>
            <Story title={EXAMPLE.title} passage={EXAMPLE.passage} lit={done ? evidenceSentence(EXAMPLE.passage, EXAMPLE.evidence) : -1} compact />
            <div style={{ background: '#fff', borderRadius: 22, padding: '18px 18px', boxShadow: '0 8px 28px rgba(170,50,85,.12)' }}>
              <div lang="en" style={{ fontFamily: FRED, fontWeight: 600, fontSize: 20, color: INK, marginBottom: 12 }}>{EXAMPLE.stem}</div>
              <Options options={EXAMPLE.options} states={EXAMPLE.options.map((_, i) => done && i === EXAMPLE.answer ? 'ok' : null)} onPick={setExPicked} disabled={done} />
            </div>
            {done && (
              <div lang="en" style={{ background: '#fff4d6', borderRadius: 16, padding: '13px 16px', fontFamily: FRED, fontWeight: 600, fontSize: 16.5, color: '#7a5a12', lineHeight: 1.5, animation: 'scaleIn .2s ease both' }}>
                The story says: <i>"…he runs back home, because he forgot his hat."</i> The answer is B.
              </div>
            )}
            <button className="pz-press" onClick={() => { setSeenExample(true); setStep('read') }} style={{ ...primaryBtn, alignSelf: 'center', opacity: done ? 1 : .4 }} disabled={!done}>
              {say(lang, "I'm ready!", 'Hazırım!', '¡Estoy listo!')}
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── read ───────────────────────────────────────────────────────────────────
  if (step === 'read') return (
    <>{bar}
      <div style={shell}>
        <style>{ANIM}</style>
        <div style={{ background: ROSE, padding: '14px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div onClick={() => nav('/child/home')} style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(255,255,255,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>←</div>
          <div lang="en" style={{ fontFamily: FRED, fontWeight: 600, fontSize: 18, color: '#fff' }}>Read the story</div>
        </div>
        <div className="pz-scroll" style={{ flex: 1, padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 680, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <Story title={story.title} passage={story.passage} lit={-1} big={isTablet} />
          <button className="pz-press" onClick={() => setStep('questions')} style={{ ...primaryBtn, alignSelf: 'center' }}>
            {say(lang, "I've read it →", 'Okudum →', 'Ya lo leí →')}
          </button>
        </div>
      </div>
    </>
  )

  // ── result ─────────────────────────────────────────────────────────────────
  if (step === 'result') {
    const own = results.filter(r => r === 'own').length, help = results.filter(r => r === 'help').length
    const label = { own: say(lang, 'on your own', 'kendi başına', 'sin ayuda'), help: say(lang, 'with a hint', 'ipucuyla', 'con pista'), wrong: say(lang, 'to work on', 'geliştirilecek', 'por mejorar') }
    const color = { own: GREEN, help: ORANGE, wrong: '#c4bfd6' }
    return (
      <>{bar}
        <div style={shell}>
          <style>{ANIM}</style>
          <div style={{ background: ROSE, padding: '18px 24px 26px', borderRadius: '0 0 32px 32px', textAlign: 'center', flexShrink: 0 }}>
            <TutoMascot size={100} expression="proud" color="#fff" style={{ animation: 'float 3s ease-in-out infinite', display: 'inline-block' }} />
            <div lang="en" style={{ fontFamily: FRED, fontWeight: 600, fontSize: 19, color: 'white', marginTop: 6 }}>
              {own === total ? 'You found every answer in the story! 🌟' : own + help >= total - 1 ? 'Great reading!' : 'Good try! Reading again helps.'}
            </div>
          </div>
          <div className="pz-scroll" style={{ flex: 1, padding: '16px 18px 22px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 680, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 14, color: INK_SOFT, textAlign: 'center' }}>
              {own} {label.own} · {help} {label.help} · {total - own - help} {label.wrong}
            </div>
            {story.questions.map((qq, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 4px 16px rgba(0,0,0,.05)', animation: `fadeUp .35s ease ${i * 0.08}s both`, borderLeft: `6px solid ${color[results[i]]}` }}>
                <div lang="en" style={{ fontFamily: FRED, fontWeight: 600, fontSize: 16.5, color: INK }}>{qq.stem}</div>
                <div lang="en" style={{ fontWeight: 800, fontSize: 15.5, color: GREEN, marginTop: 4 }}>✓ {qq.options[qq.answer]}</div>
                <div lang="en" style={{ fontWeight: 600, fontSize: 14, color: INK_SOFT, marginTop: 4, fontStyle: 'italic' }}>"{qq.evidence}"</div>
                <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 12.5, color: color[results[i]], marginTop: 6 }}>{label[results[i]]}</div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 4 }}>
              <button className="pz-press" onClick={() => restart()} style={{ ...primaryBtn, padding: '13px 30px', fontSize: 17, background: '#fff', color: ROSE, boxShadow: 'none' }}>{say(lang, 'Read it again', 'Tekrar oku', 'Leer otra vez')}</button>
              {storyIdx + 1 < stories.length && <button className="pz-press" onClick={() => restart(storyIdx + 1)} style={{ ...primaryBtn, padding: '13px 30px', fontSize: 17 }}>{say(lang, 'Next story', 'Sonraki hikâye', 'Siguiente cuento')}</button>}
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── questions ──────────────────────────────────────────────────────────────
  const pct = ((qIdx + (flash ? 1 : 0)) / total) * 100
  const states = q.options.map((_, i) => reveal ? (i === q.answer ? 'ok' : 'struck') : struck.includes(i) ? 'struck' : picked === i ? 'picked' : null)
  const side = isTablet   // a tablet keeps the story beside the question; a phone folds it above
  const storyPanel = <Story title={story.title} passage={story.passage} lit={litNow} compact={!side} big={side} />

  return (
    <>{bar}
      <div style={shell}>
        <style>{ANIM}</style>
        {flash && (
          <div onClick={() => { if (!flash.correct) { setFlash(null); setReveal(true); setStoryOpen(true) } }} style={{
            position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto',
            background: flash.correct ? 'rgba(76,182,133,.94)' : 'rgba(247,148,51,.95)',
            animation: flash.correct ? 'flashIn 1.4s ease both' : 'flashHold .22s ease both',
            padding: '24px 26px', cursor: flash.correct ? 'default' : 'pointer',
          }}>
            <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 74, animation: 'pop .35s ease both' }}>{flash.correct ? '⭐' : '💪'}</div>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: flash.correct ? 30 : 22, color: 'white' }}>
                {flash.correct ? t('math_yes', lang) : flash.skipped ? say(lang, 'No problem!', 'Olsun!', '¡No pasa nada!') : t('math_not_this', lang)}
              </div>
              {!flash.correct && (
                <>
                  <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 17, color: 'white', opacity: .92 }}>{t('math_answer_is', lang)}</div>
                  <span lang="en" style={{ background: '#fff', color: INK, borderRadius: 16, padding: '12px 20px', fontFamily: READ, fontWeight: 800, fontSize: 21, maxWidth: 440 }}>{q.options[q.answer]}</span>
                  <div lang="en" style={{ background: 'rgba(255,255,255,.2)', borderRadius: 16, padding: '12px 16px', maxWidth: 460, fontFamily: FRED, fontWeight: 600, fontSize: 17, color: 'white', lineHeight: 1.5 }}>
                    The story says: <i>"{q.evidence}"</i>
                  </div>
                  <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 15, color: 'white', opacity: .8, marginTop: 4 }}>{say(lang, 'Tap to carry on', 'Devam etmek için dokun', 'Toca para seguir')}</div>
                </>
              )}
            </div>
          </div>
        )}

        <div style={{ background: ROSE, padding: '14px 20px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div onClick={() => setStep('read')} style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(255,255,255,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: '#fff', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>←</div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.32)', borderRadius: 8, height: 10, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'white', borderRadius: 8, transition: 'width .5s ease' }} />
            </div>
            <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 15, color: 'rgba(255,255,255,.95)' }}>{qIdx + 1} / {total}</div>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 18, padding: side ? '18px 22px 0' : 0 }}>
          {side && <div className="pz-scroll" style={{ flex: '1 1 50%', paddingBottom: 22 }}>{storyPanel}</div>}

          <div style={{ flex: '1 1 50%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="pz-scroll" style={{ flex: 1, padding: side ? '0 0 16px' : '14px 18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!side && (
              storyOpen ? (
                <div style={{ animation: 'scaleIn .2s ease both', position: 'relative' }}>
                  {storyPanel}
                  <button onClick={() => setStoryOpen(false)} style={{ position: 'absolute', top: 10, right: 10, border: 'none', background: '#f1eef8', color: INK_SOFT, borderRadius: 10, padding: '4px 10px', fontWeight: 800, cursor: 'pointer' }}>▲</button>
                </div>
              ) : (
                <button className="pz-press" onClick={() => setStoryOpen(true)} style={{
                  alignSelf: 'flex-start', border: 'none', background: '#fffdf8', color: ROSE, borderRadius: 999, padding: '8px 16px',
                  fontFamily: FRED, fontWeight: 600, fontSize: 15, cursor: 'pointer', boxShadow: '0 3px 10px rgba(170,50,85,.1)',
                }}>📖 {say(lang, 'Look at the story', 'Hikâyeye bak', 'Mira el cuento')}</button>
              )
            )}

            <div key={qIdx} style={{ background: 'white', borderRadius: 22, padding: '20px 18px', boxShadow: '0 8px 28px rgba(170,50,85,.14)', animation: 'scaleIn .3s ease both' }}>
              <div lang="en" style={{ fontFamily: FRED, fontWeight: 600, fontSize: side ? 26 : 21, color: INK, lineHeight: 1.4, marginBottom: 14 }}>{q.stem}</div>
              <Options options={q.options} states={states} onPick={setPicked} disabled={!!flash || reveal} big={side} />
            </div>

            {tries === 1 && hints === 0 && !flash && !reveal && (
              <div style={{ alignSelf: 'center', background: '#fff4e0', borderRadius: 14, padding: '9px 15px', maxWidth: 340, fontFamily: FRED, fontWeight: 600, fontSize: 14.5, color: '#b7720f', textAlign: 'center', lineHeight: 1.4, animation: 'scaleIn .22s ease both' }}>
                {say(lang, 'Hmm, not quite. Look at the story again, or tap 💡!', 'Hmm, tam değil. Hikâyeye tekrar bak ya da 💡\'ya dokun!', 'Mmm, casi. ¡Mira el cuento otra vez o toca 💡!')}
              </div>
            )}
            {hints > 0 && !reveal && (
              <div lang="en" style={{ alignSelf: 'center', background: 'rgba(255,255,255,.92)', borderRadius: 16, padding: '12px 17px', maxWidth: 520, fontFamily: FRED, fontWeight: 600, fontSize: side ? 18 : 15.5, color: INK_SOFT, lineHeight: 1.5, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 7, animation: 'scaleIn .22s ease both' }}>
                <div>{HINT1[q.op] || HINT1.detail}</div>
                {hints >= 2 && <div>One wrong answer is crossed out.</div>}
                {hints >= 3 && <div>Look at the yellow sentence in the story.</div>}
              </div>
            )}

          </div>
            {/* The actions sit under the scrolling column, not over it: a sticky bar hid the
                options it was asking about on a phone once the story was open. */}
            <div style={{ flexShrink: 0, padding: '10px 18px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, borderTop: '1px solid rgba(217,87,122,.12)' }}>
              {reveal ? (
                <>
                  <div lang="en" style={{ background: '#fff4d6', borderRadius: 14, padding: '9px 15px', maxWidth: 380, fontFamily: FRED, fontWeight: 600, fontSize: 15, color: '#7a5a12', textAlign: 'center', lineHeight: 1.4 }}>
                    The yellow sentence in the story shows the answer.
                  </div>
                  <button className="pz-press" onClick={next} style={{ ...primaryBtn, padding: '13px 46px', fontSize: 19 }}>
                    {qIdx + 1 < total ? say(lang, 'Next →', 'Sıradaki →', 'Siguiente →') : say(lang, 'Finish', 'Bitir', 'Terminar')}
                  </button>
                </>
              ) : <>
              <div style={{ display: 'flex', gap: 10 }}>
                {hints < 3 && (
                  <button className="pz-press" onClick={hint} disabled={!!flash} style={{ border: 'none', background: hints ? 'rgba(247,148,51,.16)' : 'rgba(255,255,255,.72)', color: ORANGE, borderRadius: 999, padding: '8px 16px', cursor: 'pointer', fontFamily: FRED, fontWeight: 600, fontSize: 15 }}>
                    💡 {hints === 0 ? say(lang, 'Hint', 'İpucu', 'Pista') : say(lang, 'More help', 'Biraz daha', 'Más ayuda')}
                  </button>
                )}
                {picked == null && (
                  <button className="pz-press" onClick={skip} disabled={!!flash} style={{ border: 'none', background: 'rgba(255,255,255,.72)', color: INK_SOFT, borderRadius: 999, padding: '9px 18px', cursor: 'pointer', fontFamily: FRED, fontWeight: 600, fontSize: 15 }}>{t('rd_skip', lang)}</button>
                )}
              </div>
              <button className="pz-press" onClick={send} disabled={picked == null || !!flash} style={{ ...primaryBtn, padding: '13px 46px', fontSize: 19, opacity: picked == null ? .4 : 1, boxShadow: picked == null ? 'none' : primaryBtn.boxShadow }}>
                {t('puzzle_send', lang)}
              </button>
              </>}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
