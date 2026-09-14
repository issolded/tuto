// The drawing vocabulary for the puzzle (non-verbal reasoning) module — and deliberately the
// ONLY thing that can appear on a child's screen in it.
//
// Every figure a child sees is produced by renderFigure() from a spec whose every field is
// drawn from one of the fixed lists below. There is no path from a model, a prompt or a URL
// into this renderer: it draws regular polygons, fills them from five patterns, and rotates
// them. The safety argument for the whole module rests here, and it is structural rather than
// procedural — the question is not "did we review the output" but "is there any code that
// could draw something else", and there isn't. That is why this module renders figures
// instead of generating images.
//
// A spec:
//   { shape, fill, rotation, size, dots, corner, flip }
//
// geometryKey() is the other half of the contract, and the reason it exists is not obvious.
// Two specs can differ field by field and still be the SAME PICTURE: a circle rotated 90°, a
// hexagon rotated 60°, a hatch-45 fill rotated 180°. A question whose four options are not
// four visibly different pictures is broken — either two answers are equally right, or the
// child is asked to spot a difference that isn't on the screen — and comparing specs cannot
// see it. So the key is computed from the transformed geometry itself: the points after flip
// and rotation, rounded and sorted, plus the fill's effective angle. Every generated question
// is checked against it before a child can see it (see validateQuestion in puzzleTemplates).
//
// `flip` is supported by the renderer and the key, but is not in ATTRIBUTES: mirror-image
// questions are a real NVR category and belong here eventually, but a flip interacts with
// rotation in ways that need their own pass (a right-arrow flipped IS the same picture as one
// rotated 180°). For now only the analogy transform uses it, where the pairing makes the
// intent explicit.

export const SHAPES = ['circle', 'triangle', 'square', 'pentagon', 'hexagon', 'arrow']
export const FILLS = ['none', 'solid', 'hatch-45', 'hatch-90', 'cross']
export const ROTATIONS = [0, 45, 90, 135, 180, 225, 270, 315]
export const CORNERS = [null, 'tl', 'tr', 'bl', 'br']
export const SIZES = [0.65, 0.82, 1]

// The attributes a question rule may be built on. Order matters only for stable output.
export const ATTRIBUTES = ['shape', 'fill', 'rotation', 'size', 'dots', 'corner']

// Regular polygons, as [sides, starting angle]. The starting angle is what makes a shape sit
// the way a child expects it at rotation 0 — a triangle point-up, a square axis-aligned
// rather than balanced on a corner.
const POLY = {
  triangle: [3, -90],
  square: [4, -45],
  pentagon: [5, -90],
  hexagon: [6, -90],
}

// Drawn at the same nominal radius as the polygons so an arrow does not read as a different
// size class when it sits next to one.
const ARROW = [[12, 42], [58, 42], [58, 24], [88, 50], [58, 76], [58, 58], [12, 58]]

// Where the inner marks go, for 1 to 5 of them, in the 100-unit box.
const DOT_LAYOUT = {
  1: [[50, 50]],
  2: [[36, 50], [64, 50]],
  3: [[50, 34], [36, 62], [64, 62]],
  4: [[36, 36], [64, 36], [36, 64], [64, 64]],
  5: [[36, 36], [64, 36], [50, 50], [36, 64], [64, 64]],
}

// A triangle has almost no room at the top, so the dot cluster is pulled down to where the
// shape actually has area and shrunk to match. Without this, dots on a triangle sit on and
// over the edges — the single most common way a generated figure looks wrong, and the first
// thing the lab showed.
//
// An arrow gets none: its interior is a shaft a few units tall, and every placement tried
// either crossed the outline or crowded the tip. A shape that cannot carry a mark simply does
// not carry one — see the note on dotPoints for why that is safe rather than a silent gap.
const DOT_AREA = {
  circle: [50, 50, 1],
  square: [50, 50, 1],
  hexagon: [50, 50, 0.95],
  pentagon: [50, 54, 0.8],
  triangle: [50, 54, 0.45],
}

// A corner mark reads as "in the corner" only where the shape has a corner there to be in. On
// a triangle the top-left position is outside the outline entirely, and on a pentagon it sits
// on the edge; both looked like a printing error rather than a puzzle.
const CORNER_SHAPES = new Set(['circle', 'square', 'hexagon'])
const CORNER_POS = { tl: [30, 30], tr: [70, 30], bl: [30, 70], br: [70, 70] }

export function makeSpec(over = {}) {
  return {
    shape: 'square', fill: 'none', rotation: 0, size: 1,
    dots: 0, corner: null, flip: false,
    ...over,
  }
}

export function shapePoints(shape, r) {
  // A circle has no corners to compare and no orientation to lose, which is exactly what the
  // key needs to know about it.
  if (shape === 'circle') return null
  const k = r / 38
  if (shape === 'arrow') return ARROW.map(([x, y]) => [50 + (x - 50) * k, 50 + (y - 50) * k])
  const [n, start] = POLY[shape]
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = ((start + (i * 360) / n) * Math.PI) / 180
    pts.push([50 + r * Math.cos(a), 50 + r * Math.sin(a)])
  }
  return pts
}

// A shape with no room for marks returns none, and that is deliberately the ONLY place the
// rule lives. geometryKey is built from these same functions, so an arrow with three dots and
// an arrow with none produce the same key — which means attrVisible reports `dots` as
// invisible on an arrow, and a generator asking for a rule it could not have drawn is turned
// away before it builds the question rather than after a child has seen it.
export function dotPoints(spec) {
  const area = DOT_AREA[spec.shape]
  if (!spec.dots || !area) return []
  const [cx, cy, s] = area
  return (DOT_LAYOUT[spec.dots] || []).map(([x, y]) => [
    cx + (x - 50) * s * spec.size,
    cy + (y - 50) * s * spec.size,
  ])
}

export function cornerPoint(spec) {
  if (!spec.corner || !CORNER_SHAPES.has(spec.shape)) return null
  const [x, y] = CORNER_POS[spec.corner]
  return [50 + (x - 50) * spec.size, 50 + (y - 50) * spec.size]
}

// Marks shrink with the room they have: full size in a circle or square, two thirds of it in
// a triangle. Four or five of them crowd each other before they crowd the outline, so they
// come down again on top of that.
export function dotRadius(spec) {
  const s = DOT_AREA[spec.shape]?.[2] ?? 1
  return 6.5 * spec.size * (0.55 + 0.45 * s) * (spec.dots >= 4 ? 0.82 : 1)
}

// Marks on a patterned field cannot be counted — a child asked how many dots are in a
// cross-hatched square is being asked to do something the picture does not let them do, and
// the lab's first 7-8 sheet was full of exactly that. A figure carrying marks is therefore
// drawn plain, which is also what the papers do. Solid survives because marks are punched out
// of it and stay perfectly legible.
//
// It lives here, in the one function both the renderer and the key call, so it is a fact
// about the picture rather than a rule a generator has to remember: attrVisible then reports
// `fill` as invisible on a dotted figure, and no generator ever builds a rule on it.
function effectiveFill(spec) {
  const marked = spec.dots > 0 || (spec.corner && CORNER_SHAPES.has(spec.shape))
  if (marked && spec.fill !== 'solid' && spec.fill !== 'none') return 'none'
  return spec.fill
}

// flip first, then rotate — the same order the SVG transform below applies them in.
function transform([x, y], spec) {
  const px = spec.flip ? 100 - x : x
  const a = (spec.rotation * Math.PI) / 180
  const dx = px - 50
  const dy = y - 50
  return [50 + dx * Math.cos(a) - dy * Math.sin(a), 50 + dx * Math.sin(a) + dy * Math.cos(a)]
}

// `+ 0` turns -0 into 0; without it two identical pictures can produce different keys.
const fmt = ([x, y]) => `${(Math.round(x * 10) / 10 + 0).toFixed(1)},${(Math.round(y * 10) / 10 + 0).toFixed(1)}`

// A pattern fill rotates with the element it fills, so the same `hatch-45` reads as a
// different picture at rotation 90 and as the same one at rotation 180. That is a visible
// difference the child can use, so it has to be in the key.
function fillKey(spec) {
  const mod = (v, m) => ((v % m) + m) % m
  const fill = effectiveFill(spec)
  // The pattern scales with the figure, so a small one is not a solid blob — which means two
  // figures differing only in size differ in their fill geometry too, and the key has to say
  // so or it would call them the same picture.
  const scale = fill === 'none' || fill === 'solid' ? '' : `@${spec.size}`
  if (fill === 'hatch-45') return `h${mod((spec.flip ? -45 : 45) + spec.rotation, 180)}${scale}`
  if (fill === 'hatch-90') return `h${mod(90 + spec.rotation, 180)}${scale}`
  if (fill === 'cross') return `x${mod(spec.rotation, 90)}${scale}`
  return fill
}

// The visual fingerprint. Two specs with the same key draw the same picture, whatever their
// fields say.
export function geometryKey(spec) {
  const r = 38 * spec.size
  const parts = []
  const pts = shapePoints(spec.shape, r)
  if (pts) for (const p of pts) parts.push('s' + fmt(transform(p, spec)))
  else parts.push(`o${r.toFixed(1)}`)
  for (const p of dotPoints(spec)) parts.push('d' + fmt(transform(p, spec)))
  const c = cornerPoint(spec)
  if (c) parts.push('c' + fmt(transform(c, spec)))
  parts.sort()
  return `${fillKey(spec)}|${dotRadius(spec).toFixed(1)}|${parts.join(' ')}`
}

// Whether changing one attribute to `value` would actually change the picture. A rule built on
// an invisible difference ("this one is rotated 90°" — on a circle) is the failure mode this
// guards, and generators call it before committing to a rule.
export function attrVisible(spec, attr, value) {
  return geometryKey(spec) !== geometryKey({ ...spec, [attr]: value })
}

let uid = 0

// Returns an SVG string rather than React elements so the same module drives the lab, the
// child screen and the standalone preview page without a React dependency.
export function renderFigure(spec, opts = {}) {
  const px = opts.px || 84
  const bg = opts.bg || '#FFFFFF'
  const id = `pz${++uid}`
  const stroke = 2.6
  const r = 38 * spec.size

  const spacing = (8 * spec.size).toFixed(2)
  const efill = effectiveFill(spec)
  let defs = ''
  let fill = 'none'
  if (efill === 'solid') {
    fill = 'currentColor'
  } else if (efill !== 'none') {
    const w = 1.4 * spec.size
    const lines = efill === 'hatch-45'
      ? `<path d="M-2,6 l8,-8 M0,8 l8,-8 M6,10 l4,-4" stroke="currentColor" stroke-width="${(w / spec.size).toFixed(2)}" fill="none"/>`
      : efill === 'hatch-90'
        ? `<path d="M4,0 v8" stroke="currentColor" stroke-width="${(w / spec.size).toFixed(2)}" fill="none"/>`
        : `<path d="M4,0 v8 M0,4 h8" stroke="currentColor" stroke-width="${(1.2).toFixed(2)}" fill="none"/>`
    // viewBox lets the 8×8 artwork above stay as written while the tile itself shrinks with
    // the figure, so a 0.65-size shape gets proportionally finer hatching instead of three
    // fat lines.
    defs = `<defs><pattern id="${id}" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse" viewBox="0 0 8 8">${lines}</pattern></defs>`
    fill = `url(#${id})`
  }

  const pts = shapePoints(spec.shape, r)
  const body = pts
    ? `<polygon points="${pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}" fill="${fill}" stroke="currentColor" stroke-width="${stroke}" stroke-linejoin="round"/>`
    : `<circle cx="50" cy="50" r="${r.toFixed(1)}" fill="${fill}" stroke="currentColor" stroke-width="${stroke}"/>`

  // On a solid shape the marks have to be punched out of it, or they simply are not there.
  const markFill = spec.fill === 'solid' ? bg : 'currentColor'
  const dots = dotPoints(spec)
    .map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${dotRadius(spec).toFixed(1)}" fill="${markFill}"/>`)
    .join('')
  const c = cornerPoint(spec)
  const corner = c
    ? `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(5.5 * spec.size).toFixed(1)}" fill="${markFill}"/>`
    : ''

  const tf = `rotate(${spec.rotation} 50 50)${spec.flip ? ' translate(100 0) scale(-1 1)' : ''}`
  return `<svg viewBox="0 0 100 100" width="${px}" height="${px}" aria-hidden="true" focusable="false">`
    + `${defs}<g transform="${tf}">${body}${dots}${corner}</g></svg>`
}
