import { useEffect, useMemo, useState } from 'react'
import { childLang, t } from '../lib/i18n'
import {
  BANDS, BAND_KEYS, BOOK_COVERAGE, LEXICON_META, VARIETIES, DEFAULT_VARIETY, GRAMMAR_TYPES,
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
  'the-rule-applied-blindly': 'the rule applied blindly — the answer a child writes',
  'cut-in-the-wrong-place': 'the word cut in the wrong place',
  'wrong-prefix': 'the wrong beginning',
  'looks-alike': 'spelled alike, said differently',
  opposite: 'means the opposite',
  // Two types use this and it means opposite things in them. On an ANTONYM question it is the
  // trap — a word that means the same when the opposite was asked. On odd-synonym it is why
  // the option is NOT the answer: it belongs to the group.
  'same-meaning': 'means the same',
  rhyme: 'sounds like the word',
  'other-sense': 'another sense of the same word',
  'same-group': 'is in the group',
  'not-a-word': 'makes no word',
  unrelated: 'unrelated',
  // The letter puzzles (VR 7-8)
  'one-letter-different': 'one letter different',
  'other-code': 'another word in the same code',
  'wrong-order': 'right digits, wrong order',
  'next-letter': 'read off the next letter',
  'fits-some': 'makes a word with some, not all',
  'wrong-place': 'is in a different place',
  'fits-one-side': 'finishes one word only',
  'other-change': 'a different change',
  'only-from-first': 'one step from the first word only',
  'only-to-last': 'one step from the last word only',
  'can-be-made': 'can be made from the letters',
  'off-by-one': 'one step out',
  'other-relation': 'the same word, another relation',
  'the-same-word': 'the word itself',
  'same-relation-other-word': 'right relation, wrong word',
  'rhymes-only': 'rhymes, wrong meaning',
  'means-only': 'right meaning, no rhyme',
  'opposite-pair': 'an opposite pair',
  'same-meaning-pair': 'a same-meaning pair',
  'same-group-pair': 'two of a kind',
  'unrelated-pair': 'unrelated',
  'wrong-person': 'the facts rule them out',
  'one-out-of-order': 'one letter out of order',
  'out-of-order': 'out of order',
  'wrong-value': 'wrong value',
  // Spelling and grammar (English 10-11, MC Pack 2)
  'apostrophe-s-added-to-plural': "'s added to a plural ending in s",
  'extra-s': 'an extra s',
  'no-apostrophe': 'no apostrophe',
  'singular-owner': 'one owner, not several',
  'apostrophe-after-s': 'apostrophe after the s',
  'spelled-right': 'spelled correctly',
  'sounds-the-same': 'sounds the same, not this word',
  swapped: 'the letters swapped',
  'other-words': 'other words',
  'apostrophe-in-the-wrong-place': 'apostrophe in the wrong place',
  'not-standard-english': 'not Standard English here',
  'wrong-degree': 'compares the wrong number of things',
  'wrong-way-to-compare': 'the wrong way to compare this word',
  'compared-twice': 'compared twice',
  'not-compared': 'not compared',
  'still-plural': 'still plural',
  'stripped-wrongly': 'ending taken off wrongly',
  'other-pair': 'belongs to another word',
  'other-group': 'a group of something else',
  'not-the-saying': 'not the saying',
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
  if (item.type === 'odd-two' || item.type === 'odd-synonym') return null
  if (item.type === 'definition') {
    return <div style={{ fontSize: 15, fontStyle: 'italic' }}>&ldquo;{p.definition}&rdquo;</div>
  }
  if (item.type === 'missing-vowel') {
    return <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>{p.masked}</div>
  }
  if (item.type === 'syllables') {
    return (
      <div style={{ fontSize: 20, fontWeight: 700 }}>
        {p.count} <span style={{ fontSize: 13, fontWeight: 400, color: C.dim }}>
          {t('eng_syllable_beats', lang)}
        </span>
      </div>
    )
  }
  if (item.type === 'suffix') {
    return (
      <div style={{ fontSize: 20, fontWeight: 700 }}>
        {p.word} <span style={{ color: C.dim }}>+</span>{' '}
        <span style={{ color: C.warm }}>{p.suffix}</span>
      </div>
    )
  }
  if (item.type === 'prefix-antonym') {
    return (
      <div style={{ fontSize: 20, fontWeight: 700 }}>
        <span style={{ color: C.warm }}>___</span>{p.word}
      </div>
    )
  }
  // ── the letter puzzles (VR 7-8) ──────────────────────────────────────────────────────
  // Everything the question is ABOUT is on the card; the instruction above it says what to do.
  const big = { fontSize: 20, fontWeight: 700, letterSpacing: 1 }
  const small = { fontSize: 12, color: C.dim }
  if (item.type === 'letter-code') {
    return (
      <div style={{ fontSize: 15 }}>
        <div><strong style={{ letterSpacing: 2 }}>{p.key}</strong> = {p.keyCode}</div>
        <div style={{ marginTop: 4 }}>
          {p.decode ? <strong style={big}>{p.code} = ?</strong> : <strong style={big}>{p.word} = ?</strong>}
        </div>
      </div>
    )
  }
  if (item.type === 'front-letter' || item.type === 'compound-front') {
    const blank = item.type === 'front-letter' ? '_' : '___'
    return (
      <div style={{ ...big, fontSize: 18, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {p.tails.map((t, i) => <span key={i}>{blank}{item.type === 'compound-front' ? t.toUpperCase() : t}</span>)}
      </div>
    )
  }
  if (item.type === 'alpha-order') {
    return <div style={big}>{['', '1st', '2nd', '3rd', '4th', '5th'][p.nth]}</div>
  }
  if (item.type === 'join-letter') {
    return <div style={big}>{p.left} <span style={{ color: C.warm }}>( _ )</span> {p.right}</div>
  }
  if (item.type === 'change-pattern') {
    return (
      <div style={{ fontSize: 17 }}>
        {p.pairs.map(([a, b], i) => <span key={i} style={{ marginRight: 16 }}>{a}, {b}</span>)}
        <strong>{p.word}, <span style={{ color: C.warm }}>?</span></strong>
      </div>
    )
  }
  if (item.type === 'word-ladder') {
    return <div style={big}>{p.from.toUpperCase()} → <span style={{ color: C.warm }}>?</span> → {p.to.toUpperCase()}</div>
  }
  if (item.type === 'not-from-letters' || item.type === 'unscramble') {
    return <div style={{ ...big, letterSpacing: 3 }}>{(p.letters || p.word).toUpperCase()}</div>
  }
  if (item.type === 'letter-analogy') {
    return (
      <div style={{ fontSize: 17 }}>
        <strong>{p.a}</strong> is to <strong>{p.b}</strong> as <strong>{p.c}</strong> is to{' '}
        <span style={{ color: C.warm }}>?</span>
        <div style={{ ...small, letterSpacing: 2, marginTop: 4 }}>ABCDEFGHIJKLMNOPQRSTUVWXYZ</div>
      </div>
    )
  }
  if (item.type === 'analogy') {
    return (
      <div style={{ fontSize: 17 }}>
        <strong>{p.a}</strong> is to <strong>{p.A}</strong> as <strong>{p.b}</strong> is to{' '}
        <span style={{ color: C.warm }}>?</span>
      </div>
    )
  }
  if (item.type === 'rhyme-synonym') {
    return (
      <div style={{ fontSize: 17 }}>
        <strong style={{ letterSpacing: 1 }}>{p.word.toUpperCase()}</strong>
        <span style={{ ...small, margin: '0 8px' }}>{t('eng_rhymes_with', lang)}</span>
        <strong>{p.rhyme}</strong>
      </div>
    )
  }
  if (item.type === 'pair-meaning') {
    return <div style={small}>{t(p.opposite ? 'eng_pair_most_opposite' : 'eng_pair_most_similar', lang)}</div>
  }
  if (item.type === 'logic-grid') {
    return (
      <div style={{ fontSize: 15, lineHeight: 1.5 }}>
        {p.lines.join(' ')}
        <div style={{ fontWeight: 700, marginTop: 6 }}>{p.question}</div>
      </div>
    )
  }
  if (item.type === 'letters-in-order' || item.type === 'anagram-pair' || item.type === 'misspelt') return null
  if (item.type === 'letter-sum') {
    return (
      <div style={{ fontSize: 15 }}>
        <div>{p.table}</div>
        <div style={{ ...big, marginTop: 4 }}>{p.sum} = ?</div>
      </div>
    )
  }
  // ── spelling and grammar (English 10-11, MC Pack 2) ───────────────────────────────────
  if (['homophone-cloze', 'grammar-cloze', 'comparative', 'proverb'].includes(item.type)) {
    return (
      <div style={{ fontSize: 17 }}>
        {p.sentence.split('___').map((x, i, all) => (
          <span key={i}>{x}{i < all.length - 1 && <span style={{ color: C.warm }}>_____</span>}</span>
        ))}
        {item.type === 'comparative' && <span style={{ ...small, marginLeft: 8 }}>({p.word})</span>}
      </div>
    )
  }
  if (item.type === 'apostrophe') return <div style={{ fontSize: 17, fontStyle: 'italic' }}>{p.phrase}</div>
  if (['ending', 'ie-ei', 'silent-letter'].includes(item.type)) {
    return <div style={{ ...big, fontSize: 22, letterSpacing: 2 }}>{p.masked}</div>
  }
  if (item.type === 'collective') {
    return <div style={{ fontSize: 18 }}>a <span style={{ color: C.warm }}>_____</span> of <strong>{p.word}</strong></div>
  }
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
          {item.rule.word && !item.correct.some(i => item.options[i].text === item.rule.word)
            ? ` (${item.rule.word})` : ''}
          {item.rule.words ? ` (${item.rule.words.join(', ')})` : ''}
          {item.rule.group && item.rule.outsiders ? ` · group: ${item.rule.group} vs ${item.rule.outsiders}` : ''}
          {item.rule.group && !item.rule.outsiders ? ` · group: ${[].concat(item.rule.group).join(', ')}` : ''}
          {item.rule.suffix ? ` · -${item.rule.suffix}` : ''}
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

function runAudit(bandKey, perType, variety) {
  const rows = []
  let rejected = 0
  for (const type of BANDS[bandKey].types) {
    let made = 0
    let tries = 0
    const answers = new Set()
    const stems = new Set()
    let rare = 0
    for (let s = 1; made < perType && tries < perType * 200; tries++, s += 7919) {
      const item = generateItem(bandKey, type, s, { variety })
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
      const letters = ['letter-pair', 'shared-letters', 'hidden-word', 'plural', 'past-tense',
        'suffix', 'root-word', 'prefix-antonym', 'missing-vowel', 'letter-code', 'front-letter',
        'join-letter', 'letter-analogy', 'letter-sum', 'logic-grid', 'pair-meaning', 'analogy',
        ...GRAMMAR_TYPES].includes(type)
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
  const [variety, setVariety] = useState(DEFAULT_VARIETY)
  const [picked, setPicked] = useState('all')
  const [seed, setSeed] = useState(1)
  const [reveal, setReveal] = useState(true)
  const [view, setView] = useState('grid')

  const band = BANDS[bandKey]

  // Derived rather than synced. Switching band while a type that band does not pose is
  // selected would otherwise leave an empty grid, which reads as a broken engine instead of as
  // a band that does not ask that question — and fixing it with an effect means a second
  // render for every band change.
  const type = band.types.includes(picked) ? picked : 'all'

  const items = useMemo(() => {
    if (type === 'all') return generateSession(bandKey, 12, seed * 1000003, { variety })
    const out = []
    for (let i = 0, s = seed * 1000003; out.length < 12 && i < 2400; i++, s += 7919) {
      const item = generateItem(bandKey, type, s | 0, { variety })
      if (item) out.push(item)
    }
    return out
  }, [bandKey, type, seed, variety])

  const audit = useMemo(
    () => (view === 'audit' ? runAudit(bandKey, 120, variety) : null), [view, bandKey, variety])

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
            {/* Three of the counts are per-variety objects now, so they print as a pair. */}
            {Object.entries(LEXICON_META.counts)
              .map(([k, v]) => `${typeof v === 'object' ? Object.entries(v).map(([a, b]) => `${a} ${b}`).join('/') : v} ${k}`)
              .join(' · ')}.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {BAND_KEYS.map(k => (
            <button key={k} style={btn(k === bandKey)} onClick={() => setBandKey(k)}>{k}</button>
          ))}
          <span style={{ width: 12 }} />
          {/* Which English. Not a language — the child's language is a separate axis. Three
              types answer differently here: `calm` rhymes with `arm` in one and not the
              other, and 87 words are spelled two ways. */}
          {VARIETIES.map(v => (
            <button key={v} style={btn(v === variety)} onClick={() => setVariety(v)}>
              {v === 'uk' ? '🇬🇧 British' : '🇺🇸 American'}
            </button>
          ))}
          <span style={{ width: 12 }} />
          {['grid', 'audit', 'words', 'coverage'].map(v => (
            <button key={v} style={btn(v === view)} onClick={() => setView(v)}>{v}</button>
          ))}
        </div>

        {view === 'grid' && (
          <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button style={btn(type === 'all')} onClick={() => setPicked('all')}>all</button>
              {band.types.map(k => (
                <button key={k} style={btn(k === type)} onClick={() => setPicked(k)}>{k}</button>
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
