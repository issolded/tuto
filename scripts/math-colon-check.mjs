// A colon between two numbers reads as division to a child taught in Turkey ("12 : 4" is 12 ÷ 4
// there) and as a ratio to everyone else. "That is 25 groups of 8: 25 × 8" was read as 8 ÷ 25.
// Text that means "this is the same as" uses "=", a list of counts uses "→", a reason uses a word.
// Ratios are written with a space on both sides ("x : 4") and are not caught.
import { generateProblem } from '../src/lib/mathTemplates.js'
import { templateTopicFor, startingLevelForAge, clampLevelToAge } from '../src/lib/mathCurriculum.js'
import { BRITISH_CURRICULUM, ageToSchoolYear } from '../src/lib/gemini.js'

const PER_TOPIC = Number(process.argv[2]) || 150
const RE = /\d[)²³½]?:\s[(−-]?\d/
const hits = new Map()
const walk = (x, out) => {
  if (typeof x === 'string') out.push(x)
  else if (Array.isArray(x)) x.forEach(y => walk(y, out))
  else if (x && typeof x === 'object') Object.values(x).forEach(y => walk(y, out))
}

for (const age of [5, 6, 7, 8, 9, 10, 11, 12, 13]) {
  const year = ageToSchoolYear(age)
  const level = clampLevelToAge(startingLevelForAge(age), age)
  for (const lang of ['en', 'tr', 'es']) {
    for (const t of BRITISH_CURRICULUM[year].topics) {
      const tt = templateTopicFor(t)
      if (!tt) continue
      for (let i = 0; i < PER_TOPIC; i++) {
        let p
        try { p = generateProblem(tt, level, null, lang) } catch { break }
        const strs = []
        walk(p, strs)
        for (const s of strs) {
          if (!RE.test(s)) continue
          const k = `${lang} ${tt} :: ${s.replace(/\d[\d.,]*/g, 'N').slice(0, 120)}`
          hits.set(k, (hits.get(k) || 0) + 1)
        }
      }
    }
  }
}

if (hits.size) {
  console.log(`✗ ${hits.size} texts put a colon between two numbers:`)
  for (const [k, v] of [...hits].sort()) console.log(`  ${v}× ${k}`)
  process.exit(1)
}
console.log('✓ no colon between two numbers')
