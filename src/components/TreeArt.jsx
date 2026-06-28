// TreeArt — chunky ink-outlined growing tree, same hand as TutoMascot.
// `fruits` = approved contributions this month. Ported from design_handoff_my_tree/tree-art.jsx.

const INK = '#20201e'
const LEAF = '#6BBF59'
const LEAF_DEEP = '#4FA84A'
const BARK = '#A9744F'

const SLOTS = [
  { x: 86,  y: 78,  c: '#5aa9e6' },
  { x: 118, y: 74,  c: '#e89a39' },
  { x: 101, y: 95,  c: '#ef7d9d' },
  { x: 73,  y: 102, c: '#54b487' },
  { x: 131, y: 100, c: '#5aa9e6' },
  { x: 103, y: 60,  c: '#e89a39' },
  { x: 90,  y: 116, c: '#ef7d9d' },
  { x: 122, y: 118, c: '#54b487' },
]

function Sprout() {
  return (
    <g>
      <path d="M100 186 Q99 168 100 150" fill="none" stroke={LEAF_DEEP} strokeWidth="5.5" strokeLinecap="round" />
      <path d="M100 168 Q79 166 73 149 Q94 147 100 168 Z" fill={LEAF} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M100 159 Q121 155 127 138 Q105 138 100 159 Z" fill={LEAF_DEEP} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="100" cy="149" r="5.5" fill={LEAF} stroke={INK} strokeWidth="3" />
      <ellipse cx="88" cy="155" rx="4" ry="2.4" fill="#fff" opacity=".4" />
    </g>
  )
}

export function TreeArt({ size = 200, fruits = 0, target = 12, bloom = false, style = {} }) {
  const n = Math.max(0, Math.min(fruits, SLOTS.length))
  const growth = Math.max(0, Math.min(fruits / target, 1))
  const scale = 0.34 + 0.66 * growth
  const grow = {
    transform: `translate(100px,184px) scale(${scale}) translate(-100px,-184px)`,
    transition: 'transform .7s cubic-bezier(.22,1,.36,1)',
  }
  const sprout = fruits <= 1
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" style={style}>
      <ellipse cx="100" cy="184" rx="74" ry="15" fill="#cdeed8" />
      <ellipse cx="100" cy="182" rx="50" ry="9" fill="#b4e4c5" />
      {sprout ? <Sprout /> : (
        <g style={grow}>
          <path d="M91 184 Q88 150 90 128 L110 128 Q112 150 109 184 Q100 189 91 184 Z"
                fill={BARK} stroke={INK} strokeWidth="6" strokeLinejoin="round" />
          <path d="M99 168 Q99 150 100 134" stroke="#8a5d3f" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity=".6" />
          <path d="M62 100 Q46 74 72 64 Q74 40 102 46 Q132 39 136 67 Q160 76 148 102
                   Q160 126 132 130 Q120 148 98 136 Q72 144 64 122 Q46 116 62 100 Z"
                fill={LEAF} stroke={INK} strokeWidth="6" strokeLinejoin="round" />
          <path d="M132 130 Q120 148 98 136 Q112 132 120 120 Q130 122 132 130 Z" fill={LEAF_DEEP} opacity=".55" />
          <ellipse cx="84" cy="78" rx="22" ry="16" fill="#86d27a" opacity=".7" />
          <ellipse cx="78" cy="70" rx="9" ry="6" fill="#fff" opacity=".35" />
          {SLOTS.slice(0, n).map((s, i) => (
            <g key={i}>
              <circle cx={s.x} cy={s.y} r="7.5" fill={s.c} stroke={INK} strokeWidth="3" />
              <circle cx={s.x - 2.4} cy={s.y - 2.6} r="2" fill="#fff" opacity=".55" />
            </g>
          ))}
          {bloom && [[96, 64], [122, 86], [70, 92], [110, 112], [82, 110]].map((p, i) => (
            <g key={'b' + i}>
              <circle cx={p[0]} cy={p[1]} r="5.4" fill="#f6a6c4" stroke={INK} strokeWidth="2.4" />
              <circle cx={p[0]} cy={p[1]} r="1.8" fill="#ffe08a" />
            </g>
          ))}
        </g>
      )}
    </svg>
  )
}

// Minimal abstract sprig for the 12-15 "My Part" shell — never cartoonish.
export function Sprig({ size = 30, color = '#2f8f6b', style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={style}>
      <path d="M16 30 L16 9" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 17 Q7 15 6 7 Q15 8 16 17 Z" fill={color} opacity=".9" />
      <path d="M16 13 Q25 11 26 4 Q17 5 16 13 Z" fill={color} opacity=".55" />
      <circle cx="16" cy="7" r="2.4" fill={color} />
    </svg>
  )
}
