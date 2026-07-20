// Uploads the guided-step sketches to the public `drawings` bucket.
//
// Path scheme: drawings/{id}/{age_group}/step-{n}.webp
// The age group is in the path from day one because the same animal will have
// DIFFERENT sketch sets per age band (9-11 is not a resize of 6-8) — only the
// 6-8 sets exist today.
//
// WebP only. The .png siblings in drawings/ are the working files and are
// deliberately not uploaded.
//
//   node server/scripts/upload_drawings.mjs [--dry]

import { createClient } from '@supabase/supabase-js'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing')
  process.exit(1)
}

const BUCKET = 'drawings'
const SRC = path.resolve(process.argv[2] || 'drawings')
const DRY = process.argv.includes('--dry')

// Which age bands to publish a set under.
//   --all-ages  → the same sketches under every band (a stopgap: one artwork
//                 shown to every age until per-age sets are drawn)
//   default     → 6-8 only
// The path scheme is unchanged either way, so dropping a real 9-11 set in later
// just means re-running without --all-ages for that folder.
const ALL_AGE_GROUPS = ['6-8', '9-11', '12-15']
const AGE_GROUPS = process.argv.includes('--all-ages') ? ALL_AGE_GROUPS : ['6-8']

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets()
  const existing = buckets?.find(b => b.name === BUCKET)
  if (existing) {
    // These are generic sketches with no child data — public is intentional so
    // the CDN caches them and no URL signing is needed per panel.
    if (!existing.public) console.warn(`⚠️  bucket "${BUCKET}" exists but is NOT public`)
    return
  }
  if (DRY) return console.log(`[dry] would create public bucket "${BUCKET}"`)
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: '5MB',
    allowedMimeTypes: ['image/webp'],
  })
  if (error) throw new Error(`createBucket: ${error.message}`)
  console.log(`created public bucket "${BUCKET}"`)
}

async function main() {
  await ensureBucket()

  const ids = (await readdir(SRC, { withFileTypes: true }))
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()

  let uploaded = 0, skipped = 0
  for (const id of ids) {
    const files = (await readdir(path.join(SRC, id)))
      .filter(f => f.endsWith('.webp'))
      .sort()

    for (const file of files) {
      const body = DRY ? null : await readFile(path.join(SRC, id, file))
      for (const ageGroup of AGE_GROUPS) {
        const dest = `${id}/${ageGroup}/${file}`
        if (DRY) { console.log(`[dry] ${file} → ${BUCKET}/${dest}`); uploaded++; continue }

        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(dest, body, { contentType: 'image/webp', upsert: true })
        if (error) { console.error(`✗ ${dest}: ${error.message}`); skipped++; continue }
        uploaded++
        console.log(`✓ ${dest} (${(body.length / 1024).toFixed(0)} KB)`)
      }
    }
  }
  console.log(`\n${uploaded} uploaded, ${skipped} failed`)
}

main().catch(err => { console.error(err); process.exit(1) })
