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

// The English engine rides the same rule for the same reason (server/english): the server deals
// the questions and keeps the answers. Its lexicon is 3.8 MB and would never be sent to a phone;
// on the server it is one import.
const ENGINES = [
  { to: 'server/puzzle', files: [
    'puzzleSpatial.js', 'puzzleTemplates.js', 'puzzleFigures.js', 'puzzleGlyphs.js', 'puzzleIcons.js',
    'fontGate.js', 'puzzleArt.generated.js', 'puzzleExplain.js',
  ] },
  { to: 'server/english', files: ['englishTemplates.js', 'englishTables.js', 'englishLexicon.generated.js', 'englishHelp.js'] },
]
const FROM = 'src/lib'

if (process.argv.includes('--check')) {
  let bad = false
  for (const { to, files } of ENGINES) {
    const stale = files.filter(f => !existsSync(`${to}/${f}`)
      || !readFileSync(`${FROM}/${f}`).equals(readFileSync(`${to}/${f}`)))
    if (stale.length) {
      console.error(`✗ ${to} is behind src/lib: ${stale.join(', ')}\n\nRun: npm run puzzle:sync`)
      bad = true
    } else console.log(`✓ ${to} matches src/lib (${files.length} files)`)
  }
  process.exit(bad ? 1 : 0)
}

for (const { to, files } of ENGINES) {
  mkdirSync(to, { recursive: true })
  for (const f of files) writeFileSync(`${to}/${f}`, readFileSync(`${FROM}/${f}`))
  console.log(`copied ${files.length} files to ${to}`)
}
