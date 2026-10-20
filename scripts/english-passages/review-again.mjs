// Re-run the pedagogy reviewer with pro on a finished run whose stories fell back to flash (quota).
// The result is stored as check.pedagogyPro and wins in export-preview.mjs.
//
//   REVIEW_KEY=… node scripts/english-passages/review-again.mjs <out-dir-name>
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
const base = new URL('./', import.meta.url).pathname
const { pedagogyReview } = await import(base + 'agents.mjs')
const dir = base + 'out/' + process.argv[2] + '/'
const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort()
const todo = files.map(f => [f, JSON.parse(readFileSync(dir + f, 'utf8'))]).filter(([, r]) => r.check.pedagogy?.model !== 'gemini-3.1-pro-preview' && !r.check.pedagogyPro)
let next = 0
await Promise.all(Array.from({ length: 3 }, async () => {
  while (next < todo.length) {
    const [f, r] = todo[next++]
    try {
      const p = await pedagogyReview(r.item, r.level, 'gemini-3.1-pro-preview')
      const probs = []
      p.questions.forEach((q, i) => { for (const k of ['measures_op', 'single_correct', 'wrong_by_text', 'needs_text', 'reason_logical']) if (q[k] === false) probs.push(`q${i + 1} ${k}`); if (q.key_adds_info) probs.push(`q${i + 1} key_adds_info`) })
      for (const k of ['natural', 'coherent', 'logic_ok', 'level_ok', 'story_quality']) if (p.passage?.[k] === false) probs.push(`passage ${k}`)
      r.check.pedagogyPro = { ...p, model: 'gemini-3.1-pro-preview' }
      writeFileSync(dir + f, JSON.stringify(r, null, 2))
      console.log(r.item.id, probs.length ? 'PROBLEMS: ' + probs.join(', ') + ' — ' + [p.passage?.note, ...p.questions.map(q => q.note)].filter(Boolean).join(' / ').slice(0, 400) : 'ok')
    } catch (e) { console.log(r.item.id, 'ERROR', e.message.slice(0, 120)) }
  }
}))
