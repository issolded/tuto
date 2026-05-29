import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import { connectParent, sendMessage, setMessageHandler, setConnectHandler, restoreSessions, isConnected, disconnectParent } from './whatsapp.js'
import { startTelegramBot, sendTelegramMessage, sendTelegramPhoto, getTelegramChatId, setTelegramMessageHandler } from './telegram.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const GEMINI_API_KEY = 'AIzaSyDHMBb9SbxkPJKSqNWB7vgRYJ8yiT8Cq5Q'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

async function classifyIntent(text) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text:
        `Classify this parent message intent. Return JSON only:\n` +
        `{"intent":"approve"|"reject"|"auto_approve"|"manual_approve"|"other","confidence":0-1}\n` +
        `Message: '${text.replace(/'/g, "\\'")}'`
      }] }],
      generationConfig: { response_mime_type: 'application/json' },
    }),
  })
  if (!res.ok) return { intent: 'other', confidence: 0 }
  const data = await res.json()
  try { return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}') }
  catch { return { intent: 'other', confidence: 0 } }
}

async function getParentContext(parentId) {
  const [{ data: parentRow }, { data: children }] = await Promise.all([
    supabase.from('parents').select('timezone').eq('id', parentId).single(),
    supabase.from('children').select('id, name, age, task_settings').eq('parent_id', parentId),
  ])
  if (!children?.length) return []

  const tz = parentRow?.timezone || 'UTC'
  const userNow = DateTime.now().setZone(tz)
  const todayStart = userNow.startOf('day').toUTC().toISO()
  const todayEnd   = userNow.endOf('day').toUTC().toISO()

  return Promise.all(children.map(async child => {
    const [
      { data: submissions },
      { data: todaySubs },
      { data: mathProgress },
      { data: ledger },
      { data: stories },
      { data: books },
    ] = await Promise.all([
      supabase.from('submissions').select('task_type, score, gems_earned, status, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('submissions').select('task_type, score, gems_earned, status, created_at').eq('child_id', child.id).gte('created_at', todayStart).lte('created_at', todayEnd).order('created_at', { ascending: false }),
      supabase.from('math_progress').select('level, topic, accuracy, level_change, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('bt_ledger').select('amount, reason, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('stories').select('title, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(5).then(r => r).catch(() => ({ data: [] })),
      supabase.from('books').select('title, completed, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(5).then(r => r).catch(() => ({ data: [] })),
    ])

    const sub = submissions || []
    const math = mathProgress || []
    const led = ledger || []
    const today = todaySubs || []

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

// parentId → { subId, childName, gems, approved, replyCb }
const awaitingNote = new Map()

async function sendNotification(parentId, message) {
  // 1. Try Telegram
  try {
    const chatId = await getTelegramChatId(parentId)
    if (chatId) {
      await sendTelegramMessage(chatId, message)
      console.log(`[NOTIFY] Telegram → parent ${parentId}`)
      return
    }
  } catch (err) {
    console.error('[NOTIFY] Telegram error:', err.message)
  }

  // 2. Try WhatsApp
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
        console.log(`[NOTIFY] WhatsApp → parent ${parentId}`)
        return
      }
    } catch (err) {
      console.error('[NOTIFY] WhatsApp error:', err.message)
    }
  }

  console.log(`[NOTIFY] No channel for parent ${parentId} — message: ${message}`)
}

async function sendNotificationWithPhoto(parentId, message, photoUrl) {
  // 1. Try Telegram with photo
  try {
    const chatId = await getTelegramChatId(parentId)
    if (chatId) {
      try {
        await sendTelegramPhoto(chatId, photoUrl, message)
      } catch {
        await sendTelegramMessage(chatId, message)
      }
      console.log(`[NOTIFY] Telegram photo → parent ${parentId}`)
      return
    }
  } catch (err) {
    console.error('[NOTIFY] Telegram photo error:', err.message)
  }

  // 2. Try WhatsApp with photo
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
        console.log(`[NOTIFY] WhatsApp photo → parent ${parentId}`)
        return
      }
    } catch (err) {
      console.error('[NOTIFY] WhatsApp photo error:', err.message)
    }
  }

  console.log(`[NOTIFY] No channel for parent ${parentId} — message: ${message}`)
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

async function handleMessage(parentId, replyCb, text) {
  console.log(`[MSG] parent=${parentId} → "${text}"`)
  try {
    // ── 1. Multi-turn: parent is writing a note after approve/reject ──────
    if (awaitingNote.has(parentId)) {
      const { subId, childName, gems, approved } = awaitingNote.get(parentId)
      awaitingNote.delete(parentId)
      const lower = text.toLowerCase().trim()
      const skip = ['geç', 'gec', 'skip', 'hayir', 'hayır', 'yok', 'no'].includes(lower)
      if (!skip && text.trim()) {
        await supabase.from('submissions').update({ parent_note: text.trim() }).eq('id', subId)
      }
      await replyCb(approved
        ? `✅ ${childName}'in ev görevi onaylandı! ${gems} Gem kazandı 🎉${skip ? '' : ' Notun iletildi.'}`
        : `Tamam, anladım.${skip ? '' : ' Notun iletildi.'}`)
      return
    }

    // ── 2. Fetch children once ─────────────────────────────────────────────
    const { data: children } = await supabase.from('children').select('id, name').eq('parent_id', parentId)
    const childIds = (children || []).map(c => c.id)

    // ── 3. Keyword/number check for pending chore submissions ─────────────
    if (childIds.length > 0) {
      const { data: latestChore } = await supabase
        .from('submissions')
        .select('id, child_id, suggested_gems, gems_earned')
        .in('child_id', childIds)
        .eq('status', 'pending')
        .eq('task_type', 'chore')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestChore) {
        const lower = text.toLowerCase().trim()
        const num = parseInt(text.trim(), 10)
        const isApprove = ['evet', 'yes', 'onay', 'onayla', 'approve', 'ok', 'tamam', 'kabul'].some(k => lower === k)
        const isReject  = ['hayır', 'hayir', 'no', 'reddet', 'reject', 'iptal', 'olmaz'].some(k => lower === k)
        const isNumber  = !isNaN(num) && num > 0 && num <= 200

        if (isApprove || isNumber) {
          const gems = isNumber ? num : (latestChore.suggested_gems ?? latestChore.gems_earned ?? 20)
          const childName = children.find(c => c.id === latestChore.child_id)?.name || ''
          await supabase.from('submissions').update({ status: 'approved', gems_earned: gems }).eq('id', latestChore.id)
          await supabase.from('bt_ledger').insert({ child_id: latestChore.child_id, amount: gems, reason: 'chore' })
          awaitingNote.set(parentId, { subId: latestChore.id, childName, gems, approved: true })
          await replyCb(`✅ Harika! ${childName} ${gems} Gem kazandı 🎉\n\n${childName} için bir not bırakmak ister misiniz? Geçmek için 'geç' yazın.`)
          return
        }

        if (isReject) {
          const childName = children.find(c => c.id === latestChore.child_id)?.name || ''
          await supabase.from('submissions').update({ status: 'rejected' }).eq('id', latestChore.id)
          awaitingNote.set(parentId, { subId: latestChore.id, childName, gems: 0, approved: false })
          await replyCb(`❌ ${childName}'in ev görevi reddedildi.\n\n${childName} için bir mesaj bırakmak ister misiniz? Geçmek için 'geç' yazın.`)
          return
        }
      }
    }

    // ── 4. Gemini intent classify for non-chore tasks ─────────────────────
    const { intent } = await classifyIntent(text)
    console.log(`[MSG] Intent: ${intent}`)

    if (intent === 'approve' || intent === 'reject') {
      const { data: latest } = await supabase
        .from('submissions').select('id, task_type, child_id, suggested_gems, gems_earned')
        .in('child_id', childIds).eq('status', 'pending')
        .order('created_at', { ascending: false }).limit(1)
        .maybeSingle()

      if (!latest) {
        const reply = await askGeminiWithContext(parentId, text)
        await replyCb(reply)
        return
      }

      const gems = latest.suggested_gems ?? latest.gems_earned ?? 30
      const childName = children?.find(c => c.id === latest.child_id)?.name || ''
      const label = TASK_LABELS[latest.task_type] || latest.task_type

      if (intent === 'approve') {
        await supabase.from('submissions').update({ status: 'approved', gems_earned: gems }).eq('id', latest.id)
        await supabase.from('bt_ledger').insert({ child_id: latest.child_id, amount: gems, reason: latest.task_type })
        if (latest.task_type === 'chore') {
          awaitingNote.set(parentId, { subId: latest.id, childName, gems, approved: true })
          await replyCb(`✅ ${childName}'in ev görevi onaylandı! ${gems} Gem kazandı 🎉\n\n${childName} için bir not bırakmak ister misiniz? Geçmek için 'geç' yazın.`)
        } else {
          await replyCb(`✅ ${childName}'in ${label} görevi onaylandı! ${gems} Gem kazandı 🎉`)
        }
      } else {
        await supabase.from('submissions').update({ status: 'rejected' }).eq('id', latest.id)
        if (latest.task_type === 'chore') {
          awaitingNote.set(parentId, { subId: latest.id, childName, gems: 0, approved: false })
          await replyCb(`❌ ${childName}'in ev görevi reddedildi.\n\n${childName} için bir mesaj bırakmak ister misiniz? Geçmek için 'geç' yazın.`)
        } else {
          await replyCb(`❌ ${childName}'in ${label} görevi reddedildi.`)
        }
      }
      return
    }

    if (intent === 'auto_approve' || intent === 'manual_approve') {
      const val = intent === 'auto_approve'
      for (const c of children || []) {
        await supabase.from('children').update({ auto_approve_chore: val }).eq('id', c.id)
      }
      await replyCb(val
        ? 'Tamam! Artık ev görevlerini otomatik onaylayacağım 🤖'
        : 'Tamam! Ev görevleri artık manuel onaylanacak.')
      return
    }

    // ── 5. Default: full family context → Gemini ─────────────────────────
    const reply = await askGeminiWithContext(parentId, text)
    await replyCb(reply)
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
app.use(express.json())

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

app.get('/api/children/:childId/stories', async (req, res) => {
  const { childId } = req.params
  const { data: stories } = await supabase.from('stories').select('*').eq('child_id', childId).order('created_at', { ascending: false })
  res.json({ stories: stories || [] })
})

app.post('/api/children/:childId/stories', async (req, res) => {
  const { childId } = req.params
  const { title, topic, transcribed_text, corrected_text, status, gems_earned } = req.body
  const { data: story, error } = await supabase.from('stories')
    .insert({ child_id: childId, title, topic, transcribed_text, corrected_text, status, gems_earned: gems_earned || 0 })
    .select().single()
  if (error) return res.status(500).json({ error: error.message })
  if ((gems_earned || 0) > 0) {
    await supabase.from('bt_ledger').insert({ child_id: childId, amount: gems_earned, reason: 'story' })
  }
  res.json({ story })
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
      `🏠 ${child.name} ev görevi gönderdi!\n\n` +
      `📝 ${taskDescription || 'Ev görevi'}\n` +
      `🤖 AI önerisi: ${gems} Gem\n` +
      (childNote ? `💬 "${childNote}"\n` : '') +
      `\n✅ Onaylamak için: 'evet' veya gem sayısı (örn: ${gems})\n❌ Reddetmek için: 'hayır'`

    await sendNotificationWithPhoto(child.parent_id, message, photoUrl)
    res.json({ submissionId: submission.id })
  } catch (err) {
    console.error('[notify-parent-chore] error:', err.message)
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
    throw new Error(err.error?.message || `WhatsApp API error ${res.status}`)
  }
  return res.json()
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
