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
// The cost is smaller than it looks, and the font is ours to serve: `npm run fonts` subsets
// Noto Color Emoji down to exactly the table below — 52KB — into public/fonts/, declared by
// src/styles/puzzleFonts.css. Self-hosted rather than fetched from fonts.googleapis.com
// because the gate further down WITHHOLDS these questions when the font has not arrived, so a
// slow or blocked third-party host does not degrade the look, it quietly removes a third of
// the question types.
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

// The .js extension is explicit here and in puzzleIcons so both files stay importable by plain
// node — scripts/fetch-puzzle-fonts.mjs reads their tables to subset the fonts, and Vite is
// happy either way.
import { fontLoaded, ensureFont } from './fontGate.js'

// Categories for "which is the odd one out" and "which one belongs". They must be mutually
// exclusive: a table where 🍎 is both a fruit and a food gives a child two defensible answers.
export const GLYPH_GROUPS = {
  fruit:   { tr: 'meyve',  en: 'fruit',   glyphs: ['🍎', '🍐', '🍓', '🍌', '🍇', '🍒'] },
  vehicle: { tr: 'taşıt',  en: 'vehicle', glyphs: ['🚗', '🚌', '🚲', '🚂', '✈️', '🚁', '🚚', '🛵', '⛵', '🚀'] },
  // Mammals, and the label says so in both languages rather than 'animal' — a bee is an animal
  // too, and this group sits next to `bug` in every odd-one-out the module can pose.
  animal:  { tr: 'memeli', en: 'mammal',  glyphs: ['🐶', '🐱', '🐰', '🐻', '🐼', '🦊', '🐴', '🐷', '🐹', '🐭', '🐄', '🐑'] },
  bug:     { tr: 'böcek',  en: 'bug',     glyphs: ['🐝', '🐛', '🦋', '🐞', '🐜', '🦟', '🪰'] },
  // ⛈️ was here and is not, because 🌧️ and ⛈️ are the same picture at puzzle size: rasterised
  // at 64px they differ in 16.7% of their ink, against 34% for the next closest pair in any
  // group and 45-55% typically. With four options they rarely met; with five they land together
  // often, and a child would have been asked to tell apart two clouds. It stays in the
  // `protects` relation, where it is only ever a prompt term and never an option.
  //
  // Measured the same way as the icon FILL axis — render each glyph, compare pixel by pixel,
  // with the font EMBEDDED in the SVG. Worth redoing whenever a group gains a member.
  weather: { tr: 'hava',   en: 'weather', glyphs: ['☀️', '🌧️', '❄️', '🌪️', '🌈'] },
  plant:   { tr: 'bitki',  en: 'plant',   glyphs: ['🌱', '🌳', '🌻', '🌵', '🍃'] },
  tool:    { tr: 'kırtasiye', en: 'desk thing', glyphs: ['✏️', '📏', '✂️', '📎', '🖍️', '🖊️', '🖌️', '📐'] },
  music:   { tr: 'müzik',  en: 'music',   glyphs: ['🎸', '🥁', '🎺', '🎹', '🎻', '🪕', '🎷', '🪈'] },
}

export const GROUP_KEYS = Object.keys(GLYPH_GROUPS)

// The second way a set of pictures can have an odd one out, and the one the 7-8 papers actually
// lean on. Their odd-one-out questions are rarely "four fruit and a bus": paper 2 opens with a
// rhino, a goat, a bear, a sheep and a deer (only the bear has no horns), then five load-carrying
// vehicles of which one is a ship, then four aeroplanes and a helicopter, then a stool, an
// armchair, a chair, a table and a director's chair. Every option is the same KIND of thing, and
// what separates one of them is a PROPERTY — what it does, where it goes, what it is for.
//
// So a trait is a property, written as the partition it induces on one group. Two constraints
// make a question built on one sound, and both are checked below rather than trusted:
//
//   A trait belongs to exactly ONE group, and every option comes from that group. If the options
//   were not all the same kind, the category reading would answer the question and the property
//   would never be looked at — which is the easier question this one exists not to be.
//
//   A trait is TOTAL over its group: every glyph in the group is on one side or the other. A
//   partial list looks harmless and is not. With `on_water` listing only ⛵ against the road
//   vehicles, a question about flying could deal ⛵ into the four non-fliers, and a child could
//   answer "the boat, it is the only one on water" — perfectly defensible, and marked wrong.
//   Totality is what lets a generator see that collision coming; see traitConflict().
export const GLYPH_TRAITS = {
  flies:    { group: 'vehicle', tr: 'uçar', en: 'flies',
    yes: ['✈️', '🚁', '🚀'], no: ['🚗', '🚌', '🚲', '🚂', '🚚', '🛵', '⛵'] },
  on_water: { group: 'vehicle', tr: 'suda gider', en: 'goes on water',
    yes: ['⛵'], no: ['🚗', '🚌', '🚲', '🚂', '✈️', '🚁', '🚚', '🛵', '🚀'] },
  engine:   { group: 'vehicle', tr: 'motoru var', en: 'has an engine',
    yes: ['🚗', '🚌', '🚂', '✈️', '🚁', '🚚', '🛵', '🚀'], no: ['🚲', '⛵'] },
  // One trait for the mammals, deliberately. `pet` was the obvious second one and it does not
  // survive translation: Turkish `evcil hayvan` covers the cow and the sheep as readily as the
  // cat, so a set built on the English sense would have two defensible answers for a child
  // reading it in Turkish and one in English. Exactly the failure the note at the top of this
  // file warns about, found by writing the row out in both languages.
  farm:     { group: 'animal', tr: 'çiftlik hayvanı', en: 'farm animal',
    yes: ['🐴', '🐷', '🐄', '🐑'], no: ['🐶', '🐱', '🐰', '🐻', '🐼', '🦊', '🐹', '🐭'] },
  wings:    { group: 'bug', tr: 'kanatlı', en: 'has wings',
    yes: ['🐝', '🦋', '🐞', '🦟', '🪰'], no: ['🐛', '🐜'] },
  marks:    { group: 'tool', tr: 'iz bırakır', en: 'leaves a mark',
    yes: ['✏️', '🖍️', '🖊️', '🖌️'], no: ['📏', '✂️', '📎', '📐'] },
  strings:  { group: 'music', tr: 'telli', en: 'has strings',
    yes: ['🎸', '🎻', '🪕'], no: ['🥁', '🎺', '🎹', '🎷', '🪈'] },
  blow:     { group: 'music', tr: 'üflenir', en: 'you blow it',
    yes: ['🎺', '🎷', '🪈'], no: ['🎸', '🥁', '🎹', '🎻', '🪕'] },
}

export const TRAIT_KEYS = Object.keys(GLYPH_TRAITS)

// Both constraints above, enforced at import. The tables are meant to be edited by hand, and a
// trait that has quietly stopped covering its group is not visible by reading it.
{
  for (const [key, t] of Object.entries(GLYPH_TRAITS)) {
    const group = GLYPH_GROUPS[t.group]
    if (!group) throw new Error(`puzzleGlyphs: trait ${key} names no group ${t.group}`)
    const both = t.yes.filter(g => t.no.includes(g))
    if (both.length) throw new Error(`puzzleGlyphs: trait ${key} has ${both.join('')} on both sides`)
    const covered = new Set([...t.yes, ...t.no])
    const missing = group.glyphs.filter(g => !covered.has(g))
    const extra = [...covered].filter(g => !group.glyphs.includes(g))
    if (missing.length) throw new Error(`puzzleGlyphs: trait ${key} does not say ${missing.join('')}`)
    if (extra.length) throw new Error(`puzzleGlyphs: trait ${key} lists ${extra.join('')}, not in ${t.group}`)
  }
}

// true, false, or null when the glyph is outside the trait's group. Totality means null and
// "outside the group" are the same thing.
export function traitValue(key, glyph) {
  const t = GLYPH_TRAITS[key]
  if (!t) return null
  return t.yes.includes(glyph) ? true : t.no.includes(glyph) ? false : null
}

export const traitsOfGroup = (group) => TRAIT_KEYS.filter(k => GLYPH_TRAITS[k].group === group)

// Whether any trait OTHER than the one the question is built on also singles out an option — and
// if so, which glyph, because a second trait pointing at the SAME picture is two reasons for one
// answer and perfectly sound. It is only a conflict when it points somewhere else.
//
// The case this catches: four vehicles that do not fly plus an aeroplane is a question about
// flying, unless ⛵ is one of the four, in which case "the only one on water" is just as good an
// answer and the child who gives it is marked wrong. Returns the offending trait key or null.
export function traitConflict(glyphs, ruleKey, answer) {
  const group = groupOf(glyphs[0])
  for (const key of traitsOfGroup(group)) {
    if (key === ruleKey) continue
    const yes = glyphs.filter(g => traitValue(key, g) === true)
    const no = glyphs.filter(g => traitValue(key, g) === false)
    const lone = yes.length === 1 ? yes[0] : no.length === 1 ? no[0] : null
    if (lone && lone !== answer) return key
  }
  return null
}

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

// The stack a figure is drawn in. The first family is the pinned one; the rest exist only so
// that a glyph still shows SOMETHING if it is reached before the gate below has been consulted
// — which should never happen, and is why the gate is the real answer rather than this list.
export const EMOJI_FONT = "'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif"

// Whether the pinned font is actually loaded and usable RIGHT NOW.
//
// This is not a nicety. The failure mode was found by accident, in a browser that could not
// reach Google Fonts at all: a glyph whose font has not arrived does not render as a blank or
// a placeholder, it renders as fallback — a device's own emoji, which is the platform variance
// this module pins the font to avoid. That is worse than not asking the question.
//
// So it is a gate, not a hope: a session builder calls this and drops the pictorial types when
// it returns false, leaving a sheet of geometric questions, which need no font at all. The
// same reflex as the two gates on the Telegram side — the rule is enforced in code rather than
// left to whether the network behaved. See fontGate.js for why document.fonts.check alone is
// not enough to answer it.
export const EMOJI_FAMILY = 'Noto Color Emoji'
export const fontReady = () => fontLoaded(EMOJI_FAMILY)
export const ensureEmojiFont = () => ensureFont(EMOJI_FAMILY)

export function makeGlyphSpec(over = {}) {
  return { kind: 'glyph', glyph: '🍎', count: 1, size: 1, rotation: 0, ...over }
}

// `trait` is the boolean side a glyph falls on for whichever trait the question is built on —
// undefined on every question that is not. It earns its place in this list because the validator
// counts how many attributes split (n-1)-to-1, and a trait question is one where `group` is
// constant across all the options and the only thing that splits is the property.
export const GLYPH_ATTRIBUTES = ['glyph', 'group', 'trait', 'count', 'size', 'rotation']

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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${px}" height="${px}"`
    + ' aria-hidden="true" focusable="false">'
    + `<g transform="rotate(${spec.rotation} 50 50)">${marks}</g></svg>`
}
