// Writes the trial set's scene drawings to public/english-art/<hash>.svg and the manifest the lab reads.
// The file name is a hash, not "ball-under-chair": the picture's name would be the answer.
// Single objects (dog, apple…) are not files: they are the Noto emoji drawings already in the bundle.
//
//   node scripts/english-art/build.mjs
import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { SCENES, SETS } from './art.mjs'

const OUT = 'public/english-art'
mkdirSync(OUT, { recursive: true })
const scenes = {}
for (const [id, draw] of Object.entries(SCENES)) {
  const svg = draw()
  const h = createHash('sha1').update(svg).digest('hex').slice(0, 16)
  writeFileSync(`${OUT}/${h}.svg`, svg)
  scenes[id] = `english-art/${h}.svg`
}
const keep = new Set(Object.values(scenes).map(f => f.split('/')[1]))
for (const f of readdirSync(OUT)) if (!keep.has(f)) unlinkSync(`${OUT}/${f}`)
// Single objects, drawn by the Noto emoji in src/lib/puzzleArt.generated.js (EMOJI_ART).
const objects = { dog: '🐶', cat: '🐱', rabbit: '🐰', banana: '🍌', pear: '🍐', apple: '🍎', sun: '☀️', fish: '🐟' }
writeFileSync('src/lib/literacy/artManifest.generated.json', JSON.stringify({ scenes, sets: SETS, objects }, null, 1) + '\n')
console.log(`${Object.keys(scenes).length} scenes, ${Object.keys(objects).length} objects`)
