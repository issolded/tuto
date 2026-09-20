import { useEffect, useMemo, useState } from 'react'
import { childLang, t } from '../lib/i18n'
import {
  BANDS, BAND_KEYS, TYPES, BOOK_COVERAGE, LEXICON_META,
  generateItem, generateSession, validateItem,
} from '../lib/englishTemplates'
import {
  WORD_Z, WORD_LEX, CATEGORIES, ANTONYMS, SYNSETS, SENSES, EXAMPLES,
} from '../lib/englishLexicon.generated'

// Isolated pilot for the English (verbal reasoning) engine — the position PuzzleLab holds at
// /puzzle-lab and MathLab at /math-lab, and for the same reason: a generated question bank is
// only as good as the worst question in it, and the only way to find that one is to put a lot
// of them on one screen.
//
// Not linked from any menu, not wired to gems, levels or the server.
//
// Four things this screen exists to answer, in the order they matter:
//
//   1. Would these questions pass for the book's? (the grid)
//   2. Does every item have exactly one defensible answer? (the audit, running the same
//      validateItem the child path would)
//   3. Is the vocabulary one a nine-year-old reads? (the word sheet — the safety and
//      readability argument made visible, the way PuzzleLab prints every figure it can draw)
//   4. What does the book have that we do not? (coverage, from BOOK_COVERAGE)
//
// Point 3 is the one that has already earned its place. The first build of the lexicon offered
// a child the opposite of `denmark`, a slang word for potato, and a racial slur — all three
// because a case check ran on a word that had already been lowercased. None of that was
// visible in the engine; all of it was visible the moment the words were listed.

const C = {
  bg: '#0F1320', panel: '#181D2E', line: '#2A3149', text: '#EDEBF6',
  dim: '#8D83AD', ok: '#3FBF7F', bad: '#E2586A', accent: '#7C6BF5', warm: '#E8A33D',
}

const LETTERS = 'abcde'

const WHY_LABEL = {
  opposite: 'means the opposite',
  'same-meaning': 'means the same (trap on an OPPOSITE question)',
  rhyme: 'sounds like the word',
  'other-sense': 'another sense of the same word',
  'same-group': 'is in the group',
  'not-a-word': 'makes no word',
  unrelated: 'unrelated',
}

function Stem({ item, lang }) {
  const p = item.prompt
  if (item.type === 'sense') {
    // The word is quoted inside its sentence, as the book does it — the sentence is the
    // question and the word is what to look at in it.
    const parts = p.sentence.split(new RegExp(`\\b(${p.word})\\b`, 'i'))
    return (
      <div>
        <div style={{ fontSize: 15, marginBottom: 4 }}>
          ‘{parts.map((x, i) => (
            x.toLowerCase() === p.word.toLowerCase()
              ? <strong key={i} style={{ color: C.warm }}>{x}</strong>
              : <span key={i}>{x}</span>
          ))}’
        </div>
        <div style={{ fontSize: 12, color: C.dim }}>
          What does ‘{p.word}’ mean as used in the sentence?
        </div>
      </div>
    )
  }
  if (item.type === 'hidden-word') {
    return (
      <div style={{ fontSize: 15 }}>
        {p.sentence.split(new RegExp(`(${p.masked.replace(/_/g, '_')})`)).map((x, i) => (
          x === p.masked
            ? <strong key={i} style={{ color: C.warm, letterSpacing: 1 }}>{x}</strong>
            : <span key={i}>{x}</span>
        ))}
      </div>
    )
  }
  if (item.type === 'shared-letters') {
    return (
      <div style={{ fontSize: 17, letterSpacing: 1, display: 'flex', gap: 18 }}>
        {p.blanks.map((b, i) => <span key={i}>{b}</span>)}
      </div>
    )
  }
  if (item.type === 'letter-pair') {
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 17 }}>
        <span>{p.word}</span>
        <span style={{ fontSize: 11, color: C.dim }}>
          {t(p.opposite ? 'eng_pair_opposite' : 'eng_pair_similar', lang)}
        </span>
        <strong style={{ letterSpacing: 1 }}>{p.masked}</strong>
      </div>
    )
  }
  if (item.type === 'word-grid') {
    return (
      <div style={{ fontSize: 13, color: C.dim }}>
        {t(p.opposite ? 'eng_grid_opposite' : 'eng_grid_similar', lang)}{' '}
        <strong style={{ color: C.text, fontSize: 16 }}>‘{p.word}’</strong>
      </div>
    )
  }
  if (item.type === 'odd-two') return null
  return <div style={{ fontSize: 20, fontWeight: 700 }}>{p.word}</div>
}

function ItemCard({ item, lang, reveal }) {
  const [picked, setPicked] = useState([])
  const problem = validateItem(item)
  const grid = item.type === 'word-grid'

  const toggle = (i) => setPicked(prev => (
    prev.includes(i) ? prev.filter(x => x !== i)
      : prev.length >= item.pick ? [...prev.slice(1), i] : [...prev, i]
  ))

  return (
    <div style={{
      background: C.panel, border: `1px solid ${problem ? C.bad : C.line}`,
      borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 13, color: C.dim }}>{t(item.stem_key, lang)}</strong>
        <span style={{ fontSize: 11, color: C.dim, whiteSpace: 'nowrap' }}>{item.type}</span>
      </div>

      <Stem item={item} lang={lang} />

      <div style={{
        display: grid ? 'grid' : 'flex',
        gridTemplateColumns: grid ? 'repeat(4, 1fr)' : undefined,
        flexWrap: grid ? undefined : 'wrap',
        gap: 6,
      }}>
        {item.options.map((o, i) => {
          const isRight = item.correct.includes(i)
          const chosen = picked.includes(i)
          const show = reveal || chosen
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              title={o.why ? WHY_LABEL[o.why] || o.why : 'correct'}
              style={{
                background: show && isRight ? '#1C3B2C' : show && chosen ? '#3B1C24' : '#111528',
                border: `1px solid ${show && isRight ? C.ok : chosen ? C.bad : C.line}`,
                color: C.text, borderRadius: 9, padding: '7px 10px', cursor: 'pointer',
                font: 'inherit', fontSize: 14, textAlign: 'left', minWidth: grid ? 0 : 62,
              }}
            >
              {!grid && <span style={{ color: C.dim, fontSize: 11, marginRight: 5 }}>{LETTERS[i]}</span>}
              {o.text}
            </button>
          )
        })}
      </div>

      {reveal && (
        <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5 }}>
          answer: <strong style={{ color: C.ok }}>{item.correct.map(i => item.options[i].text).join(' + ')}</strong>
          {item.rule.answer ? ` (${item.rule.answer})` : ''}
          {item.rule.word ? ` (${item.rule.word})` : ''}
          {item.rule.words ? ` (${item.rule.words.join(', ')})` : ''}
          {item.rule.group ? ` · group: ${item.rule.group} vs ${item.rule.outsiders}` : ''}
          {item.rule.definition ? ` · “${item.rule.definition}”` : ''}
          <br />
          {/* A word grid has twelve cells and no a–e letters, so name its cells by the word
              itself — the lab printed "undefined unrelated" ten times per grid. */}
          {item.options.map((o, i) => o.why
            && `${item.options.length > LETTERS.length ? o.text : LETTERS[i]} ${WHY_LABEL[o.why] || o.why}`)
            .filter(Boolean).join(' · ')}
          <br />seed {item.seed}
        </div>
      )}

      {problem && (
        <div style={{ fontSize: 12, color: C.bad, fontWeight: 600 }}>⚠ {problem}</div>
      )}
    </div>
  )
}

// ── the audit ──────────────────────────────────────────────────────────────────────────────
// The same numbers scripts/english-audit.mjs prints, run in the browser so a change can be
// judged without leaving the screen. What it measures is not "does it crash" but the two
// things that decide whether the module is honest: how often a generator has to give up, and
// whether anything reaches validateItem that should not.

function runAudit(bandKey, perType) {
  const rows = []
  let rejected = 0
  for (const type of TYPES) {
    let made = 0
    let tries = 0
    const answers = new Set()
    const stems = new Set()
    let rare = 0
    for (let s = 1; made < perType && tries < perType * 200; tries++, s += 7919) {
      const item = generateItem(bandKey, type, s)
      if (!item) { rejected++; continue }
      made++
      for (const i of item.correct) answers.add(item.options[i].text)
      if (item.prompt.word) stems.add(item.prompt.word)
      // Every printed WORD measured against the band's own readable bar — a generator that
      // quietly reaches below it is the failure mode that does not look like one.
      //
      // The letter types are exempt, as they are in scripts/english-audit.mjs: their options
      // are three letters, not words, and `arb`, `ane` and `alb` all happen to be in WordNet
      // at Zipf 2.6. Counting them as unreadable vocabulary put a red number on the one thing
      // about those options that is working.
      const letters = type === 'letter-pair' || type === 'shared-letters' || type === 'hidden-word'
      if (!letters) {
        for (const o of item.options) {
          if (WORD_Z[o.text] && WORD_Z[o.text] < BANDS[bandKey].option) rare++
        }
      }
    }
    rows.push({
      type, made, tries,
      yield: tries ? Math.round((made / tries) * 100) : 0,
      answers: answers.size, stems: stems.size, rare,
    })
  }
  return { rows, rejected }
}

export default function EnglishLab() {
  const lang = childLang()
  const [bandKey, setBandKey] = useState(BAND_KEYS[0])
  const [type, setType] = useState('all')
  const [seed, setSeed] = useState(1)
  const [reveal, setReveal] = useState(true)
  const [view, setView] = useState('grid')

  const band = BANDS[bandKey]

  const items = useMemo(() => {
    if (type === 'all') return generateSession(bandKey, 12, seed * 1000003)
    const out = []
    for (let i = 0, s = seed * 1000003; out.length < 12 && i < 2400; i++, s += 7919) {
      const item = generateItem(bandKey, type, s | 0)
      if (item) out.push(item)
    }
    return out
  }, [bandKey, type, seed])

  const audit = useMemo(() => (view === 'audit' ? runAudit(bandKey, 120) : null), [view, bandKey])

  const words = useMemo(() => {
    if (view !== 'words') return null
    return Object.keys(WORD_Z)
      .filter(w => WORD_Z[w] >= band.option)
      .sort((a, b) => WORD_Z[b] - WORD_Z[a])
  }, [view, band])

  useEffect(() => { document.title = 'English lab' }, [])

  const btn = (active) => ({
    background: active ? C.accent : '#111528',
    border: `1px solid ${active ? C.accent : C.line}`,
    color: C.text, borderRadius: 9, padding: '6px 11px', cursor: 'pointer',
    font: 'inherit', fontSize: 13,
  })

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100dvh', padding: 16,
      fontFamily: 'Lexend, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>English lab</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.dim, lineHeight: 1.6 }}>
            /english-lab — isolated, no gems, no server, not linked from any menu.<br />
            Lexicon built {LEXICON_META.built} from WordNet {LEXICON_META.wordnet}:{' '}
            {Object.entries(LEXICON_META.counts).map(([k, v]) => `${v} ${k}`).join(' · ')}.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {BAND_KEYS.map(k => (
            <button key={k} style={btn(k === bandKey)} onClick={() => setBandKey(k)}>{k}</button>
          ))}
          <span style={{ width: 12 }} />
          {['grid', 'audit', 'words', 'coverage'].map(v => (
            <button key={v} style={btn(v === view)} onClick={() => setView(v)}>{v}</button>
          ))}
        </div>

        {view === 'grid' && (
          <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button style={btn(type === 'all')} onClick={() => setType('all')}>all</button>
              {TYPES.map(k => (
                <button key={k} style={btn(k === type)} onClick={() => setType(k)}>{k}</button>
              ))}
              <span style={{ width: 12 }} />
              <button style={btn(false)} onClick={() => setSeed(s => s + 1)}>new seed ({seed})</button>
              <button style={btn(reveal)} onClick={() => setReveal(r => !r)}>answers</button>
            </div>
            <div style={{
              display: 'grid', gap: 12,
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            }}>
              {items.map((item, i) => (
                <ItemCard key={`${item.seed}-${i}`} item={item} lang={lang} reveal={reveal} />
              ))}
            </div>
            {!items.length && <p style={{ color: C.bad }}>no items generated</p>}
          </>
        )}

        {view === 'audit' && audit && (
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14 }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: C.dim, lineHeight: 1.6 }}>
              120 items per type. <strong>yield</strong> is how often a generator finds a clean
              question — a low one is not a bug (an item that fails validateItem is discarded,
              never patched) but it says the lexicon is thin for that type.{' '}
              <strong>rare</strong> counts options below the band&apos;s own readable bar of
              Zipf {(band.option / 10).toFixed(1)}; it should be zero.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: C.dim, textAlign: 'left' }}>
                  <th style={{ padding: 4 }}>type</th><th>made</th><th>tries</th>
                  <th>yield</th><th>distinct answers</th><th>distinct stems</th><th>rare</th>
                </tr>
              </thead>
              <tbody>
                {audit.rows.map(r => (
                  <tr key={r.type} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={{ padding: 4 }}>{r.type}</td>
                    <td>{r.made}</td><td>{r.tries}</td>
                    <td style={{ color: r.yield < 20 ? C.warm : C.ok }}>{r.yield}%</td>
                    <td>{r.answers}</td><td>{r.stems}</td>
                    <td style={{ color: r.rare ? C.bad : C.dim }}>{r.rare}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'words' && words && (
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14 }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: C.dim, lineHeight: 1.6 }}>
              Every word the {bandKey} band can print, {words.length} of them, commonest first.
              This is the safety argument made visible — the same job PuzzleLab&apos;s vocabulary
              sheet does for figures. Read the tail: that is where a proper noun, a slur or a
              word no nine-year-old has met will be sitting.
            </p>
            <div style={{
              display: 'grid', gap: 2, fontSize: 12,
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', maxHeight: '62dvh',
              overflow: 'auto',
            }}>
              {words.map(w => (
                <div key={w} style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <span>{w}</span>
                  <span style={{ color: C.dim, fontSize: 10 }}>
                    {(WORD_Z[w] / 10).toFixed(1)} {(WORD_LEX[w] || '').replace(/^(noun|verb|adj|adv)\./, '')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'coverage' && (
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14, fontSize: 13, lineHeight: 1.7 }}>
            <p style={{ marginTop: 0, color: C.dim, fontSize: 12 }}>
              What the book asks and this engine does not. One-directional and deliberately so:
              a note in a comment saying &ldquo;no cloze yet&rdquo; stays there forever after cloze ships.
            </p>
            <strong>{BOOK_COVERAGE[bandKey].book}</strong>
            <ul style={{ paddingLeft: 18 }}>
              {BOOK_COVERAGE[bandKey].missing.map((m, i) => (
                <li key={i} style={{ marginBottom: 6, whiteSpace: 'pre-wrap' }}>{m}</li>
              ))}
            </ul>
            <div style={{ marginTop: 14, color: C.dim, fontSize: 12 }}>
              lexicon: {SYNSETS.length} sense sets · {ANTONYMS.length} opposite pairs ·{' '}
              {CATEGORIES.length} groups · {Object.keys(SENSES).length} words with two or more
              sensed sentences · {Object.keys(EXAMPLES).length} example sentences
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
