// Put passages written elsewhere (a person, another model) through the same checks as our own writer.
// Input: the JSON array the make-prompt.mjs prompt asks for. Output: out/<name>-<stamp>/REVIEW.md.
//
//   node scripts/english-passages/check-file.mjs <file.json> [level=E3] [name=external] [--all]
//   --all: report the word gate but run the model reviewers even when it fails (to compare writers).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fullCheck } from './check.mjs'
import { PREMISES } from './premises.mjs'
import { MODELS, usage } from './llm.mjs'
import { NAMES } from '../../src/lib/englishTables.js'

const args = process.argv.slice(2).filter(a => a !== '--all'), ALL = process.argv.includes('--all')
const [file, level = 'E3', name = 'external'] = args
const raw = readFileSync(file, 'utf8')
// Either a bare array (make-prompt.mjs) or a draft file with { stories: [...] } and a level per story.
const parsed = raw.trim().startsWith('{') ? JSON.parse(raw) : JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1))
const items = Array.isArray(parsed) ? parsed : parsed.stories
const here = dirname(fileURLToPath(import.meta.url))
const dir = join(here, 'out', `${name}-${level}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}`)
mkdirSync(dir, { recursive: true })
const md = [`# ${name} passages (${level}) — checked ${new Date().toISOString().slice(0, 16)}`, '']
let passed = 0
const sections = new Array(items.length)
async function one(item, k) {
  const md = []
  const premise = PREMISES.find(p => p.id === item.premise) || { id: item.id || `item${k + 1}`, genre: 'fiction', premise: '(none given)', source: name }
  const lv = item.level || level
  const check = await fullCheck(item, lv, { names: NAMES, genre: premise.genre, skipGate: ALL })
  const status = check.verdict === 'pass' ? 'awaiting-human' : 'rejected'
  if (status === 'awaiting-human') passed++
  const id = `${lv}-${name}-${premise.id}`
  writeFileSync(join(dir, `${id}.json`), JSON.stringify({ id, level: lv, premise: { ...premise, source: `${name}: ${premise.source || ''}` }, names: NAMES, models: { ...MODELS, generator: name }, item, check, log: [], status }, null, 2))
  console.log(`${status.padEnd(15)} ${item.title}${check.problems.length ? ' — ' + check.problems.slice(0, 3).join('; ') : ''}`)
  md.push(`## ${item.id ? item.id + ' ' : ''}${item.title} — ${status}`, '', '> ' + item.passage, '')
  item.questions.forEach((q, i) => { md.push(`${i + 1}. **${q.stem}** _(${q.op})_`); q.options.forEach((o, j) => md.push(`   - ${j === q.answer ? '✅' : '▫️'} ${o}`)) })
  md.push('', ...check.problems.map(p => `- ${p}`), ...(check.notes || []).map(n => `- note: ${n}`), '')
  sections[k] = md
}
// Three at a time: each one is eight model calls.
let next = 0
await Promise.all(Array.from({ length: 3 }, async () => { while (next < items.length) { const k = next++; await one(items[k], k) } }))
md.push(...sections.flat())
md.splice(1, 0, `Passed every automatic check: ${passed}/${items.length}.`)
writeFileSync(join(dir, 'REVIEW.md'), md.join('\n'))
console.log(`\n${dir}/REVIEW.md`, usage)
