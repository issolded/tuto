// Which words of a text are outside the Cambridge Starters + Movers lists (src/lib/literacy/yleWordlist
// .generated.js). A word counts by its headword: plural, -ed, -ing, -er/-est, irregular past and the usual
// contractions are folded back before the look-up. Deterministic; no model.
import { YLE_WORDLIST } from '../../src/lib/literacy/yleWordlist.generated.js'

const LEVEL = { starters: 1, movers: 2, flyers: 3 }
const best = new Map()        // headword -> lowest level it is on
for (const e of YLE_WORDLIST) {
  for (const f of [e.word, ...(e.forms || [])]) {
    for (const part of f.toLowerCase().replace(/’/g, "'").split(/[\s/]+/)) {
      if (!part || /[…()]/.test(part)) continue
      const w = part.replace(/[^a-z']/g, '')
      if (w && (!best.has(w) || best.get(w) > LEVEL[e.level])) best.set(w, LEVEL[e.level])
    }
  }
}

// The lists give numbers as figures ("1–20" Starters, "21–100" Movers); the words are added the same way.
for (const n of ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']) if (!best.has(n) || best.get(n) > 1) best.set(n, 1)
for (const n of ['thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred']) if (!best.has(n) || best.get(n) > 2) best.set(n, 2)

const IRREGULAR = {
  went: 'go', gone: 'go', goes: 'go', had: 'have', has: 'have', is: 'be', are: 'be', am: 'be', was: 'be', were: 'be', been: 'be',
  did: 'do', does: 'do', done: 'do', saw: 'see', seen: 'see', came: 'come', got: 'get', made: 'make', took: 'take', taken: 'take',
  gave: 'give', given: 'give', ate: 'eat', eaten: 'eat', drank: 'drink', found: 'find', left: 'leave', thought: 'think',
  bought: 'buy', brought: 'bring', said: 'say', told: 'tell', knew: 'know', ran: 'run', sat: 'sit', swam: 'swim', sang: 'sing',
  wrote: 'write', flew: 'fly', fell: 'fall', forgot: 'forget', lost: 'lose', wore: 'wear', caught: 'catch', taught: 'teach',
  felt: 'feel', slept: 'sleep', met: 'meet', stood: 'stand', won: 'win', began: 'begin', broke: 'break', broken: 'break',
  chose: 'choose', drew: 'draw', drove: 'drive', grew: 'grow', heard: 'hear', held: 'hold', rode: 'ride', rang: 'ring', sent: 'send',
  sold: 'sell', spent: 'spend', threw: 'throw', understood: 'understand', woke: 'wake', could: 'can', would: 'will', should: 'shall',
  children: 'child', men: 'man', women: 'woman', feet: 'foot', teeth: 'tooth', mice: 'mouse', people: 'person', leaves: 'leaf',
  better: 'good', best: 'good', worse: 'bad', worst: 'bad', me: 'i', my: 'i', mine: 'i', him: 'he', his: 'he', her: 'she', hers: 'she',
  us: 'we', our: 'we', ours: 'we', them: 'they', their: 'they', theirs: 'they', its: 'it', an: 'a', shoes: 'shoe', clothes: 'clothes',
  hid: 'hide', put: 'put', let: 'let', cut: 'cut', hit: 'hit', read: 'read', shut: 'shut', laid: 'lay', paid: 'pay', kept: 'keep',
  built: 'build', sung: 'sing', sang: 'sing', swum: 'swim', drunk: 'drink', drawn: 'draw', written: 'write', ridden: 'ride', eaten2: 'eat', lent: 'lend', meant: 'mean', swept: 'sweep', tore: 'tear', stuck: 'stick', fed: 'feed', bit: 'bite', hung: 'hang',
}
const CONTRACT = { "n't": ['not'], "'s": [], "'re": ['be'], "'m": ['be'], "'ll": ['will'], "'ve": ['have'], "'d": ['would'] }
const SPECIAL = { "can't": ['can', 'not'], "won't": ['will', 'not'], "don't": ['do', 'not'], "doesn't": ['do', 'not'], "didn't": ['do', 'not'],
  "let's": ['let', 'we'], "i'm": ['i', 'be'], "isn't": ['be', 'not'], "aren't": ['be', 'not'], "wasn't": ['be', 'not'], "weren't": ['be', 'not'],
  "haven't": ['have', 'not'], "hasn't": ['have', 'not'], "couldn't": ['can', 'not'], "shouldn't": ['shall', 'not'], "wouldn't": ['will', 'not'] }

function heads(raw) {
  const w = raw.toLowerCase().replace(/’/g, "'")
  if (best.has(w)) return [w]                    // on the list as written ("let's", "o'clock")
  if (SPECIAL[w]) return SPECIAL[w]
  for (const [suf, add] of Object.entries(CONTRACT)) if (w.endsWith(suf) && w.length > suf.length) return [...heads(w.slice(0, -suf.length)), ...add]
  return [w]
}
// Candidate headwords for one inflected form, most literal first.
function stems(w) {
  if (IRREGULAR[w]) return [w, IRREGULAR[w]]
  const c = [w]
  const strip = (suf, add = '') => { if (w.endsWith(suf) && w.length > suf.length + 1) c.push(w.slice(0, -suf.length) + add) }
  strip('s'); strip('es'); strip('ies', 'y'); strip('ed'); strip('ed', 'e'); strip('ied', 'y'); strip('d')
  strip('ing'); strip('ing', 'e'); strip('er'); strip('er', 'e'); strip('est'); strip('est', 'e'); strip('ier', 'y'); strip('iest', 'y'); strip('ly'); strip('ily', 'y')
  // doubled consonant: running -> run, stopped -> stop, bigger -> big
  for (const suf of ['ing', 'ed', 'er', 'est']) if (w.endsWith(suf) && w.length > suf.length + 2) {
    const s = w.slice(0, -suf.length)
    if (s.at(-1) === s.at(-2)) c.push(s.slice(0, -1))
  }
  return c
}

export const NUMBERS = /^\d+$/
// Words of `text` above `maxLevel` (2 = Movers): [{ word, level }] (level 3 = Flyers, 4 = not on the lists).
export function offList(text, maxLevel = 2) {
  const out = []
  for (const tok of text.match(/[A-Za-z’'-]+|\d+/g) || []) {
    if (NUMBERS.test(tok)) continue
    // a hyphenated word counts whole when the list has it ("T-shirt"), else part by part
    const whole = tok.toLowerCase().replace(/’/g, "'").replace(/[^a-z']/g, '')
    const parts = best.has(whole) ? [whole] : tok.split('-').filter(Boolean)
    for (const raw of parts) for (const h of heads(raw)) {
      const lv = Math.min(...stems(h).map(s => best.get(s) ?? 4))
      if (lv > maxLevel) out.push({ word: raw, level: lv })
    }
  }
  return out
}
export const wordCount = text => (text.match(/[A-Za-z’']+|\d+/g) || []).length

// Said differently in UK and US English, or a different word for the same thing: kept out of the shared bank.
export const REGIONAL = new Set(('mum mom mummy mommy holiday holidays vacation garden yard football soccer autumn fall sweets candy biscuit biscuits ' +
  'cookie cookies chips fries crisps flat apartment trousers pants rubbish trash garbage lift elevator maths math shop shops store stores ' +
  'film films movie movies rubber eraser pavement sidewalk queue torch flashlight lorry truck motorway highway petrol gas ' +
  'colour color favourite favorite centre center programme program pyjamas pajamas jumper sweater nappy diaper postman ' +
  'mailman semester rucksack backpack cinema theater theatre tap faucet').split(' '))
