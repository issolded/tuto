import { supabase } from './supabase'

// Compare-and-swap the whole JSON object: another tab may have changed unrelated preferences.
// The signed-in parent's existing RLS policy also applies. Never writes Gem balances.
export async function updateParentPrefs(parentId, transform) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || user?.id !== parentId) throw new Error('auth')
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.from('parents').select('prefs').eq('id', parentId).single()
    if (error) throw error
    const next = transform(data.prefs || {})
    let query = supabase.from('parents').update({ prefs: next }).eq('id', parentId)
    query = data.prefs == null ? query.is('prefs', null) : query.eq('prefs', JSON.stringify(data.prefs))
    const { data: saved, error: saveError } = await query.select('id')
    if (saveError) throw saveError
    if (saved?.length) return next
  }
  throw new Error('conflict')
}
