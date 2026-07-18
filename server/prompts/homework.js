// Homework module prompts. Kept out of index.js on purpose (CLAUDE.md: no
// inline prompt strings). Two prompts:
//   1. observation prompt — Gemini OBSERVES a child's homework photo(s) and
//      returns a strict JSON report. It does NOT grade.
//   2. caption prompt — Gemini writes the parent-facing Telegram caption from
//      the (already low-confidence-filtered) observation JSON, honoring the
//      parent's tone + language. Never a fixed template.

function languageName(language) {
  return language === 'en' ? 'English' : 'Turkish'
}

// The image safety gate lives in ./imageSafety.js — it's shared with the chore
// module so the two upload paths can't drift apart.

// ── 1. Observation prompt ─────────────────────────────────────────────────────
// The model is told it may be wrong and that the parent sees the photo next to
// its words — so overstating gets caught. Observe, don't grade.
export function homeworkObservationPrompt(language) {
  const lang = languageName(language)
  return (
    `Sana bir çocuğun tamamladığı ödeve ait olduğu söylenen bir fotoğraf (veya birden fazla sayfa) verilecek. ` +
    `Kâğıt ödev, defter sayfası veya ekran görüntüsü olabilir.\n\n` +
    `Görevin değerlendirmek değil, GÖZLEMLEMEK ve ebeveyne aktarmak. ` +
    `Emin olmadığın hiçbir şeyi kesin dille söyleme. Yanılabilirsin ve ebeveyn fotoğrafı senin yanında görecek — ` +
    `abartmak seni yakalatır.\n\n` +
    `Not verme, puanlama yapma, "başarısız" deme.\n\n` +
    `Yalnızca şu JSON'u döndür, başka hiçbir şey yazma:\n` +
    `{\n` +
    `  "looks_like_homework": boolean,\n` +
    `  "is_screenshot": boolean,\n` +
    `  "legible": boolean,\n` +
    `  "subject_guess": string | null,\n` +
    `  "blanks_noted": string | null,\n` +
    `  "observations": string[],\n` +
    `  "possible_errors": [\n` +
    `    { "where": string, "what": string, "confidence": "low" | "medium" | "high" }\n` +
    `  ],\n` +
    `  "parent_suggestion": string | null\n` +
    `}\n\n` +
    `Kurallar:\n` +
    `- observations: 2-4 madde, hedgeli dil. "6 soru dolu görünüyor", "son iki soru boş kalmış". ` +
    `Okuyamadığını okuyamadım diye yaz.\n` +
    `- possible_errors: SADECE net okuyabildiklerin. Şüphedeysen ekleme. Boş dizi tamamen kabul edilebilir bir cevaptır.\n` +
    `- parent_suggestion: bir hata varsa, ebeveynin çocuğun şevkini kırmadan nasıl konuşabileceğine dair TEK cümle. ` +
    `Hata yoksa null.\n` +
    `- looks_like_homework false ise diğer alanları doldurma.\n` +
    `- Birden fazla sayfa verildiyse hepsini birlikte değerlendir; observations bunları kapsayabilir.\n` +
    `- Metin alanlarının İÇİNDE çift tırnak (") KULLANMA — bir ifadeyi alıntılaman gerekirse tek tırnak (') kullan. ` +
    `Çıktı her koşulda geçerli JSON olmalı.\n` +
    `- Tüm metin alanları ${lang} dilinde.`
  )
}

// gemini-3.5-flash intermittently wraps the JSON in a code fence or appends
// trailing prose/a duplicate object AFTER the closing brace (observed ~2/3 of
// the time), which plain JSON.parse rejects. Slice out the outermost {...} and
// parse that — deterministic, no extra API call. Throws if there's no object.
export function parseObservation(text) {
  const s = String(text || '')
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) throw new Error('no JSON object in response')
  return validateObservation(JSON.parse(s.slice(start, end + 1)))
}

// Whitelist + coerce Gemini's JSON into a shape the rest of the pipeline can
// trust. Throws on anything structurally wrong so the caller falls back.
export function validateObservation(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('observation not an object')

  const bool = (v) => v === true
  const strOrNull = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)

  const observations = Array.isArray(raw.observations)
    ? raw.observations.filter(o => typeof o === 'string' && o.trim()).map(o => o.trim())
    : []

  const CONF = ['low', 'medium', 'high']
  const possible_errors = Array.isArray(raw.possible_errors)
    ? raw.possible_errors
        .filter(e => e && typeof e === 'object' && CONF.includes(e.confidence))
        .map(e => ({
          where: typeof e.where === 'string' ? e.where.trim() : '',
          what: typeof e.what === 'string' ? e.what.trim() : '',
          confidence: e.confidence,
        }))
        .filter(e => e.what)
    : []

  return {
    looks_like_homework: bool(raw.looks_like_homework),
    is_screenshot: bool(raw.is_screenshot),
    legible: raw.legible === undefined ? true : bool(raw.legible),
    subject_guess: strOrNull(raw.subject_guess),
    blanks_noted: strOrNull(raw.blanks_noted),
    observations,
    possible_errors,
    parent_suggestion: strOrNull(raw.parent_suggestion),
  }
}

// Drops low-confidence possible_errors. The model is allowed to voice its
// hesitation in the JSON; CODE decides the parent never reads a guess. This is
// the "kod filtresi" from the spec — a rule enforced deterministically, not by
// asking the model to self-censor.
export function filterForParent(obs) {
  return {
    ...obs,
    possible_errors: (obs.possible_errors || []).filter(e => e.confidence !== 'low'),
  }
}

// ── 2. Caption prompt ─────────────────────────────────────────────────────────
// Gemini writes the actual message the parent receives. It gets the FILTERED
// JSON (no low-confidence errors) so it can't reintroduce them. tone/language
// come from prefs. `staleNote` is a pre-built sentence about the photo date
// (or '') — CODE decides whether the photo is old, the model just includes the
// sentence verbatim if given.
export function homeworkCaptionPrompt({ filteredObservation, childName, tone, language, photoCount, staleNote, gems }) {
  const lang = languageName(language)
  const toneLine = tone
    ? `Ebeveynin tercih ettiği ton: "${tone}". Bu tona uy.\n`
    : ''
  const pageLine = photoCount > 1
    ? `Çocuk ${photoCount} sayfa gönderdi; mesajda tek tek saymana gerek yok ama birden fazla sayfa olduğunu doğal biçimde yansıtabilirsin.\n`
    : ''
  const staleLine = staleNote
    ? `Şu cümleyi mesaja aynen, doğal bir yere ekle: "${staleNote}"\n`
    : ''

  return (
    `Sen Tuto'sun — ${childName} adlı çocuğun ailesiyle konuşan sıcak, gerçek bir arkadaş gibi. ` +
    `${childName} az önce bir ödev fotoğrafı gönderdi. Ebeveyne, fotoğrafın altına düşecek KISA bir mesaj yaz.\n\n` +
    `Aşağıda senin fotoğrafa dair gözlemlerin JSON olarak var. Bu gözlemleri ebeveyne insan diliyle, ` +
    `sıcak ve abartısız aktar. Not verme, puan verme. Bir hata varsa nazikçe belirt ve ` +
    `parent_suggestion'daki öneriyi doğal biçimde ilet. Hata yoksa hata icat etme.\n\n` +
    toneLine + pageLine + staleLine +
    `\nGÖZLEMLER (JSON):\n${JSON.stringify(filteredObservation, null, 2)}\n\n` +
    `Kurallar:\n` +
    `- Sadece mesaj metnini yaz. Başlık, JSON, tırnak, madde işareti yok.\n` +
    `- En fazla 3-4 cümle.\n` +
    `- MESAJI MUTLAKA ebeveynin kararını isteyen doğal bir soruyla bitir. Ödül, ebeveyn onaylayana kadar ` +
    `askıda bekliyor — ebeveyn bir karar beklendiğini anlamazsa gönderi askıda kalır ve çocuk ödülünü hiç almaz. ` +
    `Gerçek bir insanın soracağı gibi sor: "Onaylıyor muyuz?", "Sence de hak etmiş mi?" gibi.` +
    (gems ? ` Onaylanırsa ${gems} gem ekleneceğini de doğal biçimde belirtebilirsin.` : '') + `\n` +
    `- Ama buton, onay linki, "evet/hayır yaz", "1'e bas" gibi MEKANİK yönerge koyma — ebeveyn sana zaten ` +
    `serbest metinle cevap yazabiliyor. Soru bir insanın sorusu gibi olsun, bir formun değil.\n` +
    `- Tüm metin ${lang} dilinde.`
  )
}

// Last-resort caption if the caption-writing Gemini call fails. The
// notification must NEVER be lost, so this is deterministic and dependency-free.
// Ends with the approval question too — the reward stays pending until the
// parent decides, so no path may leave that unasked.
export function fallbackCaption({ childName, language, staleNote }) {
  const base = language === 'en'
    ? `${childName} just sent a photo of their homework. 🌱 Take a look whenever you can.`
    : `${childName} az önce ödevinin fotoğrafını gönderdi. 🌱 Fırsatın olduğunda bir göz atabilirsin.`
  const ask = language === 'en' ? 'Shall we approve it?' : 'Onaylıyor muyuz?'
  return [base, staleNote, ask].filter(Boolean).join(' ')
}
