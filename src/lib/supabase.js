import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function getChildrenByFamilyCode(familyCode) {
  console.log('[getChildren] familyCode:', familyCode)

  const { data: parent, error: parentError } = await supabase
    .from('parents')
    .select('id')
    .eq('family_code', familyCode)
    .single()

  console.log('[getChildren] parent:', parent, 'error:', parentError)

  if (parentError || !parent) return []

  const { data: children, error: childError } = await supabase
    .from('children')
    .select('*')
    .eq('parent_id', parent.id)

  console.log('[getChildren] children:', children, 'error:', childError)

  return children || []
}
