import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import { wrapSocket } from 'baileys-antiban'
import qrcode from 'qrcode-terminal'
import pino from 'pino'

let sock = null

const sleep = ms => new Promise(r => setTimeout(r, ms))

export async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info')
  const { version } = await fetchLatestBaileysVersion()

  const rawSock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
  })
  sock = wrapSocket(rawSock, 'conservative')

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n── WhatsApp QR Kod ──')
      console.log('RAW QR:', qr)
      qrcode.generate(qr, { small: true })
      console.log('Telefonda WhatsApp > Bağlı Cihazlar > Cihaz Ekle ile tarat.\n')
    }

    if (connection === 'open') {
      console.log('WhatsApp bağlantısı kuruldu.')
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      console.log('WhatsApp bağlantısı kesildi. Yeniden bağlanılıyor:', shouldReconnect)
      if (shouldReconnect) connectWhatsApp()
    }
  })
}

export function onMessage(handler) {
  if (!sock) throw new Error('WhatsApp henüz bağlı değil.')
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (msg.key.fromMe || !msg.key.remoteJid) continue
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        ''
      if (!text.trim()) continue
      const phone = msg.key.remoteJid.split('@')[0]
      handler({ phone, text: text.trim() })
    }
  })
}

export async function sendWhatsAppMessage(phone, message, imageUrl = null) {
  if (!sock) throw new Error('WhatsApp henüz bağlı değil.')
  const normalized = phone.replace(/\D/g, '')
  const jid = normalized.includes('@') ? normalized : `${normalized}@s.whatsapp.net`
  await sleep(Math.random() * 2000 + 2000)
  if (imageUrl) {
    await sock.sendMessage(jid, { image: { url: imageUrl }, caption: message })
  } else {
    await sock.sendMessage(jid, { text: message })
  }
}
