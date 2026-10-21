import { useSyncExternalStore } from 'react'

// The English sitting's recordings: fetched ahead, played one after another, with how far along they are.
//
// Ahead: a question's clips are fetched as soon as the question arrives (and the next question's while the child
// looks at the mark), kept as blob URLs, so a tap plays at once instead of waiting on Storage for a few seconds.
// One element: iOS lets a page play sound only from a tap, and only on an element a tap has started. Later clips
// of the same listen (the talk, then its question) are played by swapping the source of that same element.
// Progress: 0..1 across all the clips of one listen, by their lengths once known, so the ring fills evenly.

const ready = new Map()        // remote url -> blob url
const loading = new Map()      // remote url -> promise
const lengths = new Map()      // remote url -> seconds

let el = null
const audio = () => (el ||= new Audio())

let state = { key: null, progress: 0 }
const listeners = new Set()
const emit = () => listeners.forEach(f => f())
const set = (next) => { state = next; emit() }
const now = { token: 0, list: [], i: 0 }

function measure(url, src) {
  const a = new Audio()
  a.preload = 'metadata'
  a.onloadedmetadata = () => { if (Number.isFinite(a.duration)) lengths.set(url, a.duration) }
  a.src = src
}

export function preload(urls) {
  for (const url of [].concat(urls || []).filter(Boolean)) {
    if (loading.has(url)) continue
    loading.set(url, fetch(url)
      .then(r => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then(b => { const local = URL.createObjectURL(b); ready.set(url, local); measure(url, local) })
      .catch(() => { loading.delete(url) }))     // not fetched: played from the address, as before
  }
}

// Every recording an item can play: the listen itself, the sound check, the options, the answers' explanations.
export function itemAudio(item) {
  if (!item) return []
  const p = item.prompt || {}
  return [...[].concat(p.audio || []), p.instruction_audio, ...item.questions.flatMap(q => (q.options || []).map(o => o.audio))].filter(Boolean)
}

function progress() {
  const a = audio()
  const { list, i } = now
  const len = list.map(u => lengths.get(u))
  if (Number.isFinite(a.duration) && a.duration > 0) len[i] = a.duration
  const cur = len[i] ? Math.min(1, a.currentTime / len[i]) : 0
  if (len.some(x => !x)) return (i + cur) / list.length
  const total = len.reduce((s, x) => s + x, 0)
  return (len.slice(0, i).reduce((s, x) => s + x, 0) + a.currentTime) / total
}

function tick(token) {
  requestAnimationFrame(() => {
    if (token !== now.token || !state.key) return
    const p = progress()
    if (Math.abs(p - state.progress) > 0.004) set({ ...state, progress: p })
    tick(token)
  })
}

// `key` names what is playing, so the button that started it can show its ring.
export function play(urls, key = 'sound') {
  const list = [].concat(urls || []).filter(Boolean)
  if (!list.length) return
  const a = audio()
  a.pause()
  const token = ++now.token
  now.list = list
  const end = () => { if (token === now.token) set({ key: null, progress: 0 }) }
  const step = (i) => {
    if (token !== now.token) return
    if (i >= list.length) { end(); return }
    now.i = i
    a.onended = () => step(i + 1)
    a.onerror = end
    a.src = ready.get(list[i]) || list[i]
    a.play().catch(end)
  }
  set({ key, progress: 0 })
  step(0)
  tick(token)
}

export function stop() {
  now.token++
  el?.pause()
  if (state.key) set({ key: null, progress: 0 })
}

const subscribe = (f) => { listeners.add(f); return () => listeners.delete(f) }
export const usePlayer = () => useSyncExternalStore(subscribe, () => state)
