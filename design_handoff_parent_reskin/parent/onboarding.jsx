// ── Parent onboarding — 10 steps ────────────────────────────────────────────
const { PC, FONT, SHADOW, SHADOW_SM, Btn, Card, Field, Toggle, Icon, TaskIcon, Pill, Confetti } = window;

const OB_TASKS = [
  { key:'reading', label:'My Books',   desc:'Read & answer questions' },
  { key:'math',    label:'My Math',    desc:'Daily number puzzles' },
  { key:'writing', label:'My Stories', desc:'Write & illustrate' },
  { key:'chore',   label:'My House',   desc:'Chores & helping out' },
];
const OB_REWARDS = [
  { emoji:'🎮', label:'Roblox 30 min', gems:30,  lock:true,  hint:'30 mins of playtime' },
  { emoji:'📺', label:'TV 1 hour',     gems:60,  lock:true,  hint:'1 hour of screen time' },
  { emoji:'🧸', label:'New toy',       gems:500, lock:false, hint:'Something special to save up for' },
];

function ProgressBar({ step, total }) {
  return (
    <div style={{ padding:'4px 26px 0' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
        <span style={{ fontFamily:FONT, fontWeight:800, fontSize:11, color:PC.inkSoft, letterSpacing:'.7px', whiteSpace:'nowrap' }}>STEP {step} OF {total}</span>
        <span style={{ fontFamily:FONT, fontWeight:800, fontSize:11, color:PC.tealDeep }}>{Math.round(step/total*100)}%</span>
      </div>
      <div style={{ height:7, background:PC.line, borderRadius:8, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${step/total*100}%`, background:PC.teal, borderRadius:8,
          transition:'width .45s cubic-bezier(.34,1.4,.5,1)' }} />
      </div>
    </div>
  );
}

function Stepper({ value, set }) {
  const b = { width:46, height:46, borderRadius:14, background:PC.tealBg, border:'none', color:PC.tealDeep,
    fontSize:24, fontWeight:700, cursor:'pointer', fontFamily:FONT };
  return (
    <div style={{ display:'flex', alignItems:'center', background:'#fff', border:`1.5px solid ${PC.line}`, borderRadius:16, padding:'10px 16px', gap:14 }}>
      <button className="tc-press" onClick={() => set(Math.max(1, value-1))} style={b}>−</button>
      <div style={{ flex:1, textAlign:'center', fontFamily:FONT, fontWeight:800, fontSize:34, color:PC.ink }}>{value}</div>
      <button className="tc-press" onClick={() => set(Math.min(18, value+1))} style={b}>+</button>
    </div>
  );
}

function PinPad({ value, onChange }) {
  const add = d => value.length < 4 && onChange(value + d);
  const del = () => onChange(value.slice(0, -1));
  const btn = { background:PC.field, border:'none', borderRadius:18, height:66, fontSize:24, fontWeight:700,
    color:PC.ink, cursor:'pointer', fontFamily:FONT };
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:24 }}>
      <div style={{ display:'flex', gap:16 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width:18, height:18, borderRadius:'50%', background:value.length>i ? PC.teal : PC.line,
            transition:'all .18s', transform:value.length>i ? 'scale(1.18)' : 'scale(1)' }} />
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:11, width:'100%', maxWidth:280 }}>
        {[1,2,3,4,5,6,7,8,9].map(n => <button key={n} className="tc-press" onClick={() => add(String(n))} style={btn}>{n}</button>)}
        <div />
        <button className="tc-press" onClick={() => add('0')} style={btn}>0</button>
        <button className="tc-press" onClick={del} style={{ ...btn, color:PC.inkSoft, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon name="back" size={22} color={PC.inkSoft} />
        </button>
      </div>
    </div>
  );
}

function Onboarding({ go, store }) {
  const [step, setStep] = React.useState(1);
  const [name, setName] = React.useState('');
  const [age, setAge] = React.useState(7);
  const [tasks, setTasks] = React.useState({ reading:true, math:true, writing:true, chore:true });
  const [rewards, setRewards] = React.useState(OB_REWARDS.map(r => ({ ...r })));
  const [channel, setChannel] = React.useState(null);
  const [email, setEmail] = React.useState(true);
  const [push, setPush] = React.useState(true);
  const [pin, setPin] = React.useState('');
  const [pinConfirm, setPinConfirm] = React.useState('');
  const [pinPhase, setPinPhase] = React.useState('enter');
  const [pinErr, setPinErr] = React.useState('');
  const [device, setDevice] = React.useState(null);
  const [copied, setCopied] = React.useState(false);
  const total = 9;
  const code = store.parent.family_code;
  const hasRoblox = rewards.some(r => r.label.toLowerCase().includes('roblox'));

  const finish = () => {
    store.addChild({ name: name.trim() || 'Zeynep', age, avatar: age <= 7 ? '🧒' : '👧', gems: 0, fresh: true });
    if (device === 'separate') setStep(10);
    else go('dashboard');
  };

  const onPin = (val) => {
    if (pinPhase === 'enter') { setPin(val); if (val.length === 4) setTimeout(() => setPinPhase('confirm'), 250); }
    else {
      setPinConfirm(val);
      if (val.length === 4) {
        if (val === pin) setTimeout(() => setStep(7), 250);
        else { setPinErr("PINs don't match — try again."); setTimeout(() => { setPin(''); setPinConfirm(''); setPinPhase('enter'); setPinErr(''); }, 900); }
      }
    }
  };

  const back = () => {
    if (step === 6) { setPinPhase('enter'); setPin(''); setPinConfirm(''); setPinErr(''); }
    if (step === 9 && !hasRoblox) return setStep(7);
    setStep(s => Math.max(1, s - 1));
  };
  const showBack = step > 1 && step < 9;
  const N = name.trim() || 'your child';

  const H = ({ children, sub }) => (
    <div>
      <div style={{ fontFamily:FONT, fontWeight:800, fontSize:25, color:PC.ink, letterSpacing:'-.4px', lineHeight:1.2 }}>{children}</div>
      {sub && <div style={{ fontFamily:FONT, fontWeight:600, fontSize:14, color:PC.inkSoft, marginTop:8, lineHeight:1.5 }}>{sub}</div>}
    </div>
  );

  return (
    <>
      {step > 1 && step < 10 && <ProgressBar step={Math.min(step, total)} total={total} />}
      {showBack && (
        <button className="tc-press tc-tap" onClick={back} aria-label="Back" style={{ alignSelf:'flex-start', margin:'12px 0 0 20px',
          width:42, height:42, borderRadius:14, background:'#fff', border:`1.5px solid ${PC.line}`, display:'flex',
          alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:SHADOW_SM }}>
          <Icon name="back" size={20} color={PC.ink} />
        </button>
      )}

      <div className="tc-scroll" style={{ flex:1, padding:'18px 26px 32px', display:'flex', flexDirection:'column' }}>

        {/* 1 · Welcome */}
        {step === 1 && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', gap:22 }}>
            <TutoMascot size={172} color={PC.teal} expression="excited" style={{ animation:'tcFloat 3.2s ease-in-out infinite' }} />
            <div className="tc-up">
              <div style={{ fontFamily:FONT, fontWeight:800, fontSize:30, color:PC.ink, letterSpacing:'-.5px' }}>Welcome to Tuto! 🎉</div>
              <div style={{ fontFamily:FONT, fontWeight:600, fontSize:15, color:PC.inkSoft, marginTop:10, lineHeight:1.6 }}>
                Let's set things up for your child.<br/>It takes about two minutes.
              </div>
            </div>
            <Btn onClick={() => setStep(2)} style={{ maxWidth:280, marginTop:6 }}>Get started →</Btn>
          </div>
        )}

        {/* 2 · Child info */}
        {step === 2 && (
          <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
            <H sub="We'll tailor activities to their age.">Tell me about your child 👶</H>
            <Field label="Child's name">
              <input className="tc-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Zeynep" autoFocus />
            </Field>
            <Field label="Age"><Stepper value={age} set={setAge} /></Field>
            <Btn onClick={() => setStep(3)} disabled={!name.trim()}>Next →</Btn>
          </div>
        )}

        {/* 3 · Tasks */}
        {step === 3 && (
          <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
            <H sub="Choose the activities that earn Gems. You can change these anytime.">What will {N} work on? 🌟</H>
            <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
              {OB_TASKS.map(({ key, label, desc }) => {
                const on = tasks[key];
                return (
                  <button key={key} className="tc-tap tc-press" onClick={() => setTasks(t => ({ ...t, [key]:!t[key] }))}
                    style={{ display:'flex', alignItems:'center', gap:14, padding:'15px 16px', background:'#fff',
                      border:`1.5px solid ${on ? PC[key] : PC.line}`, borderRadius:18, cursor:'pointer', textAlign:'left',
                      boxShadow:on ? SHADOW_SM : 'none' }}>
                    <div style={{ width:46, height:46, borderRadius:14, background:PC[key+'Bg'], display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <TaskIcon type={key} size={24} />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:FONT, fontWeight:800, fontSize:16, color:PC.ink }}>{label}</div>
                      <div style={{ fontFamily:FONT, fontWeight:600, fontSize:12.5, color:PC.inkSoft, marginTop:1 }}>{desc}</div>
                    </div>
                    <div style={{ width:26, height:26, borderRadius:9, background:on ? PC[key] : PC.field,
                      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'background .18s' }}>
                      {on && <Icon name="check" size={15} color="#fff" sw={2.6} />}
                    </div>
                  </button>
                );
              })}
            </div>
            <Btn onClick={() => setStep(4)} disabled={!Object.values(tasks).some(Boolean)}>Next →</Btn>
          </div>
        )}

        {/* 4 · Rewards */}
        {step === 4 && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <H sub={`The things ${N} can spend Gems on. Drag to set how many Gems each one costs.`}>Set up rewards 🎁</H>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {rewards.map((r, i) => {
                const pct = ((Math.min(Math.max(r.gems,10),1000)-10)/990)*100;
                return (
                  <Card key={i} soft pad={15} style={{ display:'flex', flexDirection:'column', gap:9 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:22, width:28, textAlign:'center' }}>{r.emoji}</span>
                      <span style={{ flex:1, fontFamily:FONT, fontWeight:700, fontSize:14.5, color:PC.ink }}>{r.label}</span>
                      <Pill bg={PC.amberBg} color={PC.amber}>💎 {r.gems}</Pill>
                    </div>
                    <input type="range" min={10} max={1000} step={10} value={Math.min(Math.max(r.gems,10),1000)}
                      onChange={e => setRewards(p => p.map((x, idx) => idx===i ? { ...x, gems:+e.target.value } : x))}
                      className="tc-slider" style={{ background:`linear-gradient(to right, ${PC.teal} ${pct}%, ${PC.line} ${pct}%)` }} />
                    <div style={{ fontFamily:FONT, fontWeight:600, fontSize:12, color:PC.inkFaint }}>💡 {r.hint}</div>
                  </Card>
                );
              })}
            </div>
            <Btn onClick={() => setStep(5)}>Next →</Btn>
          </div>
        )}

        {/* 5 · Notifications */}
        {step === 5 && (
          <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
            <H sub={`Choose how I keep you posted on ${N}'s progress.`}>Stay connected 👨‍👩‍👧</H>
            <div style={{ display:'flex', gap:12 }}>
              {[
                { k:'telegram', label:'Telegram', c:'#229ED9', bg:'#E6F4FB', icon:'✈️' },
                { k:'whatsapp', label:'WhatsApp', c:'#25D366', bg:'#E8F8EF', icon:'💬' },
              ].map(o => {
                const on = channel === o.k;
                return (
                  <button key={o.k} className="tc-tap tc-press" onClick={() => setChannel(o.k)} style={{ flex:1, padding:'20px 12px',
                    background:on ? o.bg : '#fff', border:`2px solid ${on ? o.c : PC.line}`, borderRadius:20, cursor:'pointer',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:9, boxShadow:on ? SHADOW_SM : 'none' }}>
                    <div style={{ width:46, height:46, borderRadius:14, background:on ? '#fff' : o.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>{o.icon}</div>
                    <div style={{ fontFamily:FONT, fontWeight:800, fontSize:14, color:PC.ink }}>{o.label}</div>
                    <div style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${on ? o.c : PC.inkFaint}`,
                      background:on ? o.c : '#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {on && <Icon name="check" size={12} color="#fff" sw={3} />}
                    </div>
                  </button>
                );
              })}
            </div>

            {channel && (
              <Card className="tc-fade" pad={18} style={{ border:`1.5px solid ${PC.line}`, display:'flex', flexDirection:'column', gap:14 }}>
                {channel === 'telegram' ? (
                  <>
                    <div style={{ fontFamily:FONT, fontWeight:600, fontSize:13.5, color:PC.ink, lineHeight:1.6 }}>
                      1. Open Telegram → message <b style={{ color:'#229ED9' }}>@TutoParentBot</b><br/>2. Send <b>/start</b>, then paste your family code:
                    </div>
                    <button className="tc-press" onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }}
                      style={{ background:PC.field, border:`1.5px solid ${copied ? PC.green : PC.line}`, borderRadius:14, padding:'13px 16px',
                        display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
                      <span style={{ fontFamily:'monospace', fontSize:24, fontWeight:800, color:PC.ink, letterSpacing:3 }}>{code}</span>
                      <span style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:copied ? PC.green : PC.tealDeep }}>{copied ? '✓ Copied' : 'Copy'}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13.5, color:PC.ink }}>Enter your WhatsApp number:</div>
                    <input className="tc-input" placeholder="+90 5XX XXX XX XX" />
                  </>
                )}
                <Btn onClick={() => setStep(6)} color={channel==='telegram' ? '#229ED9' : '#25D366'}>I've connected {channel === 'telegram' ? 'Telegram' : 'WhatsApp'} ✓</Btn>
              </Card>
            )}

            <div style={{ height:1, background:PC.line }} />
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ fontFamily:FONT, fontWeight:800, fontSize:11, color:PC.inkSoft, letterSpacing:'.7px' }}>ADDITIONAL</div>
              {[['mail','Email updates',email,setEmail],['bell','Push notifications',push,setPush]].map(([ic, lbl, val, set]) => (
                <div key={lbl} style={{ display:'flex', alignItems:'center', gap:13, background:'#fff', borderRadius:16, padding:'14px 16px', border:`1.5px solid ${PC.line}` }}>
                  <Icon name={ic} size={22} color={PC.inkSoft} />
                  <span style={{ flex:1, fontFamily:FONT, fontWeight:700, fontSize:14.5, color:PC.ink }}>{lbl}</span>
                  <Toggle on={val} onClick={() => set(v => !v)} />
                </div>
              ))}
            </div>
            {!channel && <Btn variant="ghost" onClick={() => setStep(6)}>Skip for now</Btn>}
          </div>
        )}

        {/* 6 · PIN */}
        {step === 6 && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:26, paddingTop:8 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:FONT, fontWeight:800, fontSize:24, color:PC.ink, letterSpacing:'-.3px' }}>
                {pinPhase === 'enter' ? 'Create a PIN 🔐' : 'Confirm the PIN 🔁'}
              </div>
              <div style={{ fontFamily:FONT, fontWeight:600, fontSize:14, color:PC.inkSoft, marginTop:8 }}>
                {pinPhase === 'enter' ? `${N} will enter this to log in.` : 'Enter the same 4 digits again.'}
              </div>
            </div>
            {pinErr && <div style={{ background:PC.dangerBg, color:PC.danger, borderRadius:13, padding:'10px 18px', fontFamily:FONT, fontWeight:700, fontSize:13 }}>{pinErr}</div>}
            <PinPad value={pinPhase === 'enter' ? pin : pinConfirm} onChange={onPin} />
          </div>
        )}

        {/* 7 · Device */}
        {step === 7 && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <H>How will {N} use Tuto? 📱</H>
            {[
              { k:'separate', icon:'phone', title:'Separate device', desc:`I'll scan a QR code to connect ${N}'s own device` },
              { k:'same',     icon:'swap',  title:'Same device',     desc:`${N} switches to their profile from here` },
            ].map(o => {
              const on = device === o.k;
              return (
                <button key={o.k} className="tc-tap tc-press" onClick={() => { setDevice(o.k); setStep(hasRoblox ? 8 : 9); }}
                  style={{ display:'flex', alignItems:'flex-start', gap:15, padding:'20px 18px', background:on ? PC.tealBg : '#fff',
                    border:`1.5px solid ${on ? PC.teal : PC.line}`, borderRadius:20, cursor:'pointer', textAlign:'left', boxShadow:SHADOW_SM }}>
                  <div style={{ width:48, height:48, borderRadius:15, background:PC.tealBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Icon name={o.icon} size={24} color={PC.tealDeep} />
                  </div>
                  <div>
                    <div style={{ fontFamily:FONT, fontWeight:800, fontSize:16, color:PC.ink, marginBottom:3 }}>{o.title}</div>
                    <div style={{ fontFamily:FONT, fontWeight:600, fontSize:13, color:PC.inkSoft, lineHeight:1.5 }}>{o.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 8 · Roblox */}
        {step === 8 && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:20, paddingTop:6, textAlign:'center' }}>
            <div style={{ fontSize:60 }}>🎮</div>
            <div>
              <div style={{ fontFamily:FONT, fontWeight:800, fontSize:23, color:PC.ink, letterSpacing:'-.3px', lineHeight:1.25 }}>Auto-open Roblox?</div>
              <div style={{ fontFamily:FONT, fontWeight:600, fontSize:14, color:PC.inkSoft, marginTop:8, lineHeight:1.5 }}>I'll add screen time when {N} earns enough Gems.</div>
            </div>
            <Card soft pad={16} style={{ width:'100%', textAlign:'left', background:PC.tealBg, boxShadow:'none' }}>
              <div style={{ fontFamily:FONT, fontWeight:800, fontSize:13, color:PC.tealDeep, marginBottom:4 }}>How it works</div>
              <div style={{ fontFamily:FONT, fontWeight:600, fontSize:13, color:PC.tealDeep, lineHeight:1.55, opacity:.85 }}>
                When {N} spends Gems on "Roblox 30 min", Tuto launches the app and starts a countdown timer.
              </div>
            </Card>
            <div style={{ width:'100%' }}>
              <Btn variant="outline" disabled style={{ opacity:.5 }}>Yes, connect Roblox</Btn>
              <div style={{ textAlign:'center', fontFamily:FONT, fontWeight:700, fontSize:11.5, color:PC.inkFaint, marginTop:7 }}>Coming soon</div>
            </div>
            <Btn variant="ghost" onClick={() => setStep(9)}>Skip for now</Btn>
          </div>
        )}

        {/* 9 · All done */}
        {step === 9 && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', gap:22, position:'relative' }}>
            <Confetti n={16} />
            <TutoMascot size={166} color={PC.teal} expression="proud" style={{ animation:'tcFloat 3s ease-in-out infinite' }} />
            <div className="tc-up">
              <div style={{ fontFamily:FONT, fontWeight:800, fontSize:30, color:PC.ink, letterSpacing:'-.5px' }}>All set! 🎉</div>
              <div style={{ fontFamily:FONT, fontWeight:700, fontSize:16, color:PC.tealDeep, marginTop:10 }}>
                {name.trim() || 'Your child'} is ready to start earning Gems!
              </div>
            </div>
            <Btn onClick={finish} style={{ maxWidth:280, marginTop:4 }}>Let's go 🚀</Btn>
          </div>
        )}

        {/* 10 · QR */}
        {step === 10 && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:22, paddingTop:8, textAlign:'center' }}>
            <div>
              <div style={{ fontFamily:FONT, fontWeight:800, fontSize:24, color:PC.ink, letterSpacing:'-.3px' }}>Connect {N}'s device 📲</div>
              <div style={{ fontFamily:FONT, fontWeight:600, fontSize:14, color:PC.inkSoft, marginTop:8 }}>Scan this on {N}'s device to connect it.</div>
            </div>
            <QRBox code={code} />
            <Btn onClick={() => go('dashboard')} style={{ maxWidth:300 }}>Go to dashboard →</Btn>
          </div>
        )}
      </div>
    </>
  );
}

// shared faux-QR (deterministic dot grid)
function QRBox({ code, size = 200 }) {
  const cells = 21;
  const seed = (code || 'TUTO').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const dot = size / cells;
  const filled = (r, c) => {
    const corner = (r < 7 && c < 7) || (r < 7 && c >= cells-7) || (r >= cells-7 && c < 7);
    if (corner) {
      const lr = r % (cells-7), lc = c % (cells-7);
      const rr = r < 7 ? r : r-(cells-7), cc = c < 7 ? c : c-(cells-7);
      const inFrame = rr===0||rr===6||cc===0||cc===6;
      const inCore = rr>=2&&rr<=4&&cc>=2&&cc<=4;
      return inFrame || inCore;
    }
    return ((r*31 + c*17 + seed) % 5) < 2;
  };
  return (
    <div style={{ background:'#fff', borderRadius:24, padding:20, boxShadow:window.SHADOW }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {Array.from({ length:cells }).map((_, r) =>
          Array.from({ length:cells }).map((_, c) => filled(r, c) ? (
            <rect key={`${r}-${c}`} x={c*dot} y={r*dot} width={dot} height={dot} rx={dot*0.28} fill={PC.ink} />
          ) : null)
        )}
      </svg>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:14 }}>
        <span style={{ fontFamily:'monospace', fontSize:17, fontWeight:800, color:PC.tealDeep, letterSpacing:2,
          background:PC.tealBg, borderRadius:9, padding:'5px 12px' }}>{code}</span>
        <span style={{ fontFamily:FONT, fontWeight:600, fontSize:12, color:PC.inkFaint }}>manual code</span>
      </div>
    </div>
  );
}

Object.assign(window, { Onboarding, PinPad, QRBox });
