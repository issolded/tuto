// Marks recordings as heard and approved by a person (or takes the mark back). Only a person sets this: no
// check passes a recording to children on its own. The lab (/english-trial-lab, Review) collects the ids
// while listening and copies this command.
//   node scripts/english-audio/approve.mjs <recording id>[,<id>…]            approve
//   node scripts/english-audio/approve.mjs --revoke <recording id>[,<id>…]   take back
// Ids are the recording hashes (the .m4a names), not clip ids: an approval belongs to the audio that was
// heard, so a re-recorded clip (new hash) starts unapproved again.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MANIFEST = join(dirname(fileURLToPath(import.meta.url)), '../../src/lib/literacy/audioManifest.generated.json')
const args = process.argv.slice(2)
const revoke = args.includes('--revoke')
const ids = new Set(args.filter(a => a !== '--revoke').flatMap(a => a.split(',')).map(s => s.trim()).filter(Boolean))
if (!ids.size) { console.error('usage: approve.mjs [--revoke] <recording id>[,<id>…]'); process.exit(1) }

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
const found = new Set()
for (const [key, m] of Object.entries(manifest)) {
  if (!ids.has(m.id)) continue
  found.add(m.id)
  m.approved = !revoke
  if (revoke) delete m.approved_on
  else m.approved_on = new Date().toISOString().slice(0, 10)
  console.log(`${revoke ? 'revoked ' : 'approved'} ${key} (${m.status})`)
}
const unknown = [...ids].filter(id => !found.has(id))
if (unknown.length) console.log(`not in the manifest (re-recorded since?): ${unknown.join(', ')}`)
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n')
const all = Object.values(manifest)
console.log(`${all.filter(m => m.approved).length} of ${all.length} recordings approved`)
