import { useEffect, useMemo, useRef, useState } from 'react'
import { COVERAGE, SKILLS, generateSession, markAnswer, summarize } from '../lib/literacy/engine'
import { CONTENT_VERSION, WORDS, CLOZE, BE_FRAMES, PASSAGES } from '../lib/literacy/content'
import './LiteracyLab.css'

// English-only internal content review lab, not a child route or placement assessment.
// All state is in memory; no account, storage, network, rewards or mastery writes.
function Question({ item, onDone, moveFocus }) {
  const cardRef = useRef(null)
  useEffect(() => {
    if (moveFocus) {
      cardRef.current?.focus({ preventScroll: true })
      cardRef.current?.scrollIntoView({ block: 'start' })
    }
  }, [moveFocus])
  const [selected, setSelected] = useState('')
  const [letters, setLetters] = useState([])
  const [hint, setHint] = useState(false)
  const [result, setResult] = useState(null)
  const response = item.mode === 'letters' ? letters.map(id=>item.letters.find(x=>x.id===id).letter).join('') : selected
  const ready = item.mode === 'letters' ? letters.length===item.letters.length : Boolean(selected)
  function submit(skipped=false) { setResult(markAnswer(item,response,{hintUsed:hint,skipped})) }
  return <article ref={cardRef} tabIndex={-1} aria-label="Practice question" className="lit-card">
    <p className="lit-eyebrow">{SKILLS[item.skill].domain} · {SKILLS[item.skill].label}</p>
    {item.passage && <section className="lit-passage" aria-label="Reading passage">
      <h2>{item.passage.title}</h2>
      <p>{item.passage.sentences.map((s,i)=><span key={i} className={result&&item.evidence.includes(i)?'lit-evidence':''}>{s}{' '}</span>)}</p>
    </section>}
    <h2>{item.prompt}</h2>
    {item.stem && <p className="lit-stem">{item.stem}</p>}
    {item.mode==='choice' ? <div className="lit-options" role="group" aria-label="Answer choices">
      {item.options.map(o=><button key={o.id} disabled={Boolean(result)} aria-pressed={selected===o.id}
        className={`lit-option ${selected===o.id?'selected':''} ${result&&o.text===item.answer?'correct':''}`}
        onClick={()=>setSelected(o.id)}>{o.text}{result&&o.text===item.answer?' ✓':''}</button>)}
    </div> : <div>
      <div className="lit-built" aria-label="Your word" aria-live="polite">{response || '…'}</div>
      <div className="lit-letters" role="group" aria-label="Letter tiles">{item.letters.map(l=><button key={l.id}
        disabled={Boolean(result)||letters.includes(l.id)} onClick={()=>setLetters([...letters,l.id])}
        aria-label={`Letter ${l.letter}, tile ${l.id+1}`}>{l.letter}</button>)}</div>
      <div className="lit-actions"><button disabled={Boolean(result)||!letters.length} onClick={()=>setLetters(letters.slice(0,-1))}>Undo</button>
        <button disabled={Boolean(result)||!letters.length} onClick={()=>setLetters([])}>Clear</button></div>
    </div>}
    {hint && <aside className="lit-hint"><strong>Hint</strong><p>{item.hint}</p></aside>}
    {!result ? <div className="lit-actions">
      <button disabled={hint} onClick={()=>setHint(true)}>Show hint</button>
      <button onClick={()=>submit(true)}>I don’t know yet</button>
      <button className="lit-primary" disabled={!ready} onClick={()=>submit()}>Check answer</button>
    </div> : <section className={`lit-feedback ${result.correct?'is-correct':''}`} aria-live="polite">
      <h3>{result.skipped?'Let’s look together':result.correct?'That’s right':'Let’s check'}</h3>
      <p>{result.explanation}</p>
      {result.correct&&hint&&<p>You used a hint. This is recorded as supported practice.</p>}
      <button className="lit-primary" onClick={()=>onDone(result)}>Next</button>
    </section>}
    <details className="lit-meta"><summary>Review metadata</summary>
      <p>Primary skill: {item.primarySkill} · Family: {item.family}</p>
      <p>Seed: {item.seed} · Content: {item.contentVersion} · Engine: {item.engineVersion}</p>
      <p>Shared UK/US content candidate. No audio, fluency or placement assessment.</p>
    </details>
  </article>
}

function ContentReview() {
  return <section className="lit-card"><h2>Content inventory</h2>
    <p>Original pilot content for editorial review. No workbook passages are reproduced. These are uncalibrated practice items.</p>
    <details><summary>{WORDS.length} words and meanings</summary><div className="lit-wordlist">{WORDS.map(w=><p key={w.id}><strong>{w.word}</strong> — {w.meaning}</p>)}</div></details>
    <details><summary>{CLOZE.length} context sentences</summary>{CLOZE.map(c=><p key={c.id}>{c.text.replace('___',c.answer)}</p>)}</details>
    <details><summary>{BE_FRAMES.length} grammar frames</summary>{BE_FRAMES.map(f=><p key={f.id}>{f.subject} ___ {f.predicate}.</p>)}</details>
    <details><summary>{PASSAGES.length} reading passages</summary>{PASSAGES.map(p=><section key={p.id}><h3>{p.title}</h3><p>{p.sentences.join(' ')}</p></section>)}</details>
  </section>
}

export default function LiteracyLab() {
  const [skill,setSkill]=useState('all'),[seed,setSeed]=useState(1),[run,setRun]=useState(0)
  const [attempts,setAttempts]=useState([]),[view,setView]=useState('play')
  const session=useMemo(()=>generateSession(seed,skill,10),[seed,skill])
  const item=session.items[attempts.length]
  function reset(nextSkill=skill,nextSeed=seed) {setSkill(nextSkill);setSeed(nextSeed);setAttempts([]);setRun(n=>n+1)}
  return <main className="lit-lab">
    <header className="lit-header"><div><p className="lit-eyebrow">TUTO · LOCAL PILOT</p><h1>English literacy lab</h1>
      <p>Words, sentences and little discoveries.</p></div><span className="lit-badge">Practice preview</span></header>
    <div className="lit-notice">Local review only · No account or Gems · No level assignment · English instructions</div>
    <nav className="lit-actions" aria-label="Lab views"><button aria-pressed={view==='play'} onClick={()=>setView('play')}>Play</button>
      <button aria-pressed={view==='content'} onClick={()=>setView('content')}>Content inventory</button></nav>
    {view==='content'?<ContentReview/>:<>
      <section className="lit-toolbar" aria-label="Session controls">
        <label>Practice area<select value={skill} onChange={e=>reset(e.target.value,seed)}><option value="all">Mixed practice · 10 skills</option>
          {Object.entries(SKILLS).map(([id,s])=><option key={id} value={id}>{s.domain} · {s.label}</option>)}</select></label>
        <label>Seed<input type="number" min="1" max="999999" value={seed} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=999999)reset(skill,n)}}/></label>
        <button onClick={()=>reset(skill,seed+1)}>New set</button>
        <button onClick={()=>reset()}>Restart</button>
      </section>
      {session.exhausted&&<p className="lit-notice">This set has {session.items.length} distinct examples. The bank has no more unseen examples for this set.</p>}
      {item ? <><div className="lit-progress"><span>Question {attempts.length+1} of {session.items.length}</span><progress value={attempts.length} max={session.items.length}/></div>
        <Question key={`${run}:${item.id}`} item={item} moveFocus={attempts.length>0} onDone={a=>setAttempts([...attempts,a])}/></>:
        <section className="lit-card"><p className="lit-eyebrow">PRACTICE COMPLETE</p><h2>Your practice today</h2>
          <p>{attempts.filter(a=>a.independent).length} independent · {attempts.filter(a=>a.correct&&!a.independent).length} with a hint · {attempts.filter(a=>!a.correct).length} to practise</p>
          <p>This short practice does not assign an English level.</p>
          <div className="lit-results">{summarize(attempts).map(s=><div key={s.skill}><strong>{s.label}</strong><span>{s.independent} independent / {s.supported} supported / {s.needsPractice} to practise</span></div>)}</div>
          <details><summary>Review answers</summary>{attempts.map(a=><div key={a.itemId}><h3>{SKILLS[a.skill].label}</h3><p>Your answer: {a.skipped?'Skipped':a.response||'No answer'}</p><p>{a.explanation}</p></div>)}</details>
          <button className="lit-primary" onClick={()=>reset(skill,seed+1)}>Try another set</button>
        </section>}
    </>}
    <footer>{COVERAGE.words} words · {COVERAGE.sentenceFrames} sentence frames · {COVERAGE.passages} passages · {CONTENT_VERSION}<br/>No phonics, speech or free-writing assessment in this pilot. Refreshing clears practice results.</footer>
  </main>
}
