import { say } from './lang.js'
import { reviewCandidates, REVIEW_MAX } from './mathReview.js'
import { asReviewAttempt } from './englishPlay.js'

// The review round after a puzzle sitting, the English one's twin (englishReview.js): up to five fresh
// puzzles of the KIND the child missed or needed help with, dealt by the server. A kind is the puzzle type plus
// the attribute it is about ("sequence|dots"), because passing a shading puzzle proves nothing about a dots one.

const SKILL_NAMES = {
  'spotting the odd one out': ['spotting the odd one out', 'farklı olanı bulma', 'encontrar la que sobra'],
  'spotting the odd one out by a feature': ['spotting the odd one out by a feature', 'bir özelliğe göre farklı olanı bulma', 'encontrar la que sobra por una característica'],
  'finding the identical figure': ['finding the identical figure', 'aynı şekli bulma', 'encontrar la figura idéntica'],
  'what comes next (sequences)': ['what comes next (sequences)', 'sırada ne geliyor (örüntüler)', 'qué viene después (secuencias)'],
  'which one belongs with a group': ['which one belongs with a group', 'hangisi gruba ait', 'cuál pertenece al grupo'],
  'finding a shape inside a picture': ['finding a shape inside a picture', 'resmin içinde şekil bulma', 'encontrar una figura dentro de un dibujo'],
  'combining shapes': ['combining shapes', 'şekilleri birleştirme', 'combinar figuras'],
  'completing a pattern grid': ['completing a pattern grid', 'örüntü tablosunu tamamlama', 'completar una cuadrícula de patrones'],
  'analogies (A is to B as C is to ?)': ['analogies (A is to B as C is to ?)', 'benzetmeler (A, B ise C, ?)', 'analogías (A es a B como C es a ?)'],
  'mirror images': ['mirror images', 'ayna görüntüleri', 'imágenes en espejo'],
  'folding cube nets': ['folding cube nets', 'küp açınımlarını katlama', 'plegar desarrollos de cubos'],
  'lines of symmetry': ['lines of symmetry', 'simetri eksenleri', 'ejes de simetría'],
  'letter codes': ['letter codes', 'harf kodları', 'códigos de letras'],
}
export const puzzleSkillName = (english, language) => {
  const n = SKILL_NAMES[english]
  return n ? say(language, n[0], n[1], n[2]) : english
}

// `attempts` are puzzle_attempts rows (type, rule, ...), `sheet` the sitting's questions.
export function buildPuzzleReview({ attempts, sheet, band, icons, generateQuestion, questionSignature, skillOf, seed, max = REVIEW_MAX }) {
  const kindOf = (a) => `${a.type}|${a.rule ?? ''}`
  const picks = reviewCandidates((attempts || []).map(a => ({ ...asReviewAttempt(a, skillOf(a.type)), topic_id: kindOf(a) })), max)
  const seen = new Set((sheet || []).map(questionSignature))
  const out = []
  picks.forEach((p, k) => {
    const [type, attr] = p.topic_id.split('|')
    for (let i = 0; i < 80; i++) {
      const q = generateQuestion(band, type, (seed + k * 7919 + i * 104729) | 0, { icons })
      if (!q || String(q.rule?.attr ?? '') !== attr) continue
      const sig = questionSignature(q)
      if (seen.has(sig)) continue
      seen.add(sig)
      out.push({ pick: p, q })
      break
    }
  })
  return { picks: out.map(o => o.pick), items: out.map(o => o.q) }
}

const skills = (review, language) => [...new Set((review.topics || []).filter(Boolean).map(t => puzzleSkillName(t.topic_name, language)))].slice(0, 3).join(', ')

export function puzzleSessionNotice(name, s, language, review) {
  const helped = Number.isInteger(s.helped) && s.helped > 0 && Number.isInteger(s.unaided)
  const how = helped ? say(language, ` (${s.unaided} on their own, ${s.helped} with help)`, ` (yardımsız ${s.unaided}, yardımla ${s.helped})`, ` (${s.unaided} solos, ${s.helped} con ayuda)`) : ''
  const halfNote = helped ? say(language, ' Puzzles solved with help count half.', ' Yardımla çözülen bulmacalar yarım gem sayılıyor.', ' Los acertijos resueltos con ayuda cuentan la mitad.') : ''
  const head = s.kind === 'capped'
    ? say(language,
      `${name} did another round of puzzles — ${s.correct}/${s.total} correct${how}. That's past today's limit of ${s.daily_cap}, so it didn't add gems. 🌙`,
      `${name} bir tur bulmaca daha çözdü — ${s.correct}/${s.total} doğru${how}. Bugünkü sınırı (günde ${s.daily_cap}) geçtiği için gem eklenmedi. 🌙`,
      `${name} ha hecho otra ronda de acertijos — ${s.correct}/${s.total} correctos${how}. Pasa del límite de hoy (${s.daily_cap}), así que no ha sumado gems. 🌙`)
    : say(language,
      `${name} did their puzzles — ${s.correct}/${s.total} correct${how}. +${s.gems} gems 💎${halfNote}`,
      `${name} bulmacalarını çözdü — ${s.correct}/${s.total} doğru${how}. +${s.gems} gem 💎${halfNote}`,
      `${name} ha hecho sus acertijos — ${s.correct}/${s.total} correctos${how}. +${s.gems} gems 💎${halfNote}`)
  let tail = ''
  let tr = '', en = ''
  if (review) {
    const topics = skills(review, language)
    const owed = topics ? {
      en: ` I'll give ${topics} extra weight in the next puzzle session.`,
      tr: ` Bir sonraki bulmacada ${topics} konusuna ağırlık vereceğim.`,
      es: ` En la próxima sesión de acertijos daré más peso a ${topics}.`,
    } : { en: '', tr: '', es: '' }
    const q = `${review.asked} ${review.asked === 1 ? 'pregunta' : 'preguntas'}`
    if (review.state === 'done') {
      const g = review.gems > 0
      tail = say(language,
        `They then went back over ${review.asked} they'd found hard — ${review.correct}/${review.asked} right${g ? `, +${review.gems} gems 💎` : ''}.${owed.en}`,
        `Sonra zorlandığı ${review.asked} bulmacayı tekrar çözdü — ${review.correct}/${review.asked} doğru${g ? `, +${review.gems} gem 💎` : ''}.${owed.tr}`,
        `Después repasó ${q} que se le habían atascado — ${review.correct}/${review.asked} bien${g ? `, +${review.gems} gems 💎` : ''}.${owed.es}`)
      en = `, then reviewed ${review.correct}/${review.asked}`; tr = `, sonra pekiştirdi ${review.correct}/${review.asked}`
    } else if (review.state === 'declined') {
      tail = say(language,
        `I offered a quick ${review.asked}-puzzle review of what they missed and they'd rather not today.${owed.en}`,
        `Kaçırdığı ${review.asked} bulmacalık kısa bir pekiştirme önerdim, bugün istemedi.${owed.tr}`,
        `Le ofrecí un repaso corto de ${q} de lo que falló y hoy prefirió no hacerlo.${owed.es}`)
      en = ', declined the review'; tr = ', pekiştirmeyi istemedi'
    } else {
      tail = review.started
        ? say(language, `They started the ${review.asked}-puzzle review but didn't finish it.${owed.en}`, `${review.asked} bulmacalık pekiştirmeye başladı ama bitirmedi.${owed.tr}`, `Empezó el repaso de ${q} pero no lo terminó.${owed.es}`)
        : say(language, `I offered a quick ${review.asked}-puzzle review of what they missed; it wasn't picked up.${owed.en}`, `Kaçırdığı ${review.asked} bulmacalık kısa bir pekiştirme önerdim, yapılmadı.${owed.tr}`, `Le ofrecí un repaso corto de ${q} de lo que falló; no se hizo.${owed.es}`)
      en = ', review not done'; tr = ', pekiştirme yapılmadı'
    }
  }
  const howShort = helped ? { tr: ` (yardımsız ${s.unaided}, yardımla ${s.helped})`, en: ` (${s.unaided} on their own, ${s.helped} with help)` } : { tr: '', en: '' }
  const detail = s.kind === 'capped'
    ? { tr: `bulmaca, ${s.correct}/${s.total} doğru${howShort.tr}, günlük sınır dolduğu için gem yok${tr}`, en: `puzzles, ${s.correct}/${s.total} correct${howShort.en}, past the daily limit so no gems${en}` }
    : { tr: `şekil ve örüntü bulmacaları, ${s.correct}/${s.total} doğru${howShort.tr}, +${s.gems} gem${tr}`, en: `shape & pattern puzzles, ${s.correct}/${s.total} correct${howShort.en}, +${s.gems} gems${en}` }
  return { text: [head, tail].filter(Boolean).join('\n\n'), notice: { kind: 'activity', child: name, detail } }
}

export function puzzleReviewLateNotice(name, review, language) {
  const g = review.gems > 0
  const topics = skills(review, language)
  const text = say(language,
    `${name} went back and finished the puzzle practice round after all — ${review.correct}/${review.asked} right${g ? `, +${review.gems} gems 💎` : ''}.${topics ? ` I'll still give ${topics} some weight next time.` : ''}`,
    `${name} bulmaca pekiştirmesine geri dönüp sonunda bitirdi — ${review.correct}/${review.asked} doğru${g ? `, +${review.gems} gem 💎` : ''}.${topics ? ` ${topics} konusuna yine de ağırlık vereceğim.` : ''}`,
    `${name} volvió y terminó el repaso de acertijos al final — ${review.correct}/${review.asked} bien${g ? `, +${review.gems} gems 💎` : ''}.${topics ? ` Aun así daré más peso a ${topics}.` : ''}`)
  return { text, notice: { kind: 'activity', child: name, detail: {
    tr: `bulmaca pekiştirmesini sonradan bitirdi, ${review.correct}/${review.asked} doğru${g ? `, +${review.gems} gem` : ''}`,
    en: `finished the puzzle practice round afterwards, ${review.correct}/${review.asked} right${g ? `, +${review.gems} gems` : ''}`,
  } } }
}
