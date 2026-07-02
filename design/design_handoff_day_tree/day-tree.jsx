// Day Tree concept — one tree per day (sprout → full → ornaments), past days form a forest.
const { useState, useRef } = React;

const DT_CATS = {
  self:    { color: 'var(--c-self)',    bg: 'var(--c-self-bg)',    icon: '🛏️', label: 'I made my bed' },
  house:   { color: 'var(--c-house)',   bg: 'var(--c-house-bg)',   icon: '🍽️', label: 'I set the table' },
  family:  { color: 'var(--c-family)',  bg: 'var(--c-family-bg)',  icon: '🤝', label: 'I helped my sibling' },
  outside: { color: 'var(--c-outside)', bg: 'var(--c-outside-bg)', icon: '🌿', label: 'I helped outside' },
};
const DT_ALL = ['self', 'house', 'family', 'outside'];
const DAY_FULL = 4; // a day's tree is "full" at 4 contributions; beyond that → ornaments

const DT_TODAY = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

// past days this month (fullness 0..1 → leaves) for the forest strip
const PAST = [4, 3, 4, 2, 4, 4, 3, 4, 1, 4, 3, 4, 4, 2, 4, 3];
// date for each past tree, counting back from yesterday (oldest first → matches PAST order)
function pastDate(i) {
  const d = new Date();
  d.setDate(d.getDate() - (PAST.length - i)); // i=last → yesterday
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function DayTreeConcept() {
  const [count, setCount] = useState(2); // contributions logged today
  const [entries, setEntries] = useState([
    { id: 'd1', cat: 'family', label: 'I helped my sibling', fresh: false },
    { id: 'd2', cat: 'self', label: 'I made my bed', fresh: false },
  ]);
  const [micro, setMicro] = useState(false);
  const tRef = useRef();
  const idRef = useRef(0);
  const [help, setHelp] = useState(false);
  const [pick, setPick] = useState(null); // tapped forest day index
  const [archive, setArchive] = useState(false); // fox → past-months forests

  const leaves = Math.min(count, DAY_FULL);
  const extras = Math.max(0, count - DAY_FULL);
  const full = count >= DAY_FULL;

  function add(catKey) {
    setCount(c => c + 1);
    setEntries(e => [{ id: 'd' + (++idRef.current), cat: catKey, label: DT_CATS[catKey].label, fresh: true }, ...e]);
    const msg = count + 1 > DAY_FULL ? 'Your tree is full — here\u2019s a little extra! 🦋' : 'Nice! I\u2019ll check this with your parent 🌱';
    setMicro(msg);
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setMicro(false), 3200);
  }

  const stageLabel = count <= 1 ? 'Sprout' : !full ? 'Growing…' : extras === 0 ? 'Full tree 🎉' : `Full + ${extras} extra`;

  return (
    <React.Fragment>
      <div className="rail">
        <div className="frame">
          <div className="cap"><span className="num">Today</span><span className="txt">Today's tree grows past full</span></div>
          <div className="phone">
            <div className="screen" style={{ background: 'linear-gradient(178deg,#EAF7EE 0%,#D7F0E2 100%)' }}>
              <div className="statusbar" style={{ color: 'var(--green-deep)' }}>
                <span>9:41</span>
                <div className="dots"><i></i><i></i><i></i><div className="batt"></div></div>
              </div>
              <div className="hd" style={{ paddingBottom: 2 }}>
                <div>
                  <div className="ttl" style={{ fontSize: 22, color: 'var(--green-deep)' }}>My Tree <span>🌳</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, position: 'relative' }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>Helping grows your tree 🌱</span>
                    <button onClick={() => setHelp(h => !h)} title="What's my tree?" style={{ width: 17, height: 17, borderRadius: '50%', border: 'none', flex: '0 0 auto', background: help ? 'var(--green)' : 'rgba(55,160,111,.16)', color: help ? '#fff' : 'var(--green-deep)', fontFamily: 'var(--fred)', fontWeight: 600, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>?</button>
                    {help && (
                      <div style={{ position: 'absolute', top: 26, left: 0, right: -30, zIndex: 30, background: '#fff', borderRadius: 14, padding: '12px 14px', boxShadow: '0 14px 32px -10px rgba(45,80,40,.34), 0 3px 10px rgba(0,0,0,.06)' }}>
                        <div style={{ position: 'absolute', top: -6, left: 92, width: 12, height: 12, background: '#fff', transform: 'rotate(45deg)' }}></div>
                        <div style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>Every kind thing you do grows a <b style={{ color: 'var(--green-deep)' }}>leaf</b>. Fill today's tree, then watch your <b style={{ color: 'var(--green-deep)' }}>forest</b> grow all month 🌳</div>
                        <button onClick={() => setHelp(false)} style={{ marginTop: 9, border: 'none', background: 'var(--green-bg)', color: 'var(--green-deep)', fontFamily: 'var(--fred)', fontWeight: 600, fontSize: 12, padding: '5px 12px', borderRadius: 999, cursor: 'pointer' }}>Got it!</button>
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => setArchive(true)} title="My Forests" style={{ border: 'none', cursor: 'pointer', background: 'transparent', padding: 0, position: 'relative' }}>
                  <div className="avatar" style={{ background: 'var(--green-bg)' }}>🦊</div>
                </button>
              </div>

              <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <TreeArt size={188} fruits={leaves} target={DAY_FULL} extras={extras} />
                <div style={{ marginTop: -8, display: 'flex', gap: 7, alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--green-deep)', background: 'rgba(76,182,133,.15)', padding: '6px 13px', borderRadius: 999 }}>🌱 Today · {stageLabel}</span>
                </div>
              </div>

              {/* month forest strip — past days persist here */}
              <div style={{ flex: '0 0 auto', margin: '10px 14px 0', padding: '8px 4px 4px', background: 'rgba(255,255,255,.55)', borderRadius: 16, position: 'relative' }}>
                <div style={{ fontWeight: 800, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', padding: '0 10px 2px' }}>This month's forest</div>
                {pick !== null && (() => {
                  const isToday = pick === 'today';
                  const lv = isToday ? Math.max(1, leaves) + extras : PAST[pick];
                  const dt = isToday ? 'Today' : pastDate(pick);
                  return (
                    <div style={{ position: 'absolute', top: 2, right: 10, zIndex: 25, background: '#fff', borderRadius: 12, padding: '7px 12px', boxShadow: '0 10px 24px -8px rgba(45,80,40,.34), 0 2px 8px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 600, fontSize: 14, color: 'var(--paper-ink)' }}>{dt}</span>
                      <span style={{ fontWeight: 800, fontSize: 11.5, color: 'var(--green-deep)', background: 'var(--green-bg)', padding: '3px 9px', borderRadius: 999 }}>🍃 {lv} {lv === 1 ? 'leaf' : 'leaves'}</span>
                    </div>
                  );
                })()}
                <div className="forest">
                  {PAST.map((f, i) => (
                    <div className="fday" key={i} onClick={() => setPick(p => p === i ? null : i)} style={{ cursor: 'pointer', outline: pick === i ? '2px solid var(--green)' : 'none', outlineOffset: 1, borderRadius: 8 }}>
                      <TreeArt size={34} fruits={f} target={DAY_FULL} />
                    </div>
                  ))}
                  <div className="fday today" onClick={() => setPick(p => p === 'today' ? null : 'today')} style={{ cursor: 'pointer', outline: pick === 'today' ? '2px solid var(--green)' : 'none', outlineOffset: 1, borderRadius: 8 }}>
                    <TreeArt size={40} fruits={Math.max(1, leaves)} target={DAY_FULL} extras={extras} />
                    <span className="dnum">today</span>
                  </div>
                </div>
              </div>

              {/* diary page */}
              <div style={{ flex: 1, minHeight: 0, padding: '10px 14px 12px', display: 'flex' }}>
                <div className="paper" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div className="ptab"><span className="tlbl">Today</span><span className="tdate">{DT_TODAY}</span></div>
                  <div className="scroll">
                    {entries.map(e => (
                      <div key={e.id} className={'sugwrap' + (e.fresh ? ' fresh-row' : '')} style={{ padding: '9px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px dashed var(--rule-soft)' }}>
                        <span style={{ width: 28, height: 28, borderRadius: 8, background: DT_CATS[e.cat].bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flex: '0 0 auto' }}>{DT_CATS[e.cat].icon}</span>
                        <b style={{ flex: 1, fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 600, fontSize: 15, color: 'var(--paper-ink)' }}>{e.label}</b>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'repeating-conic-gradient(#e8c98a 0 12deg, #f2dcae 12deg 24deg)', color: '#9a7327', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flex: '0 0 auto' }}>◷</span>
                      </div>
                    ))}
                    <div className="sugwrap">
                      <div className="lbl">Did you help? Tap one — your tree keeps growing 👇</div>
                      <div className="sugrid">
                        {DT_ALL.map(k => (
                          <button key={k} className="scard" onClick={() => add(k)}>
                            <span className="ic" style={{ background: DT_CATS[k].bg }}>{DT_CATS[k].icon}</span>
                            <span className="ct">{DT_CATS[k].label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={'micro' + (micro ? ' show' : '')}>
                <TutoMascot size={40} expression="proud" color="#4cb685" />
                <div className="mtx">{micro || ''}</div>
              </div>

              <ForestArchive open={archive} onClose={() => setArchive(false)} />
            </div>
          </div>
          <div className="legend">
            <div className="n"><i style={{ background: 'var(--leaf)' }}></i>Sprout → full tree in the first {DAY_FULL} contributions.</div>
            <div className="n"><i style={{ background: '#e0524d' }}></i>Past full: fruit → blossom → 🦋, one per extra. No ceiling.</div>
            <div className="n"><i style={{ background: 'var(--green-deep)' }}></i>Each finished day joins the month forest — nothing lost.</div>
            <div className="n"><i style={{ background: '#e89a39' }}></i>Tap the 🦊 top-right — it wanders your past months &amp; years of forests.</div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

window.DayTreeConcept = DayTreeConcept;
