// Deterministic gate for reading passages. Runs before any model reviewer and decides the same way
// every time. It knows nothing about meaning; it catches what lists and counts can catch so the
// reviewers are spent on what they cannot: vocabulary above the level, listed words, regional words,
// sentence size, and whether each question's evidence really is in the passage.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { LEVELS, BASE_WORDS } from './spec.mjs'
import { NAMES } from '../../src/lib/englishTables.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const listFile = f => readFileSync(join(root, f), 'utf8').split('\n').map(l => l.replace(/#.*/, '').trim().toLowerCase()).filter(Boolean)

const yleSrc = readFileSync(join(root, 'src/lib/literacy/yleWordlist.generated.js'), 'utf8')
const YLE = JSON.parse(yleSrc.slice(yleSrc.indexOf('['), yleSrc.lastIndexOf(']') + 1))
const RANK = { starters: 0, movers: 1, flyers: 2 }
const LEVEL_OF = new Map()                                   // form -> lowest level it appears at
const REGIONAL = new Set()                                   // words whose UK and US forms differ
for (const e of YLE) {
  for (const f of [e.word, ...e.forms]) {
    for (const part of f.toLowerCase().split(/[\s/]+/)) {
      if (!/^[a-z']+$/.test(part)) continue
      const was = LEVEL_OF.get(part)
      if (was === undefined || RANK[e.level] < RANK[was]) LEVEL_OF.set(part, e.level)
    }
  }
  if (e.uk || e.us) for (const w of [e.word, e.uk, e.us].filter(Boolean)) for (const p of w.toLowerCase().replace(/\(s\)/, '').split(/[\s/]+/)) if (p.length > 2 && !['city', 'town', 'star', 'sports', 'shopping', 'engine', 'fire', 'truck'].includes(p)) REGIONAL.add(p)
}
// Words the Cambridge lists leave out because every reader knows them, and the spelling-neutral
// regional words the lists do not mark. Kept short on purpose: anything longer belongs in the lexicon.
for (const w of ['an', 'the', 'and', 'but', 'or', 'so', 'if', 'because', 'then', 'not', 'no', 'yes', 'oh', 'ok']) LEVEL_OF.set(w, LEVEL_OF.get(w) || 'starters')
for (const w of ['mum', 'mom', 'mummy', 'mommy', 'color', 'colour', 'favorite', 'favourite', 'center', 'centre', 'gray', 'grey',
  'neighbor', 'neighbour', 'behavior', 'behaviour', 'dollar', 'dollars', 'cent', 'cents', 'pound', 'pounds', 'pence', 'penny',
  'pavement', 'sidewalk', 'trousers', 'pants', 'vacation', 'garbage', 'rubbish', 'trash', 'crisps', 'petrol', 'gas', 'diaper', 'nappy',
  'kindergarten', 'nursery', 'grade', 'semester', 'recess', 'playtime', 'zucchini', 'courgette', 'eggplant', 'aubergine',
  'jumper', 'sweater', 'mail', 'post', 'line', 'queue', 'yard', 'garden', 'closet', 'wardrobe', 'faucet', 'tap']) REGIONAL.add(w)
// `garden`, `post`, `line`, `tap`, `yard` are ordinary words in both; they are regional only in one
// sense. The gate cannot see the sense, so those five stay readable and the reviewer judges them.
for (const w of ['garden', 'post', 'line', 'tap', 'yard', 'shop', 'film', 'fall', 'sweet', 'flat', 'lift', 'store', 'rubber']) REGIONAL.delete(w)
// Number words sit in the Cambridge lists as "1–100", not as words.
for (const w of ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'twenty', 'hundred',
  'first', 'second', 'third', 'last']) LEVEL_OF.set(w, LEVEL_OF.get(w) || 'starters')

const IRREGULAR = {
  was: 'be', were: 'be', is: 'be', am: 'be', are: 'be', been: 'be', being: 'be',
  went: 'go', gone: 'go', ran: 'run', saw: 'see', seen: 'see', came: 'come', took: 'take', taken: 'take', gave: 'give', given: 'give',
  found: 'find', made: 'make', said: 'say', told: 'tell', thought: 'think', got: 'get', had: 'have', has: 'have', did: 'do', done: 'do', does: 'do',
  ate: 'eat', eaten: 'eat', felt: 'feel', knew: 'know', known: 'know', left: 'leave', began: 'begin', begun: 'begin', brought: 'bring',
  bought: 'buy', caught: 'catch', fell: 'fall', fallen: 'fall', flew: 'fly', grew: 'grow', grown: 'grow', held: 'hold', kept: 'keep',
  lost: 'lose', met: 'meet', sat: 'sit', slept: 'sleep', stood: 'stand', swam: 'swim', taught: 'teach', threw: 'throw', thrown: 'throw',
  understood: 'understand', wore: 'wear', woke: 'wake', won: 'win', wrote: 'write', written: 'write', built: 'build', drew: 'draw',
  drawn: 'draw', drank: 'drink', drove: 'drive', forgot: 'forget', hid: 'hide', hidden: 'hide', hung: 'hang', rode: 'ride', rang: 'ring',
  sang: 'sing', sent: 'send', shook: 'shake', spent: 'spend', broke: 'break', broken: 'break', chose: 'choose', fed: 'feed', heard: 'hear',
  meant: 'mean', paid: 'pay', sold: 'sell', shone: 'shine', stuck: 'stick', swept: 'sweep', lay: 'lie', led: 'lead', lit: 'light',
  blew: 'blow', blown: 'blow', dug: 'dig', fought: 'fight', froze: 'freeze', frozen: 'freeze', slid: 'slide', spun: 'spin',
  stole: 'steal', struck: 'strike', swung: 'swing', tore: 'tear', torn: 'tear', bent: 'bend', lent: 'lend', fled: 'flee', bit: 'bite', bitten: 'bite',
  lying: 'lie', dying: 'die', tying: 'tie', shown: 'show',
  better: 'good', best: 'good', worse: 'bad', worst: 'bad', children: 'child', men: 'man', women: 'woman', feet: 'foot', teeth: 'tooth',
  mice: 'mouse', people: 'person', leaves: 'leaf', wolves: 'wolf', shelves: 'shelf', knives: 'knife', halves: 'half', lives: 'life',
  me: 'i', him: 'he', us: 'we', them: 'they', myself: 'i', herself: 'she', himself: 'he', themselves: 'they', ourselves: 'we', itself: 'it',
}
function lemmas(w) {
  const out = [w]
  if (IRREGULAR[w]) out.push(IRREGULAR[w])
  const strip = (suf, add = '') => { if (w.endsWith(suf) && w.length > suf.length + 1) out.push(w.slice(0, -suf.length) + add) }
  strip('s'); strip('es'); strip('ies', 'y'); strip('ied', 'y'); strip('ed'); strip('d'); strip('ing'); strip('ing', 'e')
  strip('er'); strip('er', 'e'); strip('est'); strip('est', 'e'); strip('ier', 'y'); strip('iest', 'y'); strip('ly'); strip('ily', 'y')
  for (const suf of ['ed', 'ing', 'er', 'est']) {                       // stopped -> stop, bigger -> big
    if (w.endsWith(suf)) { const s = w.slice(0, -suf.length); if (s.length > 2 && s.at(-1) === s.at(-2)) out.push(s.slice(0, -1)) }
  }
  return out
}
export function headword(word) {
  if (BASE.has(word)) return word
  const forms = [word, ...(IRREGULAR[word] ? [IRREGULAR[word]] : []), ...lemmas(word).slice(1)]
  const known = forms.find(l => BASE.has(l)) || forms.find(l => LEVEL_OF.has(l)) || forms.find(l => DALE.has(l))
  if (known) return known
  // A word no list knows still counts once with its plain inflections (suggested/suggest, footsteps);
  // only -ed, -ing and -s are undone here, never -er/-est/-ly, which would turn whether into wheth.
  return [/ied$/, /ies$/, /ed$/, /ing$/, /es$/, /s$/].map((re, i) => word.replace(re, i < 2 ? 'y' : '')).find(x => x !== word && x.length > 2) || word
}
export function levelOf(word) {
  let best
  for (const l of lemmas(word)) { const v = LEVEL_OF.get(l); if (v && (best === undefined || RANK[v] < RANK[best])) best = v }
  return best
}

// Hand-made lists (ours) and published lists (vendor) are kept apart: the published ones are made for
// adult chat and carry ordinary children's words in another sense (`balls`), so a vendor hit is ignored
// when the word is on the Cambridge lists. Our own list is never overridden.
const HAND = new Set([
  ...listFile('scripts/english/blocklist.txt'),
  // Religious occasions are religion (decision 2026-09-20). The lexicon list has the words; the
  // occasions were never needed there because a vocabulary quiz did not reach them.
  'christmas', 'xmas', 'easter', 'halloween', 'thanksgiving', 'diwali', 'eid', 'ramadan', 'hanukkah', 'passover', 'santa',
  'lent', 'church', 'mosque', 'temple', 'synagogue', 'god', 'gods', 'pray', 'prayer', 'angel', 'heaven', 'hell', 'devil',
])
const VENDOR = new Set([
  ...listFile('scripts/english/vendor/ldnoobw-en.txt'),
  ...Object.entries(JSON.parse(readFileSync(join(root, 'scripts/english/vendor/cuss.json'), 'utf8'))).filter(([, s]) => s >= 1).map(([w]) => w),
])
const BLOCK = new Set([...HAND, ...VENDOR])
const TOPICS = new Set(listFile('scripts/english/sentence-topics.txt'))
// Dale-Chall: words most US fourth-graders know. Outside the Cambridge lists they count as above
// level (allowed in small numbers), not as unknown.
const DALE = new Set(JSON.parse(readFileSync(join(root, 'scripts/english/vendor/dale-chall.json'), 'utf8')).map(w => w.toLowerCase()))
// A word that is itself a dictionary word is matched as it is: `wood` must not be read as `woo` + d.
// Only a word the dictionaries do not know is reduced to its stem first (`buried` → `bury`).
const BASE = new Set(BASE_WORDS)
const known = w => LEVEL_OF.has(w) || DALE.has(w)
const forms = w => known(w) ? [w, ...(IRREGULAR[w] ? [IRREGULAR[w]] : [])] : lemmas(w)
const listed = (set, w) => forms(w).some(l => set.has(l))
const blocked = w => forms(w).some(l => HAND.has(l) || (VENDOR.has(l) && !levelOf(w)))

const sentencesOf = t => t.replace(/\s+/g, ' ').trim().split(/(?<=[.!?]["”’]?)\s+(?=["“‘]?[A-Z])/).filter(Boolean)
const wordsOf = t => (t.toLowerCase().replace(/[’‘]/g, "'").match(/[a-z]+(?:'[a-z]+)?/g) || []).map(w => ({ "can't": 'can', "won't": 'will', "shan't": 'shall' })[w] || w.replace(/n't$/, '').replace(/'(s|ll|re|ve|m|d)$/, ''))

export function gate(item, levelName, names = NAMES) {
  const L = LEVELS[levelName]
  const issues = [], warnings = []
  const fail = (code, detail) => issues.push({ code, detail })
  const warn = (code, detail) => warnings.push({ code, detail })
  const text = item.passage || ''
  const nameSet = new Set(names.map(n => n.toLowerCase()))

  const sents = sentencesOf(text)
  const words = wordsOf(text)
  if (words.length < L.words[0] || words.length > L.words[1]) fail('length', `${words.length} words, want ${L.words.join('–')}`)
  if (sents.length < L.sentences[0] || sents.length > L.sentences[1]) fail('sentences', `${sents.length} sentences, want ${L.sentences.join('–')}`)
  for (const s of sents) { const n = wordsOf(s).length; if (n > L.maxSentenceWords) fail('long-sentence', `${n} words: "${s}"`) }

  // Everything a child reads: passage, title, question stems and options.
  const all = [item.title || '', text, ...(item.questions || []).flatMap(q => [q.stem, ...(q.options || [])])].join(' \n ')
  // Counted by headword, not by form: kept and keep, followed and follow, heavy and heavier are one
  // word each. The headword is the first form the dictionaries know, else the word as written.
  const flyers = new Set(), outside = new Set()
  for (const w of new Set(wordsOf(all).map(headword))) {
    if (blocked(w)) fail('blocklist', w)
    if (listed(TOPICS, w)) fail('grown-up-topic', w)
    if (REGIONAL.has(w)) fail('regional', w)
    if (nameSet.has(w)) continue
    if (w === "n't" || w.length === 1 && w !== 'a' && w !== 'i') continue
    const lv = levelOf(w)
    if (lv === undefined) (lemmas(w).some(l => DALE.has(l)) ? flyers : outside).add(w)
    else if (!L.vocab.includes(lv)) flyers.add(w)
  }
  if (L.base) {
    // One limit for every word outside the level and the base list, whichever list it is on or not.
    const content = [...(L.dale ? [] : flyers), ...outside].filter(w => !BASE.has(w))
    if (content.length > L.contentAllowed) fail('content-words', `${content.length} > ${L.contentAllowed}: ${content.join(', ')}`)
  } else {
    if (flyers.size > L.flyersAllowed) fail('vocab-above-level', [...flyers].join(', '))
    if (outside.size > L.outsideAllowed) fail('vocab-outside-lists', [...outside].join(', '))
  }

  const qs = item.questions || []
  if (qs.length !== L.ops.length) fail('question-count', `${qs.length}, want ${L.ops.length}`)
  const norm = s => (s || '').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()
  for (const [i, q] of qs.entries()) {
    const tag = `q${i + 1}`
    if (!Array.isArray(q.options) || q.options.length !== L.options) { fail('options', `${tag}: ${q.options?.length} options`); continue }
    if (new Set(q.options.map(norm)).size !== q.options.length) fail('options', `${tag}: duplicate option`)
    if (!(q.answer >= 0 && q.answer < q.options.length)) fail('answer', `${tag}: answer index ${q.answer}`)
    if (!q.evidence || !norm(text).includes(norm(q.evidence))) fail('evidence', `${tag}: evidence not found in passage: "${q.evidence}"`)
    // An option copied word for word from the passage while the right answer is not is a giveaway
    // in reverse; the other way round (answer verbatim, distractors not) is a giveaway forwards.
    const verbatim = q.options.map(o => norm(o).split(' ').length >= 3 && norm(text).includes(norm(o).replace(/\.$/, '')))
    // A cause answer copied from the text can be found by matching words without understanding the
    // reason; that is a fail. For a plain detail it is how the detail is found, so only a warning.
    if (verbatim[q.answer] && verbatim.filter(Boolean).length === 1) (q.op === 'cause' ? fail : warn)('word-match', `${tag}: only the answer is copied from the text`)
    const lens = q.options.map(o => o.length)
    if (lens[q.answer] > 1.6 * Math.max(...lens.filter((_, j) => j !== q.answer))) fail('giveaway', `${tag}: the answer is much longer than the others`)
  }
  return { ok: issues.length === 0, issues, warnings, stats: { words: words.length, sentences: sents.length, flyers: [...flyers], outside: [...outside], content: [...(L.dale ? [] : flyers), ...outside].filter(w => !BASE.has(w)) } }
}

// The word list the generator is shown: base forms at the level's vocabulary, regional words removed.
export function allowedWords(levelName) {
  const L = LEVELS[levelName]
  const words = [...LEVEL_OF].filter(([w, lv]) => L.vocab.includes(lv) && !REGIONAL.has(w) && !BLOCK.has(w)).map(([w]) => w)
  return [...new Set([...words, ...(L.base ? BASE_WORDS : [])])].sort()
}
export const REGIONAL_WORDS = REGIONAL
