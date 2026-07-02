// ForestArchive — the fox's hidden trail through past months' & years' forests.
// Slides up over the My Tree screen when the child taps the fox.
const { useState: useArchState } = React;

// a compact forest: a row of small day-trees on a ground line
function MiniForest({ days, size = 19 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0, flexWrap: 'wrap', position: 'relative' }}>
      {days.map((f, i) => <TreeArt key={i} size={size} fruits={f} target={4} style={{ marginLeft: i ? -3 : 0 }} />)}
    </div>
  );
}

// deterministic-ish fullness pattern for a month with `n` active days
function monthDays(n, seed) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(1 + ((seed * 7 + i * 3) % 4)); // 1..4 leaves
  return out;
}

const THIS_YEAR = [
  { m: 'January',   trees: 26, seed: 2 },
  { m: 'February',  trees: 24, seed: 5 },
  { m: 'March',     trees: 29, seed: 1 },
  { m: 'April',     trees: 27, seed: 8 },
  { m: 'May',       trees: 30, seed: 3 },
  { m: 'June',      trees: 16, seed: 6, growing: true },
];
const PAST_YEARS = [
  { y: 2025, trees: 287 },
  { y: 2024, trees: 198 },
];
const YTD_TREES = 152;
const ALLTIME_TREES = YTD_TREES + PAST_YEARS.reduce((s, y) => s + y.trees, 0);

function ForestArchive({ open, onClose }) {
  const [openMonth, setOpenMonth] = useArchState('June');
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 40,
      background: 'linear-gradient(180deg,#F2F8EE 0%,#E3F1E4 100%)',
      display: 'flex', flexDirection: 'column',
      transform: open ? 'translateY(0)' : 'translateY(101%)',
      transition: 'transform .46s cubic-bezier(.3,.9,.3,1)',
    }}>
      {/* header — the fox is the keeper of every forest */}
      <div style={{ flex: '0 0 auto', padding: '14px 18px 10px', position: 'relative' }}>
        <button onClick={onClose} title="Back to today" style={{ position: 'absolute', top: 14, right: 18, width: 34, height: 34, borderRadius: 12, border: 'none', cursor: 'pointer', background: '#fff', color: 'var(--green-deep)', fontSize: 17, boxShadow: '0 2px 8px rgba(40,60,40,.12)' }}>✕</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 42 }}>
          <span style={{ fontSize: 26 }}>🦊</span>
          <span style={{ fontFamily: 'var(--fred)', fontWeight: 500, fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.3 }}>The fox keeps a track of the forest you’ve grown</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
          <span style={{ fontFamily: 'var(--fred)', fontWeight: 600, fontSize: 40, color: 'var(--green-deep)', letterSpacing: '-1px', lineHeight: 1 }}>{ALLTIME_TREES.toLocaleString()}</span>
          <span style={{ fontFamily: 'var(--fred)', fontWeight: 500, fontSize: 14, color: 'var(--ink-soft)' }}>trees grown, all time 🌳</span>
        </div>
      </div>

      <div className="scroll" style={{ padding: '4px 16px 20px' }}>
        {/* current year */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 2px 8px' }}>
          <span style={{ fontFamily: 'var(--fred)', fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>2026</span>
          <span style={{ fontWeight: 800, fontSize: 11.5, color: 'var(--green-deep)' }}>{YTD_TREES} trees so far 🌳</span>
        </div>

        {THIS_YEAR.slice().reverse().map(mo => {
          const isOpen = openMonth === mo.m;
          const days = monthDays(Math.min(mo.trees, 30), mo.seed);
          return (
            <div key={mo.m} onClick={() => setOpenMonth(isOpen ? null : mo.m)} style={{
              background: '#fff', borderRadius: 18, padding: '12px 14px', marginBottom: 9, cursor: 'pointer',
              boxShadow: mo.growing ? '0 6px 18px -6px rgba(76,182,133,.45)' : '0 3px 12px rgba(40,55,40,.07)',
              border: mo.growing ? '1.5px solid var(--green)' : '1.5px solid transparent',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--fred)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{mo.m}</span>
                {mo.growing && <span style={{ fontWeight: 800, fontSize: 9.5, color: 'var(--green-deep)', background: 'var(--green-bg)', padding: '2px 8px', borderRadius: 999 }}>GROWING NOW</span>}
                <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 12, color: 'var(--ink-soft)' }}>{mo.trees} 🌳</span>
                {/* the fox rests in whichever month is open */}
                {isOpen && <span style={{ fontSize: 18, marginLeft: 4 }}>🦊</span>}
              </div>
              {isOpen && (
                <div style={{ marginTop: 10, padding: '10px 8px 4px', background: 'linear-gradient(180deg,#F4FAF0,#E8F4E6)', borderRadius: 12, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 6, height: 8, background: 'linear-gradient(90deg,#dfe7cf,#cdeed8,#b4e4c5)', opacity: .8 }}></div>
                  <MiniForest days={days} />
                </div>
              )}
            </div>
          );
        })}

        {/* previous years — summaries */}
        <div style={{ fontFamily: 'var(--fred)', fontWeight: 600, fontSize: 13, color: 'var(--ink-soft)', padding: '12px 2px 8px' }}>Earlier years</div>
        {PAST_YEARS.map(py => (
          <div key={py.y} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,.7)', borderRadius: 16, padding: '13px 15px', marginBottom: 9 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              {[3, 4, 2, 4].map((f, i) => <TreeArt key={i} size={26} fruits={f} target={4} style={{ marginLeft: i ? -6 : 0 }} />)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--fred)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{py.y}</div>
              <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--green-deep)' }}>You grew {py.trees} trees 🌳</div>
            </div>
            <span style={{ color: 'var(--ink-soft)', fontSize: 18 }}>›</span>
          </div>
        ))}
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 11.5, color: 'var(--ink-soft)', padding: '6px 20px 0', lineHeight: 1.5 }}>
          The fox keeps every forest you’ve ever grown 🦊🌲
        </div>
      </div>
    </div>
  );
}

window.ForestArchive = ForestArchive;
