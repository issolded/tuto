// One server-side image safety gate shared by every module where a child
// uploads a photo (homework, chore). Lives here rather than inside a single
// module's prompts so the two paths can't drift apart.
//
// Why server-side: the chore flow already had a client-side check
// (evaluateChore in src/lib/gemini.js), but it runs in the browser, its catch
// block assumes appropriate:true on any error (fails OPEN), and the API
// endpoint itself validated nothing. The client check stays for friendly
// copy/UX; THIS is the security boundary.

const KIND = {
  homework: {
    claim: 'ödevim',
    expected: 'kâğıt ödev, defter sayfası, çalışma kâğıdı, ders kitabı sayfası, tahta fotoğrafı ya da ekran görüntüsü gibi bir okul çalışması',
  },
  chore: {
    claim: 'yaptığım ev görevi',
    expected: 'toplanmış oda, yıkanmış bulaşık, kurulmuş sofra, süpürülmüş zemin gibi tamamlanmış bir ev işini gösteren fotoğraf',
  },
  drawing: {
    claim: 'kendi çizdiğim resim',
    expected: 'kâğıda kalemle/boyayla yapılmış bir çocuk çizimi ya da resim',
  },
}

export function imageSafetyPrompt({ kind, language }) {
  const k = KIND[kind] || KIND.homework
  const lang = language === 'en' ? 'English' : 'Turkish'
  return (
    `Bir çocuk, "${k.claim}" diyerek bu görsel(ler)i bir çocuk eğitim uygulamasına yükledi. ` +
    `Sen bir çocuk-güvenliği görsel sınıflandırıcısısın. Görselin NE GÖSTERDİĞİNİ değerlendir.\n\n` +
    `Yalnızca şu JSON'u döndür, başka hiçbir şey yazma:\n` +
    `{ "appropriate": boolean, "matches_task": boolean, "reason": string }\n\n` +
    `appropriate=false SADECE görselin KENDİSİ şunlardan birini gösteriyorsa:\n` +
    `- çıplaklık, cinsel/erotik içerik, iç çamaşırı/mayo ya da bedene odaklanan fotoğraflar\n` +
    `- gerçek yaralanma, kan veya gore fotoğrafı\n` +
    `- silahın tehditkâr kullanımı, uyuşturucu/alkol\n` +
    `- yetişkinlere yönelik açık materyal\n\n` +
    `ÇOK ÖNEMLİ — şunlar appropriate=TRUE'dur, bunları ASLA bloklama:\n` +
    `- Çocuğun el yazısı, defter sayfası, ödev kâğıdı, çalışma kâğıdı veya çizimi.\n` +
    `- Yazının KONUSU karanlık ya da korkutucu olsa bile: hayalet hikâyeleri, canavarlar, ` +
    `"kan damlası", savaş, ölüm, korku öyküleri çocuk edebiyatında ve okul ödevlerinde tamamen normaldir. ` +
    `Yazılı kurguyu tek başına ASLA uygunsuz sayma.\n` +
    `- Çocuk çizimlerinde canavar, hayalet ya da dövüş sahnesi olması normaldir.\n` +
    `Sen fotoğrafın GÖSTERDİĞİ şeyi değerlendiriyorsun; yazının anlattığı hikâyeyi değil.\n\n` +
    `- matches_task=true: görsel ${k.expected} ise. Selfie, kedi fotoğrafı, oyun ekranı, alakasız bir görsel ise false.\n` +
    `- Kararsızsan ve görselde yukarıdaki yasak içeriklerden biri AÇIKÇA görünmüyorsa appropriate=true döndür.\n` +
    `- reason: tek kısa cümle, ${lang} dilinde.`
  )
}

// Strict parse. Throws on anything malformed so the caller fails CLOSED —
// never coerce a missing/!boolean `appropriate` into "safe".
export function parseImageSafety(text) {
  const s = String(text || '')
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) throw new Error('no JSON object in safety response')
  const raw = JSON.parse(s.slice(start, end + 1))
  if (typeof raw.appropriate !== 'boolean') throw new Error('malformed safety response')
  return {
    appropriate: raw.appropriate,
    matchesTask: raw.matches_task === true,
    reason: typeof raw.reason === 'string' ? raw.reason : '',
  }
}
