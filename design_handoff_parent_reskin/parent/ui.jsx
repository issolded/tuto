// ── Tuto Care — parent-side design kit ──────────────────────────────────────
// Airy, grown-up re-skin: light neutral stage, soft white cards, teal + peach.
// All shared tokens / primitives / icons are exported to window at the bottom.

const PC = {
  stage:    '#E8EBEE',   // app stage behind the phone
  bg:       '#F4F6F7',   // screen background (warm-cool off-white)
  card:     '#FFFFFF',
  ink:      '#21262E',   // near-black slate
  inkSoft:  '#79808C',   // secondary text
  inkFaint: '#A9AFB9',   // tertiary / hints
  line:     '#ECEEF1',   // hairlines / borders
  field:    '#F3F5F7',   // input fill

  teal:     '#3FB7AC',   // primary
  tealDeep: '#2EA298',
  tealBg:   '#E4F4F2',

  peach:    '#F0A368',   // warm secondary
  peachDeep:'#E08B49',
  peachBg:  '#FCEEE1',

  amber:    '#E9A23B',   // gems
  amberBg:  '#FBF0D9',

  green:    '#56BD8C',
  greenBg:  '#E6F5EC',
  danger:   '#E8695C',
  dangerBg: '#FCEAE8',

  // task accents — kept from the kids app for brand continuity
  reading:  '#a98ce6', math: '#5aa9e6', writing: '#6cc28a', chore: '#f3a35a',
  readingBg:'#EFE9FB', mathBg:'#E2F0FB', writingBg:'#E4F4EA', choreBg:'#FCEEDF',
};

const FONT = "'Plus Jakarta Sans', sans-serif";
const SHADOW = '0 14px 34px -16px rgba(40,55,75,.18), 0 3px 10px -4px rgba(40,55,75,.06)';
const SHADOW_SM = '0 6px 18px -8px rgba(40,55,75,.16), 0 1px 4px rgba(40,55,75,.04)';

const PCSS = `
*{box-sizing:border-box;}
.tc-scroll{ overflow-y:auto; -webkit-overflow-scrolling:touch; }
.tc-scroll::-webkit-scrollbar{ display:none; }
.tc-press{ transition:transform .12s ease, box-shadow .18s ease, background .18s ease, border-color .18s ease, opacity .18s ease; }
.tc-press:active{ transform:scale(.97); }
.tc-card{ transition:transform .14s ease, box-shadow .18s ease; }
.tc-tap{ cursor:pointer; }
@keyframes tcFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
@keyframes tcUp { from{opacity:0; transform:translateY(14px)} to{opacity:1; transform:translateY(0)} }
@keyframes tcPop { from{opacity:0; transform:scale(.9)} to{opacity:1; transform:scale(1)} }
@keyframes tcFall { 0%{transform:translateY(-16px) rotate(0);opacity:1} 100%{transform:translateY(720px) rotate(560deg);opacity:0} }
@keyframes tcSheet { from{transform:translateY(100%)} to{transform:translateY(0)} }
@keyframes tcFade { from{opacity:0} to{opacity:1} }
.tc-fade{ animation:tcFade .2s ease both; }
.tc-up{ animation:tcUp .4s cubic-bezier(.2,.7,.3,1) both; }
.tc-slider{ -webkit-appearance:none; appearance:none; width:100%; height:6px; border-radius:6px; outline:none; cursor:pointer; }
.tc-slider::-webkit-slider-thumb{ -webkit-appearance:none; width:24px; height:24px; border-radius:50%; background:${PC.teal}; cursor:pointer; box-shadow:0 3px 10px rgba(63,183,172,.5); border:4px solid #fff; }
.tc-slider::-moz-range-thumb{ width:24px; height:24px; border-radius:50%; background:${PC.teal}; cursor:pointer; border:4px solid #fff; box-shadow:0 3px 10px rgba(63,183,172,.5); }
.tc-input{ width:100%; padding:14px 16px; border:1.5px solid ${PC.line}; border-radius:15px; font-family:${FONT};
  font-size:15.5px; font-weight:600; color:${PC.ink}; background:${PC.field}; outline:none; transition:border-color .16s, background .16s; }
.tc-input::placeholder{ color:${PC.inkFaint}; font-weight:600; }
.tc-input:focus{ border-color:${PC.teal}; background:#fff; }
`;

/* ── Phone shell ─────────────────────────────────────────────────────────── */
function StatusBar({ dark }) {
  const c = dark ? '#fff' : PC.ink;
  return (
    <div style={{ flex:'0 0 auto', height:46, display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'14px 30px 0', fontFamily:FONT, fontWeight:700, fontSize:15, color:c, position:'relative', zIndex:6 }}>
      <span style={{ letterSpacing:'.3px' }}>9:41</span>
      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
        <svg width="18" height="12" viewBox="0 0 18 12" fill="none"><rect x="0" y="7" width="3" height="5" rx="1" fill={c}/><rect x="5" y="4" width="3" height="8" rx="1" fill={c}/><rect x="10" y="1.5" width="3" height="10.5" rx="1" fill={c}/><rect x="15" y="0" width="3" height="12" rx="1" fill={c} opacity=".4"/></svg>
        <svg width="17" height="12" viewBox="0 0 17 12" fill="none"><path d="M8.5 3.2c2 0 3.8.8 5.1 2.1M8.5 7.1c.9 0 1.7.4 2.3 1M2.4 4.2A11 11 0 018.5.5c2.3 0 4.4.7 6.1 1.9" stroke={c} strokeWidth="1.6" strokeLinecap="round"/><circle cx="8.5" cy="10.2" r="1.3" fill={c}/></svg>
        <div style={{ width:24, height:12, borderRadius:3, border:`1.5px solid ${c}`, position:'relative', opacity:.9 }}>
          <div style={{ position:'absolute', inset:1.5, width:'72%', background:c, borderRadius:1 }} />
          <div style={{ position:'absolute', right:-3, top:3.5, width:2, height:5, background:c, borderRadius:'0 1px 1px 0' }} />
        </div>
      </div>
    </div>
  );
}

function Phone({ children, dark, bg }) {
  return (
    <div style={{ width:402, height:872, borderRadius:54, background:'#fff', border:'11px solid #fff',
      boxShadow:'0 50px 90px -40px rgba(30,40,60,.55), 0 18px 40px -20px rgba(30,40,60,.25)',
      overflow:'hidden', position:'relative', display:'flex', flexDirection:'column' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:46, background:dark ? 'transparent' : bg || PC.bg, zIndex:5 }} />
      <div style={{ position:'absolute', top:14, left:'50%', transform:'translateX(-50%)', width:120, height:30,
        background:'#11151b', borderRadius:18, zIndex:7 }} />
      <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', background:bg || PC.bg, position:'relative' }}>
        <StatusBar dark={dark} />
        <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>{children}</div>
      </div>
    </div>
  );
}

/* ── Light top bar (replaces heavy colored header bands) ─────────────────── */
function TopBar({ title, onBack, right, sub }) {
  return (
    <div style={{ flex:'0 0 auto', padding:'6px 18px 12px', display:'flex', alignItems:'center', gap:10 }}>
      {onBack ? (
        <button className="tc-press tc-tap" onClick={onBack} aria-label="Back" style={{ width:42, height:42, flexShrink:0, borderRadius:14,
          background:'#fff', border:`1.5px solid ${PC.line}`, display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', boxShadow:SHADOW_SM }}>
          <Icon name="back" size={20} color={PC.ink} />
        </button>
      ) : <div style={{ width:onBack===undefined?0:42 }} />}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:FONT, fontWeight:800, fontSize:21, color:PC.ink, letterSpacing:'-.3px',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{title}</div>
        {sub && <div style={{ fontFamily:FONT, fontWeight:600, fontSize:12.5, color:PC.inkSoft, marginTop:1 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */
function Btn({ children, onClick, variant = 'primary', disabled, full = true, color, style = {} }) {
  const base = { fontFamily:FONT, fontWeight:700, fontSize:16, borderRadius:16, padding:'15px 22px',
    cursor:disabled ? 'not-allowed' : 'pointer', width:full ? '100%' : 'auto', border:'none',
    display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, ...style };
  let v;
  const c = color || PC.teal;
  if (variant === 'primary') v = { background:disabled ? '#C5CDD3' : c, color:'#fff',
    boxShadow:disabled ? 'none' : `0 10px 22px -8px ${c}cc` };
  else if (variant === 'soft') v = { background:PC.tealBg, color:PC.tealDeep };
  else if (variant === 'outline') v = { background:'#fff', color:PC.ink, border:`1.5px solid ${PC.line}`, boxShadow:SHADOW_SM };
  else if (variant === 'ghost') v = { background:'transparent', color:PC.inkSoft, fontWeight:700 };
  else if (variant === 'danger') v = { background:PC.dangerBg, color:PC.danger };
  return <button className="tc-press tc-tap" onClick={disabled ? undefined : onClick} disabled={disabled} style={{ ...base, ...v }}>{children}</button>;
}

function Card({ children, style = {}, pad = 18, soft, onClick, className = '' }) {
  return (
    <div onClick={onClick} className={`tc-card ${onClick ? 'tc-tap tc-press' : ''} ${className}`} style={{ background:PC.card, borderRadius:22, padding:pad,
      boxShadow:soft ? SHADOW_SM : SHADOW, ...style }}>{children}</div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div>
      <div style={{ fontFamily:FONT, fontWeight:700, fontSize:11.5, color:PC.inkSoft, letterSpacing:'.6px',
        textTransform:'uppercase', marginBottom:8 }}>{label}</div>
      {children}
      {hint && <div style={{ fontFamily:FONT, fontWeight:600, fontSize:12, color:PC.inkFaint, marginTop:6 }}>{hint}</div>}
    </div>
  );
}

function Toggle({ on, onClick }) {
  return (
    <button className="tc-tap" onClick={onClick} style={{ width:50, height:30, borderRadius:16, border:'none',
      background:on ? PC.teal : '#D9DEE3', position:'relative', cursor:'pointer', flexShrink:0, transition:'background .22s' }}>
      <span style={{ position:'absolute', top:3, left:on ? 23 : 3, width:24, height:24, borderRadius:'50%', background:'#fff',
        boxShadow:'0 2px 6px rgba(0,0,0,.2)', transition:'left .22s cubic-bezier(.3,1.4,.5,1)' }} />
    </button>
  );
}

function Pill({ children, bg = PC.tealBg, color = PC.tealDeep, style = {} }) {
  return <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:bg, color, borderRadius:999,
    padding:'5px 12px', fontFamily:FONT, fontWeight:700, fontSize:12.5, ...style }}>{children}</span>;
}

/* ── Avatar ──────────────────────────────────────────────────────────────── */
const TASK_TINT = { reading:[PC.reading,PC.readingBg], math:[PC.math,PC.mathBg], writing:[PC.writing,PC.writingBg], chore:[PC.chore,PC.choreBg] };
function Avatar({ child, size = 52, radius }) {
  const tints = [[PC.teal,PC.tealBg],[PC.peach,PC.peachBg],[PC.reading,PC.readingBg],[PC.math,PC.mathBg]];
  const idx = (child?.name?.charCodeAt(0) || 0) % tints.length;
  const [fg, bg] = tints[idx];
  const av = child?.avatar;
  const isEmoji = av && !av.startsWith('http');
  return (
    <div style={{ width:size, height:size, borderRadius:radius ?? size*0.32, background:bg, flexShrink:0,
      display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', fontSize:size*0.5 }}>
      {av && av.startsWith('http')
        ? <img src={av} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        : isEmoji ? av
        : <span style={{ fontFamily:FONT, fontWeight:800, fontSize:size*0.4, color:fg }}>{(child?.name||'?')[0]}</span>}
    </div>
  );
}

/* ── Icons (thin line set) ──────────────────────────────────────────────── */
function Icon({ name, size = 24, color = 'currentColor', sw = 2 }) {
  const p = { fill:'none', stroke:color, strokeWidth:sw, strokeLinecap:'round', strokeLinejoin:'round' };
  const M = {
    back:      <path d="M15 5l-7 7 7 7" {...p} />,
    chevron:   <path d="M9 6l6 6-6 6" {...p} />,
    plus:      <path d="M12 5v14M5 12h14" {...p} />,
    close:     <path d="M6 6l12 12M18 6L6 18" {...p} />,
    check:     <path d="M5 12.5l4.5 4.5L19 7" {...p} />,
    bell:      <g {...p}><path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 004 0"/></g>,
    gear:      <g {...p}><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.4M12 19.1v2.4M21.5 12h-2.4M4.9 12H2.5M18.7 5.3l-1.7 1.7M7 17l-1.7 1.7M18.7 18.7L17 17M7 7L5.3 5.3"/></g>,
    edit:      <g {...p}><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></g>,
    lock:      <g {...p}><rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/></g>,
    trash:     <g {...p}><path d="M5 7h14M9.5 7V5.5a1.5 1.5 0 011.5-1.5h2a1.5 1.5 0 011.5 1.5V7M7 7l.8 12a2 2 0 002 1.8h4.4a2 2 0 002-1.8L17 7"/></g>,
    qr:        <g {...p}><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2M20 14v6M16 18v2h4"/></g>,
    camera:    <g {...p}><path d="M4 8.5A1.5 1.5 0 015.5 7h2L9 5h6l1.5 2h2A1.5 1.5 0 0120 8.5v9A1.5 1.5 0 0118.5 19h-13A1.5 1.5 0 014 17.5z"/><circle cx="12" cy="13" r="3.2"/></g>,
    logout:    <g {...p}><path d="M14 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2v-2"/><path d="M18 12H9M15.5 8.5L19 12l-3.5 3.5"/></g>,
    refresh:   <g {...p}><path d="M20 11A8 8 0 005.6 6.5L4 8M4 4v4h4M4 13a8 8 0 0014.4 4.5L20 16M20 20v-4h-4"/></g>,
    user:      <g {...p}><circle cx="12" cy="8.5" r="3.7"/><path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"/></g>,
    sparkle:   <g {...p}><path d="M12 4l1.7 4.8L18.5 10l-4.8 1.6L12 16l-1.7-4.4L5.5 10l4.8-1.2z"/></g>,
    rocket:    <g {...p}><path d="M12 3c3.5 2 5 5.5 5 9l-2.5 2.5h-5L7 12c0-3.5 1.5-7 5-9z"/><circle cx="12" cy="9.5" r="1.6"/><path d="M9.5 15c-2 .5-3 2-3 5 3 0 4.5-1 5-3M14.5 15c2 .5 3 2 3 5"/></g>,
    book:      <g {...p}><path d="M12 6c-2-1.4-5-1.4-7 0v11c2-1.4 5-1.4 7 0 2-1.4 5-1.4 7 0V6c-2-1.4-5-1.4-7 0z"/><path d="M12 6v11"/></g>,
    calc:      <g {...p}><rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8.5 8h7"/><path d="M9 13h0M12 13h0M15 13h0M9 16.5h0M12 16.5h0M15 16.5h0"/></g>,
    pencil:    <g {...p}><path d="M14 4l6 6M4 20l1.2-4L16 5.2 18.8 8 8 18.8z"/></g>,
    house:     <g {...p}><path d="M4 11l8-6.5 8 6.5"/><path d="M6 10v9h12v-9"/></g>,
    clock:     <g {...p}><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/></g>,
    trophy:    <g {...p}><path d="M7 4h10v4a5 5 0 01-10 0z"/><path d="M7 5H4v2a3 3 0 003 3M17 5h3v2a3 3 0 01-3 3M9.5 16h5M12 13v3M8 20h8"/></g>,
    gift:      <g {...p}><rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M4 13h16M12 9v11"/><path d="M12 9S10.5 4.5 8 5.5 9.5 9 12 9zM12 9s1.5-4.5 4-3.5S14.5 9 12 9z"/></g>,
    chart:     <g {...p}><path d="M5 19V5M5 19h14"/><rect x="8" y="12" width="2.6" height="5" rx="1" fill={color} stroke="none"/><rect x="13" y="8" width="2.6" height="9" rx="1" fill={color} stroke="none"/></g>,
    phone:     <g {...p}><rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/></g>,
    swap:      <g {...p}><path d="M7 8h11l-3-3M17 16H6l3 3"/></g>,
    mail:      <g {...p}><rect x="3.5" y="6" width="17" height="12" rx="2.5"/><path d="M4 8l8 5 8-5"/></g>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24">{M[name] || null}</svg>;
}
function TaskIcon({ type, size = 24, color }) {
  const c = color || (PC[type] || PC.teal);
  const map = { reading:'book', math:'calc', writing:'pencil', chore:'house' };
  return <Icon name={map[type] || 'book'} size={size} color={c} sw={2.1} />;
}

/* ── Bottom sheet ────────────────────────────────────────────────────────── */
function BottomSheet({ onClose, children, maxHeight = '88%' }) {
  return (
    <div className="tc-fade" onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(25,32,42,.42)',
      display:'flex', alignItems:'flex-end', zIndex:200 }}>
      <div className="tc-scroll" onClick={e => e.stopPropagation()} style={{ background:PC.card, width:'100%',
        borderRadius:'30px 30px 0 0', padding:'14px 22px 30px', display:'flex', flexDirection:'column', gap:16,
        maxHeight, animation:'tcSheet .3s cubic-bezier(.2,.8,.3,1) both' }}>
        <div style={{ width:42, height:5, background:'#E2E6EA', borderRadius:5, alignSelf:'center', marginBottom:2 }} />
        {children}
      </div>
    </div>
  );
}

/* ── Segmented control ───────────────────────────────────────────────────── */
function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display:'flex', background:PC.field, borderRadius:14, padding:4, gap:4 }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <button key={o.value} className="tc-tap" onClick={() => onChange(o.value)} style={{ flex:1, border:'none',
            background:on ? '#fff' : 'transparent', color:on ? PC.ink : PC.inkSoft, borderRadius:11, padding:'9px 6px',
            fontFamily:FONT, fontWeight:700, fontSize:13.5, cursor:'pointer', boxShadow:on ? SHADOW_SM : 'none',
            transition:'all .18s' }}>{o.label}</button>
        );
      })}
    </div>
  );
}

/* ── Weekly bar chart (reference-style) ──────────────────────────────────── */
function BarChart({ data, accent = PC.teal }) {
  const max = Math.max(...data.map(d => d.v), 1);
  const hiIdx = data.reduce((m, d, i) => d.v > data[m].v ? i : m, 0);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:9, height:140 }}>
      {data.map((d, i) => {
        const h = Math.max(10, (d.v / max) * 104);
        const hi = i === hiIdx;
        return (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            <div style={{ position:'relative', width:'100%', maxWidth:34, height:104, display:'flex', alignItems:'flex-end' }}>
              <div style={{ width:'100%', height:h, borderRadius:11, background:hi ? accent : PC.field,
                display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:6, transition:'height .5s' }}>
                <span style={{ fontFamily:FONT, fontWeight:800, fontSize:11, color:hi ? '#fff' : PC.inkSoft }}>{d.v}</span>
              </div>
            </div>
            <span style={{ fontFamily:FONT, fontWeight:700, fontSize:11.5, color:hi ? PC.ink : PC.inkFaint }}>{d.l}</span>
          </div>
        );
      })}
    </div>
  );
}

function Ring({ pct, size = 64, color = PC.teal, track = PC.line, sw = 7, children }) {
  const r = (size - sw) / 2, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} style={{ transition:'stroke-dashoffset .6s ease' }} />
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>{children}</div>
    </div>
  );
}

function Confetti({ n = 14 }) {
  const cols = [PC.teal, PC.peach, PC.amber, PC.green, PC.reading, PC.math];
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:30 }}>
      {Array.from({ length:n }).map((_, i) => (
        <span key={i} style={{ position:'absolute', left:`${(i+0.5)*(100/n)}%`, top:-16, width:10, height:10,
          borderRadius: i%3===0 ? '50%' : 3, background:cols[i % cols.length],
          animation:`tcFall ${2.2 + (i%4)*0.3}s ease-in ${i*0.08}s forwards` }} />
      ))}
    </div>
  );
}

Object.assign(window, {
  PC, FONT, SHADOW, SHADOW_SM, PCSS,
  StatusBar, Phone, TopBar, Btn, Card, Field, Toggle, Pill, Avatar, Icon, TaskIcon,
  BottomSheet, Segmented, BarChart, Ring, Confetti, TASK_TINT,
});

// inject the kit stylesheet once
if (!document.getElementById('tc-css')) {
  const s = document.createElement('style');
  s.id = 'tc-css'; s.textContent = PCSS; document.head.appendChild(s);
}
