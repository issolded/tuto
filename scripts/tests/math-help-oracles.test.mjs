// The chain audit checks every line that is plain arithmetic. These are the lines that are not —
// "which digit decides", "which place is the middle one", "how many factor pairs" — so each one is
// re-derived here from the QUESTION TEXT alone, by code that shares nothing with the generator.
import test from 'node:test'
import assert from 'node:assert/strict'
import { generateProblem } from '../../src/lib/mathTemplates.js'

const draw = (topic, level, re, tries = 6000) => {
  const out = []
  for (let i = 0; i < tries && out.length < 150; i++) {
    const p = generateProblem(topic, level, null, 'en')
    const m = re.exec(p.question_text)
    if (m && p.help?.kind === 'steps') out.push({ p, m })
  }
  assert.ok(out.length >= 20, `only ${out.length} samples for ${re}`)
  return out
}
const num = s => Number(String(s).replace(/,/g, ''))
const isPrime = n => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true }

test('rounding: the deciding digit is the one just right of the asked place, and the cut is the round-down', () => {
  const places = { 'ten': 10, 'hundred': 100, 'thousand': 1000, '10,000': 10000, '100,000': 100000 }
  for (const { p, m } of draw('place-value', 12, /^Round ([\d,]+) to the nearest ([\d,]+|ten|hundred|thousand)\.$/)) {
    const n = num(m[1]), place = places[m[2]] ?? num(m[2])
    const [d, cut, up] = p.help.steps
    // The digit just RIGHT of the asked place: one place fewer than the place has digits.
    assert.equal(d.a, Number(String(n).at(-(String(place).length - 1))), `${p.question_text}`)
    assert.equal(cut.a, Math.floor(n / place) * place)
    assert.equal(p.help.steps.length, d.a >= 5 ? 3 : 2)
    if (up) assert.equal(up.a, Math.floor(n / place) * place + place)
    assert.equal(p.help.steps.at(-1).a, p.correct_answer)
  }
})

test('decimal rounding: the digit that decides is the next decimal, even when it is a zero the number does not write', () => {
  for (const { p, m } of draw('place-value', 14, /^Round ([\d.]+) \w+ to the nearest (tenth|hundredth)\.$/)) {
    const dp = m[2] === 'tenth' ? 1 : 2
    const digits = Number(m[1]).toFixed(4).split('.')[1]
    assert.equal(p.help.steps[0].a, Number(digits[dp]), p.question_text)
    assert.equal(p.help.steps.at(-1).a, p.correct_answer)
  }
})

test('median chain: the middle place and the value in it, from the list in the question', () => {
  for (const { p, m } of draw('averages', 12, /^What is the median of these numbers\? ([\d, ]+)$/)) {
    const xs = m[1].split(',').map(Number).sort((a, b) => a - b)
    assert.equal(p.help.steps[0].a, (xs.length + 1) / 2)
    assert.equal(p.help.steps[1].a, xs[(xs.length - 1) / 2])
  }
})

test('range chain: the biggest, the smallest and what lies between them', () => {
  for (const { p, m } of draw('averages', 12, /^What is the range of these numbers\? ([\d, ]+)$/)) {
    const xs = m[1].split(',').map(Number)
    assert.deepEqual(p.help.steps.map(s => s.a), [Math.max(...xs), Math.min(...xs), Math.max(...xs) - Math.min(...xs)])
  }
})

test('mean chain: the total, then the total shared out', () => {
  for (const { p } of draw('averages', 12, /What is the mean number of/)) {
    const list = /: ([\d, andy]+)\. What is the mean/.exec(p.question_text)[1].replace(/ and | y /, ', ').split(',').map(Number)
    assert.equal(p.help.steps[0].a, list.reduce((a, b) => a + b, 0))
    assert.equal(p.help.steps[1].a, list.reduce((a, b) => a + b, 0) / list.length)
  }
})

test('factor count: pairs up to the square root, doubled, with a square counted once', () => {
  for (const { p, m } of draw('number-properties', 14, /^How many factors does (\d+) have altogether\?$/)) {
    const n = Number(m[1])
    let all = 0, pairs = 0
    for (let d = 1; d <= n; d++) if (n % d === 0) { all++; if (d * d <= n) pairs++ }
    assert.equal(p.help.steps[0].a, pairs, p.question_text)
    assert.equal(p.help.steps[1].a, all)
  }
})

test('prime sum: every prime between the two numbers, in order, then their sum', () => {
  for (const { p, m } of draw('number-properties', 14, /^Add together all the prime numbers between (\d+) and (\d+)\.$/)) {
    const lo = Number(m[1]), hi = Number(m[2])
    const primes = []
    for (let n = lo + 1; n < hi; n++) if (isPrime(n)) primes.push(n)
    assert.deepEqual(p.help.steps.map(s => s.a), [...primes, primes.reduce((a, b) => a + b, 0)], p.question_text)
  }
})

test('lowest common multiple: each multiple of the bigger number up to the first one the smaller divides', () => {
  for (const { p, m } of draw('number-properties', 14, /^What is the lowest number that both (\d+) and (\d+) divide into exactly\?$/)) {
    const a = Number(m[1]), b = Number(m[2]), big = Math.max(a, b), small = Math.min(a, b)
    const seq = []
    for (let k = 1; ; k++) { seq.push(big * k); if ((big * k) % small === 0) break }
    assert.deepEqual(p.help.steps.map(s => s.a), seq, p.question_text)
  }
})

test('factor pairs with a biggest common factor: it divides both numbers and nothing larger does', () => {
  const gcd = (x, y) => (y ? gcd(y, x % y) : x)
  for (const { p, m } of draw('ratio', 11, /^Write the ratio (\d+):(\d+) in its simplest form\.$/)) {
    const a = Number(m[1]), b = Number(m[2])
    assert.equal(p.help.steps[0].a, gcd(a, b))
    assert.equal(p.help.steps[1].a, a / gcd(a, b))
    assert.equal(p.help.steps[2].a, b / gcd(a, b))
  }
  for (const { p, m } of draw('fraction-of-number', 11, /^Write (\d+)\/(\d+) in its simplest form\.$/)) {
    const a = Number(m[1]), b = Number(m[2])
    assert.equal(p.help.steps[0].a, gcd(a, b))
    assert.equal(`${p.help.steps[1].a}/${p.help.steps[2].a}`, p.correct_answer)
  }
})

test('missing-sign tries: each line is the sign applied to the two numbers and the right sign is among them', () => {
  for (const { p, m } of draw('addition', 8, /^Which sign makes this true\? (\d+) \? (\d+) = (\d+)$/)) {
    const [a, b, r] = [m[1], m[2], m[3]].map(Number)
    const calc = { '+': a + b, '−': a - b, '×': a * b, '÷': a / b }
    const tries = p.help.steps.map(s => [s.q.split(' ')[1], s.a])
    for (const [sign, v] of tries) assert.equal(v, calc[sign])
    assert.ok(tries.some(([sign, v]) => v === r && sign === p.correct_answer), p.question_text)
    assert.ok(tries.filter(([, v]) => v === r).length === 1, 'exactly one sign reaches the result')
  }
})
