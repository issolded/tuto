import { useEffect, useState } from 'react'
import { t, childLang } from '../lib/i18n'
import { useNavigate } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'
import Shell, { useIsTablet } from '../components/Shell'
import { TreeArt, Sprig } from '../components/TreeArt'
import { supabase, storageClient, getChildGems, getTodaySummary, drawingIconUrl } from '../lib/supabase'

const ACCENT = '#f79433'
const INK = '#241f3a'
const INK_SOFT = '#8d83ad'
const LILAC = '#e7ddf6'
const FRED = "'Fredoka', sans-serif"

const HOME_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap');
@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
.tuto-card{ transition: transform .13s ease, box-shadow .13s ease; }
.tuto-card:hover{ transform: translateY(-3px); box-shadow: 0 12px 22px rgba(40,30,70,.15); }
.tuto-card:active{ transform: scale(.97); }
.tuto-gempill{ transition: transform .12s ease; }
.tuto-gempill:active{ transform: scale(.95); }
.tuto-task-grid{ display:grid; grid-template-columns:1fr 1fr; gap:13px; }
.tuto-wide-card{ grid-column:1 / -1; }
.tuto-today-card{ position:relative; background:#fff; border-radius:24px; padding:20px 20px 4px; box-shadow:0 6px 16px rgba(40,30,70,.09); margin:10px 0 18px; }
.tuto-today-card.mature{ background:#F7F9F6; border:1.5px solid #E4EAE3; box-shadow:none; }
.tuto-today-sections{ display:flex; flex-direction:column; }
.tuto-today-sec{ padding:14px 0; border-top:1px dashed #E0DAF0; }
.tuto-today-sec:first-child{ border-top:none; padding-top:2px; }
.tuto-today-card.mature .tuto-today-sec{ border-top-color:#E4EAE3; }
@media (min-width:768px) {
  .tuto-today-sections{ flex-direction:row; align-items:stretch; }
  .tuto-today-sec{ flex:1; border-top:none; padding:16px 0 20px; display:flex; flex-direction:column; justify-content:center; }
  .tuto-today-sec:nth-child(2){ flex:1.4; border-left:1px dashed #E0DAF0; padding-left:24px; margin-left:24px; }
  .tuto-today-sec:nth-child(3){ flex:1.1; border-left:1px dashed #E0DAF0; padding-left:24px; margin-left:24px; }
  .tuto-today-card.mature .tuto-today-sec{ border-left-color:#E4EAE3; }
  .tuto-task-grid{ grid-template-columns:repeat(3, 1fr); }
  .tuto-wide-card{ grid-column:auto; }
}
`

// My Tree has no entry here on purpose — it earns no gems (see TASK_ACCENT's
// comment), so its tile skips the "+N gems" badge entirely rather than
// falling back to a number that isn't true.
const DEFAULT_TASK_GEMS = { reading: 30, math: 30, writing: 30 }

// Names are keys, not text: resolved against the child's language where they are drawn.
const BASE_TASKS = [
  { bg: '#E8E0FF', nameKey: 'task_reading', route: '/child/library', type: 'reading' },
  { bg: '#D4EDFF', nameKey: 'task_math',    route: '/child/math',    type: 'math'    },
  { bg: '#D4F5E0', nameKey: 'task_writing', route: '/child/stories', type: 'writing' },
  { bg: '#FFE8D4', nameKey: 'task_tree',    route: '/child/task',    type: 'tree'    },
]

// 'tree' isn't a gem-earning task type (no task_settings entry exists for it
// — it's always on), it just needs an accent color for its tile icon.
const TASK_ACCENT = { reading: '#a98ce6', math: '#5aa9e6', writing: '#6cc28a', tree: '#f3a35a' }

function TaskIcon({ type, c }) {
  if (type === 'reading') return (
    <svg width="60" height="60" viewBox="0 0 64 64" fill="none"><path d="M32 16 C26 12 18 12 12 15 L12 48 C18 45 26 45 32 49 C38 45 46 45 52 48 L52 15 C46 12 38 12 32 16 Z" fill="#fff" stroke="#20201e" strokeWidth="4" strokeLinejoin="round"/><path d="M32 16 L32 49" stroke="#20201e" strokeWidth="4" strokeLinecap="round"/><path d="M18 24 H27 M18 31 H27 M37 24 H46 M37 31 H46" stroke={c} strokeWidth="3.4" strokeLinecap="round"/></svg>
  )
  if (type === 'math') return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none"><rect x="12" y="12" width="40" height="40" rx="11" fill="#fff" stroke="#20201e" strokeWidth="4"/><path d="M22 24 H30 M26 20 V28" stroke={c} strokeWidth="3.6" strokeLinecap="round"/><path d="M35 24 H43" stroke={c} strokeWidth="3.6" strokeLinecap="round"/><circle cx="25" cy="40" r="2.4" fill={c}/><circle cx="31" cy="40" r="2.4" fill={c}/><path d="M36 37 L43 44 M43 37 L36 44" stroke={c} strokeWidth="3.4" strokeLinecap="round"/></svg>
  )
  if (type === 'writing') return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none"><path d="M40 12 L52 24 L28 48 L16 48 L16 36 Z" fill="#fff" stroke="#20201e" strokeWidth="4" strokeLinejoin="round"/><path d="M36 16 L48 28" stroke="#20201e" strokeWidth="4" strokeLinecap="round"/><path d="M16 48 L24 40" stroke="#20201e" strokeWidth="4" strokeLinecap="round"/><path d="M30 30 L40 40" stroke={c} strokeWidth="3.4" strokeLinecap="round"/></svg>
  )
  if (type === 'tree') return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none">
      <rect x="29" y="42" width="6" height="14" rx="2" fill="#A9744F" stroke="#20201e" strokeWidth="3"/>
      <path d="M16 36 C12 26 20 18 32 20 C44 18 52 26 48 36 C52 42 46 48 38 46 C34 50 30 50 26 46 C18 48 12 42 16 36 Z" fill="#fff" stroke="#20201e" strokeWidth="4" strokeLinejoin="round"/>
      <circle cx="25" cy="30" r="3.4" fill={c}/>
      <circle cx="34" cy="26" r="3.4" fill={c}/>
      <circle cx="40" cy="34" r="3.4" fill={c}/>
      <circle cx="29" cy="38" r="3.4" fill={c}/>
    </svg>
  )
  return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none"><path d="M14 30 L32 14 L50 30 L50 50 L14 50 Z" fill="#fff" stroke="#20201e" strokeWidth="4" strokeLinejoin="round"/><path d="M10 32 L32 12 L54 32" stroke="#20201e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><rect x="27" y="38" width="10" height="12" rx="1.5" fill={c}/></svg>
  )
}

// The tile art is the age band's drawing character — for 6-8 that's the
// finished cat sketch, for 9-11/12-15 the finished anime-face sketch (no
// separate otter set yet, so both older bands share this one for now). The
// full guided-step panel is ~1MB-scale (it needs to be, it's the zoomed-in
// guide image); this icon is 66px, so it loads a dedicated small derivative
// instead (drawingIconUrl) — same picture, ~16KB, not the full panel.
function DrawingsIcon({ age }) {
  const isYoung = age == null || age <= 8
  return <img src={drawingIconUrl(isYoung ? 'cat' : 'anime-face', '6-8')} alt=""
    style={{ width: 66, height: 66, objectFit: 'contain' }} />
}

// Homework tile icon — worksheet sheet + camera badge (see design handoff).
function HomeworkIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none">
      <rect x="14" y="8" width="30" height="40" rx="5" fill="#fff" stroke="#20201e" strokeWidth="4"/>
      <path d="M21 20h16M21 28h16M21 36h10" stroke="#f79433" strokeWidth="3.4" strokeLinecap="round"/>
      <rect x="34" y="34" width="22" height="17" rx="4" fill="#f79433" stroke="#20201e" strokeWidth="4"/>
      <circle cx="45" cy="43" r="4.5" fill="#fff" stroke="#20201e" strokeWidth="3"/>
      <path d="M40 34l1.6-3h6.8L50 34" stroke="#20201e" strokeWidth="3.4" strokeLinejoin="round"/>
    </svg>
  )
}

// ── "Bugün" card — same bandFor() thresholds as MyTree.jsx (that file
// doesn't export it, and it's 3 lines, so duplicated rather than plumbing a
// cross-file import for it).
function bandFor(age) {
  if (age == null) return 'young'
  if (age <= 8) return 'young'
  if (age <= 11) return 'mid'
  return 'mature'
}

const EMPTY_TODAY = {
  today: 0, monthTreeCount: 0,
  activities: { reading: 0, math: 0, writing: 0, homework: 0, drawing: 0 },
  nearestGoal: null, hasAnyGoals: false,
}

const ACTIVITY_TYPES = [
  { key: 'reading',  chipKey: 'chip_books',    bg: '#E8E0FF', emoji: '📖' },
  { key: 'math',     chipKey: 'chip_math',     bg: '#D4EDFF', emoji: '🔢' },
  { key: 'writing',  chipKey: 'chip_story',    bg: '#D4F5E0', emoji: '✏️' },
  { key: 'homework', chipKey: 'chip_homework', bg: '#FFF1CF', emoji: '📸' },
  { key: 'drawing',  chipKey: 'chip_drawing',  bg: '#EFE3FF', emoji: '🎨' },
]

// Mid/mature's plain-text activity summary — young shows this visually via
// its chip grid instead, so it never calls this.
function activitySentence(activities, mature, lang) {
  const remaining = ACTIVITY_TYPES.filter(a => !activities[a.key])
  if (remaining.length === 0) return t(mature ? 'all_done_mature' : 'all_done_young', lang)
  if (remaining.length === ACTIVITY_TYPES.length) return t(mature ? 'start_mature' : 'start_young', lang)
  const names = remaining.map(a => {
    const n = t(a.chipKey, lang)
    // Turkish does not lower-case a list like this, and its words are already the plain form.
    return mature || lang === 'tr' ? n : n.toLowerCase()
  })
  const list = names.length === 1
    ? names[0]
    : lang === 'tr'
      ? `${names.slice(0, -1).join(', ')} ve ${names[names.length - 1]}`
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return lang === 'tr' ? `${remaining.length} tane kaldı: ${list}` : `${remaining.length} left: ${list}`
}

function TodayPill({ emoji, text, color, bg }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: bg, borderRadius: 999, padding: '4px 10px', fontFamily: FRED, fontWeight: 700, fontSize: 11.5, color }}>
      <span style={{ fontSize: 11 }}>{emoji}</span>{text}
    </span>
  )
}

function GoalRing({ pct, color, track, size = 84 }) {
  const stroke = 8
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = (pct / 100) * c
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${c - dash}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray .5s ease' }} />
    </svg>
  )
}

// Replaces the old mascot-hero — surfaces the child's actual day (tree →
// today's activities → nearest goal) instead of a generic "go earn gems"
// prompt. Tonal skin follows bandFor(child.age); tablet opens the same three
// sections into side-by-side panels instead of a phone-style vertical stack
// (both driven by the .tuto-today-* CSS above + the isTablet branches below).
function TodayCard({ band, isTablet, today, gems, nav }) {
  const mature = band === 'mature'
  const ink = mature ? '#27332c' : INK
  const inkSoft = mature ? '#6c7c72' : INK_SOFT
  const accent = mature ? '#2f8f6b' : '#37a06f'

  const goal = today.nearestGoal
  const remaining = goal ? Math.max(0, goal.bt_cost - gems) : 0
  const pct = goal ? Math.min(100, Math.round((gems / goal.bt_cost) * 100)) : 0

  return (
    <div className={`tuto-today-card${mature ? ' mature' : ''}`}>
      {!mature && (
        <TutoMascot
          size={band === 'young' ? 66 : 54}
          style={{
            position: 'absolute', top: -22, zIndex: 2,
            filter: 'drop-shadow(0 6px 10px rgba(40,30,70,.18))',
            ...(isTablet ? { left: '28%', transform: 'translateX(-50%)' } : { right: 16 }),
          }}
        />
      )}

      <div className="tuto-today-sections">
        {/* ── Tree ── */}
        <div
          className="tuto-today-sec"
          onClick={() => nav('/child/task')}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
            ...(isTablet ? { flexDirection: 'column', textAlign: 'center' } : {}),
          }}
        >
          {mature ? <Sprig size={24} color={accent} /> : <TreeArt size={isTablet ? 100 : band === 'young' ? 62 : 56} fruits={today.today} target={4} />}

          {band === 'young' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: isTablet ? 'center' : 'flex-start' }}>
              <TodayPill emoji="🌱" text={`${today.today} leaves today`} color={accent} bg="rgba(76,182,133,.14)" />
              <TodayPill emoji="🌳" text={`${today.monthTreeCount} trees this month`} color={accent} bg="rgba(76,182,133,.14)" />
            </div>
          )}

          {band === 'mid' && (
            <div style={{ minWidth: 0, width: isTablet ? '100%' : undefined, flex: isTablet ? undefined : 1 }}>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 14.5, color: ink }}>
                {today.today} leaves today · {today.monthTreeCount} this month 🌳
              </div>
              <div style={{ marginTop: 6, height: 7, borderRadius: 999, background: 'rgba(55,160,111,.16)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (today.today / 4) * 100)}%`, borderRadius: 999, background: 'linear-gradient(90deg,#6BBF59,#4cb685)', transition: 'width .5s ease' }} />
              </div>
            </div>
          )}

          {mature && (
            <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 500, fontSize: 14, color: ink }}>
              {today.today} contributions today · {today.monthTreeCount} this month
            </div>
          )}

          {!isTablet && <span style={{ marginLeft: 'auto', color: inkSoft, fontSize: 17, flexShrink: 0 }}>›</span>}
        </div>

        {/* ── Activities ── */}
        <div className="tuto-today-sec">
          {band === 'young' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {ACTIVITY_TYPES.map(a => {
                const count = today.activities[a.key] || 0
                const done = count > 0
                return (
                  <div key={a.key} style={{
                    position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    background: done ? a.bg : '#F2F0F7', borderRadius: 14, padding: '10px 4px',
                    opacity: done ? 1 : 0.5,
                  }}>
                    <span style={{ fontSize: 20 }}>{a.emoji}</span>
                    <span style={{ fontFamily: FRED, fontWeight: 600, fontSize: 10, color: ink, textAlign: 'center' }}>{t(a.chipKey, lang)}</span>
                    {done && (
                      <span style={{
                        position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%',
                        background: '#4cb685', color: '#fff', fontSize: 10, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.15)',
                      }}>{count > 1 ? count : '✓'}</span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : mature ? (
            <>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 500, fontSize: 13.5, color: ink, marginBottom: 10 }}>
                {activitySentence(today.activities, true, lang)}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {ACTIVITY_TYPES.map(a => {
                  const done = (today.activities[a.key] || 0) > 0
                  return (
                    <span key={a.key} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '5px 10px',
                      fontFamily: "'Baloo 2', cursive", fontWeight: 500, fontSize: 12,
                      background: done ? '#E2F0E9' : '#EEF1ED', color: done ? '#2f8f6b' : '#8a938d',
                    }}>{done ? '✓' : '○'} {t(a.chipKey, lang)}</span>
                  )
                })}
              </div>
            </>
          ) : (
            <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 15, color: ink }}>
              {activitySentence(today.activities, false, lang)}
            </div>
          )}
        </div>

        {/* ── Goal ── */}
        <div
          className="tuto-today-sec"
          onClick={() => nav('/child/goals')}
          style={{ cursor: 'pointer', ...(isTablet ? { alignItems: 'center', textAlign: 'center' } : {}) }}
        >
          {!goal ? (
            <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 13, color: inkSoft }}>
              {today.hasAnyGoals
                ? `You've reached all your goals${mature ? '' : '! 🎉'}`
                : `No goals yet — ask your parent to add one${mature ? '' : ' 🎯'}`}
            </div>
          ) : isTablet ? (
            <>
              <GoalRing pct={pct} color={mature ? accent : '#f79433'} track={mature ? '#E4EAE3' : 'rgba(247,148,51,.16)'} />
              <div style={{ marginTop: 10, fontFamily: mature ? "'Baloo 2', cursive" : FRED, fontWeight: mature ? 500 : 600, fontSize: 14, color: ink }}>
                {remaining}⭐ to {goal.name}
              </div>
            </>
          ) : mature ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 15 }}>{goal.icon}</span>
                <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 500, fontSize: 13.5, color: ink }}>{goal.name}</span>
              </div>
              <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 12, color: inkSoft, marginBottom: 8 }}>
                {remaining} ⭐ to go
              </div>
              <div style={{ height: 4, borderRadius: 999, background: '#E4EAE3', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: accent, transition: 'width .5s ease' }} />
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 17 }}>🎯</span>
                <span style={{ fontFamily: FRED, fontWeight: 600, fontSize: 14.5, color: ink }}>So close to {goal.name}</span>
              </div>
              <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 12.5, color: accent, marginBottom: 6 }}>
                ⭐ {remaining} gems to go · {gems}/{goal.bt_cost}
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(247,148,51,.14)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: 'linear-gradient(90deg,#f79433,#FFD93D)', transition: 'width .5s ease' }} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ChildHome() {
  const nav = useNavigate()
  const isTablet = useIsTablet()
  const [child, setChild] = useState(() => JSON.parse(localStorage.getItem('child') || 'null'))
  const lang = childLang(child)
  // The greeting follows the clock, and the clock is the child's device.
  const hour = new Date().getHours()
  const greetingKey = hour < 12 ? 'greeting_morning' : hour < 18 ? 'greeting_afternoon' : 'greeting_evening'
  const band = bandFor(child?.age)
  const [gems, setGems] = useState(null)
  const [today, setToday] = useState(EMPTY_TODAY)

  const ts = child?.task_settings || {}
  const TASKS = BASE_TASKS
    .filter(t => (ts[t.type]?.active ?? true))
    .map(t => ({ ...t, gem: ts[t.type]?.gems ?? DEFAULT_TASK_GEMS[t.type] }))

  useEffect(() => {
    if (!localStorage.getItem('family_code')) { nav('/setup', { replace: true }); return }
    if (!child?.id) { nav('/child', { replace: true }); return }

    getChildGems(child.id).then(setGems)
    getTodaySummary(child.id).then(setToday)

    // Settings belong to the parent and can change at any moment, so they are re-read on
    // every visit here rather than frozen at PIN entry — otherwise turning an activity off
    // would not reach the child until they next logged in, which they rarely do.
    // storageClient, not the shared client: this is a child-side read and must not run
    // against a parent session that happens to be persisted in the same browser.
    storageClient
      .from('children')
      .select('id, name, age, task_settings')
      .eq('id', child.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setChild(data)
        localStorage.setItem('child', JSON.stringify(data))
      })
      .catch(() => { /* keep the stored copy — stale settings beat a blank home screen */ })

    const channel = supabase
      .channel(`gems-${child.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bt_ledger', filter: `child_id=eq.${child.id}` },
        (payload) => setGems(prev => (prev ?? 0) + (payload.new.amount || 0))
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  return (
    <Shell active="home" background={LILAC}>
      <style>{HOME_CSS}</style>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '54px 22px 96px', fontFamily: "'Nunito', sans-serif" }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: INK_SOFT, marginBottom: 3 }}>{greetingKey && t(greetingKey, lang)}</div>
            <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 28, color: INK, lineHeight: 1.1, letterSpacing: '-.4px' }}>
              {t('hello_name', lang)}, {child?.name ?? t('friend', lang)}!
            </div>
          </div>
          <button className="tuto-gempill" onClick={() => nav('/child/gems')}
            style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#fff', border: 'none', borderRadius: 999, padding: '8px 14px',
              boxShadow: '0 3px 10px rgba(40,30,70,.12)', cursor: 'pointer',
            }}>
            <span style={{ fontSize: 16 }}>⭐</span>
            <span style={{ fontFamily: FRED, fontWeight: 600, fontSize: 17, color: ACCENT }}>
              {gems === null ? '…' : gems}
            </span>
          </button>
        </div>

        <TodayCard band={band} isTablet={isTablet} today={today} gems={gems ?? 0} nav={nav} />

        <div className="tuto-task-grid">
          {TASKS.map((task, i) => (
            <button key={i} className="tuto-card" onClick={() => nav(task.route, { state: { ...task, from: '/child/home' } })}
              style={{
                background: '#fff', border: 'none', borderRadius: 22, padding: '12px 12px 13px',
                display: 'flex', flexDirection: 'column', gap: 7, cursor: 'pointer', textAlign: 'left',
                boxShadow: '0 6px 16px rgba(40,30,70,.09)',
              }}>
              <div style={{ background: task.bg, height: 84, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TaskIcon type={task.type} c={TASK_ACCENT[task.type]} />
              </div>
              <h3 style={{ fontFamily: FRED, fontWeight: 600, fontSize: 18, color: INK, margin: '2px 0 0' }}>{t(task.nameKey, lang)}</h3>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: task.bg, borderRadius: 10, padding: '3px 10px',
                  fontFamily: FRED, fontWeight: 600, fontSize: 13, color: ACCENT,
                }}>
                  {task.gem != null ? (<><span style={{ fontSize: 12 }}>⭐</span>+{task.gem}</>) : '🌱 Always on'}
                </span>
              </div>
            </button>
          ))}

          {/* My Homework — full-width on phone (2-col grid), normal card on tablet (3-col grid).
              Homework and Drawings are laid out by hand rather than coming from BASE_TASKS,
              and so were missed by the active filter above — a parent could switch either
              off in settings and the child would still be looking at the tile. */}
          {(ts.homework?.active ?? true) && (
          <button className="tuto-card tuto-wide-card" onClick={() => nav('/child/homework')}
            style={{
              background: '#fff', border: 'none', borderRadius: 22, padding: 12,
              display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14,
              cursor: 'pointer', textAlign: 'left', boxShadow: '0 6px 16px rgba(40,30,70,.09)',
            }}>
            <div style={{ width: 82, height: 82, flex: '0 0 auto', background: '#FFF1CF', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HomeworkIcon />
            </div>
            <h3 style={{ fontFamily: FRED, fontWeight: 600, fontSize: 18, color: INK, margin: 0 }}>My Homework</h3>
          </button>
          )}

          {/* My Drawings — same full-width-on-phone / normal-on-tablet shape as My Homework.
              No reward pill: the amount is decided server-side and capped per day. */}
          {(ts.drawing?.active ?? true) && (
          <button className="tuto-card tuto-wide-card" onClick={() => nav('/child/drawings')}
            style={{
              background: '#fff', border: 'none', borderRadius: 22, padding: 12,
              display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14,
              cursor: 'pointer', textAlign: 'left', boxShadow: '0 6px 16px rgba(40,30,70,.09)',
            }}>
            <div style={{ width: 82, height: 82, flex: '0 0 auto', background: '#EFE3FF', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DrawingsIcon age={child?.age} />
            </div>
            <h3 style={{ fontFamily: FRED, fontWeight: 600, fontSize: 18, color: INK, margin: 0 }}>My Drawings</h3>
          </button>
          )}
        </div>
      </div>
    </Shell>
  )
}
