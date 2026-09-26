import { t } from '../lib/i18n'

// How an English question is drawn — the part between the instruction and the options. Shared by
// the child's screen, its review list and the lab (/english-lab), which is why it takes a palette:
// the lab is dark, the child's card is white. The words are the book's own ("is to … as"), so they
// stay English in every UI language; the instruction above them is the translated part.

export const LIGHT = { text: '#241f3a', dim: '#8d83ad', warm: '#e0607e' }

// Why a wrong option is wrong, in the child's language. Two keys need their question to be read
// right: "means the same" is the trap on an opposite question and the reason on an odd-one-out
// question, and a syllable count carries its number.
export function englishWhy(key, type, lang) {
  if (!key) return null
  const m = /^syllables-(\d+)$/.exec(key)
  if (m) return t('eng_why_syllables', lang).replace('%n%', m[1])
  const base = `eng_why_${key.replace(/-/g, '_')}`
  const specific = `${base}__${type.replace(/-/g, '_')}`
  const own = t(specific, lang)
  if (own !== specific) return own
  const text = t(base, lang)
  return text === base ? null : text
}

export function EnglishStem({ item, lang, palette: C = LIGHT }) {
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

// The "why not" lines for the options a child chose wrongly, one line per reason: two wrong picks
// for the same reason read "organ, belly: …" rather than the same sentence twice.
export function englishWhyLines(item, why, lang) {
  const byText = new Map()
  for (const w of why || []) {
    const text = englishWhy(w.key, item.type, lang)
    const word = item.options[w.index]?.text
    if (!text || !word) continue
    byText.set(text, [...(byText.get(text) || []), word])
  }
  return [...byText.entries()].map(([text, words]) => `${words.join(', ')}: ${text}`)
}

// The options, as word chips. `states[i]` is 'picked' | 'ok' | 'bad' | null. The word grid is a
// grid because the book prints it as one (three rows of four); everything else wraps.
export function EnglishOptions({ item, states = [], onPick, disabled = false, size = 'lg' }) {
  const grid = item.type === 'word-grid'
  const big = size === 'lg'
  const tone = {
    picked: { border: '#e0607e', background: '#fff0f3', transform: 'scale(1.04)' },
    ok: { border: '#4cb685', background: '#e9f8f0' },
    bad: { border: '#E2586A', background: '#fdecee' },
  }
  return (
    <div style={{
      display: grid ? 'grid' : 'flex', gridTemplateColumns: grid ? 'repeat(4, 1fr)' : undefined,
      flexWrap: grid ? undefined : 'wrap', justifyContent: 'center', gap: big ? 10 : 6,
    }}>
      {item.options.map((o, i) => {
        const st = tone[states[i]] || {}
        const Tag = onPick ? 'button' : 'div'
        return (
          <Tag key={i} className={onPick ? 'pz-press' : undefined} onClick={onPick ? () => onPick(i) : undefined} disabled={onPick ? disabled : undefined}
            style={{
              minWidth: grid ? 0 : (big ? 96 : 64), padding: big ? '13px 16px' : '7px 10px', borderRadius: big ? 16 : 11,
              border: `3px solid ${st.border || '#DCD9EA'}`, background: st.background || '#fff', color: '#12131A',
              fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: big ? (grid ? 15 : 18) : 13.5,
              cursor: onPick && !disabled ? 'pointer' : 'default', transition: 'transform .12s ease, border-color .12s ease',
              transform: st.transform, overflowWrap: 'anywhere', textAlign: 'center',
              boxShadow: big ? '0 4px 12px rgba(120,40,70,.08)' : 'none',
            }}>
            {o.text}
          </Tag>
        )
      })}
    </div>
  )
}
