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
// Turkish and Spanish. Below five digits nothing changes, so "45 candies" and "308 + 260" read
// as they did.
//
// A hundred-question audit asked for this — "6270000" is a wall of digits a child has to count
// through before the question can start. The screen reads numbers back out of the question
// text for its visual help, so it strips separators first; see `numbersIn` in MathScreen.
const SEPARATOR = { en: ',', tr: '.', es: '.' }

export function num(n, lang = 'en') {
  const v = Number(n)
  if (!Number.isFinite(v) || Math.abs(v) < 10000) return String(n)
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, SEPARATOR[lang] ?? ',')
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
const SHAREABLE_LIMIT = 48
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
// two ways on one screen. Below five digits `num` changes nothing, so every other age is
// untouched.
function partitionSteps(a, b, add, lang) {
  const parts = placeParts(b)
  const sign = add ? '+' : '-'

  // A single digit has no place value worth naming — "7 ones" is not an explanation. It is
  // also only reachable with a large `a`, since a small pair goes to the counting steps.
  if (b < 10) {
    return [
      say(lang, `Only the ones change here.`, `Burada sadece birler basamağı değişiyor.`,
                `Aquí solo cambian las unidades.`),
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
      say(lang, `So only that place value changes. ${add ? 'Add' : 'Take away'} ${word} ${add ? 'to' : 'from'} ${num(a, lang)}.`,
                `Yani sadece o basamak değişiyor. ${num(a, lang)} ${add ? 'sayısına' : 'sayısından'} ${word} ${add ? 'ekle' : 'çıkar'}.`,
                `Así que solo cambia esa cifra. ${add ? `Suma ${word} a ${num(a, lang)}` : `Resta ${word} de ${num(a, lang)}`}.`),
    ]
  }

  const first = parts[0]
  const rest = parts.slice(1).map(x => num(x, lang)).join(` ${sign} `)
  const afterFirst = add ? a + first : a - first
  return [
    say(lang, `You do not need to write this down. Break ${num(b, lang)} up: ${parts.map(x => num(x, lang)).join(' + ')}.`,
              `Bunu yazmana gerek yok. ${num(b, lang)} sayısını parçala: ${parts.map(x => num(x, lang)).join(' + ')}.`,
              `No hace falta que lo escribas. Separa ${num(b, lang)} así: ${parts.map(x => num(x, lang)).join(' + ')}.`),
    say(lang, `${num(a, lang)} ${sign} ${first} = ${afterFirst}. Now ${add ? 'add' : 'take away'} the ${rest}.`,
              `${num(a, lang)} ${sign} ${first} = ${afterFirst}. Şimdi ${rest} ${add ? 'ekle' : 'çıkar'}.`,
              `${num(a, lang)} ${sign} ${first} = ${afterFirst}. Ahora ${add ? 'suma' : 'resta'} ${rest}.`),
  ]
}

// ─── Addition ───────────────────────────────────────────────────────────────

// `columnar` is paper mode asking for the numbers back at full width. On screen the second
// operand is partitionable; on paper it is whatever the band allows, because a formal written
// method is exactly what the curriculum wants there and paper is what it needs.
function additionTemplate(level, lang, columnar = false) {
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

function subtractionTemplate(level, lang, columnar = false) {
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
  //   Year 5-6  past tables entirely — "multiply numbers up to 4 digits by a 1-digit or
  //             2-digit number", and then long multiplication. Four digits inside a word
  //             problem is unreadable ("Ada has 3,247 baskets"), so the band takes the
  //             readable end of it: two digits by one at Year 5, by two at Year 6. That is
  //             still eight times the old ceiling of 9 x 12.
  const band = bandForLevel(level)
  let a, b
  if (band >= 5) {
    const big = randInt(13, 99)
    const small = band >= 6 ? randInt(11, 25) : randInt(3, 9)
    ;[a, b] = Math.random() < 0.5 ? [big, small] : [small, big]
  } else {
    const tables = band >= 4 ? [6, 7, 8, 9, 11, 12] : band >= 3 ? [3, 4, 8] : [2, 5, 10]
    const table = pick(tables)
    // Tables are taught to twelve, and stopping the multiplier at ten left the "x2 x5 x10"
    // rung with only 24 distinct problems once operandKey folds a x b and b x a together —
    // a child doing five sessions had seen all of them.
    const other = randInt(2, 12)
    ;[a, b] = Math.random() < 0.5 ? [table, other] : [other, table]
  }
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
          `A coat costs ${base} dollars. In the sale it is ${pct}% off. What does it cost now?`,
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
  const shapes = band <= 2 ? ['ofNumber']
    : band <= 3 ? ['ofNumber', 'addSame', 'compare']
      : band <= 4 ? ['ofNumber', 'addSame', 'compare', 'decimal']
        : band <= 6 ? ['percentOf', 'percentOf', 'simplify', 'addDifferent', 'decimal', 'compare', 'ofNumber']
          : ['percentOf', 'percentChange', 'percentChange', 'simplify', 'addDifferent', 'decimal']
  const shape = pick(shapes)
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

  const options = shuffle([
    { value: e.dec, why: say(lang,
        `Right — ${n}/${d} of one whole is ${e.dec}.`,
        `Doğru — bir bütünün ${n}/${d} kadarı ${e.dec} eder.`,
        `Correcto: ${n}/${d} de una unidad es ${e.dec}.`) },
    { value: `0.${n}${d}`, why: say(lang,
        `That is the fraction read off digit by digit. ${n}/${d} is a division, not two digits after a point.`,
        `Bu, kesrin rakam rakam okunmuş hâli. ${n}/${d} bir bölme işlemidir, virgülden sonra iki rakam değil.`,
        `Eso es la fracción leída cifra a cifra. ${n}/${d} es una división, no dos cifras detrás del punto.`) },
    { value: `0.${d}`, why: say(lang,
        `That is the bottom number after the point. The bottom number says how many pieces the whole was cut into — it is not the answer itself.`,
        `Bu, alttaki sayının virgülden sonra yazılmışı. Alttaki sayı bütünün kaç parçaya bölündüğünü söyler — cevabın kendisi değildir.`,
        `Eso es el número de abajo puesto detrás del punto. El número de abajo dice en cuántos trozos se partió la unidad; no es la respuesta.`) },
    { value: e.near, why: e.nearAs === 'tenth'
        ? say(lang, `Ten times too small — ${e.near} is a tenth of ${e.dec}.`,
                    `On kat küçük — ${e.near}, ${e.dec} sayısının onda biri.`,
                    `Diez veces más pequeño: ${e.near} es la décima parte de ${e.dec}.`)
        : say(lang, `${e.near} is ${e.nearAs}, not ${n}/${d}.`,
                    `${e.near} sayısı ${e.nearAs} eder, ${n}/${d} değil.`,
                    `${e.near} es ${e.nearAs}, no ${n}/${d}.`) },
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
// b is the group count (2-5); a is always a multiple of b so the share is a whole
// number — no remainders to reason about at this level.

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
  // Year 6 and up divide by a TWO-DIGIT number — the curriculum line is "divide numbers up to
  // 4 digits by a 2-digit number using long division", and the band-5 range was still handing
  // a twelve-year-old "42 shared among 7". The divisors avoid 10 and 11, which are a
  // place-value trick and a pattern rather than a division.
  const b = band >= 6 ? pick([12, 13, 14, 15, 16, 18, 21, 24, 25])
    : band >= 5 ? pick([3, 4, 6, 7, 8, 9, 12])
      : band >= 3 ? pick([2, 3, 4, 5, 6, 8]) : pick([2, 3, 4, 5])
  const multiplier = band >= 6 ? randInt(12, 60)
    : randInt(band >= 5 ? 6 : band >= 3 ? 3 : 2, band >= 5 ? 25 : band >= 3 ? 12 : 9)
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
  const set = pick(PICTO_SETS)
  const words = set[lang] ?? set.en
  const { noun, verb } = words
  const many = words.many          // Spanish only: "Cuántas" or "Cuántos", agreed with the noun
  // Year 2 meets "simple pictograms" — one symbol, one thing. The scaled key is Year 3's,
  // and it is what makes the picture worth reading rather than just counting.
  const each = band <= 2 ? pick([1, 1, 2]) : pick([2, 5, 10])
  const names = shuffled(MULT_NAMES[lang] ?? MULT_NAMES.en).slice(0, 3)
  // Distinct counts, so "how many more" always has a positive answer and no two rows are
  // ambiguous to point at.
  const counts = shuffled([1, 2, 3, 4, 5]).slice(0, 3)
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
  const w = randInt(3, 18)
  const h = randInt(3, 18)

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
  if (band >= 5) return Math.random() < 0.55 ? geometryAngle(level, lang) : geometryArea(level, lang)
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
  if (bandForLevel(level) >= 2) return numberLineTemplate(level, lang)

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
      visual: { kind: 'clock', hour: 12, minute: 0, ask: 'span' },
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
  const digits = band >= 6 ? randInt(6, 7) : band >= 5 ? randInt(5, 6) : 4
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

function placeValueTemplate(level, lang) {
  const band = bandForLevel(level)
  const shapes = band >= 7
    ? ['round', 'digit', 'negative', 'roundDecimal', 'roundDecimal']
    : ['round', 'round', 'digit', 'negative']
  const shape = pick(shapes)
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

const AVG_SUBJECTS = {
  en: [['cups of coffee', 'day'], ['goals', 'match'], ['books read', 'week'], ['minutes late', 'day']],
  tr: [['fincan kahve', 'gün'], ['gol', 'maç'], ['okunan kitap', 'hafta'], ['dakika gecikme', 'gün']],
  es: [['tazas de café', 'día'], ['goles', 'partido'], ['libros leídos', 'semana'], ['minutos de retraso', 'día']],
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
  const xs = meanList(n, 2, 18)
  const total = xs.reduce((a, b) => a + b, 0)
  const [what, per] = pickL(AVG_SUBJECTS, lang)

  return {
    topic: 'averages', level,
    question_text: say(lang,
      `${what} over ${n} ${per}s: ${xs.join(', ')}. What is the mean?`,
      `${n} ${per} boyunca ${what}: ${xs.join(', ')}. Ortalama kaçtır?`,
      `${what} durante ${n} ${per}s: ${xs.join(', ')}. ¿Cuál es la media?`),
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
  const mean = randInt(4, 14)
  const total = mean * n
  // The known values are built so the missing one lands in a sensible range.
  let xs
  do {
    xs = Array.from({ length: n - 1 }, () => randInt(Math.max(1, mean - 5), mean + 5))
  } while (total - xs.reduce((a, b) => a + b, 0) < 1 || total - xs.reduce((a, b) => a + b, 0) > 25)
  const missing = total - xs.reduce((a, b) => a + b, 0)
  const [what, per] = pickL(AVG_SUBJECTS, lang)

  return {
    topic: 'averages', level,
    question_text: say(lang,
      `Over ${n} ${per}s the mean number of ${what} was ${mean}. ${n - 1} of them were ${xs.join(', ')}. What was the last one?`,
      `${n} ${per} boyunca ${what} ortalaması ${mean} idi. Bunların ${n - 1} tanesi ${xs.join(', ')}. Sonuncusu kaçtı?`,
      `Durante ${n} ${per}s la media de ${what} fue ${mean}. ${n - 1} de ellos fueron ${xs.join(', ')}. ¿Cuál fue el último?`),
    format: 'numeric',
    correct_answer: missing,
    operandKey: `avg:rev:${mean}:${xs.join('-')}`,
    hint_steps: [
      say(lang, `A mean of ${mean} over ${n} ${per}s means the total was shared into ${n} equal lots of ${mean}.`,
                `${n} ${per} için ortalama ${mean} demek, toplamın ${n} eşit ${mean}'e bölündüğü demek.`,
                `Una media de ${mean} en ${n} ${per}s significa que el total se repartió en ${n} partes iguales de ${mean}.`),
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
  const shapes = band >= 7
    ? ['mean', 'reverse', 'other', 'other', 'probability']
    : ['mean', 'mean', 'reverse', 'other']
  const shape = pick(shapes)
  if (shape === 'reverse') return avgReverseMean(level, lang)
  if (shape === 'other') return avgOther(level, lang)
  if (shape === 'probability') return avgProbability(level, lang)
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
  const shape = pick(['continue', 'continue', 'rule', 'machine', 'machine'])
  if (shape === 'rule') return seqRule(level, lang)
  if (shape === 'machine') return seqMachine(level, lang)
  return seqContinue(level, lang)
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

const REGISTRY = {
  counting: countingTemplate,
  time: timeTemplate,
  addition: additionTemplate,
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
}

export { SHAPES }

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
