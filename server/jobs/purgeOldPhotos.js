// Photo retention. A homework/chore photo exists to get one parent decision —
// after that it's just a picture of a child's notebook or bedroom sitting in
// storage. This deletes the image bytes once they're past the retention window
// and clears the row's photo fields so the UI stops trying to render them.
// The submission row itself (gems, status, history) is kept.
//
// Run manually:  node jobs/purgeOldPhotos.js
// Also runs daily from index.js.
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const PHOTO_BUCKET = 'submission-photos'
const LEGACY_BUCKET = 'submissions'
const DEFAULT_RETENTION_DAYS = Number(process.env.PHOTO_RETENTION_DAYS || 60)

// Legacy rows stored a full public URL; new rows store a private-bucket path.
function legacyPathFrom(url) {
  const marker = `/storage/v1/object/public/${LEGACY_BUCKET}/`
  const i = String(url || '').indexOf(marker)
  return i === -1 ? null : decodeURIComponent(String(url).slice(i + marker.length))
}

export async function purgeOldPhotos({ days = DEFAULT_RETENTION_DAYS } = {}) {
  const cutoff = DateTime.utc().minus({ days }).toISO()

  const { data: rows, error } = await supabase
    .from('submissions')
    .select('id, photo_urls, media_url')
    .in('task_type', ['homework', 'chore'])
    .lt('created_at', cutoff)

  if (error) {
    console.error(`[PURGE] lookup failed: ${error.message}`)
    return { rows: 0, files: 0 }
  }

  const withPhotos = (rows || []).filter(r => r.photo_urls?.length || r.media_url)
  if (!withPhotos.length) {
    console.log(`[PURGE] nothing older than ${days} days still holding photos`)
    return { rows: 0, files: 0 }
  }

  let files = 0
  for (const row of withPhotos) {
    const stored = [...(row.photo_urls || []), row.media_url].filter(Boolean)
    const privatePaths = []
    const legacyPaths = []
    for (const v of stored) {
      if (/^https?:\/\//i.test(v)) {
        const p = legacyPathFrom(v)
        if (p) legacyPaths.push(p)
      } else {
        privatePaths.push(v)
      }
    }

    if (privatePaths.length) {
      const { error: e } = await supabase.storage.from(PHOTO_BUCKET).remove([...new Set(privatePaths)])
      if (e) console.error(`[PURGE] ${row.id} private remove failed: ${e.message}`)
      else files += new Set(privatePaths).size
    }
    if (legacyPaths.length) {
      const { error: e } = await supabase.storage.from(LEGACY_BUCKET).remove([...new Set(legacyPaths)])
      if (e) console.error(`[PURGE] ${row.id} legacy remove failed: ${e.message}`)
      else files += new Set(legacyPaths).size
    }

    // Clear the pointers only after the bytes are gone, so a failed delete is
    // retried on the next run instead of being silently orphaned.
    const { error: uErr } = await supabase
      .from('submissions').update({ photo_urls: [], media_url: null }).eq('id', row.id)
    if (uErr) console.error(`[PURGE] ${row.id} clear fields failed: ${uErr.message}`)
  }

  console.log(`[PURGE] cleared photos from ${withPhotos.length} submissions (${files} files, older than ${days} days)`)
  return { rows: withPhotos.length, files }
}

// Direct invocation: node jobs/purgeOldPhotos.js
if (process.argv[1] && process.argv[1].endsWith('purgeOldPhotos.js')) {
  purgeOldPhotos()
    .then(r => { console.log('done', r); process.exit(0) })
    .catch(err => { console.error(err); process.exit(1) })
}
