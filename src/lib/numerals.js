// Turns spelled-out numbers in a generated question back into digits.
//
// Real children reading real questions is what found this: "eight hundred and forty five" was
// stopping them before the arithmetic did. The prompt asked for the child's language "number
// words", meaning use yedi rather than seven where a number is spelled — and the model read it
// as an instruction to spell every number out.
//
// The prompt says digits now, but a prompt rule is a request, not a guarantee; the markdown
// table rule needed isUnreadable() behind it for the same reason. This is that guard. It
// rewrites rather than rejects, because the question is otherwise fine and dropping it costs
// the child a topic.
//
// Only runs on model-written questions. Template questions are built from digits already.

const EN_UNITS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
}
const EN_TENS = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}
const EN_SCALE = { hundred: 100, thousand: 1000, million: 1000000 }

const TR_UNITS = {
  sıfır: 0, bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9,
}
const TR_TENS = {
  on: 10, yirmi: 20, otuz: 30, kırk: 40, elli: 50, altmış: 60, yetmiş: 70, seksen: 80, doksan: 90,
}
const TR_SCALE = { yüz: 100, bin: 1000, milyon: 1000000 }

// Spanish writes 16–29 as single words, so they belong with the units rather than being built
// from a ten and a unit. The unaccented spellings are here too: a model asked for Spanish
// returns "dieciseis" often enough, and a number word we do not recognise is left spelled out
// in front of a child who has to answer it on a number pad.
const ES_UNITS = {
  cero: 0, uno: 1, un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciséis: 16, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veintiuno: 21, veintiún: 21, veintiuna: 21, veintidós: 22, veintidos: 22,
  veintitrés: 23, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiséis: 26,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
}
// The hundreds are their own words rather than "N cien", so they add like tens do.
const ES_TENS = {
  veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
  ochenta: 80, noventa: 90,
  doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500,
  seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700,
  ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
}
const ES_SCALE = { cien: 100, ciento: 100, mil: 1000, millón: 1000000, millon: 1000000, millones: 1000000 }

// "and" belongs INSIDE an English number only after a scale word — "eight hundred and forty
// five" is one number, "forty five and six" is two. Getting this wrong turns an addition into
// its own answer: 45 and 6 became 51.
//
// Spanish has the same trap with "y", but it sits somewhere else in the number: "cuarenta y
// cinco" joins a TEN to a unit, never a scale word to anything ("ciento y cinco" is not
// Spanish). So the joining word and what it may follow are configured together rather than
// the English shape being assumed for every language.
const EN_GLUE = new Set(['and', 'hundred', 'thousand', 'million'])
const ES_GLUE = new Set(['y', 'cien', 'ciento', 'mil', 'millón', 'millon', 'millones'])

function isNumberWord(w, units, tens, scale, glue) {
  return w in units || w in tens || w in scale || (glue?.has(w) ?? false)
}

// Accumulator form: hundreds multiply what came before them, thousands close a group.
function wordsToNumber(words, units, tens, scale) {
  let total = 0
  let group = 0
  let seen = false

  for (const w of words) {
    if (w in units) { group += units[w]; seen = true; continue }
    if (w in tens) { group += tens[w]; seen = true; continue }
    if (w in scale) {
      const s = scale[w]
      if (s === 100) {
        // Turkish says "yüz" alone for 100, English says "a hundred"; a bare scale word with
        // nothing before it means one of them.
        group = (group === 0 ? 1 : group) * 100
      } else {
        total += (group === 0 ? 1 : group) * s
        group = 0
      }
      seen = true
      continue
    }
  }
  return seen ? total + group : null
}

// `join` is { word, after }: the word that glues one number together, and the map whose keys it
// may follow. Anything else and it is separating two numbers, so the run ends there.
function convert(text, { units, tens, scale, glue, join, locale }) {
  const tokens = String(text ?? '').split(/(\s+|[^\p{L}\p{N}]+)/u)
  const out = []
  let run = []

  const flush = () => {
    if (!run.length) { return }
    // Trim glue-only words from both ends so "and" or a stray "hundred" is not swallowed.
    let a = 0, b = run.length
    while (a < b && !(run[a].word in units || run[a].word in tens || run[a].word in scale)) a++
    while (b > a && !(run[b - 1].word in units || run[b - 1].word in tens || run[b - 1].word in scale)) b--
    const core = run.slice(a, b)
    const before = run.slice(0, a), after = run.slice(b)

    for (const t of before) out.push(t.raw)
    if (core.length) {
      const n = wordsToNumber(core.map(t => t.word), units, tens, scale)
      // Every number word goes, however short — sparing small ones produced "45 and six" in a
      // single sentence, and mixed notation inside a sum is worse than a slightly stilted
      // "2 children".
      //
      // One exception, found on a real Turkish question: "yeni bir bilgisayar" came back as
      // "yeni 1 bilgisayar". Turkish `bir` is both the number and the indefinite article, and
      // English `one` is usually "one of them" rather than a quantity. A lone 1 is left as a
      // word. It costs the odd "3 eksi bir", which reads oddly; writing "a computer" as "1
      // computer" changes what the sentence says, which is worse.
      const lone = core.filter(t => t.word).length === 1
      if (n === null || (lone && n === 1)) out.push(...core.map(t => t.raw))
      else out.push(String(n))
    }
    for (const t of after) out.push(t.raw)
    run = []
  }

  for (const tok of tokens) {
    // Turkish lower-cases I to ı, which is right for Turkish and wrong for everything else —
    // lower-casing Spanish through it would turn "DIECISÉIS" into "dıecıséıs" and lose it.
    const word = tok.toLocaleLowerCase(locale)
    if (isNumberWord(word, units, tens, scale, glue)) {
      // An "and" that does not follow a scale word — or a Spanish "y" that does not follow a
      // ten — separates two numbers rather than joining one, so the run ends here and a fresh
      // one starts after it.
      const prev = [...run].reverse().find(t => t.word)
      if (join && word === join.word && !(prev && prev.word in join.after)) {
        flush()
        out.push(tok)
        continue
      }
      run.push({ raw: tok, word })
    } else if ((/^\s+$/.test(tok) || /^[-‑–]$/.test(tok)) && run.length) {
      // Spacing, and the hyphen in "forty-five" — which is one number, not two. Splitting the
      // run there turned it into "40-5", which is worse than the words were. Trailing glue is
      // trimmed back out when the run is flushed, so a real dash between clauses survives.
      run.push({ raw: tok, word: '' })
    } else {
      flush()
      out.push(tok)
    }
  }
  flush()

  // Runs keep their internal spacing tokens; collapse what is left of them.
  return out.join('').replace(/ {2,}/g, ' ').trim()
}

// Thousands separators arrive at random — one session produced "Round 347820 to the nearest
// 10000" and "Round 482,735 to the nearest 10,000", and another grouped the number but not the
// place value it was rounding to. Worse in Turkish, where the comma is the DECIMAL separator:
// an English-style 482,735 reads as 482.735.
//
// Stripped rather than made consistent, because the child answers on a number pad with no
// separator key — what they type back is bare digits either way. Only groups of exactly three
// are touched, so a decimal survives: English keeps "3.75", Turkish keeps "3,75".
function stripGroupSeparators(text, lang) {
  const out = text.replace(/\b\d{1,3}(?:,\d{3})+\b/g, m => m.replace(/,/g, ''))
  // Turkish and Spanish both group with the dot and put the decimal on the comma, so an
  // English-style 482,735 reads as 482.735 in either.
  return lang === 'tr' || lang === 'es'
    ? out.replace(/\b\d{1,3}(?:\.\d{3})+\b/g, m => m.replace(/\./g, ''))
    : out
}

const NUMBER_WORDS = {
  en: { units: EN_UNITS, tens: EN_TENS, scale: EN_SCALE, glue: EN_GLUE,
        join: { word: 'and', after: EN_SCALE }, locale: 'en' },
  tr: { units: TR_UNITS, tens: TR_TENS, scale: TR_SCALE, glue: new Set(['yüz', 'bin', 'milyon']),
        join: null, locale: 'tr' },
  es: { units: ES_UNITS, tens: ES_TENS, scale: ES_SCALE, glue: ES_GLUE,
        join: { word: 'y', after: ES_TENS }, locale: 'es' },
}

export function numeralise(text, lang = 'en') {
  if (typeof text !== 'string' || !text) return text
  return stripGroupSeparators(convert(text, NUMBER_WORDS[lang] ?? NUMBER_WORDS.en), lang)
}
