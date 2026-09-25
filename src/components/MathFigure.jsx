import { say } from '../lib/i18n'
import { num, dnum, FIGURE_KINDS } from '../lib/mathTemplates'

// The pictures Bond's 7-8 and 8-9 books are built on, and which a sentence cannot stand in for:
// a scale to read, a shape with a fraction of it shaded, a grid with points on it, a solid to
// count the faces of, a tally chart, a price list. In every one of them READING the picture is
// the skill — "the jug holds 600 ml, how much is in it?" is not a measuring question.
//
// Same two rules as MathGeometry and MathChart:
//   * the value the child is asked for is never printed. The arrow points, the level sits on
//     the scale, the point sits on the grid — the number is what the child supplies.
//   * the data is the template's, never parsed from the question text. What is drawn here is
//     exactly what the answer key was computed from.
//
// Scales are drawn to scale (reading them is the point, the same position MathChart takes);
// solids and polygons are schematic, and say so.

const INK = '#24465a'
const ORANGE = '#b85b10'
const GRID = '#cfe3e8'
const FILL = '#7ecbd0'
const PAPER = '#f1f9fb'
const WATER = '#bfe6f0'
const FONT = 'Nunito, sans-serif'

const W = 320

export default function MathFigure({ visual: v, language = 'en', hint = false, description }) {
  if (!v || !FIGURE_KINDS.has(v.kind)) return null
  const lang = language
  if (v.kind === 'prices') return <Prices items={v.items} />
  if (v.kind === 'digital') return <Digital times={v.times} labels={v.labels} />
  const body = v.kind === 'scale' ? scale(v, lang)
    : v.kind === 'fraction' ? fraction(v)
      : v.kind === 'coords' ? coords(v, lang, hint)
        : v.kind === 'solid' ? solid(v)
          : v.kind === 'tally' ? tally(v)
            : v.kind === 'net' ? net(v)
              : v.kind === 'venn' ? venn(v)
                : v.kind === 'carroll' ? carroll(v)
                  : v.kind === 'route' ? route(v)
                    : v.kind === 'spinner' ? spinner(v)
                      : v.kind === 'mapscale' ? mapScale(v, lang)
                        : v.kind === 'plane' ? plane(v, lang)
                          : v.kind === 'angles' ? angles(v)
                            : v.kind === 'compound' ? compound(v)
                              : v.kind === 'machine' ? machine(v)
                                : v.kind === 'numcross' ? numcross(v)
                                  : v.kind === 'dots' ? dots(v)
                                    : v.kind === 'algrects' ? algrects(v)
                                      : v.kind === 'gears' ? gears(v)
                                        : v.kind === 'cuboid' ? cuboid(v)
                                          : v.kind === 'circle' ? circle(v)
                                            : v.kind === 'righttri' ? righttri(v)
                                              : v.kind === 'garden' ? garden(v)
                                                : v.kind === 'scatter' ? scatter(v)
                                                  : v.kind === 'turn' ? turn(v)
                                                  : polygon(v, hint)
  if (!body) return null
  const schematic = ['solid', 'polygon', 'net', 'angles', 'compound', 'algrects', 'cuboid', 'righttri', 'garden', 'circle'].includes(v.kind)
  return (
    <figure style={{ margin: 0, width: '100%', maxWidth: 340, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${W} ${body.h}`} role="img"
        aria-label={description || say(lang, 'Picture', 'Resim', 'Imagen')}
        style={{ display: 'block', width: '100%', maxHeight: 230, overflow: 'visible' }}>
        {body.g}
      </svg>
      {schematic && (
        <figcaption style={{ font: `12px ${FONT}`, textAlign: 'center', color: '#617383' }}>
          {say(lang, 'Not to scale', 'Ölçekli değildir', 'No está a escala')}
        </figcaption>
      )}
    </figure>
  )
}

// A white halo under every label, so a pointer or a gridline passing behind a number does not
// cut through it.
const txt = (x, y, s, { size = 13, weight = 700, fill = INK, anchor = 'middle', key } = {}) => (
  <text key={key} x={x} y={y} textAnchor={anchor} dominantBaseline="middle"
    style={{ font: `${weight} ${size}px ${FONT}`, fill, paintOrder: 'stroke', stroke: 'white', strokeWidth: 3.5, strokeLinejoin: 'round' }}>{s}</text>
)

// A label in the reader's number format: 2,300 or 2.300, and 1.5 or 1,5.
function label(n, lang) {
  return Number.isInteger(n) ? num(n, lang) : dnum(n, lang)
}

// ── scales ────────────────────────────────────────────────────────────────────
// Every scale is min..max with a tick each `minor` and a number each `major`. The reading
// always lands on a tick, so the question has one defensible answer.
function ticks(min, max, step) {
  const out = []
  const n = Math.round((max - min) / step)
  for (let i = 0; i <= n; i++) out.push(Math.round((min + i * step) * 1000) / 1000)
  return out
}
const isMajor = (t, min, major) => Math.abs(((t - min) / major) - Math.round((t - min) / major)) < 1e-6

function scale(v, lang) {
  if (v.type === 'ruler') return ruler(v)
  if (v.type === 'jug') return jug(v, lang)
  if (v.type === 'thermo') return thermo(v, lang)
  if (v.type === 'dial') return dial(v, lang)
  return numberLine(v, lang)
}

// A thing laid along a ruler from its zero, the way both books draw it. The object's end is
// the reading; there is no number at it.
function ruler(v) {
  const { max, value, minor = 0.5 } = v
  const x0 = 22, x1 = 298
  const px = (x1 - x0) / max
  const X = cm => x0 + cm * px
  const y = 74
  const g = <g>
    {/* the object: a pencil, from 0 to the reading */}
    <rect x={X(0)} y={34} width={Math.max(0, X(value) - X(0) - 14)} height={18} rx={3} fill={FILL} stroke={INK} strokeWidth="1.5" />
    <polygon points={`${X(value) - 14},34 ${X(value)},43 ${X(value) - 14},52`} fill="#f3d7a6" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
    <line x1={X(value)} y1={43} x2={X(value)} y2={y} stroke={ORANGE} strokeWidth="1.5" strokeDasharray="3 3" />
    <rect x={x0 - 12} y={y} width={x1 - x0 + 24} height={46} rx={4} fill="#fff8e6" stroke={INK} strokeWidth="1.5" />
    {ticks(0, max, minor).map(t => {
      const major = isMajor(t, 0, 1)
      return <g key={t}>
        <line x1={X(t)} y1={y} x2={X(t)} y2={y + (major ? 16 : 9)} stroke={INK} strokeWidth={major ? 1.6 : 1} />
        {major && txt(X(t), y + 28, t, { size: 12 })}
      </g>
    })}
    {txt(x1 + 4, y + 40, 'cm', { size: 11, weight: 600, fill: '#617383', anchor: 'end' })}
  </g>
  return { h: 128, g }
}

function jug(v, lang) {
  const { max, major, minor, value, unit = 'ml' } = v
  const top = 26, bottom = 196, left = 118, right = 218
  const Y = n => bottom - (n / max) * (bottom - top - 12)
  const g = <g>
    <path d={`M ${right} ${top + 30} C ${right + 50} ${top + 30}, ${right + 50} ${top + 110}, ${right} ${top + 110}`}
      fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
    <rect x={left} y={Y(value)} width={right - left} height={bottom - Y(value)} fill={WATER} />
    <path d={`M ${left - 6} ${top} L ${left} ${top + 6} L ${left} ${bottom} Q ${left} ${bottom + 6} ${left + 6} ${bottom + 6} L ${right - 6} ${bottom + 6} Q ${right} ${bottom + 6} ${right} ${bottom} L ${right} ${top}`}
      fill="none" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
    {ticks(0, max, minor).filter(t => t > 0).map(t => {
      const m = isMajor(t, 0, major)
      return <g key={t}>
        <line x1={left} y1={Y(t)} x2={left + (m ? 24 : 13)} y2={Y(t)} stroke={INK} strokeWidth={m ? 1.8 : 1.1} />
        {m && txt(left - 10, Y(t), label(t, lang), { size: 12, anchor: 'end' })}
      </g>
    })}
    {txt(left - 10, top - 4, unit, { size: 12, weight: 600, fill: '#617383', anchor: 'end' })}
  </g>
  return { h: 210, g }
}

function thermo(v, lang) {
  const { min, max, major, minor, value } = v
  const top = 18, bottom = 176, cx = 170
  const Y = n => bottom - ((n - min) / (max - min)) * (bottom - top)
  const g = <g>
    <rect x={cx - 9} y={top - 8} width={18} height={bottom - top + 24} rx={9} fill="white" stroke={INK} strokeWidth="2" />
    <circle cx={cx} cy={bottom + 22} r={17} fill="#e4705a" stroke={INK} strokeWidth="2" />
    <rect x={cx - 4.5} y={Y(value)} width={9} height={bottom + 12 - Y(value)} fill="#e4705a" />
    {ticks(min, max, minor).map(t => {
      const m = isMajor(t, min, major)
      return <g key={t}>
        <line x1={cx - 10} y1={Y(t)} x2={cx - 10 - (m ? 16 : 8)} y2={Y(t)} stroke={INK} strokeWidth={m ? 1.8 : 1.1} />
        {m && txt(cx - 34, Y(t), `${t < 0 ? '−' : ''}${label(Math.abs(t), lang)}`, { size: 12, anchor: 'end' })}
      </g>
    })}
    {txt(cx + 26, top, '°C', { size: 13, weight: 700, fill: '#617383', anchor: 'start' })}
  </g>
  return { h: 222, g }
}

// Kitchen scales: a full dial, zero at the top, clockwise.
function dial(v, lang) {
  const { max, major, minor, value, unit = 'kg' } = v
  const cx = 160, cy = 108, r = 88
  const ang = n => (n / max) * 2 * Math.PI - Math.PI / 2
  const P = (n, rr) => [cx + rr * Math.cos(ang(n)), cy + rr * Math.sin(ang(n))]
  const [px, py] = P(value, r - 22)
  const g = <g>
    <rect x={cx - 70} y={cy + r - 4} width={140} height={20} rx={4} fill={PAPER} stroke={INK} strokeWidth="2" />
    <circle cx={cx} cy={cy} r={r} fill="white" stroke={INK} strokeWidth="2.5" />
    <line x1={cx} y1={cy} x2={px} y2={py} stroke={ORANGE} strokeWidth="3.5" strokeLinecap="round" />
    {ticks(0, max, minor).filter(t => t < max).map(t => {
      const m = isMajor(t, 0, major)
      const [a, b] = P(t, r - 3), [c, d] = P(t, r - (m ? 16 : 9))
      const [lx, ly] = P(t, r - 30)
      return <g key={t}>
        <line x1={a} y1={b} x2={c} y2={d} stroke={INK} strokeWidth={m ? 1.8 : 1} />
        {m && txt(lx, ly, label(t, lang), { size: 12 })}
      </g>
    })}
    <circle cx={cx} cy={cy} r={6} fill={INK} />
    {txt(cx, cy + 30, unit, { size: 13, weight: 700, fill: '#617383' })}
  </g>
  return { h: 222, g }
}

// Labels at the ends only, unless the template asks for more: counting the steps between
// the labelled ends is the whole of "what number is the arrow pointing to?".
function numberLine(v, lang) {
  const { min, max, minor, value, labels = [min, max] } = v
  const x0 = 26, x1 = 294, y = 70
  const X = n => x0 + ((n - min) / (max - min)) * (x1 - x0)
  const g = <g>
    <line x1={x0} y1={y} x2={x1} y2={y} stroke={INK} strokeWidth="2" />
    {ticks(min, max, minor).map(t => {
      const lab = labels.some(l => Math.abs(l - t) < 1e-9)
      return <g key={t}>
        <line x1={X(t)} y1={y - (lab ? 11 : 7)} x2={X(t)} y2={y + (lab ? 11 : 7)} stroke={INK} strokeWidth={lab ? 1.8 : 1.1} />
        {lab && txt(X(t), y + 26, label(t, lang), { size: 12 })}
      </g>
    })}
    <line x1={X(value)} y1={18} x2={X(value)} y2={y - 14} stroke={ORANGE} strokeWidth="2.5" />
    <polygon points={`${X(value) - 7},${y - 20} ${X(value) + 7},${y - 20} ${X(value)},${y - 10}`} fill={ORANGE} />
  </g>
  return { h: 110, g }
}

// ── a shape with some of its parts shaded ─────────────────────────────────────
function fraction(v) {
  const { shape, parts, shaded } = v
  const on = new Set(shaded)
  const fill = i => (on.has(i) ? FILL : 'white')
  if (shape === 'circle') {
    const cx = 160, cy = 100, r = 84
    const g = <g>
      {Array.from({ length: parts }, (_, i) => {
        const a0 = (i / parts) * 2 * Math.PI - Math.PI / 2
        const a1 = ((i + 1) / parts) * 2 * Math.PI - Math.PI / 2
        const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)]
        const p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)]
        return <path key={i} d={`M ${cx} ${cy} L ${p0} A ${r} ${r} 0 0 1 ${p1} Z`} fill={fill(i)} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      })}
    </g>
    return { h: 200, g }
  }
  const cols = shape === 'bar' ? parts : v.cols
  const rows = Math.ceil(parts / cols)
  const size = Math.min(56, Math.floor(280 / cols), Math.floor(170 / rows))
  const ox = (W - cols * size) / 2, oy = 12
  const g = <g>
    {Array.from({ length: parts }, (_, i) => (
      <rect key={i} x={ox + (i % cols) * size} y={oy + Math.floor(i / cols) * size} width={size} height={size}
        fill={fill(i)} stroke={INK} strokeWidth="2" />
    ))}
  </g>
  return { h: oy * 2 + rows * size, g }
}

// ── a grid with points on it ──────────────────────────────────────────────────
// `axes: true` numbers the lines from 0, the way coordinates are read. Without axes it is a
// map: lettered columns and numbered rows name the SQUARES (Bond's treasure map, "the flag is
// at D2"), and a north arrow makes "which direction?" answerable.
function coords(v, lang, hint) {
  const { size, points = [], axes = true, compass = false } = v
  const cell = Math.floor(170 / size)
  const ox = 56, oy = 30 // room for the "y" above the axis, which was drawn outside the box
  const g = []
  for (let i = 0; i <= size; i++) {
    g.push(<line key={`h${i}`} x1={ox} y1={oy + i * cell} x2={ox + size * cell} y2={oy + i * cell} stroke={GRID} strokeWidth="1.2" />)
    g.push(<line key={`v${i}`} x1={ox + i * cell} y1={oy} x2={ox + i * cell} y2={oy + size * cell} stroke={GRID} strokeWidth="1.2" />)
  }
  if (axes) {
    g.push(<line key="ax" x1={ox} y1={oy + size * cell} x2={ox + size * cell + 12} y2={oy + size * cell} stroke={INK} strokeWidth="2" />)
    g.push(<line key="ay" x1={ox} y1={oy + size * cell} x2={ox} y2={oy - 10} stroke={INK} strokeWidth="2" />)
    for (let i = 0; i <= size; i++) {
      g.push(txt(ox + i * cell, oy + size * cell + 14, i, { key: `nx${i}`, size: 12 }))
      if (i > 0) g.push(txt(ox - 12, oy + (size - i) * cell, i, { key: `ny${i}`, size: 12 }))
    }
    g.push(txt(ox + size * cell + 20, oy + size * cell, 'x', { key: 'lx', size: 13, fill: '#617383' }))
    g.push(txt(ox, oy - 18, 'y', { key: 'ly', size: 13, fill: '#617383' }))
    for (const p of points) {
      const cx = ox + p.x * cell, cy = oy + (size - p.y) * cell
      const lit = hint && p.ask
      if (lit) {
        g.push(<line key={`gx${p.label}`} x1={cx} y1={cy} x2={cx} y2={oy + size * cell} stroke={ORANGE} strokeWidth="1.5" strokeDasharray="4 3" />)
        g.push(<line key={`gy${p.label}`} x1={cx} y1={cy} x2={ox} y2={cy} stroke={ORANGE} strokeWidth="1.5" strokeDasharray="4 3" />)
      }
      g.push(<g key={`p${p.label}`}>
        <line x1={cx - 5} y1={cy - 5} x2={cx + 5} y2={cy + 5} stroke={lit ? ORANGE : INK} strokeWidth="2.5" />
        <line x1={cx - 5} y1={cy + 5} x2={cx + 5} y2={cy - 5} stroke={lit ? ORANGE : INK} strokeWidth="2.5" />
        {txt(cx + 11, cy - 11, p.label, { size: 14, fill: lit ? ORANGE : INK })}
      </g>)
    }
  } else {
    // squares named by column letter and row number
    for (let i = 0; i < size; i++) {
      g.push(txt(ox + (i + 0.5) * cell, oy + size * cell + 14, 'ABCDEFGH'[i], { key: `cx${i}`, size: 12 }))
      g.push(txt(ox - 12, oy + (size - i - 0.5) * cell, i + 1, { key: `cy${i}`, size: 12 }))
    }
    g.push(<rect key="frame" x={ox} y={oy} width={size * cell} height={size * cell} fill="none" stroke={INK} strokeWidth="2" />)
    for (const p of points) {
      g.push(<text key={`e${p.label}`} x={ox + (p.x + 0.5) * cell} y={oy + (size - p.y - 0.5) * cell}
        textAnchor="middle" dominantBaseline="central" style={{ fontSize: cell * 0.62 }}>{p.label}</text>)
    }
  }
  if (compass) {
    const nx = ox + size * cell + 40, ny = oy + 34
    g.push(<g key="n">
      <line x1={nx} y1={ny + 22} x2={nx} y2={ny - 12} stroke={INK} strokeWidth="2.5" />
      <polygon points={`${nx - 7},${ny - 6} ${nx + 7},${ny - 6} ${nx},${ny - 18}`} fill={INK} />
      {txt(nx, ny - 28, say(lang, 'N', 'K', 'N'), { size: 14 })}
    </g>)
  }
  return { h: oy + size * cell + 30, g: <g>{g}</g> }
}

// ── solids ────────────────────────────────────────────────────────────────────
// Hidden edges dashed, which is how a child counts the ones at the back rather than guessing.
function solid(v) {
  const L = (a, b, hidden, key) => <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={INK}
    strokeWidth={hidden ? 1.6 : 2.4} strokeDasharray={hidden ? '5 4' : undefined} strokeLinecap="round" />
  const face = (pts, key, f = PAPER) => <polygon key={key} points={pts.map(p => p.join(',')).join(' ')} fill={f} stroke="none" />
  let g
  const box = (x, y, w, h, dx, dy) => {
    const A = [x, y + h], B = [x + w, y + h], C = [x + w, y], D = [x, y]
    const E = [x + dx, y + h - dy], F = [x + w + dx, y + h - dy], G = [x + w + dx, y - dy], H = [x + dx, y - dy]
    return <g>
      {face([A, B, C, D], 'f')}{face([D, C, G, H], 't', '#e3f3f5')}{face([B, F, G, C], 'r', '#d4ecef')}
      {L(A, B)}{L(B, C)}{L(C, D)}{L(D, A)}{L(D, H)}{L(C, G)}{L(B, F)}{L(H, G)}{L(G, F)}
      {L(A, E, true)}{L(E, F, true)}{L(E, H, true)}
    </g>
  }
  if (v.name === 'cube') g = box(95, 70, 100, 100, 45, 38)
  else if (v.name === 'cuboid') g = box(62, 88, 160, 80, 50, 40)
  else if (v.name === 'prism') {
    const A = [70, 170], B = [170, 170], C = [120, 85]
    const d = [80, -38], s = p => [p[0] + d[0], p[1] + d[1]]
    g = <g>
      {face([A, B, C], 'f')}{face([C, B, s(B), s(C)], 'r', '#d4ecef')}
      {L(A, B)}{L(B, C)}{L(C, A)}{L(C, s(C))}{L(B, s(B))}{L(s(B), s(C))}
      {L(A, s(A), true)}{L(s(A), s(B), true)}{L(s(A), s(C), true)}
    </g>
  } else if (v.name === 'pyramid') {
    const A = [70, 170], B = [200, 170], C = [250, 132], D = [120, 132], T = [160, 28]
    g = <g>
      {face([A, B, T], 'f')}{face([B, C, T], 'r', '#d4ecef')}
      {L(A, B)}{L(B, C)}{L(A, T)}{L(B, T)}{L(C, T)}
      {L(C, D, true)}{L(D, A, true)}{L(D, T, true)}
    </g>
  } else if (v.name === 'cylinder' || v.name === 'cone') {
    const cx = 160, rx = 70, ry = 20, top = 50, bottom = 165
    const back = `M ${cx - rx} ${bottom} A ${rx} ${ry} 0 0 1 ${cx + rx} ${bottom}`
    const front = `M ${cx - rx} ${bottom} A ${rx} ${ry} 0 0 0 ${cx + rx} ${bottom}`
    g = v.name === 'cylinder'
      ? <g>
        <path d={`M ${cx - rx} ${top} L ${cx - rx} ${bottom} ${front.replace('M', 'L').slice(0)} L ${cx + rx} ${top} Z`} fill={PAPER} />
        <ellipse cx={cx} cy={top} rx={rx} ry={ry} fill="#e3f3f5" stroke={INK} strokeWidth="2.4" />
        {L([cx - rx, top], [cx - rx, bottom])}{L([cx + rx, top], [cx + rx, bottom])}
        <path d={front} fill="none" stroke={INK} strokeWidth="2.4" />
        <path d={back} fill="none" stroke={INK} strokeWidth="1.6" strokeDasharray="5 4" />
      </g>
      : <g>
        <path d={`M ${cx} 26 L ${cx - rx} ${bottom} ${front.replace('M', 'L')} Z`} fill={PAPER} />
        {L([cx, 26], [cx - rx, bottom])}{L([cx, 26], [cx + rx, bottom])}
        <path d={front} fill="none" stroke={INK} strokeWidth="2.4" />
        <path d={back} fill="none" stroke={INK} strokeWidth="1.6" strokeDasharray="5 4" />
      </g>
  } else if (v.name === 'tetra') {
    const A = [70, 172], B = [200, 180], C = [252, 128], T = [150, 26]
    g = <g>
      {face([A, B, T], 'f')}{face([B, C, T], 'r', '#d4ecef')}
      {L(A, B)}{L(B, C)}{L(A, T)}{L(B, T)}{L(C, T)}{L(A, C, true)}
    </g>
  } else if (v.name === 'octa') {
    const E = [62, 104], F = [150, 128], G = [258, 102], H = [170, 80], T = [160, 12], Bo = [160, 192]
    g = <g>
      {face([E, F, T], 'f1')}{face([F, G, T], 'f2', '#d4ecef')}{face([E, F, Bo], 'f3', '#e3f3f5')}{face([F, G, Bo], 'f4', '#c6e4e8')}
      {L(E, F)}{L(F, G)}{L(T, E)}{L(T, F)}{L(T, G)}{L(Bo, E)}{L(Bo, F)}{L(Bo, G)}
      {L(G, H, true)}{L(H, E, true)}{L(T, H, true)}{L(Bo, H, true)}
    </g>
  } else if (v.name === 'pentprism' || v.name === 'hexprism') {
    // Standing on its end, seen from a little above: the top is all visible, and of the bottom
    // only the edges nearer than the widest points are.
    const n = v.name === 'pentprism' ? 5 : 6
    const cx = 160, R = 92, r = 30, top = 48, bottom = 162, off = n === 5 ? 90 : 0
    const ang = k => ((360 / n) * k + off) * Math.PI / 180
    const at = (k, y) => [cx + R * Math.cos(ang(k)), y + r * Math.sin(ang(k))]
    const xs = Array.from({ length: n }, (_, k) => at(k, 0)[0])
    const sil = new Set([xs.indexOf(Math.min(...xs)), xs.indexOf(Math.max(...xs))])
    const front = k => Math.sin(ang(k)) > 1e-6 || sil.has(k)
    const ks = Array.from({ length: n }, (_, k) => k)
    g = <g>
      {face(ks.map(k => at(k, top)), 'top', '#e3f3f5')}
      {ks.filter(k => front(k) && front((k + 1) % n)).map(k => face([at(k, top), at((k + 1) % n, top), at((k + 1) % n, bottom), at(k, bottom)], `s${k}`, k % 2 ? '#d4ecef' : PAPER))}
      {ks.map(k => L(at(k, top), at((k + 1) % n, top), false, `t${k}`))}
      {ks.map(k => L(at(k, top), at(k, bottom), !front(k), `v${k}`))}
      {ks.map(k => L(at(k, bottom), at((k + 1) % n, bottom), !(front(k) && front((k + 1) % n) && Math.sin((ang(k) + ang(k + 1)) / 2) > 0), `b${k}`))}
    </g>
  } else if (v.name === 'sphere') {
    g = <g>
      <circle cx={160} cy={102} r={78} fill={PAPER} stroke={INK} strokeWidth="2.4" />
      <path d="M 82 102 A 78 20 0 0 0 238 102" fill="none" stroke={INK} strokeWidth="1.8" />
      <path d="M 82 102 A 78 20 0 0 1 238 102" fill="none" stroke={INK} strokeWidth="1.4" strokeDasharray="5 4" />
    </g>
  } else return null
  return { h: 196, g }
}

// ── tally chart ───────────────────────────────────────────────────────────────
// Five is four strokes and a gate across them, which is the thing being learnt.
function tally(v) {
  const rowH = 34, labelW = 110, ox = 14
  const tw = W - ox * 2
  const rows = v.rows
  const g = <g>
    <rect x={ox} y={6} width={tw} height={rowH * rows.length} rx={4} fill="white" stroke={INK} strokeWidth="2" />
    {rows.map((r, i) => {
      const y = 6 + i * rowH
      const marks = []
      let x = ox + labelW + 12
      for (let k = 0; k < r.count; k++) {
        const inGroup = k % 5
        if (inGroup === 4) {
          marks.push(<line key={k} x1={x - 4 * 8 - 3} y1={y + rowH - 10} x2={x + 1} y2={y + 10} stroke={INK} strokeWidth="2" strokeLinecap="round" />)
          x += 12
        } else {
          marks.push(<line key={k} x1={x} y1={y + 8} x2={x} y2={y + rowH - 8} stroke={INK} strokeWidth="2" strokeLinecap="round" />)
          x += 8
        }
      }
      return <g key={r.label}>
        {i > 0 && <line x1={ox} y1={y} x2={ox + tw} y2={y} stroke={GRID} strokeWidth="1.5" />}
        {txt(ox + 10, y + rowH / 2, r.label, { size: 13, anchor: 'start' })}
        {marks}
      </g>
    })}
    <line x1={ox + labelW} y1={6} x2={ox + labelW} y2={6 + rowH * rows.length} stroke={INK} strokeWidth="1.8" />
  </g>
  return { h: 12 + rowH * rows.length, g }
}

// ── flat shapes for symmetry and right angles ─────────────────────────────────
const REG = (n, r = 78, cx = 160, cy = 104, rot = -Math.PI / 2) =>
  Array.from({ length: n }, (_, i) => [cx + r * Math.cos(rot + (i * 2 * Math.PI) / n), cy + r * Math.sin(rot + (i * 2 * Math.PI) / n)])
// Points, and the mirror lines as pairs of points (drawn only in the hint).
const POLYGONS = {
  square: { pts: [[90, 34], [230, 34], [230, 174], [90, 174]], lines: [[[160, 20], [160, 188]], [[76, 104], [244, 104]], [[80, 24], [240, 184]], [[240, 24], [80, 184]]], right: [0, 1, 2, 3] },
  rectangle: { pts: [[50, 54], [270, 54], [270, 154], [50, 154]], lines: [[[160, 40], [160, 168]], [[36, 104], [284, 104]]], right: [0, 1, 2, 3] },
  equilateral: { pts: REG(3, 90, 160, 118), lines: [] },
  isosceles: { pts: [[160, 22], [230, 180], [90, 180]], lines: [[[160, 12], [160, 192]]] },
  rightTriangle: { pts: [[80, 30], [80, 180], [250, 180]], lines: [], right: [1] },
  scalene: { pts: [[70, 180], [270, 180], [120, 40]], lines: [] },
  pentagon: { pts: REG(5), lines: [] },
  hexagon: { pts: REG(6, 82, 160, 104, 0), lines: [] },
  octagon: { pts: REG(8, 82, 160, 104, Math.PI / 8), lines: [] },
  parallelogram: { pts: [[60, 170], [210, 170], [260, 40], [110, 40]], lines: [] },
  rhombus: { pts: [[160, 18], [240, 104], [160, 190], [80, 104]], lines: [[[160, 8], [160, 200]], [[66, 104], [254, 104]]] },
  kite: { pts: [[160, 18], [225, 80], [160, 192], [95, 80]], lines: [[[160, 8], [160, 202]]] },
  trapezium: { pts: [[60, 170], [260, 170], [210, 50], [110, 50]], lines: [[[160, 38], [160, 182]]] },
  rightTrapezium: { pts: [[70, 170], [250, 170], [250, 50], [150, 50]], lines: [], right: [1, 2] },
  lShape: { pts: [[70, 30], [140, 30], [140, 120], [250, 120], [250, 180], [70, 180]], lines: [], right: [0, 1, 3, 4, 5] },
}
// Mirror lines of a regular n-gon run through the centre at every half-step.
for (const [name, n] of [['equilateral', 3], ['pentagon', 5], ['hexagon', 6], ['octagon', 8]]) {
  const p = POLYGONS[name].pts
  const cx = p.reduce((s, q) => s + q[0], 0) / n, cy = p.reduce((s, q) => s + q[1], 0) / n
  const rot = Math.atan2(p[0][1] - cy, p[0][0] - cx)
  POLYGONS[name].lines = Array.from({ length: n }, (_, i) => {
    const a = rot + (i * Math.PI) / n
    return [[cx + 96 * Math.cos(a), cy + 96 * Math.sin(a)], [cx - 96 * Math.cos(a), cy - 96 * Math.sin(a)]]
  })
}

function polygon(v, hint) {
  const p = POLYGONS[v.name]
  if (!p) return null
  const mark = i => {
    const n = p.pts.length
    const [x, y] = p.pts[i], a = p.pts[(i + n - 1) % n], b = p.pts[(i + 1) % n]
    const u = [(a[0] - x), (a[1] - y)], w = [(b[0] - x), (b[1] - y)]
    const nu = Math.hypot(...u), nw = Math.hypot(...w), s = 14
    const P = [x + (u[0] / nu) * s, y + (u[1] / nu) * s], Q = [x + (w[0] / nw) * s, y + (w[1] / nw) * s]
    const R = [P[0] + Q[0] - x, P[1] + Q[1] - y]
    return <path key={`r${i}`} d={`M ${P} L ${R} L ${Q}`} fill="none" stroke={ORANGE} strokeWidth="2" />
  }
  const g = <g>
    <polygon points={p.pts.map(q => q.join(',')).join(' ')} fill={PAPER} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
    {hint && v.ask === 'lines' && p.lines.map(([a, b], i) => (
      <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={ORANGE} strokeWidth="2" strokeDasharray="6 5" />
    ))}
    {hint && v.ask === 'right' && (p.right || []).map(mark)}
  </g>
  return { h: 206, g }
}

// ── price tags ────────────────────────────────────────────────────────────────
function Prices({ items }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 340, flexShrink: 0 }}>
      {items.map(it => (
        <div key={it.name} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 82,
          background: '#f6fbfc', border: `1.5px solid ${GRID}`, borderRadius: 14, padding: '8px 10px',
        }}>
          <span style={{ fontSize: 28, lineHeight: 1.1 }}>{it.icon}</span>
          <span style={{ font: `600 12px ${FONT}`, color: '#617383' }}>{it.name}</span>
          <span style={{ font: `800 15px ${FONT}`, color: ORANGE }}>{it.price}</span>
        </div>
      ))}
    </div>
  )
}

// ── digital clock faces ───────────────────────────────────────────────────────
function Digital({ times, labels = [] }) {
  return (
    <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
      {times.map((t, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{
            background: '#1f3a48', color: '#bff3ea', borderRadius: 12, padding: '8px 16px',
            font: `700 30px ui-monospace, "SF Mono", Menlo, Consolas, monospace`, letterSpacing: 2,
            boxShadow: 'inset 0 0 0 3px #2f5566',
          }}>{t}</div>
          {labels[i] && <span style={{ font: `600 12px ${FONT}`, color: '#617383' }}>{labels[i]}</span>}
        </div>
      ))}
    </div>
  )
}

// ── nets ──────────────────────────────────────────────────────────────────────
// "Which 3D shape does this net make?" — thirteen times in Bond's 10-11 book and in the 8-9 one.
// Each net is the textbook one: the cross for a cube, the cross of rectangles for a cuboid, three
// rectangles and two triangles for a triangular prism, a square with four triangles for a
// pyramid, a rectangle and two circles for a cylinder, a sector and a circle for a cone.
function net(v) {
  const R = (x, y, w, h, k) => <rect key={k} x={x} y={y} width={w} height={h} fill={PAPER} stroke={INK} strokeWidth="2" />
  const P = (pts, k) => <polygon key={k} points={pts.map(p => p.join(',')).join(' ')} fill={PAPER} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
  let g
  if (v.name === 'cube' || v.name === 'cuboid') {
    const [w, h, d] = v.name === 'cube' ? [44, 44, 44] : [60, 38, 26]
    const x0 = 160 - w / 2 - d, y0 = 8
    g = <g>
      {R(x0 + d, y0, w, d, 'a')}{R(x0 + d, y0 + d, w, h, 'b')}{R(x0 + d, y0 + d + h, w, d, 'c')}{R(x0 + d, y0 + 2 * d + h, w, h, 'd')}
      {R(x0, y0 + d, d, h, 'l')}{R(x0 + d + w, y0 + d, d, h, 'r')}
    </g>
    return { h: y0 * 2 + 2 * d + 2 * h, g }
  }
  if (v.name === 'prism') {
    const w = 46, h = 70, x0 = 160 - 1.5 * w, y0 = 40
    g = <g>
      {R(x0, y0, w, h, 'a')}{R(x0 + w, y0, w, h, 'b')}{R(x0 + 2 * w, y0, w, h, 'c')}
      {P([[x0 + w, y0], [x0 + 2 * w, y0], [x0 + 1.5 * w, y0 - 38]], 't')}
      {P([[x0 + w, y0 + h], [x0 + 2 * w, y0 + h], [x0 + 1.5 * w, y0 + h + 38]], 'u')}
    </g>
    return { h: y0 + h + 48, g }
  }
  if (v.name === 'pyramid') {
    const s = 60, cx = 160, cy = 100, e = 52
    const A = [cx - s / 2, cy - s / 2], B = [cx + s / 2, cy - s / 2], C = [cx + s / 2, cy + s / 2], D = [cx - s / 2, cy + s / 2]
    g = <g>
      {P([A, B, [cx, cy - s / 2 - e]], 'n')}{P([B, C, [cx + s / 2 + e, cy]], 'e')}
      {P([C, D, [cx, cy + s / 2 + e]], 's')}{P([D, A, [cx - s / 2 - e, cy]], 'w')}
      {R(A[0], A[1], s, s, 'b')}
    </g>
    return { h: 200, g }
  }
  if (v.name === 'cylinder') {
    const w = 120, h = 60, r = 26, x0 = 100, y0 = 2 * r + 8
    g = <g>
      {R(x0, y0, w, h, 'b')}
      <circle cx={x0 + w / 2} cy={y0 - r} r={r} fill={PAPER} stroke={INK} strokeWidth="2" />
      <circle cx={x0 + w / 2} cy={y0 + h + r} r={r} fill={PAPER} stroke={INK} strokeWidth="2" />
    </g>
    return { h: y0 + h + 2 * r + 8, g }
  }
  if (v.name === 'cone') {
    const cx = 160, top = 10, L = 110, span = 1.6
    const a0 = Math.PI / 2 - span / 2, a1 = Math.PI / 2 + span / 2
    const p0 = [cx + L * Math.cos(a0), top + L * Math.sin(a0)], p1 = [cx + L * Math.cos(a1), top + L * Math.sin(a1)]
    const r = 28, by = top + L + r
    g = <g>
      <path d={`M ${cx} ${top} L ${p0} A ${L} ${L} 0 0 1 ${p1} Z`} fill={PAPER} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={cx} cy={by} r={r} fill={PAPER} stroke={INK} strokeWidth="2" />
    </g>
    return { h: by + r + 8, g }
  }
  return null
}

// ── Venn and Carroll diagrams ─────────────────────────────────────────────────
// Sorting numbers by two properties, as both young books do. The part asked about is shaded;
// the circles and boxes carry their labels, and no number is written in — placing it is the
// question.
function venn(v) {
  const [a, b] = v.labels
  const cy = 100, r = 70, lx = 122, rx = 198
  const shade = '#f7dcc0'
  const id = `vn${v.shade}`
  const clip = <defs>
    <clipPath id={`${id}l`}><circle cx={lx} cy={cy} r={r} /></clipPath>
    <clipPath id={`${id}r`}><circle cx={rx} cy={cy} r={r} /></clipPath>
  </defs>
  let fill = null
  if (v.shade === 'both') fill = <circle cx={rx} cy={cy} r={r} fill={shade} clipPath={`url(#${id}l)`} />
  if (v.shade === 'left') fill = <g><circle cx={lx} cy={cy} r={r} fill={shade} /><circle cx={rx} cy={cy} r={r} fill="white" clipPath={`url(#${id}l)`} /></g>
  if (v.shade === 'right') fill = <g><circle cx={rx} cy={cy} r={r} fill={shade} /><circle cx={lx} cy={cy} r={r} fill="white" clipPath={`url(#${id}r)`} /></g>
  if (v.shade === 'outside') fill = <g><rect x={20} y={14} width={280} height={170} fill={shade} /><circle cx={lx} cy={cy} r={r} fill="white" /><circle cx={rx} cy={cy} r={r} fill="white" /></g>
  // The "?" sits in the shaded part.
  const qx = { both: 160, left: 88, right: 232, outside: 40 }[v.shade]
  const qy = v.shade === 'outside' ? 34 : cy
  const g = <g>
    {clip}
    <rect x={20} y={14} width={280} height={170} fill="white" />
    {fill}
    <rect x={20} y={14} width={280} height={170} fill="none" stroke={INK} strokeWidth="2" rx="6" />
    <circle cx={lx} cy={cy} r={r} fill="none" stroke={INK} strokeWidth="2.2" />
    <circle cx={rx} cy={cy} r={r} fill="none" stroke={INK} strokeWidth="2.2" />
    {txt(lx - 10, 198, a, { size: 12, anchor: 'end' })}
    {txt(rx + 10, 198, b, { size: 12, anchor: 'start' })}
    {txt(qx, qy, '?', { size: 22, fill: ORANGE })}
  </g>
  return { h: 210, g }
}

function carroll(v) {
  const [colLabels, rowLabels] = [v.cols, v.rows]
  const labelW = 118, colW = 96, rowH = 52, top = 34, ox = 6
  const cell = (r, c) => <rect key={`${r}${c}`} x={ox + labelW + c * colW} y={top + r * rowH} width={colW} height={rowH}
    fill={v.cell[0] === r && v.cell[1] === c ? '#f7dcc0' : 'white'} stroke={INK} strokeWidth="2" />
  const g = <g>
    {[0, 1].map(c => txt(ox + labelW + (c + 0.5) * colW, top - 13, colLabels[c], { size: 12, key: `c${c}` }))}
    {[0, 1].map(r => txt(ox + labelW - 8, top + (r + 0.5) * rowH, rowLabels[r], { size: 12, anchor: 'end', key: `r${r}` }))}
    {[0, 1].flatMap(r => [0, 1].map(c => cell(r, c)))}
    {txt(ox + labelW + (v.cell[1] + 0.5) * colW, top + (v.cell[0] + 0.5) * rowH, '?', { size: 22, fill: ORANGE, key: 'q' })}
  </g>
  return { h: top + 2 * rowH + 10, g }
}

// ── a route between towns ─────────────────────────────────────────────────────
// Bond 7-8 Paper 8: towns joined by roads, each road labelled with its length. The zigzag keeps
// the labels apart; the route is drawn in order, so "from A to C" is read along the line.
function route(v) {
  const n = v.towns.length
  const xs = v.towns.map((_, i) => 28 + (i * 264) / (n - 1))
  const ys = v.towns.map((_, i) => (i % 2 ? 150 : 60))
  const g = <g>
    {v.legs.map((d, i) => {
      // Each label sits in the pocket to the LEFT of its road (below a "\\", above a "/"), so
      // every pocket of the zigzag holds exactly one label and neighbours never touch.
      const dx = xs[i + 1] - xs[i], dy = ys[i + 1] - ys[i], len = Math.hypot(dx, dy)
      const [nx, ny] = dy > 0 ? [-dy / len, dx / len] : [dy / len, -dx / len]
      const mx = (xs[i] + xs[i + 1]) / 2 + nx * 26, my = (ys[i] + ys[i + 1]) / 2 + ny * 26
      return <g key={i}>
        <line x1={xs[i]} y1={ys[i]} x2={xs[i + 1]} y2={ys[i + 1]} stroke="#c9b48a" strokeWidth="7" strokeLinecap="round" />
        <line x1={xs[i]} y1={ys[i]} x2={xs[i + 1]} y2={ys[i + 1]} stroke="white" strokeWidth="1.5" strokeDasharray="5 5" />
        {txt(mx, my, `${d} ${v.unit}`, { size: 12, fill: ORANGE })}
      </g>
    })}
    {v.towns.map((name, i) => <g key={name}>
      <circle cx={xs[i]} cy={ys[i]} r={7} fill={INK} />
      {txt(xs[i], ys[i] + (i % 2 ? 22 : -20), name, { size: 13 })}
    </g>)}
  </g>
  return { h: 190, g }
}

// ── a spinner ─────────────────────────────────────────────────────────────────
// Equal sectors, each a colour; the colour name is written in the sector so the question does
// not depend on telling colours apart.
const SPIN_COLOURS = { red: '#ef8a80', blue: '#8fbfe8', green: '#9fd48a', yellow: '#f5d77a' }
function spinner(v) {
  const cx = 160, cy = 102, r = 88, n = v.sectors.length
  const g = <g>
    {v.sectors.map((c, i) => {
      const a0 = (i / n) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2
      const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)], p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)]
      const m = (a0 + a1) / 2
      return <g key={i}>
        <path d={`M ${cx} ${cy} L ${p0} A ${r} ${r} 0 0 1 ${p1} Z`} fill={SPIN_COLOURS[c.colour]} stroke="white" strokeWidth="2" />
        {txt(cx + r * 0.66 * Math.cos(m), cy + r * 0.66 * Math.sin(m), c.label, { size: n > 8 ? 9 : 11 })}
      </g>
    })}
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={INK} strokeWidth="2" />
    <line x1={cx} y1={cy} x2={cx + 30} y2={cy - 48} stroke={INK} strokeWidth="4" strokeLinecap="round" />
    <circle cx={cx} cy={cy} r={7} fill={INK} />
  </g>
  return { h: 204, g }
}

// ── a map with a scale ────────────────────────────────────────────────────────
// Two places, the straight line between them marked off in centimetres, and the scale written
// on the map as a real map writes it. Counting the marks is reading the map; the scale turns
// it into distance.
function mapScale(v, lang) {
  const x0 = 34, x1 = 286, y = 92
  const step = (x1 - x0) / v.cm
  const g = <g>
    <rect x={8} y={8} width={304} height={170} rx={10} fill="#eef6e8" stroke="#b9d3a8" strokeWidth="2" />
    <path d="M 20 150 C 90 120, 140 170, 220 140 S 300 120, 306 132" fill="none" stroke="#9cc7e6" strokeWidth="9" strokeLinecap="round" />
    <line x1={x0} y1={y} x2={x1} y2={y} stroke={INK} strokeWidth="2" strokeDasharray="4 4" />
    {Array.from({ length: v.cm + 1 }, (_, i) => <line key={i} x1={x0 + i * step} y1={y - 6} x2={x0 + i * step} y2={y + 6} stroke={INK} strokeWidth="1.5" />)}
    <circle cx={x0} cy={y} r={8} fill={ORANGE} /><circle cx={x1} cy={y} r={8} fill={ORANGE} />
    {txt(x0 + 4, y - 24, v.from, { size: 13, anchor: 'start' })}
    {txt(x1 - 4, y - 24, v.to, { size: 13, anchor: 'end' })}
    <rect x={18} y={18} width={132} height={22} rx={6} fill="white" stroke={INK} strokeWidth="1" />
    {txt(84, 29, say(lang, `Scale: 1 cm = ${v.per} km`, `Ölçek: 1 cm = ${v.per} km`, `Escala: 1 cm = ${v.per} km`), { size: 11 })}
    {txt(160, y + 22, say(lang, 'each mark is 1 cm', 'her çizgi arası 1 cm', 'cada marca es 1 cm'), { size: 11, weight: 600, fill: '#617383' })}
  </g>
  return { h: 186, g }
}

// ══ Ages 11-12 ════════════════════════════════════════════════════════════════════════════════
const TEAL = '#168b91'
const signed = (n, lang) => label(n, lang).replace(/^-/, '−')

// ── a coordinate grid, in four quadrants or one ───────────────────────────────
// The axes cross at 0 wherever that is; every whole number is labelled, the way the book's
// grids are, because reading "−3" off the axis IS the question.
function plane(v, lang) {
  const { min, max, points = [], path } = v
  const n = max - min
  const cell = Math.min(28, Math.floor(236 / n))
  const size = n * cell
  const ox = (W - size) / 2, oy = 30
  const X = x => ox + (x - min) * cell, Y = y => oy + (max - y) * cell
  const g = []
  for (let i = 0; i <= n; i++) {
    g.push(<line key={`h${i}`} x1={ox} y1={oy + i * cell} x2={ox + size} y2={oy + i * cell} stroke={GRID} strokeWidth="1" />)
    g.push(<line key={`v${i}`} x1={ox + i * cell} y1={oy} x2={ox + i * cell} y2={oy + size} stroke={GRID} strokeWidth="1" />)
  }
  g.push(<line key="ax" x1={ox - 4} y1={Y(0)} x2={ox + size + 10} y2={Y(0)} stroke={INK} strokeWidth="2" />)
  g.push(<line key="ay" x1={X(0)} y1={oy + size + 4} x2={X(0)} y2={oy - 10} stroke={INK} strokeWidth="2" />)
  const fs = cell < 22 ? 10 : 12
  for (let t = min; t <= max; t++) {
    if (t === 0) continue
    g.push(txt(X(t), Y(0) + 11, signed(t, lang), { key: `nx${t}`, size: fs, weight: 600 }))
    g.push(txt(X(0) - (t < 0 ? 12 : 8), Y(t), signed(t, lang), { key: `ny${t}`, size: fs, weight: 600 }))
  }
  g.push(txt(X(0) - 7, Y(0) + 10, '0', { key: 'o', size: fs, weight: 600 }))
  g.push(txt(ox + size + 16, Y(0), 'x', { key: 'lx', size: 13, fill: '#617383' }))
  g.push(txt(X(0), oy - 16, 'y', { key: 'ly', size: 13, fill: '#617383' }))
  for (const l of v.lines || []) {
    // Clip y = mx + c to the grid, then label it at the far end, inside the grid.
    const xs = [min, max], cand = []
    for (const x of xs) { const y = l.m * x + l.c; if (y >= min - 1e-9 && y <= max + 1e-9) cand.push([x, y]) }
    if (l.m) for (const y of [min, max]) { const x = (y - l.c) / l.m; if (x > min && x < max) cand.push([x, y]) }
    cand.sort((p, q) => p[0] - q[0])
    const [p0, p1] = [cand[0], cand[cand.length - 1]]
    if (!p0 || !p1) continue
    g.push(<line key={`L${l.label}`} x1={X(p0[0])} y1={Y(p0[1])} x2={X(p1[0])} y2={Y(p1[1])} stroke={TEAL} strokeWidth="2.5" />)
    const lx = p0[0] + (p1[0] - p0[0]) * 0.86, ly = p0[1] + (p1[1] - p0[1]) * 0.86
    g.push(txt(X(lx) + 9, Y(ly) - 9, l.label, { key: `LL${l.label}`, size: 15, fill: ORANGE }))
  }
  if (path) g.push(<polyline key="path" points={path.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')} fill={path.length > 3 ? 'rgba(126,203,208,.25)' : 'none'} stroke={TEAL} strokeWidth="2.5" strokeLinejoin="round" />)
  for (const p of points) {
    const cx = X(p.x), cy = Y(p.y)
    g.push(<g key={`p${p.label}${p.x},${p.y}`}>
      {p.label
        ? <><line x1={cx - 5} y1={cy - 5} x2={cx + 5} y2={cy + 5} stroke={INK} strokeWidth="2.5" /><line x1={cx - 5} y1={cy + 5} x2={cx + 5} y2={cy - 5} stroke={INK} strokeWidth="2.5" /></>
        : <circle cx={cx} cy={cy} r={4.5} fill={INK} />}
      {p.label && txt(cx + (p.x < 0 ? -10 : 10), cy + (p.y < 0 ? 11 : -11), p.label, { size: 14, fill: ORANGE })}
    </g>)
  }
  return { h: oy + size + 22, g: <g>{g}</g> } // a label under a point on the bottom row
}

// ── angle diagrams ────────────────────────────────────────────────────────────
// Drawn to the real angles. Only the angles that carry a label get an arc, so the picture shows
// exactly what the question gives and asks.
const P = (cx, cy, r, deg) => [cx + r * Math.cos(deg * Math.PI / 180), cy - r * Math.sin(deg * Math.PI / 180)]
function arcLabel(key, cx, cy, from, to, text) {
  const span = to - from
  const r = span > 100 ? 18 : 24
  const [x1, y1] = P(cx, cy, r, from), [x2, y2] = P(cx, cy, r, to)
  const lr = r + (span < 45 ? 22 : 16)
  const [lx, ly] = P(cx, cy, lr, from + span / 2)
  const ask = text === '?'
  return <g key={key}>
    <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${span > 180 ? 1 : 0} 0 ${x2} ${y2}`} fill="none" stroke={ask ? ORANGE : TEAL} strokeWidth="2" />
    {txt(lx, ly, text, { size: 14, fill: ask ? ORANGE : INK })}
  </g>
}
function angles(v) {
  let g
  if (v.type === 'triangle') {
    const ta = Math.tan(v.a * Math.PI / 180), tc = Math.tan(v.c * Math.PI / 180)
    const tx = tc / (ta + tc), ty = ta * tc / (ta + tc)
    const ext = v.labels.ext != null
    const s = Math.min(ext ? 190 : 230, 150 / ty)
    const x0 = (W - s - (ext ? 70 : 0)) / 2, y0 = 176
    const A = [x0, y0], C = [x0 + s, y0], B = [x0 + s * tx, y0 - s * ty]
    const dirTo = (p, q) => Math.atan2(p[1] - q[1], q[0] - p[0]) * 180 / Math.PI
    const lb = v.labels
    const tick = (p, q, key) => {
      const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], d = Math.hypot(q[0] - p[0], q[1] - p[1])
      const nx = -(q[1] - p[1]) / d * 7, ny = (q[0] - p[0]) / d * 7
      return <line key={key} x1={m[0] - nx} y1={m[1] - ny} x2={m[0] + nx} y2={m[1] + ny} stroke={INK} strokeWidth="2" />
    }
    const bDir1 = dirTo(B, C), bDir2 = dirTo(B, A)
    g = <g>
      <polygon points={[A, B, C].map(p => p.join(',')).join(' ')} fill={PAPER} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      {ext && <line x1={C[0]} y1={C[1]} x2={C[0] + 70} y2={C[1]} stroke={INK} strokeWidth="2.5" />}
      {v.ticks && <>{tick(A, B, 't1')}{tick(C, B, 't2')}</>}
      {lb.a && arcLabel('a', ...A, 0, v.a, lb.a)}
      {lb.c && arcLabel('c', ...C, 180 - v.c, 180, lb.c)}
      {lb.b && arcLabel('b', ...B, (bDir2 + 360) % 360, (bDir1 + 360) % 360, lb.b)}
      {ext && arcLabel('e', ...C, 0, 180 - v.c, lb.ext)}
    </g>
  } else if (v.type === 'parallel') {
    // Two parallel lines (arrow-marked) cut by a slanted line; the given angle at the top
    // crossing, the asked one at the bottom — alternate, corresponding or co-interior.
    const t = v.t, yT = 56, yB = 150, xB = 120
    const xT = xB + (yB - yT) / Math.tan(t * Math.PI / 180)
    const arrow = (x, y, key) => <polygon key={key} points={`${x - 5},${y - 5} ${x + 3},${y} ${x - 5},${y + 5}`} fill="none" stroke={INK} strokeWidth="1.8" />
    // The slanted line runs from just above the top line to just below the bottom one — a fixed
    // length along a steep angle ran it 135px out of the drawing.
    const xAt = y => xB + (yB - y) / Math.tan(t * Math.PI / 180)
    const [e1, e2] = [[xAt(186), 186], [xAt(20), 20]]
    const topGiven = v.ask === 'alt' ? [180, 180 + t] : v.ask === 'corr' ? [0, t] : [180 + t, 360]
    g = <g>
      <line x1={20} y1={yT} x2={300} y2={yT} stroke={INK} strokeWidth="2.5" />
      <line x1={20} y1={yB} x2={300} y2={yB} stroke={INK} strokeWidth="2.5" />
      {arrow(60, yT, 'a1')}{arrow(60, yB, 'a2')}
      <line x1={e1[0]} y1={e1[1]} x2={e2[0]} y2={e2[1]} stroke={INK} strokeWidth="2.5" />
      {arcLabel('top', xT, yT, topGiven[0], topGiven[1], `${v.ask === 'co' ? 180 - t : t}°`)}
      {arcLabel('bot', xB, yB, 0, t, '?')}
    </g>
  } else if (v.type === 'cross') {
    const cx = 160, cy = 100, r = 96, h = v.a / 2
    const lb = v.labels
    g = <g>
      {[90 - h, 90 + h].map(d => { const [x1, y1] = P(cx, cy, r, d), [x2, y2] = P(cx, cy, r, d + 180); return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth="2.5" /> })}
      {lb.top && arcLabel('t', cx, cy, 90 - h, 90 + h, lb.top)}
      {lb.bottom && arcLabel('b', cx, cy, 270 - h, 270 + h, lb.bottom)}
      {lb.left && arcLabel('l', cx, cy, 90 + h, 270 - h, lb.left)}
      {lb.right && arcLabel('r', cx, cy, -90 + h, 90 - h, lb.right)}
    </g>
  } else {
    const cx = 160, cy = 150, r = 120, y = (180 - v.m) / 2
    const lb = v.labels
    g = <g>
      <line x1={cx - 140} y1={cy} x2={cx + 140} y2={cy} stroke={INK} strokeWidth="2.5" />
      {[y, y + v.m].map(d => { const [x2, y2] = P(cx, cy, r, d); return <line key={d} x1={cx} y1={cy} x2={x2} y2={y2} stroke={INK} strokeWidth="2.5" /> })}
      {arcLabel('r', cx, cy, 0, y, lb.right)}
      {arcLabel('m', cx, cy, y, y + v.m, lb.m)}
      {arcLabel('l', cx, cy, y + v.m, 180, lb.left)}
    </g>
  }
  return { h: v.type === 'line' ? 168 : 200, g }
}

// ── compound shapes ───────────────────────────────────────────────────────────
// Every length is a dimension line with its own end bars, so "15 cm" over part of an edge
// cannot be read as the whole edge.
function dim(key, x1, y1, x2, y2, text, off) {
  const vert = x1 === x2
  const [dx, dy] = vert ? [off, 0] : [0, off]
  const a = [x1 + dx, y1 + dy], b = [x2 + dx, y2 + dy]
  const bar = p => vert ? <line x1={p[0] - 4} y1={p[1]} x2={p[0] + 4} y2={p[1]} stroke="#617383" strokeWidth="1.3" /> : <line x1={p[0]} y1={p[1] - 4} x2={p[0]} y2={p[1] + 4} stroke="#617383" strokeWidth="1.3" />
  const tx = (a[0] + b[0]) / 2 + (vert ? Math.sign(off) * 22 : 0), ty = (a[1] + b[1]) / 2 + (vert ? 0 : Math.sign(off) * 11)
  return <g key={key}>
    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#617383" strokeWidth="1.3" />{bar(a)}{bar(b)}
    {txt(tx, ty, text, { size: 12 })}
  </g>
}
function compound(v) {
  const { W: w, H: h, cw, ch, unit, style } = v
  const s = Math.min(200 / w, 150 / h)
  const ox = (W - w * s) / 2, oy = 32
  const X = x => ox + x * s, Y = y => oy + y * s
  const u = n => `${n} ${unit}`
  let g
  if (style === 'L') {
    const pts = [[0, 0], [w - cw, 0], [w - cw, ch], [w, ch], [w, h], [0, h]]
    g = <g>
      <polygon points={pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')} fill={PAPER} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      {dim('t', X(0), Y(0), X(w - cw), Y(0), u(w - cw), -10)}
      {dim('b', X(0), Y(h), X(w), Y(h), u(w), 10)}
      {dim('l', X(0), Y(0), X(0), Y(h), u(h), -10)}
      {dim('r', X(w), Y(ch), X(w), Y(h), u(h - ch), 10)}
    </g>
  } else {
    g = <g>
      <rect x={X(0)} y={Y(0)} width={w * s} height={h * s} fill={FILL} stroke={INK} strokeWidth="2.5" />
      <rect x={X(0)} y={Y(0)} width={cw * s} height={ch * s} fill="white" stroke={INK} strokeWidth="2" />
      {dim('t', X(0), Y(0), X(cw), Y(0), u(cw), -10)}
      {dim('l', X(0), Y(0), X(0), Y(ch), u(ch), -10)}
      {dim('b', X(0), Y(h), X(w), Y(h), u(w), 10)}
      {dim('r', X(w), Y(0), X(w), Y(h), u(h), 10)}
    </g>
  }
  return { h: oy + h * s + 30, g }
}

// ── a function machine ────────────────────────────────────────────────────────
function machine(v) {
  const n = Math.max(v.inputs.length, v.outputs.length)
  const cy = 30 + n * 12
  const col = (list, x, key) => list.map((t, i) => txt(x, cy + (i - (list.length - 1) / 2) * 24, t, { key: `${key}${i}`, size: 16, fill: t === '?' ? ORANGE : INK }))
  const arrow = (x1, x2, key) => <g key={key}>
    <line x1={x1} y1={cy} x2={x2 - 7} y2={cy} stroke={INK} strokeWidth="2" />
    <polygon points={`${x2 - 9},${cy - 5} ${x2},${cy} ${x2 - 9},${cy + 5}`} fill={INK} />
  </g>
  const box = (x, op, key) => <g key={key}>
    <rect x={x} y={cy - 20} width={66} height={40} rx={6} fill={op ? PAPER : 'rgba(184,91,16,.08)'} stroke={op ? INK : ORANGE} strokeWidth="2" strokeDasharray={op ? undefined : '5 4'} />
    {txt(x + 33, cy, op ?? '?', { size: 16, fill: op ? INK : ORANGE })}
  </g>
  const g = <g>
    {col(v.inputs, 24, 'i')}
    {arrow(42, 66, 'a1')}{box(66, v.ops[0], 'b1')}{arrow(132, 160, 'a2')}{box(160, v.ops[1], 'b2')}{arrow(226, 256, 'a3')}
    {col(v.outputs, 284, 'o')}
  </g>
  return { h: cy * 2, g }
}

// ── the number cross ──────────────────────────────────────────────────────────
function numcross(v) {
  const c = 42, ox = (W - v.row.length * c) / 2, oy = 10
  const cellAt = (x, y, t, key) => <g key={key}>
    <rect x={x} y={y} width={c} height={c} fill="white" stroke={INK} strokeWidth="2" />
    {txt(x + c / 2, y + c / 2, t, { size: 16, fill: typeof t === 'string' ? ORANGE : INK })}
  </g>
  const g = <g>
    {v.row.map((t, i) => cellAt(ox + i * c, oy, t, `r${i}`))}
    {v.col.slice(1).map((t, i) => cellAt(ox + v.at * c, oy + (i + 1) * c, t, `c${i}`))}
  </g>
  return { h: oy + v.col.length * c + 10, g }
}

// ── dot patterns ──────────────────────────────────────────────────────────────
function dots(v) {
  const d = 9, gap = 20
  const shapes = [1, 2, 3, 4].map(k => {
    const pts = []
    for (let r = 0; r < k; r++) for (let q = 0; q < (v.tri ? r + 1 : k); q++) pts.push(v.tri ? [q * d - r * d / 2, r * d] : [q * d, r * d])
    return pts
  })
  const widths = [1, 2, 3, 4].map(k => (k - 1) * d + 8)
  let x = 16
  const g = []
  shapes.forEach((pts, i) => {
    const cx = x + widths[i] / 2
    const minX = Math.min(...pts.map(p => p[0])), maxX = Math.max(...pts.map(p => p[0]))
    const shift = cx - (minX + maxX) / 2
    pts.forEach(([px, py], j) => g.push(<circle key={`${i}-${j}`} cx={px + shift} cy={70 - 4 * d + py + (4 - i - 1) * d} r={3.2} fill={TEAL} />))
    g.push(txt(cx, 92, v.terms[i], { key: `n${i}`, size: 15 }))
    x += widths[i] + gap + 18
  })
  g.push(txt(x + 20, 56, '…', { key: 'e', size: 18 }))
  g.push(txt(x + 20, 92, '?', { key: 'q', size: 16, fill: ORANGE }))
  return { h: 104, g: <g>{g}</g> }
}

// ══ Year 8 ════════════════════════════════════════════════════════════════════════════════════
// Two rectangles with sides written in x: the drawing carries the algebra, not the numbers.
function algrects(v) {
  const box = (x, w, h, label, sides) => <g>
    <rect x={x} y={34} width={w} height={h} fill={PAPER} stroke={INK} strokeWidth="2.5" />
    {txt(x + w / 2, 34 + h / 2, label, { size: 18, fill: TEAL })}
    {txt(x + w / 2, 20, `${/[+−]/.test(sides.w) ? `(${sides.w})` : sides.w} cm`, { size: 13 })}
    {txt(x - 8, 34 + h / 2, `${sides.h} cm`, { size: 13, anchor: 'end' })}
  </g>
  return { h: 150, g: <g>{box(52, 96, 80, 'A', v.A)}{box(212, 88, 96, 'B', v.B)}</g> }
}

// Two gear wheels, touching, each with its own number of teeth drawn and written.
function gears(v) {
  const gear = (cx, cy, n, name, key) => {
    const R = 22 + n * 1.6, r = R - 9
    const pts = []
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * 2 * Math.PI
      const rr = i % 2 ? r : R
      const a0 = a - Math.PI / (n * 2) * 0.55, a1 = a + Math.PI / (n * 2) * 0.55
      pts.push([cx + rr * Math.cos(a0), cy + rr * Math.sin(a0)], [cx + rr * Math.cos(a1), cy + rr * Math.sin(a1)])
    }
    return <g key={key}>
      <polygon points={pts.map(p => p.join(',')).join(' ')} fill={key === 'a' ? '#d4ecef' : '#fde7cf'} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx={cx} cy={cy} r={6} fill={INK} />
      {txt(cx, cy - 16, name, { size: 16 })}
      {txt(cx, cy + 18, `${n}`, { size: 13, fill: ORANGE })}
    </g>
  }
  const [a, b] = v.teeth
  const Ra = 22 + a * 1.6, Rb = 22 + b * 1.6
  const cy = 12 + Math.max(Ra, Rb)
  const total = Ra + Rb - 7
  // Centred on the outside edges of both wheels, so the bigger one never leaves the box.
  const ax = (W - (Ra + total + Rb)) / 2 + Ra
  return { h: cy + Math.max(Ra, Rb) + 10, g: <g>{gear(ax, cy, a, 'A', 'a')}{gear(ax + total, cy, b, 'B', 'b')}</g> }
}

// A cuboid with its three edges measured. An unknown edge is written "?".
function cuboid(v) {
  const { l, w, h, unit = 'cm' } = v
  const hv = h === '?' ? Math.max(3, Math.min(l, w)) : h
  const s = Math.min(170 / (l + w * 0.5), 120 / (hv + w * 0.35))
  const L = l * s, H = hv * s, dx = w * s * 0.5, dy = w * s * 0.35
  const x = (W - L - dx) / 2, y = 20 + dy
  const A = [x, y + H], B = [x + L, y + H], C = [x + L, y], D = [x, y]
  const F = [B[0] + dx, B[1] - dy], G = [C[0] + dx, C[1] - dy], Hh = [D[0] + dx, D[1] - dy], E = [A[0] + dx, A[1] - dy]
  const Ln = (p, q, hidden, key) => <line key={key} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={INK} strokeWidth={hidden ? 1.4 : 2.2} strokeDasharray={hidden ? '5 4' : undefined} />
  const lab = n => (n === '?' ? '?' : `${label(n)} ${unit}`)
  const g = <g>
    <polygon points={[A, B, C, D].map(p => p.join(',')).join(' ')} fill={PAPER} />
    <polygon points={[D, C, G, Hh].map(p => p.join(',')).join(' ')} fill="#e3f3f5" />
    <polygon points={[B, F, G, C].map(p => p.join(',')).join(' ')} fill="#d4ecef" />
    {Ln(A, B)}{Ln(B, C)}{Ln(C, D)}{Ln(D, A)}{Ln(D, Hh)}{Ln(C, G)}{Ln(B, F)}{Ln(Hh, G)}{Ln(G, F)}
    {Ln(A, E, true)}{Ln(E, F, true)}{Ln(E, Hh, true)}
    {txt((A[0] + B[0]) / 2, A[1] + 16, lab(l), { size: 13 })}
    {txt(x - 8, (A[1] + D[1]) / 2, lab(h), { size: 13, anchor: 'end', fill: h === '?' ? ORANGE : INK })}
    {txt((B[0] + F[0]) / 2 + 12, (B[1] + F[1]) / 2 + 6, lab(w), { size: 13, anchor: 'start' })}
  </g>
  return { h: y + H + 30, g }
}

// A circle with its radius or diameter drawn and measured — or only the circle, when the
// question gives the measurement in words and asks for the radius.
function circle(v) {
  const cx = 160, cy = 96, R = 78
  const g = <g>
    <circle cx={cx} cy={cy} r={R} fill={PAPER} stroke={INK} strokeWidth="2.5" />
    <circle cx={cx} cy={cy} r={3.5} fill={INK} />
    {v.show === 'r' && <><line x1={cx} y1={cy} x2={cx + R} y2={cy} stroke={TEAL} strokeWidth="2.5" />{txt(cx + R / 2, cy - 12, `${v.r} cm`, { size: 14 })}</>}
    {v.show === 'd' && <><line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke={TEAL} strokeWidth="2.5" />{txt(cx, cy - 12, `${v.r * 2} cm`, { size: 14 })}</>}
    {!v.show && <><line x1={cx} y1={cy} x2={cx + R * 0.7} y2={cy - R * 0.7} stroke={ORANGE} strokeWidth="2.5" strokeDasharray="5 4" />{txt(cx + R * 0.42, cy - R * 0.25, 'r = ?', { size: 14, fill: ORANGE })}</>}
  </g>
  return { h: 184, g }
}

// A right-angled triangle, the right angle marked, two sides given and one asked.
function righttri(v) {
  const a = v.a, b = v.b === '?' ? Math.sqrt(v.c * v.c - a * a) : v.b
  const s = Math.min(220 / b, 140 / a)
  const x0 = (W - b * s) / 2 + 10, y0 = 160
  const A = [x0, y0], B = [x0 + b * s, y0], C = [x0, y0 - a * s]
  const show = n => (n === '?' ? '?' : `${n} ${v.unit}`)
  const g = <g>
    <polygon points={[A, B, C].map(p => p.join(',')).join(' ')} fill={PAPER} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
    <path d={`M ${x0 + 14} ${y0} v -14 h -14`} fill="none" stroke={INK} strokeWidth="1.8" />
    {txt(x0 - 10, (A[1] + C[1]) / 2, show(v.a), { size: 14, anchor: 'end' })}
    {txt((A[0] + B[0]) / 2, y0 + 18, show(v.b), { size: 14, fill: v.b === '?' ? ORANGE : INK })}
    {txt((B[0] + C[0]) / 2 + 14, (B[1] + C[1]) / 2 - 8, show(v.c), { size: 14, anchor: 'start', fill: v.c === '?' ? ORANGE : INK })}
  </g>
  return { h: 188, g }
}

// A garden: the outline measured, the paths shaded, the flower beds left plain.
function garden(v) {
  const { W: gw, H: gh, p, n } = v
  const s = Math.min(240 / gw, 130 / gh)
  const ox = (W - gw * s) / 2, oy = 34
  const bw = (gw - (n + 1) * p) / n, bh = gh - 2 * p
  const g = <g>
    <rect x={ox} y={oy} width={gw * s} height={gh * s} fill="#eadbc4" stroke={INK} strokeWidth="2.5" />
    {Array.from({ length: n }, (_, i) => <g key={i}>
      <rect x={ox + (p + i * (bw + p)) * s} y={oy + p * s} width={bw * s} height={bh * s} fill="#bfe3b0" stroke={INK} strokeWidth="1.8" />
    </g>)}
    {dim('t', ox, oy, ox + gw * s, oy, `${gw} m`, -10)}
    {dim('r', ox + gw * s, oy, ox + gw * s, oy + gh * s, `${gh} m`, 10)}
    {txt(ox + (p * s) / 2, oy + gh * s + 16, `${p} m`, { size: 11, fill: '#617383' })}
  </g>
  return { h: oy + gh * s + 26, g }
}

// Dots only: no axis numbers, because the question is about the shape of the cloud.
function scatter(v) {
  const x0 = 50, y0 = 176, w = 230, h = 160
  const g = <g>
    <line x1={x0} y1={y0} x2={x0 + w} y2={y0} stroke={INK} strokeWidth="2" />
    <line x1={x0} y1={y0} x2={x0} y2={y0 - h} stroke={INK} strokeWidth="2" />
    {v.pts.map(([x, y], i) => {
      const cx = x0 + 8 + x * (w - 16), cy = y0 - 8 - y * (h - 16)
      return <g key={i}><line x1={cx - 4} y1={cy - 4} x2={cx + 4} y2={cy + 4} stroke={TEAL} strokeWidth="2" /><line x1={cx - 4} y1={cy + 4} x2={cx + 4} y2={cy - 4} stroke={TEAL} strokeWidth="2" /></g>
    })}
  </g>
  return { h: 186, g }
}

// ── facing and turning ────────────────────────────────────────────────────────
// A compass with the four directions named, the child in the middle facing one of them, and a
// short curved arrow for which way round they turn. The arrow does not go the whole way: how far
// is the question.
function turn(v) {
  const cx = 160, cy = 112, R = 78
  const at = { N: -90, E: 0, S: 90, W: 180 }
  const P2 = (deg, r) => [cx + r * Math.cos(deg * Math.PI / 180), cy + r * Math.sin(deg * Math.PI / 180)]
  const face = at[v.from]
  const [hx, hy] = P2(face, 46)
  const a0 = face + (v.cw ? 18 : -18), a1 = face + (v.cw ? 78 : -78), r = 30
  const [x0, y0] = P2(a0, r), [x1, y1] = P2(a1, r)
  const tip = P2(a1 + (v.cw ? 14 : -14), r)
  const g = <g>
    <circle cx={cx} cy={cy} r={R} fill="none" stroke={GRID} strokeWidth="2" strokeDasharray="4 5" />
    {['N', 'E', 'S', 'W'].map((d, i) => {
      const [x, y] = P2(at[d], R + 16)
      const [tx, ty] = P2(at[d], R)
      return <g key={d}>
        <circle cx={tx} cy={ty} r={4} fill={INK} />
        {txt(x, y, v.names[i], { size: 13, anchor: d === 'E' ? 'start' : d === 'W' ? 'end' : 'middle' })}
      </g>
    })}
    <line x1={cx} y1={cy} x2={hx} y2={hy} stroke={TEAL} strokeWidth="5" strokeLinecap="round" />
    <polygon points={[P2(face, 58), P2(face - 12, 42), P2(face + 12, 42)].map(q => q.join(',')).join(' ')} fill={TEAL} />
    <circle cx={cx} cy={cy} r={11} fill="#fde7cf" stroke={INK} strokeWidth="2" />
    <path d={`M ${x0} ${y0} A ${r} ${r} 0 0 ${v.cw ? 1 : 0} ${x1} ${y1}`} fill="none" stroke={ORANGE} strokeWidth="3" />
    <polygon points={`${tip.join(',')} ${P2(a1, r - 6).join(',')} ${P2(a1, r + 6).join(',')}`} fill={ORANGE} />
  </g>
  return { h: 222, g }
}

