// The parent's Screen time tab.
//
// Rules for one child at a time, the way the Reports tab picks a child: chips at the top,
// the controls below. Every control saves itself (debounced, compare-and-swap through
// updateParentPrefs) — a tab bar sits under this screen, and an explicit Save button above a
// tab bar is how edits get lost to a tap on "Raporlar". Family Link and Apple Screen Time
// save the same way.
//
// Still a web trial (CLAUDE.md, 2026-09-20): nothing here measures or blocks an app on a
// device. So the screen shows the PLAN for today — budget, school and bed hours — and never a
// "used 42 of 60 minutes" figure, which would be the simulation dressed up as real usage. The
// banner at the top says so and stays until the native app enforces these rules.
//
// Values are clamped as they are entered (a weekday budget cannot pass the daily maximum,
// earned time cannot pass it either), so a rule set built here is valid by construction and
// the only thing validRules() can still refuse is a schedule whose start equals its end.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, getTodaySummary } from '../lib/supabase'
import { useT, adoptAccountLang } from '../lib/parentI18n'
import { cacheDemoRules } from '../lib/screenControlDemo'
import { updateParentPrefs } from '../lib/parentPrefs'
import { SAMPLE_APPS, EXTRA_MAX, readRules, validRules, localDay, onHoliday, isWeekendRules, dayBudget, extraToday } from '../lib/screenControl'
import { PC, FONT, TEXT, SPACE, RADIUS, PCSS, TopBar, Card, Icon } from '../lib/parentUI'
import ParentNav from '../components/ParentNav'

const APP_NAMES = { roblox: 'Roblox', youtube: 'YouTube', minecraft: 'Minecraft', tuto: 'Tuto' }
const APP_GLYPH = { roblox: '🎮', youtube: '▶️', minecraft: '⛏️', tuto: '📚' }
const SAVE_DELAY = 700

export default function ParentScreenTime() {
  const s = useT()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [parentId, setParentId] = useState('')
  const [children, setChildren] = useState([])
  const [childId, setChildId] = useState(params.get('child') || '')
  const [rules, setRules] = useState(() => readRules())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error | invalid
  const [learned, setLearned] = useState(null) // today's finished tasks for the chosen child; null = not known yet
  const pending = useRef(null) // { childId, rules } not yet written
  const timer = useRef(null)
  // What the account holds, readable from handlers that run after an await (a closure would
  // still see the value from before the save it waited on).
  const storedRef = useRef({})

  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'pcss-screen-time'
    el.textContent = PCSS
    if (!document.getElementById('pcss-screen-time')) document.head.appendChild(el)
    return () => { document.getElementById('pcss-screen-time')?.remove() }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return nav('/parent/login')
        const [family, parent] = await Promise.all([
          supabase.from('children').select('id, name, language').eq('parent_id', user.id).order('created_at'),
          supabase.from('parents').select('prefs').eq('id', user.id).single(),
        ])
        if (family.error || parent.error) throw family.error || parent.error
        if (!alive) return
        adoptAccountLang(parent.data?.prefs?.language)
        const saved = parent.data?.prefs?.screen_control_web || {}
        // The child's own trial in this browser reads its rules from this cache.
        for (const c of family.data || []) if (saved[c.id]) cacheDemoRules(c.id, readRules(saved[c.id]))
        const wanted = params.get('child')
        const picked = (family.data || []).some(c => c.id === wanted) ? wanted : (family.data?.[0]?.id || '')
        storedRef.current = saved
        setParentId(user.id); setChildren(family.data || [])
        setChildId(picked); setRules(readRules(saved[picked]))
      } catch {
        if (alive) setLoadError(true)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
    // Read once, on arrival: the chips own the choice after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav])

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    const job = pending.current
    if (!job || !parentId) return
    pending.current = null
    if (!validRules(job.rules)) { setSaveState('invalid'); return }
    setSaveState('saving')
    try {
      const prefs = await updateParentPrefs(parentId, cur => ({
        ...cur, screen_control_web: { ...(cur.screen_control_web || {}), [job.childId]: job.rules },
      }))
      cacheDemoRules(job.childId, job.rules)
      storedRef.current = prefs.screen_control_web || {}
      setSaveState(pending.current ? 'saving' : 'saved')
    } catch {
      // Put it back so the next change, or leaving the screen, tries again.
      pending.current = pending.current || job
      setSaveState('error')
    }
  }, [parentId])

  // Today's finished tasks are real (the same summary the child's home reads), unlike usage,
  // which nothing measures yet — so "learn first" can say where the child actually stands.
  useEffect(() => {
    if (!childId) return
    let alive = true
    getTodaySummary(childId).then(t => {
      if (alive) setLearned(Object.values(t?.activities || {}).reduce((a, n) => a + (Number(n) || 0), 0))
    })
    return () => { alive = false; setLearned(null) }
  }, [childId])

  // Leaving the tab writes what is waiting rather than dropping it.
  useEffect(() => () => { flush() }, [flush])

  const change = (patch, { now = false } = {}) => {
    const next = { ...rules, ...patch }
    pending.current = { childId, rules: next }
    setRules(next)
    setSaveState('saving')
    clearTimeout(timer.current)
    // A button press (today's extra time) is one deliberate act, written at once; steppers
    // are tapped in runs and wait for the run to end.
    timer.current = setTimeout(flush, now ? 0 : SAVE_DELAY)
  }

  const pickChild = async (id) => {
    if (id === childId) return
    await flush()
    setChildId(id); setRules(readRules(storedRef.current[id])); setParams({ child: id })
  }

  const child = children.find(c => c.id === childId)
  const r = rules
  const longest = Math.max(r.weekday, r.weekend)
  const now = new Date()
  const today = localDay(now)
  const holidayNow = onHoliday(r, now)
  const isWeekend = isWeekendRules(r, now)
  const extra = extraToday(r, now)
  const budget = dayBudget(r, now) + extra
  const giveExtra = (n) => change({ extra: { date: today, minutes: Math.min(EXTRA_MAX, extra + n) } }, { now: true })
  const plusDays = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); return localDay(d) }

  return (
    <div className="tc-col" style={{ background: PC.bg, minHeight: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      <TopBar title={s('st_title')} sub={child?.name} right={<SaveBadge state={saveState} s={s} />} />

      <div className="tc-scroll tc-tabbed" style={{ flex: 1, paddingInline: SPACE.s5 }}>
        <div style={{ background: PC.peachBg, color: '#8a4f1c', borderRadius: RADIUS.sm, padding: `${SPACE.s3}px ${SPACE.s3}px`, ...TEXT.bodySm, fontWeight: 700, lineHeight: '19px' }}>
          ⚠️ {s('st_demo_banner')}
        </div>

        {children.length > 1 && (
          <div style={{ display: 'flex', gap: SPACE.s2, marginTop: SPACE.s3 }}>
            {children.map(k => (
              <button key={k.id} className="tc-press tc-tap" onClick={() => pickChild(k.id)} aria-pressed={k.id === childId}
                style={{
                  flex: 1, minHeight: 44, borderRadius: RADIUS.sm, cursor: 'pointer', fontFamily: FONT, ...TEXT.bodySm, fontWeight: 800,
                  border: `1.5px solid ${k.id === childId ? PC.tealInk : PC.line}`,
                  background: k.id === childId ? PC.tealBg : '#fff', color: k.id === childId ? PC.tealInk : PC.ink,
                }}>{k.name}</button>
            ))}
          </div>
        )}

        {loading && <Card pad={18} style={{ marginTop: SPACE.s3 }}><div style={{ ...TEXT.body, color: PC.inkFaint, textAlign: 'center' }}>{s('loading')}</div></Card>}
        {loadError && !loading && <Card pad={18} style={{ marginTop: SPACE.s3 }}><div role="alert" style={{ ...TEXT.body, color: PC.danger, textAlign: 'center' }}>{s('sc_load_error')}</div></Card>}
        {!loading && !loadError && !children.length && <Card pad={18} style={{ marginTop: SPACE.s3 }}><div style={{ ...TEXT.body, color: PC.inkSoft, textAlign: 'center' }}>{s('sc_no_child')}</div></Card>}

        {child && !loading && (
          <>
            {/* Today's plan: rules, not usage. */}
            <div style={{ background: PC.tealInk, color: '#fff', borderRadius: 18, padding: SPACE.s4, display: 'flex', alignItems: 'center', gap: SPACE.s3, marginTop: SPACE.s3 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1 }}>{s('st_min', { n: budget })}</div>
                <div style={{ ...TEXT.bodySm, fontWeight: 700, opacity: .93, marginTop: 4 }}>
                  {s(holidayNow ? 'st_today_holiday' : isWeekend ? 'st_today_weekend' : 'st_today_weekday', { name: child.name })}
                </div>
                <div style={{ ...TEXT.caption, fontWeight: 700, opacity: .85, marginTop: 6 }}>
                  {[
                    extra > 0 && `🎁 +${extra}`,
                    r.learnFirst && `🔒 ${learned ?? '…'}/${r.learnNeed}`,
                    r.school && !isWeekend && `🏫 ${r.schoolStart}–${r.schoolEnd}`,
                    r.bedtime && `🌙 ${r.bedStart}`,
                    r.earnedCap > 0 && `⭐ +${r.earnedCap}`,
                  ].filter(Boolean).join('  ·  ')}
                </div>
              </div>
              <div aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, flex: 'none' }}>⏱️</div>
            </div>

            <Head>{s('st_extra')}</Head>
            <Card pad={16}>
              <div style={{ ...TEXT.bodySm, color: PC.inkSoft, marginBottom: SPACE.s3 }}>{s('st_extra_intro', { name: child.name })}</div>
              <div style={{ display: 'flex', gap: SPACE.s2 }}>
                {[15, 30, 60].map(n => (
                  <button key={n} className="tc-press tc-tap" disabled={extra + n > EXTRA_MAX} onClick={() => giveExtra(n)}
                    style={{ flex: 1, minHeight: 44, borderRadius: RADIUS.sm, border: 'none', fontFamily: FONT, fontWeight: 800, fontSize: 14,
                      background: extra + n > EXTRA_MAX ? PC.field : PC.tealBg, color: extra + n > EXTRA_MAX ? PC.inkFaint : PC.tealInk,
                      cursor: extra + n > EXTRA_MAX ? 'default' : 'pointer' }}>+{s('st_min', { n })}</button>
                ))}
              </div>
              {extra > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, marginTop: SPACE.s3 }}>
                  <div role="status" style={{ flex: 1, ...TEXT.bodySm, fontWeight: 800, color: PC.ink }}>🎁 {s('st_extra_given', { n: extra })}</div>
                  <button onClick={() => change({ extra: null }, { now: true })} className="tc-tap"
                    style={{ border: 'none', background: 'none', color: PC.danger, fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: 'pointer', padding: 6 }}>{s('st_extra_undo')}</button>
                </div>
              )}
              <div style={{ ...TEXT.caption, fontWeight: 600, color: PC.inkFaint, marginTop: SPACE.s3 }}>{s('st_extra_chat')}</div>
            </Card>

            <Head>{s('st_daily')}</Head>
            <Card pad={16}>
              <Row title={s('st_weekday')} sub={s('st_weekday_sub')}>
                <MinuteStepper label={s('st_weekday')} value={r.weekday} max={r.cap} step={5} onChange={v => change({ weekday: v })} s={s} />
              </Row>
              <Hr />
              <Row title={s('st_weekend')} sub={s('st_weekend_sub')}>
                <MinuteStepper label={s('st_weekend')} value={r.weekend} max={r.cap} step={5} onChange={v => change({ weekend: v })} s={s} />
              </Row>
              <Hr />
              <Row title={s('st_cap')} sub={s('st_cap_sub')}>
                <MinuteStepper label={s('st_cap')} value={r.cap} min={Math.max(longest, r.earnedCap)} max={480} step={15} onChange={v => change({ cap: v })} s={s} />
              </Row>
            </Card>

            <Head>{s('st_learn')}</Head>
            <Card pad={16}>
              <Row title={s('st_learn_on')} sub={s('st_learn_sub')}>
                <Switch on={r.learnFirst} label={s('st_learn_on')} onChange={v => change({ learnFirst: v })} />
              </Row>
              {r.learnFirst && <>
                <Hr />
                <Row title={s('st_learn_need')} sub={learned == null ? s('loading') : s('st_learn_today', { name: child.name, n: learned })}>
                  <MinuteStepper label={s('st_learn_need')} value={r.learnNeed} min={1} max={5} step={1} unit="task" onChange={v => change({ learnNeed: v })} s={s} />
                </Row>
                <div role="status" style={{ marginTop: SPACE.s3, borderRadius: RADIUS.sm, padding: `${SPACE.s2}px ${SPACE.s3}px`, ...TEXT.bodySm, fontWeight: 800,
                  background: learned != null && learned >= r.learnNeed ? PC.greenBg : PC.amberBg, color: PC.ink }}>
                  {learned == null ? '…' : learned >= r.learnNeed ? `✅ ${s('st_learn_open')}` : `🔒 ${s('st_learn_closed', { n: r.learnNeed - learned })}`}
                </div>
              </>}
            </Card>

            <Head>{s('st_school')}</Head>
            <Card pad={16}>
              <Row title={s('st_school_on')} sub={s('st_school_sub')}>
                <Switch on={r.school} label={s('st_school_on')} onChange={v => change({ school: v })} />
              </Row>
              {r.school && <TimeRange start={r.schoolStart} end={r.schoolEnd} s={s}
                onChange={(a, b) => change({ schoolStart: a, schoolEnd: b })} />}
            </Card>

            <Head>{s('st_bed')}</Head>
            <Card pad={16}>
              <Row title={s('st_bed_on')} sub={s('st_bed_sub')}>
                <Switch on={r.bedtime} label={s('st_bed_on')} onChange={v => change({ bedtime: v })} />
              </Row>
              {r.bedtime && <TimeRange start={r.bedStart} end={r.bedEnd} s={s}
                onChange={(a, b) => change({ bedStart: a, bedEnd: b })} />}
            </Card>

            <Head>{s('st_holiday')}</Head>
            <Card pad={16}>
              <Row title={s('st_holiday_on')} sub={s('st_holiday_sub')}>
                <Switch on={r.holiday} label={s('st_holiday_on')}
                  onChange={v => change(v && !r.holidayFrom ? { holiday: true, holidayFrom: today, holidayTo: plusDays(6) } : { holiday: v })} />
              </Row>
              {r.holiday && <DateRange from={r.holidayFrom} to={r.holidayTo} s={s} onChange={(a, b) => change({ holidayFrom: a, holidayTo: b })} />}
              {r.holiday && r.holidayTo && r.holidayTo < today && (
                <div style={{ ...TEXT.caption, fontWeight: 700, color: PC.peachDeep, marginTop: SPACE.s2 }}>{s('st_holiday_past')}</div>
              )}
            </Card>

            <Head>{s('st_gems')}</Head>
            <Card pad={16}>
              <div style={{ ...TEXT.bodySm, color: PC.inkSoft, marginBottom: SPACE.s3 }}>{s('st_gems_intro')}</div>
              <Row title={s('st_rate')} sub={s('st_rate_sub', { n: r.gemsPerMinute * 10 })}>
                <MinuteStepper label={s('st_rate')} value={r.gemsPerMinute} min={1} max={100} step={1} unit="gem" onChange={v => change({ gemsPerMinute: v })} s={s} />
              </Row>
              <Hr />
              <Row title={s('st_earned')} sub={s('st_earned_sub')}>
                <MinuteStepper label={s('st_earned')} value={r.earnedCap} max={r.cap} step={5} onChange={v => change({ earnedCap: v })} s={s} />
              </Row>
              <Hr />
              <Row title={s('st_approval')} sub={s('st_approval_sub')}>
                <Switch on={r.approval} label={s('st_approval')} onChange={v => change({ approval: v })} />
              </Row>
            </Card>

            <Head>{s('st_apps')}</Head>
            <Card pad={16}>
              <div style={{ ...TEXT.bodySm, color: PC.inkSoft, marginBottom: SPACE.s2 }}>{s('sc_apps_note')}</div>
              {SAMPLE_APPS.map((app, i) => (
                <div key={app} style={{ paddingTop: SPACE.s3, marginTop: i ? SPACE.s3 : 0, borderTop: i ? `1px solid ${PC.line}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, marginBottom: SPACE.s2 }}>
                    <span aria-hidden="true" style={{ fontSize: 18 }}>{APP_GLYPH[app]}</span>
                    <span style={{ ...TEXT.body, fontWeight: 800, color: PC.ink }}>{APP_NAMES[app]}</span>
                  </div>
                  <Segmented value={r.apps[app]} disabled={app === 'tuto'} label={APP_NAMES[app]}
                    options={['timed', 'allowed', 'blocked'].map(m => [m, s(`st_app_${m}`)])}
                    onChange={v => change({ apps: { ...r.apps, [app]: v } })} />
                </div>
              ))}
            </Card>

            <Card pad={14} onClick={async () => { await flush(); nav(`/parent/settings/screen-control?child=${childId}&view=preview`) }}
              style={{ marginTop: SPACE.s4, display: 'flex', alignItems: 'center', gap: SPACE.s3 }}>
              <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: 12, background: PC.tealBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flex: 'none' }}>👀</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...TEXT.body, fontWeight: 800, color: PC.ink }}>{s('sc_preview')}</div>
                <div style={{ ...TEXT.caption, color: PC.inkSoft, marginTop: 2 }}>{s('st_preview_sub', { name: child.name })}</div>
              </div>
              <Icon name="chevron" size={18} color={PC.inkFaint} />
            </Card>

            {saveState === 'invalid' && <div role="alert" style={{ ...TEXT.bodySm, color: PC.danger, marginTop: SPACE.s3 }}>{s('st_invalid')}</div>}
          </>
        )}
      </div>
      <ParentNav active="screen" />
    </div>
  )
}

function SaveBadge({ state, s }) {
  if (state === 'idle') return null
  const map = {
    saving: [PC.inkFaint, s('saving')],
    saved: [PC.tealInk, `✓ ${s('st_saved')}`],
    error: [PC.danger, s('st_save_error')],
    invalid: [PC.danger, s('st_not_saved')],
  }
  const [color, text] = map[state]
  return <span role="status" style={{ ...TEXT.caption, color, whiteSpace: 'nowrap' }}>{text}</span>
}

function Head({ children }) {
  return <div style={{ ...TEXT.heading, fontSize: 15, color: PC.ink, margin: `${SPACE.s5}px 2px ${SPACE.s2}px` }}>{children}</div>
}
function Hr() { return <div style={{ height: 1, background: PC.line, margin: `${SPACE.s3}px 0` }} /> }

function Row({ title, sub, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...TEXT.body, fontWeight: 800, color: PC.ink, lineHeight: '20px' }}>{title}</div>
        {sub && <div style={{ ...TEXT.caption, fontWeight: 600, color: PC.inkSoft, marginTop: 2, lineHeight: '15px' }}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}

function Switch({ on, onChange, label }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className="tc-tap"
      style={{ width: 48, height: 30, flex: 'none', border: 'none', borderRadius: 999, padding: 0, cursor: 'pointer', position: 'relative', background: on ? PC.tealInk : '#D9DEE3', transition: 'background .18s' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 24, height: 24, borderRadius: 999, background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,.18)', transition: 'left .18s' }} />
    </button>
  )
}

// − value + : thumb-sized, one tap per step, and the bounds are the rules' own (a weekday
// budget cannot rise past the daily maximum), so the result is always a valid rule set.
function MinuteStepper({ value, onChange, min = 0, max = 480, step = 5, unit = 'min', label, s }) {
  const clamp = (v) => Math.max(min, Math.min(max, v))
  const btn = (disabled) => ({
    width: 34, height: 34, borderRadius: 10, border: `1.5px solid ${PC.line}`, background: disabled ? PC.field : '#fff',
    color: disabled ? PC.inkFaint : PC.ink, fontSize: 18, fontWeight: 800, cursor: disabled ? 'default' : 'pointer', fontFamily: FONT, padding: 0,
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
      <button aria-label={`${label} −${step}`} disabled={value <= min} onClick={() => onChange(clamp(value - step))} style={btn(value <= min)}>−</button>
      <span aria-live="polite" style={{ minWidth: 54, textAlign: 'center', ...TEXT.bodySm, fontWeight: 800, color: PC.ink, fontVariantNumeric: 'tabular-nums' }}>
        {unit === 'gem' ? `${value} ⭐` : unit === 'task' ? s('st_tasks', { n: value }) : s('st_min', { n: value })}
      </span>
      <button aria-label={`${label} +${step}`} disabled={value >= max} onClick={() => onChange(clamp(value + step))} style={btn(value >= max)}>+</button>
    </div>
  )
}

function TimeRange({ start, end, onChange, s }) {
  const input = { flex: 1, minWidth: 0, border: `1.5px solid ${PC.line}`, borderRadius: 11, background: PC.field, padding: '9px 8px', textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 14, color: PC.ink }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, marginTop: SPACE.s3 }}>
      <input type="time" aria-label={s('sc_start')} value={start} onChange={e => e.target.value && onChange(e.target.value, end)} style={input} />
      <span style={{ color: PC.inkFaint, fontWeight: 800 }}>—</span>
      <input type="time" aria-label={s('sc_end')} value={end} onChange={e => e.target.value && onChange(start, e.target.value)} style={input} />
    </div>
  )
}

function DateRange({ from, to, onChange, s }) {
  const input = { flex: 1, minWidth: 0, border: `1.5px solid ${PC.line}`, borderRadius: 11, background: PC.field, padding: '9px 6px', textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 13.5, color: PC.ink }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, marginTop: SPACE.s3 }}>
      <input type="date" aria-label={s('sc_start')} value={from} max={to || undefined} onChange={e => e.target.value && onChange(e.target.value, to < e.target.value ? e.target.value : to)} style={input} />
      <span style={{ color: PC.inkFaint, fontWeight: 800 }}>—</span>
      <input type="date" aria-label={s('sc_end')} value={to} min={from || undefined} onChange={e => e.target.value && onChange(from > e.target.value ? e.target.value : from, e.target.value)} style={input} />
    </div>
  )
}

function Segmented({ value, options, onChange, disabled, label }) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', gap: 6 }}>
      {options.map(([v, text]) => {
        const on = v === value
        return (
          <button key={v} role="radio" aria-checked={on} disabled={disabled && !on} onClick={() => !disabled && onChange(v)}
            style={{
              flex: 1, minHeight: 38, borderRadius: 11, fontFamily: FONT, fontSize: 12.5, fontWeight: 800, padding: '6px 4px', cursor: disabled ? 'default' : 'pointer',
              border: `1.5px solid ${on ? PC.tealInk : PC.line}`, background: on ? PC.tealBg : '#fff',
              color: on ? PC.tealInk : (disabled ? PC.inkFaint : PC.ink),
            }}>{text}</button>
        )
      })}
    </div>
  )
}
