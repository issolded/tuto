// The pictorial half of the puzzle module: emoji, used as a curated drawn set.
//
// The geometric engine (puzzleFigures.js) cannot reach two of the four figure families the
// papers use — the pictorial ones (a candle, a jug, a teapot) and the semantic pairs (a bee is
// to honey as a hen is to an egg). Both need ARTWORK, and emoji are artwork that is already
// drawn, already licensed for this use, already reviewed, and already on every device. We do
// not draw them and we do not generate them: we choose from a fixed table, below.
//
// ── The one thing that makes this work, and without which it must not ship ────────────────
//
// System emoji fonts differ by device: 🐕 on iOS is not 🐕 on Android is not 🐕 on Windows.
// For most apps that is cosmetic. For THIS module it breaks the answer key. The whole
// contract of puzzleFigures is that geometryKey fingerprints the picture the renderer draws;
// with a glyph, all the code can see is a codepoint, and what the child sees is whatever
// their device decided to paint. "Which two are the same" and "which one is different" become
// questions about a drawing we never inspected — and two glyphs that read as clearly
// different on the machine we tested on can be near-identical on a phone.
//
// So the font is PINNED: the app loads Noto Color Emoji and renders every glyph in it. That
// restores a sound contract, though a different one, and the difference is worth stating
// plainly — the geometric key is COMPUTED from geometry we drew, while the glyph key is
// GUARANTEED BY A FONT WE SHIP. It holds exactly as long as the font is actually loaded.
//
// The cost is smaller than it looks. Google serves Noto Color Emoji split into ten
// unicode-range subsets of roughly 118KB each, so a browser downloads only the subsets our
// table's glyphs actually fall in, once, and caches them.
//
// ── Two content rules, deliberately narrow ───────────────────────────────────────────────
//
// No people, no faces, no body parts. Objects, animals, food, plants and weather only. Skin
// tone and gender modifiers turn a puzzle into a representation decision nobody asked this
// module to make, and leaving them out costs nothing — the papers' hand/glove and foot/sock
// pairs have weather-and-clothing equivalents that work as well.
//
// The tables are content, not code, and they are culture-bound. A relation that is obvious in
// English can be a shrug in Turkish, so every row carries its Turkish reading and is meant to
// be reviewed in both languages rather than trusted because it scans in one.

// Categories for "which is the odd one out" and "which one belongs". They must be mutually
// exclusive: a table where 🍎 is both a fruit and a food gives a child two defensible answers.
export const GLYPH_GROUPS = {
  fruit:   { tr: 'meyve',  en: 'fruit',   glyphs: ['🍎', '🍐', '🍓', '🍌', '🍇', '🍒'] },
  vehicle: { tr: 'taşıt',  en: 'vehicle', glyphs: ['🚗', '🚌', '🚲', '🚂', '✈️', '🚁'] },
  animal:  { tr: 'hayvan', en: 'animal',  glyphs: ['🐶', '🐱', '🐰', '🐻', '🐼', '🦊'] },
  bug:     { tr: 'böcek',  en: 'bug',     glyphs: ['🐝', '🐛', '🦋', '🐞', '🐜'] },
  weather: { tr: 'hava',   en: 'weather', glyphs: ['☀️', '🌧️', '❄️', '⛈️', '🌈'] },
  plant:   { tr: 'bitki',  en: 'plant',   glyphs: ['🌱', '🌳', '🌻', '🌵', '🍃'] },
  tool:    { tr: 'araç',   en: 'tool',    glyphs: ['✏️', '📏', '✂️', '📎', '🖍️'] },
  music:   { tr: 'müzik',  en: 'music',   glyphs: ['🎸', '🥁', '🎺', '🎹', '🎻'] },
}

export const GROUP_KEYS = Object.keys(GLYPH_GROUPS)

// Semantic pairs, grouped by the RELATION that connects them — which is the part that makes an
// analogy work. A:B :: C:? only has one answer if both pairs are joined by the same relation,
// so a question draws two pairs from one bucket and never mixes buckets.
//
// This is the family the geometric engine can never do: it is world knowledge, not pattern.
// Bond introduces it in paper 3, and it is worth tagging separately in the attempt log — "Ada
// is weak on rotation" and "Ada does not know that bees make honey" are different findings and
// a parent read that blends them is worse than either.
export const GLYPH_RELATIONS = {
  produces: {
    tr: 'üretir', en: 'produces',
    pairs: [['🐝', '🍯'], ['🐔', '🥚'], ['🐄', '🥛'], ['🐑', '🧶']],
  },
  becomes: {
    tr: 'dönüşür', en: 'becomes',
    pairs: [['🐛', '🦋'], ['🥚', '🐣'], ['🌱', '🌳'], ['🌾', '🍞']],
  },
  protects: {
    tr: 'korunma', en: 'protects from',
    pairs: [['🌧️', '☂️'], ['❄️', '🧣'], ['☀️', '🧢'], ['⛈️', '🏠']],
  },
  lives_in: {
    tr: 'yaşadığı yer', en: 'lives in',
    pairs: [['🐟', '🌊'], ['🐪', '🏜️'], ['🐄', '🌾'], ['🐦', '🌳']],
  },
}

export const RELATION_KEYS = Object.keys(GLYPH_RELATIONS)

// A pair may not appear under two relations: if 🐝→🍯 is both "produces" and "lives in", a
// question built on one relation is answerable by the other and has two defensible answers.
// Checked here rather than trusted, because the tables are meant to be edited by hand.
{
  const seen = new Map()
  for (const [key, rel] of Object.entries(GLYPH_RELATIONS)) {
    for (const [a, b] of rel.pairs) {
      const id = `${a}>${b}`
      if (seen.has(id)) {
        throw new Error(`puzzleGlyphs: pair ${id} appears in both ${seen.get(id)} and ${key}`)
      }
      seen.set(id, key)
    }
  }
}

// Which group a glyph belongs to, built once from the table above so the two can never
// disagree. A glyph in no group is not in the vocabulary.
const GROUP_OF = {}
for (const [key, g] of Object.entries(GLYPH_GROUPS)) {
  for (const ch of g.glyphs) GROUP_OF[ch] = key
}
export function groupOf(glyph) {
  return GROUP_OF[glyph] ?? null
}

// Every glyph the module can ever show, table plus relations. The vocabulary sheet prints this
// and the safety claim is the same as the geometric one: there is no code path to anything
// else, and here the set is not merely bounded but enumerable on one screen.
export const ALL_GLYPHS = [
  ...new Set([
    ...Object.values(GLYPH_GROUPS).flatMap(g => g.glyphs),
    ...Object.values(GLYPH_RELATIONS).flatMap(r => r.pairs.flat()),
  ]),
]

// The stack is what pins the font. 'Noto Color Emoji' must be loaded by the page — see the
// <link> in PuzzleLab — or the browser silently falls back to the system set and the guarantee
// above quietly stops holding.
export const EMOJI_FONT = "'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif"

// Whether the pinned font is actually loaded and usable RIGHT NOW.
//
// This is not a nicety. The failure mode was found by accident, in a browser that could not
// reach Google Fonts at all: a glyph whose font has not arrived does not render as a blank or
// a placeholder, it renders as fallback text — an English word sitting in the middle of a
// Turkish puzzle, or a device's own emoji, which is the platform variance this module pins the
// font to avoid. Both are worse than not asking the question.
//
// So it is a gate, not a hope: a session builder calls this and drops the pictorial types when
// it returns false, leaving a sheet of geometric questions, which need no font at all. The
// same reflex as the two gates on the Telegram side — the rule is enforced in code rather than
// left to whether the network behaved.
export function fontReady() {
  if (typeof document === 'undefined' || !document.fonts) return false
  try {
    // A size must be given or check() always answers false; the family is the one that matters.
    return document.fonts.check(`32px ${EMOJI_FONT.split(',')[0]}`)
  } catch {
    return false
  }
}

// A font is only fetched when something on the page actually USES it, which sets a deadlock
// against the gate above — and the preview page walked straight into it: no pictorial questions
// were offered because the font was not loaded, and the font was never loaded because nothing
// on the page used it. The gate answered false forever and the whole family silently vanished
// from every sheet, with no error anywhere.
//
// So the load is requested explicitly, once, before the gate is ever consulted. A screen that
// shows puzzles calls this on mount and re-reads the gate when the promise settles.
export function ensureEmojiFont() {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve(false)
  return document.fonts.load(`32px ${EMOJI_FONT.split(',')[0]}`)
    .then(() => fontReady())
    .catch(() => false)
}

export function makeGlyphSpec(over = {}) {
  return { kind: 'glyph', glyph: '🍎', count: 1, size: 1, rotation: 0, ...over }
}

export const GLYPH_ATTRIBUTES = ['glyph', 'group', 'count', 'size', 'rotation']

// Where copies sit when a figure carries more than one, in the same 100-unit box the geometric
// figures use so a glyph question lines up with a shape question on the same sheet.
const LAYOUT = {
  1: [[50, 50]],
  2: [[32, 50], [68, 50]],
  3: [[50, 30], [32, 66], [68, 66]],
  4: [[32, 32], [68, 32], [32, 68], [68, 68]],
}

const FONT_SIZE = { 1: 62, 2: 40, 3: 34, 4: 34 }

// The fingerprint. Unlike geometryKey this is not measured from anything drawn — it is the
// identity of the glyph plus the transforms we apply ourselves, and it is only as true as the
// pinned font. Named differently from geometryKey on purpose, so the weaker guarantee is
// visible at every call site.
export function glyphKey(spec) {
  return `g:${[...spec.glyph].map(c => c.codePointAt(0).toString(16)).join('-')}`
    + `|n${spec.count}|s${spec.size}|r${((spec.rotation % 360) + 360) % 360}`
}

export function renderGlyph(spec, opts = {}) {
  const px = opts.px || 84
  const size = (FONT_SIZE[spec.count] || 34) * spec.size
  const marks = (LAYOUT[spec.count] || LAYOUT[1])
    .map(([x, y]) =>
      `<text x="${x}" y="${y}" font-size="${size.toFixed(1)}" text-anchor="middle"`
      + ` dominant-baseline="central" font-family="${EMOJI_FONT.replace(/"/g, '&quot;')}">${spec.glyph}</text>`)
    .join('')
  return `<svg viewBox="0 0 100 100" width="${px}" height="${px}" aria-hidden="true" focusable="false">`
    + `<g transform="rotate(${spec.rotation} 50 50)">${marks}</g></svg>`
}
