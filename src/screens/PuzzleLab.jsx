import { useEffect, useMemo, useState } from 'react'
// Pins both pictorial fonts, served by us. Without them the figures fall back to the device's
// own set and the answer key stops describing what the child is looking at — which is why the
// generator withholds those questions entirely until they have loaded.
import '../styles/puzzleFonts.css'
import { childLang, t } from '../lib/i18n'
import {
  BANDS, BAND_KEYS, TYPES, GLYPH_TYPES, ICON_TYPES,
  generateQuestion, generateSession, validateQuestion,
} from '../lib/puzzleTemplates'
import { renderFigure, makeSpec, SHAPES, FILLS, HALVES, STRETCHES, INNER_NODES } from '../lib/puzzleFigures'
import {
  renderGlyph, ALL_GLYPHS, makeGlyphSpec, GLYPH_GROUPS, GLYPH_RELATIONS, fontReady, ensureEmojiFont,
} from '../lib/puzzleGlyphs'
import {
  renderIcon, ALL_ICONS, makeIconSpec, ICON_GROUPS, ICON_FILLS, iconFontReady, ensureIconFont,
} from '../lib/puzzleIcons'

// Isolated pilot for the non-verbal reasoning engine (src/lib/puzzleFigures.js +
// src/lib/puzzleTemplates.js). Not linked from any menu, not wired to gems, levels or the
// server — the same position MathLab holds at /math-lab, and for the same reason: the only
// way to know whether a generated figure is any good is to look at a lot of them at once.
//
// Three things this screen exists to answer, in the order they matter:
//
//   1. Do the questions LOOK like the ones in the book? (the grid)
//   2. Is every question sound — four different pictures, exactly one defensible answer?
//      (the audit, which runs the same validateQuestion the child path would)
//   3. Is the drawing vocabulary really as small as claimed? (the vocabulary sheet — the
//      safety argument made visible: this is everything the module can ever draw)
//
// Figures are drawn dark-on-white here deliberately. The child screen can be themed later;
// the paper the questions are modelled on is white, and judging a figure against anything
// else at this stage means judging two things at once.

// One entry point for either kind of figure. A glyph is not drawn by us — see the header of
// puzzleGlyphs.js for why the emoji font has to be pinned, and the <link> below for where.
const FIG = (spec, px) => ({
  __html: spec.kind === 'glyph' ? renderGlyph(spec, { px })
    : spec.kind === 'icon' ? renderIcon(spec, { px })
      : renderFigure(spec, { px, bg: '#FFFFFF' }),
})

// a–d at 5-6, a–e above it — the count comes from the band, so the label list has to reach.
const LETTERS = 'abcde'

const C = {
  bg: '#0F1320', panel: '#181D2E', line: '#2A3149', text: '#EDEBF6',
  dim: '#8D83AD', ok: '#3FBF7F', bad: '#E2586A', accent: '#7C6BF5',
}

function Figure({ spec, px = 76, state }) {
  const border = state === 'ok' ? C.ok : state === 'bad' ? C.bad : '#DCD9EA'
  return (
    <div
      style={{
        background: '#fff', color: '#12131A', borderRadius: 12, padding: 6,
        border: `3px solid ${border}`, lineHeight: 0, display: 'inline-block',
      }}
      dangerouslySetInnerHTML={FIG(spec, px)}
    />
  )
}

// A rule's value is usually a scalar and sometimes an `inner` node, and template interpolation
// turns every node into "[object Object]" — so the debug line read `rule: inner → [object
// Object]` on exactly the attribute whose nesting once hid a real bug. Nodes are named by their
// shape and fill, which is what distinguishes them in INNER_NODES.
function ruleValue(v) {
  if (v === null) return 'none'
  if (typeof v !== 'object') return String(v)
  return `${v.fill === 'none' ? '' : v.fill + ' '}${v.shape}${v.inner ? ' + inner' : ''}`
}

function Blank({ px = 76 }) {
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
function CodeChip({ code, state }) {
  const border = state === 'ok' ? C.ok : state === 'bad' ? C.bad : '#DCD9EA'
  return (
    <div style={{
      width: 76 + 12, height: 76 + 12, borderRadius: 12, background: '#fff', color: '#12131A',
      border: `3px solid ${border}`, display: 'grid', placeItems: 'center',
      font: '700 26px ui-monospace, monospace', letterSpacing: 1,
    }}>{code}</div>
  )
}

function Prompt({ q }) {
  if (q.layout === 'options-only') return null
  if (q.layout === 'code') {
    // Each figure carries its label under it, and the last one carries the question mark. The
    // labels ARE the question — without them the row is six unrelated drawings.
    return (
      {/* Six across, so the figure being asked about stays at the end of the run the labels
          explain. At 56px they wrapped and the `?` began a second row beside an unrelated
          label, which reads as a different question. */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {q.prompt.map((cell, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <Figure spec={cell} px={40} />
            <div style={{
              font: '700 13px ui-monospace, monospace', color: C.dim, marginTop: 3, letterSpacing: 1,
            }}>{q.promptLabels[i]}</div>
          </div>
        ))}
      </div>
    )
  }
  if (q.layout === 'grid2x2') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, max-content)', gap: 6, marginBottom: 12 }}>
        {q.prompt.map((cell, i) => (cell ? <Figure key={i} spec={cell} px={60} /> : <Blank key={i} px={60} />))}
      </div>
    )
  }
  if (q.layout === 'mirror') {
    // The dashed line is the question. Without it on screen this is a figure next to a blank
    // and nothing says which way the mirror faces, so it is drawn here rather than described.
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Figure spec={q.prompt[0]} px={60} />
        <div style={{ width: 0, alignSelf: 'stretch', borderLeft: `3px dashed ${C.dim}` }} />
        <Blank px={60} />
      </div>
    )
  }
  if (q.layout === 'analogy') {
    const [a, b, c] = q.prompt
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <Figure spec={a} px={60} />
        <span style={{ color: C.dim }}>→</span>
        <Figure spec={b} px={60} />
        <span style={{ color: C.dim, margin: '0 6px' }}>::</span>
        <Figure spec={c} px={60} />
        <span style={{ color: C.dim }}>→</span>
        <Blank px={60} />
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
      {q.prompt.map((cell, i) => <Figure key={i} spec={cell} px={60} />)}
      {/* Every "what comes next" run ends in the blank, not just the geometric one — this
          checked the type and so icon-sequence and glyph-sequence drew a row with no question
          mark on the end of it. The stem is what the question is, so that is what it asks. */}
      {q.layout === 'row' && q.stem_key === 'puzzle_stem_next' && <Blank px={60} />}
    </div>
  )
}

function QuestionCard({ q, lang }) {
  const [picked, setPicked] = useState(null)
  const problem = validateQuestion(q)
  return (
    <div style={{
      background: C.panel, border: `1px solid ${problem ? C.bad : C.line}`,
      borderRadius: 14, padding: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>{t(q.stem_key, lang)}</strong>
        <span style={{ fontSize: 11, color: C.dim, whiteSpace: 'nowrap' }}>{q.type}</span>
      </div>

      <Prompt q={q} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {q.options.map((o, i) => {
          const state = picked == null ? null
            : i === q.correct_index ? 'ok'
              : i === picked ? 'bad' : null
          return (
            <button
              key={i}
              onClick={() => setPicked(i)}
              style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
              title={o.why ? `moved: ${o.why}` : 'answer'}
            >
              {o.spec ? <Figure spec={o.spec} state={state} /> : <CodeChip code={o.code} state={state} />}
              <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                {LETTERS[i]}{picked != null && o.why ? ` · ${o.why}` : ''}
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ fontSize: 11, color: problem ? C.bad : C.dim, marginTop: 10 }}>
        {problem
          ? `INVALID: ${problem}`
          : `rule: ${q.rule.attr}${q.rule.to != null ? ` → ${ruleValue(q.rule.to)}` : ''} · seed ${q.seed}`}
      </div>
    </div>
  )
}

// The claim the whole module rests on, printed: every picture the renderer is capable of
// producing at one size, in one place. Anything a child ever sees is one of these, rotated.
function VocabularySheet() {
  const row = (label, specs) => (
    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ width: 96, fontSize: 12, color: C.dim }}>{label}</span>
      {specs.map((s, i) => <Figure key={i} spec={s} px={54} />)}
    </div>
  )
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {SHAPES.map(shape => row(shape, [
        ...FILLS.map(fill => makeSpec({ shape, fill })),
        ...[1, 3, 5].map(dots => makeSpec({ shape, dots })),
        makeSpec({ shape, corner: 'tl' }),
        makeSpec({ shape, fill: 'solid', dots: 2 }),
      ]))}
      {row('half', HALVES.filter(Boolean).flatMap(half =>
        ['circle', 'square', 'triangle', 'pentagon'].map(shape => makeSpec({ shape, half }))))}
      {row('inner', INNER_NODES.filter(Boolean).flatMap(inner =>
        ['circle', 'square'].map(shape => makeSpec({ shape, inner }))))}
      {row('stretch', STRETCHES.flatMap(stretch =>
        SHAPES.map(shape => makeSpec({ shape, stretch }))))}
      <div style={{ height: 8 }} />
      {Object.entries(GLYPH_GROUPS).map(([key, g]) =>
        row(`${key} (${g.tr})`, g.glyphs.map(glyph => makeGlyphSpec({ glyph }))))}
      {Object.entries(GLYPH_RELATIONS).map(([key, rel]) =>
        row(`${key} (${rel.tr})`, rel.pairs.flat().map(glyph => makeGlyphSpec({ glyph }))))}
      <div style={{ height: 8 }} />
      {Object.entries(ICON_GROUPS).map(([key, g]) =>
        row(`${key} (${g.tr})`, g.icons.flatMap(icon =>
          ICON_FILLS.map(fill => makeIconSpec({ icon, fill })))))}
      <div style={{ fontSize: 11, color: C.dim, paddingTop: 6 }}>
        {ALL_GLYPHS.length} emoji (Noto Color Emoji) · {ALL_ICONS.length} icons × FILL 0/1
        (Material Symbols) · both pinned
      </div>
    </div>
  )
}

const btn = (active) => ({
  background: active ? C.accent : 'transparent',
  color: active ? '#fff' : C.text,
  border: `1px solid ${active ? C.accent : C.line}`,
  borderRadius: 8, padding: '6px 10px', fontSize: 12, cursor: 'pointer',
  fontFamily: 'inherit',
})

export default function PuzzleLab() {
  const lang = childLang(JSON.parse(localStorage.getItem('child') || 'null'))
  const [band, setBand] = useState('5-6')
  const [type, setType] = useState('')      // '' = whatever the band offers
  const [seed, setSeed] = useState(1)
  const [audit, setAudit] = useState(null)
  const [view, setView] = useState('questions')
  // Re-read after the fonts settle: the gate is evaluated at generation time, so a sheet built
  // before they arrive is correctly all-geometric, and this line says why.
  const [fontsOk, setFontsOk] = useState({ emoji: fontReady(), icon: iconFontReady() })
  useEffect(() => {
    let alive = true
    // Ask for both fonts first. Waiting on document.fonts.ready alone resolves without ever
    // fetching them, because at that point nothing on the page has used one — see
    // ensureEmojiFont for the deadlock that creates.
    Promise.all([ensureEmojiFont(), ensureIconFont()]).then(([emoji, icon]) => {
      if (alive) setFontsOk({ emoji, icon })
    })
    return () => { alive = false }
  }, [])

  const questions = useMemo(() => {
    if (type) {
      return Array.from({ length: 12 }, (_, i) => generateQuestion(band, type, seed * 1000 + i * 37))
        .filter(Boolean)
    }
    return generateSession(band, 12, seed * 1000)
    // `fontsOk` is not read in here, but generateQuestion reads the font gate at CALL time, so
    // the same arguments produce a different sheet once the fonts arrive. The dependency is
    // what re-runs this then; without it the page keeps showing the all-geometric sheet it
    // built before they loaded, which is the bug this line exists to prevent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band, type, seed, fontsOk])

  // The audit is the part that makes this more than a preview: it runs the same gate the
  // child path runs, over a few thousand draws, and reports what got through. A number here
  // is the only honest answer to "can you be sure it never shows a broken question".
  const runAudit = () => {
    const started = performance.now()
    const perType = {}
    let invalid = 0
    let empty = 0
    const N = 3000
    for (let i = 0; i < N; i++) {
      const q = generateQuestion(band, type || null, 900000 + i * 13)
      if (!q) { empty++; continue }
      perType[q.type] = (perType[q.type] || 0) + 1
      if (validateQuestion(q)) invalid++
    }
    setAudit({ n: N, invalid, empty, perType, ms: Math.round(performance.now() - started) })
  }

  const cfg = BANDS[band]

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', padding: '22px 18px 70px',
    }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>🧩 Puzzle engine — pilot</h1>
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 18 }}>
          /puzzle-lab — isolated, no gems, no server, not linked from any menu
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {BAND_KEYS.map(b => (
            <button key={b} style={btn(band === b)} onClick={() => { setBand(b); setType(''); setAudit(null) }}>{b}</button>
          ))}
          <span style={{ width: 14 }} />
          <button style={btn(type === '')} onClick={() => setType('')}>all types</button>
          {[...TYPES, ...GLYPH_TYPES, ...ICON_TYPES].map(ty => {
            const on = cfg.types.includes(ty) || cfg.glyphTypes.includes(ty) || cfg.iconTypes.includes(ty)
            return (
              <button
                key={ty}
                disabled={!on}
                style={{ ...btn(type === ty), opacity: on ? 1 : 0.3 }}
                onClick={() => setType(ty)}
              >{ty}</button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          <button style={btn(false)} onClick={() => setSeed(s => s + 1)}>↻ new draw</button>
          <button style={btn(false)} onClick={runAudit}>audit 3000</button>
          <button style={btn(view === 'vocab')} onClick={() => setView(v => (v === 'vocab' ? 'questions' : 'vocab'))}>
            vocabulary sheet
          </button>
        </div>

        <div style={{ fontSize: 11, color: C.dim, marginBottom: 18, lineHeight: 1.7 }}>
          band <strong style={{ color: C.text }}>{band}</strong> ·
          {' '}attributes: {cfg.attributes.join(', ')} ·
          {' '}noise: {cfg.noise} ·
          {' '}fills: {cfg.fills.length} ·
          {' '}rotations: {cfg.rotations.join('/')} ·
          {' '}halves: {cfg.halves.length} ·
          {' '}inners: {cfg.inners.length} ·
          {' '}stretches: {cfg.stretches.join('/')} ·
          {' '}dots: {cfg.dots.join('/')} ·
          {' '}sequence: length {cfg.seqLength}, period {cfg.seqPeriod} ·
          {' '}sources: {Object.entries(cfg.sources).map(([k, v]) => `${k} ${v}`).join(' / ')}
        </div>

        <div style={{ fontSize: 11, marginBottom: 14, color: C.dim }}>
          fonts —{' '}
          <span style={{ color: fontsOk.emoji ? C.ok : C.bad }}>
            emoji {fontsOk.emoji ? 'loaded' : 'MISSING → glyph questions withheld'}
          </span>{' · '}
          <span style={{ color: fontsOk.icon ? C.ok : C.bad }}>
            icons {fontsOk.icon ? 'loaded' : 'MISSING → icon questions withheld'}
          </span>
        </div>

        {audit && (
          <div style={{
            background: audit.invalid ? '#3A1B24' : '#16301F',
            border: `1px solid ${audit.invalid ? C.bad : C.ok}`,
            borderRadius: 12, padding: 12, fontSize: 12, marginBottom: 18, lineHeight: 1.8,
          }}>
            <strong>{audit.invalid ? '✗' : '✓'} {audit.n} draws</strong> ·
            {' '}invalid: {audit.invalid} · could not build: {audit.empty} · {audit.ms}ms
            <br />
            <span style={{ color: C.dim }}>
              {Object.entries(audit.perType).map(([k, v]) => `${k} ${v}`).join(' · ')}
            </span>
          </div>
        )}

        {view === 'vocab' ? <VocabularySheet /> : (
          <div style={{
            display: 'grid', gap: 14,
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          }}>
            {questions.map(q => <QuestionCard key={`${q.seed}-${q.type}`} q={q} lang={lang} />)}
          </div>
        )}
      </div>
    </div>
  )
}
