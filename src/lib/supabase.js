import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'

export async function getChildrenByFamilyCode(familyCode) {
  try {
    const res = await fetch(`${SERVER}/api/family/${encodeURIComponent(familyCode)}/children`)
    const data = await res.json()
    return data.children || []
  } catch (err) {
    console.error('[getChildren] error:', err.message)
    return []
  }
}

export async function getChildRewards(childId) {
  try {
    const res = await fetch(`${SERVER}/api/children/${encodeURIComponent(childId)}/rewards`)
    const data = await res.json()
    return data.rewards || []
  } catch (err) {
    console.error('[getChildRewards] error:', err.message)
    return []
  }
}

export async function getChildGems(childId) {
  try {
    const res = await fetch(`${SERVER}/api/children/${encodeURIComponent(childId)}/gems`)
    const data = await res.json()
    return data.gems ?? 0
  } catch (err) {
    console.error('[getChildGems] error:', err.message)
    return 0
  }
}

export async function getStoryIdeas(childId) {
  try {
    const res = await fetch(`${SERVER}/api/children/${encodeURIComponent(childId)}/story-ideas`)
    const data = await res.json()
    return data.ideas || []
  } catch {
    return []
  }
}

export async function getChildStories(childId) {
  try {
    const res = await fetch(`${SERVER}/api/children/${encodeURIComponent(childId)}/stories`)
    const data = await res.json()
    return data.stories || []
  } catch (err) {
    console.error('[getChildStories] error:', err.message)
    return []
  }
}

export async function saveChildStory(childId, storyData) {
  const res = await fetch(`${SERVER}/api/children/${encodeURIComponent(childId)}/stories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(storyData),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || `Server error ${res.status}`)
  return data
}

export async function deleteChildStory(childId, storyId) {
  const res = await fetch(`${SERVER}/api/children/${encodeURIComponent(childId)}/stories/${encodeURIComponent(storyId)}`, {
    method: 'DELETE',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || `Server error ${res.status}`)
  return data
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function uploadStoryCover(childId, file) {
  const imageBase64 = await fileToBase64(file)
  const res = await fetch(`${SERVER}/api/children/${encodeURIComponent(childId)}/stories/cover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType: file.type || 'image/jpeg' }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || `Server error ${res.status}`)
  return data.cover_url
}

// Uploads homework photos (1..15) DIRECTLY to Storage from the client (same
// pattern as chore's uploadPhoto), then sends only the storage PATHS to the
// backend. This keeps the JSON body tiny (15 photos as base64 would blow past
// the server's body limit) AND leaves the original bytes — with EXIF intact —
// on the server side to read. The server still does EXIF/Gemini/screening/gems
// and writes the PENDING submission; no gem math here by design.
export async function submitHomework(childId, files) {
  const cid = childId || 'anonymous'
  const paths = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const ext = (file.type || '').includes('png') ? 'png' : 'jpg'
    const path = `${cid}/homework/${Date.now()}-${i}.${ext}`
    const { error } = await supabase.storage
      .from('submissions')
      .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })
    if (error) throw error
    paths.push(path)
  }

  const res = await fetch(`${SERVER}/api/children/${encodeURIComponent(childId)}/homework`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || `Server error ${res.status}`)
  return data
}

export async function saveSpellingErrors(childId, errors) {
  try {
    await fetch(`${SERVER}/api/children/${encodeURIComponent(childId)}/spelling-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ errors }),
    })
  } catch {}
}
