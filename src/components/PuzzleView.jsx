import { renderFigure } from '../lib/puzzleFigures'
import { renderGlyph } from '../lib/puzzleGlyphs'
import { renderIcon } from '../lib/puzzleIcons'

// How a puzzle question is laid out on screen, shared by the child's screen (PuzzleScreen) and
// the lab (/puzzle-lab). It lived in the lab until the child screen needed it; one copy means the
// lab keeps showing exactly what a child sees, which is what the lab is for. Every size here is a
// multiple of `px`, the one figure size for a card (see FIG_PX).

// One entry point for any kind of figure. A glyph is not drawn by us — see the header of
// puzzleGlyphs.js for why its artwork is shipped rather than left to the device.
const FIG = (spec, px) => ({
  __html: spec.kind === 'glyph' ? renderGlyph(spec, { px })
    : spec.kind === 'icon' ? renderIcon(spec, { px })
      : renderFigure(spec, { px, bg: '#FFFFFF' }),
})

// ONE size for every figure on a card, prompt and options alike. The prompt was drawn at 60px
// (42px for a run of six) and the options at 76px, so the only way to judge `size` was against
// the other options: in a run of triangles, "a bigger triangle" and "the same triangle" were both
// bigger than every triangle in the run, and a size distractor could not be told from the answer.
// Every question that can move `size` — sequence, analogy, grid, mirror — needs the child to
// compare a figure across that gap. 60px is the largest at which a run of six plus its blank
// still wraps four-and-three on a phone card, rather than leaving the blank alone on a line.
const FIG_PX = 60

// The lab draws on a dark panel and the child screen on a light one; only these change.
const PUZZLE_COLORS = { ok: '#3FBF7F', bad: '#E2586A', dim: '#8D83AD' }
// The child app's rounded face, the one maths and every other child screen use. Codes were set in a
// monospace, which on the child screen read as a different app.
const FRED = "'TrRound', 'Fredoka', 'Baloo 2', sans-serif"

export function Figure({ spec, px = FIG_PX, state, colors = PUZZLE_COLORS }) {
  const border = state === 'ok' ? colors.ok : state === 'bad' ? colors.bad : '#DCD9EA'
  return (
    <div
      style={{
        background: '#fff', color: '#12131A', borderRadius: 12, padding: 6,
        border: `3px solid ${border}`, lineHeight: 0, display: 'inline-block',
      }}
      dangerouslySetInnerHTML={FIG(spec, spec.form === 'net' ? Math.max(px, 132) : px)}
    />
  )
}

export function Blank({ px = FIG_PX }) {
  return (
    <div style={{
      width: px + 12, height: px + 12, borderRadius: 12, background: '#fff', color: '#9A93B8',
      border: '3px dashed #CFC9E4', display: 'grid', placeItems: 'center',
      fontSize: 30, fontWeight: 700,
    }}>?</div>
  )
}

// The one option that is not a picture. A code question offers five two-letter strings, so it
// gets a chip the same size as a figure tile — a row of letters at body size next to a row of
// drawings reads as a different kind of control rather than the same choice.
export function CodeChip({ code, state, px = FIG_PX, colors = PUZZLE_COLORS }) {
  const border = state === 'ok' ? colors.ok : state === 'bad' ? colors.bad : '#DCD9EA'
  const side = Math.round(px * 76 / 60) + 12
  return (
    <div style={{
      width: side, height: side, borderRadius: 12, background: '#fff', color: '#12131A',
      border: `3px solid ${border}`, display: 'grid', placeItems: 'center',
      fontFamily: FRED, fontWeight: 600, fontSize: Math.round(px * 28 / 60), letterSpacing: 1,
    }}>{code}</div>
  )
}

export function Prompt({ q, px = FIG_PX, colors = PUZZLE_COLORS }) {
  const C = colors
  if (q.layout === 'options-only') return null
  if (q.layout === 'code') {
    // Each figure carries its label under it, and the last one carries the question mark. The
    // labels ARE the question — without them the row is six unrelated drawings.
    //
    // In READING ORDER, so the figure being asked about is the last one, at the end of the run the
    // labels explain. At 56px a free wrap put the `?` alone at the start of a second row beside an
    // unrelated label, which reads as a different question. On a wide card that means one line. On
    // a phone one line only fitted at 33px — too small to read which way a triangle turns, which is
    // what a code question is often about — so there it is three and three: a small table the
    // child reads left to right, `?` in the last cell. Full card size either way.
    const oneLine = px >= 70
    const cellPx = px
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${oneLine ? q.prompt.length : 3}, max-content)`,
        gap: oneLine ? 4 : 8, marginBottom: 12,
      }}>
        {q.prompt.map((cell, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <Figure spec={cell} px={cellPx} colors={colors} />
            <div style={{
              fontFamily: FRED, fontWeight: 600, fontSize: Math.max(13, Math.round(cellPx * 0.3)), color: C.dim, marginTop: 3, letterSpacing: 1,
            }}>{q.promptLabels[i]}</div>
          </div>
        ))}
      </div>
    )
  }
  if (q.layout === 'overlay') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <Figure spec={q.prompt[0]} px={px} colors={colors} />
        <span style={{ color: C.dim }}>+</span>
        <Figure spec={q.prompt[1]} px={px} colors={colors} />
        <span style={{ color: C.dim }}>=</span>
        <Blank px={px} />
      </div>
    )
  }
  if (q.layout === 'grid2x2' || q.layout === 'grid3x3') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${q.layout === 'grid3x3' ? 3 : 2}, max-content)`, gap: 6, marginBottom: 12 }}>
        {q.prompt.map((cell, i) => (cell ? <Figure key={i} spec={cell} px={px} colors={colors} /> : <Blank key={i} px={px} />))}
      </div>
    )
  }
  if (q.layout === 'mirror') {
    // The dashed line is the question. Without it on screen this is a figure next to a blank
    // and nothing says which way the mirror faces, so it is drawn here rather than described.
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Figure spec={q.prompt[0]} px={px} colors={colors} />
        <div style={{ width: 0, alignSelf: 'stretch', borderLeft: `3px dashed ${C.dim}` }} />
        <Blank px={px} />
      </div>
    )
  }
  if (q.layout === 'analogy') {
    const [a, b, c] = q.prompt
    return (
      // Each pair is kept whole. On a phone the row does not fit, and wrapping it anywhere left
      // the blank alone on the next line — "C →" above, "?" below — which breaks the one thing the
      // layout has to say: C goes to the blank the way A goes to B. Now it breaks between pairs.
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Figure spec={a} px={px} colors={colors} />
          <span style={{ color: C.dim }}>→</span>
          <Figure spec={b} px={px} colors={colors} />
        </div>
        <span style={{ color: C.dim, margin: '0 6px' }}>::</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Figure spec={c} px={px} colors={colors} />
          <span style={{ color: C.dim }}>→</span>
          <Blank px={px} />
        </div>
      </div>
    )
  }
  // The bands above 7-8 show six figures in a run rather than four. Taking the wrap away clipped
  // the sixth figure at the edge of the card, which is worse than wrapping — a run with a figure
  // missing is a different question. They used to shrink to 42px instead, which broke `size`
  // (see FIG_PX); at FIG_PX the run wraps four-and-three and the blank stays with its run.
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
      {q.prompt.map((cell, i) => <Figure key={i} spec={cell} px={px} colors={colors} />)}
      {/* Every "what comes next" run ends in the blank, not just the geometric one — this
          checked the type and so icon-sequence and glyph-sequence drew a row with no question
          mark on the end of it. The stem is what the question is, so that is what it asks. */}
      {q.layout === 'row' && q.stem_key === 'puzzle_stem_next' && <Blank px={px} />}
    </div>
  )
}

