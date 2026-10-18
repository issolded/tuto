// Checks the written sentence bank (src/lib/literacy/sentenceBank.js): Ca2, Ca3, Ca4, Cd6, E1.
//   static: words on Starters + Movers (Cd6: up to Flyers; Flyers words otherwise at most 1), the safety lists,
//           no UK/US words, three distinct options
//   --solve: a blind solver (gemini-3.8-flash). Items with a context are answered 3 times WITHOUT it (guessed
//            3/3 = common sense, rejected) and twice WITH it (missed = unclear, rejected). Ca2 and Cd6 have no
//            context: answered twice, must be right both times.
//   node scripts/english-ladder/check-bank.mjs [--solve] [--only C3-001,...]
import { readFileSync } from 'node:fs'
import { offList, REGIONAL } from '../english-listening/vocab.mjs'
import { safety } from '../english-audio/safety.mjs'
import { fetchRetry } from '../english-audio/net.mjs'
import { SENTENCES } from '../../src/lib/literacy/sentenceBank.js'
import { SPEAKER_GENDER } from '../../src/lib/literacy/listeningBank.js'

const arg = k => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null }
const ONLY = arg('only') ? new Set(arg('only').split(',')) : null
const SOLVE = process.argv.includes('--solve')
const NAMES = new Set(Object.keys(SPEAKER_GENDER).concat(['London', 'Germany', 'May', 'June']))
const words = t => (t.toLowerCase().replace(/’/g, "'").match(/[a-z']+/g) || [])

function staticCheck(it) {
  const problems = [], notes = []
  const all = [it.context || '', it.text, ...it.options].join(' ')
  const max = it.step === 'Cd6' ? 3 : 2
  const off = offList(all, max).filter(o => !NAMES.has(o.word))
  const unlisted = [...new Set(off.filter(o => o.level === 4).map(o => o.word))]
  if (unlisted.length) problems.push(`not on the lists: ${unlisted.join(', ')}`)
  if (it.step !== 'Cd6') {
    const flyers = [...new Set(off.filter(o => o.level === 3).map(o => o.word.toLowerCase()))]
    if (flyers.length > 1) problems.push(`${flyers.length} Flyers words (${flyers.join(', ')})`)
    else if (flyers.length) notes.push(`Flyers: ${flyers.join(', ')}`)
  }
  const blocked = safety(all).blocked
  if (blocked.length) problems.push(`blocked word: ${blocked.join(', ')}`)
  const regional = [...new Set(words(all).filter(w => REGIONAL.has(w)))]
  if (regional.length) problems.push(`UK/US word: ${regional.join(', ')}`)
  if (new Set(it.options.map(o => o.toLowerCase())).size !== 3) problems.push('options repeat')
  return { problems, notes }
}

const KEY = process.env.GEMINI_API_KEY || (() => {
  const env = readFileSync(new URL('../../../tuto-app/server/.env', import.meta.url), 'utf8')
  const pick = k => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1].replace(/"/g, '').trim()
  return pick('GEMINI_TTS_API_KEY') || pick('GEMINI_API_KEY')
})()
async function ask(prompt) {
  const r = await fetchRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 1, responseMimeType: 'application/json' } }),
  })
  const j = await r.json()
  const t = j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || ''
  try { return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)) } catch { return {} }
}
async function solve(it) {
  const runs = it.context ? [false, false, false, true, true] : [true, true]
  const res = []
  for (const withText of runs) {
    const order = [0, 1, 2].sort(() => Math.random() - 0.5)
    const L = ['A', 'B', 'C']
    const opts = order.map((o, i) => `${L[i]}) ${it.options[o]}`).join('\n')
    const q = it.step === 'Cd6' ? `Which option fills the gap correctly?\n${it.text}` : it.text
    const prompt = withText
      ? `${it.context ? `A child read: "${it.context}"\n\n` : ''}Question: ${q}\n${opts}\n\nWhich answer is right? Answer JSON only: {"answer":"A|B|C"}`
      : `A child read two or three short sentences (you cannot see them). Then:\n\nQuestion: ${q}\n${opts}\n\nGuess the most likely answer from the question and options alone. Answer JSON only: {"answer":"A|B|C"}`
    res.push({ withText, right: order[L.indexOf((await ask(prompt)).answer)] === 0 })
  }
  const blind = res.filter(r => !r.withText && r.right).length, read = res.filter(r => r.withText && r.right).length
  const problems = []
  if (it.context && blind === 3) problems.push('guessed 3/3 without the text')
  if (read < 2) problems.push(`missed with the text (${read}/2)`)
  return { blind: it.context ? `${blind}/3` : '-', read, problems }
}

const items = SENTENCES.filter(it => !ONLY || ONLY.has(it.id))
let failed = 0
const out = await Promise.all(items.map(async it => ({ it, s: staticCheck(it), v: SOLVE ? await solve(it) : null })))
for (const { it, s, v } of out) {
  const problems = [...s.problems, ...(v?.problems || [])]
  if (problems.length) failed++
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${it.id} ${it.step}${v ? ` blind ${v.blind} read ${v.read}/2` : ''}${problems.length ? ' · ' + problems.join(' · ') : ''}${s.notes.length ? '  (' + s.notes.join('; ') + ')' : ''}`)
}
console.log(`\n${items.length} items, ${items.length - failed} pass${SOLVE ? '' : ' (static only; --solve for the blind solver)'}`)
process.exit(failed ? 1 : 0)
