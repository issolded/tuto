import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { connectParent, sendMessage, setMessageHandler, restoreSessions, isConnected } from './whatsapp.js'

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
  const { data: children } = await supabase
    .from('children')
    .select('id, name, age, task_settings')
    .eq('parent_id', parentId)
  if (!children?.length) return []

  return Promise.all(children.map(async child => {
    const [
      { data: submissions },
      { data: mathProgress },
      { data: ledger },
      { data: stories },
      { data: books },
    ] = await Promise.all([
      supabase.from('submissions').select('task_type, score, gems_earned, status, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('math_progress').select('level, topic, accuracy, level_change, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('bt_ledger').select('amount, reason, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('stories').select('title, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(5).then(r => r).catch(() => ({ data: [] })),
      supabase.from('books').select('title, completed, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(5).then(r => r).catch(() => ({ data: [] })),
    ])

    return {
      name: child.name,
      age: child.age,
      totalGems: (ledger || []).reduce((s, r) => s + (r.amount || 0), 0),
      submissions: submissions || [],
      mathProgress: mathProgress || [],
      gemHistory: ledger || [],
      stories: stories || [],
      books: books || [],
    }
  }))
}

async function askGeminiWithContext(parentId, userMessage) {
  const familyData = await getParentContext(parentId)
  const systemPrompt =
    `You are Tuto, a warm AI learning assistant and trusted family companion.\n` +
    `You know this family's learning data:\n${JSON.stringify(familyData, null, 2)}\n\n` +
    `Guidelines:\n` +
    `- Respond in the SAME LANGUAGE as the parent's message\n` +
    `- Be conversational and warm, like a trusted friend who knows the kids\n` +
    `- Reference specific data when relevant (e.g. "Ada earned 30 gems yesterday!")\n` +
    `- Keep responses concise — max 3-4 sentences for simple questions\n` +
    `- For progress questions, give concrete insights from the data`

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

function setupMessageListener() {
  setMessageHandler(async (parentId, phone, text) => {
    console.log(`[WA] Message: parent=${parentId} from=${phone} → "${text}"`)
    try {
      const { intent } = await classifyIntent(text)
      console.log(`[WA] Intent: ${intent}`)

      // ── Fast-path: approve / reject pending submission ────────────────────
      if (intent === 'approve' || intent === 'reject') {
        const { data: children } = await supabase.from('children').select('id, name').eq('parent_id', parentId)
        const childIds = (children || []).map(c => c.id)
        const { data: latest } = await supabase
          .from('submissions').select('id, task_type, child_id, gems_earned')
          .in('child_id', childIds).eq('status', 'pending')
          .order('created_at', { ascending: false }).limit(1).single()

        if (!latest) {
          await sendMessage(parentId, phone, 'Onay bekleyen bir görev bulunamadı.')
          return
        }
        const status = intent === 'approve' ? 'approved' : 'rejected'
        await supabase.from('submissions').update({ status }).eq('id', latest.id)
        if (intent === 'approve') {
          await supabase.from('bt_ledger').insert({ child_id: latest.child_id, amount: latest.gems_earned ?? 30, reason: latest.task_type })
        }
        const childName = children.find(c => c.id === latest.child_id)?.name || ''
        const label = TASK_LABELS[latest.task_type] || latest.task_type
        await sendMessage(parentId, phone, intent === 'approve'
          ? `✅ ${childName}'in "${label}" görevi onaylandı!`
          : `❌ ${childName}'in "${label}" görevi reddedildi.`)
        return
      }

      // ── Fast-path: auto-approve toggle ────────────────────────────────────
      if (intent === 'auto_approve' || intent === 'manual_approve') {
        const val = intent === 'auto_approve'
        const { data: children } = await supabase.from('children').select('id').eq('parent_id', parentId)
        for (const c of children || []) {
          await supabase.from('children').update({ auto_approve_chore: val }).eq('id', c.id)
        }
        await sendMessage(parentId, phone, val
          ? 'Anlaşıldı! Bundan sonra ev görevi fotoğraflarını ben kontrol ederim 🤖'
          : 'Tamam! Bundan sonra ev görevi onayları size gelecek.')
        return
      }

      // ── Default: full family context → Gemini ────────────────────────────
      const reply = await askGeminiWithContext(parentId, text)
      await sendMessage(parentId, phone, reply)
      console.log(`[WA] Reply sent → ${phone}`)
    } catch (err) {
      console.error('[WA] Message handling error:', err.message)
    }
  })

  console.log('WhatsApp message listener started.')
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

          await sendMessage(child.parent_id, child.parent_phone, message)
          console.log(`[APPROVAL] Mesaj gönderildi → ${child.parent_phone}`)
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
app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.get('/api/whatsapp-status/:parentId', (req, res) => {
  res.json({ connected: isConnected(req.params.parentId) })
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

app.listen(3000, async () => {
  console.log('Tuto sunucusu port 3000\'de çalışıyor.')
  await restoreSessions()
  await startSubmissionListener()
  setupMessageListener()
})
