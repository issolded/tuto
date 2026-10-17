// Copy the passages that passed every automatic check into the preview screen's data file.
// They are candidates, not approved content: the screen says so, and nothing else imports the file.
//
//   node scripts/english-passages/export-preview.mjs <out-dir> [<out-dir> …]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dirs = process.argv.slice(2)
if (!dirs.length) { console.error('usage: export-preview.mjs <out-dir> …'); process.exit(1) }
const items = []
for (const d of dirs) {
  const dir = join(here, 'out', d)
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const r = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    if (r.status !== 'awaiting-human') continue
    const ped = r.check.pedagogy || {}
    // Older runs were reviewed before the sense/quality lines existed; a run that has them and says
    // no is left out even if the rest passed.
    if (ped.passage?.story_quality === false || (ped.questions || []).some(q => q.reason_makes_sense === false || q.reason_logical === false || q.key_adds_info === true) || ped.passage?.logic_ok === false) continue
    items.push({
      id: r.id, level: r.level, title: r.item.title, passage: r.item.passage,
      questions: r.item.questions.map(q => ({ op: q.op, stem: q.stem, options: q.options, answer: q.answer, evidence: q.evidence })),
      writer: r.models.generator, premiseSource: r.premise.source, approved: false,
    })
  }
}
const out = join(here, '..', '..', 'src', 'lib', 'literacy', 'readingPreview.generated.json')
writeFileSync(out, JSON.stringify({ note: 'Candidates from scripts/english-passages; passed automatic checks, NOT approved by a person.', items }, null, 1))
console.log(`${items.length} passages → ${out}`)
