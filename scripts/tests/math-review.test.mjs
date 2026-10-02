import test from 'node:test'
import assert from 'node:assert/strict'
import { reviewCandidates, reviewShare, reviewOutcome, carryTopics, REVIEW_MAX } from '../../server/mathReview.js'

const a = (idx, topic_id, o = {}) => ({ idx, topic_id, topic_name: topic_id, source: 'template', correct: true, help_used: false, wrong_tries: 0, ...o })

test('wrong, skipped and two-wrong-tries questions qualify; clean, hinted and one-slip ones do not', () => {
  const picks = reviewCandidates([
    a(0, 't0'),                                             // clean
    a(1, 't1', { correct: false, help_used: true }),        // wrong / skipped
    a(2, 't2', { help_used: true, wrong_tries: 1 }),        // one slip, then right: already paid half, found it
    a(3, 't3', { help_used: true, wrong_tries: 2 }),        // two wrong options, then right
    a(4, 't4', { help_used: true }),                        // opened the hint only
  ])
  assert.deepEqual(picks.map(p => p.idx), [1, 3])
  assert.equal(picks[0].earned, 0)
  assert.equal(picks[1].earned, 0.5)
})

test('the model\'s own questions cannot be asked again', () => {
  assert.deepEqual(reviewCandidates([a(0, 't0', { correct: false, source: 'llm' })]), [])
})

test('at most five, misses before two-wrong ones, one per skill before a skill repeats', () => {
  const attempts = [
    a(0, 'frac', { correct: false }), a(1, 'frac', { correct: false }), a(2, 'frac', { correct: false }),
    a(3, 'time', { help_used: true, wrong_tries: 2 }),
    a(4, 'shape', { correct: false }), a(5, 'data', { correct: false }), a(6, 'mult', { correct: false }),
  ]
  const picks = reviewCandidates(attempts)
  assert.equal(picks.length, REVIEW_MAX)
  // Five different skills, not three fractions: misses of four skills first, then the slow one.
  assert.deepEqual(picks.map(p => p.topic_id).sort(), ['data', 'frac', 'mult', 'shape', 'time'])
  assert.equal(picks.find(p => p.topic_id === 'frac').idx, 0)
})

test('nothing to review in a clean session', () => {
  assert.deepEqual(reviewCandidates(Array.from({ length: 10 }, (_, i) => a(i, `t${i}`))), [])
  assert.deepEqual(reviewCandidates(null), [])
})

test('a review wins back half of what the first round did not pay, never more', () => {
  const miss = { idx: 1, earned: 0 }
  const slow = { idx: 2, earned: 0.5 }
  assert.equal(reviewShare(miss, { correct: true }), 0.5)
  assert.equal(reviewShare(slow, { correct: true }), 0.25)
  assert.equal(reviewShare(miss, { correct: true, help_used: true }), 0.25)
  assert.equal(reviewShare(miss, { correct: false }), 0)
  assert.equal(reviewShare(miss, undefined), 0)
  // First round plus review never exceeds one question's worth, whichever way it went.
  for (const p of [miss, slow]) {
    assert.ok(p.earned + reviewShare(p, { correct: true }) <= 0.75 + 1e-9)
  }
})

test('outcome counts only picked questions, once each, and names what is still missed', () => {
  const picks = [{ idx: 1, earned: 0, topic_id: 'a' }, { idx: 3, earned: 0.5, topic_id: 'b' }]
  const out = reviewOutcome(picks, [
    { idx: 1, correct: true }, { idx: 1, correct: true },   // repeated: counted once
    { idx: 3, correct: false }, { idx: 9, correct: true },  // not picked: ignored
  ], 10)
  assert.equal(out.share, 0.05)
  assert.equal(out.correct, 1)
  assert.deepEqual(out.missed.map(p => p.topic_id), ['b'])
})

test('carried skills are named once', () => {
  assert.deepEqual(carryTopics([{ topic_id: 'a', topic_name: 'A' }, { topic_id: 'a' }, { topic_id: 'b' }]).map(t => t.topic_id), ['a', 'b'])
})

import { mathSessionNotice } from '../../server/mathReview.js'

test('the held parent message tells how the review went, in the parent\'s language', () => {
  const s = { correct: 7, total: 10, gems: 21, capped: false, daily_cap: 3, note: '', kind: 'rewarded' }
  const done = mathSessionNotice('Ada', s, 'en', { state: 'done', asked: 3, correct: 2, gems: 5, topics: [{ topic_id: 'y4_fractions', topic_name: 'Fractions and Decimals' }] })
  assert.match(done.text, /7\/10 correct\. \+21 gems/)
  assert.match(done.text, /2\/3 right, \+5 gems/)
  assert.match(done.text, /Fractions and Decimals/)
  const declined = mathSessionNotice('Ada', s, 'tr', { state: 'declined', asked: 3, topics: [{ topic_id: 'y4_fractions', topic_name: 'Fractions and Decimals' }, { topic_id: 'y3_time', topic_name: 'Time' }] })
  assert.match(declined.text, /istemedi/)
  assert.match(declined.text, /Kesirler ve ondalık sayılar, Saat ve zaman/)
  assert.doesNotMatch(declined.text, /Fractions|Time/)
  const left = mathSessionNotice('Ada', s, 'es', { state: 'expired', asked: 3, started: false, topics: [] })
  assert.match(left.text, /no se hizo/)
  assert.doesNotMatch(left.text, /prioridad|peso/)
  // No review in the story: the message is exactly the old one.
  assert.equal(mathSessionNotice('Ada', s, 'en', null).text, 'Ada did their maths — 7/10 correct. +21 gems 💎')
})

import { TOPIC_IDS, localTopicName } from '../../server/topicNames.js'
import { readFileSync } from 'node:fs'

test('every curriculum topic has a Turkish and a Spanish name, and unknown ids fall back', () => {
  const ids = [...readFileSync(new URL('../../src/lib/gemini.js', import.meta.url), 'utf8').matchAll(/id: "(y\d+_[a-z_0-9]+)", name: "([^"]*)"/g)]
  assert.ok(ids.length > 60)
  for (const [, id, name] of ids) {
    assert.ok(TOPIC_IDS.includes(id), `${id} has no translation in server/topicNames.js`)
    assert.equal(localTopicName(id, name, 'en'), name, `${id}: English name drifted from the curriculum`)
    assert.ok(localTopicName(id, name, 'tr') && localTopicName(id, name, 'es'))
  }
  assert.equal(localTopicName('y99_new', 'New topic', 'tr'), 'New topic')
})
