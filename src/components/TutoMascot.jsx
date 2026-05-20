export default function TutoMascot({ size = 160, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" fill="none" style={{ animation: 'float 3s ease-in-out infinite', ...style }}>
      <circle cx="80" cy="90" r="55" fill="#FFD93D"/>
      <circle cx="80" cy="72" r="42" fill="#FFF0C0"/>
      <circle cx="65" cy="66" r="12" fill="#1A1A2E"/>
      <circle cx="95" cy="66" r="12" fill="#1A1A2E"/>
      <circle cx="69" cy="62" r="4" fill="white"/>
      <circle cx="99" cy="62" r="4" fill="white"/>
      <path d="M 62 82 Q 80 96 98 82" stroke="#1A1A2E" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
      <circle cx="38" cy="65" r="14" fill="#FFD93D"/>
      <circle cx="38" cy="65" r="8" fill="#FFB830"/>
      <circle cx="122" cy="65" r="14" fill="#FFD93D"/>
      <circle cx="122" cy="65" r="8" fill="#FFB830"/>
      <rect x="48" y="30" width="64" height="10" rx="5" fill="#1A1A2E"/>
      <rect x="70" y="20" width="20" height="14" rx="4" fill="#1A1A2E"/>
      <line x1="112" y1="35" x2="120" y2="48" stroke="#FF6B35" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="120" cy="50" r="4" fill="#FF6B35"/>
    </svg>
  )
}
