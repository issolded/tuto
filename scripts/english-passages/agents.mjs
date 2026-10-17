// The three model roles: a writer, two reviewers that never see the writer's reasoning, and a blind
// solver that never sees the answer key. Each reviewer returns a fixed rubric, yes/no per line with a
// quote, never a free "looks fine".
import { call, MODELS, WRITER_KEY } from './llm.mjs'
import { LEVELS, OPS, SAFETY } from './spec.mjs'
import { allowedWords, REGIONAL_WORDS } from './gate.mjs'

const rules = (level, names) => {
  const L = LEVELS[level]
  return `- ${L.words[0]}–${L.words[1]} words, ${L.sentences[0]}–${L.sentences[1]} sentences, no sentence longer than ${L.maxSentenceWords} words.
- Use ONLY words from the word list below (any normal form: plurals, -ed, -ing, irregular past). At most
  ${L.flyersAllowed} other very common words in total. Names: use only ${names.join(', ')}.
- Never include: ${Object.entries(SAFETY).map(([k, v]) => `${k} (${v})`).join('; ')}.
- Avoid these words, which differ between UK and US English: ${[...REGIONAL_WORDS].join(', ')}.

Word list: ${allowedWords(level).join(' ')}`
}

// Step 1: the questions come BEFORE the story, each with options that are all equally sensible in real
// life. Nobody decides yet which is true; the code does that by lot, and only then is the story written
// to make that option true. Common sense then cannot beat chance, by construction rather than by hope.
export async function plan({ level, premise, names, previous, redo }) {
  const L = LEVELS[level]
  const prompt = `You are planning (not yet writing) a short reading passage for a children's English reading app
(ages 7–11, native speakers and learners). Level ${level}: ${L.describe}.
Genre: ${premise.genre}. Situation to build on: "${premise.premise}"

Plan the questions first, in this order: ${L.ops.map((o, i) => `${i + 1}) ${o}: ${OPS[o]}`).join('; ')}.
Each question gets exactly ${L.options} short options. The story does not exist yet, and ANY of the
options could become the true one, so every option must be equally sensible and equally ordinary in real
life. A person who never reads the story must have no reason to prefer one. Bad: "Why did the ice cream
melt? It was hot / It was cold / It was blue". Good: "Why did Sam go back home? He forgot his hat /
He wanted to get his ball / His sister called him". Options similar in length and style.
Also write a two-sentence outline of the story the options fit.
${rules(level, names)}
${previous ? `\nYour previous plan:\n${JSON.stringify(previous)}\n\nA reader who has not seen any story always picked the same option in question(s) ${redo.map(r => `${r.q} ("${r.favourite}")`).join(', ')}, so those options are not equally ordinary. Replace the options of those questions (you may also change their stems); keep everything else.` : ''}
Answer JSON only:
{ "outline": "…", "questions": [ { "op": "…", "stem": "…", "options": ["…", "…", "…"] } ] }`
  return call(MODELS.generator, prompt, { temperature: 0.9, key: WRITER_KEY })
}

// Step 2: write the story so the drawn options are true and the others are shown false.
export async function write({ level, premise, names, planned, picks, previous, feedback }) {
  const qs = planned.questions.map((q, i) => `${i + 1}. [${q.op}] ${q.stem}\n` + q.options.map((o, j) => `   ${j === picks[i] ? 'TRUE ' : 'false'} ${o}`).join('\n')).join('\n')
  const prompt = `Write one short reading passage for a children's English reading app (ages 7–11, native speakers and
learners). Clear, natural, kind, a little interesting, never preachy. Level ${level}: ${LEVELS[level].describe}.
Genre: ${premise.genre}. Outline: ${planned.outline}

These questions are fixed. In your story the option marked TRUE must be true, and the text must make each
"false" option clearly not the case (the text gives the true thing in its place; it does not have to
mention the false ones). Never let a false option happen in the story at any time, not even earlier or
later (if "by the door" is false, nothing is ever by the door). For a "cause" question the reason must be said in the text with a clear word
like "because" or "so"; for "detail" one sentence must state it. Use different words from the TRUE option
where you naturally can, so a child cannot just match words. Keep the stems and options exactly as given
unless a problem list below asks you to change one; never change which option is TRUE.

${qs}
${rules(level, names)}
${previous ? `\nYour previous version:\n${JSON.stringify(previous)}\n\nFix ONLY these problems, keep the rest:\n${feedback}` : ''}
Answer JSON only:
{ "title": "…", "passage": "…", "questions": [ { "stem": "…", "options": ["…", "…", "…"],
  "evidence": "the exact words from your passage that prove the TRUE option (copied, not changed)" } ] }`
  const r = await call(MODELS.generator, prompt, { temperature: previous ? 0.4 : 0.8, key: WRITER_KEY })
  // The answer index is the lot, not the writer's say.
  r.questions = (r.questions || []).map((q, i) => ({ ...q, op: planned.questions[i]?.op, answer: picks[i] }))
  return r
}

const show = item => `TITLE: ${item.title}\n\nPASSAGE:\n${item.passage}\n\nQUESTIONS:\n` +
  item.questions.map((q, i) => `${i + 1}. ${q.stem}\n` + q.options.map((o, j) => `   ${'ABC'[j]}) ${o}`).join('\n')).join('\n')

export async function safetyReview(item, genre) {
  const prompt = `You check reading material for a children's app (ages 7–11, families of any culture and faith).
Read the title, passage, questions and options. For EVERY category below decide if the material
touches it, even lightly or by suggestion (a scene, a word, an implied event). When in doubt, flag it:
a person will look at every flag. Quote the exact words that made you flag.
${genre && genre !== 'information' ? 'This text is FICTION: "false-fact" does not apply to events in the story, only to statements about the real world (how animals, weather or things really are).' : ''}

Categories:
${Object.entries(SAFETY).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

${show(item)}

Answer JSON only:
{ "categories": { ${Object.keys(SAFETY).map(k => `"${k}": { "flag": true|false, "quote": "" }`).join(', ')} },
  "other_concern": "" }`
  try { return { ...(await call(MODELS.safety, prompt, { tries: 3 })), model: MODELS.safety } }
  catch { return { ...(await call(MODELS.safetyFallback, prompt)), model: MODELS.safetyFallback } }
}

export async function pedagogyReview(item, level) {
  const L = LEVELS[level]
  const prompt = `You are a primary-school reading specialist reviewing one test item for a children's English
reading app (ages 7–11). The level is ${level}: ${L.describe}. The answer key is given so you can check it.

${show(item)}

KEY: ${item.questions.map((q, i) => `${i + 1}=${'ABC'[q.answer]} (intended operation: ${q.op} = ${OPS[q.op]})`).join('; ')}

For each question answer strictly by the text, not by what usually happens in life:
- measures_op: does it really test the intended operation (a "why" whose reason is NOT stated in the text is inference, not "cause")?
- single_correct: is exactly one option right by the text, with the key on it?
- wrong_by_text: is every other option wrong according to the text? It is wrong if the text gives a
  different thing, reason or event in its place. It does NOT have to be mentioned and denied: if the text
  says the car was blue, "red" is wrong. Answer false only if the text leaves a wrong option possibly true.
- distractors_plausible: would a child who read carelessly be tempted by at least one wrong option?
- needs_text: could an adult who has NOT read the passage pick the key from common sense alone? (true = text needed)
- reason_makes_sense (cause questions; true for others): is the stated reason a sensible, real-life reason for
  that event, one a child would accept as "yes, that is why"? False if it is true only because the text says so
  (e.g. "the dog found the cat because he walked on the grass"; "she put the paper on the desk so it is clean").
For the passage:
- natural: natural, correct English a children's book could print.
- story_quality: would a good children's editor print it? It has a point, its events follow from each other,
  and the premise is visible. False for a list of loosely connected sentences.
- coherent: events make sense in order; nothing contradicts.
- level_ok: sentences and ideas fit the level.

Answer JSON only:
{ "questions": [ { "measures_op": bool, "single_correct": bool, "wrong_by_text": bool,
    "distractors_plausible": bool, "needs_text": bool, "reason_makes_sense": bool, "note": "" } ],
  "passage": { "natural": bool, "coherent": bool, "level_ok": bool, "story_quality": bool, "note": "" } }`
  return call(MODELS.pedagogy, prompt)
}

// Options are shuffled per run with a fixed seed so runs differ but a rerun repeats.
function shuffled(n, seed) {
  const a = [...Array(n).keys()]
  for (let i = n - 1; i > 0; i--) { seed = (seed * 9301 + 49297) % 233280; const j = Math.floor(seed / 233280 * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
export async function blindSolve(item, { withText, run }) {
  const orders = item.questions.map((q, i) => shuffled(q.options.length, 11 + run * 31 + i * 7))
  const qs = item.questions.map((q, i) => `${i + 1}. ${q.stem}\n` + orders[i].map((k, j) => `   ${'ABC'[j]}) ${q.options[k]}`).join('\n')).join('\n')
  const prompt = withText
    ? `Read the passage and answer each question with the letter of the best option.\n\n${item.title}\n${item.passage}\n\n${qs}\n\nAnswer JSON only: {"answers": ["A", …]}`
    : `You have NOT seen the story these questions come from. Still, for each question pick the option you
think is most likely right, using only common sense. You must pick one letter for each.\n\n${qs}\n\nAnswer JSON only: {"answers": ["A", …]}`
  const r = await call(MODELS.solver, prompt, { temperature: 0.7 })
  return item.questions.map((q, i) => {
    const letter = String(r.answers?.[i] || '').trim().toUpperCase()[0]
    const picked = orders[i]['ABC'.indexOf(letter)]
    return picked === q.answer
  })
}

// The no-text solver on a PLAN, before any story exists: which option does common sense pick, per
// question, in each run? A question whose pick is the same every run has a favourite.
export async function planFavourites(planned, runs = 3) {
  const fake = { questions: planned.questions.map(q => ({ ...q, answer: -1 })) }
  const picks = []
  for (let run = 0; run < runs; run++) picks.push(await solvePicks(fake, run + 40))
  return planned.questions.map((q, i) => {
    const mine = picks.map(p => p[i])
    return mine.every(x => x === mine[0] && x >= 0) ? mine[0] : null
  })
}
async function solvePicks(item, run) {
  const orders = item.questions.map((q, i) => shuffled(q.options.length, 11 + run * 31 + i * 7))
  const qs = item.questions.map((q, i) => `${i + 1}. ${q.stem}\n` + orders[i].map((k, j) => `   ${'ABC'[j]}) ${q.options[k]}`).join('\n')).join('\n')
  const r = await call(MODELS.solver, `You have NOT seen the story these questions come from. Still, for each question pick the option you
think is most likely right, using only common sense. You must pick one letter for each.\n\n${qs}\n\nAnswer JSON only: {"answers": ["A", …]}`, { temperature: 0.7 })
  return item.questions.map((q, i) => { const k = orders[i]['ABC'.indexOf(String(r.answers?.[i] || '').trim().toUpperCase()[0])]; return k ?? -1 })
}

// ── story first ───────────────────────────────────────────────────────────────────────────
// The plan-first route (questions, then a story to fit a drawn answer) beat common sense by
// construction but wrote collages: sentences that exist to host a question. Here the story comes
// first, written to be a good little story, and only the WRONG options are changed when a reader
// who has not seen it can guess the answer. The right answer stays what the story says.

export async function writeStory({ level, premise, names, previous, feedback }) {
  const L = LEVELS[level]
  const prompt = `Write one short reading passage and its questions for a children's English reading app (ages 7–11,
native speakers and learners). Level ${level}: ${L.describe}.

First the story. It must be a real little story a good children's book could print: one situation, events
that follow from each other, a small turn or surprise, and an ending that closes it. Every sentence earns
its place; no sentence is there only to give a question something to ask. Genre: ${premise.genre}.
Build on this situation (your own story; do not copy this sentence): "${premise.premise}"
Reasons in the story must be sensible real-life reasons, said plainly with "because" or "so" where a
"cause" question asks about them. Prefer reasons that belong to THIS story over what usually happens.

Then the questions, in this order: ${L.ops.map((o, i) => `${i + 1}) ${o}: ${OPS[o]}`).join('; ')}.
Exactly ${L.options} options each; exactly one is right by the story. Write the right option in your own
words (not copied from the story). The wrong options must be just as ordinary and sensible in real life
as the right one, so someone who has not read the story cannot guess; the story must make them wrong
(it gives the true thing instead). Never let a wrong option also happen in the story. Options similar in
length and style.
${rules(level, names)}
${previous ? `\nYour previous version:\n${JSON.stringify(previous)}\n\nFix ONLY these problems, keep the rest:\n${feedback}` : ''}
Answer JSON only:
{ "title": "…", "passage": "…", "questions": [ { "op": "…", "stem": "…", "options": ["…", "…", "…"], "answer": <index>,
  "evidence": "the exact words from the passage that prove the answer (copied, not changed)" } ] }`
  return call(MODELS.generator, prompt, { temperature: previous ? 0.4 : 0.9, key: WRITER_KEY })
}

// New wrong options for one question whose answer a reader can guess without the story. The right
// option is kept word for word; the code then puts it in a random place.
export async function newDistractors({ item, i, favourite, level, names }) {
  const q = item.questions[i]
  const prompt = `A reading question for children (7–11). The story:
${item.passage}

Question: ${q.stem}
Right answer (keep exactly): ${q.options[q.answer]}
Current wrong options: ${q.options.filter((_, j) => j !== q.answer).join(' / ')}

A reader who had NOT seen the story picked "${favourite}" every time, so the options give the answer
away. Write ${LEVELS[level].options - 1} new wrong options that are just as ordinary and likely in real life as the
right answer, similar in length and style, clearly NOT what happens in this story, and never something
that also happens in the story. Use only simple words from this list where you can: ${allowedWords(level).slice(0, 400).join(' ')}
Answer JSON only: { "wrong": ["…", "…"] }`
  const r = await call(MODELS.generator, prompt, { temperature: 0.9, key: WRITER_KEY })
  return (r.wrong || []).slice(0, LEVELS[level].options - 1)
}
