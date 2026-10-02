import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReview, englishSessionNotice, englishReviewLateNotice, skillName } from '../../server/englishReview.js'
import { generateSession, generateItem, itemSignature } from '../../src/lib/englishTemplates.js'
import { reviewOutcome } from '../../server/mathReview.js'

const sheet = generateSession('8-9', 10, 4242, { variety: 'uk' })
const rows = (spec) => sheet.map((q, i) => ({ question_index: i, type: q.type, correct: spec[i]?.[0] ?? true, wrong_tries: spec[i]?.[1] ?? 0, hints_used: spec[i]?.[2] ?? 0 }))
const build = (spec) => buildReview({ attempts: rows(spec), sheet, band: '8-9', variety: 'uk', generateItem, itemSignature, skillOf: (t) => t, seed: 99 })

test('a clean sitting offers nothing; one wrong try with no hint is left alone', () => {
  assert.equal(build({}).picks.length, 0)
  assert.equal(build({ 3: [true, 1, 0] }).picks.length, 0)
})

test('wrong, skipped and hinted questions come back as fresh questions of the same kind', () => {
  const { picks, items } = build({ 1: [false, 2, 0], 4: [false, 0, 0], 6: [true, 0, 1] })
  assert.deepEqual(picks.map(p => p.idx), [1, 4, 6])
  assert.equal(items.length, 3)
  items.forEach((it, k) => assert.equal(it.type, picks[k].topic_id))
  const seen = new Set(sheet.map(itemSignature))
  items.forEach(it => assert.ok(!seen.has(itemSignature(it)), 'never a question the child just saw'))
})

test('at most five are offered', () => {
  const spec = Object.fromEntries(sheet.map((_, i) => [i, [false, 2, 0]]))
  assert.ok(build(spec).picks.length <= 5)
})

test('what the review pays follows the maths rule: only what the sitting paid nothing for', () => {
  const { picks } = build({ 1: [false, 2, 0], 6: [true, 0, 1] })
  const out = reviewOutcome(picks, picks.map(p => ({ idx: p.idx, correct: true, help_used: false })), 10)
  // idx 1 earned 0 -> half a question back; idx 6 was found with a hint -> practice only.
  assert.equal(out.share, 0.5 / 10)
  assert.equal(out.missed.length, 0)
})

test('parent notices read in all three languages and say how the answers were reached', () => {
  const s = { correct: 8, total: 10, gems: 21, capped: false, daily_cap: 3, unaided: 6, helped: 2, kind: 'rewarded' }
  const rv = { state: 'done', asked: 3, correct: 2, gems: 2, topics: [{ topic_id: 'plural', topic_name: 'grammar and word forms' }] }
  for (const lang of ['en', 'tr', 'es']) {
    const m = englishSessionNotice('Ada', s, lang, rv)
    assert.match(m.text, /Ada/)
    assert.match(m.text, /6/)
    assert.ok(!/undefined|NaN/.test(m.text))
    assert.ok(!/maths|matematik|mates/i.test(m.text), lang)
    assert.ok(!/undefined/.test(englishReviewLateNotice('Ada', rv, lang).text))
  }
  assert.match(englishSessionNotice('Ada', s, 'tr', rv).text, /dilbilgisi/)
  assert.equal(skillName('spelling', 'es'), 'ortografía')
})
