// The checks that need a BROWSER, and therefore cannot live in scripts/puzzle-audit.mjs.
//
//   npm run puzzle:pixels
//
// Everything in puzzle-audit asks whether a question is well formed: five different keys, one
// clean split, a rule that survives normalisation. None of that can answer the only question a
// child actually has — CAN I TELL THESE APART? A key is derived from the spec, and two specs
// that differ can draw the same picture, which is a failure no amount of reasoning about specs
// will ever find. So this renders them and looks.
//
// Both sections below exist because the thing they look for actually shipped:
//
//   · eight icons had no solid form in the font, so a run built on the FILL axis was six
//     identical drawings while the key reported six different ones
//   · and then the table gained twelve icons, six of them strokes (× ✓ + − % £, which have no
//     inside to fill), the list was not re-measured, and the same bug came back
//
// Which is the point: THE DEAD-FILL LIST GOES STALE WHENEVER THE ICON TABLE CHANGES, and a stale
// entry is invisible from the node side. Run this after editing it.

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { installStubFonts } from './lib/stub-fonts.mjs'

// Playwright is deliberately NOT a dependency of this project. It is a few hundred megabytes and
// a browser download, which is a lot to add to a children's PWA for one check that runs by hand.
// So it is resolved wherever it happens to live — the project, or a global install — and when it
// is nowhere the script says what to do rather than failing with a stack trace.
async function loadChromium() {
  for (const spec of ['playwright', globalPlaywright()]) {
    if (!spec) continue
    try { return (await import(spec)).chromium } catch { /* try the next one */ }
  }
  console.error('This check needs Playwright, which this project does not depend on.\n'
    + '  npm i -g playwright   (the browser itself is already at /opt/pw-browsers/chromium)')
  process.exit(2)
}
function globalPlaywright() {
  try { return `${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs` } catch { return null }
}
const chromium = await loadChromium()

installStubFonts()
const T = await import('../src/lib/puzzleTemplates.js')
const I = await import('../src/lib/puzzleIcons.js')

// The icon font is EMBEDDED in each SVG, and that is not optional: a data-URI SVG is an isolated
// document with no access to the page's fonts, so without this every icon draws as nothing and
// the measurement is meaningless. The first version of this reported all 35 icons as having a
// dead FILL axis for exactly that reason. Emoji need nothing: their art is in the SVG itself.
const icons = readFileSync('public/fonts/puzzle-icons.woff2').toString('base64')
const FACES = '<defs><style>'
  + `@font-face{font-family:'Material Symbols Outlined';src:url(data:font/woff2;base64,${icons}) format('woff2')}`
  + '</style></defs>'

const PER_BAND = Number(process.env.PUZZLE_PIXEL_DRAWS || 40)   // per band PER TYPE
const PX = 84
const findings = []

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
await page.setContent(`<canvas id=c width=${PX} height=${PX}></canvas>`)

// One rasteriser, used by both sections. Returns the share of INKED pixels that differ, so a
// small mark moving inside a big figure is not diluted by the white around it.
async function compare(pairs) {
  return page.evaluate(async ({ pairs, faces, PX }) => {
    const ctx = document.getElementById('c').getContext('2d', { willReadFrequently: true })
    const raster = (svg) => new Promise(res => {
      const img = new Image()
      img.onload = () => {
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PX, PX); ctx.drawImage(img, 0, 0, PX, PX)
        res(ctx.getImageData(0, 0, PX, PX).data)
      }
      img.onerror = () => res(null)
      img.src = 'data:image/svg+xml;charset=utf-8,'
        + encodeURIComponent(svg.replace(/(<svg[^>]*>)/, `$1${faces}`))
    })
    const lum = (d, i) => d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
    const out = []
    for (const group of pairs) {
      const bmps = []
      for (const svg of group.svgs) bmps.push(await raster(svg))
      if (bmps.some(x => !x)) { out.push({ ...group, svgs: undefined, worst: -1, pair: 'unrenderable' }); continue }
      let worst = 101; let pair = ''; let px = 0
      for (let x = 0; x < bmps.length; x++) {
        for (let y = x + 1; y < bmps.length; y++) {
          const A = bmps[x]; const B = bmps[y]
          let diff = 0; let inked = 0
          for (let k = 0; k < A.length; k += 4) {
            const la = lum(A, k); const lb = lum(B, k)
            if (la < 235 || lb < 235) inked++
            if (Math.abs(la - lb) > 40) diff++
          }
          const pct = inked ? (diff / inked) * 100 : 0
          if (pct < worst) { worst = +pct.toFixed(1); pair = `${x}/${y}`; px = diff }
        }
      }
      out.push({ ...group, svgs: undefined, worst, pair, px })
    }
    return out
  }, { pairs, faces: FACES, PX })
}

// ── 1. which icons have a FILL axis that draws anything ──────────────────────
const axis = await compare(I.ALL_ICONS.map(icon => ({
  icon,
  svgs: [0, 1].map(fill => I.renderIcon(I.makeIconSpec({ icon, fill }), { px: PX })),
})))
const dead = axis.filter(r => r.worst < 5).map(r => r.icon).sort()
const declared = I.ALL_ICONS.filter(n => !I.fillIsLive(n)).sort()
console.log(`FILL axis: ${dead.length} of ${I.ALL_ICONS.length} icons draw the same at FILL 0 and FILL 1`)
const missing = dead.filter(n => !declared.includes(n))
const spurious = declared.filter(n => !dead.includes(n))
if (missing.length) findings.push(`FILL_DOES_NOTHING is missing: ${missing.join(', ')}`)
if (spurious.length) findings.push(`FILL_DOES_NOTHING lists icons whose fill DOES work: ${spurious.join(', ')}`)

// ── 2. can a child tell the options of a real question apart ─────────────────
// Drawn PER TYPE, not from the band's mix. The mix deals a rare type a handful of questions out
// of two hundred, which is far too thin to find a legibility problem that belongs to that type —
// the same blind spot the answer-position check had, for the same reason. Asked directly, every
// type gets the same sample whether the band poses it once a sheet or once a week.
const jobs = []
for (const band of T.BAND_KEYS) {
  const types = [...T.BANDS[band].types, ...T.BANDS[band].glyphTypes, ...T.BANDS[band].iconTypes]
  for (const type of types) {
    for (let i = 0; i < PER_BAND; i++) {
      const q = T.generateQuestion(band, type, 300_000 + i * 131)
      // A code question offers five strings; there is nothing to rasterise.
      if (!q || !q.options[0].spec) continue
      jobs.push({
        band, type: q.type, rule: String(q.rule.attr), seed: q.seed,
        svgs: q.options.map(o => (o.spec.kind === 'glyph' ? T.renderGlyph(o.spec, { px: PX })
          : o.spec.kind === 'icon' ? T.renderIcon(o.spec, { px: PX })
            : T.renderFigure(o.spec, { px: PX }))),
      })
    }
  }
}
const sweep = await compare(jobs)
sweep.sort((a, b) => a.worst - b.worst)

const tally = (keyOf) => {
  const m = {}
  for (const r of sweep) (m[keyOf(r)] ??= []).push(r.worst)
  return Object.entries(m).map(([k, list]) => {
    const v = list.slice().sort((a, b) => a - b)
    return [k, v.length, v[0], v[Math.floor(v.length * 0.05)], v[Math.floor(v.length / 2)]]
  }).sort((a, b) => a[2] - b[2])
}
const show = (label, rows) => {
  console.log(`\nclosest pair within one question, by ${label}:`)
  for (const [k, n, min, p5, med] of rows) {
    console.log(`  ${k.padEnd(22)} n=${String(n).padStart(4)}  min ${String(min).padStart(5)}%`
      + `  p5 ${String(p5).padStart(5)}%  median ${med}%`)
  }
}
console.log(`\n${sweep.length} questions rendered`)
show('band', tally(r => r.band))
show('type', tally(r => r.type))

// Where the bar sits, and why it is not higher.
//
// The share of ink that differs is a proxy, and it UNDERSTATES one case badly: a single small
// mark on a large uniform figure. A white dot punched into a solid black pentagon is the only
// white thing inside it and a child sees it instantly, but its area is about 3% of the
// pentagon's. Set the bar at 4% and every "one dot versus none" question is reported, which is
// the metric being wrong rather than the question.
//
// So there are two tests and a question has to fail BOTH. Under 2% of the ink is the share test,
// which is where a corner mark at its old radius of 5.5 landed — a genuine defect, since at that
// size the mark really was hard to find. And fewer than 25 differing pixels catches the case the
// share cannot see at all: options whose total ink is small, where a handful of pixels can still
// be a large share of it. Two options that are the SAME drawing differ in zero pixels and fail
// both tests by a wide margin, which is the case this check exists for.
const TOO_CLOSE = 2
const MIN_PIXELS = 25
const tight = sweep.filter(r => r.worst >= 0 && (r.worst < TOO_CLOSE || r.px < MIN_PIXELS))
if (tight.length) {
  findings.push(`${tight.length} of ${sweep.length} questions offer two options a child would struggle to tell apart`)
  for (const r of tight.slice(0, 10)) {
    console.log(`  ${String(r.worst).padStart(5)}%  ${String(r.px).padStart(5)}px  ${r.band.padEnd(6)} ${r.type.padEnd(15)} ${r.rule.padEnd(20)} seed ${r.seed}`)
  }
}
const broken = sweep.filter(r => r.worst === -1)
if (broken.length) findings.push(`${broken.length} questions had an option that would not render at all`)

await browser.close()
if (findings.length) {
  console.error(`\n✗ ${findings.length} finding${findings.length > 1 ? 's' : ''}:`)
  for (const f of findings) console.error(`  ${f}`)
  process.exit(1)
}
console.log('\n✓ no findings')
