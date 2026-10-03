import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { timeWords, digital } from '../lib/timeWords'
import { say } from '../lib/i18n'

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
const wrap1440 = (v) => ((v % 1440) + 1440) % 1440

// Which part of the day an hour (0-23) belongs to, with the picture that goes with it. The 12-hour
// face cannot say whether it is morning or evening, which is the whole difficulty of the 24-hour
// clock, so the help lets the child watch the day turn as they turn the hands.
export function dayPart(hour24) {
  const h = ((hour24 % 24) + 24) % 24
  if (h < 6)  return 'night'
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  if (h < 21) return 'evening'
  return 'night'
}
const PART_ICON = { night: '🌙', morning: '🌅', afternoon: '☀️', evening: '🌆' }
function partWord(part, language) {
  if (part === 'night')     return say(language, 'night', 'gece', 'noche')
  if (part === 'morning')   return say(language, 'morning', 'sabah', 'mañana')
  if (part === 'afternoon') return say(language, 'afternoon', 'öğleden sonra', 'tarde')
  return say(language, 'evening', 'akşam', 'tarde')
}

// The picture and word for a part of the day, for under a face that has no AM/PM of its own.
export function DayPartChip({ part, language = 'en' }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(247,148,51,.13)',
      borderRadius: 999, padding: '4px 12px', fontFamily: FRED, fontWeight: 600, fontSize: 13, color: INK,
    }}>
      <span style={{ fontSize: 17 }}>{PART_ICON[part]}</span>{partWord(part, language)}
    </div>
  )
}

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

export default function ClockFace({ hour, minute, size = 150, minuteNumbers = false, zoomable = false, language = 'en' }) {
  const mins = wrap720((hour % 12) * 60 + minute)
  const [zoom, setZoom] = useState(false)
  const face = (
    <svg width={size} height={size} viewBox="0 0 220 220" style={{ display: 'block', flexShrink: 0 }}>
      <Face minuteNumbers={minuteNumbers} />
      <Hands mins={mins} />
    </svg>
  )
  if (!zoomable) return face

  return (
    <>
      <button
        onClick={() => setZoom(true)}
        aria-label={say(language, 'Enlarge the clock', 'Saati büyüt', 'Ampliar el reloj')}
        style={{ border: 'none', background: 'none', padding: 0, cursor: 'zoom-in', lineHeight: 0 }}
      >{face}</button>
      {zoom && createPortal(
        // Through a portal because the question card animates with `both` fill, which leaves a
        // transform on it — and a transformed ancestor makes `position: fixed` fix to the CARD.
        // Rendered in place, the enlarged clock came out trapped inside the card it came from.
        <div
          onClick={() => setZoom(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(36,31,58,.72)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 18, cursor: 'zoom-out',
          }}
        >
          <svg viewBox="0 0 220 220" style={{
            display: 'block', flexShrink: 0,
            width: 'min(86vw, 62vh, 380px)', height: 'min(86vw, 62vh, 380px)',
          }}>
            <Face minuteNumbers />
            <Hands mins={mins} />
          </svg>
          <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 15, color: '#fffdf7' }}>
            {say(language, 'Tap to close', 'Kapatmak için dokun', 'Toca para cerrar')}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

// hour/minute is where the hands START, not the answer. For most shapes the caller hands over
// 12:00 and the child turns the hands to the question's time themselves — seeding it with the
// question's time printed the answer under the face.
//
// `readout` is off for any shape whose answer is the time itself, because the help tells the
// child to turn the hands until they match the question — and the moment they do, a readout
// saying "twenty-five past eleven" has answered "how many minutes past eleven?" for them.
export function DraggableClock({ hour, minute, size = 250, language = 'en', onSpin, readout = true, h24 = false, turnCounter = false }) {
  // With `h24` the single state runs over a whole day (1440 minutes) instead of twelve hours: the
  // hands still show it on a 12-hour face, but crossing 12 carries on into the afternoon, and the
  // readout can say 18:10 and which part of the day that is.
  const wrap = h24 ? wrap1440 : wrap720
  // It starts at midday, not midnight: the questions ask about the hours after it, so the first
  // thing the child turns towards is the afternoon, and turning back is what shows the morning.
  const start = wrap((hour % 12) * 60 + minute + (h24 ? 720 : 0))
  const [total, setTotal] = useState(start)
  const mins = total % 720
  const setMins = setTotal
  const [held, setHeld] = useState(null)
  const svgRef = useRef(null)
  // The angle a drag is measured from, and an unrounded running total. Rounding the total
  // every frame instead would lose a fraction of a minute per move, so a slow drag right
  // round the face would come back short.
  const drag = useRef({ hand: null, lastDeg: 0, exact: start })
  // Minutes turned forward since the hands were last at their start, unwrapped: the face forgets how many times round it
  // has been, and a child asked "how many minutes in 3 hours?" has to hold 60, 120, 180 in their head. Counted aloud by
  // the page when `turnCounter` is set.
  const [turned, setTurned] = useState(0)

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
    drag.current = { hand, lastDeg: deg, exact: total }
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
    const delta = drag.current.hand === 'minute' ? d / 6 : d * 2
    drag.current.exact += delta
    if (turnCounter) setTurned(prev => Math.max(0, prev + delta))
    const next = wrap(Math.round(drag.current.exact))
    setMins(prev => {
      if (prev !== next) onSpin?.()
      return next
    })
  }

  const up = () => { drag.current.hand = null; setHeld(null) }

  const h = Math.floor(mins / 60) || 12
  const m = mins % 60
  const moved = total !== start
  const h24Now = Math.floor(total / 60)
  const pad2 = (n) => String(n).padStart(2, '0')

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

      {h24 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FRED, fontWeight: 700, fontSize: 30, color: MATH_DEEP, letterSpacing: 0.5 }}>
              {pad2(h24Now)}:{pad2(m)}
            </span>
            <span style={{ fontFamily: FRED, fontWeight: 600, fontSize: 14, color: INK_SOFT }}>
              {say(language, '24-hour clock', '24 saatlik gösterim', 'reloj de 24 horas')}
            </span>
          </div>
          <DayPartChip part={dayPart(h24Now)} language={language} />
        </div>
      )}
      {turnCounter && (() => {
        const n = Math.floor(turned / 60), rest = Math.round(turned - n * 60)
        const partial = rest > 0 && n > 0
        return (
          <div style={{
            fontFamily: FRED, fontWeight: 700, fontSize: 17, color: MATH_DEEP, textAlign: 'center',
            background: 'rgba(90,169,230,.12)', borderRadius: 14, padding: '7px 14px', minHeight: 24,
          }}>
            {n === 0
              ? say(language, 'One full turn = 60 minutes', 'Bir tam tur = 60 dakika', 'Una vuelta entera = 60 minutos')
              : say(language,
                `🔄 ${n} full turn${n === 1 ? '' : 's'} = ${n * 60} minutes${partial ? ` (+${rest})` : ''}`,
                `🔄 ${n} tam tur = ${n * 60} dakika${partial ? ` (+${rest})` : ''}`,
                `🔄 ${n} vuelta${n === 1 ? '' : 's'} entera${n === 1 ? '' : 's'} = ${n * 60} minutos${partial ? ` (+${rest})` : ''}`)}
          </div>
        )
      })()}
      {readout && !h24 && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FRED, fontWeight: 700, fontSize: 30, color: MATH_DEEP, letterSpacing: 0.5 }}>
            {digital(h, m)}
          </span>
          <span style={{ fontFamily: FRED, fontWeight: 600, fontSize: 15, color: INK_SOFT }}>
            {timeWords(h, m, language)}
          </span>
        </div>
      )}

      <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 13, color: held ? GREEN : INK_SOFT, textAlign: 'center' }}>
        {held === 'hour'   ? say(language, 'Short hand — it shows the hour', 'Kısa kol — saati gösterir', 'Aguja corta: marca la hora')
        : held === 'minute' ? say(language, 'Long hand — it shows the minutes', 'Uzun kol — dakikaları gösterir', 'Aguja larga: marca los minutos')
        : say(language, 'Grab a hand and turn it 👆', 'Kollardan tut ve çevir 👆', 'Agarra una aguja y gírala 👆')}
      </div>

      {moved && (
        <button
          className="math-press"
          onClick={() => { drag.current.exact = start; setTotal(start); setTurned(0) }}
          style={{
            border: 'none', background: 'rgba(90,169,230,.14)', color: MATH_DEEP,
            borderRadius: 999, padding: '6px 16px', cursor: 'pointer',
            fontFamily: FRED, fontWeight: 600, fontSize: 13,
          }}
        >↺ {say(language, 'Start over', 'Başa dön', 'Empezar de nuevo')}</button>
      )}
    </div>
  )
}
