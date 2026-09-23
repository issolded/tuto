// Runs the maths template engine against itself, without a browser. `npm run math:check`.
//
// The same position scripts/english-audit.mjs and scripts/puzzle-audit.mjs hold for their
// engines. This one is late: the maths templates ran for months with no program checking
// them, and three separate defects lived in main because of it —
//
//   * a ten-year-old was handed `2 × 2`, because a level threshold cut a school year's band
//     in half and nothing compared what came out against the year it came from
//   * Year 1, whose curriculum line says "a half and a quarter", was asked for thirds
//   * numbers over five digits printed as unbroken walls, a finding that was written down in
//     an August audit and found again in September
//
// Every one of them is a property a program can state. That is what this file is.
//
// What it checks, and why each one is here rather than trusted:
//
//   1. the answer is among the options        a choice question whose answer is not on screen
//                                             is unanswerable; the reverse — two options
//                                             carrying the same text — makes two of them right
//   2. nothing renders as undefined/NaN       the loudest failure and the easiest to ship: a
//                                             word bank indexed the wrong way printed
//                                             "to the nearest undefined" and still returned a
//                                             correct answer, so only the text showed it
//   3. hints never state the answer           hint_steps stop at method by contract. A hint
//                                             that hands over the answer turns help into a
//                                             button that says the answer
//   4. questions fit the age's reading limit  maxQuestionChars is enforced at generation by a
//                                             reroll, so a template whose EVERY wording is too
//                                             long fails silently, thirty rerolls at a time
//   5. no language leaks                      a template that forgot say() prints English
//                                             inside a Turkish session
//   6. a sitting does not repeat itself       ten questions, ten different questions
//   7. every year can fill a whole sitting    the check that would have caught Year 6 having
//                                             no templates at all
//
// Non-zero exit on any failure, so it can gate a commit.

import { generateProblem, TOPICS, num } from '../src/lib/mathTemplates.js'
import { templateTopicFor, startingLevelForAge, clampLevelToAge } from '../src/lib/mathCurriculum.js'
import { BRITISH_CURRICULUM, ageToSchoolYear, maxQuestionChars } from '../src/lib/gemini.js'

const LANGS = ['en', 'tr', 'es']
const AGES = [5, 6, 7, 8, 9, 10, 11, 12, 13]
const PER = Number(process.env.MATH_AUDIT_N || 400)
const LEAK_FLOOR = 20

const findings = []
function fail(where, msg, sample) {
  findings.push({ where, msg, sample })
}

// ── 5. language leak ─────────────────────────────────────────────────────────
// Words that only ever belong to one language, checked with a Unicode-aware boundary.
// JavaScript's \b is ASCII-only, so \bÇocuk\b never matches — the first version of this idea
// in the i18n checker missed every Turkish word it was written to catch.
// Two leak tests, because one of them is not enough and it is worth saying why.
//
// The word lists are the real test. They carry the closed maths vocabulary each language
// uses — the shape names, the question words — so a Spanish entry filled in with the Turkish
// word is caught by name. That is not hypothetical: `es: 'sekizgen'` shipped in the polygon
// table and sat there until the output was read by eye.
//
// The letter test is the backstop for words no list will ever hold. It is weaker than it
// looks and the limit is worth writing down: "sekizgen", "üçgen", "dörtgen" and "kaç" are
// all invisible to it, because a letter class can only see letters that differ. It catches
// ğ ş ı İ anywhere outside Turkish, and ç ö outside Turkish — but NOT ü, which Spanish has
// of its own (pingüino), and not the bare Latin letters that most Turkish words are made of.
const TR_ONLY = /[ğĞşŞıİ]/u
const NOT_SPANISH = /[çÇöÖ]/u

// Words that belong to exactly one language. Question words and, above all, the shape names,
// which are the table that has already been mistranslated once.
const TR_WORDS = /(kaç|tane|sayı|kadar|şeklin|yuvarla|hangi|toplam|üçgen|dörtgen|beşgen|altıgen|sekizgen|kenar|köşe|açı|derece|oran|kesir)/iu
const ES_WORDS = /(cuántos|cuántas|figura|redondea|cuál|triángulo|cuadrilátero|pentágono|hexágono|octágono|ángulo|grados|razón)/iu
const EN_WORDS = /\b(how many|what is|round|which|altogether|nearest|triangle|quadrilateral|pentagon|hexagon|octagon|angle|degrees|ratio)\b/iu

const LEAK = {
  en: [TR_WORDS, ES_WORDS, TR_ONLY, NOT_SPANISH],
  tr: [ES_WORDS, EN_WORDS],
  es: [TR_WORDS, EN_WORDS, TR_ONLY, NOT_SPANISH],
}

function textOf(p) {
  const opts = (p.options || []).map(o => `${o.value} ${o.why}`).join(' ')
  return `${p.question_text} ${(p.hint_steps || []).join(' ')} ${opts}`
}

// "The hint hands over the answer". Two narrowings were needed before this said anything
// useful, and both are worth keeping written down:
//
//   * numbers compare as NUMBERS. A substring test reported "659 - 600 = ?" for leaking its
//     answer 59, because "59" sits inside "659": 37 findings, none of them real.
//   * merely CONTAINING the answer is not leaking it. A mental-subtraction hint splits 42 into
//     "40 + 2", and when the answer is 40 that is a coincidence, not a giveaway — the hint is
//     decomposing the number being taken away, not computing the result.
//
// So the test is where the number sits: a hint leaks when it writes the answer as a RESULT —
// straight after an "=", or as the last number of the last step, which is where a
// counting-on ladder ends up if it runs one rung too far. That last one is how "count 5, 6,
// 7… 12" used to finish on the answer it was supposed to be walking towards.
//
// The floor is measured, not guessed. Below it the answer keeps colliding with a number the
// method has to name anyway — a pictogram whose key is "each book stands for 5" and whose
// answer is 5, a clock hint that says 12 about a question whose answer is 12. Sweeping the
// whole engine at four settings: floor 0 gives 120 findings, 5 gives 34, 10 gives 17, 20
// gives none, and every finding below 20 that I read was one of those collisions. So 20 is
// where the signal starts. The cost is stated plainly: this check is blind to a leak whose
// answer is under 20, which is most of Year 1.
function hintLeaksAnswer(p) {
  const a = Number(p.correct_answer)
  if (!Number.isFinite(a) || Math.abs(a) < LEAK_FLOOR) return false
  const steps = (p.hint_steps || []).map(h => String(h).replace(/(\d)[,.](?=\d{3}(?!\d))/g, '$1'))
  const asResult = steps.some(h => (h.match(/=\s*(\d+(?:\.\d+)?)/g) || [])
    .some(t => Number(t.replace(/^=\s*/, '')) === a))
  const last = steps[steps.length - 1] || ''
  const nums = last.match(/\d+(?:\.\d+)?/g) || []
  // …and only when the last step is the FIRST place the number appears. A mental-subtraction
  // hint splits 8200 into "8000 + 200" in step one and finishes "now take away the 200" in
  // step two; when the answer happens to be 200 the closing number is the part it named at
  // the start, not a result it worked out. A counting ladder that runs one rung too far, or a
  // hint that ends "…, written 0.25", names the answer for the first time at the end.
  const earlier = steps.slice(0, -1).join(' ')
  const seenEarlier = (earlier.match(/\d+(?:\.\d+)?/g) || []).some(t => Number(t) === a)
  const endsOnIt = nums.length > 0 && Number(nums[nums.length - 1]) === a && !seenEarlier
  return asResult || endsOnIt
}

console.log(`Matematik şablon denetimi — ${AGES.length} yaş × ${LANGS.length} dil × ${PER} soru/konu\n`)

// ── per age, per language ────────────────────────────────────────────────────
const coverage = {}
for (const age of AGES) {
  const year = ageToSchoolYear(age)
  const topics = BRITISH_CURRICULUM[year].topics
  const level = clampLevelToAge(startingLevelForAge(age), age)
  const cap = maxQuestionChars(age)
  const withTemplate = topics.filter(t => templateTopicFor(t))
  coverage[year] = { age, total: topics.length, templated: withTemplate.length,
                     missing: topics.filter(t => !templateTopicFor(t)).map(t => t.name) }

  for (const lang of LANGS) {
    for (const t of withTemplate) {
      const tt = templateTopicFor(t)
      const where = `${year}/${t.id}/${tt}/${lang}`
      for (let i = 0; i < PER; i++) {
        let p
        try { p = generateProblem(tt, level, null, lang, { maxChars: cap }) }
        catch (e) { fail(where, `üretim hatası: ${e.message}`); break }

        const all = textOf(p)
        // 2. undefined / NaN anywhere a child can read
        if (/undefined|NaN|\[object/.test(all)) fail(where, 'metinde undefined/NaN', p.question_text)
        // 1. options well-formed
        if (p.format === 'choice') {
          const vals = (p.options || []).map(o => String(o.value))
          if (vals.length < 3) fail(where, `şık sayısı ${vals.length}`, p.question_text)
          if (new Set(vals).size !== vals.length) fail(where, 'çakışan şık', `${p.question_text} ${JSON.stringify(vals)}`)
          if (!vals.includes(String(p.correct_answer))) fail(where, 'cevap şıklarda yok', p.question_text)
          if ((p.options || []).some(o => !o.why)) fail(where, 'gerekçesiz şık', p.question_text)
        } else if (p.correct_answer === '' || p.correct_answer == null || Number.isNaN(Number(p.correct_answer))) {
          fail(where, `yazılamaz cevap: ${JSON.stringify(p.correct_answer)}`, p.question_text)
        } else if (p.format !== 'decimal' && !Number.isInteger(Number(p.correct_answer))) {
          // The keypad only shows its decimal point for format 'decimal'; a non-integer answer
          // anywhere else is a question the child cannot type.
          fail(where, `tam sayı olmayan cevap ama format '${p.format}'`, `${p.question_text} → ${p.correct_answer}`)
        } else if (p.format === 'decimal' && Number.isInteger(Number(p.correct_answer))) {
          // The mirror of the rule above, and the one that was missing: 'decimal' opens the
          // keypad's point, so declaring it for a whole-number answer offers a key the child
          // cannot use and can mistype into.
          fail(where, `tam sayı cevap ama format 'decimal'`, `${p.question_text} → ${p.correct_answer}`)
        } else if (Number(p.correct_answer) < 0) {
          // There is no minus key.
          fail(where, 'negatif cevap, tuş takımında eksi yok', p.question_text)
        }
        // 3. hint must not hand over the answer
        if (hintLeaksAnswer(p)) fail(where, 'ipucu cevabı söylüyor', `${p.question_text} → ${p.correct_answer}`)
        // 4. reading limit
        if (String(p.question_text).length > cap) {
          fail(where, `okuma sınırı aşıldı (${p.question_text.length} > ${cap})`, p.question_text)
        }
        // 5. language leak
        if (LEAK[lang].some(re => re.test(all))) fail(where, 'dil sızıntısı', p.question_text)
        // hint_steps present at all
        if (!Array.isArray(p.hint_steps) || !p.hint_steps.length) fail(where, 'ipucu yok', p.question_text)
      }
    }
  }
}

// ── 6. a sitting does not repeat itself ──────────────────────────────────────
for (const age of AGES) {
  const year = ageToSchoolYear(age)
  const level = clampLevelToAge(startingLevelForAge(age), age)
  const cap = maxQuestionChars(age)
  const tts = BRITISH_CURRICULUM[year].topics.map(t => templateTopicFor(t)).filter(Boolean)
  if (!tts.length) continue
  for (let s = 0; s < 60; s++) {
    const keys = new Set(), texts = new Set()
    for (let q = 0; q < 10; q++) {
      const tt = tts[q % tts.length]
      const p = generateProblem(tt, level, keys, 'tr', { maxChars: cap, avoidText: texts })
      if (texts.has(p.question_text)) fail(`${year}/oturum`, 'aynı cümle iki kez', p.question_text)
      keys.add(p.operandKey); texts.add(p.question_text)
    }
  }
}

// ── 8. does the template match the topic it was given? ───────────────────────
// A curriculum topic maps to exactly one template and the template has no idea which topic it
// is filling, so a wrong mapping is invisible at every other level: the question is correct,
// the answer is correct, and the LABEL the parent reads is about something else. The audit's
// first finding was that mismatch, and it happened again a day later — y5_statistics was
// pointed at the averages template although Year 5's line is line graphs and tables and the
// mean does not arrive until Year 6.
//
// The test is coarse on purpose: at least one word the template is about has to appear in the
// topic's own name or description. Exemptions are listed with a reason, never silently.
const TEMPLATE_WORDS = {
  'place-value': ['round', 'place value', 'negative', 'order', 'compare'],
  'fraction-of-number': ['fraction', 'decimal', 'percent'],
  geometry: ['angle', 'area', 'perimeter', 'shape', '2d', '3d', 'side'],
  averages: ['mean', 'median', 'mode', 'range', 'average', 'probability'],
  ratio: ['ratio', 'proportion', 'scale', 'speed'],
  algebra: ['algebra', 'formula', 'equation', 'unknown'],
  sequence: ['sequence', 'function', 'term'],
  'number-properties': ['factor', 'multiple', 'prime', 'square', 'cube', 'root'],
  'long-mult-div': ['multipl', 'divi'],
  'multiplication-word': ['multipl'],
  'division-word': ['divi'],
  addition: ['add'],
  subtraction: ['subtract'],
  counting: ['count', 'place value', 'number'],
  time: ['time', 'clock'],
  pictogram: ['chart', 'pictogram', 'bar', 'graph', 'table', 'data'],
  'decimals-percentages': ['decimal', 'percent'],
  money: ['money', 'pound', 'pence', 'coin', 'change', 'value'],
  'area-grid': ['area', 'perimeter', 'square', 'rectilinear'],
  chart: ['chart', 'graph', 'data', 'table', 'comparison'],
  measurement: ['length', 'mass', 'capacity', 'volume', 'measure', 'perimeter', 'money', 'time'],
}
// Topic ids whose wording cannot contain the word, with the reason spelled out.
const MATCH_EXEMPT = {
  y1_fractions: 'named "Half and Quarter"; halves and quarters are fractions, the word is not used',
}
for (const year of Object.keys(BRITISH_CURRICULUM)) {
  for (const t of BRITISH_CURRICULUM[year].topics) {
    const tt = templateTopicFor(t)
    if (!tt || MATCH_EXEMPT[t.id]) continue
    const words = TEMPLATE_WORDS[tt]
    if (!words) { fail(`${year}/eşleme`, `'${tt}' şablonu için anahtar kelime tanımlı değil`); continue }
    const text = `${t.name} ${t.description}`.toLowerCase()
    if (!words.some(w => text.includes(w))) {
      fail(`${year}/eşleme`, `konu '${t.name}' → '${tt}' şablonu; konunun tarifinde şablonun hiçbir konusu geçmiyor`, t.description)
    }
  }
}

// ── 7. coverage ──────────────────────────────────────────────────────────────
console.log('Şablon kapsamı:')
let templated = 0, total = 0
for (const [year, c] of Object.entries(coverage)) {
  templated += c.templated; total += c.total
  const bar = c.templated === c.total ? '✓' : ' '
  console.log(`  ${bar} ${year.padEnd(6)} ${String(c.templated).padStart(2)}/${c.total}` +
    (c.missing.length ? `   eksik: ${c.missing.join(', ')}` : ''))
}
console.log(`  ── toplam ${templated}/${total} (%${Math.round(templated / total * 100)})\n`)

// ── report ───────────────────────────────────────────────────────────────────
if (!findings.length) {
  console.log('Bulgu yok.')
  process.exit(0)
}
const grouped = new Map()
for (const f of findings) {
  const k = `${f.where} :: ${f.msg}`
  if (!grouped.has(k)) grouped.set(k, { n: 0, sample: f.sample })
  grouped.get(k).n++
}
console.log(`${findings.length} bulgu, ${grouped.size} farklı:\n`)
for (const [k, v] of [...grouped].sort((a, b) => b[1].n - a[1].n)) {
  console.log(`  ×${String(v.n).padStart(4)}  ${k}`)
  if (v.sample) console.log(`          ${v.sample}`)
}
process.exit(1)
