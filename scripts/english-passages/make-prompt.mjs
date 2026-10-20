// Write a self-contained prompt for an outside writer (a person or another model) that produces
// passages in the same JSON the checks read. Its output goes through check-file.mjs, the same
// gate and reviewers as our own writer.
//
//   node scripts/english-passages/make-prompt.mjs [level=E3] [count=6] > prompt.md
import { LEVELS, OPS, SAFETY } from './spec.mjs'
import { PREMISES } from './premises.mjs'
import { allowedWords, REGIONAL_WORDS } from './gate.mjs'
import { NAMES } from '../../src/lib/englishTables.js'

const [level = 'E3', countArg = '6'] = process.argv.slice(2)
const L = LEVELS[level]
const premises = PREMISES.filter(p => p.genre !== 'everyday').slice(0, Number(countArg))
console.log(`You are writing short reading passages for Tuto, a children's learning app. Readers are 7–11 years old;
some are native English speakers, many are learners. Write ${premises.length} passages, one per situation below.

## Each passage
- A real little story a good children's book could print: one situation, events that follow from each other,
  a small turn or surprise, an ending that closes it. Every sentence earns its place. Kind, clear, a little
  interesting, never preachy.
- ${L.words[0]}–${L.words[1]} words, ${L.sentences[0]}–${L.sentences[1]} sentences, no sentence over ${L.maxSentenceWords} words.
- Use ONLY words from the word list at the end (any normal form: plurals, -ed, -ing, irregular past). At most
  ${L.base ? L.contentAllowed : L.flyersAllowed} other words per passage, counting the title, the story and the questions together
  (keep/kept count as one word), and only if no listed word can do the job.
- Names: only ${NAMES.join(', ')}. Two per story.
- Reasons are sensible real-life reasons, said plainly with "because" or "so". Prefer reasons that belong to
  THIS story over what usually happens (not "the ice cream melted because it was hot").

## Questions (exactly ${L.ops.length} per passage, in this order)
${L.ops.map((o, i) => `${i + 1}. ${o}: ${OPS[o]}`).join('\n')}
- Exactly ${L.options} options each; exactly one is right according to the story.
- Write the right option in your own words, not copied from the story.
- The wrong options must be just as ordinary and sensible in real life as the right one, so someone who has
  NOT read the story cannot guess. The story must make them wrong by saying the true thing instead.
  Never let a wrong option also happen in the story, at any time.
- Options similar in length and style. Vary which letter is right.

## Never include
${Object.entries(SAFETY).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Avoid these words (they differ between UK and US English): ${[...REGIONAL_WORDS].join(', ')}.

## Situations (build your own story on each; do not copy the sentence)
${premises.map((p, i) => `${i + 1}. [${p.id}] (${p.genre}) ${p.premise}`).join('\n')}

## Answer format
Only JSON, an array, one object per passage:
[
  { "premise": "<the id in brackets above>", "title": "…", "passage": "…",
    "questions": [ { "op": "${L.ops[0]}", "stem": "…", "options": ["…", "…", "…"], "answer": <0, 1 or 2>,
      "evidence": "the exact words from the passage that prove the answer, copied without change" } ] }
]

## Word list
${allowedWords(level).join(' ')}
`)
