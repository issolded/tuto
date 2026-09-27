// Fetches the pictorial art the puzzle module draws with, pinned and served by us.
//
//   npm run fonts          — fetch and write
//   npm run fonts:check    — verify what is shipped matches the tables
//
// Two materials, handled differently since 2026-09-16, when both turned out blank on iOS:
//
//   · EMOJI are Noto's own SVG drawings, fetched at a pinned release of googlefonts/noto-emoji and
//     written into src/lib/puzzleArt.generated.js as data URIs. They used to be the Noto Color
//     Emoji FONT, subset by Google — but Google serves that font by user agent, and what it hands
//     Chrome is COLRv1, which WebKit does not draw. Every browser on iOS is WebKit, so on an
//     iPhone or iPad most emoji rendered as nothing and a few as the device's own emoji: exactly
//     the variance pinning exists to remove. What Google serves Safari instead is the full font
//     in ~1 MB chunks. A drawing is the same picture in every engine, needs no font to load, and
//     so needs no gate.
//
//   · ICONS stay a font (Material Symbols — its FILL axis is the attribute the questions use), but
//     are now addressed by CODEPOINT, written into the same generated module. They were addressed
//     by ligature, and WebKit does not apply ligatures inside SVG <text>: the letters of
//     "umbrella" are blank glyphs in this font, so the child saw an empty box.
//
// Both were found by rendering in WebKit, which no check here had ever done. scripts/puzzle-webkit.mjs
// now does, and it is the check to run after this one.
//
// ── The trap this script exists to close ─────────────────────────────────────────────────
//
// The shipped art contains exactly what the tables held ON THE DAY IT WAS FETCHED. Add 🐙 to
// GLYPH_GROUPS and forget to re-run this, and that glyph has no drawing. So --check compares the
// generated module and the manifest against the tables as they are now, and fails on a difference.

import { writeFileSync, readFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { ALL_GLYPHS } from '../src/lib/puzzleGlyphs.js'
import { ALL_ICONS } from '../src/lib/puzzleIcons.js'

const OUT = 'public/fonts'
const MANIFEST = join(OUT, 'puzzle-fonts.json')
const GENERATED = 'src/lib/puzzleArt.generated.js'

// A release tag, not `main`: the drawings are part of the answer key, and a redraw upstream
// should arrive when this line is edited, not whenever someone happens to re-fetch.
const NOTO_EMOJI_REF = 'v2.051'
const NOTO_RAW = `https://raw.githubusercontent.com/googlefonts/noto-emoji/${NOTO_EMOJI_REF}`
const ICON_CODEPOINTS_URL = 'https://raw.githubusercontent.com/google/material-design-icons/master/'
  + 'variablefont/MaterialSymbolsOutlined%5BFILL,GRAD,opsz,wght%5D.codepoints'

// Google serves woff2 only to browsers that advertise support; with node's default agent it
// hands back a TrueType URL four times the size. The icon font is a plain outline font, so the
// format it serves does not vary by engine the way the emoji font did.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const glyphs = [...new Set(ALL_GLYPHS)]
const icons = [...new Set(ALL_ICONS)].sort()

const ICON_FONT = {
  file: 'puzzle-icons.woff2',
  family: 'Material Symbols Outlined',
  license: 'Apache License 2.0',
  // The FILL axis is the whole reason this font is here — 0..1 keeps it variable rather than
  // baking one end of it.
  css: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined'
    + ':opsz,wght,FILL,GRAD@24,400,0..1,0'
    + `&icon_names=${icons.join(',')}`,
}

// Noto names its files by codepoint, without the emoji presentation selector.
const notoName = (g) => 'emoji_u' + [...g].map(c => c.codePointAt(0)).filter(c => c !== 0xfe0f)
  .map(c => c.toString(16)).join('_')

// Enough escaping for a data URI in an href attribute, and no more: percent-encoding the whole
// file would roughly double it.
const svgDataUri = (svg) => 'data:image/svg+xml,' + svg
  .replace(/<\?xml[^>]*\?>/g, '').replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\s+/g, ' ').trim()
  .replace(/"/g, "'").replace(/%/g, '%25').replace(/#/g, '%23')
  .replace(/</g, '%3C').replace(/>/g, '%3E')

async function get(url, as = 'text') {
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`${r.status} for ${url}`)
  return as === 'buffer' ? Buffer.from(await r.arrayBuffer()) : r.text()
}

async function readGenerated() {
  if (!existsSync(GENERATED)) return null
  return import(`../${GENERATED}?t=${Date.now()}`)
}

if (process.argv.includes('--check')) {
  let bad = 0
  const gen = await readGenerated()
  if (!gen) {
    console.error(`✗ ${GENERATED} is missing`)
    bad++
  } else {
    const noArt = glyphs.filter(g => !gen.EMOJI_ART[g])
    const noCode = icons.filter(n => !gen.ICON_CODEPOINTS[n])
    if (noArt.length) { bad++; console.error(`✗ no drawing shipped for: ${noArt.join(' ')}`) }
    if (noCode.length) { bad++; console.error(`✗ no codepoint shipped for: ${noCode.join(', ')}`) }
  }
  const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : null
  const shipped = manifest?.files?.[ICON_FONT.file]?.contents
  if (shipped !== icons.join(',')) {
    bad++
    const added = shipped ? icons.filter(n => !shipped.split(',').includes(n)) : icons
    console.error(`✗ ${ICON_FONT.file} is stale — not in the shipped font: ${added.join(', ') || '(order or removal)'}`)
  }
  if (!existsSync(join(OUT, ICON_FONT.file))) { bad++; console.error(`✗ ${ICON_FONT.file} is missing from ${OUT}`) }
  if (bad) {
    console.error('\nRun: npm run fonts')
    process.exit(1)
  }
  console.log(`✓ puzzle art matches the tables (${glyphs.length} emoji drawings, ${icons.length} icons)`)
  process.exit(0)
}

// ── emoji: Noto SVG drawings ──────────────────────────────────────────────────
const art = {}
let artBytes = 0
for (const g of glyphs) {
  const uri = svgDataUri(await get(`${NOTO_RAW}/svg/${notoName(g)}.svg`))
  art[g] = uri
  artBytes += uri.length
}

// ── icons: the font, and each icon's codepoint ────────────────────────────────
const sheet = await get(ICON_FONT.css)
const urls = [...sheet.matchAll(/url\((https:\/\/[^)]+)\)/g)].map(m => m[1])
// More than one means the request was not subset the way it was meant to be and the font came
// back as its full unicode-range split — worth failing on rather than shipping.
if (urls.length !== 1) throw new Error(`expected exactly one icon font file, got ${urls.length}`)
const iconFont = await get(urls[0], 'buffer')

const table = Object.fromEntries((await get(ICON_CODEPOINTS_URL)).split('\n')
  .map(l => l.trim().split(/\s+/)).filter(p => p.length === 2))
const codepoints = {}
for (const n of icons) {
  if (!table[n]) throw new Error(`no codepoint for icon "${n}" in ${ICON_CODEPOINTS_URL}`)
  codepoints[n] = table[n]
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, ICON_FONT.file), iconFont)
rmSync(join(OUT, 'puzzle-emoji.woff2'), { force: true })
rmSync(join(OUT, 'puzzle-emoji.LICENSE.txt'), { force: true })
writeFileSync(join(OUT, 'noto-emoji.LICENSE.txt'), await get(`${NOTO_RAW}/svg/LICENSE`))

writeFileSync(GENERATED, [
  '// GENERATED by scripts/fetch-puzzle-fonts.mjs — do not edit. Re-run `npm run fonts` instead.',
  '//',
  `// EMOJI_ART: Noto Emoji SVG drawings (googlefonts/noto-emoji ${NOTO_EMOJI_REF}, Apache License 2.0 —`,
  '// public/fonts/noto-emoji.LICENSE.txt), one data URI per glyph in the puzzle tables.',
  '// ICON_CODEPOINTS: Material Symbols codepoint per icon name, for public/fonts/puzzle-icons.woff2.',
  '',
  `export const NOTO_EMOJI_REF = '${NOTO_EMOJI_REF}'`,
  '',
  `export const ICON_CODEPOINTS = ${JSON.stringify(codepoints, null, 2)}`,
  '',
  'export const EMOJI_ART = {',
  ...glyphs.map(g => `  ${JSON.stringify(g)}: ${JSON.stringify(art[g])},`),
  '}',
  '',
].join('\n'))

const manifest = {
  fetched: new Date().toISOString().slice(0, 10),
  files: {
    [ICON_FONT.file]: { family: ICON_FONT.family, license: ICON_FONT.license, contents: icons.join(','), bytes: iconFont.length },
  },
  emoji_art: { source: `googlefonts/noto-emoji@${NOTO_EMOJI_REF}/svg`, license: 'Apache License 2.0', contents: glyphs.join(''), bytes: artBytes },
}
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`${ICON_FONT.file}  ${(iconFont.length / 1024).toFixed(1)} KB`)
console.log(`${GENERATED}  ${glyphs.length} emoji drawings, ${(artBytes / 1024).toFixed(0)} KB before gzip`)
console.log(`wrote ${MANIFEST}`)
