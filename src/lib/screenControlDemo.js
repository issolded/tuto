import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { newDemo, demoAction, readRules } from './screenControl'

const memory = new Map()
const listeners = new Set()
const demoKey = id => `tuto_screen_demo_v1:${id}`
const rulesKey = id => `tuto_screen_rules_v1:${id}`
function read(key) { try { return localStorage.getItem(key) || memory.get(key) || null } catch { return memory.get(key) || null } }
function write(key, value) {
  const raw = JSON.stringify(value)
  memory.set(key, raw)
  try { localStorage.setItem(key, raw) } catch { /* Session memory still allows a demo. */ }
  for (const notify of listeners) notify()
}
function subscribe(notify) {
  listeners.add(notify)
  window.addEventListener('storage', notify)
  return () => { listeners.delete(notify); window.removeEventListener('storage', notify) }
}
export function cacheDemoRules(childId, rules) { write(rulesKey(childId), rules) }
export function useCachedDemoRules(childId) {
  const raw = useSyncExternalStore(subscribe, () => read(rulesKey(childId)), () => null)
  return useMemo(() => {
    try { return { rules: readRules(JSON.parse(raw)), configured: !!raw } }
    catch { return { rules: readRules(), configured: false } }
  }, [raw])
}
function parseDemo(raw) {
  try {
    const d = JSON.parse(raw)
    if (d && Number.isFinite(d.now) && ['used','earned','bonus','gems'].every(k => Number.isFinite(d[k]) && d[k] >= 0) && Array.isArray(d.history)) return d
  } catch { /* Discard broken preview data. */ }
  return newDemo()
}
export function useScreenDemo(childId, rules, ticking = false) {
  const key = demoKey(childId)
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null)
  const demo = useMemo(() => parseDemo(raw), [raw])
  const act = action => write(key, demoAction(rules, parseDemo(read(key)), action))
  useEffect(() => {
    if (!ticking) return
    // Only the visible interactive view advances this simulated clock.
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      const d = parseDemo(read(key))
      if (d.running && Date.now() - (d.lastTick || 0) >= 900) write(key, { ...demoAction(rules, d, { type: 'tick', seconds: 1 }), lastTick: Date.now() })
    }, 1000)
    return () => clearInterval(timer)
  }, [key, rules, ticking])
  return [demo, act]
}
