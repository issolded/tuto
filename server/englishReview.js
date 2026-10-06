import { say } from './lang.js'
import { reviewCandidates, REVIEW_MAX } from './mathReview.js'
import { asReviewAttempt } from './englishPlay.js'

// The review round after an English sitting: fresh questions of the KINDS the child missed or
// needed help with. The picking, the shares and the carry-over are mathReview.js's, applied to
// English attempts (the kind of question plays the part of the maths topic); what is new here is
// that the server deals the questions (the engine's answers never reach the browser) and the
// parent's message, which is English's own.

// The skill names a parent reads, per language; keys are server/index.js's ENGLISH_SKILLS values.
const SKILL_NAMES = {
  'word meanings (same and opposite)': ['word meanings (same and opposite)', 'kelime anlamları (eş ve zıt)', 'significado de palabras (sinónimos y antónimos)'],
  'what a word means': ['what a word means', 'bir kelimenin anlamı', 'qué significa una palabra'],
  'word groups and analogies': ['word groups and analogies', 'kelime grupları ve benzetmeler', 'grupos de palabras y analogías'],
  'letter and code puzzles': ['letter and code puzzles', 'harf ve şifre bulmacaları', 'acertijos de letras y códigos'],
  'logic puzzles': ['logic puzzles', 'mantık bulmacaları', 'acertijos de lógica'],
  'sounds of words (rhymes, homophones, syllables)': ['sounds of words (rhymes, homophones, syllables)', 'kelimelerin sesleri (uyak, eş sesli, hece)', 'sonidos de las palabras (rimas, homófonas, sílabas)'],
  'grammar and word forms': ['grammar and word forms', 'dilbilgisi ve kelime biçimleri', 'gramática y formas de las palabras'],
  spelling: ['spelling', 'yazım', 'ortografía'],
  'apostrophes and short forms': ['apostrophes and short forms', 'kesme işareti ve kısaltmalar', 'apóstrofos y formas cortas'],
  sayings: ['sayings', 'atasözleri', 'refranes'],
}
export const skillName = (english, language) => {
  const n = SKILL_NAMES[english]
  return n ? say(language, n[0], n[1], n[2]) : english
}

// Up to REVIEW_MAX picks and the fresh questions for them, in the order of the original sitting.
// `attempts` are english_attempts rows, `sheet` the sitting's questions (so a fresh question is never
// one the child just saw), `skillOf` maps a type to its English skill name.
export function buildReview({ attempts, sheet, band, variety, generateItem, itemSignature, skillOf, seed, max = REVIEW_MAX }) {
  const picks = reviewCandidates((attempts || []).map(a => asReviewAttempt(a, skillOf(a.type))), max)
  const seen = new Set((sheet || []).map(itemSignature))
  const out = []
  picks.forEach((p, k) => {
    for (let i = 0; i < 80; i++) {
      const item = generateItem(band, p.topic_id, (seed + k * 7919 + i * 104729) | 0, { variety })
      if (!item) continue
      const sig = itemSignature(item)
      if (seen.has(sig)) continue
      seen.add(sig)
      out.push({ pick: p, item })
      break
    }
  })
  return { picks: out.map(o => o.pick), items: out.map(o => o.item) }
}

function skills(review, language) {
  // Several question kinds share one skill name ("letter and code puzzles"): each is named once.
  return [...new Set((review.topics || []).filter(Boolean).map(t => skillName(t.topic_name, language)))].slice(0, 3).join(', ')
}

// The parent's message about a sitting, built from facts the session carries, so it can be sent
// now or, when a review was offered, once the review is settled.
// `s`: { correct, total, gems, capped, daily_cap, unaided, helped, kind: 'rewarded' | 'capped' | null }
// `review`: null or { state: 'done' | 'declined' | 'expired', asked, correct, gems, started, topics: [{ topic_id, topic_name }] }
export function englishSessionNotice(name, s, language, review) {
  const helped = Number.isInteger(s.helped) && s.helped > 0 && Number.isInteger(s.unaided)
  const how = helped ? say(language,
    ` (${s.unaided} on their own, ${s.helped} with help)`, ` (yardımsız ${s.unaided}, yardımla ${s.helped})`, ` (${s.unaided} sin ayuda, ${s.helped} con ayuda)`) : ''
  const halfNote = helped ? say(language,
    ' Questions solved with help count half.', ' Yardımla çözülen sorular yarım gem sayılıyor.', ' Las preguntas resueltas con ayuda cuentan la mitad.') : ''
  const head = s.kind === 'capped'
    ? say(language,
      `${name} did another round of English — ${s.correct}/${s.total} correct${how}. That's past today's limit of ${s.daily_cap}, so it didn't add gems. 🌙`,
      `${name} bir tur İngilizce daha çözdü — ${s.correct}/${s.total} doğru${how}. Bugünkü sınırı (günde ${s.daily_cap}) geçtiği için gem eklenmedi. 🌙`,
      `${name} ha hecho otra ronda de inglés — ${s.correct}/${s.total} correctas${how}. Pasa del límite de hoy (${s.daily_cap}), así que no ha sumado gems. 🌙`)
    : say(language,
      `${name} did their English — ${s.correct}/${s.total} correct${how}. +${s.gems} ${s.gems === 1 ? 'gem' : 'gems'} 💎${halfNote}`,
      `${name} İngilizce sorularını çözdü — ${s.correct}/${s.total} doğru${how}. +${s.gems} gem 💎${halfNote}`,
      `${name} ha hecho su inglés — ${s.correct}/${s.total} correctas${how}. +${s.gems} ${s.gems === 1 ? 'gem' : 'gems'} 💎${halfNote}`)

  let tail = ''
  let tr = '', en = ''
  if (review) {
    const topics = skills(review, language)
    const owed = topics ? {
      en: ` I'll give ${topics} extra weight in the next English session.`,
      tr: ` Bir sonraki İngilizcede ${topics} konusuna ağırlık vereceğim.`,
      es: ` En la próxima sesión de inglés daré más peso a ${topics}.`,
    } : { en: '', tr: '', es: '' }
    const preguntas = `${review.asked} ${review.asked === 1 ? 'pregunta' : 'preguntas'}`
    if (review.state === 'done') {
      const g = review.gems > 0
      tail = say(language,
        `They then went back over ${review.asked} they'd found hard — ${review.correct}/${review.asked} right${g ? `, +${review.gems} ${review.gems === 1 ? 'gem' : 'gems'} 💎` : ''}.${owed.en}`,
        `Sonra zorlandığı ${review.asked} soruyu tekrar çözdü — ${review.correct}/${review.asked} doğru${g ? `, +${review.gems} gem 💎` : ''}.${owed.tr}`,
        `Después repasó ${preguntas} que se le habían atascado — ${review.correct}/${review.asked} bien${g ? `, +${review.gems} ${review.gems === 1 ? 'gem' : 'gems'} 💎` : ''}.${owed.es}`)
      en = `, then reviewed ${review.correct}/${review.asked}`; tr = `, sonra pekiştirdi ${review.correct}/${review.asked}`
    } else if (review.state === 'declined') {
      tail = say(language,
        `I offered a quick ${review.asked}-question review of what they missed and they'd rather not today.${owed.en}`,
        `Kaçırdığı ${review.asked} soruluk kısa bir pekiştirme önerdim, bugün istemedi.${owed.tr}`,
        `Le ofrecí un repaso corto de ${preguntas} de lo que falló y hoy prefirió no hacerlo.${owed.es}`)
      en = ', declined the review'; tr = ', pekiştirmeyi istemedi'
    } else {
      tail = review.started
        ? say(language,
          `They started the ${review.asked}-question review but didn't finish it.${owed.en}`,
          `${review.asked} soruluk pekiştirmeye başladı ama bitirmedi.${owed.tr}`,
          `Empezó el repaso de ${preguntas} pero no lo terminó.${owed.es}`)
        : say(language,
          `I offered a quick ${review.asked}-question review of what they missed; it wasn't picked up.${owed.en}`,
          `Kaçırdığı ${review.asked} soruluk kısa bir pekiştirme önerdim, yapılmadı.${owed.tr}`,
          `Le ofrecí un repaso corto de ${preguntas} de lo que falló; no se hizo.${owed.es}`)
      en = ', review not done'; tr = ', pekiştirme yapılmadı'
    }
  }
  const howShort = helped ? { tr: ` (yardımsız ${s.unaided}, yardımla ${s.helped})`, en: ` (${s.unaided} on their own, ${s.helped} with help)` } : { tr: '', en: '' }
  const detail = s.kind === 'capped'
    ? { tr: `İngilizce, ${s.correct}/${s.total} doğru${howShort.tr}, günlük sınır dolduğu için gem yok${tr}`,
      en: `English, ${s.correct}/${s.total} correct${howShort.en}, past the daily limit so no gems${en}` }
    : { tr: `İngilizce, ${s.correct}/${s.total} doğru${howShort.tr}, +${s.gems} gem${tr}`,
      en: `English, ${s.correct}/${s.total} correct${howShort.en}, +${s.gems} ${s.gems === 1 ? 'gem' : 'gems'}${en}` }
  return { text: [head, tail].filter(Boolean).join('\n\n'), notice: { kind: 'activity', child: name, detail } }
}

// A round the parent was told was not finished, that the child then finished.
export function englishReviewLateNotice(name, review, language) {
  const g = review.gems > 0
  const topics = skills(review, language)
  const text = say(language,
    `${name} went back and finished the English practice round after all — ${review.correct}/${review.asked} right${g ? `, +${review.gems} ${review.gems === 1 ? 'gem' : 'gems'} 💎` : ''}.${topics ? ` I'll still give ${topics} some weight next time.` : ''}`,
    `${name} İngilizce pekiştirmeye geri dönüp sonunda bitirdi — ${review.correct}/${review.asked} doğru${g ? `, +${review.gems} gem 💎` : ''}.${topics ? ` ${topics} konusuna yine de ağırlık vereceğim.` : ''}`,
    `${name} volvió y terminó el repaso de inglés al final — ${review.correct}/${review.asked} bien${g ? `, +${review.gems} ${review.gems === 1 ? 'gem' : 'gems'} 💎` : ''}.${topics ? ` Aun así daré más peso a ${topics}.` : ''}`)
  return { text, notice: { kind: 'activity', child: name, detail: {
    tr: `İngilizce pekiştirmeyi sonradan bitirdi, ${review.correct}/${review.asked} doğru${g ? `, +${review.gems} gem` : ''}`,
    en: `finished the English practice round afterwards, ${review.correct}/${review.asked} right${g ? `, +${review.gems} ${review.gems === 1 ? 'gem' : 'gems'}` : ''}`,
  } } }
}
