// Draws every pictorial figure the puzzle module can show in WebKit AND Chromium, and fails if
// any of them comes out blank in either.
//
//   npm run puzzle:webkit
//
// Every other check here runs in node or in Chromium. That is how, until 2026-09-16, every icon
// and most emoji were empty boxes on every iPhone and iPad — all WebKit, whatever the browser —
// while every check passed: WebKit does not apply ligatures inside SVG <text> (the icons were
// addressed by name), and does not draw COLRv1 (the emoji font Google serves to Chrome). Ada
// uses an iPad. This check exists so that the engine a child actually has is one we look at.
//
// It needs Playwright with its WebKit and Chromium builds, which this project does not depend
// on. Point PLAYWRIGHT_CORE at a playwright-core directory if it is not resolvable from here;
// `npx playwright install webkit chromium` fetches the browsers.

import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { installStubFonts } from './lib/stub-fonts.mjs'

async function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_CORE && `${process.env.PLAYWRIGHT_CORE}/index.mjs`, 'playwright', 'playwright-core']
  for (const spec of tries.filter(Boolean)) {
    try { return await import(spec) } catch { /* try the next one */ }
  }
  console.error('This check needs Playwright (webkit + chromium), which this project does not depend on.\n'
    + '  Set PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core, or install playwright globally.')
  process.exit(2)
}
const pw = await loadPlaywright()

installStubFonts()
const G = await import('../src/lib/puzzleGlyphs.js')
const I = await import('../src/lib/puzzleIcons.js')

const PX = 64
const COLS = 16
const figures = [
  ...G.ALL_GLYPHS.map(glyph => ({ label: glyph, svg: G.renderGlyph(G.makeGlyphSpec({ glyph }), { px: PX }) })),
  ...I.ALL_ICONS.flatMap(icon => [0, 1].map(fill => ({
    label: `${icon} FILL ${fill}`, svg: I.renderIcon(I.makeIconSpec({ icon, fill }), { px: PX }),
  }))),
]

const iconFont = readFileSync('public/fonts/puzzle-icons.woff2').toString('base64')
const html = `<!doctype html><style>
@font-face{font-family:'Material Symbols Outlined';src:url(data:font/woff2;base64,${iconFont}) format('woff2');font-display:block}
body{margin:0;background:#fff;color:#000}
.g{display:grid;grid-template-columns:repeat(${COLS},${PX}px);grid-auto-rows:${PX}px}
.g>div{width:${PX}px;height:${PX}px;overflow:hidden;line-height:0}
</style><div class=g>${figures.map(f => `<div>${f.svg}</div>`).join('')}</div>`

// A minimal PNG reader — 8-bit RGB or RGBA, not interlaced, which is what Playwright writes.
function readPng(buf) {
  let pos = 8, width, height, channels
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4)
      if (data[8] !== 8 || data[12] !== 0) throw new Error('unsupported PNG')
      channels = { 2: 3, 6: 4 }[data[9]]
      if (!channels) throw new Error(`unsupported PNG colour type ${data[9]}`)
    } else if (type === 'IDAT') idat.push(data)
    pos += len + 12
  }
  const raw = inflateSync(Buffer.concat(idat))
  const px = Buffer.alloc(width * height * channels)
  const stride = width * channels
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[y * stride + x - channels] : 0
      const b = y > 0 ? px[(y - 1) * stride + x] : 0
      const c = x >= channels && y > 0 ? px[(y - 1) * stride + x - channels] : 0
      const p = a + b - c
      const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1
        : (Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a
          : Math.abs(p - b) <= Math.abs(p - c) ? b : c)
      px[y * stride + x] = (line[x] + pred) & 255
    }
  }
  return { width, channels, px }
}

// Share of a cell's pixels that are not near-white.
function inkPerCell({ width, channels, px }) {
  return figures.map((_, i) => {
    const cx = (i % COLS) * PX
    const cy = Math.floor(i / COLS) * PX
    let ink = 0
    for (let y = cy; y < cy + PX; y++) {
      for (let x = cx; x < cx + PX; x++) {
        const k = (y * width + x) * channels
        if (px[k] < 200 || px[k + 1] < 200 || px[k + 2] < 200) ink++
      }
    }
    return ink / (PX * PX)
  })
}

const results = {}
for (const engine of ['webkit', 'chromium']) {
  const browser = await pw[engine].launch()
  const page = await browser.newPage({ viewport: { width: COLS * PX, height: 900 }, deviceScaleFactor: 1 })
  await page.setContent(html)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(500)
  results[engine] = inkPerCell(readPng(await page.screenshot({ fullPage: true })))
  await browser.close()
}

// A drawn figure covers several percent of its cell; an empty box covers none. Between the two
// engines the same drawing can differ in antialiasing, never in whether it is there.
const MIN_INK = 0.02
const findings = []
figures.forEach((f, i) => {
  const w = results.webkit[i]
  const c = results.chromium[i]
  if (w < MIN_INK || c < MIN_INK) findings.push(`${f.label}: ink webkit ${(w * 100).toFixed(1)}% · chromium ${(c * 100).toFixed(1)}%`)
  else if (Math.abs(w - c) > Math.max(w, c) * 0.5) findings.push(`${f.label}: engines disagree — webkit ${(w * 100).toFixed(1)}% · chromium ${(c * 100).toFixed(1)}%`)
})

console.log(`${figures.length} figures drawn in webkit and chromium (${G.ALL_GLYPHS.length} emoji, ${I.ALL_ICONS.length} icons × FILL 0/1)`)
if (findings.length) {
  console.error(`\n✗ ${findings.length} finding${findings.length > 1 ? 's' : ''}:`)
  for (const f of findings) console.error(`  ${f}`)
  process.exit(1)
}
console.log('✓ no findings')
