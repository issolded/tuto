import { useEffect, useState } from 'react'
import { t, childLang, localeFor } from '../lib/i18n'
import { useNavigate } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'
import Shell from '../components/Shell'
import { Icon } from '../lib/parentUI'
import { supabase, storageClient, getChildGems, getTodaySummary, drawingIconUrl } from '../lib/supabase'

const ACCENT = '#f79433'
const INK = '#241f3a'
const INK_SOFT = '#8d83ad'
const LILAC = '#e7ddf6'
const FRED = "'TrRound', 'Fredoka', 'Baloo 2', sans-serif"

const HOME_CSS = `
@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
.tuto-card{ transition: transform .13s ease, box-shadow .13s ease; }
.tuto-card:hover{ transform: translateY(-3px); box-shadow: 0 12px 22px rgba(40,30,70,.15); }
.tuto-card:active{ transform: scale(.97); }
.tuto-gempill{ transition: transform .12s ease; }
.tuto-gempill:active{ transform: scale(.95); }
.tuto-task-grid{ display:grid; grid-template-columns:1fr 1fr; gap:13px; }
/* A tile alone on the last row takes the row. */
.tuto-task-grid > :last-child:nth-child(odd){ grid-column:1 / -1; }
@media (min-width:768px) {
  .tuto-task-grid{ grid-template-columns:repeat(3, 1fr); }
  .tuto-task-grid > :last-child:nth-child(odd){ grid-column:auto; }
  .tuto-task-grid > :last-child:nth-child(3n+1){ grid-column:1 / -1; }
}
`

// My Tree has no entry here on purpose — it earns no gems (see TASK_ACCENT's
// comment), so its tile skips the "+N gems" badge entirely rather than
// falling back to a number that isn't true.
const DEFAULT_TASK_GEMS = { reading: 30, math: 30, writing: 30, puzzle: 30 }


// 'tree' isn't a gem-earning task type (no task_settings entry exists for it
// — it's always on), it just needs an accent color for its tile icon.
const TASK_ACCENT = { reading: '#a98ce6', math: '#5aa9e6', writing: '#6cc28a', puzzle: '#2BA59A', tree: '#f3a35a', homework: '#e89a39', drawing: '#ef7d9d' }

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
  // src/assets/puzzle-tile-icon.svg: a grid-complete question itself — three cells filled, the
  // fourth asks.
  if (type === 'puzzle') return (
    <svg width="58" height="58" viewBox="0 0 64 64" fill="none">
      <rect x="10" y="10" width="44" height="44" rx="11" fill="#fff" stroke="#20201e" strokeWidth="4"/>
      <path d="M32 12 V52 M12 32 H52" stroke="#20201e" strokeWidth="3"/>
      <circle cx="21.5" cy="21.5" r="5" fill={c}/>
      <path d="M42.5 16 L48.5 26.5 H36.5 Z" fill={c}/>
      <rect x="16.5" y="37.5" width="10" height="10" rx="2" fill={c}/>
      <path d="M39.5 39.5 C39.5 36.5 45.5 36.5 45.5 39.5 C45.5 42 42.5 42 42.5 44.5" stroke="#20201e" strokeWidth="2.8" strokeLinecap="round"/>
      <circle cx="42.5" cy="48.3" r="1.6" fill="#20201e"/>
    </svg>
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

const todayCacheKey = (id) => `tuto_today_${id}`

// Yesterday's copy keeps its shape — the week, the bonus and what it asks for — but not what was
// done today, which it cannot know.
function cachedToday(childId) {
  try {
    const c = JSON.parse(localStorage.getItem(todayCacheKey(childId)) || 'null')
    if (!c?.today) return EMPTY_TODAY
    if (c.at === new Date().toDateString()) return { ...c.today, loaded: false }
    return { ...c.today, activities: EMPTY_TODAY.activities, today: 0, bonus: c.today.bonus && { ...c.today.bonus, earned: false }, loaded: false }
  } catch { return EMPTY_TODAY }
}

const EMPTY_TODAY = {
  today: 0, monthTreeCount: 0,
  activities: { reading: 0, math: 0, writing: 0, homework: 0, drawing: 0, puzzle: 0 },
  nearestGoal: null, hasAnyGoals: false, loaded: false,
}

// Whether to hold a place for the bonus card before the summary says: from the age it starts at.
const mayHaveBonus = (today, child) => today.bonus?.active || (!today.bonus && today.loaded === false && Number(child?.age) >= 7)



function TodayPill({ emoji, text, color, bg }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: bg, borderRadius: 999, padding: '4px 10px', fontFamily: FRED, fontWeight: 700, fontSize: 11.5, color }}>
      <span style={{ fontSize: 11 }}>{emoji}</span>{text}
    </span>
  )
}



// ── 9–11: "quest" home (design_handoff_kids_home_ages/Kids Home 9-11.html) ──────
// The handoff's layout and style — lighter outlines, a hard drop shadow, pastel icon wells — on
// the data we have. What it drew and we do not hold is left out rather than faked: no XP, no
// league, no shop. Its XP bar became the week's activity, one bar a day, because that is the one
// progress figure that is true; its level rings show a real level where there is one (maths) and
// this week's count everywhere else. A puzzle band ("10-11") is an age range, not a level.
const MID = {
  ink: '#20201e', soft: '#6f6a64', bg: '#f6f4fb', purple: '#a98ce6', green: '#79cf86', orange: '#f79433',
  lilac: '#e7ddf6', mint: '#d4eed9', sky: '#d4e4fb', peach: '#fce4cf', teal: '#d4f0ee', cream: '#FFF1CF',
}
const MID_CSS = `
.mid-sub{ transition: transform .12s ease; }
.mid-sub:active{ transform: translateY(2px) scale(.98); }
.mid-grid{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.mid-grid > :last-child:nth-child(odd){ grid-column:1 / -1; }
@media (min-width:768px){
  .mid-grid{ grid-template-columns:repeat(3,1fr); }
  .mid-grid > :last-child:nth-child(odd){ grid-column:auto; }
  .mid-grid > :last-child:nth-child(3n+1){ grid-column:1 / -1; }
}
`
const MID_TILES = [
  { type: 'math',     nameKey: 'task_math',     route: '/child/math',     well: MID.sky },
  { type: 'reading',  nameKey: 'task_reading',  route: '/child/library',  well: MID.lilac },
  { type: 'puzzle',   nameKey: 'task_puzzle',   route: '/child/puzzle',   well: MID.teal },
  { type: 'writing',  nameKey: 'task_writing',  route: '/child/stories',  well: MID.mint },
  { type: 'homework', nameKey: 'task_homework', route: '/child/homework', well: MID.cream },
  { type: 'drawing',  nameKey: 'task_drawing',  route: '/child/drawings', well: '#EFE3FF' },
  { type: 'tree',     nameKey: 'task_tree',     route: '/child/task',     well: MID.peach },
]
// The order the quest suggests things in: the scored, paying ones first.
const QUEST_ORDER = ['math', 'reading', 'puzzle', 'writing', 'drawing', 'homework']
const QUEST_TARGET = 3

function Ring({ value, label, color }) {
  const pct = Math.max(0, Math.min(1, value)) * 360
  return (
    <div style={{ width: 42, height: 42, borderRadius: '50%', flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `conic-gradient(${color} ${pct}deg, #ece8f3 ${pct}deg)` }}>
      <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#fff', border: `2px solid ${MID.ink}`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 10, color: MID.ink }}>{label}</span>
    </div>
  )
}

// The day's all-rounder bonus: one slot per activity it asks for, filled with that activity's icon
// once it is done today. The server decides the set (what the parent has on) and pays; this only
// shows it. `tone` is 'mid' for the outlined 9–11 card, 'plain' inside the other ages' Today card.
const BONUS_ROUTES = { math: '/child/math', reading: '/child/library', writing: '/child/stories', drawing: '/child/drawings', puzzle: '/child/puzzle' }
const BONUS_NAMES = { math: 'task_math', reading: 'task_reading', writing: 'task_writing', drawing: 'task_drawing', puzzle: 'task_puzzle' }

function BonusCard({ today, lang, nav, tone = 'mid', placeholder = false }) {
  const [why, setWhy] = useState(false)
  const [open, setOpen] = useState(false)
  const b = today.bonus
  // Not known yet (first visit on this device): hold the card's place rather than let it arrive
  // under a finger. Only where the bonus can apply at all.
  if (!b && today.loaded === false && placeholder) {
    return <div style={{ height: tone === 'mid' ? 159 : 102, borderRadius: tone === 'mid' ? 24 : 12, background: tone === 'mid' ? 'rgba(220,208,243,.55)' : '#f0f1f5' }} />
  }
  if (!b?.active || !b.types?.length) return null
  const done = (k) => (today.activities?.[k] || 0) > 0
  const next = b.types.find(k => !done(k))
  const count = b.types.filter(done).length
  const mid = tone === 'mid'
  const grot = "'Space Grotesk', 'Manrope', sans-serif"
  const fred = { fontFamily: mid ? FRED : grot, fontWeight: 600, color: mid ? '#20201e' : '#1b1f2a' }
  const tagColor = mid ? (b.earned ? '#b7720f' : '#7c63c8') : '#5860d8'
  return (
    <div style={mid ? { position: 'relative', background: b.earned ? 'linear-gradient(135deg,#fff3c4,#fde7a3)' : 'linear-gradient(135deg,#e7ddf6,#dcd0f3)',
      border: '3px solid #20201e', borderRadius: 24, padding: '15px 16px', boxShadow: '0 8px 0 rgba(32,32,30,.10)', overflow: 'hidden' } : {}}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...fred, fontSize: 12, letterSpacing: '.6px', textTransform: 'uppercase', color: tagColor }}>🏅 {t('bonus_title', lang)}</span>
        <button onClick={() => setWhy(w => !w)} aria-label="?" style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${tagColor}`, background: 'transparent',
          color: tagColor, fontWeight: 800, fontSize: 11, lineHeight: 1, cursor: 'pointer', padding: 0 }}>?</button>
      </div>
      {why && <div style={{ fontWeight: 700, fontSize: 12.5, color: '#6f6a64', lineHeight: 1.4, marginTop: 6, maxWidth: 280 }}>{t('bonus_why', lang)}</div>}
      <div style={{ ...fred, fontSize: mid ? 19 : 16, marginTop: 5, lineHeight: 1.15, maxWidth: mid ? 'calc(100% - 64px)' : undefined }}>
        {(b.earned ? t('bonus_earned', lang) : t('bonus_todo', lang)).replace('%n%', b.gems)}
      </div>

      {/* How far along, as a bar — and what is behind it, one slot per activity, on request. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, maxWidth: mid ? 'calc(100% - 64px)' : undefined }}>
        <div style={{ flex: 1, height: mid ? 11 : 6, border: mid ? '2.5px solid #20201e' : 'none', borderRadius: 999, background: mid ? '#fff' : '#eceef3', overflow: 'hidden' }}>
          <i style={{ display: 'block', height: '100%', width: `${(count / b.types.length) * 100}%`, background: mid ? '#79cf86' : '#2f9e63' }} />
        </div>
        <span style={{ fontWeight: 800, fontSize: 13, color: '#6f6a64' }}>{count}/{b.types.length}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, position: 'relative', zIndex: 1, maxWidth: mid ? 'calc(100% - 64px)' : '100%' }}>
        <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 800, fontSize: 12.5,
          color: tagColor, fontFamily: "'Nunito', sans-serif" }}>{open ? t('bonus_hide', lang) + ' ▴' : t('bonus_show', lang) + ' ▾'}</button>
        {mid && !b.earned && next && (
          <button onClick={() => nav(BONUS_ROUTES[next], { state: { from: '/child/home' } })} style={{ marginLeft: 'auto', background: '#f79433', color: '#fff', ...fred,
            fontSize: 14, border: '2.5px solid #20201e', borderRadius: 999, padding: '6px 13px', boxShadow: '0 4px 0 rgba(32,32,30,.25)', cursor: 'pointer',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {/* The emoji says "this one" without the word "next" that did not fit. */}
            {TYPE_EMOJI[next]} {t(BONUS_NAMES[next], lang)} →
          </button>
        )}
      </div>
      {open && (
        <div style={{ display: 'flex', gap: 8, marginTop: 11, flexWrap: 'wrap' }}>
          {b.types.map(k => (
            <button key={k} onClick={() => nav(BONUS_ROUTES[k], { state: { from: '/child/home' } })} aria-label={t(BONUS_NAMES[k], lang)}
              style={{ position: 'relative', width: 46, height: 46, borderRadius: mid ? 14 : 12, cursor: 'pointer', padding: 0,
                border: mid ? `2.5px ${done(k) ? 'solid #20201e' : 'dashed #b9b0cf'}` : `1.5px ${done(k) ? 'solid #5860d8' : 'dashed #cfd3e0'}`,
                background: done(k) ? '#fff' : 'rgba(255,255,255,.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <div style={{ transform: 'scale(.6)', opacity: done(k) ? 1 : 0.35, filter: done(k) ? 'none' : 'grayscale(1)' }}>
                {k === 'drawing' ? <DrawingsIcon /> : <TaskIcon type={k} c={TASK_ACCENT[k] || '#a98ce6'} />}
              </div>
              {done(k) && <span style={{ position: 'absolute', right: -1, bottom: -1, width: 17, height: 17, borderRadius: '50%', background: mid ? '#79cf86' : '#2f9e63',
                border: mid ? '2px solid #20201e' : '2px solid #fff', color: '#fff', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
      {mid && <div style={{ position: 'absolute', right: -4, bottom: -10 }}><TutoMascot size={70} color="#79cf86" /></div>}
    </div>
  )
}

// The week, one bar a day. A bar is a button: tapping a day says what was done on it. Today is
// picked to begin with. `teen` draws the flat 12+ version.
const TYPE_EMOJI = { math: '🔢', reading: '📚', writing: '✏️', drawing: '🎨', puzzle: '🧩', homework: '📸' }

function WeekChart({ week: weekIn, lang, teen = false }) {
  let week = weekIn
  const [sel, setSel] = useState(6)
  // Before the first summary: seven empty days, so the card is already its full height.
  if (!week.length) {
    const now = new Date()
    week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i))
      return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, count: 0, byType: {} }
    })
  }
  const max = Math.max(3, ...week.map(d => d.count))
  const fmt = (iso, weekday) => new Intl.DateTimeFormat(localeFor(lang), { weekday }).format(new Date(`${iso}T12:00:00`))
  const day = week[sel] || week[week.length - 1]
  const accent = teen ? '#5860d8' : '#a98ce6'
  const parts = Object.entries(day.byType || {}).filter(([, n]) => n > 0)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: teen ? 7 : 8, height: teen ? 64 : 56, marginTop: teen ? 12 : 8 }}>
        {week.map((d, i) => {
          const on = i === sel
          const h = d.count ? Math.max(teen ? 12 : 16, (d.count / max) * (teen ? 46 : 40)) : (teen ? 6 : 8)
          const fill = d.count ? (on ? (teen ? '#3b43b8' : '#f79433') : accent) : (teen ? '#eceef3' : '#f0ecf6')
          return (
            <button key={d.date} onClick={() => setSel(i)} aria-label={`${fmt(d.date, 'long')}: ${d.count}`} style={{ flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: teen ? 6 : 4, height: '100%', justifyContent: 'flex-end', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
              {on && d.count > 0 && <span style={{ fontWeight: 800, fontSize: 10.5, color: teen ? '#3b43b8' : '#20201e' }}>{d.count}</span>}
              <div style={{ width: '100%', maxWidth: teen ? 22 : 26, height: h, borderRadius: teen ? 5 : 7, background: fill, transition: 'height .5s cubic-bezier(.2,.9,.3,1.1), background .2s',
                border: teen ? 'none' : '2.5px solid #20201e', outline: on && !d.count ? `2px solid ${accent}` : 'none' }} />
              <span style={{ fontWeight: 800, fontSize: 10.5, color: on ? (teen ? '#5860d8' : '#20201e') : (teen ? '#a4a8b4' : '#6f6a64') }}>{fmt(d.date, 'narrow')}</span>
            </button>
          )
        })}
      </div>
      <div style={{ marginTop: 10, paddingTop: 9, borderTop: `1px dashed ${teen ? '#e7e9ef' : '#e4def0'}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        fontWeight: 700, fontSize: 12.5, color: teen ? '#737888' : '#6f6a64' }}>
        <span style={{ color: teen ? '#1b1f2a' : '#20201e', fontWeight: 800 }}>{fmt(day.date, 'long')}</span>
        {parts.length
          ? <>
              <span>· {t('home_n_done', lang).replace('%n%', day.count)}</span>
              {parts.map(([k, n]) => <span key={k}>{TYPE_EMOJI[k] || '•'} {n}</span>)}
            </>
          : <span>· {t('day_nothing', lang)}</span>}
      </div>
    </div>
  )
}

// 🔥 and a number meant nothing on its own. The chip says "days", and a tap says what it counts.
function StreakChip({ n, lang, style, onToggle }) {
  if (!(n > 0)) return null
  return (
    <button onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '7px 12px', cursor: 'pointer',
      border: 'none', background: '#fff', boxShadow: '0 3px 9px rgba(40,30,70,.08)', fontFamily: FRED, fontWeight: 600, fontSize: 14.5, color: '#ef7a3a', ...style }}>
      🔥 {t('streak_days', lang).replace('%n%', n)}
    </button>
  )
}

function MidHome({ child, lang, gems, today, ts, nav }) {
  const [streakWhy, setStreakWhy] = useState(false)
  const tiles = MID_TILES.filter(x => x.type === 'tree' || (ts[x.type]?.active ?? true))
  const gemFor = (type) => ts[type]?.gems ?? DEFAULT_TASK_GEMS[type] ?? (type === 'homework' ? 25 : type === 'drawing' ? 20 : null)
  const doneToday = Object.values(today.activities || {}).reduce((a, b) => a + b, 0)
  const next = QUEST_ORDER.find(k => (ts[k]?.active ?? true) && !(today.activities?.[k] > 0))
  const nextTile = MID_TILES.find(x => x.type === next)
  const week = today.week?.length ? today.week : []
  const weekTotal = week.reduce((a, d) => a + d.count, 0)
  const card = { background: '#fff', border: `3px solid ${MID.ink}`, borderRadius: 22, boxShadow: '0 6px 0 rgba(32,32,30,.08)' }
  const fred = { fontFamily: FRED, fontWeight: 600, color: MID.ink }
  const goal = today.nearestGoal

  const ringFor = (type) => {
    if (type === 'math' && today.mathLevel != null) return { value: (today.weekByType?.math || 0) / 5, label: t('home_level', lang).replace('%n%', today.mathLevel) }
    if (type === 'tree') return { value: (today.today || 0) / 4, label: `${today.today || 0}/4` }
    const n = today.weekByType?.[type] || 0
    return { value: n / 5, label: String(n) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{MID_CSS}</style>

      {/* Who, the run of days, and gems. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 54, height: 54, borderRadius: '50%', background: MID.lilac, border: `3px solid ${MID.ink}`, boxShadow: '0 4px 0 rgba(32,32,30,.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flex: '0 0 auto' }}>
          {child?.avatar_url?.startsWith('http')
            ? <img src={child.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : child?.avatar_url ? <span style={{ fontSize: 28 }}>{child.avatar_url}</span>
              : <TutoMascot size={44} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...fred, fontSize: 19, lineHeight: 1.1 }}>{child?.name ?? t('friend', lang)}</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: MID.soft }}>{t('hello_name', lang)} 👋</div>
        </div>
        <StreakChip n={today.streak} lang={lang} onToggle={() => setStreakWhy(w => !w)} />
        <button className="tuto-gempill" onClick={() => nav('/child/gems')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fff', border: 'none', borderRadius: 999,
          padding: '7px 12px', boxShadow: '0 3px 9px rgba(40,30,70,.08)', cursor: 'pointer', ...fred, fontSize: 15, color: MID.orange }}>
          ⭐ {gems === null ? '…' : gems}
        </button>
      </div>

      {streakWhy && today.streak > 0 && (
        <div style={{ background: '#fff4e8', borderRadius: 14, padding: '9px 12px', fontWeight: 700, fontSize: 13, color: MID.ink, lineHeight: 1.4 }}>
          🔥 {t('streak_explain', lang).replace('%n%', today.streak)}
        </div>
      )}

      {/* The week, one bar a day — where the handoff had an XP bar. */}
      <div style={{ background: '#fff', borderRadius: 18, padding: '12px 15px', boxShadow: '0 4px 12px rgba(40,30,70,.07)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ ...fred, fontWeight: 500, fontSize: 13.5, color: MID.soft }}>{t('home_this_week', lang)}</span>
          <span style={{ ...fred, fontSize: 15 }}>{t('home_n_done', lang).replace('%n%', weekTotal)}</span>
        </div>
        <WeekChart week={week} lang={lang} />
      </div>

      {/* The all-rounder bonus where the handoff had its daily quest; the plain three-things quest
          only where the bonus is off (a parent's choice, or a child under seven). */}
      {mayHaveBonus(today, child) ? <BonusCard today={today} lang={lang} nav={nav} placeholder /> : (
      <div style={{ position: 'relative', background: 'linear-gradient(135deg,#e7ddf6,#dcd0f3)', border: `3px solid ${MID.ink}`, borderRadius: 24,
        padding: '15px 16px', boxShadow: '0 8px 0 rgba(32,32,30,.10)', overflow: 'hidden' }}>
        <div style={{ ...fred, fontSize: 12, letterSpacing: '.6px', textTransform: 'uppercase', color: '#7c63c8' }}>{t('home_quest_tag', lang)}</div>
        <div style={{ ...fred, fontSize: 21, marginTop: 5, maxWidth: 200, lineHeight: 1.12 }}>
          {doneToday >= QUEST_TARGET ? t('home_quest_done', lang) : t('home_quest_title', lang)}
        </div>
        <div style={{ height: 11, border: `2.5px solid ${MID.ink}`, borderRadius: 999, background: '#fff', overflow: 'hidden', marginTop: 10, maxWidth: 170 }}>
          <i style={{ display: 'block', height: '100%', width: `${Math.min(1, doneToday / QUEST_TARGET) * 100}%`, background: MID.green }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11, position: 'relative', zIndex: 1, maxWidth: 'calc(100% - 70px)' }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: MID.soft }}>{Math.min(doneToday, QUEST_TARGET)}/{QUEST_TARGET}</span>
          {doneToday < QUEST_TARGET && nextTile && (
            <button onClick={() => nav(nextTile.route, { state: { from: '/child/home' } })} style={{ marginLeft: 'auto', background: MID.orange, color: '#fff', ...fred,
              fontSize: 14.5, border: `2.5px solid ${MID.ink}`, borderRadius: 999, padding: '7px 14px', boxShadow: '0 4px 0 rgba(32,32,30,.25)', cursor: 'pointer',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {t('home_quest_next', lang).replace('%task%', t(nextTile.nameKey, lang))} →
            </button>
          )}
        </div>
        <div style={{ position: 'absolute', right: -4, bottom: -10 }}><TutoMascot size={82} color="#79cf86" /></div>
      </div>
      )}

      <div style={{ ...fred, fontSize: 18, marginTop: 2 }}>{t('home_activities', lang)}</div>
      <div className="mid-grid">
        {tiles.map(x => {
          const r = ringFor(x.type)
          const g = x.type === 'tree' ? null : gemFor(x.type)
          return (
            <button key={x.type} className="mid-sub" onClick={() => nav(x.route, { state: { from: '/child/home' } })}
              style={{ ...card, padding: 13, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: x.well, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <div style={{ transform: 'scale(.62)' }}>
                    {x.type === 'homework' ? <HomeworkIcon /> : x.type === 'drawing' ? <DrawingsIcon age={child?.age} /> : <TaskIcon type={x.type} c={TASK_ACCENT[x.type]} />}
                  </div>
                </div>
                <Ring value={r.value} label={r.label} color={TASK_ACCENT[x.type] || MID.purple} />
              </div>
              <div style={{ ...fred, fontSize: 17, marginTop: 10, lineHeight: 1.15 }}>{t(x.nameKey, lang)}</div>
              <div style={{ ...fred, fontSize: 13, color: '#b7720f', marginTop: 2 }}>
                {g != null ? `⭐ +${g}` : x.type === 'tree' ? t('home_always_on', lang) : ''}
              </div>
            </button>
          )
        })}
      </div>

      {/* The goal the gems are going towards — the one real "progress to a prize" there is. */}
      <button onClick={() => nav('/child/goals')} style={{ ...card, padding: '12px 15px', textAlign: 'left', cursor: 'pointer', background: '#f9edc5' }}>
        {goal ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ ...fred, fontSize: 15.5 }}>{t('home_goal', lang)}: {goal.icon} {goal.name}</span>
              <span style={{ fontWeight: 800, fontSize: 12.5, color: MID.soft, whiteSpace: 'nowrap' }}>{gems ?? 0}/{goal.bt_cost}</span>
            </div>
            <div style={{ height: 12, border: `2.5px solid ${MID.ink}`, borderRadius: 999, background: '#fff', overflow: 'hidden', marginTop: 8 }}>
              <i style={{ display: 'block', height: '100%', width: `${Math.min(1, (gems ?? 0) / goal.bt_cost) * 100}%`, background: MID.purple }} />
            </div>
          </>
        ) : (
          <span style={{ ...fred, fontWeight: 500, fontSize: 14, color: MID.soft }}>
            {today.hasAnyGoals ? t('home_goals_all_done', lang) + ' 🎉' : t('home_no_goals', lang) + ' 🎯'}
          </span>
        )}
      </button>
    </div>
  )
}

// What to do next, for the homes that point at one thing: the first activity of the day's bonus
// not done yet, else the first scored one not done today, else maths.
function nextActivity(today, ts) {
  const done = (k) => (today.activities?.[k] || 0) > 0
  const b = today.bonus
  const pool = b?.active && !b.earned ? b.types : QUEST_ORDER.filter(k => ts[k]?.active ?? true)
  const k = pool.find(x => !done(x)) || (ts.math?.active === false ? pool[0] : 'math')
  return MID_TILES.find(x => x.type === k) || MID_TILES[0]
}

// ── 12–15: "focused" home (design_handoff_kids_home_ages/Kids Home 12-15.html) ────
// A flat dashboard in one accent: stats, what's next, the week, and the activities as rows. The
// handoff's class rank became gems, its "continue" the next thing to do — we do not know where a
// lesson was left — and its level bars show a level only for maths; elsewhere this week's count.
const TEEN = { ink: '#1b1f2a', soft: '#737888', faint: '#a4a8b4', line: '#e7e9ef', bg: '#f5f6f8', accent: '#5860d8', track: '#eceef3', pos: '#2f9e63' }
const GROT = "'Space Grotesk', 'Manrope', sans-serif"
const MAN = "'Manrope', 'Nunito', sans-serif"

function TeenHome({ child, lang, gems, today, ts, nav }) {
  const tiles = MID_TILES.filter(x => x.type === 'tree' || (ts[x.type]?.active ?? true))
  const week = today.week || []
  const weekTotal = week.reduce((a, d) => a + d.count, 0)
  const next = nextActivity(today, ts)
  const b = today.bonus
  const bonusLeft = b?.active && !b.earned
  const progress = bonusLeft ? b.types.filter(k => today.activities?.[k] > 0).length / b.types.length : null
  const boxed = { background: '#fff', border: `1.5px solid ${TEEN.line}`, borderRadius: 14 }
  const gemFor = (type) => ts[type]?.gems ?? DEFAULT_TASK_GEMS[type] ?? (type === 'homework' ? 25 : type === 'drawing' ? 20 : null)
  const subFor = (type) => {
    if (type === 'tree') return `${today.today || 0} ${t('tree_leaves_today', lang)}`
    const n = today.weekByType?.[type] || 0
    if (type === 'math' && today.mathLevel != null) return `${t('home_level_long', lang).replace('%n%', today.mathLevel)} · ${t('home_this_week_n', lang).replace('%n%', n)}`
    return t('home_this_week_n', lang).replace('%n%', n)
  }
  const fillFor = (type) => (type === 'tree' ? (today.today || 0) / 4 : (today.weekByType?.[type] || 0) / 5)
  const goal = today.nearestGoal

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13, fontFamily: MAN, color: TEEN.ink }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ width: 42, height: 42, borderRadius: 13, background: '#eef0f4', border: `1.5px solid ${TEEN.line}`, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', fontFamily: GROT, fontWeight: 700, color: TEEN.accent }}>
          {child?.avatar_url?.startsWith('http') ? <img src={child.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : child?.avatar_url ? <span style={{ fontSize: 22 }}>{child.avatar_url}</span> : (child?.name || '?').slice(0, 1).toLocaleUpperCase(lang)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: TEEN.soft, fontWeight: 600 }}>{t('home_welcome_back', lang)}</div>
          <div style={{ fontFamily: GROT, fontWeight: 600, fontSize: 18, lineHeight: 1.1 }}>{child?.name}</div>
        </div>
        <button onClick={() => nav('/child/gems')} style={{ ...boxed, borderRadius: 10, padding: '7px 11px', fontWeight: 800, fontSize: 14, cursor: 'pointer', color: TEEN.ink, fontFamily: MAN }}>
          ⭐ <span style={{ fontFamily: GROT }}>{gems === null ? '…' : gems}</span>
        </button>
      </div>

      <div style={{ display: 'flex', gap: 9 }}>
        {[[today.streak || 0, t('home_day_streak', lang)], [weekTotal, t('home_week_done', lang)], [gems ?? 0, t('home_gems_label', lang)]].map(([v, l]) => (
          <div key={l} style={{ ...boxed, flex: 1, padding: '11px 10px' }}>
            <div style={{ fontFamily: GROT, fontWeight: 700, fontSize: 20, lineHeight: 1 }}>{v}</div>
            <div style={{ fontSize: 11.5, color: TEEN.soft, fontWeight: 600, marginTop: 5 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ background: TEEN.accent, borderRadius: 18, padding: '15px 16px', color: '#fff', position: 'relative' }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', opacity: 0.8 }}>{t('home_up_next', lang)}</div>
        <div style={{ fontFamily: GROT, fontWeight: 600, fontSize: 19, marginTop: 6, paddingRight: 80 }}>{t(next.nameKey, lang)}</div>
        <div style={{ fontSize: 12.5, opacity: 0.85, fontWeight: 600, marginTop: 3, paddingRight: 80 }}>{subFor(next.type)}</div>
        {/* Always there, hidden when there is nothing to show, so the card keeps one height. */}
        <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.28)', marginTop: 12, overflow: 'hidden', marginRight: 80, visibility: progress != null ? 'visible' : 'hidden' }}>
          <i style={{ display: 'block', height: '100%', width: `${(progress || 0) * 100}%`, background: '#fff', transition: 'width .5s ease' }} />
        </div>
        <button onClick={() => nav(next.route, { state: { from: '/child/home' } })} style={{ position: 'absolute', right: 14, bottom: 14, background: '#fff', color: TEEN.accent,
          fontFamily: GROT, fontWeight: 600, fontSize: 13.5, border: 'none', borderRadius: 10, padding: '9px 15px', cursor: 'pointer' }}>{t('home_open', lang)}</button>
      </div>

      {mayHaveBonus(today, child) && (
        <div style={{ ...boxed, borderRadius: 16, padding: '14px 15px' }}>
          <BonusCard today={today} lang={lang} nav={nav} tone="plain" placeholder />
        </div>
      )}

      <div style={{ ...boxed, borderRadius: 16, padding: '14px 15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 700, fontSize: 13.5 }}>{t('home_this_week', lang)}</span>
          <span style={{ fontFamily: GROT, fontWeight: 700, fontSize: 13.5, color: TEEN.soft }}>{t('home_n_done', lang).replace('%n%', weekTotal)}</span>
        </div>
        <WeekChart week={week} lang={lang} teen />
      </div>

      <div style={{ fontFamily: GROT, fontWeight: 600, fontSize: 15, marginTop: 3 }}>{t('home_activities', lang)}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tiles.map(x => {
          const g = x.type === 'tree' ? null : gemFor(x.type)
          const color = TASK_ACCENT[x.type] || TEEN.accent
          return (
            <button key={x.type} onClick={() => nav(x.route, { state: { from: '/child/home' } })} style={{ ...boxed, display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', cursor: 'pointer', textAlign: 'left', fontFamily: MAN, color: TEEN.ink }}>
              <span style={{ width: 7, height: 34, borderRadius: 4, background: color, flex: '0 0 auto' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: GROT, fontWeight: 600, fontSize: 15.5 }}>{t(x.nameKey, lang)}</div>
                <div style={{ fontSize: 12, color: TEEN.soft, fontWeight: 600, marginTop: 1 }}>{subFor(x.type)}</div>
                <div style={{ height: 5, borderRadius: 3, background: TEEN.track, overflow: 'hidden', marginTop: 7 }}>
                  <i style={{ display: 'block', height: '100%', borderRadius: 3, width: `${Math.min(1, fillFor(x.type)) * 100}%`, background: color }} />
                </div>
              </div>
              <div style={{ fontFamily: GROT, fontWeight: 700, fontSize: 13, color: TEEN.soft, flex: '0 0 auto' }}>{g != null ? `+${g}` : ''}</div>
            </button>
          )
        })}
      </div>

      <button onClick={() => nav('/child/goals')} style={{ ...boxed, borderRadius: 16, padding: '12px 15px', textAlign: 'left', cursor: 'pointer', fontFamily: MAN, color: TEEN.ink }}>
        {goal ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>{t('home_goal', lang)}: {goal.icon} {goal.name}</span>
              <span style={{ fontFamily: GROT, fontWeight: 700, fontSize: 13, color: TEEN.soft }}>{gems ?? 0}/{goal.bt_cost}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: TEEN.track, overflow: 'hidden', marginTop: 8 }}>
              <i style={{ display: 'block', height: '100%', width: `${Math.min(1, (gems ?? 0) / goal.bt_cost) * 100}%`, background: TEEN.accent }} />
            </div>
          </>
        ) : <span style={{ fontWeight: 600, fontSize: 13.5, color: TEEN.soft }}>{today.hasAnyGoals ? t('home_goals_all_done', lang) : t('home_no_goals', lang)}</span>}
      </button>
    </div>
  )
}

// ── 6–8: "playful" home (design_handoff_kids_home_ages/Kids Home 6-8.html) ────────
// Fewer words, bigger things: a greeting, Tuto front and centre, the day's bonus for a seven- or
// eight-year-old, and every activity as a big tile. Progress is stars, not numbers — a star for
// each time this week, up to five.
function Stars({ n }) {
  return (
    <span style={{ fontSize: 13, letterSpacing: 1, color: '#f5d35f', WebkitTextStroke: '.6px #d8a93b' }}>
      {'★'.repeat(n)}<b style={{ color: '#e4e0d4', WebkitTextStroke: '.6px #cbc6b6' }}>{'★'.repeat(5 - n)}</b>
    </span>
  )
}

const YOUNG_WELL = { math: '#D4E4FB', reading: '#E7DDF6', writing: '#D4EED9', puzzle: '#D9F3F1', homework: '#FFF1CF', drawing: '#F8D9E6', tree: '#FCE4CF' }

function YoungHome({ child, lang, gems, today, ts, nav, greetingKey }) {
  const [streakWhy, setStreakWhy] = useState(false)
  const tiles = MID_TILES.filter(x => x.type === 'tree' || (ts[x.type]?.active ?? true))
  const gemFor = (type) => ts[type]?.gems ?? DEFAULT_TASK_GEMS[type] ?? (type === 'homework' ? 25 : type === 'drawing' ? 20 : null)
  const starsFor = (type) => Math.min(5, type === 'tree' ? (today.today || 0) : (today.weekByType?.[type] || 0))
  const goal = today.nearestGoal
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#6f6a64' }}>{t(greetingKey, lang)}, {child?.name ?? t('friend', lang)}!</div>
          <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 25, color: '#20201e', lineHeight: 1.12, letterSpacing: '-.5px', marginTop: 3 }}>{t('home_lets_play', lang)}</div>
        </div>
        <button className="tuto-gempill" onClick={() => nav('/child/gems')} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
          background: '#fff', border: 'none', borderRadius: 999, padding: '8px 14px', boxShadow: '0 3px 10px rgba(40,30,70,.12)', cursor: 'pointer' }}>
          <span style={{ fontSize: 16 }}>⭐</span>
          <span style={{ fontFamily: FRED, fontWeight: 600, fontSize: 17, color: ACCENT }}>{gems === null ? '…' : gems}</span>
        </button>
      </div>

      {/* Tuto front and centre, with the two things a young child can count: leaves today, and
          days in a row. */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '4px 0' }}>
        <div style={{ position: 'absolute', width: 190, height: 190, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.85), rgba(255,255,255,0) 70%)', top: -18 }} />
        <TutoMascot size={138} style={{ position: 'relative', animation: 'float 3.2s ease-in-out infinite' }} />
        <div style={{ display: 'flex', gap: 8, position: 'relative', flexWrap: 'wrap', justifyContent: 'center' }}>
          <TodayPill emoji="🌱" text={`${today.today || 0} ${t('tree_leaves_today', lang)}`} color="#37a06f" bg="rgba(255,255,255,.85)" />
          <StreakChip n={today.streak} lang={lang} onToggle={() => setStreakWhy(w => !w)} style={{ padding: '5px 11px', fontSize: 13, boxShadow: 'none', background: 'rgba(255,255,255,.85)' }} />
        </div>
        {streakWhy && today.streak > 0 && (
          <div style={{ position: 'relative', background: '#fff', borderRadius: 14, padding: '9px 12px', fontWeight: 700, fontSize: 13, color: '#20201e', lineHeight: 1.4, maxWidth: 320, textAlign: 'center' }}>
            {t('streak_explain', lang).replace('%n%', today.streak)}
          </div>
        )}
      </div>

      {mayHaveBonus(today, child) && <BonusCard today={today} lang={lang} nav={nav} placeholder />}

      <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 18, color: '#20201e' }}>{t('home_pick_game', lang)}</div>
      <div className="tuto-task-grid">
        {tiles.map(x => {
          const g = x.type === 'tree' ? null : gemFor(x.type)
          return (
            <button key={x.type} className="tuto-card" onClick={() => nav(x.route, { state: { from: '/child/home' } })} style={{ background: '#fff', border: 'none',
              borderRadius: 22, padding: '12px 12px 13px', display: 'flex', flexDirection: 'column', gap: 7, cursor: 'pointer', textAlign: 'left', boxShadow: '0 6px 16px rgba(40,30,70,.09)' }}>
              <div style={{ background: YOUNG_WELL[x.type], height: 78, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {x.type === 'homework' ? <HomeworkIcon /> : x.type === 'drawing' ? <DrawingsIcon age={child?.age} /> : <TaskIcon type={x.type} c={TASK_ACCENT[x.type]} />}
              </div>
              <h3 style={{ fontFamily: FRED, fontWeight: 600, fontSize: 18, color: INK, margin: '2px 0 0' }}>{t(x.nameKey, lang)}</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <Stars n={starsFor(x.type)} />
                {g != null
                  ? <span style={{ fontFamily: FRED, fontWeight: 600, fontSize: 13, color: ACCENT }}>⭐+{g}</span>
                  : <span style={{ fontFamily: FRED, fontWeight: 600, fontSize: 12, color: '#37a06f' }}>🌱 {t('home_always_on', lang)}</span>}
              </div>
            </button>
          )
        })}
      </div>

      <button onClick={() => nav('/child/goals')} style={{ background: '#fff', border: 'none', borderRadius: 18, padding: '12px 15px', textAlign: 'left',
        cursor: 'pointer', boxShadow: '0 4px 12px rgba(40,30,70,.07)', fontFamily: FRED, fontWeight: 600, color: INK }}>
        {goal ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 15 }}>
              <span>🎯 {goal.icon} {goal.name}</span><span style={{ color: INK_SOFT, fontSize: 13 }}>{gems ?? 0}/{goal.bt_cost}</span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: '#f0ecf6', overflow: 'hidden', marginTop: 8 }}>
              <i style={{ display: 'block', height: '100%', width: `${Math.min(1, (gems ?? 0) / goal.bt_cost) * 100}%`, background: '#a98ce6' }} />
            </div>
          </>
        ) : <span style={{ fontSize: 14, color: INK_SOFT }}>{today.hasAnyGoals ? t('home_goals_all_done', lang) + ' 🎉' : t('home_no_goals', lang) + ' 🎯'}</span>}
      </button>
    </div>
  )
}

export default function ChildHome() {
  const nav = useNavigate()
  const [child, setChild] = useState(() => JSON.parse(localStorage.getItem('child') || 'null'))
  const lang = childLang(child)
  // The greeting follows the clock, and the clock is the child's device.
  const hour = new Date().getHours()
  const greetingKey = hour < 12 ? 'greeting_morning' : hour < 18 ? 'greeting_afternoon' : 'greeting_evening'
  const band = bandFor(child?.age)
  const [gems, setGems] = useState(null)
  // Drawn from the last summary this device saw, then replaced when the fresh one arrives. The
  // week chart and the bonus card used to appear a beat after everything else and push the
  // activity tiles down under a child's finger — a tap meant for Homework landed on Puzzles.
  const [today, setToday] = useState(() => cachedToday(child?.id))

  const ts = child?.task_settings || {}
  useEffect(() => {
    if (!localStorage.getItem('family_code')) { nav('/setup', { replace: true }); return }
    if (!child?.id) { nav('/child', { replace: true }); return }

    getChildGems(child.id).then(setGems)
    getTodaySummary(child.id).then(fresh => {
      setToday({ ...fresh, loaded: true })
      try { localStorage.setItem(todayCacheKey(child.id), JSON.stringify({ at: new Date().toDateString(), today: fresh })) } catch { /* private mode */ }
    })

    // Settings belong to the parent and can change at any moment, so they are re-read on
    // every visit here rather than frozen at PIN entry — otherwise turning an activity off
    // would not reach the child until they next logged in, which they rarely do.
    // storageClient, not the shared client: this is a child-side read and must not run
    // against a parent session that happens to be persisted in the same browser.
    storageClient
      .from('children')
      // `language` belongs in this list for the same reason task_settings does: the refresh
      // overwrites the stored child, so anything missing here is not merely stale — it is
      // erased. Setting a child to Turkish in the parent app took effect until they next
      // opened the home screen, which wiped it back to the default.
      .select('id, name, age, task_settings, language, avatar_url')
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
    <Shell active="home" background={band === 'mid' ? MID.bg : band === 'mature' ? TEEN.bg : LILAC}>
      <style>{HOME_CSS}</style>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '54px 22px 96px', fontFamily: "'Nunito', sans-serif" }}>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button onClick={() => nav('/child/settings')} style={{ display: 'flex', alignItems: 'center', gap: 8, border: band === 'young' ? 'none' : '2px solid #20201e', background: '#fff', color: INK, borderRadius: 14, padding: '10px 14px', fontFamily: FRED, fontWeight: 600, cursor: 'pointer' }}>
            <Icon name="gear" size={20} />{t('sc_settings', lang)}
          </button>
        </div>
        {band === 'mid' ? <MidHome child={child} lang={lang} gems={gems} today={today} ts={ts} nav={nav} />
          : band === 'mature' ? <TeenHome child={child} lang={lang} gems={gems} today={today} ts={ts} nav={nav} />
            : <YoungHome child={child} lang={lang} gems={gems} today={today} ts={ts} nav={nav} greetingKey={greetingKey} />}
      </div>
    </Shell>
  )
}
