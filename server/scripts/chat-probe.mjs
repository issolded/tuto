// Runs the REAL parent-chat handler against a real family's context, with nothing able to leave.
//
//   cd server && node --env-file=.env scripts/chat-probe.mjs --parent <id> --text "..." [--runs 5]
//        [--history-until <ISO>]   replay the conversation exactly as it stood at that moment
//        [--expect-no <regex>]     count replies that match, and exit 1 if any do
//
// Why it exists: the chat is reachable only through the Telegram and WhatsApp webhooks, so what
// the model says to a given message could be seen only by sending that message for real — to a
// real family, with real tools. This builds a copy of index.js in which:
//
//   · every Supabase WRITE (insert/update/upsert/delete/rpc, storage) is swallowed and logged,
//     while reads go to production, so the family's actual data is what the model sees
//   · Telegram and Twilio are stubs that record what would have been sent
//   · app.listen and the autopilot sweep never run, so no poller competes for live messages
//
// A tool the model calls therefore runs its real code and hits the write wall, which is logged.
// Gemini calls are real — this measures the model, and it costs what those calls cost.

import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : dflt
}
const parentId = arg('parent')
const text = arg('text')
const runs = Number(arg('runs', 5))
const historyUntil = arg('history-until')
const expectNo = arg('expect-no') ? new RegExp(arg('expect-no'), 'i') : null
if (!parentId || !text) {
  console.error('usage: node --env-file=.env scripts/chat-probe.mjs --parent <id> --text "..." [--runs N] [--history-until ISO] [--expect-no regex]')
  process.exit(2)
}

const serverDir = join(dirname(fileURLToPath(import.meta.url)), '..')
let src = readFileSync(join(serverDir, 'index.js'), 'utf8')
const cut = (needle, replacement) => {
  if (!src.includes(needle)) throw new Error(`probe is out of date: index.js no longer contains ${JSON.stringify(needle.slice(0, 60))}`)
  src = src.replace(needle, replacement)
}

cut("import twilio from 'twilio'", "const twilio = () => __probe.stub('twilio')")
cut(/^import \{ startTelegramBot[^\n]*\n/m.exec(src)[0],
  "const { startTelegramBot, sendTelegramMessage, sendTelegramPhoto, sendTelegramMediaGroup, getTelegramChatId, setTelegramMessageHandler, sendTelegramTyping } = __probe.telegram\n")
cut('const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)',
  'const supabase = __probe.readOnly(createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY))')
cut('setInterval(() => { closeExpiredAutopilots()', '(() => ({ unref() {} }))(() => { closeExpiredAutopilots()')
cut('const historyContents = await fetchConversationHistory(parentId)',
  'const historyContents = __probe.history ?? await fetchConversationHistory(parentId)')
cut('async function fetchGeminiOnce(body) {',
  'async function fetchGeminiOnce(body) {\n  __probe.calls.push({ tools: !!body.tools })')
src = src.slice(0, src.indexOf('app.listen(3000')) + '\nexport { handleMessage, supabase as __probeSupabase }\n'

// The write wall. A query builder is chainable and thenable, so a blocked write has to stay both:
// `.insert(x).select().single()` must resolve, not throw, or the tool errors out on something
// that is not the thing being measured.
const blocked = (what) => {
  __probe.writes.push(what)
  const chain = new Proxy(function () {}, {
    get: (_, prop) => (prop === 'then'
      ? (res) => res({ data: null, error: null })
      : () => chain),
    apply: () => chain,
  })
  return chain
}
const WRITES = new Set(['insert', 'update', 'upsert', 'delete'])
const __probe = {
  calls: [], writes: [], sent: [], history: null,
  stub: (name) => new Proxy({}, { get: () => new Proxy(() => {}, { get: () => (...a) => { __probe.sent.push([name, a]); return Promise.resolve({}) } }) }),
  telegram: new Proxy({}, { get: (_, fn) => (...a) => { __probe.sent.push([`telegram.${String(fn)}`, a]); return Promise.resolve(null) } }),
  readOnly: (client) => new Proxy(client, {
    get(target, prop) {
      if (prop === 'from') {
        return (table) => new Proxy(target.from(table), {
          get: (qb, op) => (WRITES.has(op) ? () => blocked(`${op} ${table}`) : qb[op]?.bind?.(qb) ?? qb[op]),
        })
      }
      if (prop === 'rpc') return (fn) => blocked(`rpc ${fn}`)
      if (prop === 'storage' || prop === 'channel') return blocked(String(prop))
      return target[prop]
    },
  }),
}
globalThis.__probe = __probe

const gen = join(serverDir, `.chat-probe-${process.pid}.gen.mjs`)
writeFileSync(gen, src)
let mod
try {
  mod = await import(pathToFileURL(gen).href)
} finally {
  unlinkSync(gen)
}

if (historyUntil) {
  const { data } = await mod.__probeSupabase.from('messages')
    .select('role, content, created_at').eq('parent_id', parentId)
    .lt('created_at', historyUntil).order('created_at', { ascending: false }).limit(20)
  __probe.history = (data || []).reverse()
    .map(m => ({ role: m.role === 'tuto' ? 'model' : 'user', parts: [{ text: m.content }] }))
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
let hits = 0
for (let i = 0; i < runs; i++) {
  __probe.calls = []; __probe.writes = []; __probe.sent = []
  let reply = null
  await mod.handleMessage(parentId, async (msg) => { reply = msg }, text)
  const path = __probe.calls.map(c => (c.tools ? 'tools' : 'plain')).join('→')
  const flags = [UUID.test(reply ?? '') && 'UUID', expectNo?.test(reply ?? '') && 'MATCH'].filter(Boolean)
  if (flags.length) hits++
  console.log(`\n── run ${i + 1}/${runs} · calls ${path} · writes blocked: ${__probe.writes.join(', ') || 'none'} · ${flags.join(' ') || 'clean'}`)
  console.log(reply)
}
console.log(`\n${hits}/${runs} replies flagged`)
process.exit(hits ? 1 : 0)
