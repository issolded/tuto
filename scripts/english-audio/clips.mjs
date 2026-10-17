// Every recording the English trial set (docs/ENGLISH-TRIAL-SET.md) needs: the listening items (A), and
// the spoken feedback the reading and spelling items give after a wrong answer (B01/02, CA01–03, D01/02).
// Reading items (B03+, C, E) are read, not heard; reading their text aloud is a separate support.
//
// kind: word | sentence | dialogue | instruction. A dialogue is a list of [speaker, line]; each line is
// made on its own with that speaker's voice and the lines are joined with a short pause, so that every
// line can be checked on its own.

import { LISTENING, SPEAKER_GENDER, NARRATOR, listenClip } from '../../src/lib/literacy/listeningBank.js'

export const VOICES = {
  // Chosen 2026-10-16 by a blind accent check (two runs each, see docs/ENGLISH-AUDIO.md). Puck reads
  // American even when asked for en-GB, so the British male is Charon; for American English, Puck is right.
  uk: { female: 'Leda', male: 'Charon' },
  us: { female: 'Leda', male: 'Puck' },
}
export const SPEAKERS = { Mia: 'female', Ben: 'male', Leo: 'male', Kim: 'female', ...SPEAKER_GENDER }

export const CLIPS = [
  // words — A01/A02 prompts, and the feedback of B01/B02 and D01/D02
  { id: 'w-dog', kind: 'word', text: 'dog', items: ['A01', 'B01'] },
  { id: 'w-apple', kind: 'word', text: 'apple', items: ['A02', 'B02'] },
  { id: 'w-sun', kind: 'word', text: 'sun', items: ['D01'] },
  { id: 'w-fish', kind: 'word', text: 'fish', items: ['D02'] },
  // sentences — A03/A04 prompts, and the feedback of CA01–CA03
  { id: 's-ball-under-chair', kind: 'sentence', text: 'The ball is under the chair.', items: ['A03'] },
  { id: 's-two-cats-sleeping', kind: 'sentence', text: 'Two cats are sleeping.', items: ['A04'] },
  { id: 's-cat-on-bed', kind: 'sentence', text: 'The cat is on the bed.', items: ['CA01'] },
  { id: 's-box-open', kind: 'sentence', text: 'The box is open.', items: ['CA02'] },
  { id: 's-window-not-open', kind: 'sentence', text: 'The window is not open. It is closed.', items: ['CA03'] },
  // A05
  { id: 'd-a05', kind: 'dialogue', items: ['A05'], lines: [
    ['Mia', 'Shall we draw outside? I have paper and pencils in my bag.'],
    ['Ben', 'Look at those clouds. It is starting to rain, and the paper will get wet out here.'],
    ['Mia', 'There is a table under that roof. We can sit there.'],
    ['Ben', "Good idea. Let's take our things over."],
  ] },
  { id: 'q-a05', kind: 'sentence', text: 'Why do they choose the table?', items: ['A05'] },
  { id: 'o-a05-1', kind: 'sentence', text: 'To eat lunch.', items: ['A05'] },
  { id: 'o-a05-2', kind: 'sentence', text: 'To keep the paper dry.', items: ['A05'] },
  { id: 'o-a05-3', kind: 'sentence', text: 'To watch the rain.', items: ['A05'] },
  { id: 'f-a05', kind: 'sentence', text: 'To keep the paper dry. It is raining, so they choose a table under a roof.', items: ['A05'] },
  // A06
  { id: 'd-a06', kind: 'dialogue', items: ['A06'], lines: [
    ['Leo', 'We are nearly at the library. Have you got the book we need to take back?'],
    ['Kim', 'I thought you had it. I only put my coat in this bag.'],
    ['Leo', 'Oh, I left the book on the kitchen table.'],
    ['Kim', "Let's go back and get it. We still have time."],
  ] },
  { id: 'q-a06', kind: 'sentence', text: 'Why do they go back?', items: ['A06'] },
  { id: 'o-a06-1', kind: 'sentence', text: 'To get a book.', items: ['A06'] },
  { id: 'o-a06-2', kind: 'sentence', text: 'To find a coat.', items: ['A06'] },
  { id: 'o-a06-3', kind: 'sentence', text: 'To close a window.', items: ['A06'] },
  { id: 'f-a06', kind: 'sentence', text: 'To get a book. Leo left it on the kitchen table.', items: ['A06'] },
  // instructions, heard in the listening area (A has no written text) and in the worked example
  { id: 'i-listen-picture', kind: 'instruction', text: 'Listen and choose the picture.', items: ['A01', 'A02', 'A03', 'A04'] },
  { id: 'i-listen-answer', kind: 'instruction', text: 'Listen to the children. Then choose the answer.', items: ['A05', 'A06'] },
  { id: 'i-look', kind: 'instruction', text: 'Look and listen.', items: ['example'] },
  { id: 'i-your-turn', kind: 'instruction', text: 'Now you try.', items: ['example'] },
]

// The Cambridge Young Learners wordlist (src/lib/literacy/yleWordlist.generated.js) as single-word clips,
// kept apart from the trial set: `build.mjs --set words`. One clip per spelling, merged across meanings
// ("at" / "at-2"); "child/children" gives both forms. A word the list pairs with its other-variety
// equivalent is made only for its own variety: "candy" (UK "sweets") US only, "autumn" (US "fall") UK only;
// "fall" is also a verb in the list, so it gets both. Left out, and listed by `wordSkips` for a person:
// patterns ("as … as"), entries still holding "/" or "(", and words whose sound depends on the meaning
// (close, live, read, use, wind) — said alone, the model picks one at random.
import { YLE_WORDLIST } from '../../src/lib/literacy/yleWordlist.generated.js'

const SOUND_BY_MEANING = new Set(['close', 'live', 'read', 'use', 'wind', 'tear', 'lead', 'record', 'bow', 'row'])
const slug = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/’/g, "'").replace(/[^a-z0-9']+/g, '-').replace(/'/g, '').replace(/^-|-$/g, '')

export const wordSkips = []
const byText = new Map()
for (const e of YLE_WORDLIST) {
  const own = e.uk ? ['us'] : e.us ? ['uk'] : ['uk', 'us']
  for (const raw of e.forms?.length ? e.forms : [e.word]) {
    const text = raw.trim()
    if (/[…/()]/.test(text)) { wordSkips.push({ text, why: 'pattern or alternatives' }); continue }
    if (SOUND_BY_MEANING.has(text.toLowerCase())) { wordSkips.push({ text, why: 'sound depends on the meaning' }); continue }
    const key = text.toLowerCase()      // "May" and "may" sound the same: one clip, the lower-case spelling
    const c = byText.get(key) || { id: `yw-${slug(text)}`, kind: text.includes(' ') ? 'phrase' : 'word', text, items: [], levels: new Set(), varieties: new Set() }
    if (text === key) c.text = text
    c.items.push(e.id); c.levels.add(e.level); own.forEach(v => c.varieties.add(v))
    byText.set(key, c)
  }
}
export const WORD_CLIPS = [...byText.values()].map(c => ({ ...c, levels: [...c.levels], varieties: ['uk', 'us'].filter(v => c.varieties.has(v)) }))
{
  const seen = new Map()
  for (const c of WORD_CLIPS) {
    if (seen.has(c.id)) throw new Error(`two words share the clip id ${c.id}: "${seen.get(c.id)}" and "${c.text}"`)
    seen.set(c.id, c.text)
  }
}

// The listening bank (src/lib/literacy/listeningBank.js), A4 and A5: `build.mjs --set listening`. Per item the
// talk (A5: one clip per line, joined; A4: the narrator), the question, the three options and the feedback.
// A4 has its own instruction: "Listen to the children" does not fit a narrator.
export const LISTENING_CLIPS = [
  { id: 'i-listen-choose', kind: 'instruction', text: 'Listen. Then choose the answer.', items: ['A4'] },
  ...LISTENING.flatMap(it => [
    it.lines.length === 1 && it.lines[0][0] === NARRATOR
      ? { id: listenClip.talk(it.id), kind: 'sentence', text: it.lines[0][1], items: [it.id] }
      : { id: listenClip.talk(it.id), kind: 'dialogue', lines: it.lines, items: [it.id] },
    { id: listenClip.question(it.id), kind: 'sentence', text: it.question, items: [it.id] },
    ...it.options.map((o, i) => ({ id: listenClip.option(it.id, i), kind: 'sentence', text: o, items: [it.id] })),
    { id: listenClip.feedback(it.id), kind: 'sentence', text: it.feedback, items: [it.id] },
  ]),
]
