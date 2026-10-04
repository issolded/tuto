// "Tuto'ya Sor" — the parent's conversation with Tuto, inside the app.
//
// The same Tuto the parent talks to on Telegram or WhatsApp — the server answers through the same
// handleMessage and remembers the shared conversation — but this tab is only for ASKING, and only
// about three things (user decision, 2026-10-04): the children's progress, screen time and gems.
// Tuto never starts anything here: no notifications, no approvals. So the screen shows only the
// questions asked in it and their answers, kept on this device; the server holds the scope (it
// offers the model only the tools for those three topics).
//
// The entry gate lives on the server and covers this channel too; when it refuses, its reply is
// shown like any other — it is Tuto speaking, in the parent's language.
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useT, useUiLang } from '../lib/parentI18n'
import { localeFor } from '../lib/i18n'
import { PC, FONT, TEXT, SPACE, RADIUS, PCSS, TopBar } from '../lib/parentUI'
import ParentNav from '../components/ParentNav'

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'
const MAX = 1000

const KEEP = 60
const historyKey = (uid) => `tuto_ask_v1:${uid}`
function readHistory(uid) {
  try { const v = JSON.parse(localStorage.getItem(historyKey(uid)) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
function writeHistory(uid, list) {
  try { localStorage.setItem(historyKey(uid), JSON.stringify(list.slice(-KEEP).map(m => ({ role: m.role, text: m.text, at: m.at })))) } catch { /* the chat still works, it just will not be here next time */ }
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' }
}

// The model writes for Telegram, where *bold* is markup. Render just that and line breaks;
// everything else stays text (React escapes it), so nothing in a reply can become HTML.
function Rich({ text }) {
  return String(text).split('\n').map((line, i) => (
    <span key={i}>
      {i > 0 && <br />}
      {line.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g).map((part, j) => {
        const m = /^\*\*?([^*]+)\*\*?$/.exec(part)
        return m && part.length > 2 ? <strong key={j}>{m[1]}</strong> : <span key={j}>{part}</span>
      })}
    </span>
  ))
}

export default function ParentTuto() {
  const s = useT()
  const lang = useUiLang()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [messages, setMessages] = useState([]) // { role, text, at, photos? }
  const [uid, setUid] = useState('')
  const [children, setChildren] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [draft, setDraft] = useState(params.get('ask') || '')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const endRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'pcss-tuto'
    el.textContent = PCSS
    if (!document.getElementById('pcss-tuto')) document.head.appendChild(el)
    return () => { document.getElementById('pcss-tuto')?.remove() }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return nav('/parent/login')
        const kids = await supabase.from('children').select('id, name').eq('parent_id', user.id).order('created_at')
        if (!alive) return
        setUid(user.id)
        setMessages(readHistory(user.id))
        setChildren(kids.data || [])
      } catch {
        if (alive) setLoadError(true)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [nav])

  // Kept on this device (photo links expire within the hour, so they are not kept).
  useEffect(() => { if (uid) writeHistory(uid, messages) }, [uid, messages])

  // Newest at the bottom, like every chat; follow it as it grows.
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages.length, sending, loading])

  const send = async (raw) => {
    const text = String(raw ?? draft).trim()
    if (!text || sending) return
    setSendError('')
    setSending(true)
    setDraft('')
    const at = new Date().toISOString()
    setMessages(m => [...m, { role: 'parent', text, at }])
    try {
      const r = await fetch(`${SERVER}/api/parent/chat`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ text }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error || String(r.status))
      const now = new Date().toISOString()
      const replies = (j.replies || []).map((t, i) => ({ role: 'tuto', text: t, at: now, photos: i === (j.replies.length - 1) ? j.photos : undefined }))
      // Photos with no words (a resend that the model did not caption) still need a bubble.
      if (!replies.length && j.photos?.length) replies.push({ role: 'tuto', text: '', at: now, photos: j.photos })
      setMessages(m => [...m, ...replies])
    } catch {
      // Keep what they wrote: take the bubble back and put the words in the box again.
      setMessages(m => m.filter(x => !(x.role === 'parent' && x.at === at && x.text === text)))
      setDraft(text)
      setSendError(s('tt_error'))
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const time = (iso) => { try { return new Date(iso).toLocaleTimeString(localeFor(lang), { hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
  const day = (iso) => { try { return new Date(iso).toLocaleDateString(localeFor(lang), { weekday: 'long', day: 'numeric', month: 'long' }) } catch { return '' } }

  // One question per topic the tab is for: progress, what is hard, screen time, gems.
  const first = children[0]
  const suggestions = first ? [
    ...children.slice(0, 3).map(c => s('tt_q_week', { name: c.name })),
    s('tt_q_hard', { name: first.name }),
    s('tt_q_screen', { name: first.name }),
    s('tt_q_gems', { name: first.name }),
  ] : []

  return (
    <div className="tc-col" style={{ background: PC.bg, minHeight: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      <TopBar title={s('nav_tuto')} sub={s('tt_sub')} />

      {/* Room at the bottom for the composer (≈64) and the tab bar (≈69) under it. */}
      <div className="tc-scroll" style={{ flex: 1, paddingInline: SPACE.s4, paddingBottom: 'calc(150px + env(safe-area-inset-bottom, 0px))' }}>
        {loading && <div style={{ ...TEXT.body, color: PC.inkFaint, textAlign: 'center', padding: SPACE.s6 }}>{s('loading')}</div>}
        {loadError && !loading && <div role="alert" style={{ ...TEXT.body, color: PC.danger, textAlign: 'center', padding: SPACE.s6 }}>{s('tt_load_error')}</div>}

        {!loading && !loadError && !messages.length && (
          <div style={{ textAlign: 'center', padding: `${SPACE.s6}px ${SPACE.s4}px ${SPACE.s3}px` }}>
            <div aria-hidden="true" style={{ fontSize: 40 }}>💬</div>
            <div style={{ ...TEXT.body, color: PC.inkSoft, marginTop: SPACE.s2 }}>{s('tt_empty')}</div>
          </div>
        )}

        {messages.map((m, i) => {
          const mine = m.role === 'parent'
          const newDay = i === 0 || new Date(messages[i - 1].at).toDateString() !== new Date(m.at).toDateString()
          return (
            <div key={i}>
              {newDay && <div style={{ ...TEXT.caption, color: PC.inkFaint, textAlign: 'center', margin: `${SPACE.s4}px 0 ${SPACE.s2}px` }}>{day(m.at)}</div>}
              <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginTop: SPACE.s2 }}>
                <div style={{
                  maxWidth: '82%', padding: `${SPACE.s2 + 2}px ${SPACE.s3}px`, borderRadius: 18,
                  borderBottomRightRadius: mine ? 6 : 18, borderBottomLeftRadius: mine ? 18 : 6,
                  background: mine ? PC.tealInk : PC.card, color: mine ? '#fff' : PC.ink,
                  boxShadow: mine ? 'none' : '0 4px 12px -8px rgba(40,55,75,.35)',
                  ...TEXT.body, fontWeight: 600, lineHeight: '21px', overflowWrap: 'anywhere',
                }}>
                  {m.text && <Rich text={m.text} />}
                  {m.photos?.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: m.photos.length > 1 ? '1fr 1fr' : '1fr', gap: 6, marginTop: m.text ? SPACE.s2 : 0 }}>
                      {m.photos.map(u => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={{ width: '100%', borderRadius: 12, display: 'block' }} /></a>)}
                    </div>
                  )}
                  <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 4, textAlign: 'right', color: mine ? 'rgba(255,255,255,.75)' : PC.inkFaint }}>{time(m.at)}</div>
                </div>
              </div>
            </div>
          )
        })}

        {sending && (
          <div role="status" style={{ display: 'flex', marginTop: SPACE.s2 }}>
            <div style={{ padding: `${SPACE.s2 + 2}px ${SPACE.s3}px`, borderRadius: 18, borderBottomLeftRadius: 6, background: PC.card, ...TEXT.bodySm, color: PC.inkSoft, fontWeight: 700 }}>
              {s('tt_typing')}
            </div>
          </div>
        )}

        {!loading && !loadError && !sending && suggestions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.s2, marginTop: SPACE.s4 }}>
            {suggestions.map(q => (
              <button key={q} className="tc-press tc-tap" onClick={() => send(q)}
                style={{ border: `1.5px solid ${PC.line}`, background: '#fff', color: PC.tealInk, borderRadius: RADIUS.pill, padding: '8px 13px', fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                {q}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer: fixed, sitting on the tab bar, the column's width. */}
      <form className="tc-pnav" onSubmit={e => { e.preventDefault(); send() }}
        style={{
          position: 'fixed', left: 0, right: 0, margin: '0 auto', zIndex: 99,
          bottom: 'calc(69px + env(safe-area-inset-bottom, 0px))',
          background: PC.bg, padding: `${SPACE.s2}px ${SPACE.s3}px`, borderTop: `1px solid ${PC.line}`,
        }}>
        {sendError && <div role="alert" style={{ ...TEXT.caption, color: PC.danger, marginBottom: 6 }}>{sendError}</div>}
        <div style={{ display: 'flex', gap: SPACE.s2, alignItems: 'flex-end' }}>
          <textarea ref={inputRef} value={draft} maxLength={MAX} rows={1} placeholder={s('tt_placeholder')} aria-label={s('tt_placeholder')}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            style={{
              flex: 1, minWidth: 0, resize: 'none', maxHeight: 120, border: `1.5px solid ${PC.line}`, borderRadius: 20,
              padding: '11px 14px', fontFamily: FONT, fontSize: 15, fontWeight: 600, color: PC.ink, background: '#fff', outline: 'none',
            }} />
          <button type="submit" disabled={!draft.trim() || sending} aria-label={s('tt_send')}
            style={{
              width: 44, height: 44, flex: 'none', borderRadius: 999, border: 'none', fontSize: 18,
              background: draft.trim() && !sending ? PC.tealInk : PC.line, color: '#fff', cursor: draft.trim() && !sending ? 'pointer' : 'default',
            }}>➤</button>
        </div>
      </form>

      <ParentNav active="tuto" />
    </div>
  )
}
