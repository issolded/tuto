import { spatialKey, renderSpatial } from './puzzleSpatial.js'
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
// `flip` is supported by the renderer and the key, and is still not in ATTRIBUTES. The reason
// has not changed: a flip interacts with rotation, and a right-pointing arrow flipped IS the
// same picture as one turned through 180°, so dealt as noise among other attributes it would
// silently collapse options into each other.
//
// What has changed is that the mirror-image questions it was being saved for now exist, as the
// `reflection` generator. They are safe because there a flip is not noise — it is the whole
// question, one figure against its mirror, and every case of the interaction is settled by
// asking geometryKey about the drawn result rather than the spec. A figure whose mirror image
// is itself is discarded for having no visible answer; a distractor that collides with the
// answer takes its draw with it. The analogy transform uses it on the same terms.
//
// What `flip` is NOT is a mirror on the screen. It flips the figure about its own axis before
// the figure is turned, so on a turned figure toggling it mirrors about a tilted line. The
// mirror a child is shown is mirrorSpec() below, and it moves the rotation too.

export const SHAPES = ['circle', 'triangle', 'square', 'pentagon', 'hexagon', 'arrow']
export const FILLS = ['none', 'solid', 'hatch-45', 'hatch-90', 'cross']
export const ROTATIONS = [0, 45, 90, 135, 180, 225, 270, 315]
export const CORNERS = [null, 'tl', 'tr', 'bl', 'br']
export const HALVES = [null, 'tl', 'tr', 'bl', 'br']
// TWO sizes, not three, and far apart: 0.65 against 1 is a 54% difference in every dimension,
// where the 0.82 that used to sit between them was 18% — a figure a fifth smaller, among five
// options that also differ in shading and angle. An adult reading the lab could not tell the
// "bigger" distractor from the answer, which settles it for a nine-year-old. `size` is one of the
// six variables the papers work on and is worth posing; it is not worth posing invisibly, and
// the engine's own rule is that a rule a child cannot see is not a rule.
export const SIZES = [0.65, 1]
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

// POSITION, the one variable on the papers' own SPANSS checklist this engine could not pose.
//
// Bond's example is five identical houses, each with three square windows and one rectangular
// door. Everything about them agrees — same outline, same parts, same number, same shading, same
// size — except that four have the door on the right and one has it on the left. Nothing but
// WHERE A PART SITS distinguishes the odd one, and no attribute here could express that: `dots`
// counts marks, `corner` puts a single mark in a corner, and neither can say "the same parts,
// arranged differently".
//
// So a figure may carry SATELLITES: four small squares in a grid inside the outline, three of
// them outlined and one filled. `position` names the slot the filled one sits in, which makes it
// a plain scalar like every other attribute rather than an array the rest of the engine would
// have to learn about. null means no satellites, exactly as null means no split for `half`.
//
// Rotation and flip move satellites with the figure, because they are points in the same
// untransformed space as everything else — so a house turned through 90° puts its door where a
// turned house would, and geometryKey says so without being told.
export const POSITION_SLOTS = { tl: [34, 34], tr: [66, 34], bl: [34, 66], br: [66, 66] }
export const POSITIONS = [null, 'tl', 'tr', 'bl', 'br']

// Satellites need an interior wide enough to hold a 2×2 grid without the corners of the grid
// falling outside the outline. A triangle's interior is a wedge, a pentagon's top corners are
// cut off and an arrow has no interior at all — the same three shapes that cannot carry a
// corner mark, for the same reason.
const SATELLITE_SHAPES = new Set(['circle', 'square', 'hexagon'])
const SATELLITE_HALF = 7

// The smallest a countable mark may be, in the 100-unit box — about 5px across at the size a
// child sees a figure. Below this normalizeSpec drops the marks rather than drawing specks.
const MIN_MARK = 3

// The attributes a question rule may be built on. Order matters only for stable output.
export const ATTRIBUTES = ['shape', 'fill', 'rotation', 'size', 'stretch', 'half', 'dots', 'corner', 'inner', 'position']

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
//
// Nor across a triangle. The split runs corner to corner of the BOX, not of the shape, so on a
// triangle it leaves a sliver and a wedge whose direction nobody can read — solving a sheet blind,
// the half-filled triangles were the ones that could not be told apart.
const HALF_SHAPES = new Set(['circle', 'square', 'pentagon', 'hexagon'])
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
    half: null, dots: 0, corner: null, inner: null, position: null, flip: false,
    ...over,
  }
}

// The four satellites in untransformed space, as [centre, isTheFilledOne]. Shared by the key and
// the renderer so the two cannot drift.
function satellites(spec) {
  if (!spec.position || !SATELLITE_SHAPES.has(spec.shape)) return []
  return Object.entries(POSITION_SLOTS).map(([slot, [x, y]]) => [
    stretchX([50 + (x - 50) * spec.size, 50 + (y - 50) * spec.size], spec.stretch),
    slot === spec.position,
  ])
}

// Resolves the combinations that would draw an unreadable figure, in one place that both the
// renderer and the key go through. Precedence runs from the most structural device to the
// least: a half-split owns the whole interior, a nested node needs an empty one to sit in,
// and marks need a plain ground to be counted against.
const fitsTriangle = (node) => node.shape === 'triangle' || (node.shape === 'circle' && node.size <= 0.45)

// Where narrowing reads as narrowing. A circle becomes an ellipse and a square a rectangle — a
// new shape a child can name. Anything else narrowed reads as SMALLER: a narrowed pentagon beside
// a full one was taken for a size change on a live 7-8 grid, and on an arrow the stretch is its
// length — normal and long were barely two pictures along a diagonal, and short lost its shaft
// (a live 10-11 code sheet nobody could decode). So elsewhere stretch is not drawn, and since the
// key goes through here too, no rule, distractor or noise can ever rest on it.
const STRETCH_SHAPES = new Set(['circle', 'square'])

export function normalizeSpec(spec) {
  const s = { ...spec }
  if (!STRETCH_SHAPES.has(s.shape)) s.stretch = 1
  const canCorner = s.corner && CORNER_SHAPES.has(s.shape)
  if (!canCorner) s.corner = null
  if (!DOT_AREA[s.shape]) s.dots = 0
  // An arrow has no inside to nest a figure in, for the reason it takes no dots: its interior is
  // a shaft a few units tall. A nested circle or triangle was drawn over the outline and out the
  // other side — six of the questions in a blind sheet of seventy carried one, and each read as a
  // printing error.
  if (s.shape === 'arrow') s.inner = null
  // A triangle has room for a nested figure only if it is small or is itself a triangle: its
  // inscribed circle is half its size, so the ring (0.58), the nested square (0.52) and the
  // two-level ring (0.66) stood out past its sides — four of 72 questions in a blind 5-6 sheet.
  // A concentric triangle of any size fits, being the same shape; a circle up to 0.45 fits.
  if (s.shape === 'triangle' && s.inner && !fitsTriangle(s.inner)) s.inner = null
  if (!HALF_SHAPES.has(s.shape)) s.half = null
  if (!SATELLITE_SHAPES.has(s.shape)) s.position = null

  // A mark too small to count is not a mark. `dots` is the one attribute a child has to COUNT
  // rather than merely notice, and its size is the product of four things that all shrink it:
  // the shape's usable area (a triangle gets 45% of a circle's), the figure's size, its
  // narrowing, and a further reduction above three dots so they do not crowd each other. At the
  // bottom of that stack — five dots on a small narrowed triangle — the marks came out at 1.6
  // units, which is under a pixel and a half on screen. Measured across real questions, 14% of
  // the oldest band's dotted figures were under 2.5 and its smallest was 1.62.
  //
  // So the figure declines the marks, the same way a triangle declines a corner mark: geometryKey
  // agrees because it calls this too, attrVisible then reports `dots` as invisible there, and
  // generators simply pose the question on a figure with room. Nothing is starved — the rule is
  // chosen first and the figure drawn to fit it.
  //
  // And it is declined FIRST, before anything reads `dots`. It used to run last, after the
  // precedence below had already cleared the ground tone and the corner mark to make room for
  // marks that were then dropped — so a hatched hexagon with three specks came out as a plain
  // hexagon, neither hatched nor dotted. An analogy moving `dots` then showed its A→B step as a
  // change of shading, which is what a review by Codex caught.
  if (s.dots > 0 && dotRadius(s) < MIN_MARK) s.dots = 0

  if (s.half) {
    s.fill = 'none'; s.inner = null; s.dots = 0; s.corner = null; s.position = null
  } else if (s.position) {
    // Satellites fill the interior the way a nested node does, so they sit at the same level of
    // the precedence: a figure carrying four of them has no room left for a fifth mark, a nested
    // shape behind them, or a ground tone to count them against.
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
    // Sampled finely enough to DRAW as an ellipse. Twelve points, which was enough for the key,
    // drew a visible dodecagon — and a child counting sides on a "stretched circle" was being
    // shown a twelve-sided polygon.
    return Array.from({ length: 48 }, (_, i) => {
      const a = (i * 7.5 * Math.PI) / 180
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
//
// And a NARROWED figure has less room across than a round one. Where a mark sits is stretched
// with the outline, but how big it is was not, so on a 0.62 figure the mark kept its full width
// inside a shape two thirds as wide and hung over the edge. Scaling by the narrowing — and only
// the narrowing, since a widened figure has room to spare — keeps the mark the same size
// RELATIVE to the shape carrying it, which is what decides whether a child can see it.
export const markScale = (spec) => spec.size * Math.min(1, spec.stretch)

export function dotRadius(spec) {
  const s = DOT_AREA[spec.shape]?.[2] ?? 1
  return 6.5 * markScale(spec) * (0.55 + 0.45 * s) * (spec.dots >= 4 ? 0.82 : 1)
}

// stretch is already baked into the points; flip first, then rotate — the same order the SVG
// transform below applies them in.
function transform([x, y], spec) {
  const px = spec.flip ? 100 - x : x
  const a = (spec.rotation * Math.PI) / 180
  const k = fitScale(spec)
  const dx = (px - 50) * k
  const dy = (y - 50) * k
  return [50 + dx * Math.cos(a) - dy * Math.sin(a), 50 + dx * Math.sin(a) + dy * Math.cos(a)]
}

// A widened figure is scaled down, whole, until it fits the box. Stretched to 1.45 a full-size
// circle, arrow or pentagon reaches past the edge of the 100-unit box — 55 units from the centre
// against 50 — and the renderer cut it off: the "wide circle" on a 10-11 sheet was a disc with
// its sides sliced away. The scale is uniform, so the proportion a question may be about is kept,
// and it is measured as the furthest outline point from the centre, so turning the figure cannot
// push it back out. Applied in the key and the renderer alike (see renderFigure).
const FIT_RADIUS = 47
function fitScale(spec) {
  if (!(spec.stretch > 1)) return 1
  const pts = shapePoints(spec.shape, 38 * spec.size, spec.stretch)
  const reach = pts
    ? Math.max(...pts.map(([x, y]) => Math.hypot(x - 50, y - 50)))
    : 38 * spec.size * spec.stretch
  return reach > FIT_RADIUS ? FIT_RADIUS / reach : 1
}

// The figure as it looks in a VERTICAL mirror standing beside it — the dashed line the lab draws.
//
// Not `flip` toggled. The renderer flips first and turns second, so a figure is R(θ)·F; a mirror
// on the screen is F applied after that, and F·R(θ) = R(−θ)·F. The mirror image therefore turns
// the other way. Toggling `flip` alone is only right at 0° and 180°, which is why three in four
// mirror questions at 10-11 marked a figure that was not the reflection.
export function mirrorSpec(spec) {
  return { ...spec, flip: !spec.flip, rotation: (360 - spec.rotation) % 360 }
}

// Whether some line reflects the drawn figure onto itself.
//
// Every figure is drawn about the centre of the box, so a line of symmetry runs through it, and
// a reflection in the line at angle α turns R(θ)·Fᵇ into R(2α − θ)·Fᵇ⁺¹: the same spec with
// `flip` toggled and the rotation moved. So the test is a scan over rotations, each compared with the
// drawn figure. 6° steps reach every axis the vocabulary has — a pentagon's axes are 36° apart, a
// triangle's and a hexagon's 60°, a square's 45° — and the audit checks this against a
// derivation that knows none of that (scripts/lib/drawn-geometry.mjs).
//
// It used to toggle `flip` and nothing else, which tests one axis: the figure's own vertical.
// A hexagon turned 45° was filed as having no symmetry at all.
export function hasLineOfSymmetry(spec) {
  const self = drawnParts(spec)
  for (let d = 0; d < 360; d += 6) {
    if (partsMatch(self, drawnParts({ ...spec, flip: !spec.flip, rotation: (spec.rotation + d) % 360 }))) return true
  }
  return false
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
  if (pts) {
    for (const p of pts) out.points.push([`s${depth}`, p])
  } else {
    // A true circle has no orientation, so it contributes a SIZE and not a position. Writing it
    // as the point [radius, 0] and letting the transform rotate it — which is what this did —
    // gave a rotationally symmetric figure a different key at every angle. attrVisible then
    // reported `rotation` as visible on a circle, generators built rules on it, and a child
    // could be asked which one had been turned when nothing on the card had turned at all.
    // Found by rasterising options and comparing them pixel by pixel; every check made of
    // specs agreed the four were different.
    out.marks.push(`o${depth}@${radius.toFixed(1)}`)
  }
  out.fills.push(`${depth}:${fillKey(spec.fill, spec.size, out.root)}`)

  if (spec.half) {
    const [dx, dy] = HALF_DIR[spec.half]
    out.points.push(['half', [50 + dx * 20, 50 + dy * 20]])
  }
  for (const p of dotPoints(spec)) out.points.push(['d', p])
  const c = cornerPoint(spec)
  if (c) out.points.push(['c', c])

  // The filled satellite is tagged apart from the other three, which is the whole of what
  // `position` says. Tagged identically they would sort into the same four points whichever slot
  // held the filled one, every arrangement would share a key, and attrVisible would report
  // position as invisible on every figure that has it.
  for (const [p, filled] of satellites(spec)) out.points.push([filled ? 'P' : 'p', p])

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
  if (rawSpec.kind === 'spatial') return spatialKey(rawSpec)
  const { head, points, marks } = drawnParts(rawSpec)
  const parts = points.map(([tag, p]) => tag + fmt(p))
  parts.push(...marks)   // orientation-free; never transformed
  parts.sort()
  return `${head}|${parts.join(' ')}`
}

// Whether two specs draw the same picture, without the key's rounding. Two keys can differ in a
// last digit for one picture reached by two routes — a stretched hexagon at 90° and its mirror at
// 270° came out 37.7 and 37.6 — so "the keys differ" does not prove "the pictures differ". Use
// this wherever the question is whether a child would see two of the same thing.
export function samePicture(a, b) {
  if (a.kind === 'spatial' || b.kind === 'spatial') return a.kind === b.kind && spatialKey(a) === spatialKey(b)
  return partsMatch(drawnParts(a), drawnParts(b))
}

// The key before rounding: the transformed points as floats, and everything else as the string
// the key carries. Rounding to a tenth is right for telling pictures apart and wrong for asking
// whether two routes reach the same one — a rectangle turned 135° and its reflection land a
// hundredth either side of a rounding boundary, and an exact comparison calls it asymmetric.
function drawnParts(rawSpec) {
  const spec = normalizeSpec(rawSpec)
  const out = { points: [], marks: [], fills: [], root: spec }
  collect(spec, 38 * spec.size, 0, out)
  return {
    head: `${out.fills.join('/')}|${dotRadius(spec).toFixed(1)}`,
    points: out.points.map(([tag, p]) => [tag, transform(p, spec)]),
    marks: out.marks.slice().sort().join(' '),
  }
}

// How far one picture has to turn to become the other, in degrees, as a child sees it — for two
// figures that differ ONLY in orientation (rotation, flip). Infinity for anything else: another
// fill, size, stretch, mark or shape is a different kind of difference and is not measured here.
//
// "The keys differ" is not "a child can tell them apart". A triangle turned 45° and one turned
// 270° are different specs and different keys, but a triangle repeats every 120°, so on the page
// they are 15° apart — a few pixels at the corners of a 60px card. A 9-10 code question hinged on
// exactly that pair, and mirror questions offered a hexagon beside its 15°-turned twin. Found by
// answering generated sheets blind. The angle is read off the drawn points, each against its
// nearest counterpart, so the shape's own symmetry is accounted for without being told it.
export function turnGap(a, b) {
  return orientationGap(a, b).degrees
}

// The same comparison, with the distance as well as the angle: the furthest any drawn point
// moves, in units of the 100-unit box. A turn can be wide and still tiny on the page — a small
// hexagon's satellites sit a dozen units from its centre, and 30° moves them four pixels.
function orientationGap(a, b) {
  const none = { degrees: Infinity, shift: Infinity }
  const na = normalizeSpec(a)
  const nb = normalizeSpec(b)
  if (ATTRIBUTES.some(x => x !== 'rotation' && JSON.stringify(na[x]) !== JSON.stringify(nb[x]))) return none
  const p = drawnParts(a)
  const q = drawnParts(b)
  if (p.head !== q.head || p.marks !== q.marks || p.points.length !== q.points.length) return none
  let degrees = 0
  let shift = 0
  for (const [from, to] of [[p.points, q.points], [q.points, p.points]]) {
    for (const [tag, [x, y]] of from) {
      const chord = Math.min(...to.filter(([t]) => t === tag).map(([, [u, v]]) => Math.hypot(u - x, v - y)))
      shift = Math.max(shift, chord)
      const rad = Math.hypot(x - 50, y - 50)
      if (rad < 4) continue   // at the centre a point has no direction to turn
      degrees = Math.max(degrees, (2 * Math.asin(Math.min(1, chord / (2 * rad))) * 180) / Math.PI)
    }
  }
  return { degrees, shift }
}

// How far a figure is from having a line of symmetry, in units of the 100-unit box: over every
// mirror line, the least distance its drawn points are from landing on their reflections. 0 for a
// symmetric figure. Infinity when no reflection even has the same parts (a hatch that turns into
// another angle, say), since that difference does not shrink with the scan.
//
// hasLineOfSymmetry answers yes or no, and a no can be a near miss the child cannot see: a
// rectangle tilted 45° and split corner to corner reads as a diamond cut straight across, and a
// 9-10 sheet offered it as "the one without symmetry" beside a figure that had it.
export function symmetryGap(spec) {
  const self = drawnParts(spec)
  let best = Infinity
  for (let d = 0; d < 360; d += 2) {
    const q = drawnParts({ ...spec, flip: !spec.flip, rotation: (spec.rotation + d) % 360 })
    if (self.head !== q.head || self.marks !== q.marks || self.points.length !== q.points.length) continue
    const far = (from, to) => Math.max(0, ...from.map(([tag, [x, y]]) => Math.min(
      ...to.filter(([t]) => t === tag).map(([, [u, v]]) => Math.hypot(u - x, v - y)))))
    best = Math.min(best, Math.max(far(self.points, q.points), far(q.points, self.points)))
  }
  return best
}

// Below this, two orientations of one figure are one picture to a child. 35° keeps a pentagon
// point-up apart from point-down (36°) and a square from a diamond (45°), and drops a hexagon
// turned 45° (15° from where it started) and a pentagon turned 90° (18°). It was 30, which let
// through a hexagon beside its 30°-turned twin — the most two hexagons can ever differ, since
// the outline repeats every 60°, and on the page only "slightly tilted". A second blind 9-10
// sheet missed two mirror questions on exactly that pair.
export const MIN_TURN = 35
// And however wide the turn, something on the figure has to move this far: 12 units is 7px on a
// 60px card. Found on a mirror question whose answer and a distractor were one small hexagon with
// its filled satellite 30° round — four pixels.
export const MIN_SHIFT = 12

// The test every "are these two different pictures?" question should ask: not only the same
// picture, but one a child cannot tell from it.
export function tooAlike(a, b) {
  if (a.kind === 'spatial' || b.kind === 'spatial') return samePicture(a, b)
  if (samePicture(a, b)) return true
  const { degrees, shift } = orientationGap(a, b)
  return degrees < MIN_TURN || shift < MIN_SHIFT
}

// Same picture, compared with a tolerance far below any real difference in the vocabulary and
// far above floating-point error.
function partsMatch(p, q) {
  if (p.head !== q.head || p.marks !== q.marks || p.points.length !== q.points.length) return false
  const left = q.points.slice()
  for (const [tag, [x, y]] of p.points) {
    const k = left.findIndex(([t, [u, v]]) => t === tag && Math.abs(u - x) < 0.05 && Math.abs(v - y) < 0.05)
    if (k < 0) return false
    left.splice(k, 1)
  }
  return true
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
      ? '<path d="M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2" stroke="currentColor" stroke-width="1.4" fill="none"/>'
      : spec.fill === 'hatch-90'
        ? '<path d="M4,0 v8" stroke="currentColor" stroke-width="1.4" fill="none"/>'
        : '<path d="M4,0 v8 M0,4 h8" stroke="currentColor" stroke-width="1.2" fill="none"/>'
    // viewBox lets the 8×8 artwork above stay as written while the tile itself shrinks with
    // the figure, so a 0.65-size shape gets proportionally finer hatching instead of three
    // fat lines.
    //
    // And coarse enough to tell apart. An 8-unit tile is under five pixels on a 60px figure, where
    // the diagonal hatch and the cross-hatch both read as the same grey — a sequence built on
    // those two fills could not be solved by looking. 14 units puts the lines far enough apart
    // for the cross to read as a grid and the hatch as lines.
    const sp = (14 * spec.size).toFixed(2)
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
    // 8 rather than 5.5, which is the difference between a question and an eye test. A corner
    // mark on a SOLID figure is punched out of it, so at 5.5 a filled circle carrying one and a
    // filled circle carrying none differed in 2% of their ink at the size a child sees — two
    // drawings that are the same drawing for all practical purposes, waved through by every
    // check because the specs and the key genuinely differ. Found by rasterising whole questions
    // and looking at the closest pair; see scripts/puzzle-pixels.mjs.
    //
    // 8 is the largest that still sits inside the outline: the mark sits 28.3 units from the
    // centre of a 38-unit figure, so its edge lands at 36.3. markScale carries the narrowing.
    ? `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(8 * markScale(spec)).toFixed(1)}" fill="${markFill}"/>`
    : ''

  // Squares rather than circles, so they read as parts of the figure — windows and a door —
  // rather than as more of the dots the same figure could have been carrying.
  // The satellites stay SQUARE however the outline is stretched — only where they sit moves with
  // it. Stretched with the figure they came out as narrow slots on a 0.62 figure, and the
  // question stopped being about where the mark is and started being about what shape it had
  // become. Bond's houses keep the same windows and move the door; that is the whole point.
  const sats = satellites(spec).map(([[x, y], filled]) => {
    const h = SATELLITE_HALF * markScale(spec)
    return `<rect x="${(x - h).toFixed(1)}" y="${(y - h).toFixed(1)}"`
      + ` width="${(h * 2).toFixed(1)}" height="${(h * 2).toFixed(1)}"`
      + ` fill="${filled ? 'currentColor' : ctx.bg}" stroke="currentColor" stroke-width="1.6"/>`
  }).join('')

  const inner = spec.inner
    ? nodeMarkup(
      { ...makeSpec(spec.inner), stretch: spec.stretch, size: spec.size * spec.inner.size },
      radius * spec.inner.size,
      ctx,
    )
    : ''

  return defs + body + half + dots + corner + sats + inner
}

// Returns an SVG string rather than React elements so the same module drives the lab, the
// child screen and the standalone preview page without a React dependency.
//
// The xmlns matters even though nothing reads it when the markup is injected into HTML: without
// it the output is only valid INLINE, and a browser refuses to load it as an image. That is
// what a standalone SVG document needs to be rasterised — which is how the figures are checked
// for being visually distinguishable, a thing geometryKey cannot judge.
export function renderFigure(rawSpec, opts = {}) {
  if (rawSpec.kind === 'spatial') return renderSpatial(rawSpec, opts)
  const spec = normalizeSpec(rawSpec)
  const px = opts.px || 84
  const ctx = { bg: opts.bg || '#FFFFFF' }
  const k = fitScale(spec)
  const fit = k < 1 ? ` translate(50 50) scale(${k.toFixed(4)}) translate(-50 -50)` : ''
  const tf = `rotate(${spec.rotation} 50 50)${fit}${spec.flip ? ' translate(100 0) scale(-1 1)' : ''}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${px}" height="${px}"`
    + ' aria-hidden="true" focusable="false">'
    + `<g transform="${tf}">${nodeMarkup(spec, 38 * spec.size, ctx)}</g></svg>`
}
