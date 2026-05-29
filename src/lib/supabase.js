import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'

export async function getChildrenByFamilyCode(familyCode) {
  console.log('[getChildren] familyCode:', familyCode)
  try {
    const res = await fetch(`${SERVER}/api/family/${encodeURIComponent(familyCode)}/children`)
    const data = await res.json()
    console.log('[getChildren] children:', data.children)
    return data.children || []
  } catch (err) {
    console.error('[getChildren] error:', err.message)
    return []
  }
}
