// TreeArt — a chunky, ink-outlined growing tree in the same hand as TutoMascot.
// `fruits` = how many leaves/fruits have grown (= approved contributions this month).
// `size` scales the whole thing. Style matches the mascot: thick #20201e outlines,
// soft two-tone greens, a white highlight.

const _TINK = '#20201e';
// fixed leaf/fruit slots inside the canopy, with the 4 category accent colours cycling
const _SLOTS = [
  { x: 86,  y: 78,  c: '#5aa9e6' },
  { x: 118, y: 74,  c: '#e89a39' },
  { x: 101, y: 95,  c: '#ef7d9d' },
  { x: 73,  y: 102, c: '#54b487' },
  { x: 131, y: 100, c: '#5aa9e6' },
  { x: 103, y: 60,  c: '#e89a39' },
  { x: 90,  y: 116, c: '#ef7d9d' },
  { x: 122, y: 118, c: '#54b487' },
];

// Early in the month the plant is a literal sprout; as leaves accumulate it
// becomes a tree that eases up in size (slow growth, CSS-transitioned).
function _Sprout() {
  return (
    <g>
      <path d="M100 186 Q99 168 100 150" fill="none" stroke="var(--leaf-deep)" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M100 168 Q79 166 73 149 Q94 147 100 168 Z" fill="var(--leaf)" stroke={_TINK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M100 159 Q121 155 127 138 Q105 138 100 159 Z" fill="var(--leaf-deep)" stroke={_TINK} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="100" cy="149" r="5.5" fill="var(--leaf)" stroke={_TINK} strokeWidth="3" />
      <ellipse cx="88" cy="155" rx="4" ry="2.4" fill="#fff" opacity=".4" />
    </g>
  );
}

// Once the tree is FULL, every further contribution adds a discrete ornament
// (no size ceiling): fruit → blossom → butterfly, each popping in one at a time.
const _ORN = [
  { x: 90,  y: 92,  t: 'fruit' }, { x: 116, y: 96,  t: 'fruit' }, { x: 102, y: 110, t: 'fruit' },
  { x: 74,  y: 100, t: 'fruit' }, { x: 128, y: 110, t: 'fruit' },
  { x: 96,  y: 70,  t: 'blossom' }, { x: 120, y: 76, t: 'blossom' }, { x: 78, y: 76, t: 'blossom' },
  { x: 110, y: 122, t: 'blossom' }, { x: 86, y: 120, t: 'blossom' },
  { x: 58,  y: 50,  t: 'fly' }, { x: 142, y: 56, t: 'fly' },
];
function _Ornament({ o, i }) {
  if (o.t === 'fruit') {
    return (
      <g className="orn-pop" style={{ transformOrigin: `${o.x}px ${o.y}px` }}>
        <path d={`M${o.x} ${o.y - 6} L${o.x} ${o.y - 9}`} stroke="#7a5230" strokeWidth="2" strokeLinecap="round" />
        <circle cx={o.x} cy={o.y} r="6" fill="#e0524d" stroke={_TINK} strokeWidth="2.6" />
        <circle cx={o.x - 2} cy={o.y - 2} r="1.6" fill="#fff" opacity=".6" />
      </g>
    );
  }
  if (o.t === 'blossom') {
    return (
      <g className="orn-pop" style={{ transformOrigin: `${o.x}px ${o.y}px` }}>
        {[0, 72, 144, 216, 288].map(a => {
          const r = (a * Math.PI) / 180;
          return <circle key={a} cx={o.x + Math.cos(r) * 4.4} cy={o.y + Math.sin(r) * 4.4} r="3.1" fill="#f7b6d0" stroke={_TINK} strokeWidth="1.8" />;
        })}
        <circle cx={o.x} cy={o.y} r="2.4" fill="#ffd23f" stroke={_TINK} strokeWidth="1.4" />
      </g>
    );
  }
  // butterfly — floats just off the canopy
  return (
    <g className="orn-fly" style={{ transformOrigin: `${o.x}px ${o.y}px` }}>
      <ellipse cx={o.x - 3.4} cy={o.y} rx="3.8" ry="5" fill="#f59ec0" stroke={_TINK} strokeWidth="1.8" transform={`rotate(-18 ${o.x - 3.4} ${o.y})`} />
      <ellipse cx={o.x + 3.4} cy={o.y} rx="3.8" ry="5" fill="#ffc24d" stroke={_TINK} strokeWidth="1.8" transform={`rotate(18 ${o.x + 3.4} ${o.y})`} />
      <path d={`M${o.x} ${o.y - 4} L${o.x} ${o.y + 4}`} stroke={_TINK} strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function TreeArt({ size = 200, fruits = 3, target = 12, extras = 0, bloom = false, style = {} }) {
  const n = Math.max(0, Math.min(fruits, _SLOTS.length));
  const growth = Math.max(0, Math.min(fruits / target, 1));
  const scale = 0.34 + 0.66 * growth; // small sapling → full tree
  const nx = Math.max(0, Math.min(extras, _ORN.length));
  const grow = {
    transform: `translate(100px,184px) scale(${scale}) translate(-100px,-184px)`,
    transition: 'transform .7s cubic-bezier(.22,1,.36,1)',
  };
  const sprout = fruits <= 1;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" style={style}>
      {/* soft ground (stays full size) */}
      <ellipse cx="100" cy="184" rx="74" ry="15" fill="#cdeed8" />
      <ellipse cx="100" cy="182" rx="50" ry="9" fill="#b4e4c5" />
      {sprout ? <_Sprout /> : (
        <g style={grow}>
          {/* trunk */}
          <path d="M91 184 Q88 150 90 128 L110 128 Q112 150 109 184 Q100 189 91 184 Z"
                fill="var(--bark)" stroke={_TINK} strokeWidth="6" strokeLinejoin="round" />
          <path d="M99 168 Q99 150 100 134" stroke="#8a5d3f" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity=".6" />
          {/* canopy — one lumpy blob so there are no internal outlines */}
          <path d="M62 100 Q46 74 72 64 Q74 40 102 46 Q132 39 136 67 Q160 76 148 102
                   Q160 126 132 130 Q120 148 98 136 Q72 144 64 122 Q46 116 62 100 Z"
                fill="var(--leaf)" stroke={_TINK} strokeWidth="6" strokeLinejoin="round" />
          <path d="M132 130 Q120 148 98 136 Q112 132 120 120 Q130 122 132 130 Z" fill="var(--leaf-deep)" opacity=".55" />
          <ellipse cx="84" cy="78" rx="22" ry="16" fill="#86d27a" opacity=".7" />
          <ellipse cx="78" cy="70" rx="9" ry="6" fill="#fff" opacity=".35" />
          {/* grown leaves/fruits */}
          {_SLOTS.slice(0, n).map((s, i) => (
            <g key={i}>
              <circle cx={s.x} cy={s.y} r="7.5" fill={s.c} stroke={_TINK} strokeWidth="3" />
              <circle cx={s.x - 2.4} cy={s.y - 2.6} r="2" fill="#fff" opacity=".55" />
            </g>
          ))}
          {/* past full: extra contributions become discrete ornaments (no size ceiling) */}
          {_ORN.slice(0, nx).map((o, i) => <_Ornament key={'o' + i} o={o} i={i} />)}
          {/* end-of-month bloom shorthand */}
          {bloom && nx === 0 && [[96, 64], [122, 86], [70, 92], [110, 112], [82, 110]].map((p, i) => (
            <g key={'b' + i}>
              <circle cx={p[0]} cy={p[1]} r="5.4" fill="#f6a6c4" stroke={_TINK} strokeWidth="2.4" />
              <circle cx={p[0]} cy={p[1]} r="1.8" fill="#ffe08a" />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

// A minimal sprig for the 12–15 "My Part" shell — a stem with a few small leaves,
// thin and abstract, never cartoonish.
function Sprig({ size = 30, color = 'var(--moss)', style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={style}>
      <path d="M16 30 L16 9" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 17 Q7 15 6 7 Q15 8 16 17 Z" fill={color} opacity=".9" />
      <path d="M16 13 Q25 11 26 4 Q17 5 16 13 Z" fill={color} opacity=".55" />
      <circle cx="16" cy="7" r="2.4" fill={color} />
    </svg>
  );
}

window.TreeArt = TreeArt;
window.Sprig = Sprig;
