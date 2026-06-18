// ── Auth flow — Opening, Login, Signup ──────────────────────────────────────
const { PC, FONT, SHADOW, SHADOW_SM, Btn, Icon, TopBar } = window;

function GoogleMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5c-7.6 0-14.2 4.3-17.7 10.2z"/><path fill="#4CAF50" d="M24 43.5c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 34.6 26.7 35.5 24 35.5c-5.3 0-9.7-3.1-11.3-7.4l-6.5 5C9.6 39.1 16.2 43.5 24 43.5z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.4 36.2 43.5 30.6 43.5 24c0-1.2-.1-2.3-.4-3.5z"/></svg>
  );
}

// ── Opening / role select ──────────────────────────────────────────────────
function Opening({ go }) {
  return (
    <div className="tc-scroll" style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', padding:'20px 30px 40px', gap:0, textAlign:'center' }}>
      <div style={{ position:'relative' }}>
        <div style={{ position:'absolute', inset:'-18px', borderRadius:'50%',
          background:'radial-gradient(circle, rgba(63,183,172,.16) 0%, rgba(63,183,172,0) 70%)' }} />
        <TutoMascot size={150} color={PC.teal} style={{ position:'relative', animation:'tcFloat 3.4s ease-in-out infinite' }} />
      </div>
      <div style={{ fontFamily:FONT, fontWeight:800, fontSize:42, color:PC.ink, letterSpacing:'-1.4px', marginTop:8 }}>tuto</div>
      <div style={{ fontFamily:FONT, fontWeight:600, fontSize:15.5, color:PC.inkSoft, lineHeight:1.55, marginTop:8, maxWidth:280 }}>
        Learn, earn, have fun. Every task brings your child closer to a reward.
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:13, width:'100%', marginTop:38 }}>
        <button className="tc-press tc-tap" onClick={() => go('login')} style={{ background:'#fff', border:'none', borderRadius:22,
          padding:'18px 20px', display:'flex', alignItems:'center', gap:15, cursor:'pointer', boxShadow:SHADOW, textAlign:'left' }}>
          <div style={{ width:50, height:50, borderRadius:15, background:PC.tealBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Icon name="user" size={25} color={PC.tealDeep} />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:FONT, fontWeight:800, fontSize:17, color:PC.ink }}>I'm a parent</div>
            <div style={{ fontFamily:FONT, fontWeight:600, fontSize:13, color:PC.inkSoft, marginTop:1 }}>Manage tasks & approve rewards</div>
          </div>
          <Icon name="chevron" size={20} color={PC.inkFaint} />
        </button>

        <button className="tc-press tc-tap" onClick={() => go('login')} style={{ background:'#fff', border:'none', borderRadius:22,
          padding:'18px 20px', display:'flex', alignItems:'center', gap:15, cursor:'pointer', boxShadow:SHADOW, textAlign:'left' }}>
          <div style={{ width:50, height:50, borderRadius:15, background:PC.peachBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Icon name="sparkle" size={25} color={PC.peachDeep} />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:FONT, fontWeight:800, fontSize:17, color:PC.ink }}>I'm a kid</div>
            <div style={{ fontFamily:FONT, fontWeight:600, fontSize:13, color:PC.inkSoft, marginTop:1 }}>Complete tasks, earn Gems!</div>
          </div>
          <Icon name="chevron" size={20} color={PC.inkFaint} />
        </button>
      </div>
    </div>
  );
}

// ── Login ───────────────────────────────────────────────────────────────────
function Login({ go }) {
  const [email, setEmail] = React.useState('hello@family.com');
  const [pw, setPw] = React.useState('••••••••');
  return (
    <>
      <TopBar onBack={() => go('opening')} title="" />
      <div className="tc-scroll" style={{ flex:1, padding:'8px 26px 30px', display:'flex', flexDirection:'column' }}>
        <div style={{ fontFamily:FONT, fontWeight:800, fontSize:30, color:PC.ink, letterSpacing:'-.6px', lineHeight:1.15 }}>
          Welcome back 👋
        </div>
        <div style={{ fontFamily:FONT, fontWeight:600, fontSize:15, color:PC.inkSoft, marginTop:8 }}>Sign in to manage your family.</div>

        <div style={{ display:'flex', flexDirection:'column', gap:16, marginTop:30 }}>
          <Field label="Email">
            <input className="tc-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@email.com" />
          </Field>
          <Field label="Password">
            <input className="tc-input" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" />
          </Field>
          <div style={{ alignSelf:'flex-end', marginTop:-4 }}>
            <span className="tc-tap" style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:PC.tealDeep, cursor:'pointer' }}>Forgot password?</span>
          </div>
          <Btn onClick={() => go('dashboard')} style={{ marginTop:4 }}>Sign in</Btn>

          <div style={{ display:'flex', alignItems:'center', gap:12, color:PC.inkFaint, margin:'4px 0' }}>
            <div style={{ flex:1, height:1, background:PC.line }} />
            <span style={{ fontFamily:FONT, fontWeight:700, fontSize:12.5 }}>or</span>
            <div style={{ flex:1, height:1, background:PC.line }} />
          </div>
          <Btn variant="outline" onClick={() => go('dashboard')}><GoogleMark /> Continue with Google</Btn>
        </div>

        <div style={{ textAlign:'center', marginTop:'auto', paddingTop:26, fontFamily:FONT, fontWeight:600, fontSize:14, color:PC.inkSoft }}>
          New to Tuto? <span className="tc-tap" onClick={() => go('signup')} style={{ color:PC.tealDeep, fontWeight:800, cursor:'pointer' }}>Create an account</span>
        </div>
      </div>
    </>
  );
}

// ── Signup ────────────────────────────────────────────────────────────────
function Signup({ go }) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  return (
    <>
      <TopBar onBack={() => go('login')} title="" />
      <div className="tc-scroll" style={{ flex:1, padding:'8px 26px 30px', display:'flex', flexDirection:'column' }}>
        <div style={{ fontFamily:FONT, fontWeight:800, fontSize:30, color:PC.ink, letterSpacing:'-.6px', lineHeight:1.15 }}>
          Create your account 🌱
        </div>
        <div style={{ fontFamily:FONT, fontWeight:600, fontSize:15, color:PC.inkSoft, marginTop:8 }}>Free to start — set up in 2 minutes.</div>

        <div style={{ display:'flex', flexDirection:'column', gap:16, marginTop:30 }}>
          <Field label="Full name">
            <input className="tc-input" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
          </Field>
          <Field label="Email">
            <input className="tc-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@email.com" />
          </Field>
          <Field label="Password" hint="At least 8 characters">
            <input className="tc-input" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" />
          </Field>
          <Btn onClick={() => go('onboarding')} style={{ marginTop:4 }}>Create account</Btn>

          <div style={{ display:'flex', alignItems:'center', gap:12, color:PC.inkFaint, margin:'4px 0' }}>
            <div style={{ flex:1, height:1, background:PC.line }} />
            <span style={{ fontFamily:FONT, fontWeight:700, fontSize:12.5 }}>or</span>
            <div style={{ flex:1, height:1, background:PC.line }} />
          </div>
          <Btn variant="outline" onClick={() => go('onboarding')}><GoogleMark /> Continue with Google</Btn>
        </div>

        <div style={{ textAlign:'center', marginTop:'auto', paddingTop:26, fontFamily:FONT, fontWeight:600, fontSize:14, color:PC.inkSoft }}>
          Already have an account? <span className="tc-tap" onClick={() => go('login')} style={{ color:PC.tealDeep, fontWeight:800, cursor:'pointer' }}>Sign in</span>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { Opening, Login, Signup });
