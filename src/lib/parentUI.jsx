// Tuto Care — parent-side design kit (shared tokens + primitives)
import TutoMascotComponent from '../components/TutoMascot'

export const PC = {
  bg:       '#F4F6F7',
  card:     '#FFFFFF',
  ink:      '#21262E',
  inkSoft:  '#79808C',
  inkFaint: '#A9AFB9',
  line:     '#ECEEF1',
  field:    '#F3F5F7',
  teal:     '#3FB7AC',
  tealDeep: '#2EA298',
  tealBg:   '#E4F4F2',
  peach:    '#F0A368',
  peachDeep:'#E08B49',
  peachBg:  '#FCEEE1',
  amber:    '#E9A23B',
  amberBg:  '#FBF0D9',
  green:    '#56BD8C',
  greenBg:  '#E6F5EC',
  danger:   '#E8695C',
  dangerBg: '#FCEAE8',
  reading:  '#a98ce6', readingBg: '#EFE9FB',
  math:     '#5aa9e6', mathBg:    '#E2F0FB',
  writing:  '#6cc28a', writingBg: '#E4F4EA',
  chore:    '#f3a35a', choreBg:   '#FCEEDF',
  homework: '#e0a93b', homeworkBg: '#FBF1D6',
}

export const FONT = "'Plus Jakarta Sans', sans-serif"
export const SHADOW    = '0 14px 34px -16px rgba(40,55,75,.18), 0 3px 10px -4px rgba(40,55,75,.06)'
export const SHADOW_SM = '0 6px 18px -8px rgba(40,55,75,.16), 0 1px 4px rgba(40,55,75,.04)'

export const PCSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;}
.tc-scroll{overflow-y:auto;-webkit-overflow-scrolling:touch;}
.tc-scroll::-webkit-scrollbar{display:none;}
.tc-press{transition:transform .12s ease,box-shadow .18s ease,background .18s ease,border-color .18s ease,opacity .18s ease;}
.tc-press:active{transform:scale(.97);}
.tc-tap{cursor:pointer;}
@keyframes tcFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes tcUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes tcPop{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
@keyframes tcFall{0%{transform:translateY(-16px) rotate(0);opacity:1}100%{transform:translateY(720px) rotate(560deg);opacity:0}}
@keyframes tcSheet{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes tcFade{from{opacity:0}to{opacity:1}}
.tc-fade{animation:tcFade .2s ease both;}
.tc-up{animation:tcUp .4s cubic-bezier(.2,.7,.3,1) both;}
.tc-slider{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:6px;outline:none;cursor:pointer;}
.tc-slider::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;border-radius:50%;background:#3FB7AC;cursor:pointer;box-shadow:0 3px 10px rgba(63,183,172,.5);border:4px solid #fff;}
.tc-slider::-moz-range-thumb{width:24px;height:24px;border-radius:50%;background:#3FB7AC;cursor:pointer;border:4px solid #fff;box-shadow:0 3px 10px rgba(63,183,172,.5);}
.tc-input{width:100%;padding:14px 16px;border:1.5px solid #ECEEF1;border-radius:15px;font-family:'Plus Jakarta Sans',sans-serif;font-size:15.5px;font-weight:600;color:#21262E;background:#F3F5F7;outline:none;transition:border-color .16s,background .16s;}
.tc-input::placeholder{color:#A9AFB9;font-weight:600;}
.tc-input:focus{border-color:#3FB7AC;background:#fff;}
`

// ── Google mark ───────────────────────────────────────────────────────────────
export function GoogleMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5c-7.6 0-14.2 4.3-17.7 10.2z"/>
      <path fill="#4CAF50" d="M24 43.5c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 34.6 26.7 35.5 24 35.5c-5.3 0-9.7-3.1-11.3-7.4l-6.5 5C9.6 39.1 16.2 43.5 24 43.5z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.4 36.2 43.5 30.6 43.5 24c0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  )
}

// ── Line icon set ─────────────────────────────────────────────────────────────
export function Icon({ name, size = 24, color = 'currentColor', sw = 2 }) {
  const p = { fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const M = {
    back:    <path d="M15 5l-7 7 7 7" {...p} />,
    chevron: <path d="M9 6l6 6-6 6" {...p} />,
    plus:    <path d="M12 5v14M5 12h14" {...p} />,
    close:   <path d="M6 6l12 12M18 6L6 18" {...p} />,
    check:   <path d="M5 12.5l4.5 4.5L19 7" {...p} />,
    bell:    <g {...p}><path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 004 0"/></g>,
    gear:    <g {...p}><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.4M12 19.1v2.4M21.5 12h-2.4M4.9 12H2.5M18.7 5.3l-1.7 1.7M7 17l-1.7 1.7M18.7 18.7L17 17M7 7L5.3 5.3"/></g>,
    edit:    <g {...p}><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></g>,
    lock:    <g {...p}><rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/></g>,
    trash:   <g {...p}><path d="M5 7h14M9.5 7V5.5a1.5 1.5 0 011.5-1.5h2a1.5 1.5 0 011.5 1.5V7M7 7l.8 12a2 2 0 002 1.8h4.4a2 2 0 002-1.8L17 7"/></g>,
    qr:      <g {...p}><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2M20 14v6M16 18v2h4"/></g>,
    camera:  <g {...p}><path d="M4 8.5A1.5 1.5 0 015.5 7h2L9 5h6l1.5 2h2A1.5 1.5 0 0120 8.5v9A1.5 1.5 0 0118.5 19h-13A1.5 1.5 0 014 17.5z"/><circle cx="12" cy="13" r="3.2"/></g>,
    logout:  <g {...p}><path d="M14 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2v-2"/><path d="M18 12H9M15.5 8.5L19 12l-3.5 3.5"/></g>,
    refresh: <g {...p}><path d="M20 11A8 8 0 005.6 6.5L4 8M4 4v4h4M4 13a8 8 0 0014.4 4.5L20 16M20 20v-4h-4"/></g>,
    user:    <g {...p}><circle cx="12" cy="8.5" r="3.7"/><path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"/></g>,
    sparkle: <g {...p}><path d="M12 4l1.7 4.8L18.5 10l-4.8 1.6L12 16l-1.7-4.4L5.5 10l4.8-1.2z"/></g>,
    clock:   <g {...p}><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/></g>,
    phone:   <g {...p}><rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/></g>,
    swap:    <g {...p}><path d="M7 8h11l-3-3M17 16H6l3 3"/></g>,
    mail:    <g {...p}><rect x="3.5" y="6" width="17" height="12" rx="2.5"/><path d="M4 8l8 5 8-5"/></g>,
    book:    <g {...p}><path d="M12 6c-2-1.4-5-1.4-7 0v11c2-1.4 5-1.4 7 0 2-1.4 5-1.4 7 0V6c-2-1.4-5-1.4-7 0z"/><path d="M12 6v11"/></g>,
    calc:    <g {...p}><rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8.5 8h7"/><path d="M9 13h0M12 13h0M15 13h0M9 16.5h0M12 16.5h0M15 16.5h0"/></g>,
    pencil:  <g {...p}><path d="M14 4l6 6M4 20l1.2-4L16 5.2 18.8 8 8 18.8z"/></g>,
    house:   <g {...p}><path d="M4 11l8-6.5 8 6.5"/><path d="M6 10v9h12v-9"/></g>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24">{M[name] || null}</svg>
}

export function TaskIcon({ type, size = 24, color }) {
  const c = color || PC[type] || PC.teal
  const map = { reading: 'book', math: 'calc', writing: 'pencil', chore: 'house', homework: 'camera', drawing: 'pencil' }
  return <Icon name={map[type] || 'book'} size={size} color={c} sw={2.1} />
}

// ── TopBar ────────────────────────────────────────────────────────────────────
export function TopBar({ title, onBack, right, sub }) {
  return (
    <div style={{ flexShrink: 0, padding: '6px 18px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
      {onBack !== undefined ? (
        <button className="tc-press tc-tap" onClick={onBack} aria-label="Back" style={{
          width: 42, height: 42, flexShrink: 0, borderRadius: 14,
          background: '#fff', border: `1.5px solid ${PC.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: SHADOW_SM,
        }}>
          <Icon name="back" size={20} color={PC.ink} />
        </button>
      ) : <div style={{ width: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 21, color: PC.ink, letterSpacing: '-.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>}
        {sub && <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkSoft, marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </div>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = 'primary', disabled, full = true, color, style: extStyle = {} }) {
  const base = {
    fontFamily: FONT, fontWeight: 700, fontSize: 16, borderRadius: 16, padding: '15px 22px',
    cursor: disabled ? 'not-allowed' : 'pointer', width: full ? '100%' : 'auto',
    border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    ...extStyle,
  }
  const c = color || PC.teal
  let v = {}
  if (variant === 'primary') v = { background: disabled ? '#C5CDD3' : c, color: '#fff', boxShadow: disabled ? 'none' : `0 10px 22px -8px ${c}cc` }
  else if (variant === 'soft')    v = { background: PC.tealBg, color: PC.tealDeep }
  else if (variant === 'outline') v = { background: '#fff', color: PC.ink, border: `1.5px solid ${PC.line}`, boxShadow: SHADOW_SM }
  else if (variant === 'ghost')   v = { background: 'transparent', color: PC.inkSoft, fontWeight: 700 }
  else if (variant === 'danger')  v = { background: PC.dangerBg, color: PC.danger }
  return (
    <button className="tc-press tc-tap" onClick={disabled ? undefined : onClick} disabled={disabled} style={{ ...base, ...v }}>
      {children}
    </button>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style: extStyle = {}, pad = 18, soft, onClick }) {
  return (
    <div onClick={onClick} className={onClick ? 'tc-tap tc-press' : ''} style={{
      background: PC.card, borderRadius: 22, padding: pad,
      boxShadow: soft ? SHADOW_SM : SHADOW, ...extStyle,
    }}>
      {children}
    </div>
  )
}

// ── Field label ───────────────────────────────────────────────────────────────
export function Field({ label, children, hint }) {
  return (
    <div>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11.5, color: PC.inkSoft, letterSpacing: '.6px', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      {children}
      {hint && <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12, color: PC.inkFaint, marginTop: 6 }}>{hint}</div>}
    </div>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────
export function Toggle({ on, onClick }) {
  return (
    <button className="tc-tap" onClick={onClick} style={{
      width: 50, height: 30, borderRadius: 16, border: 'none',
      background: on ? PC.teal : '#D9DEE3', position: 'relative',
      cursor: 'pointer', flexShrink: 0, transition: 'background .22s',
    }}>
      <span style={{
        position: 'absolute', top: 3, left: on ? 23 : 3,
        width: 24, height: 24, borderRadius: '50%', background: '#fff',
        boxShadow: '0 2px 6px rgba(0,0,0,.2)',
        transition: 'left .22s cubic-bezier(.3,1.4,.5,1)',
      }} />
    </button>
  )
}

// ── Pill ──────────────────────────────────────────────────────────────────────
export function Pill({ children, bg = PC.tealBg, color = PC.tealDeep, style: extStyle = {} }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: bg, color, borderRadius: 999, padding: '5px 12px',
      fontFamily: FONT, fontWeight: 700, fontSize: 12.5, ...extStyle,
    }}>
      {children}
    </span>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────
export function Avatar({ child, size = 52, radius }) {
  const tints = [[PC.teal, PC.tealBg], [PC.peach, PC.peachBg], [PC.reading, PC.readingBg], [PC.math, PC.mathBg]]
  const idx = (child?.name?.charCodeAt(0) || 0) % tints.length
  const [fg, bg] = tints[idx]
  const av = child?.avatar_url
  const isPhoto = av?.startsWith('http')
  const isEmoji = av && !isPhoto
  return (
    <div style={{
      width: size, height: size, borderRadius: radius ?? Math.round(size * 0.32),
      background: bg, flexShrink: 0, display: 'flex', alignItems: 'center',
      justifyContent: 'center', overflow: 'hidden', fontSize: size * 0.5,
    }}>
      {isPhoto
        ? <img src={av} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : isEmoji
        ? av
        : <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: size * 0.4, color: fg }}>{(child?.name || '?')[0]}</span>}
    </div>
  )
}

// ── Bottom sheet ──────────────────────────────────────────────────────────────
export function BottomSheet({ onClose, children, maxHeight = '92%' }) {
  return (
    <div className="tc-fade" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(25,32,42,.42)',
      display: 'flex', alignItems: 'flex-end', zIndex: 200,
    }}>
      <div className="tc-scroll" onClick={e => e.stopPropagation()} style={{
        background: PC.card, width: '100%', maxWidth: 430, margin: '0 auto',
        borderRadius: '30px 30px 0 0', padding: '14px 22px 36px',
        display: 'flex', flexDirection: 'column', gap: 16,
        maxHeight, animation: 'tcSheet .3s cubic-bezier(.2,.8,.3,1) both',
      }}>
        <div style={{ width: 42, height: 5, background: '#E2E6EA', borderRadius: 5, alignSelf: 'center', marginBottom: 2 }} />
        {children}
      </div>
    </div>
  )
}

// ── Age stepper ───────────────────────────────────────────────────────────────
export function Stepper({ value, onChange, min = 1, max = 18 }) {
  const btn = {
    width: 46, height: 46, borderRadius: 14, background: PC.tealBg,
    border: 'none', color: PC.tealDeep, fontSize: 24, fontWeight: 700,
    cursor: 'pointer', fontFamily: FONT,
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: `1.5px solid ${PC.line}`, borderRadius: 16, padding: '10px 16px', gap: 14 }}>
      <button className="tc-press" onClick={() => onChange(Math.max(min, value - 1))} style={btn}>−</button>
      <div style={{ flex: 1, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 34, color: PC.ink }}>{value}</div>
      <button className="tc-press" onClick={() => onChange(Math.min(max, value + 1))} style={btn}>+</button>
    </div>
  )
}

// ── PinPad ────────────────────────────────────────────────────────────────────
export function PinPad({ value, onChange }) {
  const add = d => { if (value.length < 4) onChange(value + d) }
  const del = () => onChange(value.slice(0, -1))
  const btn = {
    background: PC.field, border: 'none', borderRadius: 18, height: 66,
    fontSize: 24, fontWeight: 700, color: PC.ink, cursor: 'pointer', fontFamily: FONT,
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
      <div style={{ display: 'flex', gap: 16 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            width: 18, height: 18, borderRadius: '50%',
            background: value.length > i ? PC.teal : PC.line,
            transition: 'all .18s', transform: value.length > i ? 'scale(1.18)' : 'scale(1)',
          }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 11, width: '100%', maxWidth: 280 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <button key={n} className="tc-press" onClick={() => add(String(n))} style={btn}>{n}</button>
        ))}
        <div />
        <button className="tc-press" onClick={() => add('0')} style={btn}>0</button>
        <button className="tc-press" onClick={del} style={{ ...btn, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="back" size={22} color={PC.inkSoft} />
        </button>
      </div>
    </div>
  )
}

// ── Confetti ──────────────────────────────────────────────────────────────────
export function Confetti({ n = 14 }) {
  const cols = [PC.teal, PC.peach, PC.amber, PC.green, PC.reading, PC.math]
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 30 }}>
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} style={{
          position: 'absolute', left: `${(i + 0.5) * (100 / n)}%`, top: -16,
          width: 10, height: 10, borderRadius: i % 3 === 0 ? '50%' : 3,
          background: cols[i % cols.length], display: 'inline-block',
          animation: `tcFall ${2.2 + (i % 4) * 0.3}s ease-in ${i * 0.08}s forwards`,
        }} />
      ))}
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────
export function SectionHead({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 2px 11px' }}>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16.5, color: PC.ink, whiteSpace: 'nowrap' }}>{children}</div>
      {action}
    </div>
  )
}

// Re-export TutoMascot for convenience
export { TutoMascotComponent as TutoMascot }
