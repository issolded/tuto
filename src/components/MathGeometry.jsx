import { say } from '../lib/i18n'

const INK = '#24465a'
const TEAL = '#168b91'
const ORANGE = '#b85b10'
const polar = (cx, cy, r, a) => [cx + r * Math.cos(a), cy - r * Math.sin(a)]
const rad = d => d * Math.PI / 180

// Only givens belong in this data. Unknown lengths/angles are always labelled '?'.
// Schematic diagrams deliberately do not invite measuring a screen to get the answer.
export default function MathGeometry({ visual: v, language = 'en', hint = false, description }) {
  if (v?.kind !== 'geometry') return null
  const label = (x, y, value, key, color = INK) => <text style={{ stroke: 'none', font: '600 16px Nunito, sans-serif' }} key={key} x={x} y={y} fill={color} textAnchor="middle" dominantBaseline="middle">{value}</text>
  const line = (a, b, key, extra = {}) => <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} {...extra} />
  const polygon = points => <polygon points={points.map(p => p.join(',')).join(' ')} fill={hint && v.ask === 'area' ? '#c9efec' : '#f1f9fb'} />
  let drawing
  if (['line', 'point', 'opposite'].includes(v.shape)) {
    const cx = 160, cy = v.shape === 'line' ? 150 : 105
    // Fixed schematic sectors leave room for all labels, including very small givens.
    const sectors = v.shape === 'line' ? [75, 105] : v.shape === 'opposite' ? [65, 115, 65, 115] : Array(v.angles.length + 1).fill(360 / (v.angles.length + 1))
    let cursor = 0
    drawing = sectors.map((span, i) => {
      const start = rad(cursor), end = rad(cursor + span)
      cursor += span
      const a = polar(cx, cy, 30, start), b = polar(cx, cy, 30, end)
      const pos = polar(cx, cy, 62, (start + end) / 2)
      const val = v.shape === 'opposite' ? (i === 0 ? `${v.angles[0]}°` : i === 2 ? '?' : '') : i < v.angles.length ? `${v.angles[i]}°` : '?'
      return <g key={i}>
        {line([cx, cy], polar(cx, cy, 90, start), 'ray')}
        <path d={`M ${a} A 30 30 0 ${span > 180 ? 1 : 0} 0 ${b}`} fill="none" stroke={val === '?' ? ORANGE : TEAL} strokeWidth="2" />
        {label(...pos, val, 'label', val === '?' ? ORANGE : INK)}
      </g>
    })
    if (v.shape === 'line') drawing.push(line([70, cy], [250, cy], 'baseline'))
  } else if (v.angles || v.shape === 'regular') {
    const points = v.shape === 'triangle' ? [[55, 170], [265, 170], [160, 30]]
      : v.shape === 'quad' ? (v.angles.reduce((a, b) => a + b, 0) < 180 ? [[55, 165], [265, 165], [235, 40], [170, 130]] : [[55, 165], [265, 165], [235, 40], [95, 40]])
      : Array.from({ length: v.sides }, (_, i) => polar(160, 105, 85, Math.PI / 2 + i * 2 * Math.PI / v.sides))
    const center = [160, 110]
    drawing = <>{polygon(points)}{points.map((p, i) => {
      const pos = p.map((n, j) => n * 0.68 + center[j] * 0.32)
      const val = v.shape === 'regular' ? (i === 0 ? '?' : '') : i < v.angles.length ? `${v.angles[i]}°` : '?'
      return label(...pos, val, i, val === '?' ? ORANGE : INK)
    })}</>
  } else {
    const triangle = v.shape === 'triangle', para = v.shape === 'para'
    const points = triangle ? [[65, 165], [245, 165], [150, 45]] : para ? [[55, 165], [225, 165], [265, 45], [95, 45]] : [[65, 165], [245, 165], [245, 45], [65, 45]]
    drawing = <>
      {polygon(points)}
      {label(155, 190, `${v.base} cm`, 'base')}
      {triangle || para ? <>
        {line([150, 45], [150, 165], 'height', { strokeDasharray: '5 4', stroke: TEAL })}
        <path d="M150 153 h12 v12" fill="none" stroke={TEAL} strokeWidth="2" />
        {label(120, 125, `${v.height} cm`, 'height-label')}
      </> : <>
        {label(282, 108, v.ask === 'side' ? '? cm' : `${v.height} cm`, 'side', v.ask === 'side' ? ORANGE : INK)}
        {hint && v.ask === 'perimeter' && <>{label(155, 25, `${v.base} cm`, 'top')}{label(30, 108, `${v.height} cm`, 'left')}</>}
        {v.area != null && label(155, 105, `${v.area} cm²`, 'area')}
      </>}
    </>
  }
  return <figure style={{ margin: 0, width: '100%', maxWidth: 320 }}>
    <svg viewBox="0 0 320 210" role="img" aria-label={description || say(language, 'Geometry diagram', 'Geometri çizimi', 'Diagrama geométrico')} style={{ display: 'block', width: '100%', maxHeight: 190, overflow: 'visible' }}>
      <g stroke={hint && v.ask === 'perimeter' ? ORANGE : INK} strokeWidth={hint && v.ask === 'perimeter' ? 4 : 3} strokeLinejoin="round" strokeLinecap="round">{drawing}</g>
    </svg>
    <figcaption style={{ font: '12px Nunito, sans-serif', textAlign: 'center', color: '#617383' }}>{say(language, 'Not to scale', 'Ölçekli değildir', 'No está a escala')}</figcaption>
  </figure>
}
