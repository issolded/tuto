// Draws every figure of real server puzzle sheets (server/puzzle, icons off as the app asks) in real
// QuickJS with the app's puzzle bundle, for every band. Fails if any figure comes back undrawn.
import { getQuickJS } from 'quickjs-emscripten'
import { readFileSync } from 'node:fs'
import { generateSession, bandForAge } from '../../server/puzzle/puzzleTemplates.js'

const vm = (await getQuickJS()).newContext()
vm.runtime.setMaxStackSize(1024 * 1024)
const run = (src) => { const r = vm.evalCode(src); if (r.error) { const e = vm.dump(r.error); r.error.dispose(); throw new Error(JSON.stringify(e)) } const v = vm.dump(r.value); r.value.dispose(); return v }
run(readFileSync(new URL('../androidApp/src/main/assets/engine/puzzle.js', import.meta.url), 'utf8'))

const pub = (s) => !s ? null : s.kind === 'glyph' ? { kind: 'glyph', glyph: s.glyph, count: s.count, size: s.size, rotation: s.rotation } : s
let figures = 0, missing = 0, icons = 0, layouts = {}, slow = 0
for (const age of [5, 6, 7, 8, 9, 10, 11, 12]) for (let n = 0; n < 20; n++) {
  const sheet = generateSession(bandForAge(age), 10, 1000 + age * 97 + n, { icons: false })
  for (const q of sheet) {
    layouts[q.layout] = (layouts[q.layout] || 0) + 1
    const specs = [...(q.prompt || []).filter(Boolean).map(pub), ...q.options.filter(o => o.spec).map(o => pub(o.spec))]
    icons += specs.filter(s => s.kind === 'icon').length
    const t = Date.now()
    const out = JSON.parse(run(`TutoPuzzle.draw(${JSON.stringify(JSON.stringify(specs))}, 96)`))
    if (Date.now() - t > 300) slow++
    out.forEach((svg, i) => { figures++; if (!svg || !svg.includes('<svg')) { missing++; if (missing < 5) console.error('undrawn', JSON.stringify(specs[i])) } })
  }
}
vm.dispose()
console.log({ figures, missing, icons, slow, layouts })
if (missing || icons) { console.error('PUZZLE DRAW CHECK FAILED'); process.exit(1) }
console.log('puzzle draw check passed')
