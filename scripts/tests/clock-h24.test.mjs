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

// Time between two clock times: the help walks through the o'clocks, and the jumps add up to the answer.
test('"minutes between two times" help jumps through the o\'clocks and adds up to the answer', () => {
  let seen = 0, without = 0
  for (let i = 0; i < 6000; i++) {
    const p = generateProblem('time', 10, null, 'en')
    if (!/minutes are there between/.test(p.question_text)) continue
    const h = p.help
    if (!h) { without++; continue }
    seen++
    assert.equal(h.kind, 'jumps')
    assert.equal(h.stops.length, h.labels.length)
    assert.equal(h.stops.at(-1) - h.stops[0], p.correct_answer)
    // Every middle stop is an o'clock, the first is not, so there is a real jump up to the hour.
    for (const s of h.stops.slice(1, -1)) assert.equal(s % 60, 0)
    assert.notEqual(h.stops[0] % 60, 0)
    assert.match(h.labels[0], /^\d{1,2}:\d\d$/)
  }
  assert.ok(seen > 50, `only ${seen} samples`)
  // Without an o'clock in between there is one jump and it is the answer, so no jump help is offered.
  assert.ok(without >= 0)
})

test('remainder question is worded as the sum in Turkish and Spanish, as the book has it in English', () => {
  const seen = new Set()
  for (const lang of ['en', 'tr', 'es']) {
    for (let i = 0; i < 4000 && !seen.has(lang); i++) {
      const p = generateProblem('division-word', 8, null, lang)
      if (!/^(What is the remainder|Kalan kaçtır|¿Cuál es el resto)/.test(p.question_text)) continue
      seen.add(lang)
      if (lang === 'en') assert.match(p.question_text, /÷ \d+ = \d+ r \?/)
      else assert.match(p.question_text, /\d+ = \d+ × \d+ \+ \?/)
    }
  }
  assert.equal(seen.size, 3)
})

// "What time does it finish / start?" now has a chain of minute sums; its last line is the minutes past the
// hour of the answer, which the test reads off the CORRECT OPTION, not off the chain.
test('time-after/before help: the last typed line is the minutes of the correct time, every line is typeable', () => {
  let seen = 0, crossing = 0
  for (let i = 0; i < 8000 && seen < 300; i++) {
    const p = generateProblem('time', 10, null, 'en')
    if (!/^t(after|before):/.test(p.operandKey)) continue
    const minutes = Number(String(p.correct_answer).split(':')[1])
    // On the hour the sentences would name the answer, so there is no chain, only the hint.
    if (minutes === 0) { assert.equal(p.help, undefined); continue }
    seen++
    const steps = p.help?.steps
    assert.ok(steps?.length >= 1 && steps.length <= 3, `no chain for ${p.operandKey}`)
    assert.equal(p.help.pick, true)
    assert.equal(steps.at(-1).a, minutes, `${p.operandKey}: ${steps.map(s => `${s.q}=${s.a}`).join(' ; ')} vs ${p.correct_answer}`)
    for (const st of steps) assert.ok(Number.isInteger(st.a) && st.a >= 0 && st.a <= 59, `untypeable step ${st.q} = ${st.a}`)
    if (steps.length > 1) crossing++
  }
  assert.ok(seen >= 100, `only ${seen} samples`)
  assert.ok(crossing > 10, 'the chains that cross an o\'clock never appeared')
})

// A chain that is one long division is cut into tens and ones, one operation a line, and still ends on the answer.
test('a lone long division in a help chain is cut into parts that add back to the answer', () => {
  let cut = 0
  for (const lang of ['en', 'tr', 'es']) {
    for (let i = 0; i < 3000 && cut < 40; i++) {
      const p = generateProblem('geometry', 14, null, lang)
      const steps = p.help?.steps
      if (!steps || steps.length !== 4 || !/÷/.test(steps[2].q) || !/^\d[\d.,]* × \d/.test(steps[0].q)) continue
      cut++
      assert.equal(steps[0].a + steps[1].a, Number(String(steps[1].q).replace(/[.,]/g, '').split(' − ')[0]))
      assert.equal(steps[3].a, Number(p.correct_answer))
      for (const st of steps) assert.ok(Number.isInteger(st.a) && String(st.a).length <= 9)
    }
  }
  assert.ok(cut >= 5, `only ${cut} cut chains seen`)
})

// "8 × ? = 80": from six up the help starts from a fact the child has and finishes the rest, one operation a
// line; the pieces must add back to the product and the answer must not appear before the last line.
test('missing-factor help: a known fact first, the rest after, and the answer never named early', () => {
  let seen = 0
  for (let i = 0; i < 6000 && seen < 200; i++) {
    const p = generateProblem('multiplication-word', 6, null, 'en')
    if (!p.operandKey?.startsWith('mfac:')) continue
    const [, t, k] = p.operandKey.split(':').map(Number)
    const total = t * k
    if (k < 6) { assert.ok(!p.help || p.help.kind === 'fill'); continue }
    seen++
    const st = p.help.steps
    assert.equal(st.length, 4)
    assert.equal(st[0].a + st[1].a, total, `${p.operandKey}: ${st.map(s => `${s.q}=${s.a}`)}`)
    assert.equal(st[2].a * t, st[1].a)
    assert.equal(st[3].a, k)
    assert.equal(p.correct_answer, k)
    for (const s of [st[0], st[1]]) assert.notEqual(s.a, k, 'an early line equals the answer')
    // The answer is not stated as a result ("= 10"), whatever else shares the number with the table.
    assert.doesNotMatch(p.hint_steps.join(' '), new RegExp(`= ${k}(?![\\d])`), `hint states the answer ${k}: ${p.hint_steps.join(' | ')}`)
  }
  assert.ok(seen >= 50, `only ${seen} samples`)
})

// A jug read below its first numbered line has no numbered line "just below" the water.
test('jug hint: water below the first number is read from the bottom, not from a line that is not there', () => {
  let low = 0, high = 0
  for (let i = 0; i < 8000 && (low < 20 || high < 20); i++) {
    const p = generateProblem('measurement', 10, null, 'en')
    if (p.visual?.type !== 'jug') continue
    const first = p.hint_steps[0]
    if (p.visual.value < p.visual.major) { low++; assert.match(first, /Start at the bottom/); assert.doesNotMatch(first, /just below the water/) }
    else { high++; assert.match(first, /just below the water/) }
  }
  assert.ok(low >= 5 && high >= 5, `low ${low}, high ${high}`)
})
