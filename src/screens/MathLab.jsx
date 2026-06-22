import { useState } from 'react'
import { generateProblem, TOPICS } from '../lib/mathTemplates'

// Isolated pilot for the math template engine (src/lib/mathTemplates.js). Not linked from
// any menu, not wired to MathScreen/levels/gems — pure sandbox at /math-lab to try
// templates and tune them before anything touches production.
export default function MathLab() {
  const [topic, setTopic] = useState(TOPICS[0])
  const [level, setLevel] = useState(1)
  const [problem, setProblem] = useState(() => generateProblem(TOPICS[0], 1))
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null) // null | 'correct' | 'wrong'
  const [hintShown, setHintShown] = useState(0) // 0 = none, 1 = nudge, 2 = half, 3 = full

  const nextProblem = (t = topic, l = level) => {
    setProblem(generateProblem(t, l))
    setInput('')
    setResult(null)
    setHintShown(0)
  }

  const check = () => {
    if (input.trim() === '') return
    const numeric = Number(input)
    setResult(numeric === problem.correct_answer ? 'correct' : 'wrong')
  }

  return (
    <div style={{ minHeight: '100vh', maxWidth: 480, margin: '0 auto', background: '#0F1320', color: '#fff', fontFamily: 'monospace', padding: '24px 20px 60px' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>🧪 Math Template Engine — pilot</h1>
      <div style={{ fontSize: 12, color: '#8d83ad', marginBottom: 20 }}>/math-lab — isolated, not wired to production MathScreen</div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13 }}>
          Topic:{' '}
          <select
            value={topic}
            onChange={e => { setTopic(e.target.value); nextProblem(e.target.value, level) }}
            style={{ fontFamily: 'monospace', fontSize: 13, padding: 4 }}
          >
            {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13 }}>
          Level:{' '}
          <select
            value={level}
            onChange={e => { const l = Number(e.target.value); setLevel(l); nextProblem(topic, l) }}
            style={{ fontFamily: 'monospace', fontSize: 13, padding: 4 }}
          >
            {Array.from({ length: 15 }, (_, i) => i + 1).map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
      </div>

      <div style={{ background: '#1A1E33', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#8d83ad', marginBottom: 8 }}>
          topic={problem.topic} · level={problem.level} · format={problem.format}
        </div>
        <div style={{ fontSize: 18, marginBottom: 16 }}>{problem.question_text}</div>

        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="number"
            value={input}
            onChange={e => { setInput(e.target.value); setResult(null) }}
            onKeyDown={e => e.key === 'Enter' && check()}
            placeholder="your answer"
            style={{ flex: 1, fontFamily: 'monospace', fontSize: 16, padding: '8px 10px', borderRadius: 8, border: 'none' }}
          />
          <button onClick={check} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#2EC486', color: 'white', fontFamily: 'monospace', cursor: 'pointer' }}>
            Check
          </button>
        </div>

        {result === 'correct' && <div style={{ marginTop: 12, color: '#2EC486' }}>✅ correct — answer was {problem.correct_answer}</div>}
        {result === 'wrong' && <div style={{ marginTop: 12, color: '#FF6B6B' }}>❌ not quite — you said {input}</div>}
      </div>

      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setHintShown(h => Math.min(problem.hint_steps.length, h + 1))}
          disabled={hintShown >= problem.hint_steps.length}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #8d83ad', background: 'none', color: '#fff', fontFamily: 'monospace', cursor: hintShown >= problem.hint_steps.length ? 'default' : 'pointer', opacity: hintShown >= problem.hint_steps.length ? 0.5 : 1 }}
        >
          {hintShown === 0 ? 'Show help' : hintShown < problem.hint_steps.length ? 'More help' : 'Fully revealed'}
        </button>
        {hintShown > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {problem.hint_steps.slice(0, hintShown).map((h, i) => (
              <div key={i} style={{ fontSize: 13, color: '#c2cfc7', background: '#1A1E33', padding: '8px 10px', borderRadius: 8 }}>
                {i + 1}. {h}
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={() => nextProblem()} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#7C5CBF', color: 'white', fontFamily: 'monospace', cursor: 'pointer' }}>
        Next problem →
      </button>

      <details style={{ marginTop: 30, fontSize: 12, color: '#666' }}>
        <summary style={{ cursor: 'pointer' }}>Raw problem object</summary>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(problem, null, 2)}</pre>
      </details>
    </div>
  )
}
