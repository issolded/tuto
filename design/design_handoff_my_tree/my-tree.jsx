// My Tree / My Part — contribution diary, one screen across three age shells + 6-8 intro.
// Mock data only. Category & moderation are backend; here colour only hints category.

const { useState, useRef } = React;

// ── shared data ──────────────────────────────────────────────────────────────
const CATS = {
  self:    { color: 'var(--c-self)',    bg: 'var(--c-self-bg)',    icon: '🛏️', label: 'I made my bed',      short: 'Made my bed' },
  house:   { color: 'var(--c-house)',   bg: 'var(--c-house-bg)',   icon: '🍽️', label: 'I set the table',     short: 'Set the table' },
  family:  { color: 'var(--c-family)',  bg: 'var(--c-family-bg)',  icon: '🤝', label: 'I helped my sibling', short: 'Helped my sibling' },
  outside: { color: 'var(--c-outside)', bg: 'var(--c-outside-bg)', icon: '🌿', label: 'I helped outside',    short: 'Helped outside' },
};
const ALL = ['self', 'house', 'family', 'outside'];

const _today = new Date();
const TODAY = _today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

// ── diary hook ───────────────────────────────────────────────────────────────
function useDiary(seedToday, microMsg) {
  const [entries, setEntries] = useState(seedToday);
  const [used, setUsed] = useState([]);
  const [micro, setMicro] = useState(false);
  const [grown, setGrown] = useState(0); // leaves grown this session
  const tRef = useRef();
  function add(catKey) {
    setEntries(e => [{ id: 'e' + Date.now(), cat: catKey, label: CATS[catKey].label, status: 'pending', fresh: true }, ...e]);
    setUsed(u => (u.includes(catKey) ? u : [...u, catKey]));
    setGrown(g => g + 1);
    setMicro(true);
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setMicro(false), 3400);
  }
  return { entries, used, micro, grown, add };
}

// ── small shared pieces ──────────────────────────────────────────────────────
function StatusBar({ color = 'var(--ink)' }) {
  return (
    <div className="statusbar" style={{ color }}>
      <span>9:41</span>
      <div className="dots"><i></i><i></i><i></i><div className="batt"></div></div>
    </div>
  );
}

function EntryRow({ cat, label, status, fresh }) {
  const C = CATS[cat];
  return (
    <div className={'entry ' + status + (fresh ? ' fresh-row' : '')}>
      <div className="dot" style={{ background: C.bg }}>{C.icon}</div>
      <div className="etxt">
        <b>{label}</b>
        <span className="state">{status === 'approved' ? '✓ Approved' : '◷ Waiting for approval'}</span>
      </div>
      <div className="check">{status === 'approved' ? '✓' : '◷'}</div>
    </div>
  );
}

function SugCard({ catKey, onAdd, gone }) {
  const C = CATS[catKey];
  return (
    <button className={'scard' + (gone ? ' gone' : '')} onClick={() => onAdd(catKey)}>
      <span className="ic" style={{ background: C.bg }}>{C.icon}</span>
      <span className="ct">{C.label}</span>
    </button>
  );
}

function Micro({ show, msg }) {
  return (
    <div className={'micro' + (show ? ' show' : '')}>
      <TutoMascot size={42} expression="proud" color="#4cb685" />
      <div className="mtx">{msg}</div>
    </div>
  );
}

// ── 1 · 6–8 first-time intro ─────────────────────────────────────────────────
function IntroSixEight() {
  return (
    <div className="screen" data-screen-label="6-8 · Intro" style={{ background: 'linear-gradient(178deg,#EAF7EE 0%,#D2EEDF 100%)' }}>
      <StatusBar color="var(--green-deep)" />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '6px 28px 30px', gap: 16 }}>
        <div className="tt-float" style={{ marginBottom: 2 }}>
          <TutoMascot size={130} expression="default" color="#4cb685" />
        </div>
        <div style={{ background: '#fff', borderRadius: 24, padding: '20px 22px', boxShadow: '0 16px 36px -14px rgba(45,80,40,.3), 0 3px 10px rgba(0,0,0,.05)', maxWidth: 282 }}>
          <div style={{ fontFamily: 'var(--fred)', fontWeight: 600, fontSize: 20, color: 'var(--ink)', marginBottom: 8 }}>Meet your tree! 🌳</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.55 }}>
            Every kind thing you do — at home or out in the world — grows a new <b style={{ color: 'var(--green-deep)' }}>leaf</b>. Do a little each day and watch your tree grow big.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800, fontSize: 12.5, color: 'var(--green-deep)', background: 'rgba(76,182,133,.14)', padding: '7px 14px', borderRadius: 999 }}>
          🌱 A new tree starts every month
        </div>
      </div>
      <div style={{ flex: '0 0 auto', padding: '0 24px 26px' }}>
        <button style={{ width: '100%', border: 'none', borderRadius: 20, padding: 16, cursor: 'pointer', background: 'var(--green)', color: '#fff', fontFamily: 'var(--fred)', fontWeight: 600, fontSize: 17, boxShadow: '0 10px 26px rgba(76,182,133,.42)' }}>
          Let's grow my tree! →
        </button>
      </div>
    </div>
  );
}

// ── 2 · 6–8 primary "My Tree" ────────────────────────────────────────────────
function BandSixEight() {
  const { entries, used, micro, grown, add } = useDiary(
    [
      { id: 's1', cat: 'family', label: 'I helped my sibling', status: 'approved' },
      { id: 's2', cat: 'self', label: 'I made my bed', status: 'pending' },
    ],
    'Nice! I’ll check this with your parent 🌱'
  );
  const tree = 1 + grown;
  const remaining = ALL.filter(k => !used.includes(k));
  return (
    <div className="screen" data-screen-label="6-8 · My Tree" style={{ background: 'linear-gradient(178deg,#EAF7EE 0%,#D7F0E2 100%)' }}>
      <StatusBar color="var(--green-deep)" />
      <div className="hd">
        <div className="ttl" style={{ fontSize: 23, color: 'var(--green-deep)' }}>My Tree <span>🌳</span></div>
        <div className="avatar" style={{ background: 'var(--green-bg)' }}>🦊</div>
      </div>
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 6 }}>
        <TreeArt size={186} fruits={tree} />
        <div style={{ marginTop: -6, fontWeight: 800, fontSize: 12.5, color: 'var(--green-deep)', background: 'rgba(76,182,133,.15)', padding: '6px 14px', borderRadius: 999 }}>
          🌱 {tree} {tree === 1 ? 'leaf' : 'leaves'} this month
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: '12px 16px 14px', display: 'flex' }}>
        <div className="paper" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="ptab"><span className="tlbl">Today</span><span className="tdate">{TODAY}</span></div>
          <div className="scroll">
            {entries.map(e => <EntryRow key={e.id} {...e} />)}
            <div className="sugwrap">
              <div className="lbl">Did you help today? Tap one 👇</div>
              <div className="sugrid">
                {ALL.map(k => <SugCard key={k} catKey={k} onAdd={add} gone={used.includes(k)} />)}
              </div>
              {remaining.length === 0 && <div style={{ textAlign: 'center', fontFamily: 'var(--fred)', fontWeight: 500, fontSize: 13, color: 'var(--paper-soft)', padding: '6px 0 2px' }}>Wonderful day! 🌟</div>}
              <div className="freebar"><span className="fic">✏️</span><span className="ftx">Did something else? Write it here</span></div>
            </div>
          </div>
        </div>
      </div>
      <Micro show={micro} msg="Nice! I’ll check this with your parent 🌱" />
    </div>
  );
}

// ── 3 · 9–11 intermediate ────────────────────────────────────────────────────
function BandNineEleven() {
  const { entries, used, micro, grown, add } = useDiary(
    [
      { id: 'n1', cat: 'house', label: 'I set the table', status: 'approved' },
      { id: 'n2', cat: 'outside', label: 'I helped outside', status: 'approved' },
      { id: 'n3', cat: 'family', label: 'I helped my sibling', status: 'pending' },
    ],
    ''
  );
  const count = 8 + grown;
  const goal = 18;
  const remaining = ALL.filter(k => !used.includes(k));
  return (
    <div className="screen" data-screen-label="9-11 · My Tree" style={{ background: 'linear-gradient(178deg,#EAF4F0 0%,#DCEDE4 100%)' }}>
      <StatusBar color="var(--green-deep)" />
      <div className="hd">
        <div className="ttl" style={{ fontSize: 20, color: 'var(--green-deep)' }}>My Tree <span>🌳</span></div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 12, color: '#d07b2e', background: 'rgba(232,154,57,.16)', padding: '6px 12px', borderRadius: 999 }}>🔥 5-day streak</div>
      </div>
      {/* progress strip — tree at half weight */}
      <div style={{ flex: '0 0 auto', margin: '0 16px 4px', padding: '12px 14px', background: 'rgba(255,255,255,.66)', border: '1.5px solid rgba(255,255,255,.9)', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 6px 18px rgba(40,70,55,.08)' }}>
        <TreeArt size={92} fruits={count} target={goal} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--fred)', fontWeight: 600, fontSize: 15, color: 'var(--ink)', marginBottom: 9 }}>{count} leaves grown</div>
          <div style={{ height: 9, borderRadius: 999, background: 'rgba(55,160,111,.18)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: Math.min(100, (count / goal) * 100) + '%', borderRadius: 999, background: 'linear-gradient(90deg,#6BBF59,#4cb685)', transition: 'width .5s ease' }}></div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: '10px 16px 14px', display: 'flex' }}>
        <div className="paper" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="ptab"><span className="tlbl">Today</span><span className="tdate">{TODAY}</span></div>
          <div className="scroll">
            {entries.map(e => <EntryRow key={e.id} {...e} />)}
            <div className="sugwrap">
              <div className="lbl">Add to today</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {remaining.map(k => (
                  <button key={k} className="scard" style={{ width: '100%' }} onClick={() => add(k)}>
                    <span className="ic" style={{ background: CATS[k].bg }}>{CATS[k].icon}</span>
                    <span className="ct" style={{ flex: 1 }}>{CATS[k].label}</span>
                    <span style={{ color: 'var(--green-deep)', fontSize: 17, fontWeight: 600 }}>+</span>
                  </button>
                ))}
                {remaining.length === 0 && <div style={{ textAlign: 'center', fontFamily: 'var(--fred)', fontWeight: 500, fontSize: 13, color: 'var(--paper-soft)', padding: '4px 0' }}>All caught up — nice work! 🌟</div>}
              </div>
              <div className="freebar" style={{ borderStyle: 'solid', background: '#FFFDF7' }}><span className="fic">✏️</span><span className="ftx" style={{ color: '#7a6a4c' }}>Did something else? Write your own…</span></div>
            </div>
          </div>
        </div>
      </div>
      <Micro show={micro} msg="Logged it! Your parent will confirm soon 🌱" />
    </div>
  );
}

// ── mature list row for 12–15 ────────────────────────────────────────────────
function MatureRow({ cat, label, status, fresh }) {
  const C = CATS[cat];
  return (
    <div className={fresh ? 'fresh-row' : ''} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 2px', borderBottom: '1px solid var(--line2)' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: C.color, flex: '0 0 auto' }}></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--fred)', fontWeight: 500, fontSize: 14.5, color: 'var(--slate)' }}>{label}</div>
        <div style={{ fontWeight: 800, fontSize: 11, color: 'var(--slate-soft)', marginTop: 1 }}>{status === 'approved' ? 'Approved' : 'Sent for approval'}</div>
      </div>
      <span style={{ fontWeight: 800, fontSize: 10.5, padding: '4px 9px', borderRadius: 999, ...(status === 'approved' ? { background: '#E2F0E9', color: 'var(--moss)' } : { background: '#FBEFD8', color: '#b9892f' }) }}>
        {status === 'approved' ? 'Approved' : 'Pending'}
      </span>
    </div>
  );
}

// ── 4 · 12–15 "My Part" ──────────────────────────────────────────────────────
function BandTwelveFifteen() {
  const { entries, used, micro, grown, add } = useDiary(
    [
      { id: 't1', cat: 'outside', label: 'Helped a neighbour carry shopping', status: 'pending' },
      { id: 't2', cat: 'self', label: 'Made my bed', status: 'approved' },
    ],
    ''
  );
  const count = 7 + grown;
  const remaining = ALL.filter(k => !used.includes(k));
  const yesterday = [
    { id: 'y1', cat: 'house', label: 'Did the washing-up', status: 'approved' },
    { id: 'y2', cat: 'family', label: 'Walked my sister to school', status: 'approved' },
  ];
  return (
    <div className="screen" data-screen-label="12-15 · My Part" style={{ background: 'linear-gradient(180deg,#F5F7F4 0%,#EAEFEA 100%)' }}>
      <StatusBar color="var(--slate)" />
      <div className="hd" style={{ padding: '12px 22px 10px' }}>
        <div className="ttl" style={{ fontSize: 22, color: 'var(--slate)' }}>My Part <span>💪</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sprig size={26} color="var(--moss)" />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--fred)', fontWeight: 600, fontSize: 16, color: 'var(--moss)', lineHeight: 1 }}>{count}</div>
            <div style={{ fontWeight: 800, fontSize: 9, letterSpacing: '.1em', color: 'var(--slate-soft)', textTransform: 'uppercase', marginTop: 1 }}>this month</div>
          </div>
        </div>
      </div>
      <div className="scroll" style={{ padding: '4px 22px 16px' }}>
        {/* prominent free-text capture */}
        <div style={{ display: 'flex', gap: 9, padding: '4px 0 12px' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, background: '#fff', border: '1.5px solid var(--line2)', borderRadius: 14, padding: '13px 14px' }}>
            <span style={{ fontSize: 15 }}>✏️</span>
            <span style={{ fontFamily: 'var(--fred)', fontWeight: 500, fontSize: 13.5, color: 'var(--slate-soft)' }}>What did you do to help?</span>
          </div>
          <button style={{ width: 48, height: 48, borderRadius: 14, border: 'none', background: 'var(--moss)', color: '#fff', fontSize: 20, cursor: 'pointer', flex: '0 0 auto', boxShadow: '0 8px 18px rgba(47,143,107,.34)' }}>↑</button>
        </div>
        {/* quiet quick-add chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingBottom: 18 }}>
          <span style={{ fontWeight: 800, fontSize: 11, color: 'var(--slate-soft)' }}>Quick add</span>
          {remaining.map(k => (
            <button key={k} onClick={() => add(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1.5px solid var(--line2)', borderRadius: 999, padding: '7px 12px', cursor: 'pointer', fontFamily: 'var(--fred)', fontWeight: 500, fontSize: 12.5, color: 'var(--slate)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: CATS[k].color }}></span>{CATS[k].short}
            </button>
          ))}
          {remaining.length === 0 && <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--slate-soft)' }}>— all added today</span>}
        </div>
        {/* the contribution list — centre of the screen */}
        <div style={{ fontWeight: 800, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--slate-soft)', paddingBottom: 4 }}>Today · {TODAY.split(', ')[1]}</div>
        {entries.map(e => <MatureRow key={e.id} {...e} />)}
        <div style={{ fontWeight: 800, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--slate-soft)', padding: '18px 0 4px' }}>Yesterday</div>
        {yesterday.map(e => <MatureRow key={e.id} {...e} />)}
      </div>
      <Micro show={micro} msg="Logged — your parent will confirm it." />
    </div>
  );
}

// ── frame wrapper + rail ─────────────────────────────────────────────────────
function Frame({ num, txt, children, notes }) {
  return (
    <div className="frame">
      <div className="cap"><span className="num">{num}</span><span className="txt">{txt}</span></div>
      <div className="phone">
        <StatusBarSpacer />
        {children}
      </div>
      {notes && (
        <div className="legend">
          {notes.map((n, i) => <div className="n" key={i}><i style={{ background: n.c }}></i>{n.t}</div>)}
        </div>
      )}
    </div>
  );
}
// the screens render their own status bar, so this is a no-op placeholder kept for clarity
function StatusBarSpacer() { return null; }

function MyTreeHandoff() {
  return (
    <React.Fragment>
      <style>{`
        @keyframes tt-pop { 0%{transform:scale(.7);opacity:0} 60%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
        .fresh-row{ animation:tt-pop .42s cubic-bezier(.2,.9,.3,1.2) both; }
        @keyframes tt-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @media (prefers-reduced-motion: no-preference){ .tt-float{ animation:tt-float 4.5s ease-in-out infinite; } }
      `}</style>
      <div className="rail">
        <Frame num="6–8" txt="First-time intro" notes={[{ c: 'var(--green)', t: 'Tuto explains the tree before the diary opens.' }]}>
          <IntroSixEight />
        </Frame>
        <Frame num="6–8" txt="My Tree · primary" notes={[
          { c: 'var(--leaf)', t: 'Big tree dominates — every tap grows a leaf instantly.' },
          { c: 'var(--c-self)', t: 'Cards lead; free-text is small & secondary.' },
          { c: '#b9892f', t: 'Pending vs. approved shown on the page.' },
        ]}>
          <BandSixEight />
        </Frame>
        <Frame num="9–11" txt="Intermediate" notes={[
          { c: 'var(--leaf)', t: 'Tree at half weight; streak & progress appear.' },
          { c: 'var(--green-deep)', t: 'Diary list grows and takes more room.' },
        ]}>
          <BandNineEleven />
        </Frame>
        <Frame num="12–15" txt="My Part" notes={[
          { c: 'var(--moss)', t: 'Tree is a small corner indicator — never cartoonish.' },
          { c: 'var(--slate)', t: 'List is the centre; free-text is prominent.' },
        ]}>
          <BandTwelveFifteen />
        </Frame>
      </div>
    </React.Fragment>
  );
}

window.MyTreeHandoff = MyTreeHandoff;
