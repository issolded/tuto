const RLINES = [88, 64, 88, 64, 88]

function RLeafLines() {
  return (
    <div style={{ padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
      {RLINES.map((w, i) => (
        <span key={i} style={{ display: 'block', height: 3.5, borderRadius: 3, background: '#dcccee', width: `${w}%` }} />
      ))}
    </div>
  )
}

function RLeaf({ delay, z }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 120, width: 120, height: 160, transformOrigin: 'left center', transformStyle: 'preserve-3d', animation: `fbPageturn 2.6s ease-in-out infinite`, animationDelay: `${delay}s`, zIndex: z }}>
      <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', background: '#fff8ef', borderRadius: '2px 8px 8px 2px', boxShadow: 'inset 7px 0 13px -9px rgba(120,90,60,.5)' }}>
        <RLeafLines />
      </div>
      <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', background: '#fff8ef', borderRadius: '8px 2px 2px 8px', boxShadow: 'inset -7px 0 13px -9px rgba(120,90,60,.5)', transform: 'rotateY(180deg)' }}>
        <RLeafLines />
      </div>
    </div>
  )
}

// "Reading your story…" loop — a continuously page-turning 3D book beside a bobbing,
// blinking Tuto mascot. Replaces the static <TutoMascot expression="thinking"> on the
// 'evaluating' step. Purely decorative/looping — no story data needed.
export default function FlippingBook() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 }}>
      <style>{`
        @keyframes fbPageturn { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(-180deg); } }
        @keyframes fbBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes fbBlink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(.15); } }
        @keyframes fbRise { 0% { opacity: 0; transform: translateY(8px) scale(.6); } 30% { opacity: 1; transform: translateY(-4px) scale(1); } 70% { opacity: 1; transform: translateY(-14px) scale(1); } 100% { opacity: 0; transform: translateY(-26px) scale(.7); } }
        @keyframes fbDot { 0%, 60%, 100% { opacity: .3; } 30% { opacity: 1; } }
        .fb-mascot-svg { animation: fbBob 3.4s ease-in-out infinite; }
        .fb-eyes { transform-box: fill-box; transform-origin: center; animation: fbBlink 4.2s ease-in-out infinite; }
        .fb-spark { position: absolute; font-size: 18px; opacity: 0; }
        .fb-spark.a { left: 14px; top: 8px; animation: fbRise 2.8s ease-in-out infinite; }
        .fb-spark.b { right: 8px; top: 30px; animation: fbRise 2.8s ease-in-out .9s infinite; }
        .fb-spark.c { right: 30px; top: -4px; animation: fbRise 2.8s ease-in-out 1.7s infinite; }
        .fb-dot { display: inline-block; animation: fbDot 1.4s ease-in-out infinite; }
        .fb-dot:nth-child(2) { animation-delay: .2s; }
        .fb-dot:nth-child(3) { animation-delay: .4s; }
        @media (prefers-reduced-motion: reduce) {
          .fb-mascot-svg, .fb-eyes, .fb-spark, .fb-dot { animation: none !important; }
          .fb-spark { opacity: .9; }
        }
      `}</style>

      <div style={{ width: 260, height: 172, perspective: 1500, perspectiveOrigin: '50% 38%' }}>
        <div style={{ position: 'relative', width: 240, height: 160, transformStyle: 'preserve-3d', transform: 'rotateX(34deg)', margin: '0 auto' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, height: 160, width: 120, background: '#fff8ef', borderRadius: '8px 2px 2px 8px', boxShadow: 'inset -8px 0 16px -10px rgba(120,90,60,.45), 0 16px 26px -12px rgba(40,30,70,.45)' }}>
            <RLeafLines />
          </div>
          <div style={{ position: 'absolute', top: 0, left: 120, height: 160, width: 120, background: '#fff8ef', borderRadius: '2px 8px 8px 2px', boxShadow: 'inset 8px 0 16px -10px rgba(120,90,60,.45), 0 16px 26px -12px rgba(40,30,70,.45)' }}>
            <RLeafLines />
          </div>
          <div style={{ position: 'absolute', top: 0, left: 119, width: 2, height: 160, background: 'rgba(120,90,60,.25)', transform: 'translateZ(1px)' }} />
          <RLeaf delay={0} z={4} />
          <RLeaf delay={0.65} z={3} />
          <RLeaf delay={1.3} z={2} />
          <RLeaf delay={1.95} z={1} />
        </div>
      </div>

      <div style={{ position: 'relative', width: 150, height: 150 }}>
        <div className="fb-spark a">✨</div>
        <div className="fb-spark b">✨</div>
        <div className="fb-spark c">⭐</div>
        <svg className="fb-mascot-svg" viewBox="0 0 200 200" aria-label="Tuto reading" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <path d="M74 48 q-10 -26 12 -28 q8 13 -1 30 Z" fill="#a98ce6" stroke="#241f3a" strokeWidth="6" strokeLinejoin="round"/>
          <path d="M126 48 q10 -26 -12 -28 q-8 13 1 30 Z" fill="#a98ce6" stroke="#241f3a" strokeWidth="6" strokeLinejoin="round"/>
          <circle cx="100" cy="100" r="56" fill="#a98ce6" stroke="#241f3a" strokeWidth="6"/>
          <ellipse cx="82" cy="76" rx="12" ry="9" fill="#fff" opacity=".4"/>
          <g className="fb-eyes">
            <path d="M72 98 q9 -10 18 0" fill="none" stroke="#241f3a" strokeWidth="5" strokeLinecap="round"/>
            <path d="M110 98 q9 -10 18 0" fill="none" stroke="#241f3a" strokeWidth="5" strokeLinecap="round"/>
          </g>
          <path d="M90 114 q10 7 20 0" fill="none" stroke="#241f3a" strokeWidth="4.5" strokeLinecap="round"/>
          <circle cx="66" cy="108" r="7" fill="#f08bb0" opacity=".55"/>
          <circle cx="134" cy="108" r="7" fill="#f08bb0" opacity=".55"/>
          <ellipse cx="70" cy="150" rx="13" ry="9" fill="#a98ce6" stroke="#241f3a" strokeWidth="5.5"/>
          <ellipse cx="130" cy="150" rx="13" ry="9" fill="#a98ce6" stroke="#241f3a" strokeWidth="5.5"/>
        </svg>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: 21, color: '#8a6bd4' }}>
          Reading your story<span className="fb-dot">.</span><span className="fb-dot">.</span><span className="fb-dot">.</span> ✨
        </div>
        <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 500, fontSize: 13, color: '#8d83ad', marginTop: 2 }}>
          Just a moment!
        </div>
      </div>
    </div>
  )
}
