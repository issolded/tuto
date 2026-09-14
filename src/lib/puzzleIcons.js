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
// ── The failure mode, and why fontReady() exists ─────────────────────────────────────────
//
// Icons are addressed by LIGATURE — the text "umbrella" becomes the umbrella glyph — because
// the by-name subset drops the private-use codepoints that would otherwise address them
// directly (tried; they render as nothing). The consequence is the sharp edge: if the font has
// not loaded, the child does not see a blank, they see the English word "umbrella" sitting in
// the middle of a Turkish puzzle. puzzleGlyphs.fontReady() is the gate that keeps that off the
// screen, and it covers this font too — see iconFontReady below.
//
// Self-hosting is the other half of that answer and is a deployment decision, not a code one:
// the font is Apache 2.0, and depending on fonts.googleapis.com means the gate closes whenever
// that host is slow or blocked.

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
  food: {
    tr: 'yiyecek', en: 'food',
    icons: ['egg', 'cake', 'local_pizza', 'icecream', 'bakery_dining', 'coffee'],
  },
  home: {
    tr: 'ev', en: 'home',
    icons: ['home', 'chair', 'bed', 'key', 'door_front', 'lightbulb'],
  },
  music: {
    tr: 'müzik', en: 'music',
    icons: ['music_note', 'piano', 'headphones'],
  },
  sport: {
    tr: 'spor', en: 'sport',
    icons: ['sports_soccer', 'sports_basketball', 'sports_tennis'],
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

// The font request the page must make. Exported so the lab, the child screen and the preview
// all ask for exactly the icons the table holds and nothing else — the subset is the reason
// this costs kilobytes instead of half a megabyte.
export const ICON_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined'
  + ':opsz,wght,FILL,GRAD@24,400,0..1,0'
  + `&icon_names=${[...new Set(ALL_ICONS)].sort().join(',')}`
  + '&display=block'

// `display=block` rather than `swap` on purpose: swap paints the fallback first, and here the
// fallback is the icon's own name in English. Block shows nothing until the font arrives,
// which is the lesser of the two, and fontReady() is what actually decides whether the
// question is asked at all.

export const ICON_ATTRIBUTES = ['icon', 'group', 'fill', 'count', 'size', 'rotation']

// FILL is the axis worth having. `wght` is in the font too and was tried: at 200 against 700
// the difference is invisible at puzzle size, so it is deliberately not an attribute — a rule
// a child cannot see is the failure this engine spends most of its effort avoiding.
export const ICON_FILLS = [0, 1]

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
export function iconKey(spec) {
  return `i:${spec.icon}|f${spec.fill}|n${spec.count}|s${spec.size}`
    + `|r${((spec.rotation % 360) + 360) % 360}`
}

// See ensureEmojiFont: the gate cannot be consulted until something has asked for the font,
// and nothing asks for it until the gate opens. The request has to be made explicitly.
export function ensureIconFont() {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve(false)
  return document.fonts.load(`32px ${ICON_FONT}`)
    .then(() => iconFontReady())
    .catch(() => false)
}

export function iconFontReady() {
  if (typeof document === 'undefined' || !document.fonts) return false
  try {
    return document.fonts.check(`32px ${ICON_FONT}`)
  } catch {
    return false
  }
}

export function renderIcon(spec, opts = {}) {
  const px = opts.px || 84
  const size = (ICON_FONT_SIZE[spec.count] || 34) * spec.size
  const style = `font-family:${ICON_FONT};font-variation-settings:'FILL' ${spec.fill},'wght' 400,'GRAD' 0,'opsz' 24;font-feature-settings:'liga';`
  const marks = (ICON_LAYOUT[spec.count] || ICON_LAYOUT[1])
    .map(([x, y]) =>
      `<text x="${x}" y="${y}" font-size="${size.toFixed(1)}" text-anchor="middle"`
      + ` dominant-baseline="central" fill="currentColor" style="${style}">${spec.icon}</text>`)
    .join('')
  return `<svg viewBox="0 0 100 100" width="${px}" height="${px}" aria-hidden="true" focusable="false">`
    + `<g transform="rotate(${spec.rotation} 50 50)">${marks}</g></svg>`
}
