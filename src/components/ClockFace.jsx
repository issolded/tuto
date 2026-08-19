import { useRef, useState } from 'react'
import { timeWords, digital } from '../lib/timeWords'

// An analogue clock, drawn once and used twice: still on the question card, and geared and
// draggable inside the help panel.
//
// The help version is the reason this exists. Telling the time is the one topic where reading
// about the method is useless — a child learns it by turning the hands and watching what the
// other one does. So both hands are views of a SINGLE state (minutes since 12), which is what
// makes the gearing honest: drag the long hand once round and the short hand really has moved
// one hour, because there is no second number that could disagree with it.

const MATH      = '#5aa9e6'
const MATH_DEEP = '#3d8fcf'
const INK       = '#241f3a'
const INK_SOFT  = '#8d83ad'
const GREEN     = '#4cb685'
const ORANGE    = '#f79433'
const FRED      = "'TrRound', 'Fredoka', 'Baloo 2', sans-serif"

// Everything is drawn in a 220×220 box and scaled by the `size` prop, so one set of numbers
// describes the clock at every size it is used at. The face is only 92 across because the
// minute counts ride OUTSIDE it — put on the rim they landed on the border stroke and read as
// orange smudges.
const BOX = 220
const C = BOX / 2
const R_FACE   = 92
const R_HOUR   = 46
const R_MINUTE = 72

const wrap720 = (v) => ((v % 720) + 720) % 720

const tip = (deg, len) => {
  const a = (deg * Math.PI) / 180
  return [C + len * Math.sin(a), C - len * Math.cos(a)]
}

function Face({ minuteNumbers }) {
  return (
    <>
      <circle cx={C} cy={C} r={R_FACE} fill="#fffdf7" stroke={MATH} strokeWidth={7} />
      {Array.from({ length: 60 }).map((_, i) => {
        const five = i % 5 === 0
        const [x1, y1] = tip(i * 6, 84)
        const [x2, y2] = tip(i * 6, five ? 75 : 80)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={five ? MATH_DEEP : '#cfe3f5'} strokeWidth={five ? 3 : 1.5} strokeLinecap="round" />
      })}
      {Array.from({ length: 12 }).map((_, i) => {
        const [x, y] = tip((i + 1) * 30, 61)
        return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="central"
          fill={INK} fontFamily={FRED} fontWeight="700" fontSize="19">{i + 1}</text>
      })}
      {/* The minute count outside each hour number — "the 3 also means 15" is the single thing
          that makes an analogue clock readable, and it is nowhere on a real one. */}
      {minuteNumbers && Array.from({ length: 12 }).map((_, i) => {
        const [x, y] = tip((i + 1) * 30, 103)
        return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="central"
          fill={ORANGE} fontFamily={FRED} fontWeight="700" fontSize="12">
          {((i + 1) * 5) % 60}
        </text>
      })}
    </>
  )
}

function Hands({ mins, knobs, held }) {
  const [hx, hy] = tip(mins * 0.5, R_HOUR)      // 720 minutes = one full turn
  const [mx, my] = tip((mins % 60) * 6, R_MINUTE)
  return (
    <>
      <line x1={C} y1={C} x2={mx} y2={my} stroke={ORANGE} strokeWidth={8} strokeLinecap="round" />
      <line x1={C} y1={C} x2={hx} y2={hy} stroke={MATH_DEEP} strokeWidth={12} strokeLinecap="round" />
      {knobs && (
        <>
          <circle cx={mx} cy={my} r={held === 'minute' ? 19 : 16} fill={ORANGE} fillOpacity={held === 'minute' ? 0.35 : 0.18}
            stroke={ORANGE} strokeWidth={3} />
          <circle cx={hx} cy={hy} r={held === 'hour' ? 19 : 16} fill={MATH_DEEP} fillOpacity={held === 'hour' ? 0.35 : 0.18}
            stroke={MATH_DEEP} strokeWidth={3} />
        </>
      )}
      <circle cx={C} cy={C} r={7} fill={INK} />
    </>
  )
}

export default function ClockFace({ hour, minute, size = 150, minuteNumbers = false }) {
  const mins = wrap720((hour % 12) * 60 + minute)
  return (
    <svg width={size} height={size} viewBox="0 0 220 220" style={{ display: 'block' }}>
      <Face minuteNumbers={minuteNumbers} />
      <Hands mins={mins} />
    </svg>
  )
}

export function DraggableClock({ hour, minute, size = 250, language = 'en', onSpin }) {
  const start = wrap720((hour % 12) * 60 + minute)
  const [mins, setMins] = useState(start)
  const [held, setHeld] = useState(null)
  const svgRef = useRef(null)
  // The angle a drag is measured from, and an unrounded running total. Rounding the total
  // every frame instead would lose a fraction of a minute per move, so a slow drag right
  // round the face would come back short.
  const drag = useRef({ hand: null, lastDeg: 0, exact: start })
  const tr = language === 'tr'

  const at = (e) => {
    const r = svgRef.current.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * BOX - C
    const y = ((e.clientY - r.top) / r.height) * BOX - C
    return { deg: (Math.atan2(x, -y) * 180) / Math.PI, x, y }
  }

  const down = (e) => {
    const { deg, x, y } = at(e)
    // Whichever knob the finger landed nearest to. Comparing angles instead would make the
    // hands fight for the same touch whenever they overlap, which is most of the hour.
    const [hx, hy] = tip(mins * 0.5, R_HOUR)
    const [mx, my] = tip((mins % 60) * 6, R_MINUTE)
    const hand = Math.hypot(x + C - hx, y + C - hy) <= Math.hypot(x + C - mx, y + C - my) ? 'hour' : 'minute'
    drag.current = { hand, lastDeg: deg, exact: mins }
    setHeld(hand)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const move = (e) => {
    if (!drag.current.hand) return
    const { deg } = at(e)
    // Shortest way round, so crossing 12 carries into the next hour instead of unwinding
    // eleven of them.
    let d = deg - drag.current.lastDeg
    if (d > 180) d -= 360
    if (d < -180) d += 360
    drag.current.lastDeg = deg
    // One turn of the long hand is an hour; one turn of the short hand is twelve.
    drag.current.exact += drag.current.hand === 'minute' ? d / 6 : d * 2
    const next = wrap720(Math.round(drag.current.exact))
    setMins(prev => {
      if (prev !== next) onSpin?.()
      return next
    })
  }

  const up = () => { drag.current.hand = null; setHeld(null) }

  const h = Math.floor(mins / 60) || 12
  const m = mins % 60
  const moved = mins !== start

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg
        ref={svgRef}
        width={size} height={size} viewBox="0 0 220 220"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ display: 'block', touchAction: 'none', userSelect: 'none', cursor: held ? 'grabbing' : 'grab' }}
      >
        <Face minuteNumbers />
        <Hands mins={mins} knobs held={held} />
      </svg>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: FRED, fontWeight: 700, fontSize: 30, color: MATH_DEEP, letterSpacing: 0.5 }}>
          {digital(h, m)}
        </span>
        <span style={{ fontFamily: FRED, fontWeight: 600, fontSize: 15, color: INK_SOFT }}>
          {timeWords(h, m, language)}
        </span>
      </div>

      <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 13, color: held ? GREEN : INK_SOFT, textAlign: 'center' }}>
        {held === 'hour'   ? (tr ? 'Kısa kol — saati gösterir' : 'Short hand — it shows the hour')
        : held === 'minute' ? (tr ? 'Uzun kol — dakikaları gösterir' : 'Long hand — it shows the minutes')
        : (tr ? 'Kollardan tut ve çevir 👆' : 'Grab a hand and turn it 👆')}
      </div>

      {moved && (
        <button
          className="math-press"
          onClick={() => { drag.current.exact = start; setMins(start) }}
          style={{
            border: 'none', background: 'rgba(90,169,230,.14)', color: MATH_DEEP,
            borderRadius: 999, padding: '6px 16px', cursor: 'pointer',
            fontFamily: FRED, fontWeight: 600, fontSize: 13,
          }}
        >↺ {tr ? 'Sorudaki saate dön' : 'Back to the question'}</button>
      )}
    </div>
  )
}
