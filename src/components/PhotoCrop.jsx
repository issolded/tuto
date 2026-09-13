import { useEffect, useMemo, useRef, useState } from 'react'
import { cropToBlob } from '../lib/image'

// The step between taking a photo and sending it: drag the corners in until the frame holds
// the drawing, or the page, and nothing else.
//
// Why it exists in more than one place: three of the photos this app takes are read by a
// model, not just stored. Gemini tiles an image down to 768px internally, so every pixel spent
// on the desk, a sleeve, or the opposite page is a pixel taken away from the handwriting it is
// supposed to transcribe. Cropping is the cheapest accuracy there is. For the photos that are
// only shown — a drawing, a story cover, a child's avatar — the frame was being chosen by CSS
// (`object-fit: cover` centre-crops whatever it is given), which means it was being chosen by
// nobody.
//
// The crop starts as the WHOLE photo. A default that trims the edges would quietly cut the
// bottom line off a page a child framed tightly, and the child would never know why the model
// misread it. Confirming without touching anything sends exactly what the camera saw.
//
// Labels come in through `translate` rather than an import, because this is used on child
// screens (t(key, lang)) and on parent screens (s(key)) and those are two separate
// dictionaries — see CLAUDE.md. Both carry the crop_* keys.

const FULL = { x: 0, y: 0, x2: 1, y2: 1 }
const MIN = 0.12          // a crop can never be smaller than this fraction of the photo
const HANDLE = 30         // touch target, px
const CORNERS = [['x', 'y'], ['x2', 'y'], ['x', 'y2'], ['x2', 'y2']]

export default function PhotoCrop({ file, translate: label, onDone, onRetake, onCancel, accent = '#7c5cd6', ratio = null }) {
  const [rect, setRect] = useState(FULL)
  const [busy, setBusy] = useState(false)
  const [area, setArea] = useState(null)     // the space the photo may use, in px
  const [nat, setNat] = useState(null)       // the photo's own size
  const boxRef = useRef(null)
  const areaRef = useRef(null)
  const drag = useRef(null)

  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  // The picture's box is measured, not left to CSS. `max-height: 100%` on the <img> resolves
  // against a wrapper whose own height is auto, which means it resolves to nothing: sideways
  // on an iPad a 3024×4032 photo rendered 1170×1560 inside a 568px-tall box, so the frame sat
  // over a fraction of a picture that ran off the screen, and every corner the child dragged
  // cut somewhere other than where they dragged it. Fitting it here makes the box exactly the
  // picture, which is what the crop fractions are measured against.
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const read = () => setArea({ w: el.clientWidth, h: el.clientHeight })
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // HANDLE of slack, half a handle on each side: the corner grips straddle the edge of the
  // photo, and a photo fitted to the very edge of the screen puts half of each of them past
  // it — on a phone the two right-hand grips were cut off by the viewport.
  // A frame locked to a shape is measured in the photo's pixels, not in fractions: the
  // fractions are of a 3024×4032 photo, so a square frame is 1 : 1 in pixels and 4 : 3 in
  // fractions. `fr` is that shape expressed the way rect is stored.
  const fr = ratio && nat ? ratio * (nat.h / nat.w) : null

  const fit = area && nat
    ? (() => {
        const k = Math.min(
          Math.max(1, area.w - HANDLE) / nat.w,
          Math.max(1, area.h - HANDLE) / nat.h,
        )
        return { w: Math.round(nat.w * k), h: Math.round(nat.h * k) }
      })()
    : null

  // A different photo means a fresh frame. Adjusting during render rather than in an effect:
  // an effect would paint one frame with the previous photo's crop over the new picture.
  const [shown, setShown] = useState(file)
  if (file !== shown) { setShown(file); setRect(FULL) }

  // Pointer position as a fraction of the displayed photo, clamped to it — a finger that
  // slides off the picture should pin the corner to the edge, not lose the drag.
  function at(e) {
    const b = boxRef.current?.getBoundingClientRect()
    if (!b || !b.width || !b.height) return null
    return {
      fx: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)),
      fy: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)),
    }
  }

  function down(e, corner) {
    const p = at(e)
    if (!p) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = corner
      ? { kind: 'corner', corner }
      : { kind: 'move', fx: p.fx, fy: p.fy, start: rect }
  }

  function move(e) {
    const d = drag.current
    if (!d) return
    const p = at(e)
    if (!p) return
    if (d.kind === 'corner') {
      const [hx, hy] = d.corner
      setRect(r => {
        if (!fr) {
          const next = { ...r }
          if (hx === 'x') next.x = Math.min(p.fx, r.x2 - MIN)
          else next.x2 = Math.max(p.fx, r.x + MIN)
          if (hy === 'y') next.y = Math.min(p.fy, r.y2 - MIN)
          else next.y2 = Math.max(p.fy, r.y + MIN)
          return next
        }
        // Locked shape: the opposite corner stays put and the dragged one is pulled back to
        // whichever of the two directions allows the shape, so the frame never leaves the photo.
        const ax = hx === 'x' ? r.x2 : r.x
        const ay = hy === 'y' ? r.y2 : r.y
        let w = Math.abs(p.fx - ax)
        let h = Math.abs(p.fy - ay)
        w = Math.min(w, h * fr)
        w = Math.min(w, hx === 'x' ? ax : 1 - ax)
        h = Math.min(w / fr, hy === 'y' ? ay : 1 - ay)
        w = h * fr
        if (w < MIN * fr || h < MIN) { h = MIN; w = MIN * fr }
        const x = hx === 'x' ? ax - w : ax
        const y = hy === 'y' ? ay - h : ay
        return { x, y, x2: x + w, y2: y + h }
      })
    } else {
      // Moving the whole frame stops at the edges of the photo instead of shrinking against
      // them, so the frame the child sized stays the size they made it.
      const w = d.start.x2 - d.start.x
      const h = d.start.y2 - d.start.y
      const nx = Math.min(1 - w, Math.max(0, d.start.x + (p.fx - d.fx)))
      const ny = Math.min(1 - h, Math.max(0, d.start.y + (p.fy - d.fy)))
      setRect({ x: nx, y: ny, x2: nx + w, y2: ny + h })
    }
  }

  const up = () => { drag.current = null }

  async function confirm() {
    if (busy) return
    setBusy(true)
    try {
      const blob = await cropToBlob(file, { x: rect.x, y: rect.y, w: rect.x2 - rect.x, h: rect.y2 - rect.y })
      onDone(blob)
    } catch {
      onDone(file)   // canvas unavailable — the uncropped photo is still a usable photo
    }
  }

  const pct = v => `${v * 100}%`
  const untouched = !fr && rect.x === 0 && rect.y === 0 && rect.x2 === 1 && rect.y2 === 1

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 120, background: '#1b1726',
      display: 'flex', flexDirection: 'column',
      padding: 'calc(10px + env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom))',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, flexShrink: 0 }}>
        {onCancel && (
          <button onClick={onCancel} aria-label={label('crop_cancel')} style={{
            width: 38, height: 38, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: 17, cursor: 'pointer',
          }}>✕</button>
        )}
        <div style={{
          flex: 1, textAlign: 'center', color: '#fff', fontSize: 15.5,
          fontFamily: "'TrRound', 'Baloo 2', cursive", fontWeight: 600,
        }}>{label('crop_title')}</div>
        <div style={{ width: 38, flexShrink: 0 }} />
      </div>

      {/* The photo takes whatever height is left, and the frame sits exactly on top of it —
          the overlay is a child of the picture's own box, so a fraction here is the same
          fraction of the pixels that get cut. */}
      <div ref={areaRef} style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div ref={boxRef} style={{
          position: 'relative', touchAction: 'none',
          width: fit ? fit.w : 0, height: fit ? fit.h : 0,
        }}>
          <img
            src={url} alt=""
            onLoad={e => {
              const w = e.currentTarget.naturalWidth
              const h = e.currentTarget.naturalHeight
              setNat({ w, h })
              // A locked frame needs the photo's own proportions to know its shape, and those
              // only exist once it has loaded — so it opens here rather than from an effect.
              if (ratio) {
                const f = ratio * (h / w)
                const fw = f >= 1 ? 1 : f
                const fh = f >= 1 ? 1 / f : 1
                setRect({ x: (1 - fw) / 2, y: (1 - fh) / 2, x2: (1 + fw) / 2, y2: (1 + fh) / 2 })
              }
            }}
            style={{ display: 'block', width: '100%', height: '100%' }}
          />

          {/* What is being cut away. Four bands rather than one ring of box-shadow: the ring
              needs the box to clip it, and a box that clips cannot also show a handle sitting
              on the very corner of the photo — which is exactly where a finger goes. */}
          {[
            { left: 0, top: 0, width: pct(1), height: pct(rect.y) },
            { left: 0, top: pct(rect.y2), width: pct(1), height: pct(1 - rect.y2) },
            { left: 0, top: pct(rect.y), width: pct(rect.x), height: pct(rect.y2 - rect.y) },
            { left: pct(rect.x2), top: pct(rect.y), width: pct(1 - rect.x2), height: pct(rect.y2 - rect.y) },
          ].map((box, i) => (
            <div key={i} style={{ position: 'absolute', ...box, background: 'rgba(20,16,30,.62)', pointerEvents: 'none' }} />
          ))}

          <div
            onPointerDown={e => down(e, null)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            style={{
              position: 'absolute',
              left: pct(rect.x), top: pct(rect.y),
              width: pct(rect.x2 - rect.x), height: pct(rect.y2 - rect.y),
              border: '2px solid #fff',
              cursor: 'move', touchAction: 'none',
            }}
          >
            {/* Thirds, so a child has something to line the paper up against. */}
            {[1, 2].map(i => (
              <div key={`v${i}`} style={{ position: 'absolute', left: `${i * 33.333}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,.28)' }} />
            ))}
            {[1, 2].map(i => (
              <div key={`h${i}`} style={{ position: 'absolute', top: `${i * 33.333}%`, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,.28)' }} />
            ))}

            {CORNERS.map(([hx, hy]) => (
              <div
                key={`${hx}${hy}`}
                onPointerDown={e => { e.stopPropagation(); down(e, [hx, hy]) }}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
                style={{
                  position: 'absolute',
                  // Centred on the corner, so a finger aimed at the corner of the frame grabs
                  // the corner. Inset instead, pressing the corner reads as "move the frame",
                  // and at the frame's opening size — the whole photo — moving it does nothing
                  // at all: the child drags and the app appears not to respond.
                  [hx === 'x' ? 'left' : 'right']: -HANDLE / 2,
                  [hy === 'y' ? 'top' : 'bottom']: -HANDLE / 2,
                  width: HANDLE, height: HANDLE, borderRadius: '50%',
                  background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.4)',
                  touchAction: 'none', cursor: 'grab',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 12, flexShrink: 0 }}>
        {onRetake && (
          <button onClick={onRetake} disabled={busy} style={{
            flex: 1, padding: '14px 10px', borderRadius: 16, border: '1.5px solid rgba(255,255,255,.28)',
            background: 'transparent', color: '#fff', cursor: busy ? 'default' : 'pointer',
            fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 14.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}>📷 {label('crop_retake')}</button>
        )}
        <button onClick={confirm} disabled={busy} style={{
          flex: 1.4, padding: '15px 10px', borderRadius: 16, border: 'none',
          background: accent, color: '#fff', cursor: busy ? 'default' : 'pointer',
          fontFamily: "'TrRound', 'Baloo 2', cursive", fontWeight: 600, fontSize: 17,
          opacity: busy ? .7 : 1,
        }}>
          {busy ? label('crop_working') : untouched ? label('crop_use_all') : label('crop_use')}
        </button>
      </div>
    </div>
  )
}
