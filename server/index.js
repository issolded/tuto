import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import axios from 'axios'
import FormData from 'form-data'
import { connectParent, sendMessage, setMessageHandler, setConnectHandler, restoreSessions, isConnected, disconnectParent } from './whatsapp.js'
import { startTelegramBot, sendTelegramMessage, sendTelegramPhoto, getTelegramChatId, setTelegramMessageHandler, sendTelegramTyping } from './telegram.js'

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
    ] = await Promise.all([
      supabase.from('submissions').select('task_type, score, gems_earned, status, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('submissions').select('task_type, score, gems_earned, status, created_at').eq('child_id', child.id).gte('created_at', todayStart).lte('created_at', todayEnd).order('created_at', { ascending: false }),
      supabase.from('math_progress').select('level, topic, accuracy, level_change, help_used, questions_total, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('bt_ledger').select('amount, reason, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('stories').select('title, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(5).then(r => r).catch(() => ({ data: [] })),
      supabase.from('books').select('title, completed, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(5).then(r => r).catch(() => ({ data: [] })),
      supabase.from('contribution_log').select('id, label, category, created_at').eq('child_id', child.id).eq('status', 'pending').order('created_at', { ascending: false }),
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

async function sendNotificationWithPhoto(parentId, message, photoUrl) {
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
  ],
}]

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

    function buildSystemPrompt(currentPendingList) {
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

      return (
        `${childrenBlock}\n\n` +
        `${pendingBlock}\n\n` +
        `- Yukarıdaki "onay bekleyen katkılar" listesinde bir veya daha fazla kayıt VARSA, asla "onay bekleyen ` +
        `bir şey yok" deme. Parent onay sorduğunda ya da "onayla" dediğinde, bu listeyi referans al. Liste boşsa, ` +
        `o zaman bekleyen olmadığını söyle.\n\n` +
        `You are Tuto, a warm AI learning assistant and trusted family companion.\n` +
        `Current local time for parent: ${localTimeStr}\n` +
        `You know this family's learning data:\n${JSON.stringify(familyData, null, 2)}\n\n` +
        `Tool usage rules:\n` +
        `- Use the exact "id" from the pending contributions list above when calling approve_contribution or ` +
        `reject_contribution.\n` +
        `- Use the exact "id" from the children list above when calling add_card or approve_all_pending.\n` +
        `- Approving a contribution does NOT award gems. Gems are tallied separately in the end-of-month review. ` +
        `Approving simply adds a leaf to the child's tree.\n` +
        `- NEVER tell the parent the child "earned gems" for a contribution approval — talk about a leaf being ` +
        `added to their tree instead.\n` +
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
      } else {
        toolResult = { success: false, error: `unknown tool ${name}` }
      }
      console.log(`[MSG] Tool "${name}"(${JSON.stringify(args)}) → ${JSON.stringify(toolResult)}`)
      toolResults.push({ name, contributionId: args.contribution_id, result: toolResult })
    }

    // Refresh the pending list so the second call doesn't contradict itself —
    // a just-approved/rejected contribution must no longer show as pending.
    // approve_all_pending has no single contributionId — it reports the whole
    // batch via result.approvedIds instead.
    const processedIds = new Set(
      toolResults.filter(t => t.result.success).flatMap(t => t.result.approvedIds ?? (t.contributionId ? [t.contributionId] : []))
    )
    const refreshedPendingList = pendingList.filter(p => !processedIds.has(p.id))
    const refreshedSystemPrompt = buildSystemPrompt(refreshedPendingList)

    const secondData = await callGeminiWithRetry(() => fetchGeminiOnce({
      system_instruction: { parts: [{ text: refreshedSystemPrompt }] },
      contents: [
        ...contents,
        { role: 'model', parts: fnCallParts.map(p => ({ functionCall: p.functionCall })) },
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

        // Chore submissions are handled by /api/notify-parent-chore
        if (submission.task_type === 'chore') return

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
app.post('/api/gemini/generate', async (req, res) => {
  try {
    const { parts, generationConfig } = req.body
    if (!Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ error: 'parts required' })
    }
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

    const fetchActiveCards = () => supabase
      .from('contribution_cards')
      .select('id, label, category, icon, color')
      .eq('child_id', child_id)
      .eq('active', true)
      .order('sort_order', { ascending: true })

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

app.get('/api/tree', async (req, res) => {
  try {
    const { child_id } = req.query
    if (!child_id) return res.json({ today: 0, listItems: [], monthForest: [], monthTreeCount: 0, todayDate: null })

    const { data: child } = await supabase
      .from('children')
      .select('parent_id')
      .eq('id', child_id)
      .single()

    const { data: parentRow } = await supabase
      .from('parents')
      .select('timezone')
      .eq('id', child?.parent_id)
      .single()

    const tz = parentRow?.timezone || 'UTC'
    const now = DateTime.now().setZone(tz)

    const todayStart = now.startOf('day').toUTC().toISO()
    const todayEnd   = now.endOf('day').toUTC().toISO()
    const monthStart = now.startOf('month').toUTC().toISO()

    // Three separate queries:
    // 1. Month approved-only → drives tree growth counts and forest (unchanged)
    // 2. ALL pending, any date → stays in the diary list until approved/rejected
    // 3. Today's approved-only → the "Bugün" part of the diary list
    const [{ data: monthLogs }, { data: pendingLogs }, { data: todayApprovedLogs }] = await Promise.all([
      supabase
        .from('contribution_log')
        .select('created_at')
        .eq('child_id', child_id)
        .eq('status', 'approved')
        .gte('created_at', monthStart)
        .lte('created_at', todayEnd),
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

    const countByDate = {}
    const todayLocalStr = now.toFormat('yyyy-MM-dd')

    for (const entry of (monthLogs || [])) {
      const localDate = DateTime.fromISO(entry.created_at, { zone: 'utc' }).setZone(tz).toFormat('yyyy-MM-dd')
      countByDate[localDate] = (countByDate[localDate] || 0) + 1
    }

    const today = countByDate[todayLocalStr] || 0

    // Diary list: every pending contribution (any date, until approved/rejected)
    // plus today's approved ones — each tagged with its own local day so an
    // old pending never masquerades as "today".
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

    const monthForest = []
    let cursor = now.startOf('month')
    const todayDay = now.startOf('day')
    while (cursor <= todayDay) {
      const dateStr = cursor.toFormat('yyyy-MM-dd')
      monthForest.push({ date: dateStr, count: countByDate[dateStr] || 0 })
      cursor = cursor.plus({ days: 1 })
    }

    const monthTreeCount = monthForest.filter(d => d.count > 0).length

    res.json({ today, listItems, monthForest, monthTreeCount, todayDate: todayLocalStr })
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

app.post('/api/notify-parent-chore', async (req, res) => {
  const { childId, photoUrl, taskDescription, suggestedGems, qualityScore, childNote } = req.body
  if (!childId) return res.status(400).json({ error: 'childId required' })
  try {
    const { data: child } = await supabase
      .from('children').select('name, parent_id').eq('id', childId).single()
    if (!child) return res.status(404).json({ error: 'Child not found' })

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
  startTelegramBot()
  await restoreSessions()
  await startSubmissionListener()
  setupConnectHandler()
  setupMessageListener()
})
