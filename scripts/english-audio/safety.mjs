// Safety pass over every text that is recorded (the trial set, the wordlist, the listening bank): the same
// lists the English engine uses (scripts/english/).
//   blocked: blocklist.txt (slurs, sexual words, weapons, drugs, self-harm, religion), LDNOOBW, cuss score 1–2
//            -> a recording with one of these must not exist; exit 1
//   grown-up: sentence-topics.txt (war, courts, illness…) -> listed for a person; not an error
// Words are matched whole, case-insensitive, and with simple endings folded (-s, -es, -ed, -ing).
//   node scripts/english-audio/safety.mjs        (exceptions, with reasons: safety-allow.txt)
import { readFileSync } from 'node:fs'
import { CLIPS, WORD_CLIPS, LISTENING_CLIPS } from './clips.mjs'

const dir = new URL('../english/', import.meta.url)
const list = f => readFileSync(new URL(f, dir), 'utf8').split('\n').map(l => l.trim().toLowerCase()).filter(l => l && !l.startsWith('#'))
const cuss = Object.entries(JSON.parse(readFileSync(new URL('vendor/cuss.json', dir), 'utf8'))).filter(([, s]) => s >= 1).map(([w]) => w.toLowerCase())
const ALLOW = new Set(readFileSync(new URL('./safety-allow.txt', import.meta.url), 'utf8').split('\n')
  .map(l => l.replace(/#.*/, '').trim().toLowerCase()).filter(Boolean))
// A word allowed on its own can still be slang in a phrase: these stay blocked (matched as whole phrases).
const PHRASES = ['lots of balls', 'has balls', 'have balls', 'got balls', 'his balls', 'my balls', 'no balls']
const BLOCKED = new Set([...list('blocklist.txt'), ...list('vendor/ldnoobw-en.txt'), ...cuss, ...PHRASES])
const GROWN_UP = new Set(list('sentence-topics.txt'))

const forms = w => [w, w.replace(/'s$/, ''), w.replace(/s$/, ''), w.replace(/es$/, ''), w.replace(/ed$/, ''), w.replace(/ed$/, 'e'), w.replace(/ing$/, ''), w.replace(/ing$/, 'e')]
function hits(text, set) {
  const t = text.toLowerCase().replace(/’/g, "'")
  const words = t.match(/[a-z']+/g) || []
  const found = new Set()
  for (const w of words) if (!ALLOW.has(w)) for (const f of forms(w)) if (set.has(f) && !ALLOW.has(f)) found.add(f)
  for (const entry of set) if (entry.includes(' ') && ` ${words.join(' ')} `.includes(` ${entry} `)) found.add(entry)   // phrases
  return [...found]
}

// The gate build.mjs asks before it records anything: blocked words, and grown-up topic words (notes).
export const safety = text => ({ blocked: hits(text, BLOCKED), grownUp: hits(text, GROWN_UP) })

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
const texts = [...CLIPS, ...WORD_CLIPS, ...LISTENING_CLIPS].flatMap(c => (c.kind === 'dialogue' ? c.lines.map(([, l]) => ({ id: c.id, text: l })) : [{ id: c.id, text: c.text }]))
let blocked = 0
const grown = []
for (const { id, text } of texts) {
  const b = hits(text, BLOCKED)
  if (b.length) { blocked++; console.log(`BLOCKED ${id}: ${b.join(', ')} — "${text}"`) }
  const g = hits(text, GROWN_UP)
  if (g.length) grown.push(`${id}: ${g.join(', ')} — "${text}"`)
}
if (grown.length) console.log(`\ngrown-up topic words (for a person to look at):\n  ${grown.join('\n  ')}`)
console.log(`\n${texts.length} texts · blocked ${blocked} · grown-up topic ${grown.length} · lists: ${BLOCKED.size} blocked, ${GROWN_UP.size} grown-up`)
process.exit(blocked ? 1 : 0)
}
