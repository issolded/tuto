// Fetches the two puzzle fonts into public/fonts/, subset to exactly the tables the module
// uses, so the app serves them itself instead of depending on fonts.googleapis.com.
//
//   node scripts/fetch-puzzle-fonts.mjs          — fetch and write
//   npm run fonts:check                          — verify what is shipped matches the tables
//
// Why self-hosted at all: the module drops its pictorial questions whenever the font that
// draws them has not loaded (see puzzleGlyphs.fontReady). Depending on a third-party host means
// that gate closes whenever that host is slow or blocked, and a child quietly gets a smaller,
// entirely geometric session with no error anywhere. The fonts are small enough that there is
// no reason to take the risk: measured below, the whole emoji table is ~53KB and the whole
// icon table ~9KB.
//
// ── The trap this script exists to close ─────────────────────────────────────────────────
//
// Subsetting means the shipped font contains exactly the glyphs the tables held ON THE DAY IT
// WAS FETCHED. Add 🐙 to GLYPH_GROUPS and forget to re-run this, and that one glyph falls back
// to the device's own emoji — which is precisely the platform variance the pinning exists to
// remove, now happening for one glyph, invisibly, with everything else still correct.
//
// So the fetch writes a manifest of what it subsetted, and --check compares it against the
// tables as they are now. A table edit without a re-fetch fails the check instead of shipping.

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { ALL_GLYPHS } from '../src/lib/puzzleGlyphs.js'
import { ALL_ICONS } from '../src/lib/puzzleIcons.js'

const OUT = 'public/fonts'
const MANIFEST = join(OUT, 'puzzle-fonts.json')

// Google serves woff2 only to browsers that advertise support; with node's default agent it
// hands back a TrueType URL four times the size.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const glyphs = [...new Set(ALL_GLYPHS)].join('')
const icons = [...new Set(ALL_ICONS)].sort()

const SOURCES = {
  'puzzle-emoji.woff2': {
    family: 'Noto Color Emoji',
    license: 'SIL Open Font License 1.1',
    css: `https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&text=${encodeURIComponent(glyphs)}`,
    contents: glyphs,
  },
  'puzzle-icons.woff2': {
    family: 'Material Symbols Outlined',
    license: 'Apache License 2.0',
    // The FILL axis is the whole reason this font is here — 0..1 keeps it variable rather than
    // baking one end of it.
    css: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined'
      + ':opsz,wght,FILL,GRAD@24,400,0..1,0'
      + `&icon_names=${icons.join(',')}`,
    contents: icons.join(','),
  },
}

async function fetchSubset(css) {
  const sheet = await fetch(css, { headers: { 'User-Agent': UA } }).then(r => {
    if (!r.ok) throw new Error(`stylesheet ${r.status} for ${css}`)
    return r.text()
  })
  const urls = [...sheet.matchAll(/url\((https:\/\/[^)]+)\)/g)].map(m => m[1])
  if (urls.length !== 1) {
    // More than one means the request was not subset the way it was meant to be and the font
    // came back as its full unicode-range split — worth failing on rather than shipping.
    throw new Error(`expected exactly one font file, got ${urls.length}`)
  }
  const buf = await fetch(urls[0], { headers: { 'User-Agent': UA } }).then(r => {
    if (!r.ok) throw new Error(`font ${r.status}`)
    return r.arrayBuffer()
  })
  return Buffer.from(buf)
}

function currentTables() {
  return Object.fromEntries(Object.entries(SOURCES).map(([file, s]) => [file, s.contents]))
}

if (process.argv.includes('--check')) {
  if (!existsSync(MANIFEST)) {
    console.error('✗ public/fonts/puzzle-fonts.json is missing — run: node scripts/fetch-puzzle-fonts.mjs')
    process.exit(1)
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const now = currentTables()
  let bad = 0
  for (const [file, contents] of Object.entries(now)) {
    const was = manifest.files?.[file]?.contents
    if (was !== contents) {
      bad++
      console.error(`✗ ${file} is stale — the table changed since it was fetched.`)
      const missing = [...contents].filter(c => was && !was.includes(c))
      if (missing.length && file.includes('emoji')) {
        console.error(`  not in the shipped font: ${missing.join(' ')}`)
      }
      if (file.includes('icons') && was) {
        const added = contents.split(',').filter(n => !was.split(',').includes(n))
        if (added.length) console.error(`  not in the shipped font: ${added.join(', ')}`)
      }
    }
    if (!existsSync(join(OUT, file))) {
      bad++
      console.error(`✗ ${file} is missing from ${OUT}`)
    }
  }
  if (bad) {
    console.error('\nRun: node scripts/fetch-puzzle-fonts.mjs')
    process.exit(1)
  }
  console.log(`✓ both puzzle fonts match the tables (${[...new Set(ALL_GLYPHS)].length} emoji, ${icons.length} icons)`)
  process.exit(0)
}

mkdirSync(OUT, { recursive: true })
const manifest = { fetched: new Date().toISOString().slice(0, 10), files: {} }
for (const [file, source] of Object.entries(SOURCES)) {
  const buf = await fetchSubset(source.css)
  writeFileSync(join(OUT, file), buf)
  manifest.files[file] = {
    family: source.family,
    license: source.license,
    contents: source.contents,
    bytes: buf.length,
  }
  console.log(`${file}  ${(buf.length / 1024).toFixed(1)} KB  ${source.family}`)
}
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`\nwrote ${MANIFEST}`)
