// Scene drawings for the English trial set: flat shapes, one dark outline, the app's colours. Every scene
// in a set of three changes ONE thing (where the ball is, how many cats, open or closed), so the picture
// answers the sentence and nothing else. Single objects (dog, apple…) come from the Noto emoji already in
// the project (src/lib/puzzleArt.generated.js); these are the things Noto drawings were not fetched for.
//
// Each export returns an SVG string, viewBox 0 0 240 200.

const INK = '#2c2745', W = 4
const C = {
  wood: '#c98b52', woodDark: '#a96d3b', red: '#e8574f', blue: '#4f8fe0', yellow: '#f6c445', white: '#ffffff',
  grey: '#b9b4c9', cat: '#f2a65a', catDark: '#d9853a', bed: '#7cc7b2', sheet: '#ffffff', pillow: '#fbe7a6',
  box: '#d9a066', boxDark: '#b77d44', bag: '#e87aa4', glass: '#cfe8fb', wall: '#f6f3ee', floor: '#e9e2d5', sky: '#bfe3ff',
}
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="240" height="200">` +
  `<rect width="240" height="200" fill="${C.wall}"/><rect y="168" width="240" height="32" fill="${C.floor}"/>` +
  `<g stroke="${INK}" stroke-width="${W}" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`

// ── objects ───────────────────────────────────────────────────────────────────────────────────────
// A chair seen from the side, standing on the floor at x (its front-left foot), seat top at y=118.
function chair(x) {
  return `<rect x="${x}" y="40" width="14" height="90" rx="4" fill="${C.wood}"/>` +              // back post
    `<rect x="${x}" y="52" width="14" height="44" rx="3" fill="${C.woodDark}"/>` +
    `<rect x="${x - 4}" y="112" width="92" height="16" rx="5" fill="${C.wood}"/>` +             // seat
    `<line x1="${x + 6}" y1="128" x2="${x + 6}" y2="168"/>` +                                     // legs
    `<line x1="${x + 80}" y1="128" x2="${x + 80}" y2="168"/>`
}
function ball(cx, cy, r = 20) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.white}"/>` +
    `<path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx} ${cy - r} L${cx} ${cy} Z" fill="${C.red}" stroke="none"/>` +
    `<path d="M${cx + r} ${cy} A${r} ${r} 0 0 1 ${cx} ${cy + r} L${cx} ${cy} Z" fill="${C.blue}" stroke="none"/>` +
    `<path d="M${cx} ${cy - r} A${r} ${r} 0 0 1 ${cx + r} ${cy} L${cx} ${cy} Z" fill="${C.yellow}" stroke="none"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"/>`
}
// A bed on tall legs, so there is a clear space under it: headboard left, mattress, pillow, blanket.
// Mattress top at y=88; the frame's underside at y=128, the floor at 168.
function bed(x) {
  return `<rect x="${x}" y="46" width="18" height="122" rx="5" fill="${C.wood}"/>` +
    `<rect x="${x + 14}" y="88" width="150" height="30" rx="8" fill="${C.sheet}"/>` +
    `<rect x="${x + 70}" y="84" width="96" height="36" rx="10" fill="${C.bed}"/>` +
    `<rect x="${x + 22}" y="74" width="42" height="20" rx="9" fill="${C.pillow}"/>` +
    `<rect x="${x + 14}" y="118" width="152" height="10" rx="3" fill="${C.wood}"/>` +
    `<line x1="${x + 24}" y1="128" x2="${x + 24}" y2="168"/><line x1="${x + 156}" y1="128" x2="${x + 156}" y2="168"/>`
}
// A cat seen from the side. pose: 'sleep' (curled up, eyes shut, z z) or 'run' (stretched, legs out).
function cat(x, y, pose, s = 1, flip = false) {
  const t = `translate(${x} ${y}) scale(${flip ? -s : s} ${s})`
  if (pose === 'sleep') {
    // the z z are drawn outside the (possibly mirrored) group, so they never read backwards
    const zx = flip ? x + 6 * s : x - 6 * s
    const zs = `<text x="${zx}" y="${y - 44 * s}" font-family="Arial, sans-serif" font-size="${18 * s}" font-weight="700" fill="${C.blue}" stroke="none">z</text>` +
      `<text x="${zx + 12 * s}" y="${y - 58 * s}" font-family="Arial, sans-serif" font-size="${14 * s}" font-weight="700" fill="${C.blue}" stroke="none">z</text>`
    return zs + `<g transform="${t}">` +
      `<path d="M-38 0 C-40 -26 -10 -34 14 -28 C34 -22 40 -6 36 4 Z" fill="${C.cat}"/>` +            // curled body
      `<path d="M30 2 C40 -6 46 -14 40 -22" fill="none" stroke-width="6" stroke="${C.catDark}"/>` +   // tail over
      `<circle cx="-26" cy="-14" r="16" fill="${C.cat}"/>` +                                            // head tucked
      `<path d="M-38 -26 L-36 -40 L-28 -30 Z M-22 -30 L-14 -40 L-12 -26 Z" fill="${C.cat}"/>` +        // ears
      `<path d="M-33 -14 q4 4 8 0 M-21 -14 q4 4 8 0" fill="none" stroke-width="3"/>` +                  // closed eyes
      `</g>`
  }
  return `<g transform="${t}">` +
    `<path d="M-40 -6 C-44 -14 -60 -26 -66 -36" fill="none" stroke-width="7" stroke="${C.catDark}"/>` +  // tail up behind
    `<path d="M-36 -2 L-58 16 M-30 4 L-44 22 M18 4 L36 22 M24 -2 L46 12" stroke-width="7"/>` +        // legs stretched
    `<ellipse cx="-6" cy="-6" rx="40" ry="16" fill="${C.cat}"/>` +                                    // long body
    `<circle cx="38" cy="-20" r="15" fill="${C.cat}"/>` +                                              // head forward
    `<path d="M28 -32 L30 -46 L38 -35 Z M42 -35 L50 -46 L52 -30 Z" fill="${C.cat}"/>` +
    `<circle cx="43" cy="-22" r="2.5" fill="${INK}" stroke="none"/>` +                                 // open eye
    `<path d="M-74 -8 L-90 -8 M-72 4 L-94 4 M-70 16 L-86 16" stroke-width="3" stroke="${C.grey}"/>` +  // speed lines
    `</g>`
}
function box(x, open) {
  const front = `<rect x="${x}" y="100" width="90" height="68" fill="${C.box}"/>`
  const side = `<path d="M${x + 90} 100 L${x + 116} 86 L${x + 116} 154 L${x + 90} 168 Z" fill="${C.boxDark}"/>`
  if (!open) {
    return front + side + `<path d="M${x} 100 L${x + 26} 86 L${x + 116} 86 L${x + 90} 100 Z" fill="${C.box}"/>` +
      `<path d="M${x + 45} 100 L${x + 71} 86" stroke="${C.boxDark}" stroke-width="8"/>`                  // tape on the lid
  }
  return `<path d="M${x + 26} 86 L${x + 116} 86 L${x + 90} 100 L${x} 100 Z" fill="#5a3d24"/>` +          // dark inside
    `<path d="M${x} 100 L${x - 26} 78 L${x + 2} 66 L${x + 26} 86 Z" fill="${C.box}"/>` +              // flap left
    `<path d="M${x + 90} 100 L${x + 112} 120 L${x + 138} 104 L${x + 116} 86 Z" fill="${C.box}"/>` +   // flap right
    `<path d="M${x + 26} 86 L${x + 40} 58 L${x + 128} 58 L${x + 116} 86 Z" fill="${C.boxDark}"/>` +   // flap back
    front + side
}
function bag(x) {   // an open tote bag: two loop handles, straight sides, the dark opening showing
  return `<path d="M${x + 16} 100 C${x + 16} 66 ${x + 38} 66 ${x + 38} 100" fill="none" stroke-width="6"/>` +
    `<path d="M${x + 52} 100 C${x + 52} 66 ${x + 74} 66 ${x + 74} 100" fill="none" stroke-width="6"/>` +
    `<rect x="${x}" y="100" width="90" height="68" rx="6" fill="${C.bag}"/>` +
    `<path d="M${x + 8} 112 L${x + 82} 112" stroke-dasharray="4 5" stroke-width="2.5"/>` +
    `<ellipse cx="${x + 45}" cy="100" rx="45" ry="9" fill="#7a2f4c"/>`
}
// One window, two panes. Closed: both panes of glass in the frame. Open: the right pane swung out into
// the room and sky showing through the gap. Nothing else differs between the two.
function windowPic(x, open) {
  const left = `<rect x="${x}" y="34" width="60" height="104" fill="${C.glass}"/>` +
    `<path d="M${x + 12} 46 L${x + 32} 46" stroke="${C.white}" stroke-width="5"/>`
  const right = open
    ? `<rect x="${x + 60}" y="34" width="60" height="104" fill="#6fb6ee"/>` +                       // outside: sky, a cloud, a hill
      `<path d="M${x + 60} 138 L${x + 60} 118 C${x + 80} 104 ${x + 104} 106 ${x + 120} 116 L${x + 120} 138 Z" fill="#7cc46a" stroke="none"/>` +
      `<path d="M${x + 72} 62 a8 8 0 0 1 14 -4 a10 10 0 0 1 18 6 a7 7 0 0 1 -2 12 l-28 0 a7 7 0 0 1 -2 -14 Z" fill="${C.white}" stroke="none"/>` +
      `<path d="M${x + 120} 34 L${x + 156} 22 L${x + 156} 150 L${x + 120} 138 Z" fill="${C.glass}"/>`
    : `<rect x="${x + 60}" y="34" width="60" height="104" fill="${C.glass}"/>` +
      `<path d="M${x + 72} 46 L${x + 92} 46" stroke="${C.white}" stroke-width="5"/>`
  return left + right + `<rect x="${x}" y="34" width="120" height="104" rx="4" fill="none"/>` +
    `<line x1="${x + 60}" y1="34" x2="${x + 60}" y2="138"/>` +
    `<rect x="${x - 8}" y="138" width="136" height="10" rx="3" fill="${C.wood}"/>`
}
function door(x, open) {
  const frame = `<rect x="${x}" y="30" width="86" height="138" fill="${open ? '#3b3552' : C.wood}"/>`
  if (!open) return frame + `<circle cx="${x + 70}" cy="104" r="6" fill="${C.yellow}"/>`
  return frame + `<path d="M${x} 30 L${x - 34} 44 L${x - 34} 176 L${x} 168 Z" fill="${C.wood}"/>` +
    `<circle cx="${x - 26}" cy="110" r="5" fill="${C.yellow}"/>`
}

// ── scenes ─────────────────────────────────────────────────────────────────────────────────────────
export const SCENES = {
  // A03 "The ball is under the chair."
  'ball-on-chair': () => svg(chair(70) + ball(116, 92)),
  'ball-under-chair': () => svg(chair(70) + ball(116, 146)),
  'ball-next-to-chair': () => svg(chair(50) + ball(186, 146)),
  // A04 "Two cats are sleeping."
  'two-cats-sleeping': () => svg(cat(72, 160, 'sleep') + cat(172, 160, 'sleep', 1, true)),
  'one-cat-sleeping': () => svg(cat(124, 160, 'sleep')),
  'two-cats-running': () => svg(cat(110, 110, 'run', 0.85) + cat(150, 160, 'run', 0.85)),
  // CA01 "The cat is on the bed."
  'cat-under-bed': () => svg(bed(30) + cat(116, 166, 'sleep', 0.62)),
  'cat-next-to-bed': () => svg(bed(10) + cat(208, 166, 'sleep', 0.62, true)),
  'cat-on-bed': () => svg(bed(30) + cat(128, 86, 'sleep', 0.62)),
  // CA02 "The box is open."
  'box-closed': () => svg(box(60, false)),
  'box-open': () => svg(box(60, true)),
  'bag-open': () => svg(bag(76)),
  // CA03 "The window is not open. It is closed."
  'window-open': () => svg(windowPic(50, true)),
  'door-open': () => svg(door(110, true)),
  'window-closed': () => svg(windowPic(50, false)),
}

// What each picture must be read as, for the blind recognition check (scripts/english-art/check.mjs):
// the sentence it answers, the set it belongs to, and a few words a description of it should contain.
export const SETS = [
  { item: 'A03', sentence: 'The ball is under the chair.', key: 'ball-under-chair', options: ['ball-on-chair', 'ball-under-chair', 'ball-next-to-chair'] },
  { item: 'A04', sentence: 'Two cats are sleeping.', key: 'two-cats-sleeping', options: ['two-cats-sleeping', 'one-cat-sleeping', 'two-cats-running'] },
  { item: 'CA01', sentence: 'The cat is on the bed.', key: 'cat-on-bed', options: ['cat-under-bed', 'cat-next-to-bed', 'cat-on-bed'] },
  { item: 'CA02', sentence: 'The box is open.', key: 'box-open', options: ['box-closed', 'box-open', 'bag-open'] },
  { item: 'CA03', sentence: 'The window is not open. It is closed.', key: 'window-closed', options: ['window-open', 'door-open', 'window-closed'] },
]
