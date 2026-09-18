// The line-drawn half of the pictorial vocabulary: Material Symbols, used as a curated set.
//
// Emoji (puzzleGlyphs.js) got the pictorial family working, but they are the wrong material
// for most of it. They are coloured stickers next to black line polygons — two visual systems
// on one sheet — and, more importantly, nothing about an emoji can be VARIED. The whole engine
// is built on "the same figure with one attribute changed", and for a glyph the only movable
// things were which one, how many, how big, which way up.
//
// Material Symbols is a variable font, and its FILL axis is exactly the attribute the papers
// use most: the same icon, outline or solid. That one axis roughly doubles what the pictorial
// family can pose — odd-one-out on fill, a sequence that alternates fill, a grid of icon ×
// fill — and it speaks the same language as the geometric engine's own `fill`.
//
// Measured rather than assumed: Google serves this font subset by icon name, and eight icons
// came to 3.4 KB against 459 KB for the whole set and ~118 KB for one emoji subset. A table of
// forty is still small enough not to think about.
//
// ── The failure mode, and why iconFontReady() exists ─────────────────────────────────────────
//
// Icons are addressed by CODEPOINT (ICON_CODEPOINTS, written by `npm run fonts`). They were
// addressed by LIGATURE — the text "umbrella" becoming the umbrella glyph — and an earlier note
// here said codepoints rendered as nothing in the subset. On 2026-09-16 the opposite was
// measured: WebKit does not apply ligatures inside SVG <text>, and in this font the letters
// themselves are blank, so every icon on an iPhone or iPad was an empty box, while codepoints
// draw in WebKit and Chromium alike, FILL axis included. The gate is still needed: without the
// font a private-use codepoint draws as a box or nothing. See iconFontReady below.
//
// Self-hosting is the other half of that answer, and is now done: the font is Apache 2.0 and
// ships in public/fonts/ with its licence, because depending on fonts.googleapis.com means
// the gate closes whenever that host is slow or blocked — silently, since a withheld question
// looks exactly like a session that happened to have none.

import { fontLoaded, ensureFont } from './fontGate.js'
import { ICON_CODEPOINTS } from './puzzleArt.generated.js'

export const ICON_FAMILY = 'Material Symbols Outlined'
// Served by us (public/fonts), subset to this table by `npm run fonts`. Declared from code by
// ensureIconFont, not by a stylesheet — see note 4 in fontGate.js.
export const ICON_FONT_URL = '/fonts/puzzle-icons.woff2'
export const ICON_FONT = "'Material Symbols Outlined'"

// Mutually exclusive categories, same rule as the emoji table: a table where one icon belongs
// to two groups gives a child two defensible answers to an odd-one-out.
//
// Every name here was checked against the font's own codepoint list rather than recalled —
// a name that does not exist renders as its own text, which is the failure above.
export const ICON_GROUPS = {
  vehicle: {
    tr: 'taşıt', en: 'vehicle',
    icons: ['directions_car', 'flight', 'directions_bike', 'train', 'directions_boat', 'local_shipping'],
  },
  weather: {
    tr: 'hava', en: 'weather',
    icons: ['wb_sunny', 'ac_unit', 'umbrella', 'thunderstorm', 'water_drop', 'cloud'],
  },
  plant: {
    tr: 'bitki', en: 'plant',
    icons: ['local_florist', 'forest', 'potted_plant', 'grass', 'park'],
  },
  // `egg`, `bakery_dining` and (in music) `album` were here and are not. Solved blind at the size
  // a child sees them, the egg read as a water drop — and water_drop is in `weather`, so an
  // odd-one-out could put the two side by side as "different"; the croissant read as a hand or a
  // fan; and the solid record read as a doughnut, a food, in a question about what is NOT food.
  food: {
    tr: 'yiyecek', en: 'food',
    icons: ['lunch_dining', 'cake', 'local_pizza', 'icecream', 'nutrition', 'coffee'],
  },
  home: {
    tr: 'ev', en: 'home',
    icons: ['home', 'chair', 'bed', 'key', 'door_front', 'lightbulb'],
  },
  // Six each, and the two that used to have three were not merely thin — they were unreachable.
  // A category question needs `options` members inside the group and one fewer outside it, so at
  // five options a group of three can be neither the set nor the foil, and music and sport sat
  // out every band above 5-6 entirely. Nothing reported it: the audit asked whether each TYPE
  // could be built, and it could, out of the other five groups.
  music: {
    tr: 'müzik', en: 'music',
    icons: ['music_note', 'piano', 'headphones', 'radio', 'mic', 'speaker'],
  },
  sport: {
    tr: 'spor', en: 'sport',
    icons: ['sports_soccer', 'sports_basketball', 'sports_tennis',
      'sports_football', 'sports_volleyball', 'sports_baseball'],
  },
  // Bond 8-9 paper 1 question 20 cycles ×, ✓, £ and = — a run of bare symbols with no picture in
  // it at all, which is a different thing to read from a run of drawings and the papers use it
  // from that age up. `currency_pound` is literally the book's third term.
  symbol: {
    tr: 'işaret', en: 'symbol',
    icons: ['close', 'check', 'add', 'remove', 'percent', 'currency_pound'],
  },
}

export const ICON_GROUP_KEYS = Object.keys(ICON_GROUPS)

const ICON_GROUP_OF = {}
for (const [key, g] of Object.entries(ICON_GROUPS)) {
  for (const name of g.icons) ICON_GROUP_OF[name] = key
}
export function iconGroupOf(name) {
  return ICON_GROUP_OF[name] ?? null
}

export const ALL_ICONS = Object.values(ICON_GROUPS).flatMap(g => g.icons)

// The font itself is served by the app, not by fonts.googleapis.com: it is subset to exactly
// this table by `npm run fonts` and declared by ensureIconFont (ICON_FONT_URL). `npm run
// fonts:check` fails if this table is edited without re-fetching, because a name missing from
// the subset has no glyph to draw — see the failure note above.

export const ICON_ATTRIBUTES = ['icon', 'group', 'fill', 'count', 'size', 'rotation']

// FILL is the axis worth having. `wght` is in the font too and was tried: at 200 against 700
// the difference is invisible at puzzle size, so it is deliberately not an attribute — a rule
// a child cannot see is the failure this engine spends most of its effort avoiding.
export const ICON_FILLS = [0, 1]

// …and for fourteen of these icons the FILL axis does nothing at all: the font has no solid form
// for them, so FILL 0 and FILL 1 draw the identical glyph. Sequences were being built as
// outline → solid → outline → solid in which every single figure looked the same, and the key
// waved them through because the SPECS differed.
//
// THIS LIST GOES STALE THE MOMENT THE TABLE ABOVE GAINS AN ICON, and a stale entry is invisible
// — the question is well formed, the key says five different pictures, and two of them are the
// same drawing. It was eight icons, measured when the table had 35. Adding twelve brought six
// more dead ones with it, every one of the new `symbol` group: ×, ✓, +, −, %, £ are strokes and
// a stroke has no inside to fill. A sweep of rendered questions turned up options differing in
// 0% of their ink in every band, which is what that looks like from the outside.
//
// So it is measured, not guessed, by `npm run puzzle:pixels` — which exists because this needs a
// browser and cannot live in puzzle:check. RUN IT AFTER EDITING THE TABLE. The fourteen below
// come back at 0%; the rest range from 20% to 81%.
const FILL_DOES_NOTHING = new Set([
  'flight', 'directions_bike', 'ac_unit', 'umbrella',
  'grass', 'music_note', 'piano', 'sports_soccer',
  'add', 'check', 'close', 'currency_pound', 'percent', 'remove',
  // Not at 0% like the rest — 16% of its ink moves — but below every icon this list calls live
  // (the lowest is 20%), and by eye the solid burger is the outline burger with a darker bun.
  'lunch_dining',
])

// Whether asking for a solid version of this icon will draw anything different. A generator that
// builds a run on the FILL axis needs to know before it starts, rather than discovering it when
// validateQuestion rejects the finished question.
export const fillIsLive = (icon) => !FILL_DOES_NOTHING.has(icon)

// Making it a fact about the PICTURE rather than a rule for generators to remember is what
// makes it safe: with fill pinned, two options that differed only in fill now produce the same
// key, validateQuestion rejects the question as "two options draw the same picture", and the
// draw is retried. Nothing else had to change.
export function normalizeIconSpec(spec) {
  return FILL_DOES_NOTHING.has(spec.icon) && spec.fill !== 0 ? { ...spec, fill: 0 } : spec
}

const ICON_LAYOUT = {
  1: [[50, 50]],
  2: [[32, 50], [68, 50]],
  3: [[50, 30], [32, 66], [68, 66]],
  4: [[32, 32], [68, 32], [32, 68], [68, 68]],
}
const ICON_FONT_SIZE = { 1: 62, 2: 42, 3: 34, 4: 34 }

export function makeIconSpec(over = {}) {
  return { kind: 'icon', icon: 'home', fill: 0, count: 1, size: 1, rotation: 0, ...over }
}

// Like glyphKey, this is a contract with a pinned font rather than a measurement of drawn
// geometry — the identity of the icon plus the transforms we apply ourselves.
export function iconKey(rawSpec) {
  const spec = normalizeIconSpec(rawSpec)
  return `i:${spec.icon}|f${spec.fill}|n${spec.count}|s${spec.size}`
    + `|r${((spec.rotation % 360) + 360) % 360}`
}

// See fontGate.js: document.fonts.check passes an undeclared family, so a missing stylesheet
// would wave these questions through drawn in the device's fallback — the exact failure the
// pinning exists to prevent.
export const iconFontReady = () => fontLoaded(ICON_FAMILY)
export const ensureIconFont = () => ensureFont(ICON_FAMILY, ICON_FONT_URL)

export function renderIcon(rawSpec, opts = {}) {
  const spec = normalizeIconSpec(rawSpec)
  const px = opts.px || 84
  const size = (ICON_FONT_SIZE[spec.count] || 34) * spec.size
  const style = `font-family:${ICON_FONT};font-variation-settings:'FILL' ${spec.fill},'wght' 400,'GRAD' 0,'opsz' 24;`
  const marks = (ICON_LAYOUT[spec.count] || ICON_LAYOUT[1])
    .map(([x, y]) =>
      `<text x="${x}" y="${y}" font-size="${size.toFixed(1)}" text-anchor="middle"`
      + ` dominant-baseline="central" fill="currentColor" style="${style}">&#x${ICON_CODEPOINTS[spec.icon]};</text>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${px}" height="${px}"`
    + ' aria-hidden="true" focusable="false">'
    + `<g transform="rotate(${spec.rotation} 50 50)">${marks}</g></svg>`
}
