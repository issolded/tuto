// TutoMascot — "Tuto the blob": chunky-outline, ear-topped blob.
// Same API (size, expression, style) + optional `color`. Only the face swaps per expression.
const INK = '#20201e'
const PINK = '#f08bb0'

function Face({ expression }) {
  const e = expression
  if (e === 'thinking') {
    return (
      <g>
        <path d="M80 102 q8 -6 17 0" fill="none" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="90" cy="110" r="5" fill={INK} />
        <circle cx="113" cy="110" r="5" fill={INK} />
        <path d="M95 128 q9 -5 18 -1" fill="none" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
        <text x="132" y="78" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="30" fill={INK}>?</text>
        <circle cx="74" cy="124" r="6.5" fill={PINK} opacity=".55" />
        <circle cx="126" cy="124" r="6.5" fill={PINK} opacity=".55" />
      </g>
    )
  }
  if (e === 'excited') {
    return (
      <g>
        <path d="M78 106 l8 -8 l8 8 M78 98 l8 8 l8 -8" stroke={INK} strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <path d="M106 106 l8 -8 l8 8 M106 98 l8 8 l8 -8" stroke={INK} strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <path d="M84 122 q16 26 32 0 Z" fill={INK} />
        <path d="M90 126 q10 10 20 0 Z" fill={PINK} />
        <circle cx="72" cy="122" r="7" fill={PINK} opacity=".6" />
        <circle cx="128" cy="122" r="7" fill={PINK} opacity=".6" />
      </g>
    )
  }
  if (e === 'proud') {
    return (
      <g>
        <circle cx="88" cy="106" r="5" fill={INK} />
        <path d="M104 106 q8 -8 17 0" fill="none" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
        <path d="M86 122 q14 12 30 -3" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        <circle cx="72" cy="122" r="6.5" fill={PINK} opacity=".6" />
        <circle cx="126" cy="124" r="6.5" fill={PINK} opacity=".6" />
      </g>
    )
  }
  return (
    <g>
      <path d="M80 104 q8 -10 17 0" fill="none" stroke={INK} strokeWidth="5.5" strokeLinecap="round" />
      <path d="M104 104 q8 -10 17 0" fill="none" stroke={INK} strokeWidth="5.5" strokeLinecap="round" />
      <path d="M86 124 q14 22 30 0 Z" fill={INK} />
      <path d="M91 128 q9 9 18 0 Z" fill={PINK} />
      <circle cx="74" cy="124" r="6.5" fill={PINK} opacity=".6" />
      <circle cx="126" cy="124" r="6.5" fill={PINK} opacity=".6" />
    </g>
  )
}

export default function TutoMascot({ size = 160, expression = 'default', color = '#a98ce6', style = {} }) {
  const c = color
  return (
    <svg width={size} height={Math.round(size * 1.05)} viewBox="0 0 200 210" fill="none" style={style}>
      <rect x="84" y="166" width="16" height="30" rx="8" fill={c} stroke={INK} strokeWidth="6" />
      <rect x="106" y="166" width="16" height="30" rx="8" fill={c} stroke={INK} strokeWidth="6" />
      <path d="M70 120 q-26 -6 -34 -30" fill="none" stroke={INK} strokeWidth="17" strokeLinecap="round" />
      <path d="M70 120 q-26 -6 -34 -30" fill="none" stroke={c} strokeWidth="9" strokeLinecap="round" />
      <path d="M138 116 q24 -4 30 16" fill="none" stroke={INK} strokeWidth="16" strokeLinecap="round" />
      <path d="M138 116 q24 -4 30 16" fill="none" stroke={c} strokeWidth="8" strokeLinecap="round" />
      <path d="M66 64 q-10 -26 12 -28 q9 13 -1 30 Z" fill={c} stroke={INK} strokeWidth="6" strokeLinejoin="round" />
      <path d="M134 64 q10 -26 -12 -28 q-9 13 1 30 Z" fill={c} stroke={INK} strokeWidth="6" strokeLinejoin="round" />
      <circle cx="100" cy="112" r="58" fill={c} stroke={INK} strokeWidth="6" />
      <Face expression={expression} />
      <ellipse cx="82" cy="88" rx="11" ry="8" fill="#fff" opacity=".4" />
    </svg>
  )
}
