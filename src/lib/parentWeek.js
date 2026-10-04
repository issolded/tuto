// One child's week, from the same endpoint the report draws — shared by the child page's
// "This week" card and the Children tab's per-child row, so both say the same thing.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'

export function useChildWeek(childId) {
  const [week, setWeek] = useState(null)
  useEffect(() => {
    if (!childId) return
    let alive = true
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const r = await fetch(`${SERVER}/api/parent/children/${encodeURIComponent(childId)}/week?offset=0`,
          { headers: { Authorization: `Bearer ${session?.access_token}` } })
        const j = await r.json()
        // Only a whole week: a card reading .totals of anything else would take the screen down.
        if (alive && r.ok && j?.totals && Array.isArray(j.days)) setWeek(j)
      } catch { /* the row stays quiet; the report itself shows the error */ }
    })()
    return () => { alive = false }
  }, [childId])
  return week
}
