// Runs the REAL server (index.js) over an in-memory Supabase, so the English endpoints and the
// child screen can be played end to end without touching production.
//
//   cd server && node scripts/english-harness.mjs [--port 3999] [--age 8] [--lang tr]
//
// One family is seeded: a parent (Europe/London) and a child. It prints the child JSON to put in the
// browser (`localStorage.child`) and the VITE_SERVER_URL to start the front end with. Telegram and
// Twilio are stubs that print what would have been sent. Nothing leaves the machine.
//
// The fake covers what the English and gem endpoints read and write (eq/neq/is/not/in/gt/gte/lt/lte,
// order, limit, single/maybeSingle, insert/update/upsert/delete, unique keys). It is not PostgREST:
// a query it does not know fails loudly instead of guessing.
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d }
const PORT = Number(arg('port', 3999))
const AGE = Number(arg('age', 8))
const LANG = arg('lang', 'tr')
const NOMIG = process.argv.includes('--no-migration')   // behave as if the English help migration had not been run

const serverDir = join(dirname(fileURLToPath(import.meta.url)), '..')
let src = readFileSync(join(serverDir, 'index.js'), 'utf8')
const cut = (needle, replacement) => {
  if (!src.includes(needle)) throw new Error(`harness is out of date: index.js no longer contains ${JSON.stringify(String(needle).slice(0, 70))}`)
  src = src.replace(needle, replacement)
}
cut("import twilio from 'twilio'", "const twilio = () => __h.stub('twilio')")
cut(/^import \{ startTelegramBot[^\n]*\n/m.exec(src)[0],
  "const { startTelegramBot, sendTelegramMessage, sendTelegramPhoto, sendTelegramMediaGroup, getTelegramChatId, setTelegramMessageHandler, sendTelegramTyping } = __h.telegram\n")
cut('const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)', 'const supabase = __h.db')
src = src.replace(/setInterval\(/g, '__h.interval(')
// Test-only peek at the stored keys and tables, so a script can play right and wrong on purpose.
const peek = `\napp.get('/__h/families', (req, res) => res.json(__h.families))\napp.get('/__h/sweep', async (req, res) => { for (const r of __h.tables.english_reviews || []) if (r.state === 'offered') r.created_at = new Date(Date.now() - 3600e3).toISOString(); await expireEnglishReviews(); res.json({ ok: true }) })\napp.post('/__h/clear-ledger', (req, res) => { __h.tables.bt_ledger = []; res.json({ ok: true }) })\n\napp.get('/__h/sheet/:id', (req, res) => { const t = __h.tables; const r = (t.english_sessions || []).find(x => x.id === req.params.id) || (t.english_reviews || []).find(x => x.id === req.params.id); res.json(r?.sheet || null) })\napp.get('/__h/table/:name', (req, res) => res.json(__h.tables[req.params.name] || []))\napp.get('/__h/notes', (req, res) => res.json(__h.notes))\n`
src = src.slice(0, src.indexOf('app.listen(3000')) + peek + `\napp.listen(${PORT}, () => console.log('[harness] server on ${PORT}'))\nexport { supabase as db }\n`

// ── in-memory tables ──
const tables = {}
const UNIQUE = { english_attempts: ['session_id', 'question_index'] }
// Column defaults the real tables carry (migrations).
const DEFAULTS = { english_reviews: { state: 'offered', results: [], gems: 0 }, english_attempts: { wrong_tries: 0, hints_used: 0 } }
const T = (name) => (tables[name] ||= [])
function builder(name) {
  const q = { op: 'select', filters: [], order: null, limit: null, row: null, patch: null, count: null, head: false, returning: false }
  const rows = () => T(name)
  const match = (r) => q.filters.every(([kind, col, v]) => {
    const x = r[col]
    switch (kind) {
      case 'eq': return x === v
      case 'neq': return x !== v
      case 'is': return v === null ? x == null : x === v
      case 'not': return v === null ? x != null : x !== v
      case 'in': return v.includes(x)
      case 'gt': return x > v
      case 'gte': return x >= v
      case 'lt': return x < v
      case 'lte': return x <= v
      default: throw new Error(`fake: filter ${kind}`)
    }
  })
  const run = () => {
    if (NOMIG && name === 'english_reviews') return { data: null, error: { message: 'relation "english_reviews" does not exist' } }
    if (NOMIG && name === 'english_attempts' && q.op === 'insert' && [].concat(q.row).some(r => 'wrong_tries' in r)) return { data: null, error: { message: 'column "wrong_tries" of relation "english_attempts" does not exist' } }
    if (q.op === 'insert') {
      const list = Array.isArray(q.row) ? q.row : [q.row]
      const out = []
      for (const r of list) {
        const key = UNIQUE[name]
        if (key && rows().some(o => key.every(k => o[k] === r[k]))) return { data: null, error: { code: '23505', message: 'duplicate key' } }
        const full = { id: randomUUID(), created_at: new Date().toISOString(), ...structuredClone((NOMIG && name === 'english_attempts') ? {} : (DEFAULTS[name] || {})), ...r }
        rows().push(full); out.push(full)
      }
      return { data: out, error: null }
    }
    if (q.op === 'update') {
      const hit = rows().filter(match)
      hit.forEach(r => Object.assign(r, q.patch))
      return { data: hit.map(r => ({ ...r })), error: null }
    }
    if (q.op === 'delete') {
      const hit = rows().filter(match)
      tables[name] = rows().filter(r => !hit.includes(r))
      return { data: hit, error: null }
    }
    let list = rows().filter(match).map(r => ({ ...r }))
    if (q.order) list.sort((a, b) => (a[q.order.col] > b[q.order.col] ? 1 : -1) * (q.order.asc ? 1 : -1))
    if (q.limit != null) list = list.slice(0, q.limit)
    if (q.head) return { data: null, count: list.length, error: null }
    return { data: list, count: list.length, error: null }
  }
  const api = {
    select: (_cols, opts) => { if (q.op === 'select') { q.head = !!opts?.head } else q.returning = true; return api },
    insert: (row) => { q.op = 'insert'; q.row = row; return api },
    update: (patch) => { q.op = 'update'; q.patch = patch; return api },
    delete: () => { q.op = 'delete'; return api },
    upsert: (row) => { q.op = 'insert'; q.row = row; return api },
    order: (col, o) => { q.order = { col, asc: o?.ascending !== false }; return api },
    limit: (n) => { q.limit = n; return api },
    single: () => thenable(true, true),
    maybeSingle: () => thenable(true, false),
    then: (res, rej) => Promise.resolve(run()).then(res, rej),
  }
  for (const k of ['eq', 'neq', 'is', 'not', 'in', 'gt', 'gte', 'lt', 'lte']) {
    api[k] = (...a) => { q.filters.push(k === 'not' ? ['not', a[0], a[2]] : [k, a[0], a[1]]); return api }
  }
  const thenable = (one, must) => Promise.resolve().then(() => {
    const r = run()
    if (r.error) return r
    const first = (r.data || [])[0] ?? null
    return { data: first, error: must && !first ? { message: 'no rows', code: 'PGRST116' } : null }
  })
  return api
}

const parentId = randomUUID(), childId = randomUUID()
const FAMILIES = {}
// One family (own parent, Telegram channel so messages are captured) per age x language; the parent's
// language follows the child's, plus one crossed family (child reads Turkish, parent English).
const mk = (key, age, lang, plang) => {
  const pid = randomUUID(), cid = randomUUID()
  T('parents').push({ id: pid, timezone: 'Europe/London', notification_channel: 'telegram', telegram_chat_id: key, prefs: { language: plang } })
  T('children').push({ id: cid, parent_id: pid, name: 'Ada', age, language: lang, task_settings: {}, english_variety: null })
  FAMILIES[key] = { child: cid, parent: pid, age, lang, plang }
}
mk('main', AGE, LANG, 'en')
if (process.argv.includes('--matrix')) {
  for (const a of [7, 8, 9, 10, 11, 12]) for (const l of ['en', 'tr', 'es']) mk(`${a}-${l}`, a, l, l)
  mk('cross', 8, 'tr', 'en')
}

const notes = []
const __h = {
  db: { from: builder, rpc: async () => ({ data: null, error: null }), channel: () => ({ on() { return this }, subscribe() { return this } }), storage: { from: () => ({ upload: async () => ({ error: null }), createSignedUrl: async () => ({ data: null, error: null }) }) } },
  stub: (n) => new Proxy({}, { get: () => new Proxy(() => {}, { get: () => (...a) => { notes.push([n, a]); return Promise.resolve({}) } }) }),
  telegram: new Proxy({}, { get: (_, fn) => (...a) => { notes.push([`telegram.${String(fn)}`, a]); return Promise.resolve(null) } }),
  interval: (fn, ms) => ({ unref() {}, fn, ms }),
  tables, notes, families: FAMILIES,
}
globalThis.__h = __h

const gen = join(serverDir, `.english-harness-${process.pid}.gen.mjs`)
writeFileSync(gen, src)
try { await import(pathToFileURL(gen).href) } finally { unlinkSync(gen) }
console.log(JSON.stringify({ child: { id: FAMILIES.main.child, name: 'Ada', age: AGE, language: LANG }, vite: `VITE_SERVER_URL=http://localhost:${PORT} npm run dev` }))
globalThis.__harnessNotes = notes
