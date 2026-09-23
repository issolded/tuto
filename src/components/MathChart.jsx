import { say } from '../lib/i18n'

// Charts and grids for the three topics that cannot be asked in words alone:
//
//   Year 4 "Area and Perimeter"   — "find the area of rectilinear shapes by counting squares"
//   Year 4 "Data and Time Graphs" — "interpret and present data using bar charts and time graphs"
//   Year 5 "Statistics"           — "using information in a line graph; complete and interpret
//                                    information in a table"
//
// Every one of those lines names the picture. Without one the question becomes "here are some
// numbers, subtract them", which is a different question with the same answer — and the topic
// label would be describing something the child never saw.
//
// Two rules the diagrams keep, both borrowed from MathGeometry:
//
//   * the value the child is asked for is never printed. A bar chart with its numbers written
//     on top is a subtraction question with a picture behind it.
//   * unlike the geometry diagrams, these ARE to scale, and deliberately: reading a bar
//     against its axis is the skill. So no "not to scale" caption here — the gridlines are
//     the instrument and they have to be trustworthy.

const INK = '#24465a'
const TEAL = '#168b91'
const ORANGE = '#b85b10'
const GRID = '#cfe3e8'
const FILL = '#7ecbd0'

const W = 320
const H = 210
const PAD = { l: 34, r: 8, t: 12, b: 30 }

const axisLabel = { font: '600 11px Nunito, sans-serif', fill: '#617383' }

export default function MathChart({ visual: v, language = 'en', description }) {
  if (v?.kind !== 'chart') return null

  // ── a grid of unit squares with a rectilinear shape drawn on it ────────────
  if (v.shape === 'grid') {
    const { cols, rows, cells } = v          // cells: [[x, y], …] filled unit squares
    const size = Math.min(30, Math.floor((W - 20) / cols), Math.floor((H - 34) / rows))
    const ox = (W - cols * size) / 2
    // Centred vertically, caption included. A three-row shape pinned to the top left most of
    // the box empty and the squares small enough to be fiddly to count, which is the one thing
    // this picture exists to make easy.
    const oy = Math.max(6, (H - 20 - rows * size) / 2)
    const filled = new Set(cells.map(c => c.join(',')))
    return (
      <Figure description={description} language={language} scale={false}>
        <g>
          {Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => (
            <rect key={`${x},${y}`} x={ox + x * size} y={oy + y * size} width={size} height={size}
              fill={filled.has(`${x},${y}`) ? FILL : '#f6fbfc'} stroke={GRID} strokeWidth="1" />
          )))}
          {/* The outline is drawn over the squares so the shape reads as one figure rather
              than as a scatter of filled cells. */}
          {cells.map(([x, y]) => (
            <g key={`o${x},${y}`} stroke={INK} strokeWidth="2.5" strokeLinecap="round">
              {!filled.has(`${x},${y - 1}`) && <line x1={ox + x * size} y1={oy + y * size} x2={ox + (x + 1) * size} y2={oy + y * size} />}
              {!filled.has(`${x},${y + 1}`) && <line x1={ox + x * size} y1={oy + (y + 1) * size} x2={ox + (x + 1) * size} y2={oy + (y + 1) * size} />}
              {!filled.has(`${x - 1},${y}`) && <line x1={ox + x * size} y1={oy + y * size} x2={ox + x * size} y2={oy + (y + 1) * size} />}
              {!filled.has(`${x + 1},${y}`) && <line x1={ox + (x + 1) * size} y1={oy + y * size} x2={ox + (x + 1) * size} y2={oy + (y + 1) * size} />}
            </g>
          ))}
          <text x={W / 2} y={oy + rows * size + 16} textAnchor="middle" {...axisLabel}>
            {say(language, 'each square is 1 cm by 1 cm', 'her kare 1 cm × 1 cm', 'cada cuadrado mide 1 cm por 1 cm')}
          </text>
        </g>
      </Figure>
    )
  }

  // ── bar chart and line graph share an axis ─────────────────────────────────
  const { labels, values, step } = v
  const top = Math.ceil(Math.max(...values) / step) * step + step
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b
  const x = i => PAD.l + (plotW / labels.length) * (i + 0.5)
  const y = val => PAD.t + plotH - (val / top) * plotH
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step)

  return (
    <Figure description={description} language={language} scale={false}>
      <g>
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD.l} y1={y(t)} x2={W - PAD.r} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={PAD.l - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" {...axisLabel}>{t}</text>
          </g>
        ))}
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + plotH} stroke={INK} strokeWidth="2" />
        <line x1={PAD.l} y1={PAD.t + plotH} x2={W - PAD.r} y2={PAD.t + plotH} stroke={INK} strokeWidth="2" />

        {v.shape === 'bar' && values.map((val, i) => {
          const bw = (plotW / labels.length) * 0.56
          return <rect key={i} x={x(i) - bw / 2} y={y(val)} width={bw} height={PAD.t + plotH - y(val)}
            fill={v.highlight?.includes(labels[i]) ? ORANGE : FILL} stroke={INK} strokeWidth="1.5" />
        })}

        {v.shape === 'line' && <>
          <polyline points={values.map((val, i) => `${x(i)},${y(val)}`).join(' ')}
            fill="none" stroke={TEAL} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {values.map((val, i) => <circle key={i} cx={x(i)} cy={y(val)} r="4"
            fill={v.highlight?.includes(labels[i]) ? ORANGE : TEAL} stroke="white" strokeWidth="1.5" />)}
        </>}

        {labels.map((l, i) => (
          <text key={l} x={x(i)} y={PAD.t + plotH + 14} textAnchor="middle" {...axisLabel}>{l}</text>
        ))}
        {/* No unit caption on the axis. It sat on top of the highest tick label, and the
            question already says what the numbers are — "how many people on Tue". */}
      </g>
    </Figure>
  )
}

function Figure({ children, description, language, scale }) {
  return (
    <figure style={{ margin: 0, width: '100%', maxWidth: 340 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={description || say(language, 'Chart', 'Grafik', 'Gráfico')}
        style={{ display: 'block', width: '100%', maxHeight: 200, overflow: 'visible' }}>
        {children}
      </svg>
      {scale && (
        <figcaption style={{ font: '12px Nunito, sans-serif', textAlign: 'center', color: '#617383' }}>
          {say(language, 'Not to scale', 'Ölçekli değildir', 'No está a escala')}
        </figcaption>
      )}
    </figure>
  )
}
