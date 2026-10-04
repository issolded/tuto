import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inboundVerdict, inboundRefusal, INBOUND_LIMITS } from '../../server/inboundGate.js'

test('passes under both limits, stops at either', () => {
  assert.deepEqual(inboundVerdict({ lastMinute: 0, lastDay: 0 }), { ok: true })
  assert.deepEqual(inboundVerdict({ lastMinute: INBOUND_LIMITS.perMinute - 1, lastDay: INBOUND_LIMITS.perDay - 1 }), { ok: true })
  assert.equal(inboundVerdict({ lastMinute: INBOUND_LIMITS.perMinute, lastDay: 3 }).reason, 'burst')
  assert.equal(inboundVerdict({ lastMinute: 0, lastDay: INBOUND_LIMITS.perDay }).reason, 'daily')
  // Daily wins when both are hit: "come back tomorrow" is the true answer, "wait a minute" is not.
  assert.equal(inboundVerdict({ lastMinute: 99, lastDay: 999 }).reason, 'daily')
})

test('missing counts never block (a failed count is not a reason to go silent)', () => {
  assert.deepEqual(inboundVerdict(null), { ok: true })
  assert.deepEqual(inboundVerdict({ lastMinute: undefined, lastDay: NaN }), { ok: true })
})

test('refusals exist in all three languages and differ by reason', () => {
  for (const lang of ['en', 'tr', 'es']) {
    const d = inboundRefusal('daily', lang), b = inboundRefusal('burst', lang)
    assert.ok(d && b && d !== b, lang)
  }
  assert.match(inboundRefusal('daily', 'tr'), /yarın/)
})
