import test from 'node:test'
import assert from 'node:assert/strict'
import { generateProblem } from '../../src/lib/mathTemplates.js'
import { planSession, templateTopicFor } from '../../src/lib/mathCurriculum.js'

test('decimal questions: independently calculated answers, all kinds and languages (seed 230923)', () => {
  const original = Math.random
  let seed = 230923
  Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
  try {
    for (const lang of ['en', 'tr', 'es']) {
      const seen = new Set()
      for (let i = 0; i < 2400; i++) {
        const p = generateProblem('decimals-percentages', 10, null, lang, { numericOnly: true })
        const [, kind, ...args] = p.operandKey.split(':')
        const [a, b, scale] = args.map(Number)
        seen.add(kind)
        let expected
        if (kind === 'percent-decimal') expected = a / 100
        else if (kind === 'decimal-percent') expected = a
        else if (kind === 'fraction-decimal') expected = a / b
        else if (kind === 'decimal-fraction') expected = a
        else if (kind === 'compare') expected = (a > b ? a : b) / 1000
        else if (kind === 'round') {
          const factor = 10 ** (3 - b)
          const whole = Math.trunc(a / factor)
          expected = (whole + ((a % factor) * 2 >= factor ? 1 : 0)) / 10 ** b
        } else expected = Number((kind === 'add' ? a / scale + b / scale : a / scale - b / scale).toFixed(3))
        assert.equal(p.correct_answer, expected, p.operandKey)
        // The format describes the ANSWER, not the topic: "write 0.69 as a percentage" is
        // answered with 69, and declaring that 'decimal' puts a point on the keypad the child
        // cannot use and could mistype into. Asserted as the rule rather than as a constant,
        // which is stronger than the original either way.
        assert.equal(p.format, Number.isInteger(p.correct_answer) ? 'numeric' : 'decimal', p.operandKey)
        assert.ok(Number.isFinite(p.correct_answer) && p.correct_answer >= 0)
        assert.ok(p.question_text.length <= 150)
        assert.equal(p.hint_steps.length, 2)
      }
      assert.equal(seen.size, 8)
    }
  } finally { Math.random = original }
})

test('all age-10 slots have templates, including a decimals focus', () => {
  for (const weighting of [{}, {focusTopicId:'y5_decimals', weakTopicIds:['y5_geometry']}]) {
    for (let i=0; i<100; i++) {
      const plan = planSession(10, 10, [], weighting)
      assert.equal(plan.length,10)
      for (const topic of plan) assert.ok(templateTopicFor(topic), topic.id)
      assert.ok(plan.some(t => t.id === 'y5_decimals'))
    }
  }
})
