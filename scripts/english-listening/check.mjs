// Checks the listening bank (src/lib/literacy/listeningBank.js), A4 and A5 items: everything is heard,
// nothing is read. Two parts:
//   static (always): sizes, vocabulary against Starters + Movers, UK/US words, the safety lists
//                    (scripts/english-audio/safety.mjs), speakers, options
//   --solve: a blind solver (gemini-3.8-flash) answers each question 3 times WITHOUT the transcript and twice
//            WITH it. Guessed without it (3/3 on the key) = the question measures common sense, not
//            listening: rejected. Missed with it = the question or the key is unclear: rejected.
//
//   node scripts/english-listening/check.mjs [--solve] [--only L5-001,L4-003]
//
// Exit 1 when any item fails. A pass means "worth a person's time", never "approved".
import { readFileSync } from 'node:fs'
import { offList, wordCount, REGIONAL } from './vocab.mjs'
import { fetchRetry } from '../english-audio/net.mjs'
import { safety } from '../english-audio/safety.mjs'
import { LISTENING, SPEAKER_GENDER, NARRATOR } from '../../src/lib/literacy/listeningBank.js'

const arg = k => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null }
const ONLY = arg('only') ? new Set(arg('only').split(',')) : null
const SOLVE = process.argv.includes('--solve')

const STEP = {
  A4: { words: [12, 30], sentences: [2, 3], flyers: 1, speakers: [1, 1] },
  A5: { words: [35, 65], sentences: [4, 10], flyers: 2, speakers: [2, 2] },
}
const MAX_SENTENCE = 15

const NAMES_OK = new Set(Object.keys(SPEAKER_GENDER))

const sentences = t => t.split(/(?<=[.!?])\s+/).filter(Boolean)
const words = t => (t.toLowerCase().replace(/’/g, "'").match(/[a-z']+/g) || [])

function staticCheck(it) {
  const S = STEP[it.step], problems = [], notes = []
  if (!S) return [`unknown step ${it.step}`]
  const transcript = it.lines.map(([, l]) => l).join(' ')
  const all = [transcript, it.question, ...it.options, it.feedback].join(' ')
  const n = wordCount(transcript)
  if (n < S.words[0] || n > S.words[1]) problems.push(`transcript ${n} words, want ${S.words.join('–')}`)
  const ns = sentences(transcript).length
  if (ns < S.sentences[0] || ns > S.sentences[1]) problems.push(`${ns} sentences, want ${S.sentences.join('–')}`)
  for (const s of sentences(transcript)) if (wordCount(s) > MAX_SENTENCE) problems.push(`long sentence (${wordCount(s)}): "${s}"`)
  const off = offList(all).filter(o => !NAMES_OK.has(o.word))
  const unlisted = [...new Set(off.filter(o => o.level === 4).map(o => o.word))]
  const flyers = [...new Set(off.filter(o => o.level === 3).map(o => o.word.toLowerCase()))]
  if (unlisted.length) problems.push(`not on the lists: ${unlisted.join(', ')}`)
  if (flyers.length > S.flyers) problems.push(`${flyers.length} Flyers words (${flyers.join(', ')}), at most ${S.flyers}`)
  else if (flyers.length) notes.push(`Flyers: ${flyers.join(', ')}`)
  const unsafe = [...new Set(safety(all).blocked)], grownUp = [...new Set(safety(all).grownUp)]
  if (unsafe.length) problems.push(`blocked word: ${unsafe.join(', ')}`)
  if (grownUp.length) notes.push(`grown-up topic word: ${grownUp.join(', ')}`)
  const regional = [...new Set(words(all).filter(w => REGIONAL.has(w)))]
  if (regional.length) problems.push(`UK/US word: ${regional.join(', ')}`)
  const who = [...new Set(it.lines.map(([s]) => s))]
  if (who.length < S.speakers[0] || who.length > S.speakers[1]) problems.push(`${who.length} speakers`)
  for (const s of who) if (s !== NARRATOR && !NAMES_OK.has(s)) problems.push(`speaker ${s} has no voice`)
  if (who.length === 2 && SPEAKER_GENDER[who[0]] === SPEAKER_GENDER[who[1]]) problems.push('both speakers have the same voice')
  if (it.options.length !== 3) problems.push(`${it.options.length} options`)
  const norm = o => o.toLowerCase().replace(/[^a-z ]/g, '').trim()
  if (new Set(it.options.map(norm)).size !== it.options.length) problems.push('two options are the same')
  const lens = it.options.map(wordCount)
  if (Math.max(...lens) > 2 * Math.min(...lens) + 1) notes.push(`option lengths ${lens.join('/')}`)
  if (!norm(it.feedback).startsWith(norm(it.options[0]).split(' ').slice(0, 3).join(' '))) notes.push('feedback does not start with the answer')
  // The wrong options should be in the talk too (heard, but not the answer): then only listening tells them apart.
  const content = o => words(o).filter(w => w.length > 2 && !['with', 'they', 'them', 'that', 'this', 'there', 'have'].includes(w))
  for (const o of it.options.slice(1)) if (!content(o).some(w => words(transcript).some(t => t.startsWith(w.slice(0, 4))))) notes.push(`wrong option not in the talk: "${o}"`)
  if (!content(it.options[0]).some(w => words(transcript).some(t => t.startsWith(w.slice(0, 4))))) notes.push('answer is not said: inference')
  return { problems, notes, words: n }
}

// ── blind solver ────────────────────────────────────────────────────────────────────────────────
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
  const runs = []
  for (const withText of [false, false, false, true, true]) {
    const order = [0, 1, 2].sort(() => Math.random() - 0.5)        // a fresh order each run: no position habit
    const letters = ['A', 'B', 'C']
    const opts = order.map((o, i) => `${letters[i]}) ${it.options[o]}`).join('\n')
    const talk = it.lines.map(([s, l]) => (s === NARRATOR ? l : `${s}: ${l}`)).join('\n')
    const prompt = withText
      ? `A child heard this:\n\n${talk}\n\nQuestion: ${it.question}\n${opts}\n\nWhich answer is right? Answer JSON only: {"answer":"A|B|C"}`
      : `A child heard a short ${it.lines.length > 1 ? 'talk between two children' : 'text'} (you cannot hear it). Then this question:\n\n` +
        `Question: ${it.question}\n${opts}\n\nGuess the most likely answer from the question and options alone. Answer JSON only: {"answer":"A|B|C"}`
    const a = (await ask(prompt)).answer
    runs.push({ withText, right: order[letters.indexOf(a)] === 0 })
  }
  const blind = runs.filter(r => !r.withText && r.right).length, heard = runs.filter(r => r.withText && r.right).length
  const problems = []
  if (blind === 3) problems.push('guessed 3/3 without the talk')       // by luck: 1 in 27
  if (heard < 2) problems.push(`missed with the talk (${heard}/2)`)
  return { blind, heard, problems }
}

let failed = 0
const items = LISTENING.filter(it => !ONLY || ONLY.has(it.id))
const ids = new Set()
for (const it of items) {
  if (ids.has(it.id)) { console.log(`${it.id}: duplicate id`); failed++ }
  ids.add(it.id)
}
const results = await Promise.all(items.map(async it => {
  const s = staticCheck(it)
  const v = SOLVE ? await solve(it) : null
  return { it, s, v }
}))
for (const { it, s, v } of results) {
  const problems = [...s.problems, ...(v?.problems || [])]
  if (problems.length) failed++
  const tag = problems.length ? 'FAIL' : 'ok  '
  console.log(`${tag} ${it.id} ${it.step} ${s.words}w${v ? ` blind ${v.blind}/3 heard ${v.heard}/2` : ''}${problems.length ? ' · ' + problems.join(' · ') : ''}${s.notes.length ? '  (' + s.notes.join('; ') + ')' : ''}`)
}
console.log(`\n${items.length} items, ${items.length - failed} pass${SOLVE ? '' : ' (static only; --solve for the blind solver)'}`)
process.exit(failed ? 1 : 0)
