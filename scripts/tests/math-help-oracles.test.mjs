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

// ── the picture-reading chains: every number is re-read from the visual or the question text ──

const drawAny = (topic, level, re, tries = 8000) => {
  const out = []
  for (let i = 0; i < tries && out.length < 120; i++) {
    const p = generateProblem(topic, level, null, 'en')
    const m = re.exec(p.question_text)
    if (m && p.help?.kind === 'steps') out.push({ p, m })
  }
  assert.ok(out.length >= 15, `only ${out.length} samples for ${re}`)
  return out
}

test('chart reading: each typed value is the bar the picture draws', () => {
  for (const { p, m } of drawAny('chart', 9, /(How many (goals|books|people) .*\?|largest number|altogether|How many more)/)) {
    const v = p.visual
    if (v?.kind !== 'chart' || !v.values) continue
    const a = p.help.steps.map(s => s.a)
    if (/largest number/.test(p.question_text)) assert.deepEqual(a, [...v.values, Math.max(...v.values)])
    else if (/altogether/.test(p.question_text)) assert.deepEqual(a, [...v.values, v.values.reduce((x, y) => x + y, 0)])
    else if (/How many more/.test(p.question_text)) assert.equal(a.at(-1), p.correct_answer)
    else { assert.equal(a.length, 2); assert.ok(v.values.includes(a[1]), 'the value read is one of the bars'); assert.equal(a[0] * v.step, a[1]) }
  }
})

test('translate: the new numbers follow from the start point and the words', () => {
  for (const { p, m } of drawAny('geometry', 10, /^Point A moves (\d+) to the (right|left) and (\d+) (up|down)\./)) {
    const { x, y } = p.visual.points[0]
    const dx = (m[2] === 'right' ? 1 : -1) * Number(m[1]), dy = (m[4] === 'up' ? 1 : -1) * Number(m[3])
    assert.deepEqual(p.help.steps.map(s => s.a), [x + dx, y + dy])
    assert.equal(p.correct_answer, `(${x + dx}, ${y + dy})`)
  }
})

test('square roots: the trial squares climb to the target and the last line is the root', () => {
  for (const { p, m } of drawAny('number-properties', 14, /^What is the square root of (\d+)\?$/)) {
    const sq = Number(m[1]), root = Math.sqrt(sq)
    const a = p.help.steps.map(s => s.a)
    assert.equal(a.at(-1), root)
    assert.ok(a.slice(0, -1).includes(sq), 'one trial lands exactly on the number')
    assert.ok(a.slice(0, -2).every((x, i) => x < a[i + 1]), 'trial squares increase')
  }
})

test('dot patterns: triangular and square terms from their own formula', () => {
  for (const { p, m } of drawAny('number-properties', 14, /^These are the first four (triangular|square) numbers\./)) {
    const tri = m[1] === 'triangular'
    const term = n => (tri ? n * (n + 1) / 2 : n * n)
    const ask = /sixth/.test(p.question_text) ? 6 : 5
    assert.equal(p.help.steps.at(-1).a, term(ask))
    if (tri) assert.deepEqual(p.help.steps.map(s => s.a), Array.from({ length: ask - 4 }, (_, i) => term(5 + i)))
  }
})

test('roman numerals: the chunks add up and are read the way a numeral is read', () => {
  const V = { I: 1, V: 5, X: 10, L: 50, C: 100 }
  const parse = r => { let t = 0; for (let i = 0; i < r.length; i++) t += V[r[i]] < (V[r[i + 1]] || 0) ? -V[r[i]] : V[r[i]]; return t }
  for (const { p, m } of drawAny('place-value', 8, /^What number is ([IVXLC]+) in Roman numerals\?$/, 30000)) {
    assert.equal(parse(m[1]), p.correct_answer)
    const steps = p.help.steps
    assert.equal(steps.at(-1).a, p.correct_answer)
    if (steps.length > 1) assert.equal(steps.slice(0, -1).map(s => parse(s.q)).reduce((x, y) => x + y, 0), p.correct_answer)
    for (const s of steps.slice(0, -1)) assert.equal(parse(s.q), s.a, s.q)
  }
})

test('name of four joined points: parallel pairs, right angles and side lengths pick exactly the named shape', () => {
  const table = { rectangle: [2, 4, 2], rhombus: [2, 0, 1], kite: [0, 0, 2], parallelogram: [2, 0, 2] }
  for (const { p } of drawAny('geometry', 11, /are joined in that order/)) {
    const [par, rt, dist] = p.help.steps.map(s => s.a)
    const name = p.correct_answer
    // A kite can have a right angle where its equal sides meet (a = t), so only its parallel pairs
    // and side lengths are fixed; the other shapes are fixed on all three counts.
    if (name === 'kite') { assert.equal(par, 0); assert.equal(dist, 2) }
    else if (table[name]) assert.deepEqual([par, rt, dist], table[name], name)
    // A trapezium may be a right trapezium (two right angles); one pair of parallel sides is what names it.
    else { assert.equal(name, 'trapezium'); assert.equal(par, 1) }
  }
})

test('pie fractions: parts covered come from the slice the picture draws', () => {
  for (const { p, m } of drawAny('averages', 11, /^The pie chart shows .* How many children chose (.+)\?$/)) {
    const slice = p.visual.slices.find(s => s.label === m[1])
    const lcm = p.visual.parts
    assert.equal(p.help.steps[0].a, (slice.n * lcm) / slice.d)
    assert.equal(p.help.steps.at(-1).a, p.correct_answer)
  }
})

// ── Year 8 ────────────────────────────────────────────────────────────────────────────────────
const gcd2 = (a, b) => (b ? gcd2(b, a % b) : a)
const Y8 = 14 // the level the curriculum puts Year 8 on

test('negative numbers: the size and the sign of the answer, from the expression in the question', () => {
  for (const { p, m } of drawAny('negatives-decimals', Y8, /^(.+) = \?$/, 6000)) {
    if (p.format !== 'choice') continue
    const expr = m[1].replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/(\(-?[\d.]+\))²/g, '($1**2)').replace(/\s+/g, ' ')
    if (!/^[\d\s+\-*/().]+$/.test(expr.replace(/\*\*2/g, ''))) continue
    let v; try { v = Function(`"use strict"; return (${expr})`)() } catch { continue }
    const [size, sign] = p.help.steps
    assert.ok(Math.abs(Math.abs(v) - size.a) < 1e-9, `${m[1]} → size ${size.a}, expected ${Math.abs(v)}`)
    if (sign) assert.equal(sign.a, v > 0 ? 1 : 2, m[1])
    else assert.equal(v, 0)
  }
})

test('highest common factor: Euclid remainders in order, ending on the factor that divides both', () => {
  for (const { p, m } of drawAny('powers-primes', Y8, /^What is the highest common factor \(HCF\) of (\d+) and (\d+)\?$/)) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    const a2 = p.help.steps.map(s => s.a)
    assert.equal(a2.at(-1), gcd2(a, b))
    assert.equal(a2.at(-1), p.correct_answer)
    let [x, y] = a > b ? [a, b] : [b, a]; const want = []
    while (y) { const r = x % y; if (!r) break; want.push(r); ;[x, y] = [y, r] }
    assert.deepEqual(a2.slice(0, -1), want)
  }
})

test('prime factors by repeated division: every quotient is the last one over a prime, and the primes make the number', () => {
  for (const { p, m } of drawAny('powers-primes', Y8, /^Write (\d+) as a product of prime factors, using indices\.$/)) {
    let cur = Number(m[1]); const quotients = p.help.steps.map(s => s.a)
    for (const q of quotients) { const d = cur / q; assert.ok(Number.isInteger(d) && d > 1 && [2, 3, 5, 7, 11, 13].includes(d), `${cur} → ${q}`); cur = q }
    assert.equal(cur, 1)
  }
})

test('summary statistics: mean, median and range recomputed from the list in the question', () => {
  for (const { p, m } of drawAny('stats-8', Y8, /^What is the (mean|median|range) of these numbers\? (.+)$/, 8000)) {
    const xs = m[2].split(',').map(Number), n = xs.length, sorted = [...xs].sort((a, b) => a - b)
    const mean = xs.reduce((a, b) => a + b, 0) / n
    const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    const want = { mean, median, range: sorted[n - 1] - sorted[0] }[m[1]]
    assert.ok(Math.abs(p.help.steps.at(-1).a - want) < 1e-9, `${m[1]} of ${m[2]}`)
    if (m[1] === 'median' && n % 2 === 0) assert.deepEqual(p.help.steps.slice(0, 3).map(s => s.a), [n / 2, sorted[n / 2 - 1], sorted[n / 2]])
  }
})

test('mean from a frequency table: value × frequency per column, their sum, and the number of observations', () => {
  for (const { p } of drawAny('stats-8', Y8, /The table shows/, 8000)) {
    const cells = p.visual.rows[0].cells, vals = p.visual.cols.map(Number)
    const steps = p.help.steps.map(s => s.a)
    assert.deepEqual(steps.slice(0, 4), vals.map((v, i) => v * cells[i]))
    const total = vals.reduce((s, v, i) => s + v * cells[i], 0)
    assert.equal(steps[4], total)
    assert.ok(Math.abs(steps[5] - total / cells.reduce((a, b) => a + b, 0)) < 1e-9)
  }
})

test('two dice: the number of pairs that give the total is counted by brute force', () => {
  for (const { p, m } of drawAny('stats-8', Y8, /^Two fair dice are rolled and the scores added\. What is the probability of a total of (\d+)( or less)?\?$/, 8000)) {
    const T = Number(m[1]); let n = 0
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (m[2] ? a + b <= T : a + b === T) n++
    assert.deepEqual(p.help.steps.map(s => s.a), [n, 36])
  }
})

test('bag of balls: what is left of the colour and in the bag, read from the numbers in the question', () => {
  for (const { p, m } of drawAny('stats-8', Y8, /^A bag has (\d+) grey, (\d+) white and (\d+) black balls\. (\d+) grey, (\d+) white and (\d+) black are taken out\. What is the probability now of picking a (\w+) ball\?$/, 8000)) {
    const c = [m[1], m[2], m[3]].map(Number), r = [m[4], m[5], m[6]].map(Number), i = ['grey', 'white', 'black'].indexOf(m[7])
    assert.deepEqual(p.help.steps.map(s => s.a), [c[i] - r[i], c.reduce((a, b) => a + b, 0) - r.reduce((a, b) => a + b, 0)])
  }
})

test('nth term: the gap, and what has to be added at the end, from the first terms in the question', () => {
  for (const { p, m } of drawAny('sequences-graphs', Y8, /^What is the nth term of ([\d, ]+), …\?$/)) {
    const t = m[1].split(',').map(Number)
    assert.equal(p.help.steps[0].a, t[1] - t[0])
    assert.equal(p.help.steps[1].a, Math.abs(t[0] - (t[1] - t[0])))
  }
})

test('substitution: each line is the expression evaluated with the given letters', () => {
  for (const { p, m } of drawAny('algebra-8', Y8, /^If a = (\d+) and b = (\d+), what is (.+)\?$/, 8000)) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    const js = m[3].replace(/²/g, '**2').replace(/³/g, '**3').replace(/−/g, '-').replace(/(\d)([ab])/g, '$1*$2').replace(/([ab])([ab])/g, '$1*$2').replace(/\)\*\*/g, ')**').replace(/ba/g, 'b*a')
    let v; try { v = Function('a', 'b', `"use strict"; return (${js})`)(a, b) } catch { continue }
    assert.equal(p.help.steps.at(-1).a, v, m[3])
    assert.equal(p.correct_answer, v)
  }
})

test('regular polygons: exterior angles share 360 between the sides', () => {
  for (const { p, m } of drawAny('geometry-8', Y8, /^Each exterior angle of a regular polygon is (\d+)°\. How many sides does it have\?$/)) {
    // 360 ÷ n may be cut into tens and ones (a long division is no help as one line): the LAST line is the sides.
    assert.equal(p.help.steps.at(-1).a, 360 / Number(m[1]))
  }
})

test('Pythagoras: the squares come from the sides the picture draws', () => {
  for (const { p } of drawAny('geometry-8', Y8, /^This triangle has a right angle\./)) {
    const v = p.help.picture ?? p.visual
    const a = Number(v.a), b = v.b === '?' ? null : Number(v.b), c = v.c === '?' ? null : Number(v.c)
    const sq = p.help.steps.map(s => s.a)
    if (b !== null) { assert.deepEqual(sq.slice(0, 3), [a * a, b * b, a * a + b * b]); assert.equal(sq[3] ** 2, a * a + b * b) }
    else { assert.deepEqual(sq.slice(0, 3), [c * c, a * a, c * c - a * a]); assert.equal(sq[3] ** 2, c * c - a * a) }
  }
})
