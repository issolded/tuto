// Isolated math template-engine pilot. Pure code, no LLM calls, no images.
// Wired into production MathScreen for arithmetic topics — see templateTopicForLevel()
// there. Also has its own isolated sandbox: src/screens/MathLab.jsx.
//
// Problem shape:
//   { topic, level, question_text, format: 'numeric', correct_answer, hint_steps: [],
//     operandKey, visual? }
//
// format: 'choice' is the second shape, for questions whose answer cannot be typed on a number
// pad at all — 5/8, 16:15. It adds `options: [{ value, why }]`, correct_answer holding the
// winning option's own `value` string. Every option carries its own `why`, because a child who
// picks "5/16" has made one specific mistake (they added the denominators) and the generic hint
// steps do not name it. Two of the wrong options encode a real misconception, one is a near
// miss — a plausible-looking number, so the right answer cannot be found by elimination.
// operandKey identifies the underlying number pair (independent of phrasing/names) so a
// caller generating several problems in one batch can dedupe — see generateProblem's
// `avoid` param. Note it SORTS the pair, so roles are not recoverable from it.
//
// `visual` is how a template hands its operands to the help panel with their roles intact,
// which operandKey cannot do — "3 groups of 4" and "4 groups of 3" share a key. Drawing
// from this instead of re-parsing the question text is the point: text inference is what
// previously drew 2 + 1 for a question whose answer was 2×3 + 1×5. Shapes:
//   { kind: 'share',  total, groups, highlight? }  — deal total into equal groups
//   { kind: 'groups', groups, per }                — that many equal groups of that size
//   { kind: 'array',  rows, cols }                 — a rectangular arrangement
//   { kind: 'clock',  hour, minute, ask }          — a clock face; `ask` says what is wanted
//   { kind: 'pictogram', unit, each, rows, highlight } — a chart of `unit` symbols, one row
//       per { label, count }, where one symbol stands for `each`; `highlight` names the rows
//       the question is about, which the help panel lights up and counts along
// Optional: a template without one simply gets no visual.
//
// A "template" is a function(level) -> problem. It picks numbers, builds the question
// text, computes correct_answer in code (deterministic, no model guessing), and builds
// hint_steps from that same structure — never a separate hand-written explanation that
// could drift out of sync with the actual numbers. hint_steps stop at method, never state
// the final answer — the child does that last step themselves.

// Extensions are explicit so this module can be imported by `npm run math:check` under
// bare node as well as by Vite. The audit has to exercise the code that ships, not a copy.
import { TR_ACC, TR_ABL } from './timeWords.js'
import { say } from './i18n.js'

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)]
}

// Word banks are keyed by language; anything still a bare array is language-neutral.
// A bank whose per-language value is a single STRING rather than a list is returned whole.
// Without that line this picked a random CHARACTER out of it, and "1 kilogram is about 2.2
// pounds" went out as "1 r is about 2.2 d" — a wrong question that reads as a corrupted one,
// and that no check looking for undefined or NaN can see.
function pickL(bank, lang) {
  const v = Array.isArray(bank) ? bank : (bank[lang] ?? bank.en)
  return typeof v === 'string' ? v : pick(v)
}

// Everything a child reads goes through say(lang, en, tr, es), so adding a language is adding
// an argument rather than hunting for strings. It lives in i18n.js because the screens build
// sentences the same way.
//
// It was a local `tr` taking two phrasings, which is why the rename: with three languages a
// name that means "the Turkish one" reads as a bug at every one of its call sites.

// Capitalise a sentence that starts with a word from a bank ("atılan gol grafiğine bak" was
// printed lower-case). Turkish rules, so "ı" stays dotless and "i" becomes "İ".
const cap = s => s.charAt(0).toLocaleUpperCase('tr') + s.slice(1)

function pairKey(a, b) {
  return [a, b].sort((x, y) => x - y).join(',')
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i)
    const t = a[i]; a[i] = a[j]; a[j] = t
  }
  return a
}

// Difficulty → operand range. Same shape for every template so registry/templates agree
// on what "level" means without each template reinventing scaling.
// The ceiling used to grow by three a rung and topped out at 49, which was coherent while the
// ladder only ever went as far as "Subtraction up to 20" — but the dial now sits a child in
// their school year, and Year 5 arithmetic is not 34 + 28. A linear ceiling put "34 + 28 = ?"
// in the same ten questions as "round 384,715 to the nearest ten thousand". It grows with the
// curriculum instead: within 20, then 100, then three digits, then four, and up.
// Indexed by level. Two rungs per school year, matching the dial's year footings in
// mathCurriculum.js (Y1→2, Y2→4, Y3→6, Y4→8, Y5→10, Y6→12): within 20, within 100, three
// digits, four digits, and beyond. This is the band a question works inside — for addition
// it caps the ANSWER, so "Addition within 20" cannot produce 17 + 16.
// The top two years are deliberately below what the curriculum's "more than 4 digits" would
// allow. Screen mode gives the child no paper to work on, and a typed answer to
// 540375 + 374852 is a wall rather than a question — the gap that made our maths feel easy
// was never magnitude (the hardest arithmetic in the quiz we were compared against was
// 456 × 7) but breadth, which the curriculum topics now supply. One array to raise if
// testing says otherwise.
const MAX_FOR_LEVEL = [20, 20, 20, 100, 100, 1000, 1000, 10000, 10000, 20000, 20000, 50000, 50000, 50000, 50000, 50000]

// Which school year's footing a level sits on — 1..7. The dial is two rungs per year, so
// this is what a template consults when its difficulty is about WHICH numbers are in play
// (tables, denominators) rather than how big they get.
// The ceiling was 6 while Year 6 was the last year. It is 7 now that Year 7 exists, which is
// also what makes levels 13-14 mean anything: capped at 6 they were a second Year 6.
// A number as a book would print it for this language: 4,200,000 in English, 4.200.000 in
// Turkish and Spanish. Below four digits nothing changes, so "45 candies" and "308 + 260" read
// as they did.
//
// A hundred-question audit asked for this — "6270000" is a wall of digits a child has to count
// through before the question can start. The screen reads numbers back out of the question
// text for its visual help, so it strips separators first; see `numbersIn` in MathScreen.
const SEPARATOR = { en: ',', tr: '.', es: '.' }

export function num(n, lang = 'en') {
  const v = Number(n)
  if (!Number.isFinite(v) || Math.abs(v) < 1000) return String(n)
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, SEPARATOR[lang] ?? ',')
}

// A decimal as a book in this language prints it: 0.25 in English, 0,25 in Turkish and Spanish.
// The mirror of `num` above, and the two have to be read together. `num` gives Turkish and
// Spanish a POINT between thousands, so a decimal left with its point in those languages is a
// different number: a Year 5 Turkish session asked "8.412 + 5.400 = ?" (eight thousand…) and a
// few questions later "8.312 sayısını 2 ondalık basamağa yuvarla" (eight point…), the same
// spelling meaning two things a thousand times apart. The hints already said "virgülden sonra".
// Only what a child reads goes through here — option values and answers keep their point,
// because they are compared as numbers; the screen localises them when it draws them.
export function dnum(v, lang = 'en') {
  // Nothing in, nothing out: the results screen carries null for a question with no answer, and
  // String(null) would print the word.
  if (v == null) return v
  const s = String(v)
  return lang === 'tr' || lang === 'es' ? s.replace(/(\d)\.(\d)/g, '$1,$2') : s
}

function bandForLevel(level) {
  const l = Math.min(Math.max(Number(level) || 1, 1), 15)
  return Math.min(7, Math.ceil(l / 2) || 1)
}

function rangeForLevel(level) {
  const l = Math.min(Math.max(Number(level) || 1, 1), 15)
  const max = MAX_FOR_LEVEL[l]
  // The floor used to be 1 at every rung, so the very easiest question was always in play
  // no matter how high the child had climbed — a ten-year-old on "Subtraction up to 20"
  // was handed "2 - 1". Raising it with the ceiling keeps each rung inside its own band.
  return { min: Math.max(1, Math.round(max / 4)), max }
}

// Whether a pair of operands can honestly be drawn as countable objects. The addition and
// subtraction help draws one emoji per unit; that is the whole point of it for a six-year-old,
// and nonsense at 34 + 28, which would put sixty-two circles on screen and ask a child to
// count them. Past this the help falls back to the template's own written steps.
export const COUNTABLE_LIMIT = 20
export function isCountable(a, b) {
  return Number.isInteger(a) && Number.isInteger(b)
    && a >= 0 && b >= 0 && a <= COUNTABLE_LIMIT && b <= COUNTABLE_LIMIT && a + b <= 30
}

// The equal-sharing picture draws one object per unit and splits them into groups. That reads
// at 20 shared among 4; at 300 shared among 12 it is a screenful of dots nobody can count, so
// past this the help falls back to the written steps the template already carries.
//
// It was 48, which is below what the children who SEE this picture are actually asked. The
// picture lives inside HelpPanel and HelpPanel opens for ages eight and under, so the largest
// number that can ever reach it is Year 3's ceiling: a 2-digit number divided by a 1-digit
// one, up to 96. At 48 roughly a fifth of Year 3's division questions lost their picture —
// "50 pencils among 5 friends" had none, which is how this was reported. 88 among 8 was
// rendered and read cleanly, so the ceiling is the curriculum's, not the drawing's.
//
// The coupling is checked rather than remembered: math:check fails if any question a child of
// eight or under can be asked carries a share that this limit would drop.
const SHAREABLE_LIMIT = 100
function shareVisual(total, groups, highlight) {
  if (total > SHAREABLE_LIMIT) return null
  return highlight ? { kind: 'share', total, groups, highlight } : { kind: 'share', total, groups }
}

// ─── Mental arithmetic ──────────────────────────────────────────────────────
// Screen mode gives the child nothing to write on. A ten-year-old's session came back with
// "8" for 8.412 - 3.202, "8" for 5647 + 13043 and "2" for 9025 + 7383 — single digits lifted
// off the question. That is not failing the arithmetic, it is abandoning it, and five of the
// ten questions asked for column work they had no paper to do.
//
// The fix is NOT smaller numbers, which would quietly hand a Year 5 child Year 3's curriculum
// and still tell the parent they practised "addition with more than 4 digits". It is that the
// number being added or subtracted must PARTITION: at most two non-zero digits, so it splits
// into at most two steps a child can hold in their head. 5647 + 13043 becomes 5647 + 13000 —
// same five digits, same curriculum line, but now "add thirteen thousand" rather than four
// columns of carrying.
//
// Borrowing is deliberately not restricted: 5147 - 2900 borrows in column form and partitions
// perfectly well (5147 - 2000 = 3147, then - 900). Borrowing is a property of the written
// method, not of the number, so the one rule below is enough.
//
// That one rule also writes the help — partitionSteps walks one step per non-zero digit — so
// the constraint and the explanation are the same fact and cannot drift apart.
const MENTAL_PARTS = 2

// Rounds DOWN to two significant digits: 13043 → 13000, 1999 → 1900, 47 → 47. Down rather
// than to nearest so the result can never exceed the headroom the caller measured.
function mentalise(n) {
  const step = 10 ** Math.max(0, String(Math.trunc(n)).length - MENTAL_PARTS)
  return Math.floor(n / step) * step
}

// The place-value pieces actually doing something: 2100 → [2000, 100], 13000 → [13000].
function placeParts(n) {
  const digits = String(Math.trunc(Math.abs(n)))
  return digits.split('').map((d, i) => Number(d) * 10 ** (digits.length - 1 - i)).filter(Boolean)
}

// The same rule, applied to a number the templates did not choose. The model writes the topics
// that have no template — decimals, rounding, angles — and a rule left to a model drifts back
// to whatever its prose allows, so the prompt asks and this decides. Takes the operand as
// written, because "3.202" fails on its decimal places before its digits are even counted.
export function partitionsMentally(written) {
  const [whole, fraction = ''] = String(written).trim().replace(',', '.').replace('-', '').split('.')
  if (fraction.length > 1) return false
  return (whole + fraction).split('').filter(d => d !== '0').length <= MENTAL_PARTS
}

// `es` is the singular and `esP` the plural: Spanish counts them ("3 centenas"), where English
// and Turkish leave the word alone after a number.
const UNITS = [
  { at: 1000, en: 'thousand', tr: 'bin', es: 'millar', esP: 'millares' },
  { at: 100, en: 'hundred', tr: 'yüz', es: 'centena', esP: 'centenas' },
  { at: 10, en: 'ten', tr: 'onluk', es: 'decena', esP: 'decenas' },
]

// The help for anything past counting range. One step per place-value piece, stopping short of
// the last one so the child still does the arithmetic — the file's rule is that hint_steps
// carry method and never the answer, and a walk that ran to the end would carry both.
//
// Two pieces is the useful shape: name the split, then do the first piece and hand over the
// second. One piece has no intermediate to show without giving the answer away, so it names
// the place value instead, which is the method a child is actually taught for round numbers.
// Numbers here go through `num` for the same reason the question text does: a question that
// reads "30,956 + 18,000" and a hint that reads "Break 18000 up" are the same number written
// two ways on one screen. Group four-digit numbers too, including intermediate steps.
function partitionSteps(a, b, add, lang) {
  const parts = placeParts(b)
  const sign = add ? '+' : '-'

  // A single digit has no place value worth naming — "7 ones" is not an explanation. It is
  // also only reachable with a large `a`, since a small pair goes to the counting steps.
  if (b < 10) {
    return [
      say(lang, `Start with the ones; you may need to cross a ten.`, `Birler basamağından başla; bir onluğu geçmen gerekebilir.`,
                `Empieza por las unidades; puede que cruces una decena.`),
      say(lang, `Count ${add ? 'on' : 'back'} ${num(b, lang)} from ${num(a, lang)}.`,
                `${num(a, lang)} sayısından ${num(b, lang)} tane ${add ? 'ileri' : 'geri'} say.`,
                `Cuenta ${num(b, lang)} hacia ${add ? 'adelante' : 'atrás'} desde ${num(a, lang)}.`),
    ]
  }

  if (parts.length === 1) {
    const u = UNITS.find(x => b % x.at === 0 && b >= x.at)
    const k = b / u.at
    const word = say(lang, `${k} ${u.en}`, `${k} ${u.tr}`, `${k} ${k === 1 ? u.es : u.esP}`)
    return [
      say(lang, `${num(b, lang)} is a round number — ${word}.`, `${num(b, lang)} yuvarlak bir sayı — ${word}.`,
                `${num(b, lang)} es un número redondo: ${word}.`),
      say(lang, `${add ? 'Add' : 'Take away'} ${word} ${add ? 'to' : 'from'} ${num(a, lang)}. The smaller place values stay the same.`,
                `${num(a, lang)} ${add ? 'sayısına' : 'sayısından'} ${word} ${add ? 'ekle' : 'çıkar'}. Daha küçük basamaklar aynı kalır.`,
                `${add ? `Suma ${word} a ${num(a, lang)}` : `Resta ${word} de ${num(a, lang)}`}. Las posiciones menores no cambian.`),
    ]
  }

  const first = parts[0]
  const rest = parts.slice(1).map(x => num(x, lang)).join(` ${sign} `)
  const afterFirst = add ? a + first : a - first
  return [
    say(lang, `You do not need to write this down. Break ${num(b, lang)} up: ${parts.map(x => num(x, lang)).join(' + ')}.`,
              `Bunu yazmana gerek yok. ${num(b, lang)} sayısını parçala: ${parts.map(x => num(x, lang)).join(' + ')}.`,
              `No hace falta que lo escribas. Separa ${num(b, lang)} así: ${parts.map(x => num(x, lang)).join(' + ')}.`),
    say(lang, `${num(a, lang)} ${sign} ${num(first, lang)} = ${num(afterFirst, lang)}. Now ${add ? 'add' : 'take away'} the ${rest}.`,
              `${num(a, lang)} ${sign} ${num(first, lang)} = ${num(afterFirst, lang)}. Şimdi ${rest} ${add ? 'ekle' : 'çıkar'}.`,
              `${num(a, lang)} ${sign} ${num(first, lang)} = ${num(afterFirst, lang)}. Ahora ${add ? 'suma' : 'resta'} ${rest}.`),
  ]
}

// ─── Addition ───────────────────────────────────────────────────────────────

// `columnar` is paper mode asking for the numbers back at full width. On screen the second
// operand is partitionable; on paper it is whatever the band allows, because a formal written
// method is exactly what the curriculum wants there and paper is what it needs.
function additionTemplate(level, lang, columnar = false, plain = false) {
  // Years 2-4 mix in the book's shapes (see youngAddSub); `plain` is that mix asking for this one.
  const yb = bandForLevel(level)
  if (!plain && yb >= 2 && yb <= 4) return youngAddSub(level, lang, true, columnar)
  const { min, max } = rangeForLevel(level)
  // Both operands used to be drawn from the whole range, so the SUM could reach twice the
  // band's ceiling — "Addition within 20" handing over 17 + 16. The ceiling belongs to the
  // answer, so the second operand is drawn from what is left of it.
  const a = randInt(min, Math.max(min, max - min))
  const raw = randInt(min, Math.max(min, max - a))
  const b = columnar ? raw : mentalise(raw)
  const correct_answer = a + b

  return {
    topic: 'addition',
    level,
    question_text: `${num(a, lang)} + ${num(b, lang)} = ?`,
    format: 'numeric',
    correct_answer,
    operandKey: pairKey(a, b),
    hint_steps: countingOnSteps(a, b, lang),
  }
}

// "Count on from 19: 20, 21, 22" is the right hint for a six-year-old and absurd once the
// numbers are in the thousands — the old version listed every single number from a+1 to a+b,
// which at this level would have written out two thousand of them. Past what a child would
// ever count, it points at the method they are actually taught instead.
// The run a count-on or count-back hint shows, stopping ONE SHORT of where it lands.
//
// It used to print the whole thing — "Count back 11 from 16: 15, 14, … 6, 5" — and the last
// number in that list is the answer. That breaks the rule at the top of this file, and it is
// the same rule the model is held to when it writes hints ("walk the child toward the answer
// WITHOUT ever stating it"). The child now says the last number themselves, which is the
// entire skill being practised.
function countRun(from, steps, dir) {
  const run = [from, ...Array.from({ length: Math.max(0, steps - 1) }, (_, i) => from + dir * (i + 1))]
  return `${run.join(', ')}, ?`
}

function countingOnSteps(a, b, lang) {
  if (isCountable(a, b)) {
    return [
      say(lang, `Try counting on from ${a}.`, `${a} sayısından ileri saymayı dene.`,
                `Prueba a contar hacia adelante desde ${a}.`),
      say(lang, `Count ${b} more starting at ${a}: ${countRun(a, b, 1)}`,
                `${a} sayısından ${b} tane ileri say: ${countRun(a, b, 1)}`,
                `Cuenta ${b} más empezando en ${a}: ${countRun(a, b, 1)}`),
    ]
  }
  // Which help a question gets is read off the number itself rather than passed in, so a
  // question can never be handed the wrong one: anything that partitions gets the mental walk,
  // and only genuinely columnar numbers — which now reach a child solely in paper mode — get
  // told to line up columns.
  if (placeParts(b).length <= MENTAL_PARTS) return partitionSteps(a, b, true, lang)
  return [
    say(lang, 'Line the two numbers up by their place value — ones under ones, tens under tens.',
              'Sayıları basamaklarına göre alt alta yaz — birler birlerin, onlar onların altına.',
              'Coloca los dos números uno debajo del otro: unidades con unidades, decenas con decenas.'),
    say(lang, 'Add each column from the right, carrying into the next when a column passes 9.',
              'Sağdan başlayarak her basamağı topla, 9\'u geçince bir sonraki basamağa elde ver.',
              'Suma cada columna empezando por la derecha y llévate una a la siguiente cuando pases de 9.'),
  ]
}

// ─── Subtraction ────────────────────────────────────────────────────────────

function subtractionTemplate(level, lang, columnar = false, plain = false) {
  const yb = bandForLevel(level)
  if (!plain && yb >= 2 && yb <= 4) return youngAddSub(level, lang, false, columnar)
  const { min, max } = rangeForLevel(level)
  // a is the larger operand, kept non-negative. Both bounds matter: drawing a uniformly
  // from the whole range put it near the floor half the time, and b then had nowhere to sit
  // but right beneath it, so 44% of "Subtraction up to 20" came out as 7 - 6 and the like.
  // a now comes from the upper part of the range and b leaves a gap, so the answer is
  // actually worth working out.
  // `max + 1` was written for an exclusive randInt; ours is inclusive, so it handed out
  // max + 1 — "21 - 5" inside a year whose curriculum says "subtraction within 20".
  const a = randInt(Math.max(min + 1, Math.round(max * 0.55)), max)
  const raw = randInt(min, Math.max(min, a - 3))
  const b = columnar ? raw : mentalise(raw)
  const correct_answer = a - b

  return {
    topic: 'subtraction',
    level,
    question_text: `${num(a, lang)} - ${num(b, lang)} = ?`,
    format: 'numeric',
    correct_answer,
    operandKey: pairKey(a, b),
    hint_steps: countingBackSteps(a, b, lang),
  }
}

// Same limit as counting on, for the same reason: counting back three thousand is not a hint.
function countingBackSteps(a, b, lang) {
  if (isCountable(a, b)) {
    return [
      say(lang, `Start at ${a} and take away ${b}.`, `${a} sayısından başla ve ${b} çıkar.`,
                `Empieza en ${a} y quita ${b}.`),
      say(lang, `Count back ${b} from ${a}: ${countRun(a, b, -1)}`,
                `${a} sayısından ${b} geri say: ${countRun(a, b, -1)}`,
                `Cuenta ${b} hacia atrás desde ${a}: ${countRun(a, b, -1)}`),
    ]
  }
  if (placeParts(b).length <= MENTAL_PARTS) return partitionSteps(a, b, false, lang)
  return [
    say(lang, 'Line the two numbers up by their place value — ones under ones, tens under tens.',
              'Sayıları basamaklarına göre alt alta yaz — birler birlerin, onlar onların altına.',
              'Coloca los dos números uno debajo del otro: unidades con unidades, decenas con decenas.'),
    say(lang, 'Subtract each column from the right, borrowing from the next column when you need to.',
              'Sağdan başlayarak her basamağı çıkar, gerektiğinde soldaki basamaktan onluk al.',
              'Resta cada columna empezando por la derecha y pide prestado a la siguiente cuando lo necesites.'),
  ]
}

// ─── Multiplication word problem ────────────────────────────────────────────
// Three different problem *shapes* (groups / array / reading-rate) so a 5-question batch
// doesn't read as the same sentence with the name swapped, plus object/name/container
// word banks so phrasing varies independently of the shape.

// Turkish takes no plural after a number — "3 misket", not "3 misketler" — so the Turkish
// banks are singular where the English ones are plural.
//
// The Spanish banks are all FEMININE, deliberately. Spanish agrees the question word with the
// noun — "¿Cuántas canicas?" but "¿Cuántos botones?" — and a bank mixing the two would need
// every sentence that names an object to carry its gender through as well. One gender in the
// bank costs a little variety and buys a sentence that is always grammatical; a wrong article
// in front of the noun is the kind of thing a child reads as the app not speaking their
// language. Same reason the containers are feminine: the group question says "cada una".
const MULT_NAMES = { en: ['Mia', 'Leo', 'Sam', 'Ada', 'Theo', 'Noah', 'Zoe', 'Iris'],
                     tr: ['Ada', 'Zeynep', 'Emir', 'Elif', 'Kaan', 'Deniz', 'Mert', 'Ece'],
                     es: ['Lucía', 'Mateo', 'Sofía', 'Diego', 'Valeria', 'Hugo', 'Emma', 'Martín'] }
const MULT_OBJECTS = { en: ['marbles', 'stickers', 'cookies', 'crayons', 'pencils', 'apples', 'shells', 'buttons'],
                       tr: ['misket', 'çıkartma', 'kurabiye', 'boya kalemi', 'kalem', 'elma', 'deniz kabuğu', 'düğme'],
                       es: ['canicas', 'pegatinas', 'galletas', 'ceras', 'manzanas', 'conchas', 'fichas', 'monedas'] }
const MULT_CONTAINERS = { en: ['baskets', 'boxes', 'jars', 'bags', 'bowls', 'trays'],
                          tr: ['sepet', 'kutu', 'kavanoz', 'torba', 'kâse', 'tepsi'],
                          es: ['cestas', 'cajas', 'bolsas', 'bandejas', 'huchas', 'jarras'] }

function multGroupsVariant(a, b, name, object, lang) {
  const container = pickL(MULT_CONTAINERS, lang)
  return {
    question_text: say(lang,
      `${name} has ${a} ${container}, each with ${b} ${object} inside. How many ${object} in total?`,
      `${name} ${a} ${container} hazırladı, her birinde ${b} ${object} var. Toplam kaç ${object} eder?`,
      `${name} tiene ${a} ${container} y en cada una hay ${b} ${object}. ¿Cuántas ${object} hay en total?`),
    hint_steps: [
      say(lang, `${name} has ${a} ${container} — that's ${a} equal groups.`, `${a} ${container} var — yani ${a} eşit grup.`,
                `Hay ${a} ${container}: son ${a} grupos iguales.`),
      say(lang, `Each group has ${b}, so it's ${a} groups of ${b}: ${a} × ${b}.`, `Her grupta ${b} tane var: ${a} × ${b}.`,
                `En cada grupo hay ${b}, así que son ${a} grupos de ${b}: ${a} × ${b}.`),
    ],
    visual: { kind: 'groups', groups: a, per: b },
  }
}

function multArrayVariant(a, b, name, object, lang) {
  return {
    question_text: say(lang,
      `${name} arranges ${object} in ${a} rows of ${b}. How many ${object} in total?`,
      `${name} ${object} dizdi: ${a} sıra, her sırada ${b} tane. Toplam kaç ${object} eder?`,
      `${name} coloca ${object} en ${a} filas de ${b}. ¿Cuántas ${object} hay en total?`),
    hint_steps: [
      say(lang, `Each row is one equal group of ${b} ${object}.`, `Her bir sıra eşit bir grup demek: ${b} ${object}.`,
                `Cada fila es un grupo igual de ${b} ${object}.`),
      say(lang, `${a} rows of ${b} is ${a} × ${b}.`, `${a} sıra × ${b} tane: ${a} × ${b}.`,
                `${a} filas de ${b} son ${a} × ${b}.`),
    ],
    visual: { kind: 'array', rows: a, cols: b },
  }
}

// Signature matches the other two even though this one has no object of its own: they are
// called through one `variant(...)` reference, so an argument out of place lands silently —
// this one was receiving the object name as its language.
function multReadingVariant(a, b, name, _object, lang) {
  return {
    question_text: say(lang,
      `${name} reads ${b} pages a day for ${a} days. How many pages does ${name} read in total?`,
      `${name} her gün ${b} sayfa okuyor. ${a} günde toplam kaç sayfa okur?`,
      `${name} lee ${b} páginas al día durante ${a} días. ¿Cuántas páginas lee en total?`),
    hint_steps: [
      say(lang, `Each day is one group of ${b} pages.`, `Her bir gün bir grup demek: ${b} sayfa.`,
                `Cada día es un grupo de ${b} páginas.`),
      say(lang, `That's ${a} days × ${b} pages: ${a} × ${b}.`, `Yani ${a} gün × ${b} sayfa: ${a} × ${b}.`,
                `Son ${a} días × ${b} páginas: ${a} × ${b}.`),
    ],
    // Days are the groups, pages the size — same picture as containers of objects.
    visual: { kind: 'groups', groups: a, per: b },
  }
}

const MULT_VARIANTS = [multGroupsVariant, multArrayVariant, multReadingVariant]

function multiplicationWordTemplate(level, lang) {
  // One factor comes from the tables the child's YEAR is actually learning; the other is a
  // plain multiplier. Which side it lands on varies, so a child does not only ever meet
  // "n groups of 5".
  //
  // By band, not by a raw level threshold, and that is the whole of the bug this replaced.
  // `bandForLevel` is `ceil(level/2)` and lands exactly on the school year, which is why
  // every other template in this file uses it — divisionWordTemplate included, with a comment
  // about the same failure. This one tested `level >= 10`, and a year owns TWO rungs: Year 5
  // sits on 9 or 10. So a ten-year-old on the lower rung of their own year dropped to the
  // Year 2 tables, and `2 × 2` came up in 3.1% of their multiplication questions.
  //
  // The sets are each year's own curriculum line, not a guess:
  //   Year 1-2  "the 2, 5 and 10 tables"
  //   Year 3    "the 3, 4 and 8 tables"
  //   Year 4    tables to 12 x 12, so the ones not already drilled
  //   Year 5+   past tables entirely — see contextMultiplication.
  const band = bandForLevel(level)
  // From Year 5 the numbers belong to the story; see contextMultiplication.
  if (band >= 5) return contextMultiplication(level, lang)
  // Years 2-4: the book's stories and missing factors take most slots; null keeps this one.
  const young = band >= 2 ? youngMultiplication(level, lang) : null
  if (young) return young
  const tables = band >= 4 ? [6, 7, 8, 9, 11, 12] : band >= 3 ? [3, 4, 8] : [2, 5, 10]
  const table = pick(tables)
  // Tables are taught to twelve, and stopping the multiplier at ten left the "x2 x5 x10"
  // rung with only 24 distinct problems once operandKey folds a x b and b x a together —
  // a child doing five sessions had seen all of them.
  const other = randInt(2, 12)
  const [a, b] = Math.random() < 0.5 ? [table, other] : [other, table]
  const correct_answer = a * b
  const name = pickL(MULT_NAMES, lang)
  const object = pickL(MULT_OBJECTS, lang)
  const variant = pick(MULT_VARIANTS)
  const { question_text, hint_steps, visual } = variant(a, b, name, object, lang)

  return {
    topic: 'multiplication-word',
    level,
    question_text,
    format: 'numeric',
    correct_answer,
    operandKey: pairKey(a, b),
    hint_steps,
    visual,
  }
}

// ─── Fraction of a number ───────────────────────────────────────────────────
// d is the denominator (2, 3, or 4); N is always a multiple of d so the answer is a
// whole number — no decimals/rounding to reason about at this level.

// One template, three shapes, picked by band — the same arrangement timeTemplate already uses.
// The two new ones are choice-format because their answers are fractions: a child cannot type
// 5/8 on a number pad, and asking them to would turn a fractions question into a typing puzzle.
// They only appear from Year 3, which is where adding same-denominator fractions and comparing
// unit fractions actually enter the curriculum.
// Percentage of an amount. Both Bond books ask this more than any other single thing, and the
// curriculum names it in Year 5, Year 6 and Year 7 — it is the shape that keeps coming back.
// The percentages are the ones a child can reach by halving and tenths rather than by
// multiplying a decimal, which is how it is taught before a calculator appears.
function fractionPercentOf(level, lang) {
  const band = bandForLevel(level)
  const pct = pick(band >= 7 ? [5, 10, 15, 20, 25, 30, 40, 60, 75, 80] : [10, 20, 25, 50, 75])
  // The amount is chosen so the answer is whole: percentages of 100 are the taught anchor.
  const amount = pick([20, 40, 50, 60, 80, 120, 140, 160, 200, 240, 300, 400, 500]) * (band >= 7 ? pick([1, 1, 2]) : 1)
  const answer = amount * pct / 100
  if (!Number.isInteger(answer)) return fractionPercentOf(level, lang)

  return {
    topic: 'fraction-of-number', level,
    question_text: say(lang,
      `What is ${pct}% of ${num(amount, lang)}?`,
      `${num(amount, lang)} sayısının %${pct} kadarı kaçtır?`,
      `¿Cuánto es el ${pct}% de ${num(amount, lang)}?`),
    format: 'numeric',
    correct_answer: answer,
    operandKey: `frac:pct:${pct}:${amount}`,
    hint_steps: [
      say(lang, `Per cent means "out of a hundred" — ${pct}% is ${pct} parts of every 100.`,
                `Yüzde demek "her yüzde" demek — %${pct}, her 100'ün ${pct} parçası.`,
                `Por ciento significa "de cada cien": el ${pct}% son ${pct} partes de cada 100.`),
      pct % 10 === 0
        ? say(lang, `Find 10% first by dividing by 10, then take as many tens as you need.`,
                    `Önce 10'a bölüp %10'u bul, sonra gerektiği kadar onluk al.`,
                    `Halla primero el 10% dividiendo entre 10 y luego toma tantas decenas como necesites.`)
        : say(lang, `Find 10% and 5% first — 10% is a tenth, and 5% is half of that.`,
                    `Önce %10 ve %5'i bul — %10 onda birdir, %5 de onun yarısı.`,
                    `Halla primero el 10% y el 5%: el 10% es la décima parte y el 5% la mitad de eso.`),
    ],
  }
}

// Year 7: percentage increase and decrease. Bond's "a £75 jacket with 15% off" and "journey
// times up 15%" are both this shape, and the mistake it catches is answering with the change
// instead of with the new amount.
function fractionPercentChange(level, lang) {
  const pct = pick([5, 10, 15, 20, 25, 50])
  const base = pick([40, 60, 80, 120, 160, 200, 240, 300, 400])
  const change = base * pct / 100
  if (!Number.isInteger(change)) return fractionPercentChange(level, lang)
  const up = Math.random() < 0.5
  const answer = up ? base + change : base - change
  return {
    topic: 'fraction-of-number', level,
    question_text: up
      ? say(lang,
          `A journey normally takes ${base} minutes. Today it takes ${pct}% longer. How many minutes is it today?`,
          `Bir yolculuk normalde ${base} dakika sürüyor. Bugün %${pct} daha uzun sürdü. Bugün kaç dakika sürdü?`,
          `Un viaje dura normalmente ${base} minutos. Hoy dura un ${pct}% más. ¿Cuántos minutos dura hoy?`)
      : say(lang,
          `A coat costs $${base}. In the sale it is ${pct}% off. How much does it cost now, in dollars?`,
          `Bir mont ${base} lira. İndirimde %${pct} iniyor. Şimdi kaç lira?`,
          `Un abrigo cuesta ${base} euros. En rebajas tiene un ${pct}% de descuento. ¿Cuánto cuesta ahora?`),
    format: 'numeric',
    correct_answer: answer,
    operandKey: `frac:pctch:${up ? 'up' : 'dn'}:${pct}:${base}`,
    hint_steps: [
      say(lang, `Work out the ${pct}% on its own first.`,
                `Önce %${pct}'in kendisini hesapla.`,
                `Calcula primero el ${pct}% por separado.`),
      up
        ? say(lang, `That much is ADDED to the original — the question asks for the new time, not the extra.`,
                    `O kadarı aslın ÜSTÜNE eklenir — soru yeni süreyi istiyor, fazlalığı değil.`,
                    `Esa cantidad se SUMA al original: la pregunta pide el tiempo nuevo, no lo que aumenta.`)
        : say(lang, `That much comes OFF the original — the question asks for the new price, not the discount.`,
                    `O kadarı asıldan DÜŞÜLÜR — soru yeni fiyatı istiyor, indirimi değil.`,
                    `Esa cantidad se RESTA del original: la pregunta pide el precio nuevo, no el descuento.`),
    ],
  }
}

// Simplifying a fraction with a common factor. A choice question: the answer is a fraction.
function fractionSimplify(level, lang) {
  const gcd = (x, y) => (y ? gcd(y, x % y) : x)
  let n, d
  do { n = randInt(1, 9); d = randInt(2, 12) } while (n >= d || gcd(n, d) !== 1)
  const f = randInt(2, 8)
  const N = n * f, D = d * f
  const correct = `${n}/${d}`

  const options = shuffle([
    { value: correct, why: say(lang,
        `Right — top and bottom both divide by ${f}.`,
        `Doğru — pay da payda da ${f}'e bölünür.`,
        `Correcto: arriba y abajo se dividen los dos entre ${f}.`) },
    { value: `${n * 2}/${d * 2}`, why: say(lang,
        `Not all the way — ${n * 2} and ${d * 2} still share a factor.`,
        `Sonuna kadar sadeleşmemiş — ${n * 2} ile ${d * 2} hâlâ ortak bölene sahip.`,
        `No del todo: ${n * 2} y ${d * 2} todavía comparten un divisor.`) },
    { value: `${N - f}/${D - f}`, why: say(lang,
        `${f} was subtracted from each. Simplifying DIVIDES both by the same number, it does not take it away.`,
        `Her ikisinden ${f} çıkarılmış. Sadeleştirme ikisini de aynı sayıya BÖLER, çıkarmaz.`,
        `Se ha restado ${f} a cada uno. Simplificar DIVIDE los dos entre el mismo número, no se lo resta.`) },
    { value: `${d}/${n}`, why: say(lang,
        `Upside down. ${N} was on top in the question, so its share stays on top.`,
        `Ters çevrilmiş. Soruda ${N} üstteydi, payı üstte kalır.`,
        `Del revés. En la pregunta ${N} estaba arriba, así que su parte se queda arriba.`) },
  ])

  return {
    topic: 'fraction-of-number', level,
    question_text: say(lang,
      `Write ${N}/${D} in its simplest form.`,
      `${N}/${D} kesrini en sade hâliyle yaz.`,
      `Escribe ${N}/${D} en su forma más simple.`),
    format: 'choice',
    options,
    correct_answer: correct,
    operandKey: `frac:simp:${N}:${D}`,
    hint_steps: [
      say(lang, `Find a number that goes into both the top and the bottom.`,
                `Hem payı hem paydayı bölen bir sayı bul.`,
                `Busca un número que entre en el de arriba y en el de abajo.`),
      say(lang, `Divide both by it, and check whether the new pair still share one.`,
                `İkisini de ona böl, sonra yeni çiftin hâlâ ortak böleni var mı diye bak.`,
                `Divide los dos entre él y comprueba si la nueva pareja todavía comparte alguno.`),
    ],
  }
}

// Adding fractions with DIFFERENT denominators — the Year 6 line, and a different skill from
// the same-denominator shape above it. One denominator is a multiple of the other, which is
// how it is taught first: only one of the two has to be changed.
function fractionAddDifferent(level, lang) {
  const d1 = pick([2, 3, 4, 5, 6])
  const mult = pick([2, 3, 4])
  const d2 = d1 * mult
  const n1 = randInt(1, d1 - 1)
  const n2 = randInt(1, d2 - 1)
  const sum = n1 * mult + n2
  if (sum >= d2) return fractionAddDifferent(level, lang)
  const correct = `${sum}/${d2}`

  const options = shuffle([
    { value: correct, why: say(lang,
        `Right — ${n1}/${d1} is the same as ${n1 * mult}/${d2}, and then the tops add.`,
        `Doğru — ${n1}/${d1} ile ${n1 * mult}/${d2} aynı şey, sonra paylar toplanır.`,
        `Correcto: ${n1}/${d1} es lo mismo que ${n1 * mult}/${d2}, y entonces se suman los de arriba.`) },
    { value: `${n1 + n2}/${d1 + d2}`, why: say(lang,
        `Tops added to tops and bottoms to bottoms. The bottom says how big a piece is — adding them changes the size of the pieces.`,
        `Paylar payla, paydalar paydayla toplanmış. Payda parçanın büyüklüğünü söyler — onları toplamak parça boyunu değiştirir.`,
        `Se han sumado los de arriba con los de arriba y los de abajo con los de abajo. El de abajo dice el tamaño del trozo.`) },
    { value: `${n1 + n2}/${d2}`, why: say(lang,
        `${n1}/${d1} was used as if it were ${n1}/${d2}. A ${d1}th is bigger than a ${d2}th, so it has to be rewritten first.`,
        `${n1}/${d1}, sanki ${n1}/${d2} imiş gibi kullanılmış. ${d1}'te bir, ${d2}'de birden büyüktür; önce yeniden yazılmalı.`,
        `Se ha usado ${n1}/${d1} como si fuera ${n1}/${d2}. Un ${d1}avo es mayor que un ${d2}avo, hay que reescribirlo antes.`) },
    { value: `${sum}/${d1}`, why: say(lang,
        `The right top number over the wrong bottom — the pieces were made ${d2}ths, so the answer is in ${d2}ths.`,
        `Pay doğru ama payda yanlış — parçalar ${d2}'de bire çevrildi, cevap da ${d2}'de bir cinsinden olur.`,
        `El numerador correcto sobre el denominador equivocado: los trozos se pasaron a ${d2}avos.`) },
  ])

  return {
    topic: 'fraction-of-number', level,
    question_text: say(lang,
      `What is ${n1}/${d1} + ${n2}/${d2}?`,
      `${n1}/${d1} + ${n2}/${d2} kaçtır?`,
      `¿Cuánto es ${n1}/${d1} + ${n2}/${d2}?`),
    format: 'choice',
    options,
    correct_answer: correct,
    operandKey: `frac:addiff:${n1}:${d1}:${n2}:${d2}`,
    hint_steps: [
      say(lang, `The pieces are different sizes, so they cannot be added yet.`,
                `Parçalar farklı büyüklükte, bu hâliyle toplanamaz.`,
                `Los trozos son de tamaños distintos, así que todavía no se pueden sumar.`),
      say(lang, `${d2} divides by ${d1}, so rewrite ${n1}/${d1} in ${d2}ths and then add the tops.`,
                `${d2}, ${d1}'e bölünüyor; ${n1}/${d1} kesrini ${d2}'de bir cinsinden yaz, sonra payları topla.`,
                `${d2} se divide entre ${d1}: reescribe ${n1}/${d1} en ${d2}avos y luego suma los de arriba.`),
    ],
  }
}

// Year 5 names "Decimals and Percentages", Year 6 "Fractions, Decimals, Percentages" and
// Year 7 the same again — one topic each, and a topic maps to one template, so all of it
// lives here. From band 5 the percentage shapes are the weight of the topic, which is also
// how both Bond books are balanced.
function fractionOfNumberTemplate(level, lang) {
  const band = bandForLevel(level)
  // 'shaded' — a drawn shape with some parts coloured — is the fraction question both of
  // Bond's younger books ask most, and every year from 1 to 4 names fractions "of a shape".
  const shapes = band <= 2 ? ['ofNumber', 'shaded', 'shaded']
    : band <= 3 ? ['ofNumber', 'addSame', 'compare', 'shaded', 'shaded']
      : band <= 4 ? ['ofNumber', 'addSame', 'compare', 'decimal', 'shaded']
        : band <= 6 ? ['percentOf', 'percentOf', 'simplify', 'addDifferent', 'decimal', 'compare', 'ofNumber']
          : ['percentOf', 'percentChange', 'percentChange', 'simplify', 'addDifferent', 'decimal']
  const shape = pick(shapes)
  if (shape === 'shaded') return fractionShaded(level, lang)
  if (shape === 'addSame') return fractionAddSame(level, lang)
  if (shape === 'compare') return fractionCompare(level, lang)
  if (shape === 'decimal') return fractionDecimal(level, lang)
  if (shape === 'percentOf') return fractionPercentOf(level, lang)
  if (shape === 'percentChange') return fractionPercentChange(level, lang)
  if (shape === 'simplify') return fractionSimplify(level, lang)
  if (shape === 'addDifferent') return fractionAddDifferent(level, lang)
  return fractionOfNumber(level, lang)
}

// 3/4 = 0.75, which Year 4 names outright. Decimals are typable, so this could have been a
// number-pad question — but the whole difficulty is that a fraction LOOKS like it can be read
// straight off as a decimal, and only a wrong option can say so back to the child.
//
// `near` is a real decimal of the same shape as the answer, so the answer cannot be picked out
// by how it is written. `nearAs` says what the near miss actually is: another fraction from the
// same family, or the answer with its digits pushed one place too far right.
const DECIMAL_BANK = [
  { n: 1, d: 2, dec: '0.5',  near: '0.05', nearAs: 'tenth' },
  { n: 1, d: 4, dec: '0.25', near: '0.75', nearAs: '3/4'   },
  { n: 3, d: 4, dec: '0.75', near: '0.25', nearAs: '1/4'   },
  { n: 1, d: 5, dec: '0.2',  near: '0.02', nearAs: 'tenth', band: 5 },
  { n: 2, d: 5, dec: '0.4',  near: '0.6',  nearAs: '3/5',   band: 5 },
  { n: 3, d: 5, dec: '0.6',  near: '0.4',  nearAs: '2/5',   band: 5 },
  { n: 4, d: 5, dec: '0.8',  near: '0.08', nearAs: 'tenth', band: 5 },
]

function fractionDecimal(level, lang) {
  const band = bandForLevel(level)
  const e = pick(DECIMAL_BANK.filter(x => (x.band ?? 0) <= band))
  const { n, d } = e
  // What the child reads, in their language's decimal mark; the option VALUES keep their point.
  const D = v => dnum(v, lang)

  const options = shuffle([
    { value: e.dec, why: say(lang,
        `Right — ${n}/${d} of one whole is ${D(e.dec)}.`,
        `Doğru — bir bütünün ${n}/${d} kadarı ${D(e.dec)} eder.`,
        `Correcto: ${n}/${d} de una unidad es ${D(e.dec)}.`) },
    { value: `0.${n}${d}`, why: say(lang,
        `That is the fraction read off digit by digit. ${n}/${d} is a division, not two digits after a point.`,
        `Bu, kesrin rakam rakam okunmuş hâli. ${n}/${d} bir bölme işlemidir, virgülden sonra iki rakam değil.`,
        `Eso es la fracción leída cifra a cifra. ${n}/${d} es una división, no dos cifras detrás de la coma.`) },
    { value: `0.${d}`, why: say(lang,
        `That is the bottom number after the point. The bottom number says how many pieces the whole was cut into — it is not the answer itself.`,
        `Bu, alttaki sayının virgülden sonra yazılmışı. Alttaki sayı bütünün kaç parçaya bölündüğünü söyler — cevabın kendisi değildir.`,
        `Eso es el número de abajo puesto detrás de la coma. El número de abajo dice en cuántos trozos se partió la unidad; no es la respuesta.`) },
    { value: e.near, why: e.nearAs === 'tenth'
        ? say(lang, `Ten times too small — ${D(e.near)} is a tenth of ${D(e.dec)}.`,
                    `On kat küçük — ${D(e.near)}, ${D(e.dec)} sayısının onda biri.`,
                    `Diez veces más pequeño: ${D(e.near)} es la décima parte de ${D(e.dec)}.`)
        : say(lang, `${D(e.near)} is ${e.nearAs}, not ${n}/${d}.`,
                    `${D(e.near)} sayısı ${e.nearAs} eder, ${n}/${d} değil.`,
                    `${D(e.near)} es ${e.nearAs}, no ${n}/${d}.`) },
  ])

  return {
    topic: 'fraction-of-number', level,
    question_text: say(lang, `What is ${n}/${d} written as a decimal?`, `${n}/${d} ondalık sayıyla nasıl yazılır?`,
                             `¿Cómo se escribe ${n}/${d} en número decimal?`),
    format: 'choice',
    options,
    correct_answer: e.dec,
    operandKey: `frac:dec:${n}/${d}`,
    hint_steps: [
      say(lang, 'A decimal is another way of writing part of one whole.',
                'Ondalık sayı, bir bütünün parçasını yazmanın başka bir yoludur.',
                'Un número decimal es otra forma de escribir una parte de la unidad.'),
      // Money is the anchor, but the hint stops at the money: writing "…, written 0.25" handed
      // over the answer, which is exactly what these steps must not do. Dollars rather than
      // pounds for English — the same choice the model's prompt makes, and for the same
      // reason: these readers are not all in Britain. Spanish gets euros, the same currency
      // its prompt asks for; see the note on es-ES in i18n.js.
      say(lang, `Think of money: $1 is 100 cents, and ${n}/${d} of it is ${Math.round(Number(e.dec) * 100)} cents.`,
                `Parayı düşün: 1 lira 100 kuruştur, ${n}/${d} kadarı ${Math.round(Number(e.dec) * 100)} kuruş eder.`,
                `Piensa en el dinero: 1 € son 100 céntimos, y ${n}/${d} de eso son ${Math.round(Number(e.dec) * 100)} céntimos.`),
    ],
  }
}

// 2/8 + 3/8. The mistake worth catching is adding the denominators too, which is why 5/16 is
// always on offer.
function fractionAddSame(level, lang) {
  const band = bandForLevel(level)
  const d = pick(band >= 5 ? [6, 8, 10, 12] : [5, 6, 8, 10])
  // The sum stays a proper fraction with room for a near miss above it, so a+b <= d-2. Building
  // the candidates rather than rolling and rejecting means no d can come up empty.
  const pairs = []
  for (let x = 1; x <= d - 3; x++) for (let y = x + 1; x + y <= d - 2; y++) pairs.push([x, y])
  // Shuffled so the smaller numerator is not always written first.
  const [a, b] = shuffle(pick(pairs))
  const sum = a + b

  const correct = `${sum}/${d}`
  const options = shuffle([
    { value: correct, why: say(lang,
        `Right — the pieces are the same size, so only the top numbers add: ${a} + ${b} = ${sum}.`,
        `Doğru — parçalar aynı büyüklükte, sadece üstteki sayılar toplanır: ${a} + ${b} = ${sum}.`,
        `Correcto: los trozos son del mismo tamaño, así que solo se suman los números de arriba: ${a} + ${b} = ${sum}.`) },
    { value: `${sum}/${d + d}`, why: say(lang,
        `The bottom numbers were added too. ${d} and ${d} mean the same size piece, so the bottom stays ${d}.`,
        `Alttaki sayılar da toplanmış. ${d} ile ${d} aynı büyüklükte parça demek, alt sayı ${d} kalır.`,
        `Aquí también se han sumado los números de abajo. ${d} y ${d} son trozos del mismo tamaño, así que abajo se queda ${d}.`) },
    { value: `${Math.abs(a - b)}/${d}`, why: say(lang,
        `That is ${Math.max(a, b)} take away ${Math.min(a, b)}. The question adds them.`,
        `Bu ${Math.max(a, b)} eksi ${Math.min(a, b)} olur. Soruda toplama isteniyor.`,
        `Eso es ${Math.max(a, b)} menos ${Math.min(a, b)}. La pregunta los suma.`) },
    { value: `${sum + 1}/${d}`, why: say(lang,
        `One piece too many — count again: ${a} + ${b}.`,
        `Bir parça fazla — tekrar say: ${a} + ${b}.`,
        `Un trozo de más: cuenta otra vez ${a} + ${b}.`) },
  ])

  return {
    topic: 'fraction-of-number', level,
    question_text: say(lang, `What is ${a}/${d} + ${b}/${d}?`, `${a}/${d} + ${b}/${d} kaçtır?`,
                             `¿Cuánto es ${a}/${d} + ${b}/${d}?`),
    format: 'choice',
    options,
    correct_answer: correct,
    operandKey: `frac:add:${d}:${pairKey(a, b)}`,
    hint_steps: [
      say(lang, 'Both fractions cut the whole into the same number of pieces.',
                'İki kesir de bütünü aynı sayıda parçaya bölüyor.',
                'Las dos fracciones parten la unidad en el mismo número de trozos.'),
      say(lang, 'So count how many pieces in total — the bottom number does not change.',
                'O yüzden toplam kaç parça olduğunu say — alttaki sayı değişmez.',
                'Así que cuenta cuántos trozos hay en total: el número de abajo no cambia.'),
    ],
  }
}

// Which of 1/4, 1/3, 1/2, 1/5 is largest. Every child's first instinct is that 1/5 wins because
// 5 is the biggest number, so the options ARE the misconception — no distractor to invent.
function fractionCompare(level, lang) {
  const band = bandForLevel(level)
  const pool = band >= 5 ? [2, 3, 4, 5, 6, 8, 10, 12] : [2, 3, 4, 5, 6, 8]
  const denoms = shuffle(pool).slice(0, 4)
  const smallest = Math.min(...denoms)
  const correct = `1/${smallest}`

  const options = denoms.map(d => d === smallest
    ? { value: `1/${d}`, why: say(lang,
        `Right — cut into only ${d}, so each piece is the biggest.`,
        `Doğru — sadece ${d} parçaya bölünmüş, o yüzden her parça en büyüğü.`,
        `Correcto: solo está partida en ${d}, así que cada trozo es el más grande.`) }
    : { value: `1/${d}`, why: say(lang,
        `1/${d} cuts the whole into ${d} pieces; 1/${smallest} cuts it into only ${smallest}, so those pieces are bigger.`,
        `1/${d} bütünü ${d} parçaya böler; 1/${smallest} ise sadece ${smallest} parçaya böler, o parçalar daha büyük.`,
        `1/${d} parte la unidad en ${d} trozos; 1/${smallest} la parte solo en ${smallest}, así que esos trozos son más grandes.`) })

  return {
    topic: 'fraction-of-number', level,
    question_text: say(lang, 'Which of these is the largest?', 'Bunlardan hangisi en büyüktür?',
                             '¿Cuál de estas es la más grande?'),
    format: 'choice',
    options,
    correct_answer: correct,
    operandKey: `frac:cmp:${[...denoms].sort((x, y) => x - y).join('-')}`,
    hint_steps: [
      say(lang, 'The bottom number says how many pieces the whole was cut into.',
                'Alttaki sayı, bütünün kaç parçaya bölündüğünü söyler.',
                'El número de abajo dice en cuántos trozos se partió la unidad.'),
      say(lang, 'The more pieces you cut it into, the smaller each piece gets.',
                'Kaç parçaya çok bölersen, her bir parça o kadar küçülür.',
                'Cuantos más trozos hagas, más pequeño es cada uno.'),
    ],
  }
}

function fractionOfNumber(level, lang) {
  // `level` used to be accepted and ignored, which had two consequences: a question at
  // "Fractions & Decimals" was identical to one at "Fractions", and the topic could only
  // ever produce 3 x 5 = 15 distinct problems — so a 5-question session used a third of
  // everything there was, and the next session was bound to repeat it.
  // The one step at level 12 was the whole of the scaling, so a ten-year-old and a six-year-old
  // both got "1/3 of 6". It follows the year now: bigger denominators and bigger wholes.
  const { max } = rangeForLevel(level)
  const band = bandForLevel(level)
  // Year 1 gets halves and quarters and nothing else. Its topic is called "Half and Quarter"
  // and its curriculum line is "a half as 1 of 2 equal parts... a quarter as 1 of 4 equal
  // parts" — thirds are not in it. A 100-question audit found "What is 1/3 of 18?" filed
  // under that topic for a six-year-old. The topic label is not decoration: the parent report
  // and the progress record both read it, so a question outside it misstates which skill the
  // child has shown. Thirds enter at Year 2, whose line names 1/3 outright.
  const denominators = band >= 5 ? [2, 3, 4, 5, 6, 8, 10, 12]
    : band >= 3 ? [2, 3, 4, 5, 6, 8]
      : band >= 2 ? [2, 3, 4]
        : [2, 4]
  const d = pick(denominators)
  const multiplier = randInt(band >= 5 ? 6 : band >= 3 ? 3 : 2, band >= 5 ? 25 : band >= 3 ? 12 : 6)
  // The whole N has to fit the year: 1/4 of 24 is outside a Year 1 that works within 20.
  const N = Math.min(d * multiplier, Math.floor(max / d) * d)
  const correct_answer = N / d

  return {
    topic: 'fraction-of-number',
    level,
    question_text: say(lang, `What is 1/${d} of ${N}?`, `${N} sayısının 1/${d} kadarı kaçtır?`,
                             `¿Cuánto es 1/${d} de ${N}?`),
    format: 'numeric',
    correct_answer,
    operandKey: pairKey(d, N),
    // Same picture as division — split into equal groups — with one group singled out,
    // which is exactly what "1/d of N" asks for.
    visual: shareVisual(N, d, 1),
    // Stops at method, never states the final share — the child does that last step.
    hint_steps: [
      say(lang, `1/${d} means splitting into ${d} equal groups.`, `1/${d}, ${d} eşit gruba ayırmak demek.`,
                `1/${d} significa repartir en ${d} grupos iguales.`),
      say(lang, `Split ${N} into ${d} equal groups: ${N} ÷ ${d}.`, `${N} sayısını ${d} eşit gruba ayır: ${N} ÷ ${d}.`,
                `Reparte ${N} en ${d} grupos iguales: ${N} ÷ ${d}.`),
    ],
  }
}

// ─── Division word problem ──────────────────────────────────────────────────
// Up to Year 4, a is always a multiple of b so the share is a whole number. Remainders start
// in Year 5, where contextDivision takes over.

const DIV_NAMES = MULT_NAMES
const DIV_ITEMS = { en: ['candies', 'stickers', 'cookies', 'marbles', 'balloons', 'crayons', 'pencils', 'stamps'],
                    tr: ['şeker', 'çıkartma', 'kurabiye', 'misket', 'balon', 'boya kalemi', 'kalem', 'pul'],
                    es: ['golosinas', 'pegatinas', 'galletas', 'canicas', 'ceras', 'fichas', 'monedas', 'conchas'] }
// The Turkish list is short on purpose rather than a translation of the English one: with
// "sınıf arkadaşı" and "takım arkadaşı" in it, the longest roll of this template ran past a
// seven-year-old's reading limit on its own. Every entry here is one word. The Spanish list
// is short for the same reason — "compañeros" alone costs eleven characters of a ninety-
// character question, and Spanish sentences already run longer than their English originals.
const DIV_WHO = { en: ['friends', 'classmates', 'kids', 'teammates'],
                  tr: ['arkadaş', 'öğrenci', 'çocuk', 'kardeş'],
                  es: ['amigos', 'primos', 'niños', 'vecinos'] }

function divisionWordTemplate(level, lang) {
  // Division used to occupy a single rung, so it took no notice of the level at all — which
  // is why a Year 5 session could be handed "28 shared among 4". It follows the year now.
  const band = bandForLevel(level)
  // From Year 5: context-sized numbers and remainders; see contextDivision. Year 6's two-digit
  // divisors ("divide up to 4 digits by a 2-digit number using long division") live there too.
  if (band >= 5) return contextDivision(level, lang)
  const young = band >= 2 ? youngDivision(level, lang) : null
  if (young) return young
  const b = band >= 3 ? pick([2, 3, 4, 5, 6, 8]) : pick([2, 3, 4, 5])
  const multiplier = randInt(band >= 3 ? 3 : 2, band >= 3 ? 12 : 9)
  const a = b * multiplier
  const correct_answer = a / b
  const name = pickL(DIV_NAMES, lang)
  const items = pickL(DIV_ITEMS, lang)
  const who = pickL(DIV_WHO, lang)

  return {
    topic: 'division-word',
    level,
    // One sentence with a subject in it. The English used to read "Mia has 45 candies. Shared
    // equally among 5 teammates. How many each?" — a sentence, then a participle phrase with
    // nobody doing the sharing, then a question with no noun. A hundred-question audit picked
    // it out, and it is the kind of thing a template repeats at every age until someone does.
    // The longest roll of the new wording is 77 characters against a seven-year-old's 90.
    // Turkish and Spanish were already whole sentences and are left alone.
    question_text: say(lang,
      `${name} shares ${a} ${items} equally among ${b} ${who}. How many does each get?`,
      `${name} ${a} ${items} aldı. ${b} ${who} arasında eşit paylaştırdı. Her birine kaç düşer?`,
      `${name} reparte ${a} ${items} entre ${b} ${who}. ¿Cuántas le tocan a cada uno?`),
    format: 'numeric',
    correct_answer,
    operandKey: pairKey(a, b),
    visual: shareVisual(a, b),
    // Stops at method, never states the final share — the child does that last step.
    hint_steps: [
      say(lang, `${a} shared into ${b} equal groups.`, `${a} tane, ${b} eşit gruba paylaştırılıyor.`,
                `${a} se reparten en ${b} grupos iguales.`),
      say(lang, `Split ${a} into ${b} groups: ${a} ÷ ${b}.`, `${a} sayısını ${b} gruba ayır: ${a} ÷ ${b}.`,
                `Reparte ${a} en ${b} grupos: ${a} ÷ ${b}.`),
    ],
  }
}

// ─── Word problems from Year 5 up: the context carries the numbers ──────────
// Bond's 10-11 book (10 Minute Tests) never asks a bare multi-digit sum, and every one of its
// multiplication and division questions puts the big number on the thing that is big: "a coach
// holds 52 passengers, 12 coaches are full", "a crate holds 24 cans, Simon wants 312", "2800
// fans, each coach has 53 seats", "435 pupils in classes of 23". Our template rolled the two
// numbers first and a sentence afterwards, with a coin toss for which number went where, and
// so a ten-year-old was asked about "93 baskets, each with 8 buttons" — right sum, a story no
// one would tell. From Year 5 each context owns the range of each of its numbers, so a coach
// always seats forty-odd and a school never has ninety classes.
//
// Ranges are the year's curriculum line held inside what reads true:
//   Year 5  "multiply numbers up to 4 digits by a 1-digit or 2-digit number" — here a two-digit
//           amount times a one-digit count, or the reverse where the context makes the count big
//   Year 6  long multiplication — two digits by two digits, and the counts grow with it
// The hint splits the larger factor by place value and stops at the parts, never the product.

function multSplitHint(a, b, lang) {
  // Split whichever factor has two non-zero digits; keep the other whole.
  const [big, small] = a >= b ? [a, b] : [b, a]
  const parts = placeParts(big)
  if (parts.length < 2) {
    const k = big / 10 ** (String(big).length - 1)
    return say(lang, `${num(big, lang)} is a round number: work out ${small} × ${k} first, then put the zeros back on.`,
                     `${num(big, lang)} yuvarlak bir sayı: önce ${small} × ${k} işlemini yap, sonra sıfırları geri ekle.`,
                     `${num(big, lang)} es un número redondo: calcula primero ${small} × ${k} y luego añade los ceros.`)
  }
  const [p, q] = [parts[0], big - parts[0]]
  return say(lang, `Split ${num(big, lang)} into ${num(p, lang)} and ${num(q, lang)}: work out ${small} × ${num(p, lang)} and ${small} × ${num(q, lang)}, then add the two.`,
                   `${num(big, lang)} sayısını ${num(p, lang)} ve ${num(q, lang)} diye ayır: ${small} × ${num(p, lang)} ve ${small} × ${num(q, lang)} işlemlerini yap, sonra ikisini topla.`,
                   `Separa ${num(big, lang)} en ${num(p, lang)} y ${num(q, lang)}: calcula ${small} × ${num(p, lang)} y ${small} × ${num(q, lang)}, y suma los dos.`)
}

// Each context: `size` is the amount in one group, `count` the number of groups, both per
// year; `text` writes the question and `group` the first hint (what one group is).
const MULT_CONTEXTS = [
  { id: 'coach',
    size: { 5: [40, 57], 6: [40, 57] }, count: { 5: [3, 9], 6: [11, 19] },
    text: (lang, g, s) => say(lang,
      `A coach holds ${s} passengers. ${g} full coaches go on a school trip. How many passengers is that?`,
      `Bir otobüs ${s} yolcu alıyor. Okul gezisine ${g} dolu otobüs gidiyor. Toplam kaç yolcu eder?`,
      `Un autocar lleva ${s} pasajeros. Van ${g} autocares llenos de excursión. ¿Cuántos pasajeros son?`),
    group: (lang, g, s) => say(lang, `Each coach is one group of ${s}, and there are ${g} of them.`,
      `Her otobüs ${s} kişilik bir grup ve ${g} otobüs var.`, `Cada autocar es un grupo de ${s}, y hay ${g}.`) },
  { id: 'crate',
    size: { 5: [12, 48], 6: [12, 48] }, count: { 5: [3, 9], 6: [12, 25] }, sizes: [12, 18, 24, 36, 48],
    text: (lang, g, s) => say(lang,
      `A crate holds ${s} cans of juice. How many cans are there in ${g} full crates?`,
      `Bir kasaya ${s} kutu meyve suyu sığıyor. ${g} dolu kasada kaç kutu vardır?`,
      `En una caja caben ${s} latas de zumo. ¿Cuántas latas hay en ${g} cajas llenas?`),
    group: (lang, g, s) => say(lang, `${g} crates, each with ${s} cans: ${g} groups of ${s}.`,
      `${g} kasa var, her birinde ${s} kutu: ${g} eşit grup.`, `${g} cajas con ${s} latas cada una: ${g} grupos de ${s}.`) },
  { id: 'rows',
    size: { 5: [3, 9], 6: [11, 19] }, count: { 5: [12, 25], 6: [11, 25] },
    text: (lang, g, s, name) => say(lang,
      `${name} plants ${g} rows of cabbages with ${s} cabbages in each row. How many cabbages is that?`,
      `${name} bahçeye ${g} sıra lahana dikiyor, her sırada ${s} lahana var. Toplam kaç lahana eder?`,
      `${name} planta ${g} filas de lechugas con ${s} lechugas en cada fila. ¿Cuántas lechugas son?`),
    group: (lang, g, s) => say(lang, `Each row is a group of ${s}, and there are ${g} rows.`,
      `Her sıra ${s} lahanalık bir grup, ${g} sıra var.`, `Cada fila es un grupo de ${s}, y hay ${g} filas.`) },
  { id: 'tickets',
    size: { 5: [3, 9], 6: [12, 25] }, count: { 5: [24, 99], 6: [31, 99] },
    text: (lang, g, s) => say(lang,
      `Tickets for the school play cost $${s} each. ${g} tickets are sold. How much money is that, in dollars?`,
      `Okul oyununun biletinin tanesi ${s} lira. ${g} bilet satıldı. Toplam kaç lira toplandı?`,
      `Cada entrada para la obra del colegio cuesta ${s} euros. Se venden ${g}. ¿Cuántos euros se recaudan?`),
    group: (lang, g, s) => say(lang, `Every ticket brings in $${s}, and ${g} were sold.`,
      `Her bilet ${s} lira getiriyor ve ${g} bilet satıldı.`, `Cada entrada deja ${s} euros, y se vendieron ${g}.`) },
  { id: 'classes',
    size: { 5: [24, 32], 6: [24, 32] }, count: { 5: [3, 9], 6: [11, 19] },
    text: (lang, g, s) => say(lang,
      `A school has ${g} classes with ${s} pupils in each. How many pupils are there altogether?`,
      `Bir okulda ${g} sınıf var ve her sınıfta ${s} öğrenci okuyor. Okulda toplam kaç öğrenci var?`,
      `Un colegio tiene ${g} clases con ${s} alumnos en cada una. ¿Cuántos alumnos hay en total?`),
    group: (lang, g, s) => say(lang, `Each class is a group of ${s}, and there are ${g} classes.`,
      `Her sınıf ${s} kişilik bir grup, ${g} sınıf var.`, `Cada clase es un grupo de ${s}, y hay ${g} clases.`) },
  { id: 'eggs',
    size: { 5: [6, 12], 6: [12, 12] }, count: { 5: [13, 99], 6: [110, 250] }, sizes: [6, 12],
    text: (lang, g, s) => say(lang,
      `A farm packs its eggs in boxes of ${s}. Today it fills ${g} boxes. How many eggs is that?`,
      `Bir çiftlik yumurtaları kutulara koyuyor, her kutuya ${s} yumurta giriyor. Bugün ${g} kutu doldu. Toplam kaç yumurta eder?`,
      `Una granja guarda los huevos en cajas de ${s}. Hoy llena ${g} cajas. ¿Cuántos huevos son?`),
    group: (lang, g, s) => say(lang, `Each box is a group of ${s}, and there are ${g} boxes.`,
      `Her kutu ${s} yumurtalık bir grup, ${g} kutu var.`, `Cada caja es un grupo de ${s}, y hay ${g} cajas.`) },
  { id: 'reading',
    size: { 5: [12, 30], 6: [12, 25] }, count: { 5: [3, 9], 6: [14, 30] },
    text: (lang, g, s, name) => say(lang,
      `${name} reads ${s} pages a day for ${g} days. How many pages is that?`,
      `${name} her gün ${s} sayfa okuyor. ${g} günde toplam kaç sayfa okur?`,
      `${name} lee ${s} páginas al día durante ${g} días. ¿Cuántas páginas lee?`),
    group: (lang, g, s) => say(lang, `Every day is a group of ${s} pages, and there are ${g} days.`,
      `Her gün ${s} sayfalık bir grup, ${g} gün var.`, `Cada día es un grupo de ${s} páginas, y hay ${g} días.`) },
]

function contextMultiplication(level, lang) {
  const band = Math.min(bandForLevel(level), 6)
  const ctx = pick(MULT_CONTEXTS)
  const s = ctx.sizes ? pick(ctx.sizes.filter(x => x >= ctx.size[band][0] && x <= ctx.size[band][1])) : randInt(...ctx.size[band])
  const g = randInt(...ctx.count[band])
  const name = pickL(MULT_NAMES, lang)
  return {
    topic: 'multiplication-word',
    level,
    question_text: ctx.text(lang, g, s, name),
    format: 'numeric',
    correct_answer: g * s,
    operandKey: pairKey(g, s),
    hint_steps: [ctx.group(lang, g, s), multSplitHint(g, s, lang)],
  }
}

// Division from Year 5 has four questions, not one, because the curriculum line has a clause
// the old template could not ask: "interpret remainders appropriately". Half of Bond's division
// questions turn on it — "how many coaches are required" rounds UP (the last few fans still
// travel), "how many complete pieces" rounds DOWN (the offcut is not a piece), and "how many
// are left over" asks for the remainder itself. The old template divided exactly, every time.
// A context lists the years it belongs to through `div`: a minibus of eight is a Year 5
// divisor and a coach of fifty-three a Year 6 one, and a year with no range never sees it.
// `q` narrows how many groups come out where the default would read false — a plank cut into
// sixty pieces is fourteen metres long, and nobody hires forty-six minibuses. `sizes` is the
// same idea for the divisor: crates come in dozens, not in twenty-nines.
const DIV_CONTEXTS = {
  exact: [
    { id: 'crates', div: { 5: [6, 9], 6: [12, 48] }, sizes: { 6: [12, 18, 24, 36, 48] },
      text: (lang, n, d) => say(lang,
        `A crate holds ${d} cans. How many crates do ${num(n, lang)} cans fill exactly?`,
        `Bir kasaya ${d} kutu sığıyor. ${num(n, lang)} kutu tam olarak kaç kasayı doldurur?`,
        `En una caja caben ${d} latas. ¿Cuántas cajas se llenan justas con ${num(n, lang)} latas?`) },
    { id: 'teams', div: { 5: [6, 9] },
      text: (lang, n, d) => say(lang,
        `${num(n, lang)} children are split into teams of ${d}, with nobody left out. How many teams are there?`,
        `${num(n, lang)} çocuk ${d} kişilik takımlara ayrılıyor, kimse dışarıda kalmıyor. Kaç takım olur?`,
        `${num(n, lang)} niños se reparten en equipos de ${d} y no sobra nadie. ¿Cuántos equipos hay?`) },
    { id: 'classes', div: { 6: [21, 32] },
      text: (lang, n, d) => say(lang,
        `${num(n, lang)} pupils are put into classes of ${d}, and every class is full. How many classes are there?`,
        `${num(n, lang)} öğrenci ${d} kişilik sınıflara yerleşiyor ve bütün sınıflar tam dolu. Kaç sınıf var?`,
        `${num(n, lang)} alumnos se reparten en clases de ${d} y todas quedan llenas. ¿Cuántas clases hay?`) },
  ],
  up: [
    { id: 'minibus', div: { 5: [7, 9] }, q: { 5: [8, 16] }, need: ['a minibus', 'bir minibüs', 'un microbús'],
      text: (lang, n, d) => say(lang,
        `${num(n, lang)} children are going on a trip. A minibus has ${d} seats. How many minibuses are needed?`,
        `${num(n, lang)} çocuk geziye gidiyor. Bir minibüste ${d} koltuk var. Kaç minibüs gerekir?`,
        `${num(n, lang)} niños van de excursión. Un microbús tiene ${d} asientos. ¿Cuántos microbuses hacen falta?`) },
    { id: 'coach', div: { 6: [45, 57] }, need: ['a coach', 'bir otobüs', 'un autocar'],
      text: (lang, n, d) => say(lang,
        `${num(n, lang)} fans are going to a match. Each coach has ${d} seats. How many coaches are needed?`,
        `${num(n, lang)} taraftar maça gidiyor. Her otobüste ${d} koltuk var. Kaç otobüs gerekir?`,
        `${num(n, lang)} aficionados van a un partido. Cada autocar tiene ${d} asientos. ¿Cuántos autocares hacen falta?`) },
    { id: 'tables', div: { 5: [4, 8] }, q: { 5: [12, 40] }, need: ['a table', 'bir masa', 'una mesa'],
      text: (lang, n, d) => say(lang,
        `${num(n, lang)} guests are coming to a party. Each table seats ${d}. How many tables are needed?`,
        `Bir partiye ${num(n, lang)} misafir geliyor. Her masada ${d} kişi oturabiliyor. Kaç masa gerekir?`,
        `A una fiesta vienen ${num(n, lang)} invitados. En cada mesa caben ${d}. ¿Cuántas mesas hacen falta?`) },
    { id: 'boxes', div: { 6: [12, 25] }, need: ['a box', 'bir kutu', 'una caja'],
      text: (lang, n, d) => say(lang,
        `The library is packing ${num(n, lang)} books. A box holds ${d} books. How many boxes are needed?`,
        `Kütüphane ${num(n, lang)} kitabı kutuluyor. Bir kutuya ${d} kitap sığıyor. Kaç kutu gerekir?`,
        `La biblioteca empaqueta ${num(n, lang)} libros. En una caja caben ${d}. ¿Cuántas cajas hacen falta?`) },
  ],
  down: [
    { id: 'wood', div: { 5: [3, 9], 6: [12, 35] }, q: { 5: [12, 40], 6: [6, 20] },
      text: (lang, n, d) => say(lang,
        `A length of wood is ${num(n, lang)} cm long. It is cut into pieces ${d} cm long. How many complete pieces are made?`,
        `${num(n, lang)} cm uzunluğunda bir tahta, ${d} cm uzunluğunda parçalara kesiliyor. Kaç tam parça çıkar?`,
        `Un listón de ${num(n, lang)} cm se corta en trozos de ${d} cm. ¿Cuántos trozos enteros salen?`) },
    { id: 'pencils', div: { 5: [6, 9] }, q: { 5: [12, 40] },
      text: (lang, n, d) => say(lang,
        `A shop packs ${num(n, lang)} pencils into boxes of ${d}. How many boxes can it fill?`,
        `Bir dükkân ${num(n, lang)} kalemi kutulara koyuyor, her kutuya ${d} kalem giriyor. Kaç kutu dolar?`,
        `Una tienda mete ${num(n, lang)} lápices en cajas de ${d}. ¿Cuántas cajas puede llenar?`) },
    { id: 'ribbon', div: { 6: [15, 40] }, q: { 6: [8, 30] },
      text: (lang, n, d) => say(lang,
        `A roll of ribbon is ${num(n, lang)} cm long. Each bow needs ${d} cm. How many bows can be made?`,
        `Bir rulo kurdele ${num(n, lang)} cm uzunluğunda. Her fiyonk için ${d} cm gerekiyor. Kaç fiyonk yapılabilir?`,
        `Un rollo de cinta mide ${num(n, lang)} cm. Cada lazo necesita ${d} cm. ¿Cuántos lazos se pueden hacer?`) },
  ],
  left: [
    { id: 'eggs', div: { 5: [6, 6], 6: [12, 12] },
      text: (lang, n, d) => say(lang,
        `${num(n, lang)} eggs are packed into boxes of ${d}. Only full boxes are sold. How many eggs are left over?`,
        `${num(n, lang)} yumurta, her birine ${d} yumurta giren kutulara konuyor. Yalnız dolu kutular satılıyor. Kaç yumurta artar?`,
        `${num(n, lang)} huevos se guardan en cajas de ${d}. Solo se venden cajas llenas. ¿Cuántos huevos sobran?`) },
    { id: 'stickers', div: { 5: [3, 9], 6: [12, 15] },
      text: (lang, n, d) => say(lang,
        `${num(n, lang)} stickers are shared equally between ${d} children. How many stickers are left over?`,
        `${num(n, lang)} çıkartma ${d} çocuğa eşit olarak paylaştırılıyor. Kaç çıkartma artar?`,
        `Se reparten ${num(n, lang)} pegatinas a partes iguales entre ${d} niños. ¿Cuántas pegatinas sobran?`) },
  ],
}

function contextDivision(level, lang) {
  const band = Math.min(bandForLevel(level), 6)
  const mode = pick(['exact', 'up', 'up', 'down', 'down', 'left'])
  const ctx = pick(DIV_CONTEXTS[mode].filter(c => c.div[band]))
  const d = ctx.sizes?.[band] ? pick(ctx.sizes[band]) : randInt(...ctx.div[band])
  // The quotient is the year's size: Year 5 divides up to three digits by one, Year 6 up to four
  // by two. Remainder 1 is avoided for "up", where it makes the question feel like a trick.
  const q = ctx.q?.[band] ? randInt(...ctx.q[band]) : band >= 6 ? randInt(11, 60) : randInt(12, 60)
  const r = mode === 'exact' ? 0 : randInt(mode === 'up' ? 2 : 1, d - 1)
  const n = q * d + r
  const name = pickL(MULT_NAMES, lang)
  const answer = mode === 'up' ? q + 1 : mode === 'left' ? r : q

  // Split the dividend at a multiple of ten groups, so the two divisions are both easy — and
  // name the parts only, never what they come to.
  const tens = Math.floor(q / 10) * 10 * d
  const split = tens > 0 && tens < n
    ? say(lang, `Split ${num(n, lang)} into ${num(tens, lang)} and ${num(n - tens, lang)}, and divide each part by ${d}.`,
                `${num(n, lang)} sayısını ${num(tens, lang)} ve ${num(n - tens, lang)} diye ayır, her parçayı ${d} sayısına böl.`,
                `Separa ${num(n, lang)} en ${num(tens, lang)} y ${num(n - tens, lang)}, y divide cada parte entre ${d}.`)
    : say(lang, `Work out ${num(n, lang)} ÷ ${d}.`, `${num(n, lang)} ÷ ${d} işlemini yap.`, `Calcula ${num(n, lang)} ÷ ${d}.`)
  // Written per mode and only the asked one is built: `need` exists on the round-up contexts only.
  const last = {
    exact: () => say(lang, `Every group is full, so nothing is left over.`,
                     `Her grup tam dolu, dışarıda kalan yok.`,
                     `Todos los grupos quedan completos; no sobra nada.`),
    up: () => say(lang, `Some will be left over, and they still need ${ctx.need[0]} — so count one more for them.`,
                  `Birkaç tane artacak ve onlar için de ${ctx.need[1]} gerekir — onlar için bir tane daha say.`,
                  `Sobrarán algunos y también necesitan ${ctx.need[2]}: cuenta uno más para ellos.`),
    down: () => say(lang, `Only whole ones count. What is left at the end is not enough for another.`,
                    `Yalnız tam olanlar sayılır. Sonda kalan, bir tane daha için yetmez.`,
                    `Solo cuentan los enteros. Lo que queda al final no llega para otro.`),
    left: () => say(lang, `Find how many full groups of ${d} there are, then see what is still over.`,
                    `Önce her grupta ${d} tane olacak şekilde kaç tam grup çıktığını bul, sonra geriye ne kaldığına bak.`,
                    `Busca cuántos grupos completos de ${d} hay y mira lo que sobra.`),
  }[mode]()

  return {
    topic: 'division-word',
    level,
    question_text: ctx.text(lang, n, d, name),
    format: 'numeric',
    correct_answer: answer,
    operandKey: `div:${mode}:${n}:${d}`,
    hint_steps: [split, last],
  }
}

// ─── Addition and subtraction in context (Year 5) ───────────────────────────
// Year 5's line is "add and subtract … using formal written methods; add and subtract mentally
// with increasingly large numbers". The template it was mapped to answered that with a bare
// "8.412 + 5.400 = ?" in every session, and never once a subtraction. Bond's 10-11 book has
// no bare sum anywhere in it: its addition and subtraction are always inside something, and
// usually two steps deep — "567 people asked, 78 chose curry, 206 stir-fry, the rest pasta",
// a bus that picks people up and drops them off, "a CD holds 650 MB, two files of 68 and 96",
// "728 meals, 986 people", "the war began in 1337 and ended in 1453". These are those shapes.
//
// Screen mode has no paper, so the numbers being added or taken away keep to two non-zero
// digits (the rule `mentalise` enforces for the bare template, and for the same reason); the
// number they are taken FROM can be anything. Paper mode lifts that, as it does everywhere.
function twoPart(lo, hi, columnar) {
  let n
  do { n = randInt(lo, hi) } while (!columnar && placeParts(n).length > 2)
  return n
}

const SURVEYS = [
  { en: ['sport', 'football', 'swimming', 'tennis'],
    tr: ['sporu', 'futbolu', 'yüzmeyi', 'tenisi'],
    es: ['deporte favorito', 'el fútbol', 'la natación', 'el tenis'] },
  { en: ['fruit', 'apples', 'bananas', 'grapes'],
    tr: ['meyveyi', 'elmayı', 'muzu', 'üzümü'],
    es: ['fruta favorita', 'la manzana', 'el plátano', 'la uva'] },
  { en: ['pet', 'cats', 'dogs', 'rabbits'],
    tr: ['hayvanı', 'kediyi', 'köpeği', 'tavşanı'],
    es: ['mascota favorita', 'el gato', 'el perro', 'el conejo'] },
]

function addSubSurvey(level, lang, columnar) {
  const s = pick(SURVEYS)
  const w = s[lang] ?? s.en
  let total, p1, p2, rest
  do {
    total = randInt(300, 950)
    p1 = twoPart(40, 390, columnar)
    p2 = twoPart(40, 390, columnar)
    rest = total - p1 - p2
  } while (rest < 30 || p1 === p2)
  return {
    question_text: say(lang,
      `${total} pupils chose their favourite ${w[0]}. ${p1} chose ${w[1]}, ${p2} chose ${w[2]} and the rest chose ${w[3]}. How many chose ${w[3]}?`,
      `${total} öğrenci en sevdiği ${w[0]} seçti. ${p1} kişi ${w[1]}, ${p2} kişi ${w[2]}, geri kalanı ${w[3]} seçti. Kaç kişi ${w[3]} seçti?`,
      `${total} alumnos eligieron su ${w[0]}. ${p1} eligieron ${w[1]}, ${p2} ${w[2]} y el resto ${w[3]}. ¿Cuántos eligieron ${w[3]}?`),
    answer: rest,
    key: `asw:survey:${total}:${p1}:${p2}`,
    hints: [
      say(lang, `First add up the ones you know: ${p1} + ${p2}.`, `Önce bildiklerini topla: ${p1} + ${p2}.`, `Primero suma los que conoces: ${p1} + ${p2}.`),
      say(lang, `Everyone else chose the last one, so take that total away from ${total}.`,
                `Geri kalan herkes sonuncuyu seçti, o yüzden bu toplamı ${total} sayısından çıkar.`,
                `Todos los demás eligieron el último, así que resta ese total de ${total}.`),
    ],
  }
}

function addSubBus(level, lang) {
  let s, on1, off1, on2, off2, now
  do {
    s = randInt(18, 45); on1 = randInt(5, 19); off1 = randInt(2, 12); on2 = randInt(4, 16); off2 = randInt(3, 19)
    now = s + on1 - off1 + on2 - off2
  } while (now < 10 || on1 === off1 || on2 === off2)
  return {
    question_text: say(lang,
      `${s} people are on a bus. At the first stop ${on1} get on and ${off1} get off. At the second, ${on2} get on and ${off2} get off. How many are on the bus now?`,
      `Bir otobüste ${s} kişi var. İlk durakta ${on1} kişi biniyor, ${off1} kişi iniyor. İkinci durakta ${on2} kişi biniyor, ${off2} kişi iniyor. Şimdi otobüste kaç kişi var?`,
      `En un autobús van ${s} personas. En la primera parada suben ${on1} y bajan ${off1}. En la segunda suben ${on2} y bajan ${off2}. ¿Cuántas van ahora?`),
    answer: now,
    key: `asw:bus:${s}:${on1}:${off1}:${on2}:${off2}`,
    hints: [
      say(lang, `Go one stop at a time: people getting on are added, people getting off are taken away.`,
                `Durak durak ilerle: binenleri ekle, inenleri çıkar.`,
                `Ve parada a parada: los que suben se suman y los que bajan se restan.`),
      say(lang, `After the first stop: ${s} + ${on1} − ${off1}. Then do the same for the second stop.`,
                `İlk duraktan sonra: ${s} + ${on1} − ${off1}. Sonra aynısını ikinci durak için yap.`,
                `Tras la primera parada: ${s} + ${on1} − ${off1}. Luego haz lo mismo con la segunda.`),
    ],
  }
}

function addSubSpace(level, lang, columnar) {
  const name = pickL(MULT_NAMES, lang)
  let cap, f1, f2, left
  do {
    cap = pick([500, 600, 650, 700, 750, 800, 900, 1000])
    f1 = twoPart(60, 450, columnar); f2 = twoPart(20, 250, columnar)
    left = cap - f1 - f2
  } while (left < 20 || f1 === f2)
  return {
    question_text: say(lang,
      `A tablet has ${num(cap, lang)} MB of free space. ${name} saves a game of ${f1} MB and a video of ${f2} MB. How many MB are still free?`,
      `Bir tablette ${num(cap, lang)} MB boş yer var. ${name} ${f1} MB bir oyun ve ${f2} MB bir video kaydediyor. Kaç MB boş yer kalır?`,
      `Una tableta tiene ${num(cap, lang)} MB libres. ${name} guarda un juego de ${f1} MB y un vídeo de ${f2} MB. ¿Cuántos MB quedan libres?`),
    answer: left,
    key: `asw:space:${cap}:${f1}:${f2}`,
    hints: [
      say(lang, `Work out how much the two files take together: ${f1} + ${f2}.`,
                `Önce iki dosyanın birlikte ne kadar yer tuttuğunu bul: ${f1} + ${f2}.`,
                `Calcula cuánto ocupan los dos archivos juntos: ${f1} + ${f2}.`),
      say(lang, `What is free is what is left of ${num(cap, lang)} once that is taken away.`,
                `Boş kalan yer, bu ${num(cap, lang)} sayısından çıkınca geriye kalandır.`,
                `Lo libre es lo que queda de ${num(cap, lang)} después de restar eso.`),
    ],
  }
}

function addSubShort(level, lang, columnar) {
  let made, came
  do {
    made = twoPart(300, 900, columnar)
    came = randInt(made + 25, Math.min(made + 400, 999))
  } while (made === came)
  return {
    question_text: say(lang,
      `The cooks at a concert make ${made} meals, but ${came} people turn up. How many people go without a meal?`,
      `Bir konser için ${made} kişilik yemek hazırlandı ama ${came} kişi geldi. Kaç kişi yemeksiz kalır?`,
      `Para un concierto se preparan ${made} comidas, pero llegan ${came} personas. ¿Cuántas se quedan sin comida?`),
    answer: came - made,
    key: `asw:short:${made}:${came}`,
    hints: [
      say(lang, `The people without a meal are the gap between the people and the meals.`,
                `Yemeksiz kalanlar, gelen kişi sayısı ile yemek sayısı arasındaki farktır.`,
                `Los que se quedan sin comida son la diferencia entre personas y comidas.`),
      say(lang, `Take ${made} away from ${came}, or count up from ${made} to ${came}.`,
                `${came} sayısından ${made} çıkar ya da ${made} sayısından ${came} sayısına kadar say.`,
                `Resta ${made} de ${came}, o cuenta desde ${made} hasta ${came}.`),
    ],
  }
}

// Years are printed as years — "1868", never "1.868" — which is why this one does not go
// through `num`.
function addSubYears(level, lang) {
  let from, to
  do { from = randInt(1066, 1950); to = from + randInt(36, 480) } while (to > 2025 || from % 100 === 0)
  const next = Math.ceil(from / 100) * 100
  const tree = Math.random() < 0.5
  return {
    question_text: tree
      ? say(lang, `An oak tree was planted in ${from}. How old was it in ${to}?`,
                  `Bir meşe ağacı ${from} yılında dikildi. ${to} yılında kaç yaşındaydı?`,
                  `Un roble se plantó en ${from}. ¿Cuántos años tenía en ${to}?`)
      : say(lang, `A bridge was opened in ${from} and replaced in ${to}. For how many years was it used?`,
                  `Bir köprü ${from} yılında açıldı, ${to} yılında yenisiyle değiştirildi. Köprü kaç yıl kullanıldı?`,
                  `Un puente se abrió en ${from} y se sustituyó en ${to}. ¿Cuántos años se usó?`),
    answer: to - from,
    key: `asw:years:${from}:${to}`,
    hints: [
      say(lang, `The answer is the gap between the two years.`, `Cevap, iki yıl arasındaki farktır.`, `La respuesta es la distancia entre los dos años.`),
      next < to
        ? say(lang, `Count up from ${from} to ${next}, then from ${next} on to ${to}, and add the two jumps.`,
                    `${from} yılından ${next} yılına kadar say, sonra ${next} yılından ${to} yılına kadar. İki sıçramayı topla.`,
                    `Cuenta desde ${from} hasta ${next}, luego desde ${next} hasta ${to}, y suma los dos saltos.`)
        : say(lang, `Take ${from} away from ${to}.`, `${to} sayısından ${from} çıkar.`, `Resta ${from} de ${to}.`),
    ],
  }
}

function addSubMoney(level, lang, columnar) {
  const name = pickL(MULT_NAMES, lang)
  let had, c1, c2, left
  do {
    had = pick([150, 200, 250, 300, 350, 400, 450, 500])
    c1 = twoPart(45, 290, columnar); c2 = twoPart(12, 95, columnar)
    left = had - c1 - c2
  } while (left < 5)
  return {
    question_text: say(lang,
      `${name} has saved $${had}, then buys a bike helmet for $${c1} and a book for $${c2}. How much money is left, in dollars?`,
      `${name} ${had} lira biriktirdi. ${c1} liraya bir bisiklet kaskı, ${c2} liraya bir kitap aldı. Kaç lirası kaldı?`,
      `${name} ha ahorrado ${had} euros. Compra un casco de bici de ${c1} euros y un libro de ${c2} euros. ¿Cuántos euros le quedan?`),
    answer: left,
    key: `asw:money:${had}:${c1}:${c2}`,
    hints: [
      say(lang, `Find what was spent altogether: ${c1} + ${c2}.`, `Önce toplam ne kadar harcandığını bul: ${c1} + ${c2}.`, `Primero calcula cuánto se gastó en total: ${c1} + ${c2}.`),
      say(lang, `Then take that away from the ${had} saved.`, `Sonra bunu biriktirilen ${had} liradan çıkar.`, `Luego réstalo de los ${had} euros ahorrados.`),
    ],
  }
}

const ADD_SUB_SHAPES = [addSubSurvey, addSubBus, addSubSpace, addSubShort, addSubYears, addSubMoney]

function addSubWordTemplate(level, lang, columnar = false) {
  const p = pick(ADD_SUB_SHAPES)(level, lang, columnar)
  return {
    topic: 'add-sub-word',
    level,
    question_text: p.question_text,
    format: 'numeric',
    correct_answer: p.answer,
    operandKey: p.key,
    hint_steps: p.hints,
  }
}

// ── Pictogram (statistics) ───────────────────────────────────────────────────
// "Each symbol in Can's pictogram is 8 books, so what do his 5 symbols show?" is what the
// model wrote for this strand: a chart the child cannot see, named with a word they have
// never met, and underneath it a plain 5 × 8 in costume. Reading the key IS the skill the
// curriculum asks for, so the chart has to be on screen — and once it is drawn, the word
// "pictogram" explains itself and never has to appear in the question at all.
//
// The Spanish entries carry two fields the others do not need. `one` is the singular, because
// "gol" is not "goles" with the s taken off, which is all the English branch has to do. `many`
// is the question word: Spanish agrees it with the noun, so apples ask "¿Cuántas?" and goals
// ask "¿Cuántos?" — the one place in this file where a bank could not simply be all feminine,
// since the five symbols are fixed and two of them name masculine things.
const PICTO_SETS = [
  { unit: '🍎', en: { noun: 'apples', verb: 'pick'    }, tr: { noun: 'elma',         verb: 'topladı' },
                es: { noun: 'manzanas',  one: 'manzana',  verb: 'recogió', many: 'Cuántas' } },
  { unit: '⚽', en: { noun: 'goals',  verb: 'score'   }, tr: { noun: 'gol',          verb: 'attı'    },
                es: { noun: 'goles',     one: 'gol',      verb: 'marcó',   many: 'Cuántos' } },
  { unit: '📕', en: { noun: 'books',  verb: 'read'    }, tr: { noun: 'kitap',        verb: 'okudu'   },
                es: { noun: 'libros',    one: 'libro',    verb: 'leyó',    many: 'Cuántos' } },
  { unit: '⭐', en: { noun: 'stars',  verb: 'earn'    }, tr: { noun: 'yıldız',       verb: 'kazandı' },
                es: { noun: 'estrellas', one: 'estrella', verb: 'ganó',    many: 'Cuántas' } },
  { unit: '🐚', en: { noun: 'shells', verb: 'collect' }, tr: { noun: 'deniz kabuğu', verb: 'topladı' },
                es: { noun: 'conchas',   one: 'concha',   verb: 'recogió', many: 'Cuántas' } },
]

function shuffled(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pictogramTemplate(level, lang) {
  const band = bandForLevel(level)
  const rr = Math.random()
  if (band >= 2 && rr < 0.3) return dataTally(level, lang)
  if (band >= 2 && rr < 0.5) return dataSorting(level, lang)
  const set = pick(PICTO_SETS)
  const words = set[lang] ?? set.en
  const { noun, verb } = words
  const many = words.many          // Spanish only: "Cuántas" or "Cuántos", agreed with the noun
  // Year 2 meets "simple pictograms" — one symbol, one thing. The scaled key is Year 3's,
  // and it is what makes the picture worth reading rather than just counting.
  const each = band <= 2 ? pick([1, 1, 2]) : pick([2, 4, 5, 10])
  const names = shuffled(MULT_NAMES[lang] ?? MULT_NAMES.en).slice(0, 3)
  // Distinct counts, so "how many more" always has a positive answer and no two rows are
  // ambiguous to point at.
  const counts = shuffled([1, 2, 3, 4, 5]).slice(0, 3)
  // Year 3's scaled key comes with half symbols in Bond's 8-9 book ("☺ = 10 children", a half
  // face for 5). Only with an even key, so half a symbol is a whole number of things.
  if (band >= 3 && each % 2 === 0 && Math.random() < 0.45) {
    const halves = shuffled([0, 1, 2]).slice(0, randInt(1, 2))
    for (const i of halves) counts[i] += 0.5
  }
  const rows = names.map((label, i) => ({ label, count: counts[i] }))

  // Turkish takes no plural after a number; English needs the singular when the key is 1, and
  // Spanish needs the singular it carries rather than one guessed from the plural.
  const keyNoun = lang === 'tr' ? noun
    : lang === 'es' ? (each === 1 ? words.one : noun)
    : (each === 1 ? noun.replace(/s$/, '') : noun)
  const keyLine = say(lang, `Each ${set.unit} stands for ${each} ${keyNoun}.`, `Her ${set.unit} ${each} ${noun} demek.`,
                            `Cada ${set.unit} vale ${each} ${keyNoun}.`)
  const scaleStep = each === 1
    ? say(lang, `Each ${set.unit} is one, so the count you say is the answer.`,
                `Her sembol 1 demek, saydığın sayı cevaptır.`,
                `Cada símbolo vale 1, así que el número que cuentes es la respuesta.`)
    : counts.some(c => !Number.isInteger(c))
      ? say(lang, `Each whole ${set.unit} is ${each}, and half a ${set.unit} is ${each / 2}.`,
                  `Her tam sembol ${each}, yarım sembol ${each / 2} demek.`,
                  `Cada ${set.unit} entero vale ${each} y medio vale ${each / 2}.`)
      : say(lang, `Each ${set.unit} is ${each} — multiply the number of symbols by ${each}.`,
                `Her sembol ${each} demek — sembol sayısını ${each} ile çarp.`,
                `Cada símbolo vale ${each}: multiplica el número de símbolos por ${each}.`)

  const ask = band <= 2 ? pick(['read', 'read', 'total']) : pick(['read', 'total', 'diff'])

  if (ask === 'total') {
    const totalSymbols = counts.reduce((a, b) => a + b, 0)
    return {
      topic: 'pictogram', level,
      question_text: say(lang, `${keyLine} How many ${noun} altogether?`, `${keyLine} Toplam kaç ${noun} var?`,
                               `${keyLine} ¿${many} ${noun} hay en total?`),
      format: 'numeric',
      correct_answer: totalSymbols * each,
      operandKey: `picto:total:${each}:${counts.join('-')}`,
      hint_steps: [
        say(lang, `Count the ${set.unit} in every row.`, `Bütün satırlardaki sembolleri say.`,
                  `Cuenta los ${set.unit} de todas las filas.`),
        scaleStep,
      ],
      visual: { kind: 'pictogram', unit: set.unit, each, rows, highlight: names },
    }
  }

  if (ask === 'diff') {
    const hi = rows.reduce((m, r) => (r.count > m.count ? r : m))
    const lo = rows.reduce((m, r) => (r.count < m.count ? r : m))
    return {
      topic: 'pictogram', level,
      // Turkish puts a case suffix on a name through an apostrophe and it does not follow
      // from the spelling — Emir'den but Zeynep'ten. "A ile B arasındaki fark" needs none.
      question_text: say(lang,
        `${keyLine} How many more ${noun} did ${hi.label} ${verb} than ${lo.label}?`,
        `${keyLine} ${hi.label} ile ${lo.label} arasındaki fark kaç ${noun}?`,
        `${keyLine} ¿${many} ${noun} más ${verb} ${hi.label} que ${lo.label}?`),
      format: 'numeric',
      correct_answer: (hi.count - lo.count) * each,
      operandKey: `picto:diff:${each}:${hi.count}-${lo.count}`,
      hint_steps: [
        say(lang, `Count ${hi.label}'s row, then ${lo.label}'s row.`,
                  `Önce ${hi.label} satırını, sonra ${lo.label} satırını say.`,
                  `Cuenta la fila de ${hi.label} y luego la de ${lo.label}.`),
        each === 1
          ? say(lang, `Take the smaller count away from the bigger one.`, `Küçük sayıyı büyük sayıdan çıkar.`,
                      `Resta el número más pequeño del más grande.`)
          : say(lang, `Find the difference in symbols, then multiply it by ${each}.`,
                      `Sembol farkını bul, sonra ${each} ile çarp.`,
                      `Halla la diferencia de símbolos y multiplícala por ${each}.`),
      ],
      visual: { kind: 'pictogram', unit: set.unit, each, rows, highlight: [hi.label, lo.label] },
    }
  }

  const row = pick(rows)
  return {
    topic: 'pictogram', level,
    question_text: say(lang,
      `${keyLine} How many ${noun} did ${row.label} ${verb}?`,
      `${keyLine} ${row.label} kaç ${noun} ${verb}?`,
      `${keyLine} ¿${many} ${noun} ${verb} ${row.label}?`),
    format: 'numeric',
    correct_answer: row.count * each,
    operandKey: `picto:read:${each}:${row.count}`,
    hint_steps: [
      // Finding the row is half the skill, so the first step points at it rather than at
      // the arithmetic — the help panel then lights that row up.
      say(lang, `Find the row for ${row.label} and count the ${set.unit}.`,
                `${row.label} satırındaki sembolleri say.`,
                `Busca la fila de ${row.label} y cuenta los ${set.unit}.`),
      scaleStep,
    ],
    visual: { kind: 'pictogram', unit: set.unit, each, rows, highlight: [row.label] },
  }
}

// ─── Registry ───────────────────────────────────────────────────────────────

// ── Geometry ─────────────────────────────────────────────────────────────────
// This level used to be generated by the LLM, and what came out was arithmetic wearing a
// geometry costume: "Sides of a pentagon + Corners of a triangle = ?" is 5 + 3 once you
// already know the words, so it measured whether a child had met "pentagon" — and one who
// had not was stuck on what is really an addition question. Shapes are a small closed set
// with exact properties, which is what a template does best: draw the shape and let the
// child count what is in front of them.
//
// Every simple polygon has as many corners as it has sides, so both askings share one
// number — but both words are worth meeting, and seeing that they always match is itself
// the lesson.
const SHAPES = {
  triangle: 3, square: 4, rectangle: 4, pentagon: 5, hexagon: 6, octagon: 8,
}

// Which of them a child of this year has actually met. Year 1's curriculum entry names
// "rectangles, circles, triangles" and nothing else, so a five-year-old was being shown an
// octagon and asked to count its eight sides — countable, but not their year's work, and
// "Bu şeklin adı nedir? → Sekizgen" is not a Year 1 question at all. Circles are absent from
// SHAPES on purpose: a shape with no sides has no place in a sides-and-corners question.
function shapePoolForLevel(level) {
  const all = Object.keys(SHAPES)
  return bandForLevel(level) <= 1 ? all.filter(k => SHAPES[k] <= 4) : all
}

// Every Spanish shape name here is masculine, so the article in front of one is always "un" —
// which is why the Spanish phrasings below can write it inline instead of carrying a gender.
const SHAPE_NAMES = {
  triangle:  { en: 'triangle',  tr: 'üçgen',      es: 'triángulo' },
  square:    { en: 'square',    tr: 'kare',       es: 'cuadrado' },
  rectangle: { en: 'rectangle', tr: 'dikdörtgen', es: 'rectángulo' },
  pentagon:  { en: 'pentagon',  tr: 'beşgen',     es: 'pentágono' },
  hexagon:   { en: 'hexagon',   tr: 'altıgen',    es: 'hexágono' },
  octagon:   { en: 'octagon',   tr: 'sekizgen',   es: 'octógono' },
}

// Year 4 is where classifying shapes by name enters the curriculum, and naming is the one
// geometry question that cannot be typed. It is also the one this file's opening note warns
// about — a question that only measures whether a child has met the word "pentagon". Drawing
// the shape is what stops that: the answer is countable, and a wrong option can say so back
// ("a hexagon means six sides; count this one, it has five").
function geometryName(level, lang) {
  const pool = shapePoolForLevel(level)
  const shown = pick(pool)
  const n = SHAPES[shown]
  const name = k => SHAPE_NAMES[k][lang] ?? SHAPE_NAMES[k].en
  const cap = s => s.charAt(0).toLocaleUpperCase(lang === 'tr' ? 'tr' : lang === 'es' ? 'es' : 'en') + s.slice(1)
  const a = k => (/^[aeiou]/.test(SHAPE_NAMES[k].en) ? 'an' : 'a') + ' ' + name(k)

  // Never offer the other four-sided shape against this one. A square really is a rectangle,
  // so marking it wrong would be a lie, and the reason given would contradict the curriculum.
  // Shuffle first, then a stable sort by how near the side count is: near misses, tie broken
  // at random rather than always the same three.
  const wrongs = shuffle(pool.filter(k => SHAPES[k] !== n))
    .sort((a, b) => Math.abs(SHAPES[a] - n) - Math.abs(SHAPES[b] - n))
    .slice(0, 3)

  const options = shuffle([
    { value: cap(name(shown)), why: say(lang,
        `Right — it has ${n} sides, and that is what ${a(shown)} is.`,
        `Doğru — ${n} kenarı var, ${name(shown)} demek de bu.`,
        `Correcto: tiene ${n} lados, y eso es un ${name(shown)}.`) },
    ...wrongs.map(w => ({ value: cap(name(w)), why: say(lang,
        `${cap(a(w))} means ${SHAPES[w]} sides. Count this one — it has ${n}.`,
        `${cap(name(w))} demek ${SHAPES[w]} kenar demek. Bunu say — ${n} kenarı var.`,
        `Un ${name(w)} tiene ${SHAPES[w]} lados. Cuenta esta figura: tiene ${n}.`) })),
  ])

  return {
    topic: 'geometry',
    level,
    question_text: say(lang, 'What is this shape called?', 'Bu şeklin adı nedir?', '¿Cómo se llama esta figura?'),
    format: 'choice',
    options,
    correct_answer: cap(name(shown)),
    operandKey: `geo:name:${shown}`,
    hint_steps: [
      say(lang, 'Count the sides of the shape.', 'Şeklin kenarlarını say.', 'Cuenta los lados de la figura.'),
      say(lang, 'The name carries the number: penta is five, hexa is six, octa is eight.',
                'Adı sayıyı söyler: beşgen beş, altıgen altı, sekizgen sekiz.',
                'El nombre lleva el número: penta es cinco, hexa es seis, octo es ocho.'),
    ],
    // 'sides' rather than 'name': `ask` is what the DRAWING does, not what the question says,
    // and counting the sides is exactly how a child settles which shape this is. The hint above
    // asks for the same thing in words.
    visual: { kind: 'shapes', shapes: [shown], ask: 'sides' },
  }
}

// ── Angles and area (Year 5 and up) ──────────────────────────────────────────
// The geometry template above counts sides and corners, which is Year 1 to Year 4. From Year 5
// the curriculum is angles and area, and until now that went to the model — which is where the
// hundred-question audit found "A straight line has 2 angles. One is 45°, what is the other?"
// The model's answer was right and the sentence it wrapped it in was not, and answer
// verification cannot catch that: it checks the answer, not the premise. A template can only
// state premises its author wrote, which is the whole argument for having one here.
//
// Every angle fact used is named in the question, because nothing is drawn: "angles on a
// straight line add up to 180°" is the fact, and the question gives one and asks for the rest.

const POLY = {
  3: { en: 'triangle', tr: 'üçgen', es: 'triángulo' },
  4: { en: 'quadrilateral', tr: 'dörtgen', es: 'cuadrilátero' },
  5: { en: 'pentagon', tr: 'beşgen', es: 'pentágono' },
  6: { en: 'hexagon', tr: 'altıgen', es: 'hexágono' },
  8: { en: 'octagon', tr: 'sekizgen', es: 'octágono' },
}

function geometryAngle(level, lang) {
  const band = bandForLevel(level)
  const kinds = band >= 7
    ? ['line', 'point', 'triangle', 'quad', 'opposite', 'regular']
    : ['line', 'line', 'point', 'triangle', 'triangle', 'quad']
  const kind = pick(kinds)

  if (kind === 'regular') {
    // Interior angle of a regular polygon. Only sides whose interior angle is whole.
    const n = pick([3, 4, 5, 6, 8, 9, 10, 12])
    const answer = 180 - 360 / n
    const name = pickL(POLY[n] ?? { en: `${n}-sided shape`, tr: `${n} kenarlı şekil`, es: `figura de ${n} lados` }, lang)
    return {
      topic: 'geometry', level,
      question_text: say(lang,
        `Every angle in a regular ${name} is the same size. How many degrees is one of them?`,
        `Düzgün bir ${name}in bütün açıları eşittir. Bir açısı kaç derecedir?`,
        `Todos los ángulos de un ${name} regular son iguales. ¿Cuántos grados mide uno?`),
      format: 'numeric',
      correct_answer: answer,
      operandKey: `geo:reg:${n}`,
      visual: { kind: 'geometry', shape: 'regular', sides: n },
      hint_steps: [
        say(lang, `Walking all the way round the outside turns you through 360° altogether.`,
                  `Şeklin dışından bir tam tur atmak seni toplam 360° döndürür.`,
                  `Dar toda la vuelta por fuera te gira 360° en total.`),
        say(lang, `Share that 360° between the ${n} corners, then take that away from a straight line.`,
                  `O 360°'yi ${n} köşeye eşit paylaştır, sonra doğru açıdan çıkar.`,
                  `Reparte esos 360° entre las ${n} esquinas y réstaselo a un ángulo llano.`),
      ],
    }
  }

  if (kind === 'opposite') {
    const a = randInt(25, 155)
    return {
      topic: 'geometry', level,
      question_text: say(lang,
        `Two straight lines cross each other. One of the four angles made is ${a}°. What is the angle directly opposite it?`,
        `İki doğru birbirini kesiyor. Oluşan dört açıdan biri ${a}°. Tam karşısındaki açı kaç derecedir?`,
        `Dos rectas se cruzan. Uno de los cuatro ángulos que se forman mide ${a}°. ¿Cuánto mide el que está justo enfrente?`),
      format: 'numeric',
      correct_answer: a,
      operandKey: `geo:opp:${a}`,
      visual: { kind: 'geometry', shape: 'opposite', angles: [a] },
      hint_steps: [
        say(lang, `Where two lines cross, the angles facing each other are equal.`,
                  `İki doğru kesiştiğinde, karşılıklı duran açılar eşittir.`,
                  `Cuando dos rectas se cruzan, los ángulos enfrentados son iguales.`),
        say(lang, `The one next to it is what makes up the straight line — the one opposite is not.`,
                  `Yanındaki açı doğruyu tamamlayandır — karşısındaki değil.`,
                  `El de al lado es el que completa la recta; el opuesto no.`),
      ],
    }
  }

  // The three "add up to" facts. `total` is the sum, `parts` how many angles there are.
  const spec = {
    line:     { total: 180, parts: 2 },
    point:    { total: 360, parts: pick([3, 4]) },
    triangle: { total: 180, parts: 3 },
    quad:     { total: 360, parts: 4 },
  }[kind]
  // Built from the givens outwards so the missing angle is always positive and whole, and so
  // no angle is 0 — an angle of 0° is not an angle a child should be shown.
  const given = []
  let left = spec.total
  for (let i = 0; i < spec.parts - 1; i++) {
    const remaining = spec.parts - 1 - i
    const hi = left - 10 * (remaining + 1)
    if (hi < 15) return geometryAngle(level, lang)
    const v = randInt(15, Math.min(hi, 140))
    given.push(v); left -= v
  }
  const answer = left
  // "115° and 131° and 62°" is not how a list is written. Everything but the last is joined
  // with a comma and the last with the language's own word for "and".
  const parts = given.map(v => `${v}°`)
  const list = parts.length === 1 ? parts[0]
    : parts.slice(0, -1).join(', ') + say(lang, ' and ', ' ve ', ' y ') + parts[parts.length - 1]

  const text = {
    // "Angles meet at a point" does NOT make them add to 360: they have to be adjacent and
    // go all the way round, with no gap and no overlap. Nothing is drawn here, so every
    // condition the answer depends on has to be in the sentence — otherwise the child is
    // asked to guess the diagram. A re-audit found this wording the day it was written, and
    // it is the same defect as the model's "a straight line has 2 angles", one step milder:
    // a premise that happens to be true of the picture the author had in mind.
    line: say(lang,
      `Two angles sit next to each other and together they make a straight line. One is ${given[0]}°. How many degrees is the other?`,
      `İki açı yan yana duruyor ve birlikte bir doğru oluşturuyor. Biri ${given[0]}°. Diğeri kaç derecedir?`,
      `Dos ángulos están uno junto al otro y juntos forman una recta. Uno mide ${given[0]}°. ¿Cuánto mide el otro?`),
    point: say(lang,
      `${spec.parts} angles sit next to each other and together they make a full turn. ${spec.parts - 1} of them are ${list}. How many degrees is the last one?`,
      `${spec.parts} açı yan yana duruyor ve birlikte tam bir tur oluşturuyor. Bunların ${spec.parts - 1} tanesi ${list}. Sonuncusu kaç derecedir?`,
      `${spec.parts} ángulos están uno junto a otro y juntos dan una vuelta completa. ${spec.parts - 1} de ellos miden ${list}. ¿Cuánto mide el último?`),
    triangle: say(lang,
      `Two angles of a triangle are ${list}. How many degrees is the third?`,
      `Bir üçgenin iki açısı ${list}. Üçüncü açı kaç derecedir?`,
      `Dos ángulos de un triángulo miden ${list}. ¿Cuánto mide el tercero?`),
    quad: say(lang,
      `Three angles of a quadrilateral are ${list}. How many degrees is the fourth?`,
      `Bir dörtgenin üç açısı ${list}. Dördüncü açı kaç derecedir?`,
      `Tres ángulos de un cuadrilátero miden ${list}. ¿Cuánto mide el cuarto?`),
  }[kind]

  const fact = {
    line: say(lang, `Angles on a straight line add up to 180°.`, `Bir doğru üzerindeki açılar toplamı 180°'dir.`,
                    `Los ángulos sobre una recta suman 180°.`),
    point: say(lang, `Angles meeting at a point add up to 360°.`, `Bir noktada birleşen açıların toplamı 360°'dir.`,
                     `Los ángulos que se juntan en un punto suman 360°.`),
    triangle: say(lang, `The angles inside a triangle add up to 180°.`, `Bir üçgenin iç açıları toplamı 180°'dir.`,
                        `Los ángulos de un triángulo suman 180°.`),
    quad: say(lang, `The angles inside a quadrilateral add up to 360°.`, `Bir dörtgenin iç açıları toplamı 360°'dir.`,
                    `Los ángulos de un cuadrilátero suman 360°.`),
  }[kind]

  return {
    topic: 'geometry', level,
    question_text: text,
    format: 'numeric',
    correct_answer: answer,
    operandKey: `geo:ang:${kind}:${given.join('-')}`,
    visual: { kind: 'geometry', shape: kind, angles: given },
    hint_steps: [
      fact,
      say(lang, `Add up the ones you were given, then take that away from ${spec.total}.`,
                `Verilenleri topla, sonra ${spec.total}'den çıkar.`,
                `Suma los que te han dado y réstalo de ${spec.total}.`),
    ],
  }
}

// Area and perimeter, including working backwards from a known area — Bond asks that shape in
// both books and it is the one that separates knowing the formula from using it.
function geometryArea(level, lang) {
  const band = bandForLevel(level)
  const shape = pick(band >= 7 ? ['rect', 'triangle', 'para', 'reverse'] : ['rect', 'rect', 'triangle', 'reverse'])
  // Two different lengths, the longer one along the bottom. Equal sides made a square that the
  // question called a rectangle ("area 16 cm², one side 4 cm" — the other side is 4 too) under a
  // drawing that is always wider than it is tall.
  const [w, h] = rectSides(3, 18)

  if (shape === 'triangle') {
    // Base and height chosen so half of their product is whole.
    const b = pick([4, 6, 8, 10, 12, 14, 16, 20])
    const answer = b * h / 2
    return {
      topic: 'geometry', level,
      question_text: say(lang,
        `A triangle has a base of ${b} cm and a height of ${h} cm. What is its area in cm²?`,
        `Bir üçgenin tabanı ${b} cm, yüksekliği ${h} cm. Alanı kaç cm²'dir?`,
        `Un triángulo tiene una base de ${b} cm y una altura de ${h} cm. ¿Cuál es su área en cm²?`),
      format: 'numeric', correct_answer: answer, operandKey: `geo:tri:${b}:${h}`,
      visual: { kind: 'geometry', shape: 'triangle', base: b, height: h, ask: 'area' },
      hint_steps: [
        say(lang, `A triangle is exactly half of the rectangle that would fit around it.`,
                  `Bir üçgen, etrafına oturacak dikdörtgenin tam yarısıdır.`,
                  `Un triángulo es exactamente la mitad del rectángulo que lo rodearía.`),
        say(lang, `Multiply the base by the height, then halve it.`,
                  `Tabanı yükseklikle çarp, sonra yarıya böl.`,
                  `Multiplica la base por la altura y divide entre 2.`),
      ],
    }
  }

  if (shape === 'para') {
    const answer = w * h
    return {
      topic: 'geometry', level,
      question_text: say(lang,
        `A parallelogram has a base of ${w} cm and a height of ${h} cm. What is its area in cm²?`,
        `Bir paralelkenarın tabanı ${w} cm, yüksekliği ${h} cm. Alanı kaç cm²'dir?`,
        `Un paralelogramo tiene una base de ${w} cm y una altura de ${h} cm. ¿Cuál es su área en cm²?`),
      format: 'numeric', correct_answer: answer, operandKey: `geo:para:${w}:${h}`,
      visual: { kind: 'geometry', shape: 'para', base: w, height: h, ask: 'area' },
      hint_steps: [
        say(lang, `Cut the slanted end off and slide it to the other side — it becomes a rectangle.`,
                  `Eğik ucu kesip diğer tarafa kaydır — dikdörtgen olur.`,
                  `Corta el extremo inclinado y deslízalo al otro lado: se convierte en un rectángulo.`),
        say(lang, `Use the height straight up, not the slanted side.`,
                  `Eğik kenarı değil, dik yüksekliği kullan.`,
                  `Usa la altura vertical, no el lado inclinado.`),
      ],
    }
  }

  if (shape === 'reverse') {
    const area = w * h
    return {
      topic: 'geometry', level,
      question_text: say(lang,
        `A rectangle has an area of ${area} cm². One side is ${w} cm. How long is the other side?`,
        `Bir dikdörtgenin alanı ${area} cm². Bir kenarı ${w} cm. Diğer kenarı kaç cm'dir?`,
        `Un rectángulo tiene un área de ${area} cm². Un lado mide ${w} cm. ¿Cuánto mide el otro?`),
      format: 'numeric', correct_answer: h, operandKey: `geo:rev:${w}:${h}`,
      visual: { kind: 'geometry', shape: 'rect', base: w, area, ask: 'side' },
      hint_steps: [
        say(lang, `Area is the two sides multiplied together.`,
                  `Alan, iki kenarın çarpımıdır.`,
                  `El área es el producto de los dos lados.`),
        say(lang, `So going backwards is a division: divide the area by the side you know.`,
                  `Geriye gitmek bölme demek: alanı bildiğin kenara böl.`,
                  `Así que ir hacia atrás es una división: divide el área entre el lado que conoces.`),
      ],
    }
  }

  const askArea = Math.random() < 0.6
  return {
    topic: 'geometry', level,
    question_text: askArea
      ? say(lang, `A rectangle is ${w} cm by ${h} cm. What is its area in cm²?`,
                  `Bir dikdörtgen ${w} cm × ${h} cm. Alanı kaç cm²'dir?`,
                  `Un rectángulo mide ${w} cm por ${h} cm. ¿Cuál es su área en cm²?`)
      : say(lang, `A rectangle is ${w} cm by ${h} cm. What is its perimeter in cm?`,
                  `Bir dikdörtgen ${w} cm × ${h} cm. Çevresi kaç cm'dir?`,
                  `Un rectángulo mide ${w} cm por ${h} cm. ¿Cuál es su perímetro en cm?`),
    format: 'numeric',
    correct_answer: askArea ? w * h : 2 * (w + h),
    operandKey: `geo:rect:${askArea ? 'a' : 'p'}:${w}:${h}`,
    visual: { kind: 'geometry', shape: 'rect', base: w, height: h, ask: askArea ? 'area' : 'perimeter' },
    hint_steps: askArea
      ? [say(lang, `Area is how much surface is covered, counted in squares.`,
                   `Alan, kaplanan yüzeydir; kareyle sayılır.`,
                   `El área es la superficie que se cubre, contada en cuadrados.`),
         say(lang, `${w} rows of ${h} squares — that is a multiplication.`,
                   `${w} sıra, her sırada ${h} kare — bu bir çarpma.`,
                   `${w} filas de ${h} cuadrados: eso es una multiplicación.`)]
      : [say(lang, `Perimeter is the distance all the way round the edge.`,
                   `Çevre, kenar boyunca dolaşılan toplam uzunluktur.`,
                   `El perímetro es la distancia que rodea todo el borde.`),
         say(lang, `A rectangle has two sides of each length, so add them all.`,
                   `Dikdörtgende her uzunluktan iki kenar vardır, hepsini topla.`,
                   `Un rectángulo tiene dos lados de cada medida: súmalos todos.`)],
  }
}

function geometryTemplate(level, lang) {
  const band = bandForLevel(level)
  // From Year 5 the topic is no longer "how many sides" — the curriculum names angles and
  // area, and counting corners at eleven is not the same question wearing a bigger number.
  // Bond's 10-11 book asks for nets thirteen times; they take a share of the older years too.
  if (band >= 6) {
    // Ages 11-12: Bond's 11+-12+ book is mostly pictures here — four-quadrant grids, angle
    // diagrams, compound shapes, solids past the cube. The text-only angle and area questions
    // keep a third of the slots.
    const r = Math.random()
    return r < 0.08 ? geoNet(level, lang) : r < 0.16 ? solidOlder(level, lang)
      : r < 0.24 ? planeVertex(level, lang) : r < 0.30 ? planeShape(level, lang) : r < 0.36 ? planeTranslate(level, lang)
        : r < 0.52 ? angleDiagram(level, lang) : r < 0.64 ? compoundArea(level, lang)
          : r < 0.82 ? geometryAngle(level, lang) : geometryArea(level, lang)
  }
  if (band >= 5) { const r = Math.random(); return r < 0.12 ? geoNet(level, lang) : r < 0.24 ? geoTranslate(level, lang) : r < 0.62 ? geometryAngle(level, lang) : geometryArea(level, lang) }
  // Years 3 and 4: solids, right angles, turns, symmetry and coordinates (geometryYoung); null
  // keeps the sides-and-corners and naming questions below for a share of the slots.
  const young = band >= 3 ? geometryYoung(level, lang) : null
  if (young) return young
  if (band >= 4 && Math.random() < 0.4) return geometryName(level, lang)
  // Shapes occupy a single rung on the ladder, so difficulty does not ride on the level
  // number — the rung presents its own whole range instead. Both askings, all six shapes,
  // and a mix of one shape and two: a pair tops out at 8 + 8, and since every mark is on
  // screen and countable, that stays within reach of a child who can count to sixteen.
  const pool = shapePoolForLevel(level)
  const askKey = pick(['sides', 'corners'])
  // `ask` is the word the question is written in; `askKey` is what the drawing switches on.
  // They were the same field, so a Turkish "kaç kenarı var?" carried ask:'kenarı', missed the
  // === 'sides' test and lit the corners while asking about the sides. Right answer, wrong
  // picture — the one failure a counting visual must not have.
  const ask = say(lang, askKey, askKey === 'sides' ? 'kenarı' : 'köşesi', askKey === 'sides' ? 'lados' : 'esquinas')
  // Singular for the hint text. Turkish already reads as one ("kenarı"), English and Spanish
  // both drop the s.
  const one = lang === 'tr' ? ask : ask.slice(0, -1)
  // Spanish agrees the question word and the article with the noun, and the two words this
  // template picks between are of different genders: lados is masculine, esquinas feminine.
  const esMany = askKey === 'sides' ? 'Cuántos' : 'Cuántas'
  const esThe = askKey === 'sides' ? 'los' : 'las'
  const pair = Math.random() < 0.45

  if (!pair) {
    const shape = pick(pool)
    return {
      topic: 'geometry',
      level,
      question_text: say(lang, `How many ${ask} does this shape have?`, `Bu şeklin kaç ${ask} var?`,
                               `¿${esMany} ${ask} tiene esta figura?`),
      format: 'numeric',
      correct_answer: SHAPES[shape],
      operandKey: `${shape}:${askKey}`,
      hint_steps: [
        say(lang, `Start at one ${one} and go around the shape.`, `Bir noktadan başla, şeklin etrafını dolaş.`,
                  `Empieza en un ${one} y da la vuelta a la figura.`),
        say(lang, `Count every ${one} once — the glowing one is where you are.`, `Her birini bir kez say — parlayan, bulunduğun yer.`,
                  `Cuenta cada ${one} una sola vez; lo que brilla es donde estás.`),
      ],
      visual: { kind: 'shapes', shapes: [shape], ask: askKey },
    }
  }

  const a = pick(pool)
  const b = pick(pool)
  return {
    topic: 'geometry',
    level,
    question_text: say(lang, `How many ${ask} do these two shapes have altogether?`, `Bu iki şeklin toplam kaç ${ask} var?`,
                             `¿${esMany} ${ask} tienen estas dos figuras en total?`),
    format: 'numeric',
    correct_answer: SHAPES[a] + SHAPES[b],
    operandKey: [a, b].sort().join('+') + `:${askKey}`,
    hint_steps: [
      say(lang, `Count the ${ask} of the first shape, then the second.`, `Önce birinci şeklin ${ask}, sonra ikincisinin ${ask} say.`,
                `Cuenta ${esThe} ${ask} de la primera figura y luego ${esThe} de la segunda.`),
      say(lang, `Add the two counts together.`, `İki sayıyı topla.`, `Suma los dos números.`),
    ],
    visual: { kind: 'shapes', shapes: [a, b], ask: askKey },
  }
}

// ── Counting ────────────────────────────────────────────────────────────────
// The first rung, for the youngest children, was the one still going to the model: the
// simplest possible task carrying an API call, a wait, and a chance of a wrong answer.
// Counting is what a template is for. Two shapes of question — count what is shown, and
// say what comes next — with the objects drawn, so a child who cannot yet read the words
// can still answer.
const COUNT_ITEMS = ['🍎', '⭐', '🐟', '🌸', '🚗', '🐛', '🍓', '🎈']

function countingTemplate(level, lang) {
  // The template took a level and ignored it, so "Numbers to 100" drew seven apples for a
  // Year 2 child in the same session as a four-digit sum. Past the first year it is a number
  // -line topic, not a counting-objects one: one more, ten more, and the steps of 2s, 5s and
  // 10s the curriculum actually names.
  if (bandForLevel(level) >= 2) return youngPlaceValue(level, lang) ?? numberLineTemplate(level, lang)

  if (Math.random() < 0.65) {
    const n = randInt(1, 10)
    return {
      topic: 'counting',
      level,
      question_text: say(lang, 'How many do you see?', 'Kaç tane görüyorsun?', '¿Cuántos ves?'),
      format: 'numeric',
      correct_answer: n,
      operandKey: `count:${n}`,
      hint_steps: [say(lang, 'Touch each one as you say the number.', 'Her birine dokunarak say.',
                            'Toca cada uno mientras dices el número.'),
                   say(lang, 'The last number you say is the answer.', 'Söylediğin son sayı cevaptır.',
                            'El último número que digas es la respuesta.')],
      visual: { kind: 'count', n, item: pick(COUNT_ITEMS) },
    }
  }
  // "What comes after 6?" — the other half of knowing the number line, and it needs no
  // arithmetic, just the order.
  const n = randInt(1, 9)
  return {
    topic: 'counting',
    level,
    question_text: say(lang, `What number comes after ${n}?`, `${n} sayısından sonra hangi sayı gelir?`,
                             `¿Qué número viene después del ${n}?`),
    format: 'numeric',
    correct_answer: n + 1,
    operandKey: `after:${n}`,
    // The ladder stops at the number asked about. Printed to ten it contained the answer —
    // "what comes after 6?" with "1, 2, 3, 4, 5, 6, 7…" underneath is not a hint, it is the
    // answer with extra steps.
    hint_steps: [say(lang, `Start at ${n} and say the next number.`, `${n} sayısından başla ve sonraki sayıyı söyle.`,
                           `Empieza en ${n} y di el número siguiente.`),
                 say(lang, `Counting up goes ${countRun(1, n, 1)}`, `İleri sayma: ${countRun(1, n, 1)}`,
                           `Contando hacia adelante: ${countRun(1, n, 1)}`)],
    visual: { kind: 'count', n, item: pick(COUNT_ITEMS), upTo: true },
  }
}

// Year 2 and up: "Numbers to 100" — one/ten more and less, and counting on in 2s, 5s and 10s.
// Scaled by the band so a Year 3 child works to 1000 rather than to 20.
function numberLineTemplate(level, lang) {
  const { max: cap } = rangeForLevel(level)
  const shape = pick(['more', 'less', 'step'])

  if (shape === 'step') {
    const step = pick([2, 5, 10])
    // The whole sequence, including the answer, has to fit the year's ceiling — a Year 2
    // sequence running 370, 380, 390, 400 is outside "Numbers to 100" even though each step
    // is right.
    const highestStart = Math.max(step, cap - step * 4)
    const start = randInt(1, Math.max(1, Math.floor(highestStart / step))) * step
    const terms = [start, start + step, start + step * 2, start + step * 3]
    return {
      topic: 'counting', level,
      // A bare sequence, both languages. The Turkish sentence it replaces was ungrammatical
      // ("__ sırada hangi sayı gelir"), and the words bought nothing: the row of numbers with
      // a gap on the end already asks the question. Being bare is also what lets the help
      // panel recognise it and walk the child arrow by arrow (see isBareSequence).
      question_text: `${terms.join(', ')}, ?`,
      format: 'numeric',
      correct_answer: start + step * 4,
      operandKey: `step:${step}:${start}`,
      hint_steps: [say(lang, `Look at the gap between each number.`, `Sayılar arasındaki farka bak.`,
                             `Mira la diferencia entre un número y el siguiente.`),
                   say(lang, `Each one goes up by ${step}.`, `Her seferinde ${step} artıyor.`,
                             `Cada vez sube ${step}.`)],
    }
  }

  const amount = pick([1, 10])
  const up = shape === 'more'
  // The ANSWER has to fit the ceiling too: "10 more than 99" is 109, outside a Year 2 that
  // says "numbers to 100".
  // Must stay above the amount being taken away, or "10 less than 10" asks a six-year-old for
  // zero — outside the positive-whole-number contract the rest of the app is built on.
  const low = amount + 1
  const n = randInt(low, Math.max(low + 1, up ? cap - amount : cap))   // randInt is inclusive
  return {
    topic: 'counting', level,
    question_text: say(lang,
      `What is ${amount} ${up ? 'more' : 'less'} than ${n}?`,
      `${n} sayısının ${amount} ${up ? 'fazlası' : 'eksiği'} kaçtır?`,
      `¿Cuánto es ${amount} ${up ? 'más' : 'menos'} que ${n}?`),
    format: 'numeric',
    correct_answer: up ? n + amount : n - amount,
    operandKey: `${up ? 'more' : 'less'}:${amount}:${n}`,
    hint_steps: [
      amount === 10
        ? say(lang, 'Ten more changes the tens digit, not the ones.', 'On fazlası onlar basamağını değiştirir, birler aynı kalır.',
                    'Diez más cambia la cifra de las decenas, no la de las unidades.')
        : say(lang, `Start at ${n}.`, `${n} sayısından başla.`, `Empieza en ${n}.`),
      up ? say(lang, `Count ${amount} forwards from ${n}.`, `${n} sayısından ${amount} ileri say.`,
                     `Cuenta ${amount} hacia adelante desde ${n}.`)
         : say(lang, `Count ${amount} backwards from ${n}.`, `${n} sayısından ${amount} geri say.`,
                     `Cuenta ${amount} hacia atrás desde ${n}.`),
    ],
  }
}

// ── Time ─────────────────────────────────────────────────────────────────────
// Time was on the model's side of the line, and it is the worst topic to leave there: the
// model writes "the clock shows quarter past four" in words, so the child answers a reading
// question about a clock they never see. A template can state the time exactly, which is what
// lets the clock be DRAWN — on the question, and turnable by hand in the help panel.
//
// Every shape here answers with a plain whole number, because the keypad has no colon. That is
// a real constraint rather than a dodge: "how many minutes past 4" is the question a child
// actually has to answer inside themselves before they can say the time at all.

// Which minutes a year is allowed to land on. Year 1 tells the time to the hour and half past,
// Year 2 to five minutes, Year 3 to the nearest minute — so the FACE gets harder with the year
// rather than the arithmetic on top of it.
function minuteChoicesForBand(band) {
  if (band <= 1) return [0, 30]
  if (band === 2) return [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
  return Array.from({ length: 59 }, (_, i) => i + 1)
}

function timeTemplate(level, lang) {
  const band = bandForLevel(level)
  // Years 2 and 3 add the book's time questions: what time it will be, how long between two
  // times, a timetable, a watch that is fast. The clock-reading shapes below keep the rest.
  if (band >= 2 && Math.random() < 0.45) return timeYoung(level, lang)
  const h = randInt(1, 12)
  const next = h === 12 ? 1 : h + 1
  const shapes = band <= 1 ? ['hour', 'halfPast', 'later']
    : band === 2 ? ['past', 'to', 'span', 'hour', 'later']
    : ['past', 'to', 'span', 'later', 'h24']
  const shape = pick(shapes)
  // Spanish puts an article before the hour and it is singular for one o'clock: "la una", but
  // "las dos". Same reason TR_ACC exists a few lines down — the language does something to the
  // number that its digits do not tell you.
  const esAt = h === 1 ? 'la' : 'las'
  const esNext = next === 1 ? 'la' : 'las'

  if (shape === 'hour') {
    return {
      topic: 'time', level,
      question_text: say(lang, 'What time is it? Write just the hour.', 'Saat kaç? Sadece saati yaz.',
                               '¿Qué hora es? Escribe solo la hora.'),
      format: 'numeric',
      correct_answer: h,
      operandKey: `time:hour:${h}`,
      visual: { kind: 'clock', hour: h, minute: 0, ask: 'hour' },
      hint_steps: [
        say(lang, 'The short hand is the hour hand.', 'Kısa kol akreptir, saati gösterir.',
                  'La aguja corta es la de las horas.'),
        say(lang, 'Read the number the short hand points at.', 'Akrebin gösterdiği sayıyı oku.',
                  'Lee el número al que apunta la aguja corta.'),
      ],
    }
  }

  // Year 1's half past is not "what is 30" — asking that gives the same answer every time. The
  // actual skill, and the mistake children reliably make, is that at half past the short hand
  // sits BETWEEN two numbers and the earlier one is the answer.
  if (shape === 'halfPast') {
    return {
      topic: 'time', level,
      question_text: say(lang,
        'It is half past. Which hour has it just gone past?',
        'Saat buçuğu gösteriyor. Hangi saati yeni geçti?',
        'Es y media. ¿Qué hora acaba de pasar?'),
      format: 'numeric',
      correct_answer: h,
      operandKey: `time:halfPast:${h}`,
      visual: { kind: 'clock', hour: h, minute: 30, ask: 'halfPast' },
      hint_steps: [
        say(lang, 'At half past, the short hand sits between two numbers.',
                  'Buçukta akrep iki sayının arasında durur.',
                  'A y media, la aguja corta se queda entre dos números.'),
        say(lang, 'The answer is the number it has already passed, not the one ahead.',
                  'Cevap, akrebin geçtiği sayıdır — ilerideki değil.',
                  'La respuesta es el número que ya ha pasado, no el que viene.'),
      ],
    }
  }

  if (shape === 'past') {
    // Past 30 a child is taught to read it the other way round ("ten to five"), which is what
    // the 'to' shape asks — so this one stays in the first half of the hour. 0 is excluded
    // because "how many minutes past 4 is 4 o'clock" gives them nothing to look at.
    const m = pick(minuteChoicesForBand(band).filter(v => v > 0 && (band >= 3 || v <= 30)))
    return {
      topic: 'time', level,
      question_text: say(lang, `How many minutes past ${h} is it?`, `Saat ${TR_ACC[h]} kaç dakika geçiyor?`,
                               `¿Cuántos minutos han pasado de ${esAt} ${h}?`),
      format: 'numeric',
      correct_answer: m,
      operandKey: `time:past:${h}:${m}`,
      visual: { kind: 'clock', hour: h, minute: m, ask: 'past' },
      hint_steps: [
        say(lang, 'The long hand counts the minutes, starting from 12.',
                  'Yelkovan dakikaları sayar, 12\'den başlayarak.',
                  'La aguja larga cuenta los minutos, empezando en el 12.'),
        say(lang, 'Every number on the face is 5 minutes — count round in fives from 12.',
                  'Kadrandaki her sayı 5 dakikadır — 12\'den başlayıp beşer beşer say.',
                  'Cada número de la esfera son 5 minutos: cuenta de cinco en cinco desde el 12.'),
      ],
    }
  }

  if (shape === 'to') {
    const m = pick(minuteChoicesForBand(band).filter(v => v >= 35))
    return {
      topic: 'time', level,
      question_text: say(lang, `How many minutes until ${next} o'clock?`, `Saat ${next} olmasına kaç dakika var?`,
                               `¿Cuántos minutos faltan para ${esNext} ${next}?`),
      format: 'numeric',
      correct_answer: 60 - m,
      operandKey: `time:to:${h}:${m}`,
      visual: { kind: 'clock', hour: h, minute: m, ask: 'to' },
      hint_steps: [
        say(lang, 'A whole turn of the long hand is 60 minutes.', 'Yelkovanın bir tam turu 60 dakikadır.',
                  'Una vuelta entera de la aguja larga son 60 minutos.'),
        say(lang, 'Count on from the long hand round to 12.', 'Yelkovandan 12\'ye kadar ilerleyerek say.',
                  'Cuenta desde la aguja larga hasta el 12.'),
      ],
    }
  }

  if (shape === 'span') {
    const n = randInt(2, band >= 3 ? 6 : 3)
    return {
      topic: 'time', level,
      question_text: say(lang, `How many minutes are there in ${n} hours?`, `${n} saatte kaç dakika vardır?`,
                               `¿Cuántos minutos hay en ${n} horas?`),
      format: 'numeric',
      correct_answer: n * 60,
      operandKey: `time:span:${n}`,
      // `hours` so the help can count the turns rather than demonstrating one and stopping.
      visual: { kind: 'clock', hour: 12, minute: 0, ask: 'span', hours: n },
      hint_steps: [
        say(lang, 'One hour is 60 minutes.', 'Bir saat 60 dakikadır.', 'Una hora son 60 minutos.'),
        say(lang, `So ${n} hours is ${n} lots of 60.`, `Yani ${n} saat, ${n} kere 60 eder.`,
                  `Así que ${n} horas son ${n} veces 60.`),
      ],
    }
  }

  if (shape === 'h24') {
    // Afternoon only — the morning half is the same number twice over and teaches nothing.
    // The minutes are cosmetic here, so they stay in the first half of the hour: at 11:59 the
    // short hand is already touching the 12 and a child reads the hour as 12, which turns a
    // question about 24-hour time into a trick about hand positions.
    const m = pick([0, 5, 10, 15, 20])
    const afternoon = randInt(1, 11)
    return {
      topic: 'time', level,
      question_text: say(lang,
        'The clock shows the afternoon. What is the hour on a 24-hour clock?',
        'Saat öğleden sonrayı gösteriyor. 24 saatlik gösterimde saat kaçtır?',
        'El reloj marca la tarde. ¿Qué hora es en el reloj de 24 horas?'),
      format: 'numeric',
      correct_answer: afternoon + 12,
      operandKey: `time:h24:${afternoon}:${m}`,
      visual: { kind: 'clock', hour: afternoon, minute: m, ask: 'h24' },
      hint_steps: [
        say(lang, 'A 24-hour clock keeps counting after midday instead of starting again at 1.',
                  '24 saatlik gösterim öğleden sonra 1\'e dönmez, saymaya devam eder.',
                  'El reloj de 24 horas sigue contando después del mediodía en vez de volver a la 1.'),
        say(lang, 'So an afternoon hour is that hour plus 12.', 'Yani öğleden sonraki saate 12 eklenir.',
                  'Así que a una hora de la tarde se le suman 12.'),
      ],
    }
  }

  // 'later' — the only shape that asks the child to move the clock rather than read it, which
  // is exactly what the draggable hands are for.
  const n = randInt(1, band <= 1 ? 3 : 6)
  return {
    topic: 'time', level,
    question_text: say(lang,
      `It is ${h} o'clock. What time will it be in ${n} ${n === 1 ? 'hour' : 'hours'}? Write just the hour.`,
      `Saat ${h}. ${n} saat sonra saat kaç olur? Sadece saati yaz.`,
      `${h === 1 ? 'Es' : 'Son'} ${esAt} ${h}. ¿Qué hora será dentro de ${n} ${n === 1 ? 'hora' : 'horas'}? Escribe solo la hora.`),
    format: 'numeric',
    correct_answer: ((h + n - 1) % 12) + 1,
    operandKey: `time:later:${h}:${n}`,
    visual: { kind: 'clock', hour: h, minute: 0, ask: 'later' },
    hint_steps: [
      say(lang, 'Move the short hand on one hour at a time.', 'Akrebi birer saat ilerlet.',
                'Mueve la aguja corta de hora en hora.'),
      say(lang, `Count ${n} hours on from ${h}.`, `${TR_ABL[h]} başlayarak ${n} saat ileri say.`,
                `Cuenta ${n} ${n === 1 ? 'hora' : 'horas'} desde ${esAt} ${h}.`),
    ],
  }
}

// ── Place value, rounding and negative numbers ───────────────────────────────
// Year 6's "Numbers to 10,000,000" and Year 7's "Negative Numbers and Rounding". Both were
// model-only: Year 6 had no template at all, which is the whole of why the hundred-question
// audit found every content defect in the oldest three ages.
//
// The keypad has no minus key, so a question whose ANSWER is negative has to be offered as
// options. Negative numbers still appear inside the question freely — that is the half of the
// curriculum a number pad cannot stop.

// A lookup by place, not a bank to draw from — the separator is the language's own, so this
// cannot go through `num()` (which would need a number, and these are labels).
const ROUND_UNITS = { en: ['10', '100', '1,000', '10,000', '100,000'],
                      tr: ['10', '100', '1.000', '10.000', '100.000'],
                      es: ['10', '100', '1.000', '10.000', '100.000'] }

// Rounding to a named place. The wrong options are the two neighbouring places and the same
// number rounded the wrong way — a child who rounds 4,600 down to 4,000 has made a rule
// mistake, not an arithmetic one, and the option says which.
function placeRound(level, lang) {
  const band = bandForLevel(level)
  // Each year rounds to the places its own curriculum line names, and no further. Year 4 says
  // "round to the nearest 10, 100 or 1,000"; Year 5 adds ten and a hundred thousand; Year 6
  // says "round any whole number". Rounding a Year 4 child's number to the nearest hundred
  // thousand is not a harder version of their topic, it is a different one.
  const placeIdx = band >= 6 ? randInt(1, 4) : band >= 5 ? randInt(0, 3) : randInt(0, 2)
  const place = Math.pow(10, placeIdx + 1)
  // Kept clear of an exact multiple (nothing to round) and of an exact half (the rule for
  // 4,500 is a convention, and a question should not turn on remembering a convention).
  let n
  do { n = randInt(place * 2, place * 60) } while (n % place === 0 || (n % place) * 2 === place)
  const answer = Math.round(n / place) * place
  const unit = (ROUND_UNITS[lang] || ROUND_UNITS.en)[placeIdx]

  return {
    topic: 'place-value', level,
    question_text: say(lang,
      `Round ${num(n, lang)} to the nearest ${unit}.`,
      `${num(n, lang)} sayısını en yakın ${unit} sayısına yuvarla.`,
      `Redondea ${num(n, lang)} a la ${unit} más cercana.`),
    format: 'numeric',
    correct_answer: answer,
    operandKey: `pv:round:${n}:${place}`,
    hint_steps: [
      say(lang,
        `Look at the digit just to the right of the ${unit} place — that one digit decides it.`,
        `${unit} basamağının hemen sağındaki rakama bak — kararı o tek rakam verir.`,
        `Mira la cifra justo a la derecha de la posición de ${unit}: esa sola cifra lo decide.`),
      say(lang,
        `5 or more goes up, less than 5 stays. Everything to the right becomes 0.`,
        `5 ve üstü yukarı çıkar, 5'ten küçük olduğu yerde kalır. Sağındaki her şey 0 olur.`,
        `5 o más sube, menos de 5 se queda. Todo lo que hay a la derecha pasa a ser 0.`),
    ],
  }
}

// "In 103,247 what is the 3 worth?" — straight out of Bond's 10-11 book, and the question that
// separates knowing the digits from knowing the places.
function placeDigitValue(level, lang) {
  const band = bandForLevel(level)
  // Same idea: the number itself is the size the year's topic is named after — "Numbers to
  // 10,000" is four digits, and asking what a digit is worth in a seven-digit number is not
  // that topic.
  const digits = band >= 6 ? randInt(6, 7) : band >= 5 ? randInt(5, 6) : band >= 4 ? 4 : 3
  // Built digit by digit so the chosen digit is unique in the number: "what is the 3 worth"
  // has no answer if there are two 3s.
  const used = new Set()
  const ds = []
  for (let i = 0; i < digits; i++) {
    let d
    do { d = i === 0 ? randInt(1, 9) : randInt(0, 9) } while (used.has(d))
    used.add(d); ds.push(d)
  }
  // Never the ones or the tens place. At ones the answer IS the digit, so the "that is the
  // digit itself" option becomes a second correct answer; at tens the "one place too low"
  // option collapses onto it as well. Both would put two identical choices on screen.
  // Never a 0 either, for the same reason taken to its limit: "what is the 0 worth" has all
  // four options reading 0. It is also not a question — a 0 is a placeholder, not a value.
  let at
  do { at = randInt(0, digits - 3) } while (ds[at] === 0)
  const digit = ds[at]
  const power = digits - 1 - at
  const n = Number(ds.join(''))
  const answer = digit * Math.pow(10, power)

  const options = shuffle([
    { value: num(answer, lang), why: say(lang,
        `Right — the ${digit} sits ${power} place${power === 1 ? '' : 's'} up from the ones, so it is worth ${num(answer, lang)}.`,
        `Doğru — ${digit} rakamı birler basamağından ${power} basamak yukarıda, yani ${num(answer, lang)} değerinde.`,
        `Correcto: el ${digit} está ${power} posición${power === 1 ? '' : 'es'} por encima de las unidades, así que vale ${num(answer, lang)}.`) },
    { value: String(digit), why: say(lang,
        `That is the digit itself. The question asks what it is WORTH, which depends on where it sits.`,
        `Bu rakamın kendisi. Soru rakamın DEĞERİNİ soruyor, o da bulunduğu basamağa bağlı.`,
        `Esa es la cifra en sí. La pregunta es cuánto VALE, y eso depende de su posición.`) },
    { value: num(digit * Math.pow(10, Math.max(0, power - 1)), lang), why: say(lang,
        `One place too low — count the places to the right of the ${digit} again.`,
        `Bir basamak eksik — ${digit} rakamının sağındaki basamakları tekrar say.`,
        `Una posición de menos: vuelve a contar las posiciones a la derecha del ${digit}.`) },
    { value: num(digit * Math.pow(10, power + 1), lang), why: say(lang,
        `One place too high — the ${digit} has ${power} digit${power === 1 ? '' : 's'} after it, not ${power + 1}.`,
        `Bir basamak fazla — ${digit} rakamından sonra ${power} rakam var, ${power + 1} değil.`,
        `Una posición de más: después del ${digit} hay ${power} cifra${power === 1 ? '' : 's'}, no ${power + 1}.`) },
  ])

  return {
    topic: 'place-value', level,
    question_text: say(lang,
      `In ${num(n, lang)}, what is the ${digit} worth?`,
      `${num(n, lang)} sayısında ${digit} rakamının değeri kaçtır?`,
      `En ${num(n, lang)}, ¿cuánto vale el ${digit}?`),
    format: 'choice',
    options,
    correct_answer: num(answer, lang),
    operandKey: `pv:digit:${n}:${at}`,
    hint_steps: [
      say(lang, `Name the places from the right: ones, tens, hundreds, thousands…`,
                `Basamakları sağdan adlandır: birler, onlar, yüzler, binler…`,
                `Nombra las posiciones desde la derecha: unidades, decenas, centenas, millares…`),
      say(lang, `Find which place the ${digit} is standing in.`,
                `${digit} rakamının hangi basamakta durduğunu bul.`,
                `Busca en qué posición está el ${digit}.`),
    ],
  }
}

// Intervals across zero. The answer is a COUNT of degrees, which is positive and typable —
// the version where the answer is the new temperature would need a minus key.
function placeNegative(level, lang) {
  // Year 4 is where "count backwards through 0" first appears, so the crossing is small there
  // and opens up later.
  const band = bandForLevel(level)
  const below = band >= 5 ? randInt(2, 14) : randInt(2, 8)
  const above = band >= 5 ? randInt(1, 12) : randInt(1, 7)
  const answer = below + above
  // Cities only: the sentence says "in ___", and "in the mountain" is not English. The
  // Turkish bank carries its own locative ending because Turkish marks it on the word.
  const place = pickL({ en: ['Oslo', 'Helsinki', 'Moscow', 'Calgary', 'Tromso'],
                        tr: ["Oslo'da", "Helsinki'de", "Moskova'da", "Calgary'de", "Tromso'da"],
                        es: ['Oslo', 'Helsinki', 'Moscú', 'Calgary', 'Tromso'] }, lang)

  return {
    topic: 'place-value', level,
    question_text: say(lang,
      `At dawn it was −${below}°C in ${place}. By noon it was ${above}°C. How many degrees did it rise?`,
      `Şafakta ${place} sıcaklık −${below}°C idi. Öğlen ${above}°C oldu. Kaç derece yükseldi?`,
      `Al amanecer hacía −${below}°C en ${place}. A mediodía hacía ${above}°C. ¿Cuántos grados subió?`),
    format: 'numeric',
    correct_answer: answer,
    operandKey: `pv:neg:${below}:${above}`,
    hint_steps: [
      say(lang, `Count up to 0 first — that is ${below} degrees on its own.`,
                `Önce 0'a kadar çık — bu tek başına ${below} derece.`,
                `Primero sube hasta 0: eso ya son ${below} grados.`),
      say(lang, `Then carry on from 0 up to ${above}, and add the two climbs.`,
                `Sonra 0'dan ${above} dereceye devam et ve iki çıkışı topla.`,
                `Luego sigue desde 0 hasta ${above} y suma las dos subidas.`),
    ],
  }
}

// Year 7: round to a given number of decimal places. This is the shape the keypad's decimal
// point was opened for — as multiple choice it teaches picking, not rounding.
function placeRoundDecimal(level, lang) {
  const dp = pick([1, 2])
  const whole = randInt(2, 89)
  // Four decimals so there is always a digit to look at past the rounding place, and never an
  // exact half at that digit.
  // Rejected: an exact half at the deciding digit (the rule there is a convention, not a
  // skill), and a value that rounds to a whole number — "round to the nearest tenth" answered
  // by "48" shows the child nothing about tenths.
  let frac, value, answer
  do {
    frac = randInt(1000, 9999)
    value = Number(`${whole}.${frac}`)
    answer = Number(value.toFixed(dp))
    // Rejected as well: a result that lands on FEWER decimal places than were asked for.
    // 49.604 to the nearest hundredth is 49.6, which is right and reads as though the
    // rounding never happened.
  } while ((String(frac)[dp] === '5' && Number(String(frac).slice(dp + 1)) === 0)
    || Number.isInteger(answer)
    || (String(answer).split('.')[1] || '').length !== dp)
  const unit = pickL({ en: ['litres', 'metres', 'kilograms', 'seconds'],
                       tr: ['litre', 'metre', 'kilogram', 'saniye'],
                       es: ['litros', 'metros', 'kilogramos', 'segundos'] }, lang)
  const placeName = dp === 1
    ? say(lang, 'tenth', 'onda bir', 'décima')
    : say(lang, 'hundredth', 'yüzde bir', 'centésima')

  return {
    topic: 'place-value', level,
    question_text: say(lang,
      `Round ${value} ${unit} to the nearest ${placeName}.`,
      `${String(value).replace('.', ',')} ${unit} değerini en yakın ${placeName}e yuvarla.`,
      `Redondea ${String(value).replace('.', ',')} ${unit} a la ${placeName} más cercana.`),
    // 'decimal' rather than 'numeric': the answer has a point in it, and the keypad only shows
    // its point when the question says it will be needed.
    format: 'decimal',
    correct_answer: answer,
    operandKey: `pv:dp:${value}:${dp}`,
    hint_steps: [
      say(lang, `Keep ${dp} digit${dp === 1 ? '' : 's'} after the point and look at the next one along.`,
                `Virgülden sonra ${dp} rakam tut ve bir sonrakine bak.`,
                `Quédate con ${dp} cifra${dp === 1 ? '' : 's'} tras la coma y mira la siguiente.`),
      say(lang, `5 or more rounds the last kept digit up; less than 5 leaves it alone.`,
                `5 ve üstü tuttuğun son rakamı bir artırır; 5'ten küçükse rakam olduğu gibi kalır.`,
                `5 o más sube la última cifra que has guardado; menos de 5 la deja igual.`),
    ],
  }
}

// Year 3's own line: "count from 0 in multiples of 4, 8, 50 and 100; recognise place value of
// each digit in a 3-digit number; compare and order numbers up to 1,000." No rounding — that
// starts in Year 4 — so the rounding shape is kept out of this band entirely.
function placeCountInMultiples(level, lang) {
  const step = pick([4, 8, 50, 100])
  const start = step * randInt(1, 4)
  const terms = [0, 1, 2, 3].map(i => start + step * i)
  return {
    topic: 'place-value', level,
    question_text: say(lang,
      `Count on in ${step}s. What comes next? ${terms.map(t => num(t, lang)).join(', ')}, …`,
      `${step}'şer sayarak ilerle. Sırada ne gelir? ${terms.map(t => num(t, lang)).join(', ')}, …`,
      `Cuenta de ${step} en ${step}. ¿Qué viene después? ${terms.map(t => num(t, lang)).join(', ')}, …`),
    format: 'numeric',
    correct_answer: start + step * 4,
    operandKey: `pv:mult:${step}:${start}`,
    hint_steps: [
      say(lang, `Every step goes up by the same amount.`,
                `Her adımda aynı kadar artıyor.`,
                `Cada paso sube lo mismo.`),
      say(lang, `Check the gap between two of them, then add that to ${num(terms[3], lang)}.`,
                `İkisinin arasındaki farka bak, sonra onu ${num(terms[3], lang)} sayısına ekle.`,
                `Mira el salto entre dos de ellos y súmalo a ${num(terms[3], lang)}.`),
    ],
  }
}

function placeCompare(level, lang) {
  // Four numbers close enough that they cannot be told apart at a glance — the skill is
  // comparing digit by digit from the left, not spotting the obviously biggest.
  const hundreds = randInt(2, 9)
  const set = new Set()
  while (set.size < 4) set.add(hundreds * 100 + randInt(0, 99))
  const xs = [...set]
  const askBiggest = Math.random() < 0.5
  const answer = askBiggest ? Math.max(...xs) : Math.min(...xs)
  return {
    topic: 'place-value', level,
    question_text: askBiggest
      ? say(lang, `Which of these is the largest? ${xs.map(x => num(x, lang)).join(', ')}`,
                  `Bunlardan hangisi en büyük? ${xs.map(x => num(x, lang)).join(', ')}`,
                  `¿Cuál de estos es el mayor? ${xs.map(x => num(x, lang)).join(', ')}`)
      : say(lang, `Which of these is the smallest? ${xs.map(x => num(x, lang)).join(', ')}`,
                  `Bunlardan hangisi en küçük? ${xs.map(x => num(x, lang)).join(', ')}`,
                  `¿Cuál de estos es el menor? ${xs.map(x => num(x, lang)).join(', ')}`),
    format: 'numeric',
    correct_answer: answer,
    operandKey: `pv:cmp:${xs.slice().sort((a, b) => a - b).join('-')}`,
    hint_steps: [
      say(lang, `Compare the hundreds first, then the tens, then the ones.`,
                `Önce yüzleri, sonra onları, sonra birleri karşılaştır.`,
                `Compara primero las centenas, luego las decenas y después las unidades.`),
      say(lang, `The first place where they differ is the one that decides it.`,
                `Farklılaştıkları ilk basamak kararı verir.`,
                `La primera posición en la que se diferencian es la que decide.`),
    ],
  }
}

function placeValueTemplate(level, lang) {
  const band = bandForLevel(level)
  const young = band >= 3 && band <= 4 ? youngPlaceValue(level, lang) : null
  if (young) return young
  // Number lines running past zero and between whole numbers, as the 11+-12+ book draws them.
  if (band >= 6 && Math.random() < 0.22) return numberLineOlder(level, lang)
  // Year 3 does not round and does not use negative numbers — both arrive in Year 4 — so its
  // band gets its own three shapes rather than a softened version of the others.
  const shapes = band <= 3
    ? ['multiples', 'multiples', 'compare', 'compare', 'digit']
    : band >= 7
      ? ['round', 'digit', 'negative', 'roundDecimal', 'roundDecimal']
      : ['round', 'round', 'digit', 'negative']
  const shape = pick(shapes)
  if (shape === 'multiples') return placeCountInMultiples(level, lang)
  if (shape === 'compare') return placeCompare(level, lang)
  if (shape === 'digit') return placeDigitValue(level, lang)
  if (shape === 'negative') return placeNegative(level, lang)
  if (shape === 'roundDecimal') return placeRoundDecimal(level, lang)
  return placeRound(level, lang)
}

// ── Algebra ──────────────────────────────────────────────────────────────────
// Year 6's "Algebra" and Year 7's "Expressions and Equations". Both were model-only.
//
// The shapes come from Bond's two books rather than from the curriculum line alone, because
// the line says "express missing number problems algebraically" and the books show what that
// looks like to a child: a think-of-a-number puzzle, a formula to substitute into, a
// perimeter written in terms of x. Year 7 adds the unknown on BOTH sides, which Year 6's
// national curriculum does not have and Bond's 10-11 book does — the 11+ is ahead of the
// curriculum, and that difference is the whole reason the harder shape sits a year up.
//
// Every equation here is built from its solution outwards, never rolled and then solved:
// pick x, pick the coefficients, compute the constant. That way the answer is always a whole
// number by construction and no generated question can turn out to have no answer.

const ALG_NAMES = { en: ['Alice', 'Omar', 'Priya', 'Jonah', 'Maya', 'Ben'],
                    tr: ['Elif', 'Kerem', 'Defne', 'Baran', 'Nil', 'Tuna'],
                    es: ['Lucía', 'Mateo', 'Sofía', 'Diego', 'Vera', 'Hugo'] }

// "I think of a number, multiply by 4, then add 12. The answer is 76." Inverse operations,
// and the one shape in this template a ten-year-old meets before they meet a letter.
function algThinkOfNumber(level, lang) {
  const x = randInt(3, 24)
  const mult = pick([2, 3, 4, 5, 6])
  const add = randInt(5, 30)
  const plus = Math.random() < 0.7
  const total = plus ? x * mult + add : x * mult - add
  const name = pickL(ALG_NAMES, lang)

  return {
    topic: 'algebra', level,
    question_text: plus
      ? say(lang,
          `${name} thinks of a number, multiplies it by ${mult} and adds ${add}. The answer is ${total}. What was the number?`,
          `${name} bir sayı tutuyor, ${mult} ile çarpıp ${add} ekliyor. Sonuç ${total}. Tuttuğu sayı kaç?`,
          `${name} piensa un número, lo multiplica por ${mult} y le suma ${add}. Sale ${total}. ¿Qué número era?`)
      : say(lang,
          `${name} thinks of a number, multiplies it by ${mult} and takes away ${add}. The answer is ${total}. What was the number?`,
          `${name} bir sayı tutuyor, ${mult} ile çarpıp ${add} çıkarıyor. Sonuç ${total}. Tuttuğu sayı kaç?`,
          `${name} piensa un número, lo multiplica por ${mult} y le resta ${add}. Sale ${total}. ¿Qué número era?`),
    format: 'numeric',
    correct_answer: x,
    operandKey: `alg:think:${mult}:${add}:${x}`,
    hint_steps: [
      say(lang, `Work backwards from ${total}, undoing each step in reverse order.`,
                `${total} sayısından geriye doğru git, adımları ters sırayla geri al.`,
                `Ve hacia atrás desde ${total}, deshaciendo cada paso en orden inverso.`),
      plus
        ? say(lang, `The last thing done was adding ${add}, so undo that first — then undo the × ${mult}.`,
                    `En son ${add} eklendi, önce onu geri al — sonra ${mult} ile çarpmayı geri al.`,
                    `Lo último fue sumar ${add}, así que deshaz eso primero y luego el × ${mult}.`)
        : say(lang, `The last thing done was taking away ${add}, so undo that first — then undo the × ${mult}.`,
                    `En son ${add} çıkarıldı, önce onu geri al — sonra ${mult} ile çarpmayı geri al.`,
                    `Lo último fue restar ${add}, así que deshaz eso primero y luego el × ${mult}.`),
    ],
  }
}

// Substitution: 4a + 2b − c, find the value. Year 7 gets a negative among the letters, which
// is where substitution stops being arithmetic with extra steps.
function algSubstitute(level, lang) {
  const band = bandForLevel(level)
  const negatives = band >= 7 && Math.random() < 0.5
  const a = randInt(2, 9)
  const b = negatives ? -randInt(2, 7) : randInt(2, 9)
  const ca = randInt(2, 6)
  const cb = randInt(2, 5)
  const extra = randInt(1, 12)
  const answer = ca * a + cb * b + extra
  // Built to land positive: there is no minus key, so a negative total would be untypable.
  if (answer <= 0) return algSubstitute(level, lang)
  const bWritten = b < 0 ? `−${Math.abs(b)}` : String(b)

  return {
    topic: 'algebra', level,
    question_text: say(lang,
      `If a = ${a} and b = ${bWritten}, what is ${ca}a + ${cb}b + ${extra}?`,
      `a = ${a} ve b = ${bWritten} ise, ${ca}a + ${cb}b + ${extra} kaçtır?`,
      `Si a = ${a} y b = ${bWritten}, ¿cuánto vale ${ca}a + ${cb}b + ${extra}?`),
    format: 'numeric',
    correct_answer: answer,
    operandKey: `alg:sub:${ca}:${a}:${cb}:${b}:${extra}`,
    hint_steps: [
      say(lang, `${ca}a means ${ca} × a. Put the numbers in place of the letters first.`,
                `${ca}a demek ${ca} × a demek. Önce harflerin yerine sayıları koy.`,
                `${ca}a significa ${ca} × a. Primero pon los números en lugar de las letras.`),
      negatives
        ? say(lang, `Adding a negative number makes the total smaller — ${cb} × ${bWritten} takes away.`,
                    `Negatif bir sayı eklemek toplamı küçültür — ${cb} × ${bWritten} eksiltir.`,
                    `Sumar un número negativo hace el total más pequeño: ${cb} × ${bWritten} resta.`)
        : say(lang, `Do both multiplications before you add anything.`,
                    `Bir şey toplamadan önce iki çarpmayı da yap.`,
                    `Haz las dos multiplicaciones antes de sumar nada.`),
    ],
  }
}

// Solving. Year 6 gets the unknown on one side; Year 7 gets it on both, which is where a
// child has to move terms rather than just undo them.
function algSolve(level, lang) {
  const band = bandForLevel(level)
  const bothSides = band >= 7
  const x = randInt(2, 15)

  if (!bothSides) {
    const m = pick([2, 3, 4, 5, 6, 7])
    const c = randInt(3, 25)
    const total = m * x + c
    return {
      topic: 'algebra', level,
      question_text: say(lang, `If ${m}x + ${c} = ${total}, what is x?`,
                               `${m}x + ${c} = ${total} ise x kaçtır?`,
                               `Si ${m}x + ${c} = ${total}, ¿cuánto vale x?`),
      format: 'numeric',
      correct_answer: x,
      operandKey: `alg:solve1:${m}:${c}:${x}`,
      hint_steps: [
        say(lang, `Whatever you do to one side, do to the other — that keeps it balanced.`,
                  `Bir tarafa ne yaparsan diğerine de yap — denge böyle korunur.`,
                  `Lo que hagas a un lado, hazlo al otro: así sigue equilibrada.`),
        say(lang, `Take ${c} off both sides first, then divide both sides by ${m}.`,
                  `Önce iki taraftan da ${c} çıkar, sonra iki tarafı da ${m}'e böl.`,
                  `Primero quita ${c} a los dos lados y luego divide los dos lados entre ${m}.`),
      ],
    }
  }

  // Both sides: ax + b = cx + d, built so a > c and both constants land positive.
  const c2 = randInt(2, 6)
  const a2 = c2 + randInt(1, 5)
  const d = randInt(5, 40)
  const b = (c2 - a2) * x + d
  if (b <= 0) return algSolve(level, lang)
  return {
    topic: 'algebra', level,
    question_text: say(lang, `If ${a2}x + ${b} = ${c2}x + ${d}, what is x?`,
                             `${a2}x + ${b} = ${c2}x + ${d} ise x kaçtır?`,
                             `Si ${a2}x + ${b} = ${c2}x + ${d}, ¿cuánto vale x?`),
    format: 'numeric',
    correct_answer: x,
    operandKey: `alg:solve2:${a2}:${b}:${c2}:${d}`,
    hint_steps: [
      say(lang, `Get all the x terms on one side and all the plain numbers on the other.`,
                `Bütün x'li terimleri bir tarafa, düz sayıları diğer tarafa topla.`,
                `Junta todos los términos con x en un lado y los números sueltos en el otro.`),
      say(lang, `Take ${c2}x off both sides — that leaves ${a2 - c2}x on the left.`,
                `İki taraftan da ${c2}x çıkar — solda ${a2 - c2}x kalır.`,
                `Quita ${c2}x a los dos lados: a la izquierda queda ${a2 - c2}x.`),
    ],
  }
}

// Collecting like terms. A choice question because the answer is an expression, not a number.
// The wrong options are the three mistakes a child actually makes: adding the unlike terms
// together, dropping a sign, and multiplying instead of adding the coefficients.
// A coefficient of 1 is not written: 1y is not how anyone writes y, and a child who has just
// been taught the notation should not meet it written wrongly in the question they are
// being taught it with.
// A phrase drawn from a bank starts a sentence in some languages and not others. Turkish puts
// the shape first in both of these wordings; English and Spanish never do.
// The locale is passed, not left to the host. Turkish capitalises i as İ and ı as I, and the
// default mapping gets the first of those wrong — the same distinction that put a font check
// in this repo. No bank starts with an i today; one will.
function up(w, lang = 'en') {
  return String(w).charAt(0).toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : lang) + String(w).slice(1)
}

// "2, 8, 4 and 11", not "2 and 8 and 4 and 11". Everything but the last joined with a comma,
// the last with the language's own word.
function listWithAnd(parts, lang) {
  if (parts.length <= 1) return parts.join('')
  return parts.slice(0, -1).join(', ') + say(lang, ' and ', ' ve ', ' y ') + parts[parts.length - 1]
}

function term(n, letter) {
  return n === 1 ? letter : `${n}${letter}`
}

function algSimplify(level, lang) {
  // 2 and 2 are excluded together: 2 + 2 and 2 × 2 are both 4, so the "you multiplied the x
  // terms" option would come out identical to the right answer and two of the four choices
  // would be correct. The checker found this, not a reading of the code.
  let a1, a2
  do { a1 = randInt(2, 9); a2 = randInt(2, 9) } while (a1 * a2 === a1 + a2)
  const b1 = randInt(2, 9), b2 = randInt(1, b1 - 1 || 1)
  const xs = a1 + a2
  const ys = b1 + b2
  const correct = `${term(xs, 'x')} + ${term(ys, 'y')}`

  const options = shuffle([
    { value: correct, why: say(lang,
        `Right — only the x terms go together and only the y terms go together.`,
        `Doğru — sadece x'liler kendi arasında, y'liler kendi arasında toplanır.`,
        `Correcto: solo los términos con x se juntan entre sí, y los de y entre sí.`) },
    { value: `${term(xs + ys, 'xy')}`, why: say(lang,
        `x and y are different things, so they cannot be added into one term — ${xs} apples and ${ys} pears are not ${xs + ys} applepears.`,
        `x ile y farklı şeyler, tek terimde toplanamaz — ${xs} elma ve ${ys} armut, ${xs + ys} elmarmut etmez.`,
        `x e y son cosas distintas, no se suman en un solo término: ${xs} manzanas y ${ys} peras no son ${xs + ys} manzaperas.`) },
    { value: `${term(a1 * a2, 'x')} + ${term(ys, 'y')}`, why: say(lang,
        `The x terms were multiplied. ${a1}x + ${a2}x is ${a1} lots of x plus ${a2} more lots of x.`,
        `x'liler çarpılmış. ${a1}x + ${a2}x demek ${a1} tane x'in üstüne ${a2} tane x daha demek.`,
        `Los términos con x se han multiplicado. ${a1}x + ${a2}x son ${a1} equis más otras ${a2} equis.`) },
    { value: `${term(xs, 'x')} + ${term(b1 - b2, 'y')}`, why: say(lang,
        `The y terms were subtracted. Both of them are being added in the question.`,
        `y'liler çıkarılmış. Soruda ikisi de toplanıyor.`,
        `Los términos con y se han restado. En la pregunta los dos se suman.`) },
  ])

  return {
    topic: 'algebra', level,
    question_text: say(lang,
      `Simplify: ${term(a1, 'x')} + ${term(b1, 'y')} + ${term(a2, 'x')} + ${term(b2, 'y')}`,
      `Sadeleştir: ${term(a1, 'x')} + ${term(b1, 'y')} + ${term(a2, 'x')} + ${term(b2, 'y')}`,
      `Simplifica: ${term(a1, 'x')} + ${term(b1, 'y')} + ${term(a2, 'x')} + ${term(b2, 'y')}`),
    format: 'choice',
    options,
    correct_answer: correct,
    operandKey: `alg:simp:${a1}:${a2}:${b1}:${b2}`,
    hint_steps: [
      say(lang, `Like terms are ones with exactly the same letter.`,
                `Benzer terimler, harfi birebir aynı olanlardır.`,
                `Los términos semejantes son los que llevan exactamente la misma letra.`),
      say(lang, `Gather the x terms, then gather the y terms, and leave them side by side.`,
                `Önce x'lileri topla, sonra y'lileri topla, ikisini yan yana bırak.`,
                `Junta primero los términos con x, luego los de y, y déjalos uno al lado del otro.`),
    ],
  }
}

// Writing an expression rather than evaluating one: a rectangle whose length is given in
// terms of its width. Bond asks this in both books and the curriculum line calls it
// "express missing number problems algebraically".
function algExpression(level, lang) {
  const times = pick([2, 3])
  const plus = randInt(1, 9)
  const useTimes = Math.random() < 0.5
  // perimeter = 2(w + l)
  const correct = useTimes ? term(2 + 2 * times, 'x') : `4x + ${2 * plus}`
  const options = shuffle([
    { value: correct, why: useTimes
        ? say(lang, `Right — the two lengths are ${times}x each and the two widths are x each, and all four are added.`,
                    `Doğru — iki uzun kenar ${times}x, iki kısa kenar x, dördü de toplanır.`,
                    `Correcto: los dos lados largos miden ${times}x y los dos cortos x, y se suman los cuatro.`)
        : say(lang, `Right — two widths of x and two lengths of x + ${plus} make 4x + ${2 * plus}.`,
                    `Doğru — iki tane x ve iki tane x + ${plus}, toplamda 4x + ${2 * plus} eder.`,
                    `Correcto: dos anchos de x y dos largos de x + ${plus} dan 4x + ${2 * plus}.`) },
    { value: useTimes ? term(times + 1, 'x') : `2x + ${plus}`, why: say(lang,
        `That is one width and one length added — a perimeter goes all the way round, so all four sides count.`,
        `Bu bir kısa ve bir uzun kenarın toplamı — çevre etrafını tamamen dolaşır, dört kenar da sayılır.`,
        `Eso es un ancho más un largo. El perímetro da toda la vuelta, así que cuentan los cuatro lados.`) },
    { value: useTimes ? term(2 * times, 'x') : `4x + ${plus}`, why: say(lang,
        `Two of the sides were left out or counted once instead of twice.`,
        `Kenarların ikisi atlanmış ya da iki kez yerine bir kez sayılmış.`,
        `Se han dejado fuera dos lados, o se han contado una vez en vez de dos.`) },
    { value: useTimes ? term(times, 'x²') : `x² + ${plus}`, why: say(lang,
        `Multiplying the sides gives the AREA. Perimeter is the distance around the edge, so the sides are added.`,
        `Kenarları çarpmak ALANI verir. Çevre, kenar boyunca dolaşılan uzunluktur, kenarlar toplanır.`,
        `Multiplicar los lados da el ÁREA. El perímetro es la distancia del borde, así que los lados se suman.`) },
  ])

  return {
    topic: 'algebra', level,
    question_text: useTimes
      ? say(lang,
          `A rectangle is x cm wide. It is ${times} times as long as it is wide. What is its perimeter?`,
          `Bir dikdörtgenin genişliği x cm. Uzunluğu genişliğinin ${times} katı. Çevresi kaçtır?`,
          `Un rectángulo mide x cm de ancho. Es ${times} veces más largo que ancho. ¿Cuál es su perímetro?`)
      : say(lang,
          `A rectangle is x cm wide and ${plus} cm longer than it is wide. What is its perimeter?`,
          `Bir dikdörtgenin genişliği x cm, uzunluğu genişliğinden ${plus} cm fazla. Çevresi kaçtır?`,
          `Un rectángulo mide x cm de ancho y ${plus} cm más de largo que de ancho. ¿Cuál es su perímetro?`),
    format: 'choice',
    options,
    correct_answer: correct,
    operandKey: `alg:expr:${useTimes ? 't' + times : 'p' + plus}`,
    hint_steps: [
      say(lang, `Write down what each of the four sides is, in terms of x.`,
                `Dört kenarın her birini x cinsinden yaz.`,
                `Escribe cuánto mide cada uno de los cuatro lados, en función de x.`),
      say(lang, `Perimeter is all four added together. Collect the like terms at the end.`,
                `Çevre, dört kenarın toplamıdır. Sonunda benzer terimleri topla.`,
                `El perímetro es la suma de los cuatro. Al final junta los términos semejantes.`),
    ],
  }
}

function algebraTemplate(level, lang) {
  const band = bandForLevel(level)
  const shapes = band >= 7
    ? ['solve', 'solve', 'substitute', 'substitute', 'simplify', 'think', 'expression']
    : ['think', 'think', 'solve', 'substitute', 'simplify', 'expression']
  // The book's two algebra pictures: points on a line and the rule they follow, and a cross of
  // numbers adding to one total both ways.
  if (band >= 6) { const r = Math.random(); if (r < 0.14) return planeRule(level, lang); if (r < 0.26) return numberCross(level, lang) }
  const shape = pick(shapes)
  if (shape === 'solve') return algSolve(level, lang)
  if (shape === 'substitute') return algSubstitute(level, lang)
  if (shape === 'simplify') return algSimplify(level, lang)
  if (shape === 'expression') return algExpression(level, lang)
  return algThinkOfNumber(level, lang)
}

// ── Ratio and proportion ─────────────────────────────────────────────────────
// Year 6's "Ratio and Proportion" and Year 7's "Ratio, Proportion and Rates". Bond asks all
// four of these shapes in both books; the rate shape (speed, distance, time) is Year 7 only,
// which is also where the curriculum line puts it.

// Simplifying a ratio to its lowest terms. Built from the simplified pair outwards so the
// common factor is known rather than searched for — and so the pair is never already in its
// lowest terms, which would make the question answer itself.
function ratioSimplify(level, lang) {
  // Coprime by construction: the whole skill is dividing by the common factor, and a pair
  // that still shares one after "simplifying" would mark a correct answer wrong.
  const gcd = (x, y) => (y ? gcd(y, x % y) : x)
  let p, q
  do { p = randInt(2, 12); q = randInt(2, 12) } while (p === q || gcd(p, q) !== 1)
  const f = randInt(2, 9)
  const a = p * f, b = q * f
  const correct = `${p}:${q}`

  const options = shuffle([
    { value: correct, why: say(lang,
        `Right — both sides divide by ${f}.`,
        `Doğru — iki taraf da ${f}'e bölünür.`,
        `Correcto: los dos lados se dividen entre ${f}.`) },
    { value: `${q}:${p}`, why: say(lang,
        `The right numbers, the wrong way round. ${a} comes first in the question, so its share comes first in the answer.`,
        `Sayılar doğru ama ters. Soruda önce ${a} geçiyor, cevapta da onun payı önce gelir.`,
        `Los números correctos, pero al revés. En la pregunta va primero ${a}, así que su parte va primero.`) },
    { value: `${a - b === 0 ? a : Math.abs(a - b)}:${f}`, why: say(lang,
        `That is the difference between the two, not the ratio. A ratio keeps both amounts.`,
        `Bu ikisinin farkı, oran değil. Oran iki miktarı da korur.`,
        `Eso es la diferencia entre los dos, no la razón. Una razón conserva las dos cantidades.`) },
    { value: `${p * 2}:${q * 2}`, why: say(lang,
        `Not all the way down — ${p * 2} and ${q * 2} can still both be halved.`,
        `Sonuna kadar sadeleşmemiş — ${p * 2} ile ${q * 2} hâlâ ikiye bölünebilir.`,
        `No está del todo reducida: ${p * 2} y ${q * 2} todavía se pueden dividir entre 2.`) },
  ])

  return {
    topic: 'ratio', level,
    question_text: say(lang,
      `Write the ratio ${a}:${b} in its simplest form.`,
      `${a}:${b} oranını en sade hâliyle yaz.`,
      `Escribe la razón ${a}:${b} en su forma más simple.`),
    format: 'choice',
    options,
    correct_answer: correct,
    operandKey: `ratio:simp:${a}:${b}`,
    hint_steps: [
      say(lang, `Look for a number that divides into both sides exactly.`,
                `İki tarafı da tam bölen bir sayı ara.`,
                `Busca un número que divida exactamente a los dos lados.`),
      say(lang, `Keep dividing until nothing goes into both any more.`,
                `İkisini birden bölen başka sayı kalmayana kadar bölmeye devam et.`,
                `Sigue dividiendo hasta que ya no haya ningún número que entre en los dos.`),
    ],
  }
}

// Sharing an amount in a given ratio. The answer is one share, so it is typable.
function ratioShare(level, lang) {
  const gcd = (x, y) => (y ? gcd(y, x % y) : x)
  let p, q
  do { p = randInt(1, 7); q = randInt(1, 7) } while (p === q || gcd(p, q) !== 1)
  const part = randInt(4, 30)
  const total = (p + q) * part
  const bigger = p > q
  const answer = (bigger ? p : q) * part
  const [n1, n2] = pickL({ en: [['Ada', 'Sam'], ['Omar', 'Lily'], ['Ben', 'Nora']],
                           tr: [['Ada', 'Kerem'], ['Ömer', 'Elif'], ['Deniz', 'Nil']],
                           es: [['Ada', 'Hugo'], ['Omar', 'Lía'], ['Bea', 'Nora']] }, lang)
  const thing = pickL({ en: ['stickers', 'marbles', 'cards'], tr: ['çıkartma', 'misket', 'kart'],
                        es: ['pegatinas', 'canicas', 'cartas'] }, lang)
  const who = bigger ? n1 : n2

  return {
    topic: 'ratio', level,
    question_text: say(lang,
      `${total} ${thing} are shared between ${n1} and ${n2} in the ratio ${p}:${q}. How many does ${who} get?`,
      `${total} ${thing} ${n1} ile ${n2} arasında ${p}:${q} oranında paylaşılıyor. ${who} kaç tane alır?`,
      `Se reparten ${total} ${thing} entre ${n1} y ${n2} en la razón ${p}:${q}. ¿Cuántas le tocan a ${who}?`),
    format: 'numeric',
    correct_answer: answer,
    operandKey: `ratio:share:${total}:${p}:${q}`,
    hint_steps: [
      say(lang, `${p}:${q} means ${p + q} equal parts altogether.`,
                `${p}:${q} demek toplam ${p + q} eşit pay demek.`,
                `${p}:${q} significa ${p + q} partes iguales en total.`),
      say(lang, `Divide ${total} by ${p + q} to find one part, then take as many parts as ${who} is owed.`,
                `Bir payı bulmak için ${total} sayısını ${p + q}'e böl, sonra ${who}'a düşen kadar pay al.`,
                `Divide ${total} entre ${p + q} para hallar una parte y toma tantas partes como le corresponden a ${who}.`),
    ],
  }
}

// Direct proportion — the "if 4 cost £6, what do 10 cost" shape, and its unit-conversion
// cousin. Both books lean on it.
function ratioProportion(level, lang) {
  const band = bandForLevel(level)
  const unitConv = band >= 7 && Math.random() < 0.45

  if (unitConv) {
    // The rates are the ones Bond actually uses, so the number a child carries away is true.
    // Singular and plural are separate fields rather than an -s stripped off the plural:
    // "inches" minus its s is "inche". Turkish needs neither, which is why its two fields are
    // the same word — the language marks number on the verb, not the noun after a count.
    // `g` is the Spanish gender of the unit being converted TO, and it is not decoration:
    // it agrees both the question word and the article, so without it the sentence reads
    // "¿cuántos libras?" and "unas kilómetros". The geometry template carries the same field
    // for the same reason.
    const conv = pick([
      { per: 2.2, step: 5,
        from: { en: ['kilogram', 'kilograms'], tr: ['kilogram', 'kilogram'], es: ['kilogramo', 'kilogramos'] },
        to:   { en: ['pound', 'pounds'],       tr: ['libre', 'libre'],       es: ['libra', 'libras'] }, g: 'f' },
      { per: 2.5, step: 2,
        from: { en: ['inch', 'inches'],        tr: ['inç', 'inç'],           es: ['pulgada', 'pulgadas'] },
        to:   { en: ['centimetre', 'centimetres'], tr: ['santimetre', 'santimetre'], es: ['centímetro', 'centímetros'] }, g: 'm' },
      // 5 miles to 8 kilometres, so the multiple has to clear the 5 or the answer is not whole:
      // 2 miles came out as 3.2 and was rounded to 3, which is a wrong answer, not an estimate.
      { per: 8, step: 5,
        from: { en: ['mile', 'miles'],         tr: ['mil', 'mil'],           es: ['milla', 'millas'] },
        to:   { en: ['kilometre', 'kilometres'], tr: ['kilometre', 'kilometre'], es: ['kilómetro', 'kilómetros'] }, g: 'm' },
    ])
    const n = conv.step * randInt(2, 12)
    const answer = conv.per === 8 ? (n / 5) * 8 : Math.round(n * conv.per)
    const [fromOne, fromMany] = conv.from[lang] ?? conv.from.en
    const [, toMany] = conv.to[lang] ?? conv.to.en
    const esMany = conv.g === 'f' ? 'cuántas' : 'cuántos'
    const esSome = conv.g === 'f' ? 'unas' : 'unos'
    // Each language states the rate in its own natural shape. Turkish reads badly as a
    // translated "if X then Y" — "2,2 libre eder ise" — so it takes the rate as its own
    // sentence and asks the question after it.
    const rate = conv.per === 8
      ? say(lang, `5 miles is about 8 kilometres`, `5 mil yaklaşık 8 kilometredir.`, `5 millas son ${esSome} 8 kilómetros`)
      : say(lang, `1 ${fromOne} is about ${conv.per} ${toMany}`,
                  `1 ${fromOne} yaklaşık ${String(conv.per).replace('.', ',')} ${toMany}dir.`,
                  `1 ${fromOne} son ${esSome} ${String(conv.per).replace('.', ',')} ${toMany}`)
    return {
      topic: 'ratio', level,
      question_text: say(lang,
        `If ${rate}, about how many ${toMany} is ${n} ${fromMany}?`,
        `${rate} ${n} ${fromMany} yaklaşık kaç ${toMany} eder?`,
        `Si ${rate}, ¿${esMany} ${toMany} son aproximadamente ${n} ${fromMany}?`),
      format: 'numeric',
      correct_answer: answer,
      operandKey: `ratio:conv:${conv.per}:${n}`,
      hint_steps: [
        say(lang, `Find what one unit is worth first, then multiply.`,
                  `Önce bir birimin karşılığını bul, sonra çarp.`,
                  `Halla primero cuánto vale una unidad y después multiplica.`),
        say(lang, `Both amounts grow together, so ${n} times as much of one is ${n} times as much of the other.`,
                  `İki miktar birlikte büyür, birinden ${n} kat almak diğerinden de ${n} kat almak demektir.`,
                  `Las dos cantidades crecen juntas: ${n} veces de una es ${n} veces de la otra.`),
      ],
    }
  }

  const unit = randInt(2, 15)
  const have = randInt(2, 8)
  const want = have + randInt(1, 9)
  const cost = unit * have
  const answer = unit * want
  const thing = pickL({ en: ['pencils', 'tickets', 'apples', 'notebooks'], tr: ['kalem', 'bilet', 'elma', 'defter'],
                        es: ['lápices', 'entradas', 'manzanas', 'cuadernos'] }, lang)

  return {
    topic: 'ratio', level,
    question_text: say(lang,
      `${have} ${thing} cost ${cost} cents. At the same rate, what do ${want} cost?`,
      `${have} ${thing} ${cost} kuruş tutuyor. Aynı fiyattan ${want} tanesi kaç kuruş tutar?`,
      `${have} ${thing} cuestan ${cost} céntimos. Al mismo precio, ¿cuánto cuestan ${want}?`),
    format: 'numeric',
    correct_answer: answer,
    operandKey: `ratio:prop:${have}:${want}:${unit}`,
    hint_steps: [
      say(lang, `Work out what one costs before you work out what ${want} cost.`,
                `${want} tanesini hesaplamadan önce bir tanesinin kaç ettiğini bul.`,
                `Averigua cuánto cuesta uno antes de calcular cuánto cuestan ${want}.`),
      say(lang, `Divide by ${have} to get one, then multiply by ${want}.`,
                `Bir tanesi için ${have}'e böl, sonra ${want} ile çarp.`,
                `Divide entre ${have} para tener uno y luego multiplica por ${want}.`),
    ],
  }
}

// Year 7 only: speed, distance, time. Numbers are chosen so the answer is whole in whichever
// of the three is being asked for.
function ratioRate(level, lang) {
  const speed = pick([30, 40, 50, 60, 80, 90])
  const hours = pick([2, 3, 4, 5])
  const distance = speed * hours
  const ask = pick(['distance', 'time', 'speed'])
  const q = {
    distance: say(lang,
      `A train travels at ${speed} km/h for ${hours} hours. How far does it go?`,
      `Bir tren ${speed} km/sa hızla ${hours} saat gidiyor. Kaç kilometre yol alır?`,
      `Un tren va a ${speed} km/h durante ${hours} horas. ¿Qué distancia recorre?`),
    time: say(lang,
      `A train travels ${distance} km at ${speed} km/h. How many hours does it take?`,
      `Bir tren ${speed} km/sa hızla ${distance} km gidiyor. Kaç saat sürer?`,
      `Un tren recorre ${distance} km a ${speed} km/h. ¿Cuántas horas tarda?`),
    speed: say(lang,
      `A train covers ${distance} km in ${hours} hours. What is its speed in km/h?`,
      `Bir tren ${hours} saatte ${distance} km gidiyor. Hızı saatte kaç km?`,
      `Un tren recorre ${distance} km en ${hours} horas. ¿Cuál es su velocidad en km/h?`),
  }[ask]
  const answer = { distance, time: hours, speed }[ask]

  return {
    topic: 'ratio', level,
    question_text: q,
    format: 'numeric',
    correct_answer: answer,
    operandKey: `ratio:rate:${ask}:${speed}:${hours}`,
    hint_steps: [
      say(lang, `Speed, distance and time make one triangle: distance sits on top.`,
                `Hız, yol ve zaman tek bir üçgen kurar: yol en üstte durur.`,
                `Velocidad, distancia y tiempo forman un triángulo: la distancia va arriba.`),
      ask === 'distance'
        ? say(lang, `Covering ${speed} km each hour, for ${hours} hours, is a multiplication.`,
                    `Her saat ${speed} km gitmek, ${hours} saat boyunca, bir çarpma işlemidir.`,
                    `Recorrer ${speed} km cada hora durante ${hours} horas es una multiplicación.`)
        : say(lang, `Cover up the one you are looking for and the triangle shows you the sum.`,
                    `Aradığını parmağınla kapat, üçgen sana işlemi gösterir.`,
                    `Tapa con el dedo lo que buscas y el triángulo te enseña la operación.`),
    ],
  }
}

function ratioTemplate(level, lang) {
  const band = bandForLevel(level)
  const shapes = band >= 7
    ? ['simplify', 'share', 'proportion', 'rate', 'rate']
    : ['simplify', 'simplify', 'share', 'share', 'proportion']
  const shape = pick(shapes)
  // A map's scale is Year 6's "scale factor" as a child meets it, and Bond's 10-11 book asks it.
  if (Math.random() < 0.2) return ratioMapScale(level, lang)
  if (shape === 'share') return ratioShare(level, lang)
  if (shape === 'proportion') return ratioProportion(level, lang)
  if (shape === 'rate') return ratioRate(level, lang)
  return ratioSimplify(level, lang)
}

// ── Averages (statistics, Year 5 and up) ─────────────────────────────────────
// The pictogram template is Year 2 and Year 3. From Year 5 the curriculum says "calculate and
// interpret the mean" and Year 7 adds median, mode and range — a different question, not a
// bigger picture.
//
// The reverse-mean shape ("her mean is 7, how many on Tuesday?") is here because both Bond
// books ask it and because it is the one that shows whether a child understands what a mean
// IS rather than which buttons to press.

// Each subject carries the range that is plausible FOR IT. One shared range produced "cups of
// coffee over 4 days: 18, 10, 5, 3" — about half of all generated questions had a value no
// child would believe, and a number a child does not believe is a number they stop reading.
// Coffee is gone rather than re-ranged: it came from Bond's 10-11 book, where the question is
// about someone's mum, and outside that framing it reads as the child drinking it.
// The period is carried in BOTH forms rather than built by adding an s. "4 matchs" and
// "5 sesións" are what adding one gives you, and this is the second time an -s has been
// wrong here — the ratio template's unit banks were fixed for "inche" the same day. Turkish
// takes the same word twice on purpose: it does not mark plural after a number.
// Each subject carries the range that is plausible FOR IT, its plural, and the verb that
// makes it a sentence.
//
// The range is here because one shared range produced "cups of coffee over 4 days: 18, 10, 5,
// 3" — about half of all generated questions had a value no child would believe, and a number
// a child does not believe is a number they stop reading. Coffee is gone rather than re-ranged:
// it came from Bond's 10-11 book, where the question is about someone's mum, and outside that
// framing it reads as the child drinking it.
//
// The plural is carried rather than made by adding an s, because "4 matchs" and "5 sesións"
// are what adding one gives you. Turkish takes the same word twice on purpose: it does not
// mark plural after a number.
//
// The verb is here because without it the question was not a sentence. "Points over 6 games:
// 2, 8, 4, 11, 15, 2. What is the mean?" is a spreadsheet header with a question after it —
// the same defect as the division word problem that read "Mia has 45 candies. Shared equally
// among 5 teammates. How many each?", written again in a new template a day after that one
// was fixed.
//
// The last two fields say what the mean is OF. "Over 4 weeks Iris read 3, 7, 1 and 1 books. What
// is the mean?" left a child to work out that each number is one week and that the answer is
// books per week; Bond asks "the mean number of goals scored per match". English carries the
// participle ("books read"), Turkish the relative form and the "per" case ("okuduğu",
// "haftada") — neither can be built from the verb by adding letters.
const AVG_SUBJECTS = {
  en: [['goals', 'match', 'matches', 'scored', 0, 6, 'scored', 'per match'], ['books', 'week', 'weeks', 'read', 1, 7, 'read', 'per week'],
       ['points', 'game', 'games', 'scored', 2, 20, 'scored', 'per game'], ['lengths', 'session', 'sessions', 'swam', 2, 16, 'swum', 'per session'],
       ['birds', 'day', 'days', 'spotted', 1, 18, 'spotted', 'per day']],
  tr: [['gol', 'maç', 'maç', 'attı', 0, 6, 'attığı', 'maçta'], ['kitap', 'hafta', 'hafta', 'okudu', 1, 7, 'okuduğu', 'haftada'],
       ['puan', 'oyun', 'oyun', 'topladı', 2, 20, 'topladığı', 'oyunda'], ['tur', 'antrenman', 'antrenman', 'yüzdü', 2, 16, 'yüzdüğü', 'antrenmanda'],
       ['kuş', 'gün', 'gün', 'gördü', 1, 18, 'gördüğü', 'günde']],
  es: [['goles', 'partido', 'partidos', 'marcó', 0, 6, 'marcó', 'por partido'], ['libros', 'semana', 'semanas', 'leyó', 1, 7, 'leyó', 'por semana'],
       ['puntos', 'juego', 'juegos', 'consiguió', 2, 20, 'consiguió', 'por juego'], ['largos', 'sesión', 'sesiones', 'nadó', 2, 16, 'nadó', 'por sesión'],
       ['pájaros', 'día', 'días', 'vio', 1, 18, 'vio', 'por día']],
}

// A list of small whole numbers whose mean is whole, built by choosing the mean first.
function meanList(n, lo, hi) {
  for (let tries = 0; tries < 200; tries++) {
    const xs = Array.from({ length: n }, () => randInt(lo, hi))
    const total = xs.reduce((a, b) => a + b, 0)
    if (total % n === 0) return xs
  }
  return Array.from({ length: n }, () => lo)
}

function avgMean(level, lang) {
  const n = pick([4, 5, 6])
  const [what, per, pers, verb, lo, hi, done, perUnit] = pickL(AVG_SUBJECTS, lang)
  const xs = meanList(n, lo, hi)
  const total = xs.reduce((a, b) => a + b, 0)
  const name = pickL(MULT_NAMES, lang)
  const list = listWithAnd(xs.map(String), lang)

  return {
    topic: 'averages', level,
    question_text: say(lang,
      `${name} wrote down the ${what} ${done} each ${per} for ${n} ${pers}: ${list}. What is the mean number of ${what} ${done} ${perUnit}?`,
      `${name}, ${n} ${per} boyunca her ${per} ${done} ${what} sayısını yazdı: ${list}. ${cap(perUnit)} ortalama kaç ${what}?`,
      `${name} apuntó los ${what} que ${done} cada ${per} durante ${n} ${pers}: ${list}. ¿Cuál es la media de ${what} ${perUnit}?`),
    format: 'numeric',
    correct_answer: total / n,
    operandKey: `avg:mean:${xs.join('-')}`,
    hint_steps: [
      say(lang, `The mean shares the total out evenly, as if every ${per} were the same.`,
                `Ortalama, toplamı eşit paylaştırır — her ${per} aynıymış gibi.`,
                `La media reparte el total por igual, como si cada ${per} fuera igual.`),
      say(lang, `Add all ${n} numbers together, then divide by ${n}.`,
                `${n} sayıyı topla, sonra ${n}'e böl.`,
                `Suma los ${n} números y divide entre ${n}.`),
    ],
  }
}

// Working backwards from a known mean to a missing value.
function avgReverseMean(level, lang) {
  const n = pick([4, 5])
  const [what, per, pers, verb, lo, hi] = pickL(AVG_SUBJECTS, lang)
  // The mean has to sit inside the subject's own range, or the values built around it leave it.
  const mean = randInt(Math.max(lo + 1, 2), Math.max(lo + 2, hi - 1))
  const total = mean * n
  // Every known value, and the missing one, stay inside that range too — a missing value of 25
  // goals is the same defect as a list of them.
  let xs, missing
  do {
    xs = Array.from({ length: n - 1 }, () => randInt(lo, hi))
    missing = total - xs.reduce((a, b) => a + b, 0)
  } while (missing < Math.max(lo, 1) || missing > hi)
  const name = pickL(MULT_NAMES, lang)
  const list = listWithAnd(xs.map(String), lang)

  return {
    topic: 'averages', level,
    question_text: say(lang,
      `Over ${n} ${pers} ${name} ${verb} a mean of ${mean} ${what}. In the first ${n - 1} ${pers} ${name} ${verb} ${list}. How many in the last one?`,
      `${name} ${n} ${per} boyunca ortalama ${mean} ${what} ${verb}. İlk ${n - 1} ${per} içinde ${list} ${verb}. Sonuncusunda kaç tane?`,
      `En ${n} ${pers} ${name} ${verb} una media de ${mean} ${what}. En los primeros ${n - 1} ${pers} ${verb} ${list}. ¿Cuántos en el último?`),
    format: 'numeric',
    correct_answer: missing,
    operandKey: `avg:rev:${mean}:${xs.join('-')}`,
    hint_steps: [
      say(lang, `A mean of ${mean} over ${n} ${pers} means the total was shared into ${n} equal lots of ${mean}.`,
                `${n} ${per} için ortalama ${mean} demek, toplamın ${n} eşit ${mean}'e bölündüğü demek.`,
                `Una media de ${mean} en ${n} ${pers} significa que el total se repartió en ${n} partes iguales de ${mean}.`),
      say(lang, `Find the total first, then take away the ones you already know.`,
                `Önce toplamı bul, sonra bildiklerini çıkar.`,
                `Halla primero el total y luego quita los que ya conoces.`),
    ],
  }
}

// Median, mode and range. The three get asked about the same list, because telling them apart
// is the skill — a child who finds the mode when asked for the median has not made an
// arithmetic mistake.
function avgOther(level, lang) {
  const ask = pick(['median', 'mode', 'range'])
  const n = pick([5, 7])
  let xs, sorted, mode
  // The list is built to have exactly one mode and a median that is not also the mode, so
  // that no question has two defensible answers.
  for (let tries = 0; tries < 200; tries++) {
    xs = Array.from({ length: n - 2 }, () => randInt(2, 20))
    const rep = pick(xs)
    xs = shuffle([...xs, rep, rep])
    sorted = [...xs].sort((a, b) => a - b)
    const counts = {}
    for (const v of xs) counts[v] = (counts[v] || 0) + 1
    const top = Math.max(...Object.values(counts))
    const modes = Object.keys(counts).filter(k => counts[k] === top)
    if (modes.length !== 1) continue
    mode = Number(modes[0])
    if (ask === 'median' && sorted[(n - 1) / 2] === mode) continue
    break
  }
  const median = sorted[(n - 1) / 2]
  const range = sorted[n - 1] - sorted[0]
  const answer = { median, mode, range }[ask]

  const q = {
    median: say(lang, `What is the median of these numbers? ${xs.join(', ')}`,
                      `Bu sayıların ortancası kaçtır? ${xs.join(', ')}`,
                      `¿Cuál es la mediana de estos números? ${xs.join(', ')}`),
    mode: say(lang, `What is the mode of these numbers? ${xs.join(', ')}`,
                    `Bu sayıların tepe değeri (mod) kaçtır? ${xs.join(', ')}`,
                    `¿Cuál es la moda de estos números? ${xs.join(', ')}`),
    range: say(lang, `What is the range of these numbers? ${xs.join(', ')}`,
                     `Bu sayıların açıklığı kaçtır? ${xs.join(', ')}`,
                     `¿Cuál es el rango de estos números? ${xs.join(', ')}`),
  }[ask]

  const hints = {
    median: [
      say(lang, `The median is the middle one once they are in order.`,
                `Ortanca, sayılar sıralandığında ortada kalandır.`,
                `La mediana es el del medio una vez ordenados.`),
      say(lang, `Put all ${n} in order first, then count in from both ends together.`,
                `Önce ${n} sayıyı sırala, sonra iki uçtan birlikte içeri doğru say.`,
                `Ordena primero los ${n} y luego cuenta desde los dos extremos a la vez.`)],
    mode: [
      say(lang, `The mode is the one that turns up most often.`,
                `Mod, en çok tekrar eden sayıdır.`,
                `La moda es el que aparece más veces.`),
      say(lang, `Count how many times each number appears — no ordering needed.`,
                `Her sayının kaç kez geçtiğini say — sıralamaya gerek yok.`,
                `Cuenta cuántas veces aparece cada número; no hace falta ordenarlos.`)],
    range: [
      say(lang, `The range is how far the numbers spread, not an average.`,
                `Açıklık, sayıların ne kadar yayıldığıdır; bir ortalama değildir.`,
                `El rango es cuánto se separan los números, no es una media.`),
      say(lang, `Find the biggest and the smallest, then take one from the other.`,
                `En büyüğü ve en küçüğü bul, sonra birini diğerinden çıkar.`,
                `Busca el mayor y el menor y resta uno del otro.`)],
  }[ask]

  return {
    topic: 'averages', level,
    question_text: q,
    format: 'numeric',
    correct_answer: answer,
    operandKey: `avg:${ask}:${sorted.join('-')}`,
    hint_steps: hints,
  }
}

// Probability of a single event, written as a fraction. A choice question — the answer is a
// fraction — and the wrong options are the three real confusions: counting the wrong way
// round, leaving out the rest, and giving the count instead of the chance.
function avgProbability(level, lang) {
  const want = randInt(2, 6)
  const other = randInt(3, 9)
  const total = want + other
  const gcd = (x, y) => (y ? gcd(y, x % y) : x)
  const g = gcd(want, total)
  const correct = `${want / g}/${total / g}`
  const colour = pickL({ en: ['red', 'green', 'blue'], tr: ['kırmızı', 'yeşil', 'mavi'], es: ['rojas', 'verdes', 'azules'] }, lang)

  const options = shuffle([
    { value: correct, why: say(lang,
        `Right — ${want} of the ${total} marbles are ${colour}.`,
        `Doğru — ${total} misketin ${want} tanesi ${colour}.`,
        `Correcto: ${want} de las ${total} canicas son ${colour}.`) },
    { value: `${want}/${other}`, why: say(lang,
        `That compares the ${colour} ones with the others. A probability compares them with ALL of them.`,
        `Bu, ${colour} olanları diğerleriyle kıyaslıyor. Olasılık ise HEPSİYLE kıyaslar.`,
        `Eso compara las ${colour} con las demás. Una probabilidad las compara con TODAS.`) },
    { value: `${total / g}/${want / g}`, why: say(lang,
        `Upside down. The number you want goes on top, the total underneath.`,
        `Ters. İstenen sayı üstte, toplam altta olur.`,
        `Del revés. El número que buscas va arriba y el total debajo.`) },
    { value: `${other}/${total}`, why: say(lang,
        `That is the chance of NOT picking a ${colour} one.`,
        `Bu, ${colour} olmayan birini çekme olasılığı.`,
        `Esa es la probabilidad de NO sacar una ${colour}.`) },
  ])

  return {
    topic: 'averages', level,
    question_text: say(lang,
      `A bag has ${want} ${colour} marbles and ${other} others. What is the probability of picking a ${colour} one?`,
      `Bir torbada ${want} ${colour} misket ve ${other} başka misket var. ${colour} birini çekme olasılığı nedir?`,
      `Una bolsa tiene ${want} canicas ${colour} y ${other} más. ¿Cuál es la probabilidad de sacar una ${colour}?`),
    format: 'choice',
    options,
    correct_answer: correct,
    operandKey: `avg:prob:${want}:${total}`,
    hint_steps: [
      say(lang, `A probability is the ones you want over ALL of them.`,
                `Olasılık, istediklerinin HEPSİNE oranıdır.`,
                `Una probabilidad es los que quieres sobre TODOS.`),
      say(lang, `Count the whole bag first, then simplify the fraction if you can.`,
                `Önce torbanın tamamını say, sonra kesri sadeleştirebiliyorsan sadeleştir.`,
                `Cuenta primero toda la bolsa y luego simplifica la fracción si puedes.`),
    ],
  }
}

function averagesTemplate(level, lang) {
  const band = bandForLevel(level)
  // Year 6's line opens with pie charts, and the book reads them; a third of the slots.
  if (Math.random() < 0.35) return statsPie(level, lang)
  if (band >= 6 && Math.random() < 0.15) return diceTable(level, lang)
  const shapes = band >= 7
    ? ['mean', 'reverse', 'other', 'other', 'probability']
    : ['mean', 'mean', 'reverse', 'other']
  const shape = pick(shapes)
  if (shape === 'reverse') return avgReverseMean(level, lang)
  if (shape === 'other') return avgOther(level, lang)
  if (shape === 'probability') return Math.random() < 0.5 ? avgSpinner(level, lang) : avgProbability(level, lang)
  return avgMean(level, lang)
}

// ── Factors, multiples, primes and powers (Year 7) ───────────────────────────
// Bond's 11+-12+ book opens its Number tests with these and comes back to them in most of the
// mixed ones: list the factors of 32, add the primes between 10 and 20, find the lowest common
// multiple of 7 and 9, the square root of 121. They are the vocabulary of the year.
//
// The sets are computed, never listed by hand — a hand-written table of primes is a table that
// is wrong somewhere, and the whole point of a template is that the answer is derived.

function factorsOf(n) {
  const out = []
  for (let i = 1; i <= n; i++) if (n % i === 0) out.push(i)
  return out
}

function isPrime(n) {
  if (n < 2) return false
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false
  return true
}

function lcm(a, b) {
  const gcd = (x, y) => (y ? gcd(y, x % y) : x)
  return (a * b) / gcd(a, b)
}

function npHowManyFactors(level, lang) {
  // Composite numbers only, and never a prime or a square of one: "how many factors does 37
  // have" is a different question wearing this one's clothes. Rolled rather than listed —
  // a hand-written list of eighteen numbers was the whole pool, and a child doing this three
  // times a week would have met all of them inside a month.
  let n, fs
  do { n = randInt(18, 120); fs = factorsOf(n) } while (fs.length < 4)
  return {
    topic: 'number-properties', level,
    question_text: say(lang,
      `How many factors does ${n} have altogether?`,
      `${n} sayısının toplam kaç çarpanı vardır?`,
      `¿Cuántos divisores tiene ${n} en total?`),
    format: 'numeric',
    correct_answer: fs.length,
    operandKey: `np:fac:${n}`,
    hint_steps: [
      say(lang, `A factor divides into ${n} exactly, with nothing left over.`,
                `Çarpan, ${n} sayısını kalansız bölen sayıdır.`,
                `Un divisor entra en ${n} exactamente, sin que sobre nada.`),
      say(lang, `Work in pairs from 1 upwards — each one you find brings its partner with it. Do not forget 1 and ${n}.`,
                `1'den başlayarak çiftler hâlinde ilerle — bulduğun her çarpan eşini de getirir. 1 ile ${n} sayısını da unutma.`,
                `Ve de dos en dos desde el 1: cada uno que encuentres trae su pareja. No olvides el 1 y el ${n}.`),
    ],
  }
}

function npPrimeSum(level, lang) {
  const lo = pick([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]) + (Math.random() < 0.4 ? 5 : 0)
  const hi = lo + 10
  const primes = []
  for (let i = lo + 1; i < hi; i++) if (isPrime(i)) primes.push(i)
  if (primes.length < 2) return npPrimeSum(level, lang)
  return {
    topic: 'number-properties', level,
    question_text: say(lang,
      `Add together all the prime numbers between ${lo} and ${hi}.`,
      `${lo} ile ${hi} arasındaki bütün asal sayıları topla.`,
      `Suma todos los números primos que hay entre ${lo} y ${hi}.`),
    format: 'numeric',
    correct_answer: primes.reduce((a, b) => a + b, 0),
    operandKey: `np:primesum:${lo}`,
    hint_steps: [
      say(lang, `A prime has exactly two factors: 1 and itself.`,
                `Asal sayının tam olarak iki çarpanı vardır: 1 ve kendisi.`,
                `Un número primo tiene exactamente dos divisores: 1 y él mismo.`),
      say(lang, `Go through them one at a time and cross out anything in the 2, 3, 5 or 7 times table.`,
                `Tek tek geç ve 2, 3, 5 ya da 7'nin katı olanları ele.`,
                `Ve uno a uno y tacha todo lo que esté en las tablas del 2, 3, 5 o 7.`),
    ],
  }
}

function npLcm(level, lang) {
  // Small enough that the answer is reachable by listing multiples rather than by prime
  // factorisation, which is the following year — so the lowest common multiple is capped
  // rather than the operands. Rolled, not listed, for the same reason as the factors above.
  let a, b
  do { a = randInt(3, 12); b = randInt(3, 15) } while (a === b || lcm(a, b) > 90)
  return {
    topic: 'number-properties', level,
    question_text: say(lang,
      `What is the lowest number that both ${a} and ${b} divide into exactly?`,
      `Hem ${a} hem ${b} sayısının tam böldüğü en küçük sayı kaçtır?`,
      `¿Cuál es el número más pequeño que ${a} y ${b} dividen exactamente?`),
    format: 'numeric',
    correct_answer: lcm(a, b),
    operandKey: `np:lcm:${a}:${b}`,
    hint_steps: [
      say(lang, `Count up in ${a}s and in ${b}s and watch for the first number that appears in both lists.`,
                `${a}'şer ve ${b}'şer sayarak ilerle, iki listede de görünen ilk sayıyı yakala.`,
                `Cuenta de ${a} en ${a} y de ${b} en ${b} y busca el primer número que salga en las dos listas.`),
      say(lang, `${a} × ${b} always works, but it is not always the SMALLEST one that does.`,
                `${a} × ${b} her zaman işe yarar ama her zaman işe yarayanların EN KÜÇÜĞÜ değildir.`,
                `${a} × ${b} siempre vale, pero no siempre es el MÁS PEQUEÑO que vale.`),
    ],
  }
}

function npSquareRoot(level, lang) {
  const ask = pick(['root', 'square', 'cube'])
  if (ask === 'cube') {
    const n = randInt(2, 10)
    return {
      topic: 'number-properties', level,
      question_text: say(lang, `What is ${n} cubed?`, `${n} sayısının küpü kaçtır?`, `¿Cuánto es ${n} al cubo?`),
      format: 'numeric', correct_answer: n * n * n, operandKey: `np:cube:${n}`,
      hint_steps: [
        say(lang, `Cubed means the number multiplied by itself three times over.`,
                  `Küpü demek, sayının kendisiyle üç kez çarpılması demek.`,
                  `Al cubo significa el número multiplicado por sí mismo tres veces.`),
        say(lang, `Square it first, then multiply by ${n} once more.`,
                  `Önce karesini al, sonra bir kez daha ${n} ile çarp.`,
                  `Elévalo al cuadrado primero y luego multiplica otra vez por ${n}.`),
      ],
    }
  }
  const n = randInt(4, 20)
  const sq = n * n
  return ask === 'root'
    ? {
      topic: 'number-properties', level,
      question_text: say(lang, `What is the square root of ${sq}?`, `${sq} sayısının karekökü kaçtır?`,
                               `¿Cuál es la raíz cuadrada de ${sq}?`),
      format: 'numeric', correct_answer: n, operandKey: `np:root:${sq}`,
      hint_steps: [
        say(lang, `A square root asks: which number times itself makes ${sq}?`,
                  `Karekök şunu sorar: hangi sayı kendisiyle çarpılınca ${sq} eder?`,
                  `Una raíz cuadrada pregunta: ¿qué número por sí mismo da ${sq}?`),
        say(lang, `It is not half of ${sq} — try a few numbers and see which one lands on it.`,
                  `${sq} sayısının yarısı değildir — birkaç sayı dene, hangisi tutuyor bak.`,
                  `No es la mitad de ${sq}: prueba con varios números y mira cuál cuadra.`),
      ],
    }
    : {
      topic: 'number-properties', level,
      question_text: say(lang, `What is ${n} squared?`, `${n} sayısının karesi kaçtır?`, `¿Cuánto es ${n} al cuadrado?`),
      format: 'numeric', correct_answer: sq, operandKey: `np:sq:${n}`,
      hint_steps: [
        say(lang, `Squared means the number multiplied by itself.`,
                  `Karesi demek, sayının kendisiyle çarpılması demek.`,
                  `Al cuadrado significa el número multiplicado por sí mismo.`),
        say(lang, `It is called squared because ${n} rows of ${n} make a square.`,
                  `Kare deniyor çünkü ${n} sıra ${n} tane bir kare oluşturur.`,
                  `Se llama al cuadrado porque ${n} filas de ${n} forman un cuadrado.`),
      ],
    }
}

function numberPropertiesTemplate(level, lang) {
  if (Math.random() < 0.12) return dotNumbers(level, lang)
  const shape = pick(['factors', 'primes', 'lcm', 'power', 'power'])
  if (shape === 'primes') return npPrimeSum(level, lang)
  if (shape === 'lcm') return npLcm(level, lang)
  if (shape === 'power') return npSquareRoot(level, lang)
  return npHowManyFactors(level, lang)
}

// ── Sequences and function machines (Year 7) ─────────────────────────────────
// "If each term is 3 less than the seven times table, what are the first four terms?" is Bond's
// own wording and it is a position-to-term rule in disguise. The function machine is the same
// idea drawn as a box, and both books use it in both directions — given the input, and given
// the output.

function seqContinue(level, lang) {
  const step = pick([3, 4, 5, 6, 7, 8, 9, 11, 12, 15, 25])
  const up = Math.random() < 0.7
  const start = up ? randInt(2, 30) : randInt(60, 140)
  const terms = [0, 1, 2, 3].map(i => start + (up ? 1 : -1) * step * i)
  const answer = start + (up ? 1 : -1) * step * 4
  if (answer < 1) return seqContinue(level, lang)
  return {
    topic: 'sequence', level,
    question_text: say(lang,
      `What comes next? ${terms.join(', ')}, …`,
      `Sırada ne gelir? ${terms.join(', ')}, …`,
      `¿Qué viene después? ${terms.join(', ')}, …`),
    format: 'numeric',
    correct_answer: answer,
    operandKey: `seq:cont:${terms.join('-')}`,
    hint_steps: [
      say(lang, `Find the gap between one term and the next, and check it is the same gap every time.`,
                `Bir terimle sonraki arasındaki farkı bul, her seferinde aynı mı diye kontrol et.`,
                `Halla el salto de un término al siguiente y comprueba que sea siempre el mismo.`),
      up
        ? say(lang, `The sequence is going up, so the next one is bigger than ${terms[3]}.`,
                    `Dizi yükseliyor, yani sıradaki ${terms[3]} sayısından büyük.`,
                    `La sucesión sube, así que el siguiente es mayor que ${terms[3]}.`)
        : say(lang, `The sequence is going down, so the next one is smaller than ${terms[3]}.`,
                    `Dizi azalıyor, yani sıradaki ${terms[3]} sayısından küçük.`,
                    `La sucesión baja, así que el siguiente es menor que ${terms[3]}.`),
    ],
  }
}

function seqRule(level, lang) {
  const table = pick([3, 4, 6, 7, 8, 9, 11, 12])
  const off = randInt(1, 9)
  const less = Math.random() < 0.5 && table * 1 - off > 0
  const which = randInt(4, 9)
  const answer = table * which + (less ? -off : off)
  return {
    topic: 'sequence', level,
    question_text: less
      ? say(lang,
          `Each term of a sequence is ${off} less than the ${table} times table. What is the ${which}th term?`,
          `Bir dizinin her terimi ${table} çarpım tablosundan ${off} eksiktir. ${which}. terim kaçtır?`,
          `Cada término de una sucesión es ${off} menos que la tabla del ${table}. ¿Cuál es el término ${which}?`)
      : say(lang,
          `Each term of a sequence is ${off} more than the ${table} times table. What is the ${which}th term?`,
          `Bir dizinin her terimi ${table} çarpım tablosundan ${off} fazladır. ${which}. terim kaçtır?`,
          `Cada término de una sucesión es ${off} más que la tabla del ${table}. ¿Cuál es el término ${which}?`),
    format: 'numeric',
    correct_answer: answer,
    operandKey: `seq:rule:${table}:${off}:${which}`,
    hint_steps: [
      say(lang, `Find the ${which}th number in the ${table} times table first.`,
                `Önce ${table} çarpım tablosunun ${which}. sayısını bul.`,
                `Halla primero el número ${which} de la tabla del ${table}.`),
      less
        ? say(lang, `Then take ${off} off it — the rule applies to every term, not just the first.`,
                    `Sonra ondan ${off} çıkar — kural ilk terime değil, her terime uygulanır.`,
                    `Luego réstale ${off}: la regla vale para todos los términos, no solo el primero.`)
        : say(lang, `Then add ${off} to it — the rule applies to every term, not just the first.`,
                    `Sonra ona ${off} ekle — kural ilk terime değil, her terime uygulanır.`,
                    `Luego súmale ${off}: la regla vale para todos los términos, no solo el primero.`),
    ],
  }
}

function seqMachine(level, lang) {
  const m = pick([2, 3, 4, 5, 6])
  const add = randInt(2, 20)
  const input = randInt(3, 20)
  const output = input * m + add
  const backwards = Math.random() < 0.5
  return {
    topic: 'sequence', level,
    question_text: backwards
      ? say(lang,
          `A machine multiplies by ${m}, then adds ${add}. It puts out ${output}. What went in?`,
          `Bir makine ${m} ile çarpıp ${add} ekliyor. Çıkan sayı ${output}. Giren sayı kaçtı?`,
          `Una máquina multiplica por ${m} y luego suma ${add}. Sale ${output}. ¿Qué entró?`)
      : say(lang,
          `A machine multiplies by ${m}, then adds ${add}. ${input} goes in. What comes out?`,
          `Bir makine ${m} ile çarpıp ${add} ekliyor. İçine ${input} giriyor. Çıkan sayı kaçtır?`,
          `Una máquina multiplica por ${m} y luego suma ${add}. Entra ${input}. ¿Qué sale?`),
    format: 'numeric',
    correct_answer: backwards ? input : output,
    operandKey: `seq:mach:${backwards ? 'b' : 'f'}:${m}:${add}:${input}`,
    visual: { kind: 'machine', inputs: [backwards ? '?' : input], ops: [`× ${m}`, `+ ${add}`], outputs: [backwards ? output : '?'] },
    hint_steps: [
      backwards
        ? say(lang, `Going backwards through a machine undoes each step, last one first.`,
                    `Makinede geriye gitmek, adımları sondan başlayarak geri alır.`,
                    `Ir hacia atrás por la máquina deshace cada paso, empezando por el último.`)
        : say(lang, `Follow the steps in order — multiply before you add.`,
                    `Adımları sırayla uygula — toplamadan önce çarp.`,
                    `Sigue los pasos en orden: multiplica antes de sumar.`),
      backwards
        ? say(lang, `So take ${add} off first, and only then divide by ${m}.`,
                    `Yani önce ${add} çıkar, ancak ondan sonra ${m}'e böl.`,
                    `Así que quita ${add} primero y solo después divide entre ${m}.`)
        : say(lang, `Multiplying after adding would give a different answer, so the order matters.`,
                    `Toplayıp sonra çarpmak başka bir sonuç verir, sıra önemli.`,
                    `Sumar antes de multiplicar daría otra respuesta: el orden importa.`),
    ],
  }
}

function sequenceTemplate(level, lang) {
  const shape = pick(['continue', 'continue', 'rule', 'machine', 'machine', 'missing'])
  if (shape === 'missing') return machineMissing(level, lang)
  if (shape === 'rule') return seqRule(level, lang)
  if (shape === 'machine') return seqMachine(level, lang)
  return seqContinue(level, lang)
}

// ── Money ────────────────────────────────────────────────────────────────────
// Year 2's own topic. The curriculum line says pounds and pence because it is the British
// curriculum; the app's money is the reader's — dollars and cents in English, lira and kuruş
// in Turkish, euros and céntimos in Spanish. That is a decision already made and written down
// (see the decimal hint in fractionDecimal, and the model's own prompt), not a new one.
//
// Amounts stay in the minor unit while they are small, because a seven-year-old counting coins
// is counting whole numbers — "45 cents" is a number, "$0.45" is a notation lesson wearing a
// money question's clothes.

// Looked up by language, NOT drawn from with pickL: these are [plural, singular] pairs, and
// pickL picks one element out of a list. Destructuring what it returns gave the first
// CHARACTER — "Kerem 50 k veriyor". Same trap as the unit banks in the ratio template, from
// the other side.
const MINOR = { en: ['cents', 'cent'], tr: ['kuruş', 'kuruş'], es: ['céntimos', 'céntimo'] }
// The coins a child actually handles, in the minor unit.
const COINS = [1, 5, 10, 25, 50]

function moneyCombine(level, lang) {
  const [many] = MINOR[lang] ?? MINOR.en
  // Two or three different coins, each with a small count — a purse, not an arithmetic problem
  // in disguise.
  const kinds = shuffle(COINS).slice(0, randInt(2, 3))
  const parts = kinds.map(v => ({ v, n: randInt(1, 4) }))
  const total = parts.reduce((s, p) => s + p.v * p.n, 0)
  const list = listWithAnd(parts.map(p => say(lang,
    `${p.n} ${p.v}${many === 'cents' ? 'c' : ''} ${p.n === 1 ? 'coin' : 'coins'}`,
    `${p.n} tane ${p.v} kuruşluk`,
    `${p.n} ${p.n === 1 ? 'moneda' : 'monedas'} de ${p.v}`)), lang)

  return {
    topic: 'money', level,
    question_text: say(lang,
      `Ada has ${list} in her purse. How many ${many} is that altogether?`,
      `Ada'nın cüzdanında ${list} var. Toplam kaç ${many} eder?`,
      `Ada tiene ${list} en el monedero. ¿Cuántos ${many} son en total?`),
    format: 'numeric',
    correct_answer: total,
    operandKey: `money:comb:${parts.map(p => `${p.n}x${p.v}`).sort().join('-')}`,
    hint_steps: [
      say(lang, `Work out each kind of coin on its own first.`,
                `Önce her bozuk paranın kendi toplamını bul.`,
                `Calcula primero cada clase de moneda por separado.`),
      say(lang, `${parts[0].n} coins of ${parts[0].v} is ${parts[0].n} lots of ${parts[0].v}. Then add the other piles on.`,
                `${parts[0].n} tane ${parts[0].v} kuruşluk demek ${parts[0].v}'nin ${parts[0].n} katı demek. Sonra diğer öbekleri ekle.`,
                `${parts[0].n} monedas de ${parts[0].v} son ${parts[0].n} veces ${parts[0].v}. Luego suma los otros montones.`),
    ],
  }
}

function moneyChange(level, lang) {
  const band = bandForLevel(level)
  const [many] = MINOR[lang] ?? MINOR.en
  // Paid with a round note or coin, so the change is a subtraction a child can do in their head.
  const paid = band >= 3 ? pick([100, 200, 500]) : pick([20, 50, 100])
  // Never exactly half: the change then equals the price, which makes the hint name the
  // answer and turns "how much change" into "halve it".
  let cost
  do { cost = randInt(Math.round(paid * 0.25), paid - 5) } while (cost * 2 === paid)
  const thing = pickL({ en: ['a pencil', 'a sticker book', 'an apple', 'a rubber'],
                        tr: ['bir kalem', 'bir çıkartma kitabı', 'bir elma', 'bir silgi'],
                        es: ['un lápiz', 'un libro de pegatinas', 'una manzana', 'una goma'] }, lang)

  return {
    topic: 'money', level,
    question_text: say(lang,
      `${thing.charAt(0).toUpperCase() + thing.slice(1)} costs ${cost} ${many}. Leo pays with ${paid} ${many}. How much change does he get?`,
      `${thing.charAt(0).toUpperCase() + thing.slice(1)} ${cost} ${many}. Kerem ${paid} ${many} veriyor. Kaç ${many} para üstü alır?`,
      `${thing.charAt(0).toUpperCase() + thing.slice(1)} cuesta ${cost} ${many}. Mateo paga con ${paid} ${many}. ¿Cuánto le devuelven?`),
    format: 'numeric',
    correct_answer: paid - cost,
    operandKey: `money:chg:${paid}:${cost}`,
    hint_steps: [
      say(lang, `Change is what is left of what you handed over.`,
                `Para üstü, verdiğin paradan geriye kalandır.`,
                `El cambio es lo que sobra de lo que has dado.`),
      say(lang, `Count up from ${cost} to ${paid}, or take ${cost} away from ${paid} — both give the same answer.`,
                `${cost}'ten ${paid}'e kadar sayarak çık, ya da ${paid}'ten ${cost} çıkar — ikisi de aynı sonucu verir.`,
                `Cuenta desde ${cost} hasta ${paid}, o resta ${cost} de ${paid}: dan lo mismo.`),
    ],
  }
}

function moneyMakeValue(level, lang) {
  const [many] = MINOR[lang] ?? MINOR.en
  const coin = pick([2, 5, 10, 20, 25])
  const n = randInt(3, 9)
  const total = coin * n

  return {
    topic: 'money', level,
    question_text: say(lang,
      `How many ${coin}${many === 'cents' ? 'c' : ''} coins make ${total} ${many}?`,
      `${total} ${many} etmek için kaç tane ${coin} ${many}luk gerekir?`,
      `¿Cuántas monedas de ${coin} hacen ${total} ${many}?`),
    format: 'numeric',
    correct_answer: n,
    operandKey: `money:make:${coin}:${total}`,
    hint_steps: [
      say(lang, `Count up in ${coin}s and keep track of how many you have said.`,
                `${coin}'şer sayarak ilerle ve kaç kez saydığını takip et.`,
                `Cuenta de ${coin} en ${coin} y lleva la cuenta de cuántas veces.`),
      say(lang, `Or ask: how many ${coin}s fit inside ${total}?`,
                `Ya da şunu sor: ${total} içine kaç tane ${coin} sığar?`,
                `O pregúntate: ¿cuántos ${coin} caben en ${total}?`),
    ],
  }
}

function moneyTemplate(level, lang) {
  if (bandForLevel(level) >= 2 && Math.random() < 0.4) return moneyShop(level, lang)
  const shape = pick(['change', 'change', 'combine', 'combine', 'make'])
  if (shape === 'combine') return moneyCombine(level, lang)
  if (shape === 'make') return moneyMakeValue(level, lang)
  return moneyChange(level, lang)
}

// ── Measurement ──────────────────────────────────────────────────────────────
// Year 1's "Measurement" and Year 3's. Both bundle several strands, and Year 1's bundles one
// more: it is the only place that year names telling the time, so a share of its rolls go to
// the time template rather than quietly deleting that strand — the same arrangement Year 6's
// "Long Multiplication and Division" needed.
//
// Nothing is drawn here. A comparison is asked as a difference ("how much longer") rather than
// as "which is longer", because the second needs a picture to be a measuring question at all
// and without one it is just reading two numbers.

// Written out rather than abbreviated inside a sentence. "How many l are there in 6 l" puts a
// lower-case L next to digits, where it reads as a 1 — and these are the units a Year 3 child
// is learning the NAMES of.
const UNITS_BY_KIND = {
  length: { per: 100, big: { en: 'metres', tr: 'metre', es: 'metros' }, small: { en: 'centimetres', tr: 'santimetre', es: 'centímetros' } },
  length_mm: { per: 10, big: { en: 'centimetres', tr: 'santimetre', es: 'centímetros' }, small: { en: 'millimetres', tr: 'milimetre', es: 'milímetros' } },
  mass: { per: 1000, big: { en: 'kilograms', tr: 'kilogram', es: 'kilogramos' }, small: { en: 'grams', tr: 'gram', es: 'gramos' } },
  capacity: { per: 1000, big: { en: 'litres', tr: 'litre', es: 'litros' }, small: { en: 'millilitres', tr: 'mililitre', es: 'mililitros' } },
}

function measureConvert(level, lang) {
  const kind = pick(Object.keys(UNITS_BY_KIND))
  const u0 = UNITS_BY_KIND[kind]
  const u = { per: u0.per, big: pickL(u0.big, lang), small: pickL(u0.small, lang) }
  const toSmall = Math.random() < 0.6
  // Whole numbers both ways: going down multiplies, going up needs an exact multiple.
  const big = u.per >= 1000 ? randInt(2, 9) : randInt(2, 40)
  const small = big * u.per

  return {
    topic: 'measurement', level,
    question_text: toSmall
      ? say(lang, `How many ${u.small} are there in ${big} ${u.big}?`,
                  `${big} ${u.big} kaç ${u.small} eder?`,
                  `¿Cuántos ${u.small} hay en ${big} ${u.big}?`)
      : say(lang, `How many ${u.big} are there in ${num(small, lang)} ${u.small}?`,
                  `${num(small, lang)} ${u.small} kaç ${u.big} eder?`,
                  `¿Cuántos ${u.big} hay en ${num(small, lang)} ${u.small}?`),
    format: 'numeric',
    correct_answer: toSmall ? small : big,
    operandKey: `meas:conv:${kind}:${big}:${toSmall ? 'd' : 'u'}`,
    hint_steps: [
      say(lang, `1 ${u.big} is ${num(u.per, lang)} ${u.small}.`,
                `1 ${u.big} = ${num(u.per, lang)} ${u.small}.`,
                `1 ${u.big} son ${num(u.per, lang)} ${u.small}.`),
      toSmall
        ? say(lang, `Going to the smaller unit makes the number bigger, so multiply.`,
                    `Küçük birime geçerken sayı büyür, yani çarparsın.`,
                    `Al pasar a la unidad pequeña el número crece, así que multiplica.`)
        : say(lang, `Going to the bigger unit makes the number smaller, so divide.`,
                    `Büyük birime geçerken sayı küçülür, yani bölersin.`,
                    `Al pasar a la unidad grande el número se hace menor, así que divide.`),
    ],
  }
}

function measureDifference(level, lang) {
  const band = bandForLevel(level)
  const set = band <= 2
    ? pick([
      { unit: 'cm', lo: 5, hi: 30, a: { en: 'pencil', tr: 'kalem', es: 'lápiz', g: 'm' }, b: { en: 'ruler', tr: 'cetvel', es: 'regla', g: 'f' } },
      { unit: 'cm', lo: 20, hi: 90, a: { en: 'cat', tr: 'kedi', es: 'gato', g: 'm' }, b: { en: 'dog', tr: 'köpek', es: 'perro', g: 'm' } },
    ])
    : pick([
      { unit: 'g', lo: 150, hi: 900, a: { en: 'apple', tr: 'elma', es: 'manzana', g: 'f' }, b: { en: 'melon', tr: 'kavun', es: 'melón', g: 'm' } },
      { unit: 'ml', lo: 100, hi: 900, a: { en: 'cup', tr: 'bardak', es: 'vaso', g: 'm' }, b: { en: 'bottle', tr: 'şişe', es: 'botella', g: 'f' } },
      { unit: 'cm', lo: 30, hi: 200, a: { en: 'chair', tr: 'sandalye', es: 'silla', g: 'f' }, b: { en: 'door', tr: 'kapı', es: 'puerta', g: 'f' } },
    ])
  const small = randInt(set.lo, Math.floor((set.lo + set.hi) / 2))
  const large = randInt(small + 2, set.hi)
  const A = pickL(set.a, lang), B = pickL(set.b, lang)
  // "A apple" and "Un manzana" were both being printed. English takes its article from the
  // sound, Spanish from the noun's gender, which the bank now carries.
  const enA = /^[aeiou]/i.test(pickL(set.a, 'en')) ? 'An' : 'A'
  const enB = /^[aeiou]/i.test(pickL(set.b, 'en')) ? 'an' : 'a'
  const esA = set.a.g === 'f' ? 'Una' : 'Un'
  const esB = set.b.g === 'f' ? 'una' : 'un'
  const esTheB = set.b.g === 'f' ? 'la' : 'el'
  // The Spanish adjective agrees with the thing being compared, so it takes B's gender too —
  // "más alto es la puerta" was going out. English and Turkish do not inflect here.
  const esF = set.b.g === 'f'
  const heavier = set.unit === 'g'
    ? say(lang, 'heavier', 'daha ağır', `más ${esF ? 'pesada' : 'pesado'}`)
    : set.unit === 'ml'
      ? say(lang, 'more', 'daha fazla', 'más')
      : say(lang, 'taller', 'daha uzun', `más ${esF ? 'alta' : 'alto'}`)

  return {
    topic: 'measurement', level,
    question_text: set.unit === 'ml'
      ? say(lang, `${enA} ${A} holds ${small} ml and ${enB} ${B} holds ${large} ml. How much more does the ${B} hold?`,
                  `Bir ${A} ${small} ml, bir ${B} ${large} ml alıyor. ${B} kaç ml daha fazla alır?`,
                  `${esA} ${A} contiene ${small} ml y ${esB} ${B} contiene ${large} ml. ¿Cuántos ml más contiene ${esTheB} ${B}?`)
      : say(lang, `${enA} ${A} is ${small} ${set.unit} and ${enB} ${B} is ${large} ${set.unit}. How much ${heavier} is the ${B}?`,
                  `Bir ${A} ${small} ${set.unit}, bir ${B} ${large} ${set.unit}. ${B} kaç ${set.unit} ${heavier}?`,
                  `${esA} ${A} mide ${small} ${set.unit} y ${esB} ${B} mide ${large} ${set.unit}. ¿Cuánto ${heavier} es ${esTheB} ${B}?`),
    format: 'numeric',
    correct_answer: large - small,
    operandKey: `meas:diff:${set.unit}:${small}:${large}`,
    hint_steps: [
      say(lang, `"How much more" asks for the gap between the two, not for either one.`,
                `"Kaç fazla" sorusu ikisinin arasındaki farkı ister, sayılardan birini değil.`,
                `"Cuánto más" pide la diferencia entre los dos, no uno de ellos.`),
      say(lang, `Take the smaller away from the larger.`,
                `Küçüğü büyükten çıkar.`,
                `Resta el menor del mayor.`),
    ],
  }
}

// Two different side lengths, longer first: the drawing is a landscape rectangle with the first
// length along the bottom, and "9 cm long and 16 cm wide" or a square called a rectangle both
// contradict it.
function rectSides(lo, hi) {
  const a = randInt(lo, hi)
  let b
  do { b = randInt(lo, hi) } while (b === a)
  return a > b ? [a, b] : [b, a]
}

function measurePerimeter(level, lang) {
  const [w, h] = rectSides(3, 24)
  return {
    topic: 'measurement', level,
    question_text: say(lang,
      `A rectangle is ${w} cm long and ${h} cm wide. What is its perimeter in cm?`,
      `Bir dikdörtgenin uzunluğu ${w} cm, genişliği ${h} cm. Çevresi kaç cm'dir?`,
      `Un rectángulo mide ${w} cm de largo y ${h} cm de ancho. ¿Cuál es su perímetro en cm?`),
    format: 'numeric',
    correct_answer: 2 * (w + h),
    operandKey: `meas:per:${w}:${h}`,
    hint_steps: [
      say(lang, `Perimeter is the whole way round the outside.`,
                `Çevre, dışından bir tam turdur.`,
                `El perímetro es toda la vuelta por fuera.`),
      say(lang, `A rectangle has two sides of each length, so there are four sides to add.`,
                `Dikdörtgende her uzunluktan iki kenar vardır, yani toplanacak dört kenar var.`,
                `Un rectángulo tiene dos lados de cada medida: hay cuatro lados que sumar.`),
    ],
    visual: { kind: 'geometry', shape: 'rect', base: w, height: h, ask: 'perimeter' },
  }
}

function measurementTemplate(level, lang, columnar) {
  const band = bandForLevel(level)
  if (band <= 2) {
    // Year 1 names telling the time inside this topic and nowhere else, and it names coins.
    // A share of the rolls goes to each rather than dropping the strand.
    const r = Math.random()
    if (r < 0.3) return timeTemplate(level, lang, columnar)
    if (r < 0.45) return moneyCombine(level, lang)
    if (r < 0.65) return measureReading(level, lang)
    return measureDifference(level, lang)
  }
  // Year 3: units, perimeter, and money change — all three are in its line.
  // Reading a scale is the measuring question both books ask most, and it could not be asked
  // until there was something to draw it with.
  // Change is asked through the shop now: the old shape priced an apple at 418 cents.
  const shape = pick(['convert', 'convert', 'difference', 'perimeter', 'read', 'read', 'read', 'shop', 'shop'])
  if (shape === 'read') return measureReading(level, lang)
  if (shape === 'shop') return moneyShop(level, lang)
  if (shape === 'difference') return measureDifference(level, lang)
  if (shape === 'perimeter') return measurePerimeter(level, lang)
  return measureConvert(level, lang)
}

// ── Area and perimeter by counting squares (Year 4) ──────────────────────────
// The line is "find the area of rectilinear shapes by counting squares; calculate the
// perimeter of rectilinear figures; convert between different units of measurement".
//
// Rectilinear, not rectangular: an L-shape is the whole point of the topic, and it is also
// what stops the question being answered by multiplying the two numbers in the sentence —
// there are no two numbers in the sentence. The shape is on the grid and nowhere else.

// An L built from a rectangle with a corner bitten out. Returned as the filled unit squares,
// plus the area and perimeter computed from the cells rather than from a formula, so the
// answer cannot drift from the picture.
export function measureGridCells(cells = []) {
  const has = new Set(cells.map(c => c.join(',')))
  let perimeter = 0
  for (const [x, y] of cells) {
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (!has.has(`${x + dx},${y + dy}`)) perimeter++
    }
  }
  return { area: cells.length, perimeter }
}

function rectilinearShape() {
  const w = randInt(3, 7), h = randInt(3, 6)
  // The bite is always smaller than the rectangle in both directions, so the result is a
  // proper L and never a rectangle or a disconnected pair.
  const bw = randInt(1, w - 2), bh = randInt(1, h - 2)
  const corner = pick([[0, 0], [1, 0], [0, 1], [1, 1]])
  const cells = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inBiteX = corner[0] === 0 ? x < bw : x >= w - bw
      const inBiteY = corner[1] === 0 ? y < bh : y >= h - bh
      if (!(inBiteX && inBiteY)) cells.push([x, y])
    }
  }
  // Perimeter is counted as the number of cell edges with nothing on the other side, which is
  // true of any rectilinear figure and needs no special case for the notch.
  return { w, h, cells, ...measureGridCells(cells) }
}

function areaGridTemplate(level, lang) {
  const shape = rectilinearShape()
  const askArea = Math.random() < 0.55
  // Several phrasings, because the whole variety of this template lives in the PICTURE and a
  // single wording meant two distinct question texts in twenty thousand draws. A Year 4 session
  // has nine topics for ten slots, so one topic comes round twice — and the session's own
  // repeat guard works on the sentence, which would have had nothing to choose between.
  const who = pickL({ en: ['this shape', 'the shape on the grid', 'the blue shape'],
                      tr: ['bu şeklin', 'ızgaradaki şeklin', 'mavi şeklin'],
                      es: ['esta figura', 'la figura de la cuadrícula', 'la figura azul'] }, lang)
  return {
    topic: 'area-grid', level,
    question_text: askArea
      ? pick([
        say(lang, `Each square is 1 cm by 1 cm. What is the area of ${who} in cm²?`,
                  `Her kare 1 cm × 1 cm. ${up(who, 'tr')} alanı kaç cm²'dir?`,
                  `Cada cuadrado mide 1 cm por 1 cm. ¿Cuál es el área de ${who} en cm²?`),
        say(lang, `How many 1 cm squares does ${who} cover?`,
                  `${up(who, 'tr')} kapladığı 1 cm'lik kare sayısı kaçtır?`,
                  `¿Cuántos cuadrados de 1 cm cubre ${who}?`),
      ])
      : pick([
        say(lang, `Each square is 1 cm by 1 cm. What is the perimeter of ${who} in cm?`,
                  `Her kare 1 cm × 1 cm. ${up(who, 'tr')} çevresi kaç cm'dir?`,
                  `Cada cuadrado mide 1 cm por 1 cm. ¿Cuál es el perímetro de ${who} en cm?`),
        say(lang, `Count the 1 cm sides around the outside of ${who}. What is its perimeter?`,
                  `${up(who, 'tr')} dışındaki 1 cm'lik kenarları say. Çevresi kaç cm'dir?`,
                  `Cuenta los lados de 1 cm alrededor de ${who}. ¿Cuál es su perímetro?`),
      ]),
    format: 'numeric',
    correct_answer: askArea ? shape.area : shape.perimeter,
    operandKey: `grid:${askArea ? 'a' : 'p'}:${shape.cells.map(c => c.join('')).join('-')}`,
    hint_steps: askArea
      ? [say(lang, `Area is how many squares the shape covers.`,
                   `Alan, şeklin kapladığı kare sayısıdır.`,
                   `El área es cuántos cuadrados cubre la figura.`),
         say(lang, `Count them row by row so none is counted twice.`,
                   `Satır satır say ki hiçbiri iki kez sayılmasın.`,
                   `Cuéntalos fila a fila para no contar ninguno dos veces.`)]
      : [say(lang, `Perimeter is the distance all the way round the edge.`,
                   `Çevre, kenar boyunca dolaşılan toplam uzunluktur.`,
                   `El perímetro es la distancia que rodea todo el borde.`),
         say(lang, `Start at one corner and count the sides of the squares along the outside — the notch counts too.`,
                   `Bir köşeden başla ve dış kenardaki kare kenarlarını say — girinti de sayılır.`,
                   `Empieza en una esquina y cuenta los lados de los cuadrados por fuera; la muesca también cuenta.`)],
    visual: { kind: 'chart', shape: 'grid', cols: shape.w, rows: shape.h, cells: shape.cells },
  }
}

// ── Bar charts and time graphs (Year 4), line graphs and tables (Year 5) ─────
// The question never prints the value it asks for. A chart with its numbers written on it is
// a subtraction question with a picture behind it, and the topic is reading the chart.

// The axis carries the short label; the question says the day or month in full, with the
// preposition the language puts in front of it. The questions used to reuse the axis label and
// the day's grammar for everything: "Eki günü Ara gününden kaç gol fazla?" ("on October-day")
// and "¿Cuántos goles el Oct?".
const EN_DAYS = ['on Monday', 'on Tuesday', 'on Wednesday', 'on Thursday', 'on Friday']
const TR_DAYS = ['pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma']
const ES_DAYS = ['el lunes', 'el martes', 'el miércoles', 'el jueves', 'el viernes']
const CHART_SETS = {
  en: [
    { what: 'books borrowed', labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], unit: 'books', at: EN_DAYS },
    { what: 'goals scored', labels: ['Sep', 'Oct', 'Nov', 'Dec'], unit: 'goals', at: ['in September', 'in October', 'in November', 'in December'] },
    { what: 'visitors', labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], unit: 'people', at: EN_DAYS },
  ],
  tr: [
    { what: 'ödünç alınan kitap', labels: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'], unit: 'kitap', at: TR_DAYS.map(d => `${d} günü`), from: TR_DAYS.map(d => `${d} gününden`) },
    { what: 'atılan gol', labels: ['Eyl', 'Eki', 'Kas', 'Ara'], unit: 'gol', at: ['eylülde', 'ekimde', 'kasımda', 'aralıkta'], from: ['eylülden', 'ekimden', 'kasımdan', 'aralıktan'] },
    { what: 'ziyaretçi', labels: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'], unit: 'kişi', at: TR_DAYS.map(d => `${d} günü`), from: TR_DAYS.map(d => `${d} gününden`) },
  ],
  es: [
    { what: 'libros prestados', labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'], unit: 'libros', at: ES_DAYS },
    { what: 'goles marcados', labels: ['Sep', 'Oct', 'Nov', 'Dic'], unit: 'goles', at: ['en septiembre', 'en octubre', 'en noviembre', 'en diciembre'] },
    { what: 'visitantes', labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'], unit: 'personas', at: ES_DAYS, many: 'Cuántas' },
  ],
}

// Values land on the gridlines, because a bar between two lines cannot be read exactly and the
// question would then have no defensible answer.
function chartData(step, n) {
  const vals = []
  while (vals.length < n) {
    const v = step * randInt(1, 9)
    // No two the same: "which day had the most" needs one answer, and a repeated value in a
    // difference question makes the pair ambiguous.
    if (!vals.includes(v)) vals.push(v)
  }
  return vals
}

// Year 5's own line ends "complete and interpret information in a table", and Bond's 10-11
// book asks it the same way three times: a two-way table of boys and girls against three
// choices, the total given in the question, one cell a "?". It is an addition-and-subtraction
// question with a picture — which is the point: the child has to see that "100 children" is
// the whole table before anything can be worked out.
const TABLE_SETS = [
  { en: { what: 'musical instrument', rows: ['Drum', 'Recorder', 'Guitar'], ask: ['the drum', 'the recorder', 'the guitar'] },
    tr: { what: 'enstrümanı', rows: ['Davul', 'Blok flüt', 'Gitar'], ask: ['davulu', 'blok flütü', 'gitarı'] },
    es: { what: 'instrumento favorito', rows: ['Tambor', 'Flauta', 'Guitarra'], ask: ['el tambor', 'la flauta', 'la guitarra'] } },
  { en: { what: 'after-school club', rows: ['Tennis', 'Judo', 'Ballet'], ask: ['tennis', 'judo', 'ballet'] },
    tr: { what: 'kulübü', rows: ['Tenis', 'Judo', 'Bale'], ask: ['tenisi', 'judoyu', 'baleyi'] },
    es: { what: 'actividad favorita', rows: ['Tenis', 'Judo', 'Ballet'], ask: ['el tenis', 'el judo', 'el ballet'] } },
  { en: { what: 'school subject', rows: ['English', 'Geography', 'Maths'], ask: ['English', 'geography', 'maths'] },
    tr: { what: 'dersi', rows: ['Türkçe', 'Coğrafya', 'Matematik'], ask: ['Türkçeyi', 'coğrafyayı', 'matematiği'] },
    es: { what: 'asignatura favorita', rows: ['Lengua', 'Geografía', 'Matemáticas'], ask: ['lengua', 'geografía', 'matemáticas'] } },
]

function chartTable(level, lang) {
  const set = pick(TABLE_SETS)
  const w = set[lang] ?? set.en
  const total = pick([60, 80, 100, 100, 120])
  // Two columns (boys, girls) by three rows; one cell is the question.
  let cells, missing
  const hole = randInt(0, 5)
  do {
    cells = Array.from({ length: 6 }, () => randInt(2, Math.round(total / 3.5)))
    cells[hole] = 0
    missing = total - cells.reduce((x, y) => x + y, 0)
  } while (missing < 3 || missing > total / 2.5)
  cells[hole] = null
  const row = Math.floor(hole / 2)
  const girls = hole % 2 === 1
  const cols = [say(lang, 'Boys', 'Erkek', 'Niños'), say(lang, 'Girls', 'Kız', 'Niñas')]
  const q = girls
    ? say(lang, `How many girls chose ${w.ask[row]}?`, `Kaç kız ${w.ask[row]} seçti?`, `¿Cuántas niñas eligieron ${w.ask[row]}?`)
    : say(lang, `How many boys chose ${w.ask[row]}?`, `Kaç erkek ${w.ask[row]} seçti?`, `¿Cuántos niños eligieron ${w.ask[row]}?`)
  return {
    topic: 'chart', level,
    question_text: say(lang,
      `${total} children each chose their favourite ${w.what}. ${q}`,
      `${total} çocuk en sevdiği ${w.what} seçti. ${q}`,
      `${total} niños eligieron su ${w.what}. ${q}`),
    format: 'numeric',
    correct_answer: missing,
    operandKey: `chart:t:${total}:${cells.map(c => c ?? '?').join('-')}`,
    hint_steps: [
      say(lang, `Add up all the numbers you can see in the table.`,
                `Tabloda gördüğün bütün sayıları topla.`,
                `Suma todos los números que ves en la tabla.`),
      say(lang, `Every one of the ${total} children is in the table, so the missing number is what takes your total up to ${total}.`,
                `${total} çocuğun hepsi tabloda, yani eksik sayı, bulduğun toplamı ${total} yapan sayıdır.`,
                `Los ${total} niños están todos en la tabla: el número que falta es lo que lleva tu suma hasta ${total}.`),
    ],
    visual: { kind: 'chart', shape: 'table', cols, rows: w.rows.map((label, i) => ({ label, cells: [cells[i * 2], cells[i * 2 + 1]] })) },
  }
}

function chartTemplate(level, lang) {
  const band = bandForLevel(level)
  // From Year 5 a third of the chart questions are the two-way table the curriculum line names.
  if (band >= 5 && Math.random() < 0.35) return chartTable(level, lang)
  // Year 4 sorts numbers too (Venn and Carroll diagrams, Bond 8-9 tests 4, 7, 15).
  if (band === 4 && Math.random() < 0.25) return { ...dataSorting(level, lang), topic: 'chart' }
  const line = band >= 5
  const set = pickL(CHART_SETS, lang)
  const step = pick(line ? [5, 10, 20] : [2, 5, 10])
  const values = chartData(step, set.labels.length)
  const ask = pick(line ? ['read', 'difference', 'total', 'most'] : ['read', 'read', 'difference', 'most'])

  const iMax = values.indexOf(Math.max(...values))
  const i1 = randInt(0, values.length - 1)
  let i2 = randInt(0, values.length - 1)
  while (i2 === i1) i2 = randInt(0, values.length - 1)
  const [hi, lo] = values[i1] > values[i2] ? [i1, i2] : [i2, i1]

  const spec = {
    read: {
      q: say(lang, `How many ${set.unit} ${set.at[i1]}?`,
                   `${cap(set.at[i1])} kaç ${set.unit}?`,
                   `¿${set.many ?? 'Cuántos'} ${set.unit} ${set.at[i1]}?`),
      a: values[i1], highlight: [set.labels[i1]],
      h: [say(lang, `Find ${set.labels[i1]} along the bottom.`, `Alt tarafta ${set.labels[i1]} etiketini bul.`, `Busca ${set.labels[i1]} en la parte de abajo.`),
          say(lang, `Follow it up, then read straight across to the numbers on the left.`, `Yukarı doğru takip et, sonra soldaki sayılara doğru düz git.`, `Súbelo y luego lee en línea recta hacia los números de la izquierda.`)],
    },
    difference: {
      q: say(lang, `How many more ${set.unit} ${set.at[hi]} than ${set.at[lo]}?`,
                   `${cap(set.at[hi])}, ${set.from?.[lo]} kaç ${set.unit} fazla?`,
                   `¿${set.many ?? 'Cuántos'} ${set.unit} más ${set.at[hi]} que ${set.at[lo]}?`),
      a: values[hi] - values[lo], highlight: [set.labels[hi], set.labels[lo]],
      h: [say(lang, `Read both of them off the chart first.`, `Önce ikisini de grafikten oku.`, `Lee primero los dos en el gráfico.`),
          say(lang, `"How many more" is the gap between them, so take the smaller from the larger.`, `"Kaç fazla" aradaki farktır, küçüğü büyükten çıkar.`, `"Cuántos más" es la diferencia: resta el menor del mayor.`)],
    },
    total: {
      q: say(lang, `How many ${set.unit} altogether across all ${values.length}?`,
                   `Hepsinde toplam kaç ${set.unit}?`,
                   `¿${set.many ?? 'Cuántos'} ${set.unit} hay en total entre los ${values.length}?`),
      a: values.reduce((x, y) => x + y, 0), highlight: [],
      h: [say(lang, `Read each one off the chart and write it down before adding.`, `Her birini grafikten okuyup yaz, sonra topla.`, `Lee cada uno del gráfico y anótalo antes de sumar.`),
          say(lang, `Add them in pairs that make a round number if you can.`, `Yuvarlak sayı yapan çiftleri önce topla.`, `Suma primero las parejas que den un número redondo.`)],
    },
    most: {
      q: say(lang, `How many ${set.unit} were there on the busiest one?`,
                   `En yoğun olanında kaç ${set.unit} vardı?`,
                   `¿${set.many ?? 'Cuántos'} ${set.unit} hubo en el de más?`),
      a: values[iMax], highlight: [set.labels[iMax]],
      h: [say(lang, `Find the tallest one first.`, `Önce en yükseğini bul.`, `Busca primero el más alto.`),
          say(lang, `Then read its height off the numbers on the left.`, `Sonra yüksekliğini soldaki sayılardan oku.`, `Luego lee su altura en los números de la izquierda.`)],
    },
  }[ask]

  return {
    topic: 'chart', level,
    // Same reason as the grid above: the lead-in was one fixed sentence, so two chart questions
    // in a session read as the same question twice even with different data behind them.
    question_text: pick([
      say(lang, `The chart shows the ${set.what}. ${spec.q}`,
                `Grafik ${set.what} sayısını gösteriyor. ${spec.q}`,
                `El gráfico muestra los ${set.what}. ${spec.q}`),
      say(lang, `Look at the chart of ${set.what}. ${spec.q}`,
                `${cap(set.what)} grafiğine bak. ${spec.q}`,
                `Mira el gráfico de ${set.what}. ${spec.q}`),
      say(lang, `This is a record of the ${set.what}. ${spec.q}`,
                `Bu, ${set.what} kaydıdır. ${spec.q}`,
                `Este es el registro de ${set.what}. ${spec.q}`),
    ]),
    format: 'numeric',
    correct_answer: spec.a,
    operandKey: `chart:${line ? 'l' : 'b'}:${ask}:${values.join('-')}`,
    hint_steps: spec.h,
    visual: { kind: 'chart', shape: line ? 'line' : 'bar', labels: set.labels, values, step, unit: set.unit, highlight: spec.highlight },
  }
}

// Year 6 names one topic "Long Multiplication and Division", and a curriculum topic maps to
// exactly one template — so pointing it at the multiplication template alone would mean a
// Year 6 child never met division at all, since no other Year 6 topic carries it. This hands
// the slot to either, which is what the topic itself says.
function longMultDivTemplate(level, lang, columnar) {
  return Math.random() < 0.5
    ? multiplicationWordTemplate(level, lang, columnar)
    : divisionWordTemplate(level, lang, columnar)
}

// Year 5's separate decimal topic. Integer units keep the arithmetic exact;
// rounding happens on those units, not on binary floating-point decimals.
function decimalsPercentagesTemplate(level, lang) {
  const kind = pick(['percent-decimal', 'decimal-percent', 'fraction-decimal', 'decimal-fraction', 'add', 'subtract', 'compare', 'round'])
  const places = pick([1, 2, 3])
  const scale = 10 ** places
  // Never an exact whole number: "1 = ?/100" is not a question about writing a decimal as a
  // fraction, and its hint has to say 100, which is the answer.
  let a
  do { a = randInt(1, scale * 4 - 1) } while (a % scale === 0)
  const b = randInt(1, scale * 2 - 1)
  const dec = n => dnum(n / scale, lang)
  let question, answer, hints, key
  const placeHint = say(lang,
    'After the decimal point come tenths, hundredths, then thousandths.',
    'Ondalık ayıracından sonra onda birler, yüzde birler, sonra binde birler gelir.',
    'Tras el separador decimal vienen décimas, centésimas y milésimas.')
  if (kind === 'percent-decimal' || kind === 'decimal-percent') {
    const pct = randInt(1, 99)
    const toDecimal = kind === 'percent-decimal'
    question = toDecimal
      ? say(lang, `Write ${pct}% as a decimal.`, `%${pct} değerini ondalık sayı olarak yaz.`, `Escribe el ${pct}% como número decimal.`)
      : say(lang, `Write ${dnum(pct / 100, lang)} as a percentage. Enter the number before %.`, `${dnum(pct / 100, lang)} sayısını yüzde olarak yaz. Yüzde işareti olmadan sayıyı gir.`, `Escribe ${dnum(pct / 100, lang)} como porcentaje. Introduce el número sin %.`)
    answer = toDecimal ? pct / 100 : pct
    hints = [say(lang, 'Percent means parts out of one hundred.', 'Yüzde, yüz eş parçadan kaçının alındığını söyler.', 'Por ciento indica cuántas partes se toman de cien.'),
      toDecimal
        ? say(lang, 'Divide the percentage number by 100. Use the hundredths place, with a zero placeholder if needed.', 'Yüzde sayısını 100’e böl. Yüzde birler basamağını kullan; gerekirse boş basamağa sıfır koy.', 'Divide el porcentaje entre 100. Usa las centésimas y un cero si hace falta para guardar la posición.')
        : say(lang, 'One whole is 100%. Multiply the decimal by 100 to count the hundredths.', 'Bir bütün %100’dür. Yüzde birleri saymak için ondalık sayıyı 100 ile çarp.', 'Un entero es el 100%. Multiplica el decimal por 100 para contar las centésimas.')]
    key = `${kind}:${pct}`
  } else if (kind === 'fraction-decimal' || kind === 'decimal-fraction') {
    const toDecimal = kind === 'fraction-decimal'
    question = toDecimal
      ? say(lang, `Write ${a}/${scale} as a decimal.`, `${a}/${scale} kesrini ondalık sayı olarak yaz.`, `Escribe ${a}/${scale} como número decimal.`)
      : say(lang, `Complete: ${dec(a)} = ?/${scale}. What is the top number?`, `Tamamla: ${dec(a)} = ?/${scale}. Üstteki sayı kaçtır?`, `Completa: ${dec(a)} = ?/${scale}. ¿Cuál es el número de arriba?`)
    answer = toDecimal ? a / scale : a
    hints = [placeHint, toDecimal
      ? say(lang, `Divide the top number by ${scale}; use ${places} decimal places before dropping any trailing zeros.`, `Üstteki sayıyı ${scale} sayısına böl; sondaki sıfırları silmeden önce ${places} ondalık basamak kullan.`, `Divide el número de arriba entre ${scale}; usa ${places} cifras decimales antes de quitar ceros finales.`)
      : say(lang, `Count how many pieces of size 1/${scale} make this number. Multiply by ${scale}.`, `Bu sayıda kaç tane 1/${scale} olduğunu bul. ${scale} ile çarp.`, `Cuenta cuántas partes de tamaño 1/${scale} forman el número. Multiplica por ${scale}.`)]
    key = `${kind}:${a}:${scale}`
  } else if (kind === 'round') {
    // Include a discarded digit, including exact halfway cases; round half upwards.
    // The value must actually NEED rounding: 7.700 asked "to 1 decimal place" answers itself
    // with 7.7, and a question the child does nothing to is not a question. Same rule as
    // placeRoundDecimal above, which was fixed for the same reason.
    const digits = pick([0, 1, 2])
    const divisor = 10 ** (3 - digits)
    let units, value
    do {
      units = randInt(11, 9999)
      value = units / 1000
    } while (units % divisor === 0)
    answer = Math.floor((units + divisor / 2) / divisor) / (10 ** digits)
    // "1 decimal places" — English and Spanish both agree the noun with the count, Turkish
    // does not. Fourth time an -s has been wrong in these banks today, so it is written out
    // rather than appended.
    // And "0 decimal places" is not how anyone asks for a whole number, least of all of a
    // ten-year-old. Zero gets its own wording.
    const one = digits === 1
    question = digits === 0
      ? say(lang,
          `Round ${dnum(value, lang)} to the nearest whole number.`,
          `${dnum(value, lang)} sayısını en yakın tam sayıya yuvarla.`,
          `Redondea ${dnum(value, lang)} al número entero más cercano.`)
      : say(lang,
          `Round ${dnum(value, lang)} to ${digits} decimal ${one ? 'place' : 'places'}.`,
          `${dnum(value, lang)} sayısını ${digits} ondalık basamağa yuvarla.`,
          `Redondea ${dnum(value, lang)} a ${digits} ${one ? 'cifra decimal' : 'cifras decimales'}.`)
    hints = [placeHint, say(lang, 'Look at the first digit you will remove. If it is 5 or more, increase the last kept digit; otherwise keep it.', 'Sileceğin ilk rakama bak. 5 veya büyükse tutacağın son basamağı artır; küçükse aynı bırak.', 'Mira la primera cifra que vas a quitar. Si es 5 o más, aumenta la última que conservas; si no, déjala igual.')]
    key = `${kind}:${units}:${digits}`
  } else if (kind === 'compare') {
    // Different printed lengths catch the misconception that more digits means bigger.
    const short = randInt(1, 29) * 100
    let long = randInt(1, 2999)
    if (long === short) long += 1
    question = say(lang, `Which is greater: ${dnum(short / 1000, lang)} or ${dnum(long / 1000, lang)}?`, `Hangisi daha büyük: ${dnum(short / 1000, lang)} mi, ${dnum(long / 1000, lang)} mi?`, `¿Cuál es mayor: ${dnum(short / 1000, lang)} o ${dnum(long / 1000, lang)}?`)
    answer = Math.max(short, long) / 1000
    hints = [say(lang, 'Compare the whole-number parts first, then tenths, hundredths and thousandths.', 'Önce tam kısımları, sonra onda birleri, yüzde birleri ve binde birleri karşılaştır.', 'Compara primero los enteros, luego décimas, centésimas y milésimas.'),
      say(lang, 'Add zeros at the end of the decimal part; its value stays the same. Compare matching places.', 'Ondalık kısmın sonuna sıfır eklemek değeri değiştirmez. Aynı basamakları karşılaştır.', 'Puedes añadir ceros al final de la parte decimal sin cambiar su valor. Compara las mismas posiciones.')]
    key = `${kind}:${short}:${long}`
  } else {
    const x = Math.max(a, b), y = Math.min(a, b)
    const add = kind === 'add'
    question = `${dec(x)} ${add ? '+' : '−'} ${dec(y)} = ?`
    answer = (add ? x + y : x - y) / scale
    hints = [say(lang, 'Line up the decimal points. Add zeros at the end if the decimal lengths differ.', 'Ondalık ayıraçlarını alt alta hizala. Ondalık basamak sayıları farklıysa sona sıfır ekle.', 'Alinea los separadores decimales. Añade ceros al final si hay distinta cantidad de cifras decimales.'),
      say(lang, 'Work from right to left, keeping each place aligned. Regroup when needed; keep the decimal point in line.', 'Sağdan sola, aynı basamaklarla işlem yap. Gerekirse elde veya ödünç alma kullan; ondalık ayıracını hizasında tut.', 'Opera de derecha a izquierda, con las posiciones alineadas. Reagrupa cuando haga falta y conserva el separador alineado.')]
    key = `${kind}:${x}:${y}:${scale}`
  }
  // The format describes the ANSWER, not the topic: "write 0.69 as a percentage" is answered
  // with 69 and "= ?/1000" with 2042, and declaring those 'decimal' puts a point on the keypad
  // that the child has no use for and could mistype into.
  const format = Number.isInteger(answer) ? 'numeric' : 'decimal'
  return { topic: 'decimals-percentages', level, question_text: question, format, correct_answer: answer, operandKey: `dec:${key}`, hint_steps: hints }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Years 2 to 4 (ages 7-9): the questions Bond's 7-8 and 8-9 books ask
// ═══════════════════════════════════════════════════════════════════════════════
// Measured before this section was written: those three years had one shape of addition
// ("68 + 25 = ?"), one of subtraction, one of division and three of multiplication, all of them
// the same sentence with the nouns swapped. Bond's Assessment Papers 7-8 and 10 Minute Tests 8-9
// ask the same arithmetic in a dozen ways — a missing number ("? + 650 = 1000"), the missing
// sign ("22 ? 19 = 41"), a story that takes two steps, a remainder that has to be rounded the
// right way ("30 children, 4 to a car"), a scale to read, a shape with some of it shaded, a grid,
// a tally chart. A child can be fluent at "68 + 25" and lost at every one of those, which is why
// the books ask them.
//
// Each topic keeps a share of its plain shape — the fluency still has to be practised — and
// takes the rest from the book's shapes, scaled to the child's year.

// A choice option. Every wrong one carries the mistake it stands for, the same contract the
// fraction templates keep: a wrong answer is told WHY it is wrong, not just that it is.
const opt = (value, why) => ({ value: String(value), why })

// Options in a stable, meaningful order where the values have one (numbers, times), shuffled
// otherwise, with duplicates of the right answer's VALUE removed rather than trusted away.
function choiceOf(right, wrongs, { sort = null } = {}) {
  const seen = new Set([right.value])
  const out = [right]
  for (const w of wrongs) {
    if (!w || seen.has(w.value)) continue
    seen.add(w.value)
    out.push(w)
    if (out.length === 4) break
  }
  return sort ? out.sort(sort) : shuffle(out)
}

// ── number words ──────────────────────────────────────────────────────────────
// "Write two hundred and two in figures" is in both books, and so is the reverse. English is
// the British form the books print ("nine thousand, seven hundred and three"); Turkish drops
// "bir" before yüz and bin; Spanish has its own words to 29 and its irregular hundreds.
const EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const EN_TENS_W = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const TR_ONES = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz']
const TR_TENS_W = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan']
const ES_TO_29 = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis',
  'veintisiete', 'veintiocho', 'veintinueve']
const ES_TENS_W = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const ES_HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos',
  'setecientos', 'ochocientos', 'novecientos']

export function numberWords(n, lang = 'en') {
  if (lang === 'tr') {
    if (n === 0) return 'sıfır'
    const parts = []
    const th = Math.floor(n / 1000), h = Math.floor((n % 1000) / 100), t = Math.floor((n % 100) / 10), o = n % 10
    if (th) parts.push(th === 1 ? 'bin' : `${TR_ONES[th]} bin`)
    if (h) parts.push(h === 1 ? 'yüz' : `${TR_ONES[h]} yüz`)
    if (t) parts.push(TR_TENS_W[t])
    if (o) parts.push(TR_ONES[o])
    return parts.join(' ')
  }
  if (lang === 'es') {
    const under100 = m => m < 30 ? ES_TO_29[m] : `${ES_TENS_W[Math.floor(m / 10)]}${m % 10 ? ` y ${ES_TO_29[m % 10]}` : ''}`
    const under1000 = m => {
      if (m === 100) return 'cien'
      const h = Math.floor(m / 100), r = m % 100
      return [h ? ES_HUNDREDS[h] : '', r ? under100(r) : ''].filter(Boolean).join(' ')
    }
    if (n === 0) return 'cero'
    const th = Math.floor(n / 1000), r = n % 1000
    return [th ? (th === 1 ? 'mil' : `${under1000(th)} mil`) : '', r ? under1000(r) : ''].filter(Boolean).join(' ')
  }
  const under100 = m => m < 20 ? EN_ONES[m] : `${EN_TENS_W[Math.floor(m / 10)]}${m % 10 ? `-${EN_ONES[m % 10]}` : ''}`
  const under1000 = m => {
    const h = Math.floor(m / 100), r = m % 100
    if (!h) return under100(r)
    return `${EN_ONES[h]} hundred${r ? ` and ${under100(r)}` : ''}`
  }
  if (n === 0) return 'zero'
  const th = Math.floor(n / 1000), r = n % 1000
  if (!th) return under1000(r)
  if (!r) return `${under1000(th)} thousand`
  return `${under1000(th)} thousand${r < 100 ? ' and ' : ', '}${under1000(r)}`
}

// Roman numerals to 100 — Year 4's own line ("read Roman numerals to 100").
export function roman(n) {
  const table = [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let out = ''
  for (const [v, s] of table) while (n >= v) { out += s; n -= v }
  return out
}

// ── money and time as the reader writes them ──────────────────────────────────
// The app's money is the reader's (see the money section): dollars in English, lira in Turkish,
// euros in Spanish. Tags print the major unit with two decimals, the way a shop does.
function cash(cents, lang) {
  const s = (cents / 100).toFixed(2)
  return say(lang, `$${s}`, `${s.replace('.', ',')} TL`, `${s.replace('.', ',')} €`)
}
const MAJOR = { en: 'dollars', tr: 'lira', es: 'euros' }

// h:mm on a 12-hour face, hh:mm on a 24-hour clock. Minutes are counted from midnight.
const hm = (mins, pad = false) => {
  const m = ((mins % 1440) + 1440) % 1440
  const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0')
  return pad ? `${String(h).padStart(2, '0')}:${mm}` : `${((h + 11) % 12) + 1}:${mm}`
}

// Turkish's distributive suffix, written after digits the way a book does: 2'şer, 3'er, 4'er,
// 6'şar, 9'ar, 10'ar, 50'şer, 100'er. It follows the last word of the number as it is SAID —
// a vowel-final word takes -şer/-şar, and the vowel harmonises with the last vowel — so it
// cannot be one suffix for every number, which is what "Count on in 4s" was doing ("4'şer").
export function trDist(n) {
  const words = numberWords(n, 'tr').split(' ')
  const last = words[words.length - 1]
  const vowels = last.match(/[aeıioöuü]/g) || ['e']
  const back = 'aıou'.includes(vowels[vowels.length - 1])
  const endsVowel = /[aeıioöuü]$/.test(last)
  return `${n}'${endsVowel ? 'ş' : ''}${back ? 'ar' : 'er'}`
}

// ── addition and subtraction, ages 7-9 ────────────────────────────────────────
// The numbers each year works in, and a round number to aim at. "? + 650 = 1000" is the
// Year 3 question; "? + 38 = 100" the Year 2 one.
function youngRange(band) {
  if (band <= 2) return { lo: 11, hi: 99, whole: [50, 60, 80, 100], parts: 2 }
  if (band === 3) return { lo: 101, hi: 999, whole: [200, 500, 1000], parts: 2 }
  return { lo: 1001, hi: 9999, whole: [2000, 5000, 10000], parts: 2 }
}

// A number whose non-zero digits are few enough to hold in the head, drawn inside [lo, hi].
function partitionable(lo, hi, parts = 2) {
  let n
  do { n = randInt(lo, hi) } while (placeParts(n).length > parts)
  return n
}

function missingNumber(level, lang, add) {
  const band = bandForLevel(level)
  const R = youngRange(band)
  const toWhole = Math.random() < 0.5
  let a, b, total
  if (add) {
    total = toWhole ? pick(R.whole) : randInt(Math.max(R.lo * 2, 30), R.hi)
    b = partitionable(Math.round(total * 0.2), Math.round(total * 0.8), R.parts)
    a = total - b
    const blankFirst = Math.random() < 0.5
    const q = blankFirst ? `? + ${num(b, lang)} = ${num(total, lang)}` : `${num(a, lang)} + ? = ${num(total, lang)}`
    const known = blankFirst ? b : a
    return {
      topic: 'addition', level, question_text: q, format: 'numeric', correct_answer: total - known,
      operandKey: `miss:add:${known}:${total}`,
      hint_steps: [
        say(lang, `The missing number and ${num(known, lang)} make ${num(total, lang)} together.`,
                  `Eksik sayı ile ${num(known, lang)} birlikte ${num(total, lang)} eder.`,
                  `El número que falta y ${num(known, lang)} suman ${num(total, lang)}.`),
        say(lang, `So take ${num(known, lang)} away from ${num(total, lang)}, or count up from ${num(known, lang)} to ${num(total, lang)}.`,
                  `Yani ${num(total, lang)} sayısından ${num(known, lang)} çıkar ya da ${num(known, lang)} sayısından ${num(total, lang)} sayısına kadar say.`,
                  `Así que resta ${num(known, lang)} de ${num(total, lang)}, o cuenta desde ${num(known, lang)} hasta ${num(total, lang)}.`),
      ],
    }
  }
  // Subtraction: "74 − ? = 51" and "? − 25 = 22" — the second is the one children find hard,
  // because the answer is BIGGER than both numbers on the page.
  const start = toWhole ? pick(R.whole) : randInt(Math.max(R.lo * 2, 30), R.hi)
  const takeAway = partitionable(Math.round(start * 0.15), Math.round(start * 0.7), R.parts)
  const left = start - takeAway
  const blankStart = Math.random() < 0.4
  if (blankStart) {
    return {
      topic: 'subtraction', level,
      question_text: `? − ${num(takeAway, lang)} = ${num(left, lang)}`, format: 'numeric', correct_answer: start,
      operandKey: `miss:subA:${takeAway}:${left}`,
      hint_steps: [
        say(lang, `Something had ${num(takeAway, lang)} taken away and ${num(left, lang)} was left.`,
                  `Bir sayıdan ${num(takeAway, lang)} çıkarılmış, geriye ${num(left, lang)} kalmış.`,
                  `A un número se le quitaron ${num(takeAway, lang)} y quedaron ${num(left, lang)}.`),
        say(lang, `Put the ${num(takeAway, lang)} back: add it to ${num(left, lang)}.`,
                  `Çıkarılan ${num(takeAway, lang)} sayısını geri koy: ${num(left, lang)} ile topla.`,
                  `Devuelve los ${num(takeAway, lang)}: súmalos a ${num(left, lang)}.`),
      ],
    }
  }
  return {
    topic: 'subtraction', level,
    question_text: `${num(start, lang)} − ? = ${num(left, lang)}`, format: 'numeric', correct_answer: takeAway,
    operandKey: `miss:subB:${start}:${left}`,
    hint_steps: [
      say(lang, `How much do you take from ${num(start, lang)} to get down to ${num(left, lang)}?`,
                `${num(start, lang)} sayısından ne kadar çıkarırsan ${num(left, lang)} kalır?`,
                `¿Cuánto hay que quitar a ${num(start, lang)} para llegar a ${num(left, lang)}?`),
      say(lang, `That is the gap between them: count up from ${num(left, lang)} to ${num(start, lang)}.`,
                `Bu, aradaki farktır: ${num(left, lang)} sayısından ${num(start, lang)} sayısına kadar say.`,
                `Es la diferencia entre los dos: cuenta desde ${num(left, lang)} hasta ${num(start, lang)}.`),
    ],
  }
}

// "22 ? 19 = 41": which sign makes it true. Year 2 chooses between + and −; from Year 3 the
// tables are in play, so × and ÷ are offered too — and a question is only asked when exactly
// one sign works.
function missingSign(level, lang, lean) {
  const band = bandForLevel(level)
  // Year 2 names × with its 2, 5 and 10 tables, so it is the third sign there; ÷ joins at Year 3.
  const ops = band <= 2 ? ['+', '−', '×'] : ['+', '−', '×', '÷']
  const calc = (a, o, b) => (o === '+' ? a + b : o === '−' ? a - b : o === '×' ? a * b : (b && a % b === 0 ? a / b : NaN))
  let a, b, o, r
  do {
    // The answer is the topic's own sign — an addition slot asks about +, a subtraction slot
    // about − — and the other signs are the distractors. Otherwise a parent reading "Subtraction"
    // sees a question whose answer is ÷.
    o = lean === 'add' ? '+' : lean === 'sub' ? '−' : pick(ops)
    if (o === '×' || o === '÷') {
      const x = band <= 2 ? pick([2, 5, 10]) : randInt(2, band >= 4 ? 12 : 10), y = randInt(2, band >= 4 ? 12 : 10)
      ;[a, b] = o === '×' ? [x, y] : [x * y, y]
    } else {
      // Never both small enough to count: the help panel draws a countable addition as the
      // sum it is, and this question's sign is the unknown.
      a = randInt(21, band <= 2 ? 60 : 99); b = randInt(band <= 2 ? 3 : 11, band <= 2 ? 30 : 60)
      if (o === '−' && b >= a) a += b
    }
    r = calc(a, o, b)
  } while (!Number.isInteger(r) || r <= 0 || ops.filter(p => calc(a, p, b) === r).length !== 1)
  const why = {
    '+': say(lang, `${a} + ${b} is ${a + b}, not ${r}.`, `${a} + ${b} = ${a + b} eder, ${r} değil.`, `${a} + ${b} son ${a + b}, no ${r}.`),
    '−': say(lang, `${a} − ${b} is ${a - b}, not ${r}.`, `${a} − ${b} = ${a - b} eder, ${r} değil.`, `${a} − ${b} son ${a - b}, no ${r}.`),
    '×': say(lang, `${a} × ${b} is ${a * b}, not ${r}.`, `${a} × ${b} = ${a * b} eder, ${r} değil.`, `${a} × ${b} son ${a * b}, no ${r}.`),
    '÷': say(lang, `${a} ÷ ${b} does not give ${r}.`, `${a} ÷ ${b}, ${r} etmez.`, `${a} ÷ ${b} no da ${r}.`),
  }
  const right = opt(o, say(lang, `Right — ${a} ${o} ${b} = ${r}.`, `Doğru — ${a} ${o} ${b} = ${r}.`, `Correcto: ${a} ${o} ${b} = ${r}.`))
  return {
    topic: lean === 'sub' ? 'subtraction' : 'addition', level,
    question_text: say(lang, `Which sign makes this true? ${a} ? ${b} = ${r}`, `Hangi işaret bunu doğru yapar? ${a} ? ${b} = ${r}`,
                             `¿Qué signo lo hace correcto? ${a} ? ${b} = ${r}`),
    format: 'choice',
    options: ops.map(p => (p === o ? right : opt(p, why[p]))),
    correct_answer: o,
    operandKey: `sign:${a}:${b}:${r}`,
    hint_steps: [
      say(lang, `Is ${r} bigger or smaller than ${a}?`, `${r}, ${a} sayısından büyük mü küçük mü?`, `¿${r} es mayor o menor que ${a}?`),
      say(lang, `Bigger means you added or multiplied; smaller means you took away or divided. Try each one.`,
                `Büyükse topladın ya da çarptın; küçükse çıkardın ya da böldün. Her birini dene.`,
                `Si es mayor, sumaste o multiplicaste; si es menor, restaste o dividiste. Prueba cada uno.`),
    ],
  }
}

// Stories. Both books' word problems are these: a total and a part, a start and what changed,
// two amounts to compare. Each year has its own stories, because the context has to own the
// size of its numbers — strawberries picked in a morning are a Year 2 number, a flight's
// kilometres a Year 4 one, and swapping them is how "a lorry drives 4,213 km on Monday" happens.
function youngStory(level, lang, add) {
  const band = Math.min(Math.max(bandForLevel(level), 2), 4)
  const name = pickL(MULT_NAMES, lang)
  const N = n => num(n, lang)
  const P = (lo, hi) => partitionable(lo, hi, 2)
  const ADD = {
    2: [
      () => { const a = randInt(12, 45), b = P(5, 40); return { a, b, key: 'berries',
        q: say(lang, `${name} picked ${a} strawberries in the morning and ${b} in the afternoon. How many is that altogether?`,
                     `${name} sabah ${a}, öğleden sonra ${b} çilek topladı. Toplam kaç çilek eder?`,
                     `${name} cogió ${a} fresas por la mañana y ${b} por la tarde. ¿Cuántas son en total?`) } },
      () => { const a = randInt(20, 55), b = P(10, 40); return { a, b, key: 'pages',
        q: say(lang, `A book has two parts. The first has ${a} pages and the second has ${b} pages. How many pages is that?`,
                     `Bir kitap iki bölümden oluşuyor. Birinci bölüm ${a}, ikinci bölüm ${b} sayfa. Kitap toplam kaç sayfa?`,
                     `Un libro tiene dos partes. La primera tiene ${a} páginas y la segunda ${b}. ¿Cuántas páginas son?`) } },
      () => { const a = randInt(20, 60), b = P(5, 35); return { a, b, key: 'stickers',
        q: say(lang, `${name} has ${a} stickers and is given ${b} more. How many stickers does ${name} have now?`,
                     `${name} ${a} çıkartması var, ${b} tane daha hediye ediliyor. Şimdi kaç çıkartması var?`,
                     `${name} tiene ${a} pegatinas y le regalan ${b} más. ¿Cuántas tiene ahora?`) } },
    ],
    3: [
      () => { const a = randInt(150, 480), b = P(100, 450); return { a, b, key: 'fair',
        q: say(lang, `${a} people came to the school fair on Saturday and ${b} on Sunday. How many people came altogether?`,
                     `Okul şenliğine cumartesi ${a}, pazar ${b} kişi geldi. Toplam kaç kişi geldi?`,
                     `A la feria del colegio vinieron ${a} personas el sábado y ${b} el domingo. ¿Cuántas vinieron en total?`) } },
      () => { const a = randInt(120, 480), b = P(40, 400); return { a, b, key: 'drive',
        q: say(lang, `A family drives ${a} km on the first day of their holiday and ${b} km on the second. How far is that?`,
                     `Bir aile tatilin ilk günü ${a} km, ikinci günü ${b} km yol gitti. Toplam kaç km eder?`,
                     `Una familia recorre ${a} km el primer día de vacaciones y ${b} km el segundo. ¿Cuántos km son?`) } },
      () => { const a = randInt(74, 480), b = P(20, 300); return { a, b, key: 'collect',
        q: say(lang, `By the age of 8 ${name} had collected ${a} shells. The next year ${name} found ${b} more. How many shells is that now?`,
                     `${name} 8 yaşına kadar ${a} deniz kabuğu topladı. Ertesi yıl ${b} tane daha buldu. Şimdi kaç deniz kabuğu var?`,
                     `A los 8 años ${name} había reunido ${a} conchas. Al año siguiente encontró ${b} más. ¿Cuántas tiene ahora?`) } },
    ],
    4: [
      () => { const a = randInt(1200, 4800), b = P(1000, 4000); return { a, b, key: 'museum',
        q: say(lang, `A museum had ${N(a)} visitors in June and ${N(b)} in July. How many visitors is that altogether?`,
                     `Bir müzeyi haziranda ${N(a)}, temmuzda ${N(b)} kişi ziyaret etti. Toplam kaç ziyaretçi eder?`,
                     `Un museo tuvo ${N(a)} visitantes en junio y ${N(b)} en julio. ¿Cuántos visitantes son en total?`) } },
      () => { const a = randInt(1500, 6000), b = P(200, 3000); return { a, b, key: 'score',
        q: say(lang, `${name} scored ${N(a)} points in a game, then ${N(b)} more in the bonus round. What is the score now?`,
                     `${name} bir oyunda ${N(a)} puan aldı, bonus turunda ${N(b)} puan daha kazandı. Şimdi puanı kaç?`,
                     `${name} consiguió ${N(a)} puntos en un juego y luego ${N(b)} más en la ronda extra. ¿Cuántos puntos tiene ahora?`) } },
      () => { const a = randInt(1500, 5500), b = P(300, 2500); return { a, b, key: 'village',
        q: say(lang, `A town has ${N(a)} people. ${N(b)} more move into new houses. How many people live there now?`,
                     `Bir kasabada ${N(a)} kişi yaşıyor. Yeni evlere ${N(b)} kişi daha taşınıyor. Şimdi kasabada kaç kişi yaşıyor?`,
                     `En un pueblo viven ${N(a)} personas. Llegan ${N(b)} más a casas nuevas. ¿Cuántas personas viven ahora?`) } },
    ],
  }
  const SUB = {
    2: [
      () => { const a = randInt(40, 99), b = P(12, a - 8); return { a, b, key: 'read',
        q: say(lang, `A book has ${a} pages. ${name} has read ${b} of them. How many pages are left to read?`,
                     `Bir kitap ${a} sayfa. ${name} ${b} sayfasını okudu. Okunacak kaç sayfa kaldı?`,
                     `Un libro tiene ${a} páginas. ${name} ha leído ${b}. ¿Cuántas le quedan por leer?`) } },
      () => { const a = 100, b = P(12, 88); return { a, b, key: 'beads',
        q: say(lang, `There are 100 beads in a jar. ${name} uses ${b} of them for a bracelet. How many beads are left?`,
                     `Bir kavanozda 100 boncuk var. ${name} bilezik yapmak için ${b} tanesini kullandı. Kaç boncuk kaldı?`,
                     `En un bote hay 100 cuentas. ${name} usa ${b} para una pulsera. ¿Cuántas quedan?`) } },
      () => { const a = randInt(40, 64), b = randInt(Math.round(a * 0.4), Math.round(a * 0.6)); return { a, b, key: 'classes',
        q: say(lang, `There are ${a} children in Class 1 and Class 2 altogether. ${b} are in Class 1. How many are in Class 2?`,
                     `1. ve 2. sınıfta toplam ${a} çocuk var. ${b} tanesi 1. sınıfta. 2. sınıfta kaç çocuk var?`,
                     `Entre la clase 1 y la clase 2 hay ${a} niños. En la clase 1 hay ${b}. ¿Cuántos hay en la clase 2?`) } },
    ],
    3: [
      () => { const a = randInt(150, 900), b = P(60, a - 40); return { a, b, key: 'journey',
        q: say(lang, `A family drives ${a} km to their holiday. They stop for lunch after ${b} km. How many km are left?`,
                     `Bir aile tatile gitmek için ${a} km yol gidecek. ${b} km sonra öğle yemeği için duruyorlar. Kaç km yol kaldı?`,
                     `Una familia viaja ${a} km hasta su destino. Paran a comer tras ${b} km. ¿Cuántos km les quedan?`) } },
      () => { const a = 1000, b = P(120, 880); return { a, b, key: 'juice',
        q: say(lang, `A bottle holds ${N(1000)} ml of juice. ${b} ml is spilt. How much juice is left in the bottle?`,
                     `Bir şişede ${N(1000)} ml meyve suyu var. ${b} ml döküldü. Şişede kaç ml kaldı?`,
                     `Una botella tiene ${N(1000)} ml de zumo. Se derraman ${b} ml. ¿Cuánto zumo queda?`) } },
      () => { const a = randInt(200, 999), b = P(Math.round(a * 0.25), Math.round(a * 0.75)); return { a, b, key: 'between',
        q: say(lang, `At the age of 8 ${name} had ${b} shells. At 9 ${name} had ${a}. How many were found in between?`,
                     `${name} 8 yaşındayken ${b} deniz kabuğu vardı, 9 yaşında ${a} oldu. Arada kaç tane buldu?`,
                     `A los 8 años ${name} tenía ${b} conchas y a los 9, ${a}. ¿Cuántas encontró entre medias?`) } },
    ],
    4: [
      () => { const a = randInt(2400, 9800), b = P(Math.round(a * 0.2), Math.round(a * 0.8)); return { a, b, key: 'flight',
        q: say(lang, `A flight is ${N(a)} km long. The plane has flown ${N(b)} km so far. How many km are left?`,
                     `Bir uçuş ${N(a)} km. Uçak şimdiye kadar ${N(b)} km uçtu. Kaç km kaldı?`,
                     `Un vuelo es de ${N(a)} km. El avión lleva ${N(b)} km. ¿Cuántos km quedan?`) } },
      () => { const a = pick([5000, 6000, 8000, 9000]), b = P(Math.round(a * 0.3), Math.round(a * 0.9)); return { a, b, key: 'stadium',
        q: say(lang, `A stadium has ${N(a)} seats. ${N(b)} tickets have been sold. How many seats are still free?`,
                     `Bir stadyumda ${N(a)} koltuk var. ${N(b)} bilet satıldı. Kaç koltuk hâlâ boş?`,
                     `Un estadio tiene ${N(a)} asientos. Se han vendido ${N(b)} entradas. ¿Cuántos asientos quedan libres?`) } },
      () => { const a = randInt(3000, 9000), b = P(Math.round(a * 0.3), Math.round(a * 0.8)); return { a, b, key: 'more',
        q: say(lang, `Last year a zoo had ${N(b)} visitors in May. This year it had ${N(a)}. How many more visitors came this year?`,
                     `Geçen yıl mayısta bir hayvanat bahçesine ${N(b)} kişi gelmişti. Bu yıl ${N(a)} kişi geldi. Bu yıl kaç kişi daha fazla geldi?`,
                     `El año pasado un zoo tuvo ${N(b)} visitantes en mayo. Este año tuvo ${N(a)}. ¿Cuántos visitantes más vinieron este año?`) } },
    ],
  }
  const s = pick((add ? ADD : SUB)[band])()
  const ans = add ? s.a + s.b : s.a - s.b
  return {
    topic: add ? 'addition' : 'subtraction', level,
    question_text: s.q, format: 'numeric', correct_answer: ans,
    operandKey: `story:${s.key}:${s.a}:${s.b}`,
    hint_steps: add
      ? [say(lang, `Both amounts go together, so this is an adding question.`, `İki miktar bir araya geliyor, yani bu bir toplama sorusu.`, `Las dos cantidades se juntan: es una suma.`),
         say(lang, `Add ${N(s.a)} and ${N(s.b)} — split the smaller one into its parts if it helps.`,
                   `${N(s.a)} ile ${N(s.b)} sayısını topla — işine yararsa küçük olanı parçalarına ayır.`,
                   `Suma ${N(s.a)} y ${N(s.b)}; si te ayuda, separa el menor en partes.`)]
      : [say(lang, `You know the whole and one part, so take the part away.`, `Bütünü ve bir parçasını biliyorsun, parçayı bütünden çıkar.`, `Conoces el total y una parte: resta la parte.`),
         say(lang, `Work out ${N(s.a)} − ${N(s.b)}, or count up from ${N(s.b)} to ${N(s.a)}.`,
                   `${N(s.a)} − ${N(s.b)} işlemini yap ya da ${N(s.b)} sayısından ${N(s.a)} sayısına kadar say.`,
                   `Calcula ${N(s.a)} − ${N(s.b)}, o cuenta desde ${N(s.b)} hasta ${N(s.a)}.`)],
  }
}

// The mix for Years 2-4. Plain sums keep a share — the fluency still needs practising, and a
// seven-year-old's session gets the counting picture from them — but no longer the whole topic.
function youngAddSub(level, lang, add, columnar) {
  const r = Math.random()
  // Paper keeps the plain written sum: it is the one place the column method can be done.
  if (columnar || r < 0.3) return add ? additionTemplate(level, lang, columnar, true) : subtractionTemplate(level, lang, columnar, true)
  if (r < 0.55) return missingNumber(level, lang, add)
  if (r < 0.7) return missingSign(level, lang, add ? 'add' : 'sub')
  if (r < 0.8 && bandForLevel(level) <= 3) return youngRoute(level, lang, add)
  return youngStory(level, lang, add)
}

// ── multiplication and division, ages 7-9 ─────────────────────────────────────
// A context knows what size its numbers come in: a spider has 8 legs, a week 7 days, a box of
// eggs 6. The multiplier is the year's — its tables at Year 2 and 3, a two- or three-digit
// number at Year 4 ("multiply 2-digit and 3-digit numbers by a 1-digit number").
function tableFor(band) {
  return band <= 2 ? [2, 5, 10] : band === 3 ? [3, 4, 8] : [6, 7, 8, 9, 11, 12]
}

const YOUNG_MULT = [
  { id: 'legs', per: [8], unit: { en: 'legs', tr: 'bacak', es: 'patas' },
    q: (lang, n, per) => say(lang, `A spider has ${per} legs. How many legs do ${n} spiders have?`,
                                   `Bir örümceğin ${per} bacağı var. ${n} örümceğin toplam kaç bacağı vardır?`,
                                   `Una araña tiene ${per} patas. ¿Cuántas patas tienen ${n} arañas?`) },
  { id: 'eggs', per: [2, 3, 4, 5, 6], unit: { en: 'eggs', tr: 'yumurta', es: 'huevos' },
    q: (lang, n, per) => say(lang, `The hens lay ${per} eggs a day. How many eggs do they lay in ${n} days?`,
                                   `Tavuklar günde ${per} yumurta yumurtluyor. ${n} günde kaç yumurta yumurtlarlar?`,
                                   `Las gallinas ponen ${per} huevos al día. ¿Cuántos huevos ponen en ${n} días?`) },
  { id: 'weeks', per: [7], unit: { en: 'days', tr: 'gün', es: 'días' },
    q: (lang, n, per) => say(lang, `There are ${per} days in a week. How many days are there in ${n} weeks?`,
                                   `Bir haftada ${per} gün var. ${n} haftada kaç gün vardır?`,
                                   `Una semana tiene ${per} días. ¿Cuántos días hay en ${n} semanas?`) },
  { id: 'packs', per: [2, 3, 4, 5, 6, 8, 10, 12], unit: { en: 'pens', tr: 'kalem', es: 'bolis' },
    q: (lang, n, per) => say(lang, `Pens come in packs of ${per}. How many pens are in ${n} packs?`,
                                   `Kalemler ${per} tanelik paketlerde satılıyor. ${n} pakette kaç kalem vardır?`,
                                   `Los bolis vienen en paquetes de ${per}. ¿Cuántos bolis hay en ${n} paquetes?`) },
  { id: 'walks', per: [14, 21], unit: { en: 'walks', tr: 'yürüyüş', es: 'paseos' }, band: 4,
    q: (lang, n, per) => say(lang, `A dog goes on ${per} walks a week. How many walks is that in ${n} weeks?`,
                                   `Bir köpek haftada ${per} kez yürüyüşe çıkıyor. ${n} haftada kaç yürüyüş eder?`,
                                   `Un perro sale de paseo ${per} veces a la semana. ¿Cuántos paseos son en ${n} semanas?`) },
  { id: 'class', per: [24, 26, 28, 30, 32], unit: { en: 'children', tr: 'çocuk', es: 'niños' }, band: 4,
    q: (lang, n, per) => say(lang, `A school has ${n} classes with ${per} children in each. How many children is that?`,
                                   `Bir okulda ${n} sınıf var, her sınıfta ${per} çocuk okuyor. Toplam kaç çocuk eder?`,
                                   `Un colegio tiene ${n} clases con ${per} niños en cada una. ¿Cuántos niños son?`) },
  { id: 'pages', per: [125, 150, 175, 216, 248], unit: { en: 'pages', tr: 'sayfa', es: 'páginas' }, band: 4,
    q: (lang, n, per) => say(lang, `Each book in a series has ${per} pages. How many pages are there in ${n} books?`,
                                   `Bir dizideki her kitap ${per} sayfa. ${n} kitapta toplam kaç sayfa vardır?`,
                                   `Cada libro de una colección tiene ${per} páginas. ¿Cuántas páginas hay en ${n} libros?`) },
]

function youngMultStory(level, lang) {
  const band = bandForLevel(level)
  const tables = tableFor(band)
  // Year 2 and 3 multiply inside the year's tables (8 legs is Year 3's 8 times table); the
  // Year 4 contexts are the two- and three-digit ones, and every context is open to Year 4.
  const pool = YOUNG_MULT.flatMap(c => {
    const pers = band >= 4 ? c.per : c.band ? [] : c.per.filter(p => tables.includes(p))
    return pers.length ? [{ c, pers }] : []
  })
  const { c, pers } = pick(pool)
  const per = pick(pers)
  const n = band <= 2 ? randInt(2, 10)
    : band === 3 ? (Math.random() < 0.5 ? randInt(2, 10) : randInt(11, 25))
      : per >= 100 ? randInt(2, 6) : per > 12 ? randInt(3, 9) : randInt(3, 12)
  return {
    topic: 'multiplication-word', level,
    question_text: c.q(lang, n, per), format: 'numeric', correct_answer: n * per,
    operandKey: `ymult:${c.id}:${n}:${per}`,
    hint_steps: [
      say(lang, `That is ${n} groups of ${per}: ${n} × ${per}.`, `Bu, ${per} tanelik ${n} grup demek: ${n} × ${per}.`,
                `Son ${n} grupos de ${per}: ${n} × ${per}.`),
      n > 12 || per > 12
        ? multSplitHint(n, per, lang)
        : say(lang, `Count up in ${per}s, ${n} times.`, `${trDist(per)} ${trDist(per)} ${n} kez say.`, `Cuenta de ${per} en ${per}, ${n} veces.`),
    ],
  }
}

// "56 = ? × 8", "? × 7 = 63" — the table read backwards, which is where division begins.
function missingFactor(level, lang) {
  const band = bandForLevel(level)
  const t = pick(tableFor(band))
  const k = randInt(2, 12)
  const p = t * k
  const shape = randInt(0, 2)
  const q = shape === 0 ? `? × ${t} = ${p}` : shape === 1 ? `${t} × ? = ${p}` : `${p} = ? × ${t}`
  return {
    topic: 'multiplication-word', level, question_text: q, format: 'numeric', correct_answer: k,
    operandKey: `mfac:${t}:${k}`,
    hint_steps: [
      say(lang, `Which number in the ${t} times table makes ${p}?`, `${t} çarpım tablosunda hangi sayı ${p} eder?`,
                `¿Qué número de la tabla del ${t} da ${p}?`),
      say(lang, `Count up in ${t}s until you reach ${p}, and count how many steps it took.`,
                `${p} sayısına ulaşana kadar ${trDist(t)} ${trDist(t)} say ve kaç adım attığını say.`,
                `Cuenta de ${t} en ${t} hasta llegar a ${p} y cuenta cuántos saltos has dado.`),
    ],
  }
}

// "Which of these is a factor pair for 63?" — Year 4, 10 Minute Tests 8-9, test 5.
function factorPair(level, lang) {
  const a = randInt(3, 9), b = randInt(3, 9)
  const p = a * b
  const right = opt(`${a} × ${b}`, say(lang, `Right — ${a} × ${b} = ${p}.`, `Doğru — ${a} × ${b} = ${p}.`, `Correcto: ${a} × ${b} = ${p}.`))
  const wrongs = [[a + 1, b], [a, b - 1], [a + 2, b - 1], [a - 1, b + 1], [a + b, 1 + 1]]
    .filter(([x, y]) => x > 1 && y > 1 && x * y !== p)
    .map(([x, y]) => opt(`${x} × ${y}`, say(lang, `${x} × ${y} = ${x * y}, not ${p}.`, `${x} × ${y} = ${x * y} eder, ${p} değil.`, `${x} × ${y} = ${x * y}, no ${p}.`)))
  return {
    topic: 'multiplication-word', level,
    question_text: say(lang, `Which of these multiplies to make ${p}?`, `Bunlardan hangisinin sonucu ${p} eder?`, `¿Cuál de estas multiplicaciones da ${p}?`),
    format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value,
    operandKey: `fpair:${p}:${Math.min(a, b)}`,
    hint_steps: [
      say(lang, `Work out each one in turn.`, `Her birini sırayla hesapla.`, `Calcula cada una por turnos.`),
      say(lang, `Only one of them lands exactly on ${p}.`, `Yalnız biri tam olarak ${p} eder.`, `Solo una da exactamente ${p}.`),
    ],
  }
}

function youngMultiplication(level, lang) {
  const band = bandForLevel(level)
  const r = Math.random()
  // Year 2 keeps the drawn groups and arrays for half its questions: at seven the picture is
  // the method.
  if (band <= 2) return r < 0.5 ? null : r < 0.8 ? youngMultStory(level, lang) : missingFactor(level, lang)
  if (r < 0.2) return null
  if (r < 0.65) return youngMultStory(level, lang)
  if (band >= 4 && r < 0.8) return factorPair(level, lang)
  return missingFactor(level, lang)
}

// Division for ages 7-9: sharing (the existing picture), grouping ("how many 6s in 24?"),
// and from Year 3 the remainder — both books' own examples: "30 children, 4 in a car, how
// many cars?" rounds up; "37 eggs, boxes of 6, how many full boxes?" rounds down.
const YOUNG_DIV_UP = [
  { need: ['a car', 'bir araba', 'un coche'],
    q: (lang, n, d) => say(lang, `${n} children are going on a trip. Each car can take ${d} children. How many cars are needed?`,
                                 `${n} çocuk geziye gidiyor. Her arabaya ${d} çocuk sığıyor. Kaç araba gerekir?`,
                                 `${n} niños van de excursión. En cada coche caben ${d} niños. ¿Cuántos coches hacen falta?`) },
  { need: ['a box', 'bir kutu', 'una caja'],
    q: (lang, n, d) => say(lang, `I have ${n} eggs. An egg box holds ${d}. How many boxes do I need to hold all the eggs?`,
                                 `${n} yumurtam var. Bir kutuya ${d} yumurta sığıyor. Bütün yumurtalar için kaç kutu gerekir?`,
                                 `Tengo ${n} huevos. En una caja caben ${d}. ¿Cuántas cajas necesito para todos?`) },
  { need: ['a table', 'bir masa', 'una mesa'],
    q: (lang, n, d) => say(lang, `${n} guests are coming to dinner. Each table seats ${d}. How many tables are needed?`,
                                 `Akşam yemeğine ${n} misafir geliyor. Her masada ${d} kişi oturabiliyor. Kaç masa gerekir?`,
                                 `Vienen ${n} invitados a cenar. En cada mesa caben ${d}. ¿Cuántas mesas hacen falta?`) },
]
const YOUNG_DIV_DOWN = [
  { q: (lang, n, d) => say(lang, `I have ${n} eggs. An egg box holds ${d}. How many boxes can I fill completely?`,
                                 `${n} yumurtam var. Bir kutuya ${d} yumurta sığıyor. Kaç kutuyu tamamen doldurabilirim?`,
                                 `Tengo ${n} huevos. En una caja caben ${d}. ¿Cuántas cajas puedo llenar del todo?`) },
  { money: true,
    q: (lang, n, d) => say(lang, `I have $${n}. Cinema tickets cost $${d} each. How many tickets can I buy?`,
                                 `${n} liram var. Sinema biletinin tanesi ${d} lira. En fazla kaç bilet alabilirim?`,
                                 `Tengo ${n} euros. Cada entrada de cine cuesta ${d} euros. ¿Cuántas entradas puedo comprar?`) },
  { q: (lang, n, d) => say(lang, `A packet of ${n} biscuits is shared out, ${d} to each child. How many children get ${d} biscuits?`,
                                 `${n} bisküvilik bir paket, her çocuğa ${d} tane olacak şekilde dağıtılıyor. Kaç çocuk ${d} bisküvi alır?`,
                                 `Hay un paquete de ${n} galletas y cada niño recibe ${d}. ¿Cuántos niños reciben ${d} galletas?`) },
]

function youngDivision(level, lang) {
  const band = bandForLevel(level)
  const tables = tableFor(band)
  const r = Math.random()
  if (band <= 2) {
    if (r < 0.55) return null
    // grouping: "How many 5s are there in 30?"
    const d = pick(tables), k = randInt(3, 10)
    return {
      topic: 'division-word', level,
      question_text: say(lang, `How many ${d}s are there in ${d * k}?`, `${d * k} sayısında kaç tane ${d} vardır?`, `¿Cuántas veces cabe el ${d} en ${d * k}?`),
      format: 'numeric', correct_answer: k, operandKey: `ygroup:${d}:${k}`,
      hint_steps: [
        say(lang, `Count up in ${d}s until you reach ${d * k}.`, `${d * k} sayısına ulaşana kadar ${trDist(d)} ${trDist(d)} say.`, `Cuenta de ${d} en ${d} hasta llegar a ${d * k}.`),
        say(lang, `The number of jumps is the answer.`, `Kaç kez saydığın cevaptır.`, `El número de saltos es la respuesta.`),
      ],
    }
  }
  // Year 4 divides two- and three-digit numbers ("98 children in 7 groups"); the picture of
  // dealing out dots is past its size, so Year 4's exact share is written, not drawn.
  if (band >= 4 && r < 0.3) {
    const d = pick([3, 4, 6, 7, 8, 9]), q = randInt(12, 45), n = d * q
    const c = pick([
      { en: `On sports day ${n} children are split into ${d} equal teams. How many children are in each team?`,
        tr: `Spor gününde ${n} çocuk ${d} eşit takıma ayrılıyor. Her takımda kaç çocuk olur?`,
        es: `En el día del deporte, ${n} niños se reparten en ${d} equipos iguales. ¿Cuántos niños hay en cada equipo?` },
      { en: `${n} kg of apples are packed equally into ${d} crates. How many kg go in each crate?`,
        tr: `${n} kg elma ${d} kasaya eşit olarak konuyor. Her kasaya kaç kg düşer?`,
        es: `Se reparten ${n} kg de manzanas a partes iguales en ${d} cajas. ¿Cuántos kg van en cada caja?` },
    ])
    return {
      topic: 'division-word', level, question_text: say(lang, c.en, c.tr, c.es), format: 'numeric', correct_answer: q,
      operandKey: `ybig:${n}:${d}`,
      hint_steps: [
        say(lang, `Split ${n} into a part that divides easily by ${d} and the rest: ${d * 10} is 10 lots of ${d}.`,
                  `${n} sayısını ${d} ile kolay bölünen bir parça ve kalanı diye ayır: ${d * 10}, ${d} sayısının 10 katıdır.`,
                  `Separa ${n} en una parte fácil de dividir entre ${d} y el resto: ${d * 10} son 10 veces ${d}.`),
        say(lang, `Divide each part by ${d} and add the two answers.`, `Her parçayı ${d} ile böl ve iki sonucu topla.`, `Divide cada parte entre ${d} y suma los dos resultados.`),
      ],
    }
  }
  if (r < 0.3) return null
  const d = band === 3 ? pick([3, 4, 5, 6, 8]) : pick([4, 6, 7, 8, 9])
  if (r < 0.5) {
    // "Find the remainder: 69 ÷ 8 = 8 r ?" — answer the remainder
    const q = randInt(3, band === 3 ? 10 : 12), rem = randInt(1, d - 1), n = q * d + rem
    return {
      topic: 'division-word', level,
      question_text: say(lang, `What is the remainder? ${n} ÷ ${d} = ${q} r ?`, `Kalan kaçtır? ${n} ÷ ${d} = ${q} kalan ?`,
                               `¿Cuál es el resto? ${n} ÷ ${d} = ${q} y resto ?`),
      format: 'numeric', correct_answer: rem, operandKey: `yrem:${n}:${d}`,
      hint_steps: [
        say(lang, `${q} lots of ${d} is ${q} × ${d}.`, `${q} tane ${d}, ${q} × ${d} eder.`, `${q} veces ${d} es ${q} × ${d}.`),
        say(lang, `What is left of ${n} after that?`, `Bundan sonra ${n} sayısından geriye ne kalır?`, `¿Qué queda de ${n} después de eso?`),
      ],
    }
  }
  const up = r < 0.75
  const q = randInt(3, band === 3 ? 9 : 12), rem = randInt(1, d - 1), n = q * d + rem
  const c = up ? pick(YOUNG_DIV_UP) : pick(YOUNG_DIV_DOWN)
  return {
    topic: 'division-word', level,
    question_text: c.q(lang, n, d), format: 'numeric', correct_answer: up ? q + 1 : q,
    operandKey: `yround:${up ? 'u' : 'd'}:${n}:${d}`,
    hint_steps: [
      say(lang, `${n} ÷ ${d} = ${q} remainder ${rem}.`, `${n} ÷ ${d} = ${q}, kalan ${rem}.`, `${n} ÷ ${d} = ${q} y sobran ${rem}.`),
      up
        ? say(lang, `The ${rem} left over still need ${c.need[0]}.`, `Artan ${rem} için de ${c.need[1]} gerekir.`, `Los ${rem} que sobran también necesitan ${c.need[2]}.`)
        : say(lang, `The ${rem} left over are not enough for another one.`, `Artan ${rem}, bir tane daha için yetmez.`, `Los ${rem} que sobran no llegan para otro.`),
    ],
  }
}

// ── fractions of a shape ──────────────────────────────────────────────────────
// "What fraction of this shape is shaded?" — the most common fraction question in both books,
// and the one a sentence cannot ask. Year 1 halves and quarters; Year 2 thirds and three
// quarters; Year 3 up to tenths; Year 4 asks for the EQUAL fraction ("which is the same as the
// shaded part?"), the step from counting parts to equivalence.
function gcd(a, b) { return b ? gcd(b, a % b) : a }

function fractionShaded(level, lang) {
  const band = bandForLevel(level)
  const menu = band <= 1 ? [[1, 2], [1, 4]]
    : band === 2 ? [[1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [2, 3]]
      : band === 3 ? [[1, 5], [2, 5], [3, 5], [3, 8], [5, 8], [7, 10], [3, 10], [4, 6], [5, 6], [2, 3], [3, 4]]
        : [[2, 4], [4, 8], [6, 8], [2, 6], [4, 6], [2, 8], [6, 10], [4, 10], [8, 10], [3, 6], [9, 12]]
  const [n, d] = pick(menu)
  // Circles cut into more than eight read as a fan; they are kept to the small denominators.
  const shape = d <= 8 && Math.random() < 0.4 ? 'circle' : d % 2 === 0 && d >= 6 && Math.random() < 0.6 ? 'grid' : 'bar'
  const cols = shape === 'grid' ? (d === 6 ? 3 : d === 12 ? 4 : d / 2) : d
  // Shaded parts are not always the first ones in a row: "the first n" makes it a count of a
  // run, not of the parts.
  const shaded = shuffle(Array.from({ length: d }, (_, i) => i)).slice(0, n).sort((a, b) => a - b)
  const askWhite = band >= 2 && band <= 3 && Math.random() < 0.3
  const k = askWhite ? d - n : n
  const g = gcd(k, d)
  const equalMode = band >= 4
  const answer = equalMode ? `${k / g}/${d / g}` : `${k}/${d}`
  const why = {
    swap: v => say(lang, `${v} compares the two colours — the bottom number counts ALL the parts.`,
                         `${v} iki rengi birbiriyle karşılaştırır — alttaki sayı BÜTÜN parçaları sayar.`,
                         `${v} compara los dos colores; el número de abajo cuenta TODAS las partes.`),
    other: v => say(lang, `${v} is the other colour.`, `${v} öbür rengin kesri.`, `${v} es el otro color.`),
    near: v => say(lang, `Count the parts again — ${v} is not what the picture shows.`, `Parçaları yeniden say — resim ${v} göstermiyor.`,
                         `Vuelve a contar las partes: el dibujo no muestra ${v}.`),
    notEqual: v => say(lang, `${v} is not the same amount — check by making both bottoms the same.`,
                             `${v} aynı miktar değil — iki kesrin paydasını eşitleyerek kontrol et.`,
                             `${v} no es la misma cantidad: compruébalo igualando los denominadores.`),
  }
  const right = opt(answer, say(lang, `Right — ${k} of the ${d} equal parts.`, `Doğru — ${d} eş parçanın ${k} tanesi.`, `Correcto: ${k} de las ${d} partes iguales.`))
  const wrongs = equalMode
    ? [[k / g + 1, d / g], [k / g, d / g + 1], [d - k, d], [k / g, d], [1, d / g]].filter(([x, y]) => x > 0 && x < y && x * d !== k * y)
      .map(([x, y]) => opt(`${x}/${y}`, why.notEqual(`${x}/${y}`)))
    : [[k, d - k, why.swap], [d - k, d, why.other], [k, d + 1, why.near], [k + 1, d, why.near], [k - 1, d, why.near],
       [k, d * 2, why.near], [k, d - 1, why.near]]
      // A wrong option must be a proper fraction and must not be EQUAL to the answer: 2/4
      // offered against 1/2 would be a second right answer.
      .filter(([x, y]) => x >= 1 && y >= 2 && x < y && x * d !== k * y)
      .map(([x, y, w]) => opt(`${x}/${y}`, w(`${x}/${y}`)))
  const q = equalMode
    ? say(lang, 'Which fraction is equal to the shaded part?', 'Hangi kesir taralı kısma eşittir?', '¿Qué fracción es igual a la parte coloreada?')
    : askWhite
      ? say(lang, 'What fraction of this shape is NOT shaded?', 'Bu şeklin ne kadarı boyalı DEĞİL?', '¿Qué fracción de la figura NO está coloreada?')
      : say(lang, 'What fraction of this shape is shaded?', 'Bu şeklin ne kadarı boyalı?', '¿Qué fracción de la figura está coloreada?')
  return {
    topic: 'fraction-of-number', level, question_text: q, format: 'choice',
    options: choiceOf(right, wrongs), correct_answer: answer,
    operandKey: `fshade:${n}/${d}:${askWhite ? 'w' : 's'}:${shape}`,
    hint_steps: [
      say(lang, `Count all the equal parts — that is the bottom number.`, `Bütün eş parçaları say — bu alttaki sayıdır.`,
                `Cuenta todas las partes iguales: ese es el número de abajo.`),
      equalMode
        ? say(lang, `Now see if the shaded parts can be grouped evenly into bigger pieces.`, `Şimdi boyalı parçaları eşit büyük gruplara toplayabilir misin, bak.`,
                    `Ahora mira si las partes coloreadas se pueden agrupar en trozos más grandes iguales.`)
        : say(lang, `Then count the ${askWhite ? 'white' : 'shaded'} parts — that is the top number.`,
                    `Sonra ${askWhite ? 'boyasız' : 'boyalı'} parçaları say — bu üstteki sayıdır.`,
                    `Luego cuenta las partes ${askWhite ? 'blancas' : 'coloreadas'}: ese es el número de arriba.`),
    ],
    visual: { kind: 'fraction', shape, parts: d, cols, shaded },
  }
}

// ── reading a scale ───────────────────────────────────────────────────────────
// The ruler, the jug, the kitchen scales and the thermometer are on almost every page of both
// books, and a scale's difficulty is its MARKINGS, not its numbers: a jug marked every 100 ml
// read at 600 is Year 2; the same jug marked every 50 read at 350 is Year 3. Each spec below
// lands its reading on a mark so there is exactly one answer.
function scaleReading(level, lang, types) {
  const band = bandForLevel(level)
  const type = pick(types)
  let v, q, unit, hint
  if (type === 'ruler') {
    const half = band >= 3 && Math.random() < 0.5
    const max = band <= 1 ? 10 : 12
    const value = half ? randInt(3, max - 1) + 0.5 : randInt(3, max)
    v = { kind: 'scale', type, max, value, minor: band >= 2 ? 0.5 : 1 }
    q = say(lang, 'How long is the pencil, in cm?', 'Kalem kaç cm uzunluğunda?', '¿Cuántos cm mide el lápiz?')
    hint = say(lang, `The pencil starts at 0. Find the number under its point.`, `Kalem 0'dan başlıyor. Ucunun altındaki sayıyı bul.`,
                     `El lápiz empieza en el 0. Busca el número que hay bajo su punta.`)
    unit = half ? say(lang, `The small marks are half centimetres.`, `Küçük çizgiler yarım santimetredir.`, `Las marcas pequeñas son medios centímetros.`) : null
  } else if (type === 'jug') {
    const spec = band <= 2 ? pick([{ max: 1000, major: 200, minor: 100 }, { max: 500, major: 100, minor: 100 }])
      : pick([{ max: 1000, major: 200, minor: 50 }, { max: 1000, major: 250, minor: 50 }, { max: 500, major: 100, minor: 25 }])
    const steps = spec.max / spec.minor
    const value = randInt(2, steps - 1) * spec.minor
    v = { kind: 'scale', type, ...spec, value, unit: 'ml' }
    q = say(lang, 'How much water is in the jug, in ml?', 'Sürahide kaç ml su var?', '¿Cuántos ml de agua hay en la jarra?')
    hint = say(lang, `Find the numbered line just below the water, then count the small marks up to the top of the water.`,
                     `Suyun hemen altındaki numaralı çizgiyi bul, sonra suyun üstüne kadar küçük çizgileri say.`,
                     `Busca la línea numerada justo debajo del agua y cuenta las marcas pequeñas hasta arriba.`)
    unit = say(lang, `Each small mark here is ${spec.minor} ml.`, `Buradaki her küçük çizgi ${spec.minor} ml.`, `Aquí cada marca pequeña es ${spec.minor} ml.`)
  } else if (type === 'thermo') {
    const spec = band <= 2 ? { min: 0, max: 40, major: 10, minor: 5 } : pick([{ min: 0, max: 40, major: 10, minor: 2 }, { min: 0, max: 50, major: 10, minor: 5 }])
    const value = randInt(2, (spec.max - spec.min) / spec.minor - 1) * spec.minor + spec.min
    v = { kind: 'scale', type, ...spec, value }
    q = say(lang, 'What temperature does the thermometer show, in °C?', 'Termometre kaç °C gösteriyor?', '¿Qué temperatura marca el termómetro, en °C?')
    hint = say(lang, `Find the top of the red line and read across to the numbers.`, `Kırmızı çizginin en üstünü bul ve yandaki sayılara bak.`,
                     `Busca el final de la línea roja y mira los números de al lado.`)
    unit = say(lang, `Between two numbers, each mark is ${spec.minor} degrees.`, `İki sayı arasında her çizgi ${spec.minor} derece.`, `Entre dos números, cada marca son ${spec.minor} grados.`)
  } else if (type === 'dial') {
    const spec = pick([{ max: 1000, major: 200, minor: 50, unit: 'g' }, { max: 5, major: 1, minor: 0.5, unit: 'kg' }, { max: 100, major: 20, minor: 5, unit: 'kg' }])
    const steps = spec.max / spec.minor
    // Never on the first mark: the hint names what one mark is worth.
    const value = Math.round(randInt(2, steps - 1) * spec.minor * 1000) / 1000
    v = { kind: 'scale', type, ...spec, value }
    q = say(lang, `How much does it weigh, in ${spec.unit}?`, `Kaç ${spec.unit} geliyor?`, `¿Cuánto pesa, en ${spec.unit}?`)
    hint = say(lang, `Start at 0 at the top and follow the numbers round to the pointer.`, `Tepedeki 0'dan başla, sayıları ibreye kadar takip et.`,
                     `Empieza en el 0 de arriba y sigue los números hasta la aguja.`)
    unit = say(lang, `Each small mark is ${dnum(spec.minor, lang)} ${spec.unit}.`, `Her küçük çizgi ${dnum(spec.minor, lang)} ${spec.unit}.`, `Cada marca pequeña es ${dnum(spec.minor, lang)} ${spec.unit}.`)
  } else {
    // A number line labelled at its ends only: count the steps. Year 2 in tens to 100, Year 3
    // in hundreds to 1,000 or tens inside a hundred, Year 4 in tens between two hundreds
    // ("2300 … 2400") and tenths between two whole numbers.
    const spec = band <= 2 ? { min: 0, max: 100, minor: 10 }
      : band === 3 ? pick([{ min: 0, max: 1000, minor: 100 }, { min: 200, max: 300, minor: 10 }, { min: 0, max: 50, minor: 5 }])
        : pick([(() => { const h = randInt(12, 89) * 100; return { min: h, max: h + 100, minor: 10 } })(), (() => { const w = randInt(1, 8); return { min: w, max: w + 1, minor: 0.1 } })(), { min: 0, max: 1000, minor: 50 }])
    const steps = Math.round((spec.max - spec.min) / spec.minor)
    const value = Math.round((spec.min + randInt(1, steps - 1) * spec.minor) * 10) / 10
    v = { kind: 'scale', type: 'line', ...spec, value }
    q = say(lang, 'What number is the arrow pointing to?', 'Ok hangi sayıyı gösteriyor?', '¿A qué número apunta la flecha?')
    hint = say(lang, `Work out how much each small step is worth: the gap between the two ends, shared by the number of steps.`,
                     `Önce her küçük adımın kaç ettiğini bul: iki uç arasındaki farkı adım sayısına böl.`,
                     `Averigua cuánto vale cada paso pequeño: la distancia entre los dos extremos entre el número de pasos.`)
    unit = say(lang, `Then count the steps from ${label0(spec.min, lang)} to the arrow.`, `Sonra ${label0(spec.min, lang)} sayısından oka kadar adımları say.`,
                     `Luego cuenta los pasos desde ${label0(spec.min, lang)} hasta la flecha.`)
  }
  const answer = v.value
  return {
    topic: type === 'line' ? 'place-value' : 'measurement', level,
    question_text: q,
    format: Number.isInteger(answer) ? 'numeric' : 'decimal',
    correct_answer: answer,
    operandKey: `scale:${type}:${v.max}:${v.minor}:${answer}`,
    hint_steps: [hint, ...(unit ? [unit] : [])],
    visual: v,
  }
}
const label0 = (n, lang) => (Number.isInteger(n) ? num(n, lang) : dnum(n, lang))

// ── time, ages 7-9 ────────────────────────────────────────────────────────────
// Every time question the books ask that is not "read the clock": what time it will be, how
// long something took, a timetable, a watch that is fast. The answer is a time, which the
// keypad cannot type, so those are offered as choices — and the wrong choices are the real
// mistakes: going the wrong way, adding to the hour, forgetting that 60 minutes make an hour.
function timeYoung(level, lang) {
  const band = bandForLevel(level)
  const pad = band >= 3
  const name = pickL(MULT_NAMES, lang)
  const shape = pick(band <= 2 ? ['after', 'between', 'quarter'] : ['after', 'between', 'before', 'watch', 'timetable'])
  const start = (randInt(7, 17) * 60) + randInt(0, 11) * 5 + (band >= 3 ? randInt(0, 4) : 0)

  if (shape === 'quarter') {
    const [q, a] = pick([
      [say(lang, 'How many minutes are there in a quarter of an hour?', 'Çeyrek saat kaç dakikadır?', '¿Cuántos minutos hay en un cuarto de hora?'), 15],
      [say(lang, 'How many minutes are there in half an hour?', 'Yarım saat kaç dakikadır?', '¿Cuántos minutos hay en media hora?'), 30],
      [say(lang, 'How many minutes are there in three quarters of an hour?', 'Üç çeyrek saat kaç dakikadır?', '¿Cuántos minutos hay en tres cuartos de hora?'), 45],
      [say(lang, 'How many hours are there in a day?', 'Bir günde kaç saat vardır?', '¿Cuántas horas tiene un día?'), 24],
      [say(lang, 'How many days are there in a week?', 'Bir haftada kaç gün vardır?', '¿Cuántos días tiene una semana?'), 7],
    ])
    return { topic: 'time', level, question_text: q, format: 'numeric', correct_answer: a, operandKey: `tq:${a}`,
      hint_steps: [say(lang, 'A whole hour is 60 minutes.', 'Bir tam saat 60 dakikadır.', 'Una hora entera son 60 minutos.'),
                   say(lang, 'Half of it, or a quarter of it, is the same share of 60.', 'Yarısı ya da çeyreği, 60\'ın o kadarıdır.', 'La mitad o un cuarto son esa parte de 60.')] }
  }

  if (shape === 'after' || shape === 'before') {
    const add = band <= 2 ? randInt(2, 8) * 5 : randInt(12, 55)
    const after = shape === 'after'
    const answer = after ? start + add : start - add
    const crosses = Math.floor(start / 60) !== Math.floor(answer / 60)
    const why = {
      wrongWay: say(lang, 'That goes the wrong way in time.', 'Bu, zamanda ters yöne gidiyor.', 'Eso va hacia atrás en el tiempo.'),
      carry: crosses
        ? say(lang, 'The minutes went past the hour, so the hour changes too.', 'Dakikalar saati geçti, o yüzden saat de değişir.', 'Los minutos pasan de la hora, así que la hora también cambia.')
        : say(lang, 'The minutes stay inside the hour here — the hour does not change.', 'Burada dakikalar saati geçmiyor — saat değişmez.', 'Aquí los minutos no pasan de la hora: la hora no cambia.'),
      off: say(lang, 'Close, but count the minutes again.', 'Yakın, ama dakikaları yeniden say.', 'Cerca, pero vuelve a contar los minutos.'),
    }
    const right = opt(hm(answer, pad), say(lang, 'Right.', 'Doğru.', 'Correcto.'))
    const wrongs = [
      opt(hm(after ? start - add : start + add, pad), why.wrongWay),
      opt(hm(crosses ? answer + (after ? -60 : 60) : answer + (after ? 60 : -60), pad), why.carry),
      opt(hm(answer + (after ? 5 : -5) * (band <= 2 ? 1 : 2), pad), why.off),
      opt(hm(answer - (after ? 5 : -5) * (band <= 2 ? 1 : 2), pad), why.off),
    ]
    const task = pick([
      { en: 'walk to school', tr: 'okula yürümeye', es: 'ir andando al colegio' },
      { en: 'bake a cake', tr: 'kek pişirmeye', es: 'hornear un bizcocho' },
      { en: 'do some homework', tr: 'ödev yapmaya', es: 'hacer los deberes' },
    ])
    return {
      topic: 'time', level,
      question_text: after
        ? say(lang, `${name} starts to ${task.en} at the time shown. It takes ${add} minutes. What time does ${name} finish?`,
                    `${name} gösterilen saatte ${task.tr} başlıyor. Bu ${add} dakika sürüyor. ${name} saat kaçta bitirir?`,
                    `${name} empieza a ${task.es} a la hora que se ve. Tarda ${add} minutos. ¿A qué hora termina?`)
        : say(lang, `A lesson finished at the time shown. It lasted ${add} minutes. What time did it start?`,
                    `Bir ders gösterilen saatte bitti. Ders ${add} dakika sürdü. Ders saat kaçta başladı?`,
                    `Una clase terminó a la hora que se ve. Duró ${add} minutos. ¿A qué hora empezó?`),
      format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value,
      operandKey: `t${shape}:${start}:${add}`,
      hint_steps: [
        say(lang, `Count ${after ? 'on' : 'back'} to the o'clock first.`, `Önce ${after ? 'ileri' : 'geri'} doğru tam saate kadar say.`,
                  `Cuenta primero ${after ? 'hacia delante' : 'hacia atrás'} hasta la hora en punto.`),
        say(lang, `Then ${after ? 'add' : 'take away'} whatever is left of the ${add} minutes.`, `Sonra ${add} dakikadan kalanı ${after ? 'ekle' : 'çıkar'}.`,
                  `Luego ${after ? 'suma' : 'resta'} lo que quede de los ${add} minutos.`),
      ],
      visual: { kind: 'digital', times: [hm(start, pad)] },
    }
  }

  if (shape === 'between') {
    const len = band <= 2 ? randInt(2, 11) * 5 : randInt(15, 95)
    // Never from an o'clock: from 9:00 the end time's minutes ARE the answer, and the hint that
    // names the end time would be naming it.
    const from = start % 60 === 0 ? start + 5 : start
    const end = from + len
    const start_ = from
    return {
      topic: 'time', level,
      question_text: say(lang, `How many minutes are there between these two times?`, `Bu iki saat arasında kaç dakika var?`, `¿Cuántos minutos hay entre estas dos horas?`),
      format: 'numeric', correct_answer: len, operandKey: `tbetween:${start_}:${len}`,
      hint_steps: [
        say(lang, `Count on from ${hm(start_, pad)} to the next o'clock.`, `${hm(start_, pad)} saatinden bir sonraki tam saate kadar say.`, `Cuenta desde las ${hm(start_, pad)} hasta la siguiente hora en punto.`),
        say(lang, `Then count on to ${hm(end, pad)} and add the two parts.`, `Sonra ${hm(end, pad)} saatine kadar say ve iki parçayı topla.`, `Luego sigue hasta las ${hm(end, pad)} y suma las dos partes.`),
      ],
      visual: { kind: 'digital', times: [hm(start_, pad), hm(end, pad)] },
    }
  }

  if (shape === 'watch') {
    const off = pick([5, 10, 15])
    const fast = Math.random() < 0.5
    const shown = start
    const real = fast ? shown - off : shown + off
    const right = opt(hm(real, pad), say(lang, 'Right.', 'Doğru.', 'Correcto.'))
    const wrongs = [opt(hm(fast ? shown + off : shown - off, pad), say(lang, `A ${fast ? 'fast' : 'slow'} watch is ${fast ? 'ahead of' : 'behind'} the real time, so go the other way.`,
      `${fast ? 'İleri' : 'Geri'} kalan saat gerçek saatin ${fast ? 'önündedir' : 'gerisindedir'}, öbür yöne git.`,
      `Un reloj que ${fast ? 'adelanta' : 'atrasa'} va ${fast ? 'por delante' : 'por detrás'} de la hora real: ve al revés.`)),
      opt(hm(shown, pad), say(lang, `That is what the watch says, not the real time.`, `Bu, saatin gösterdiği; gerçek saat değil.`, `Eso es lo que marca el reloj, no la hora real.`)),
      opt(hm(real + (fast ? -5 : 5), pad), say(lang, 'Close, but count the minutes again.', 'Yakın, ama dakikaları yeniden say.', 'Cerca, pero vuelve a contar los minutos.'))]
    return {
      topic: 'time', level,
      question_text: say(lang, `${name}'s watch is ${off} minutes ${fast ? 'fast' : 'slow'}. It shows the time here. What is the real time?`,
                               `${name} adlı çocuğun saati ${off} dakika ${fast ? 'ileri' : 'geri'}. Saat burada gösterilen zamanı gösteriyor. Gerçek saat kaç?`,
                               `El reloj de ${name} ${fast ? 'adelanta' : 'atrasa'} ${off} minutos. Marca la hora de aquí. ¿Qué hora es de verdad?`),
      format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `twatch:${shown}:${off}:${fast}`,
      hint_steps: [
        say(lang, `A fast watch shows a time that has not happened yet; a slow one is behind.`, `İleri olan saat henüz gelmemiş bir zamanı gösterir; geri olan saat geride kalır.`, `Un reloj que adelanta marca una hora que aún no ha llegado; uno que atrasa va por detrás.`),
        say(lang, `So ${fast ? 'take' : 'add'} ${off} minutes ${fast ? 'off' : 'on'}.`, `O zaman ${off} dakika ${fast ? 'çıkar' : 'ekle'}.`, `Así que ${fast ? 'quita' : 'suma'} ${off} minutos.`),
      ],
      visual: { kind: 'digital', times: [hm(shown, pad)] },
    }
  }

  // timetable: four trains, how long does one take
  // Trains leave in order and arrive in order — a later train overtaking an earlier one is a
  // timetable no one has seen, and it makes a child doubt the reading they just did.
  let trains
  do {
    trains = Array.from({ length: 4 }, (_, i) => ({ leave: (8 + i) * 60 + randInt(0, 11) * 5, take: randInt(4, 13) * 5 }))
  } while (trains.some((tr, i) => i > 0 && tr.leave + tr.take <= trains[i - 1].leave + trains[i - 1].take))
  const k = randInt(0, 3)
  const place = pickL({ en: [['Rigby', 'Stairs'], ['Oakley', 'Hilton']], tr: [['Kavaklı', 'Ilıca'], ['Çamlık', 'Pınarbaşı']], es: [['Robledo', 'Sierra'], ['Olmos', 'Fuentes']] }, lang)
  const letters = ['A', 'B', 'C', 'D']
  return {
    topic: 'time', level,
    question_text: say(lang, `How many minutes does train ${letters[k]} take?`, `${letters[k]} treni yolculuğu kaç dakikada yapıyor?`, `¿Cuántos minutos tarda el tren ${letters[k]}?`),
    format: 'numeric', correct_answer: trains[k].take, operandKey: `ttable:${trains.map(t => `${t.leave}-${t.take}`).join(':')}:${k}`,
    hint_steps: [
      say(lang, `Find train ${letters[k]}'s column: when it leaves and when it arrives.`, `${letters[k]} treninin sütununu bul: ne zaman kalkıyor, ne zaman varıyor?`, `Busca la columna del tren ${letters[k]}: cuándo sale y cuándo llega.`),
      say(lang, `Count on from leaving to arriving — to the next o'clock first, then the rest.`, `Kalkıştan varışa kadar say — önce tam saate, sonra kalanı.`, `Cuenta desde la salida hasta la llegada: primero hasta la hora en punto y luego el resto.`),
    ],
    visual: { kind: 'chart', shape: 'table', cols: letters.map(l => say(lang, `Train ${l}`, `${l} treni`, `Tren ${l}`)),
      rows: [{ label: say(lang, `Leaves ${place[0]}`, `${place[0]} kalkış`, `Sale de ${place[0]}`), cells: trains.map(t => hm(t.leave, true)) },
             { label: say(lang, `Arrives ${place[1]}`, `${place[1]} varış`, `Llega a ${place[1]}`), cells: trains.map(t => hm(t.leave + t.take, true)) }] },
  }
}

// ── geometry, ages 8-9 ────────────────────────────────────────────────────────
const SOLIDS = {
  cube: { faces: 6, edges: 12, vertices: 8, name: { en: 'cube', tr: 'küp', es: 'cubo' } },
  cuboid: { faces: 6, edges: 12, vertices: 8, name: { en: 'cuboid', tr: 'dikdörtgenler prizması', es: 'ortoedro' } },
  prism: { faces: 5, edges: 9, vertices: 6, name: { en: 'triangular prism', tr: 'üçgen prizma', es: 'prisma triangular' } },
  pyramid: { faces: 5, edges: 8, vertices: 5, name: { en: 'square-based pyramid', tr: 'kare tabanlı piramit', es: 'pirámide cuadrangular' } },
  cylinder: { name: { en: 'cylinder', tr: 'silindir', es: 'cilindro' } },
  cone: { name: { en: 'cone', tr: 'koni', es: 'cono' } },
  sphere: { name: { en: 'sphere', tr: 'küre', es: 'esfera' } },
}

function geoSolid(level, lang) {
  const name = pick(Object.keys(SOLIDS))
  const s = SOLIDS[name]
  const counts = s.faces != null && Math.random() < 0.7
  if (counts) {
    const ask = pick(['faces', 'edges', 'vertices'])
    const word = { faces: say(lang, 'faces', 'yüzü', 'caras'), edges: say(lang, 'edges', 'ayrıtı', 'aristas'), vertices: say(lang, 'vertices (corners)', 'köşesi', 'vértices') }[ask]
    const esMany = ask === 'edges' || ask === 'faces' ? 'Cuántas' : 'Cuántos'
    return {
      topic: 'geometry', level,
      question_text: say(lang, `How many ${word} does this ${s.name.en} have?`, `Bu ${s.name.tr} şeklinin kaç ${word} var?`, `¿${esMany} ${word} tiene este ${s.name.es}?`)
        .replace('este pirámide', 'esta pirámide'),
      format: 'numeric', correct_answer: s[ask], operandKey: `solid:${name}:${ask}`,
      hint_steps: [
        { faces: say(lang, 'A face is a flat side. Count the front ones, then the ones you cannot see.', 'Yüz, düz bir kenardır. Önce öndekileri, sonra görünmeyenleri say.', 'Una cara es un lado plano. Cuenta las de delante y luego las que no se ven.'),
          edges: say(lang, 'An edge is where two faces meet. The dashed lines are edges at the back.', 'Ayrıt, iki yüzün birleştiği çizgidir. Kesikli çizgiler arkadaki ayrıtlardır.', 'Una arista es donde se juntan dos caras. Las líneas discontinuas son aristas de detrás.'),
          vertices: say(lang, 'A vertex is a corner where edges meet. Include the hidden ones at the back.', 'Köşe, ayrıtların birleştiği noktadır. Arkadaki gizlileri de say.', 'Un vértice es una esquina donde se juntan aristas. Cuenta también las de detrás.') }[ask],
        say(lang, 'Count the top, then the bottom, then any in between.', 'Önce üsttekileri, sonra alttakileri, sonra aradakileri say.', 'Cuenta las de arriba, luego las de abajo y luego las del medio.'),
      ],
      visual: { kind: 'solid', name },
    }
  }
  const right = opt(s.name[lang] ?? s.name.en, say(lang, 'Right.', 'Doğru.', 'Correcto.'))
  const wrongs = shuffle(Object.keys(SOLIDS).filter(k => k !== name)).map(k => opt(SOLIDS[k].name[lang] ?? SOLIDS[k].name.en,
    say(lang, `A ${SOLIDS[k].name.en} looks different — count its faces and look for curved ones.`,
              `${SOLIDS[k].name.tr} farklı görünür — yüzlerini say, eğri yüz var mı bak.`,
              `Esa figura es distinta: cuenta sus caras y busca las curvas.`)))
  return {
    topic: 'geometry', level,
    question_text: say(lang, 'What is this 3D shape called?', 'Bu cismin adı nedir?', '¿Cómo se llama este cuerpo geométrico?'),
    format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `solid:${name}:name`,
    hint_steps: [
      say(lang, 'Are its faces flat, or is some of it curved?', 'Yüzleri düz mü, yoksa eğri bir yüzü var mı?', '¿Sus caras son planas o tiene alguna curva?'),
      say(lang, 'Look at the shape of its faces: squares, rectangles, triangles or circles?', 'Yüzlerinin şekline bak: kare mi, dikdörtgen mi, üçgen mi, daire mi?', 'Mira la forma de sus caras: ¿cuadrados, rectángulos, triángulos o círculos?'),
    ],    visual: { kind: 'solid', name },
  }
}

const POLY_FACTS = {
  square: { lines: 4, right: 4 }, rectangle: { lines: 2, right: 4 }, equilateral: { lines: 3, right: 0 },
  isosceles: { lines: 1, right: 0 }, rightTriangle: { lines: 0, right: 1 }, scalene: { lines: 0, right: 0 },
  pentagon: { lines: 5, right: 0 }, hexagon: { lines: 6, right: 0 }, octagon: { lines: 8, right: 0 },
  parallelogram: { lines: 0, right: 0 }, rhombus: { lines: 2, right: 0 }, kite: { lines: 1, right: 0 },
  trapezium: { lines: 1, right: 0 }, rightTrapezium: { lines: 0, right: 2 }, lShape: { lines: 0, right: 5 },
}
export { POLY_FACTS }

// Lines of symmetry (Year 4's line) and right angles (Year 3's). Both drawn; the hint draws the
// mirror lines or marks the right angles on the same shape.
function geoPolygon(level, lang, ask) {
  const pool = ask === 'right'
    ? ['square', 'rectangle', 'rightTriangle', 'rightTrapezium', 'lShape', 'equilateral', 'parallelogram', 'rightTriangle', 'lShape', 'rightTrapezium']
    : ['square', 'rectangle', 'equilateral', 'isosceles', 'pentagon', 'hexagon', 'rhombus', 'kite', 'trapezium', 'parallelogram', 'scalene', 'octagon']
  const name = pick(pool)
  const answer = POLY_FACTS[name][ask]
  return {
    topic: 'geometry', level,
    question_text: ask === 'right'
      ? say(lang, 'How many right angles are there inside this shape?', 'Bu şeklin içinde kaç dik açı var?', '¿Cuántos ángulos rectos hay dentro de esta figura?')
      : say(lang, 'How many lines of symmetry does this shape have?', 'Bu şeklin kaç simetri ekseni var?', '¿Cuántos ejes de simetría tiene esta figura?'),
    format: 'numeric', correct_answer: answer, operandKey: `poly:${name}:${ask}`,
    hint_steps: ask === 'right'
      ? [say(lang, 'A right angle is a square corner, like the corner of a book.', 'Dik açı, bir kitabın köşesi gibi kare bir köşedir.', 'Un ángulo recto es una esquina cuadrada, como la de un libro.'),
         say(lang, 'Check every corner inside the shape, one at a time. A corner can be too wide or too narrow to count.', 'Şeklin içindeki her köşeye tek tek bak. Bazı köşeler fazla geniş ya da dar olabilir.', 'Revisa cada esquina de dentro, una por una. Algunas son demasiado abiertas o cerradas.')]
      : [say(lang, 'A line of symmetry folds the shape into two halves that match exactly.', 'Simetri ekseni, şekli tam üst üste gelen iki yarıya katlar.', 'Un eje de simetría dobla la figura en dos mitades que coinciden exactamente.'),
         say(lang, 'Try up and down, across, and corner to corner. Some shapes have none.', 'Dikey, yatay ve köşeden köşeye dene. Bazı şekillerin hiç yoktur.', 'Prueba de arriba abajo, de lado a lado y de esquina a esquina. Algunas figuras no tienen ninguno.')],
    visual: { kind: 'polygon', name, ask },
  }
}

// Compass turns: "Gavin faces North and turns a quarter turn clockwise."
function geoTurn(level, lang) {
  const dirs = ['N', 'E', 'S', 'W']
  const names = { N: say(lang, 'North', 'Kuzey', 'Norte'), E: say(lang, 'East', 'Doğu', 'Este'), S: say(lang, 'South', 'Güney', 'Sur'), W: say(lang, 'West', 'Batı', 'Oeste') }
  const from = randInt(0, 3)
  const turns = pick([1, 2, 3])
  const cw = Math.random() < 0.5
  const to = (from + (cw ? turns : 4 - turns)) % 4
  const turnWord = { 1: say(lang, 'a quarter turn', 'çeyrek tur', 'un cuarto de vuelta'), 2: say(lang, 'a half turn', 'yarım tur', 'media vuelta'), 3: say(lang, 'three quarters of a turn', 'üç çeyrek tur', 'tres cuartos de vuelta') }[turns]
  const dirWord = cw ? say(lang, 'clockwise', 'saat yönünde', 'en el sentido de las agujas del reloj') : say(lang, 'anticlockwise', 'saatin tersi yönünde', 'en sentido contrario a las agujas del reloj')
  const name = pickL(MULT_NAMES, lang)
  const right = opt(names[dirs[to]], say(lang, 'Right.', 'Doğru.', 'Correcto.'))
  const wrongDir = (from + (cw ? 4 - turns : turns)) % 4
  const wrongs = [opt(names[dirs[wrongDir]], say(lang, 'That is turning the other way round.', 'Bu, ters yöne dönmek.', 'Eso es girar al revés.')),
                  ...dirs.filter((_, i) => i !== to && i !== wrongDir).map(d => opt(names[d], say(lang, 'Count the quarter turns again.', 'Çeyrek turları yeniden say.', 'Vuelve a contar los cuartos de vuelta.')))]
  return {
    topic: 'geometry', level,
    question_text: say(lang, `${name} is facing ${names[dirs[from]]} and makes ${turnWord} ${dirWord}. Which way is ${name} facing now?`,
                             `${name} ${names[dirs[from]]} yönüne bakıyor ve ${dirWord} ${turnWord} dönüyor. ${name} şimdi hangi yöne bakıyor?`,
                             `${name} mira al ${names[dirs[from]]} y da ${turnWord} ${dirWord}. ¿Hacia dónde mira ahora?`),
    format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `turn:${from}:${turns}:${cw}`,
    hint_steps: [
      say(lang, `Going clockwise the order is North, East, South, West.`, `Saat yönünde sıra: Kuzey, Doğu, Güney, Batı.`, `En el sentido de las agujas del reloj el orden es Norte, Este, Sur, Oeste.`),
      say(lang, `Each quarter turn moves one step along that order${cw ? '' : ', backwards'}.`, `Her çeyrek tur bu sırada bir adım ${cw ? 'ileri' : 'geri'} gider.`, `Cada cuarto de vuelta avanza un paso en ese orden${cw ? '' : ', hacia atrás'}.`),
    ],
  }
}

// Coordinates (Year 4): "What are the coordinates of B?" — the classic wrong answer is the pair
// the wrong way round, so it is always on offer when it differs.
function geoCoords(level, lang) {
  const size = 6
  const pts = []
  const used = new Set()
  for (const label of ['A', 'B', 'C', 'D']) {
    let x, y
    do { x = randInt(1, size - 1); y = randInt(1, size - 1) } while (used.has(`${x},${y}`) || x === y)
    used.add(`${x},${y}`)
    pts.push({ label, x, y })
  }
  const target = pick(pts)
  const readMode = Math.random() < 0.6
  const pair = (x, y) => `(${x}, ${y})`
  if (readMode) {
    const right = opt(pair(target.x, target.y), say(lang, 'Right — across first, then up.', 'Doğru — önce sağa, sonra yukarı.', 'Correcto: primero a lo largo y luego hacia arriba.'))
    const wrongs = [opt(pair(target.y, target.x), say(lang, 'Those are the right numbers the wrong way round: across comes first.', 'Sayılar doğru ama sırası ters: önce yatay gelir.', 'Son los números correctos al revés: primero va el de abajo.')),
      opt(pair(target.x + 1, target.y), say(lang, 'Count the lines along the bottom again, starting from 0.', 'Alttaki çizgileri 0\'dan başlayarak yeniden say.', 'Vuelve a contar las líneas de abajo desde 0.')),
      opt(pair(target.x, target.y - 1), say(lang, 'Count the lines up the side again, starting from 0.', 'Yandaki çizgileri 0\'dan başlayarak yeniden say.', 'Vuelve a contar las líneas del lado desde 0.'))]
    return {
      topic: 'geometry', level,
      question_text: say(lang, `What are the coordinates of point ${target.label}?`, `${target.label} noktasının koordinatları nedir?`, `¿Cuáles son las coordenadas del punto ${target.label}?`),
      format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `coord:r:${pts.map(p => `${p.x}${p.y}`).join('')}:${target.label}`,
      hint_steps: [
        say(lang, `Go along the bottom first until you are under ${target.label}.`, `Önce altta, ${target.label} noktasının altına gelene kadar ilerle.`, `Ve primero por abajo hasta quedar debajo de ${target.label}.`),
        say(lang, `Then go up to it. Write (along, up).`, `Sonra yukarı çık. (yatay, dikey) diye yaz.`, `Luego sube hasta él. Escribe (horizontal, vertical).`),
      ],
      visual: { kind: 'coords', size, points: pts.map(p => ({ ...p, ask: p.label === target.label })) },
    }
  }
  const right = opt(target.label, say(lang, 'Right.', 'Doğru.', 'Correcto.'))
  const swapped = pts.find(p => p.x === target.y && p.y === target.x)
  const wrongs = pts.filter(p => p.label !== target.label).map(p => opt(p.label, p === swapped
    ? say(lang, 'That point has the numbers the wrong way round.', 'O noktada sayılar ters sırada.', 'Ese punto tiene los números al revés.')
    : say(lang, `${p.label} is at (${p.x}, ${p.y}).`, `${p.label} noktası (${p.x}, ${p.y}) konumunda.`, `${p.label} está en (${p.x}, ${p.y}).`)))
  return {
    topic: 'geometry', level,
    question_text: say(lang, `Which point is at ${pair(target.x, target.y)}?`, `Hangi nokta ${pair(target.x, target.y)} konumunda?`, `¿Qué punto está en ${pair(target.x, target.y)}?`),
    format: 'choice', options: choiceOf(right, wrongs, { sort: (a, b) => a.value.localeCompare(b.value) }), correct_answer: right.value,
    operandKey: `coord:w:${pts.map(p => `${p.x}${p.y}`).join('')}:${target.label}`,
    hint_steps: [
      say(lang, `The first number is how far along, the second how far up.`, `İlk sayı ne kadar sağa, ikincisi ne kadar yukarı gidileceğidir.`, `El primer número es cuánto avanzar y el segundo cuánto subir.`),
      say(lang, `Go ${target.x} along, then ${target.y} up.`, `${target.x} sağa, sonra ${target.y} yukarı git.`, `Avanza ${target.x} y luego sube ${target.y}.`),
    ],
    visual: { kind: 'coords', size, points: pts },
  }
}

// Angles against a right angle (Year 3: "identify whether angles are greater than or less than
// a right angle"), and the whole-turn facts both books ask.
function geoAngleFacts(level, lang) {
  if (Math.random() < 0.5) {
    // Each fact carries its own hints, written so that none of them states the fact asked.
    const facts = [
      { a: 4, q: say(lang, 'How many right angles make a whole turn?', 'Tam tur kaç dik açıdır?', '¿Cuántos ángulos rectos forman una vuelta completa?'),
        h: [say(lang, 'A right angle is a quarter turn, like the hand of a clock going from 12 to 3.', 'Dik açı çeyrek turdur, akrebin 12\'den 3\'e gitmesi gibi.', 'Un ángulo recto es un cuarto de vuelta, como la aguja del reloj del 12 al 3.'),
            say(lang, 'Keep turning in quarter turns until you are back where you started, and count them.', 'Başladığın yere dönene kadar çeyrek tur dön ve say.', 'Sigue girando de cuarto en cuarto hasta volver al principio y cuéntalos.')] },
      { a: 2, q: say(lang, 'How many right angles make a half turn?', 'Yarım tur kaç dik açıdır?', '¿Cuántos ángulos rectos forman media vuelta?'),
        h: [say(lang, 'A right angle is a quarter turn, like the hand of a clock going from 12 to 3.', 'Dik açı çeyrek turdur, akrebin 12\'den 3\'e gitmesi gibi.', 'Un ángulo recto es un cuarto de vuelta, como la aguja del reloj del 12 al 3.'),
            say(lang, 'A half turn takes the hand from 12 to 6. How many quarter turns is that?', 'Yarım tur, akrebi 12\'den 6\'ya götürür. Bu kaç çeyrek tur?', 'Media vuelta lleva la aguja del 12 al 6. ¿Cuántos cuartos son?')] },
      { a: 90, q: say(lang, 'How many degrees are there in a right angle?', 'Dik açı kaç derecedir?', '¿Cuántos grados tiene un ángulo recto?'),
        h: [say(lang, 'A whole turn is 360 degrees.', 'Tam tur 360 derecedir.', 'Una vuelta completa son 360 grados.'),
            say(lang, 'A right angle is a quarter of a whole turn: 360 ÷ 4.', 'Dik açı tam turun çeyreğidir: 360 ÷ 4.', 'Un ángulo recto es un cuarto de vuelta: 360 ÷ 4.')] },
      { a: 360, q: say(lang, 'How many degrees are there in a whole turn?', 'Tam tur kaç derecedir?', '¿Cuántos grados tiene una vuelta completa?'),
        h: [say(lang, 'A right angle is 90 degrees.', 'Dik açı 90 derecedir.', 'Un ángulo recto mide 90 grados.'),
            say(lang, 'A whole turn is four right angles: 4 × 90.', 'Tam tur dört dik açıdır: 4 × 90.', 'Una vuelta completa son cuatro ángulos rectos: 4 × 90.')] },
      { a: 45, q: say(lang, 'How many degrees are there in half a right angle?', 'Dik açının yarısı kaç derecedir?', '¿Cuántos grados tiene la mitad de un ángulo recto?'),
        h: [say(lang, 'A right angle is 90 degrees.', 'Dik açı 90 derecedir.', 'Un ángulo recto mide 90 grados.'),
            say(lang, 'Half of it is 90 ÷ 2.', 'Yarısı 90 ÷ 2 eder.', 'La mitad es 90 ÷ 2.')] },
    ]
    const f = pick(facts)
    return { topic: 'geometry', level, question_text: f.q, format: 'numeric', correct_answer: f.a, operandKey: `angfact:${f.a}`, hint_steps: f.h }
  }
  const bigger = Math.random() < 0.5
  const target = bigger ? randInt(95, 170) : randInt(15, 85)
  const others = shuffle([randInt(15, 85), randInt(20, 80), 90, randInt(95, 170), randInt(100, 160)])
    .filter(x => (bigger ? x <= 90 : x >= 90) && x !== target).slice(0, 3)
  const right = opt(`${target}°`, say(lang, 'Right.', 'Doğru.', 'Correcto.'))
  const wrongs = others.map(x => opt(`${x}°`, x === 90
    ? say(lang, '90° IS a right angle — not bigger or smaller.', '90° tam dik açıdır — ne büyük ne küçük.', '90° ES un ángulo recto: ni mayor ni menor.')
    : say(lang, `${x}° is ${x > 90 ? 'more' : 'less'} than a right angle.`, `${x}°, dik açıdan ${x > 90 ? 'büyük' : 'küçük'}.`, `${x}° es ${x > 90 ? 'mayor' : 'menor'} que un ángulo recto.`)))
  return {
    topic: 'geometry', level,
    question_text: bigger
      ? say(lang, 'Which angle is bigger than a right angle?', 'Hangi açı dik açıdan büyüktür?', '¿Qué ángulo es mayor que un ángulo recto?')
      : say(lang, 'Which angle is smaller than a right angle?', 'Hangi açı dik açıdan küçüktür?', '¿Qué ángulo es menor que un ángulo recto?'),
    format: 'choice', options: choiceOf(right, wrongs, { sort: (a, b) => parseInt(a.value) - parseInt(b.value) }), correct_answer: right.value,
    operandKey: `angcmp:${bigger}:${target}`,
    hint_steps: [say(lang, 'A right angle is 90°.', 'Dik açı 90°\'dir.', 'Un ángulo recto mide 90°.'),
                 say(lang, `Look for the one ${bigger ? 'more' : 'less'} than 90.`, `90'dan ${bigger ? 'büyük' : 'küçük'} olanı bul.`, `Busca el que sea ${bigger ? 'mayor' : 'menor'} que 90.`)],
  }
}

function geometryYoung(level, lang) {
  const band = bandForLevel(level)
  const r = Math.random()
  if (band === 3) {
    if (r < 0.16) return null                                   // sides and corners, as before
    if (r < 0.28) return geoMap(level, lang)
    if (r < 0.38) return geoNet(level, lang)
    if (r < 0.45) return geoSolid(level, lang)
    if (r < 0.65) return geoPolygon(level, lang, 'right')
    if (r < 0.82) return geoAngleFacts(level, lang)
    return geoTurn(level, lang)
  }
  // Year 4: "classify shapes; identify lines of symmetry; describe positions on a 2D grid as
  // coordinates". Coordinates had no question at all before this.
  if (r < 0.15) return null
  if (r < 0.45) return geoCoords(level, lang)
  if (r < 0.7) return geoPolygon(level, lang, 'lines')
  if (r < 0.78) return geoNet(level, lang)
  if (r < 0.88) return geoSolid(level, lang)
  return geoTurn(level, lang)
}

// ── place value and number, ages 7-9 ──────────────────────────────────────────
// Numbers in words and back, the biggest number from some digits, the missing term of a
// sequence, what a number is made of, Roman numerals — every one of them in both books.
function pvWords(level, lang) {
  const band = bandForLevel(level)
  const n = band <= 2 ? randInt(21, 99) : band === 3 ? randInt(101, 999) : randInt(1001, 9999)
  // Zeros inside the number are where the mistakes live: "two hundred and two" is written 22.
  const tricky = band >= 3 && Math.random() < 0.5
    ? (band === 3 ? randInt(1, 9) * 100 + randInt(1, 9) : randInt(1, 9) * 1000 + (Math.random() < 0.5 ? randInt(1, 9) * 100 + randInt(1, 9) : randInt(10, 99)))
    : n
  return {
    topic: band <= 2 ? 'counting' : 'place-value', level,
    question_text: say(lang, `Write "${numberWords(tricky, 'en')}" in figures.`, `"${numberWords(tricky, 'tr')}" sayısını rakamla yaz.`, `Escribe "${numberWords(tricky, 'es')}" con cifras.`),
    format: 'numeric', correct_answer: tricky, operandKey: `pvw:${tricky}`,
    hint_steps: [
      say(lang, `Write each part in its place: thousands, hundreds, tens, ones.`, `Her parçayı kendi basamağına yaz: binler, yüzler, onlar, birler.`, `Escribe cada parte en su lugar: millares, centenas, decenas, unidades.`),
      say(lang, `If a place has nothing in it, it still needs a 0.`, `Bir basamakta hiçbir şey yoksa oraya 0 yazılır.`, `Si una posición está vacía, lleva un 0.`),
    ],
  }
}

function pvDigits(level, lang) {
  const band = bandForLevel(level)
  const k = band <= 3 ? 3 : 4
  let digits
  do { digits = Array.from({ length: k }, () => randInt(0, 9)) } while (new Set(digits).size < k - (band >= 4 ? 1 : 0) || digits.filter(d => d > 0).length < 2)
  const biggest = Math.random() < 0.5
  const sorted = [...digits].sort((a, b) => (biggest ? b - a : a - b))
  // The smallest number cannot start with 0: swap in the smallest non-zero digit.
  if (!biggest && sorted[0] === 0) {
    const i = sorted.findIndex(d => d > 0)
    ;[sorted[0], sorted[i]] = [sorted[i], sorted[0]]
  }
  const answer = Number(sorted.join(''))
  return {
    topic: 'place-value', level,
    question_text: say(lang, `What is the ${biggest ? 'biggest' : 'smallest'} number you can make with these digits: ${digits.join(', ')}?`,
                             `Bu rakamlarla yazabileceğin en ${biggest ? 'büyük' : 'küçük'} sayı kaçtır: ${digits.join(', ')}?`,
                             `¿Cuál es el número más ${biggest ? 'grande' : 'pequeño'} que puedes formar con estas cifras: ${digits.join(', ')}?`),
    format: 'numeric', correct_answer: answer, operandKey: `pvd:${biggest}:${digits.join('')}`,
    hint_steps: [
      say(lang, `The first digit is worth the most, so put the ${biggest ? 'biggest' : 'smallest'} digit there.`,
                `İlk rakam en değerli olandır, oraya en ${biggest ? 'büyük' : 'küçük'} rakamı koy.`,
                `La primera cifra es la que más vale: pon ahí la ${biggest ? 'mayor' : 'menor'}.`),
      biggest
        ? say(lang, `Then the next biggest, and so on.`, `Sonra bir sonraki en büyüğü, böyle devam et.`, `Luego la siguiente mayor, y así.`)
        : say(lang, `A number cannot start with 0 — use 0 in the next place instead.`, `Sayı 0 ile başlayamaz — 0'ı bir sonraki basamağa koy.`, `Un número no puede empezar por 0: ponlo en la siguiente posición.`),
    ],
  }
}

function pvSequence(level, lang) {
  const band = bandForLevel(level)
  const steps = band <= 2 ? [2, 3, 5, 10] : band === 3 ? [4, 8, 50, 100, 6, 9] : [6, 7, 9, 25, 1000, 11, 12, 15]
  const step = pick(steps)
  const down = Math.random() < 0.45
  const len = 5
  const maxStart = band <= 2 ? 99 : band === 3 ? 999 : 9999
  let start = randInt(step * (down ? len : 1), Math.max(step * (down ? len : 1) + 1, maxStart - (down ? 0 : step * len)))
  if (step >= 25) start = Math.round(start / step) * step || step * len
  const terms = Array.from({ length: len }, (_, i) => (down ? start - step * i : start + step * i))
  if (terms.some(t => t <= 0)) return pvSequence(level, lang)
  const gap = randInt(1, len - 2)
  const shown = terms.map((t, i) => (i === gap ? '?' : num(t, lang)))
  return {
    topic: band <= 2 ? 'counting' : 'place-value', level,
    question_text: say(lang, `What is the missing number? ${shown.join(', ')}`, `Eksik sayı kaçtır? ${shown.join(', ')}`, `¿Qué número falta? ${shown.join(', ')}`),
    format: 'numeric', correct_answer: terms[gap], operandKey: `pvs:${step}:${terms[0]}:${down}:${gap}`,
    hint_steps: [
      say(lang, `Find two numbers next to each other and work out the gap.`, `Yan yana iki sayı bul ve aradaki farkı hesapla.`, `Busca dos números seguidos y calcula la diferencia.`),
      say(lang, `The sequence goes ${down ? 'down' : 'up'} by the same amount every time.`, `Dizi her seferinde aynı miktarda ${down ? 'azalıyor' : 'artıyor'}.`, `La serie ${down ? 'baja' : 'sube'} siempre lo mismo.`),
    ],
  }
}

function pvPartition(level, lang) {
  const band = bandForLevel(level)
  if (band <= 2) {
    const t = randInt(2, 9), o = randInt(1, 9)
    const swapped = Math.random() < 0.3
    return {
      topic: 'counting', level,
      question_text: swapped
        ? say(lang, `What number is ${o} ones and ${t} tens?`, `${o} birlik ve ${t} onluk hangi sayıyı yapar?`, `¿Qué número forman ${o} unidades y ${t} decenas?`)
        : say(lang, `What number is ${t} tens and ${o} ones?`, `${t} onluk ve ${o} birlik hangi sayıyı yapar?`, `¿Qué número forman ${t} decenas y ${o} unidades?`),
      format: 'numeric', correct_answer: t * 10 + o, operandKey: `pvp:${t}:${o}:${swapped}`,
      hint_steps: [say(lang, `${t} tens is ${t * 10}.`, `${t} onluk ${t * 10} eder.`, `${t} decenas son ${t * 10}.`),
                   say(lang, `Then add the ones.`, `Sonra birlikleri ekle.`, `Luego suma las unidades.`)],
    }
  }
  const n = band === 3 ? randInt(101, 999) : randInt(1001, 9999)
  const parts = placeParts(n)
  if (parts.length < 3) return pvPartition(level, lang)
  const hide = randInt(1, parts.length - 1)
  const shown = parts.map((p, i) => (i === hide ? '?' : num(p, lang))).join(' + ')
  return {
    topic: 'place-value', level,
    question_text: say(lang, `What is the missing number? ${num(n, lang)} = ${shown}`, `Eksik sayı kaçtır? ${num(n, lang)} = ${shown}`, `¿Qué número falta? ${num(n, lang)} = ${shown}`),
    format: 'numeric', correct_answer: parts[hide], operandKey: `pvp:${n}:${hide}`,
    hint_steps: [say(lang, `Each part is one digit of ${num(n, lang)} in its place.`, `Her parça, ${num(n, lang)} sayısının bir basamağıdır.`, `Cada parte es una cifra de ${num(n, lang)} en su posición.`),
                 say(lang, `Find the digit that is missing and what its place makes it worth.`, `Eksik rakamı ve bulunduğu basamağın ona kattığı değeri bul.`, `Busca la cifra que falta y cuánto vale en su posición.`)],
  }
}

function pvRoman(level, lang) {
  // A single letter (V, X, L, C) is not asked: the hint's key names every one of them.
  let n
  do { n = randInt(4, 99) } while ([5, 10, 50].includes(n))
  const r = roman(n)
  return {
    topic: 'place-value', level,
    question_text: say(lang, `What number is ${r} in Roman numerals?`, `Roma rakamıyla ${r} hangi sayıdır?`, `¿Qué número es ${r} en números romanos?`),
    format: 'numeric', correct_answer: n, operandKey: `roman:${n}`,
    hint_steps: [
      say(lang, 'I = 1, V = 5, X = 10, L = 50, C = 100.', 'I = 1, V = 5, X = 10, L = 50, C = 100.', 'I = 1, V = 5, X = 10, L = 50, C = 100.'),
      (() => {
        // The worked examples are chosen so that neither is the numeral being asked about.
        const ex = [['IV', 4], ['IX', 9], ['XL', 40], ['XC', 90]].filter(([, v]) => v !== n).slice(0, 2).map(([s, v]) => `${s} = ${v}`).join(', ')
        return say(lang, `Add them up — but a smaller one BEFORE a bigger one is taken away (${ex}).`,
                         `Hepsini topla — ama büyük olanın ÖNÜNDEKİ küçük çıkarılır (${ex}).`,
                         `Súmalos, pero uno pequeño DELANTE de uno grande se resta (${ex}).`)
      })(),
    ],
  }
}

function pvMoreLess(level, lang) {
  const band = bandForLevel(level)
  const amount = band <= 2 ? pick([1, 10]) : band === 3 ? pick([10, 100]) : pick([100, 1000])
  const up = Math.random() < 0.5
  const max = band <= 2 ? 99 : band === 3 ? 999 : 9999
  const n = randInt(amount + 1, max - amount)
  return {
    topic: band <= 2 ? 'counting' : 'place-value', level,
    question_text: say(lang, `What is ${num(amount, lang)} ${up ? 'more' : 'less'} than ${num(n, lang)}?`,
                             `${num(n, lang)} sayısının ${num(amount, lang)} ${up ? 'fazlası' : 'eksiği'} kaçtır?`,
                             `¿Cuánto es ${num(amount, lang)} ${up ? 'más' : 'menos'} que ${num(n, lang)}?`),
    format: 'numeric', correct_answer: up ? n + amount : n - amount, operandKey: `pvml:${amount}:${n}:${up}`,
    hint_steps: [
      say(lang, `Only one digit is being ${up ? 'added to' : 'taken from'}: the ${amount === 1000 ? 'thousands' : amount === 100 ? 'hundreds' : amount === 10 ? 'tens' : 'ones'}.`,
                `Yalnız bir basamak ${up ? 'artıyor' : 'azalıyor'}: ${amount === 1000 ? 'binler' : amount === 100 ? 'yüzler' : amount === 10 ? 'onlar' : 'birler'} basamağı.`,
                `Solo cambia una posición: la de las ${amount === 1000 ? 'unidades de millar' : amount === 100 ? 'centenas' : amount === 10 ? 'decenas' : 'unidades'}.`),
      say(lang, `If that digit passes 9 or goes below 0, the next place changes too.`, `O rakam 9'u geçerse ya da 0'ın altına inerse bir sonraki basamak da değişir.`, `Si esa cifra pasa de 9 o baja de 0, cambia también la siguiente.`),
    ],
  }
}

function youngPlaceValue(level, lang) {
  const band = bandForLevel(level)
  const r = Math.random()
  if (band <= 2) {
    if (r < 0.35) return null
    if (r < 0.55) return pvSequence(level, lang)
    if (r < 0.72) return pvWords(level, lang)
    if (r < 0.87) return pvPartition(level, lang)
    return lineReading(level, lang)
  }
  if (band === 3) {
    if (r < 0.3) return null
    if (r < 0.45) return pvSequence(level, lang)
    if (r < 0.58) return pvWords(level, lang)
    if (r < 0.7) return pvDigits(level, lang)
    if (r < 0.82) return pvMoreLess(level, lang)
    if (r < 0.9) return pvPartition(level, lang)
    return lineReading(level, lang)
  }
  if (r < 0.3) return null
  if (r < 0.42) return pvRoman(level, lang)
  if (r < 0.54) return pvSequence(level, lang)
  if (r < 0.64) return pvWords(level, lang)
  if (r < 0.74) return pvDigits(level, lang)
  if (r < 0.82) return pvMoreLess(level, lang)
  if (r < 0.9) return pvPartition(level, lang)
  return lineReading(level, lang)
}

function lineReading(level, lang) {
  return scaleReading(level, lang, ['line'])
}

// Year 1 reads a ruler in whole centimetres; Year 3 reads all four instruments.
function measureReading(level, lang) {
  return scaleReading(level, lang, bandForLevel(level) <= 2 ? ['ruler'] : ['ruler', 'jug', 'thermo', 'dial'])
}

// ── data, ages 7-9 ────────────────────────────────────────────────────────────
// A tally chart: Year 2's curriculum names it, and both books start their data pages with one.
const TALLY_SETS = [
  { en: { what: 'favourite fruit', rows: ['Apple', 'Banana', 'Grapes', 'Pear'] }, tr: { what: 'en sevdiği meyveyi', rows: ['Elma', 'Muz', 'Üzüm', 'Armut'] }, es: { what: 'fruta favorita', rows: ['Manzana', 'Plátano', 'Uvas', 'Pera'] } },
  { en: { what: 'favourite pet', rows: ['Dog', 'Cat', 'Hamster', 'Fish'] }, tr: { what: 'en sevdiği evcil hayvanı', rows: ['Köpek', 'Kedi', 'Hamster', 'Balık'] }, es: { what: 'mascota favorita', rows: ['Perro', 'Gato', 'Hámster', 'Pez'] } },
  { en: { what: 'way to school', rows: ['Walk', 'Car', 'Bus', 'Bike'] }, tr: { what: 'okula geliş şeklini', rows: ['Yürüyerek', 'Arabayla', 'Otobüsle', 'Bisikletle'] }, es: { what: 'forma de ir al cole', rows: ['Andando', 'Coche', 'Autobús', 'Bici'] } },
]

function dataTally(level, lang) {
  const band = bandForLevel(level)
  const set = pick(TALLY_SETS)
  const w = set[lang] ?? set.en
  const counts = shuffle(Array.from({ length: band <= 2 ? 12 : 17 }, (_, i) => i + 2)).slice(0, 4)
  const rows = w.rows.map((label, i) => ({ label, count: counts[i] }))
  const ask = pick(band <= 2 ? ['read', 'read', 'more', 'total'] : ['read', 'more', 'total', 'total'])
  const i = randInt(0, 3)
  let j = randInt(0, 3); while (j === i) j = randInt(0, 3)
  const [hi, lo] = counts[i] > counts[j] ? [i, j] : [j, i]
  const intro = say(lang, `The tally chart shows each child's ${w.what}.`, `Çetele tablosu, çocukların ${w.what} gösteriyor.`, `La tabla de conteo muestra la ${w.what} de cada niño.`)
  const q = ask === 'read'
    ? say(lang, `${intro} How many children chose ${w.rows[i]}?`, `${intro} Kaç çocuk "${w.rows[i]}" dedi?`, `${intro} ¿Cuántos niños eligieron «${w.rows[i]}»?`)
    : ask === 'more'
      ? say(lang, `${intro} How many more chose ${w.rows[hi]} than ${w.rows[lo]}?`, `${intro} "${w.rows[hi]}" diyenler, "${w.rows[lo]}" diyenlerden kaç kişi fazla?`, `${intro} ¿Cuántos más eligieron «${w.rows[hi]}» que «${w.rows[lo]}»?`)
      : say(lang, `${intro} How many children are there altogether?`, `${intro} Toplam kaç çocuk var?`, `${intro} ¿Cuántos niños hay en total?`)
  const answer = ask === 'read' ? counts[i] : ask === 'more' ? counts[hi] - counts[lo] : counts.reduce((a, b) => a + b, 0)
  return {
    topic: 'pictogram', level, question_text: q, format: 'numeric', correct_answer: answer,
    operandKey: `tally:${ask}:${counts.join('-')}:${i}:${j}`,
    hint_steps: [
      say(lang, 'Each gate of four lines with one across is 5. Count the gates in fives, then the single lines.', 'Üstü çizili dört çizgi 5 demektir. Önce beşleri, sonra tek çizgileri say.', 'Cada grupo de cuatro rayas cruzadas es 5. Cuenta de 5 en 5 y luego las rayas sueltas.'),
      ask === 'total' ? say(lang, 'Add up every row.', 'Bütün satırları topla.', 'Suma todas las filas.')
        : ask === 'more' ? say(lang, 'Count both rows, then find the difference.', 'İki satırı da say, sonra farkı bul.', 'Cuenta las dos filas y calcula la diferencia.')
          : say(lang, 'Find the right row first.', 'Önce doğru satırı bul.', 'Busca primero la fila correcta.'),
    ],
    visual: { kind: 'tally', rows },
  }
}

// ── money, ages 7-9 ───────────────────────────────────────────────────────────
// A shop's price list: what two things cost together, which two cost an exact amount, how much
// change. Year 2 works in cents; Years 3 and 4 in dollars and cents, the way the books use £.
const SHOP = [
  { icon: '✏️', en: 'pencil', tr: 'kalem', es: 'lápiz' }, { icon: '📒', en: 'notepad', tr: 'defter', es: 'libreta' },
  { icon: '🧽', en: 'rubber', tr: 'silgi', es: 'goma' }, { icon: '📏', en: 'ruler', tr: 'cetvel', es: 'regla' },
  { icon: '🖍️', en: 'crayons', tr: 'boya', es: 'ceras' }, { icon: '✂️', en: 'scissors', tr: 'makas', es: 'tijeras' },
  { icon: '🖊️', en: 'pen', tr: 'tükenmez', es: 'boli' },
]

function moneyShop(level, lang) {
  const band = bandForLevel(level)
  const items = shuffle(SHOP).slice(0, 4).map(it => ({ ...it,
    cents: band <= 2 ? randInt(2, 9) * 5 : randInt(4, 39) * 5 }))
  // no two prices the same, or "which two cost …" can have two answers
  if (new Set(items.map(i => i.cents)).size < items.length) return moneyShop(level, lang)
  const price = c => (band <= 2 ? say(lang, `${c}c`, `${c} kr`, `${c} cént.`) : cash(c, lang))
  const visual = { kind: 'prices', items: items.map(it => ({ icon: it.icon, name: it[lang] ?? it.en, price: price(it.cents) })) }
  const unitQ = band <= 2 ? say(lang, 'cents', 'kuruş', 'céntimos') : MAJOR[lang] ?? MAJOR.en
  const ask = pick(['pair', 'pair', 'change', 'which'])
  const [a, b] = items
  const nm = it => it[lang] ?? it.en
  const value = c => (band <= 2 ? c : c / 100)
  const fmt = band <= 2 ? 'numeric' : 'decimal'
  if (ask === 'pair') {
    const total = a.cents + b.cents
    return {
      topic: 'money', level,
      question_text: say(lang, `How much do the ${nm(a)} and the ${nm(b)} cost together, in ${unitQ}?`,
                               `${cap(nm(a))} ve ${nm(b)} birlikte kaç ${unitQ} tutar?`,
                               `¿Cuánto cuestan juntos ${nm(a)} y ${nm(b)}, en ${unitQ}?`),
      format: Number.isInteger(value(total)) ? 'numeric' : fmt, correct_answer: value(total), operandKey: `shop:pair:${a.cents}:${b.cents}`,
      hint_steps: [say(lang, `Find both prices on the tags.`, `İki fiyatı da etiketlerden bul.`, `Busca los dos precios en las etiquetas.`),
                   say(lang, `Add them — the cents first, then the ${band <= 2 ? 'tens' : 'dollars'}.`, `Topla — önce kuruşları, sonra ${band <= 2 ? 'onlukları' : 'liraları'}.`, `Súmalos: primero los céntimos y luego ${band <= 2 ? 'las decenas' : 'los euros'}.`)],
      visual,
    }
  }
  if (ask === 'change') {
    const paid = band <= 2 ? 100 : pick([500, 1000])
    const spend = a.cents + (band >= 3 ? b.cents : 0)
    return {
      topic: 'money', level,
      question_text: band <= 2
        ? say(lang, `${pickL(MULT_NAMES, lang)} buys the ${nm(a)} and pays with 100 cents. How much change is there, in cents?`,
                    `${pickL(MULT_NAMES, lang)} ${nm(a)} alıyor ve 100 kuruş veriyor. Kaç kuruş para üstü alır?`,
                    `${pickL(MULT_NAMES, lang)} compra ${nm(a)} y paga con 100 céntimos. ¿Cuánto le devuelven, en céntimos?`)
        : say(lang, `${pickL(MULT_NAMES, lang)} buys the ${nm(a)} and the ${nm(b)} and pays with ${cash(paid, lang)}. How much change is there, in ${unitQ}?`,
                    `${pickL(MULT_NAMES, lang)} ${nm(a)} ve ${nm(b)} alıyor, ${cash(paid, lang)} veriyor. Kaç ${unitQ} para üstü alır?`,
                    `${pickL(MULT_NAMES, lang)} compra ${nm(a)} y ${nm(b)} y paga con ${cash(paid, lang)}. ¿Cuánto le devuelven, en ${unitQ}?`),
      format: Number.isInteger(value(paid - spend)) ? 'numeric' : fmt, correct_answer: value(paid - spend), operandKey: `shop:chg:${paid}:${spend}`,
      hint_steps: [say(lang, `First find what it all costs.`, `Önce hepsinin kaç tuttuğunu bul.`, `Primero calcula cuánto cuesta todo.`),
                   say(lang, `Then count up from that to what was paid.`, `Sonra oradan verilen paraya kadar say.`, `Luego cuenta desde ahí hasta lo que se pagó.`)],
      visual,
    }
  }
  // which two cost exactly …
  const pairs = []
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) pairs.push([items[i], items[j]])
  const target = pick(pairs)
  const sum = target[0].cents + target[1].cents
  if (pairs.filter(([x, y]) => x.cents + y.cents === sum).length !== 1) return moneyShop(level, lang)
  const label = ([x, y]) => say(lang, `${nm(x)} and ${nm(y)}`, `${nm(x)} ve ${nm(y)}`, `${nm(x)} y ${nm(y)}`)
  const right = opt(label(target), say(lang, 'Right.', 'Doğru.', 'Correcto.'))
  const wrongs = shuffle(pairs.filter(p => p !== target)).map(p => opt(label(p),
    say(lang, `Those two come to ${price(p[0].cents + p[1].cents)}.`, `Bu ikisi ${price(p[0].cents + p[1].cents)} tutar.`, `Esos dos suman ${price(p[0].cents + p[1].cents)}.`)))
  return {
    topic: 'money', level,
    question_text: say(lang, `Which two things cost exactly ${price(sum)} together?`, `Hangi iki şey birlikte tam ${price(sum)} tutar?`, `¿Qué dos cosas cuestan juntas exactamente ${price(sum)}?`),
    format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `shop:which:${items.map(i => i.cents).join('-')}:${sum}`,
    hint_steps: [say(lang, `Try adding the prices two at a time.`, `Fiyatları ikişer ikişer toplamayı dene.`, `Prueba a sumar los precios de dos en dos.`),
                 say(lang, `Only one pair lands exactly on ${price(sum)}.`, `Yalnız bir çift tam ${price(sum)} eder.`, `Solo una pareja da exactamente ${price(sum)}.`)],
    visual,
  }
}

// ── pie charts (Year 6: "interpret pie charts") ───────────────────────────────
// The statistics topic of an 11-year-old asked only for averages, although the curriculum line
// begins with pie charts and Bond's 10-11 book has them. Slices are halves, quarters, eighths,
// thirds, sixths and fifths — read against the circle the way the book's are, never measured.
const PIE_SPLITS = [
  [[1, 2], [1, 4], [1, 4]], [[1, 2], [1, 4], [1, 8], [1, 8]], [[3, 8], [1, 4], [1, 4], [1, 8]],
  [[1, 4], [1, 4], [1, 4], [1, 4]], [[1, 3], [1, 3], [1, 6], [1, 6]], [[1, 2], [1, 3], [1, 6]],
  [[2, 5], [1, 5], [1, 5], [1, 5]], [[3, 8], [3, 8], [1, 8], [1, 8]], [[1, 2], [1, 6], [1, 6], [1, 6]],
]

function statsPie(level, lang) {
  const set = pick(TALLY_SETS)
  const w = set[lang] ?? set.en
  const split = shuffle(pick(PIE_SPLITS))
  const lcm = split.reduce((m, [, d]) => (m * d) / gcd(m, d), 1)
  const total = lcm * pick([2, 3, 4, 5, 6, 8, 10].filter(k => lcm * k >= 20 && lcm * k <= 120))
  const labels = shuffle(w.rows).slice(0, split.length)
  const slices = split.map(([n, d], i) => ({ label: labels[i], n, d, count: (total * n) / d }))
  const i = randInt(0, slices.length - 1)
  const s = slices[i]
  const intro = say(lang, `The pie chart shows the ${w.what} of ${total} children.`,
                          `Daire grafiği ${total} çocuğun ${w.what} gösteriyor.`,
                          `El gráfico circular muestra la ${w.what} de ${total} niños.`)
  const visual = { kind: 'chart', shape: 'pie', slices: slices.map(({ label, n, d }) => ({ label, n, d })) }
  const ask = pick(['count', 'count', 'fraction', 'more'])
  const g = gcd(s.n, s.d)
  const frac = `${s.n / g}/${s.d / g}`
  const readHint = say(lang, 'The whole circle is all the children. A half is a straight line through the middle; a quarter is a right angle.',
                             'Bütün daire, çocukların hepsidir. Yarım, ortadan geçen düz çizgidir; çeyrek bir dik açıdır.',
                             'El círculo entero son todos los niños. La mitad es una línea recta por el centro; un cuarto es un ángulo recto.')
  if (ask === 'fraction') {
    const right = opt(frac, say(lang, 'Right.', 'Doğru.', 'Correcto.'))
    const wrongs = [...slices.filter(o => o.n * s.d !== s.n * o.d).map(o => { const k = gcd(o.n, o.d); return opt(`${o.n / k}/${o.d / k}`, say(lang, `That is the ${o.label} slice.`, `Bu, "${o.label}" diliminin kesri.`, `Esa es la porción de «${o.label}».`)) }),
      opt(`1/${slices.length}`, say(lang, 'The slices are not all the same size, so it is not one part in ' + slices.length + '.', `Dilimler eşit büyüklükte değil, yani ${slices.length} eşit parçadan biri değil.`, `Las porciones no son iguales, así que no es una de ${slices.length} partes.`)),
      // Common fractions of a circle as the remaining distractors, never one equal to the answer.
      ...shuffle([[1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 8], [3, 8], [2, 5], [3, 4]])
        .filter(([x, y]) => x * (s.d / g) !== (s.n / g) * y)
        .map(([x, y]) => opt(`${x}/${y}`, say(lang, 'Compare the slice with a half or a quarter of the circle.', 'Dilimi dairenin yarısı ya da çeyreğiyle karşılaştır.', 'Compara la porción con media o un cuarto del círculo.')))]
    return {
      topic: 'averages', level,
      question_text: say(lang, `${intro} What fraction of the children chose ${s.label}?`, `${intro} Çocukların ne kadarı "${s.label}" dedi?`, `${intro} ¿Qué fracción de los niños eligió «${s.label}»?`),
      format: 'choice', options: choiceOf(right, wrongs), correct_answer: frac, operandKey: `pie:f:${split.join('|')}:${i}`,
      hint_steps: [readHint, say(lang, 'How many slices that size would fill the whole circle?', 'O büyüklükte kaç dilim bütün daireyi doldurur?', '¿Cuántas porciones de ese tamaño llenarían el círculo?')],
      visual,
    }
  }
  if (ask === 'more') {
    const others = slices.filter(o => o.count !== s.count)
    if (!others.length) return statsPie(level, lang)
    const o = pick(others)
    const [hi, lo] = s.count > o.count ? [s, o] : [o, s]
    return {
      topic: 'averages', level,
      question_text: say(lang, `${intro} How many more chose ${hi.label} than ${lo.label}?`, `${intro} "${hi.label}" diyenler, "${lo.label}" diyenlerden kaç kişi fazla?`, `${intro} ¿Cuántos más eligieron «${hi.label}» que «${lo.label}»?`),
      format: 'numeric', correct_answer: hi.count - lo.count, operandKey: `pie:m:${total}:${split.join('|')}:${hi.label}:${lo.label}`,
      hint_steps: [readHint, say(lang, `Work out each slice as a fraction of ${total}, then find the difference.`, `Her dilimi ${total} sayısının bir kesri olarak hesapla, sonra farkı bul.`, `Calcula cada porción como fracción de ${total} y luego la diferencia.`)],
      visual,
    }
  }
  return {
    topic: 'averages', level,
    question_text: say(lang, `${intro} How many children chose ${s.label}?`, `${intro} Kaç çocuk "${s.label}" dedi?`, `${intro} ¿Cuántos niños eligieron «${s.label}»?`),
    format: 'numeric', correct_answer: s.count, operandKey: `pie:c:${total}:${split.join('|')}:${i}`,
    hint_steps: [readHint, say(lang, `Find what fraction of the circle the slice is, then take that fraction of ${total}.`, `Dilimin dairenin ne kadarı olduğunu bul, sonra ${total} sayısının o kadarını al.`, `Averigua qué fracción del círculo es la porción y calcula esa fracción de ${total}.`)],
    visual,
  }
}

// ── nets ──────────────────────────────────────────────────────────────────────
const NETS = ['cube', 'cuboid', 'prism', 'pyramid', 'cylinder', 'cone']
function geoNet(level, lang) {
  const name = pick(NETS)
  const nm = k => SOLIDS[k].name[lang] ?? SOLIDS[k].name.en
  const right = opt(nm(name), say(lang, 'Right.', 'Doğru.', 'Correcto.'))
  const why = {
    cube: say(lang, 'A cube folds from six squares all the same size.', 'Küp, eş büyüklükte altı kareden katlanır.', 'Un cubo se dobla con seis cuadrados iguales.'),
    cuboid: say(lang, 'A cuboid folds from six rectangles, in three matching pairs.', 'Dikdörtgenler prizması, üç eş çift hâlinde altı dikdörtgenden katlanır.', 'Un ortoedro se dobla con seis rectángulos, en tres parejas iguales.'),
    prism: say(lang, 'A triangular prism needs two triangles and three rectangles.', 'Üçgen prizma iki üçgen ve üç dikdörtgen ister.', 'Un prisma triangular necesita dos triángulos y tres rectángulos.'),
    pyramid: say(lang, 'A square-based pyramid is one square with four triangles.', 'Kare tabanlı piramit, bir kare ve dört üçgendir.', 'Una pirámide cuadrangular es un cuadrado con cuatro triángulos.'),
    cylinder: say(lang, 'A cylinder rolls up from a rectangle, with a circle at each end.', 'Silindir bir dikdörtgenin kıvrılmasıyla olur, iki ucunda birer daire vardır.', 'Un cilindro se enrolla desde un rectángulo, con un círculo en cada extremo.'),
    cone: say(lang, 'A cone is a curved piece like a fan, with one circle.', 'Koni, yelpaze gibi kıvrık bir parça ve bir daireden oluşur.', 'Un cono es una pieza curva como un abanico, con un círculo.'),
    sphere: say(lang, 'A sphere has no flat faces, so it has no net.', 'Kürenin düz yüzü yoktur, açınımı da yoktur.', 'Una esfera no tiene caras planas, así que no tiene desarrollo.'),
  }
  // The near misses first: cube against cuboid, prism against pyramid, cylinder against cone.
  const near = { cube: 'cuboid', cuboid: 'cube', prism: 'pyramid', pyramid: 'prism', cylinder: 'cone', cone: 'cylinder' }[name]
  const wrongs = [near, ...shuffle(Object.keys(SOLIDS).filter(k => k !== name && k !== near))].map(k => opt(nm(k), why[k]))
  return {
    topic: 'geometry', level,
    question_text: say(lang, 'This is a net. Which 3D shape does it fold up into?', 'Bu bir açınım. Katlanınca hangi cisim olur?', 'Esto es un desarrollo plano. ¿Qué cuerpo se forma al doblarlo?'),
    format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `net:${name}`,
    hint_steps: [
      say(lang, 'Count the faces and look at their shapes.', 'Yüzleri say ve şekillerine bak.', 'Cuenta las caras y mira qué forma tienen.'),
      say(lang, 'Imagine folding the outside pieces up to meet each other.', 'Dıştaki parçaları yukarı katlayıp birbirine değdirdiğini düşün.', 'Imagina que doblas las piezas de fuera hasta que se juntan.'),
    ],
    visual: { kind: 'net', name },
  }
}

// ── Venn and Carroll diagrams ─────────────────────────────────────────────────
// Sorting numbers by two properties — Bond 7-8 Papers 2, 7, 9, 22 and 8-9 tests 4, 7, 15.
// Asked as "which number goes in the shaded part?", with every wrong option telling the child
// which of the two tests it fails.
const TR_GEN = { 2: "2'nin", 3: "3'ün", 4: "4'ün", 5: "5'in", 6: "6'nın", 7: "7'nin", 8: "8'in", 9: "9'un", 10: "10'un" }
function sortProps(band) {
  const multiples = band <= 2 ? [2, 5, 10] : band === 3 ? [3, 4, 5, 8] : [3, 4, 6, 7, 9]
  const big = band <= 2 ? 30 : band === 3 ? 50 : 100
  const props = [
    { id: 'even', test: n => n % 2 === 0, en: 'Even numbers', tr: 'Çift sayılar', es: 'Números pares', not: { en: 'is odd', tr: 'tek', es: 'es impar' }, is: { en: 'is even', tr: 'çift', es: 'es par' } },
    { id: 'odd', test: n => n % 2 === 1, en: 'Odd numbers', tr: 'Tek sayılar', es: 'Números impares', not: { en: 'is even', tr: 'çift', es: 'es par' }, is: { en: 'is odd', tr: 'tek', es: 'es impar' } },
    ...multiples.map(k => ({ id: `m${k}`, test: n => n % k === 0, en: `Multiples of ${k}`, tr: `${TR_GEN[k]} katları`, es: `Múltiplos de ${k}`,
      not: { en: `is not a multiple of ${k}`, tr: `${TR_GEN[k]} katı değil`, es: `no es múltiplo de ${k}` }, is: { en: `is a multiple of ${k}`, tr: `${TR_GEN[k]} katı`, es: `es múltiplo de ${k}` } })),
    { id: `gt${big}`, test: n => n > big, en: `More than ${big}`, tr: `${big}'den büyük`.replace("50'den", "50'den").replace("100'den", "100'den").replace("30'den", "30'dan"), es: `Mayores que ${big}`,
      not: { en: `is not more than ${big}`, tr: `${big}'den büyük değil`.replace("30'den", "30'dan"), es: `no es mayor que ${big}` }, is: { en: `is more than ${big}`, tr: `${big}'den büyük`.replace("30'den", "30'dan"), es: `es mayor que ${big}` } },
  ]
  return { props, max: band <= 2 ? 60 : band === 3 ? 100 : 150 }
}

function dataSorting(level, lang) {
  const band = bandForLevel(level)
  const { props, max } = sortProps(band)
  let A, B
  do { [A, B] = shuffle(props).slice(0, 2) } while ((A.id === 'even' && B.id === 'odd') || (A.id === 'odd' && B.id === 'even')
    || (A.id === 'even' && B.id.startsWith('m') && Number(B.id.slice(1)) % 2 === 0) || (B.id === 'even' && A.id.startsWith('m') && Number(A.id.slice(1)) % 2 === 0)
    || (A.id.startsWith('m') && B.id.startsWith('m') && (Number(A.id.slice(1)) % Number(B.id.slice(1)) === 0 || Number(B.id.slice(1)) % Number(A.id.slice(1)) === 0)))
  const region = n => `${A.test(n) ? 1 : 0}${B.test(n) ? 1 : 0}`
  const buckets = { '11': [], '10': [], '01': [], '00': [] }
  // The threshold of "more than 50" is never an answer: the hint would have to name it.
  for (let n = 2; n <= max; n++) if (!props.some(p => p.id === `gt${n}`)) buckets[region(n)].push(n)
  if (Object.values(buckets).some(b => !b.length)) return dataSorting(level, lang)
  const target = pick(['11', '11', '10', '01', '00'])
  const answer = pick(buckets[target])
  const others = ['11', '10', '01', '00'].filter(k => k !== target).map(k => pick(buckets[k]))
  const L = p => p[lang] ?? p.en
  const describe = n => {
    const a = A.test(n) ? L(A.is) : L(A.not), b = B.test(n) ? L(B.is) : L(B.not)
    return say(lang, `${n} ${a} and ${b}.`, `${n}: ${a}, ${b}.`, `${n} ${a} y ${b}.`)
  }
  const right = opt(answer, describe(answer))
  const wrongs = others.map(n => opt(n, describe(n)))
  const carroll = Math.random() < 0.4
  const need = {
    '11': say(lang, `It has to be in both: ${L(A.is)} AND ${L(B.is)}.`, `İkisine birden uymalı: hem ${L(A.is)} hem ${L(B.is)}.`, `Tiene que cumplir las dos: ${L(A.is)} Y ${L(B.is)}.`),
    '10': say(lang, `It ${L(A.is)} but ${L(B.not)}.`, `${cap(L(A.is))} ama ${L(B.not)}.`, `${cap(L(A.is))} pero ${L(B.not)}.`),
    '01': say(lang, `It ${L(B.is)} but ${L(A.not)}.`, `${cap(L(B.is))} ama ${L(A.not)}.`, `${cap(L(B.is))} pero ${L(A.not)}.`),
    '00': say(lang, `It fits neither label: it ${L(A.not)} and ${L(B.not)}.`, `İki etikete de uymaz: ${L(A.not)} ve ${L(B.not)}.`, `No cumple ninguna: ${L(A.not)} y ${L(B.not)}.`),
  }[target]
  const visual = carroll
    ? { kind: 'carroll', cols: [L(B), say(lang, 'Others', 'Diğerleri', 'Los demás')], rows: [L(A), say(lang, 'Others', 'Diğerleri', 'Los demás')], cell: [target[0] === '1' ? 0 : 1, target[1] === '1' ? 0 : 1] }
    : { kind: 'venn', labels: [L(A), L(B)], shade: { '11': 'both', '10': 'left', '01': 'right', '00': 'outside' }[target] }
  return {
    topic: 'pictogram', level,
    question_text: carroll
      ? say(lang, 'Which number belongs in the shaded box?', 'Hangi sayı boyalı kutuya girer?', '¿Qué número va en la casilla coloreada?')
      : say(lang, 'Which number belongs in the shaded part?', 'Hangi sayı boyalı bölgeye girer?', '¿Qué número va en la parte coloreada?'),
    format: 'choice', options: choiceOf(right, wrongs, { sort: (x, y) => Number(x.value) - Number(y.value) }), correct_answer: right.value,
    operandKey: `sort:${carroll ? 'c' : 'v'}:${A.id}:${B.id}:${target}:${answer}`,
    hint_steps: [
      say(lang, 'Read both labels, then test each number against them one at a time.', 'İki etiketi oku, sonra her sayıyı tek tek ikisine göre dene.', 'Lee las dos etiquetas y comprueba cada número con ellas, uno por uno.'),
      need,
    ],
    visual,
  }
}

// ── a map: grid references and compass directions (Bond 7-8 Papers 1 and 8) ───
// Columns are letters and rows numbers, the way the book's treasure map names its squares, and
// a north arrow makes "which direction?" answerable from the picture.
const LANDMARKS = [
  { icon: '🏠', en: 'the house', tr: 'Ev', trAbl: 'evden', es: 'la casa' },
  { icon: '🌳', en: 'the tree', tr: 'Ağaç', trAbl: 'ağaçtan', es: 'el árbol' },
  { icon: '🏫', en: 'the school', tr: 'Okul', trAbl: 'okuldan', es: 'el colegio' },
  { icon: '🚩', en: 'the flag', tr: 'Bayrak', trAbl: 'bayraktan', es: 'la bandera' },
  { icon: '⛵', en: 'the boat', tr: 'Tekne', trAbl: 'tekneden', es: 'el barco' },
  { icon: '⛰️', en: 'the mountain', tr: 'Dağ', trAbl: 'dağdan', es: 'la montaña' },
]
function geoMap(level, lang) {
  const size = 5
  const marks = shuffle(LANDMARKS).slice(0, 4)
  const used = new Set()
  const pts = marks.map(m => {
    let x, y
    do { x = randInt(0, size - 1); y = randInt(0, size - 1) } while (used.has(`${x},${y}`))
    used.add(`${x},${y}`)
    return { ...m, x, y }
  })
  const ref = p => `${'ABCDE'[p.x]}${p.y + 1}`
  const nameOf = m => (lang === 'tr' ? m.tr.toLocaleLowerCase('tr') : m[lang] ?? m.en)
  const visual = { kind: 'coords', size, axes: false, compass: true, points: pts.map(p => ({ label: p.icon, x: p.x, y: p.y })) }
  // Direction needs two landmarks in the same row or column.
  const pairs = []
  for (const a of pts) for (const b of pts) if (a !== b && (a.x === b.x || a.y === b.y)) pairs.push([a, b])
  if (pairs.length && Math.random() < 0.5) {
    const [a, b] = pick(pairs)
    const dir = a.x === b.x ? (a.y > b.y ? 'N' : 'S') : (a.x > b.x ? 'E' : 'W')
    const names = { N: say(lang, 'North', 'Kuzey', 'Norte'), S: say(lang, 'South', 'Güney', 'Sur'), E: say(lang, 'East', 'Doğu', 'Este'), W: say(lang, 'West', 'Batı', 'Oeste') }
    const opposite = { N: 'S', S: 'N', E: 'W', W: 'E' }[dir]
    const right = opt(names[dir], say(lang, 'Right.', 'Doğru.', 'Correcto.'))
    const wrongs = [opt(names[opposite], say(lang, 'That is the way from the other one — swap them round.', 'Bu, ötekinden bakınca olan yön — yerlerini değiştirdin.', 'Esa es la dirección desde el otro: los has cambiado.')),
      ...['N', 'S', 'E', 'W'].filter(d => d !== dir && d !== opposite).map(d => opt(names[d], say(lang, 'Look at the north arrow: North is up the map.', 'Kuzey okuna bak: Kuzey haritanın yukarısıdır.', 'Mira la flecha del norte: el Norte está arriba.')))]
    return {
      topic: 'geometry', level,
      question_text: say(lang, `Which direction is ${a.en} (${a.icon}) from ${b.en} (${b.icon})?`,
                               `${a.tr} (${a.icon}), ${b.trAbl} (${b.icon}) hangi yönde?`,
                               `¿En qué dirección está ${a.es} (${a.icon}) desde ${b.es} (${b.icon})?`),
      format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `map:dir:${ref(a)}:${ref(b)}`,
      hint_steps: [
        say(lang, 'Put your finger on the second one, then move it to the first.', 'Parmağını ikincisine koy, sonra birinciye doğru götür.', 'Pon el dedo en el segundo y llévalo hasta el primero.'),
        say(lang, 'Up the map is North, down is South, right is East, left is West.', 'Haritada yukarı Kuzey, aşağı Güney, sağ Doğu, sol Batı.', 'En el mapa, arriba es Norte, abajo Sur, derecha Este e izquierda Oeste.'),
      ],
      visual,
    }
  }
  const target = pick(pts)
  const r = ref(target)
  const right = opt(r, say(lang, 'Right — letter along the bottom first, then number up the side.', 'Doğru — önce alttaki harf, sonra yandaki sayı.', 'Correcto: primero la letra de abajo y luego el número del lado.'))
  const swapped = `${'ABCDE'[target.y] ?? 'A'}${target.x + 1}`
  const wrongs = [opt(swapped, say(lang, 'Those are the wrong way round: the letter is the column along the bottom.', 'Ters okudun: harf, alttaki sütundur.', 'Están al revés: la letra es la columna de abajo.')),
    ...pts.filter(p => p !== target).map(p => opt(ref(p), say(lang, `That square has ${p.icon} in it.`, `O karede ${p.icon} var.`, `En esa casilla está ${p.icon}.`)))]
  return {
    topic: 'geometry', level,
    question_text: say(lang, `Which square is ${nameOf(target)} (${target.icon}) in?`, `${target.tr} (${target.icon}) hangi karede?`, `¿En qué casilla está ${target.es} (${target.icon})?`),
    format: 'choice', options: choiceOf(right, wrongs, { sort: (x, y) => x.value.localeCompare(y.value) }), correct_answer: r,
    operandKey: `map:ref:${pts.map(ref).join('')}:${r}`,
    hint_steps: [
      say(lang, 'Go down from the square to the letter at the bottom.', 'Kareden aşağı inip alttaki harfi bul.', 'Baja desde la casilla hasta la letra de abajo.'),
      say(lang, 'Then go across to the number at the side. Write the letter first.', 'Sonra yana gidip sayıyı bul. Önce harfi yaz.', 'Luego ve al lado hasta el número. Escribe primero la letra.'),
    ],
    visual,
  }
}

// ── a route map (Bond 7-8 Paper 8) ─────────────────────────────────────────────
const TOWNS = { en: ['Oakley', 'Brook', 'Hilton', 'Marsh', 'Ashby'], tr: ['Çamlık', 'Dereköy', 'Tepebaşı', 'Kavaklı', 'Ilıca'], es: ['Robledo', 'Fuentes', 'Olmos', 'Sierra', 'Vega'] }
function youngRoute(level, lang, add) {
  const band = bandForLevel(level)
  const towns = (TOWNS[lang] ?? TOWNS.en).slice(0, band <= 2 ? 4 : 5)
  const [lo, hi] = band <= 2 ? [5, 30] : [40, 260]
  // Every road a different length: "how much longer" needs two that differ, and a map of equal
  // legs made the pick below loop for ever.
  let legs
  do { legs = towns.slice(1).map(() => randInt(lo, hi)) } while (new Set(legs).size < legs.length)
  const visual = { kind: 'route', towns, legs, unit: 'km' }
  if (add) {
    const i = randInt(0, towns.length - 3), j = randInt(i + 2, Math.min(towns.length - 1, i + 3))
    const total = legs.slice(i, j).reduce((a, b) => a + b, 0)
    return {
      topic: 'addition', level,
      question_text: say(lang, `How far is it from ${towns[i]} to ${towns[j]} along the road?`, `Yol boyunca ${towns[i]} ile ${towns[j]} arası kaç km?`, `¿Qué distancia hay de ${towns[i]} a ${towns[j]} por la carretera?`),
      format: 'numeric', correct_answer: total, operandKey: `route:sum:${legs.join('-')}:${i}:${j}`,
      hint_steps: [say(lang, 'Follow the road from the first town to the second, stop by stop.', 'Yolu ilk kasabadan ikinciye durak durak takip et.', 'Sigue la carretera del primer pueblo al segundo, tramo a tramo.'),
                   say(lang, 'Add the distance of every part of the road you pass.', 'Geçtiğin her yol parçasının uzunluğunu topla.', 'Suma la distancia de cada tramo por el que pasas.')],
      visual,
    }
  }
  let i, j
  do { i = randInt(0, legs.length - 1); j = randInt(0, legs.length - 1) } while (i === j || legs[i] === legs[j])
  const [a, b] = legs[i] > legs[j] ? [i, j] : [j, i]
  return {
    topic: 'subtraction', level,
    question_text: say(lang, `How much longer is the road from ${towns[a]} to ${towns[a + 1]} than the road from ${towns[b]} to ${towns[b + 1]}?`,
                             `${towns[a]}–${towns[a + 1]} yolu, ${towns[b]}–${towns[b + 1]} yolundan kaç km daha uzun?`,
                             `¿Cuántos km más largo es el tramo de ${towns[a]} a ${towns[a + 1]} que el de ${towns[b]} a ${towns[b + 1]}?`),
    format: 'numeric', correct_answer: legs[a] - legs[b], operandKey: `route:diff:${legs.join('-')}:${a}:${b}`,
    hint_steps: [say(lang, 'Find both roads on the map and read their lengths.', 'İki yolu da haritada bul ve uzunluklarını oku.', 'Busca los dos tramos en el mapa y lee sus longitudes.'),
                 say(lang, '"How much longer" is the difference: take the shorter from the longer.', '"Ne kadar uzun" farkı sorar: kısayı uzundan çıkar.', '"Cuánto más largo" es la diferencia: resta el corto del largo.')],
    visual,
  }
}

// ── spinner probability (Bond 10-11) ──────────────────────────────────────────
const SPIN = { red: { en: 'red', tr: 'kırmızı', es: 'rojo' }, blue: { en: 'blue', tr: 'mavi', es: 'azul' }, green: { en: 'green', tr: 'yeşil', es: 'verde' }, yellow: { en: 'yellow', tr: 'sarı', es: 'amarillo' } }
function avgSpinner(level, lang) {
  const n = pick([4, 5, 6, 8, 10])
  const colours = shuffle(Object.keys(SPIN)).slice(0, pick([2, 3]))
  let sectors
  do { sectors = Array.from({ length: n }, () => pick(colours)) } while (colours.some(c => !sectors.includes(c)))
  const want = pick(colours)
  const k = sectors.filter(c => c === want).length
  const g = gcd(k, n)
  const correct = `${k / g}/${n / g}`
  const w = SPIN[want][lang] ?? SPIN[want].en
  const right = opt(correct, say(lang, `Right — ${k} of the ${n} equal parts are ${w}.`, `Doğru — ${n} eşit parçanın ${k} tanesi ${w}.`, `Correcto: ${k} de las ${n} partes iguales son ${w}.`))
  const wrongs = [
    opt(`${k}/${n - k}`, say(lang, `That compares ${w} with the other parts. A probability compares it with ALL of them.`, `Bu, ${w} parçaları diğerleriyle kıyaslıyor. Olasılık HEPSİYLE kıyaslar.`, `Eso compara el ${w} con las otras partes. La probabilidad lo compara con TODAS.`)),
    opt(`1/${colours.length}`, say(lang, `There are ${colours.length} colours, but they do not have the same number of parts.`, `${colours.length} renk var ama parça sayıları eşit değil.`, `Hay ${colours.length} colores, pero no tienen el mismo número de partes.`)),
    opt(`${n - k}/${n}`, say(lang, `That is the chance of NOT landing on ${w}.`, `Bu, ${w} gelmeme olasılığı.`, `Esa es la probabilidad de NO caer en ${w}.`)),
    opt(`1/${n}`, say(lang, `That is one part. Count every ${w} part.`, `Bu tek bir parça. Bütün ${w} parçaları say.`, `Eso es una parte. Cuenta todas las partes de ${w}.`)),
    ...[[k + 1, n], [k - 1, n], [k, n + 1]].map(([x, y]) => opt(`${x}/${y}`, say(lang, 'Count the parts again.', 'Parçaları yeniden say.', 'Vuelve a contar las partes.'))),
  ].filter(o => { const [x, y] = o.value.split('/').map(Number); return y > 0 && x > 0 && x < y && x * n !== k * y })
  return {
    topic: 'averages', level,
    question_text: say(lang, `The spinner is spun once. What is the probability that it lands on ${w}?`, `Çark bir kez çevriliyor. ${cap(w)} gelme olasılığı nedir?`, `Se gira la ruleta una vez. ¿Cuál es la probabilidad de que caiga en ${w}?`),
    format: 'choice', options: choiceOf(right, wrongs), correct_answer: correct, operandKey: `spin:${sectors.join('')}:${want}`,
    hint_steps: [say(lang, 'Count all the equal parts of the spinner — that is the bottom number.', 'Çarkın bütün eşit parçalarını say — bu alttaki sayıdır.', 'Cuenta todas las partes iguales de la ruleta: ese es el número de abajo.'),
                 say(lang, `Count the ${w} parts — that is the top number. Simplify if you can.`, `${cap(w)} parçaları say — bu üstteki sayıdır. Sadeleştirebiliyorsan sadeleştir.`, `Cuenta las partes de ${w}: ese es el número de arriba. Simplifica si puedes.`)],
    visual: { kind: 'spinner', sectors: sectors.map(c => ({ colour: c, label: SPIN[c][lang] ?? SPIN[c].en })) },
  }
}

// ── map scale (Bond 10-11) ────────────────────────────────────────────────────
function ratioMapScale(level, lang) {
  const cm = randInt(3, 9)
  const per = pick([2, 5, 10, 20, 25, 50])
  const [from, to] = shuffle(TOWNS[lang] ?? TOWNS.en).slice(0, 2)
  return {
    topic: 'ratio', level,
    question_text: say(lang, `Use the scale. How far apart are ${from} and ${to} in real life, in km?`, `Ölçeği kullan. ${from} ile ${to} arasındaki gerçek uzaklık kaç km?`, `Usa la escala. ¿A cuántos km están ${from} y ${to} en la realidad?`),
    format: 'numeric', correct_answer: cm * per, operandKey: `mapscale:${cm}:${per}`,
    hint_steps: [say(lang, 'Count the centimetres between the two places on the map.', 'Haritada iki yer arasındaki santimetreleri say.', 'Cuenta los centímetros entre los dos lugares del mapa.'),
                 say(lang, `Every centimetre on the map is ${per} km in real life.`, `Haritadaki her santimetre gerçekte ${per} km.`, `Cada centímetro del mapa son ${per} km en la realidad.`)],
    visual: { kind: 'mapscale', cm, per, from, to },
  }
}

// ── translating a point (Bond 10-11) ──────────────────────────────────────────
function geoTranslate(level, lang) {
  const size = 8
  let x, y, dx, dy
  do { x = randInt(1, 7); y = randInt(1, 7); dx = randInt(-4, 4); dy = randInt(-4, 4) } while (!dx || !dy || x + dx < 0 || x + dx > size || y + dy < 0 || y + dy > size || Math.abs(dx) === Math.abs(dy))
  const pair = (a, b) => `(${a}, ${b})`
  const moveX = dx > 0 ? say(lang, `${dx} to the right`, `${dx} sağa`, `${dx} a la derecha`) : say(lang, `${-dx} to the left`, `${-dx} sola`, `${-dx} a la izquierda`)
  const moveY = dy > 0 ? say(lang, `${dy} up`, `${dy} yukarı`, `${dy} hacia arriba`) : say(lang, `${-dy} down`, `${-dy} aşağı`, `${-dy} hacia abajo`)
  const right = opt(pair(x + dx, y + dy), say(lang, 'Right.', 'Doğru.', 'Correcto.'))
  const wrongs = [
    [x + dy, y + dx, say(lang, 'The two moves were swapped: left/right changes the first number, up/down the second.', 'İki hareket karıştı: sağ/sol ilk sayıyı, yukarı/aşağı ikinciyi değiştirir.', 'Has cambiado los movimientos: derecha/izquierda cambia el primer número y arriba/abajo el segundo.')],
    [x - dx, y + dy, say(lang, 'Check which way the across move goes.', 'Yatay hareketin yönünü kontrol et.', 'Comprueba hacia dónde va el movimiento horizontal.')],
    [x + dx, y - dy, say(lang, 'Check which way the up/down move goes.', 'Yukarı/aşağı hareketin yönünü kontrol et.', 'Comprueba hacia dónde va el movimiento vertical.')],
    [x, y, say(lang, 'That is where the point started.', 'Bu, noktanın başladığı yer.', 'Ahí es donde empezó el punto.')],
    ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([ex, ey]) => [x + dx + ex, y + dy + ey, say(lang, 'Count the squares moved again.', 'Gidilen kareleri yeniden say.', 'Vuelve a contar las casillas.')]),
  ].filter(([a, b]) => a >= 0 && b >= 0 && a <= size && b <= size).map(([a, b, w]) => opt(pair(a, b), w))
  return {
    topic: 'geometry', level,
    question_text: say(lang, `Point A moves ${moveX} and ${moveY}. What are its new coordinates?`, `A noktası ${moveX} ve ${moveY} gidiyor. Yeni koordinatları nedir?`, `El punto A se mueve ${moveX} y ${moveY}. ¿Cuáles son sus nuevas coordenadas?`),
    format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `translate:${x}:${y}:${dx}:${dy}`,
    hint_steps: [say(lang, `Read where A is now: along first, then up.`, `A'nın şimdi nerede olduğunu oku: önce yatay, sonra dikey.`, `Lee dónde está A ahora: primero horizontal y luego vertical.`),
                 say(lang, 'Moving right or left changes only the first number; up or down changes only the second.', 'Sağa/sola gitmek yalnız ilk sayıyı, yukarı/aşağı gitmek yalnız ikinciyi değiştirir.', 'Moverse a derecha o izquierda cambia solo el primer número; arriba o abajo, solo el segundo.')],
    visual: { kind: 'coords', size, points: [{ label: 'A', x, y }] },
  }
}

// A Turkish case ending after a number written in digits: "4'e", "11'in", "%20'si", "17½'si".
// The ending follows the last word the number is READ with (dört, on bir, yirmi, buçuk), which a
// fixed "'e" or "'nin" gets wrong for most numbers — "11'nin", "%20'ini" shipped that way.
const TR_UNITS = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz']
const TR_TENS = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan']
function trLastWord(v) {
  const s = String(v)
  if (s.includes('½')) return 'buçuk'
  const [ip, fp] = s.replace(',', '.').replace(/[−-]/, '').split('.')
  const m = Number(fp ?? ip)
  if (!m) return 'sıfır'
  if (m % 10) return TR_UNITS[m % 10]
  if (m % 100) return TR_TENS[(m % 100) / 10]
  if (m % 1000) return 'yüz'
  return m % 1e6 ? 'bin' : 'milyon'
}
export function trEk(v, kind) {
  const w = trLastWord(v)
  const vs = w.match(/[aeıioöuü]/g), last = vs[vs.length - 1]
  const endsV = /[aeıioöuü]$/.test(w), hard = /[çfhkpsşt]$/.test(w)
  const back = /[aıou]/.test(last), round = /[ouöü]/.test(last)
  const i4 = back ? (round ? 'u' : 'ı') : (round ? 'ü' : 'i'), a2 = back ? 'a' : 'e'
  const ek = {
    gen: `${endsV ? 'n' : ''}${i4}n`, acc: `${endsV ? 'y' : ''}${i4}`, dat: `${endsV ? 'y' : ''}${a2}`,
    loc: `${hard ? 't' : 'd'}${a2}`, abl: `${hard ? 't' : 'd'}${a2}n`, poss: `${endsV ? 's' : ''}${i4}`, possAcc: `${endsV ? 's' : ''}${i4}n${i4}`,
  }[kind]
  return `'${ek}`
}

// ══ Ages 11-12: the pictures of Bond's 11+-12+ 10 Minute Tests ═══════════════════════════════
// Year 7 was written from this book's WORDS: its square roots, lowest-terms ratios, unknowns on
// both sides and speed-distance-time were already here. What was not here is the half of the
// book that is a picture — a grid running into negative numbers with three corners of a
// rectangle on it, a triangle with its side pushed out past a corner, an L-shaped floor with two
// of its lengths missing, a function machine with an empty box, a cross of numbers adding to the
// same total both ways. Thirty tests, and each of those comes back several times.
//
// Left out on purpose: reflection and rotation (the NVR puzzles ask those), and everything the
// book asks the child to draw, sketch or explain in a sentence — nothing can mark those here.

const minus = n => (n < 0 ? `−${-n}` : String(n))
const pairOf = (x, y) => `(${minus(x)}, ${minus(y)})`

// ── a grid in four quadrants ───────────────────────────────────────────────────
// Three corners of a rectangle, a square or a parallelogram, and the fourth to find. The shape
// always reaches past an axis — the point of the question at this age is the negative numbers.
function planeVertex(level, lang) {
  const kind = pick(['rect', 'rect', 'square', 'para'])
  let P
  for (;;) {
    const x0 = randInt(-5, 1), y0 = randInt(-5, 1)
    if (kind === 'para') {
      const w = randInt(2, 4), h = randInt(2, 4), s = pick([-2, -1, 1, 2])
      P = [[x0, y0], [x0 + w, y0], [x0 + w + s, y0 + h], [x0 + s, y0 + h]]
    } else {
      const w = randInt(2, 6), h = kind === 'square' ? w : randInt(2, 6)
      if (kind === 'rect' && w === h) continue
      P = [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]]
    }
    if (P.some(([x, y]) => Math.abs(x) > 5 || Math.abs(y) > 5)) continue
    if (P.some(([x]) => x < 0) && P.some(([, y]) => y < 0) && P.some(([x]) => x > 0) && P.some(([, y]) => y > 0)) break
  }
  const miss = randInt(0, 3)
  const [A, B, C, D] = [1, 2, 3, 0].map(i => P[(miss + i) % 4])
  const name = say(lang, { rect: 'rectangle', square: 'square', para: 'parallelogram' }[kind],
    { rect: 'dikdörtgen', square: 'kare', para: 'paralelkenar' }[kind],
    { rect: 'rectángulo', square: 'cuadrado', para: 'paralelogramo' }[kind])
  const right = opt(pairOf(...D), say(lang, 'Right.', 'Doğru.', 'Correcto.'))
  const other = say(lang, 'That makes a different shape: D has to join to both A and C.', 'Bu başka bir şekil yapar: D hem A\'ya hem C\'ye bağlanmalı.', 'Eso forma otra figura: D tiene que unirse con A y con C.')
  const side = say(lang, 'Check which side of the axis D is on.', 'D\'nin eksenin hangi tarafında olduğunu kontrol et.', 'Comprueba a qué lado del eje está D.')
  const wrongs = [
    [D[1], D[0], say(lang, 'The numbers are swapped: across comes first, then up or down.', 'Sayıların yeri karıştı: önce yatay, sonra dikey.', 'Los números están al revés: primero horizontal, luego vertical.')],
    [A[0] + B[0] - C[0], A[1] + B[1] - C[1], other],
    [B[0] + C[0] - A[0], B[1] + C[1] - A[1], other],
    [-D[0], D[1], side], [D[0], -D[1], side],
    ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([ex, ey]) => [D[0] + ex, D[1] + ey, say(lang, 'Count the squares again.', 'Kareleri yeniden say.', 'Vuelve a contar las casillas.')]),
  ].filter(([x, y]) => (x !== D[0] || y !== D[1]) && Math.abs(x) <= 5 && Math.abs(y) <= 5).map(([x, y, w]) => opt(pairOf(x, y), w))
  return {
    topic: 'geometry', level,
    question_text: say(lang, `A, B and C are three corners of the ${name} ABCD. What are the coordinates of D?`,
      `ABCD bir ${name}; A, B ve C köşeleri işaretli. D'nin koordinatları nedir?`,
      `A, B y C son tres vértices del ${name} ABCD. ¿Cuáles son las coordenadas de D?`),
    format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value,
    operandKey: `plane:v:${kind}:${P.flat().join(',')}:${miss}`,
    hint_steps: [
      say(lang, 'Go from B to C and count: how many across, how many up or down?', 'B\'den C\'ye git ve say: kaç kare yatay, kaç kare yukarı ya da aşağı?', 'Ve de B a C y cuenta: ¿cuántas casillas en horizontal y cuántas arriba o abajo?'),
      say(lang, 'Make the same move starting from A — that is where D is.', 'Aynı hareketi A\'dan başlayarak yap — D orada.', 'Haz el mismo movimiento empezando en A: ahí está D.'),
    ],
    visual: { kind: 'plane', min: -5, max: 5, points: [['A', A], ['B', B], ['C', C]].map(([label, [x, y]]) => ({ label, x, y })), path: [A, B, C] },
  }
}

// Four points joined in order, and the best name for what they make. "Best" matters: a square is
// a rectangle and a rhombus is a kite, so no wrong option is ever a family the right answer
// belongs to — and a square is never the answer, because every other name would then be true.
const QUADS = {
  rect: { en: 'rectangle', tr: 'dikdörtgen', es: 'rectángulo', is: { en: 'four right angles and its opposite sides equal', tr: 'dört dik açı ve eşit karşılıklı kenarlar', es: 'cuatro ángulos rectos y los lados opuestos iguales' } },
  square: { en: 'square', tr: 'kare', es: 'cuadrado', is: { en: 'four equal sides AND four right angles', tr: 'dört eşit kenar VE dört dik açı', es: 'cuatro lados iguales Y cuatro ángulos rectos' } },
  rhombus: { en: 'rhombus', tr: 'eşkenar dörtgen', es: 'rombo', is: { en: 'four equal sides', tr: 'dört eşit kenar', es: 'cuatro lados iguales' } },
  kite: { en: 'kite', tr: 'deltoid', es: 'cometa', is: { en: 'two pairs of equal sides that sit next to each other', tr: 'yan yana duran iki çift eşit kenar', es: 'dos pares de lados iguales que están uno junto al otro' } },
  para: { en: 'parallelogram', tr: 'paralelkenar', es: 'paralelogramo', is: { en: 'two pairs of parallel sides', tr: 'iki çift paralel kenar', es: 'dos pares de lados paralelos' } },
  trap: { en: 'trapezium', tr: 'yamuk', es: 'trapecio', is: { en: 'only one pair of parallel sides', tr: 'yalnız bir çift paralel kenar', es: 'un solo par de lados paralelos' } },
}
const QUAD_WRONG = { rect: ['square', 'rhombus', 'kite', 'trap'], rhombus: ['square', 'rect', 'trap'], kite: ['rhombus', 'para', 'trap', 'rect'], para: ['rhombus', 'rect', 'trap', 'kite'], trap: ['para', 'kite', 'rect', 'rhombus'] }

function planeShape(level, lang) {
  const kind = pick(Object.keys(QUAD_WRONG))
  let P
  for (;;) {
    if (kind === 'rect') { const w = randInt(2, 7), h = randInt(2, 6); if (w === h) continue; P = [[0, 0], [w, 0], [w, h], [0, h]] }
    else if (kind === 'rhombus') { const a = randInt(1, 4), b = randInt(2, 5); if (a === b) continue; P = [[0, b], [a, 0], [0, -b], [-a, 0]] }
    else if (kind === 'kite') { const a = randInt(1, 3), t = randInt(1, 3), u = randInt(3, 6); if (t === u) continue; P = [[0, t], [a, 0], [0, -u], [-a, 0]] }
    else if (kind === 'para') { const w = randInt(3, 6), h = randInt(2, 5), s = pick([-3, -2, -1, 1, 2, 3]); if (w * w === s * s + h * h) continue; P = [[0, 0], [w, 0], [w + s, h], [s, h]] }
    else { const w = randInt(4, 8), h = randInt(2, 5), a = randInt(0, 3), b = randInt(1, 3); if (w - a - b < 1 || a === b) continue; P = [[0, 0], [w, 0], [w - b, h], [a, h]] }
    const xs = P.map(p => p[0]), ys = P.map(p => p[1])
    const dx = randInt(-5 - Math.min(...xs), 5 - Math.max(...xs)), dy = randInt(-5 - Math.min(...ys), 5 - Math.max(...ys))
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue
    const Q = P.map(([x, y]) => [x + dx, y + dy])
    if (Q.some(([x, y]) => Math.abs(x) > 5 || Math.abs(y) > 5)) continue
    if (!Q.some(([x]) => x < 0) || !Q.some(([, y]) => y < 0)) continue
    P = Q; break
  }
  const start = randInt(0, 3)
  const pts = [0, 1, 2, 3].map(i => P[(start + i) % 4])
  const nameOf = k => pickL(QUADS[k], lang)
  const right = opt(nameOf(kind), say(lang, 'Right.', 'Doğru.', 'Correcto.'))
  const wrongs = shuffle(QUAD_WRONG[kind]).map(k => opt(nameOf(k), say(lang,
    `A ${QUADS[k].en} has ${QUADS[k].is.en}. Check the sides of this one.`,
    `${cap(QUADS[k].tr)}: ${QUADS[k].is.tr}. Bu şeklin kenarlarına bak.`,
    `${k === 'kite' ? 'Una' : 'Un'} ${QUADS[k].es} tiene ${QUADS[k].is.es}. Mira los lados de esta figura.`)))
  const list = pts.map(p => pairOf(...p)).join(', ')
  return {
    topic: 'geometry', level,
    question_text: say(lang, `The points ${list} are joined in that order. What is the best name for the shape they make?`,
      `${list} noktaları bu sırayla birleştiriliyor. Oluşan şeklin en doğru adı nedir?`,
      `Se unen los puntos ${list} en ese orden. ¿Cuál es el nombre más exacto de la figura que forman?`),
    format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value,
    operandKey: `plane:s:${kind}:${pts.flat().join(',')}`,
    hint_steps: [
      say(lang, 'Join the points on the grid in order, then back to the first.', 'Noktaları ızgarada sırayla birleştir, sonra ilkine dön.', 'Une los puntos en orden en la cuadrícula y vuelve al primero.'),
      say(lang, 'Now look for sides that are parallel, sides that are equal and right angles.', 'Şimdi paralel kenarlara, eşit kenarlara ve dik açılara bak.', 'Ahora busca lados paralelos, lados iguales y ángulos rectos.'),
    ],
    visual: { kind: 'plane', min: -5, max: 5, points: pts.map(([x, y], i) => ({ label: 'ABCD'[i], x, y })) },
  }
}

// A triangle slid across the axes. Moving a whole shape is moving each corner the same way, and
// the new corner may land in another quadrant — the reason the question lives on this grid.
function planeTranslate(level, lang) {
  let T, dx, dy, k
  for (;;) {
    const x = randInt(-4, 2), y = randInt(-4, 2)
    T = [[x, y], [x + randInt(2, 4), y], [x + randInt(0, 3), y + randInt(2, 4)]]
    dx = pick([-4, -3, -2, 2, 3, 4]); dy = pick([-4, -3, -2, 2, 3, 4])
    if (Math.abs(dx) === Math.abs(dy)) continue
    const all = [...T, ...T.map(([a, b]) => [a + dx, b + dy])]
    if (all.some(([a, b]) => Math.abs(a) > 5 || Math.abs(b) > 5)) continue
    // The corner asked about must cross an axis, or the negative numbers never come into it.
    k = randInt(0, 2)
    const [cx, cy] = T[k]
    if ((cx > 0) !== (cx + dx > 0) || (cy > 0) !== (cy + dy > 0)) break
  }
  const [x, y] = T[k]
  const moveX = dx > 0 ? say(lang, `${dx} to the right`, `${dx} birim sağa`, `${dx} a la derecha`) : say(lang, `${-dx} to the left`, `${-dx} birim sola`, `${-dx} a la izquierda`)
  const moveY = dy > 0 ? say(lang, `${dy} up`, `${dy} birim yukarı`, `${dy} hacia arriba`) : say(lang, `${-dy} down`, `${-dy} birim aşağı`, `${-dy} hacia abajo`)
  const corner = 'ABC'[k]
  const right = opt(pairOf(x + dx, y + dy), say(lang, 'Right.', 'Doğru.', 'Correcto.'))
  const wrongs = [
    [x + dy, y + dx, say(lang, 'The two moves were swapped: left/right changes the first number, up/down the second.', 'İki hareket karıştı: sağ/sol ilk sayıyı, yukarı/aşağı ikinciyi değiştirir.', 'Has cambiado los movimientos: derecha/izquierda cambia el primer número y arriba/abajo el segundo.')],
    [x - dx, y + dy, say(lang, 'Check which way the across move goes.', 'Yatay hareketin yönünü kontrol et.', 'Comprueba hacia dónde va el movimiento horizontal.')],
    [x + dx, y - dy, say(lang, 'Check which way the up/down move goes.', 'Yukarı/aşağı hareketin yönünü kontrol et.', 'Comprueba hacia dónde va el movimiento vertical.')],
    [-(x + dx), y + dy, say(lang, 'Watch the minus sign when you cross the axis.', 'Ekseni geçerken eksi işaretine dikkat et.', 'Cuidado con el signo menos al cruzar el eje.')],
    [x + dx, -(y + dy), say(lang, 'Watch the minus sign when you cross the axis.', 'Ekseni geçerken eksi işaretine dikkat et.', 'Cuidado con el signo menos al cruzar el eje.')],
    ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([ex, ey]) => [x + dx + ex, y + dy + ey, say(lang, 'Count the squares moved again.', 'Gidilen kareleri yeniden say.', 'Vuelve a contar las casillas.')]),
  ].filter(([a, b]) => (a !== x + dx || b !== y + dy) && Math.abs(a) <= 5 && Math.abs(b) <= 5).map(([a, b, w]) => opt(pairOf(a, b), w))
  return {
    topic: 'geometry', level,
    question_text: say(lang, `The triangle is moved ${moveX} and ${moveY}. What are the new coordinates of corner ${corner}?`,
      `Üçgen ${moveX} ve ${moveY} kaydırılıyor. ${corner} köşesinin yeni koordinatları nedir?`,
      `El triángulo se desplaza ${moveX} y ${moveY}. ¿Cuáles son las nuevas coordenadas del vértice ${corner}?`),
    format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value,
    operandKey: `plane:t:${T.flat().join(',')}:${dx}:${dy}:${k}`,
    hint_steps: [
      say(lang, `Read where ${corner} is now: across first, then up or down.`, `${corner} köşesinin şimdi nerede olduğunu oku: önce yatay, sonra dikey.`, `Lee dónde está ${corner} ahora: primero horizontal y luego vertical.`),
      say(lang, 'Right or left changes only the first number; up or down only the second. Below zero the numbers carry a minus.', 'Sağ/sol yalnız ilk sayıyı, yukarı/aşağı yalnız ikinciyi değiştirir. Sıfırın altında sayılar eksi olur.', 'Derecha o izquierda cambia solo el primer número; arriba o abajo, solo el segundo. Por debajo de cero llevan un menos.'),
    ],
    visual: { kind: 'plane', min: -5, max: 5, points: T.map(([a, b], i) => ({ label: 'ABC'[i], x: a, y: b })), path: [...T, T[0]] },
  }
}

// Points on a straight line and the rule they follow — Bond's "write the equation that
// represents the coordinates plotted". Every wrong rule offered fails on a point that is drawn,
// and says which one.
const ruleText = (m, c) => `y = ${m === 1 ? '' : m}x${c > 0 ? ` + ${c}` : c < 0 ? ` − ${-c}` : ''}`

function planeRule(level, lang) {
  const [m, c] = pick([[1, 1], [1, 2], [1, 3], [1, -1], [1, -2], [2, 0], [2, 1], [2, -1], [3, 0], [1, 0]])
  const xs = []
  for (let x = 0; x <= 8 && xs.length < 5; x++) { const y = m * x + c; if (y >= 0 && y <= 8) xs.push(x) }
  const pts = xs.map(x => ({ x, y: m * x + c }))
  const right = opt(ruleText(m, c), say(lang, 'Right.', 'Doğru.', 'Correcto.'))
  const pool = [[1, 0], [1, 1], [1, 2], [1, 3], [1, -1], [1, -2], [2, 0], [2, 1], [2, -1], [3, 0], [3, -1]]
    .filter(([a, b]) => a !== m || b !== c)
    .map(([a, b]) => ({ a, b, bad: pts.find(p => a * p.x + b !== p.y) }))
    .filter(r => r.bad)
    .sort((r, s) => (Math.abs(r.a - m) * 3 + Math.abs(r.b - c)) - (Math.abs(s.a - m) * 3 + Math.abs(s.b - c)))
  const wrongs = pool.slice(0, 5).map(({ a, b, bad }) => opt(ruleText(a, b), say(lang,
    `Try it on the point (${bad.x}, ${bad.y}): when x is ${bad.x} this rule gives ${a * bad.x + b}, not ${bad.y}.`,
    `(${bad.x}, ${bad.y}) noktasında dene: x ${bad.x} iken bu kural ${a * bad.x + b} verir, ${bad.y} değil.`,
    `Pruébala con el punto (${bad.x}, ${bad.y}): cuando x vale ${bad.x}, esta regla da ${a * bad.x + b}, no ${bad.y}.`)))
  return {
    topic: 'algebra', level,
    question_text: say(lang, 'The points lie on a straight line. Which rule do they follow?', 'Noktalar bir doğru üzerinde. Hangi kurala uyuyorlar?', 'Los puntos están en una recta. ¿Qué regla siguen?'),
    format: 'choice', options: choiceOf(right, shuffle(wrongs).slice(0, 3)), correct_answer: right.value,
    operandKey: `plane:r:${m}:${c}`,
    hint_steps: [
      say(lang, 'Write the points as pairs: (x, y).', 'Noktaları çift olarak yaz: (x, y).', 'Escribe los puntos como pares: (x, y).'),
      say(lang, 'What do you do to x to get y? It has to work for every point, not just one.', 'x\'e ne yapınca y çıkıyor? Tek bir noktada değil, hepsinde işe yaramalı.', '¿Qué le haces a x para obtener y? Tiene que funcionar con todos los puntos, no solo con uno.'),
    ],
    visual: { kind: 'plane', min: 0, max: 8, points: pts.map(p => ({ ...p, label: '' })) },
  }
}

// ── angle diagrams ─────────────────────────────────────────────────────────────
// The book's angle questions are all pictures: a side pushed out past a corner, two sides
// marked equal, two lines crossing, two equal angles either side of a known one. Drawn to the
// real angles; the letters are what is asked.
function angleDiagram(level, lang) {
  const type = pick(['exterior', 'exterior', 'exteriorBack', 'isosceles', 'isosceles', 'opposite', 'lineTwo'])
  const straight = say(lang, 'Angles on a straight line add up to 180°.', 'Bir doğru üzerindeki açılar toplamı 180°\'dir.', 'Los ángulos sobre una recta suman 180°.')
  const inside = say(lang, 'The angles inside a triangle add up to 180°.', 'Üçgenin iç açıları toplamı 180°\'dir.', 'Los ángulos de un triángulo suman 180°.')
  const q = say(lang, 'What is the size of the angle marked ?', '? ile gösterilen açı kaç derecedir?', '¿Cuánto mide el ángulo marcado con ?')
  let v, answer, hints
  if (type === 'exterior' || type === 'exteriorBack') {
    let a, b, c
    do { a = randInt(30, 75); b = randInt(35, 95); c = 180 - a - b } while (c < 30 || c > 80)
    if (type === 'exterior') {
      v = { kind: 'angles', type: 'triangle', a, c, labels: { a: `${a}°`, b: `${b}°`, ext: '?' } }
      answer = a + b
      hints = [inside, say(lang, 'Find the angle inside at that corner first; it and ? make a straight line.', 'Önce o köşedeki iç açıyı bul; o açı ile ? bir doğru oluşturur.', 'Primero halla el ángulo interior de esa esquina; con ? forma una recta.')]
    } else {
      v = { kind: 'angles', type: 'triangle', a, c, labels: { a: `${a}°`, b: '?', ext: `${180 - c}°` } }
      answer = b
      hints = [straight, say(lang, 'The outside angle tells you the inside angle next to it. Then use the triangle.', 'Dış açı, yanındaki iç açıyı verir. Sonra üçgeni kullan.', 'El ángulo exterior te da el interior de al lado. Luego usa el triángulo.')]
    }
  } else if (type === 'isosceles') {
    const apex = randInt(10, 70) * 2
    const base = (180 - apex) / 2
    const askBase = Math.random() < 0.6
    v = { kind: 'angles', type: 'triangle', a: base, c: base, ticks: true, labels: askBase ? { b: `${apex}°`, c: '?' } : { a: `${base}°`, b: '?' } }
    answer = askBase ? base : apex
    hints = [say(lang, 'The two sides with a mark are equal, so the two angles at the bottom are equal too.', 'İşaretli iki kenar eşit, bu yüzden alttaki iki açı da eşit.', 'Los dos lados marcados son iguales, así que los dos ángulos de abajo también lo son.'), inside]
  } else if (type === 'opposite') {
    const a = randInt(28, 76) * 2 + (Math.random() < 0.5 ? 1 : 0)
    v = { kind: 'angles', type: 'cross', a, labels: { top: `${a}°`, bottom: `${a}°`, left: '?' } }
    answer = 180 - a
    hints = [straight, say(lang, 'The ? and the angle above it sit side by side on one straight line.', '? ile üstündeki açı aynı doğru üzerinde yan yana.', 'El ? y el ángulo de arriba están uno al lado del otro sobre una recta.')]
  } else {
    const m = randInt(20, 70) * 2
    v = { kind: 'angles', type: 'line', m, labels: { m: `${m}°`, left: '?', right: '?' } }
    answer = (180 - m) / 2
    hints = [straight, say(lang, 'Take the known angle away from 180°, then share what is left between the two equal angles.', 'Bilinen açıyı 180°\'den çıkar, kalanı iki eşit açıya paylaştır.', 'Resta el ángulo conocido de 180° y reparte lo que queda entre los dos ángulos iguales.')]
  }
  return {
    topic: 'geometry', level,
    question_text: type === 'lineTwo'
      ? say(lang, 'The two angles marked ? are equal. What size is each one?', '? ile gösterilen iki açı eşit. Her biri kaç derecedir?', 'Los dos ángulos marcados con ? son iguales. ¿Cuánto mide cada uno?')
      : q,
    format: 'numeric', correct_answer: answer,
    operandKey: `angd:${type}:${JSON.stringify(v.labels)}:${v.a ?? v.m}:${v.c ?? ''}`,
    hint_steps: hints, visual: v,
  }
}

// ── compound shapes ─────────────────────────────────────────────────────────────
// An L-shaped floor with two of its lengths left off, or a rectangle with a corner cut out and
// the rest shaded. The book's version is a floor in millimetres; the missing lengths are the
// half of the question that is not multiplication.
function compoundArea(level, lang) {
  const mm = bandForLevel(level) >= 7 && Math.random() < 0.3
  const unit = mm ? 'mm' : 'cm'
  const k = mm ? 4 : 1
  let W, H, cw, ch
  do {
    W = randInt(10, 24); H = randInt(8, 20); cw = randInt(3, W - 3); ch = randInt(3, H - 3)
  } while (cw * 2 === W || ch * 2 === H)
  W *= k; H *= k; cw *= k; ch *= k
  const style = Math.random() < 0.6 ? 'L' : 'cut'
  const perimeter = style === 'L' && Math.random() < 0.25
  const answer = perimeter ? 2 * (W + H) : W * H - cw * ch
  return {
    topic: 'geometry', level,
    question_text: style === 'cut'
      ? say(lang, `A small rectangle is cut from the corner of a big one. What is the area of the shaded part, in ${unit}²?`,
        `Büyük bir dikdörtgenin köşesinden küçük bir dikdörtgen kesiliyor. Taralı kısmın alanı kaç ${unit}²?`,
        `Se recorta un rectángulo pequeño de la esquina de uno grande. ¿Cuál es el área de la parte sombreada, en ${unit}²?`)
      : perimeter
        ? say(lang, `All the corners of this shape are right angles. What is its perimeter, in ${unit}?`, `Bu şeklin bütün köşeleri dik açı. Çevresi kaç ${unit}?`, `Todas las esquinas de esta figura son ángulos rectos. ¿Cuál es su perímetro, en ${unit}?`)
        : say(lang, `All the corners of this shape are right angles. What is its area, in ${unit}²?`, `Bu şeklin bütün köşeleri dik açı. Alanı kaç ${unit}²?`, `Todas las esquinas de esta figura son ángulos rectos. ¿Cuál es su área, en ${unit}²?`),
    format: 'numeric', correct_answer: answer,
    operandKey: `cmp:${style}:${perimeter ? 'p' : 'a'}:${W}:${H}:${cw}:${ch}`,
    hint_steps: perimeter
      ? [say(lang, 'Two sides have no number. Each is the whole side opposite minus the part you know.', 'İki kenarın sayısı yok. Her biri, karşısındaki bütün kenardan bildiğin parça çıkarılarak bulunur.', 'Dos lados no tienen número. Cada uno es el lado entero de enfrente menos la parte que conoces.'),
         say(lang, 'Then add all six sides.', 'Sonra altı kenarın hepsini topla.', 'Después suma los seis lados.')]
      : [say(lang, 'Think of the whole rectangle, then take away the corner that is missing.', 'Bütün dikdörtgeni düşün, sonra eksik köşeyi çıkar.', 'Piensa en el rectángulo entero y quita la esquina que falta.'),
         style === 'L'
           ? say(lang, 'The missing corner\'s sides are the whole side minus the part that is written.', 'Eksik köşenin kenarları, bütün kenardan yazılı parçanın çıkarılmasıyla bulunur.', 'Los lados de la esquina que falta son el lado entero menos la parte escrita.')
           : say(lang, 'Area of a rectangle: one side times the other.', 'Dikdörtgenin alanı: bir kenar çarpı diğeri.', 'Área de un rectángulo: un lado por el otro.')],
    visual: { kind: 'compound', style, W, H, cw, ch, unit },
  }
}

// ── solids beyond the cube ───────────────────────────────────────────────────────
const SOLIDS_OLD = {
  tetra: { faces: 4, edges: 6, vertices: 4, name: { en: 'tetrahedron', tr: 'dörtyüzlü', es: 'tetraedro' }, near: ['pyramid', 'prism', 'octa'] },
  octa: { faces: 8, edges: 12, vertices: 6, name: { en: 'octahedron', tr: 'sekizyüzlü', es: 'octaedro' }, near: ['pyramid', 'tetra', 'hexprism'] },
  prism: { faces: 5, edges: 9, vertices: 6, name: { en: 'triangular prism', tr: 'üçgen prizma', es: 'prisma triangular' }, near: ['tetra', 'pyramid', 'pentprism'] },
  pyramid: { faces: 5, edges: 8, vertices: 5, name: { en: 'square-based pyramid', tr: 'kare tabanlı piramit', es: 'pirámide cuadrangular' }, near: ['tetra', 'prism', 'octa'] },
  pentprism: { faces: 7, edges: 15, vertices: 10, name: { en: 'pentagonal prism', tr: 'beşgen prizma', es: 'prisma pentagonal' }, near: ['hexprism', 'prism', 'pyramid'] },
  hexprism: { faces: 8, edges: 18, vertices: 12, name: { en: 'hexagonal prism', tr: 'altıgen prizma', es: 'prisma hexagonal' }, near: ['pentprism', 'octa', 'prism'] },
}

function solidOlder(level, lang) {
  const name = pick(Object.keys(SOLIDS_OLD))
  const s = SOLIDS_OLD[name]
  if (Math.random() < 0.35) {
    const right = opt(pickL(s.name, lang), say(lang, 'Right.', 'Doğru.', 'Correcto.'))
    const wrongs = s.near.map(k => opt(pickL(SOLIDS_OLD[k].name, lang), say(lang,
      `${k === 'octa' ? 'An' : 'A'} ${SOLIDS_OLD[k].name.en} has ${SOLIDS_OLD[k].faces} faces. Count the faces of this one.`,
      `${cap(SOLIDS_OLD[k].name.tr)}: ${SOLIDS_OLD[k].faces} yüz. Bu cismin yüzlerini say.`,
      `${k === 'pyramid' ? 'Una' : 'Un'} ${SOLIDS_OLD[k].name.es} tiene ${SOLIDS_OLD[k].faces} caras. Cuenta las caras de este.`)))
    return {
      topic: 'geometry', level,
      question_text: say(lang, 'What is the name of this 3D shape?', 'Bu cismin adı nedir?', '¿Cómo se llama este cuerpo geométrico?'),
      format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `solid3:name:${name}`,
      hint_steps: [say(lang, 'Look at the faces: what shapes are they, and how many are there?', 'Yüzlere bak: hangi şekiller ve kaç tane?', 'Mira las caras: ¿qué formas tienen y cuántas hay?'),
                   say(lang, 'A prism is the same all the way through; a pyramid comes to a point.', 'Prizma baştan sona aynıdır; piramit bir noktada birleşir.', 'Un prisma es igual de principio a fin; una pirámide acaba en punta.')],
      visual: { kind: 'solid', name },
    }
  }
  const what = pick(['faces', 'edges', 'vertices'])
  const word = say(lang, what, { faces: 'yüzü', edges: 'ayrıtı', vertices: 'köşesi' }[what], { faces: 'caras', edges: 'aristas', vertices: 'vértices' }[what])
  const many = lang === 'es' && what !== 'vertices' ? 'Cuántas' : 'Cuántos'
  return {
    topic: 'geometry', level,
    question_text: say(lang, `How many ${word} does this shape have?`, `Bu cismin kaç ${word} var?`, `¿${many} ${word} tiene este cuerpo?`),
    format: 'numeric', correct_answer: s[what], operandKey: `solid3:${what}:${name}`,
    hint_steps: [say(lang, 'The dashed lines are the edges at the back that you cannot see.', 'Kesik çizgiler arkada kalan, göremediğin ayrıtlar.', 'Las líneas discontinuas son las aristas de atrás que no se ven.'),
                 what === 'faces'
                   ? say(lang, 'Count the top and bottom, then the faces around the side.', 'Önce alt ve üst, sonra yan yüzleri say.', 'Cuenta la de arriba y la de abajo, y luego las de alrededor.')
                   : what === 'edges'
                     ? say(lang, 'Count the edges round the top, round the bottom, then the ones joining them.', 'Üstteki, alttaki, sonra ikisini birleştiren ayrıtları say.', 'Cuenta las aristas de arriba, las de abajo y luego las que las unen.')
                     : say(lang, 'Count the corners at the top, then at the bottom.', 'Önce üstteki, sonra alttaki köşeleri say.', 'Cuenta las esquinas de arriba y luego las de abajo.')],
    visual: { kind: 'solid', name },
  }
}

// ── function machines ─────────────────────────────────────────────────────────────
const opSym = { mul: '×', div: '÷', add: '+', sub: '−' }
const applyOp = ([o, k], n) => (o === 'mul' ? n * k : o === 'div' ? n / k : o === 'add' ? n + k : n - k)
const opText = ([o, k]) => `${opSym[o]} ${k}`

// The empty box: two numbers go in, two come out, and one of the two steps is missing. Two
// pairs, not one — with a single pair "7 → ? → +9 → 30" is × 3 and + 14 both, and the book's
// own answer key only accepts one.
function machineMissing(level, lang) {
  for (;;) {
    const first = pick([['mul', randInt(2, 6)], ['add', randInt(3, 15)], ['sub', randInt(2, 9)]])
    const second = pick([['add', randInt(2, 12)], ['sub', randInt(2, 9)], ['mul', randInt(2, 4)]])
    if (first[0] === second[0]) continue
    const i1 = randInt(3, 12), i2 = i1 + randInt(2, 5)
    const outs = [i1, i2].map(n => applyOp(second, applyOp(first, n)))
    if (outs.some(o => o <= 0) || [i1, i2].some(n => applyOp(first, n) <= 0)) continue
    const askFirst = Math.random() < 0.5
    const ops = askFirst ? [null, opText(second)] : [opText(first), null]
    const truth = askFirst ? first : second
    const mid1 = applyOp(first, i1)
    // Wrong steps that fit the first pair and not the second, plus the inverse.
    const fromIn = askFirst ? i1 : mid1
    const toOut = askFirst ? mid1 : outs[0]
    const cands = [
      toOut > fromIn ? ['add', toOut - fromIn] : ['sub', fromIn - toOut],
      toOut % fromIn === 0 && toOut / fromIn > 1 ? ['mul', toOut / fromIn] : null,
      truth[0] === 'mul' ? ['add', truth[1]] : truth[0] === 'add' ? ['mul', truth[1]] : ['add', truth[1]],
      [truth[0], truth[1] + 1], [truth[0], Math.max(2, truth[1] - 1)],
    ].filter(Boolean)
    const run = (op, n) => (askFirst ? applyOp(second, applyOp(op, n)) : applyOp(op, applyOp(first, n)))
    const wrongs = cands.filter(op => opText(op) !== opText(truth) && (run(op, i1) !== outs[0] || run(op, i2) !== outs[1]))
      .map(op => {
        const bad = run(op, i1) !== outs[0] ? [i1, outs[0]] : [i2, outs[1]]
        const got = run(op, bad[0])
        return opt(opText(op), say(lang, `Try it with ${bad[0]}: that gives ${got}, but the machine gives ${bad[1]}.`,
          `${bad[0]} ile dene: ${got} çıkar, ama makineden ${bad[1]} çıkıyor.`,
          `Pruébalo con ${bad[0]}: da ${got}, pero la máquina da ${bad[1]}.`))
      })
    if (wrongs.length < 2) continue
    const right = opt(opText(truth), say(lang, 'Right.', 'Doğru.', 'Correcto.'))
    return {
      topic: 'sequence', level,
      question_text: say(lang, 'Both numbers go through the same machine. What goes in the empty box?', 'İki sayı da aynı makineden geçiyor. Boş kutuya ne gelir?', 'Los dos números pasan por la misma máquina. ¿Qué va en la caja vacía?'),
      format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value,
      operandKey: `mach:miss:${opText(first)}:${opText(second)}:${i1}:${i2}:${askFirst ? 1 : 2}`,
      hint_steps: [
        askFirst
          ? say(lang, 'Undo the second box first: work backwards from each output.', 'Önce ikinci kutuyu geri al: her çıkıştan geriye doğru git.', 'Deshaz primero la segunda caja: ve hacia atrás desde cada salida.')
          : say(lang, 'Put each number through the first box, then compare with what comes out.', 'Her sayıyı birinci kutudan geçir, sonra çıkanla karşılaştır.', 'Pasa cada número por la primera caja y compáralo con lo que sale.'),
        say(lang, 'The missing step has to work for BOTH numbers.', 'Eksik adım İKİ sayı için de çalışmalı.', 'El paso que falta tiene que funcionar con LOS DOS números.'),
      ],
      visual: { kind: 'machine', inputs: [i1, i2], ops, outputs: outs },
    }
  }
}

// ── the number cross ──────────────────────────────────────────────────────────────
// A row of five and a column of three sharing a square, the row and the column adding to the
// same total. Two letters, one in each, and the one in the row can only be found after the one
// in the column — Bond's version is exactly that two-step.
function numberCross(level, lang) {
  let row, col, T
  for (;;) {
    const b = randInt(2, 9), c2 = randInt(3, 15), c3 = randInt(3, 15)
    T = b + c2 + c3
    const r = [randInt(1, 9), 0, randInt(1, 12), b, randInt(1, 9)]
    const a = T - b - r[0] - r[2] - r[4]
    if (a < 2 || a > 20) continue
    r[1] = a
    row = r; col = [b, c2, c3]
    break
  }
  const askA = Math.random() < 0.65
  return {
    topic: 'algebra', level,
    question_text: say(lang, `The row adds up to ${T} and so does the column. What is the value of ${askA ? 'a' : 'b'}?`,
      `Satırın toplamı ${T}, sütunun toplamı da ${T}. ${askA ? 'a' : 'b'} kaçtır?`,
      `La fila suma ${T} y la columna también. ¿Cuánto vale ${askA ? 'a' : 'b'}?`),
    format: 'numeric', correct_answer: askA ? row[1] : row[3],
    operandKey: `cross:${row.join(',')}:${col.join(',')}:${askA ? 'a' : 'b'}`,
    hint_steps: askA
      ? [say(lang, 'Start with the column: it has only one letter in it, b.', 'Sütundan başla: içinde tek harf var, b.', 'Empieza por la columna: solo tiene una letra, b.'),
         say(lang, 'Once you know b, the row has only one unknown left.', 'b\'yi bulunca satırda tek bilinmeyen kalır.', 'Cuando sepas b, en la fila solo queda una incógnita.')]
      : [say(lang, 'Use the column: it has only one letter in it.', 'Sütunu kullan: içinde tek harf var.', 'Usa la columna: solo tiene una letra.'),
         say(lang, `Add the numbers you know and take them away from ${T}.`, `Bildiğin sayıları topla ve ${T}${trEk(T, 'abl')} çıkar.`, `Suma los números que conoces y réstalos de ${T}.`)],
    visual: { kind: 'numcross', row: row.map((n, i) => (i === 1 ? 'a' : i === 3 ? 'b' : n)), col: ['b', ...col.slice(1)], at: 3 },
  }
}

// ── results of a dice ─────────────────────────────────────────────────────────────
// "Dan threw his dice 200 times" with one result rubbed out. The total is in the sentence; the
// missing count is the total minus the rest.
function diceTable(level, lang) {
  const N = pick([60, 100, 120, 150, 200])
  let f
  do {
    f = Array.from({ length: 6 }, () => Math.round(N / 6 + randInt(-N / 15, N / 15)))
    f[5] = N - f.slice(0, 5).reduce((s, x) => s + x, 0)
  } while (f[5] < 3 || new Set(f).size < 5)
  const miss = randInt(0, 5)
  const name = pickL(MULT_NAMES, lang)
  const cells = f.map((n, i) => (i === miss ? null : n))
  const even = Math.random() < 0.25
  return {
    topic: 'averages', level,
    question_text: even
      ? say(lang, `${name} threw a dice ${N} times. How many times did it land on an even number?`, `${name} bir zarı ${N} kez attı. Kaç kez çift sayı geldi?`, `${name} lanzó un dado ${N} veces. ¿Cuántas veces salió un número par?`)
      : say(lang, `${name} threw a dice ${N} times and wrote down the results. One is missing. How many times did it land on ${miss + 1}?`,
        `${name} bir zarı ${N} kez atıp sonuçları yazdı. Biri eksik. Kaç kez ${miss + 1} geldi?`,
        `${name} lanzó un dado ${N} veces y apuntó los resultados. Falta uno. ¿Cuántas veces salió el ${miss + 1}?`),
    format: 'numeric', correct_answer: even ? f[1] + f[3] + f[5] : f[miss],
    operandKey: `dice:${even ? 'even' : miss}:${f.join(',')}`,
    hint_steps: even
      ? [say(lang, 'The even numbers on a dice are 2, 4 and 6.', 'Zardaki çift sayılar 2, 4 ve 6.', 'Los números pares de un dado son 2, 4 y 6.'),
         say(lang, 'Add up how often each of those came up.', 'Her birinin kaç kez geldiğini topla.', 'Suma cuántas veces salió cada uno.')]
      : [say(lang, `All six results together must make ${N}.`, `Altı sonucun toplamı ${N} etmeli.`, `Los seis resultados juntos tienen que sumar ${N}.`),
         say(lang, `Add up the five you can see and take that from ${N}.`, `Gördüğün beşini topla ve ${N}${trEk(N, 'abl')} çıkar.`, `Suma los cinco que ves y réstalo de ${N}.`)],
    visual: { kind: 'chart', shape: 'table', cols: ['1', '2', '3', '4', '5', '6'], rows: [{ label: say(lang, 'Times', 'Kaç kez', 'Veces'), cells: even ? f : cells }] },
  }
}

// ── patterns of dots ──────────────────────────────────────────────────────────────
// Triangular and square numbers as the book draws them: the pattern, and the next one to find.
function dotNumbers(level, lang) {
  const tri = Math.random() < 0.6
  const term = n => (tri ? (n * (n + 1)) / 2 : n * n)
  const ask = pick([5, 5, 6])
  return {
    topic: 'number-properties', level,
    question_text: tri
      ? say(lang, `These are the first four triangular numbers. What is the ${ask === 5 ? 'fifth' : 'sixth'} one?`, `Bunlar ilk dört üçgensel sayı. ${ask === 5 ? 'Beşincisi' : 'Altıncısı'} kaçtır?`, `Estos son los cuatro primeros números triangulares. ¿Cuál es el ${ask === 5 ? 'quinto' : 'sexto'}?`)
      : say(lang, `These are the first four square numbers. What is the ${ask === 5 ? 'fifth' : 'sixth'} one?`, `Bunlar ilk dört kare sayı. ${ask === 5 ? 'Beşincisi' : 'Altıncısı'} kaçtır?`, `Estos son los cuatro primeros números cuadrados. ¿Cuál es el ${ask === 5 ? 'quinto' : 'sexto'}?`),
    format: 'numeric', correct_answer: term(ask), operandKey: `dots:${tri ? 't' : 's'}:${ask}`,
    hint_steps: tri
      ? [say(lang, 'Each pattern adds a new row along the bottom, one dot longer than the last.', 'Her desen alta bir sıra ekliyor, öncekinden bir nokta uzun.', 'Cada figura añade una fila abajo, con un punto más que la anterior.'),
         say(lang, 'So the jumps between the numbers go 2, 3, 4, … — keep them going.', 'Yani sayılar arasındaki farklar 2, 3, 4, … diye gidiyor — devam ettir.', 'Así que los saltos entre los números van 2, 3, 4…: sigue la serie.')]
      : [say(lang, 'Each pattern is a square: the same number of rows as columns.', 'Her desen bir kare: satır sayısı sütun sayısına eşit.', 'Cada figura es un cuadrado: tantas filas como columnas.'),
         say(lang, 'The number of dots is the side times itself.', 'Nokta sayısı, kenarın kendisiyle çarpımı.', 'El número de puntos es el lado por sí mismo.')],
    visual: { kind: 'dots', tri, terms: [1, 2, 3, 4].map(term) },
  }
}

// ── number lines past zero and between whole numbers ─────────────────────────────
// Bond labels these at two points only, often not the ends — "0" and "0.1" with the arrow to
// the left of the zero. Negative answers are offered as choices (the keypad has no minus), and
// the wrong ones are the real slips: the sign dropped, the step read ten times too big.
function numberLineOlder(level, lang) {
  const shape = pick(['neg', 'neg', 'dec', 'forms'])
  if (shape === 'forms') {
    const k = randInt(1, 9)
    const forms = [[`${k * 10}%`, `${k}%`], [`${k}/10`, `${k}/100`], [dnum(`0.${k}`, lang), dnum(`0.0${k}`, lang)]]
    const [rf, wf] = pick(forms)
    const right = opt(rf, say(lang, 'Right.', 'Doğru.', 'Correcto.'))
    const others = forms.filter(f => f[0] !== rf)
    const wrongs = [opt(wf, say(lang, 'That is ten times too small: each step here is a tenth.', 'Bu on kat küçük: buradaki her adım onda bir.', 'Eso es diez veces más pequeño: cada paso aquí es una décima.')),
      ...others.map(f => opt(f[1], say(lang, 'Each step here is a tenth, not a hundredth.', 'Buradaki her adım yüzde bir değil, onda bir.', 'Cada paso aquí es una décima, no una centésima.'))),
      k !== 5 && opt(dnum(`0.${10 - k}`, lang), say(lang, 'Count from 0, the left end.', 'Soldaki 0\'dan say.', 'Cuenta desde el 0, a la izquierda.'))]
    return {
      topic: 'place-value', level,
      question_text: say(lang, 'Which of these is equal to the number the arrow points to?', 'Okun gösterdiği sayıya hangisi eşittir?', '¿Cuál de estos es igual al número que señala la flecha?'),
      format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `nl:forms:${k}:${rf}`,
      hint_steps: [say(lang, 'The line from 0 to 1 is cut into ten equal steps.', '0\'dan 1\'e kadar olan doğru on eşit adıma bölünmüş.', 'La recta de 0 a 1 está dividida en diez pasos iguales.'),
                   say(lang, 'A tenth is the same as 10 hundredths, or 10%.', 'Onda bir, yüzde on ile aynıdır (%10).', 'Una décima es lo mismo que 10 centésimas, o el 10 %.')],
      visual: { kind: 'scale', type: 'line', min: 0, max: 1, minor: 0.1, value: k / 10, labels: [0, 1] },
    }
  }
  if (shape === 'dec') {
    const spec = pick([{ min: 0, max: 1.5, minor: 0.1, labels: [0, 1.5] }, { min: 2, max: 3, minor: 0.05, labels: [2, 2.5, 3] }, { min: 0, max: 0.1, minor: 0.01, labels: [0, 0.1] }])
    const steps = Math.round((spec.max - spec.min) / spec.minor)
    let value
    do { value = Math.round((spec.min + randInt(1, steps - 1) * spec.minor) * 1000) / 1000 } while (Number.isInteger(value) || spec.labels.some(l => Math.abs(l - value) < 1e-9))
    return {
      topic: 'place-value', level,
      question_text: say(lang, 'What number is the arrow pointing to?', 'Ok hangi sayıyı gösteriyor?', '¿A qué número apunta la flecha?'),
      format: 'decimal', correct_answer: value, operandKey: `nl:dec:${spec.min}:${spec.max}:${value}`,
      hint_steps: [say(lang, 'First find what one small step is worth: the gap between two labels, shared by the steps between them.', 'Önce bir küçük adımın değerini bul: iki etiket arasındaki farkı aradaki adım sayısına böl.', 'Primero averigua cuánto vale un paso pequeño: la distancia entre dos etiquetas entre los pasos que hay.'),
                   say(lang, 'Then count the steps from the nearest label.', 'Sonra en yakın etiketten adımları say.', 'Luego cuenta los pasos desde la etiqueta más cercana.')],
      visual: { kind: 'scale', type: 'line', ...spec, value },
    }
  }
  const spec = pick([{ min: -0.1, max: 0.1, minor: 0.01, labels: [0, 0.1] }, { min: -20, max: 20, minor: 2, labels: [0, 20] }, { min: -1, max: 1, minor: 0.1, labels: [0, 1] }, { min: -50, max: 50, minor: 5, labels: [0, 50] }])
  const steps = Math.round((spec.max - spec.min) / spec.minor)
  let value
  do { value = Math.round((spec.min + randInt(1, steps / 2 - 1) * spec.minor) * 1000) / 1000 } while (value >= 0)
  const show = n => dnum(minus(Math.round(n * 1000) / 1000), lang)
  const right = opt(show(value), say(lang, 'Right.', 'Doğru.', 'Correcto.'))
  const wrongs = [
    opt(show(-value), say(lang, 'The arrow is to the left of 0, so the number is below zero.', 'Ok 0\'ın solunda, yani sayı sıfırın altında.', 'La flecha está a la izquierda del 0: el número es menor que cero.')),
    opt(show(value + spec.minor), say(lang, 'Count the steps from 0 again.', '0\'dan adımları yeniden say.', 'Vuelve a contar los pasos desde el 0.')),
    opt(show(value - spec.minor), say(lang, 'Count the steps from 0 again.', '0\'dan adımları yeniden say.', 'Vuelve a contar los pasos desde el 0.')),
    opt(show(value * 10), say(lang, `Each step is ${dnum(spec.minor, lang)}, not ${dnum(Math.round(spec.minor * 10000) / 1000, lang)}.`, `Her adım ${dnum(spec.minor, lang)}, ${dnum(Math.round(spec.minor * 10000) / 1000, lang)} değil.`, `Cada paso es ${dnum(spec.minor, lang)}, no ${dnum(Math.round(spec.minor * 10000) / 1000, lang)}.`)),
  ]
  return {
    topic: 'place-value', level,
    question_text: say(lang, 'What number is the arrow pointing to?', 'Ok hangi sayıyı gösteriyor?', '¿A qué número apunta la flecha?'),
    format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `nl:neg:${spec.max}:${value}`,
    hint_steps: [say(lang, 'Work out one small step from the two labels.', 'İki etiketten bir küçük adımın değerini bul.', 'Calcula un paso pequeño a partir de las dos etiquetas.'),
                 say(lang, 'Left of 0 the numbers are negative: count the steps back from 0.', '0\'ın solunda sayılar negatif: 0\'dan geriye adımları say.', 'A la izquierda del 0 los números son negativos: cuenta los pasos hacia atrás desde el 0.')],
    visual: { kind: 'scale', type: 'line', ...spec, value },
  }
}

// ══ Year 8 (13 yaş): Bond Maths Assessment Papers 12+-13+ ══════════════════════════════════════
// Year 8 had no list of its own: thirteen landed on Year 7, which was written from the 11+-12+
// book. This block is the 12+-13+ book, read paper by paper (twenty papers, fifty questions each).
// What changes at this age is not the size of the numbers but what is done with them: indices
// and prime factors, negative numbers in every operation, fractions with mixed numbers in all
// four operations, brackets expanded and factorised, two unknowns at once, the nth term, lines
// read as equations, Pythagoras, circles with π, volume and surface area, frequency tables and
// two dice.
//
// Every template here is its own REGISTRY key: the level dial stops at 15 and Year 7 already
// sits at 13-14, so nothing here may ride on the band — the year is chosen by the topic.
//
// Left out, as the book asks them and nothing can mark them: drawing a graph or a pie chart,
// measuring with a protractor or ruler, reflecting a shape, and writing a sentence.

const ok8 = lang => say(lang, 'Right.', 'Doğru.', 'Correcto.')
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const pw = (b, e) => (e === 1 ? `${b}` : `${b}${String(e).split('').map(c => SUP[c]).join('')}`)
// A fraction in lowest terms, and the same as a mixed number — "7 1/6", which the screen stacks.
function lowest(n, d) {
  if (d < 0) { n = -n; d = -d }
  const g = gcd(Math.abs(n), d) || 1
  return [n / g, d / g]
}
function fracS(n, d) { const [a, b] = lowest(n, d); return b === 1 ? minus(a) : `${a < 0 ? '−' : ''}${Math.abs(a)}/${b}` }
function mixedS(n, d) {
  const [a, b] = lowest(n, d)
  if (b === 1) return minus(a)
  const w = Math.trunc(Math.abs(a) / b), r = Math.abs(a) % b
  return `${a < 0 ? '−' : ''}${w ? `${w} ` : ''}${r}/${b}`
}
// "4a − 4b", "x² + 7x + 12", "−3y": a list of [coefficient, letter] with the ones and signs a
// book would write.
function lin(terms) {
  let s = ''
  for (const [c, v] of terms) {
    if (!c) continue
    const a = Math.abs(c)
    const body = v ? (a === 1 ? v : `${a}${v}`) : `${a}`
    s += s ? (c < 0 ? ` − ${body}` : ` + ${body}`) : (c < 0 ? `−${body}` : body)
  }
  return s || '0'
}
const money8 = (v, lang) => {
  const s = Number.isInteger(v) ? String(v) : v.toFixed(2)
  return say(lang, `$${s}`, `${s.replace('.', ',')} TL`, `${s.replace('.', ',')} €`)
}
const pctS = p => (Number.isInteger(p) ? `${p}` : `${Math.floor(p)}½`)
const round2 = x => Math.round(x * 100) / 100

// ── 1. indices, primes, powers ────────────────────────────────────────────────────
function y8Powers(level, lang) {
  const shape = pick(['factors', 'factors', 'hcf', 'lcm', 'power', 'power', 'brackets', 'sumprod', 'pickset'])
  const T = 'powers-primes'
  if (shape === 'factors') {
    let fs, n
    do {
      const ps = shuffle([2, 3, 5, 7, 11]).slice(0, randInt(2, 3)).sort((a, b) => a - b)
      fs = ps.map(p => [p, p === 2 ? randInt(1, 4) : p <= 5 ? randInt(1, 2) : 1])
      n = fs.reduce((s, [p, e]) => s * p ** e, 1)
    } while (n < 40 || n > 2000 || fs.every(([, e]) => e === 1))
    const show = f => f.map(([p, e]) => pw(p, e)).join(' × ')
    const value = f => f.reduce((s, [p, e]) => s * p ** e, 1)
    const right = opt(show(fs), ok8(lang))
    const bump = (i, k) => fs.map(([p, e], j) => [p, j === i ? e + k : e]).filter(([, e]) => e > 0)
    const wrongs = [bump(0, 1), bump(fs.length - 1, 1), bump(fs.findIndex(([, e]) => e > 1), -1)]
      .filter(f => value(f) !== n)
      .map(f => opt(show(f), say(lang, `Multiply it out: that makes ${value(f)}, not ${n}.`, `Çarpınca ${value(f)} eder, ${n} değil.`, `Si lo multiplicas da ${value(f)}, no ${n}.`)))
    const grouped = fs.map(([p, e]) => `${p ** e}`).join(' × ')
    if (fs.some(([, e]) => e > 1)) wrongs.unshift(opt(grouped, say(lang, `That multiplies to ${n}, but ${fs.filter(([, e]) => e > 1).map(([p, e]) => p ** e).join(' and ')} ${fs.filter(([, e]) => e > 1).length > 1 ? 'are' : 'is'} not prime.`, `Çarpımı ${n} eder, ama ${fs.filter(([, e]) => e > 1).map(([p, e]) => p ** e).join(' ve ')} asal değil.`, `Da ${n}, pero ${fs.filter(([, e]) => e > 1).map(([p, e]) => p ** e).join(' y ')} no es primo.`)))
    return {
      topic: T, level,
      question_text: say(lang, `Write ${n} as a product of prime factors, using indices.`, `${n} sayısını asal çarpanlarının çarpımı olarak, üslü biçimde yaz.`, `Escribe ${n} como producto de factores primos, usando potencias.`),
      format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `pp:f:${n}`,
      hint_steps: [say(lang, `Keep dividing by the smallest prime that goes in: 2, then 3, then 5…`, `En küçük asalla bölmeye devam et: önce 2, sonra 3, sonra 5…`, `Sigue dividiendo por el primo más pequeño que quepa: 2, luego 3, luego 5…`),
                   say(lang, 'A prime used more than once is written once with a small power: 2 × 2 × 2 = 2³.', 'Birden çok kez kullanılan asal bir kez, küçük bir üsle yazılır: 2 × 2 × 2 = 2³.', 'Un primo que se repite se escribe una vez con un exponente: 2 × 2 × 2 = 2³.')],
    }
  }
  if (shape === 'hcf') {
    let a, b, g
    do { g = pick([4, 6, 8, 9, 12, 14, 15, 18, 24]); const p = randInt(2, 25), q = randInt(2, 25); a = g * p; b = g * q; if (gcd(p, q) !== 1 || p === q) a = 0 } while (!a || a > 600 || b > 600)
    return {
      topic: T, level,
      question_text: say(lang, `What is the highest common factor (HCF) of ${a} and ${b}?`, `${a} ve ${b} sayılarının en büyük ortak böleni (EBOB) kaçtır?`, `¿Cuál es el máximo común divisor (m.c.d.) de ${a} y ${b}?`),
      format: 'numeric', correct_answer: g, operandKey: `pp:h:${a}:${b}`,
      hint_steps: [say(lang, 'Write each number as a product of primes.', 'Her sayıyı asal çarpanlarına ayır.', 'Descompón cada número en factores primos.'),
                   say(lang, 'Multiply together the primes the two lists share.', 'İki listede ortak olan asalları çarp.', 'Multiplica los primos que tienen en común.')],
    }
  }
  if (shape === 'lcm') {
    let list, l
    do {
      list = shuffle([4, 6, 8, 9, 10, 12, 15, 16, 18, 20, 24, 30]).slice(0, randInt(3, 4)).sort((a, b) => a - b)
      l = list.reduce((s, x) => (s * x) / gcd(s, x), 1)
    } while (l > 360 || l === list[list.length - 1])
    const txt = list.slice(0, -1).join(', ') + say(lang, ' and ', ' ve ', ' y ') + list[list.length - 1]
    return {
      topic: T, level,
      question_text: say(lang, `What is the lowest common multiple (LCM) of ${txt}?`, `${txt} sayılarının en küçük ortak katı (EKOK) kaçtır?`, `¿Cuál es el mínimo común múltiplo (m.c.m.) de ${txt}?`),
      format: 'numeric', correct_answer: l, operandKey: `pp:l:${list.join(',')}`,
      hint_steps: [say(lang, 'Start with the multiples of the biggest number.', 'En büyük sayının katlarından başla.', 'Empieza por los múltiplos del número más grande.'),
                   say(lang, 'Stop at the first one that every number divides into.', 'Hepsinin tam böldüğü ilk katta dur.', 'Para en el primero que todos dividen exactamente.')],
    }
  }
  if (shape === 'power') {
    const form = pick(['sq', 'root', 'cube', 'prod', 'diff'])
    let q, ans
    if (form === 'sq') { const n = randInt(11, 25); q = `${pw(n, 2)} = ?`; ans = n * n }
    else if (form === 'root') { const n = randInt(9, 30); q = `√${n * n} = ?`; ans = n }
    else if (form === 'cube') { const n = randInt(3, 10); q = `${pw(n, 3)} = ?`; ans = n ** 3 }
    else if (form === 'prod') { const a = pick([2, 3]), b = pick([3, 5]), i = randInt(2, 3), j = randInt(2, 3); if (a === b) return y8Powers(level, lang); q = `${pw(a, i)} × ${pw(b, j)} = ?`; ans = a ** i * b ** j }
    else { const a = randInt(6, 12), b = randInt(2, 4); if (a * a <= b ** 3) return y8Powers(level, lang); q = `${pw(a, 2)} − ${pw(b, 3)} = ?`; ans = a * a - b ** 3 }
    return {
      topic: T, level, question_text: q, format: 'numeric', correct_answer: ans, operandKey: `pp:p:${q}`,
      hint_steps: [say(lang, 'The small number says how many times the number is multiplied by itself: 4³ = 4 × 4 × 4.', 'Küçük sayı, sayının kendisiyle kaç kez çarpılacağını söyler: 4³ = 4 × 4 × 4.', 'El número pequeño dice cuántas veces se multiplica por sí mismo: 4³ = 4 × 4 × 4.'),
                   form === 'root' ? say(lang, 'Which number times itself makes this?', 'Hangi sayı kendisiyle çarpılınca bunu verir?', '¿Qué número multiplicado por sí mismo da esto?') : say(lang, 'Work out each power first, then do the ×, − or +.', 'Önce her üssü hesapla, sonra ×, − ya da + yap.', 'Calcula primero cada potencia y luego haz el ×, − o +.')],
    }
  }
  if (shape === 'brackets') {
    const form = randInt(0, 2)
    let q, ans
    if (form === 0) {
      const mid = randInt(2, 9), quo = randInt(2, 9), inner = randInt(1, 6), d = randInt(1, 5), e = randInt(1, 9)
      q = `${mid * quo} ÷ (${mid + inner} − (${inner + d} − ${d})) + ${e} = ?`; ans = quo + e
    } else if (form === 1) {
      const a = randInt(3, 9), b = randInt(3, 9), c = randInt(2, 6), d = randInt(2, 6), f = randInt(2, 6), e = f * randInt(2, 8)
      if (a * b - c * d <= 0) return y8Powers(level, lang)
      q = `(${a} × ${b}) − (${c} × ${d}) + (${e} ÷ ${f}) = ?`; ans = a * b - c * d + e / f
    } else {
      const a = randInt(6, 15), b = randInt(1, a - 2), c = randInt(6, 15), d = randInt(1, c - 2)
      q = `(${a} − ${b})(${c} − ${d}) = ?`; ans = (a - b) * (c - d)
    }
    return {
      topic: T, level, question_text: q, format: 'numeric', correct_answer: ans, operandKey: `pp:b:${q}`,
      hint_steps: [say(lang, 'Work from the innermost brackets outwards.', 'En içteki parantezden dışarı doğru çalış.', 'Trabaja desde el paréntesis de más adentro hacia fuera.'),
                   say(lang, 'Then × and ÷ before + and −. Two brackets side by side are multiplied.', 'Sonra + ve −\'den önce × ve ÷. Yan yana iki parantez çarpılır.', 'Luego × y ÷ antes que + y −. Dos paréntesis juntos se multiplican.')],
    }
  }
  if (shape === 'sumprod') {
    let x, y
    do { x = randInt(2, 15); y = randInt(2, 15) } while (x === y)
    const [lo, hi] = x < y ? [x, y] : [y, x]
    const diff = Math.random() < 0.4
    return {
      topic: T, level,
      question_text: diff
        ? say(lang, `Two numbers add up to ${(hi + lo) * 3} and their difference is ${(hi - lo) * 3}. What is the larger number?`, `İki sayının toplamı ${(hi + lo) * 3}, farkı ${(hi - lo) * 3}. Büyük sayı kaçtır?`, `Dos números suman ${(hi + lo) * 3} y su diferencia es ${(hi - lo) * 3}. ¿Cuál es el mayor?`)
        : say(lang, `Two numbers add up to ${hi + lo} and multiply to make ${hi * lo}. What is the larger number?`, `İki sayının toplamı ${hi + lo}, çarpımı ${hi * lo}. Büyük sayı kaçtır?`, `Dos números suman ${hi + lo} y su producto es ${hi * lo}. ¿Cuál es el mayor?`),
      format: 'numeric', correct_answer: diff ? hi * 3 : hi, operandKey: `pp:s:${diff ? 'd' : 'p'}:${lo}:${hi}`,
      hint_steps: diff
        ? [say(lang, 'Add the total and the difference together: that is two lots of the larger number.', 'Toplam ile farkı topla: bu, büyük sayının iki katıdır.', 'Suma el total y la diferencia: eso es el doble del número mayor.'), say(lang, 'Then halve it.', 'Sonra yarıya böl.', 'Luego divídelo entre 2.')]
        : [say(lang, 'List pairs of numbers that multiply to make the product.', 'Çarpımı veren sayı çiftlerini listele.', 'Haz una lista de parejas que multiplicadas den el producto.'), say(lang, 'Pick the pair that also adds up to the total.', 'Toplamı da tutan çifti seç.', 'Elige la pareja que además sume el total.')],
    }
  }
  // Which one is prime / square / cube / a multiple — a row of numbers and only one fits.
  const kind = pick(['prime', 'square', 'cube', 'mult'])
  const k = pick([6, 7, 9, 11])
  const isPrime = n => n > 1 && Array.from({ length: Math.floor(Math.sqrt(n)) - 1 }, (_, i) => i + 2).every(d => n % d)
  const fits = n => (kind === 'prime' ? isPrime(n) : kind === 'square' ? Number.isInteger(Math.sqrt(n)) : kind === 'cube' ? Number.isInteger(Math.round(Math.cbrt(n))) && Math.round(Math.cbrt(n)) ** 3 === n : n % k === 0)
  const pool = kind === 'prime' ? [23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113]
    : kind === 'square' ? [49, 64, 81, 121, 144, 169, 196, 225, 289, 324]
      : kind === 'cube' ? [27, 64, 125, 216, 343, 512]
        : Array.from({ length: 12 }, (_, i) => k * (i + 4))
  const ans = pick(pool)
  const decoys = []
  const near = kind === 'prime' ? [51, 57, 87, 91, 93, 111, 119, 121, 133, 143, 49, 77, 69, 39] : kind === 'mult' ? Array.from({ length: 40 }, (_, i) => ans + i - 20) : Array.from({ length: 60 }, (_, i) => ans + i - 30)
  for (const n of shuffle(near)) { if (n > 1 && !fits(n) && !decoys.includes(n) && n !== ans) decoys.push(n); if (decoys.length === 3) break }
  const why = n => {
    if (kind === 'prime') { const d = [2, 3, 5, 7, 11, 13].find(p => n % p === 0); return say(lang, `${n} = ${d} × ${n / d}, so it is not prime.`, `${n} = ${d} × ${n / d}, asal değil.`, `${n} = ${d} × ${n / d}, no es primo.`) }
    if (kind === 'mult') return say(lang, `${n} ÷ ${k} leaves ${n % k} over.`, `${n} ÷ ${k} işleminde ${n % k} kalır.`, `${n} ÷ ${k} da resto ${n % k}.`)
    const r = kind === 'square' ? Math.floor(Math.sqrt(n)) : Math.floor(Math.cbrt(n) + 1e-9)
    return kind === 'square'
      ? say(lang, `${r}² = ${r * r} and ${r + 1}² = ${(r + 1) ** 2}, so ${n} is not a square.`, `${r}² = ${r * r}, ${r + 1}² = ${(r + 1) ** 2}; ${n} kare sayı değil.`, `${r}² = ${r * r} y ${r + 1}² = ${(r + 1) ** 2}: ${n} no es un cuadrado.`)
      : say(lang, `${r}³ = ${r ** 3} and ${r + 1}³ = ${(r + 1) ** 3}, so ${n} is not a cube.`, `${r}³ = ${r ** 3}, ${r + 1}³ = ${(r + 1) ** 3}; ${n} küp sayı değil.`, `${r}³ = ${r ** 3} y ${r + 1}³ = ${(r + 1) ** 3}: ${n} no es un cubo.`)
  }
  const name = kind === 'prime' ? say(lang, 'a prime number', 'asal sayı', 'un número primo')
    : kind === 'square' ? say(lang, 'a square number', 'kare sayı', 'un número cuadrado')
      : kind === 'cube' ? say(lang, 'a cube number', 'küp sayı', 'un número cúbico') : say(lang, `a multiple of ${k}`, `${k}${trEk(k, 'gen')} katı`, `un múltiplo de ${k}`)
  const right = opt(String(ans), ok8(lang))
  return {
    topic: T, level,
    question_text: say(lang, `Which of these is ${name}?`, `Bunlardan hangisi ${name}?`, `¿Cuál de estos es ${name}?`),
    format: 'choice', options: choiceOf(right, decoys.map(n => opt(String(n), why(n))), { sort: (a, b) => a.value - b.value }), correct_answer: right.value, operandKey: `pp:k:${kind}:${ans}:${decoys.join(',')}`,
    hint_steps: [kind === 'prime' ? say(lang, 'A prime has only two factors: 1 and itself. Try dividing by 2, 3, 5, 7, 11.', 'Asal sayının yalnız iki böleni var: 1 ve kendisi. 2, 3, 5, 7, 11 ile bölmeyi dene.', 'Un primo solo tiene dos divisores: 1 y él mismo. Prueba a dividir entre 2, 3, 5, 7, 11.')
      : say(lang, 'Test each number in turn.', 'Sayıları tek tek dene.', 'Prueba los números uno por uno.'),
    say(lang, 'Only one of them fits.', 'Yalnız biri uyuyor.', 'Solo uno cumple.')],
  }
}

// ── 2. negative numbers, decimals and the powers of ten ──────────────────────────
function y8Negatives(level, lang) {
  const shape = pick(['neg', 'neg', 'neg', 'decround', 'pow10', 'compare'])
  const T = 'negatives-decimals'
  if (shape === 'neg') {
    const dec = Math.random() < 0.25
    const a = dec ? randInt(3, 40) / 2 : randInt(2, 20), b = dec ? randInt(3, 40) / 4 : randInt(2, 20)
    const s = n => (n < 0 ? `(${minus(n)})` : String(n))
    const forms = [
      [`${a} − ${s(-b)}`, a + b, a - b, say(lang, 'Taking away a negative is the same as adding.', 'Negatif bir sayıyı çıkarmak, toplamakla aynıdır.', 'Restar un negativo es lo mismo que sumar.')],
      [`${s(-a)} + ${s(-b)}`, -a - b, b - a, say(lang, 'Adding a negative moves you further below zero.', 'Negatif eklemek seni sıfırın daha altına götürür.', 'Sumar un negativo te lleva más por debajo de cero.')],
      [`${s(-a)} − ${b}`, -a - b, b - a, say(lang, 'Start below zero and go further down.', 'Sıfırın altından başla ve daha aşağı in.', 'Empieza por debajo de cero y baja más.')],
      [`${s(-a)} − ${s(-b)}`, b - a, -a - b, say(lang, 'Taking away a negative is the same as adding.', 'Negatif bir sayıyı çıkarmak, toplamakla aynıdır.', 'Restar un negativo es lo mismo que sumar.')],
    ]
    if (!dec) forms.push(
      [`${s(-a)} × ${b}`, -a * b, a * b, say(lang, 'A negative times a positive is negative.', 'Negatif çarpı pozitif, negatiftir.', 'Negativo por positivo da negativo.')],
      [`${s(-a)} × ${s(-b)}`, a * b, -a * b, say(lang, 'A negative times a negative is positive.', 'Negatif çarpı negatif, pozitiftir.', 'Negativo por negativo da positivo.')],
      [`${s(-a * b)} ÷ ${s(-b)}`, a, -a, say(lang, 'A negative divided by a negative is positive.', 'Negatifin negatife bölümü pozitiftir.', 'Negativo entre negativo da positivo.')],
      [`${a * b} ÷ ${s(-b)}`, -a, a, say(lang, 'Positive divided by negative is negative.', 'Pozitifin negatife bölümü negatiftir.', 'Positivo entre negativo da negativo.')],
      [`${s(-a)}²`, a * a, -a * a, say(lang, 'Squaring multiplies the number by itself: negative × negative.', 'Kare almak sayıyı kendisiyle çarpar: negatif × negatif.', 'Elevar al cuadrado es multiplicar por sí mismo: negativo × negativo.')],
    )
    const [q, ans, flip, rule] = pick(forms)
    const r = x => Math.round(x * 100) / 100
    const right = opt(minus(r(ans)), ok8(lang))
    const wrongs = [opt(minus(r(-ans)), rule), opt(minus(r(flip)), rule), opt(minus(r(ans + (dec ? 0.5 : 1))), say(lang, 'Check the counting.', 'Saymayı kontrol et.', 'Revisa la cuenta.')), opt(minus(r(ans - (dec ? 0.5 : 1))), say(lang, 'Check the counting.', 'Saymayı kontrol et.', 'Revisa la cuenta.'))]
    return {
      topic: T, level, question_text: `${dnum(q, lang)} = ?`, format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value,
      operandKey: `nd:n:${q}`,
      hint_steps: [rule, say(lang, 'Picture a number line: which way do you move, and how far?', 'Bir sayı doğrusu düşün: hangi yöne ve ne kadar gidiyorsun?', 'Imagina una recta numérica: ¿hacia dónde te mueves y cuánto?')],
    }
  }
  if (shape === 'decround') {
    const A = randInt(1000, 15000) // hundredths
    const op = pick(['×', '÷'])
    const b = op === '×' ? pick([3, 4, 6, 7, 8, 9, 1.5, 2.5]) : pick([3, 6, 7, 8, 9])
    const exact = op === '×' ? (A * b) / 100 : A / 100 / b
    const dp = randInt(1, 2)
    const ans = Math.round(exact * 10 ** dp) / 10 ** dp
    if (Math.abs(ans - exact) < 1e-9 && op === '×') return y8Negatives(level, lang)
    const q = `${(A / 100).toFixed(2)} ${op} ${b}`
    return {
      topic: T, level,
      question_text: say(lang, `Work out ${q}. Give your answer to ${dp} decimal place${dp > 1 ? 's' : ''}.`, `${dnum(q, lang)} işlemini yap. Cevabı ${dp} ondalık basamağa yuvarla.`, `Calcula ${dnum(q, lang)}. Da la respuesta con ${dp} decimal${dp > 1 ? 'es' : ''}.`),
      format: Number.isInteger(ans) ? 'numeric' : 'decimal', correct_answer: ans, operandKey: `nd:r:${q}:${dp}`,
      hint_steps: [say(lang, 'Work it out to one more decimal place than you need.', 'Gerekenden bir basamak fazla hesapla.', 'Calcula con un decimal más de los que necesitas.'),
                   say(lang, 'That extra digit decides: 5 or more rounds up.', 'O fazladan basamak karar verir: 5 ve üstü yukarı yuvarlanır.', 'Esa cifra de más decide: de 5 en adelante se redondea hacia arriba.')],
    }
  }
  if (shape === 'pow10') {
    const k = randInt(1, 4), m = randInt(11, 9999)
    const x = m / 10 ** k
    const f = pick([10, 100, 1000])
    const mul = Math.random() < 0.5
    const ans = Number((mul ? x * f : x / f).toPrecision(10))
    const q = `${x} ${mul ? '×' : '÷'} ${num(f, lang)}`
    return {
      topic: T, level, question_text: `${dnum(q, lang)} = ?`, format: Number.isInteger(ans) ? 'numeric' : 'decimal', correct_answer: ans, operandKey: `nd:p:${q}`,
      hint_steps: [say(lang, `${mul ? 'Multiplying' : 'Dividing'} by ${num(f, lang)} moves every digit ${String(f).length - 1} place${f > 10 ? 's' : ''} to the ${mul ? 'left' : 'right'}.`,
        `${num(f, lang)} ile ${mul ? 'çarpmak' : 'bölmek'} her rakamı ${String(f).length - 1} basamak ${mul ? 'sola' : 'sağa'} kaydırır.`,
        `${mul ? 'Multiplicar' : 'Dividir'} por ${num(f, lang)} mueve cada cifra ${String(f).length - 1} lugar${f > 10 ? 'es' : ''} a la ${mul ? 'izquierda' : 'derecha'}.`),
      say(lang, 'Fill any gaps with zeros.', 'Boş kalan yerleri sıfırla doldur.', 'Rellena los huecos con ceros.')],
    }
  }
  // Which sign goes in the gap — both sides worked out, the sign read off.
  const exprs = [
    () => { const a = randInt(2, 5), e = randInt(2, 3); return [`${pw(a, e + 1)} ÷ ${a}`, a ** e] },
    () => { const a = randInt(2, 6), b = randInt(2, 4); return [`${pw(a, 2)} + ${pw(b, 3)}`, a * a + b ** 3] },
    () => { const a = randInt(3, 12), b = randInt(3, 12); return [`${a} × ${b}`, a * b] },
    () => { const a = randInt(5, 11); const b = randInt(1, a * a - 1); return [`${pw(a, 2)} − ${b}`, a * a - b] },
    () => { const a = randInt(2, 4); return [`${pw(a, 3)} × 2`, 2 * a ** 3] },
  ]
  let L, R
  do { L = pick(exprs)(); R = pick(exprs)() } while (L[0] === R[0] || Math.abs(L[1] - R[1]) > 40)
  if (Math.random() < 0.3) { const d = L[1] - randInt(1, L[1] - 1); R = [`${L[1] - d} + ${d}`, L[1]] }
  const ansSign = L[1] < R[1] ? '<' : L[1] > R[1] ? '>' : '='
  const why = say(lang, `The left side is ${L[1]} and the right side is ${R[1]}.`, `Sol taraf ${L[1]}, sağ taraf ${R[1]}.`, `El lado izquierdo es ${L[1]} y el derecho ${R[1]}.`)
  const right = opt(ansSign, ok8(lang))
  return {
    topic: T, level,
    question_text: say(lang, `Which sign goes in the gap?  ${L[0]} __ ${R[0]}`, `Boşluğa hangi işaret gelir?  ${L[0]} __ ${R[0]}`, `¿Qué signo va en el hueco?  ${L[0]} __ ${R[0]}`),
    format: 'choice', options: choiceOf(right, ['<', '>', '='].filter(x => x !== ansSign).map(x => opt(x, why))), correct_answer: right.value,
    operandKey: `nd:c:${L[0]}:${R[0]}`,
    hint_steps: [say(lang, 'Work out each side on its own.', 'Her tarafı ayrı ayrı hesapla.', 'Calcula cada lado por separado.'),
                 say(lang, 'The wide end of < or > faces the bigger number.', '< ya da > işaretinin açık ucu büyük sayıya bakar.', 'La parte abierta de < o > mira al número mayor.')],
  }
}

// ── 3. fractions, decimals and percentages ───────────────────────────────────────
function y8Fractions(level, lang) {
  const shape = pick(['ops', 'ops', 'ops', 'pctof', 'discount', 'reverse', 'order', 'dec2frac'])
  const T = 'fdp'
  if (shape === 'ops') {
    const op = pick(['+', '−', '×', '÷'])
    let a, b
    for (;;) {
      const d1 = randInt(2, 9), d2 = randInt(2, 9), w1 = Math.random() < 0.5 ? randInt(1, 6) : 0, w2 = Math.random() < 0.4 ? randInt(1, 4) : 0
      const n1 = randInt(1, d1 - 1), n2 = randInt(1, d2 - 1)
      a = [w1 * d1 + n1, d1]; b = [w2 * d2 + n2, d2]
      if (gcd(n1, d1) !== 1 || gcd(n2, d2) !== 1) continue
      if (op === '−' && a[0] * b[1] <= b[0] * a[1]) continue
      break
    }
    const show = ([n, d]) => mixedS(n, d)
    const res = op === '+' ? [a[0] * b[1] + b[0] * a[1], a[1] * b[1]] : op === '−' ? [a[0] * b[1] - b[0] * a[1], a[1] * b[1]]
      : op === '×' ? [a[0] * b[0], a[1] * b[1]] : [a[0] * b[1], a[1] * b[0]]
    const same = (x, y) => x[0] * y[1] === y[0] * x[1]
    const cand = []
    if (op === '+' || op === '−') {
      cand.push([[op === '+' ? a[0] + b[0] : Math.abs(a[0] - b[0]), a[1] + b[1]], say(lang, 'Tops and bottoms cannot be added straight across: make the bottoms the same first.', 'Paylar ve paydalar doğrudan toplanmaz: önce paydaları eşitle.', 'No se suman arriba con arriba y abajo con abajo: primero iguala los denominadores.')])
      cand.push([[res[0] + (op === '+' ? a[1] : -a[1]), res[1]], say(lang, 'One of the tops was not scaled up with its bottom.', 'Paylardan biri paydasıyla birlikte genişletilmemiş.', 'Uno de los numeradores no se amplió junto con su denominador.')])
    } else {
      cand.push([op === '×' ? [a[0] * b[1], a[1] * b[0]] : [a[0] * b[0], a[1] * b[1]], op === '×' ? say(lang, 'That is dividing. To multiply, multiply the tops and the bottoms.', 'Bu bölme. Çarpmak için payları ve paydaları çarp.', 'Eso es dividir. Para multiplicar, multiplica numeradores y denominadores.') : say(lang, 'That is multiplying. To divide, turn the second fraction upside down, then multiply.', 'Bu çarpma. Bölmek için ikinci kesri ters çevir, sonra çarp.', 'Eso es multiplicar. Para dividir, da la vuelta a la segunda fracción y multiplica.')])
      const w1 = Math.floor(a[0] / a[1]), w2 = Math.floor(b[0] / b[1])
      if (op === '×' && w1 && w2) cand.push([[w1 * w2 * a[1] * b[1] + (a[0] % a[1]) * (b[0] % b[1]), a[1] * b[1]], say(lang, 'The whole numbers and the fractions cannot be multiplied separately: make them top-heavy fractions first.', 'Tam kısımlar ve kesirler ayrı ayrı çarpılmaz: önce bileşik kesre çevir.', 'No se multiplican por separado los enteros y las fracciones: pásalos antes a fracción impropia.')])
    }
    const [rn, rd] = lowest(...res)
    cand.push([[rn + 1, rd], say(lang, 'Nearly — check the last step of the working.', 'Neredeyse — işlemin son adımını kontrol et.', 'Casi: revisa el último paso.')])
    const right = opt(show(res), ok8(lang))
    const wrongs = cand.filter(([f]) => f[0] > 0 && f[1] > 0 && !same(f, res)).map(([f, w]) => opt(show(f), w))
    wrongs.push(opt(show([res[0] * 2 + res[1], res[1] * 2]), say(lang, 'Nearly — check the last step of the working.', 'Neredeyse — işlemin son adımını kontrol et.', 'Casi: revisa el último paso.')))
    return {
      topic: T, level,
      question_text: say(lang, `${show(a)} ${op} ${show(b)} = ?  (lowest terms)`, `${show(a)} ${op} ${show(b)} = ?  (en sade biçimde)`, `${show(a)} ${op} ${show(b)} = ?  (fracción irreducible)`),
      format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `fdp:o:${show(a)}${op}${show(b)}`,
      hint_steps: [
        say(lang, 'Turn any mixed numbers into top-heavy fractions first.', 'Önce tam sayılı kesirleri bileşik kesre çevir.', 'Primero pasa los números mixtos a fracciones impropias.'),
        op === '+' || op === '−' ? say(lang, 'Make the bottoms the same, then add or take away the tops.', 'Paydaları eşitle, sonra payları topla ya da çıkar.', 'Iguala los denominadores y suma o resta los numeradores.')
          : op === '×' ? say(lang, 'Multiply the tops, multiply the bottoms, then simplify.', 'Payları çarp, paydaları çarp, sonra sadeleştir.', 'Multiplica numeradores y denominadores, y simplifica.')
            : say(lang, 'Flip the second fraction and multiply.', 'İkinci kesri ters çevir ve çarp.', 'Da la vuelta a la segunda fracción y multiplica.'),
      ],
    }
  }
  if (shape === 'pctof') {
    let p, amt, ans
    do { p = pick([2.5, 7.5, 12.5, 17.5, 6.5, 15, 35, 65, 63, 48, 27, 13, 16, 18, 45]); amt = randInt(4, 80) * 5; ans = (amt * p) / 100 } while (Math.round(ans * 100) !== ans * 100)
    return {
      topic: T, level,
      question_text: say(lang, `What is ${pctS(p)}% of ${money8(amt, lang)}?`, `${money8(amt, lang)}'nin %${pctS(p)}${trEk(pctS(p), 'poss')} ne kadar?`, `¿Cuánto es el ${pctS(p)} % de ${money8(amt, lang)}?`),
      format: Number.isInteger(ans) ? 'numeric' : 'decimal', correct_answer: ans, operandKey: `fdp:p:${p}:${amt}`,
      hint_steps: [say(lang, 'Find 1% first: divide by 100.', 'Önce %1\'i bul: 100\'e böl.', 'Halla primero el 1 %: divide entre 100.'),
                   say(lang, Number.isInteger(p) ? 'Then multiply by the percentage.' : 'Then multiply by the percentage — ½ is 0.5.', Number.isInteger(p) ? 'Sonra yüzdeyle çarp.' : 'Sonra yüzdeyle çarp — ½, 0,5 demek.', Number.isInteger(p) ? 'Luego multiplica por el porcentaje.' : 'Luego multiplica por el porcentaje: ½ es 0,5.')],
    }
  }
  if (shape === 'discount') {
    let d, P, S
    do { d = pick([5, 10, 15, 20, 25, 30, 35, 40, 12.5]); P = randInt(8, 150) * (d === 12.5 ? 8 : 2); S = (P * (100 - d)) / 100 } while (Math.round(S * 100) !== S * 100)
    return {
      topic: T, level,
      question_text: say(lang, `A game priced at ${money8(P, lang)} is sold for ${money8(S, lang)}. What percentage discount is given?`, `Fiyatı ${money8(P, lang)} olan bir oyun ${money8(S, lang)}'ye satılıyor. Yüzde kaç indirim yapılmış?`, `Un juego que cuesta ${money8(P, lang)} se vende por ${money8(S, lang)}. ¿Qué porcentaje de descuento tiene?`),
      format: Number.isInteger(d) ? 'numeric' : 'decimal', correct_answer: d, operandKey: `fdp:d:${P}:${S}`,
      hint_steps: [say(lang, 'Work out how much money comes off.', 'Önce ne kadar para düştüğünü bul.', 'Calcula cuánto dinero se descuenta.'),
                   say(lang, 'Write that as a fraction of the ORIGINAL price, then × 100.', 'Bunu İLK fiyatın kesri olarak yaz, sonra 100 ile çarp.', 'Escríbelo como fracción del precio ORIGINAL y multiplica por 100.')],
    }
  }
  if (shape === 'reverse') {
    let p, start, left
    do { p = pick([10, 20, 25, 30, 40, 60, 75]); start = randInt(4, 60) * 0.5; left = (start * (100 - p)) / 100 } while (Math.round(left * 100) !== left * 100)
    const name = pickL(MULT_NAMES, lang)
    return {
      topic: T, level,
      question_text: say(lang, `After spending ${p}% of the pocket money, ${name} has ${money8(left, lang)} left. How much was the pocket money?`, `${name} harçlığının %${p}${trEk(p, 'possAcc')} harcayınca ${money8(left, lang)} kalıyor. Harçlık ne kadardı?`, `Después de gastar el ${p} % de la paga, a ${name} le quedan ${money8(left, lang)}. ¿Cuánto era la paga?`),
      format: Number.isInteger(start) ? 'numeric' : 'decimal', correct_answer: start, operandKey: `fdp:r:${p}:${start}`,
      hint_steps: [say(lang, `What is left is ${100 - p}% of the starting amount.`, `Kalan para, başlangıçtakinin %${100 - p}${trEk(100 - p, 'poss')}.`, `Lo que queda es el ${100 - p} % de lo que tenía.`),
                   say(lang, `So find 1% by dividing by ${100 - p}, then × 100.`, `Yani %1'i bulmak için ${100 - p}${trEk(100 - p, 'dat')} böl, sonra 100 ile çarp.`, `Así que halla el 1 % dividiendo entre ${100 - p} y multiplica por 100.`)],
    }
  }
  if (shape === 'order') {
    const vals = []
    const reps = []
    while (vals.length < 5) {
      const kind = randInt(0, 2)
      let v, s
      if (kind === 0) { const d = pick([3, 4, 5, 6, 8, 9, 12, 16]); const n = randInt(1, d - 1); if (gcd(n, d) !== 1) continue; v = n / d; s = `${n}/${d}` }
      else if (kind === 1) { v = randInt(10, 95) / 100; s = dnum(String(v), lang) }
      else { v = randInt(10, 95) / 100; s = `${Math.round(v * 100)}%` }
      if (vals.some(x => Math.abs(x - v) < 0.012)) continue
      vals.push(v); reps.push(s)
    }
    const small = Math.random() < 0.5
    const idx = vals.indexOf(small ? Math.min(...vals) : Math.max(...vals))
    const right = opt(reps[idx], ok8(lang))
    const wrongs = reps.map((s, i) => [s, i]).filter(([, i]) => i !== idx).map(([s, i]) => opt(s, say(lang, `As a decimal that is about ${dnum(vals[i].toFixed(3), lang)}.`, `Ondalık olarak yaklaşık ${dnum(vals[i].toFixed(3), lang)}.`, `En decimal es más o menos ${dnum(vals[i].toFixed(3), lang)}.`)))
    return {
      topic: T, level,
      question_text: say(lang, `Which is the ${small ? 'smallest' : 'largest'}?`, `Hangisi en ${small ? 'küçük' : 'büyük'}?`, `¿Cuál es el ${small ? 'menor' : 'mayor'}?`),
      format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `fdp:ord:${reps.join('|')}:${small}`,
      hint_steps: [say(lang, 'Turn them all into decimals.', 'Hepsini ondalık sayıya çevir.', 'Pásalos todos a decimales.'),
                   say(lang, 'A percentage ÷ 100 is a decimal; a fraction is its top ÷ its bottom.', 'Yüzde ÷ 100 ondalık olur; kesir, pay ÷ paydadır.', 'Un porcentaje entre 100 es un decimal; una fracción es numerador entre denominador.')],
    }
  }
  const [n, d] = pick([[5, 8], [12, 25], [1, 40], [33, 40], [17, 80], [3, 8], [7, 20], [9, 16], [3, 16], [11, 25], [7, 40], [3, 125], [21, 50], [13, 20]])
  const dec = Number((n / d).toPrecision(8))
  const right = opt(`${n}/${d}`, ok8(lang))
  const places = String(dec).split('.')[1].length
  const digits = Number(String(dec).split('.')[1])
  const wrongs = [
    opt(fracS(digits, 10 ** (places - 1)), say(lang, 'Count the decimal places: that many zeros go under the digits.', 'Ondalık basamakları say: payda o kadar sıfırlı olur.', 'Cuenta los decimales: el denominador lleva tantos ceros.')),
    opt(fracS(n + 1, d), say(lang, `That is ${dnum(((n + 1) / d).toFixed(4).replace(/0+$/, ''), lang)} as a decimal.`, `Bu, ondalık olarak ${dnum(((n + 1) / d).toFixed(4).replace(/0+$/, ''), lang)}.`, `En decimal eso es ${dnum(((n + 1) / d).toFixed(4).replace(/0+$/, ''), lang)}.`)),
    opt(fracS(d, n * 10), say(lang, 'The fraction is upside down.', 'Kesir ters yazılmış.', 'La fracción está al revés.')),
  ].filter(o => o.value !== right.value)
  return {
    topic: T, level,
    question_text: say(lang, `Write ${dnum(String(dec), lang)} as a fraction in its lowest terms.`, `${dnum(String(dec), lang)} sayısını en sade kesir olarak yaz.`, `Escribe ${dnum(String(dec), lang)} como fracción irreducible.`),
    format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `fdp:df:${n}/${d}`,
    hint_steps: [say(lang, 'Write the digits over 10, 100 or 1000 — one zero for each decimal place.', 'Rakamları 10, 100 ya da 1000\'in üstüne yaz — her ondalık basamak için bir sıfır.', 'Escribe las cifras sobre 10, 100 o 1000: un cero por cada decimal.'),
                 say(lang, 'Then divide top and bottom by the same number until you cannot any more.', 'Sonra pay ve paydayı, bölünemeyene kadar aynı sayıya böl.', 'Luego divide arriba y abajo por el mismo número hasta que no se pueda más.')],
  }
}

// ── 4. algebra: brackets, factorising, equations ─────────────────────────────────
function y8Algebra(level, lang) {
  const shape = pick(['simplify', 'simplify', 'factorise', 'expand2', 'solve', 'solve', 'simult', 'simult', 'subst', 'rects'])
  const T = 'algebra-8'
  if (shape === 'simplify') {
    const k1 = randInt(2, 7), k2 = randInt(1, 5)
    const u1 = randInt(1, 5), v1 = pick([-1, 1]) * randInt(1, 5), u2 = randInt(1, 4), v2 = pick([-1, 1]) * randInt(1, 5)
    const A = k1 * u1 - k2 * u2, B = k1 * v1 - k2 * v2
    if (!A && !B) return y8Algebra(level, lang)
    const q = `${k1}(${lin([[u1, 'a'], [v1, 'b']])}) − ${k2 === 1 ? '' : k2}(${lin([[u2, 'a'], [v2, 'b']])})`
    const right = opt(lin([[A, 'a'], [B, 'b']]), ok8(lang))
    const wrongs = [
      opt(lin([[A, 'a'], [k1 * v1 + k2 * v2, 'b']]), say(lang, 'The minus in front of the second bracket changes the sign of EVERYTHING inside it.', 'İkinci parantezin önündeki eksi, içindeki HER terimin işaretini değiştirir.', 'El menos delante del segundo paréntesis cambia el signo de TODO lo de dentro.')),
      opt(lin([[k1 * u1 - u2, 'a'], [k1 * v1 - v2, 'b']]), say(lang, `Multiply every term in the second bracket by ${k2}.`, `İkinci parantezdeki her terimi ${k2} ile çarp.`, `Multiplica cada término del segundo paréntesis por ${k2}.`)),
      opt(lin([[u1 * k1 - k2 * u2, 'a'], [v1 - k2 * v2, 'b']]), say(lang, `Multiply every term in the first bracket by ${k1}.`, `Birinci parantezdeki her terimi ${k1} ile çarp.`, `Multiplica cada término del primer paréntesis por ${k1}.`)),
      opt(lin([[A + 1, 'a'], [B, 'b']]), say(lang, 'Collect the a terms again.', 'a terimlerini yeniden topla.', 'Vuelve a juntar los términos con a.')),
    ].filter(o => o.value !== right.value)
    return {
      topic: T, level, question_text: say(lang, `Simplify: ${q}`, `Sadeleştir: ${q}`, `Simplifica: ${q}`),
      format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `a8:s:${q}`,
      hint_steps: [say(lang, 'Multiply out each bracket first. A minus in front changes every sign inside.', 'Önce parantezleri aç. Önündeki eksi, içindeki her işareti değiştirir.', 'Primero quita los paréntesis. Un menos delante cambia todos los signos de dentro.'),
                   say(lang, 'Then collect the a terms and the b terms.', 'Sonra a\'lı ve b\'li terimleri ayrı ayrı topla.', 'Después junta los términos con a y los términos con b.')],
    }
  }
  if (shape === 'factorise') {
    const quad = Math.random() < 0.55
    let k, p, q
    do { k = randInt(2, 8); p = randInt(1, 5); q = pick([-1, 1]) * randInt(1, 9) } while (gcd(p, Math.abs(q)) !== 1)
    const v = quad ? 'x' : ''
    const expr = quad ? lin([[k * p, 'x²'], [k * q, 'x']]) : lin([[k * p, 'x'], [k * q, '']])
    const inner = quad ? lin([[p, 'x'], [q, '']]) : lin([[p, 'x'], [q, '']])
    const right = opt(`${k}${v}(${inner})`, ok8(lang))
    const sub = [2, 3, 4].find(f => k % f === 0 && f < k)
    const wrongs = [
      opt(`${k}${v}(${lin([[p, 'x'], [-q, '']])})`, say(lang, 'Check the sign inside the bracket by multiplying back out.', 'Parantezi geri açarak içindeki işareti kontrol et.', 'Comprueba el signo de dentro multiplicando otra vez.')),
      opt(`${k}${v}(${lin([[p, 'x'], [k * q, '']])})`, say(lang, `Both terms have to be divided by ${k}${v}.`, `İki terim de ${k}${v}${v ? "'e" : trEk(k, 'dat')} bölünmeli.`, `Hay que dividir los dos términos entre ${k}${v}.`)),
      quad ? opt(`${k}(${lin([[p, 'x²'], [q, 'x']])})`, say(lang, 'That is equal, but x is still in both terms: take it out too.', 'Eşit, ama x hâlâ iki terimde de var: onu da dışarı al.', 'Es igual, pero x sigue en los dos términos: sácala también.'))
        : sub ? opt(`${sub}(${lin([[k * p / sub, 'x'], [k * q / sub, '']])})`, say(lang, `That is equal, but ${k / sub} still divides both terms: factorise fully.`, `Eşit, ama ${k / sub} hâlâ iki terimi de böler: tamamen çarpanlarına ayır.`, `Es igual, pero ${k / sub} aún divide a los dos términos: factoriza del todo.`)) : null,
    ].filter(Boolean)
    return {
      topic: T, level, question_text: say(lang, `Factorise fully: ${expr}`, `Tamamen çarpanlarına ayır: ${expr}`, `Factoriza del todo: ${expr}`),
      format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `a8:f:${expr}`,
      hint_steps: [say(lang, 'Find the biggest thing that divides every term — a number, and a letter if every term has one.', 'Her terimi bölen en büyük şeyi bul — bir sayı, ve her terimde varsa bir harf.', 'Busca lo más grande que divida a todos los términos: un número y, si todos la tienen, una letra.'),
                   say(lang, 'Put it outside the bracket; inside goes what is left of each term.', 'Onu parantezin dışına yaz; içine her terimden kalanlar gelir.', 'Ponlo fuera del paréntesis; dentro va lo que queda de cada término.')],
    }
  }
  if (shape === 'expand2') {
    const p = Math.random() < 0.35 ? randInt(2, 4) : 1
    let a, b
    do { a = pick([-1, 1]) * randInt(1, 7); b = pick([-1, 1]) * randInt(1, 7) } while (a === -b)
    const q = `(${lin([[p, 'x'], [a, '']])})(${lin([[1, 'x'], [b, '']])})`
    const right = opt(lin([[p, 'x²'], [p * b + a, 'x'], [a * b, '']]), ok8(lang))
    const wrongs = [
      opt(lin([[p, 'x²'], [a * b, '']]), say(lang, 'Each term in the first bracket multiplies each term in the second — four products, not two.', 'Birinci parantezdeki her terim ikincidekilerin her biriyle çarpılır — iki değil, dört çarpım.', 'Cada término del primer paréntesis multiplica a cada uno del segundo: cuatro productos, no dos.')),
      opt(lin([[p, 'x²'], [p * b - a, 'x'], [a * b, '']]), say(lang, 'Check the signs of the two x terms.', 'İki x teriminin işaretlerini kontrol et.', 'Revisa los signos de los dos términos con x.')),
      opt(lin([[p, 'x²'], [p * b + a, 'x'], [-a * b, '']]), say(lang, `The number on its own is ${minus(a)} × ${minus(b)}.`, `Tek başına kalan sayı ${minus(a)} × ${minus(b)}.`, `El número suelto es ${minus(a)} × ${minus(b)}.`)),
      opt(lin([[p, 'x²'], [a * b, 'x'], [p * b + a, '']]), say(lang, 'The x term comes from the outside and inside pairs; the number is the two last terms multiplied.', 'x\'li terim dış ve iç çiftlerden gelir; sayı, iki son terimin çarpımıdır.', 'El término en x sale de los pares de fuera y de dentro; el número es el producto de los dos últimos.')),
    ].filter(o => o.value !== right.value)
    return {
      topic: T, level, question_text: say(lang, `Multiply out: ${q}`, `Parantezleri aç: ${q}`, `Desarrolla: ${q}`),
      format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `a8:e:${q}`,
      hint_steps: [say(lang, 'Multiply each term in the first bracket by each term in the second: four products.', 'Birinci parantezdeki her terimi ikincidekilerle çarp: dört çarpım.', 'Multiplica cada término del primer paréntesis por cada uno del segundo: cuatro productos.'),
                   say(lang, 'Then collect the two x terms.', 'Sonra iki x\'li terimi topla.', 'Luego junta los dos términos con x.')],
    }
  }
  if (shape === 'solve') {
    for (;;) {
      const x = randInt(1, 12), form = randInt(0, 2)
      let q
      if (form === 0) {
        const a = randInt(3, 9), c = randInt(2, a - 1), b = randInt(1, 6)
        const num = a * (x - b)
        if (num % c) continue
        const d = num / c - x
        if (!d) continue
        q = `${a}(${lin([[1, 'x'], [-b, '']])}) = ${c}(${lin([[1, 'x'], [d, '']])})`
      } else if (form === 1) {
        const a = randInt(4, 12), c = randInt(2, a - 1), b = randInt(1, 6), d = randInt(1, 6)
        q = `${a}(x + ${b}) − ${c}(${lin([[1, 'x'], [-d, '']])}) = ${a * (x + b) - c * (x - d)}`
      } else {
        const a = randInt(2, 6), c = a + randInt(1, 5), p = randInt(1, 12)
        const r = (c - a) * x - p
        if (r <= 0) continue
        q = `${a}x + ${p} = ${c}x − ${r}`
      }
      return {
        topic: T, level, question_text: say(lang, `Solve: ${q}`, `Denklemi çöz: ${q}`, `Resuelve: ${q}`),
        format: 'numeric', correct_answer: x, operandKey: `a8:q:${q}`,
        hint_steps: [say(lang, 'Multiply out any brackets first.', 'Önce parantezleri aç.', 'Primero quita los paréntesis.'),
                     say(lang, 'Get the x terms on one side and the numbers on the other — do the same to both sides.', 'x\'li terimleri bir tarafa, sayıları diğer tarafa topla — iki tarafa da aynısını yap.', 'Pon los términos con x a un lado y los números al otro, haciendo lo mismo en los dos lados.')],
      }
    }
  }
  if (shape === 'simult') {
    for (;;) {
      const x = randInt(1, 9), y = randInt(1, 9)
      const a1 = randInt(1, 5), b1 = pick([-1, 1]) * randInt(1, 5), a2 = randInt(1, 5), b2 = pick([-1, 1]) * randInt(1, 5)
      if (a1 * b2 - a2 * b1 === 0 || (a1 === a2 && b1 === b2)) continue
      const e1 = `${lin([[a1, 'x'], [b1, 'y']])} = ${minus(a1 * x + b1 * y)}`, e2 = `${lin([[a2, 'x'], [b2, 'y']])} = ${minus(a2 * x + b2 * y)}`
      const askX = Math.random() < 0.5
      return {
        topic: T, level,
        question_text: say(lang, `Solve the simultaneous equations ${e1} and ${e2}. What is ${askX ? 'x' : 'y'}?`, `${e1} ve ${e2} denklem sistemini çöz. ${askX ? 'x' : 'y'} kaçtır?`, `Resuelve el sistema ${e1} y ${e2}. ¿Cuánto vale ${askX ? 'x' : 'y'}?`),
        format: 'numeric', correct_answer: askX ? x : y, operandKey: `a8:m:${e1}:${e2}:${askX}`,
        hint_steps: [say(lang, 'Multiply one or both equations so that x (or y) has the same number in front in both.', 'Denklemlerden birini ya da ikisini, x\'in (ya da y\'nin) katsayısı ikisinde de aynı olacak şekilde çarp.', 'Multiplica una o las dos ecuaciones para que x (o y) tenga el mismo coeficiente en ambas.'),
                     say(lang, 'Add or subtract the equations to get rid of that letter, solve, then put the answer back in.', 'O harfi yok etmek için denklemleri topla ya da çıkar, çöz, sonra bulduğunu yerine koy.', 'Suma o resta las ecuaciones para eliminar esa letra, resuelve y sustituye.')],
      }
    }
  }
  if (shape === 'subst') {
    const a = randInt(2, 6), b = randInt(2, 7), c = randInt(2, 4)
    const forms = [[`b a²`.replace(' ', ''), b * a * a], [`2a + 3b`, 2 * a + 3 * b], [`a² + b²`, a * a + b * b], [`${c}ab − a`, c * a * b - a], [`(a + b)²`, (a + b) ** 2], [`b³ − a²`, b ** 3 - a * a]]
    const [expr, ans] = pick(forms.filter(([, v]) => v > 0))
    return {
      topic: T, level,
      question_text: say(lang, `If a = ${a} and b = ${b}, what is ${expr}?`, `a = ${a} ve b = ${b} ise ${expr} kaçtır?`, `Si a = ${a} y b = ${b}, ¿cuánto vale ${expr}?`),
      format: 'numeric', correct_answer: ans, operandKey: `a8:u:${expr}:${a}:${b}`,
      hint_steps: [say(lang, 'Letters written side by side are multiplied: ab means a × b.', 'Yan yana yazılan harfler çarpılır: ab, a × b demek.', 'Las letras juntas se multiplican: ab es a × b.'),
                   say(lang, 'Powers first, then ×, then + and −.', 'Önce üsler, sonra ×, en son + ve −.', 'Primero potencias, luego ×, y al final + y −.')],
    }
  }
  // Two rectangles with the same area, sides written in x.
  for (;;) {
    const x = randInt(2, 8), a = randInt(1, 3), b = randInt(1, 6), h = randInt(2, 5), c = randInt(1, 3)
    const k = (h * (a * x + b)) / (c * x)
    if (!Number.isInteger(k) || k < 2 || k > 9 || (k === h && c === a)) continue
    const askX = Math.random() < 0.6
    return {
      topic: T, level,
      question_text: askX
        ? say(lang, 'Rectangles A and B have the same area. What is x?', 'A ve B dikdörtgenlerinin alanları eşit. x kaçtır?', 'Los rectángulos A y B tienen la misma área. ¿Cuánto vale x?')
        : say(lang, 'Rectangles A and B have the same area. What is that area, in cm²?', 'A ve B dikdörtgenlerinin alanları eşit. Bu alan kaç cm²?', 'Los rectángulos A y B tienen la misma área. ¿Cuál es esa área, en cm²?'),
      format: 'numeric', correct_answer: askX ? x : h * (a * x + b), operandKey: `a8:r:${x}:${a}:${b}:${h}:${c}:${askX}`,
      hint_steps: [say(lang, 'Write each area as length × width, in x.', 'Her alanı x cinsinden uzunluk × genişlik olarak yaz.', 'Escribe cada área como largo × ancho, con x.'),
                   say(lang, 'The two areas are equal: that is an equation. Solve it for x.', 'İki alan eşit: bu bir denklem. x için çöz.', 'Las dos áreas son iguales: eso es una ecuación. Resuélvela.')],
      visual: { kind: 'algrects', A: { w: lin([[a, 'x'], [b, '']]), h: String(h) }, B: { w: c === 1 ? 'x' : `${c}x`, h: String(k) } },
    }
  }
}

// ── 5. sequences, the nth term and straight-line graphs ───────────────────────────
const LINE_POOL = [
  { m: 3, c: 0, t: 'y = 3x' }, { m: 1, c: 3, t: 'y = x + 3' }, { m: -0.5, c: 7, t: 'y = 7 − ½x' }, { m: 1 / 3, c: 4, t: 'y = (x + 12) ÷ 3' },
  { m: 2, c: 1, t: 'y = 2x + 1' }, { m: -1, c: 10, t: 'y = 10 − x' }, { m: 0.5, c: 1, t: 'y = ½x + 1' }, { m: 1, c: 0, t: 'y = x' }, { m: -2, c: 10, t: 'y = 10 − 2x' },
]
function y8Sequences(level, lang) {
  const shape = pick(['nth', 'nth', 'term100', 'next', 'table', 'lines', 'meet'])
  const T = 'sequences-graphs'
  if (shape === 'nth' || shape === 'term100') {
    const d = randInt(2, 9), e = randInt(-5, 8)
    const terms = [1, 2, 3, 4].map(n => d * n + e)
    if (terms[0] <= 0) return y8Sequences(level, lang)
    const rule = lin([[d, 'n'], [e, '']])
    if (shape === 'term100') {
      const n = pick([15, 20, 50, 100])
      return {
        topic: T, level,
        question_text: say(lang, `${terms.join(', ')}, … What is the ${n}th term?`, `${terms.join(', ')}, … ${n}. terim kaçtır?`, `${terms.join(', ')}, … ¿Cuál es el término ${n}?`),
        format: 'numeric', correct_answer: d * n + e, operandKey: `sg:h:${d}:${e}:${n}`,
        hint_steps: [say(lang, `The terms go up by ${d} each time, so the rule starts ${d}n.`, `Terimler her seferinde ${d} artıyor, yani kural ${d}n ile başlar.`, `Los términos suben de ${d} en ${d}, así que la regla empieza por ${d}n.`),
                     say(lang, `Check it on the first term (n = 1), fix the number on the end, then put in n = ${n}.`, `İlk terimde (n = 1) dene, sondaki sayıyı düzelt, sonra n = ${n} koy.`, `Compruébalo con el primer término (n = 1), ajusta el número del final y pon n = ${n}.`)],
      }
    }
    const right = opt(rule, ok8(lang))
    const cands = [lin([[1, 'n'], [d, '']]), lin([[d, 'n'], [terms[0], '']]), lin([[d, 'n'], [-e, '']]), lin([[terms[0], 'n'], [d, '']])]
    const wrongs = cands.filter(s => s !== rule).map(s => {
      const [cm, cc] = s === cands[0] ? [1, d] : s === cands[1] ? [d, terms[0]] : s === cands[2] ? [d, -e] : [terms[0], d]
      const got = cm + cc
      const n = got !== terms[0] ? 1 : 2
      return opt(s, say(lang, `Try n = ${n}: this gives ${cm * n + cc}, but term ${n} is ${terms[n - 1]}.`, `n = ${n} dene: ${cm * n + cc} verir, ama ${n}. terim ${terms[n - 1]}.`, `Prueba n = ${n}: da ${cm * n + cc}, pero el término ${n} es ${terms[n - 1]}.`))
    })
    return {
      topic: T, level,
      question_text: say(lang, `What is the nth term of ${terms.join(', ')}, …?`, `${terms.join(', ')}, … dizisinin n. terimi nedir?`, `¿Cuál es el término n-ésimo de ${terms.join(', ')}, …?`),
      format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `sg:n:${d}:${e}`,
      hint_steps: [say(lang, 'How much does it go up each time? That number goes in front of n.', 'Her seferinde ne kadar artıyor? O sayı n\'nin önüne gelir.', '¿Cuánto sube cada vez? Ese número va delante de n.'),
                   say(lang, 'Then check with n = 1 and add or take away to reach the first term.', 'Sonra n = 1 ile dene ve ilk terime ulaşmak için ekle ya da çıkar.', 'Luego prueba con n = 1 y suma o resta hasta llegar al primer término.')],
    }
  }
  if (shape === 'next') {
    const form = randInt(0, 4)
    let t, why
    if (form === 0) { const r = pick([2, 3]), a = randInt(1, 5); t = [0, 1, 2, 3, 4].map(i => a * r ** i); why = say(lang, `Each term is × ${r}.`, `Her terim × ${r}.`, `Cada término es × ${r}.`) }
    else if (form === 1) { const a = randInt(1, 3); t = [a]; for (let i = 0; i < 5; i++) t.push(t[t.length - 1] * 2 + 1); t = t.slice(0, 5); why = say(lang, 'Double and add 1.', 'İki katı artı 1.', 'El doble más 1.') }
    else if (form === 2) { const k = randInt(-3, 5), s = randInt(1, 4); t = [0, 1, 2, 3, 4].map(i => (s + i) ** 2 + k); why = say(lang, 'Look at the gaps: they go up by 2 each time.', 'Aralara bak: her seferinde 2 artıyor.', 'Mira las diferencias: suben de 2 en 2.') }
    else if (form === 3) { const a = randInt(-2, 5), g = randInt(1, 4); t = [a]; for (let i = 0; i < 4; i++) t.push(t[i] + g + 2 * i); why = say(lang, `The gaps go ${g}, ${g + 2}, ${g + 4}, … — up by 2 each time.`, `Aralar ${g}, ${g + 2}, ${g + 4}, … — her seferinde 2 artıyor.`, `Las diferencias son ${g}, ${g + 2}, ${g + 4}…: suben de 2 en 2.`) }
    else { const a = randInt(20, 40), g = randInt(3, 8); t = [0, 1, 2, 3, 4].map(i => a - g * i); why = say(lang, `Each term is ${g} less.`, `Her terim ${g} eksik.`, `Cada término es ${g} menos.`) }
    const shown = t.slice(0, 4), ans = t[4]
    return {
      topic: T, level, question_text: `${shown.map(minus).join(', ')}, ?`, format: ans < 0 ? 'choice' : 'numeric', correct_answer: ans < 0 ? minus(ans) : ans,
      ...(ans < 0 ? { options: choiceOf(opt(minus(ans), ok8(lang)), [opt(minus(-ans), why), opt(minus(ans + 1), why), opt(minus(ans - 1), why)]) } : {}),
      operandKey: `sg:x:${t.join(',')}`,
      hint_steps: [say(lang, 'Look at how each term is made from the one before.', 'Her terimin bir öncekinden nasıl elde edildiğine bak.', 'Mira cómo se forma cada término a partir del anterior.'),
                   say(lang, 'If adding does not work, try multiplying — or look at the gaps between the gaps.', 'Toplama işe yaramıyorsa çarpmayı dene — ya da aralar arasındaki farklara bak.', 'Si sumar no funciona, prueba a multiplicar, o mira las diferencias entre las diferencias.')],
    }
  }
  if (shape === 'table') {
    const rules = [
      { t: 'y = 2x + 3', f: x => 2 * x + 3 }, { t: 'y = 37 − 5x', f: x => 37 - 5 * x }, { t: 'y = x² + 2x', f: x => x * x + 2 * x },
      { t: 'y = 10 − x', f: x => 10 - x }, { t: 'y = 3x − 2', f: x => 3 * x - 2 }, { t: 'y = x² − 1', f: x => x * x - 1 },
    ]
    const r = pick(rules)
    const xs = [0, 1, 2, 3, 4, 5, 6].filter(x => r.f(x) >= 0).slice(0, 6)
    const miss = randInt(2, xs.length - 1)
    return {
      topic: T, level,
      question_text: say(lang, `This is a table of values for ${r.t}. What number is missing?`, `Bu tablo ${r.t} için değerler tablosu. Eksik sayı kaçtır?`, `Esta es una tabla de valores de ${r.t}. ¿Qué número falta?`),
      format: 'numeric', correct_answer: r.f(xs[miss]), operandKey: `sg:t:${r.t}:${xs[miss]}`,
      hint_steps: [say(lang, 'Put the x value from the top row into the rule.', 'Üst satırdaki x değerini kurala koy.', 'Pon el valor de x de la fila de arriba en la regla.'),
                   say(lang, 'Check your working on a column you can already see.', 'İşlemini zaten görebildiğin bir sütunda kontrol et.', 'Comprueba el cálculo con una columna que ya ves.')],
      visual: { kind: 'chart', shape: 'table', cols: xs.map(x => `x = ${x}`), rows: [{ label: 'y', cells: xs.map((x, i) => (i === miss ? null : r.f(x))) }] },
    }
  }
  let draw
  do { draw = shuffle(LINE_POOL).slice(0, shape === 'meet' ? 2 : 4) } while (new Set(draw.map(l => l.c)).size < draw.length)
  if (shape === 'meet') {
    const [p, q] = draw
    if (p.m === q.m) return y8Sequences(level, lang)
    const x = Math.round(((q.c - p.c) / (p.m - q.m)) * 1e6) / 1e6, y = Math.round((p.m * x + p.c) * 1e6) / 1e6
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > 10 || y < 0 || y > 10) return y8Sequences(level, lang)
    const right = opt(pairOf(x, y), ok8(lang))
    const wrongs = [[y, x], [x + 1, y], [x, y + 1], [x - 1, y - 1]].filter(([a, b]) => (a !== x || b !== y) && a >= 0 && b >= 0)
      .map(([a, b]) => opt(pairOf(a, b), say(lang, `Put x = ${a} into ${p.t}: y is ${round2(p.m * a + p.c)}, not ${b}.`, `${p.t} kuralına x = ${a} koy: y ${dnum(String(round2(p.m * a + p.c)), lang)} olur, ${b} değil.`, `Pon x = ${a} en ${p.t}: y vale ${dnum(String(round2(p.m * a + p.c)), lang)}, no ${b}.`)))
    return {
      topic: T, level,
      question_text: say(lang, `The lines ${p.t} and ${q.t} are drawn. Where do they cross?`, `${p.t} ve ${q.t} doğruları çizili. Nerede kesişiyorlar?`, `Están dibujadas las rectas ${p.t} y ${q.t}. ¿Dónde se cortan?`),
      format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `sg:m:${p.t}:${q.t}`,
      hint_steps: [say(lang, 'Read the point where the two lines meet: across first, then up.', 'İki doğrunun buluştuğu noktayı oku: önce yatay, sonra dikey.', 'Lee el punto donde se cruzan: primero horizontal, luego vertical.'),
                   say(lang, 'Check it: the point has to fit BOTH rules.', 'Kontrol et: nokta İKİ kurala da uymalı.', 'Compruébalo: el punto tiene que cumplir LAS DOS reglas.')],
      visual: { kind: 'plane', min: 0, max: 10, points: [], lines: draw.map((l, i) => ({ m: l.m, c: l.c, label: 'ab'[i] })) },
    }
  }
  const k = randInt(0, 3)
  const letters = ['a', 'b', 'c', 'd']
  const right = opt(letters[k], ok8(lang))
  const wrongs = letters.filter((_, i) => i !== k).map(L => {
    const l = draw[letters.indexOf(L)]
    return opt(L, say(lang, `Line ${L} crosses the y-axis at ${dnum(String(round2(l.c)), lang)}. Put x = 0 into ${draw[k].t}.`, `${L} doğrusu y eksenini ${dnum(String(round2(l.c)), lang)}${trEk(round2(l.c), 'loc')} kesiyor. ${draw[k].t} kuralına x = 0 koy.`, `La recta ${L} corta el eje y en ${dnum(String(round2(l.c)), lang)}. Pon x = 0 en ${draw[k].t}.`))
  })
  return {
    topic: T, level,
    question_text: say(lang, `Which line is ${draw[k].t}?`, `Hangi doğru ${draw[k].t}?`, `¿Qué recta es ${draw[k].t}?`),
    format: 'choice', options: choiceOf(right, wrongs, { sort: (a, b) => a.value.localeCompare(b.value) }), correct_answer: right.value, operandKey: `sg:l:${draw.map(l => l.t).join('|')}:${k}`,
    hint_steps: [say(lang, 'Put x = 0 into the rule: that is where the line crosses the y-axis.', 'Kurala x = 0 koy: doğrunun y eksenini kestiği yer orası.', 'Pon x = 0 en la regla: ahí corta la recta el eje y.'),
                 say(lang, 'Then check one more point, and whether the line goes up or down.', 'Sonra bir nokta daha dene, doğrunun yukarı mı aşağı mı gittiğine bak.', 'Luego prueba otro punto y mira si la recta sube o baja.')],
    visual: { kind: 'plane', min: 0, max: 10, points: [], lines: draw.map((l, i) => ({ m: l.m, c: l.c, label: letters[i] })) },
  }
}

// ── 6. ratio, proportion, rates and conversions ───────────────────────────────────
function y8Ratio(level, lang) {
  const shape = pick(['share', 'equiv', 'inverse', 'convert', 'convert', 'speed', 'unit', 'gears', 'gears', 'enlarge'])
  const T = 'ratio-8'
  if (shape === 'share') {
    const parts = Array.from({ length: randInt(3, 4) }, () => randInt(1, 6))
    const sum = parts.reduce((a, b) => a + b, 0), k = randInt(3, 12), i = randInt(0, parts.length - 1)
    const cols = say(lang, ['red', 'green', 'yellow', 'blue'], ['kırmızı', 'yeşil', 'sarı', 'mavi'], ['rojos', 'verdes', 'amarillos', 'azules'])
    const used = cols.slice(0, parts.length)
    const listed = used.slice(0, -1).join(', ') + say(lang, ' and ', ' ve ', ' y ') + used[used.length - 1]
    return {
      topic: T, level,
      question_text: say(lang, `A packet of ${sum * k} sweets has ${listed} sweets in the ratio ${parts.join(':')}. How many are ${cols[i]}?`,
        `${sum * k} şekerlik bir pakette ${listed} şekerler ${parts.join(':')} oranında. Kaç tanesi ${cols[i]}?`,
        `Una bolsa de ${sum * k} caramelos tiene caramelos ${listed} en la razón ${parts.join(':')}. ¿Cuántos son ${cols[i]}?`),
      format: 'numeric', correct_answer: parts[i] * k, operandKey: `r8:s:${parts.join(':')}:${k}:${i}`,
      hint_steps: [say(lang, 'Add the parts of the ratio: that is how many equal shares there are.', 'Oranın parçalarını topla: kaç eşit pay olduğunu verir.', 'Suma las partes de la razón: así sabes cuántas partes iguales hay.'),
                   say(lang, 'Find one share, then multiply by that colour\'s part.', 'Bir payı bul, sonra o rengin parçasıyla çarp.', 'Halla una parte y multiplícala por la de ese color.')],
    }
  }
  if (shape === 'equiv') {
    let p, q
    do { p = randInt(1, 9); q = randInt(2, 9) } while (gcd(p, q) !== 1 || p === q)
    const k = randInt(3, 15)
    return {
      topic: T, level, question_text: say(lang, `The ratio x : ${q * k} is equivalent to ${p} : ${q}. What is x?`, `x : ${q * k} oranı ${p} : ${q} oranına denk. x kaçtır?`, `La razón x : ${q * k} es equivalente a ${p} : ${q}. ¿Cuánto vale x?`),
      format: 'numeric', correct_answer: p * k, operandKey: `r8:e:${p}:${q}:${k}`,
      hint_steps: [say(lang, `What was ${q} multiplied by to make ${q * k}?`, `${q}, neyle çarpılınca ${q * k} oldu?`, `¿Por cuánto se multiplicó ${q} para dar ${q * k}?`),
                   say(lang, 'Do the same to the other side.', 'Aynısını diğer tarafa da yap.', 'Haz lo mismo con el otro lado.')],
    }
  }
  if (shape === 'inverse') {
    let D, H, H2
    do { D = randInt(6, 30); H = randInt(4, 12); H2 = randInt(4, 12) } while (H === H2 || (D * H) % H2)
    return {
      topic: T, level,
      question_text: say(lang, `A job takes ${D} days working ${H} hours a day. How many days would it take working ${H2} hours a day?`, `Bir iş günde ${H} saat çalışınca ${D} gün sürüyor. Günde ${H2} saat çalışılırsa kaç gün sürer?`, `Un trabajo dura ${D} días trabajando ${H} horas al día. ¿Cuántos días duraría trabajando ${H2} horas al día?`),
      format: 'numeric', correct_answer: (D * H) / H2, operandKey: `r8:i:${D}:${H}:${H2}`,
      hint_steps: [say(lang, 'Work out the total number of hours the job needs.', 'İşin toplam kaç saat sürdüğünü bul.', 'Calcula cuántas horas necesita el trabajo en total.'),
                   say(lang, `More hours a day means fewer days: share the total by ${H2}.`, `Günde daha çok saat, daha az gün demek: toplamı ${H2}${trEk(H2, 'dat')} böl.`, `Más horas al día son menos días: reparte el total entre ${H2}.`)],
    }
  }
  if (shape === 'convert') {
    const form = randInt(0, 3)
    let q, ans, hints
    if (form === 0) {
      const toKm = Math.random() < 0.5, k = randInt(2, 30)
      q = toKm ? say(lang, `Using 5 miles ≈ 8 km, about how many km is ${5 * k} miles?`, `5 mil ≈ 8 km ise ${5 * k} mil yaklaşık kaç km?`, `Si 5 millas ≈ 8 km, ¿cuántos km son unas ${5 * k} millas?`)
        : say(lang, `Using 5 miles ≈ 8 km, about how many miles is ${8 * k} km?`, `5 mil ≈ 8 km ise ${8 * k} km yaklaşık kaç mil?`, `Si 5 millas ≈ 8 km, ¿cuántas millas son unos ${8 * k} km?`)
      ans = toKm ? 8 * k : 5 * k
      hints = [say(lang, `How many lots of ${toKm ? 5 : 8} are there?`, `Kaç tane ${toKm ? 5 : 8} var?`, `¿Cuántas veces cabe ${toKm ? 5 : 8}?`), say(lang, `Each lot is worth ${toKm ? 8 : 5}.`, `Her biri ${toKm ? 8 : 5} eder.`, `Cada una vale ${toKm ? 8 : 5}.`)]
    } else if (form === 1) {
      const cm2 = randInt(1000, 90000) * 10
      q = say(lang, `How many m² is ${num(cm2, lang)} cm²?`, `${num(cm2, lang)} cm² kaç m²?`, `¿Cuántos m² son ${num(cm2, lang)} cm²?`)
      ans = cm2 / 10000
      hints = [say(lang, '1 m is 100 cm, so 1 m² is 100 × 100 cm².', '1 m 100 cm, yani 1 m² = 100 × 100 cm².', '1 m son 100 cm, así que 1 m² son 100 × 100 cm².'), say(lang, 'Divide by 10,000.', '10.000\'e böl.', 'Divide entre 10.000.')]
    } else if (form === 2) {
      const w = randInt(1, 4), d = randInt(1, 6), h = randInt(1, 23)
      q = say(lang, `How many minutes are there in ${w} week${w > 1 ? 's' : ''}, ${d} day${d > 1 ? 's' : ''} and ${h} hour${h > 1 ? 's' : ''}?`, `${w} hafta, ${d} gün ve ${h} saatte kaç dakika vardır?`, `¿Cuántos minutos hay en ${w} semana${w > 1 ? 's' : ''}, ${d} día${d > 1 ? 's' : ''} y ${h} hora${h > 1 ? 's' : ''}?`)
      ans = ((w * 7 + d) * 24 + h) * 60
      hints = [say(lang, 'Turn everything into hours first: a week is 7 days, a day is 24 hours.', 'Önce her şeyi saate çevir: bir hafta 7 gün, bir gün 24 saat.', 'Pásalo todo primero a horas: una semana son 7 días y un día 24 horas.'), say(lang, 'Then × 60.', 'Sonra × 60.', 'Luego × 60.')]
    } else {
      const km = randInt(1, 40) + pick([0.25, 0.5, 0.75, 0.125, 0.05])
      q = say(lang, `How many metres are there in ${dnum(String(km), lang)} km?`, `${dnum(String(km), lang)} km kaç metredir?`, `¿Cuántos metros hay en ${dnum(String(km), lang)} km?`)
      ans = Math.round(km * 1000)
      hints = [say(lang, '1 km is 1000 m.', '1 km, 1000 m.', '1 km son 1000 m.'), say(lang, 'Multiplying by 1000 moves the digits three places.', '1000 ile çarpmak rakamları üç basamak kaydırır.', 'Multiplicar por 1000 mueve las cifras tres lugares.')]
    }
    return { topic: T, level, question_text: q, format: Number.isInteger(ans) ? 'numeric' : 'decimal', correct_answer: ans, operandKey: `r8:c:${q}`, hint_steps: hints }
  }
  if (shape === 'speed') {
    const t = pick([1.5, 2, 2.5, 3, 4, 0.5]), v = randInt(20, 80) + pick([0, 0, 0.4, 0.8, 0.6])
    const d = Math.round(v * t * 10) / 10
    const ans = Math.round((d / t) * 100) / 100
    const tS = say(lang, t === 0.5 ? 'half an hour' : t % 1 ? `${Math.floor(t)}½ hours` : `${t} hours`, t === 0.5 ? 'yarım saatte' : `${dnum(String(t), lang)} saatte`, t === 0.5 ? 'media hora' : t % 1 ? `${Math.floor(t)} horas y media` : `${t} horas`)
    return {
      topic: T, level,
      question_text: say(lang, `A car travels ${dnum(String(d), lang)} km in ${tS}. What is its average speed in km/h?`, `Bir araba ${tS} ${dnum(String(d), lang)} km gidiyor. Ortalama hızı kaç km/sa?`, `Un coche recorre ${dnum(String(d), lang)} km en ${tS}. ¿Cuál es su velocidad media en km/h?`),
      format: Number.isInteger(ans) ? 'numeric' : 'decimal', correct_answer: ans, operandKey: `r8:v:${d}:${t}`,
      hint_steps: [say(lang, 'Speed is distance ÷ time.', 'Hız = yol ÷ zaman.', 'Velocidad = distancia ÷ tiempo.'), t % 1 ? say(lang, 'Half an hour is 0.5 of an hour — minutes are not decimals.', 'Yarım saat 0,5 saattir — dakikalar ondalık değildir.', 'Media hora es 0,5 horas: los minutos no son decimales.') : say(lang, 'Share the distance equally between the hours.', 'Yolu saatlere eşit paylaştır.', 'Reparte la distancia entre las horas.')],
    }
  }
  if (shape === 'unit') {
    let q1, p1, q2
    do { q1 = pick([50, 75, 100, 120, 150, 200, 250]); p1 = randInt(20, 99); q2 = pick([30, 45, 60, 80, 90, 180, 270, 300, 400]) } while ((p1 * q2) % q1 || q1 === q2)
    return {
      topic: T, level,
      question_text: say(lang, `${q1} g of sweets costs ${p1} cents. How many cents would ${q2} g cost?`, `${q1} g şeker ${p1} kuruş. ${q2} g kaç kuruş tutar?`, `${q1} g de caramelos cuestan ${p1} céntimos. ¿Cuántos céntimos costarían ${q2} g?`),
      format: 'numeric', correct_answer: (p1 * q2) / q1, operandKey: `r8:u:${q1}:${p1}:${q2}`,
      hint_steps: [say(lang, `Find the cost of a smaller amount that goes into both ${q1} g and ${q2} g.`, `Hem ${q1} g'a hem ${q2} g'a sığan daha küçük bir miktarın fiyatını bul.`, `Halla el precio de una cantidad más pequeña que quepa en ${q1} g y en ${q2} g.`),
                   say(lang, 'Then multiply up.', 'Sonra çarparak büyüt.', 'Luego multiplica.')],
    }
  }
  if (shape === 'gears') {
    let tA, tB, n
    do { tA = pick([8, 10, 12, 15, 16, 18, 20, 24, 30, 36]); tB = pick([8, 10, 12, 15, 16, 18, 20, 24, 30, 36]); n = randInt(2, 12) } while (tA === tB || (n * tA) % tB)
    return {
      topic: T, level,
      question_text: say(lang, `Gear A has ${tA} teeth and gear B has ${tB}. They turn together. If A makes ${n} whole turns, how many turns does B make?`, `A dişlisinin ${tA}, B'nin ${tB} dişi var. Birlikte dönüyorlar. A ${n} tam tur atarsa B kaç tur atar?`, `El engranaje A tiene ${tA} dientes y el B tiene ${tB}. Giran juntos. Si A da ${n} vueltas, ¿cuántas da B?`),
      format: 'numeric', correct_answer: (n * tA) / tB, operandKey: `r8:g:${tA}:${tB}:${n}`,
      hint_steps: [say(lang, `Count the teeth that pass: ${n} turns of A pushes ${n} × ${tA} teeth past.`, `Geçen dişleri say: A'nın ${n} turu ${n} × ${tA} diş geçirir.`, `Cuenta los dientes que pasan: ${n} vueltas de A hacen pasar ${n} × ${tA} dientes.`),
                   say(lang, `B turns once for every ${tB} teeth.`, `B her ${tB} dişte bir tur döner.`, `B da una vuelta cada ${tB} dientes.`)],
      visual: { kind: 'gears', teeth: [tA, tB] },
    }
  }
  const w = randInt(2, 9), h = randInt(2, 9), k = pick([2, 3, 4, 1.5])
  const askTimes = Math.random() < 0.4
  const ans = askTimes ? k * k : w * h * k * k
  return {
    topic: T, level,
    question_text: askTimes
      ? say(lang, `A shape is enlarged by a scale factor of ${dnum(String(k), lang)}. How many times bigger is its area?`, `Bir şekil ${dnum(String(k), lang)} ölçek çarpanıyla büyütülüyor. Alanı kaç kat büyür?`, `Una figura se amplía con factor de escala ${dnum(String(k), lang)}. ¿Cuántas veces mayor es su área?`)
      : say(lang, `A rectangle ${w} cm by ${h} cm is enlarged by a scale factor of ${dnum(String(k), lang)}. What is the new area, in cm²?`, `${w} cm'ye ${h} cm'lik bir dikdörtgen ${dnum(String(k), lang)} ölçek çarpanıyla büyütülüyor. Yeni alan kaç cm²?`, `Un rectángulo de ${w} cm por ${h} cm se amplía con factor ${dnum(String(k), lang)}. ¿Cuál es la nueva área, en cm²?`),
    format: Number.isInteger(ans) ? 'numeric' : 'decimal', correct_answer: ans, operandKey: `r8:x:${w}:${h}:${k}:${askTimes}`,
    hint_steps: [say(lang, 'Both the length AND the width get multiplied by the scale factor.', 'Hem uzunluk HEM genişlik ölçek çarpanıyla çarpılır.', 'Se multiplican por el factor tanto el largo COMO el ancho.'),
                 say(lang, 'So the area is multiplied by the scale factor twice.', 'Yani alan, ölçek çarpanıyla iki kez çarpılır.', 'Así que el área se multiplica dos veces por el factor.')],
  }
}

// ── 7. volume, surface area, circles, Pythagoras, parallel lines ──────────────────
const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29]]
function y8Geometry(level, lang) {
  const shape = pick(['cuboid', 'cuboid', 'parallel', 'parallel', 'circle', 'circle', 'pythag', 'pythag', 'polygon', 'garden', 'enlarge', 'angles'])
  const T = 'geometry-8'
  if (shape === 'angles') return { ...angleDiagram(level, lang), topic: T }
  if (shape === 'cuboid') {
    const half = Math.random() < 0.25
    const [l, w, h] = [randInt(3, 20), randInt(2, 12), randInt(2, 15)].map((v, i) => (half && i === 1 ? v + 0.5 : v))
    const form = pick(['v', 'v', 'sa', 'sa', 'h'])
    const V = l * w * h, SA = 2 * (l * w + l * h + w * h)
    return {
      topic: T, level,
      question_text: form === 'v' ? say(lang, 'What is the volume of this cuboid, in cm³?', 'Bu dikdörtgenler prizmasının hacmi kaç cm³?', '¿Cuál es el volumen de este ortoedro, en cm³?')
        : form === 'sa' ? say(lang, 'What is the surface area of this cuboid, in cm²?', 'Bu dikdörtgenler prizmasının yüzey alanı kaç cm²?', '¿Cuál es el área total de este ortoedro, en cm²?')
          : say(lang, `This cuboid holds ${dnum(String(V), lang)} cm³. How tall is it, in cm?`, `Bu dikdörtgenler prizmasının hacmi ${dnum(String(V), lang)} cm³. Yüksekliği kaç cm?`, `Este ortoedro tiene ${dnum(String(V), lang)} cm³. ¿Cuánto mide de alto, en cm?`),
      format: [V, SA, h][['v', 'sa', 'h'].indexOf(form)] % 1 ? 'decimal' : 'numeric', correct_answer: form === 'v' ? V : form === 'sa' ? SA : h,
      operandKey: `g8:c:${form}:${l}:${w}:${h}`,
      hint_steps: form === 'sa'
        ? [say(lang, 'There are six faces, in three matching pairs: front and back, top and bottom, the two ends.', 'Altı yüz var, üç eş çift hâlinde: ön-arka, alt-üst, iki yan.', 'Tiene seis caras, en tres parejas iguales: delante y detrás, arriba y abajo, los dos lados.'),
           say(lang, 'Find the area of one of each pair, add them, then double.', 'Her çiftin birinin alanını bul, topla, sonra iki katını al.', 'Halla el área de una cara de cada pareja, súmalas y multiplica por 2.')]
        : [say(lang, 'Volume = length × width × height.', 'Hacim = uzunluk × genişlik × yükseklik.', 'Volumen = largo × ancho × alto.'),
           form === 'h' ? say(lang, 'Going backwards: divide the volume by the area of the base.', 'Geriye gitmek: hacmi taban alanına böl.', 'Hacia atrás: divide el volumen entre el área de la base.') : say(lang, 'Multiply two of them first, then the third.', 'Önce ikisini çarp, sonra üçüncüsüyle.', 'Multiplica dos y luego el tercero.')],
      visual: { kind: 'cuboid', l, w, h: form === 'h' ? '?' : h, unit: 'cm' },
    }
  }
  if (shape === 'parallel') {
    const t = randInt(35, 80) + (Math.random() < 0.5 ? 0 : randInt(1, 40))
    const type = pick(['alt', 'corr', 'co'])
    // The asked angle is always t; for co-interior the one given is 180 − t.
    const ans = t
    return {
      topic: T, level,
      question_text: say(lang, 'The two lines marked with arrows are parallel. What is the angle marked ?', 'Okla işaretli iki doğru paralel. ? ile gösterilen açı kaç derecedir?', 'Las dos rectas marcadas con flechas son paralelas. ¿Cuánto mide el ángulo marcado con ?'),
      format: 'numeric', correct_answer: ans, operandKey: `g8:p:${type}:${t}`,
      hint_steps: [type === 'alt' ? say(lang, 'The two angles make a Z shape: alternate angles are equal.', 'İki açı Z şekli yapıyor: iç ters açılar eşittir.', 'Los dos ángulos forman una Z: los alternos son iguales.')
        : type === 'corr' ? say(lang, 'The two angles sit in the same position at each crossing: corresponding angles are equal.', 'İki açı her kesişimde aynı yerde: yöndeş açılar eşittir.', 'Los dos ángulos están en la misma posición en cada cruce: los correspondientes son iguales.')
          : say(lang, 'The two angles are between the parallel lines on the same side: they add up to 180°.', 'İki açı paralel doğruların arasında, aynı tarafta: toplamları 180°.', 'Los dos ángulos están entre las paralelas del mismo lado: suman 180°.'),
      say(lang, 'Find the matching angle at the other crossing first if it helps.', 'İşine yararsa önce diğer kesişimdeki eş açıyı bul.', 'Si te ayuda, halla primero el ángulo equivalente en el otro cruce.')],
      visual: { kind: 'angles', type: 'parallel', t, ask: type },
    }
  }
  if (shape === 'circle') {
    const r = randInt(2, 15)
    const form = pick(['circ', 'area', 'rFromC', 'rFromA'])
    const byD = Math.random() < 0.4
    const C = round2(2 * 3.14 * r), A = round2(3.14 * r * r)
    const q = form === 'circ' ? say(lang, `Taking π as 3.14, what is the circumference of this circle, in cm?`, `π'yi 3,14 al. Bu çemberin çevresi kaç cm?`, `Con π = 3,14, ¿cuál es la longitud de esta circunferencia, en cm?`)
      : form === 'area' ? say(lang, `Taking π as 3.14, what is the area of this circle, in cm²?`, `π'yi 3,14 al. Bu dairenin alanı kaç cm²?`, `Con π = 3,14, ¿cuál es el área de este círculo, en cm²?`)
        : form === 'rFromC' ? say(lang, `A circle has a circumference of ${dnum(String(C), lang)} cm. Taking π as 3.14, what is its radius?`, `Bir çemberin çevresi ${dnum(String(C), lang)} cm. π'yi 3,14 al. Yarıçapı kaç cm?`, `Una circunferencia mide ${dnum(String(C), lang)} cm. Con π = 3,14, ¿cuál es su radio?`)
          : say(lang, `A circle has an area of ${dnum(String(A), lang)} cm². Taking π as 3.14, what is its radius?`, `Bir dairenin alanı ${dnum(String(A), lang)} cm². π'yi 3,14 al. Yarıçapı kaç cm?`, `Un círculo tiene un área de ${dnum(String(A), lang)} cm². Con π = 3,14, ¿cuál es su radio?`)
    const ans = form === 'circ' ? C : form === 'area' ? A : r
    return {
      topic: T, level, question_text: q, format: Number.isInteger(ans) ? 'numeric' : 'decimal', correct_answer: ans, operandKey: `g8:o:${form}:${r}:${byD}`,
      hint_steps: [form === 'circ' || form === 'rFromC' ? say(lang, 'Circumference = π × diameter, and the diameter is twice the radius.', 'Çevre = π × çap; çap, yarıçapın iki katı.', 'Longitud = π × diámetro, y el diámetro es el doble del radio.')
        : say(lang, 'Area = π × radius × radius.', 'Alan = π × yarıçap × yarıçap.', 'Área = π × radio × radio.'),
      form === 'rFromA' ? say(lang, 'Divide by 3.14, then find the number that times itself gives that.', '3,14\'e böl, sonra kendisiyle çarpılınca bunu veren sayıyı bul.', 'Divide entre 3,14 y busca el número que multiplicado por sí mismo da eso.')
        : form === 'rFromC' ? say(lang, 'Divide by 3.14 to get the diameter, then halve it.', 'Çapı bulmak için 3,14\'e böl, sonra yarıya böl.', 'Divide entre 3,14 para el diámetro y luego a la mitad.')
          : byD ? say(lang, 'The picture gives the diameter: halve it for the radius.', 'Resimde çap verilmiş: yarıçap için yarıya böl.', 'El dibujo da el diámetro: divídelo entre 2 para el radio.') : say(lang, 'Use the radius from the picture.', 'Resimdeki yarıçapı kullan.', 'Usa el radio del dibujo.')],
      visual: { kind: 'circle', r, show: form === 'circ' || form === 'area' ? (byD ? 'd' : 'r') : null },
    }
  }
  if (shape === 'pythag') {
    const [a, b, c] = pick(TRIPLES), k = pick([1, 1, 2, 3])
    const askHyp = Math.random() < 0.55
    const [A, B, C] = [a * k, b * k, c * k]
    return {
      topic: T, level,
      question_text: askHyp ? say(lang, 'This triangle has a right angle. How long is the longest side, in cm?', 'Bu üçgende bir dik açı var. En uzun kenar kaç cm?', 'Este triángulo tiene un ángulo recto. ¿Cuánto mide el lado más largo, en cm?')
        : say(lang, 'This triangle has a right angle. How long is the side marked ?, in cm?', 'Bu üçgende bir dik açı var. ? ile gösterilen kenar kaç cm?', 'Este triángulo tiene un ángulo recto. ¿Cuánto mide el lado marcado con ?, en cm?'),
      format: 'numeric', correct_answer: askHyp ? C : B, operandKey: `g8:y:${A}:${B}:${askHyp}`,
      hint_steps: [say(lang, 'Pythagoras: the longest side squared = the other two sides squared, added.', 'Pisagor: en uzun kenarın karesi = diğer iki kenarın karelerinin toplamı.', 'Pitágoras: el lado más largo al cuadrado = la suma de los cuadrados de los otros dos.'),
                   askHyp ? say(lang, 'Square the two short sides, add, then find the square root.', 'İki kısa kenarın karesini al, topla, sonra karekökünü bul.', 'Eleva al cuadrado los dos lados cortos, súmalos y halla la raíz.')
                     : say(lang, 'Square the longest side, take away the square of the other, then find the square root.', 'En uzun kenarın karesinden diğerinin karesini çıkar, sonra karekökünü bul.', 'Al cuadrado del lado largo réstale el cuadrado del otro y halla la raíz.')],
      visual: { kind: 'righttri', a: A, b: askHyp ? B : '?', c: askHyp ? '?' : C, unit: 'cm' },
    }
  }
  if (shape === 'polygon') {
    const n = pick([5, 6, 8, 9, 10, 12, 15, 18, 20])
    const form = pick(['ext', 'int', 'sides'])
    const ext = 360 / n
    const name = pickL(POLY[n] ?? { en: `${n}-sided shape`, tr: `${n} kenarlı çokgen`, es: `polígono de ${n} lados` }, lang)
    return {
      topic: T, level,
      question_text: form === 'sides'
        ? say(lang, `Each exterior angle of a regular polygon is ${ext}°. How many sides does it have?`, `Düzgün bir çokgenin her dış açısı ${ext}°. Kaç kenarı var?`, `Cada ángulo exterior de un polígono regular mide ${ext}°. ¿Cuántos lados tiene?`)
        : form === 'ext' ? say(lang, `What is the size of each exterior angle of a regular ${name}?`, `Düzgün bir ${name}in her dış açısı kaç derecedir?`, `¿Cuánto mide cada ángulo exterior de un ${name} regular?`)
          : say(lang, `What is the size of each interior angle of a regular ${name}?`, `Düzgün bir ${name}in her iç açısı kaç derecedir?`, `¿Cuánto mide cada ángulo interior de un ${name} regular?`),
      format: 'numeric', correct_answer: form === 'sides' ? n : form === 'ext' ? ext : 180 - ext, operandKey: `g8:g:${form}:${n}`,
      hint_steps: [say(lang, 'The exterior angles of any polygon add up to 360°.', 'Her çokgenin dış açıları toplamı 360°.', 'Los ángulos exteriores de cualquier polígono suman 360°.'),
                   say(lang, 'At each corner, the interior and exterior angles make a straight line: 180°.', 'Her köşede iç ve dış açı bir doğru oluşturur: 180°.', 'En cada vértice, el ángulo interior y el exterior forman una recta: 180°.')],
    }
  }
  if (shape === 'garden') {
    for (;;) {
      const p = pick([1, 2]), n = randInt(1, 3), bw = randInt(2, 6), bh = randInt(2, 5)
      const Wd = n * bw + (n + 1) * p, Hd = bh + 2 * p
      const askPath = Math.random() < 0.5
      const beds = n * bw * bh
      return {
        topic: T, level,
        question_text: askPath
          ? say(lang, `The garden is ${Wd} m by ${Hd} m. All the paths are ${p} m wide and the flower beds are the same size. What is the area of the paths, in m²?`, `Bahçe ${Wd} m'ye ${Hd} m. Bütün yollar ${p} m genişliğinde, çiçek tarhları eş. Yolların alanı kaç m²?`, `El jardín mide ${Wd} m por ${Hd} m. Todos los caminos miden ${p} m de ancho y los parterres son iguales. ¿Cuál es el área de los caminos, en m²?`)
          : say(lang, `The garden is ${Wd} m by ${Hd} m. All the paths are ${p} m wide and the flower beds are the same size. What is the total area of the beds, in m²?`, `Bahçe ${Wd} m'ye ${Hd} m. Bütün yollar ${p} m genişliğinde, çiçek tarhları eş. Tarhların toplam alanı kaç m²?`, `El jardín mide ${Wd} m por ${Hd} m. Todos los caminos miden ${p} m de ancho y los parterres son iguales. ¿Cuál es el área total de los parterres, en m²?`),
        format: 'numeric', correct_answer: askPath ? Wd * Hd - beds : beds, operandKey: `g8:d:${Wd}:${Hd}:${p}:${n}:${askPath}`,
        hint_steps: [say(lang, `A bed is the garden's height minus two paths, and the width is what is left after ${n + 1} paths, shared by ${n}.`, `Bir tarhın yüksekliği, bahçeninkinden iki yol eksiktir; genişliği ${n + 1} yol çıkınca kalanın ${n}${trEk(n, 'loc')} biridir.`, `Un parterre mide de alto lo del jardín menos dos caminos, y de ancho lo que queda tras ${n + 1} caminos, repartido entre ${n}.`),
                     askPath ? say(lang, 'Paths = the whole garden minus the beds.', 'Yollar = bütün bahçe eksi tarhlar.', 'Caminos = el jardín entero menos los parterres.') : say(lang, 'Multiply out one bed, then count the beds.', 'Bir tarhın alanını bul, sonra tarh sayısıyla çarp.', 'Calcula un parterre y multiplícalo por el número de parterres.')],
        visual: { kind: 'garden', W: Wd, H: Hd, p, n },
      }
    }
  }
  // Enlargement from the origin: the corners, and where they go.
  let Tri, k
  do {
    k = pick([2, 3])
    const x = randInt(0, 3), y = randInt(0, 3)
    Tri = [[x, y], [x + randInt(1, 2), y], [x + randInt(0, 2), y + randInt(1, 2)]]
  } while (Tri.some(([a, b]) => a * k > 10 || b * k > 10) || Tri.every(([a]) => a === 0))
  const i = randInt(0, 2)
  const [x, y] = Tri[i]
  const right = opt(pairOf(x * k, y * k), ok8(lang))
  const wrongs = [[x + k, y + k, say(lang, 'An enlargement multiplies the coordinates; it does not add to them.', 'Büyütme koordinatları çarpar, onlara eklemez.', 'Una ampliación multiplica las coordenadas, no les suma.')],
    [x * k, y, say(lang, 'Both coordinates are multiplied by the scale factor.', 'İki koordinat da ölçek çarpanıyla çarpılır.', 'Las dos coordenadas se multiplican por el factor.')],
    [x, y * k, say(lang, 'Both coordinates are multiplied by the scale factor.', 'İki koordinat da ölçek çarpanıyla çarpılır.', 'Las dos coordenadas se multiplican por el factor.')],
    [y * k, x * k, say(lang, 'Across first, then up.', 'Önce yatay, sonra dikey.', 'Primero horizontal, luego vertical.')],
    [x * k + 1, y * k, say(lang, 'Multiply again, carefully.', 'Dikkatle yeniden çarp.', 'Vuelve a multiplicar con cuidado.')], [x * k, y * k + 1, say(lang, 'Multiply again, carefully.', 'Dikkatle yeniden çarp.', 'Vuelve a multiplicar con cuidado.')]]
    .filter(([a, b]) => a !== x * k || b !== y * k).map(([a, b, w]) => opt(pairOf(a, b), w))
  return {
    topic: T, level,
    question_text: say(lang, `The triangle is enlarged by a scale factor of ${k}, with the centre at (0, 0). Where does corner ${'ABC'[i]} go?`, `Üçgen, merkezi (0, 0) olan ${k} ölçek çarpanıyla büyütülüyor. ${'ABC'[i]} köşesi nereye gider?`, `El triángulo se amplía con factor ${k} y centro en (0, 0). ¿Adónde va el vértice ${'ABC'[i]}?`),
    format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `g8:e:${Tri.flat().join(',')}:${k}:${i}`,
    hint_steps: [say(lang, 'From (0, 0), every point moves out to k times as far.', '(0, 0)\'dan her nokta k kat uzağa gider.', 'Desde (0, 0), cada punto se aleja k veces más.'),
                 say(lang, 'So multiply both coordinates of the corner by the scale factor.', 'Yani köşenin iki koordinatını da ölçek çarpanıyla çarp.', 'Así que multiplica las dos coordenadas del vértice por el factor.')],
    visual: { kind: 'plane', min: 0, max: 10, points: Tri.map(([a, b], j) => ({ label: 'ABC'[j], x: a, y: b })), path: [...Tri, Tri[0]] },
  }
}

// ── 8. statistics and probability ──────────────────────────────────────────────────
const SCATTER = {
  pos: { en: ['the height and the shoe size of some children', 'hours of revision and test scores'], tr: ['bazı çocukların boyu ve ayakkabı numarası', 'çalışma saati ve sınav puanı'], es: ['la altura y la talla de pie de unos niños', 'las horas de estudio y la nota del examen'] },
  neg: { en: ['the age of a car and its value', 'the temperature outside and heating bills'], tr: ['bir arabanın yaşı ve değeri', 'dışarıdaki sıcaklık ve ısınma faturası'], es: ['la edad de un coche y su valor', 'la temperatura exterior y la factura de la calefacción'] },
  none: { en: ['shoe size and test scores', 'house numbers and the height of the people in them'], tr: ['ayakkabı numarası ve sınav puanı', 'ev numarası ve oturanların boyu'], es: ['la talla de pie y la nota del examen', 'el número de la casa y la altura de quien vive en ella'] },
}
function y8Statistics(level, lang) {
  const shape = pick(['summary', 'summary', 'freq', 'freq', 'combined', 'dice', 'cards', 'bag', 'grouped', 'scatter'])
  const T = 'stats-8'
  if (shape === 'summary') {
    const N = pick([5, 8, 10]), decs = N !== 8 && Math.random() < 0.4
    const vals = Array.from({ length: N }, () => (decs ? randInt(100, 190) / 10 : randInt(5, 20)))
    const ask = pick(['mean', 'mean', 'median', 'range'])
    const sorted = [...vals].sort((a, b) => a - b)
    let ans = ask === 'mean' ? vals.reduce((a, b) => a + b, 0) / N
      : ask === 'median' ? (N % 2 ? sorted[(N - 1) / 2] : (sorted[N / 2 - 1] + sorted[N / 2]) / 2) : sorted[N - 1] - sorted[0]
    ans = Math.round(ans * 1000) / 1000
    if (Math.round(ans * 100) !== ans * 100) return y8Statistics(level, lang)
    const list = vals.map(v => dnum(String(v), lang)).join(', ')
    const w = say(lang, { mean: 'mean', median: 'median', range: 'range' }[ask], { mean: 'aritmetik ortalaması', median: 'ortancası', range: 'açıklığı' }[ask], { mean: 'la media', median: 'la mediana', range: 'el rango' }[ask])
    return {
      topic: T, level,
      question_text: say(lang, `What is the ${w} of these numbers? ${list}`, `Bu sayıların ${w} kaçtır? ${list}`, `¿Cuál es ${w} de estos números? ${list}`),
      format: Number.isInteger(ans) ? 'numeric' : 'decimal', correct_answer: ans, operandKey: `s8:m:${ask}:${vals.join(',')}`,
      hint_steps: [ask === 'mean' ? say(lang, 'Add them all up.', 'Hepsini topla.', 'Súmalos todos.') : say(lang, 'Put them in order first.', 'Önce sıraya diz.', 'Primero ordénalos.'),
                   ask === 'mean' ? say(lang, `Then divide by how many numbers there are (${N}).`, `Sonra sayı adedine (${N}) böl.`, `Luego divide entre cuántos números hay (${N}).`)
                     : ask === 'median' ? say(lang, 'The median is in the middle; with two middle numbers, it is halfway between them.', 'Ortanca tam ortadaki; iki orta sayı varsa, tam ortalarıdır.', 'La mediana está en el centro; si hay dos en medio, es el punto medio entre ellos.')
                       : say(lang, 'Range = biggest − smallest.', 'Açıklık = en büyük − en küçük.', 'Rango = mayor − menor.')],
    }
  }
  if (shape === 'freq') {
    const start = pick([1, 11, 14, 0]), vals = [0, 1, 2, 3].map(i => start + i)
    const N = pick([10, 20, 25, 40])
    let f
    do { f = [0, 0, 0].map(() => randInt(1, Math.floor(N / 2))); f.push(N - f.reduce((a, b) => a + b, 0)) } while (f[3] < 1)
    const total = vals.reduce((s, v, i) => s + v * f[i], 0)
    const ans = total / N
    const what = start === 1 ? say(lang, 'the number of goals scored in each match', 'maçlarda atılan gol sayılarını', 'los goles marcados en cada partido') : start === 0 ? say(lang, 'the number of pets each family owns', 'ailelerin evcil hayvan sayılarını', 'las mascotas de cada familia') : say(lang, 'the ages of a group of children', 'bir grup çocuğun yaşlarını', 'las edades de un grupo de niños')
    return {
      topic: T, level,
      question_text: say(lang, `The table shows ${what}. What is the mean?`, `Tablo ${what} gösteriyor. Aritmetik ortalama kaçtır?`, `La tabla muestra ${what}. ¿Cuál es la media?`),
      format: Number.isInteger(ans) ? 'numeric' : 'decimal', correct_answer: ans, operandKey: `s8:f:${vals.join(',')}:${f.join(',')}`,
      hint_steps: [say(lang, 'Multiply each value by how often it happened, and add those up.', 'Her değeri kaç kez görüldüğüyle çarp ve bunları topla.', 'Multiplica cada valor por cuántas veces aparece y súmalo todo.'),
                   say(lang, 'Divide by the total of the frequencies — not by 4.', 'Sıklıkların toplamına böl — 4\'e değil.', 'Divide entre la suma de las frecuencias, no entre 4.')],
      visual: { kind: 'chart', shape: 'table', cols: vals.map(String), rows: [{ label: say(lang, 'Frequency', 'Sıklık', 'Frecuencia'), cells: f }] },
    }
  }
  if (shape === 'combined') {
    for (;;) {
      const n1 = randInt(2, 8), n2 = randInt(2, 8), m1 = randInt(120, 180), m2 = randInt(120, 180)
      const tot = n1 * m1 + n2 * m2
      if (tot % (n1 + n2) || m1 === m2) continue
      return {
        topic: T, level,
        question_text: say(lang, `${n1} girls have a mean height of ${m1} cm and ${n2} boys have a mean height of ${m2} cm. What is the mean height of all ${n1 + n2}?`, `${n1} kızın boy ortalaması ${m1} cm, ${n2} erkeğinki ${m2} cm. ${n1 + n2} kişinin boy ortalaması kaç cm?`, `${n1} chicas miden de media ${m1} cm y ${n2} chicos ${m2} cm. ¿Cuál es la altura media de los ${n1 + n2}?`),
        format: 'numeric', correct_answer: tot / (n1 + n2), operandKey: `s8:c:${n1}:${m1}:${n2}:${m2}`,
        hint_steps: [say(lang, 'The mean of two groups is NOT halfway between the two means — the bigger group counts more.', 'İki grubun ortalaması iki ortalamanın tam ortası DEĞİL — kalabalık grup daha çok sayılır.', 'La media de dos grupos NO es el punto medio de las dos medias: el grupo mayor cuenta más.'),
                     say(lang, 'Find each group\'s total height (number × mean), add, then divide by everyone.', 'Her grubun toplam boyunu bul (kişi × ortalama), topla, sonra herkese böl.', 'Halla la altura total de cada grupo (número × media), súmalas y divide entre todos.')],
      }
    }
  }
  if (shape === 'dice') {
    const T2 = randInt(2, 12), orLess = Math.random() < 0.3
    let count = 0
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (orLess ? a + b <= T2 : a + b === T2) count++
    if (orLess && count === 36) return y8Statistics(level, lang)
    const right = opt(fracS(count, 36), ok8(lang))
    const wrongs = [opt('1/11', say(lang, 'There are 11 totals, but they are not equally likely: count the 36 ways the dice can land.', '11 toplam var ama eşit olasılıklı değiller: zarların düşebileceği 36 yolu say.', 'Hay 11 totales, pero no son igual de probables: cuenta las 36 formas de caer.')),
      opt(fracS(count + 1, 36), say(lang, 'Count the ways again — (2, 5) and (5, 2) are different.', 'Yolları yeniden say — (2, 5) ile (5, 2) farklı.', 'Vuelve a contar: (2, 5) y (5, 2) son distintas.')),
      opt(fracS(Math.max(1, count - 1), 36), say(lang, 'Count the ways again — (2, 5) and (5, 2) are different.', 'Yolları yeniden say — (2, 5) ile (5, 2) farklı.', 'Vuelve a contar: (2, 5) y (5, 2) son distintas.')),
      opt(fracS(count, 12), say(lang, 'Two dice can land 6 × 6 = 36 ways, not 12.', 'İki zar 6 × 6 = 36 şekilde düşebilir, 12 değil.', 'Dos dados pueden caer de 6 × 6 = 36 formas, no 12.'))].filter(o => o.value !== right.value)
    return {
      topic: T, level,
      question_text: say(lang, `Two fair dice are rolled and the scores added. What is the probability of a total of ${T2}${orLess ? ' or less' : ''}?`, `Hilesiz iki zar atılıp sonuçlar toplanıyor. Toplamın ${T2}${orLess ? ' ya da daha az' : ''} olma olasılığı nedir?`, `Se lanzan dos dados y se suman. ¿Cuál es la probabilidad de un total de ${T2}${orLess ? ' o menos' : ''}?`),
      format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `s8:d:${T2}:${orLess}`,
      hint_steps: [say(lang, 'There are 6 × 6 = 36 equally likely ways for two dice to land.', 'İki zarın düşebileceği 6 × 6 = 36 eşit olasılıklı yol var.', 'Hay 6 × 6 = 36 formas igual de probables de caer.'),
                   say(lang, 'Count the pairs that give the total, then write it over 36 in lowest terms.', 'O toplamı veren çiftleri say, 36\'nın üstüne yaz ve sadeleştir.', 'Cuenta las parejas que dan ese total, ponlo sobre 36 y simplifica.')],
    }
  }
  if (shape === 'cards') {
    const events = [
      [26, say(lang, 'a red card', 'kırmızı bir kart', 'una carta roja')], [12, say(lang, 'a picture card (jack, queen or king)', 'resimli bir kart (vale, kız ya da papaz)', 'una figura (jota, reina o rey)')],
      [4, say(lang, 'an ace', 'bir as', 'un as')], [1, say(lang, 'the jack of spades', 'maça valesi', 'la jota de picas')], [13, say(lang, 'a heart', 'bir kupa', 'un corazón')], [2, say(lang, 'a red king', 'kırmızı bir papaz', 'un rey rojo')],
    ]
    const i = randInt(0, events.length - 1), [c, e] = events[i]
    const right = opt(fracS(c, 52), ok8(lang))
    const wrongs = events.filter((_, j) => j !== i).map(([c2, e2]) => opt(fracS(c2, 52), say(lang, `That is the chance of ${e2}.`, `Bu, ${e2} çekme olasılığı.`, `Esa es la probabilidad de ${e2}.`)))
    return {
      topic: T, level,
      question_text: say(lang, `A card is picked at random from a pack of 52. What is the probability that it is ${e}?`, `52'lik bir desteden rastgele bir kart çekiliyor. Bunun ${e} olma olasılığı nedir?`, `Se saca al azar una carta de una baraja de 52. ¿Cuál es la probabilidad de que sea ${e}?`),
      format: 'choice', options: choiceOf(right, shuffle(wrongs)), correct_answer: right.value, operandKey: `s8:k:${i}`,
      hint_steps: [say(lang, 'There are 4 suits of 13: hearts and diamonds are red, clubs and spades black.', '13\'er kartlık 4 renk var: kupa ve karo kırmızı, sinek ve maça siyah.', 'Hay 4 palos de 13: corazones y diamantes son rojos; tréboles y picas, negros.'),
                   say(lang, 'Count how many cards fit, put it over 52, and simplify.', 'Kaç kartın uyduğunu say, 52\'nin üstüne yaz ve sadeleştir.', 'Cuenta cuántas cartas cumplen, ponlo sobre 52 y simplifica.')],
    }
  }
  if (shape === 'bag') {
    const c = [randInt(4, 10), randInt(3, 8), randInt(3, 8)]
    let rm
    do { rm = c.map(x => randInt(0, Math.min(3, x - 1))) } while (rm.reduce((a, b) => a + b, 0) < 2)
    const left = c.map((x, i) => x - rm[i])
    const i = randInt(0, 2)
    const cols = say(lang, ['grey', 'white', 'black'], ['gri', 'beyaz', 'siyah'], ['grises', 'blancas', 'negras'])
    const col1 = say(lang, cols[i], cols[i], ['gris', 'blanca', 'negra'][i])
    const L = left.reduce((a, b) => a + b, 0), C = c.reduce((a, b) => a + b, 0)
    const right = opt(fracS(left[i], L), ok8(lang))
    const wrongs = [opt(fracS(c[i], C), say(lang, 'That was the chance BEFORE the balls were taken out.', 'Bu, toplar çıkarılmadan ÖNCEki olasılık.', 'Esa era la probabilidad ANTES de sacar las bolas.')),
      opt(fracS(left[i], C), say(lang, 'The total in the bag has gone down too.', 'Torbadaki toplam da azaldı.', 'El total de la bolsa también ha bajado.')),
      opt(fracS(c[i], L), say(lang, `Some ${cols[i]} balls were taken out too.`, `Bazı ${cols[i]} toplar da çıkarıldı.`, `También se sacaron bolas ${cols[i]}.`)),
      opt(fracS(left[i] + 1, L), say(lang, `Count the ${cols[i]} balls left again.`, `Kalan ${cols[i]} topları yeniden say.`, `Vuelve a contar las bolas ${cols[i]} que quedan.`)),
      opt(fracS(left[i], L - 1), say(lang, 'Count all the balls left again.', 'Kalan bütün topları yeniden say.', 'Vuelve a contar todas las bolas que quedan.'))].filter(o => o.value !== right.value)
    return {
      topic: T, level,
      question_text: say(lang, `A bag has ${c[0]} grey, ${c[1]} white and ${c[2]} black balls. ${rm[0]} grey, ${rm[1]} white and ${rm[2]} black are taken out. What is the probability now of picking a ${col1} ball?`,
        `Bir torbada ${c[0]} gri, ${c[1]} beyaz ve ${c[2]} siyah top var. ${rm[0]} gri, ${rm[1]} beyaz ve ${rm[2]} siyah çıkarılıyor. Şimdi ${col1} top çekme olasılığı nedir?`,
        `Una bolsa tiene ${c[0]} bolas grises, ${c[1]} blancas y ${c[2]} negras. Se sacan ${rm[0]} grises, ${rm[1]} blancas y ${rm[2]} negras. ¿Qué probabilidad hay ahora de sacar una ${col1}?`),
      format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `s8:b:${c.join(',')}:${rm.join(',')}:${i}`,
      hint_steps: [say(lang, 'Work out how many of each colour are left, and how many balls altogether.', 'Her renkten kaç top kaldığını ve toplam kaç top olduğunu bul.', 'Calcula cuántas quedan de cada color y cuántas en total.'),
                   say(lang, 'Probability = how many fit ÷ how many there are. Simplify.', 'Olasılık = uyanlar ÷ hepsi. Sadeleştir.', 'Probabilidad = las que cumplen ÷ el total. Simplifica.')],
    }
  }
  if (shape === 'grouped') {
    const vals = Array.from({ length: 18 }, () => randInt(1, 79))
    const g = randInt(0, 3), lo = g * 20, hi = lo + 19
    const ans = vals.filter(v => v >= lo && v <= hi).length
    if (!ans) return y8Statistics(level, lang)
    return {
      topic: T, level,
      question_text: say(lang, `Some students each thought of a number: ${vals.join(', ')}. How many go in the group ${lo}–${hi}?`, `Öğrenciler birer sayı tuttu: ${vals.join(', ')}. ${lo}–${hi} grubuna kaç sayı girer?`, `Unos alumnos pensaron un número cada uno: ${vals.join(', ')}. ¿Cuántos van en el grupo ${lo}–${hi}?`),
      format: 'numeric', correct_answer: ans, operandKey: `s8:g:${vals.join(',')}:${g}`,
      hint_steps: [say(lang, `Go along the list once and tick every number from ${lo} to ${hi}, both included.`, `Listede bir kez ilerle ve ${lo}${trEk(lo, 'abl')} ${hi}${trEk(hi, 'dat')} kadar (ikisi dahil) her sayıyı işaretle.`, `Recorre la lista una vez y marca cada número de ${lo} a ${hi}, ambos incluidos.`),
                   say(lang, 'Count the ticks.', 'İşaretleri say.', 'Cuenta las marcas.')],
    }
  }
  const type = pick(['pos', 'neg', 'none'])
  const pts = Array.from({ length: 14 }, () => {
    const x = Math.random()
    const y = type === 'pos' ? x * 0.8 + 0.1 + (Math.random() - 0.5) * 0.18 : type === 'neg' ? 0.9 - x * 0.8 + (Math.random() - 0.5) * 0.18 : Math.random() * 0.8 + 0.1
    return [Math.round(x * 100) / 100, Math.round(Math.min(0.98, Math.max(0.02, y)) * 100) / 100]
  })
  const bank = t => (SCATTER[t][lang] ?? SCATTER[t].en)
  const right = opt(pick(bank(type)), ok8(lang))
  const whyOf = t => t === 'pos' ? say(lang, 'That pair goes up together: the dots would climb from left to right.', 'Bu ikisi birlikte artar: noktalar soldan sağa tırmanırdı.', 'Esas dos cosas suben juntas: los puntos subirían de izquierda a derecha.')
    : t === 'neg' ? say(lang, 'As one goes up the other goes down: the dots would fall from left to right.', 'Biri artarken diğeri azalır: noktalar soldan sağa düşerdi.', 'Cuando una sube, la otra baja: los puntos bajarían de izquierda a derecha.')
      : say(lang, 'Those two have nothing to do with each other: the dots would be scattered all over.', 'Bu ikisinin birbiriyle ilgisi yok: noktalar her yere dağılırdı.', 'Esas dos cosas no tienen relación: los puntos estarían por todas partes.')
  const wrongs = ['pos', 'neg', 'none'].filter(t => t !== type).map(t => opt(pick(bank(t)), whyOf(t)))
  wrongs.push(opt(bank(type === 'pos' ? 'neg' : 'pos')[1], whyOf(type === 'pos' ? 'neg' : 'pos')))
  return {
    topic: T, level,
    question_text: say(lang, 'Which of these could this scatter graph show?', 'Bu serpilme grafiği hangisini gösteriyor olabilir?', '¿Qué podría mostrar este diagrama de dispersión?'),
    format: 'choice', options: choiceOf(right, wrongs), correct_answer: right.value, operandKey: `s8:x:${type}:${right.value}`,
    hint_steps: [say(lang, 'Do the dots go up from left to right, down, or neither?', 'Noktalar soldan sağa yukarı mı çıkıyor, aşağı mı iniyor, yoksa hiçbiri mi?', '¿Los puntos suben de izquierda a derecha, bajan, o ninguna de las dos?'),
                 say(lang, 'Pick the pair of things that behaves the same way.', 'Aynı şekilde davranan ikiliyi seç.', 'Elige la pareja de cosas que se comporta igual.')],
    visual: { kind: 'scatter', pts },
  }
}

const REGISTRY = {
  counting: countingTemplate,
  time: timeTemplate,
  addition: additionTemplate,
  'add-sub-word': addSubWordTemplate,
  subtraction: subtractionTemplate,
  'multiplication-word': multiplicationWordTemplate,
  'fraction-of-number': fractionOfNumberTemplate,
  'division-word': divisionWordTemplate,
  geometry: geometryTemplate,
  pictogram: pictogramTemplate,
  'place-value': placeValueTemplate,
  algebra: algebraTemplate,
  'long-mult-div': longMultDivTemplate,
  ratio: ratioTemplate,
  averages: averagesTemplate,
  'number-properties': numberPropertiesTemplate,
  sequence: sequenceTemplate,
  'decimals-percentages': decimalsPercentagesTemplate,
  money: moneyTemplate,
  measurement: measurementTemplate,
  'area-grid': areaGridTemplate,
  chart: chartTemplate,
  'powers-primes': y8Powers,
  'negatives-decimals': y8Negatives,
  fdp: y8Fractions,
  'algebra-8': y8Algebra,
  'sequences-graphs': y8Sequences,
  'ratio-8': y8Ratio,
  'geometry-8': y8Geometry,
  'stats-8': y8Statistics,
}

export { SHAPES }

// The visual kinds drawn by components/MathFigure. Kept here, beside the templates that emit
// them, so the screen can ask "is this a picture question?" without importing a component.
export const FIGURE_KINDS = new Set(['scale', 'fraction', 'coords', 'solid', 'tally', 'polygon', 'prices', 'digital', 'net', 'venn', 'carroll', 'route', 'spinner', 'mapscale', 'plane', 'angles', 'compound', 'machine', 'numcross', 'dots', 'algrects', 'gears', 'cuboid', 'circle', 'righttri', 'garden', 'scatter'])

export const TOPICS = Object.keys(REGISTRY)

// `avoid`: optional Set of operandKey strings already used in this batch — if the first
// roll collides, reroll (bounded) until a fresh number pair comes up. Callers building a
// multi-question batch should accumulate returned operandKeys into the same Set across
// calls; single one-off calls (e.g. MathLab) can just omit it.
// Both options belong to paper mode, which is why they arrive together:
// `numericOnly` rerolls past choice-format shapes — a question whose answer is picked from
//   options cannot be printed, so it has to come back as something typable.
// `columnar` lifts the mental-arithmetic constraint on addition and subtraction. Paper is the
//   one place a formal written method is possible, so it is the one place the curriculum's
//   "add numbers with more than 4 digits" is asked for literally.
// `maxChars` is the reading limit for the child's age. The model's questions were measured
//   against it from the start and these were not, on the assumption that a template's own
//   wording is short by construction — but a template's wording is fixed and its longest
//   substitutions are not: "Emir 15 çıkartma aldı ve 3 sınıf arkadaşı arasında eşit
//   paylaştırdı..." came to 95 characters against a seven-year-old's 90. Turkish runs longer
//   than the English it was written beside, so the limit belongs here too. A reroll usually
//   lands a shorter name and object; if thirty do not, the question still goes out, because a
//   question slightly over the limit beats a session one question shorter.
// `avoidText` is the same idea one level up: not the numbers, the WORDING. Operand keys alone
// let a session ask "Kaç tane görüyorsun?" twice over two different pictures, and a child does
// not experience that as two questions — the sentence they read is the one they had a moment
// ago. Rerolled, the template lands on another of its shapes ("what comes after 6?", a
// sequence) and the session reads as ten questions rather than eight and a stutter.
export function generateProblem(topic, level, avoid = null, lang = 'en', { numericOnly = false, columnar = false, maxChars = 0, avoidText = null } = {}) {
  const template = REGISTRY[topic]
  if (!template) throw new Error(`Unknown math template topic: ${topic}`)
  const reject = p => (avoid ? avoid.has(p.operandKey) : false)
    || (avoidText ? avoidText.has(String(p.question_text ?? '')) : false)
    || (numericOnly && p.format === 'choice')
    || (maxChars > 0 && String(p.question_text ?? '').length > maxChars)

  const MAX_ATTEMPTS = 30
  let problem = template(level, lang, columnar)
  for (let attempt = 1; attempt < MAX_ATTEMPTS && reject(problem); attempt++) {
    problem = template(level, lang, columnar)
  }
  return problem
}
