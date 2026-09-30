// Quality checks on the worked-step help (`help.kind === 'steps'`) of every math template, ages 5-14,
// all three languages. The answer-and-arithmetic checks live in math-audit.mjs; this file is about
// what the CHILD sees and can do with a chain:
//
//   · a step the keypad cannot type (negative, more than 7 characters, more than 3 decimals)
//   · a sentence that says the answer it is about to ask for
//   · English left in a Turkish or Spanish sentence
//   · a chain on the wrong kind of question (a typed chain on a multiple-choice card and back)
//   · the same line twice in a row, an empty line, a chain too long to finish
//
// HELP_AUDIT_N=500 npm run math:help   (per topic, per language)
import { generateProblem } from '../src/lib/mathTemplates.js'
import { templateTopicFor, startingLevelForAge, clampLevelToAge } from '../src/lib/mathCurriculum.js'
import { BRITISH_CURRICULUM, ageToSchoolYear } from '../src/lib/gemini.js'

const N = Number(process.env.HELP_AUDIT_N || 400)
const AGES = (process.env.HELP_AUDIT_AGES || '5,6,7,8,9,10,11,12,13,14').split(',').map(Number)
const LANGS = ['en', 'tr', 'es']
const found = new Map()
const seenSteps = new Map() // topic → number of chains inspected
let inspected = 0

const fail = (where, what, sample) => {
  const key = `${where} :: ${what}`
  const e = found.get(key) || { n: 0, sample }
  e.n++
  found.set(key, e)
}

// Words that only English uses. Short, unambiguous, and chosen not to collide with Turkish or
// Spanish ("add", "number" and "first" are not words in either).
const ENGLISH = /\b(the|and|then|now|first|next|add|number|which|each|take|away|because|write|parts?|divide by|equal|together|answer)\b/i

const numberWord = (v, lang) => {
  // Every way the child could read this number in this language, without a thousands mark
  // confusing it with a decimal one.
  const s = String(v)
  const out = new Set([s])
  if (Number.isFinite(Number(v))) {
    const n = Number(v)
    out.add(n.toLocaleString(lang === 'en' ? 'en-GB' : lang === 'tr' ? 'tr-TR' : 'es-ES', { maximumFractionDigits: 6 }))
    if (!Number.isInteger(n)) out.add(s.replace('.', ','))
  }
  return [...out]
}

const standalone = (text, v, lang) =>
  numberWord(v, lang).some(w => {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?<![\\d.,])${esc}(?![\\d]|[.,]\\d)`).test(text)
  })

for (const age of AGES) {
  const year = ageToSchoolYear(age)
  const level = clampLevelToAge(startingLevelForAge(age), age)
  for (const lang of LANGS) {
    for (const t of BRITISH_CURRICULUM[year].topics) {
      const tt = templateTopicFor(t)
      if (!tt) continue
      for (let i = 0; i < N; i++) {
        let p
        try { p = generateProblem(tt, level, null, lang) } catch (e) { fail(`${age}/${tt}/${lang}`, `generation threw: ${e.message}`); break }
        const h = p.help
        if (!h || h.kind !== 'steps') continue
        inspected++
        seenSteps.set(`${age}/${tt}`, (seenSteps.get(`${age}/${tt}`) || 0) + 1)
        const where = `${age}/${tt}/${lang}`
        const steps = h.steps || []
        const choice = p.format === 'choice'

        if (choice && !h.pick) fail(where, 'chain on a multiple-choice card is not marked pick', p.question_text)
        if (!choice && h.pick) fail(where, 'pick chain on a typed question', p.question_text)
        if (!steps.length) { fail(where, 'empty chain', p.question_text); continue }
        if (steps.length > 9) fail(where, `chain of ${steps.length} steps is too long to finish`, p.question_text)

        const textOf = `${p.question_text} ${JSON.stringify(p.visual ?? {})} ${JSON.stringify(h.picture ?? {})}`
        const answer = p.correct_answer

        steps.forEach((st, k) => {
          const last = k === steps.length - 1
          const a = st.a
          if (!Number.isFinite(a)) { fail(where, 'step answer is not a number', `${st.q}`); return }
          if (a < 0) fail(where, 'step answer is negative (the keypad has no minus)', `${st.q} = ${a}`)
          const typed = String(a).replace('.', '')
          if (String(a).length > 7) fail(where, `step answer longer than 7 characters`, `${st.q} = ${a}`)
          const dec = String(a).split('.')[1]
          if (dec && dec.length > 3) fail(where, 'step answer has more than 3 decimals', `${st.q} = ${a}`)
          if (!st.say || st.say.trim().length < 6) fail(where, 'step has no sentence', `${st.q}`)
          if (st.say && st.say.length > 260) fail(where, 'step sentence is over 260 characters', st.say.slice(0, 80))
          if (/undefined|NaN|\$\{|\[object/.test(`${st.q} ${st.say}`)) fail(where, 'unresolved placeholder', `${st.q} | ${st.say}`)
          if (k && steps[k - 1].q === st.q && steps[k - 1].a === st.a && steps[k - 1].say === st.say) fail(where, 'same line twice in a row', `${st.q}`)
          if (lang !== 'en' && ENGLISH.test(`${st.say} ${st.q}`)) fail(where, 'English in a Turkish/Spanish step', `${st.q} | ${st.say}`.slice(0, 140))

          // A sentence shown BEFORE a line is typed must not hand over that line's own answer, nor
          // (on the last line) the question's answer. Small numbers are everywhere in a sentence,
          // and numbers the question or its picture already print are not a give-away.
          // "Split 92 into 80 and 12" and "5% is half of 10%" carry numbers as parts and labels; one of
          // them landing on an answer is a coincidence of the numbers, not the sentence giving it away.
          const sentence = String(st.say ?? '').replace(/\d+\s?%|%\s?\d+/g, '').replace(/[^.:]*\b(split|separa|ayır|parçala|break)\b[^.:]*[.:]/gi, '').replace(/(sobran|left over)\s+\d+/gi, '').replace(/\d+ (tane|are|son|sobran)[^.:]*(artıyor|left over|sobran)[^.:]*[.:]?/gi, '')
          const big = Math.abs(a) >= 10 || !Number.isInteger(a)
          const inQuestion = standalone(textOf, a, lang)
          const inQ = standalone(String(st.q), a, lang)
          if (st.say && big && !inQuestion && !inQ && standalone(sentence, a, lang)) fail(where, 'sentence states the answer of its own line', `${st.q} = ${a} | ${st.say}`.slice(0, 160))
          if (st.say && !choice && Number.isFinite(Number(answer)) && Math.abs(Number(answer)) >= 10 && !standalone(textOf, answer, lang) && !standalone(String(st.q), answer, lang) && standalone(sentence, answer, lang) && a !== Number(answer)) {
            fail(where, "sentence states the question's answer early", `${st.q} | ${st.say}`.slice(0, 160))
          }
          // A chain that tries each card in turn names every option, the right one included, by design.
          const tries = String(st.q) === String(answer)
          if (st.say && choice && !tries && !standalone(textOf, answer, lang) && String(answer).length > 1 && standalone(st.say, answer, lang)) {
            fail(where, "sentence names the correct option", `${st.q} | ${st.say}`.slice(0, 160))
          }
        })
      }
    }
  }
}

console.log(`Yardım zinciri kalite denetimi — ${AGES.join(',')} yaş × 3 dil × ${N} soru/konu`)
console.log(`  incelenen zincir: ${inspected}`)
if (!found.size) { console.log('\nBulgu yok.'); process.exit(0) }
console.log(`\n${found.size} farklı bulgu:\n`)
const rows = [...found.entries()].sort((a, b) => b[1].n - a[1].n)
for (const [k, e] of rows.slice(0, 60)) console.log(`  ×${String(e.n).padStart(4)}  ${k}\n          ${String(e.sample).slice(0, 170)}`)
process.exit(1)
