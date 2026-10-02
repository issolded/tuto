import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { say } from '../lib/i18n'

// A scratchpad over a question: a pencil button, and with it on, whatever the child draws with a finger,
// a pencil or a mouse stays on the page, over the question and its answers. Nothing is sent or saved — it is
// paper, and a new question is a clean sheet.
//
// The canvas lives INSIDE the screen's own scrolling column (found by `selector`) and is as tall as its
// content, so a note written next to an answer scrolls with the answer. With the pencil off the canvas lets
// every touch through and the screen is exactly what it was; with it on, the page does not scroll under the
// finger (that is the whole trade, and why the button says clearly which state it is in).

const INKS = ['#241f3a', '#d9567a', '#3d8fcf']

export default function Scratchpad({ selector, resetKey, language = 'en', accent = '#5aa9e6' }) {
  const [host, setHost] = useState(null)
  const [on, setOn] = useState(false)
  const [ink, setInk] = useState(INKS[0])
  const [erase, setErase] = useState(false)
  const canvasRef = useRef(null)
  const stroke = useRef(null)

  // The column is found after the screen has drawn it, and made a positioning context for the canvas.
  useEffect(() => {
    const el = document.querySelector(selector)
    if (!el) return
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
    setHost(el)
  }, [selector])

  // A new question is a clean sheet, with the pencil put down so the answers can be tapped.
  useEffect(() => {
    const c = canvasRef.current
    if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height)
    setOn(false)
    setErase(false)
  }, [resetKey])

  // Same size as the column's content. A hint or help panel opening makes the content taller; the notes
  // already written are kept when the canvas is resized.
  const fit = () => {
    const c = canvasRef.current
    if (!c || !host) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(host.clientWidth * dpr), h = Math.round(host.scrollHeight * dpr)
    c.style.height = `${host.scrollHeight}px`
    if (c.width === w && c.height === h) return
    const keep = document.createElement('canvas')
    keep.width = c.width; keep.height = c.height
    keep.getContext('2d').drawImage(c, 0, 0)
    c.width = w; c.height = h
    const ctx = c.getContext('2d')
    ctx.drawImage(keep, 0, 0)
  }
  useEffect(() => {
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }) // eslint-disable-line react-hooks/exhaustive-deps

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
      {host && createPortal(
        <canvas
          ref={canvasRef}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          style={{
            position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', zIndex: 5,
            pointerEvents: on ? 'auto' : 'none', touchAction: on ? 'none' : 'auto', cursor: on ? 'crosshair' : 'default',
          }}
        />, host)}

      {/* Bottom right: the question is at the top and the answers and keypad in the middle, so the corner is the one
          place the pencil never sits on the words. The tools open upwards from it. */}
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
