import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '../lib/i18n'
import { draftKey, saveDraft } from '../lib/storyDrafts'
const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'

export default function StoryWriter({ child, story, language, onExit, onReview }) {
  const [draft, setDraft] = useState(() => ({
    id: story?.id || crypto.randomUUID(), title: story?.title || '',
    text: story?.corrected_text ?? story?.transcribed_text ?? '',
    revision: story?.revision || 0, persisted: !!story && !story.local_only, dirty: false, cursor: 0
  }))
  const current = useRef(draft)
  const [state, setState] = useState(story ? 'loading' : 'ready')
  const [working, setWorking] = useState(false)
  const [localOk, setLocalOk] = useState(true)
  const area = useRef(null)
  const busy = useRef(null)
  const blocked = useRef(false)
  const mounted = useRef(true)
  const s = key => t(key, language)
  const publish = useCallback(value => { current.current = value; if (mounted.current) setDraft(value) }, [])
  const stash = useCallback(value => {
    try {
      localStorage.setItem(draftKey(child.id, value.id), JSON.stringify({ ...value, savedAt: new Date().toISOString() }))
      if (mounted.current) setLocalOk(true)
      return true
    } catch { if (mounted.current) setLocalOk(false); return false }
  }, [child.id])
  const show = useCallback(value => { if (mounted.current) setState(value) }, [])
  const flush = useCallback(async () => {
    if (busy.current) { await busy.current; if (blocked.current) return false; }
    if (blocked.current) return false
    if (!current.current.dirty) return true
    if (!current.current.text.trim() && !current.current.persisted) return false
    const sent = { ...current.current }
    show('saving')
    const task = (async () => {
      try {
        const saved = await saveDraft(child.id, sent)
        const latest = current.current
        const value = { ...latest, persisted: true, revision: saved.revision,
          dirty: latest.text !== sent.text || latest.title !== sent.title }
        publish(value); stash(value)
        show(value.dirty ? 'ready' : 'saved')
        return true
      } catch (error) {
        if (error.status === 409) { blocked.current = true; show('conflict') }
        else show('offline')
        return false
      }
    })()
    busy.current = task
    try { return await task } finally { if (busy.current === task) busy.current = null }
  }, [child.id, publish, show, stash])
  useEffect(() => {
    mounted.current = true
    let cancelled = false
    const initialise = async () => {
      let local
      try { local = JSON.parse(localStorage.getItem(draftKey(child.id, current.current.id))) } catch { /* no local copy */ }
      let remote = story
      if (story && !story.local_only) {
        try {
          const response = await fetch(SERVER + '/api/children/' + encodeURIComponent(child.id) + '/stories', { signal: AbortSignal.timeout(15000) })
          if (!response.ok) throw Error('read_failed')
          const data = await response.json()
          remote = data.stories?.find(row => row.id === story.id)
          if (!remote) { blocked.current = true; if (!cancelled) show('conflict'); return }
        } catch {
          // Without a fresh revision a local copy may be edited, but must not overwrite the server.
          if (!local) { if (!cancelled) show('load_error'); return }
          remote = story
        }
      }
      if (cancelled) return
      const base = remote ? { id: remote.id, title: remote.title || '',
        text: remote.corrected_text ?? remote.transcribed_text ?? '', revision: remote.revision || 0,
        persisted: !remote.local_only, dirty: false, cursor: local?.cursor || 0 } : current.current
      const value = local?.dirty ? local : base
      if (remote?.status === 'completed' || (local?.dirty && !remote?.local_only && remote
        && local.revision !== remote.revision && (local.text !== base.text || local.title !== base.title))) {
        blocked.current = true; publish(value); show('conflict'); return
      }
      if (remote && local?.dirty && local.text === base.text && local.title === base.title) {
        value.revision = base.revision; value.dirty = false
      }
      publish(value); stash(value); show(value.dirty || !remote ? 'ready' : 'saved')
      requestAnimationFrame(() => {
        area.current?.focus()
        area.current?.setSelectionRange(value.cursor || 0, value.cursor || 0)
        if (area.current) area.current.scrollTop = value.scroll || 0
      })
    }
    initialise()
    return () => { cancelled = true; mounted.current = false }
  }, [child.id, story, publish, show, stash])
  const loading = state === 'loading' || state === 'load_error'
  useEffect(() => {
    if (!draft.dirty || blocked.current || loading) return
    const timer = setTimeout(() => { flush() }, 1500)
    return () => clearTimeout(timer)
  }, [draft.text, draft.title, draft.revision, draft.dirty, loading, flush])
  useEffect(() => {
    const online = () => flush()
    const hide = () => { if (document.visibilityState === 'hidden') { stash(current.current); flush() } }
    const unload = event => {
      if (current.current.dirty) { stash(current.current); event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('online', online)
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('beforeunload', unload)
    return () => {
      window.removeEventListener('online', online)
      document.removeEventListener('visibilitychange', hide)
      window.removeEventListener('beforeunload', unload)
    }
  }, [flush, stash])
  const change = patch => {
    const value = { ...current.current, ...patch, dirty: true }
    publish(value); stash(value)
    if (!blocked.current) show('ready')
  }
  const rememberPosition = () => {
    if (!area.current) return
    current.current = { ...current.current, cursor: area.current.selectionStart, scroll: area.current.scrollTop }
    stash(current.current)
  }
  const leave = async () => {
    setWorking(true)
    const saved = await flush()
    if (saved || stash(current.current)) onExit()
    else { show('offline'); setWorking(false) }
  }
  const finish = async () => {
    setWorking(true)
    // Inputs are disabled while finishing; a prior in-flight save may contain older text.
    let saved = await flush()
    if (saved && current.current.dirty) saved = await flush()
    if (saved && !current.current.dirty) {
      try {
        await onReview({ id: current.current.id, title: current.current.title,
          transcribed_text: current.current.text, corrected_text: current.current.text,
          revision: current.current.revision, writing_source: 'typed', status: 'in_progress' })
      } catch (error) {
        if (error.status === 409) { blocked.current = true; show('conflict') }
        else show('review_error')
      }
    }
    if (mounted.current) setWorking(false)
  }
  const copy = () => {
    const old = current.current.id
    const value = { ...current.current, id: crypto.randomUUID(), revision: 0, persisted: false, dirty: true }
    if (!stash(value)) return
    localStorage.removeItem(draftKey(child.id, old))
    blocked.current = false; publish(value); show('ready')
    flush()
  }
  const statusKeys = { loading: 'sw_loading', load_error: 'sw_load_error', ready: 'sw_ready', saving: 'sw_saving', saved: 'sw_saved', offline: 'sw_offline', conflict: 'sw_conflict', review_error: 'sw_review_error' }
  const locked = working || state === 'loading' || state === 'load_error'
  const button = { border: 0, borderRadius: 16, padding: '14px 18px', font: 'inherit', fontWeight: 800, cursor: 'pointer' }
  return <main style={{ maxWidth: 800, margin: '0 auto', padding: '28px 20px 100px', minHeight: '100vh', background: '#E8F5E9', color: '#244631', boxSizing: 'border-box' }}>
    <button style={{ ...button, background: 'white' }} disabled={working} onClick={leave}>{s('sw_exit')}</button>
    <h1 style={{ fontSize: 26 }}>{s('sw_heading')}</h1>
    <p role="status" aria-live="polite">{s(localOk ? statusKeys[state] : 'sw_storage_error')}</p>
    {state === 'conflict' && <div role="alert" style={{ padding: 16, background: '#fff3cd', borderRadius: 16 }}>
      <p>{s('sw_conflict_detail')}</p>
      <button style={button} disabled={working} onClick={copy}>{s('sw_copy')}</button>
    </div>}
    {state === 'load_error' && <button style={button} onClick={() => window.location.reload()}>{s('sw_retry')}</button>}
    <label style={{ display: 'block', marginTop: 20 }}>{s('sw_title')}
      <input value={draft.title} maxLength={200} disabled={locked} onChange={e => change({ title: e.target.value })}
        placeholder={s('sw_untitled')} style={{ width: '100%', boxSizing: 'border-box', padding: 14, font: 'inherit', fontSize: 20, border: '2px solid #A5D6A7', borderRadius: 14, margin: '8px 0 20px' }} />
    </label>
    <label style={{ display: 'block' }}>{s('sw_text')}
      <textarea ref={area} value={draft.text} maxLength={50000} disabled={locked} spellCheck
        onChange={e => change({ text: e.target.value, cursor: e.target.selectionStart })}
        onSelect={rememberPosition} onScroll={rememberPosition} placeholder={s('sw_placeholder')}
        style={{ display: 'block', width: '100%', boxSizing: 'border-box', minHeight: '45vh', padding: 18,
          fontFamily: 'Nunito, sans-serif', fontSize: Number(child.age) <= 8 ? 22 : 19, lineHeight: 1.7,
          resize: 'vertical', border: '2px solid #A5D6A7', borderRadius: 18, marginTop: 8 }} />
    </label>
    <p style={{ fontSize: 13 }}>{draft.text.length.toLocaleString()} / 50,000</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 20 }}>
      <button style={{ ...button, background: 'white' }} disabled={locked || state === 'conflict'} onClick={() => flush()}>{s('sw_retry_save')}</button>
      <button style={{ ...button, background: '#19845D', color: 'white', opacity: locked || !draft.text.trim() || state === 'conflict' ? 0.55 : 1 }}
        disabled={locked || !draft.text.trim() || state === 'conflict'} onClick={finish}>{s(working ? 'sw_reviewing' : 'sw_finish')}</button>
    </div>
  </main>
}
