import TelegramBot from 'node-telegram-bot-api'
import { createClient } from '@supabase/supabase-js'
import { humanizeDelay } from './humanize.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

let bot = null
let globalMessageHandler = null // called as handler(parentId, chatId, text)

// chatId → parentId cache for connected users
const chatToParent = new Map()

export function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) { console.log('[TG] No TELEGRAM_BOT_TOKEN — skipping'); return }

  bot = new TelegramBot(token, { polling: true })

  // Track pending family-code prompts: chatId → true
  const awaitingCode = new Set()

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id
    awaitingCode.add(chatId)
    await bot.sendMessage(chatId,
      `Welcome to Tuto! 🎉 I'll keep you updated on your child's progress.\n\nPlease enter your family code to connect:`
    )
  })

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id
    const text = (msg.text || '').trim()
    if (!text || text.startsWith('/')) return

    // ── Family code verification ───────────────────────────────────────────
    if (awaitingCode.has(chatId)) {
      awaitingCode.delete(chatId)
      console.log(`[TG] Family code attempt: "${text}" (normalized: "${text.toUpperCase()}") from chatId=${chatId}`)
      const { data: parent, error } = await supabase
        .from('parents')
        .select('id')
        .eq('family_code', text.toUpperCase())
        .single()

      console.log(`[TG] Supabase result: parent=${JSON.stringify(parent)}, error=${error ? error.message : 'none'} (code=${error?.code})`)

      if (error || !parent) {
        awaitingCode.add(chatId) // let them try again
        await bot.sendMessage(chatId, '❌ Family code not found. Please check and try again:')
        return
      }

      await supabase.from('parents').update({ telegram_chat_id: chatId }).eq('id', parent.id)
      chatToParent.set(chatId, parent.id)
      await bot.sendMessage(chatId, '✅ Connected! You\'ll now receive updates here.')
      console.log(`[TG] Parent ${parent.id} connected via Telegram (chatId=${chatId})`)
      return
    }

    // ── Regular message → forward to Gemini ───────────────────────────────
    let parentId = chatToParent.get(chatId)

    if (!parentId) {
      // Look up in DB (e.g. after server restart)
      const { data: parent } = await supabase
        .from('parents')
        .select('id')
        .eq('telegram_chat_id', chatId)
        .single()

      if (!parent) {
        await bot.sendMessage(chatId, 'Please send /start to connect your family first.')
        return
      }
      parentId = parent.id
      chatToParent.set(chatId, parentId)
    }

    console.log(`[TG] Message from parent ${parentId}: "${text}"`)
    if (globalMessageHandler) {
      globalMessageHandler(parentId, String(chatId), text)
    }
  })

  bot.on('polling_error', (err) => console.error('[TG] Polling error:', err.message))
  console.log('[TG] Telegram bot started.')
}

export async function sendTelegramMessage(chatId, message) {
  if (!bot) throw new Error('Telegram bot not started')
  await bot.sendChatAction(String(chatId), 'typing')
  await new Promise(r => setTimeout(r, humanizeDelay(message)))
  await bot.sendMessage(String(chatId), message)
}

// Early "typing…" ping for the moment a message comes in, before the reply
// (and its own typing+delay in sendTelegramMessage) is ready — Telegram's
// typing indicator fades after ~5s, so this just covers the "thinking" gap.
export async function sendTelegramTyping(chatId) {
  if (!bot) return
  await bot.sendChatAction(String(chatId), 'typing')
}

export async function sendTelegramPhoto(chatId, photoUrl, caption) {
  if (!bot) throw new Error('Telegram bot not started')
  await bot.sendPhoto(String(chatId), photoUrl, { caption })
}

// Sends multiple photos as native Telegram albums. Media groups cap at 10
// items, so >10 photos are split into chunks; the caption rides only the FIRST
// item of the FIRST album (Telegram shows it under the whole first group).
// A single photo falls back to sendPhoto so callers don't special-case counts.
export async function sendTelegramMediaGroup(chatId, photoUrls, caption) {
  if (!bot) throw new Error('Telegram bot not started')
  const urls = (photoUrls || []).filter(Boolean)
  if (urls.length === 0) throw new Error('no photos')
  if (urls.length === 1) return bot.sendPhoto(String(chatId), urls[0], { caption })

  const chunks = []
  for (let i = 0; i < urls.length; i += 10) chunks.push(urls.slice(i, i + 10))

  for (let c = 0; c < chunks.length; c++) {
    const media = chunks[c].map((url, i) => ({
      type: 'photo',
      media: url,
      // Caption only on the very first photo of the very first album.
      ...(c === 0 && i === 0 && caption ? { caption } : {}),
    }))
    await bot.sendMediaGroup(String(chatId), media)
  }
}

export async function getTelegramChatId(parentId) {
  // Check in-memory cache first
  for (const [cid, pid] of chatToParent.entries()) {
    if (pid === parentId) return cid
  }
  // Fall back to DB
  const { data } = await supabase
    .from('parents')
    .select('telegram_chat_id')
    .eq('id', parentId)
    .single()
  if (data?.telegram_chat_id) {
    chatToParent.set(data.telegram_chat_id, parentId)
    return data.telegram_chat_id
  }
  return null
}

export function setTelegramMessageHandler(handler) {
  globalMessageHandler = handler
}
