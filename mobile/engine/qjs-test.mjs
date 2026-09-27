// Runs the Android engine bundle in real QuickJS (the same engine the app embeds) and checks
// that every age and language produces a full session with drawable figures.
import { getQuickJS } from 'quickjs-emscripten'
import { readFileSync } from 'node:fs'
const code = readFileSync(new URL('../androidApp/src/main/assets/engine/math.js', import.meta.url), 'utf8')
const QJS = await getQuickJS()
const vm = QJS.newContext()
vm.runtime.setMaxStackSize(1024 * 1024)
const run = (src) => { const r = vm.evalCode(src); if (r.error) { const e = vm.dump(r.error); r.error.dispose(); throw new Error(JSON.stringify(e)) } const v = vm.dump(r.value); r.value.dispose(); return v }
let t0 = Date.now(); run(code); console.log('load ms', Date.now() - t0)
let fails = 0, total = 0, figs = {}, skipped = 0, slow = 0
for (const lang of ['en', 'tr', 'es']) for (const age of [5, 6, 7, 8, 9, 10, 11, 12, 13]) for (let n = 0; n < 6; n++) {
  const t = Date.now()
  const out = JSON.parse(run(`TutoMath.buildSession(${JSON.stringify(JSON.stringify({ age, level: null, lang, count: 10 }))})`))
  const ms = Date.now() - t; if (ms > 400) slow++
  total++
  if (out.questions.length < 10) fails++
  skipped += out.skipped.length
  for (const q of out.questions) { const k = q.visual ? q.visual.kind + (q.figure?.svg ? ':svg' : q.figure?.native ? ':native' : ':NONE') : 'none'; figs[k] = (figs[k] || 0) + 1 }
}
console.log({ total, shortSessions: fails, skipped, slowOver400ms: slow })
console.log(Object.entries(figs).sort((a, b) => b[1] - a[1]).map(x => x.join('=')).join('  '))
t0 = Date.now(); const one = JSON.parse(run(`TutoMath.buildSession('{"age":7,"lang":"tr"}')`)); console.log('one session ms', Date.now() - t0)
const withSvg = one.questions.find(q => q.figure?.svg); console.log(withSvg ? withSvg.question + '\n' + withSvg.figure.svg.slice(0, 300) : 'no svg in sample')
console.log(run(`TutoMath.sameAnswer("07", 7)`), run(`TutoMath.sameAnswer("5/8", "5/8")`), run(`TutoMath.sameAnswer("", 0)`))
vm.dispose()
const problems = []
if (fails) problems.push(`${fails} sessions came out shorter than 10 questions`)
if (slow) problems.push(`${slow} sessions took over 400 ms`)
for (const k of Object.keys(figs)) if (k.endsWith(':NONE') && !/^(share|groups|array|clock):/.test(k)) problems.push(`figure kind ${k} rendered nothing`)
if (problems.length) { console.error('ENGINE CHECK FAILED:\n' + problems.join('\n')); process.exit(1) }
console.log('engine check passed')
