import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { say } from '../lib/i18n'

// A scratchpad over a question: a pencil button, and with it on a sheet of tracing paper slides over the
// whole working area — see-through, so the question and its answers show underneath — and whatever the
// child draws with a finger, a pencil or a mouse stays on it. Putting the pencil down lifts the paper and
// leaves the ink on the screen for as long as the question lasts, so the notes can be read while answering.
// Nothing is sent or saved; a new question is a clean sheet.
//
// The sheet is the size of the screen's whole scrolling column (found by `selector`), not of the little
// room beside the answers: on a phone there is almost none of that. With the pencil down every touch goes
// through to the screen exactly as before; with it up, the page does not scroll under the finger (that is
// the whole trade, and why the button says clearly which state it is in).

const INKS = ['#241f3a', '#d9567a', '#3d8fcf']

export default function Scratchpad({ selector, language = 'en', accent = '#5aa9e6' }) {
  const [on, setOn] = useState(false)
  const [ink, setInk] = useState(INKS[0])
  const [erase, setErase] = useState(false)
  const [rect, setRect] = useState(null)   // where the column is on screen; the sheet is exactly that
  const canvasRef = useRef(null)
  const stroke = useRef(null)

  // The column is found after the screen has drawn it, and followed when it moves or changes size. (The
  // observer reports once as soon as it starts watching, which is the first measurement.) A new question
  // is a clean sheet because the screen gives this component a new `key` for each one.
  useEffect(() => {
    const el = document.querySelector(selector)
    if (!el) return undefined
    const measure = () => {
      const r = el.getBoundingClientRect()
      setRect(prev => (prev && prev.left === r.left && prev.top === r.top && prev.width === r.width && prev.height === r.height
        ? prev : { left: r.left, top: r.top, width: r.width, height: r.height }))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [selector])

  // The bitmap follows the sheet's size; notes already written are kept when it is resized.
  const fit = () => {
    const c = canvasRef.current
    if (!c || !rect) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr))
    if (c.width === w && c.height === h) return
    const keep = document.createElement('canvas')
    keep.width = c.width; keep.height = c.height
    keep.getContext('2d').drawImage(c, 0, 0)
    c.width = w; c.height = h
    c.getContext('2d').drawImage(keep, 0, 0)
  }
  useEffect(() => { fit() })

  const at = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    const k = canvasRef.current.width / r.width
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, k }
  }
  const down = (e) => {
    if (!on) return
    fit()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    stroke.current = at(e)
    e.preventDefault()
  }
  const move = (e) => {
    if (!stroke.current) return
    const p = at(e)
    const ctx = canvasRef.current.getContext('2d')
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over'
    ctx.strokeStyle = ink
    ctx.lineWidth = (erase ? 26 : 3.5) * p.k
    ctx.beginPath(); ctx.moveTo(stroke.current.x, stroke.current.y); ctx.lineTo(p.x, p.y); ctx.stroke()
    stroke.current = p
    e.preventDefault()
  }
  const up = () => { stroke.current = null }

  const clear = () => {
    const c = canvasRef.current
    if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height)
  }

  const label = (en, tr, es) => say(language, en, tr, es)
  const round = { border: 'none', borderRadius: '50%', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }

  return (
    <>
      {rect && createPortal(
        <canvas
          ref={canvasRef}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          style={{
            position: 'fixed', left: rect.left, top: rect.top, width: rect.width, height: rect.height, zIndex: 35,
            pointerEvents: on ? 'auto' : 'none', touchAction: on ? 'none' : 'auto', cursor: on ? 'crosshair' : 'default',
            // Tracing paper: warm, see-through, faintly ruled. Gone when the pencil is down; the ink stays.
            background: on
              ? 'repeating-linear-gradient(to bottom, rgba(255,251,238,.5) 0, rgba(255,251,238,.5) 31px, rgba(90,169,230,.28) 31px, rgba(90,169,230,.28) 32px)'
              : 'transparent',
            boxShadow: on ? `inset 0 0 0 3px ${accent}55` : 'none',
            transition: 'background .18s ease',
          }}
        />, document.body)}

      <div style={{ position: 'fixed', right: 12, bottom: 22, zIndex: 40, display: 'flex', flexDirection: 'column-reverse', alignItems: 'flex-end', gap: 8 }}>
        <button
          onClick={() => setOn(v => !v)}
          aria-pressed={on}
          aria-label={on ? label('Put the pencil down', 'Kalemi bırak', 'Dejar el lápiz') : label('Take notes', 'Not al', 'Tomar notas')}
          style={{
            ...round, width: 46, height: 46, fontSize: 21,
            background: on ? accent : '#fff', border: `2.5px solid ${accent}`,
            boxShadow: '0 4px 12px rgba(40,30,70,.16)',
          }}
        >✏️</button>
        {on && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, background: '#fff', borderRadius: 24,
            padding: '10px 8px', boxShadow: '0 6px 18px rgba(40,30,70,.16)',
          }}>
            {INKS.map(c => (
              <button key={c} onClick={() => { setInk(c); setErase(false) }}
                aria-label={label('Ink colour', 'Mürekkep rengi', 'Color de tinta')}
                style={{ ...round, width: 28, height: 28, background: c, border: '2px solid #fff', boxShadow: !erase && ink === c ? `0 0 0 2.5px ${c}` : 'none' }} />
            ))}
            <button onClick={() => setErase(v => !v)} aria-pressed={erase} aria-label={label('Eraser', 'Silgi', 'Goma')}
              style={{ ...round, width: 32, height: 32, fontSize: 16, background: erase ? '#ffe0a8' : '#f3efe6' }}>🧽</button>
            <button onClick={clear} aria-label={label('Clear the notes', 'Notları sil', 'Borrar las notas')}
              style={{ ...round, width: 32, height: 32, fontSize: 15, background: '#f3efe6' }}>🗑️</button>
          </div>
        )}
      </div>
    </>
  )
}
