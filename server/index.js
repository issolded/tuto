import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import axios from 'axios'
import FormData from 'form-data'
import exifr from 'exifr'
import { connectParent, sendMessage, setMessageHandler, setConnectHandler, restoreSessions, isConnected, disconnectParent } from './whatsapp.js'
import { startTelegramBot, sendTelegramMessage, sendTelegramPhoto, sendTelegramMediaGroup, getTelegramChatId, setTelegramMessageHandler, sendTelegramTyping } from './telegram.js'
import crypto, { randomUUID } from 'crypto'
import { homeworkObservationPrompt, parseObservation, filterForParent, homeworkCaptionPrompt, fallbackCaption } from './prompts/homework.js'
import { imageSafetyPrompt, parseImageSafety } from './prompts/imageSafety.js'
import { purgeOldPhotos } from './jobs/purgeOldPhotos.js'

// Default homework reward when a child's task_settings has no homework entry
// yet. Parent can override it from Task settings (dashboard). Read SERVER-SIDE
// only — gems_earned is never taken from the client.
const HOMEWORK_DEFAULT_GEMS = 25

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`

// Transient-only: 503/429/"overloaded"/"high demand" get retried, everything
// else (400 bad prompt, etc.) throws immediately — a real bug shouldn't repeat 3x.
function isRetryableGeminiError(err) {
  if (err?.status === 503 || err?.status === 429) return true
  return /overloaded|high demand|unavailable|rate.?limit|resource_exhausted/i.test(err?.message || '')
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const GEMINI_RETRY_DELAYS_MS = [500, 1500, 4000]

// Runs `fn` (one attempt at a Gemini call) with retry-on-transient-failure:
// up to 3 retries (4 attempts total) with exponential backoff + jitter.
// Non-retryable errors propagate immediately without waiting.
async function callGeminiWithRetry(fn) {
  let lastErr
  for (let i = 0; i <= GEMINI_RETRY_DELAYS_MS.length; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i === GEMINI_RETRY_DELAYS_MS.length || !isRetryableGeminiError(err)) throw err
      const base = GEMINI_RETRY_DELAYS_MS[i]
      const delay = base + Math.random() * base * 0.2
      console.warn(`[MSG] Gemini transient error, retry ${i + 1}/${GEMINI_RETRY_DELAYS_MS.length} in ${Math.round(delay)}ms: ${err.message}`)
      await sleep(delay)
    }
  }
  throw lastErr
}

// One attempt at a Gemini call — resolves with parsed JSON, or throws an
// Error with `.status` set to the HTTP status so callGeminiWithRetry can
// tell a transient failure from a real one.
async function fetchGeminiOnce(body) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    const err = new Error(errBody.error?.message || `Gemini API error ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

const GEMINI_FALLBACK_REPLY = {
  tr: 'Şu an yapay zeka platformumdaki bir teknik sorun nedeniyle mesajla yanıt veremiyorum. Bunu çözene kadar tüm ayarlara ve onaylara Tuto uygulaması üzerinden erişebilirsiniz.',
  en: "I'm currently unable to reply due to a technical issue with my AI platform. Until this is resolved, you can access all settings and approvals through the Tuto app.",
}

async function getParentContext(parentId) {
  const [{ data: parentRow }, { data: children }] = await Promise.all([
    supabase.from('parents').select('timezone, prefs').eq('id', parentId).single(),
    supabase.from('children').select('id, name, age, task_settings').eq('parent_id', parentId),
  ])
  if (!children?.length) return []

  const tz = parentRow?.timezone || 'UTC'
  const userNow = DateTime.now().setZone(tz)
  const todayStart = userNow.startOf('day').toUTC().toISO()
  const todayEnd   = userNow.endOf('day').toUTC().toISO()
  const parentPrefs = parentRow?.prefs ?? null

  return Promise.all(children.map(async child => {
    const [
      { data: submissions },
      { data: todaySubs },
      { data: mathProgress },
      { data: ledger },
      { data: stories },
      { data: books },
      { data: pendingContribs, error: pendingError },
      { data: pendingSubs },
      treeState,
      { data: pendingPaintings },
    ] = await Promise.all([
      supabase.from('submissions').select('task_type, score, gems_earned, status, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('submissions').select('task_type, score, gems_earned, status, created_at').eq('child_id', child.id).gte('created_at', todayStart).lte('created_at', todayEnd).order('created_at', { ascending: false }),
      supabase.from('math_progress').select('level, topic, accuracy, level_change, help_used, questions_total, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('bt_ledger').select('amount, reason, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('stories').select('title, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(5).then(r => r).catch(() => ({ data: [] })),
      supabase.from('books').select('title, completed, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(5).then(r => r).catch(() => ({ data: [] })),
      supabase.from('contribution_log').select('id, label, category, created_at').eq('child_id', child.id).eq('status', 'pending').order('created_at', { ascending: false }),
      // Pending submissions (homework/chore) awaiting a parent reply — WITH ids
      // so the parent can approve/reject by free text ("onayla", "25 gem yeter").
      supabase.from('submissions').select('id, task_type, task_description, suggested_gems, photo_taken_at, created_at, photo_urls, media_url, status').eq('child_id', child.id).in('status', ['pending', 'blocked']).order('created_at', { ascending: false }),
      // The tree is its own thing — a kindness diary, not a function of gems or
      // math level. Without it in context the model answered "how is the tree?"
      // by improvising from gems/level/stories, which is a different subject.
      getTreeState(child.id, tz).catch(() => null),
      supabase.from('paintings')
        .select('id, drawing_id, created_at')
        .eq('child_id', child.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ])

    const sub = submissions || []
    const math = mathProgress || []
    const led = ledger || []
    const today = todaySubs || []
    const pendingContributions = pendingContribs || []

    // A failed read here must NEVER be reported as "no pending contributions" —
    // that's a false negative a parent could act on (or rather, not act on).
    // Surface the failure explicitly instead of silently coercing it to [].
    if (pendingError) console.error(`[CONTEXT] pending contributions read failed for child=${child.id}: ${pendingError.message}`)

    return {
      name: child.name,
      age: child.age,
      totalGems: led.reduce((s, r) => s + (r.amount || 0), 0),
      todaySubmissions: today.length ? today : `${child.name} has not completed any tasks today`,
      submissions: sub.length ? sub : `${child.name} has not completed any tasks yet`,
      mathProgress: math.length ? math : `${child.name} has not done any math yet`,
      gemHistory: led.length ? led : `${child.name} has no gem history yet`,
      stories: (stories || []).length ? stories : `${child.name} has not written any stories yet`,
      books: (books || []).length ? books : `${child.name} has not read any books yet`,
      pendingContributions: pendingError
        ? `${child.name}'s pending contributions could not be read right now (temporary error) — do NOT say there are none, tell the parent you couldn't check and to ask again shortly`
        : (pendingContributions.length ? pendingContributions : `${child.name} has no contributions awaiting approval`),
      pendingCheckFailed: !!pendingError,
      // Drawings wait for the parent too, but they are NOT submissions — a
      // different table and different approve/reject tools.
      pendingDrawings: (pendingPaintings || []).map(p => ({
        id: p.id,
        what: p.drawing_id || 'kendi çizimi',
        created_at: p.created_at,
      })),
      tree: treeState
        ? {
            leavesToday: treeState.today,
            leavesForAFullTreeToday: treeState.dayFull,
            todaysTreeFullyGrown: treeState.todayComplete,
            treesThisMonth: treeState.monthTreeCount,
            daysElapsedThisMonth: treeState.monthDaysElapsed,
            leavesThisMonth: treeState.monthLeafCount,
            month: treeState.monthName,
            recentLeaves: treeState.recentLeaves.length
              ? treeState.recentLeaves
              : `${child.name} has no approved contributions this month yet`,
          }
        : `${child.name}'s tree could not be read right now (temporary error) — tell the parent you couldn't check it, do NOT guess`,
      pendingSubmissions: (pendingSubs || []).map(s => {
        // Photo count MUST be in context: without it the model confidently told
        // a parent the homework was "saved without any photo" while the photos
        // were sitting right there in the dashboard.
        const urls = (s.photo_urls?.length ? s.photo_urls : (s.media_url ? [s.media_url] : []))
        return {
          id: s.id,
          task_type: s.task_type,
          status: s.status,
          description: s.task_description || (s.task_type === 'homework' ? 'Ödev' : s.task_type),
          suggested_gems: s.suggested_gems ?? null,
          photo_taken_at: s.photo_taken_at ?? null,
          created_at: s.created_at,
          photoCount: urls.length,
        }
      }),
      parentPrefs,
    }
  }))
}

async function askGeminiWithContext(parentId, userMessage) {
  const [familyData, { data: parentRow }] = await Promise.all([
    getParentContext(parentId),
    supabase.from('parents').select('timezone').eq('id', parentId).single(),
  ])
  const tz = parentRow?.timezone || 'UTC'
  const userNow = DateTime.now().setZone(tz)
  const localTimeStr = `${userNow.toFormat('yyyy-MM-dd HH:mm')} (${tz})`

  const systemPrompt =
    `You are Tuto, a warm AI learning assistant and trusted family companion.\n` +
    `Current local time for parent: ${localTimeStr}\n` +
    `You know this family's learning data:\n${JSON.stringify(familyData, null, 2)}\n\n` +
    `Guidelines:\n` +
    `- Respond in the SAME LANGUAGE as the parent's message\n` +
    `- Be conversational and warm, like a trusted friend who knows the kids\n` +
    `- Reference specific data when relevant (e.g. "Ada earned 30 gems yesterday!")\n` +
    `- Keep responses concise — max 3-4 sentences for simple questions\n` +
    `- For progress questions, give concrete insights from the data\n\n` +
    `CRITICAL: Only report facts from the data provided.\n` +
    `If the data is empty or null, say so honestly.\n` +
    `NEVER invent or assume activity that is not in the data.\n` +
    `If a field is empty, say the child hasn't done that yet.`

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini API error ${res.status}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Yanıt alınamadı.'
}

async function _geminiScreenCall(text, age) {
  const n = Number(age) || 7
  const prompt =
    `You are a child-safety classifier for a children's educational app. ` +
    `A ${n}-year-old child wrote this text about something they did or are feeling: "${text.replace(/"/g, '\\"')}"\n\n` +
    `Classify on TWO independent axes and return JSON only:\n` +
    `{\n` +
    `  "appropriateness": "ok" | "inappropriate",\n` +
    `  "concern_level": "none" | "mild" | "concerning" | "serious",\n` +
    `  "reason": "<short explanation>"\n` +
    `}\n\n` +
    `appropriateness: "inappropriate" if the text contains profanity, explicit content, violence, or adult themes. Otherwise "ok".\n` +
    `concern_level rules:\n` +
    `  - "none": no emotional or safety concern.\n` +
    `  - "mild": temporary/normal emotion (sad, bored, angry) with no distress signals.\n` +
    `  - "concerning": repeated or intense distress, loneliness, feeling unloved/worthless, persistent fear.\n` +
    `  - "serious": any hint of self-harm, harm to others, abuse, or a genuine safety signal.\n` +
    `The two axes are INDEPENDENT. A text can be appropriate but concerning, or inappropriate but not concerning.\n` +
    `"serious" should only be used when there is a real, unambiguous signal — not for hyperbolic child language like "I want to kill this homework".`

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_mime_type: 'application/json' },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini API error ${res.status}`)
  }
  const data = await res.json()
  const parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
  if (!['ok', 'inappropriate'].includes(parsed.appropriateness)) throw new Error('malformed screen response')
  if (!['none', 'mild', 'concerning', 'serious'].includes(parsed.concern_level)) throw new Error('malformed screen response')
  return parsed
}

async function _geminiConfirmSerious(text, age) {
  const n = Number(age) || 7
  const prompt =
    `You are a second-opinion child-safety reviewer. A first classifier flagged this text from a ${n}-year-old as ` +
    `a SERIOUS safety signal: "${text.replace(/"/g, '\\"')}"\n\n` +
    `Is this truly a serious safety signal (self-harm, harm to others, abuse), or is it most likely hyperbolic ` +
    `child language, frustration, or play? Return JSON only:\n` +
    `{ "confirmed_serious": boolean, "reason": "<short explanation>" }`

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_mime_type: 'application/json' },
    }),
  })
  if (!res.ok) return { confirmed_serious: true } // fail-closed on confirm step
  const data = await res.json()
  const parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
  return parsed
}

async function screenChildInput(text, age) {
  const result = await _geminiScreenCall(text, age)

  if (result.concern_level === 'serious') {
    try {
      const confirm = await _geminiConfirmSerious(text, age)
      if (!confirm.confirmed_serious) {
        result.concern_level = 'concerning'
      }
    } catch {
      // fail-closed: keep serious
    }
  }

  return result
}

// The single server-side image safety gate for every child photo upload
// (homework + chore). screenChildInput above only classifies TEXT — it never
// sees the picture — so this is what actually stops an inappropriate image.
// FAILS CLOSED: any transport error, model refusal or malformed response
// returns "not appropriate" so the caller blocks rather than forwards.
async function screenImageSafety({ images, kind, language }) {
  try {
    const parts = [
      { text: imageSafetyPrompt({ kind, language }) },
      ...images.map(i => ({ inline_data: { mime_type: i.mimeType, data: i.buffer.toString('base64') } })),
    ]
    const data = await callGeminiWithRetry(() => fetchGeminiOnce({
      contents: [{ parts }],
      generationConfig: { response_mime_type: 'application/json' },
    }))
    return parseImageSafety(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
  } catch (err) {
    console.error(`[SAFETY] ${kind} image screen failed (failing closed): ${err.message}`)
    return { appropriate: false, matchesTask: false, reason: 'safety check failed' }
  }
}

// 'https://…/storage/v1/object/public/submissions/<path>' → '<path>', so a
// blocked upload can be deleted from Storage instead of lingering there.
function storagePathFromPublicUrl(url) {
  const marker = '/storage/v1/object/public/submissions/'
  const i = String(url || '').indexOf(marker)
  return i === -1 ? null : decodeURIComponent(String(url).slice(i + marker.length))
}

// Child photos of real homework / real rooms live in a PRIVATE bucket and are
// only ever readable through a short-lived signed URL. The old public
// 'submissions' bucket stays as-is for story covers (AI cover art, shown
// directly by the unauthenticated child app) and for legacy rows.
const PHOTO_BUCKET = 'submission-photos'

// Photos of the child's own drawings. Private, and — unlike the homework and
// chore buckets — written ONLY by the service role from this file. There is no
// client upload policy on it at all. Declared next to PHOTO_BUCKET because
// signedUrlFor() below has to be told which of the two a path belongs to.
const PAINTING_BUCKET = 'paintings'

// New rows store a storage PATH; legacy rows store a full public URL. Anything
// starting with http is legacy public and returned untouched; everything else
// is signed against the private bucket.
// `bucket` matters: a path only signs against the bucket it actually lives in.
// Drawing photos live in PAINTING_BUCKET, and signing them against the homework
// bucket silently returned null — which made the Telegram photo fall back to a
// text-only message and left the library and dashboard blank.
async function signedUrlFor(pathOrUrl, expiresIn = 3600, bucket = PHOTO_BUCKET) {
  const v = String(pathOrUrl || '')
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v // legacy public URL
  let { data, error } = await supabase.storage.from(bucket).createSignedUrl(v, expiresIn)
  if (error && bucket === PHOTO_BUCKET) {
    // Transitional: a path written before the private bucket existed.
    ;({ data, error } = await supabase.storage.from('submissions').createSignedUrl(v, expiresIn))
  }
  if (error) {
    console.error(`[STORAGE] could not sign ${v} in ${bucket}: ${error.message}`)
    return null
  }
  return data.signedUrl
}

async function signedUrlsFor(list, expiresIn = 3600) {
  const out = await Promise.all((list || []).map(v => signedUrlFor(v, expiresIn)))
  return out.filter(Boolean)
}

// Reads a stored photo's bytes for server-side work (safety screen, EXIF),
// handling both new private-bucket paths and legacy public URLs.
async function readStoredPhoto(pathOrUrl) {
  const v = String(pathOrUrl || '')
  if (/^https?:\/\//i.test(v)) {
    const legacyPath = storagePathFromPublicUrl(v)
    if (!legacyPath) throw new Error('unrecognized photo location')
    const { data, error } = await supabase.storage.from('submissions').download(legacyPath)
    if (error || !data) throw new Error(error?.message || 'download failed')
    return Buffer.from(await data.arrayBuffer())
  }
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(v)
  if (error || !data) throw new Error(error?.message || 'download failed')
  return Buffer.from(await data.arrayBuffer())
}

async function sendNotification(parentId, message) {
  const { data: parent } = await supabase
    .from('parents')
    .select('notification_channel, telegram_chat_id, whatsapp_phone')
    .eq('id', parentId)
    .single()

  const channel = parent?.notification_channel || 'none'
  console.log(`[NOTIFY] parent=${parentId} channel="${channel}" telegram_chat_id=${parent?.telegram_chat_id ?? 'null'} whatsapp_phone=${parent?.whatsapp_phone ?? 'null'}`)

  // ── Telegram ──────────────────────────────────────────────────────────────
  if (channel === 'telegram' && parent?.telegram_chat_id) {
    try {
      await sendTelegramMessage(parent.telegram_chat_id, message)
      console.log(`[NOTIFY] ✅ Sent via Telegram → parent ${parentId}`)
      return
    } catch (err) {
      console.error(`[NOTIFY] ❌ Telegram failed: ${err.message}`)
    }
  }

  // ── WhatsApp Business API ─────────────────────────────────────────────────
  if (channel === 'whatsapp' && parent?.whatsapp_phone) {
    try {
      await sendWhatsAppBusinessMessage(parent.whatsapp_phone, message)
      console.log(`[NOTIFY] ✅ Sent via WhatsApp Business → parent ${parentId}`)
      return
    } catch (err) {
      console.error(`[NOTIFY] ❌ WhatsApp Business failed: ${err.message}`)
    }
  }

  // ── Baileys fallback (pairing-code sessions) ──────────────────────────────
  if (isConnected(parentId)) {
    try {
      const { data: child } = await supabase
        .from('children')
        .select('parent_phone')
        .eq('parent_id', parentId)
        .not('parent_phone', 'is', null)
        .limit(1)
        .single()
      if (child?.parent_phone) {
        await sendMessage(parentId, child.parent_phone, message)
        console.log(`[NOTIFY] ✅ Sent via Baileys WhatsApp → parent ${parentId}`)
        return
      }
    } catch (err) {
      console.error(`[NOTIFY] ❌ Baileys fallback failed: ${err.message}`)
    }
  }

  console.log(`[NOTIFY] ⚠️ No working channel for parent ${parentId} (channel="${channel}") — message dropped`)
}

async function sendNotificationWithPhoto(parentId, message, photoUrl, bucket = PHOTO_BUCKET) {
  // Sign at the boundary: the messaging platform fetches the image once, so a
  // short TTL is plenty and no long-lived public link ever leaves the server.
  photoUrl = (await signedUrlFor(photoUrl, 900, bucket)) || photoUrl

  const { data: parent } = await supabase
    .from('parents')
    .select('notification_channel, telegram_chat_id, whatsapp_phone')
    .eq('id', parentId)
    .single()

  const channel = parent?.notification_channel || 'none'
  console.log(`[NOTIFY-PHOTO] parent=${parentId} channel="${channel}" telegram_chat_id=${parent?.telegram_chat_id ?? 'null'} whatsapp_phone=${parent?.whatsapp_phone ?? 'null'}`)

  // ── Telegram with photo ───────────────────────────────────────────────────
  if (channel === 'telegram' && parent?.telegram_chat_id) {
    try {
      await sendTelegramPhoto(parent.telegram_chat_id, photoUrl, message)
      console.log(`[NOTIFY-PHOTO] ✅ Sent photo via Telegram → parent ${parentId}`)
      return
    } catch (err) {
      console.error(`[NOTIFY-PHOTO] ❌ Telegram photo failed: ${err.message} — trying text`)
      try {
        await sendTelegramMessage(parent.telegram_chat_id, message)
        console.log(`[NOTIFY-PHOTO] ✅ Sent text fallback via Telegram → parent ${parentId}`)
        return
      } catch (err2) {
        console.error(`[NOTIFY-PHOTO] ❌ Telegram text fallback also failed: ${err2.message}`)
      }
    }
  }

  // ── WhatsApp Business API — text only (photo URL embedded in message) ────
  if (channel === 'whatsapp' && parent?.whatsapp_phone) {
    try {
      await sendWhatsAppBusinessMessage(parent.whatsapp_phone, message)
      console.log(`[NOTIFY-PHOTO] ✅ Sent text (with photo URL) via WhatsApp Business → parent ${parentId}`)
      return
    } catch (err) {
      console.error(`[NOTIFY-PHOTO] ❌ WhatsApp Business failed: ${err.message}`)
    }
  }

  // ── Baileys fallback with photo ───────────────────────────────────────────
  if (isConnected(parentId)) {
    try {
      const { data: child } = await supabase
        .from('children')
        .select('parent_phone')
        .eq('parent_id', parentId)
        .not('parent_phone', 'is', null)
        .limit(1)
        .single()
      if (child?.parent_phone) {
        await sendMessage(parentId, child.parent_phone, message, photoUrl)
        console.log(`[NOTIFY-PHOTO] ✅ Sent photo via Baileys WhatsApp → parent ${parentId}`)
        return
      }
    } catch (err) {
      console.error(`[NOTIFY-PHOTO] ❌ Baileys fallback failed: ${err.message}`)
    }
  }

  console.log(`[NOTIFY-PHOTO] ⚠️ No working channel for parent ${parentId} (channel="${channel}") — message dropped`)
}

// Multi-photo variant for homework (up to 15 pages). Telegram gets a native
// album; WhatsApp/Baileys have no album primitive here, so they fall back to
// the first photo + caption (parent still sees the homework arrived and can
// open the app). The notification must NEVER be lost — every path degrades to
// text rather than throwing.
async function sendNotificationWithPhotos(parentId, message, photoUrls) {
  const raw = (photoUrls || []).filter(Boolean)
  if (raw.length <= 1) return sendNotificationWithPhoto(parentId, message, raw[0] || null)
  // Short-lived signed URLs — Telegram fetches and re-hosts them immediately.
  const urls = await signedUrlsFor(raw, 900)
  if (!urls.length) return sendNotification(parentId, message)

  const { data: parent } = await supabase
    .from('parents')
    .select('notification_channel, telegram_chat_id, whatsapp_phone')
    .eq('id', parentId)
    .single()

  const channel = parent?.notification_channel || 'none'
  console.log(`[NOTIFY-PHOTOS] parent=${parentId} channel="${channel}" photos=${urls.length}`)

  if (channel === 'telegram' && parent?.telegram_chat_id) {
    try {
      await sendTelegramMediaGroup(parent.telegram_chat_id, urls, message)
      console.log(`[NOTIFY-PHOTOS] ✅ Sent album (${urls.length}) via Telegram → parent ${parentId}`)
      return
    } catch (err) {
      console.error(`[NOTIFY-PHOTOS] ❌ Telegram album failed: ${err.message} — trying single photo`)
    }
  }

  // Any other channel, or a failed album: fall back to the single-photo path
  // (which itself falls back to text if the photo send fails).
  await sendNotificationWithPhoto(parentId, message, urls[0])
}

function setupConnectHandler() {
  setConnectHandler(async (parentId, phoneNumber) => {
    console.log(`[WA] First connect for parent ${parentId} — sending welcome message`)
    try {
      await sendMessage(
        parentId,
        phoneNumber,
        `Hi! I'm Tuto 👋\n\nI'm here to help you track your children's learning journey.\n\nYou'll get task updates here, and you can ask me anything about your kids' progress! 🌟`
      )
    } catch (err) {
      console.error('[WA] Welcome message error:', err.message)
    }
  })
}

// ── Contribution diary tools (function-calling) ───────────────────────────────
const CONTRIBUTION_TOOLS = [{
  functionDeclarations: [
    {
      name: 'approve_contribution',
      description:
        'Approve ONE SPECIFIC pending household contribution diary entry, by its exact id. Only call this when ' +
        'the parent clearly expresses intent to approve a single named/described contribution from the pending ' +
        'list. If more than one contribution is pending and it is unclear which one the parent means, do NOT call ' +
        'this — ask the parent to clarify first. If the parent wants to approve ALL of a child\'s pending ' +
        'contributions at once (e.g. "hepsini onayla", "approve all", "ikisini de onayla", "approve both"), use ' +
        'approve_all_pending instead — do NOT call this repeatedly to cover multiple contributions; copying long ' +
        'ids by hand for each one is unreliable and can silently fail partway through.',
      parameters: {
        type: 'OBJECT',
        properties: {
          contribution_id: { type: 'STRING', description: 'The exact id of the contribution to approve, taken from the pending contributions list in context.' },
          note: { type: 'STRING', description: 'Optional note from the parent to pass along to the child.' },
        },
        required: ['contribution_id'],
      },
    },
    {
      name: 'approve_all_pending',
      description:
        'Ebeveyn bir çocuğun TÜM onay bekleyen katkılarını onaylamak isterse (örn. "hepsini onayla", "approve ' +
        'all", "ikisini de onayla") bunu kullan. Tek tek contribution_id vermeye gerek yok — bu araç o çocuğun ' +
        'tüm pending katkılarını tek işlemde onaylar. Sadece belirli/tek bir katkı onaylanmak isteniyorsa bunun ' +
        'yerine approve_contribution kullan.',
      parameters: {
        type: 'OBJECT',
        properties: {
          child_id: { type: 'STRING', description: 'The exact id of the child whose pending contributions should all be approved, taken from the children list in context.' },
        },
        required: ['child_id'],
      },
    },
    {
      name: 'reject_contribution',
      description:
        'Reject a pending household contribution diary entry. Only call this when the parent clearly expresses ' +
        'intent to reject ONE SPECIFIC contribution from the pending list. If more than one contribution is ' +
        'pending and it is unclear which one the parent means, do NOT call this — ask the parent to clarify first.',
      parameters: {
        type: 'OBJECT',
        properties: {
          contribution_id: { type: 'STRING', description: 'The exact id of the contribution to reject, taken from the pending contributions list in context.' },
          note: { type: 'STRING', description: 'Optional note from the parent to pass along to the child.' },
        },
        required: ['contribution_id'],
      },
    },
    {
      name: 'approve_drawing',
      description:
        'Approve ONE SPECIFIC pending drawing (a picture the child drew and photographed), by its exact id from ' +
        'the "pending drawings" list in context. Call this when the parent approves it in free text ("onayla", ' +
        '"evet", "harika, onaylıyorum"). A drawing is NOT a submission and NOT a contribution — do not use ' +
        'approve_submission or approve_contribution for it. The reward amount is decided by the server (there is ' +
        'a daily cap), so there is no gems parameter here. If more than one drawing is pending and it is unclear ' +
        'which one the parent means, do NOT call this — ask which one first. Never invent an id.',
      parameters: {
        type: 'OBJECT',
        properties: {
          painting_id: { type: 'STRING', description: 'The exact id of the drawing to approve, taken from the pending drawings list in context.' },
        },
        required: ['painting_id'],
      },
    },
    {
      name: 'reject_drawing',
      description:
        'Reject a pending drawing. The picture stays in the child\'s library, it just earns nothing. Only call ' +
        'this when the parent clearly rejects ONE SPECIFIC drawing from the pending drawings list.',
      parameters: {
        type: 'OBJECT',
        properties: {
          painting_id: { type: 'STRING', description: 'The exact id of the drawing to reject, taken from the pending drawings list in context.' },
        },
        required: ['painting_id'],
      },
    },
    {
      name: 'add_card',
      description:
        'Add a new permanent contribution card for a child, so it shows up as a tappable suggestion in their ' +
        'diary going forward (e.g. parent says "Ada\'nın kartlarına \'köpeği gezdirdim\' ekle"). Only call this ' +
        'when the parent clearly asks to add a new card/option for a child — not for logging a one-off ' +
        'contribution. Pick the child_id from the children list in context; if the parent has only one child and ' +
        'doesn\'t name them, use that child. If there are multiple children and it is unclear which one the ' +
        'parent means, do NOT call this — ask which child first.\n' +
        'Decide the category yourself from the label\'s meaning — do NOT ask the parent which category to use, ' +
        'even if you have to guess. Only ask the parent something (and skip calling this tool) if the action ' +
        'itself is genuinely ambiguous (e.g. you can\'t tell what they even mean). "household" is a last-resort ' +
        'fallback for when the action truly fits none of the others — never ask the parent to pick a category.\n' +
        'Keep the label to the bare action only — strip out frequency/schedule words the parent adds ("her gün", ' +
        '"sabah akşam", "günde iki kez", "every day", "twice a day"). E.g. parent says "bulaşıkları yıka her ' +
        'akşam ekle" → label should be just "bulaşıkları yıka" (do the dishes), not the schedule part. There is ' +
        'no recurrence/frequency system yet, so that information is simply dropped — the card itself stays a ' +
        'single short action. This stripping rule applies ONLY to the label you pass into THIS tool call — never ' +
        'apply it when reading back or listing existing pending contributions elsewhere.',
      parameters: {
        type: 'OBJECT',
        properties: {
          child_id: { type: 'STRING', description: 'The exact id of the child this card belongs to, taken from the children list in context.' },
          label: { type: 'STRING', description: 'The bare action only, in the parent\'s words, with any frequency/schedule phrasing removed (e.g. "I walked the dog", not "I walked the dog every morning").' },
          category: { type: 'STRING', description: 'One of: self_care, household, family, outside. Chosen by you from the label\'s meaning — never ask the parent for this.' },
        },
        required: ['child_id', 'label', 'category'],
      },
    },
    {
      name: 'approve_submission',
      description:
        'Approve ONE SPECIFIC pending submission (a homework or a chore the child photographed), by its exact id ' +
        'from the "pending submissions" list in context. Call this when the parent clearly approves it in free ' +
        'text ("onayla", "evet", "tamam 25 gem", "harika, onaylıyorum"). ' +
        'gems is OPTIONAL: pass it ONLY if the parent named an amount ("25 gem yeter", "give 10"). If the parent ' +
        'just approves without a number, DO NOT pass gems — the server uses the configured reward. ' +
        'If MORE THAN ONE submission is pending and it is unclear which one the parent means, do NOT call this — ' +
        'ask which one first, in the parent\'s language. Never invent an id.',
      parameters: {
        type: 'OBJECT',
        properties: {
          submission_id: { type: 'STRING', description: 'The exact id of the submission to approve, taken from the pending submissions list in context.' },
          gems: { type: 'NUMBER', description: 'Optional gem amount, ONLY if the parent explicitly stated one. Omit otherwise.' },
          note: { type: 'STRING', description: 'Optional note from the parent to pass along to the child.' },
        },
        required: ['submission_id'],
      },
    },
    {
      name: 'send_submission_photos',
      description:
        'Send the parent the actual PHOTO(S) of a submission (homework or chore) here in the chat, by its exact id ' +
        'from the "pending submissions" list. Call this whenever the parent asks to see the photos ' +
        '("görselleri var mı", "fotoğrafı gönder", "show me the photo", "can I see it"). The pending list tells you ' +
        'how many photos each submission has (photoCount) — if photoCount is 0 there is genuinely no photo, ' +
        'otherwise NEVER tell the parent there is no photo. If several submissions are pending and it is unclear ' +
        'which one they mean, ask first.',
      parameters: {
        type: 'OBJECT',
        properties: {
          submission_id: { type: 'STRING', description: 'The exact id of the submission whose photos to send, from the pending submissions list.' },
        },
        required: ['submission_id'],
      },
    },
    {
      name: 'reject_submission',
      description:
        'Reject a pending submission (homework or chore) by its exact id from the "pending submissions" list, when ' +
        'the parent clearly declines it ("hayır", "eksik kalmış", "olmamış, tekrar yapsın"). No gems are awarded. ' +
        'If more than one submission is pending and it is unclear which one the parent means, do NOT call this — ' +
        'ask which one first, in the parent\'s language.',
      parameters: {
        type: 'OBJECT',
        properties: {
          submission_id: { type: 'STRING', description: 'The exact id of the submission to reject, taken from the pending submissions list in context.' },
          note: { type: 'STRING', description: 'Optional note from the parent to pass along to the child.' },
        },
        required: ['submission_id'],
      },
    },
  ],
}]

// Approve a pending homework/chore submission from a parent's free-text reply.
// Every rule here is DETERMINISTIC — the LLM only picks the id and (maybe) an
// amount; code decides authorization, double-approval, the reward value, the
// clamp, and the single ledger write.
async function approveSubmissionTool(submissionId, parentId, gems) {
  const { data: sub } = await supabase
    .from('submissions')
    .select('id, child_id, task_type, status, suggested_gems')
    .eq('id', submissionId)
    .maybeSingle()
  if (!sub) return { success: false, error: 'submission not found' }

  // Rule 1 — authorization: the submission's child must belong to THIS parent.
  const { data: child } = await supabase
    .from('children')
    .select('id, name, parent_id, task_settings')
    .eq('id', sub.child_id)
    .maybeSingle()
  if (!child || child.parent_id !== parentId) {
    return { success: false, error: 'not authorized for this submission' }
  }

  // Rule 2 — no double approval.
  if (sub.status !== 'pending') {
    return { success: false, error: `already ${sub.status}` }
  }

  // Rules 3 & 4 — the reward value. Configured amount comes from the child's
  // task_settings[type].gems (server-side, never the client), homework
  // defaulting to HOMEWORK_DEFAULT_GEMS. If the parent named an amount, clamp
  // it to [0, configured * 2] so an LLM-relayed number can't blow up the ledger.
  const ts = child.task_settings || {}
  const configured = ts[sub.task_type]?.gems ?? (sub.task_type === 'homework' ? HOMEWORK_DEFAULT_GEMS : (sub.suggested_gems ?? HOMEWORK_DEFAULT_GEMS))

  let awarded
  if (gems === undefined || gems === null || Number.isNaN(Number(gems))) {
    awarded = configured
  } else {
    awarded = Math.max(0, Math.min(Number(gems), configured * 2))
  }
  awarded = Math.round(awarded)

  // Rule 5 — single ledger path, identical to the dashboard approve button:
  // flip status + write gems_earned, then one bt_ledger insert (reason=type).
  const { error: updErr } = await supabase
    .from('submissions')
    .update({ status: 'approved', gems_earned: awarded })
    .eq('id', sub.id)
    .eq('status', 'pending') // guard against a concurrent approval racing us
  if (updErr) return { success: false, error: updErr.message }

  if (awarded > 0) {
    const { error: ledErr } = await supabase
      .from('bt_ledger')
      .insert({ child_id: sub.child_id, amount: awarded, reason: sub.task_type || 'task' })
    if (ledErr) {
      console.error(`[SUBMISSION] ledger insert failed for ${sub.id}: ${ledErr.message}`)
      return { success: false, error: 'reward could not be recorded' }
    }
  }

  return { success: true, id: sub.id, childName: child.name, taskType: sub.task_type, gems: awarded }
}

// Re-sends a submission's photos into the chat on request. Ownership is checked
// in code — a parent can only ever pull their own child's photos.
async function sendSubmissionPhotosTool(submissionId, parentId) {
  const { data: sub } = await supabase
    .from('submissions')
    .select('id, child_id, task_type, photo_urls, media_url')
    .eq('id', submissionId)
    .maybeSingle()
  if (!sub) return { success: false, error: 'submission not found' }

  const { data: child } = await supabase
    .from('children').select('id, name, parent_id').eq('id', sub.child_id).maybeSingle()
  if (!child || child.parent_id !== parentId) {
    return { success: false, error: 'not authorized for this submission' }
  }

  const urls = sub.photo_urls?.length ? sub.photo_urls : (sub.media_url ? [sub.media_url] : [])
  if (!urls.length) return { success: false, error: 'this submission genuinely has no photo' }

  try {
    await sendNotificationWithPhotos(parentId, '', urls)
  } catch (err) {
    console.error(`[SUBMISSION] photo resend failed: ${err.message}`)
    return { success: false, error: 'could not send the photos right now' }
  }
  return { success: true, id: sub.id, childName: child.name, photoCount: urls.length, alreadySent: true }
}

async function rejectSubmissionTool(submissionId, parentId) {
  const { data: sub } = await supabase
    .from('submissions')
    .select('id, child_id, status')
    .eq('id', submissionId)
    .maybeSingle()
  if (!sub) return { success: false, error: 'submission not found' }

  const { data: child } = await supabase
    .from('children')
    .select('id, name, parent_id')
    .eq('id', sub.child_id)
    .maybeSingle()
  if (!child || child.parent_id !== parentId) {
    return { success: false, error: 'not authorized for this submission' }
  }
  if (sub.status !== 'pending') {
    return { success: false, error: `already ${sub.status}` }
  }

  const { error } = await supabase
    .from('submissions')
    .update({ status: 'rejected' })
    .eq('id', sub.id)
    .eq('status', 'pending')
  if (error) return { success: false, error: error.message }

  return { success: true, id: sub.id, childName: child.name }
}

async function approveContributionTool(contributionId, parentId) {
  const { data: updated, error } = await supabase
    .from('contribution_log')
    .update({ status: 'approved', approved_at: DateTime.utc().toISO(), approved_by: parentId || null })
    .eq('id', contributionId)
    .select('id, label, child_id, status')
    .single()
  if (error || !updated) return { success: false, error: error?.message || 'contribution not found' }
  return { success: true, id: updated.id, label: updated.label, status: updated.status }
}

// Approves every pending contribution for a child in one deterministic
// update — no per-id copying by the LLM, so a long list can't partially
// fail from a mis-copied UUID the way repeated approve_contribution calls did.
async function approveAllPendingTool(childId, parentId) {
  const { data: child } = await supabase.from('children').select('id, name').eq('id', childId).maybeSingle()
  if (!child) return { success: false, error: 'child not found' }

  const { data: updated, error } = await supabase
    .from('contribution_log')
    .update({ status: 'approved', approved_at: DateTime.utc().toISO(), approved_by: parentId || null })
    .eq('child_id', childId)
    .eq('status', 'pending')
    .select('id, label')

  if (error) return { success: false, error: error.message }
  if (!updated?.length) return { success: false, error: `${child.name} has no contributions awaiting approval` }

  return {
    success: true,
    childId: child.id,
    childName: child.name,
    count: updated.length,
    labels: updated.map(u => u.label),
    approvedIds: updated.map(u => u.id),
  }
}

async function rejectContributionTool(contributionId) {
  const { data: updated, error } = await supabase
    .from('contribution_log')
    .update({ status: 'rejected' })
    .eq('id', contributionId)
    .select('id, label, child_id, status')
    .single()
  if (error || !updated) return { success: false, error: error?.message || 'contribution not found' }
  return { success: true, id: updated.id, label: updated.label, status: updated.status }
}

const CARD_CATEGORY_THEME = {
  self_care: { icon: '🛏️', color: '#5aa9e6' },
  household: { icon: '🍽️', color: '#e89a39' },
  family:    { icon: '🤝', color: '#ef7d9d' },
  outside:   { icon: '🌿', color: '#54b487' },
}

async function addCardTool(childId, label, category) {
  const trimmedLabel = (label || '').trim()
  if (!trimmedLabel) return { success: false, error: 'label required' }

  const { data: child } = await supabase.from('children').select('id').eq('id', childId).maybeSingle()
  if (!child) return { success: false, error: 'child not found' }

  const resolvedCategory = Object.keys(CARD_CATEGORY_THEME).includes(category) ? category : 'household'
  const theme = CARD_CATEGORY_THEME[resolvedCategory]

  const { data: maxRow } = await supabase
    .from('contribution_cards')
    .select('sort_order')
    .eq('child_id', childId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1

  const { data: inserted, error } = await supabase
    .from('contribution_cards')
    .insert({
      child_id: childId,
      label: trimmedLabel,
      category: resolvedCategory,
      icon: theme.icon,
      color: theme.color,
      sort_order: nextSortOrder,
      active: true,
    })
    .select('id, label, category')
    .single()
  if (error || !inserted) return { success: false, error: error?.message || 'insert failed' }
  return { success: true, id: inserted.id, label: inserted.label, category: inserted.category }
}

async function fetchConversationHistory(parentId) {
  try {
    const since = DateTime.utc().minus({ hours: 48 }).toISO()
    const { data: recent } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('parent_id', parentId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    let rows = recent || []
    if (rows.length < 10) {
      const { data: lastTen } = await supabase
        .from('messages')
        .select('role, content, created_at')
        .eq('parent_id', parentId)
        .order('created_at', { ascending: false })
        .limit(10)
      rows = lastTen || []
    }

    return rows
      .slice()
      .reverse()
      .map(m => ({ role: m.role === 'tuto' ? 'model' : 'user', parts: [{ text: m.content }] }))
  } catch (err) {
    console.error(`[MSG] history fetch failed: ${err.message}`)
    return []
  }
}

async function logMessage(parentId, role, content) {
  try {
    await supabase.from('messages').insert({ parent_id: parentId, role, content })
  } catch (err) {
    console.error(`[MSG] log failed (role=${role}): ${err.message}`)
  }
}

async function handleMessage(parentId, replyCb, text) {
  console.log(`[MSG] parent=${parentId} → "${text}"`)
  // Declared here (not inside try) so the catch block can still send a
  // localized fallback reply if we made it far enough to know the parent's
  // language before something failed.
  let language = 'tr'
  try {
    const historyContents = await fetchConversationHistory(parentId)
    await logMessage(parentId, 'parent', text)

    const [familyData, { data: parentRow }, { data: childrenRows }] = await Promise.all([
      getParentContext(parentId),
      supabase.from('parents').select('timezone, prefs').eq('id', parentId).single(),
      supabase.from('children').select('id, name').eq('parent_id', parentId),
    ])
    language = parentRow?.prefs?.language === 'en' ? 'en' : 'tr'
    const tz = parentRow?.timezone || 'UTC'
    const userNow = DateTime.now().setZone(tz)
    const localTimeStr = `${userNow.toFormat('yyyy-MM-dd HH:mm')} (${tz})`

    const children = childrenRows || []
    const childrenBlock =
      `AİLENİN ÇOCUKLARI (add_card için child_id'yi buradan al):\n` +
      (children.length
        ? children.map(c => `- id=${c.id}: ${c.name}`).join('\n')
        : 'Kayıtlı çocuk yok.')

    const pendingList = familyData.flatMap(c =>
      Array.isArray(c.pendingContributions)
        ? c.pendingContributions.map(p => ({ id: p.id, label: p.label, category: p.category, child: c.name }))
        : []
    )
    // If the pending read failed for any child, the list above is NOT "empty" —
    // it's unknown. Must not let the deterministic block claim "nothing pending"
    // in that case, since that's a false negative the parent could act on.
    const pendingCheckFailed = familyData.some(c => c.pendingCheckFailed)

    // Pending homework/chore submissions with ids — so a free-text "onayla"
    // can be routed to approve_submission for the right one.
    const nowLocalDate = userNow.toFormat('yyyy-MM-dd')
    const allSubsList = familyData.flatMap(c =>
      (c.pendingSubmissions || []).map(s => ({
        id: s.id,
        child: c.name,
        taskType: s.task_type,
        status: s.status,
        description: s.description,
        suggestedGems: s.suggested_gems,
        photoCount: s.photoCount,
        stale: s.photo_taken_at
          ? DateTime.fromISO(s.photo_taken_at, { zone: 'utc' }).setZone(tz).toFormat('yyyy-MM-dd') !== nowLocalDate
          : false,
      }))
    )
    const pendingSubsList = allSubsList.filter(s => s.status !== 'blocked')
    // Images the safety screen withheld. NOT awaiting approval, but the parent
    // must be able to see them on request — the classifier can be wrong.
    const heldSubsList = allSubsList.filter(s => s.status === 'blocked')

    function buildSystemPrompt(currentPendingList, currentPendingSubs = pendingSubsList) {
      const pendingBlock = pendingCheckFailed
        ? `ŞU AN ONAY BEKLEYEN KATKILAR: bu bilgi şu anda okunamadı (geçici bir hata oluştu).\n` +
          `- Onay bekleyenler hakkında KESİN bir şey söyleme — ne "yok" de ne bir sayı ver. Parent'a şu anda ` +
          `kontrol edemediğini söyle, birazdan tekrar sormasını iste.`
        : `ŞU AN ONAY BEKLEYEN KATKILAR (toplam ${currentPendingList.length}):\n` +
          (currentPendingList.length
            ? currentPendingList.map(p => `- id=${p.id}: "${p.label}" — ${p.child} (${p.category})`).join('\n') +
              `\n- Bu ${currentPendingList.length} kaydın HEPSİNİ, olduğu gibi (etiketi kısaltmadan/değiştirmeden) ` +
              `say ve listele. "her gün", "hem sabah hem akşam" gibi zamanlama ifadeleri içeren bir etiket görürsen ` +
              `bile bunu atlama/kısaltma — o temizleme kuralı SADECE add_card aracını çağırırken yeni bir kart ` +
              `etiketi üretmek için geçerlidir, bu listeyi okuyup söylerken hiçbir şekilde uygulanmaz.`
            : 'Şu anda onay bekleyen katkı yok.')

      const subsBlock =
        `ŞU AN ONAY BEKLEYEN GÖNDERİLER (ödev/ev görevi fotoğrafı, toplam ${currentPendingSubs.length}):\n` +
        (currentPendingSubs.length
          ? currentPendingSubs.map(s => {
              const kind = s.taskType === 'homework' ? 'ödev' : s.taskType === 'chore' ? 'ev görevi' : s.taskType
              const gemHint = s.suggestedGems != null ? `, önerilen ödül ${s.suggestedGems} gem` : ''
              const staleHint = s.stale ? ', (fotoğraf bugün çekilmemiş görünüyor)' : ''
              const photoHint = s.photoCount > 0 ? `, ${s.photoCount} fotoğraf var` : ', fotoğrafı yok'
              return `- id=${s.id}: ${kind} — ${s.child}: "${s.description}"${gemHint}${photoHint}${staleHint}`
            }).join('\n') +
            `\n- Ebeveyn bunlardan birini onaylarsa approve_submission'ı, reddederse reject_submission'ı ` +
            `yukarıdaki EXACT id ile çağır. Ebeveyn bir gem sayısı söylediyse (örn. "25 gem yeter") onu gems ` +
            `parametresine geçir; söylemediyse gems'i BOŞ bırak (sunucu ayarlı ödülü kullanır). Birden fazla ` +
            `bekleyen gönderi varsa ve hangisi olduğu belirsizse, tahmin etme — ebeveynin diliyle hangisi diye sor.\n` +
            `- Her gönderinin kaç fotoğrafı olduğu yukarıda yazıyor. Ebeveyn görselleri sorarsa ("görseli var mı", ` +
            `"fotoğrafı gönder") send_submission_photos'u o id ile çağır. Bir gönderi için "fotoğrafı yok" ` +
            `yazmıyorsa ASLA "görsel bulunmuyor / fotoğrafsız kaydedilmiş" deme — fotoğraflar sistemde duruyor.`
          : 'Şu anda onay bekleyen gönderi yok.')

      const heldBlock = heldSubsList.length
        ? `\n\nGÜVENLİK TARAMASININ İLETMEDİĞİ GÖRSELLER (toplam ${heldSubsList.length}):\n` +
          heldSubsList.map(s => `- id=${s.id}: ${s.child}, ${s.photoCount} fotoğraf`).join('\n') +
          `\n- Bunlar otomatik iletilmedi ama SİLİNMEDİ; sistemde duruyor. Ebeveyn "ne göndermiş", "göster", ` +
          `"görebilir miyim" derse send_submission_photos'u bu id ile çağır ve göster. Ebeveyn çocuğun velisi; ` +
          `görme hakkı var ve tarama yanılmış olabilir — asla "gösteremem / elimde yok" deme.\n` +
          `- Bunlar onay bekleyen gönderi DEĞİL; onay listesinde sayma, approve_submission ile onaylamaya çalışma.`
        : ''

      return (
        `${childrenBlock}\n\n` +
        `${pendingBlock}\n\n` +
        `${subsBlock}${heldBlock}\n\n` +
        `ŞU AN ONAY BEKLEYEN ÇİZİMLER:\n` +
        (familyData.flatMap(c => (Array.isArray(c.pendingDrawings) ? c.pendingDrawings.map(d => ({ ...d, child: c.name })) : [])).length
          ? familyData.flatMap(c => (Array.isArray(c.pendingDrawings) ? c.pendingDrawings.map(d => ({ ...d, child: c.name })) : []))
              .map(d => `- id=${d.id}: ${d.child} — "${d.what}" çizimi`).join('\n') +
            `\n- Ebeveyn bunlardan birini onaylarsa approve_drawing'i, reddederse reject_drawing'i yukarıdaki ` +
            `EXACT id ile çağır. Çizim ödülünün miktarını SEN belirlemezsin — sunucu karar verir ve günlük bir ` +
            `üst sınır uygular; bu yüzden gems parametresi yok. Onay sonucunda dönen gem sayısını ebeveyne söyle. ` +
            `Sonuç capped=true dönerse, çizim onaylandı ama günlük çizim ödülü dolduğu için gem eklenmedi — ` +
            `bunu açıkça söyle, "gem kazandı" deme.`
          : 'Şu anda onay bekleyen çizim yok.') + `\n\n` +
        `- Yukarıdaki "onay bekleyen katkılar" listesinde bir veya daha fazla kayıt VARSA, asla "onay bekleyen ` +
        `bir şey yok" deme. Parent onay sorduğunda ya da "onayla" dediğinde, bu listeyi referans al. Liste boşsa, ` +
        `o zaman bekleyen olmadığını söyle.\n\n` +
        `You are Tuto, a warm AI learning assistant and trusted family companion.\n` +
        `Current local time for parent: ${localTimeStr}\n` +
        `You know this family's learning data:\n${JSON.stringify(familyData, null, 2)}\n\n` +
        `The tree ("ağaç"):\n` +
        `- Each child's "tree" field above is the WHOLE answer to any tree question. The tree is a kindness / ` +
        `good-deeds diary: every approved contribution grows one leaf, a day's tree is fully grown at ` +
        `leavesForAFullTreeToday leaves, and a new tree starts each day (treesThisMonth = days this month with ` +
        `at least one leaf).\n` +
        `- The tree has NOTHING to do with gems, math level, stories or books. When the parent asks about the ` +
        `tree, answer ONLY from the tree field — never substitute gem totals, math level or story counts, and ` +
        `never present those as "how the tree is doing". Those are separate subjects; mention them only if the ` +
        `parent asks about them.\n` +
        `- Be concrete: say how many leaves today (out of leavesForAFullTreeToday), how many trees this month ` +
        `out of daysElapsedThisMonth days, and name a couple of actual deeds from recentLeaves. That is what ` +
        `makes it clear you are looking at the real tree.\n` +
        `- If the tree field is a text message instead of an object, it means the read failed — say you couldn't ` +
        `check the tree right now, do NOT invent a state.\n` +
        `- Pending contributions are NOT leaves yet; they grow a leaf only when approved.\n\n` +
        `Tool usage rules:\n` +
        `- Use the exact "id" from the pending contributions list above when calling approve_contribution or ` +
        `reject_contribution.\n` +
        `- Use the exact "id" from the children list above when calling add_card or approve_all_pending.\n` +
        `- Approving a CONTRIBUTION (a diary / contribution_log entry) does NOT award gems. Gems for contributions ` +
        `are tallied separately in the end-of-month review; approving one simply adds a leaf to the child's tree. ` +
        `For a CONTRIBUTION approval, never say the child "earned gems" — talk about a leaf added to their tree.\n` +
        `- A SUBMISSION approval is the OPPOSITE: approve_submission (a homework or chore) awards gems IMMEDIATELY. ` +
        `When it succeeds, its result gives you the exact gem amount — tell the parent how many gems the child ` +
        `earned. Do NOT use tree/leaf language for a submission; that framing is only for contributions.\n` +
        `- If the parent wants ALL of a child's pending contributions approved at once ("hepsini onayla", ` +
        `"approve all", "ikisini de onayla"), call approve_all_pending ONCE with that child's id — never call ` +
        `approve_contribution multiple times to cover a bulk request.\n` +
        `- Only call approve_contribution or reject_contribution when the parent clearly states approve/reject ` +
        `intent for ONE SPECIFIC contribution (not a bulk "all" request).\n` +
        `- If more than one contribution is pending, the parent isn't asking to approve all of them, and it is ` +
        `unclear which one they mean, do NOT call a tool — ask which one they mean first, in the same language ` +
        `as the parent's message.\n` +
        `- For add_card: if the parent doesn't name a child and there is only one child, use that child. If ` +
        `there are multiple children and it's unclear which one they mean, do NOT call add_card — ask which ` +
        `child first, in the same language as the parent's message.\n` +
        `- For add_card: pick the category yourself, silently — never ask the parent which category to use. ` +
        `Only skip the tool call to ask a question if the action itself is unclear.\n` +
        `- For add_card: strip frequency/schedule wording from the label ("her gün", "sabah akşam", ` +
        `"günde iki kez", "every day", "twice a day", etc.) — keep only the bare action. There is no ` +
        `recurrence system yet, so that part of what the parent said is simply dropped, not stored. This ` +
        `stripping is ONLY for the label argument you pass into add_card — never apply it when reading, ` +
        `listing, or counting existing pending contributions elsewhere in this prompt.\n\n` +
        `General guidelines:\n` +
        `- Respond in the SAME LANGUAGE as the parent's message\n` +
        `- Be conversational and warm, like a trusted friend who knows the kids\n` +
        `- Reference specific data when relevant (e.g. "Ada earned 30 gems yesterday!")\n` +
        `- Keep responses concise — max 3-4 sentences for simple questions\n\n` +
        `CRITICAL: Only report facts from the data provided.\n` +
        `If the data is empty or null, say so honestly.\n` +
        `NEVER invent or assume activity that is not in the data.\n` +
        `If a field is empty, say the child hasn't done that yet.`
      )
    }

    const systemPrompt = buildSystemPrompt(pendingList)
    const contents = [...historyContents, { role: 'user', parts: [{ text }] }]

    const firstData = await callGeminiWithRetry(() => fetchGeminiOnce({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      tools: CONTRIBUTION_TOOLS,
    }))
    const parts = firstData.candidates?.[0]?.content?.parts || []
    const fnCallParts = parts.filter(p => p.functionCall)

    if (fnCallParts.length === 0) {
      // Verified empirically: attaching `tools` measurably degrades plain-text
      // list reproduction — with the exact same data, Gemini reliably drops
      // one item from a 5-item pending list ~80% of the time when `tools` is
      // present, and 0% of the time with it omitted. Since no function was
      // actually called, re-ask without `tools` for the reply that's actually
      // sent to the parent, instead of trusting this call's own text.
      let reply = 'Üzgünüm, anlayamadım.'
      try {
        const plainData = await callGeminiWithRetry(() => fetchGeminiOnce({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
        }))
        reply = plainData.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || reply
      } catch {
        // Fall back to the tools-attached call's text rather than failing outright.
        reply = parts.map(p => p.text || '').join('').trim() || reply
      }
      await logMessage(parentId, 'tuto', reply)
      await replyCb(reply)
      console.log(`[MSG] Reply sent to parent ${parentId}`)
      return
    }

    const toolResults = []
    for (const part of fnCallParts) {
      const { name, args } = part.functionCall
      let toolResult
      if (name === 'approve_contribution') {
        toolResult = await approveContributionTool(args.contribution_id, parentId)
      } else if (name === 'approve_all_pending') {
        toolResult = await approveAllPendingTool(args.child_id, parentId)
      } else if (name === 'reject_contribution') {
        toolResult = await rejectContributionTool(args.contribution_id)
      } else if (name === 'add_card') {
        toolResult = await addCardTool(args.child_id, args.label, args.category)
      } else if (name === 'approve_submission') {
        toolResult = await approveSubmissionTool(args.submission_id, parentId, args.gems)
      } else if (name === 'reject_submission') {
        toolResult = await rejectSubmissionTool(args.submission_id, parentId)
      } else if (name === 'send_submission_photos') {
        toolResult = await sendSubmissionPhotosTool(args.submission_id, parentId)
      } else if (name === 'approve_drawing') {
        toolResult = await approvePaintingById(args.painting_id, parentId)
      } else if (name === 'reject_drawing') {
        toolResult = await rejectPaintingById(args.painting_id, parentId)
      } else {
        toolResult = { success: false, error: `unknown tool ${name}` }
      }
      console.log(`[MSG] Tool "${name}"(${JSON.stringify(args)}) → ${JSON.stringify(toolResult)}`)
      toolResults.push({ name, contributionId: args.contribution_id, submissionId: args.submission_id, result: toolResult })
    }

    // Refresh the pending list so the second call doesn't contradict itself —
    // a just-approved/rejected contribution must no longer show as pending.
    // approve_all_pending has no single contributionId — it reports the whole
    // batch via result.approvedIds instead.
    const processedIds = new Set(
      toolResults.filter(t => t.result.success).flatMap(t => t.result.approvedIds ?? (t.contributionId ? [t.contributionId] : []))
    )
    const refreshedPendingList = pendingList.filter(p => !processedIds.has(p.id))
    // Same idea for submissions: an approved/rejected one must not still show
    // as pending in the second call's context.
    const processedSubIds = new Set(
      toolResults.filter(t => t.result.success && t.submissionId).map(t => t.submissionId)
    )
    const refreshedPendingSubs = pendingSubsList.filter(s => !processedSubIds.has(s.id))
    const refreshedSystemPrompt = buildSystemPrompt(refreshedPendingList, refreshedPendingSubs)

    const secondData = await callGeminiWithRetry(() => fetchGeminiOnce({
      system_instruction: { parts: [{ text: refreshedSystemPrompt }] },
      contents: [
        ...contents,
        // Echo the model's own content object verbatim — Gemini 3.x requires
        // each functionCall part's thoughtSignature to round-trip unchanged.
        // Rebuilding { functionCall: { name, args } } by hand (the old code)
        // drops it and gets a 400 "missing thought_signature". Only the
        // FIRST functionCall part carries a signature in a parallel call;
        // that's expected — pass the parts through as-is, don't invent one.
        firstData.candidates[0].content,
        // All functionResponses grouped into one user turn, same order as
        // the functionCall parts above — required order is FC1(+sig),FC2,...,FR1,FR2,...
        { role: 'user', parts: toolResults.map(t => ({ functionResponse: { name: t.name, response: t.result } })) },
      ],
      tools: CONTRIBUTION_TOOLS,
    }))
    const finalText = secondData.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || 'Tamamlandı.'
    await logMessage(parentId, 'tuto', finalText)
    await replyCb(finalText)
    console.log(`[MSG] Reply sent to parent ${parentId}`)
  } catch (err) {
    console.error('[MSG] Message handling error:', err.message)
    // Every Gemini call above already retried transient failures — if we're
    // here, it's exhausted or something else broke. Either way the parent
    // must never get silence: send a fixed, human fallback without calling
    // Gemini again.
    try {
      await logMessage(parentId, 'tuto', GEMINI_FALLBACK_REPLY[language])
      await replyCb(GEMINI_FALLBACK_REPLY[language])
    } catch (replyErr) {
      console.error('[MSG] Fallback reply also failed:', replyErr.message)
    }
  }
}

function setupMessageListener() {
  setMessageHandler((parentId, phone, text) =>
    handleMessage(parentId, msg => sendMessage(parentId, phone, msg), text)
  )
  setTelegramMessageHandler((parentId, chatId, text) => {
    // A real person reads the message and pauses before typing — so the
    // typing indicator itself is delayed ~1s, but that delay must not push
    // back when Gemini starts thinking. Fire-and-forget: the timeout and
    // handleMessage run in parallel, not sequentially.
    setTimeout(() => sendTelegramTyping(chatId).catch(() => {}), 800 + Math.random() * 700)
    return handleMessage(parentId, msg => sendTelegramMessage(chatId, msg), text)
  })
  console.log('Message listeners started (WhatsApp + Telegram).')
}

const TASK_LABELS = {
  math: 'Matematik',
  writing: 'Yazı Yazma',
  reading: 'Kitap Okuma',
  chore: 'Ev Görevi',
}

async function startSubmissionListener() {
  const channel = supabase
    .channel('submissions-insert')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'submissions' },
      async (payload) => {
        const submission = payload.new
        console.log('Yeni submission!', JSON.stringify(submission, null, 2))

        // Chore and homework submissions are notified by their own endpoints
        // (with the photo + AI observation), not by this generic text path.
        if (submission.task_type === 'chore' || submission.task_type === 'homework') return

        try {
          const { data: child, error } = await supabase
            .from('children')
            .select('name, parent_id, parent_phone')
            .eq('id', submission.child_id)
            .single()

          if (error) {
            console.log(`[DEBUG] Supabase child sorgusu hata: ${error.message}`)
            return
          }

          if (!child?.parent_phone) {
            console.log(`[DEBUG] parent_phone boş — child_id=${submission.child_id}`)
            return
          }

          if (!isConnected(child.parent_id)) {
            console.log(`[WA] Parent ${child.parent_id} has no active session — skipping notification`)
            return
          }

          const taskLabel = TASK_LABELS[submission.task_type] || submission.task_type
          const score = submission.score ?? null
          const gems = submission.gems_earned ?? 0

          console.log(`[APPROVAL] ${child.name} — score=${score}, gems=${gems}, görev=${taskLabel}`)

          const needsApproval = score === null || score < 80

          const message =
            `📚 Tuto – ${child.name} yeni bir görev tamamladı!\n\n` +
            `📌 Görev: ${taskLabel}\n` +
            `⭐ Puan: ${score !== null ? `${score}/100` : 'Belirsiz'}\n` +
            `💎 Kazanılan Gem: ${gems}\n\n` +
            `Harika iş ${child.name}! 🎉` +
            (needsApproval ? `\n\nOnaylıyor musunuz?` : '')

          if (score !== null && score >= 80) {
            await supabase.from('submissions').update({ status: 'approved' }).eq('id', submission.id)
            await supabase.from('bt_ledger').insert({ child_id: submission.child_id, amount: gems, reason: taskLabel })
          }

          await sendNotification(child.parent_id, message)
          console.log(`[APPROVAL] Bildirim gönderildi → parent ${child.parent_id}`)
        } catch (err) {
          console.error('Mesaj gönderilemedi:', err.message)
        }
      }
    )
    .subscribe((status, err) => {
      if (err) console.error('[REALTIME] Bağlantı hatası:', err.message)
      else console.log('[REALTIME] Durum:', status)
    })

  console.log('Supabase realtime dinleniyor (submissions)...')
  return channel
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '15mb' }))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// Proxies Gemini calls from the frontend — GEMINI_API_KEY must never ship in
// the client bundle (it did before this, got scraped/flagged as leaked by
// Google, and both frontend and backend Gemini access broke as a result).
// Frontend still builds prompts and parses responses; this is a pure
// pass-through with the key attached server-side only.
// The Gemini key lives only here — but an unauthenticated relay is just as bad
// as a leaked key: anyone who finds this URL can burn the quota (the key was
// already flagged as leaked once). Children have no Supabase session, so the
// gate is: the caller must name a real child, and each child gets a budget.
const CHILD_LIMIT = 40          // calls per child
const IP_LIMIT = 120            // calls per IP (a family shares one)
const RATE_WINDOW_MS = 10 * 60 * 1000
const rateHits = new Map()      // key → timestamps[]
const knownChildren = new Map() // childId → expiry, so we don't hit the DB every call

function overLimit(key, limit) {
  const now = Date.now()
  const hits = (rateHits.get(key) || []).filter(t => now - t < RATE_WINDOW_MS)
  hits.push(now)
  rateHits.set(key, hits)
  return hits.length > limit
}

async function childExists(childId) {
  const cached = knownChildren.get(childId)
  if (cached && cached > Date.now()) return true
  const { data } = await supabase.from('children').select('id').eq('id', childId).maybeSingle()
  if (!data) return false
  knownChildren.set(childId, Date.now() + 30 * 60 * 1000)
  return true
}

// Both maps grow with traffic; drop stale entries so a long-running dyno
// doesn't leak memory.
setInterval(() => {
  const now = Date.now()
  for (const [k, hits] of rateHits) {
    const live = hits.filter(t => now - t < RATE_WINDOW_MS)
    if (live.length) rateHits.set(k, live); else rateHits.delete(k)
  }
  for (const [k, exp] of knownChildren) if (exp <= now) knownChildren.delete(k)
}, RATE_WINDOW_MS).unref()

app.post('/api/gemini/generate', async (req, res) => {
  try {
    const { parts, generationConfig, childId } = req.body
    if (!Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ error: 'parts required' })
    }

    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!childId || !UUID.test(childId)) return res.status(401).json({ error: 'unauthorized' })

    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip
    if (overLimit(`ip:${ip}`, IP_LIMIT)) return res.status(429).json({ error: 'rate limited' })
    if (overLimit(`child:${childId}`, CHILD_LIMIT)) return res.status(429).json({ error: 'rate limited' })

    if (!(await childExists(childId))) return res.status(401).json({ error: 'unauthorized' })

    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: generationConfig || { response_mime_type: 'application/json' },
      }),
    })
    const data = await geminiRes.json()
    if (!geminiRes.ok) return res.status(geminiRes.status).json(data)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/family/:code/children', async (req, res) => {
  const code = req.params.code?.trim().toUpperCase()
  if (!code) return res.status(400).json({ error: 'code required' })
  const { data: parent } = await supabase.from('parents').select('id').eq('family_code', code).maybeSingle()
  if (!parent) return res.json({ children: [] })
  const { data: children } = await supabase.from('children').select('*').eq('parent_id', parent.id)
  res.json({ children: children || [] })
})

app.get('/api/children/:childId/rewards', async (req, res) => {
  const { childId } = req.params
  const { data: rewards } = await supabase.from('rewards').select('*').eq('child_id', childId).order('bt_cost')
  res.json({ rewards: rewards || [] })
})

app.get('/api/children/:childId/gems', async (req, res) => {
  const { childId } = req.params
  const { data: ledger } = await supabase.from('bt_ledger').select('amount').eq('child_id', childId)
  const gems = (ledger || []).reduce((sum, r) => sum + (r.amount || 0), 0)
  res.json({ gems })
})

app.get('/api/children/:childId/story-ideas', async (req, res) => {
  try {
    const { childId } = req.params
    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')

    const { data: child } = await supabase.from('children').select('age').eq('id', childId).single()
    const age = child?.age || 7
    const band = age <= 7 ? '5-7' : age <= 10 ? '8-10' : '11+'

    const [{ data: pool }, { data: written }] = await Promise.all([
      supabase.from('story_ideas').select('emoji, title, topic, description').eq('age_band', band).eq('status', 'active').eq('scope', 'global'),
      supabase.from('stories').select('topic').eq('child_id', childId),
    ])

    const usedNorms = new Set((written || []).map(r => norm(r.topic)))
    const fresh = (pool || []).filter(r => !usedNorms.has(norm(r.topic)))

    const shuffle = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(v => v[1])
    let ideas = shuffle(fresh).slice(0, 4)

    if (ideas.length < 4 && (pool || []).length > 0) {
      const used = new Set(ideas.map(r => norm(r.topic)))
      const extras = shuffle((pool || []).filter(r => !used.has(norm(r.topic))))
      ideas = [...ideas, ...extras].slice(0, 4)
    }

    res.json({ ideas })
  } catch {
    res.json({ ideas: [] })
  }
})

app.post('/api/screen-story-draft', async (req, res) => {
  // Fire-and-forget safety screen called right after OCR — never blocks the child's flow.
  try {
    const { child_id, transcribed_text } = req.body
    if (!child_id || !transcribed_text) return res.json({ ok: true })

    const { data: child } = await supabase
      .from('children').select('age, name, parent_id').eq('id', child_id).maybeSingle()
    if (!child) return res.json({ ok: true })

    let screening
    try {
      screening = await screenChildInput(transcribed_text, child.age)
    } catch {
      return res.json({ ok: true })
    }

    if (screening.concern_level === 'concerning' || screening.concern_level === 'serious') {
      try {
        await sendNotification(
          child.parent_id,
          `${child.name} bir şeyler yazıyor. Bir göz atmanda fayda olabilir.\n\n${transcribed_text}`
        )
      } catch (err) {
        console.error(`[SCREEN-DRAFT] notify failed: ${err.message}`)
      }
    }
  } catch (err) {
    console.error(`[SCREEN-DRAFT] unexpected error: ${err.message}`)
  }
  res.json({ ok: true })
})

app.get('/api/children/:childId/stories', async (req, res) => {
  const { childId } = req.params
  const { data: stories } = await supabase.from('stories').select('*').eq('child_id', childId).order('created_at', { ascending: false })
  res.json({ stories: stories || [] })
})

app.post('/api/children/:childId/stories', async (req, res) => {
  const { childId } = req.params
  const { storyId, title, topic, transcribed_text, corrected_text, status, gems_earned, cover_url, cover_color } = req.body
  try {
    let story, prevStatus

    if (storyId) {
      // Fetch existing status before update (don't trust client on gem eligibility)
      const { data: existing } = await supabase.from('stories').select('status').eq('id', storyId).single()
      prevStatus = existing?.status
      // Only update fields that were explicitly provided
      const fields = {}
      if (title !== undefined) fields.title = title
      if (transcribed_text !== undefined) fields.transcribed_text = transcribed_text
      if (corrected_text !== undefined) fields.corrected_text = corrected_text
      if (status !== undefined) fields.status = status
      if (cover_url !== undefined) fields.cover_url = cover_url
      if (cover_color !== undefined) fields.cover_color = cover_color
      const { data: updated, error } = await supabase.from('stories')
        .update(fields)
        .eq('id', storyId)
        .select().single()
      if (error) return res.status(500).json({ error: error.message })
      story = updated
    } else {
      prevStatus = null
      const { data: inserted, error } = await supabase.from('stories')
        .insert({ child_id: childId, title, topic, transcribed_text, corrected_text, status, gems_earned: gems_earned || 0 })
        .select().single()
      if (error) return res.status(500).json({ error: error.message })
      story = inserted
    }

    // Gem awarded only on first-ever completion (prev was not completed)
    const firstCompletion = status === 'completed' && prevStatus !== 'completed'
    const gemsAwarded = firstCompletion ? (gems_earned || 0) : 0
    if (gemsAwarded > 0) {
      await supabase.from('bt_ledger').insert({ child_id: childId, amount: gemsAwarded, reason: 'story' })
    }

    // Parent notification — insert only (no notification on edits/updates)
    if (!storyId) {
      try {
        const { data: child } = await supabase
          .from('children').select('name, parent_id').eq('id', childId).maybeSingle()
        if (child) {
          const storyText = corrected_text || transcribed_text || ''
          let screening
          try { screening = await screenChildInput(storyText, child.age ?? 7) } catch { /* skip */ }

          const cl = screening?.concern_level
          if (!screening) {
            // Screening failed — unknown safety status, stay calm (fail-closed)
            await sendNotification(
              child.parent_id,
              `${child.name} bir hikaye yazdı. Bir göz atmanda fayda olabilir.\n\n${title || 'Hikaye'}\n\n${storyText}`
            )
          } else if (cl === 'none' || cl === 'mild') {
            // Clean story — joyful share
            await sendNotification(
              child.parent_id,
              `${child.name} bir hikaye yazdı! 🌸\n\n${title || 'Hikaye'}\n\n${storyText}`
            )
          } else if (screening?.appropriateness === 'inappropriate') {
            // Inappropriate language — neutral share, no judgment
            await sendNotification(
              child.parent_id,
              `${child.name} bir hikaye yazdı, okumak istersin diye paylaşıyorum.\n\n${title || 'Hikaye'}\n\n${storyText}`
            )
          }
          // concerning/serious: silent — draft screen (Point 1) already notified
        }
      } catch (err) {
        console.error(`[STORIES] notification failed: ${err.message}`)
      }
    }

    res.json({ story, gems_awarded: gemsAwarded })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/children/:childId/stories/:storyId', async (req, res) => {
  const { childId, storyId } = req.params
  const { error } = await supabase.from('stories').delete().eq('id', storyId).eq('child_id', childId)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

const CONTRIBUTION_CATEGORIES = ['self_care', 'household', 'family', 'outside']

const DEFAULT_CONTRIBUTION_CARDS = [
  { category: 'self_care', label: 'I made my bed',     icon: '🛏️', color: '#5aa9e6', sort_order: 0 },
  { category: 'household', label: 'I set the table',    icon: '🍽️', color: '#e89a39', sort_order: 1 },
  { category: 'household', label: 'I helped tidy up',   icon: '🧹', color: '#e89a39', sort_order: 2 },
  { category: 'outside',   label: 'I helped outside',   icon: '🌿', color: '#54b487', sort_order: 3 },
]

app.get('/api/cards', async (req, res) => {
  try {
    const { child_id } = req.query
    if (!child_id) return res.status(400).json({ error: 'child_id required' })

    const { data: child } = await supabase.from('children').select('id').eq('id', child_id).maybeSingle()
    if (!child) return res.status(404).json({ error: 'child not found' })

    // photo_ok is newer than this endpoint. If the migration hasn't been run
    // yet, selecting it errors and would leave the child with NO cards at all,
    // so fall back to the older column set rather than breaking the screen.
    const CARD_COLS = 'id, label, category, icon, color'
    const fetchActiveCards = async () => {
      const q = cols => supabase
        .from('contribution_cards')
        .select(cols)
        .eq('child_id', child_id)
        .eq('active', true)
        .order('sort_order', { ascending: true })

      const withFlag = await q(`${CARD_COLS}, photo_ok`)
      if (!withFlag.error) return withFlag
      console.warn(`[CARDS] photo_ok unavailable (${withFlag.error.message}) — run the photo_ok migration`)
      return q(CARD_COLS)
    }

    let { data: cards } = await fetchActiveCards()

    if (!cards || cards.length === 0) {
      // Lazy seed: insert the 4 defaults for this child the first time they're
      // requested. Idempotent against a race — if another request seeded
      // first, this insert violates nothing fatal; we just refetch after.
      const { data: anyExisting } = await supabase
        .from('contribution_cards')
        .select('id')
        .eq('child_id', child_id)
        .limit(1)

      if (!anyExisting || anyExisting.length === 0) {
        await supabase.from('contribution_cards').insert(
          DEFAULT_CONTRIBUTION_CARDS.map(c => ({ ...c, child_id, active: true }))
        )
      }

      const refetched = await fetchActiveCards()
      cards = refetched.data
    }

    res.json({ cards: cards || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Screens a diary photo through the shared image gate. Returns null when the
// photo may be forwarded, or a child-facing message when it must not be.
// Mirrors the chore path: fails CLOSED (unreadable photo → blocked), deletes
// the rejected upload, and tells the parent that something was held back.
async function screenContributionPhoto(photoPath, child) {
  const { data: parentRow } = await supabase
    .from('parents').select('prefs').eq('id', child.parent_id).maybeSingle()
  const language = parentRow?.prefs?.language === 'en' ? 'en' : 'tr'

  let image = null
  try {
    const buffer = await readStoredPhoto(photoPath)
    image = { buffer, mimeType: String(photoPath).endsWith('.png') ? 'image/png' : 'image/jpeg' }
  } catch (err) {
    console.error(`[CONTRIBUTIONS] could not read photo for safety screen: ${err.message}`)
  }

  // 'chore' is the right frame here: both are a child photographing their home.
  const safety = image
    ? await screenImageSafety({ images: [image], kind: 'chore', language })
    : { appropriate: false, reason: 'photo could not be read' }

  // matchesTask is deliberately ignored — a diary label like "I helped outside"
  // is not a task the photo has to depict. Only appropriateness gates it.
  if (safety.appropriate) return null

  console.log(`[CONTRIBUTIONS] inappropriate image child=${child.id} — blocked (${safety.reason})`)
  const legacyPath = storagePathFromPublicUrl(photoPath)
  if (legacyPath) await supabase.storage.from('submissions').remove([legacyPath]).then(() => {}, () => {})
  else await supabase.storage.from(PHOTO_BUCKET).remove([photoPath]).then(() => {}, () => {})

  try {
    await sendNotification(child.parent_id, language === 'en'
      ? `${child.name} tried to attach a photo to a home contribution that isn't appropriate for a kids' app. I did not forward the image, but I wanted you to know.`
      : `${child.name} bir ev katkısına uygun olmayan bir görsel eklemeye çalıştı. Görseli paylaşmıyorum ama haberin olsun istedim.`)
  } catch (err) {
    console.error(`[CONTRIBUTIONS] inappropriate alert failed: ${err.message}`)
  }

  return language === 'en'
    ? "I couldn't send that photo. Want to take another one?"
    : 'Bu fotoğrafı gönderemedim. Başka bir tane çeker misin?'
}

app.post('/api/contributions', async (req, res) => {
  try {
    const { child_id, label, category, source, photo_url } = req.body

    if (!child_id) return res.status(400).json({ error: 'child_id required' })
    if (source !== 'card' && source !== 'free_text') return res.status(400).json({ error: 'invalid source' })

    const trimmedLabel = (label || '').trim()
    if (!trimmedLabel) return res.status(400).json({ error: 'label required' })
    if (trimmedLabel.length > 200) return res.status(400).json({ error: 'label too long' })

    let resolvedCategory = category
    if (source === 'free_text' && !resolvedCategory) resolvedCategory = 'outside'
    if (!CONTRIBUTION_CATEGORIES.includes(resolvedCategory)) return res.status(400).json({ error: 'invalid category' })

    const resolvedPhotoUrl = typeof photo_url === 'string' && photo_url ? photo_url : null

    // TODO: verify child belongs to authenticated parent's family
    const { data: child } = await supabase.from('children').select('id, name, age, parent_id').eq('id', child_id).maybeSingle()
    if (!child) return res.status(404).json({ error: 'child not found' })

    // A diary photo is forwarded straight to the parent's Telegram, so it goes
    // through the SAME image gate as homework and chore photos. It used to skip
    // it entirely: the label was screened, the picture attached to it was not.
    if (resolvedPhotoUrl) {
      const blocked = await screenContributionPhoto(resolvedPhotoUrl, child)
      if (blocked) return res.status(400).json({ error: 'photo_rejected', message: blocked })
    }

    if (source === 'free_text') {
      let screening
      try {
        screening = await screenChildInput(trimmedLabel, child.age)
      } catch (err) {
        console.error(`[CONTRIBUTIONS] screening failed: ${err.message}`)
        return res.status(503).json({ error: 'Şu an kaydedemedik, tekrar dener misin?' })
      }

      // ── Inappropriate content: block ──────────────────────────────────────
      if (screening.appropriateness === 'inappropriate') {
        console.log(`[SCREEN] inappropriate block child=${child_id}`)
        return res.status(400).json({ error: 'inappropriate', reason: screening.reason })
      }

      // ── Concerning or serious: notify parent, skip contribution flow ───────
      if (screening.concern_level === 'concerning' || screening.concern_level === 'serious') {
        const isSerious = screening.concern_level === 'serious'
        console.log(`[SCREEN] concern_level=${screening.concern_level} child=${child_id}`)
        try {
          const parentMsg = isSerious
            ? `${child.name} şöyle bir şey paylaştı: "${trimmedLabel}". Onunla konuşmak iyi gelebilir.`
            : `${child.name} şöyle bir şey paylaştı: "${trimmedLabel}". Onunla konuşmak iyi gelebilir.`
          await sendNotification(child.parent_id, parentMsg)
        } catch (err) {
          console.error(`[SCREEN] concern notification failed: ${err.message}`)
        }

        const n = Number(child.age) || 7
        const childAck = n <= 8 ? 'Paylaştığın için teşekkürler. 💚' : 'Paylaştığın için teşekkürler.'
        return res.status(200).json({ concern: true, message: childAck })
      }

      // ── Mild: continue normal flow, log for pattern tracking ─────────────
      if (screening.concern_level === 'mild') {
        // TODO: aggregate mild entries for pattern detection (threshold not yet implemented)
        await supabase.from('contribution_mild_log').insert({
          child_id,
          label: trimmedLabel,
          reason: screening.reason,
        }).then(() => {}).catch(err => console.error(`[SCREEN] mild log failed: ${err.message}`))
      }
    }

    const { data: inserted, error } = await supabase
      .from('contribution_log')
      .insert({
        child_id,
        label: trimmedLabel,
        category: resolvedCategory,
        source,
        status: 'pending',
        approved_by: null,
        approved_at: null,
        period: DateTime.utc().toFormat('yyyy-MM'),
        photo_url: resolvedPhotoUrl,
      })
      .select('id, label, category, source, status, created_at, photo_url')
      .single()

    if (error) return res.status(500).json({ error: error.message })

    try {
      const message = `🌱 ${child.name} bir katkı ekledi:\n"${trimmedLabel}"\n\nOnaylamak için uygulamadaki panelden bakabilirsin.`
      if (resolvedPhotoUrl) {
        await sendNotificationWithPhoto(child.parent_id, message, resolvedPhotoUrl)
      } else {
        await sendNotification(child.parent_id, message)
      }
    } catch (err) {
      console.error(`[CONTRIBUTIONS] notification failed: ${err.message}`)
    }

    res.status(201).json(inserted)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Attach a photo to a contribution that was already logged. Card taps stay a
// single tap — the photo is offered AFTER the entry exists, so it stays truly
// optional. Same image gate as the create path; a rejected photo leaves the
// contribution itself untouched.
app.post('/api/contributions/:id/photo', async (req, res) => {
  try {
    const { photo_url } = req.body
    if (typeof photo_url !== 'string' || !photo_url) return res.status(400).json({ error: 'photo_url required' })

    const { data: contribution } = await supabase
      .from('contribution_log')
      .select('id, child_id, label, status, photo_url')
      .eq('id', req.params.id)
      .maybeSingle()
    if (!contribution) return res.status(404).json({ error: 'not found' })
    if (contribution.photo_url) return res.status(409).json({ error: 'already has a photo' })

    const { data: child } = await supabase
      .from('children').select('id, name, age, parent_id').eq('id', contribution.child_id).maybeSingle()
    if (!child) return res.status(404).json({ error: 'child not found' })

    const blocked = await screenContributionPhoto(photo_url, child)
    if (blocked) return res.status(400).json({ error: 'photo_rejected', message: blocked })

    const { data: updated, error } = await supabase
      .from('contribution_log')
      .update({ photo_url })
      .eq('id', contribution.id)
      .select('id, label, category, source, status, created_at, photo_url')
      .single()
    if (error) return res.status(500).json({ error: error.message })

    // The parent already got the "added a contribution" message when the entry
    // was created, so this is a follow-up rather than a repeat.
    try {
      await sendNotificationWithPhoto(
        child.parent_id,
        `📷 ${child.name} "${contribution.label}" katkısına bir fotoğraf ekledi.`,
        photo_url,
      )
    } catch (err) {
      console.error(`[CONTRIBUTIONS] photo notification failed: ${err.message}`)
    }

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/contributions', async (req, res) => {
  try {
    const { child_id, period, scope } = req.query
    if (!child_id) return res.status(400).json({ error: 'child_id required' })

    const { data: child } = await supabase.from('children').select('id, parent_id').eq('id', child_id).maybeSingle()
    if (!child) return res.status(404).json({ error: 'child not found' })

    const effectiveScope = scope === 'today' ? 'today' : scope === 'pending' ? 'pending' : 'month'

    // Pending contributions never expire off the parent's queue just because
    // the month rolled over — `period` is fixed at insert time (UTC month),
    // so a month-scoped query silently drops last month's open pendings.
    // This scope ignores period entirely and returns every open pending.
    if (effectiveScope === 'pending') {
      const { data: parentRow } = await supabase
        .from('parents')
        .select('timezone')
        .eq('id', child.parent_id)
        .single()
      const tz = parentRow?.timezone || 'UTC'

      const { data, error } = await supabase
        .from('contribution_log')
        .select('id, label, category, source, status, created_at, photo_url')
        .eq('child_id', child_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) return res.status(500).json({ error: error.message })

      const contributions = (data || []).map(c => ({
        ...c,
        date: DateTime.fromISO(c.created_at, { zone: 'utc' }).setZone(tz).toFormat('yyyy-MM-dd'),
      }))
      return res.json({ contributions, todayDate: DateTime.now().setZone(tz).toFormat('yyyy-MM-dd') })
    }

    let query = supabase
      .from('contribution_log')
      .select('id, label, category, source, status, created_at, photo_url')
      .eq('child_id', child_id)
      .order('created_at', { ascending: false })

    if (effectiveScope === 'today') {
      const todayStart = DateTime.utc().startOf('day').toISO()
      const todayEnd = DateTime.utc().endOf('day').toISO()
      query = query.gte('created_at', todayStart).lte('created_at', todayEnd)
    } else {
      const effectivePeriod = period || DateTime.utc().toFormat('yyyy-MM')
      query = query.eq('period', effectivePeriod)
    }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    res.json({ contributions: data || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Single deterministic approval path — no gem write here. Gems are computed
// separately in the end-of-month review, by pedagogical design.
app.post('/api/contributions/:id/approve', async (req, res) => {
  try {
    const { id } = req.params
    const { parent_id } = req.body

    const { data: existing } = await supabase.from('contribution_log').select('id').eq('id', id).maybeSingle()
    if (!existing) return res.status(404).json({ error: 'contribution not found' })

    const { data: updated, error } = await supabase
      .from('contribution_log')
      .update({
        status: 'approved',
        approved_at: DateTime.utc().toISO(),
        approved_by: parent_id || null,
      })
      .eq('id', id)
      .select('id, label, category, source, status, created_at')
      .single()

    if (error) return res.status(500).json({ error: error.message })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/contributions/:id/reject', async (req, res) => {
  try {
    const { id } = req.params

    const { data: existing } = await supabase.from('contribution_log').select('id').eq('id', id).maybeSingle()
    if (!existing) return res.status(404).json({ error: 'contribution not found' })

    const { data: updated, error } = await supabase
      .from('contribution_log')
      .update({ status: 'rejected' })
      .eq('id', id)
      .select('id, label, category, source, status, created_at')
      .single()

    if (error) return res.status(500).json({ error: error.message })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// A day's tree reaches full size at this many approved contributions.
// Mirrors DAY_FULL in src/screens/MyTree.jsx — keep the two in step.
const DAY_FULL = 4

// The single source of truth for "how is the tree doing". The child screen, the
// parent dashboard and the Telegram agent all read the tree through here, so a
// parent asking Tuto gets the same numbers the two screens draw.
async function getTreeState(childId, tz) {
  const now = DateTime.now().setZone(tz)
  const todayEnd   = now.endOf('day').toUTC().toISO()
  const monthStart = now.startOf('month').toUTC().toISO()

  const { data: monthLogs } = await supabase
    .from('contribution_log')
    .select('label, category, created_at')
    .eq('child_id', childId)
    .eq('status', 'approved')
    .gte('created_at', monthStart)
    .lte('created_at', todayEnd)
    .order('created_at', { ascending: false })

  const localDay = ts => DateTime.fromISO(ts, { zone: 'utc' }).setZone(tz).toFormat('yyyy-MM-dd')
  const countByDate = {}
  for (const entry of (monthLogs || [])) {
    const d = localDay(entry.created_at)
    countByDate[d] = (countByDate[d] || 0) + 1
  }

  const todayLocalStr = now.toFormat('yyyy-MM-dd')
  const monthForest = []
  let cursor = now.startOf('month')
  const todayDay = now.startOf('day')
  while (cursor <= todayDay) {
    const dateStr = cursor.toFormat('yyyy-MM-dd')
    monthForest.push({ date: dateStr, count: countByDate[dateStr] || 0 })
    cursor = cursor.plus({ days: 1 })
  }

  const today = countByDate[todayLocalStr] || 0
  return {
    today,
    dayFull: DAY_FULL,
    todayComplete: today >= DAY_FULL,
    monthForest,
    monthTreeCount: monthForest.filter(d => d.count > 0).length,
    monthDaysElapsed: monthForest.length,
    monthLeafCount: (monthLogs || []).length,
    monthName: now.toFormat('LLLL yyyy'),
    todayDate: todayLocalStr,
    // What the leaves actually WERE — without this the agent can only report
    // numbers, and a parent asking about the tree wants the deeds.
    recentLeaves: (monthLogs || []).slice(0, 8).map(e => ({
      label: e.label, category: e.category, date: localDay(e.created_at),
    })),
    countByDate,
  }
}

async function tzForChild(childId) {
  const { data: child } = await supabase
    .from('children').select('parent_id').eq('id', childId).single()
  const { data: parentRow } = await supabase
    .from('parents').select('timezone').eq('id', child?.parent_id).single()
  return parentRow?.timezone || 'UTC'
}

app.get('/api/tree', async (req, res) => {
  try {
    const { child_id } = req.query
    if (!child_id) return res.json({ today: 0, listItems: [], monthForest: [], monthTreeCount: 0, todayDate: null })

    const tz = await tzForChild(child_id)
    const now = DateTime.now().setZone(tz)
    const todayStart = now.startOf('day').toUTC().toISO()
    const todayEnd   = now.endOf('day').toUTC().toISO()

    // Tree growth (approved, month-wide) comes from the shared helper; the
    // diary list is this endpoint's own concern:
    // - ALL pending, any date → stays in the list until approved/rejected
    // - today's approved → the "Bugün" part of the list
    const [tree, { data: pendingLogs }, { data: todayApprovedLogs }] = await Promise.all([
      getTreeState(child_id, tz),
      supabase
        .from('contribution_log')
        .select('id, label, category, status, created_at, photo_url')
        .eq('child_id', child_id)
        .eq('status', 'pending'),
      supabase
        .from('contribution_log')
        .select('id, label, category, status, created_at, photo_url')
        .eq('child_id', child_id)
        .eq('status', 'approved')
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd),
    ])

    // Each item is tagged with its own local day so an old pending never
    // masquerades as "today".
    const listItems = [...(pendingLogs || []), ...(todayApprovedLogs || [])]
      .map(e => ({
        id: e.id,
        label: e.label,
        category: e.category,
        status: e.status,
        photo_url: e.photo_url ?? null,
        created_at: e.created_at,
        date: DateTime.fromISO(e.created_at, { zone: 'utc' }).setZone(tz).toFormat('yyyy-MM-dd'),
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))

    res.json({
      today: tree.today,
      listItems,
      monthForest: tree.monthForest,
      monthTreeCount: tree.monthTreeCount,
      todayDate: tree.todayDate,
      dayFull: tree.dayFull,
      monthLeafCount: tree.monthLeafCount,
    })
  } catch {
    res.json({ today: 0, listItems: [], monthForest: [], monthTreeCount: 0, todayDate: null })
  }
})

app.get('/api/tree/archive', async (req, res) => {
  try {
    const { child_id } = req.query
    if (!child_id) return res.json({ allTimeTrees: 0, months: [], years: [] })

    const { data: child } = await supabase
      .from('children').select('parent_id').eq('id', child_id).single()

    const { data: parentRow } = await supabase
      .from('parents').select('timezone').eq('id', child?.parent_id).single()

    const tz = parentRow?.timezone || 'UTC'
    const now = DateTime.now().setZone(tz)
    const currentYearMonth = `${now.year}-${String(now.month).padStart(2, '0')}`

    const { data: logs } = await supabase
      .from('contribution_log')
      .select('created_at')
      .eq('child_id', child_id)
      .eq('status', 'approved')

    // Group into local (year, month, day) keys using parent timezone
    const daySet = new Set()    // 'YYYY-MM-DD' — for allTimeTrees distinct-day count
    const monthMap = {}         // 'YYYY-MM' → { days: Set<string>, contributions: int }
    const yearMap = {}          // 'YYYY'    → Set<'YYYY-MM-DD'>

    for (const row of (logs || [])) {
      const local = DateTime.fromISO(row.created_at, { zone: 'utc' }).setZone(tz)
      const dayKey   = local.toFormat('yyyy-MM-dd')
      const monthKey = local.toFormat('yyyy-MM')
      const yearKey  = String(local.year)

      daySet.add(dayKey)

      if (!monthMap[monthKey]) monthMap[monthKey] = { days: new Set(), contributions: 0 }
      monthMap[monthKey].days.add(dayKey)
      monthMap[monthKey].contributions++

      if (!yearMap[yearKey]) yearMap[yearKey] = new Set()
      yearMap[yearKey].add(dayKey)
    }

    const allTimeTrees = daySet.size

    // months: past months only (exclude current), non-empty, newest first
    const months = Object.entries(monthMap)
      .filter(([key]) => key < currentYearMonth)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, { days, contributions }]) => {
        const [year, month] = key.split('-').map(Number)
        return { year, month, trees: days.size, contributions }
      })

    // years: newest first
    const years = Object.entries(yearMap)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([yearStr, daySetYear]) => ({ year: Number(yearStr), trees: daySetYear.size }))

    res.json({ allTimeTrees, months, years })
  } catch {
    res.json({ allTimeTrees: 0, months: [], years: [] })
  }
})

app.get('/api/submissions/:id', async (req, res) => {
  const { id } = req.params
  const { data, error } = await supabase
    .from('submissions')
    .select('id, status, gems_earned, parent_note, suggested_gems')
    .eq('id', id)
    .single()
  if (error || !data) return res.status(404).json({ error: 'Not found' })
  res.json(data)
})

// Signed, expiring URLs for a submission's photos. The bucket is private, so
// this is the only way the dashboard can render them — and it verifies the
// caller's Supabase JWT and that the submission belongs to THEIR child, so a
// submission id alone is not enough to see a child's photos.
app.get('/api/submissions/:id/photos', async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return res.status(401).json({ error: 'unauthorized' })

    const { data: userData, error: authErr } = await supabase.auth.getUser(token)
    const userId = userData?.user?.id
    if (authErr || !userId) return res.status(401).json({ error: 'unauthorized' })

    const { data: sub } = await supabase
      .from('submissions').select('id, child_id, photo_urls, media_url').eq('id', req.params.id).maybeSingle()
    if (!sub) return res.status(404).json({ error: 'not found' })

    const { data: child } = await supabase
      .from('children').select('parent_id').eq('id', sub.child_id).maybeSingle()
    // parents.id IS the auth user id (see ParentSignup), so this is the check.
    if (!child || child.parent_id !== userId) return res.status(403).json({ error: 'forbidden' })

    const stored = sub.photo_urls?.length ? sub.photo_urls : (sub.media_url ? [sub.media_url] : [])
    res.json({ photos: await signedUrlsFor(stored, 3600) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Signed URL for a contribution's photo. Same private bucket and same
// ownership check as the submission photos — the parent approves contributions
// in the dashboard, so they need to see the photo there, not only on Telegram.
app.get('/api/contributions/:id/photo', async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return res.status(401).json({ error: 'unauthorized' })

    const { data: userData, error: authErr } = await supabase.auth.getUser(token)
    const userId = userData?.user?.id
    if (authErr || !userId) return res.status(401).json({ error: 'unauthorized' })

    const { data: contribution } = await supabase
      .from('contribution_log').select('id, child_id, photo_url').eq('id', req.params.id).maybeSingle()
    if (!contribution) return res.status(404).json({ error: 'not found' })
    if (!contribution.photo_url) return res.json({ photo: null })

    const { data: child } = await supabase
      .from('children').select('parent_id').eq('id', contribution.child_id).maybeSingle()
    // parents.id IS the auth user id, so this is the check.
    if (!child || child.parent_id !== userId) return res.status(403).json({ error: 'forbidden' })

    res.json({ photo: await signedUrlFor(contribution.photo_url, 3600) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/notify-parent-chore', async (req, res) => {
  const { childId, photoUrl, taskDescription, suggestedGems, qualityScore, childNote } = req.body
  if (!childId) return res.status(400).json({ error: 'childId required' })
  try {
    const { data: child } = await supabase
      .from('children').select('name, parent_id').eq('id', childId).single()
    if (!child) return res.status(404).json({ error: 'Child not found' })

    // Server-side safety gate. The client-side evaluateChore() check is UX only
    // — it runs in the browser and its catch block assumes appropriate:true on
    // any error (fails OPEN), and this endpoint previously validated nothing.
    // Same gate the homework flow uses, so the two can't diverge.
    if (photoUrl) {
      const { data: parentRow } = await supabase
        .from('parents').select('prefs').eq('id', child.parent_id).maybeSingle()
      const language = parentRow?.prefs?.language === 'en' ? 'en' : 'tr'

      let image = null
      try {
        // photoUrl is a private-bucket PATH for new clients (legacy rows may
        // still be a public URL — readStoredPhoto handles both).
        const buffer = await readStoredPhoto(photoUrl)
        image = {
          buffer,
          mimeType: String(photoUrl).endsWith('.png') ? 'image/png' : 'image/jpeg',
        }
      } catch (err) {
        console.error(`[CHORE] could not read photo for safety screen: ${err.message}`)
      }

      // Unreadable photo → treat as unverified, block (fail closed).
      const safety = image
        ? await screenImageSafety({ images: [image], kind: 'chore', language })
        : { appropriate: false, matchesTask: false, reason: 'photo could not be read' }

      if (!safety.appropriate) {
        console.log(`[CHORE] inappropriate image child=${childId} — blocked (${safety.reason})`)
        const legacyPath = storagePathFromPublicUrl(photoUrl)
        if (legacyPath) await supabase.storage.from('submissions').remove([legacyPath]).then(() => {}, () => {})
        else await supabase.storage.from(PHOTO_BUCKET).remove([photoUrl]).then(() => {}, () => {})
        try {
          await sendNotification(child.parent_id, language === 'en'
            ? `${child.name} tried to send something as a chore photo that isn't appropriate for a kids' app. I did not forward the image, but I wanted you to know.`
            : `${child.name} ev görevi olarak uygun olmayan bir görsel göndermeye çalıştı. Görseli paylaşmıyorum ama haberin olsun istedim.`)
        } catch (err) {
          console.error(`[CHORE] inappropriate alert failed: ${err.message}`)
        }
        return res.status(400).json({ error: 'Bu fotoğrafı gönderemedim. Ev görevinin fotoğrafını çeker misin?' })
      }
    }

    const gems = suggestedGems || 20
    const { data: submission, error: subErr } = await supabase
      .from('submissions')
      .insert({
        child_id: childId,
        task_type: 'chore',
        status: 'pending',
        media_url: photoUrl,
        task_description: taskDescription || 'Ev görevi',
        suggested_gems: gems,
        child_note: childNote || null,
        score: qualityScore || null,
        gems_earned: null,
      })
      .select('id').single()

    if (subErr) {
      console.error('[notify-parent-chore] submission error:', subErr.message)
      return res.status(500).json({ error: subErr.message })
    }

    const message =
      `🏠 ${child.name} ev görevi tamamladı!\n` +
      `📝 ${taskDescription || 'Ev görevi'}\n` +
      (childNote ? `💬 '${childNote}'\n` : '') +
      `🤖 AI önerisi: +${gems} Gem\n\n` +
      `Fotoğrafı görmek için: ${photoUrl}\n\n` +
      `Sen ne dersin? (evet / hayır / kaç gem)`

    await sendNotificationWithPhoto(child.parent_id, message, photoUrl)
    res.json({ submissionId: submission.id })
  } catch (err) {
    console.error('[notify-parent-chore] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/children/:childId/stories/cover', async (req, res) => {
  const { childId } = req.params
  const { imageBase64, mimeType } = req.body
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' })
  try {
    const buffer = Buffer.from(imageBase64, 'base64')
    const ext = (mimeType || '').includes('png') ? 'png' : 'jpg'
    const path = `${childId}/covers/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('submissions')
      .upload(path, buffer, { contentType: mimeType || 'image/jpeg', upsert: false })
    if (error) return res.status(500).json({ error: error.message })
    const cover_url = supabase.storage.from('submissions').getPublicUrl(path).data.publicUrl
    res.json({ cover_url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Homework module ───────────────────────────────────────────────────────────
// Child photographs finished homework (up to 15 pages). EVERYTHING AI/gem
// related is server-side: EXIF, storage upload, Gemini observation, safety
// screen, submission write (pending, NO gems), parent notification. The client
// only uploads images and shows "it arrived" — gems_earned is never client-set.
const HOMEWORK_MAX_PHOTOS = 15

// Homework submissions whose parent notification is held pending a child's
// "did you do this today?" answer (only when the photo has no readable date).
// submissionId → { deliver(doneToday), timer }. In-memory is fine: the backend
// is a single long-running process (same pattern as the WhatsApp/TG maps).
const pendingHomeworkNotify = new Map()

app.post('/api/children/:childId/homework', async (req, res) => {
  const { childId } = req.params
  const { paths } = req.body
  // Client uploads the images straight to Storage (like chore) and sends only
  // the paths — so the request body stays tiny no matter how many pages, and
  // the ORIGINAL bytes (with EXIF) live on the server side to read.
  if (!Array.isArray(paths) || paths.length === 0) return res.status(400).json({ error: 'paths required' })
  if (paths.length > HOMEWORK_MAX_PHOTOS) return res.status(400).json({ error: `en fazla ${HOMEWORK_MAX_PHOTOS} fotoğraf gönderilebilir` })
  // Constrain to this child's own homework folder — a client can't point the
  // submission at some other object in the bucket.
  const prefix = `${childId}/homework/`
  if (!paths.every(p => typeof p === 'string' && p.startsWith(prefix))) {
    return res.status(400).json({ error: 'invalid path' })
  }

  try {
    const { data: child } = await supabase
      .from('children').select('id, name, age, parent_id, task_settings').eq('id', childId).maybeSingle()
    if (!child) return res.status(404).json({ error: 'child not found' })

    const { data: parentRow } = await supabase
      .from('parents').select('prefs, timezone').eq('id', child.parent_id).maybeSingle()
    const prefs = parentRow?.prefs || {}
    const language = prefs.language === 'en' ? 'en' : 'tr'
    const tone = typeof prefs.tone === 'string' && prefs.tone ? prefs.tone : null
    const tz = parentRow?.timezone || 'UTC'

    // 1. Download the ORIGINAL bytes from Storage (service role). Read EXIF
    //    DateTimeOriginal from the FIRST photo — the client never resized, so
    //    EXIF is intact. Screenshots carry no EXIF; null is expected and fine.
    //    CODE (not Gemini, not the client) decides photo_taken_at.
    const decoded = []
    for (const path of paths) {
      // Prefer the private bucket; fall back to the legacy public one so a
      // still-cached older client (uploading to 'submissions') keeps working
      // through the transition.
      let { data: blob, error: dlErr } = await supabase.storage.from(PHOTO_BUCKET).download(path)
      if (dlErr || !blob) {
        ({ data: blob, error: dlErr } = await supabase.storage.from('submissions').download(path))
      }
      if (dlErr || !blob) return res.status(400).json({ error: `could not read ${path}` })
      const buffer = Buffer.from(await blob.arrayBuffer())
      if (buffer.length === 0) return res.status(400).json({ error: 'empty image' })
      const mimeType = blob.type && blob.type.startsWith('image/') ? blob.type : (path.endsWith('.png') ? 'image/png' : 'image/jpeg')
      decoded.push({ buffer, mimeType })
    }

    let photoTakenAt = null
    try {
      const exif = await exifr.parse(decoded[0].buffer, ['DateTimeOriginal'])
      if (exif?.DateTimeOriginal instanceof Date && !Number.isNaN(exif.DateTimeOriginal.getTime())) {
        photoTakenAt = exif.DateTimeOriginal.toISOString()
      }
    } catch { /* no EXIF (e.g. screenshot) — leave null */ }

    // 2. Store the storage PATHS, not public URLs — the bucket is private, so
    //    readers get a short-lived signed URL instead (signedUrlFor).
    const photoUrls = paths

    // Any rejection below must not leave the uploaded bytes sitting in Storage.
    const discardUploads = () => supabase.storage.from(PHOTO_BUCKET).remove(paths).then(() => {}, () => {})

    // 2.5 Duplicate guard — the same image must not be submitted (and rewarded)
    //     twice. Byte-exact sha256 per page catches a re-sent file.
    const hashes = decoded.map(d => crypto.createHash('sha256').update(d.buffer).digest('hex'))
    const { data: priorSubs, error: priorErr } = await supabase
      .from('submissions')
      .select('photo_hashes')
      .eq('child_id', childId)
      .eq('task_type', 'homework')
    if (priorErr) console.error(`[HOMEWORK] duplicate lookup failed: ${priorErr.message}`)
    const seenHashes = new Set((priorSubs || []).flatMap(s => s.photo_hashes || []))
    if (hashes.some(h => seenHashes.has(h))) {
      console.log(`[HOMEWORK] duplicate photo child=${childId} — rejected`)
      await discardUploads()
      return res.status(409).json({ error: 'You already sent this one 🌱 Try a photo of your new homework!' })
    }

    // 2.6 Image safety gate — looks at the PICTURE. The text screener further
    //     down only ever sees Gemini's written description, which is empty for a
    //     non-homework image, so an inappropriate photo used to reach the parent
    //     untouched. Fails CLOSED: any error, refusal or uncertainty blocks it.
    const safety = await screenImageSafety({ images: decoded, kind: 'homework', language })

    if (!safety.appropriate) {
      console.log(`[HOMEWORK] withheld image child=${childId} (reason: ${safety.reason})`)
      // KEEP the image and record it as 'blocked' — out of the approval queue,
      // but retrievable. The classifier can be wrong (a kid's ghost story got
      // flagged for "blood"), and telling a parent "something was inappropriate"
      // with no way to look leaves them helpless. They can ask to see it.
      const heldRow = {
        child_id: childId,
        task_type: 'homework',
        status: 'blocked',
        photo_urls: photoUrls,
        photo_hashes: hashes,
        media_url: photoUrls[0],
        task_description: 'İncelenmeyi bekleyen görsel',
        gems_earned: null,
      }
      let { error: heldErr } = await supabase.from('submissions').insert(heldRow)
      if (heldErr && /photo_hashes/i.test(heldErr.message || '')) {
        const { photo_hashes, ...withoutHashes } = heldRow
        ;({ error: heldErr } = await supabase.from('submissions').insert(withoutHashes))
      }
      if (heldErr) console.error(`[HOMEWORK] held-row insert failed: ${heldErr.message}`)

      try {
        await sendNotification(child.parent_id, language === 'en'
          ? `${child.name} sent something as homework that I hesitated to forward automatically — I may well be wrong. I've kept it: just say "show me" and I'll send it here so you can decide for yourself.`
          : `${child.name} ödev olarak bir görsel gönderdi ama otomatik iletmekte tereddüt ettim — yanılıyor da olabilirim. Görseli sakladım: "göster" dersen buraya yollarım, kararı sen verirsin.`)
      } catch (err) {
        console.error(`[HOMEWORK] withheld alert failed: ${err.message}`)
      }
      return res.status(400).json({ error: "I couldn't send this one. Can you take a photo of your homework page?" })
    }

    // 3. Gemini observation — server-side only. gemini-3.5-flash intermittently
    //    emits invalid JSON even with response_mime_type set (typically an
    //    unescaped double-quote inside a text field), so a bad parse gets ONE
    //    fresh regeneration before we give up — a re-roll almost always yields
    //    valid JSON. On total failure we still record the submission and notify
    //    the parent (observation stays null). callGeminiWithRetry covers the
    //    HTTP-transient axis; this loop covers the parse-validity axis.
    let observation = null
    try {
      const parts = [
        { text: homeworkObservationPrompt(language) },
        ...decoded.map(d => ({ inline_data: { mime_type: d.mimeType, data: d.buffer.toString('base64') } })),
      ]
      for (let attempt = 0; attempt < 2 && !observation; attempt++) {
        const data = await callGeminiWithRetry(() => fetchGeminiOnce({
          contents: [{ parts }],
          generationConfig: { response_mime_type: 'application/json' },
        }))
        try {
          observation = parseObservation(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
        } catch (parseErr) {
          console.warn(`[HOMEWORK] observation parse attempt ${attempt + 1} failed: ${parseErr.message}`)
        }
      }
    } catch (err) {
      console.error(`[HOMEWORK] observation failed: ${err.message}`)
    }

    // 3.5 Not homework at all — the safety pass and the observation both say so.
    //     Don't file it or bother the parent; ask the child to retake. Requiring
    //     BOTH to agree keeps a misread page from blocking real homework.
    if (!safety.matchesTask && !observation?.looks_like_homework) {
      console.log(`[HOMEWORK] not homework child=${childId} — rejected`)
      await discardUploads()
      return res.status(400).json({ error: "This doesn't look like homework. Try a photo of your homework page!" })
    }

    // 4. Safety screen over what Gemini read on the page. Inappropriate → do NOT
    //    store the submission, alert the parent separately. Screen failure →
    //    proceed (homework is low-risk; don't lose it over a screening hiccup).
    if (observation?.looks_like_homework) {
      const screenText = [observation.subject_guess, observation.blanks_noted, ...(observation.observations || [])]
        .filter(Boolean).join('. ')
      if (screenText) {
        let screening
        try { screening = await screenChildInput(screenText, child.age ?? 7) } catch { /* proceed */ }
        if (screening?.appropriateness === 'inappropriate') {
          console.log(`[HOMEWORK] inappropriate content child=${childId} — submission skipped`)
          try {
            await sendNotification(child.parent_id,
              `${child.name} bir ödev fotoğrafı gönderdi ama içeriğine bir göz atmanda fayda olabilir.`)
          } catch { /* best-effort */ }
          return res.json({ ok: true })
        }
        if (screening?.concern_level === 'concerning' || screening?.concern_level === 'serious') {
          try {
            await sendNotification(child.parent_id,
              `${child.name} bir ödev gönderdi. Sayfada dikkat çekebilecek bir şey olabilir, bir göz atmanda fayda var.`)
          } catch { /* best-effort */ }
        }
      }
    }

    // 5. Store submission — pending, NO gems. suggested_gems is the SERVER-read
    //    configured reward (task_settings.homework.gems, default 25) so the
    //    dashboard/approval path has a number to work with.
    const hwGems = child.task_settings?.homework?.gems ?? HOMEWORK_DEFAULT_GEMS
    const submissionRow = {
      child_id: childId,
      task_type: 'homework',
      status: 'pending',
      photo_urls: photoUrls,
      photo_hashes: hashes,
      media_url: photoUrls[0],
      task_description: observation?.subject_guess || 'Ödev',
      suggested_gems: hwGems,
      gems_earned: null,
      photo_taken_at: photoTakenAt,
    }
    let { data: submission, error: subErr } = await supabase
      .from('submissions').insert(submissionRow).select('id').single()

    // If the dedup column hasn't been migrated yet, don't take homework down
    // over it — store without hashes and shout in the logs. Dedup starts
    // working the moment the column exists.
    if (subErr && /photo_hashes/i.test(subErr.message || '')) {
      console.warn('[HOMEWORK] photo_hashes column missing — RUN THE MIGRATION; storing without dedup for now')
      const { photo_hashes, ...withoutHashes } = submissionRow
      ;({ data: submission, error: subErr } = await supabase
        .from('submissions').insert(withoutHashes).select('id').single())
    }
    if (subErr) {
      console.error(`[HOMEWORK] submission insert failed: ${subErr.message}`)
      return res.status(500).json({ error: subErr.message })
    }

    // Can we vouch for the photo being from today? EXIF present + today =
    // confident (no question). EXIF present + other day = we already know it's
    // stale (note below). EXIF absent (screenshot / downloaded image) = we
    // genuinely can't tell, so we ask the CHILD before notifying the parent.
    const takenLocal = photoTakenAt ? DateTime.fromISO(photoTakenAt, { zone: 'utc' }).setZone(tz).toFormat('yyyy-MM-dd') : null
    const todayLocal = DateTime.now().setZone(tz).toFormat('yyyy-MM-dd')
    const needsDateConfirm = photoTakenAt == null

    // 6. Parent notification. Gemini writes the caption honoring tone+language;
    //    CODE filters low-confidence errors out and supplies the date sentence.
    //    Runs immediately when the date is known, or after the child answers
    //    when it isn't. Notification must never be lost → every branch falls back.
    async function deliverHomeworkNotification(doneToday) {
      let dateNote = ''
      if (photoTakenAt && takenLocal !== todayLocal) {
        dateNote = language === 'en'
          ? "This photo doesn't look like it was taken today."
          : 'Bu fotoğraf bugün çekilmiş görünmüyor.'
      } else if (!photoTakenAt) {
        // Couldn't read the date — relay the child's own answer, hedged. Name as
        // subject (no case suffix) so it reads right for any Turkish name.
        if (doneToday === true) dateNote = language === 'en'
          ? `I couldn't confirm the photo's date, but ${child.name} said they did this homework today — I could be wrong.`
          : `Fotoğrafın tarihini kesinleştiremedim; ${child.name} bu ödevi bugün yaptığını söyledi. Yine de yanılıyor olabilirim.`
        else if (doneToday === false) dateNote = language === 'en'
          ? `I couldn't confirm the photo's date; ${child.name} said they did not do this homework today.`
          : `Fotoğrafın tarihini kesinleştiremedim; ${child.name} bu ödevi bugün yapmadığını söyledi.`
        // doneToday undefined (child never answered) → no date sentence
      }

      let caption
      try {
        const filtered = observation?.looks_like_homework ? filterForParent(observation) : null
        if (!filtered) {
          caption = fallbackCaption({ childName: child.name, language, staleNote: dateNote })
        } else {
          const capData = await callGeminiWithRetry(() => fetchGeminiOnce({
            contents: [{ parts: [{ text: homeworkCaptionPrompt({
              filteredObservation: filtered, childName: child.name, tone, language,
              photoCount: photoUrls.length, staleNote: dateNote, gems: hwGems,
            }) }] }],
          }))
          caption = capData.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim()
          if (!caption) caption = fallbackCaption({ childName: child.name, language, staleNote: dateNote })
        }
      } catch (err) {
        console.error(`[HOMEWORK] caption failed: ${err.message}`)
        caption = fallbackCaption({ childName: child.name, language, staleNote: dateNote })
      }
      if (caption.length > 1024) caption = caption.slice(0, 1021) + '…'

      try {
        await sendNotificationWithPhotos(child.parent_id, caption, photoUrls)
      } catch (err) {
        console.error(`[HOMEWORK] notification failed: ${err.message}`)
      }
    }

    // Child stops waiting the moment the homework is safely recorded.
    res.json({ ok: true, submissionId: submission.id, needsDateConfirm })

    if (needsDateConfirm) {
      // Hold the notification until the child answers "did you do this today?".
      // Safety net: if they never answer (closed the app), send anyway after a
      // grace period so the parent is never left without a notification.
      const timer = setTimeout(() => {
        if (pendingHomeworkNotify.has(submission.id)) {
          pendingHomeworkNotify.delete(submission.id)
          deliverHomeworkNotification(undefined).catch(err => console.error(`[HOMEWORK] deferred notify error: ${err.message}`))
        }
      }, 90_000)
      pendingHomeworkNotify.set(submission.id, { deliver: deliverHomeworkNotification, timer })
    } else {
      deliverHomeworkNotification(undefined).catch(err => console.error(`[HOMEWORK] background notify error: ${err.message}`))
    }
  } catch (err) {
    console.error(`[HOMEWORK] error: ${err.message}`)
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
})

// Child's answer to "did you do this homework today?" — asked only when the
// photo carried no readable date. Releases the held parent notification with
// the child's confirmation woven in. Idempotent: if the safety-net timer
// already fired (or it's an unknown id), this is a no-op.
app.post('/api/homework/:submissionId/confirm-date', async (req, res) => {
  const { submissionId } = req.params
  const { doneToday } = req.body
  const entry = pendingHomeworkNotify.get(submissionId)
  if (entry) {
    clearTimeout(entry.timer)
    pendingHomeworkNotify.delete(submissionId)
    entry.deliver(typeof doneToday === 'boolean' ? doneToday : undefined)
      .catch(err => console.error(`[HOMEWORK] confirm-date notify error: ${err.message}`))
  }
  res.json({ ok: true })
})

// Child-side homework history (last 7 days), newest first. Powers the "This
// week" list on the upload screen. 'checking' is a client-only optimistic
// state; persisted rows are pending/approved/rejected.
app.get('/api/children/:childId/homework', async (req, res) => {
  const { childId } = req.params
  try {
    const since = DateTime.utc().minus({ days: 7 }).toISO()
    const { data, error } = await supabase
      .from('submissions')
      .select('id, status, photo_urls, media_url, created_at')
      .eq('child_id', childId)
      .eq('task_type', 'homework')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    const submissions = (data || []).map(s => ({
      id: s.id,
      date: s.created_at,
      pages: Array.isArray(s.photo_urls) && s.photo_urls.length ? s.photo_urls.length : (s.media_url ? 1 : 0),
      status: s.status,
    }))
    res.json({ submissions })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── My Drawings ─────────────────────────────────────────────────────────────
// Guided-step drawing: the child follows sketch panels, photographs the result
// and is rewarded IMMEDIATELY (no parent approval, unlike homework).
//
// Because there is no approval step, the server is the only thing standing
// between a child and unlimited gems — so the reward amount is decided HERE and
// the client's opinion of it is never read. A free-draw upload is a photo of
// anything at all, so the same daily cap covers it.

const DRAWING_DEFAULTS = { gems: 20, dailyCap: 2 }

// Parent-tunable per child via children.task_settings.drawing.
function drawingSettings(taskSettings) {
  const s = taskSettings?.drawing || {}
  const gems = Number.isFinite(s.gems) ? Math.max(0, Math.min(200, Math.trunc(s.gems))) : DRAWING_DEFAULTS.gems
  const cap = Number.isFinite(s.daily_cap) ? Math.max(0, Math.min(50, Math.trunc(s.daily_cap))) : DRAWING_DEFAULTS.dailyCap
  return { gems, dailyCap: cap, active: s.active !== false }
}

// How many rewarded drawings this child already has today, in THEIR timezone.
// Counted by approved_at, not created_at: gems move at approval, so a drawing
// made yesterday and approved today spends today's allowance.
async function rewardedDrawingsToday(childId, tz) {
  const now = DateTime.now().setZone(tz)
  const { data, error } = await supabase
    .from('paintings')
    .select('id')
    .eq('child_id', childId)
    .gt('reward_amount', 0)
    .gte('approved_at', now.startOf('day').toUTC().toISO())
    .lte('approved_at', now.endOf('day').toUTC().toISO())
  // Fail CLOSED: if we can't count, don't hand out gems.
  if (error) { console.error(`[DRAWING] cap check failed: ${error.message}`); return null }
  return (data || []).length
}

// The catalogue. Panel URLs are derived from the path, never stored.
app.get('/api/drawings', async (req, res) => {
  try {
    const ageGroup = typeof req.query.age_group === 'string' ? req.query.age_group : '6-8'
    const { data, error } = await supabase
      .from('drawings')
      .select('id, age_group, name_tr, name_en, category, step_count')
      .eq('age_group', ageGroup)
      .eq('active', true)
      .order('sort_order', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    res.json({ drawings: data || [], ageGroup })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// The child finished a drawing. The IMAGE BYTES come through here — not
// straight to Storage from the browser.
//
// The first cut had the client upload to the bucket itself, which needed an
// anon INSERT policy on storage.objects. That policy was the hole: child ids
// are discoverable (GET /api/family/:code/children), so anyone with a family
// code could write arbitrary files into a child's folder and then have them
// forwarded to the parent. Here the service role is the only writer, and
// nothing is stored until it has passed the shared image gate.
app.post('/api/children/:childId/paintings', async (req, res) => {
  const { childId } = req.params
  try {
    const { photo_base64, mime_type, drawing_id, age_group } = req.body

    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID.test(childId)) return res.status(400).json({ error: 'invalid child id' })

    if (typeof photo_base64 !== 'string' || !photo_base64) {
      return res.status(400).json({ error: 'photo required' })
    }

    // Uploading is expensive (safety screen + storage), so it gets the same
    // kind of budget as the Gemini proxy.
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip
    if (overLimit(`paint-ip:${ip}`, 40) || overLimit(`paint-child:${childId}`, 20)) {
      return res.status(429).json({ error: 'rate limited' })
    }

    const { data: child } = await supabase
      .from('children')
      .select('id, name, age, parent_id, task_settings')
      .eq('id', childId)
      .maybeSingle()
    if (!child) return res.status(404).json({ error: 'child not found' })

    let buffer
    try {
      buffer = Buffer.from(photo_base64, 'base64')
    } catch {
      return res.status(400).json({ error: 'invalid photo' })
    }
    if (!buffer?.length || buffer.length > 8 * 1024 * 1024) {
      return res.status(400).json({ error: 'invalid photo' })
    }

    const contentType = mime_type === 'image/png' ? 'image/png'
      : mime_type === 'image/webp' ? 'image/webp'
      : 'image/jpeg'

    // Screen BEFORE storing — a rejected image never reaches the bucket, so
    // there is nothing to clean up and nothing to leak.
    const { data: parentRow } = await supabase
      .from('parents').select('prefs').eq('id', child.parent_id).maybeSingle()
    const language = parentRow?.prefs?.language === 'en' ? 'en' : 'tr'
    const safety = await screenImageSafety({
      images: [{ buffer, mimeType: contentType }], kind: 'drawing', language,
    })
    if (!safety.appropriate) {
      console.log(`[DRAWING] inappropriate image child=${childId} — blocked (${safety.reason})`)
      try {
        await sendNotification(child.parent_id, language === 'en'
          ? `${child.name} tried to upload a drawing photo that isn't appropriate for a kids' app. I did not save or forward it, but I wanted you to know.`
          : `${child.name} çizim olarak uygun olmayan bir görsel yüklemeye çalıştı. Kaydetmedim ve paylaşmadım ama haberin olsun istedim.`)
      } catch (err) {
        console.error(`[DRAWING] inappropriate alert failed: ${err.message}`)
      }
      return res.status(400).json({
        error: 'photo_rejected',
        message: language === 'en'
          ? "I couldn't save that photo. Want to take another one?"
          : 'Bu fotoğrafı kaydedemedim. Başka bir tane çeker misin?',
      })
    }

    // Service-role write into the private bucket. The path is built here, so it
    // cannot point at another child's folder.
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
    const photo_path = `${childId}/${randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from(PAINTING_BUCKET)
      .upload(photo_path, buffer, { contentType, upsert: false })
    if (upErr) {
      console.error(`[DRAWING] upload failed for child=${childId}: ${upErr.message}`)
      return res.status(500).json({ error: 'could not save the photo' })
    }

    // A drawing_id must exist in the catalogue; anything else is free-draw.
    let resolvedDrawing = null
    if (drawing_id) {
      const { data: d } = await supabase
        .from('drawings')
        .select('id, age_group, name_tr, name_en, step_count')
        .eq('id', drawing_id)
        .eq('age_group', age_group || '6-8')
        .maybeSingle()
      resolvedDrawing = d || null
    }

    // The drawing lands PENDING. No gems here — not even a provisional entry:
    // the amount is decided when the parent approves, so there is nothing for a
    // client to influence at upload time.
    const { data: painting, error: insErr } = await supabase
      .from('paintings')
      .insert({
        child_id: childId,
        drawing_id: resolvedDrawing?.id ?? null,
        age_group: resolvedDrawing?.age_group ?? (age_group || null),
        photo_path,
        status: 'pending',
        reward_amount: 0,
      })
      .select('id, drawing_id, age_group, photo_path, status, reward_amount, created_at')
      .single()
    if (insErr) return res.status(500).json({ error: insErr.message })

    // Passive transparency plus the ask: the parent sees the photo AND is told
    // it is waiting on them. Same boundary-signing as homework — the URL is
    // short-lived and Telegram re-hosts the image immediately.
    try {
      const what = resolvedDrawing ? `"${resolvedDrawing.name_tr}" çizimini` : 'kendi çizimini'
      await sendNotificationWithPhoto(
        child.parent_id,
        `🎨 ${child.name} ${what} bitirdi ve fotoğrafını ekledi.\n\n` +
        `Onaylarsan ödülü ekleyeyim — "onayla" diyebilir ya da panelden bakabilirsin.`,
        photo_path,
        PAINTING_BUCKET,
      )
    } catch (err) {
      console.error(`[DRAWING] parent notification failed: ${err.message}`)
    }

    res.status(201).json({
      painting: { ...painting, photo: await signedUrlFor(photo_path, 3600, PAINTING_BUCKET) },
      status: 'pending',
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Decides and pays out a drawing's reward. This is the ONLY place a drawing
// writes to bt_ledger, and it runs only after the caller is proven to be the
// child's parent. The amount comes from settings, never from the request.
async function approvePaintingById(paintingId, parentId) {
  const { data: painting } = await supabase
    .from('paintings')
    .select('id, child_id, drawing_id, status, photo_path')
    .eq('id', paintingId)
    .maybeSingle()
  if (!painting) return { success: false, error: 'not found' }
  if (painting.status !== 'pending') return { success: false, error: `already ${painting.status}` }

  const { data: child } = await supabase
    .from('children')
    .select('id, name, parent_id, task_settings')
    .eq('id', painting.child_id)
    .maybeSingle()
  if (!child || child.parent_id !== parentId) return { success: false, error: 'forbidden' }

  const settings = drawingSettings(child.task_settings)
  const tz = await tzForChild(child.id)
  const rewardedToday = await rewardedDrawingsToday(child.id, tz)

  // The cap is applied at APPROVAL time, because that is when gems move. Fails
  // closed: if the count can't be read, approve the drawing but pay nothing.
  let awarded = 0
  let capped = false
  if (!settings.active || rewardedToday === null || rewardedToday >= settings.dailyCap) {
    capped = true
  } else {
    awarded = settings.gems
  }

  const { error: updErr } = await supabase
    .from('paintings')
    .update({ status: 'approved', reward_amount: awarded, approved_at: new Date().toISOString() })
    .eq('id', painting.id)
    .eq('status', 'pending')  // guard against a concurrent approval racing us
  if (updErr) return { success: false, error: updErr.message }

  if (awarded > 0) {
    const { error: ledErr } = await supabase
      .from('bt_ledger')
      .insert({ child_id: child.id, amount: awarded, reason: 'drawing' })
    if (ledErr) {
      console.error(`[DRAWING] ledger insert failed for ${painting.id}: ${ledErr.message}`)
      await supabase.from('paintings').update({ reward_amount: 0 }).eq('id', painting.id)
      return { success: false, error: 'reward could not be recorded' }
    }
  }

  return { success: true, id: painting.id, childName: child.name, gems: awarded, capped }
}

async function rejectPaintingById(paintingId, parentId) {
  const { data: painting } = await supabase
    .from('paintings')
    .select('id, child_id, status')
    .eq('id', paintingId)
    .maybeSingle()
  if (!painting) return { success: false, error: 'not found' }
  if (painting.status !== 'pending') return { success: false, error: `already ${painting.status}` }

  const { data: child } = await supabase
    .from('children').select('id, name, parent_id').eq('id', painting.child_id).maybeSingle()
  if (!child || child.parent_id !== parentId) return { success: false, error: 'forbidden' }

  // Rejected drawings stay in the library — the child keeps the picture, it
  // just doesn't earn. Nothing is deleted.
  const { error } = await supabase
    .from('paintings')
    .update({ status: 'rejected', reward_amount: 0 })
    .eq('id', painting.id)
    .eq('status', 'pending')
  if (error) return { success: false, error: error.message }
  return { success: true, id: painting.id, childName: child.name }
}

// Dashboard approve/reject. Parent JWT + ownership, both checked inside.
async function paintingActionRoute(req, res, action) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return res.status(401).json({ error: 'unauthorized' })
    const { data: userData, error: authErr } = await supabase.auth.getUser(token)
    const userId = userData?.user?.id
    if (authErr || !userId) return res.status(401).json({ error: 'unauthorized' })

    const result = await action(req.params.id, userId)
    if (!result.success) {
      const code = result.error === 'forbidden' ? 403 : result.error === 'not found' ? 404 : 400
      return res.status(code).json({ error: result.error })
    }
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

app.post('/api/paintings/:id/approve', (req, res) => paintingActionRoute(req, res, approvePaintingById))
app.post('/api/paintings/:id/reject', (req, res) => paintingActionRoute(req, res, rejectPaintingById))

// The child's own library. The photos are in a private bucket with no client
// read policy, so the server signs each one; the child app has no session and
// could not read them any other way.
app.get('/api/children/:childId/paintings', async (req, res) => {
  const { childId } = req.params
  try {
    const { data, error } = await supabase
      .from('paintings')
      .select('id, drawing_id, age_group, photo_path, status, reward_amount, created_at')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(60)
    if (error) return res.status(500).json({ error: error.message })

    const paintings = await Promise.all((data || []).map(async p => ({
      id: p.id,
      drawing_id: p.drawing_id,
      age_group: p.age_group,
      status: p.status,
      reward_amount: p.reward_amount,
      created_at: p.created_at,
      photo: await signedUrlFor(p.photo_path, 3600, PAINTING_BUCKET),
    })))
    res.json({ paintings })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Parent-side view of a child's paintings. Unlike the child route this proves
// WHO is asking — parent JWT plus ownership of that child.
app.get('/api/parent/children/:childId/paintings', async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return res.status(401).json({ error: 'unauthorized' })

    const { data: userData, error: authErr } = await supabase.auth.getUser(token)
    const userId = userData?.user?.id
    if (authErr || !userId) return res.status(401).json({ error: 'unauthorized' })

    const { data: child } = await supabase
      .from('children').select('id, parent_id').eq('id', req.params.childId).maybeSingle()
    // parents.id IS the auth user id, so this is the check.
    if (!child || child.parent_id !== userId) return res.status(403).json({ error: 'forbidden' })

    const { data } = await supabase
      .from('paintings')
      .select('id, drawing_id, photo_path, status, reward_amount, created_at')
      .eq('child_id', child.id)
      .order('created_at', { ascending: false })
      .limit(60)

    const paintings = await Promise.all((data || []).map(async p => ({
      id: p.id,
      drawing_id: p.drawing_id,
      status: p.status,
      reward_amount: p.reward_amount,
      created_at: p.created_at,
      photo: await signedUrlFor(p.photo_path, 3600, PAINTING_BUCKET),
    })))
    res.json({ paintings })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/children/:childId/spelling-errors', async (req, res) => {
  const { childId } = req.params
  const { errors } = req.body
  if (errors?.length) {
    await supabase.from('spelling_errors').insert(errors.map(e => ({ child_id: childId, ...e })))
  }
  res.json({ ok: true })
})

app.get('/api/whatsapp-status/:parentId', (req, res) => {
  res.json({ connected: isConnected(req.params.parentId) })
})

app.post('/api/disconnect-whatsapp', async (req, res) => {
  const { parentId } = req.body
  if (!parentId) return res.status(400).json({ error: 'parentId required' })
  try {
    await disconnectParent(parentId)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/connect-whatsapp', async (req, res) => {
  const { parentId, phoneNumber } = req.body
  if (!parentId || !phoneNumber) {
    return res.status(400).json({ error: 'parentId and phoneNumber are required' })
  }
  try {
    const code = await connectParent(parentId, phoneNumber)
    if (code === null) {
      return res.json({ alreadyConnected: true })
    }
    res.json({ pairingCode: code })
  } catch (err) {
    console.error('[connect-whatsapp]', err.message)
    res.status(500).json({ error: err.message })
  }
})

const WA_VERIFY_TOKEN    = process.env.WHATSAPP_VERIFY_TOKEN || 'tuto_webhook_2024'
const WA_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const whatsappToken      = process.env.WHATSAPP_API_TOKEN

async function sendWhatsAppBusinessMessage(to, message) {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${WA_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${whatsappToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.log('[WA] Error response:', JSON.stringify(err))
    throw new Error(err.error?.message || `WhatsApp API error ${res.status}`)
  }
  return res.json()
}

async function sendWhatsAppPhoto(phoneNumber, photoUrl, caption) {
  // 1. Download image as buffer
  console.log(`[WA-PHOTO] Downloading image — url=${photoUrl}`)
  const imageResponse = await axios.get(photoUrl, { responseType: 'arraybuffer' })
  const imageBuffer = Buffer.from(imageResponse.data)
  console.log(`[WA-PHOTO] Downloaded ${imageBuffer.length} bytes`)

  // 2. Upload buffer to Meta as multipart/form-data → get media_id
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', 'image/jpeg')
  form.append('file', imageBuffer, { filename: 'photo.jpg', contentType: 'image/jpeg' })

  console.log(`[WA-PHOTO] Uploading to Meta media endpoint`)
  let mediaId
  try {
    const uploadResponse = await axios.post(
      `https://graph.facebook.com/v19.0/${WA_PHONE_NUMBER_ID}/media`,
      form,
      { headers: { ...form.getHeaders(), Authorization: `Bearer ${whatsappToken}` } }
    )
    mediaId = uploadResponse.data.id
    console.log(`[WA-PHOTO] media_id=${mediaId}`)
  } catch (err) {
    console.log('[WA] Error response:', JSON.stringify(err.response?.data))
    throw new Error(err.response?.data?.error?.message || err.message)
  }

  // 3. Send image message using media_id
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${WA_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'image',
        image: { id: mediaId, caption },
      },
      { headers: { Authorization: `Bearer ${whatsappToken}` } }
    )
    console.log(`[WA-PHOTO] ✅ Photo sent to ${phoneNumber}`)
  } catch (err) {
    console.log('[WA] Error response:', JSON.stringify(err.response?.data))
    throw new Error(err.response?.data?.error?.message || err.message)
  }
}

app.post('/api/verify-whatsapp', async (req, res) => {
  const { phoneNumber, parentId } = req.body
  if (!phoneNumber || !parentId) return res.status(400).json({ error: 'phoneNumber and parentId required' })

  try {
    await supabase
      .from('parents')
      .update({ whatsapp_phone: phoneNumber, notification_channel: 'whatsapp' })
      .eq('id', parentId)
    res.json({ success: true })
  } catch (err) {
    console.error('[verify-whatsapp]', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/send-welcome-whatsapp', async (req, res) => {
  const { phoneNumber, childName, parentId } = req.body
  if (!phoneNumber || !childName || !parentId) return res.status(400).json({ error: 'phoneNumber, childName and parentId required' })

  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${WA_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${whatsappToken}` },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'template',
          template: { name: 'hello_world', language: { code: 'en_US' } },
        }),
      }
    )
    const response = await metaRes.json()
    console.log('[WA-BIZ] Meta response:', JSON.stringify(response))
    if (!metaRes.ok) throw new Error(response.error?.message || `Meta API error ${metaRes.status}`)
    await supabase.from('parents').update({ whatsapp_phone: phoneNumber, notification_channel: 'whatsapp' }).eq('id', parentId)
    console.log(`[WA-BIZ] Welcome sent to ${phoneNumber} for parent ${parentId}`)
    res.json({ success: true })
  } catch (err) {
    console.error('[send-welcome-whatsapp]', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/send-welcome', async (req, res) => {
  const { parentId } = req.body
  if (!parentId) return res.status(400).json({ error: 'parentId required' })

  try {
    const [{ data: parent }, { data: children }] = await Promise.all([
      supabase.from('parents').select('notification_channel, whatsapp_phone, telegram_chat_id').eq('id', parentId).single(),
      supabase.from('children').select('name').eq('parent_id', parentId).order('created_at').limit(1),
    ])

    const childName = children?.[0]?.name || 'your child'
    const isTurkish = parent?.whatsapp_phone?.startsWith('90')

    const message = isTurkish
      ? `👋 Merhaba! Ben Tuto, ${childName}'in öğrenme arkadaşı!\n\n${childName} görevlerini tamamladıkça sizi buradan haberdar edeceğim. 🎉\n\nBana istediğiniz zaman yazabilirsiniz — ${childName}'in gelişimini, kazandığı Gems'leri ve daha fazlasını sorabilirsiniz! 💎`
      : `👋 Hi! I'm Tuto, ${childName}'s learning companion!\n\nI'll keep you updated here as ${childName} completes tasks. 🎉\n\nFeel free to message me anytime — you can ask about ${childName}'s progress, earned Gems, and more! 💎`

    const channel = parent?.notification_channel
    if (channel === 'telegram' && parent?.telegram_chat_id) {
      await sendTelegramMessage(parent.telegram_chat_id, message)
      console.log(`[WELCOME] Sent via Telegram to parent ${parentId}`)
    } else if (channel === 'whatsapp' && parent?.whatsapp_phone) {
      await sendWhatsAppBusinessMessage(parent.whatsapp_phone, message)
      console.log(`[WELCOME] Sent via WhatsApp to parent ${parentId}`)
    } else {
      console.log(`[WELCOME] No channel configured for parent ${parentId} — skipped`)
    }

    res.json({ success: true })
  } catch (err) {
    console.error('[send-welcome]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Webhook verification
app.get('/webhook/whatsapp', (req, res) => {
  const mode      = req.query['hub.mode']
  const token     = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']
  if (mode === 'subscribe' && token === WA_VERIFY_TOKEN) {
    console.log('[WA-BIZ] Webhook verified.')
    return res.status(200).send(challenge)
  }
  res.sendStatus(403)
})

// Incoming messages
app.post('/webhook/whatsapp', async (req, res) => {
  res.sendStatus(200) // acknowledge immediately

  try {
    const entry   = req.body?.entry?.[0]
    const changes = entry?.changes?.[0]
    const value   = changes?.value

    // Ignore status updates (delivered, read, etc.)
    if (!value?.messages?.length) return

    const msg  = value.messages[0]
    const from = msg.from // phone number in E.164 without +
    const text = msg.text?.body?.trim()
    if (!text) return

    console.log(`[WA-BIZ] Incoming from ${from}: "${text}"`)

    // Find parent by whatsapp_phone in parents table
    // Meta sends numbers without '+', e.g. "905XXXXXXXXX"
    console.log(`[WA-BIZ] Looking up parent for phone: "${from}"`)
    const { data: parents, error: lookupErr } = await supabase
      .from('parents')
      .select('id')
      .eq('whatsapp_phone', from)
      .limit(1)

    console.log(`[WA-BIZ] Lookup result: parents=${JSON.stringify(parents)}, error=${lookupErr ? lookupErr.message : 'none'}`)

    const parentId = parents?.[0]?.id
    if (!parentId) {
      console.log(`[WA-BIZ] No parent found for phone ${from} — check whatsapp_phone column in parents table`)
      return
    }

    await handleMessage(
      parentId,
      reply => sendWhatsAppBusinessMessage(from, reply),
      text
    )
  } catch (err) {
    console.error('[WA-BIZ] Webhook error:', err.message)
  }
})

app.listen(3000, async () => {
  console.log('Tuto sunucusu port 3000\'de çalışıyor.')
  // Photo retention — homework/chore images are deleted once past the window
  // (PHOTO_RETENTION_DAYS, default 60). Runs at boot and daily thereafter.
  purgeOldPhotos().catch(err => console.error(`[PURGE] ${err.message}`))
  setInterval(() => purgeOldPhotos().catch(err => console.error(`[PURGE] ${err.message}`)), 24 * 60 * 60 * 1000)
  startTelegramBot()
  await restoreSessions()
  await startSubmissionListener()
  setupConnectHandler()
  setupMessageListener()
})
