// Ghost blob body — wavy bottom gives a friendly ghost silhouette
const BODY =
  'M 100 26 C 142 20 175 55 175 95 C 175 148 160 172 148 184 Q 135 199 118 192 Q 108 203 100 197 Q 92 203 82 192 Q 65 199 52 184 C 40 172 25 148 25 95 C 25 55 58 20 100 26 Z'

export default function TutoMascot({ size = 160, expression = 'default', style = {} }) {
  const e = expression

  // ── Eyebrow paths ───────────────────────────────────────────────────────────
  const leftBrow = e === 'excited'
    ? 'M 52 72 Q 64 63 82 68'
    : e === 'proud'
    ? 'M 52 75 Q 64 68 82 72'
    : 'M 52 77 Q 64 71 82 74'

  const rightBrow = e === 'thinking'
    ? 'M 118 66 Q 136 58 148 67'
    : e === 'excited'
    ? 'M 118 68 Q 136 61 148 68'
    : e === 'proud'
    ? 'M 118 72 Q 136 68 148 75'
    : 'M 118 74 Q 136 71 148 77'

  // ── Iris config per expression ───────────────────────────────────────────────
  const liX = e === 'thinking' ? 78  : 75
  const liY = (e === 'default' || e === 'thinking') ? 107 : 103
  const riX = e === 'thinking' ? 128 : 125
  const riY = liY
  const irisR = e === 'excited' ? 16  : 13
  const pupR  = e === 'excited' ? 10  : 7
  const hiR   = e === 'excited' ? 4.5 : 3

  return (
    <svg
      width={size}
      height={Math.round(size * 1.1)}
      viewBox="0 0 200 220"
      fill="none"
      style={style}
    >
      {/* ── Ghost body ─────────────────────────────────────────────────────── */}
      <path d={BODY} fill="#F5F0FF" stroke="#DDD5F0" strokeWidth="4" strokeLinejoin="round" />
      {/* Inner body shadow on wavy bottom area */}
      <path
        d="M 90 180 Q 100 188 110 180 Q 118 175 130 178 Q 118 196 100 197 Q 82 196 70 178 Q 82 175 90 180 Z"
        fill="#DDD5F0"
        opacity="0.35"
      />
      {/* Top-left highlight */}
      <ellipse cx="78" cy="58" rx="22" ry="16" fill="rgba(255,255,255,0.55)" transform="rotate(-15 78 58)" />

      {/* ── Glasses temple arms (behind frames) ────────────────────────────── */}
      <line x1="51" y1="105" x2="30"  y2="96" stroke="#5B4B8A" strokeWidth="3"   strokeLinecap="round" />
      <line x1="149" y1="105" x2="170" y2="96" stroke="#5B4B8A" strokeWidth="3"   strokeLinecap="round" />

      {/* ── Left lens ──────────────────────────────────────────────────────── */}
      {/* Glass tint */}
      <circle cx="75" cy="105" r="24" fill="#E5F3F8" opacity="0.55" />
      {/* Iris */}
      <circle cx={liX} cy={liY} r={irisR} fill="#6BBFD4" />
      {/* Pupil */}
      <circle cx={liX} cy={liY} r={pupR}  fill="#1A1A2E" />
      {/* Highlight */}
      <circle cx={liX + 4} cy={liY - 4} r={hiR} fill="white" />

      {/* ── Right lens ─────────────────────────────────────────────────────── */}
      <circle cx="125" cy="105" r="24" fill="#E5F3F8" opacity="0.55" />
      <circle cx={riX} cy={riY} r={irisR} fill="#6BBFD4" />
      <circle cx={riX} cy={riY} r={pupR}  fill="#1A1A2E" />
      <circle cx={riX + 4} cy={riY - 4} r={hiR} fill="white" />

      {/* ── Lens frames (rendered over iris so edges look sharp) ───────────── */}
      <circle cx="75"  cy="105" r="24" fill="none" stroke="#5B4B8A" strokeWidth="4.5" />
      <circle cx="125" cy="105" r="24" fill="none" stroke="#5B4B8A" strokeWidth="4.5" />
      {/* Nose bridge */}
      <path d="M 99 105 Q 100 100 101 105" fill="none" stroke="#5B4B8A" strokeWidth="3" strokeLinecap="round" />

      {/* ── Eyebrows ───────────────────────────────────────────────────────── */}
      <path d={leftBrow}  fill="none" stroke="#3D2D6E" strokeWidth="3"   strokeLinecap="round" />
      <path d={rightBrow} fill="none" stroke="#3D2D6E" strokeWidth="3"   strokeLinecap="round" />

      {/* ── Blush ──────────────────────────────────────────────────────────── */}
      <ellipse cx="45"  cy="124" rx="14" ry="8" fill="#FFB5C8" opacity="0.48" />
      <ellipse cx="155" cy="124" rx="14" ry="8" fill="#FFB5C8" opacity="0.48" />

      {/* ── Mouth ──────────────────────────────────────────────────────────── */}
      {e === 'default' && (
        <path d="M 88 142 Q 100 152 112 142" fill="none" stroke="#3D2D6E" strokeWidth="3" strokeLinecap="round" />
      )}
      {e === 'thinking' && (
        <path d="M 92 144 Q 102 149 114 142" fill="none" stroke="#3D2D6E" strokeWidth="3" strokeLinecap="round" />
      )}
      {e === 'excited' && (
        <>
          <path d="M 84 138 A 16 14 0 0 1 116 138 Z" fill="#2D2560" />
          <path d="M 89 138 A 11  5 0 0 1 111 138"   fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
        </>
      )}
      {e === 'proud' && (
        <path d="M 86 141 Q 100 154 114 141" fill="none" stroke="#3D2D6E" strokeWidth="3" strokeLinecap="round" />
      )}

      {/* ── Book + hands: default & thinking (open book held in front) ─────── */}
      {(e === 'default' || e === 'thinking') && (
        <>
          {/* Hands (behind book, peaking out at sides) */}
          <ellipse cx="52"  cy="184" rx="16" ry="11" fill="#F5F0FF" stroke="#DDD5F0" strokeWidth="2.5" />
          <ellipse cx="148" cy="184" rx="16" ry="11" fill="#F5F0FF" stroke="#DDD5F0" strokeWidth="2.5" />

          {/* Open book body */}
          <rect x="57" y="168" width="86" height="48" rx="5" fill="white" />
          {/* Left page tint */}
          <rect x="58" y="169" width="41" height="46" rx="4" fill="#F8F5FF" />
          {/* Left cover strip */}
          <rect x="58" y="169" width="7"  height="46" rx="3" fill="#B5A0E8" />
          {/* Spine */}
          <rect x="98" y="168" width="5"  height="48" fill="#B5A0E8" />
          {/* Right cover strip */}
          <rect x="136" y="169" width="6" height="46" rx="3" fill="#B5A0E8" />
          {/* Book outline */}
          <rect x="57" y="168" width="86" height="48" rx="5" fill="none" stroke="#DDD5F0" strokeWidth="1.5" />

          {/* Left page lines */}
          <line x1="70" y1="180" x2="94" y2="180" stroke="#DDD5F0" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="70" y1="188" x2="94" y2="188" stroke="#DDD5F0" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="70" y1="196" x2="94" y2="196" stroke="#DDD5F0" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="70" y1="204" x2="88" y2="204" stroke="#DDD5F0" strokeWidth="1.5" strokeLinecap="round" />
          {/* Right page lines */}
          <line x1="107" y1="180" x2="131" y2="180" stroke="#DDD5F0" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="107" y1="188" x2="131" y2="188" stroke="#DDD5F0" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="107" y1="196" x2="131" y2="196" stroke="#DDD5F0" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="107" y1="204" x2="125" y2="204" stroke="#DDD5F0" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}

      {/* ── Book + hands: proud (closed book hugged to chest) ──────────────── */}
      {e === 'proud' && (
        <>
          {/* Arms wrapping around book */}
          <ellipse cx="52"  cy="174" rx="18" ry="12" fill="#F5F0FF" stroke="#DDD5F0" strokeWidth="2.5" transform="rotate(-28 52 174)" />
          <ellipse cx="148" cy="174" rx="18" ry="12" fill="#F5F0FF" stroke="#DDD5F0" strokeWidth="2.5" transform="rotate( 28 148 174)" />
          {/* Closed book (lavender cover) */}
          <rect x="62" y="156" width="76" height="50" rx="5" fill="#B5A0E8" />
          {/* Spine */}
          <rect x="62" y="156" width="10" height="50" rx="4" fill="#9080D0" />
          {/* Cover decoration lines */}
          <line x1="78" y1="171" x2="131" y2="171" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
          <line x1="78" y1="179" x2="124" y2="179" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
          <line x1="78" y1="187" x2="128" y2="187" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {/* ── Arms + book: excited (arms up, book dropped to side) ───────────── */}
      {e === 'excited' && (
        <>
          {/* Raised arms */}
          <ellipse cx="32"  cy="150" rx="16" ry="10" fill="#F5F0FF" stroke="#DDD5F0" strokeWidth="2.5" transform="rotate(-42  32 150)" />
          <ellipse cx="168" cy="150" rx="16" ry="10" fill="#F5F0FF" stroke="#DDD5F0" strokeWidth="2.5" transform="rotate( 42 168 150)" />
          {/* Dropped book (tilted, lower right) */}
          <g transform="translate(152, 196) rotate(28)">
            <rect x="-30" y="-22" width="54" height="38" rx="4" fill="#B5A0E8" />
            <rect x="-30" y="-22" width=" 8" height="38" rx="3" fill="#9080D0" />
            <line x1="-18" y1="-10" x2="17" y2="-10" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="-18" y1=" -2" x2="17" y2=" -2" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="-18" y1="  6" x2="12" y2="  6" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </>
      )}

      {/* ── Thinking: small thought bubbles upper-right ─────────────────────── */}
      {e === 'thinking' && (
        <>
          <circle cx="140" cy="76" r="3"   fill="#B09AEE" opacity="0.7" />
          <circle cx="148" cy="68" r="4.5" fill="#B09AEE" opacity="0.8" />
          <circle cx="157" cy="59" r="6.5" fill="#B09AEE" opacity="0.9" />
        </>
      )}
    </svg>
  )
}
