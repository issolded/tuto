import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import { wrapSocket } from 'baileys-antiban'
import pino from 'pino'
import { mkdirSync, existsSync, readdirSync, rmSync } from 'fs'

const sessions = new Map()          // parentId → sock (exists as soon as session starts)
const connectedSessions = new Set() // parentId → confirmed open connection only
const phoneNumbers = new Map()      // parentId → phoneNumber
const newConnections = new Set()    // parentIds awaiting first 'open' (not restores)
let globalMessageHandler = null
let onConnectHandler = null         // called as handler(parentId, phoneNumber) on first connect

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
      connectedSessions.add(parentId)
      if (newConnections.has(parentId)) {
        newConnections.delete(parentId)
        const phone = phoneNumbers.get(parentId)
        if (onConnectHandler && phone) onConnectHandler(parentId, phone)
      }
    }
    if (connection === 'close') {
      connectedSessions.delete(parentId)
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
  if (sessions.has(parentId)) return null

  phoneNumbers.set(parentId, phoneNumber)
  newConnections.add(parentId)

  const sock = await startSession(parentId)

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

export function setConnectHandler(handler) {
  onConnectHandler = handler
}

export function isConnected(parentId) {
  return connectedSessions.has(parentId)
}

export async function disconnectParent(parentId) {
  const sock = sessions.get(parentId)
  if (sock) {
    try { await sock.logout() } catch (_) {}
    sessions.delete(parentId)
    connectedSessions.delete(parentId)
  }
  const dir = sessionDir(parentId)
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
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
