import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { connectWhatsApp, sendWhatsAppMessage, onMessage } from './whatsapp.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const GEMINI_API_KEY = 'AIzaSyDHMBb9SbxkPJKSqNWB7vgRYJ8yiT8Cq5Q'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

const TUTO_SYSTEM_PROMPT = `You are Tuto, a friendly AI learning assistant. You help parents track their child's educational progress. Be warm, encouraging and concise.`

async function classifyIntent(text) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `Classify this parent message intent. Return JSON only:\n{\n  "intent": "approve" | "reject" | "auto_approve" | "manual_approve" | "question" | "other",\n  "confidence": 0-1\n}\nMessage: '${text.replace(/'/g, "\\'")}'` }],
      }],
      generationConfig: { response_mime_type: 'application/json' },
    }),
  })
  if (!res.ok) return { intent: 'other', confidence: 0 }
  const data = await res.json()
  try {
    return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
  } catch {
    return { intent: 'other', confidence: 0 }
  }
}

async function askGemini(userMessage) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: TUTO_SYSTEM_PROMPT }] },
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

async function getLatestSubmission(childId) {
  const { data } = await supabase
    .from('submissions')
    .select('id, task_type')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data
}

async function getChildStats(childId) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: submissions } = await supabase
    .from('submissions')
    .select('task_type, score, gems_earned, created_at')
    .eq('child_id', childId)
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
  const totalGems = (submissions || []).reduce((sum, s) => sum + (s.gems_earned || 0), 0)
  return { submissions: submissions || [], totalGems }
}

async function setupMessageListener() {
  onMessage(async ({ phone, text }) => {
    console.log(`[WHATSAPP] Gelen mesaj: ${phone} → "${text}"`)
    try {
      const { data: child, error } = await supabase
        .from('children')
        .select('id, name')
        .eq('parent_phone', phone)
        .single()

      if (error || !child) {
        console.log(`[WHATSAPP] Kayıtlı ebeveyn bulunamadı: ${phone}`)
        await sendWhatsAppMessage(phone, 'Merhaba! Sisteme kayıtlı bir hesap bulunamadı.')
        return
      }

      const { intent, confidence } = await classifyIntent(text)
      console.log(`[WHATSAPP] Intent: ${intent} (${confidence}) — ${child.name}`)

      if (intent === 'approve' || intent === 'reject') {
        const latest = await getLatestSubmission(child.id)
        if (!latest) {
          await sendWhatsAppMessage(phone, 'Son bir görev bulunamadı.')
          return
        }
        const status = intent === 'approve' ? 'approved' : 'rejected'
        await supabase.from('submissions').update({ status }).eq('id', latest.id)
        const label = TASK_LABELS[latest.task_type] || latest.task_type
        const reply = intent === 'approve'
          ? `✅ ${child.name}'in "${label}" görevi onaylandı!`
          : `❌ ${child.name}'in "${label}" görevi reddedildi.`
        await sendWhatsAppMessage(phone, reply)

      } else if (intent === 'auto_approve') {
        await supabase.from('children').update({ auto_approve_chore: true }).eq('id', child.id)
        await sendWhatsAppMessage(phone, `Anlaşıldı! Bundan sonra ev görevi fotoğraflarını ben kontrol ederim 🤖`)

      } else if (intent === 'manual_approve') {
        await supabase.from('children').update({ auto_approve_chore: false }).eq('id', child.id)
        await sendWhatsAppMessage(phone, `Tamam! Bundan sonra ev görevi onayları size gelecek.`)

      } else if (intent === 'question') {
        const { submissions, totalGems } = await getChildStats(child.id)
        const context =
          `Child's name: ${child.name}\n` +
          `Last 7 days: ${submissions.length} submission(s), ${totalGems} gems earned total.\n` +
          `Submissions: ${JSON.stringify(submissions)}\n\n` +
          `Parent's question: ${text}`
        const reply = await askGemini(context)
        await sendWhatsAppMessage(phone, reply)

      } else {
        const reply = await askGemini(text)
        await sendWhatsAppMessage(phone, reply)
      }

      console.log(`[WHATSAPP] Yanıt gönderildi → ${phone}`)
    } catch (err) {
      console.error('[WHATSAPP] Mesaj işleme hatası:', err.message)
    }
  })

  console.log('WhatsApp mesaj dinleyici başlatıldı.')
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
            .select('name, parent_phone')
            .eq('id', submission.child_id)
            .single()

          if (error) {
            console.log(`[DEBUG] Supabase child sorgusu hata: ${error.message}`)
            return
          }

          if (!child?.parent_phone) {
            console.log(`[DEBUG] parent_phone boş — child_id=${submission.child_id}, child=${JSON.stringify(child)}`)
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

          await sendWhatsAppMessage(child.parent_phone, message)
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

app.listen(3000, async () => {
  console.log('Tuto sunucusu port 3000\'de çalışıyor.')
  await connectWhatsApp()
  await startSubmissionListener()
  setupMessageListener()
})
