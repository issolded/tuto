// Measure the reviewers on the trap set: recall per planted problem and false alarms on clean items.
// The gate is reported but not allowed to stop an item, so every trap reaches the model reviewers.
//
//   node scripts/english-passages/trap-check.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TRAPS } from './traps.mjs'
import { fullCheck } from './check.mjs'
import { MODELS, usage } from './llm.mjs'
import { NAMES } from '../../src/lib/englishTables.js'

const here = dirname(fileURLToPath(import.meta.url))
const rows = []
async function judge(t) {
  const c = await fullCheck(t, 'E3', { names: NAMES, skipGate: true })
  const llm = c.problems.filter(p => !p.startsWith('gate '))
  const gateCodes = c.gate.issues.map(i => i.code).filter(x => ['blocklist', 'grown-up-topic', 'regional'].includes(x))
  let outcome
  const e = t.expect
  if (e.kind === 'safety') {
    const exact = Object.keys(c.safety.flags).includes(e.category)
    outcome = exact ? 'caught' : Object.keys(c.safety.flags).length ? 'caught-other-category' : 'MISSED'
  } else if (e.kind === 'pedagogy') {
    const hit = llm.some(p => p.startsWith(`q${e.q} pedagogy ${e.check}`) || (e.check === 'needs_text' && p.startsWith(`q${e.q} solved WITHOUT`)) || (e.check === 'single_correct' && p.startsWith(`q${e.q} solver missed`)))
    outcome = hit ? 'caught' : llm.length ? 'caught-something-else' : 'MISSED'
  } else outcome = llm.length ? 'FALSE-ALARM' : 'clean'
  return { id: t.id, expect: e, outcome, gate: gateCodes, gateDetail: c.gate.issues.filter(i => ['blocklist', 'grown-up-topic', 'regional'].includes(i.code)).map(i => i.detail), flags: c.safety.flags, problems: llm }
}
// Four traps at a time: each one is eight model calls.
const results = new Array(TRAPS.length)
let next = 0
await Promise.all(Array.from({ length: 4 }, async () => { while (next < TRAPS.length) { const i = next++; results[i] = await judge(TRAPS[i]); process.stderr.write('.') } }))
for (const r of results) console.log(`${r.outcome.padEnd(22)} ${r.id.padEnd(18)} ${r.expect.kind === 'safety' ? r.expect.category : r.expect.check || ''}  gate:[${r.gateDetail.join(',')}]  ${r.problems.slice(0, 3).join(' ; ')}`)
const by = k => results.filter(r => r.expect.kind === k)
const n = (arr, f) => arr.filter(f).length
console.log(`\nsafety: exact ${n(by('safety'), r => r.outcome === 'caught')}/${by('safety').length}, any flag ${n(by('safety'), r => r.outcome !== 'MISSED')}/${by('safety').length}, gate words ${n(by('safety'), r => r.gateDetail.length)}/${by('safety').length}`)
console.log(`pedagogy: ${n(by('pedagogy'), r => r.outcome === 'caught')}/${by('pedagogy').length} (any problem ${n(by('pedagogy'), r => r.outcome !== 'MISSED')})`)
console.log(`clean: false alarms ${n(by('clean'), r => r.outcome === 'FALSE-ALARM')}/${by('clean').length}`)
console.log(usage)
mkdirSync(join(here, 'out'), { recursive: true })
writeFileSync(join(here, 'out', `traps-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.json`), JSON.stringify({ models: MODELS, results, usage }, null, 2))
