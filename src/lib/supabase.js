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

export async function saveSpellingErrors(childId, errors) {
  try {
    await fetch(`${SERVER}/api/children/${encodeURIComponent(childId)}/spelling-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ errors }),
    })
  } catch {}
}
