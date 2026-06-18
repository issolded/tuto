// ── Child detail, task settings, and modals ─────────────────────────────────
const { PC, FONT, SHADOW, SHADOW_SM, Btn, Card, Field, Toggle, Icon, TaskIcon, Pill, Avatar, BottomSheet, BarChart, Ring, Confetti } = window;

const TLABEL = { reading:'My Books', math:'My Math', writing:'My Stories', chore:'My House' };

function PhotoStub() {
  return (
    <div style={{ width:'100%', height:130, borderRadius:13, overflow:'hidden', position:'relative',
      background:`repeating-linear-gradient(135deg, ${PC.field} 0 11px, #EAEDF0 11px 22px)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <span style={{ fontFamily:'monospace', fontSize:11, fontWeight:700, color:PC.inkFaint, background:'rgba(255,255,255,.7)', borderRadius:6, padding:'4px 10px' }}>homework photo</span>
    </div>
  );
}

function SubmissionCard({ sub, onApprove, onReject }) {
  return (
    <Card soft pad={15} style={{ display:'flex', flexDirection:'column', gap:11 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
        <div style={{ width:42, height:42, borderRadius:13, background:PC[sub.type+'Bg'], display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <TaskIcon type={sub.type} size={22} />
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:FONT, fontWeight:800, fontSize:14.5, color:PC.ink }}>{TLABEL[sub.type]}</div>
          {sub.desc && <div style={{ fontFamily:FONT, fontWeight:600, fontSize:13, color:PC.inkSoft, marginTop:1 }}>{sub.desc}</div>}
          <div style={{ fontFamily:FONT, fontWeight:600, fontSize:11.5, color:PC.inkFaint, marginTop:2 }}>{sub.time}</div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontFamily:FONT, fontWeight:800, fontSize:15, color:PC.amber }}>+{sub.gems} ⭐</div>
          {sub.ai && <div style={{ fontFamily:FONT, fontWeight:700, fontSize:10, color:PC.inkFaint, marginTop:1 }}>🤖 AI suggested</div>}
        </div>
      </div>
      {sub.hasPhoto && <PhotoStub />}
      {sub.note && (
        <div style={{ background:PC.tealBg, borderRadius:12, padding:'10px 13px', fontFamily:FONT, fontWeight:600, fontSize:13, color:PC.tealDeep, lineHeight:1.45 }}>💬 {sub.note}</div>
      )}
      <div style={{ display:'flex', gap:9 }}>
        <Btn onClick={onApprove} color={PC.green} style={{ padding:'12px' }}><Icon name="check" size={17} color="#fff" sw={2.6} /> Approve</Btn>
        <Btn variant="danger" onClick={onReject} style={{ padding:'12px' }}><Icon name="close" size={16} color={PC.danger} sw={2.4} /> Reject</Btn>
      </div>
    </Card>
  );
}

function SectionHead({ children, action }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'2px 2px 11px' }}>
      <div style={{ fontFamily:FONT, fontWeight:800, fontSize:16.5, color:PC.ink, whiteSpace:'nowrap' }}>{children}</div>
      {action}
    </div>
  );
}
function EmptyCard({ text }) {
  return <Card soft pad={16} style={{ textAlign:'center', fontFamily:FONT, fontWeight:600, fontSize:13, color:PC.inkSoft }}>{text}</Card>;
}

function ChildDetail({ child, go, store, openSettings, back }) {
  const [, force] = React.useReducer(x => x + 1, 0);
  const [modal, setModal] = React.useState(null); // 'edit' | 'pin' | 'reward' | 'remove'
  const [justApproved, setJustApproved] = React.useState(false);

  const approve = (sub) => {
    store.approve(child.id, sub.id);
    setJustApproved(true); setTimeout(() => setJustApproved(false), 2200);
    force();
  };
  const reject = (sub) => { store.reject(child.id, sub.id); force(); };

  return (
    <>
      {justApproved && <Confetti n={12} />}
      <window.TopBar title={child.name} sub={`${child.age} years old`} onBack={back} />
      <div className="tc-scroll" style={{ flex:1, padding:'2px 20px 30px', display:'flex', flexDirection:'column', gap:22 }}>

        {/* profile + weekly chart (reference-inspired) */}
        <Card pad={18}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <Avatar child={child} size={56} />
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:PC.ink }}>{child.name}</div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:4 }}>
                <Pill bg={PC.amberBg} color={PC.amber} style={{ fontSize:13 }}>⭐ {child.gems} Gems</Pill>
              </div>
            </div>
            <div style={{ width:40, height:40, borderRadius:12, background:PC.field, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Icon name="refresh" size={19} color={PC.inkSoft} />
            </div>
          </div>
          <div style={{ height:1, background:PC.line, margin:'16px 0 4px' }} />
          <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12.5, color:PC.inkSoft, margin:'6px 0 10px' }}>Gems earned this week</div>
          <BarChart data={child.week} />
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:14 }}>
            <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:PC.ink }}>Weekly goal</div>
            <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:PC.inkSoft }}>{Math.min(child.gems, child.weeklyGoal)} / {child.weeklyGoal}</div>
          </div>
          <div style={{ height:8, background:PC.field, borderRadius:8, overflow:'hidden', marginTop:8 }}>
            <div style={{ height:'100%', width:`${Math.min(100, child.gems/child.weeklyGoal*100)}%`, background:PC.peach, borderRadius:8, transition:'width .6s' }} />
          </div>
        </Card>

        {/* pending approvals */}
        <div>
          <SectionHead>⏳ Pending approvals{child.pending.length > 0 ? ` (${child.pending.length})` : ''}</SectionHead>
          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            {child.pending.length === 0
              ? <EmptyCard text="All caught up — nothing to review! ✅" />
              : child.pending.map(s => <SubmissionCard key={s.id} sub={s} onApprove={() => approve(s)} onReject={() => reject(s)} />)}
          </div>
        </div>

        {/* completed today */}
        <div>
          <SectionHead>✅ Completed today</SectionHead>
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {child.todayDone.length === 0
              ? <EmptyCard text="Nothing completed yet today." />
              : child.todayDone.map(s => (
                <Card key={s.id} soft pad={13} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:38, height:38, borderRadius:11, background:PC[s.type+'Bg'], display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <TaskIcon type={s.type} size={20} />
                  </div>
                  <div style={{ flex:1, fontFamily:FONT, fontWeight:800, fontSize:14, color:PC.ink }}>{TLABEL[s.type]}</div>
                  <div style={{ fontFamily:FONT, fontWeight:800, fontSize:14, color:PC.green }}>+{s.gems} ⭐</div>
                </Card>
              ))}
          </div>
        </div>

        {/* reward goals */}
        <div>
          <SectionHead action={<button className="tc-press tc-tap" onClick={() => setModal('reward')} style={{ display:'flex', alignItems:'center', gap:5, background:PC.tealBg, color:PC.tealDeep, border:'none', borderRadius:10, padding:'7px 12px', fontFamily:FONT, fontWeight:700, fontSize:12.5, cursor:'pointer' }}><Icon name="plus" size={15} color={PC.tealDeep} sw={2.4} /> Add goal</button>}>🏆 Reward goals</SectionHead>
          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            {child.rewards.length === 0
              ? <EmptyCard text="No reward goals set yet." />
              : child.rewards.map(r => {
                const pct = Math.min(100, Math.round(child.gems / r.cost * 100));
                const ready = child.gems >= r.cost;
                return (
                  <Card key={r.id} soft pad={15} style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:11 }}>
                      <span style={{ fontSize:24 }}>{r.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:FONT, fontWeight:800, fontSize:14.5, color:PC.ink }}>{r.name}</div>
                        <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:PC.amber, marginTop:1 }}>⭐ {r.cost} gems</div>
                      </div>
                      {ready
                        ? <Pill bg={PC.greenBg} color={PC.green}>Ready 🎉</Pill>
                        : <button className="tc-tap" onClick={() => { store.removeReward(child.id, r.id); force(); }} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}><Icon name="trash" size={18} color={PC.inkFaint} /></button>}
                    </div>
                    <div style={{ height:8, background:PC.field, borderRadius:8, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:ready ? PC.green : PC.peach, borderRadius:8, transition:'width .6s' }} />
                    </div>
                    <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12, color:ready ? PC.green : PC.inkSoft }}>
                      {ready ? 'Ready to claim! 🎉' : `${Math.max(0, r.cost - child.gems)} more gems to go`}
                    </div>
                  </Card>
                );
              })}
          </div>
        </div>

        {/* settings group */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[
            { icon:'gear', label:'Task settings', sub:'Adjust gems per task', onClick:openSettings },
            { icon:'edit', label:'Edit child', sub:'Name, age or avatar', onClick:() => setModal('edit') },
            { icon:'lock', label:'Change PIN', sub:'Set a new 4-digit PIN', onClick:() => setModal('pin') },
          ].map(o => (
            <Card key={o.label} onClick={o.onClick} soft pad={15} style={{ display:'flex', alignItems:'center', gap:13 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:PC.field, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Icon name={o.icon} size={20} color={PC.inkSoft} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:FONT, fontWeight:800, fontSize:14.5, color:PC.ink }}>{o.label}</div>
                <div style={{ fontFamily:FONT, fontWeight:600, fontSize:12, color:PC.inkSoft, marginTop:1 }}>{o.sub}</div>
              </div>
              <Icon name="chevron" size={19} color={PC.inkFaint} />
            </Card>
          ))}
          <button className="tc-press tc-tap" onClick={() => setModal('remove')} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#fff', border:`1.5px solid ${PC.dangerBg}`, borderRadius:16, padding:'14px', cursor:'pointer', marginTop:2 }}>
            <Icon name="trash" size={17} color={PC.danger} /><span style={{ fontFamily:FONT, fontWeight:800, fontSize:14, color:PC.danger }}>Remove child</span>
          </button>
        </div>
      </div>

      {modal === 'edit' && <EditChildSheet child={child} onClose={() => setModal(null)} onSave={(p) => { store.updateChild(child.id, p); setModal(null); force(); }} />}
      {modal === 'pin' && <ChangePinSheet onClose={() => setModal(null)} />}
      {modal === 'reward' && <AddRewardSheet onClose={() => setModal(null)} onSave={(r) => { store.addReward(child.id, r); setModal(null); force(); }} />}
      {modal === 'remove' && <RemoveSheet child={child} onClose={() => setModal(null)} onConfirm={() => { store.removeChild(child.id); back(); }} />}
    </>
  );
}

// ── Edit child ──────────────────────────────────────────────────────────────
function EditChildSheet({ child, onClose, onSave }) {
  const [name, setName] = React.useState(child.name);
  const [age, setAge] = React.useState(child.age);
  const [avatar, setAvatar] = React.useState(child.avatar);
  const opts = ['👧','👦','🧒','📷'];
  const ab = a => ({ width:62, height:62, borderRadius:'50%', border:`2.5px solid ${avatar===a ? PC.teal : PC.line}`,
    background:avatar===a ? PC.tealBg : PC.field, fontSize:27, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' });
  return (
    <BottomSheet onClose={onClose}>
      <div style={{ fontFamily:FONT, fontWeight:800, fontSize:21, color:PC.ink }}>Edit child ✏️</div>
      <div style={{ display:'flex', justifyContent:'center', gap:13 }}>
        {opts.map(a => <button key={a} className="tc-press" style={ab(a)} onClick={() => setAvatar(a)}>{a === '📷' ? <Icon name="camera" size={24} color={PC.inkSoft} /> : a}</button>)}
      </div>
      <Field label="Name"><input className="tc-input" value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="Age">
        <div style={{ display:'flex', alignItems:'center', background:'#fff', border:`1.5px solid ${PC.line}`, borderRadius:15, padding:'8px 14px', gap:12 }}>
          <button className="tc-press" onClick={() => setAge(a => Math.max(1,a-1))} style={{ width:42, height:42, borderRadius:13, background:PC.tealBg, border:'none', color:PC.tealDeep, fontSize:22, fontWeight:700, cursor:'pointer' }}>−</button>
          <div style={{ flex:1, textAlign:'center', fontFamily:FONT, fontWeight:800, fontSize:28, color:PC.ink }}>{age}</div>
          <button className="tc-press" onClick={() => setAge(a => Math.min(18,a+1))} style={{ width:42, height:42, borderRadius:13, background:PC.tealBg, border:'none', color:PC.tealDeep, fontSize:22, fontWeight:700, cursor:'pointer' }}>+</button>
        </div>
      </Field>
      <Btn onClick={() => onSave({ name: name.trim() || child.name, age, avatar: avatar === '📷' ? child.avatar : avatar })}>Save changes</Btn>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
    </BottomSheet>
  );
}

// ── Change PIN ──────────────────────────────────────────────────────────────
function ChangePinSheet({ onClose }) {
  const [phase, setPhase] = React.useState('enter');
  const [pin, setPin] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [err, setErr] = React.useState('');
  const [done, setDone] = React.useState(false);
  const onPin = (val) => {
    if (phase === 'enter') { setPin(val); if (val.length === 4) setTimeout(() => setPhase('confirm'), 250); }
    else { setConfirm(val); if (val.length === 4) {
      if (val === pin) { setDone(true); setTimeout(onClose, 1300); }
      else { setErr("PINs don't match. Try again."); setTimeout(() => { setPin(''); setConfirm(''); setPhase('enter'); setErr(''); }, 900); }
    }}
  };
  return (
    <BottomSheet onClose={onClose}>
      {done ? (
        <div style={{ textAlign:'center', padding:'18px 0', display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
          <div style={{ width:54, height:54, borderRadius:'50%', background:PC.greenBg, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name="check" size={28} color={PC.green} sw={2.6} /></div>
          <div style={{ fontFamily:FONT, fontWeight:800, fontSize:19, color:PC.green }}>PIN updated!</div>
        </div>
      ) : (
        <>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:FONT, fontWeight:800, fontSize:20, color:PC.ink }}>{phase === 'enter' ? 'Enter new PIN 🔐' : 'Confirm PIN 🔁'}</div>
            <div style={{ fontFamily:FONT, fontWeight:600, fontSize:13, color:PC.inkSoft, marginTop:5 }}>{phase === 'enter' ? 'Choose a 4-digit PIN' : 'Enter the same PIN again'}</div>
          </div>
          {err && <div style={{ background:PC.dangerBg, color:PC.danger, borderRadius:12, padding:'9px 16px', textAlign:'center', fontFamily:FONT, fontWeight:700, fontSize:13 }}>{err}</div>}
          <window.PinPad value={phase === 'enter' ? pin : confirm} onChange={onPin} />
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </>
      )}
    </BottomSheet>
  );
}

// ── Add reward goal ──────────────────────────────────────────────────────────
const REWARD_EMOJIS = ['🎮','🍦','🎬','🧸','📱','🎁','🏖️','🎨','🚲','⚽','🎤','📚','🍕','🎡','🛹'];
function AddRewardSheet({ onClose, onSave }) {
  const [icon, setIcon] = React.useState('🎁');
  const [name, setName] = React.useState('');
  const [cost, setCost] = React.useState(50);
  const [err, setErr] = React.useState('');
  const pct = ((cost - 5) / (200 - 5)) * 100;
  return (
    <BottomSheet onClose={onClose}>
      <div style={{ fontFamily:FONT, fontWeight:800, fontSize:21, color:PC.ink }}>Add a goal 🏆</div>
      <Field label="Icon">
        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          {REWARD_EMOJIS.map(e => (
            <button key={e} className="tc-press" onClick={() => setIcon(e)} style={{ width:44, height:44, borderRadius:13, border:`2px solid ${icon===e ? PC.teal : PC.line}`, background:icon===e ? PC.tealBg : '#fff', fontSize:22, cursor:'pointer' }}>{e}</button>
          ))}
        </div>
      </Field>
      <Field label="Goal name"><input className="tc-input" value={name} onChange={e => { setName(e.target.value); setErr(''); }} placeholder="e.g. Roblox time, ice cream…" /></Field>
      <Field label={`Gem cost — ⭐ ${cost} gems`}>
        <input type="range" min={5} max={200} step={5} value={cost} onChange={e => setCost(+e.target.value)} className="tc-slider" style={{ background:`linear-gradient(to right, ${PC.teal} ${pct}%, ${PC.line} ${pct}%)` }} />
      </Field>
      {err && <div style={{ fontFamily:FONT, fontWeight:700, fontSize:13, color:PC.danger }}>{err}</div>}
      <Btn onClick={() => name.trim() ? onSave({ icon, name: name.trim(), cost }) : setErr('Give this goal a name.')}>Add goal</Btn>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
    </BottomSheet>
  );
}

// ── Remove child ──────────────────────────────────────────────────────────────
function RemoveSheet({ child, onClose, onConfirm }) {
  return (
    <BottomSheet onClose={onClose}>
      <div style={{ textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:9 }}>
        <div style={{ width:56, height:56, borderRadius:'50%', background:PC.dangerBg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>⚠️</div>
        <div style={{ fontFamily:FONT, fontWeight:800, fontSize:20, color:PC.ink }}>Remove {child.name}?</div>
        <div style={{ fontFamily:FONT, fontWeight:600, fontSize:13, color:PC.inkSoft, lineHeight:1.6 }}>This permanently deletes {child.name}'s profile, gems and activity. This can't be undone.</div>
      </div>
      <Btn color={PC.danger} onClick={onConfirm}>Yes, remove {child.name}</Btn>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
    </BottomSheet>
  );
}

// ── Task settings screen ──────────────────────────────────────────────────────
const TS_TASKS = [
  { key:'reading', label:'My Books' }, { key:'math', label:'My Math' },
  { key:'writing', label:'My Stories' }, { key:'chore', label:'My House' },
];
function TaskSettings({ child, store, back }) {
  const [, force] = React.useReducer(x => x + 1, 0);
  const [saving, setSaving] = React.useState(false);
  const ping = () => { setSaving(true); setTimeout(() => setSaving(false), 700); };
  const s = child.settings;
  return (
    <>
      <window.TopBar title="Task settings" sub={child.name} onBack={back}
        right={saving ? <span style={{ fontFamily:FONT, fontWeight:700, fontSize:12.5, color:PC.tealDeep }}>Saving…</span> : null} />
      <div className="tc-scroll" style={{ flex:1, padding:'2px 20px 30px', display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ fontFamily:FONT, fontWeight:600, fontSize:13.5, color:PC.inkSoft, padding:'0 2px 4px' }}>Toggle tasks on or off and set the Gems earned per session.</div>
        {TS_TASKS.map(({ key, label }) => {
          const t = s[key]; const pct = ((t.gems - 5) / (100 - 5)) * 100;
          return (
            <Card key={key} pad={16} style={{ display:'flex', flexDirection:'column', gap:12, opacity:t.active ? 1 : .6, transition:'opacity .2s' }}>
              <div style={{ display:'flex', alignItems:'center', gap:13 }}>
                <div style={{ width:46, height:46, borderRadius:14, background:PC[key+'Bg'], display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <TaskIcon type={key} size={24} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:FONT, fontWeight:800, fontSize:15.5, color:PC.ink }}>{label}</div>
                  <div style={{ fontFamily:FONT, fontWeight:700, fontSize:12.5, color:t.active ? PC[key] : PC.inkFaint, marginTop:1 }}>{t.active ? `+${t.gems} gems / session` : 'Disabled'}</div>
                </div>
                <Toggle on={t.active} onClick={() => { t.active = !t.active; ping(); force(); }} />
              </div>
              {t.active && (
                <input type="range" min={5} max={100} step={5} value={t.gems} onChange={e => { t.gems = +e.target.value; ping(); force(); }}
                  className="tc-slider" style={{ background:`linear-gradient(to right, ${PC.teal} ${pct}%, ${PC.line} ${pct}%)` }} />
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}

Object.assign(window, { ChildDetail, TaskSettings });
