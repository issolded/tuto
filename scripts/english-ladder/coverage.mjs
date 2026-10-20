// Content coverage of the English ladder: per step, which sources can serve it, how many items (or
// "generated"), the best review status, and the steps nothing can serve yet. The ladder engine's gaps()
// with the catalog's hasContent() at a given status.
//   node scripts/english-ladder/coverage.mjs [--status approved|checked|draft]
import { TRACKS, TRACK_ORDER, gaps } from '../../src/lib/literacy/ladder.js'
import { coverage, hasContent } from '../../src/lib/literacy/catalog.js'

const i = process.argv.indexOf('--status')
const cov = coverage()
console.log('step  best      items      formats                      sources')
for (const t of TRACK_ORDER) for (let s = 1; s <= TRACKS[t]; s++) {
  const st = `${t}${s}`, c = cov[st]
  if (!c) { console.log(`${st.padEnd(5)} —         (nothing)`); continue }
  const items = c.generated ? (c.items ? `gen + ${c.items}` : 'generated') : String(c.items)
  console.log(`${st.padEnd(5)} ${c.best.padEnd(9)} ${items.padEnd(10)} ${[...c.formats].join(', ').padEnd(28)} ${c.sources.join(', ')}`)
}
for (const min of i > 0 ? [process.argv[i + 1]] : ['draft', 'checked', 'approved']) {
  const g = gaps(hasContent(min))
  console.log(`\nat "${min}" or better: ${32 - g.length}/32 steps served; empty: ${g.join(' ') || 'none'}`)
}
