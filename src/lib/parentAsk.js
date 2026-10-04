// The "Ask Tuto" questions, held outside the screen.
//
// The screen used to own the request: a parent who asked and switched tabs unmounted it, and the
// answer — produced on the server all the same — had nowhere to land; they had to ask again.
// This store lives for as long as the app is open, so a question asked on the Tuto tab keeps
// waiting for its answer while the parent is on Children or Screen time, and is there when they
// come back. With the parent_app_chat table on the server the answer also survives closing the
// app: the server writes it into the row and this store reads it back.
//
// Two modes, decided by the server:
//   server — POST answers 202 with the row; the answer is fetched by polling the history.
//   local  — the table is not there yet; POST answers inside the request, and the history is
//            kept on this device, as before.
import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from './supabase'

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'
const KEEP = 60
const POLL_MS = 2500

let state = { uid: '', mode: 'unknown', items: [], ready: false, error: false, unseen: 0 }
let viewers = 0
let pollTimer = null
let loading = null
let tmp = 0
const listeners = new Set()

function set(patch) {
  state = { ...state, ...patch }
  if (state.mode === 'local' && state.uid) writeLocal(state.uid, state.items)
  listeners.forEach(l => l())
}
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }

const localKey = (uid) => `tuto_ask_v2:${uid}`
function writeLocal(uid, items) {
  try {
    localStorage.setItem(localKey(uid), JSON.stringify(items.slice(-KEEP).map(i => ({ ...i, photos: [] }))))
  } catch { /* the chat still works, it just will not be here next time */ }
}
function readLocal(uid) {
  try {
    const v2 = JSON.parse(localStorage.getItem(localKey(uid)) || 'null')
    if (Array.isArray(v2)) return v2.map(i => (i.status === 'pending' ? { ...i, status: 'failed' } : i))
    // The first version kept bubbles, not questions: pair each parent line with the reply after it.
    const v1 = JSON.parse(localStorage.getItem(`tuto_ask_v1:${uid}`) || '[]')
    const items = []
    for (const m of Array.isArray(v1) ? v1 : []) {
      if (m.role === 'parent') items.push({ id: `v1-${items.length}`, question: m.text, answer: '', photos: [], status: 'failed', at: m.at })
      else if (items.length && !items[items.length - 1].answer) Object.assign(items[items.length - 1], { answer: m.text, status: 'answered', answeredAt: m.at })
    }
    return items
  } catch { return [] }
}

async function headers() {
  const { data: { session } } = await supabase.auth.getSession()
  return { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' }
}

async function fetchHistory() {
  const r = await fetch(`${SERVER}/api/parent/chat`, { headers: await headers() })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}

// Answers that land while nobody is looking at the tab are counted, so the tab can show a dot.
function mergeServer(items) {
  const before = new Map(state.items.map(i => [i.id, i]))
  let landed = 0
  for (const i of items) if (before.get(i.id)?.status === 'pending' && i.status === 'answered') landed++
  // Questions sent but not yet acknowledged by the server stay at the end.
  const sending = state.items.filter(i => String(i.id).startsWith('tmp-'))
  set({ items: [...items, ...sending], unseen: state.unseen + (viewers ? 0 : landed) })
}

function schedulePoll() {
  clearTimeout(pollTimer)
  if (state.mode !== 'server' || !state.items.some(i => i.status === 'pending')) return
  pollTimer = setTimeout(async () => {
    try { const j = await fetchHistory(); if (j.available) mergeServer(j.items || []) } catch { /* next round */ }
    schedulePoll()
  }, POLL_MS)
}

export async function loadAsk() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  if (state.uid && state.uid !== user.id) {
    clearTimeout(pollTimer)
    state = { uid: '', mode: 'unknown', items: [], ready: false, error: false, unseen: 0 }
  }
  if (loading) return loading
  loading = (async () => {
    try {
      const j = await fetchHistory()
      if (j.available) { set({ uid: user.id, mode: 'server', ready: true, error: false }); mergeServer(j.items || []) }
      else set({ uid: user.id, mode: 'local', items: readLocal(user.id), ready: true, error: false })
      schedulePoll()
    } catch {
      // Unreachable server: show what this device remembers rather than nothing.
      set({ uid: user.id, mode: state.mode === 'unknown' ? 'local' : state.mode, items: state.items.length ? state.items : readLocal(user.id), ready: true, error: true })
    } finally {
      loading = null
    }
  })()
  return loading
}

export async function askTuto(question) {
  const text = String(question || '').trim()
  if (!text) return
  const id = `tmp-${++tmp}`
  const at = new Date().toISOString()
  set({ items: [...state.items, { id, question: text, answer: '', photos: [], status: 'pending', at }] })
  const replace = (fn) => set({ items: state.items.map(i => (i.id === id ? fn(i) : i)) })
  try {
    const r = await fetch(`${SERVER}/api/parent/chat`, { method: 'POST', headers: await headers(), body: JSON.stringify({ text }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j?.error || String(r.status))
    if (r.status === 202 && j.item) {
      if (state.mode !== 'server') set({ mode: 'server' })
      // A poll may already have brought the row in; then the placeholder just goes.
      if (state.items.some(i => i.id === j.item.id)) set({ items: state.items.filter(i => i.id !== id) })
      else replace(() => j.item)
      schedulePoll()
    } else {
      // Answered inside the request (no table on the server yet).
      if (state.mode === 'unknown') set({ mode: 'local' })
      const landed = viewers ? 0 : 1
      replace(i => ({ ...i, id: `l-${Date.now()}-${tmp}`, answer: (j.replies || []).join('\n\n'), photos: j.photos || [], status: 'answered', answeredAt: new Date().toISOString() }))
      set({ unseen: state.unseen + landed })
    }
  } catch {
    replace(i => ({ ...i, status: 'failed' }))
  }
}

// The screen counts itself in, so answers that land while it is open are not "unseen".
export function useAskScreen() {
  const snap = useSyncExternalStore(subscribe, () => state)
  useEffect(() => {
    viewers++
    if (state.unseen) set({ unseen: 0 })
    loadAsk()
    return () => { viewers-- }
  }, [])
  return snap
}

export function useAskUnseen() {
  return useSyncExternalStore(subscribe, () => state.unseen)
}
