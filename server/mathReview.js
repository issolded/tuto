import { say } from './lang.js'
import { localTopicName } from './topicNames.js'

// The review round offered after a maths session: up to five fresh questions on the skills the
// child missed. Pure functions only — the endpoints in index.js do the reading and writing.

export const REVIEW_MAX = 5
// A review that is offered and never answered is closed after this long and reported as it is.
export const REVIEW_WINDOW_MS = 30 * 60 * 1000

// The questions a review draws from, ranked: wrong or skipped first, then the ones the child got
// right only with the help panel in front of them (found with a worked solution is not found
// alone, and the review is the first unaided check). A question answered right after a nudge back
// to the question, with no help shown, is left alone. Only questions a template made can be asked
// again (a fresh one of the same kind), so the model's questions never qualify. One question per
// skill first, so five misses on fractions do not crowd out the others; leftovers fill the rest.
export function reviewCandidates(attempts, max = REVIEW_MAX) {
  const list = Array.isArray(attempts) ? attempts : []
  const eligible = []
  list.forEach((a, pos) => {
    if (!a || a.source !== 'template' || typeof a.topic_id !== 'string' || !a.topic_id) return
    const tries = Math.max(0, Math.min(9, Math.trunc(Number(a.wrong_tries) || 0)))
    const missed = a.correct !== true
    // Two wrong tries always show the help panel; `help_shown` is the direct record of it.
    const helped = a.help_shown === true || tries >= 2
    if (!missed && !helped) return
    // `idx` is the question's place in the session as the screen counts it; `pos` only the place
    // in this list, which differs when the screen dropped a question it could not attribute.
    const idx = Number.isInteger(a.idx) && a.idx >= 0 ? a.idx : pos
    eligible.push({
      idx, topic_id: a.topic_id.slice(0, 60),
      topic_name: typeof a.topic_name === 'string' ? a.topic_name.slice(0, 120) : null,
      // What the first round already paid for this question, as a share of one question.
      earned: missed ? 0 : (a.help_used ? 0.5 : 1),
      rank: missed ? 0 : 1,
    })
  })
  eligible.sort((x, y) => x.rank - y.rank || x.idx - y.idx)
  const picked = []
  const topics = new Set()
  for (const e of eligible) {
    if (picked.length >= max) break
    if (!topics.has(e.topic_id)) { picked.push(e); topics.add(e.topic_id) }
  }
  for (const e of eligible) {
    if (picked.length >= max) break
    if (!picked.includes(e)) picked.push(e)
  }
  return picked.sort((x, y) => x.idx - y.idx).map(({ rank: _r, ...p }) => p)
}

// What the review can give back, and only for questions the first round paid NOTHING for (wrong or
// skipped): half a question, or a quarter when it is found with help again. That is exactly what
// one wrong try and then a right answer pays in the first round, so it is never more than that.
// Questions found with help in the first round are practised but pay nothing here: giving them a
// share made two wrong tries worth more than one, and a child who was wrong twice earned more.
export function reviewShare(pick, result) {
  if (!result || result.correct !== true) return 0
  if ((Number(pick?.earned) || 0) !== 0) return 0
  return 0.5 * (result.help_used ? 0.5 : 1)
}

// results: [{ idx, correct, help_used }] from the child; only questions that were picked count,
// and each once, so a repeated or invented idx pays nothing.
export function reviewOutcome(picks, results, total) {
  const byIdx = new Map()
  for (const r of Array.isArray(results) ? results : []) {
    if (r && Number.isInteger(r.idx) && !byIdx.has(r.idx)) byIdx.set(r.idx, r)
  }
  const n = Math.max(1, Number(total) || 1)
  let share = 0
  let correct = 0
  const missed = []
  for (const p of picks) {
    const r = byIdx.get(p.idx)
    share += reviewShare(p, r)
    if (r?.correct === true) correct++
    // Found only with a hint or the help panel is not found alone: the review is the first unaided check, so
    // the skill stays on the list for the next session until one is passed without any.
    if (r?.correct !== true || r?.help_shown === true || r?.help_used === true) missed.push(p)
  }
  return { share: share / n, correct, asked: picks.length, missed }
}

// The skills a review leaves for next time, each named once.
export function carryTopics(picks) {
  const seen = new Set()
  const out = []
  for (const p of picks) {
    if (!p?.topic_id || seen.has(p.topic_id)) continue
    seen.add(p.topic_id)
    out.push({ topic_id: p.topic_id, topic_name: p.topic_name ?? null })
  }
  return out
}

// The parent's message about a maths session, built from the facts a session row carries so it can
// be sent now or, when a review was offered, once the review is settled. `review` is null (no
// review in the story) or { state: 'done' | 'declined' | 'expired', asked, correct, gems,
// started, topics: [{ topic_id, topic_name } still owed] }.
export function mathSessionNotice(name, s, language, review) {
  const head = s.kind === 'capped'
    ? say(language,
        `${name} did another maths session — ${s.correct}/${s.total} correct. That's past today's limit of ${s.daily_cap}, so it didn't add gems. 🌙`,
        `${name} bir matematik daha yaptı — ${s.correct}/${s.total} doğru. Bugünkü sınırı (günde ${s.daily_cap}) geçtiği için gem eklenmedi. 🌙`,
        `${name} ha hecho otra sesión de mates — ${s.correct}/${s.total} correctas. Pasa del límite de hoy (${s.daily_cap}), así que no ha sumado gems. 🌙`)
    : say(language,
        `${name} did their maths — ${s.correct}/${s.total} correct. +${s.gems} gems 💎`,
        `${name} matematiğini yaptı — ${s.correct}/${s.total} doğru. +${s.gems} gem 💎`,
        `${name} ha hecho sus mates — ${s.correct}/${s.total} correctas. +${s.gems} gems 💎`)

  let tail = ''
  let tr = '', en = ''
  if (review) {
    const preguntas = `${review.asked} ${review.asked === 1 ? 'pregunta' : 'preguntas'}`
    // Topics arrive as { topic_id, topic_name }; the name is written in the parent's language.
    const topics = (review.topics || []).filter(Boolean).slice(0, 3)
      .map(t => localTopicName(t.topic_id, t.topic_name, language)).join(', ')
    const owed = topics ? {
      en: ` I'll give ${topics} extra weight in the next maths session.`,
      tr: ` Bir sonraki matematikte ${topics} konusuna ağırlık vereceğim.`,
      es: ` En la próxima sesión de mates daré más peso a ${topics}.`,
    } : { en: '', tr: '', es: '' }
    if (review.state === 'done') {
      const g = review.gems > 0
      tail = say(language,
        `They then went back over ${review.asked} they'd missed — ${review.correct}/${review.asked} right${g ? `, +${review.gems} gems 💎` : ''}.${owed.en}`,
        `Sonra kaçırdığı ${review.asked} soruyu tekrar çözdü — ${review.correct}/${review.asked} doğru${g ? `, +${review.gems} gem 💎` : ''}.${owed.tr}`,
        `Después repasó ${review.asked} que había fallado — ${review.correct}/${review.asked} bien${g ? `, +${review.gems} gems 💎` : ''}.${owed.es}`)
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
  const text = [head, tail, s.note].filter(Boolean).join('\n\n')
  const detail = s.kind === 'capped'
    ? { tr: `matematik, ${s.correct}/${s.total} doğru, günlük sınır dolduğu için gem yok${tr}`,
        en: `maths, ${s.correct}/${s.total} correct, past the daily limit so no gems${en}` }
    : { tr: `matematik, ${s.correct}/${s.total} doğru, +${s.gems} gem${tr}`,
        en: `maths, ${s.correct}/${s.total} correct, +${s.gems} gems${en}` }
  return { text, notice: { kind: 'activity', child: name, detail } }
}
