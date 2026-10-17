import { createContext, useContext, useMemo, useRef, useState } from 'react'
import { TRIAL_ITEMS, PASSAGES, AREAS, TRIAL_REVISION } from '../lib/literacy/trialSet'
import AUDIO from '../lib/literacy/audioManifest.generated.json'
import ART from '../lib/literacy/artManifest.generated.json'
import { EMOJI_ART } from '../lib/puzzleArt.generated'

// /english-trial-lab — the 36-item English trial set (docs/ENGLISH-TRIAL-SET.md) with its recordings and
// pictures. A reviewer tool, not a child screen: the answer keys are in this bundle by design. Two views:
// "Review" lists every item with its key and the check status of every recording; "Play" shows one item at
// a time with nothing but the item, for trying the set with a child. Nothing is sent anywhere. In Review a
// recording can be marked as heard and approved: the marks stay in this browser (by recording hash) and the
// page copies the command (scripts/english-audio/approve.mjs) that writes them into the manifest.
// Reviewer chrome is in English like the other labs; everything inside an item is English by rule.

const INK = '#2c2745', SOFT = '#8d83ad', LINE = '#e4def3', GREEN = '#3fa97a', RED = '#e2586a', BLUE = '#4f8fe0', ORANGE = '#f08a24'
const FONT = "'Lexend', 'Nunito', system-ui, sans-serif"
const STATUS_COLOUR = { ok: GREEN, listen: ORANGE, fail: RED, unchecked: SOFT, missing: '#c9c3da' }

// Marks made while listening, keyed by recording hash so a re-recorded clip is not carried over.
const MARKS_KEY = 'tuto_trial_audio_marks_v1'
function readMarks() {
  try { return new Set(JSON.parse(localStorage.getItem(MARKS_KEY) || '[]')) } catch { return new Set() }
}
function writeMarks(set) {
  try { localStorage.setItem(MARKS_KEY, JSON.stringify([...set])) } catch { /* private mode: marks last this visit only */ }
}
const Marks = createContext({ marks: new Set(), toggle: () => {} })

function clipInfo(id, variety) {
  const m = AUDIO[`${id}:${variety}`]
  return m ? { ...m, url: `/${m.file}` } : { status: 'missing' }
}

// One audio element for the page: a new tap stops what is playing. iOS plays only after a tap.
let player = null
function play(url) {
  if (!url) return
  if (player) player.pause()
  player = new Audio(url)
  player.play().catch(() => {})
}

function Picture({ p, size = 120, fill = false }) {
  const src = p.object ? EMOJI_ART[ART.objects[p.object]] : `/${ART.scenes[p.scene]}`
  // fill: as wide as its option card, so three options sit side by side on a phone
  const style = fill ? { width: '100%', height: 'auto', aspectRatio: p.object ? '1' : '240 / 200' } : { width: size, height: p.object ? size : size * 200 / 240 }
  return <img src={src} alt="" draggable={false} style={{ ...style, objectFit: 'contain', display: 'block' }} />
}

function ListenButton({ clip, variety, label = 'Listen', review, big }) {
  const c = clipInfo(clip, variety)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button onClick={() => play(c.url)} disabled={!c.url} style={{
        border: 'none', borderRadius: 999, padding: big ? '14px 26px' : '8px 14px', cursor: c.url ? 'pointer' : 'not-allowed',
        background: c.url ? BLUE : '#d8d4e6', color: 'white', fontFamily: FONT, fontWeight: 700, fontSize: big ? 20 : 14,
      }}>🔊 {label}</button>
      {review && <StatusDot c={c} />}
      {review && c.id && <ApproveToggle c={c} />}
    </span>
  )
}

function StatusDot({ c }) {
  const tip = c.status === 'missing' ? 'not recorded yet' : `${c.status}${c.issues?.length ? ': ' + c.issues.join(' · ') : ''}${c.approved ? ' · approved' : ' · not approved'}`
  return <span title={tip} style={{ fontSize: 11, fontFamily: FONT, fontWeight: 700, color: STATUS_COLOUR[c.status], whiteSpace: 'nowrap' }}>● {c.status}</span>
}

function ApproveToggle({ c }) {
  const { marks, toggle } = useContext(Marks)
  if (c.approved) return <span style={{ fontSize: 11, fontFamily: FONT, fontWeight: 700, color: GREEN }}>✓ approved</span>
  const on = marks.has(c.id)
  return (
    <button onClick={() => toggle(c.id)} title={on ? 'Marked: will be in the approve command' : 'Heard it and it is right'} style={{
      border: `1.5px solid ${on ? GREEN : LINE}`, background: on ? GREEN : 'white', color: on ? 'white' : SOFT, borderRadius: 999,
      padding: '2px 8px', fontFamily: FONT, fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
    }}>{on ? '✓ marked' : 'approve?'}</button>
  )
}

// The Cambridge wordlist recordings (build.mjs --set words): one button per word, with its check status.
// "unchecked" = made with --no-qc, only the signal check so far.
function WordsView({ variety }) {
  const words = Object.values(AUDIO).filter(m => m.clip.startsWith('yw-') && m.variety === variety)
    .sort((a, b) => a.text.localeCompare(b.text))
  if (!words.length) return <div style={{ fontSize: 14, color: SOFT }}>No wordlist recordings for this voice yet.</div>
  return (
    <section style={{ background: 'white', borderRadius: 20, padding: 16, border: `1px solid ${LINE}`, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      <div style={{ width: '100%', fontSize: 13, color: SOFT }}>{words.length} of the Cambridge wordlist ({variety.toUpperCase()}). Tap to hear.</div>
      {words.map(m => (
        <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${LINE}`, borderRadius: 999, padding: '4px 8px 4px 4px' }}>
          <button onClick={() => play(`/${m.file}`)} style={{ border: 'none', borderRadius: 999, padding: '6px 12px', background: BLUE, color: 'white', fontFamily: FONT, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>🔊 {m.text}</button>
          <StatusDot c={m} />
          <ApproveToggle c={m} />
        </span>
      ))}
    </section>
  )
}

// A stable shuffle per item and round, so the key is not always in the same place.
function shuffled(list, seed) {
  const a = [...list]
  let s = [...seed].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)
  for (let i = a.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) >>> 0; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

function Item({ item, variety, review, round, onDone }) {
  const [picked, setPicked] = useState(null)
  const [letters, setLetters] = useState([])     // build: indices into item.letters, in the order tapped
  const [order, setOrder] = useState([])         // order: card ids in the order tapped
  const [result, setResult] = useState(null)     // null | 'right' | 'wrong'
  const options = useMemo(() => (item.options ? shuffled(item.options, item.id + round) : []), [item, round])
  const tiles = useMemo(() => (item.letters ? shuffled(item.letters.map((l, i) => ({ l, i })), item.id + round) : []), [item, round])
  const cards = useMemo(() => (item.cards ? shuffled(item.cards, item.id + round) : []), [item, round])
  const done = result !== null

  function finish(ok) {
    setResult(ok ? 'right' : 'wrong')
    if (!ok && item.feedback?.audio) play(clipInfo(item.feedback.audio, variety).url)
    onDone?.(ok)
  }
  const choose = id => { if (done) return; setPicked(id); finish(id === item.key) }

  const passage = item.passage && PASSAGES[item.passage]
  const optionStyle = id => ({
    border: `3px solid ${done && id === item.key ? GREEN : done && id === picked ? RED : LINE}`,
    background: done && id === item.key ? '#eaf8f1' : 'white', borderRadius: 16, padding: 10, cursor: done ? 'default' : 'pointer',
    fontFamily: FONT, fontSize: 18, fontWeight: 600, color: INK, minHeight: 56,
  })

  return (
    <article style={{ background: 'white', borderRadius: 20, padding: 18, border: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {review && (
        <div style={{ fontFamily: FONT, fontSize: 12, color: SOFT, fontWeight: 700 }}>
          {item.id} · {AREAS[item.area]} · step {item.step} · {item.mode}
        </div>
      )}
      {item.instruction?.audio && <div><ListenButton clip={item.instruction.audio} variety={variety} label="Instruction" review={review} /></div>}
      {item.instruction?.text && <div style={{ fontFamily: FONT, fontSize: 16, color: SOFT, fontWeight: 600 }}>{item.instruction.text}</div>}
      {passage && (
        <section style={{ background: '#f6f3fb', borderRadius: 14, padding: '12px 16px', fontFamily: 'Georgia, serif', fontSize: 17, lineHeight: 1.6, color: INK }}>
          <div style={{ fontFamily: FONT, fontWeight: 700, marginBottom: 6 }}>{passage.title}</div>
          {passage.text.map((p, i) => <p key={i} style={{ margin: '0 0 8px' }}>{p}</p>)}
        </section>
      )}
      {item.prompt?.context && <div style={{ fontFamily: FONT, fontSize: 19, color: INK, lineHeight: 1.5 }}>{item.prompt.context}</div>}
      {item.prompt?.text && <div style={{ fontFamily: FONT, fontSize: item.mode === 'read-picture' ? 26 : 20, fontWeight: 700, color: INK, lineHeight: 1.4 }}>{item.prompt.text}</div>}
      {item.prompt?.picture && <Picture p={item.prompt.picture} size={130} />}
      {item.prompt?.audio && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <ListenButton clip={item.prompt.audio} variety={variety} big review={review} label={item.mode === 'listen-answer' ? 'Listen to the children' : 'Listen'} />
          {item.prompt.question && <ListenButton clip={item.prompt.question} variety={variety} big review={review} label="Question" />}
        </div>
      )}

      {/* answers */}
      {(item.mode === 'listen-picture' || item.mode === 'read-picture') && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, maxWidth: 560 }}>
          {options.map(o => <button key={o.id} onClick={() => choose(o.id)} style={{ ...optionStyle(o.id), padding: 6 }}><Picture p={o.picture} fill /></button>)}
        </div>
      )}
      {item.mode === 'listen-answer' && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {options.map((o, i) => (
            <div key={o.id} style={{ ...optionStyle(o.id), display: 'flex', gap: 8, alignItems: 'center' }}>
              <ListenButton clip={o.audio} variety={variety} label={String(i + 1)} review={review} />
              <button onClick={() => choose(o.id)} disabled={done} style={{ border: 'none', background: INK, color: 'white', borderRadius: 10, padding: '8px 12px', fontFamily: FONT, fontWeight: 700, cursor: 'pointer' }}>Choose</button>
            </div>
          ))}
        </div>
      )}
      {item.mode === 'read-choice' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {options.map(o => <button key={o.id} onClick={() => choose(o.id)} style={{ ...optionStyle(o.id), textAlign: 'left' }}>{o.text}</button>)}
        </div>
      )}
      {item.mode === 'build' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {item.answer.split('').map((_, k) => (
              <div key={k} style={{ width: 52, height: 60, borderRadius: 12, border: `3px dashed ${done ? (result === 'right' ? GREEN : RED) : LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontSize: 30, fontWeight: 700, color: INK }}>
                {letters[k] !== undefined ? item.letters[letters[k]] : ''}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tiles.map(t => (
              <button key={t.i} disabled={done || letters.includes(t.i) || letters.length >= item.answer.length}
                onClick={() => setLetters(x => [...x, t.i])}
                style={{ width: 56, height: 56, borderRadius: 12, border: 'none', background: letters.includes(t.i) ? '#ece9f5' : '#ffe8cf', fontFamily: FONT, fontSize: 28, fontWeight: 700, color: INK, cursor: 'pointer' }}>{t.l}</button>
            ))}
            <button disabled={done || !letters.length} onClick={() => setLetters(x => x.slice(0, -1))} style={{ borderRadius: 12, border: `2px solid ${LINE}`, background: 'white', padding: '0 14px', fontFamily: FONT, cursor: 'pointer' }}>Undo</button>
            <button disabled={done || letters.length !== item.answer.length} onClick={() => finish(letters.map(i => item.letters[i]).join('') === item.answer)}
              style={{ borderRadius: 12, border: 'none', background: GREEN, color: 'white', padding: '0 18px', fontFamily: FONT, fontWeight: 700, cursor: 'pointer' }}>Check</button>
          </div>
          {done && result === 'wrong' && <div style={{ fontFamily: FONT, fontSize: 26, fontWeight: 700, color: GREEN, letterSpacing: 4 }}>{item.answer}</div>}
        </div>
      )}
      {item.mode === 'order' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cards.map(c => {
            const n = order.indexOf(c.id)
            const right = done && item.order.indexOf(c.id)
            return (
              <button key={c.id} disabled={done || n >= 0} onClick={() => setOrder(x => [...x, c.id])}
                style={{ ...optionStyle('—'), textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ width: 30, height: 30, borderRadius: 999, background: n >= 0 ? INK : '#ece9f5', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n >= 0 ? n + 1 : ''}</span>
                {c.text}
                {done && <span style={{ marginLeft: 'auto', color: GREEN, fontWeight: 700 }}>{right + 1}</span>}
              </button>
            )
          })}
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={done || !order.length} onClick={() => setOrder([])} style={{ borderRadius: 12, border: `2px solid ${LINE}`, background: 'white', padding: '8px 14px', fontFamily: FONT, cursor: 'pointer' }}>Start again</button>
            <button disabled={done || order.length !== item.cards.length} onClick={() => finish(order.join() === item.order.join())}
              style={{ borderRadius: 12, border: 'none', background: GREEN, color: 'white', padding: '8px 18px', fontFamily: FONT, fontWeight: 700, cursor: 'pointer' }}>Check</button>
          </div>
        </div>
      )}

      {done && (
        <div style={{ borderRadius: 14, padding: '10px 14px', background: result === 'right' ? '#eaf8f1' : '#fff3e8', fontFamily: FONT, fontSize: 16, color: INK, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ color: result === 'right' ? GREEN : ORANGE }}>{result === 'right' ? 'Yes!' : 'Look:'}</strong>
          {result === 'wrong' && item.feedback?.text && <span>{item.feedback.text}</span>}
          {item.feedback?.audio && <ListenButton clip={item.feedback.audio} variety={variety} label="Hear it" review={review} />}
        </div>
      )}
      {review && !done && <div style={{ fontFamily: FONT, fontSize: 12, color: SOFT }}>key: {item.key ?? item.answer ?? item.order?.join(' → ')}</div>}
    </article>
  )
}

export default function EnglishTrialLab() {
  const [variety, setVariety] = useState('uk')
  const [view, setView] = useState('review')
  const [area, setArea] = useState('all')
  const [round, setRound] = useState(0)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState({})
  const [marks, setMarks] = useState(readMarks)
  const [copied, setCopied] = useState(false)
  const toggle = id => setMarks(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    writeMarks(next)
    return next
  })
  const top = useRef(null)
  const items = TRIAL_ITEMS.filter(i => area === 'all' || i.area === area)
  const recs = Object.values(AUDIO).filter(r => !r.clip.startsWith('yw-'))   // the trial set; words have their own tab
  const count = s => recs.filter(r => r.status === s).length
  // Only marks for recordings still in the manifest and not yet approved there.
  const pending = Object.values(AUDIO).filter(r => marks.has(r.id) && !r.approved)
  const command = `node scripts/english-audio/approve.mjs ${pending.map(r => r.id).join(',')}`
  const copy = () => {
    navigator.clipboard?.writeText(command).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }, () => {})
  }
  const needed = new Set(TRIAL_ITEMS.flatMap(i => [i.instruction?.audio, i.prompt?.audio, i.prompt?.question, i.feedback?.audio, ...(i.options || []).map(o => o.audio)]).filter(Boolean))
  const missing = [...needed].filter(id => !AUDIO[`${id}:${variety}`]).length

  const btn = (on, label, f) => (
    <button key={label} onClick={f} style={{ border: `2px solid ${on ? INK : LINE}`, background: on ? INK : 'white', color: on ? 'white' : INK, borderRadius: 999, padding: '6px 14px', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{label}</button>
  )
  const reset = () => { setRound(r => r + 1); setIndex(0); setScore({}) }

  return (
    <div ref={top} style={{ minHeight: '100dvh', background: '#f4f3fa', padding: '20px 16px 160px', boxSizing: 'border-box', fontFamily: FONT, color: INK }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <header>
          <div style={{ fontSize: 12, fontWeight: 700, color: SOFT, letterSpacing: 1 }}>TUTO · ENGLISH TRIAL SET · {TRIAL_REVISION}</div>
          <h1 style={{ margin: '4px 0 6px', fontSize: 28 }}>English trial lab</h1>
          <div style={{ fontSize: 13, color: SOFT, lineHeight: 1.5 }}>
            Reviewer tool. Recordings: {count('ok')} ok · {count('listen')} to hear · {count('fail')} failed · {missing} not made yet ({variety.toUpperCase()}) · {recs.filter(r => r.approved).length} approved. None reaches a child until a person has listened and approved it.
          </div>
        </header>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {btn(view === 'review', 'Review', () => setView('review'))}{btn(view === 'play', 'Play with a child', () => { setView('play'); reset() })}{btn(view === 'words', 'Words', () => setView('words'))}
          <span style={{ width: 12 }} />
          {btn(variety === 'uk', 'UK voice', () => setVariety('uk'))}{btn(variety === 'us', 'US voice', () => setVariety('us'))}
          <span style={{ width: 12 }} />
          {['all', ...Object.keys(AREAS)].map(a => btn(area === a, a === 'all' ? 'All' : a, () => { setArea(a); setIndex(0) }))}
        </div>

        {view !== 'play' && pending.length > 0 && (
          <div style={{ position: 'fixed', left: 16, right: 16, bottom: 12, maxWidth: 728, margin: '0 auto', zIndex: 2, background: 'white', border: `1.5px solid ${GREEN}`, borderRadius: 14, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, boxShadow: '0 6px 24px rgba(44,39,69,.18)' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{pending.length} marked as heard. Run this in the repo, then commit the manifest:</div>
            <code style={{ fontSize: 11, wordBreak: 'break-all', color: SOFT }}>{command}</code>
            <div style={{ display: 'flex', gap: 8 }}>
              {btn(false, copied ? 'Copied ✓' : 'Copy command', copy)}
              {btn(false, 'Clear marks', () => { setMarks(new Set()); writeMarks(new Set()) })}
            </div>
          </div>
        )}

        <Marks.Provider value={{ marks, toggle }}>
        {view === 'review' && items.map(it => <Item key={it.id + variety + round} item={it} variety={variety} review round={round} />)}
        {view === 'words' && <WordsView variety={variety} />}
        </Marks.Provider>

        {view === 'play' && (index < items.length ? (
          <>
            <div style={{ fontSize: 13, color: SOFT, fontWeight: 700 }}>{index + 1} / {items.length}</div>
            <Item key={items[index].id + round} item={items[index]} variety={variety} round={round}
              onDone={ok => setScore(s => ({ ...s, [items[index].id]: ok }))} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setIndex(i => i + 1); top.current?.scrollIntoView() }}
                style={{ border: 'none', background: INK, color: 'white', borderRadius: 999, padding: '12px 24px', fontFamily: FONT, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
                {score[items[index].id] === undefined ? 'Skip' : 'Next'} →
              </button>
            </div>
          </>
        ) : (
          <section style={{ background: 'white', borderRadius: 20, padding: 18, border: `1px solid ${LINE}` }}>
            <h2 style={{ marginTop: 0 }}>Done</h2>
            {Object.keys(AREAS).map(a => {
              const its = items.filter(i => i.area === a)
              if (!its.length) return null
              return <div key={a} style={{ fontSize: 15, margin: '4px 0' }}><strong>{AREAS[a]}</strong>: {its.map(i => `${i.id} ${score[i.id] === undefined ? '–' : score[i.id] ? '✓' : '✗'}`).join('  ')}</div>
            })}
            <button onClick={reset} style={{ marginTop: 12, border: 'none', background: INK, color: 'white', borderRadius: 999, padding: '10px 20px', fontFamily: FONT, fontWeight: 700, cursor: 'pointer' }}>Again</button>
          </section>
        ))}
      </div>
    </div>
  )
}
