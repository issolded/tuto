import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function getChildrenByFamilyCode(familyCode) {
  const { data: parent, error } = await supabase
    .from('parents')
    .select('id')
    .eq('family_code', familyCode)
    .single()

  if (error || !parent) return null

  const { data: children } = await supabase
    .from('children')
    .select('*')
    .eq('parent_id', parent.id)

  return children
}
