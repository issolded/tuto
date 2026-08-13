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

// "and" belongs INSIDE an English number only after a scale word — "eight hundred and forty
// five" is one number, "forty five and six" is two. Getting this wrong turns an addition into
// its own answer: 45 and 6 became 51.
const EN_GLUE = new Set(['and', 'hundred', 'thousand', 'million'])
const JOINS_AFTER_SCALE = 'and'

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

function convert(text, units, tens, scale, glue) {
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
      // Every number word goes, not just the long ones. Sparing small words seemed kinder to
      // the prose until it produced "45 and six" in one sentence, and mixed notation inside a
      // sum is worse to read than a slightly stilted "1 of the boxes". One rule, no surprises.
      if (n === null) out.push(...core.map(t => t.raw))
      else out.push(String(n))
    }
    for (const t of after) out.push(t.raw)
    run = []
  }

  for (const tok of tokens) {
    const word = tok.toLocaleLowerCase('tr')
    if (isNumberWord(word, units, tens, scale, glue)) {
      // An "and" that does not follow a scale word separates two numbers rather than joining
      // one, so the run ends here and a fresh one starts after it.
      const prev = [...run].reverse().find(t => t.word)
      if (word === JOINS_AFTER_SCALE && !(prev && prev.word in scale)) {
        flush()
        out.push(tok)
        continue
      }
      run.push({ raw: tok, word })
    } else if (/^\s+$/.test(tok) && run.length) {
      run.push({ raw: tok, word: '' })          // keep spacing inside a run
    } else {
      flush()
      out.push(tok)
    }
  }
  flush()

  // Runs keep their internal spacing tokens; collapse what is left of them.
  return out.join('').replace(/ {2,}/g, ' ').trim()
}

export function numeralise(text, lang = 'en') {
  if (typeof text !== 'string' || !text) return text
  return lang === 'tr'
    ? convert(text, TR_UNITS, TR_TENS, TR_SCALE, new Set(['yüz', 'bin', 'milyon']))
    : convert(text, EN_UNITS, EN_TENS, EN_SCALE, EN_GLUE)
}
