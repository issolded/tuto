// Tuto Care — design tokens for the parent app.
// Kept apart from the components so the kit has one source of truth for colour, type,
// space, radius, elevation and touch, and so parentUI.jsx exports only components to
// React Fast Refresh. parentUI re-exports every name here: screens keep importing from
// '../lib/parentUI' and nothing at the call sites has to change.

export const PC = {
  bg:       '#F4F6F7',
  card:     '#FFFFFF',
  ink:      '#21262E',
  inkSoft:  '#79808C',
  inkFaint: '#A9AFB9',
  line:     '#ECEEF1',
  field:    '#F3F5F7',
  teal:     '#3FB7AC',
  tealDeep: '#2EA298',
  tealInk:  '#237F78',
  tealBg:   '#E4F4F2',
  peach:    '#F0A368',
  peachDeep:'#E08B49',
  peachBg:  '#FCEEE1',
  amber:    '#E9A23B',
  amberBg:  '#FBF0D9',
  green:    '#56BD8C',
  greenBg:  '#E6F5EC',
  danger:   '#E8695C',
  dangerBg: '#FCEAE8',
  reading:  '#a98ce6', readingBg: '#EFE9FB',
  math:     '#5aa9e6', mathBg:    '#E2F0FB',
  writing:  '#6cc28a', writingBg: '#E4F4EA',
  homework: '#e0a93b', homeworkBg: '#FBF1D6',
  drawing:  '#d97ab0', drawingBg: '#FBE6F1',
  puzzle:   '#2BA59A', puzzleBg:  '#D9F3F1',
  english:  '#D9577A', englishBg: '#FBDDE5',
}

export const FONT = "'Plus Jakarta Sans', sans-serif"
export const SHADOW    = '0 14px 34px -16px rgba(40,55,75,.18), 0 3px 10px -4px rgba(40,55,75,.06)'
export const SHADOW_SM = '0 6px 18px -8px rgba(40,55,75,.16), 0 1px 4px rgba(40,55,75,.04)'

/* PC covered colour and nothing else, so every size, gap and radius was typed where it
   was used: across the seven parent screens that left 30 distinct font sizes (10.5, 11.5,
   12.5 and 13.5 among them — no scale produces those), 15 corner radii and 18 gap values.
   These are the steps those collapse to. They are plain numbers on a 4-unit grid, the
   common denominator of Android's 4dp grid and iOS's 8pt grid, so the Kotlin Multiplatform
   build in mobile/ binds the same steps rather than re-deciding each one twice. */

export const SPACE  = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32 }

export const RADIUS = { xs: 8, sm: 12, md: 16, lg: 22, xl: 28, pill: 999 }

/* Minimum hit areas. Android asks for 48dp and iOS for 44pt, so 48 satisfies both. */
export const TAP    = { min: 48, controlH: 52, icon: 24, tile: 44 }

/* CSS shadows with negative spread have no equivalent in Compose or SwiftUI; each step
   carries its native value so nobody re-invents one per screen.
   e1 → shadow(2.dp) / .shadow(radius: 8, y: 3) · e2 → shadow(6.dp) / .shadow(radius: 14, y: 6) */
export const ELEV   = { e1: SHADOW_SM, e2: SHADOW, e3: '0 -8px 40px -12px rgba(40,55,75,.22)' }

/* Spread into a style object: style={{ ...TEXT.body }}. Headings are 800 and body is 600 —
   the kit has no 400 weight, which is why it stays legible at small sizes. */
export const TEXT = {
  wordmark: { fontSize: 42, lineHeight: '42px', fontWeight: 800, letterSpacing: '-.03em' },
  display:  { fontSize: 34, lineHeight: '40px', fontWeight: 800, letterSpacing: '-.02em' },
  titleLg:  { fontSize: 26, lineHeight: '32px', fontWeight: 800, letterSpacing: '-.01em' },
  title:    { fontSize: 21, lineHeight: '28px', fontWeight: 800 },
  heading:  { fontSize: 17, lineHeight: '24px', fontWeight: 800 },
  body:     { fontSize: 15, lineHeight: '22px', fontWeight: 600 },
  bodySm:   { fontSize: 13, lineHeight: '18px', fontWeight: 600 },
  label:    { fontSize: 12, lineHeight: '16px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' },
  caption:  { fontSize: 11, lineHeight: '14px', fontWeight: 700 },
}
