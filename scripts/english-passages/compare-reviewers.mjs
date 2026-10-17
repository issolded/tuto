// Run the pedagogy reviewer, on several models, over the comparison set (reviewer-set.mjs), twice each,
// and count: faults caught (by the right check), faults missed, and false alarms on clean items.
//
//   node scripts/english-passages/compare-reviewers.mjs [model …]
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REVIEWER_SET } from './reviewer-set.mjs'
import { pedagogyReview } from './agents.mjs'
import { usage } from './llm.mjs'

const models = process.argv.slice(2).length ? process.argv.slice(2) : ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.1-pro-preview']
const RUNS = 2
const logicFlag = p => p.passage?.logic_ok === false || (p.questions || []).some(q => q.reason_logical === false)
const addsFlag = (p, i) => i == null ? (p.questions || []).some(q => q.key_adds_info === true) : p.questions?.[i - 1]?.key_adds_info === true

function judge(item, p) {
  const e = item.expect
  if (e.fault === 'logic') return logicFlag(p) ? 'caught' : 'MISSED'
  if (e.fault === 'adds_info') return addsFlag(p, e.q) ? 'caught' : 'MISSED'
  return logicFlag(p) || addsFlag(p) ? 'FALSE-ALARM' : 'clean'
}

const table = {}
for (const model of models) {
  table[model] = {}
  await Promise.all(REVIEWER_SET.map(async item => {
    const runs = []
    for (let r = 0; r < RUNS; r++) {
      try { const p = await pedagogyReview(item, 'E3', model); runs.push({ verdict: judge(item, p), note: p.passage?.note || p.questions?.map(q => q.note).filter(Boolean).join(' / ') }) }
      catch (e) { runs.push({ verdict: 'ERROR', note: e.message.slice(0, 120) }) }
    }
    table[model][item.id] = runs
  }))
}

const faults = REVIEWER_SET.filter(i => i.expect.fault), clean = REVIEWER_SET.filter(i => !i.expect.fault)
for (const model of models) {
  const t = table[model]
  const count = (items, v) => items.reduce((n, i) => n + t[i.id].filter(r => r.verdict === v).length, 0)
  console.log(`\n${model}: faults caught ${count(faults, 'caught')}/${faults.length * RUNS}, false alarms ${count(clean, 'FALSE-ALARM')}/${clean.length * RUNS}, errors ${count(REVIEWER_SET, 'ERROR')}`)
  for (const i of REVIEWER_SET) console.log(`  ${i.id.padEnd(16)} ${(i.expect.fault || 'clean').padEnd(10)} ${t[i.id].map(r => r.verdict).join(' ')}`)
}
const here = dirname(fileURLToPath(import.meta.url))
writeFileSync(join(here, 'out', `reviewers-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.json`), JSON.stringify({ models, runs: RUNS, table, usage }, null, 2))
console.log(usage)
