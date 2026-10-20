// Runs the REAL parent-chat handler against a real family's context, with nothing able to leave.
//
//   cd server && node --env-file=.env scripts/chat-probe.mjs --parent <id> --text "..." [--runs 5]
//        [--history-until <ISO>]   replay the conversation exactly as it stood at that moment
//        [--expect-no <regex>]     count replies that match, and exit 1 if any do
//        [--prior-tuto "<text>"]   add a Tuto turn after the history, as if it had just been sent
//                                  (a reminder, a notification) — to test the reply to it
//        [--overlay table:id:json] reads of that row see these fields merged in (writes stay blocked);
//                                  e.g. children:<id>:{"math_skip":[...]} to give a child a state it
//                                  does not have in production. Repeatable.
//        [--expect-tool name:regex] the tool calls of each run must include one named so whose
//                                  arguments (JSON) match; exit 1 if any run misses it
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
const priorTuto = arg('prior-tuto')
const argsAll = (name) => process.argv.flatMap((a, i) => (a === `--${name}` ? [process.argv[i + 1]] : []))
const overlays = argsAll('overlay').map(o => {
  const [table, id, ...rest] = o.split(':')
  return { table, id, fields: JSON.parse(rest.join(':')) }
})
const expectTool = arg('expect-tool') ? (([n, ...r]) => ({ name: n, re: new RegExp(r.join(':') || '.', 'i') }))(arg('expect-tool').split(':')) : null
if (!parentId || !text) {
  console.error('usage: node --env-file=.env scripts/chat-probe.mjs --parent <id> --text "..." [--runs N] [--history-until ISO] [--expect-no regex] [--prior-tuto text] [--overlay table:id:json] [--expect-tool name:regex]')
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
cut('setInterval(() => { remindEndingMathSkips()', '(() => ({ unref() {} }))(() => { remindEndingMathSkips()')
cut('      console.log(`[MSG] Tool "${name}"(${JSON.stringify(args)}) → ${JSON.stringify(toolResult)}`)',
  '      __probe.tools.push({ name, args, result: toolResult })\n      console.log(`[MSG] Tool "${name}"(${JSON.stringify(args)}) → ${JSON.stringify(toolResult)}`)')
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

// --overlay: a select on an overlaid table resolves with the fields merged into the matching row —
// matched by the row's id, or by an .eq('id', …) in the query when the select did not ask for id.
const overlaid = (table, builder) => {
  const mine = overlays.filter(o => o.table === table)
  if (!mine.length) return builder
  const state = { id: null }
  const wrap = (b) => new Proxy(b, {
    get(t, p) {
      if (p === 'then') {
        return (res, rej) => t.then(r => {
          const fix = row => {
            if (!row || typeof row !== 'object') return row
            const o = mine.find(m => m.id === (row.id ?? state.id))
            return o ? { ...row, ...o.fields } : row
          }
          return res(r?.data ? { ...r, data: Array.isArray(r.data) ? r.data.map(fix) : fix(r.data) } : r)
        }, rej)
      }
      const v = t[p]
      if (typeof v !== 'function') return v
      return (...a) => {
        if (p === 'eq' && a[0] === 'id') state.id = a[1]
        const out = v.apply(t, a)
        return out && typeof out.then === 'function' ? wrap(out) : out
      }
    },
  })
  return wrap(builder)
}
const __probe = {
  calls: [], writes: [], sent: [], tools: [], history: null,
  stub: (name) => new Proxy({}, { get: () => new Proxy(() => {}, { get: () => (...a) => { __probe.sent.push([name, a]); return Promise.resolve({}) } }) }),
  telegram: new Proxy({}, { get: (_, fn) => (...a) => { __probe.sent.push([`telegram.${String(fn)}`, a]); return Promise.resolve(null) } }),
  readOnly: (client) => new Proxy(client, {
    get(target, prop) {
      if (prop === 'from') {
        return (table) => new Proxy(target.from(table), {
          get: (qb, op) => (WRITES.has(op) ? () => blocked(`${op} ${table}`)
            : op === 'select' ? (...a) => overlaid(table, qb.select(...a))
            : qb[op]?.bind?.(qb) ?? qb[op]),
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

if (priorTuto) {
  if (!__probe.history) {
    const { data } = await mod.__probeSupabase.from('messages')
      .select('role, content, created_at').eq('parent_id', parentId)
      .order('created_at', { ascending: false }).limit(10)
    __probe.history = (data || []).reverse()
      .map(m => ({ role: m.role === 'tuto' ? 'model' : 'user', parts: [{ text: m.content }] }))
  }
  __probe.history.push({ role: 'model', parts: [{ text: priorTuto }] })
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
let hits = 0
for (let i = 0; i < runs; i++) {
  __probe.calls = []; __probe.writes = []; __probe.sent = []
  let reply = null
  await mod.handleMessage(parentId, async (msg) => { reply = msg }, text)
  const path = __probe.calls.map(c => (c.tools ? 'tools' : 'plain')).join('→')
  const tools = __probe.tools.splice(0)
  const missedTool = expectTool && !tools.some(t => t.name === expectTool.name && expectTool.re.test(JSON.stringify(t.args)))
  const flags = [UUID.test(reply ?? '') && 'UUID', expectNo?.test(reply ?? '') && 'MATCH', missedTool && 'NO-TOOL'].filter(Boolean)
  if (flags.length) hits++
  console.log(`\n── run ${i + 1}/${runs} · calls ${path} · tools ${tools.map(t => `${t.name}(${JSON.stringify(t.args)})`).join(', ') || 'none'} · writes blocked: ${__probe.writes.join(', ') || 'none'} · ${flags.join(' ') || 'clean'}`)
  console.log(reply)
}
console.log(`\n${hits}/${runs} replies flagged`)
process.exit(hits ? 1 : 0)
