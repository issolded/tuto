// Blind recognition check for the trial set's pictures: can a reader who has NOT been told which picture
// is meant pick it from the sentence? For each set of three the pictures are shown in a shuffled order,
// numbered, with the sentence; the reader names the number. Done RUNS times with different orders; a set
// passes only if every run picks the key. A second question asks for a one-line description of each
// picture on its own, for a person to read. The reader is a vision model (gemini-3.8-flash), a different
// model from nothing here (the drawings are hand-written SVG), so it is a check on the drawing, not on itself.
//
//   GEMINI_API_KEY=… node scripts/english-art/check.mjs [runs]
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { SCENES, SETS } from './art.mjs'

const RUNS = Number(process.argv[2] || 3)
const dir = join(tmpdir(), 'english-art-check'); mkdirSync(dir, { recursive: true })
function png(id) {
  const f = join(dir, `${id}.svg`)
  writeFileSync(f, SCENES[id]())
  execFileSync('qlmanage', ['-t', '-s', String(process.env.ART_PX || 480), '-o', dir, f], { stdio: 'ignore' })   // macOS renders SVG
  return readFileSync(`${f}.png`).toString('base64')
}
async function ask(parts) {
  for (let t = 0; t < 5; t++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }] }) })
    if (r.status === 429 || r.status >= 500) { await new Promise(res => setTimeout(res, 15000)); continue }
    const j = await r.json()
    return j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || ''
  }
  return ''
}
const shuffle = (a, seed) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { seed = (seed * 9301 + 49297) % 233280; const j = Math.floor(seed / 233280 * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }
const imgs = Object.fromEntries(Object.keys(SCENES).map(id => [id, png(id)]))
let failed = 0
for (const set of SETS) {
  const picks = []
  for (let run = 0; run < RUNS; run++) {
    const order = shuffle(set.options, 7 + run * 13 + set.item.length)
    const parts = [{ text: `Here are three pictures, numbered 1 to 3. Which ONE picture shows exactly this: "${set.sentence}" Answer with the number only.` }]
    order.forEach((id, i) => parts.push({ text: `Picture ${i + 1}:` }, { inlineData: { mimeType: 'image/png', data: imgs[id] } }))
    const ans = (await ask(parts)).match(/[1-3]/)?.[0]
    picks.push(ans ? order[Number(ans) - 1] : '?')
  }
  const ok = picks.every(p => p === set.key)
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${set.item.padEnd(5)} "${set.sentence}"  picked: ${picks.join(', ')}`)
}
console.log('\ndescriptions (one picture at a time, nothing else said):')
for (const id of Object.keys(SCENES)) {
  const d = await ask([{ inlineData: { mimeType: 'image/png', data: imgs[id] } }, { text: 'Describe this picture for a child in one short sentence: what is there, how many, where, and what it is doing.' }])
  console.log(`  ${id.padEnd(20)} ${d.replace(/\s+/g, ' ').trim()}`)
}
process.exit(failed ? 1 : 0)
