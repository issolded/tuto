// Audit for the puzzle help (src/lib/puzzleHelp.js): every band and type the engine deals, many seeds.
// Fails when a type has no help written, a rung is missing a language or prints "undefined"/"NaN", rung 2 would cross out
// the right option, or an attribute the rule names has no child-facing word.
import { generateQuestion, BANDS, BAND_KEYS } from '../src/lib/puzzleTemplates.js'
import { puzzleHintAt, puzzleAllHelp, PUZZLE_HELP_TYPES } from '../src/lib/puzzleHelp.js'
import { ATTR } from '../src/lib/puzzleExplain.js'

const N = Number(process.argv[2]) || 40
const bad = []
const note = (m) => { if (bad.length < 40) bad.push(m) }
const types = new Set()
let checked = 0
for (const bk of BAND_KEYS) {
  for (const type of [...BANDS[bk].types, null, null, null, null]) {
    for (const icons of [true, false]) for (let s = 1; s <= N; s++) {
      const q = generateQuestion(bk, type, s * 7919 + 11 + (type === null ? s * 31 : 0), { icons })
      if (!q) continue
      checked++; types.add(q.type)
      if (!PUZZLE_HELP_TYPES.includes(q.type)) { note(`${q.type}: no help written`); continue }
      for (const lang of ['en', 'tr', 'es']) {
        for (const lvl of [1, 3]) {
          const h = puzzleHintAt(q, lvl, lang)
          if (!h.text || h.text.length < 15 || /undefined|NaN|\[object/.test(h.text)) note(`${q.type} ${bk} ${lang} rung${lvl}: "${h.text}"`)
        }
      }
      for (const lang of ['en', 'tr', 'es']) {
        const r = puzzleHintAt(q, 2, lang)
        if (r.text != null && (r.text.length < 12 || /undefined|NaN|\[object|\{/.test(r.text))) note(`${q.type} ${bk} ${lang} rung2 reason: "${r.text}"`)
      }
      const eg = []
      const h2 = puzzleHintAt(q, 2, 'en', { eliminated: eg })
      if (h2.eliminate === q.correct_index) note(`${q.type} ${bk}: rung 2 crosses out the right option`)
      for (const a of String(q.rule?.attr ?? '').replace(/^code:/, '').split('+')) {
        if (a && /^(shape|fill|rotation|size|stretch|half|dots|corner|inner|position|flip)$/.test(a) && !ATTR.en[a]) note(`${q.type}: attribute ${a} has no word`)
      }
    }
  }
}
// A type that is rare in sessions may simply not come up in a sample: said, not failed.
for (const t of PUZZLE_HELP_TYPES) if (!types.has(t)) console.log(`(note) ${t} not dealt in this sample`)
console.log(`${checked} questions, ${types.size} types`)
if (bad.length) { console.log(bad.join('\n')); process.exit(1) }
console.log('ok')
