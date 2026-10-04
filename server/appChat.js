// The app's Ask Tuto history as the screen reads it, with no database and no clock inside it
// (tested by scripts/tests/app-chat.test.mjs).

// An answer is written by a background job after the request has returned. If the server
// restarts in between, the row stays 'pending' forever; past this age it is shown as failed so
// the parent can ask again instead of watching "Tuto is writing…" for good.
export const APP_CHAT_STALE_MS = 3 * 60 * 1000
// Photo links are signed for an hour; an older link is a broken image, not a photo.
export const APP_CHAT_PHOTO_MS = 55 * 60 * 1000

export function appChatView(row, now) {
  const created = Date.parse(row.created_at)
  const answeredAt = row.answered_at ? Date.parse(row.answered_at) : null
  // The column default is 'pending'; a row read back without it (an insert that did not return
  // defaults) is still a question waiting for its answer, not one with no state.
  const status = row.status || 'pending'
  const stale = status === 'pending' && now - created > APP_CHAT_STALE_MS
  const photosFresh = answeredAt != null && now - answeredAt < APP_CHAT_PHOTO_MS
  return {
    id: row.id,
    question: row.question,
    answer: row.answer || '',
    photos: photosFresh && Array.isArray(row.photos) ? row.photos : [],
    status: stale ? 'failed' : status,
    at: row.created_at,
    answeredAt: row.answered_at || null,
  }
}

// Several reply callbacks can fire for one question (the fallback reply, a post-tool reply);
// the screen shows one answer.
export const joinReplies = (replies) => replies.filter(Boolean).map(String).join('\n\n')

// A missing table reads as one of these, depending on which layer answers.
export const isMissingTable = (error) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || /parent_app_chat/.test(error.message || '') && /exist|find|schema cache/i.test(error.message || ''))
