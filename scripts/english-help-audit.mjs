// Audit for the English help (src/lib/englishHelp.js): every question type, every band, both
// varieties, many seeds. Fails when
//   - a type has no help written, or the builder throws,
//   - a rung is missing a language, or prints "undefined" / "NaN" / "[object",
//   - rung 1 or 3 (what a child sees BEFORE answering) contains a right option, whole-word, unless
//     the question itself printed that word,
//   - the explanation does not name the right option (it is what a wrong answer is owed),
//   - an option crossed out at rung 2 is a right one.
// Usage: node scripts/english-help-audit.mjs [seedsPerType]
import { generateItem, BANDS } from '../src/lib/englishTemplates.js'
import { allHelp, hintAt, explanation, visualFor, HELP_TYPES } from '../src/lib/englishHelp.js'

const N = Number(process.argv[2]) || 60
const LANGS = ['en', 'tr', 'es']
const bad = []
const leaks = []
const note = (m) => { if (bad.length < 40) bad.push(m) }
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const printed = (it) => JSON.stringify(it.prompt).toLowerCase()
const STATIC = new Map()   // type|lang -> Map(word -> count)
let checked = 0
const types = new Set()
const seenTypes = new Set()

for (const [bk, band] of Object.entries(BANDS)) {
  for (const type of band.types) {
    seenTypes.add(type)
    if (!HELP_TYPES.includes(type)) { note(`${type}: no help written`); continue }
    for (const variety of ['uk', 'us']) {
      for (let s = 1; s <= N; s++) {
        const it = generateItem(bk, type, s * 7919 + 13, { variety })
        if (!it) continue
        checked++
        types.add(type)
        let h
        try { h = allHelp(it) } catch (e) { note(`${type} ${bk} seed ${s}: ${e.message}`); continue }
        const right = it.correct.map(i => it.options[i].text.toLowerCase())
        const before = [h.tip, ...h.steps.slice(0, Math.max(1, h.steps.length - 1))]
        for (const lang of LANGS) {
          for (const l of [h.tip, ...h.steps]) {
            const text = l[lang]
            if (!text || /undefined|NaN|\[object|\{\w+\}/.test(text)) note(`${type} ${bk} ${lang}: bad text "${text}"`)
          }
          const joined = before.map(l => (l[lang] || '').toLowerCase()).join(' | ')
          const key = `${type}|${lang}`
          const freq = STATIC.get(key) || { n: 0, words: new Map() }
          STATIC.set(key, freq)
          freq.n++
          for (const w of new Set(joined.split(/[^\p{L}]+/u))) freq.words.set(w, (freq.words.get(w) || 0) + 1)
          for (const r of right) {
            if (r.length < 3 || printed(it).includes(r)) continue
            // Listing ALL the options the child can see ("-ance / -ence") is not giving one away.
            if (it.options.length > 1 && it.options.every(o => joined.includes(o.text.toLowerCase())) && it.options.length <= 5 && it.type === 'ending') continue
            if (new RegExp(`(^|[^\\p{L}])${esc(r)}([^\\p{L}]|$)`, 'u').test(joined)) leaks.push({ key, r, msg: `${type} ${bk} seed ${s} ${lang}: hint before answering says "${r}": ${joined}` })
          }
        }
        const ex = explanation(it, 'en').join(' ').toLowerCase()
        if (right.some(r => r.length >= 3) && !right.some(r => ex.includes(r))) note(`${type} ${bk} seed ${s}: explanation does not name the answer`)
        // The picture shown while the question is open must not carry the answer; filled in, it must.
        const open = JSON.stringify(visualFor(it, false) ?? '', (k, v) => (k === 'kind' ? undefined : v)).toLowerCase()
        const filled = JSON.stringify(visualFor(it, true) ?? '').toLowerCase()
        for (const r of right) {
          if (r.length >= 3 && !['alpha-order'].includes(type) && open.includes(`"${r}"`) && !printed(it).includes(r)) note(`${type} ${bk} seed ${s}: open picture holds the answer "${r}"`)
        }
        const fv = visualFor(it, true)
        const filledCode = fv?.line ? fv.line.map(c => c.bottom).join('').toLowerCase() : ''
        if (type === 'letter-code' && !right.some(r => r.replace(/\s+/g, '').toLowerCase() === filledCode)) note(`${type} ${bk} seed ${s}: filled code row does not spell the answer`)
        if (type === 'letter-analogy') {
          const L = fv.question.map(q => q.to).join(''), D = fv.numbers?.ans ?? ''
          if (!right.some(r => (r.toUpperCase().match(/[A-Z]/g) || []).join('') === L && r.replace(/[a-z]/gi, '') === D)) note(`${type} ${bk} seed ${s}: filled picture does not spell the answer (${L}${D})`)
        }
        if (['change-pattern', 'word-ladder', 'letter-sum'].includes(type) && right.some(r => r.length >= 1) && !right.some(r => filled.includes(r.toLowerCase()))) note(`${type} ${bk} seed ${s}: filled picture lacks the answer`)
        const h2 = hintAt(it, 2, 'en')
        if (h2.eliminate != null && it.correct.includes(h2.eliminate)) note(`${type} ${bk}: rung 2 crosses out a right option`)
      }
    }
  }
}
// A word the type's help prints on (almost) every question is its own wording, not the question's
// content; the answer only leaks if the word is rare in that help.
for (const l of leaks) {
  const f = STATIC.get(l.key)
  if ((f.words.get(l.r) || 0) / f.n < 0.5) note(l.msg)
}
for (const t of HELP_TYPES) if (!seenTypes.has(t)) note(`${t}: written but in no band`)
console.log(`${checked} items, ${types.size} types`)
if (bad.length) { console.log(bad.join('\n')); process.exit(1) }
console.log('ok')
