// Uploads the recordings in the manifest to Supabase Storage: the AAC files to the public bucket
// `english-audio` (what screens play), the FLAC masters to the private `english-audio-masters`.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/english-audio/upload.mjs [--only id,id] [--dry]
//
// A file name is the hash of what was said, by whom, with which model and encoding (build.mjs), so a file
// never changes under its name: it is uploaded once (an existing name is skipped, never overwritten) and
// served with a one-year immutable cache. The repo keeps only code and the manifest.
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fetchRetry } from './net.mjs'

const MANIFEST = 'src/lib/literacy/audioManifest.generated.json'
const LOCAL = 'public/english-audio'
const MASTERS = process.env.AUDIO_MASTERS || join(process.env.HOME, 'Downloads', 'tuto-audio-masters')
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) { console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY needed'); process.exit(1) }
const arg = k => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null }
const ONLY = arg('only') ? new Set(arg('only').split(',')) : null
const DRY = process.argv.includes('--dry')

const ids = [...new Set(Object.values(JSON.parse(readFileSync(MANIFEST, 'utf8'))).map(m => m.id))].filter(id => !ONLY || ONLY.has(id))
const jobs = ids.flatMap(id => [
  { bucket: 'english-audio', name: `${id}.m4a`, path: join(LOCAL, `${id}.m4a`), type: 'audio/mp4' },
  { bucket: 'english-audio-masters', name: `${id}.flac`, path: join(MASTERS, `${id}.flac`), type: 'audio/flac' },
])

const count = { uploaded: 0, there: 0, missing: 0, failed: 0 }
async function put(j) {
  if (!existsSync(j.path)) { count.missing++; console.log(`missing locally: ${j.path}`); return }
  if (DRY) { count.uploaded++; return }
  const r = await fetchRetry(`${URL_}/storage/v1/object/${j.bucket}/${j.name}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${KEY}`, apikey: KEY, 'content-type': j.type, 'cache-control': 'max-age=31536000, immutable', 'x-upsert': 'false' },
    body: readFileSync(j.path),
  })
  if (r.ok) { count.uploaded++; return }
  const t = await r.text()
  if (r.status === 409 || /already exists|Duplicate/i.test(t)) { count.there++; return }
  count.failed++; console.log(`${j.bucket}/${j.name}: ${r.status} ${t.slice(0, 160)}`)
}

const queue = [...jobs]
await Promise.all(Array.from({ length: 8 }, async () => { while (queue.length) await put(queue.shift()) }))
console.log(`${ids.length} recordings, ${jobs.length} files${DRY ? ' (dry run)' : ''}: uploaded ${count.uploaded}, already there ${count.there}, missing locally ${count.missing}, failed ${count.failed}`)
if (count.failed || count.missing) process.exit(1)
