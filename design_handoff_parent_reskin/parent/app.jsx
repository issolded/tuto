// ── Parent app — mock store + router ────────────────────────────────────────
const { PC, Phone, Opening, Login, Signup, Onboarding, Dashboard, ChildDetail, TaskSettings } = window;

const defSettings = () => ({
  reading:{ active:true, gems:30 }, math:{ active:true, gems:30 },
  writing:{ active:true, gems:30 }, chore:{ active:true, gems:10 },
});
const week = (...v) => ['M','T','W','T','F','S','S'].map((l, i) => ({ l, v: v[i] ?? 0 }));
let _id = 100;
const uid = () => `x${++_id}`;

function makeStore(force) {
  const store = {
    parent: { name: 'Defne Kaya', family_code: 'X7K2M9P4', telegram: false, whatsapp: null },
    children: [
      {
        id:'c1', name:'Zeynep', age:8, avatar:'👧', gems:240, weeklyGoal:300,
        week: week(20, 40, 30, 60, 50, 40, 0),
        pending: [
          { id:'s1', type:'reading', desc:'"The Sleepy Dragon" — 4/5 correct', gems:30, time:'Today, 4:12 PM', hasPhoto:true, note:'I read 3 chapters today!' },
          { id:'s2', type:'chore', desc:'Tidied her room', gems:15, ai:true, time:'Today, 5:40 PM', hasPhoto:true },
        ],
        todayDone: [{ id:'d1', type:'math', gems:30 }],
        rewards: [
          { id:'r1', icon:'🎮', name:'Roblox 30 min', cost:30 },
          { id:'r2', icon:'📺', name:'TV 1 hour', cost:60 },
          { id:'r3', icon:'🧸', name:'New Lego set', cost:500 },
        ],
        settings: defSettings(),
      },
      {
        id:'c2', name:'Emir', age:6, avatar:'👦', gems:90, weeklyGoal:200,
        week: week(10, 20, 0, 30, 20, 10, 0),
        pending: [
          { id:'s3', type:'writing', desc:'A story about a robot friend', gems:30, time:'Today, 3:05 PM', hasPhoto:true, note:'My robot is called Beep!' },
        ],
        todayDone: [],
        rewards: [
          { id:'r4', icon:'🍦', name:'Ice cream trip', cost:40 },
          { id:'r5', icon:'🚲', name:'New bike', cost:800 },
        ],
        settings: { ...defSettings(), chore:{ active:false, gems:10 } },
      },
    ],
    getChild(id) { return store.children.find(c => c.id === id); },
    totalPending() { return store.children.reduce((n, c) => n + c.pending.length, 0); },
    addChild(p) {
      const id = uid();
      store.children.push({ id, gems:0, weeklyGoal:200, week: week(0,0,0,0,0,0,0),
        pending:[], todayDone:[], rewards:[], settings: defSettings(), ...p });
      return id;
    },
    updateChild(id, p) { Object.assign(store.getChild(id), p); },
    removeChild(id) { store.children = store.children.filter(c => c.id !== id); },
    approve(cid, sid) {
      const c = store.getChild(cid); const i = c.pending.findIndex(s => s.id === sid);
      if (i < 0) return; const sub = c.pending[i];
      c.pending.splice(i, 1); c.todayDone.unshift({ id: sub.id, type: sub.type, gems: sub.gems }); c.gems += sub.gems;
    },
    reject(cid, sid) { const c = store.getChild(cid); c.pending = c.pending.filter(s => s.id !== sid); },
    addReward(cid, r) { store.getChild(cid).rewards.push({ id: uid(), ...r }); },
    removeReward(cid, rid) { const c = store.getChild(cid); c.rewards = c.rewards.filter(r => r.id !== rid); },
  };
  return store;
}

function ParentApp() {
  const storeRef = React.useRef(null);
  const [, force] = React.useReducer(x => x + 1, 0);
  if (!storeRef.current) storeRef.current = makeStore(force);
  const store = storeRef.current;

  const [route, setRoute] = React.useState({ name:'opening', childId:null });
  const go = (name, childId = null) => setRoute({ name, childId });

  let screen;
  if (route.name === 'opening')   screen = <Opening go={go} />;
  else if (route.name === 'login')    screen = <Login go={go} />;
  else if (route.name === 'signup')   screen = <Signup go={go} />;
  else if (route.name === 'onboarding') screen = <Onboarding go={go} store={store} />;
  else if (route.name === 'dashboard')  screen = <Dashboard go={go} store={store} openChild={(id) => go('child', id)} />;
  else if (route.name === 'child') {
    const child = store.getChild(route.childId);
    screen = child ? <ChildDetail child={child} go={go} store={store}
      openSettings={() => go('settings', child.id)} back={() => go('dashboard')} /> : <Dashboard go={go} store={store} openChild={(id) => go('child', id)} />;
  }
  else if (route.name === 'settings') {
    const child = store.getChild(route.childId);
    screen = child ? <TaskSettings child={child} store={store} back={() => go('child', child.id)} /> : null;
  }

  return <Phone key={route.name + (route.childId||'')} bg={PC.bg}>{screen}</Phone>;
}

// ── scale-to-fit stage ────────────────────────────────────────────────────
function Stage() {
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 44) / 872, (window.innerWidth - 28) / 402));
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'0', overflow:'hidden' }}>
      <div style={{ transform:`scale(${scale})`, transformOrigin:'center center' }}>
        <ParentApp />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Stage />);
