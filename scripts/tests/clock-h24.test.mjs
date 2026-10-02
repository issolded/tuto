import test from 'node:test'
import assert from 'node:assert/strict'
import { generateProblem } from '../../src/lib/mathTemplates.js'

// The 24-hour clock question: after midday, say so, ask for the hour only, and never print the
// answer in its own hint.
test('24-hour clock questions name the part of the day, ask for the hour only, and keep the answer out of the hint', () => {
  const seen = new Set()
  for (const lang of ['en', 'tr', 'es']) {
    for (let i = 0; i < 4000 && seen.size < 3 * 3; i++) {
      const p = generateProblem('time', 10, null, lang)
      if (p.visual?.ask !== 'h24') continue
      const ans = p.correct_answer
      const hour12 = ans - 12
      seen.add(`${lang}:${p.visual.part}`)
      assert.ok(ans >= 13 && ans <= 23)
      // The picture and the sentence agree with the hour: 1-5 afternoon, 6-8 evening, 9-11 night.
      assert.equal(p.visual.part, hour12 <= 5 ? 'afternoon' : hour12 <= 8 ? 'evening' : 'night')
      assert.match(p.question_text, lang === 'en' ? /only the hour/ : lang === 'tr' ? /yalnızca saati/ : /solo la hora/)
      for (const h of p.hint_steps) assert.doesNotMatch(h, new RegExp(`(?<!\\d)${ans}(?!\\d)`), `hint names the answer: ${h}`)
    }
  }
  assert.equal(seen.size, 9, `saw ${[...seen]}`)
})
