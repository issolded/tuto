// ── Parent dashboard ────────────────────────────────────────────────────────
const { PC, FONT, SHADOW, SHADOW_SM, Btn, Card, Field, Toggle, Icon, Pill, Avatar, BottomSheet, QRBox } = window;

function ChildRow({ child, onClick }) {
  const pct = child.weeklyGoal ? Math.min(100, Math.round(child.gems / child.weeklyGoal * 100)) : 0;
  return (
    <Card onClick={onClick} pad={16} style={{ display:'flex', alignItems:'center', gap:14 }}>
      <Avatar child={child} size={54} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:FONT, fontWeight:800, fontSize:17, color:PC.ink }}>{child.name}</div>
        <div style={{ fontFamily:FONT, fontWeight:600, fontSize:13, color:PC.inkSoft, marginTop:1 }}>{child.age} years old</div>
        <div style={{ display:'flex', gap:7, marginTop:8 }}>
          <Pill bg={PC.amberBg} color={PC.amber}>⭐ {child.gems}</Pill>
          {child.pending.length > 0 && <Pill bg={PC.peachBg} color={PC.peachDeep}>{child.pending.length} to review</Pill>}
        </div>
      </div>
      <Icon name="chevron" size={20} color={PC.inkFaint} />
    </Card>
  );
}

function AddChildSheet({ onClose, onSave, store }) {
  const [name, setName] = React.useState('');
  const [age, setAge] = React.useState(8);
  const [avatar, setAvatar] = React.useState('👧');
  const [pin, setPin] = React.useState('');
  const [err, setErr] = React.useState('');
  const opts = ['👧', '👦', '📷'];
  const save = () => {
    if (!name.trim()) return setErr('Name is required.');
    if (!/^\d{4}$/.test(pin)) return setErr('PIN must be 4 digits.');
    onSave({ name: name.trim(), age, avatar: avatar === '📷' ? '🧒' : avatar, gems: 0, fresh: true });
  };
  const ab = a => ({ width:70, height:70, borderRadius:'50%', border:`2.5px solid ${avatar===a ? PC.teal : PC.line}`,
    background:avatar===a ? PC.tealBg : PC.field, fontSize:30, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' });
  return (
    <BottomSheet onClose={onClose}>
      <div style={{ fontFamily:FONT, fontWeight:800, fontSize:21, color:PC.ink }}>Add a child 🧒</div>
      <div style={{ display:'flex', justifyContent:'center', gap:16 }}>
        {opts.map(a => <button key={a} className="tc-press" style={ab(a)} onClick={() => setAvatar(a)}>{a === '📷' ? <Icon name="camera" size={26} color={PC.inkSoft} /> : a}</button>)}
      </div>
      <Field label="Child's name"><input className="tc-input" value={name} onChange={e => { setName(e.target.value); setErr(''); }} placeholder="e.g. Emma" /></Field>
      <Field label="Age">
        <div style={{ display:'flex', alignItems:'center', background:'#fff', border:`1.5px solid ${PC.line}`, borderRadius:15, padding:'8px 14px', gap:12 }}>
          <button className="tc-press" onClick={() => setAge(a => Math.max(1, a-1))} style={{ width:42, height:42, borderRadius:13, background:PC.tealBg, border:'none', color:PC.tealDeep, fontSize:22, fontWeight:700, cursor:'pointer' }}>−</button>
          <div style={{ flex:1, textAlign:'center', fontFamily:FONT, fontWeight:800, fontSize:28, color:PC.ink }}>{age}</div>
          <button className="tc-press" onClick={() => setAge(a => Math.min(18, a+1))} style={{ width:42, height:42, borderRadius:13, background:PC.tealBg, border:'none', color:PC.tealDeep, fontSize:22, fontWeight:700, cursor:'pointer' }}>+</button>
        </div>
      </Field>
      <Field label="4-digit PIN">
        <input className="tc-input" type="password" inputMode="numeric" maxLength={4} value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g,'').slice(0,4)); setErr(''); }} placeholder="••••" style={{ letterSpacing:6 }} />
      </Field>
      {err && <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:PC.danger }}>{err}</div>}
      <Btn onClick={save}>Save</Btn>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
    </BottomSheet>
  );
}

function NotifRow({ icon, label, status, connected, action }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:13 }}>
      <div style={{ width:40, height:40, borderRadius:12, background:PC.field, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{icon}</div>
      <div style={{ flex:1 }}>
        <div style={{ fontFamily:FONT, fontWeight:800, fontSize:14.5, color:PC.ink }}>{label}</div>
        <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:connected ? PC.green : PC.inkFaint, marginTop:2 }}>{status}</div>
      </div>
      {action}
    </div>
  );
}

function Dashboard({ go, store, openChild }) {
  const [showAdd, setShowAdd] = React.useState(false);
  const [showQR, setShowQR] = React.useState(false);
  const [tgOpen, setTgOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [, force] = React.useReducer(x => x + 1, 0);
  const children = store.children;
  const code = store.parent.family_code;

  return (
    <>
      <div className="tc-scroll" style={{ flex:1, padding:'8px 22px 28px' }}>
        {/* greeting */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'4px 2px 0' }}>
          <div>
            <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13.5, color:PC.inkSoft }}>Welcome back 👋</div>
            <div style={{ fontFamily:FONT, fontWeight:800, fontSize:26, color:PC.ink, letterSpacing:'-.5px', marginTop:2 }}>{store.parent.name}</div>
          </div>
          <button className="tc-press tc-tap" onClick={() => go('opening')} aria-label="Sign out" style={{ width:46, height:46, borderRadius:15, background:'#fff', border:`1.5px solid ${PC.line}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:SHADOW_SM }}>
            <Icon name="logout" size={21} color={PC.inkSoft} />
          </button>
        </div>

        {/* summary strip */}
        <Card pad={16} style={{ marginTop:18, display:'flex', alignItems:'center', gap:14, background:`linear-gradient(120deg, ${PC.teal}, ${PC.tealDeep})`, boxShadow:'0 16px 32px -14px rgba(63,183,172,.6)' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:'rgba(255,255,255,.85)' }}>Pending approvals</div>
            <div style={{ fontFamily:FONT, fontWeight:800, fontSize:30, color:'#fff', lineHeight:1.1, marginTop:2 }}>{store.totalPending()} tasks</div>
            <div style={{ fontFamily:FONT, fontWeight:600, fontSize:12.5, color:'rgba(255,255,255,.85)', marginTop:3 }}>across {children.length} {children.length===1?'child':'children'}</div>
          </div>
          <div style={{ width:62, height:62, borderRadius:20, background:'rgba(255,255,255,.18)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Icon name="clock" size={30} color="#fff" />
          </div>
        </Card>

        {/* children */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'24px 2px 12px' }}>
          <div style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:PC.ink }}>My children</div>
          <button className="tc-press tc-tap" onClick={() => setShowAdd(true)} style={{ display:'flex', alignItems:'center', gap:5, background:PC.tealBg, color:PC.tealDeep, border:'none', borderRadius:11, padding:'8px 13px', fontFamily:FONT, fontWeight:700, fontSize:13, cursor:'pointer' }}>
            <Icon name="plus" size={16} color={PC.tealDeep} sw={2.4} /> Add
          </button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
          {children.map(c => <ChildRow key={c.id} child={c} onClick={() => openChild(c.id)} />)}
        </div>

        {/* device setup */}
        <div style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:PC.ink, margin:'26px 2px 12px' }}>Set up a device</div>
        <Card pad={18}>
          <div style={{ display:'flex', alignItems:'center', gap:13 }}>
            <div style={{ width:44, height:44, borderRadius:14, background:PC.tealBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Icon name="qr" size={23} color={PC.tealDeep} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:FONT, fontWeight:800, fontSize:15, color:PC.ink }}>Child device</div>
              <div style={{ fontFamily:FONT, fontWeight:600, fontSize:12.5, color:PC.inkSoft, marginTop:1 }}>Scan a QR code to connect it</div>
            </div>
            <Btn full={false} variant={showQR ? 'soft' : 'outline'} onClick={() => setShowQR(v => !v)} style={{ padding:'10px 16px', fontSize:14 }}>{showQR ? 'Hide' : 'Show QR'}</Btn>
          </div>
          {showQR && (
            <div className="tc-fade" style={{ display:'flex', flexDirection:'column', alignItems:'center', marginTop:16 }}>
              <QRBox code={code} size={186} />
            </div>
          )}
        </Card>

        {/* notifications */}
        <div style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:PC.ink, margin:'26px 2px 12px' }}>Notifications</div>
        <Card pad={18} style={{ display:'flex', flexDirection:'column', gap:18 }}>
          <NotifRow icon="✈️" label="Telegram" connected={store.parent.telegram}
            status={store.parent.telegram ? 'Connected' : 'Not connected'}
            action={store.parent.telegram
              ? <Pill>★ Primary</Pill>
              : <Btn full={false} variant="soft" onClick={() => setTgOpen(v => !v)} style={{ padding:'8px 13px', fontSize:13 }}>{tgOpen ? 'Cancel' : 'Connect'}</Btn>} />
          {tgOpen && !store.parent.telegram && (
            <div className="tc-fade" style={{ background:PC.field, borderRadius:15, padding:16, display:'flex', flexDirection:'column', gap:12, marginTop:-6 }}>
              <div style={{ fontFamily:FONT, fontWeight:600, fontSize:13, color:PC.ink, lineHeight:1.6 }}>
                Message <b style={{ color:'#229ED9' }}>@TutoParentBot</b>, send <b>/start</b>, then paste your code:
              </div>
              <button className="tc-press" onClick={() => { store.parent.telegram = true; setTgOpen(false); force(); }}
                style={{ background:'#fff', border:`1.5px solid ${PC.line}`, borderRadius:13, padding:'12px 15px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
                <span style={{ fontFamily:'monospace', fontSize:20, fontWeight:800, color:PC.ink, letterSpacing:3 }}>{code}</span>
                <span style={{ fontFamily:FONT, fontWeight:700, fontSize:12.5, color:PC.tealDeep }}>I've connected ✓</span>
              </button>
            </div>
          )}
          <div style={{ height:1, background:PC.line }} />
          <NotifRow icon="💬" label="WhatsApp" connected={store.parent.whatsapp}
            status={store.parent.whatsapp ? store.parent.whatsapp : 'Not connected'}
            action={store.parent.whatsapp
              ? <Pill bg={PC.greenBg} color={PC.green}>★ Primary</Pill>
              : <Btn full={false} variant="soft" onClick={() => { store.parent.whatsapp = '+90 5•• ••• 42 18'; force(); }} style={{ padding:'8px 13px', fontSize:13 }}>Add number</Btn>} />
        </Card>
      </div>

      {showAdd && <AddChildSheet store={store} onClose={() => setShowAdd(false)} onSave={(c) => { const id = store.addChild(c); setShowAdd(false); openChild(id); }} />}
    </>
  );
}

Object.assign(window, { Dashboard });
