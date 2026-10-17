// Write passages from premises and put each through the full check, with a short repair loop.
// Nothing here is published: the output is a folder of candidates and a review sheet for a person.
//
//   node scripts/english-passages/run.mjs [level=E3] [count=5] [firstPremise=0]
//
// Output: scripts/english-passages/out/<level>-<stamp>/{<id>.json, REVIEW.md}
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PREMISES } from './premises.mjs'
import { plan, write, planFavourites, writeStory, newDistractors } from './agents.mjs'
import { fullCheck } from './check.mjs'
import { MODELS, usage } from './llm.mjs'
import { NAMES } from '../../src/lib/englishTables.js'
import { LEVELS } from './spec.mjs'

const [level = 'E3', countArg = '5', firstArg = '0'] = process.argv.slice(2)
const COUNT = Number(countArg), FIRST = Number(firstArg)
const LEVELS_OPS = LEVELS[level].ops
const MAX_ROUNDS = 4                 // first draft + up to three repairs/rewrites
const here = dirname(fileURLToPath(import.meta.url))
const dir = join(here, 'out', `${level}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}`)
mkdirSync(dir, { recursive: true })

const premises = PREMISES.filter(p => p.genre !== 'everyday' || level !== 'E3').slice(FIRST, FIRST + COUNT)

// The lot: which option is true, per question. Seeded so a run can be repeated.
function lot(seed, n, options) {
  const out = []
  for (let i = 0; i < n; i++) { seed = (seed * 9301 + 49297) % 233280; out.push(Math.floor(seed / 233280 * options)) }
  return out
}
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 100000, 7)
// What a problem line means for the writer, in words it can act on.
const advice = p => /solved WITHOUT the text|needs_text/.test(p) ? `${p}: someone who never read the story guessed it. Rewrite that question's options so all three are equally ordinary in real life, keeping the TRUE one true.`
  : /solver missed it WITH/.test(p) ? `${p}: a careful reader got it wrong; make the passage state the TRUE option clearly.`
  : p

async function onePlan(premise, k) {
  const names = [NAMES[(k * 5) % NAMES.length], NAMES[(k * 5 + 7) % NAMES.length]]
  const log = []
  let item = null, feedback = null, check = null, planned = null, picks = null, draws = 0
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const fresh = !item || check?.verdict === 'regenerate'
    if (fresh) {
      planned = await plan({ level, premise, names })
      // Up to two re-plans while common sense still has a favourite option somewhere.
      for (let t = 0; t < 2; t++) {
        const fav = await planFavourites(planned)
        const redo = fav.map((f, i) => f === null ? null : { q: i + 1, favourite: planned.questions[i].options[f] }).filter(Boolean)
        log.push({ round, mode: 'plan-check', favourites: redo })
        console.log(`  ${premise.id} plan check: ${redo.length ? redo.map(r => `q${r.q} favours "${r.favourite}"`).join('; ') : 'no favourites'}`)
        if (!redo.length) break
        planned = await plan({ level, premise, names, previous: planned, redo })
      }
      picks = lot(hash(premise.id) + 101 * draws++, planned.questions.length, planned.questions[0]?.options?.length || 3)
    }
    item = await write({ level, premise, names, planned, picks, ...(fresh ? {} : { previous: item, feedback }) })
    check = await fullCheck(item, level, { names, genre: premise.genre })
    log.push({ item, planned, picks, round, mode: fresh ? 'write' : 'repair', verdict: check.verdict, problems: check.problems, warnings: check.gate.warnings, notes: check.notes })
    console.log(`  ${premise.id} round ${round} (${fresh ? 'write' : 'repair'}): ${check.verdict}${check.problems.length ? ' — ' + check.problems.slice(0, 4).join('; ') : ''}`)
    if (check.verdict === 'pass') break
    feedback = check.problems.map(p => `- ${advice(p)}`).join('\n')
    // Solved without the text after all: the plan had a favourite the check missed. Plan again.
    if (check.problems.some(p => /solved WITHOUT the text/.test(p)) && check.verdict === 'revise') check.verdict = 'regenerate'
  }
  return finish(premise, names, item, check, log)
}
function finish(premise, names, item, check, log) {
  const rec = { id: `${level}-${premise.id}`, level, premise, names, models: MODELS, item, check, log, status: check.verdict === 'pass' ? 'awaiting-human' : 'rejected' }
  writeFileSync(join(dir, `${rec.id}.json`), JSON.stringify(rec, null, 2))
  return rec
}

// Story first (default): write the story and its questions, then for each question a reader can guess
// without the story, replace only its wrong options (twice at most). The right option is put in a
// place drawn by lot, so position says nothing either.
const STRATEGY = process.env.STRATEGY || 'story'
function place(item, i, wrong, seed) {
  const q = item.questions[i]
  const right = q.options[q.answer]
  const at = lot(seed, 1, wrong.length + 1)[0]
  const options = [...wrong]; options.splice(at, 0, right)
  item.questions[i] = { ...q, options, answer: at }
}
async function oneStory(premise, k) {
  const names = [NAMES[(k * 5) % NAMES.length], NAMES[(k * 5 + 7) % NAMES.length]]
  const log = []
  let item = null, feedback = null, check = null, draws = 0
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const fresh = !item || check?.verdict === 'regenerate'
    item = await writeStory({ level, premise, names, ...(fresh ? {} : { previous: item, feedback }) })
    item.questions = (item.questions || []).map((q, i) => ({ ...q, op: q.op || LEVELS_OPS[i] }))
    // Writers put the right option first more often than not; the lot decides its place.
    item.questions.forEach((q, i) => { if (q.options?.[q.answer] != null) place(item, i, q.options.filter((_, j) => j !== q.answer), hash(premise.id) + 53 * draws++) })
    for (let t = 0; t < 1; t++) {        // one try at fairer wrong options; the check decides the rest
      const fav = await planFavourites(item)
      const guessed = fav.map((f, i) => f !== null && f === item.questions[i].answer ? i : null).filter(i => i !== null)
      log.push({ round, mode: 'guess-check', guessed: guessed.map(i => i + 1) })
      console.log(`  ${premise.id} guess check: ${guessed.length ? guessed.map(i => `q${i + 1} guessed`).join(', ') : 'none guessed'}`)
      if (!guessed.length) break
      for (const i of guessed) {
        const wrong = await newDistractors({ item, i, favourite: item.questions[i].options[fav[i]], level, names })
        if (wrong.length === item.questions[i].options.length - 1) place(item, i, wrong, hash(premise.id) + 37 * draws++)
      }
    }
    check = await fullCheck(item, level, { names, genre: premise.genre })
    log.push({ item, round, mode: fresh ? 'write' : 'repair', verdict: check.verdict, problems: check.problems, warnings: check.gate.warnings, notes: check.notes })
    console.log(`  ${premise.id} round ${round} (${fresh ? 'write' : 'repair'}): ${check.verdict}${check.problems.length ? ' — ' + check.problems.slice(0, 4).join('; ') : ''}`)
    if (check.verdict === 'pass') break
    feedback = check.problems.map(p => `- ${advice(p)}`).join('\n')
  }
  return finish(premise, names, item, check, log)
}
const one = (p, k) => STRATEGY === 'plan' ? onePlan(p, k) : oneStory(p, k)


// Three premises at a time; each round is one write and eight checks.
const recs = new Array(premises.length)
let next = 0
await Promise.all(Array.from({ length: 3 }, async () => {
  while (next < premises.length) { const k = next++; console.log(`${k + 1}/${premises.length} ${premises[k].id}`); recs[k] = await one(premises[k], k + FIRST).catch(e => { console.log(`  ${premises[k].id} ERROR ${e.message}`); return null }) }
}))

const md = [`# ${level} candidates — ${new Date().toISOString().slice(0, 16)}`, '',
  `Models: writer ${MODELS.generator}, safety ${MODELS.safety} ×2, pedagogy ${MODELS.pedagogy}, blind solver ${MODELS.solver}.`,
  `Passed every automatic check: ${recs.filter(r => r?.status === 'awaiting-human').length}/${recs.length} (errors: ${recs.filter(r => !r).length}). None is approved until a person reads it.`, '']
for (const r of recs.filter(Boolean)) {
  md.push(`## ${r.item.title} — \`${r.id}\` — ${r.status === 'awaiting-human' ? 'PASSED CHECKS, awaiting human' : 'REJECTED'}`, '')
  md.push(`Premise: ${r.premise.premise} _(source: ${r.premise.source})_`, '', '> ' + r.item.passage.replace(/\n/g, '\n> '), '')
  r.item.questions.forEach((q, i) => {
    md.push(`${i + 1}. **${q.stem}** _(${q.op})_`)
    q.options.forEach((o, j) => md.push(`   - ${j === q.answer ? '✅' : '▫️'} ${o}`))
    md.push(`   - evidence: “${q.evidence}”`)
    const s = r.check.solve?.[i]; if (s) md.push(`   - blind solver: with text ${s.withText.filter(Boolean).length}/${s.withText.length}, without ${s.noText.filter(Boolean).length}/${s.noText.length}`)
  })
  md.push('', `Rounds: ${r.log.filter(l => l.verdict).map(l => `${l.round} ${l.mode} → ${l.verdict}`).join(', ')}`)
  for (const l of r.log) if (l.problems?.length) md.push(`- round ${l.round}: ${l.problems.join('; ')}`)
  if (r.check.gate.warnings?.length) md.push(`- warnings: ${r.check.gate.warnings.map(w => w.detail).join('; ')}`)
  if (r.check.notes?.length) md.push(`- reviewer notes: ${r.check.notes.join('; ')}`)
  if (r.check.otherConcerns?.length) md.push(`- safety reviewer notes: ${r.check.otherConcerns.join(' | ')}`)
  md.push(`- vocab: ${r.check.gate.stats.words} words, ${r.check.gate.stats.sentences} sentences, above level: ${r.check.gate.stats.flyers.join(', ') || '—'}`, '')
}
md.push('## Model use', '', ...Object.entries(usage).map(([m, u]) => `- ${m}: ${u.calls} calls, ${u.in} in / ${u.out} out tokens`))
writeFileSync(join(dir, 'REVIEW.md'), md.join('\n'))
console.log(`\n${dir}/REVIEW.md`)
console.log(usage)
