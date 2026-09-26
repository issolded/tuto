// Spatial vocabulary shared by the deterministic engine and its SVG renderer.
// All coordinates and symbols are visible data, never an answer flag.
export const SPATIAL_TYPES = ['hidden-part', 'overlay', 'matrix', 'compound-analogy', 'compound-mirror', 'cube-net']
const pick = (r, xs) => xs[Math.floor(r() * xs.length)]
const shuffle = (r, xs) => {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
const shapes = ['circle', 'square', 'diamond', 'cross']
const nodeKey = p => `${p.x},${p.y}:${p.shape}:${p.fill}`
const partsSpec = parts => ({ kind: 'spatial', form: 'parts', parts })
const node = (r, x, y) => ({ x, y, shape: pick(r, shapes), fill: pick(r, [0, 1]) })
export function spatialKey(s) {
  if (s.form === 'parts') return `parts:${s.parts.map(nodeKey).sort().join('|')}`
  if (s.form === 'net') return `net:${s.cells.map(c => `${c.x},${c.y}:${c.symbol}`).sort().join('|')}`
  if (s.form === 'cube') return `cube:${s.faces.join(',')}`
  return ''
}
const equal = (a, b) => spatialKey(a) === spatialKey(b)
function finish(r, seed, type, layout, prompt, answer, wrong, rule, extra = {}) {
  const candidates = [answer, ...wrong]
  if (new Set(candidates.map(spatialKey)).size !== 5) return null
  const options = shuffle(r, candidates.map((spec, i) => ({ spec, why: i ? type : null })))
  return { seed, type, layout, prompt, options, correct_index: options.findIndex(o => !o.why), rule, ...extra }
}

// Parts move on a spacious 3×3 lattice; each mark is at least 14 screen pixels across.
// The four shapes have quarter-turn symmetry, so rotating the arrangement also rotates
// every part correctly. Each part has a real outline/solid pair.
export function transformParts(s, turn = 0, invert = false, mirror = false) {
  return partsSpec(s.parts.map(p => {
    let { x, y } = p
    if (mirror) x = 2 - x
    for (let k = 0; k < turn; k++) [x, y] = [2 - y, x]
    return { ...p, x, y, fill: invert ? 1 - p.fill : p.fill }
  }))
}
const pattern = (r, count = 3) => partsSpec(shuffle(r, [0, 1, 2, 3, 5, 6, 7, 8]).slice(0, count)
  .map(k => node(r, k % 3, Math.floor(k / 3))))
function mutations(r, answer, count = 4) {
  const out = []
  for (let tries = 0; tries < 100 && out.length < count; tries++) {
    const parts = answer.parts.map(p => ({ ...p }))
    const i = Math.floor(r() * parts.length)
    if (r() < 0.5) parts[i].fill = 1 - parts[i].fill
    else parts[i].shape = pick(r, shapes.filter(s => s !== parts[i].shape))
    const s = partsSpec(parts)
    if (!equal(s, answer) && !out.some(o => equal(o, s))) out.push(s)
  }
  return out
}
export function containsPart(whole, target) {
  return whole.parts.some(anchor => {
    const dx = anchor.x - target.parts[0].x, dy = anchor.y - target.parts[0].y
    return target.parts.every(p => whole.parts.some(q => nodeKey(q) === nodeKey({ ...p, x: p.x + dx, y: p.y + dy })))
  })
}
function hiddenPart(r, band, seed) {
  const target = partsSpec([node(r, 1, 1)])
  const wanted = target.parts[0]
  const forbidden = p => p.shape === wanted.shape && p.fill === wanted.fill
  const options = Array.from({ length: 5 }, () => {
    const parts = shuffle(r, [0, 2, 6, 8]).map(k => {
      let p = node(r, k % 3, Math.floor(k / 3))
      while (forbidden(p)) p = node(r, p.x, p.y)
      return p
    })
    return partsSpec(parts)
  })
  const spot = Math.floor(r() * 4)
  options[0].parts[spot] = { ...options[0].parts[spot], shape: wanted.shape, fill: wanted.fill }
  // Every distractor includes the right outline with the wrong fill: the child must
  // find the WHOLE target, not just the only circle on the page.
  for (const s of options.slice(1)) {
    const at = Math.floor(r() * 4)
    s.parts[at] = { ...s.parts[at], shape: wanted.shape, fill: 1 - wanted.fill }
  }
  return finish(r, seed, 'hidden-part', 'row', [target], options[0], options.slice(1), { attr: 'containment', from: null, to: null })
}
function overlay(r, band, seed) {
  const slots = shuffle(r, [0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 6)
  const parts = slots.map(k => node(r, k % 3, Math.floor(k / 3)))
  const a = partsSpec(parts.slice(0, 3)), b = partsSpec(parts.slice(3))
  const answer = partsSpec(parts)
  // Equal mark count in every answer; distractors move a whole input layer, or
  // change one mark. No option can win simply by counting the two input layers.
  const wrong = [1, 2, 3].map(t => partsSpec([...a.parts, ...transformParts(b, t).parts]))
    .filter(s => new Set(s.parts.map(p => `${p.x},${p.y}`)).size === 6 && !equal(s, answer))
  wrong.push(...mutations(r, answer, 4 - wrong.length))
  return finish(r, seed, 'overlay', 'overlay', [a, b], answer, wrong, { attr: 'overlay', from: null, to: null })
}
function compoundAnalogy(r, band, seed) {
  const turn = pick(r, [1, 2, 3]), a = pattern(r), c = pattern(r)
  const b = transformParts(a, turn, true), answer = transformParts(c, turn, true)
  // Show a compound rule: move ALL positions and reverse ALL fills. Distractors
  // omit one step, turn the wrong way, or reflect instead of turning.
  const wrong = [transformParts(c, turn), transformParts(c, 0, true),
    transformParts(c, (turn + 2) % 4, true), transformParts(c, 0, true, true)]
  return finish(r, seed, 'compound-analogy', 'analogy', [a, b, c], answer, wrong,
    { attr: 'parts-transform', from: null, to: turn })
}
function compoundMirror(r, band, seed) {
  const a = pattern(r, 4), answer = transformParts(a, 0, false, true)
  return finish(r, seed, 'compound-mirror', 'mirror', [a], answer,
    [a, transformParts(a, 1), transformParts(a, 2), transformParts(answer, 0, true)],
    { attr: 'parts-mirror', from: null, to: null })
}
function shiftShapes(s, steps) {
  return partsSpec(s.parts.map(p => ({ ...p, shape: shapes[(shapes.indexOf(p.shape) + steps) % shapes.length] })))
}
function matrix(r, band, seed) {
  // Columns turn the arrangement. Rows cycle the outlines and alternate fill.
  // Cycling outlines prevents row three from copying row one: the answer must
  // combine the two directions instead of being copied from a shown cell.
  const base = pattern(r, 3), turn = pick(r, [1, 3]), shapeStep = pick(r, [1, 3])
  const cells = Array.from({ length: 9 }, (_, k) => shiftShapes(
    transformParts(base, (k % 3) * turn % 4, Math.floor(k / 3) % 2 === 1), Math.floor(k / 3) * shapeStep))
  const missing = pick(r, [4, 5, 7, 8]), answer = cells[missing]
  const wrong = [transformParts(answer, 0, true), transformParts(answer, 1),
    transformParts(answer, 2), transformParts(answer, 3, true)]
  cells[missing] = null
  return finish(r, seed, 'matrix', 'grid3x3', cells, answer, wrong,
    { attr: 'parts-matrix', from: null, to: null })
}

const neg = v => v.map(x => -x)
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
// Fold any connected net into integer orthonormal frames. Repeated normals mean
// overlapping faces, not a cube; disagreement on revisiting a face is also invalid.
export function foldNet(cells) {
  const frames = new Map([[`${cells[0].x},${cells[0].y}`, { u: [1,0,0], v: [0,1,0], n: [0,0,1] }]])
  const queue = [cells[0]]
  for (const cell of queue) {
    const f = frames.get(`${cell.x},${cell.y}`)
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const next = cells.find(c => c.x === cell.x + dx && c.y === cell.y + dy)
      if (!next) continue
      const nf = dx === 1 ? { u: neg(f.n), v: f.v, n: f.u }
        : dx === -1 ? { u: f.n, v: f.v, n: neg(f.u) }
          : dy === 1 ? { u: f.u, v: neg(f.n), n: f.v } : { u: f.u, v: f.n, n: neg(f.v) }
      const key = `${next.x},${next.y}`, old = frames.get(key)
      if (old) { if (JSON.stringify(old) !== JSON.stringify(nf)) return null }
      else { frames.set(key, nf); queue.push(next) }
    }
  }
  if (frames.size !== 6 || new Set([...frames.values()].map(f => f.n.join(','))).size !== 6) return null
  return cells.map(c => ({ symbol: c.symbol, ...frames.get(`${c.x},${c.y}`) }))
}
export function cubeFits(net, cube) {
  const frames = foldNet(net.cells)
  if (!frames || new Set(cube.faces).size !== 3) return false
  const ns = cube.faces.map(s => frames.find(f => f.symbol === s)?.n)
  if (ns.some(n => !n)) return false
  const [top, front, right] = ns
  // Screen y points down; the physical cross-net fixture [north, centre, east]
  // is [top, front-left, front-right], giving determinant -1 (see regression test).
  return dot(top, front) === 0 && dot(cross(top, front), right) === -1
}
const NETS = [
  [[1,0],[0,1],[1,1],[2,1],[1,2],[1,3]],
  [[0,0],[1,0],[1,1],[2,1],[2,2],[3,2]],
  [[0,0],[0,1],[1,1],[2,1],[3,1],[3,2]],
]
function cubeNet(r, band, seed) {
  const symbols = shuffle(r, [0,1,2,3,4,5])
  const cells = pick(r, NETS).map(([x,y], i) => ({ x, y, symbol: symbols[i] }))
  const net = { kind: 'spatial', form: 'net', cells }
  const good = [], bad = []
  for (const t of symbols) for (const f of symbols) for (const s of symbols) {
    if (new Set([t,f,s]).size !== 3) continue
    const cube = { kind: 'spatial', form: 'cube', faces: [t,f,s] }
    ;(cubeFits(net, cube) ? good : bad).push(cube)
  }
  if (good.length !== 24) return null
  const impossible = r() < 0.5
  return finish(r, seed, 'cube-net', 'row', [net], pick(r, impossible ? bad : good),
    shuffle(r, impossible ? good : bad).slice(0,4), { attr: 'folding', from: null, to: impossible },
    { stem_key: impossible ? 'puzzle_stem_cube_not' : 'puzzle_stem_cube' })
}
export const SPATIAL_GENERATORS = {
  'hidden-part': hiddenPart, overlay, matrix,
  'compound-analogy': compoundAnalogy, 'compound-mirror': compoundMirror, 'cube-net': cubeNet,
}

// Recompute from the visible prompt, never from the designated answer. For analogies
// infer all admissible transforms; if two fit the example but predict different
// answers the question is ambiguous and is discarded.
export function spatialAnswerProblem(q) {
  let matches = []
  if (q.type === 'hidden-part') matches = q.options.map(o => containsPart(o.spec, q.prompt[0]))
  if (q.type === 'overlay') {
    const wanted = partsSpec(q.prompt.flatMap(s => s.parts))
    matches = q.options.map(o => equal(o.spec, wanted))
  }
  if (q.type === 'compound-mirror') matches = q.options.map(o => equal(o.spec, transformParts(q.prompt[0], 0, false, true)))
  if (q.type === 'compound-analogy') {
    const [a,b,c] = q.prompt, predictions = []
    for (let turn = 0; turn < 4; turn++) for (const inv of [false,true]) for (const mir of [false,true]) {
      if (equal(transformParts(a,turn,inv,mir),b)) predictions.push(transformParts(c,turn,inv,mir))
    }
    if (new Set(predictions.map(spatialKey)).size !== 1) return 'ambiguous compound transform'
    matches = q.options.map(o => equal(o.spec,predictions[0]))
  }
  if (q.type === 'matrix') {
    const predictions = []
    const missing = q.prompt.indexOf(null)
    if (missing < 0) return 'matrix has no blank'
    for (const turn of [1,3]) for (const inv of [false,true]) for (const shapeStep of [1,3]) {
      const wanted = k => shiftShapes(transformParts(q.prompt[0], (k%3)*turn%4, inv && Math.floor(k/3)%2 === 1), Math.floor(k/3)*shapeStep)
      if (q.prompt.every((p,k) => p === null || equal(p,wanted(k)))) predictions.push(wanted(missing))
    }
    if (new Set(predictions.map(spatialKey)).size !== 1) return 'ambiguous matrix'
    matches = q.options.map(o => equal(o.spec, predictions[0]))
  }
  if (q.type === 'cube-net') matches = q.options.map(o => cubeFits(q.prompt[0],o.spec) !== q.rule.to)
  if (matches.filter(Boolean).length !== 1 || !matches[q.correct_index]) return 'not exactly one spatial answer'
  return null
}
export function validateSpatial(q) {
  const specs = [...q.prompt.filter(Boolean), ...q.options.map(o => o.spec)]
  if (specs.some(s => s.kind !== 'spatial' || !spatialKey(s))) return 'invalid spatial figure'
  if (new Set(q.options.map(o => spatialKey(o.spec))).size !== q.options.length) return 'duplicate spatial options'
  for (const s of specs.filter(s => s.form === 'parts')) {
    if (!s.parts.length || s.parts.some(p => !shapes.includes(p.shape) || ![0,1].includes(p.fill)
      || ![0,1,2].includes(p.x) || ![0,1,2].includes(p.y))) return 'invalid part'
    if (new Set(s.parts.map(p => `${p.x},${p.y}`)).size !== s.parts.length) return 'overlapping parts'
  }
  return spatialAnswerProblem(q)
}

function mark(shape, fill, x, y, radius = 11) {
  const ink = '#18232D', paint = fill ? ink : 'white'
  const attrs = `fill="${paint}" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"`
  if (shape === 'circle') return `<circle cx="${x}" cy="${y}" r="${radius}" ${attrs}/>`
  if (shape === 'square') return `<rect x="${x-radius}" y="${y-radius}" width="${radius*2}" height="${radius*2}" ${attrs}/>`
  if (shape === 'diamond') return `<path d="M${x} ${y-radius*1.2}L${x+radius*1.2} ${y}L${x} ${y+radius*1.2}L${x-radius*1.2} ${y}Z" ${attrs}/>`
  const w = radius * 0.38
  const points = [[-w,-radius],[w,-radius],[w,-w],[radius,-w],[radius,w],[w,w],
    [w,radius],[-w,radius],[-w,w],[-radius,w],[-radius,-w],[-w,-w]]
  return `<polygon points="${points.map(([dx,dy]) => `${x+dx},${y+dy}`).join(' ')}" ${attrs}/>`
}
const cubeMark = (symbol, x, y, radius) => mark(['circle','circle','square','square','diamond','cross'][symbol], [0,1,0,1,0,0][symbol], x, y, radius)
export function renderSpatial(s, opts = {}) {
  const px = opts.px || 84
  let body = ''
  if (s.form === 'parts') body = s.parts.map(p => mark(p.shape,p.fill,20+p.x*30,20+p.y*30)).join('')
  if (s.form === 'net') {
    const minX = Math.min(...s.cells.map(c => c.x)), minY = Math.min(...s.cells.map(c => c.y))
    const w = Math.max(...s.cells.map(c => c.x))-minX+1, h = Math.max(...s.cells.map(c => c.y))-minY+1
    const unit = 88/Math.max(w,h), ox = (100-w*unit)/2, oy = (100-h*unit)/2
    body = s.cells.map(c => {
      const x = ox+(c.x-minX)*unit, y = oy+(c.y-minY)*unit
      return `<rect x="${x}" y="${y}" width="${unit}" height="${unit}" fill="white" stroke="#18232D" stroke-width="1.4"/>`
        + cubeMark(c.symbol,x+unit/2,y+unit/2,unit*0.26)
    }).join('')
  }
  if (s.form === 'cube') {
    // Screen y points down: the visible top/front/right normals have determinant -1.
    // The marks are quarter-turn
    // invariant; project them into each face, never paste upright text on a cube.
    const faces = [
      [[50,8],[40,20],[-40,20]],
      [[10,28],[40,20],[0,44]],
      [[50,48],[40,-20],[0,44]],
    ]
    body = faces.map(([o,u,v], i) => {
      const pts = [o,[o[0]+u[0],o[1]+u[1]],[o[0]+u[0]+v[0],o[1]+u[1]+v[1]],[o[0]+v[0],o[1]+v[1]]]
      return `<polygon points="${pts.map(p=>p.join(',')).join(' ')}" fill="white" stroke="#18232D" stroke-width="2"/>`
        + `<g transform="matrix(${u[0]/40} ${u[1]/40} ${v[0]/40} ${v[1]/40} ${o[0]} ${o[1]})">${cubeMark(s.faces[i],20,20,9)}</g>`
    }).join('')
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${px}" height="${px}" aria-hidden="true" focusable="false">${body}</svg>`
}
