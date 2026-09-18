// Copies the puzzle engine into the server, byte for byte.
//
//   npm run puzzle:sync           — copy
//   npm run puzzle:sync -- --check — fail if the server's copy differs (puzzle:check runs this)
//
// The server generates every puzzle session and checks every answer against the question it
// regenerates from the seed, so the child's browser is never sent which option is right. That
// needs the engine on the server, and the server is deployed on its own — it imports nothing
// from src/. So the engine lives in src/lib (where the lab, the audit and the child screen use
// it) and a copy lives in server/puzzle. A copy that falls behind does not break anything
// loudly: the server keeps generating with the old rules, and a fix made here never reaches a
// child. --check is what turns that into a failure.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'

const FILES = [
  'puzzleTemplates.js', 'puzzleFigures.js', 'puzzleGlyphs.js', 'puzzleIcons.js',
  'fontGate.js', 'puzzleArt.generated.js',
]
const FROM = 'src/lib'
const TO = 'server/puzzle'

if (process.argv.includes('--check')) {
  const stale = FILES.filter(f => !existsSync(`${TO}/${f}`)
    || !readFileSync(`${FROM}/${f}`).equals(readFileSync(`${TO}/${f}`)))
  if (stale.length) {
    console.error(`✗ server/puzzle is behind src/lib: ${stale.join(', ')}\n\nRun: npm run puzzle:sync`)
    process.exit(1)
  }
  console.log(`✓ server/puzzle matches src/lib (${FILES.length} files)`)
  process.exit(0)
}

mkdirSync(TO, { recursive: true })
for (const f of FILES) writeFileSync(`${TO}/${f}`, readFileSync(`${FROM}/${f}`))
console.log(`copied ${FILES.length} files to ${TO}`)
