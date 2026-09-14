// The drawing vocabulary for the puzzle (non-verbal reasoning) module — and deliberately the
// ONLY thing that can appear on a child's screen in it.
//
// Every figure a child sees is produced by renderFigure() from a spec whose every field is
// drawn from one of the fixed lists below. There is no path from a model, a prompt or a URL
// into this renderer: it draws polygons, fills them from a fixed set, nests them and rotates
// them. The safety argument for the whole module rests here, and it is structural rather than
// procedural — the question is not "did we review the output" but "is there any code that
// could draw something else", and there isn't. That is why this module renders figures
// instead of generating images.
//
// A spec:
//   { shape, fill, rotation, size, stretch, half, dots, corner, inner, flip }
//
// `inner` is the one field that is not a scalar: it holds another node — { shape, fill, size }
// — drawn concentrically inside, and that node may hold one of its own. Nesting is how the
// papers build a very large share of their figures (a circle inside a circle inside a dot, a
// black triangle in a circle, a square in a square), and a flat record cannot express any of
// it. Inner nodes carry no rotation of their own: they inherit the parent's, which is what
// makes "the whole figure turned 90°" mean what a child expects.
//
// `half` fills one diagonal half of the shape. It is the single most recognizable device in
// the book — the worked example of the pattern papers is four squares split corner to corner
// — and it is a fill mode rather than a shape, so it composes with everything.
//
// `stretch` scales the outline horizontally before rotation, which turns a regular polygon
// into an irregular one. Whole questions in the papers turn on "same number of sides,
// different proportions", and with regular polygons only, that rule cannot be posed at all.
//
// normalizeSpec() resolves the combinations that would produce an unreadable picture — marks
// on a hatched field cannot be counted, a nested figure inside a solid one cannot be seen.
// Both the renderer and the key call it, so those are facts about the picture rather than
// rules a generator has to remember: attrVisible then reports the suppressed attribute as
// invisible, and no generator ever builds a rule on it.
//
// geometryKey() is the other half of the contract, and the reason it exists is not obvious.
// Two specs can differ field by field and still be the SAME PICTURE: a circle rotated 90°, a
// hexagon rotated 60°, a hatch-45 fill rotated 180°. A question whose four options are not
// four visibly different pictures is broken — either two answers are equally right, or the
// child is asked to spot a difference that isn't on the screen — and comparing specs cannot
// see it. So the key is computed from the transformed geometry of the whole tree: points
// after stretch, flip and rotation, rounded and sorted, plus each fill's effective angle.
// Every generated question is checked against it before a child can see it.
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
export const HALVES = [null, 'tl', 'tr', 'bl', 'br']
export const SIZES = [0.65, 0.82, 1]
export const STRETCHES = [1, 0.62, 1.45]

// The inner nodes, chosen to match what the papers actually nest: a pip, a ring, a filled
// core, a nested square, a black triangle in a circle. Frozen and shared so a generator can
// compare them by identity the way it compares any other attribute value.
export const INNER_NODES = [
  null,
  Object.freeze({ shape: 'circle', fill: 'solid', size: 0.2, inner: null }),
  Object.freeze({ shape: 'circle', fill: 'none', size: 0.58, inner: null }),
  Object.freeze({ shape: 'circle', fill: 'solid', size: 0.5, inner: null }),
  Object.freeze({ shape: 'square', fill: 'none', size: 0.52, inner: null }),
  Object.freeze({ shape: 'triangle', fill: 'solid', size: 0.55, inner: null }),
  Object.freeze({ shape: 'triangle', fill: 'none', size: 0.62, inner: null }),
  // Two levels deep: the concentric run the sequence papers build their growth questions on.
  Object.freeze({
    shape: 'circle', fill: 'none', size: 0.66,
    inner: Object.freeze({ shape: 'circle', fill: 'solid', size: 0.42, inner: null }),
  }),
]

// The attributes a question rule may be built on. Order matters only for stable output.
export const ATTRIBUTES = ['shape', 'fill', 'rotation', 'size', 'stretch', 'half', 'dots', 'corner', 'inner']

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
// not carry one — normalizeSpec turns the request into no marks, and the key agrees.
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

// Which half a diagonal split fills, as the triangle that gets the ink and the direction it
// points. The direction is what goes in the key: it is a vector, so the parent's rotation and
// flip move it exactly as they move the rest of the figure.
// A diagonal split reads as a split only across a compact outline. On an arrow the cut lands
// across the head and the shaft at once and the result looks like a misprint rather than a
// half-filled shape.
const HALF_SHAPES = new Set(['circle', 'triangle', 'square', 'pentagon', 'hexagon'])
const HALF_TRI = {
  tl: [[0, 0], [100, 0], [0, 100]],
  tr: [[0, 0], [100, 0], [100, 100]],
  br: [[100, 0], [100, 100], [0, 100]],
  bl: [[0, 0], [0, 100], [100, 100]],
}
const HALF_DIR = { tl: [-1, -1], tr: [1, -1], br: [1, 1], bl: [-1, 1] }

export function makeSpec(over = {}) {
  return {
    shape: 'square', fill: 'none', rotation: 0, size: 1, stretch: 1,
    half: null, dots: 0, corner: null, inner: null, flip: false,
    ...over,
  }
}

// Resolves the combinations that would draw an unreadable figure, in one place that both the
// renderer and the key go through. Precedence runs from the most structural device to the
// least: a half-split owns the whole interior, a nested node needs an empty one to sit in,
// and marks need a plain ground to be counted against.
export function normalizeSpec(spec) {
  const s = { ...spec }
  const canCorner = s.corner && CORNER_SHAPES.has(s.shape)
  if (!canCorner) s.corner = null
  if (!DOT_AREA[s.shape]) s.dots = 0
  if (!HALF_SHAPES.has(s.shape)) s.half = null

  if (s.half) {
    s.fill = 'none'; s.inner = null; s.dots = 0; s.corner = null
  } else if (s.inner) {
    s.fill = 'none'; s.dots = 0; s.corner = null
  } else if (s.dots > 0 || s.corner) {
    // A corner mark and a dot cluster are the same ink. Together they read as one crowd: the
    // lab turned up a five-dot circle carrying a sixth dot in the corner, posed as "which
    // corner is it in", and nothing on the card said which of the six was the one being asked
    // about. Dots win, because they are the countable rule and the corner is the positional
    // one — a figure can carry either, never both.
    if (s.dots > 0) s.corner = null
    if (s.fill !== 'solid') s.fill = 'none'
  }
  return s
}

function stretchX([x, y], k) {
  return [50 + (x - 50) * k, y]
}

export function shapePoints(shape, r, stretch = 1) {
  // A circle has no corners to compare and no orientation to lose, which is exactly what the
  // key needs to know about it — unless it has been stretched into an ellipse, which does.
  if (shape === 'circle' && stretch === 1) return null
  if (shape === 'circle') {
    // An ellipse is sampled rather than special-cased, so one code path compares every outline.
    return Array.from({ length: 12 }, (_, i) => {
      const a = (i * 30 * Math.PI) / 180
      return stretchX([50 + r * Math.cos(a), 50 + r * Math.sin(a)], stretch)
    })
  }
  const k = r / 38
  if (shape === 'arrow') {
    return ARROW.map(([x, y]) => stretchX([50 + (x - 50) * k, 50 + (y - 50) * k], stretch))
  }
  const [n, start] = POLY[shape]
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = ((start + (i * 360) / n) * Math.PI) / 180
    pts.push(stretchX([50 + r * Math.cos(a), 50 + r * Math.sin(a)], stretch))
  }
  return pts
}

export function dotPoints(spec) {
  const area = DOT_AREA[spec.shape]
  if (!spec.dots || !area) return []
  const [cx, cy, s] = area
  return (DOT_LAYOUT[spec.dots] || []).map(([x, y]) => stretchX([
    cx + (x - 50) * s * spec.size,
    cy + (y - 50) * s * spec.size,
  ], spec.stretch))
}

export function cornerPoint(spec) {
  if (!spec.corner || !CORNER_SHAPES.has(spec.shape)) return null
  const [x, y] = CORNER_POS[spec.corner]
  return stretchX([50 + (x - 50) * spec.size, 50 + (y - 50) * spec.size], spec.stretch)
}

// Marks shrink with the room they have: full size in a circle or square, two thirds of it in
// a triangle. Four or five of them crowd each other before they crowd the outline, so they
// come down again on top of that.
export function dotRadius(spec) {
  const s = DOT_AREA[spec.shape]?.[2] ?? 1
  return 6.5 * spec.size * (0.55 + 0.45 * s) * (spec.dots >= 4 ? 0.82 : 1)
}

// stretch is already baked into the points; flip first, then rotate — the same order the SVG
// transform below applies them in.
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
function fillKey(fill, size, root) {
  const mod = (v, m) => ((v % m) + m) % m
  // The pattern scales with the figure, so a small one is not a solid blob — which means two
  // figures differing only in size differ in their fill geometry too, and the key has to say
  // so or it would call them the same picture.
  const scale = fill === 'none' || fill === 'solid' ? '' : `@${size}`
  if (fill === 'hatch-45') return `h${mod((root.flip ? -45 : 45) + root.rotation, 180)}${scale}`
  if (fill === 'hatch-90') return `h${mod(90 + root.rotation, 180)}${scale}`
  if (fill === 'cross') return `x${mod(root.rotation, 90)}${scale}`
  return fill
}

// Walks the nesting tree once, in untransformed space, so the key and the renderer agree by
// construction rather than by two implementations happening to match.
function collect(spec, radius, depth, out) {
  const pts = shapePoints(spec.shape, radius, spec.stretch)
  if (pts) for (const p of pts) out.points.push([`s${depth}`, p])
  else out.points.push([`o${depth}`, [radius, 0]])
  out.fills.push(`${depth}:${fillKey(spec.fill, spec.size, out.root)}`)

  if (spec.half) {
    const [dx, dy] = HALF_DIR[spec.half]
    out.points.push(['half', [50 + dx * 20, 50 + dy * 20]])
  }
  for (const p of dotPoints(spec)) out.points.push(['d', p])
  const c = cornerPoint(spec)
  if (c) out.points.push(['c', c])

  if (spec.inner) {
    // The inner node inherits the parent's orientation and proportions; only its own shape,
    // fill and relative size are its own.
    collect(
      { ...makeSpec(spec.inner), stretch: spec.stretch, size: spec.size * spec.inner.size },
      radius * spec.inner.size,
      depth + 1,
      out,
    )
  }
}

// The visual fingerprint. Two specs with the same key draw the same picture, whatever their
// fields say.
export function geometryKey(rawSpec) {
  const spec = normalizeSpec(rawSpec)
  const out = { points: [], fills: [], root: spec }
  collect(spec, 38 * spec.size, 0, out)
  const parts = out.points.map(([tag, p]) => tag + fmt(transform(p, spec)))
  parts.sort()
  return `${out.fills.join('/')}|${dotRadius(spec).toFixed(1)}|${parts.join(' ')}`
}

// Whether changing one attribute to `value` would actually change the picture. A rule built on
// an invisible difference ("this one is rotated 90°" — on a circle) is the failure mode this
// guards, and generators call it before committing to a rule.
export function attrVisible(spec, attr, value) {
  return geometryKey(spec) !== geometryKey({ ...spec, [attr]: value })
}

let uid = 0

function pathOf(pts) {
  return pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
}

// Draws one node of the tree in untransformed space. The caller applies flip and rotation once
// to the whole group, which is how an inner node inherits its parent's orientation.
function nodeMarkup(spec, radius, ctx) {
  const id = `pz${++uid}`
  const pts = shapePoints(spec.shape, radius, spec.stretch)
  const outline = pts
    ? `<polygon points="${pathOf(pts)}"`
    : `<circle cx="50" cy="50" r="${radius.toFixed(1)}"`

  let defs = ''
  let fill = 'none'
  if (spec.fill === 'solid') {
    fill = 'currentColor'
  } else if (spec.fill !== 'none') {
    const lines = spec.fill === 'hatch-45'
      ? '<path d="M-2,6 l8,-8 M0,8 l8,-8 M6,10 l4,-4" stroke="currentColor" stroke-width="1.4" fill="none"/>'
      : spec.fill === 'hatch-90'
        ? '<path d="M4,0 v8" stroke="currentColor" stroke-width="1.4" fill="none"/>'
        : '<path d="M4,0 v8 M0,4 h8" stroke="currentColor" stroke-width="1.2" fill="none"/>'
    // viewBox lets the 8×8 artwork above stay as written while the tile itself shrinks with
    // the figure, so a 0.65-size shape gets proportionally finer hatching instead of three
    // fat lines.
    const sp = (8 * spec.size).toFixed(2)
    defs = `<defs><pattern id="${id}" width="${sp}" height="${sp}" patternUnits="userSpaceOnUse" viewBox="0 0 8 8">${lines}</pattern></defs>`
    fill = `url(#${id})`
  }

  let half = ''
  if (spec.half) {
    // The ink is the shape clipped to one diagonal triangle, so the split follows the outline
    // instead of overrunning it — a half-filled circle comes out a proper half-disc.
    const clip = `clip${id}`
    const shapeEl = pts
      ? `<polygon points="${pathOf(pts)}"/>`
      : `<circle cx="50" cy="50" r="${radius.toFixed(1)}"/>`
    defs += `<defs><clipPath id="${clip}">${shapeEl}</clipPath></defs>`
    half = `<polygon points="${pathOf(HALF_TRI[spec.half])}" fill="currentColor" clip-path="url(#${clip})"/>`
  }

  const body = `${outline} fill="${fill}" stroke="currentColor" stroke-width="${(2.6 * (radius / 38) ** 0.35).toFixed(2)}" stroke-linejoin="round"/>`

  // On a solid shape the marks have to be punched out of it, or they simply are not there.
  const markFill = spec.fill === 'solid' ? ctx.bg : 'currentColor'
  const dots = dotPoints(spec)
    .map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${dotRadius(spec).toFixed(1)}" fill="${markFill}"/>`)
    .join('')
  const c = cornerPoint(spec)
  const corner = c
    ? `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(5.5 * spec.size).toFixed(1)}" fill="${markFill}"/>`
    : ''

  const inner = spec.inner
    ? nodeMarkup(
      { ...makeSpec(spec.inner), stretch: spec.stretch, size: spec.size * spec.inner.size },
      radius * spec.inner.size,
      ctx,
    )
    : ''

  return defs + body + half + dots + corner + inner
}

// Returns an SVG string rather than React elements so the same module drives the lab, the
// child screen and the standalone preview page without a React dependency.
export function renderFigure(rawSpec, opts = {}) {
  const spec = normalizeSpec(rawSpec)
  const px = opts.px || 84
  const ctx = { bg: opts.bg || '#FFFFFF' }
  const tf = `rotate(${spec.rotation} 50 50)${spec.flip ? ' translate(100 0) scale(-1 1)' : ''}`
  return `<svg viewBox="0 0 100 100" width="${px}" height="${px}" aria-hidden="true" focusable="false">`
    + `<g transform="${tf}">${nodeMarkup(spec, 38 * spec.size, ctx)}</g></svg>`
}
