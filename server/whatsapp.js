import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import { wrapSocket } from 'baileys-antiban'
import pino from 'pino'
import { mkdirSync, existsSync, readdirSync } from 'fs'

const sessions = new Map() // parentId → sock
let globalMessageHandler = null

const sleep = ms => new Promise(r => setTimeout(r, ms))

function sessionDir(parentId) {
  return `./sessions/${parentId}`
}

async function startSession(parentId) {
  const dir = sessionDir(parentId)
  mkdirSync(dir, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(dir)
  const { version } = await fetchLatestBaileysVersion()

  const rawSock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  })
  const sock = wrapSocket(rawSock, 'conservative')
  sessions.set(parentId, sock)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      console.log(`[WA] Parent ${parentId} connected.`)
    }
    if (connection === 'close') {
      sessions.delete(parentId)
      const code = lastDisconnect?.error?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) {
        console.log(`[WA] Reconnecting parent ${parentId}...`)
        startSession(parentId)
      } else {
        console.log(`[WA] Parent ${parentId} logged out.`)
      }
    }
  })

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify' || !globalMessageHandler) return
    for (const msg of messages) {
      if (msg.key.fromMe || !msg.key.remoteJid) continue
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        ''
      if (!text.trim()) continue
      const phone = msg.key.remoteJid.split('@')[0]
      globalMessageHandler(parentId, phone, text.trim())
    }
  })

  return sock
}

// Connect a new parent via pairing code (no QR).
// Returns the 8-digit code to show the user.
export async function connectParent(parentId, phoneNumber) {
  // If already has a live session, return null (already connected)
  if (sessions.has(parentId)) return null

  const sock = await startSession(parentId)

  // Give the socket a moment to initialize before requesting the code
  await sleep(2000)

  const normalized = phoneNumber.replace(/\D/g, '')
  const code = await sock.requestPairingCode(normalized)
  return code
}

// Send a message from a specific parent's session
export async function sendMessage(parentId, toPhone, message, imageUrl = null) {
  const sock = sessions.get(parentId)
  if (!sock) throw new Error(`No active session for parent ${parentId}`)

  const normalized = toPhone.replace(/\D/g, '')
  const jid = `${normalized}@s.whatsapp.net`

  await sleep(Math.random() * 2000 + 2000)

  if (imageUrl) {
    await sock.sendMessage(jid, { image: { url: imageUrl }, caption: message })
  } else {
    await sock.sendMessage(jid, { text: message })
  }
}

// Register a global incoming-message handler.
// Called as handler(parentId, fromPhone, text)
export function setMessageHandler(handler) {
  globalMessageHandler = handler
}

export function isConnected(parentId) {
  return sessions.has(parentId)
}

// Restore all saved sessions from disk on startup
export async function restoreSessions() {
  if (!existsSync('./sessions')) return
  const dirs = readdirSync('./sessions', { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
  for (const parentId of dirs) {
    console.log(`[WA] Restoring session: ${parentId}`)
    try {
      await startSession(parentId)
    } catch (e) {
      console.error(`[WA] Failed to restore ${parentId}:`, e.message)
    }
  }
}
