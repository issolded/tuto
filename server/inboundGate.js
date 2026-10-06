// The entry gate: how many messages a parent can send before the model is called at all.
//
// One of the two gates in the architecture (CLAUDE.md, "iki kapı, tek beyin"); sendGate is the
// way out, this is the way in. It is code, never the model's judgement: every message that
// passes costs a Gemini call, and the in-app chat removes the friction Telegram had. Applied to
// the app's Ask Tuto tab only — Telegram and WhatsApp are left exactly as they were (user
// decision, 2026-10-04). Counted from the messages table the transcript already writes (role
// 'parent'), so it needs no migration; with no channel column that count is every channel's.
//
// Generous on purpose. A parent going through approvals ("evet", "onayla", "bunu da") sends a
// burst of short messages, and a gate that trips on that is worse than no gate. The numbers
// stop a loop or a stuck key, not a busy evening.
import { say } from './lang.js'

export const INBOUND_LIMITS = { perMinute: 10, perDay: 150 }

// counts: { lastMinute, lastDay } — messages ALREADY sent in those windows, not counting this one.
export function inboundVerdict(counts, limits = INBOUND_LIMITS) {
  const minute = Number(counts?.lastMinute) || 0
  const day = Number(counts?.lastDay) || 0
  if (day >= limits.perDay) return { ok: false, reason: 'daily' }
  if (minute >= limits.perMinute) return { ok: false, reason: 'burst' }
  return { ok: true }
}

// What the parent reads instead of an answer. Fixed text, no model: the point is not calling it.
export function inboundRefusal(reason, lang) {
  return reason === 'daily'
    ? say(lang,
        "We've talked a lot today — I'll be able to answer again tomorrow.",
        'Bugün çok konuştuk, yarın yeniden cevap verebileceğim.',
        'Hoy hemos hablado mucho; mañana podré responderte de nuevo.')
    : say(lang,
        "That's a lot of messages at once — give me a minute and send it again.",
        'Çok hızlı geldi, bir dakika sonra tekrar yazar mısın?',
        'Han llegado muchos mensajes de golpe; espera un minuto y vuelve a enviarlo.')
}
