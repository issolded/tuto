import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import axios from 'axios'
import FormData from 'form-data'
import { connectParent, sendMessage, setMessageHandler, setConnectHandler, restoreSessions, isConnected, disconnectParent } from './whatsapp.js'
import { startTelegramBot, sendTelegramMessage, sendTelegramPhoto, getTelegramChatId, setTelegramMessageHandler } from './telegram.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

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
      { data: pendingContribs },
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
      pendingContributions: pendingContributions.length ? pendingContributions : `${child.name} has no contributions awaiting approval`,
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

async function moderateContributionText(text, age) {
  const n = Number(age) || 7
  const prompt =
    `You are a content moderator for a children's educational app. A ${n}-year-old child wrote this about a ` +
    `way they helped: "${text}". Determine if it is appropriate and safe for a children's app — no profanity, ` +
    `violence, adult themes, or inappropriate content. Return JSON only: { "ok": boolean, "reason": string }`

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
  if (typeof parsed.ok !== 'boolean') throw new Error('malformed moderation response')
  return parsed
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
        'Approve a pending household contribution diary entry. Only call this when the parent clearly expresses ' +
        'intent to approve ONE SPECIFIC contribution from the pending list. If more than one contribution is ' +
        'pending and it is unclear which one the parent means, do NOT call this — ask the parent to clarify first. ' +
        'If the parent wants to approve multiple contributions (e.g. "both", "approve all of them"), make a ' +
        'SEPARATE approve_contribution call for each contribution.',
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
  try {
    const historyContents = await fetchConversationHistory(parentId)
    await logMessage(parentId, 'parent', text)

    const [familyData, { data: parentRow }] = await Promise.all([
      getParentContext(parentId),
      supabase.from('parents').select('timezone').eq('id', parentId).single(),
    ])
    const tz = parentRow?.timezone || 'UTC'
    const userNow = DateTime.now().setZone(tz)
    const localTimeStr = `${userNow.toFormat('yyyy-MM-dd HH:mm')} (${tz})`

    const pendingList = familyData.flatMap(c =>
      Array.isArray(c.pendingContributions)
        ? c.pendingContributions.map(p => ({ id: p.id, label: p.label, category: p.category, child: c.name }))
        : []
    )

    function buildSystemPrompt(currentPendingList) {
      const pendingBlock =
        `ŞU AN ONAY BEKLEYEN KATKILAR (toplam ${currentPendingList.length}):\n` +
        (currentPendingList.length
          ? currentPendingList.map(p => `- id=${p.id}: "${p.label}" — ${p.child} (${p.category})`).join('\n')
          : 'Şu anda onay bekleyen katkı yok.')

      return (
        `${pendingBlock}\n\n` +
        `- Yukarıdaki "onay bekleyen katkılar" listesinde bir veya daha fazla kayıt VARSA, asla "onay bekleyen ` +
        `bir şey yok" deme. Parent onay sorduğunda ya da "onayla" dediğinde, bu listeyi referans al. Liste boşsa, ` +
        `o zaman bekleyen olmadığını söyle.\n\n` +
        `You are Tuto, a warm AI learning assistant and trusted family companion.\n` +
        `Current local time for parent: ${localTimeStr}\n` +
        `You know this family's learning data:\n${JSON.stringify(familyData, null, 2)}\n\n` +
        `Tool usage rules:\n` +
        `- Use the exact "id" from the pending contributions list above when calling a tool.\n` +
        `- Approving a contribution does NOT award gems. Gems are tallied separately in the end-of-month review. ` +
        `Approving simply adds a leaf to the child's tree.\n` +
        `- NEVER tell the parent the child "earned gems" for a contribution approval — talk about a leaf being ` +
        `added to their tree instead.\n` +
        `- Only call approve_contribution or reject_contribution when the parent clearly states approve/reject ` +
        `intent for ONE SPECIFIC contribution.\n` +
        `- If more than one contribution is pending and it is unclear which one the parent means, do NOT call a ` +
        `tool — ask which one they mean first, in the same language as the parent's message.\n\n` +
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

    const firstRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        tools: CONTRIBUTION_TOOLS,
      }),
    })
    if (!firstRes.ok) {
      const err = await firstRes.json().catch(() => ({}))
      throw new Error(err.error?.message || `Gemini API error ${firstRes.status}`)
    }
    const firstData = await firstRes.json()
    const parts = firstData.candidates?.[0]?.content?.parts || []
    const fnCallParts = parts.filter(p => p.functionCall)

    if (fnCallParts.length === 0) {
      const reply = parts.map(p => p.text || '').join('').trim() || 'Üzgünüm, anlayamadım.'
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
      } else if (name === 'reject_contribution') {
        toolResult = await rejectContributionTool(args.contribution_id)
      } else {
        toolResult = { success: false, error: `unknown tool ${name}` }
      }
      console.log(`[MSG] Tool "${name}"(${args.contribution_id}) → ${JSON.stringify(toolResult)}`)
      toolResults.push({ name, contributionId: args.contribution_id, result: toolResult })
    }

    // Refresh the pending list so the second call doesn't contradict itself —
    // a just-approved/rejected contribution must no longer show as pending.
    const processedIds = new Set(toolResults.filter(t => t.result.success).map(t => t.contributionId))
    const refreshedPendingList = pendingList.filter(p => !processedIds.has(p.id))
    const refreshedSystemPrompt = buildSystemPrompt(refreshedPendingList)

    const secondRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: refreshedSystemPrompt }] },
        contents: [
          ...contents,
          { role: 'model', parts: fnCallParts.map(p => ({ functionCall: p.functionCall })) },
          { role: 'user', parts: toolResults.map(t => ({ functionResponse: { name: t.name, response: t.result } })) },
        ],
        tools: CONTRIBUTION_TOOLS,
      }),
    })
    if (!secondRes.ok) {
      const err = await secondRes.json().catch(() => ({}))
      throw new Error(err.error?.message || `Gemini API error ${secondRes.status}`)
    }
    const secondData = await secondRes.json()
    const finalText = secondData.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || 'Tamamlandı.'
    await logMessage(parentId, 'tuto', finalText)
    await replyCb(finalText)
    console.log(`[MSG] Reply sent to parent ${parentId}`)
  } catch (err) {
    console.error('[MSG] Message handling error:', err.message)
  }
}

function setupMessageListener() {
  setMessageHandler((parentId, phone, text) =>
    handleMessage(parentId, msg => sendMessage(parentId, phone, msg), text)
  )
  setTelegramMessageHandler((parentId, chatId, text) =>
    handleMessage(parentId, msg => sendTelegramMessage(chatId, msg), text)
  )
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
      try {
        const moderation = await moderateContributionText(trimmedLabel, child.age)
        if (!moderation.ok) {
          return res.status(400).json({ error: 'inappropriate', reason: moderation.reason })
        }
      } catch (err) {
        console.error(`[CONTRIBUTIONS] moderation failed: ${err.message}`)
        return res.status(503).json({ error: 'Şu an kaydedemedik, tekrar dener misin?' })
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

    const { data: child } = await supabase.from('children').select('id').eq('id', child_id).maybeSingle()
    if (!child) return res.status(404).json({ error: 'child not found' })

    const effectiveScope = scope === 'today' ? 'today' : 'month'

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
