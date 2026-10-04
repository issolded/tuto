import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appChatView, joinReplies, isMissingTable, APP_CHAT_STALE_MS, APP_CHAT_PHOTO_MS } from '../../server/appChat.js'

const T0 = Date.parse('2026-10-04T12:00:00Z')
const row = (o) => ({ id: 'r1', question: 'Ada bu hafta nasıldı?', answer: null, photos: [], status: 'pending', created_at: new Date(T0).toISOString(), answered_at: null, ...o })

test('a pending question stays pending, then reads as failed once it is stale', () => {
  assert.equal(appChatView(row(), T0 + 10_000).status, 'pending')
  assert.equal(appChatView(row(), T0 + APP_CHAT_STALE_MS + 1).status, 'failed')
  assert.equal(appChatView(row({ status: 'answered', answer: 'ok', answered_at: new Date(T0 + 5000).toISOString() }), T0 + APP_CHAT_STALE_MS * 10).status, 'answered')
})

test('photos are shown only while their signed links still work', () => {
  const r = row({ status: 'answered', answer: '', photos: ['https://x/a.jpg'], answered_at: new Date(T0).toISOString() })
  assert.deepEqual(appChatView(r, T0 + 60_000).photos, ['https://x/a.jpg'])
  assert.deepEqual(appChatView(r, T0 + APP_CHAT_PHOTO_MS + 1).photos, [])
})

test('several replies become one answer; empty ones are dropped', () => {
  assert.equal(joinReplies(['a', '', null, 'b']), 'a\n\nb')
  assert.equal(joinReplies([]), '')
})

test('a missing table is recognised in both shapes, other errors are not', () => {
  assert.equal(isMissingTable({ code: '42P01', message: 'relation "parent_app_chat" does not exist' }), true)
  assert.equal(isMissingTable({ code: 'PGRST205', message: "Could not find the table 'public.parent_app_chat' in the schema cache" }), true)
  assert.equal(isMissingTable({ code: '23505', message: 'duplicate key' }), false)
  assert.equal(isMissingTable(null), false)
})

test('a row without a status reads as pending, never as no state', () => {
  assert.equal(appChatView(row({ status: undefined }), T0 + 1000).status, 'pending')
})
