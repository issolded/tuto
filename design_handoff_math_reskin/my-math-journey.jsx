// My Math journey — the MathScreen flow (welcome → mode → puzzles → result),
// re-skinned in the 6–8 chunky-cute visual system. Mirrors MathScreen.jsx logic. Mock data.
const INK = '#241f3a', INK_SOFT = '#8d83ad';
const MATH = '#5aa9e6', MATH_DEEP = '#3d8fcf', MATH_BG = '#D4EDFF';
const ORANGE = '#f79433', GREEN = '#4cb685', GREEN_DEEP = '#37a06f';
const LILAC = '#e7ddf6';
const FRED = "'Fredoka', sans-serif";
const FLOW_BG = 'linear-gradient(172deg,#EAF5FF 0%,#D2E9FB 100%)';

const MJCSS = `
@keyframes mjFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
@keyframes mjPop { from{transform:scale(.85);opacity:0} to{transform:scale(1);opacity:1} }
@keyframes mjFall { 0%{transform:translateY(-14px) rotate(0);opacity:1} 100%{transform:translateY(640px) rotate(560deg);opacity:0} }
.mj-press:active{ transform:scale(.96); }
.mj-card{ transition:transform .13s ease, box-shadow .13s ease; }
.mj-card:hover{ transform:translateY(-3px); }
.mj-card:active{ transform:scale(.97); }
.mj-scroll{ overflow-y:auto; }
.mj-scroll::-webkit-scrollbar{ display:none; }
`;

/* ── shared bits ─────────────────────────────────────────── */

function MathGlyph({ c = MATH, size = 46 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="12" y="12" width="40" height="40" rx="11" fill="#fff" stroke="#20201e" strokeWidth="4"/>
      <path d="M22 24 H30 M26 20 V28" stroke={c} strokeWidth="3.6" strokeLinecap="round"/>
      <path d="M35 24 H43" stroke={c} strokeWidth="3.6" strokeLinecap="round"/>
      <circle cx="25" cy="40" r="2.4" fill={c}/>
      <circle cx="31" cy="40" r="2.4" fill={c}/>
      <path d="M36 37 L43 44 M43 37 L36 44" stroke={c} strokeWidth="3.4" strokeLinecap="round"/>
    </svg>
  );
}

function BackHeader({ title }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11, padding:'14px 20px 10px' }}>
      <div style={{
        width:42, height:42, borderRadius:14, background:'#fff', flexShrink:0,
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 3px 10px rgba(40,30,70,.1)', fontSize:19, color:INK, fontWeight:800,
      }}>←</div>
      <span style={{ fontFamily:FRED, fontWeight:600, fontSize:22, color:INK, letterSpacing:'-.3px' }}>{title}</span>
    </div>
  );
}

function TutoBubble({ msg, expr = 'default', size = 96 }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
      <div style={{
        position:'relative', background:'#fff', borderRadius:26, padding:'18px 22px',
        boxShadow:'0 8px 26px rgba(60,120,200,.16)', width:'100%',
      }}>
        <div style={{ fontFamily:FRED, fontWeight:500, fontSize:17, color:INK, lineHeight:1.5, textAlign:'center', whiteSpace:'pre-line' }}>{msg}</div>
        <div style={{ position:'absolute', bottom:-13, left:38, width:0, height:0,
          borderLeft:'9px solid transparent', borderRight:'20px solid transparent', borderTop:'15px solid #fff' }} />
      </div>
      <TutoMascot size={size} expression={expr} color={MATH} style={{ marginTop:6, animation:'mjFloat 3s ease-in-out infinite' }} />
    </div>
  );
}

function LevelBadge({ children }) {
  return (
    <div style={{ display:'inline-flex', alignSelf:'center', alignItems:'center', gap:7,
      background:'rgba(90,169,230,.16)', borderRadius:14, padding:'8px 18px',
      fontFamily:FRED, fontWeight:600, fontSize:14, color:MATH_DEEP }}>
      📊 {children}
    </div>
  );
}

function PrimaryBtn({ children, color = MATH, glow = 'rgba(61,143,207,.34)' }) {
  return (
    <button className="mj-press" style={{
      background:color, color:'#fff', border:'none', borderRadius:18, padding:'16px 22px',
      fontFamily:FRED, fontWeight:600, fontSize:18, cursor:'pointer', width:'100%',
      boxShadow:`0 8px 20px ${glow}`,
    }}>{children}</button>
  );
}

function GhostBtn({ children }) {
  return (
    <button className="mj-press" style={{
      background:'rgba(255,255,255,.7)', color:MATH_DEEP, border:'none', borderRadius:18,
      padding:'15px 22px', fontFamily:FRED, fontWeight:500, fontSize:17, cursor:'pointer', width:'100%',
    }}>{children}</button>
  );
}

/* ── SCREENS ─────────────────────────────────────────────── */

// 1 · Welcome — mascot greets, shows current level
function S_Welcome() {
  return (
    <div className="scene" style={{ background:FLOW_BG }}>
      <div style={{ position:'absolute', top:42, left:18, zIndex:5 }}>
        <div style={{ width:42, height:42, borderRadius:14, background:'rgba(255,255,255,.85)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, color:INK, fontWeight:800,
          boxShadow:'0 3px 10px rgba(40,30,70,.1)' }}>←</div>
      </div>
      <div className="scroll" style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', padding:'60px 26px 36px', gap:20, textAlign:'center' }}>
        <TutoMascot size={150} expression="excited" color={MATH} style={{ animation:'mjFloat 3s ease-in-out infinite' }} />
        <div style={{ fontFamily:FRED, fontWeight:600, fontSize:21, color:INK, lineHeight:1.5 }}>
          Let's go on a number adventure! 🚀<br/>I'll show you some fun puzzles — just do your best!
        </div>
        <LevelBadge>Subtraction up to 10</LevelBadge>
        <button className="mj-press" style={{ background:MATH, color:'#fff', border:'none', borderRadius:20,
          padding:'17px 54px', fontFamily:FRED, fontWeight:600, fontSize:20, cursor:'pointer',
          boxShadow:'0 10px 28px rgba(61,143,207,.42)', marginTop:4 }}>Let's go! →</button>
      </div>
    </div>
  );
}

// 2 · Mode select — on paper vs on screen
function ModeCard({ emoji, title, gems, gemColor, desc, delay }) {
  return (
    <button className="mj-card mj-press" style={{ background:'#fff', border:'none', borderRadius:26,
      padding:'24px 22px', display:'flex', flexDirection:'column', gap:9, cursor:'pointer', textAlign:'left',
      boxShadow:'0 8px 26px rgba(60,120,200,.13)' }}>
      <span style={{ fontSize:42 }}>{emoji}</span>
      <div style={{ fontFamily:FRED, fontWeight:600, fontSize:21, color:INK }}>{title}</div>
      <div style={{ alignSelf:'flex-start', background:gemColor, color:'#fff', borderRadius:11,
        padding:'4px 13px', fontFamily:FRED, fontWeight:600, fontSize:13 }}>⭐ +{gems} Gems</div>
      <div style={{ fontWeight:700, fontSize:13.5, color:INK_SOFT, lineHeight:1.5, marginTop:2 }}>{desc}</div>
    </button>
  );
}
function S_Mode() {
  return (
    <div className="scene" style={{ background:FLOW_BG }}>
      <BackHeader title="How do you want to work? 🤔" />
      <div className="scroll mj-scroll" style={{ padding:'4px 22px 24px', display:'flex', flexDirection:'column', gap:15 }}>
        <ModeCard emoji="✏️" title="On Paper" gems={30} gemColor={MATH}
          desc="We love pen and paper! Your brain grows every time you write! 🧠" />
        <ModeCard emoji="📱" title="On Screen" gems={20} gemColor={GREEN}
          desc="Type your answers right here, one by one." />
      </div>
    </div>
  );
}

// 3 · Loading — preparing puzzles
function S_Loading() {
  return (
    <div className="scene" style={{ background:FLOW_BG }}>
      <div className="scroll" style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', gap:22, padding:40 }}>
        <TutoMascot size={140} expression="thinking" color={MATH} style={{ animation:'mjFloat 2s ease-in-out infinite' }} />
        <div style={{ fontFamily:FRED, fontWeight:600, fontSize:20, color:INK, textAlign:'center' }}>
          Preparing your puzzles…
        </div>
        <div style={{ display:'flex', gap:7 }}>
          {[0,1,2].map(i => (
            <span key={i} style={{ width:11, height:11, borderRadius:'50%', background:MATH,
              opacity:.4 + i*0.25, animation:'mjFloat 1s ease-in-out infinite', animationDelay:`${i*0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// 4 · Paper — the question sheet to solve by hand
const PAPER_QS = ['9 − 4 = ?', '7 − 3 = ?', '10 − 6 = ?', '8 − 5 = ?', '6 − 2 = ?'];
function S_Paper() {
  return (
    <div className="scene" style={{ background:FLOW_BG }}>
      <div style={{ background:MATH, padding:'16px 22px 18px', borderRadius:'0 0 26px 26px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:36, height:36, borderRadius:11, background:'rgba(255,255,255,.22)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, color:'#fff', fontWeight:800 }}>←</div>
          <div style={{ fontFamily:FRED, fontWeight:600, fontSize:21, color:'#fff' }}>My Math 🔢</div>
        </div>
        <div style={{ fontWeight:700, fontSize:13, color:'rgba(255,255,255,.85)', marginTop:6, marginLeft:45 }}>Now solve these on paper! ✏️</div>
      </div>
      <div className="scroll mj-scroll" style={{ flex:1, padding:'16px 18px 14px', display:'flex', flexDirection:'column', gap:11 }}>
        {PAPER_QS.map((q, i) => (
          <div key={i} style={{ background:'#fff', borderRadius:18, padding:'14px 18px', display:'flex',
            alignItems:'center', gap:13, boxShadow:'0 4px 14px rgba(60,120,200,.1)' }}>
            <div style={{ width:34, height:34, borderRadius:'50%', background:MATH, color:'#fff',
              display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FRED, fontWeight:600,
              fontSize:15, flexShrink:0 }}>{i + 1}</div>
            <div style={{ fontFamily:FRED, fontWeight:600, fontSize:22, color:INK }}>{q}</div>
          </div>
        ))}
      </div>
      <div style={{ flexShrink:0, background:'#fff', padding:'14px 22px 22px', boxShadow:'0 -6px 18px rgba(40,30,70,.06)' }}>
        <PrimaryBtn>I'm ready, Tuto! 📸</PrimaryBtn>
      </div>
    </div>
  );
}

// number keyboard, chunky-cute re-skin
function NumKey({ k, kind }) {
  const isSubmit = kind === 'submit', isBack = kind === 'back';
  const bg = isSubmit ? GREEN : isBack ? ORANGE : '#2c2745';
  const color = '#fff';
  const glow = isSubmit ? 'rgba(76,182,133,.4)' : isBack ? 'rgba(247,148,51,.36)' : 'rgba(44,39,69,.28)';
  return (
    <button className="mj-press" style={{ width:70, height:70, borderRadius:'50%', border:'none',
      background:bg, color, fontFamily:FRED, fontWeight:600, fontSize:isSubmit || isBack ? 24 : 27,
      cursor:'pointer', boxShadow:`0 5px 14px ${glow}` }}>{k}</button>
  );
}
function NumKeyboard() {
  const rows = [['7','8','9'], ['4','5','6'], ['1','2','3'], ['⌫','0','✓']];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display:'flex', gap:10 }}>
          {row.map(k => <NumKey key={k} k={k} kind={k === '✓' ? 'submit' : k === '⌫' ? 'back' : 'num'} />)}
        </div>
      ))}
    </div>
  );
}

// 5 · Screen — one question + number pad
function S_Screen() {
  const total = 5, idx = 1, pct = (idx / total) * 100;
  return (
    <div className="scene" style={{ background:FLOW_BG }}>
      <div style={{ background:MATH, padding:'16px 20px 18px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:11, background:'rgba(255,255,255,.22)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, color:'#fff', fontWeight:800, flexShrink:0 }}>←</div>
          <div style={{ flex:1, background:'rgba(255,255,255,.32)', borderRadius:8, height:10, overflow:'hidden' }}>
            <div style={{ width:`${pct}%`, height:'100%', background:'#fff', borderRadius:8 }} />
          </div>
          <div style={{ fontFamily:FRED, fontWeight:600, fontSize:15, color:'rgba(255,255,255,.95)', flexShrink:0 }}>{idx + 1} / {total}</div>
        </div>
      </div>
      <div className="scroll" style={{ flex:1, padding:'18px 20px 22px', display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ background:'#fff', borderRadius:22, padding:'26px 24px', textAlign:'center',
          boxShadow:'0 8px 28px rgba(60,120,200,.14)', minHeight:84, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontFamily:FRED, fontWeight:600, fontSize:32, color:INK }}>7 − 3 = ?</div>
        </div>
        <div style={{ background:'#fff', borderRadius:16, padding:'14px', textAlign:'center',
          boxShadow:'0 4px 14px rgba(0,0,0,.05)', minHeight:62, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontFamily:FRED, fontWeight:600, fontSize:38, color:MATH, letterSpacing:6 }}>4</span>
        </div>
        <NumKeyboard />
      </div>
    </div>
  );
}

// 6 · Flash feedback — correct! overlay over the screen question
function S_Flash() {
  return (
    <div className="scene" style={{ background:FLOW_BG, position:'relative' }}>
      <div style={{ background:MATH, padding:'16px 20px 18px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:11, background:'rgba(255,255,255,.22)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, color:'#fff', fontWeight:800, flexShrink:0 }}>←</div>
          <div style={{ flex:1, background:'rgba(255,255,255,.32)', borderRadius:8, height:10, overflow:'hidden' }}>
            <div style={{ width:'40%', height:'100%', background:'#fff', borderRadius:8 }} />
          </div>
          <div style={{ fontFamily:FRED, fontWeight:600, fontSize:15, color:'rgba(255,255,255,.95)', flexShrink:0 }}>2 / 5</div>
        </div>
      </div>
      <div style={{ position:'absolute', inset:0, top:0, zIndex:20, background:'rgba(76,182,133,.94)',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
        <div style={{ fontSize:78, animation:'mjPop .35s ease both' }}>⭐</div>
        <div style={{ fontFamily:FRED, fontWeight:600, fontSize:30, color:'#fff', textAlign:'center', padding:'0 28px' }}>Yes! ⭐</div>
      </div>
    </div>
  );
}

// 7 · Result — score, gems, level up + per-question
const RESULTS = [
  { q:'9 − 4 = ?', correct:true },
  { q:'7 − 3 = ?', correct:true },
  { q:'10 − 6 = ?', correct:true },
  { q:'8 − 5 = ?', correct:false, ans:3 },
  { q:'6 − 2 = ?', correct:true },
];
const CONF = [
  { c:ORANGE, l:'8%', d:'0s' }, { c:'#FFD93D', l:'22%', d:'.1s' }, { c:GREEN, l:'36%', d:'.05s' },
  { c:MATH, l:'50%', d:'.15s' }, { c:'#ef6b6b', l:'64%', d:'.08s' }, { c:MATH_DEEP, l:'78%', d:'.12s' },
  { c:'#FFD93D', l:'90%', d:'.03s' },
];
function S_Result() {
  return (
    <div className="scene" style={{ background:FLOW_BG, position:'relative' }}>
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:5, overflow:'hidden' }}>
        {CONF.map((p, i) => (
          <span key={i} style={{ position:'absolute', left:p.l, top:-14, width:11, height:11, borderRadius:'50%',
            background:p.c, animation:`mjFall 2.6s ease-out ${p.d} forwards` }} />
        ))}
      </div>
      <div style={{ background:MATH, padding:'18px 24px 26px', borderRadius:'0 0 32px 32px', textAlign:'center' }}>
        <TutoMascot size={108} expression="proud" color="#fff" style={{ animation:'mjFloat 3s ease-in-out infinite' }} />
        <div style={{ fontFamily:FRED, fontWeight:600, fontSize:18, color:'#fff', marginTop:6, lineHeight:1.5 }}>
          WOW! You're a math superstar! 🌟 I'm so proud of you!
        </div>
      </div>
      <div className="scroll mj-scroll" style={{ flex:1, padding:'16px 18px 22px', display:'flex', flexDirection:'column', gap:13 }}>
        <div style={{ background:'#fff', borderRadius:22, padding:'18px 22px', display:'flex', alignItems:'center', gap:12,
          boxShadow:'0 4px 16px rgba(0,0,0,.05)' }}>
          <div style={{ flex:1, textAlign:'center' }}>
            <div style={{ fontFamily:FRED, fontWeight:600, fontSize:11, color:INK_SOFT, textTransform:'uppercase', letterSpacing:'.6px' }}>Score</div>
            <div style={{ fontFamily:FRED, fontWeight:600, fontSize:40, color:GREEN, lineHeight:1.05 }}>80%</div>
            <div style={{ fontWeight:700, fontSize:12.5, color:INK_SOFT, marginTop:2 }}>4 / 5 correct</div>
          </div>
          <div style={{ width:1, height:56, background:'#eee' }} />
          <div style={{ flex:1, textAlign:'center' }}>
            <div style={{ fontFamily:FRED, fontWeight:600, fontSize:11, color:INK_SOFT, textTransform:'uppercase', letterSpacing:'.6px' }}>Earned</div>
            <div style={{ fontFamily:FRED, fontWeight:600, fontSize:40, color:ORANGE, lineHeight:1.05 }}>+30</div>
            <div style={{ fontWeight:700, fontSize:12.5, color:INK_SOFT, marginTop:2 }}>Gems ⭐</div>
          </div>
        </div>

        <div style={{ background:`linear-gradient(135deg,${MATH} 0%,${GREEN} 100%)`, borderRadius:18,
          padding:'15px 18px', display:'flex', alignItems:'center', gap:13, boxShadow:'0 8px 22px rgba(61,143,207,.32)' }}>
          <span style={{ fontSize:30 }}>🎉</span>
          <div style={{ fontFamily:FRED, fontWeight:600, fontSize:16, color:'#fff' }}>You unlocked a new level! 🎉</div>
        </div>

        <div style={{ fontFamily:FRED, fontWeight:600, fontSize:15, color:INK, margin:'2px 2px 0' }}>Your answers:</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {RESULTS.map((r, i) => (
            <div key={i} style={{ background:'#fff', borderRadius:15, padding:'11px 15px', display:'flex',
              alignItems:'center', gap:11, boxShadow:'0 3px 12px rgba(60,120,200,.07)' }}>
              <span style={{ fontSize:19, flexShrink:0 }}>{r.correct ? '✅' : '🔄'}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:FRED, fontWeight:600, fontSize:15, color:INK }}>{r.q}</div>
                {!r.correct && (
                  <div style={{ fontWeight:700, fontSize:12.5, color:ORANGE, marginTop:3 }}>The answer was {r.ans} 💡</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <GhostBtn>Done! 🏠</GhostBtn>
      </div>
    </div>
  );
}

/* ── frame wrapper + assembly ────────────────────────────── */

function Phone({ n, label, children }) {
  return (
    <div className="frame">
      <div className="cap"><span className="num">{n}</span><span className="txt">{label}</span></div>
      <div className="phone" style={{ background:LILAC }}>
        <div className="statusbar">
          <span>9:41</span>
          <div className="dots"><i></i><i></i><i></i><div className="batt"></div></div>
        </div>
        {children}
      </div>
    </div>
  );
}

function MyMathJourney() {
  return (
    <div className="rail">
      <style>{MJCSS}</style>
      <Phone n="1" label="Welcome — meet your level"><S_Welcome /></Phone>
      <Phone n="2" label="Paper or screen?"><S_Mode /></Phone>
      <Phone n="3" label="Preparing puzzles"><S_Loading /></Phone>
      <Phone n="4" label="On paper — the sheet"><S_Paper /></Phone>
      <Phone n="5" label="On screen — number pad"><S_Screen /></Phone>
      <Phone n="6" label="Instant feedback"><S_Flash /></Phone>
      <Phone n="7" label="Score · gems · level up"><S_Result /></Phone>
    </div>
  );
}
window.MyMathJourney = MyMathJourney;
