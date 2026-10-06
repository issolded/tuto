// The pictures the English help draws (data from src/lib/englishHelp.js, visualFor): the alphabet strip, the key table of a
// code, two words set one over the other with the changed letter lit, a word ladder and a logic grid. Plain markup, no
// images, sized by a `scale` so a tablet can read it from arm's length. "?" is where the answer goes while the
// question is open.
const FRED = "'TrRound', 'Fredoka', 'Baloo 2', sans-serif"
const INK = '#241f3a'
const SOFT = '#8d83ad'
const ROSE = '#D9577A'
const GREEN = '#4cb685'
const BLUE = '#5a9be6'
const ORANGE = '#f79433'
const LINE = '#e6e1f1'

const box = (extra = {}) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8,
  fontFamily: FRED, fontWeight: 700, color: INK, border: `2px solid ${LINE}`, background: '#fff', ...extra,
})
const Q = ({ size }) => <span style={{ ...box({ width: size, height: size, borderStyle: 'dashed', borderColor: ROSE, color: ROSE, fontSize: size * 0.55 }) }}>?</span>
const A_Z = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
const TONE = { pick: ROSE, from: BLUE, to: GREEN, ask: ORANGE, ans: GREEN }

function Strip({ marks, scale }) {
  const w = 22 * scale, h = 26 * scale
  const row = (letters) => (
    <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
      {letters.map(ch => {
        const m = marks[ch], c = TONE[m]
        return (
          <span key={ch} style={box({
            width: w, height: h, fontSize: 13 * scale, borderRadius: 6, padding: 0,
            border: `2px solid ${c || LINE}`, background: c ? `${c}22` : '#fff', color: c || SOFT, transform: c ? 'translateY(-2px)' : 'none',
          })}>{ch}</span>
        )
      })}
    </div>
  )
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{row(A_Z.slice(0, 13))}{row(A_Z.slice(13))}</div>
}

const shiftText = (n) => (n > 0 ? `+${n}` : String(n))

function Alphabet({ v, scale, lang }) {
  const word = (en, tr, es) => ({ tr, es }[lang] ?? en)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      <Strip marks={v.marks} scale={scale} />
      {v.note === 'first-letters' && (
        <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 14 * scale, color: SOFT, textAlign: 'center' }}>
          {word('The first letters of the words. Read them left to right along the alphabet.', 'Kelimelerin ilk harfleri. Alfabede soldan sağa okuyunca sıra çıkar.', 'Las primeras letras de las palabras. Léelas de izquierda a derecha por el alfabeto.')}
        </div>
      )}
      {(v.rows?.length > 0 || v.question?.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          {v.rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FRED, fontWeight: 700, fontSize: 18 * scale, color: INK }}>
              <span style={box({ width: 30 * scale, height: 30 * scale, borderColor: BLUE, background: `${BLUE}22` })}>{r.from}</span>
              <span style={{ color: SOFT, fontSize: 14 * scale }}>→ {shiftText(r.shift)}</span>
              <span style={box({ width: 30 * scale, height: 30 * scale, borderColor: GREEN, background: `${GREEN}22` })}>{r.to}</span>
            </div>
          ))}
          {v.question.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FRED, fontWeight: 700, fontSize: 18 * scale, color: INK }}>
              <span style={box({ width: 30 * scale, height: 30 * scale, borderColor: ORANGE, background: `${ORANGE}22` })}>{r.from}</span>
              <span style={{ color: SOFT, fontSize: 14 * scale }}>→ {r.shift == null ? '?' : shiftText(r.shift)}</span>
              {r.to ? <span style={box({ width: 30 * scale, height: 30 * scale, borderColor: GREEN, background: `${GREEN}22` })}>{r.to}</span> : <Q size={30 * scale} />}
            </div>
          ))}
        </div>
      )}
      {v.numbers && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FRED, fontWeight: 700, fontSize: 18 * scale, color: INK }}>
          <span>{v.numbers.from}</span><span style={{ color: SOFT }}>→</span><span>{v.numbers.to}</span>
          <span style={{ color: SOFT, margin: '0 6px' }}>·</span>
          <span>{v.numbers.ask}</span><span style={{ color: SOFT }}>→</span>{v.numbers.ans ? <span>{v.numbers.ans}</span> : <Q size={28 * scale} />}
        </div>
      )}
    </div>
  )
}

function KeyTable({ v, scale, lang }) {
  const s = 34 * scale
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {v.pairs.map(([k, n], i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={box({ width: s, height: s, fontSize: 17 * scale, borderColor: BLUE, background: `${BLUE}1f` })}>{k}</span>
            <span style={box({ width: s, height: s, fontSize: 17 * scale })}>{n}</span>
          </div>
        ))}
      </div>
      {v.line && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {v.line.map((c, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={box({ width: s, height: s, fontSize: 17 * scale, borderColor: ORANGE, background: `${ORANGE}1f` })}>{c.top}</span>
              <span style={{ color: SOFT, fontSize: 12 * scale, lineHeight: 1 }}>↓</span>
              {c.bottom != null ? <span style={box({ width: s, height: s, fontSize: 17 * scale, borderColor: GREEN, background: `${GREEN}22` })}>{c.bottom}</span> : <Q size={s} />}
            </div>
          ))}
        </div>
      )}
      {v.expr && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FRED, fontWeight: 700, fontSize: 22 * scale, color: INK }}>
          <span style={{ color: SOFT, fontSize: 16 * scale }}>{v.expr.named}</span>
          <span style={{ color: SOFT }}>=</span>
          <span>{v.expr.left}</span>
          <span style={{ color: SOFT }}>=</span>
          {v.expr.right != null ? <span style={{ color: GREEN }}>{v.expr.right}</span> : <Q size={32 * scale} />}
        </div>
      )}
    </div>
  )
}

// Two words, one over the other, the letter that changed lit; then the new word with a gap where the change goes.
function Diff({ v, scale }) {
  const s = 30 * scale
  const wordRow = (word, lit, key) => (
    <div key={key} style={{ display: 'flex', gap: 3 }}>
      {[...word].map((ch, i) => <span key={i} style={box({ width: s, height: s, fontSize: 17 * scale, ...(lit.has(i) ? { borderColor: ROSE, background: `${ROSE}22`, color: ROSE } : {}) })}>{ch}</span>)}
    </div>
  )
  const diffIdx = (a, b) => new Set(a.length === b.length ? [...a].map((c, i) => (c !== b[i] ? i : -1)).filter(i => i >= 0) : [])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      {v.rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {wordRow(r.from, diffIdx(r.from, r.to), 'a')}
          <span style={{ color: SOFT, fontFamily: FRED, fontWeight: 700 }}>→</span>
          {wordRow(r.to, diffIdx(r.from, r.to), 'b')}
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {wordRow(v.word, new Set(v.change.type === 'sub' && v.change.at != null ? [v.change.at] : []), 'c')}
        <span style={{ color: SOFT, fontFamily: FRED, fontWeight: 700 }}>→</span>
        {v.answer
          ? wordRow(v.answer, new Set(v.change.type === 'sub' && v.change.at != null ? [v.change.at] : []), 'd')
          : v.change.type === 'sub' && v.change.at != null
            ? <div style={{ display: 'flex', gap: 3 }}>{[...v.word].map((ch, i) => (i === v.change.at ? <Q key={i} size={s} /> : <span key={i} style={box({ width: s, height: s, fontSize: 17 * scale })}>{ch}</span>))}</div>
            : <Q size={s} />}
      </div>
    </div>
  )
}

function Ladder({ v, scale, lang }) {
  const s = 32 * scale
  const lit = (a, b) => new Set([...a].map((c, i) => (c !== b[i] ? i : -1)).filter(i => i >= 0))
  const row = (word, hi) => (
    <div style={{ display: 'flex', gap: 3 }}>
      {[...word].map((ch, i) => <span key={i} style={box({ width: s, height: s, fontSize: 18 * scale, ...(hi.has(i) ? { borderColor: ROSE, background: `${ROSE}22`, color: ROSE } : {}) })}>{ch}</span>)}
    </div>
  )
  const arrow = <div style={{ color: SOFT, fontFamily: FRED, fontWeight: 700, fontSize: 14 * scale, lineHeight: 1 }}>↓ {({ tr: '1 harf', es: '1 letra' }[lang] ?? '1 letter')}</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
      {row(v.from, v.middle ? lit(v.from, v.middle) : (v.from.length === v.to.length ? lit(v.from, v.to) : new Set()))}
      {arrow}
      {v.middle ? row(v.middle, new Set([...lit(v.from, v.middle), ...lit(v.middle, v.to)])) : (
        <div style={{ display: 'flex', gap: 3 }}>{[...v.from].map((_, i) => <Q key={i} size={s} />)}</div>
      )}
      {arrow}
      {row(v.to, v.middle ? lit(v.middle, v.to) : (v.from.length === v.to.length ? lit(v.from, v.to) : new Set()))}
    </div>
  )
}

function Grid({ v, scale, lang }) {
  const w = 74 * scale, h = 36 * scale
  const hit = (r, c) => v.pick.includes(r) && v.pick.includes(c)
  return (
    <div style={{ display: 'inline-block' }}>
      <div style={{ display: 'flex', gap: 3, marginLeft: w + 3 }}>
        {v.cols.map(c => <div key={c} style={{ width: w, textAlign: 'center', fontFamily: FRED, fontWeight: 700, fontSize: 13 * scale, color: SOFT }}>{c}</div>)}
      </div>
      {v.rows.map((r, ri) => (
        <div key={r} style={{ display: 'flex', gap: 3, marginTop: 3, alignItems: 'center' }}>
          <div style={{ width: w, fontFamily: FRED, fontWeight: 700, fontSize: 13 * scale, color: SOFT, textAlign: 'right', paddingRight: 4 }}>{r}</div>
          {v.cols.map((c, ci) => (
            <span key={c} style={box({ width: w, height: h, fontSize: 14 * scale, ...(hit(r, c) ? { borderColor: GREEN, background: `${GREEN}22` } : {}) })}>{v.cells[ri][ci]}</span>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function EnglishHelpVisual({ visual, scale = 1, lang = 'en' }) {
  if (!visual) return null
  const body = visual.kind === 'alphabet' ? <Alphabet v={visual} scale={scale} lang={lang} />
    : visual.kind === 'keytable' ? <KeyTable v={visual} scale={scale} lang={lang} />
      : visual.kind === 'diff' ? <Diff v={visual} scale={scale} />
        : visual.kind === 'ladder' ? <Ladder v={visual} scale={scale} lang={lang} />
          : visual.kind === 'grid' ? <Grid v={visual} scale={scale} lang={lang} />
            : null
  if (!body) return null
  return <div style={{ background: '#fff', borderRadius: 16, padding: '14px 12px', display: 'flex', justifyContent: 'center', maxWidth: '100%', overflowX: 'auto' }}>{body}</div>
}
