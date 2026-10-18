// Checks a reading-story batch (scripts/english-passages format: stories[] with passage and questions[]):
//   static: the safety lists (blocked words: rejected) and UK/US words (noted), in passage, stems and options
//   blind:  each question 3 times WITHOUT the passage (3/3 on the key = common sense or a leak: FLAGGED, not
//           rejected, as the batch's review notes ask) and twice WITH it (a miss = the question or key is
//           unclear: REJECTED)
//   second: cause, inference and main-idea questions: an independent read of the passage asks whether another
//           option could also be defended (twice; both yes = REJECTED, one yes = FLAGGED)
// A story passes when no question is rejected; flags are listed for a person.
//   node scripts/english-ladder/check-stories.mjs <batch.json> [--out results.json] [--only id,id] [--conc 16]
import { readFileSync, writeFileSync } from 'node:fs'
import { safety } from '../english-audio/safety.mjs'
import { REGIONAL } from '../english-listening/vocab.mjs'
import { fetchRetry } from '../english-audio/net.mjs'

const arg = k => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null }
const FILE = process.argv[2]
const ONLY = arg('only') ? new Set(arg('only').split(',')) : null
const CONC = Number(arg('conc') || 16)
const batch = JSON.parse(readFileSync(FILE, 'utf8'))
const stories = (batch.stories || batch.items).filter(s => !ONLY || ONLY.has(s.id))

const KEY = process.env.GEMINI_API_KEY || (() => {
  const env = readFileSync(new URL('../../../tuto-app/server/.env', import.meta.url), 'utf8')
  const pick = k => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1].replace(/"/g, '').trim()
  return pick('GEMINI_TTS_API_KEY') || pick('GEMINI_API_KEY')
})()
async function ask(prompt) {
  for (let tries = 0; tries < 3; tries++) {
    const r = await fetchRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${KEY}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 1, responseMimeType: 'application/json' } }),
    })
    if (r.status === 429 || r.status >= 500) { await new Promise(res => setTimeout(res, 5000)); continue }
    const j = await r.json()
    const t = j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || ''
    try { return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)) } catch { /* try again */ }
  }
  return {}
}

const words = t => (t.toLowerCase().replace(/’/g, "'").match(/[a-z']+/g) || [])
const L = ['A', 'B', 'C', 'D']
function shuffled(n) { return [...Array(n).keys()].sort(() => Math.random() - 0.5) }

async function checkQuestion(story, q, qi) {
  const out = { q: qi + 1, op: q.op, stem: q.stem, rejected: [], flagged: [] }
  let blind = 0, read = 0
  for (const withText of [false, false, false, true, true]) {
    const order = shuffled(q.options.length)
    const opts = order.map((o, i) => `${L[i]}) ${q.options[o]}`).join('\n')
    const prompt = withText
      ? `A child read this text:\n\n"${story.passage}"\n\nQuestion: ${q.stem}\n${opts}\n\nWhich answer is right? Answer JSON only: {"answer":"A|B|C"}`
      : `A child read a short story (you cannot see it). Then this question:\n\nQuestion: ${q.stem}\n${opts}\n\nGuess the most likely answer from the question and options alone. Answer JSON only: {"answer":"A|B|C"}`
    const a = (await ask(prompt)).answer
    const right = order[L.indexOf(a)] === q.answer
    if (withText) read += right; else blind += right
  }
  out.blind = blind; out.read = read
  if (read < 2) out.rejected.push(`missed with the text (${read}/2)`)
  if (blind === 3) out.flagged.push('answered 3/3 without the text')
  if (['cause', 'inference', 'main-idea'].includes(q.op)) {
    let yes = 0, why = []
    for (let k = 0; k < 2; k++) {
      const r = await ask(`Text for children:\n\n"${story.passage}"\n\nQuestion: ${q.stem}\nOptions:\n${q.options.map((o, i) => `${L[i]}) ${o}`).join('\n')}\nIntended answer: ${L[q.answer]}\n\n` +
        `Read the text yourself. Could a careful reader defend ANOTHER option as correct from this text (not from general knowledge)? Answer JSON only: {"another":true|false,"which":"A|B|C|none","why":"one short sentence"}`)
      if (r.another === true) { yes++; why.push(r.why) }
    }
    out.second = yes
    if (yes === 2) out.rejected.push(`another option defensible (2/2): ${why[0]}`)
    else if (yes === 1) out.flagged.push(`another option defensible (1/2): ${why[0]}`)
  }
  return out
}

async function checkStory(story) {
  const text = [story.title, story.passage, ...story.questions.flatMap(q => [q.stem, ...q.options])].join(' ')
  const res = { id: story.id, level: story.level, category: story.category, rejected: [], flagged: [], questions: [] }
  const b = safety(text)
  if (b.blocked.length) res.rejected.push(`blocked word: ${b.blocked.join(', ')}`)
  if (b.grownUp.length) res.flagged.push(`grown-up topic word: ${b.grownUp.join(', ')}`)
  const reg = [...new Set(words(text).filter(w => REGIONAL.has(w)))]
  // The passages gate keeps its own UK/US list; this stricter one (made for the listening bank) only notes.
  if (reg.length) res.flagged.push(`UK/US word (listening-bank list): ${reg.join(', ')}`)
  for (const [i, q] of story.questions.entries()) {
    const r = await checkQuestion(story, q, i)
    res.questions.push(r)
    for (const x of r.rejected) res.rejected.push(`q${r.q} ${x}`)
    for (const x of r.flagged) res.flagged.push(`q${r.q} ${x}`)
  }
  res.pass = res.rejected.length === 0
  return res
}

const results = []
let next = 0
await Promise.all(Array.from({ length: CONC }, async () => {
  while (next < stories.length) {
    const s = stories[next++]
    const r = await checkStory(s)
    results.push(r)
    if (results.length % 20 === 0) console.log(`  ${results.length}/${stories.length}`)
  }
}))
results.sort((a, b) => a.id.localeCompare(b.id))
const out = arg('out')
if (out) writeFileSync(out, JSON.stringify({ file: FILE, checked: new Date().toISOString(), results }, null, 1))
const by = lv => results.filter(r => !lv || r.level === lv)
for (const lv of [...new Set(results.map(r => r.level))].sort()) {
  const rs = by(lv), qs = rs.flatMap(r => r.questions)
  console.log(`${lv}: ${rs.filter(r => r.pass).length}/${rs.length} stories pass · ${rs.filter(r => r.pass && r.flagged.length).length} of them flagged · questions: guessed 3/3 without text ${qs.filter(q => q.blind === 3).length}/${qs.length}, missed with text ${qs.filter(q => q.read < 2).length}`)
}
for (const r of results.filter(r => !r.pass)) console.log(`REJECT ${r.id}: ${r.rejected.join(' | ')}`)
