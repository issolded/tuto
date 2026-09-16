// The figure as it lands on the screen, for checks that must not share the engine's assumptions.
//
// The mirror and symmetry checks used to re-derive the answer the way the generator derived it:
// toggle `flip` and compare keys. That is the generator's model of a mirror, so a check built
// on it agrees with the generator by construction — and the model was wrong. The renderer flips
// a figure about its OWN axis and then turns it, so toggling `flip` on a turned figure is a
// mirror about a tilted line, not about the dashed vertical one drawn between prompt and blank.
// Three in four 10-11 mirror questions marked the wrong answer, and the audit passed them all.
//
// So everything here works on points in screen space and never reads `flip` or `rotation`. A
// mirror is x → 100 − x. A line of symmetry is any line whose reflection maps the drawing onto
// itself, found from the drawing rather than from a list of axes the shapes are known to have.
//
// What it does trust is geometryKey's transformed points: that they sit where the SVG draws
// them. That is the pixel check's job (scripts/puzzle-pixels.mjs), and it is one assumption
// about the renderer instead of one about what a mirror is.

import { geometryKey } from '../../src/lib/puzzleFigures.js'

// Coordinates in the key are rounded to a tenth, so two drawings of the same picture reached by
// different routes can disagree in the last digit. A real difference is never this small: the
// nearest distinct features in the vocabulary are several units apart.
const TOL = 0.35

const mod = (v, m) => ((v % m) + m) % m

export function drawn(spec) {
  const [fillPart, radius, pointPart] = geometryKey(spec).split('|')
  const fills = fillPart.split('/').map(f => {
    const [depth, body] = f.split(':')
    const m = body.match(/^([hx])(-?\d+(?:\.\d+)?)(@.*)?$/)
    return m
      ? { depth, kind: m[1], angle: Number(m[2]), scale: m[3] ?? '' }
      : { depth, kind: body, angle: null, scale: '' }
  })
  const points = []
  const marks = []
  for (const part of pointPart ? pointPart.split(' ') : []) {
    const m = part.match(/^(s\d|half|d|c|P|p)(-?\d+\.\d),(-?\d+\.\d)$/)
    if (m) points.push({ tag: m[1], x: Number(m[2]), y: Number(m[3]) })
    else marks.push(part)   // a true circle: a size with no position and no orientation
  }
  // The key leaves a circle's position out because it never moves: the renderer draws every one
  // at the centre of the box. A reflection can still move that centre, so it goes in as a point.
  if (marks.length) points.push({ tag: 'o', x: 50, y: 50 })
  return { fills, radius, points, marks }
}

// Reflection in the line through `c` at angle `alpha` (degrees, in the key's own x/y frame).
// A hatch direction is a line, so it reflects as 2α − a; a cross is two lines a quarter-turn
// apart, so it is read modulo 90.
export function reflect(d, alpha, c = [50, 50]) {
  const t = (2 * alpha * Math.PI) / 180
  const cos = Math.cos(t)
  const sin = Math.sin(t)
  return {
    ...d,
    fills: d.fills.map(f => (f.angle === null ? f
      : { ...f, angle: mod(2 * alpha - f.angle, f.kind === 'x' ? 90 : 180) })),
    points: d.points.map(p => {
      const vx = p.x - c[0]
      const vy = p.y - c[1]
      return { tag: p.tag, x: c[0] + vx * cos + vy * sin, y: c[1] + vx * sin - vy * cos }
    }),
  }
}

// The dashed line in the lab's mirror layout is vertical and runs through the middle of the box.
export const mirrorImage = (d) => reflect(d, 90)

const angleClose = (a, b, m) => Math.min(mod(a - b, m), mod(b - a, m)) < 0.5

export function sameDrawing(p, q) {
  if (p.radius !== q.radius) return false
  if (p.marks.slice().sort().join() !== q.marks.slice().sort().join()) return false
  if (p.fills.length !== q.fills.length) return false
  for (let i = 0; i < p.fills.length; i++) {
    const a = p.fills[i]
    const b = q.fills[i]
    if (a.depth !== b.depth || a.kind !== b.kind || a.scale !== b.scale) return false
    if (a.angle !== null && !angleClose(a.angle, b.angle, a.kind === 'x' ? 90 : 180)) return false
  }
  if (p.points.length !== q.points.length) return false
  // Every point matched to a distinct point with the same tag. Greedy is enough: no two points
  // with one tag sit within tolerance of each other in any figure the vocabulary can draw.
  const left = q.points.slice()
  for (const a of p.points) {
    const k = left.findIndex(b => b.tag === a.tag && Math.hypot(a.x - b.x, a.y - b.y) < TOL)
    if (k < 0) return false
    left.splice(k, 1)
  }
  return true
}

// Whether ANY line reflects the drawing onto itself.
//
// A reflection that maps the drawing onto itself maps the outline onto itself, so the line
// passes through the centroid of the outline's vertices. Then the candidates are finite: the
// first outline vertex goes either to itself (the line runs through it) or to another vertex
// (the line is the perpendicular bisector of the two). Each candidate is tested whole. Nothing
// here knows which axes a hexagon has.
export function hasLineOfSymmetry(spec) {
  const d = drawn(spec)
  const outline = d.points.filter(p => p.tag === 's0')
  const anchor = outline.length ? outline : d.points
  const hatchAngles = d.fills.filter(f => f.angle !== null).map(f => f.angle)

  const c = [
    anchor.reduce((s, p) => s + p.x, 0) / anchor.length,
    anchor.reduce((s, p) => s + p.y, 0) / anchor.length,
  ]
  const p0 = anchor[0]
  if (anchor.every(p => Math.hypot(p.x - c[0], p.y - c[1]) < TOL)) {
    // Nothing off-centre to take a direction from — concentric circles and a plain or solid
    // fill. Every line through the middle works, unless a hatch picks out the directions it
    // allows, which are its own and its normal.
    return hatchAngles.length === 0 || sameDrawing(d, reflect(d, hatchAngles[0], c))
  }
  const candidates = new Set()
  for (const q of anchor) {
    const same = Math.hypot(q.x - p0.x, q.y - p0.y) < TOL
    const [dx, dy] = same ? [p0.x - c[0], p0.y - c[1]] : [-(q.y - p0.y), q.x - p0.x]
    if (Math.hypot(dx, dy) < TOL) continue
    candidates.add(mod(Math.round((Math.atan2(dy, dx) * 180) / Math.PI * 1000) / 1000, 180))
  }
  for (const alpha of candidates) {
    if (sameDrawing(d, reflect(d, alpha, c))) return true
  }
  return false
}
