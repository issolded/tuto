// The parent's weekly report for one child.
//
// A dashboard answers "what needs me now"; this answers "how is it going" — the question a
// parent has once a week, not once a day. It is deliberately the only parent screen that
// looks backwards.
//
// Everything here comes from /api/parent/children/:childId/week. Nothing is computed from
// guesses: a day with no activity draws an empty slot rather than being left out, and a day
// the daily limit stopped is reported as such, because a report that hides those days tells
// a parent their child did nothing.
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PC, FONT, TEXT, SPACE, RADIUS, PCSS, TopBar, Card, TaskIcon } from '../lib/parentUI'
import { useT } from '../lib/parentI18n'
import { t as childT, childLang as childLangOf, localeFor } from '../lib/i18n'
import ParentNav from '../components/ParentNav'

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'
const TYPES = ['reading', 'math', 'writing', 'homework', 'drawing', 'puzzle', 'english']

// The bar area, in px. A percentage height inside an auto-height column resolves against
// nothing, so the height is computed rather than expressed as a ratio in CSS.
const BAR_MAX = 86

export default function ParentReports() {
  const nav = useNavigate()
  const s = useT()
  const [params, setParams] = useSearchParams()
  const [children, setChildren] = useState([])
  const [childId, setChildId] = useState(params.get('child') || '')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openDay, setOpenDay] = useState(null)

  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'pcss-reports'
    el.textContent = PCSS
    if (!document.getElementById('pcss-reports')) document.head.appendChild(el)
    return () => { document.getElementById('pcss-reports')?.remove() }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return nav('/parent/login')
      const { data: kids } = await supabase
        .from('children').select('id, name, language, birth_date').eq('parent_id', user.id).order('created_at')
      if (!alive) return
      setChildren(kids || [])
      // A child named in the URL wins, so the child page can link straight to its own week;
      // anything else falls back to the first. Read through the setter rather than from
      // state, so this effect does not re-run every time the choice changes.
      setChildId(prev => (kids || []).some(k => k.id === prev) ? prev : (kids?.[0]?.id || ''))
      if (!kids?.length) setLoading(false)
    })()
    return () => { alive = false }
  }, [nav])

  useEffect(() => {
    if (!childId) return
    let alive = true
    ;(async () => {
      setLoading(true); setError('')
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const r = await fetch(`${SERVER}/api/parent/children/${encodeURIComponent(childId)}/week?offset=${offset}`,
          { headers: { Authorization: `Bearer ${session?.access_token}` } })
        const j = await r.json()
        if (!alive) return
        if (!r.ok) throw new Error(j?.error || `Server error ${r.status}`)
        setData(j); setOpenDay(null)
      } catch (e) {
        if (alive) { setError(e.message); setData(null) }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [childId, offset])

  const child = children.find(c => c.id === childId)
  const lang = childLangOf(child)
  const locale = localeFor(lang)

  const pickChild = (id) => { setChildId(id); setOffset(0); setParams({ child: id }) }

  const fmtRange = (r) => {
    if (!r) return ''
    const d1 = new Date(r.start + 'T00:00:00'), d2 = new Date(r.end + 'T00:00:00')
    const day = (d) => d.toLocaleDateString(locale, { day: 'numeric' })
    const full = (d) => d.toLocaleDateString(locale, { day: 'numeric', month: 'long' })
    return d1.getMonth() === d2.getMonth() ? `${day(d1)}–${full(d2)}` : `${full(d1)} – ${full(d2)}`
  }
  const dayLabel = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString(locale, { weekday: 'short' })

  const totals = data?.totals
  const maxGems = Math.max(0, ...(data?.days || []).map(d => d.gems))
  const delta = data ? (data.totals.gems - data.previous.gems) : 0

  return (
    <div className="tc-col" style={{ background: PC.bg, minHeight: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      <TopBar title={s('rp_title')} sub={child?.name} />

      <div className="tc-scroll tc-tabbed" style={{ flex: 1, padding: `0 ${SPACE.s5}px ${SPACE.s8}px` }}>

        {children.length > 1 && (
          <div style={{ display: 'flex', gap: SPACE.s2, marginBottom: SPACE.s3 }}>
            {children.map(k => (
              <button key={k.id} className="tc-press tc-tap" onClick={() => pickChild(k.id)}
                aria-pressed={k.id === childId}
                style={{
                  flex: 1, minHeight: 44, borderRadius: RADIUS.sm, cursor: 'pointer', fontFamily: FONT,
                  ...TEXT.bodySm, fontWeight: 800,
                  border: `1.5px solid ${k.id === childId ? PC.tealInk : PC.line}`,
                  background: k.id === childId ? PC.tealBg : '#fff',
                  color: k.id === childId ? PC.tealInk : PC.ink,
                }}>
                {k.name}
              </button>
            ))}
          </div>
        )}

        {/* week nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.s2, marginBottom: SPACE.s3 }}>
          <button className="tc-press tc-tap" onClick={() => setOffset(o => o + 1)} aria-label={s('rp_prev_week')}
            style={navChip}>‹</button>
          <div style={{ ...TEXT.heading, color: PC.ink, textAlign: 'center', flex: 1 }}>
            {offset === 0 ? s('rp_this_week') : fmtRange(data?.range)}
          </div>
          <button className="tc-press tc-tap" onClick={() => setOffset(o => Math.max(0, o - 1))}
            disabled={offset === 0} aria-label={s('rp_next_week')}
            style={{ ...navChip, opacity: offset === 0 ? 0.35 : 1, cursor: offset === 0 ? 'default' : 'pointer' }}>›</button>
        </div>

        {!children.length && !loading && (
          <Card pad={18}><div style={{ ...TEXT.body, color: PC.inkSoft, textAlign: 'center' }}>{s('rp_no_children')}</div></Card>
        )}

        {loading && (
          <Card pad={18}><div style={{ ...TEXT.body, color: PC.inkFaint, textAlign: 'center' }}>{s('loading')}</div></Card>
        )}

        {error && !loading && (
          <Card pad={18}><div style={{ ...TEXT.body, color: PC.danger, textAlign: 'center' }}>{error}</div></Card>
        )}

        {data && !loading && !error && (
          <>
            {/* the week, as one number and its comparison */}
            <Card pad={18}>
              <div style={{ ...TEXT.heading, color: PC.ink }}>
                {offset === 0 ? s('rp_so_far') : fmtRange(data.range)}
              </div>
              <div style={{ ...TEXT.bodySm, color: PC.inkSoft, marginTop: 2 }}>
                {s('rp_summary', { n: totals.sessions, g: totals.gems })}
              </div>
              {data.previous.gems > 0 || totals.gems > 0 ? (
                <div style={{ ...TEXT.bodySm, fontWeight: 800, marginTop: SPACE.s2, color: delta > 0 ? PC.green : delta < 0 ? PC.peachDeep : PC.inkSoft }}>
                  {delta > 0 ? s('rp_vs_up', { n: delta })
                    : delta < 0 ? s('rp_vs_down', { n: -delta })
                    : s('rp_vs_same')}
                </div>
              ) : null}

              {/* One series, so one hue and no legend — the label above names it. */}
              <div style={{ ...TEXT.label, color: PC.inkFaint, marginTop: SPACE.s4 }}>{s('rp_daily')}</div>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 5, height: BAR_MAX + 22, marginTop: SPACE.s3 }}>
                {data.days.map((d, i) => {
                  const h = maxGems ? Math.max(3, Math.round(d.gems / maxGems * BAR_MAX)) : 3
                  const best = d.gems === maxGems && maxGems > 0
                  return (
                    <button key={d.date} onClick={() => setOpenDay(openDay === i ? null : i)}
                      style={{
                        flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                        alignItems: 'center', gap: 5, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      }}>
                      <span style={{
                        width: '100%', height: h, borderRadius: '4px 4px 0 0', position: 'relative',
                        background: d.gems ? PC.tealInk : PC.line,
                        outline: openDay === i ? `2px solid ${PC.tealInk}` : 'none', outlineOffset: 1,
                      }}>
                        {best && (
                          <span style={{ position: 'absolute', top: -15, left: 0, right: 0, textAlign: 'center', ...TEXT.caption, color: PC.tealInk }}>
                            {d.gems}
                          </span>
                        )}
                      </span>
                      <span style={{ ...TEXT.caption, fontWeight: 700, color: PC.inkFaint }}>{dayLabel(d.date)}</span>
                    </button>
                  )
                })}
              </div>
              <div style={{ height: 1, background: PC.line, marginTop: -1 }} />
              {openDay !== null && (
                <div className="tc-fade" style={{
                  background: PC.ink, color: '#fff', borderRadius: RADIUS.xs, padding: `${SPACE.s2}px ${SPACE.s3}px`,
                  ...TEXT.bodySm, fontWeight: 700, textAlign: 'center', marginTop: SPACE.s3,
                }}>
                  {s('rp_day_detail', {
                    d: new Date(data.days[openDay].date + 'T00:00:00').toLocaleDateString(locale, { weekday: 'long' }),
                    g: data.days[openDay].gems,
                    n: data.days[openDay].sessions,
                  })}
                </div>
              )}
            </Card>

            {/* what they actually did — identity carried by icon and name, never colour alone */}
            <Card pad={18} style={{ marginTop: SPACE.s3 }}>
              <div style={{ ...TEXT.heading, color: PC.ink, marginBottom: SPACE.s2 }}>{s('rp_what')}</div>
              {TYPES.filter(k => data.byType[k] > 0).map((k, i) => (
                <div key={k} style={{
                  display: 'flex', alignItems: 'center', gap: SPACE.s3, padding: `${SPACE.s2}px 0`,
                  borderTop: i ? `1px solid ${PC.line}` : 'none',
                }}>
                  <TaskIcon type={k} size={20} />
                  <div style={{ flex: 1, ...TEXT.body, fontWeight: 800, color: PC.ink }}>{childT(`task_${k}`, lang)}</div>
                  <div style={{ ...TEXT.caption, color: PC.inkSoft }}>{data.byType[k] === 1 ? s('rp_times_one') : s('rp_times', { n: data.byType[k] })}</div>
                </div>
              ))}
              {!TYPES.some(k => data.byType[k] > 0) && (
                <div style={{ ...TEXT.body, color: PC.inkFaint, textAlign: 'center', padding: `${SPACE.s3}px 0` }}>
                  {s('rp_empty')}
                </div>
              )}
            </Card>

            {/* The limit is reported, not hidden: these are sessions that happened and paid nothing. */}
            {totals.capped > 0 && (
              <Card pad={18} style={{ marginTop: SPACE.s3, background: PC.peachBg, boxShadow: 'none' }}>
                <div style={{ ...TEXT.bodySm, color: PC.ink, lineHeight: 1.5 }}>
                  {s('rp_capped', { n: totals.capped })}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
      <ParentNav active="reports" />
    </div>
  )
}

const navChip = {
  width: 44, height: 44, flex: 'none', borderRadius: RADIUS.sm,
  border: `1.5px solid ${PC.line}`, background: '#fff', color: PC.ink,
  fontSize: 18, fontWeight: 800, cursor: 'pointer', fontFamily: FONT,
}
