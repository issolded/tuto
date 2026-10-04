// "Tuto'ya Sor" — the parent's conversation with Tuto, inside the app.
//
// The same Tuto the parent talks to on Telegram or WhatsApp — the server answers through the same
// handleMessage and remembers the shared conversation — but this tab is only for ASKING, and only
// about three things (user decision, 2026-10-04): the children's progress, screen time and gems.
// Tuto never starts anything here: no notifications, no approvals. So the screen shows only the
// questions asked in it and their answers; the server holds the scope (it offers the model only
// the tools for those three topics). The questions live in src/lib/parentAsk.js, not in this
// screen, so leaving the tab while Tuto is writing does not lose the answer.
//
// The entry gate lives on the server and covers this channel too; when it refuses, its reply is
// shown like any other — it is Tuto speaking, in the parent's language.
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useT, useUiLang } from '../lib/parentI18n'
import { useAskScreen, askTuto } from '../lib/parentAsk'
import { localeFor } from '../lib/i18n'
import { PC, FONT, TEXT, SPACE, RADIUS, PCSS, TopBar } from '../lib/parentUI'
import ParentNav from '../components/ParentNav'

const MAX = 1000

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

function Bubble({ mine, text, photos, at }) {
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginTop: SPACE.s2 }}>
      <div style={{
        maxWidth: '82%', padding: `${SPACE.s2 + 2}px ${SPACE.s3}px`, borderRadius: 18,
        borderBottomRightRadius: mine ? 6 : 18, borderBottomLeftRadius: mine ? 18 : 6,
        background: mine ? PC.tealInk : PC.card, color: mine ? '#fff' : PC.ink,
        boxShadow: mine ? 'none' : '0 4px 12px -8px rgba(40,55,75,.35)',
        ...TEXT.body, fontWeight: 600, lineHeight: '21px', overflowWrap: 'anywhere',
      }}>
        {text && <Rich text={text} />}
        {photos?.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: photos.length > 1 ? '1fr 1fr' : '1fr', gap: 6, marginTop: text ? SPACE.s2 : 0 }}>
            {photos.map(u => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={{ width: '100%', borderRadius: 12, display: 'block' }} /></a>)}
          </div>
        )}
        <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 4, textAlign: 'right', color: mine ? 'rgba(255,255,255,.75)' : PC.inkFaint }}>{at}</div>
      </div>
    </div>
  )
}

export default function ParentTuto() {
  const s = useT()
  const lang = useUiLang()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const ask = useAskScreen()
  const items = ask.items
  const [children, setChildren] = useState([])
  const [draft, setDraft] = useState(params.get('ask') || '')
  const loading = !ask.ready
  const waiting = items.some(i => i.status === 'pending')
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
        if (alive) setChildren(kids.data || [])
      } catch { /* the suggestions just do not appear */ }
    })()
    return () => { alive = false }
  }, [nav])

  // Newest at the bottom, like every chat; follow it as it grows and as answers land.
  const lastKey = items.length ? `${items.length}:${items[items.length - 1].status}` : '0'
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [lastKey, loading])

  // One question at a time: the next waits for the answer, the way a conversation does.
  const send = (raw) => {
    const text = String(raw ?? draft).trim()
    if (!text || waiting) return
    setDraft('')
    askTuto(text)
    inputRef.current?.focus()
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
        {ask.error && !loading && !items.length && <div role="alert" style={{ ...TEXT.body, color: PC.danger, textAlign: 'center', padding: SPACE.s6 }}>{s('tt_load_error')}</div>}

        {!loading && !items.length && !ask.error && (
          <div style={{ textAlign: 'center', padding: `${SPACE.s6}px ${SPACE.s4}px ${SPACE.s3}px` }}>
            <div aria-hidden="true" style={{ fontSize: 40 }}>💬</div>
            <div style={{ ...TEXT.body, color: PC.inkSoft, marginTop: SPACE.s2 }}>{s('tt_empty')}</div>
          </div>
        )}

        {items.map((it, i) => {
          const newDay = i === 0 || new Date(items[i - 1].at).toDateString() !== new Date(it.at).toDateString()
          return (
            <div key={it.id}>
              {newDay && <div style={{ ...TEXT.caption, color: PC.inkFaint, textAlign: 'center', margin: `${SPACE.s4}px 0 ${SPACE.s2}px` }}>{day(it.at)}</div>}
              <Bubble mine text={it.question} at={time(it.at)} />
              {it.status === 'answered' && (it.answer || it.photos?.length > 0) && <Bubble text={it.answer} photos={it.photos} at={time(it.answeredAt || it.at)} />}
              {it.status === 'pending' && (
                <div role="status" style={{ display: 'flex', marginTop: SPACE.s2 }}>
                  <div style={{ padding: `${SPACE.s2 + 2}px ${SPACE.s3}px`, borderRadius: 18, borderBottomLeftRadius: 6, background: PC.card, ...TEXT.bodySm, color: PC.inkSoft, fontWeight: 700 }}>
                    {s('tt_typing')}
                  </div>
                </div>
              )}
              {it.status === 'failed' && (
                <div role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: SPACE.s2, marginTop: 4 }}>
                  <span style={{ ...TEXT.caption, color: PC.danger }}>{s('tt_failed')}</span>
                  {i === items.length - 1 && !waiting && (
                    <button onClick={() => send(it.question)} className="tc-tap"
                      style={{ border: 'none', background: 'none', color: PC.tealInk, fontFamily: FONT, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', padding: 4 }}>
                      {s('tt_retry')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {!loading && !waiting && suggestions.length > 0 && (
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
        <div style={{ display: 'flex', gap: SPACE.s2, alignItems: 'flex-end' }}>
          <textarea ref={inputRef} value={draft} maxLength={MAX} rows={1} placeholder={s('tt_placeholder')} aria-label={s('tt_placeholder')}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            style={{
              flex: 1, minWidth: 0, resize: 'none', maxHeight: 120, border: `1.5px solid ${PC.line}`, borderRadius: 20,
              padding: '11px 14px', fontFamily: FONT, fontSize: 15, fontWeight: 600, color: PC.ink, background: '#fff', outline: 'none',
            }} />
          <button type="submit" disabled={!draft.trim() || waiting} aria-label={s('tt_send')}
            style={{
              width: 44, height: 44, flex: 'none', borderRadius: 999, border: 'none', fontSize: 18,
              background: draft.trim() && !waiting ? PC.tealInk : PC.line, color: '#fff', cursor: draft.trim() && !waiting ? 'pointer' : 'default',
            }}>➤</button>
        </div>
      </form>

      <ParentNav active="tuto" />
    </div>
  )
}
