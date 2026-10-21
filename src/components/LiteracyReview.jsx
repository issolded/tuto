import { EMOJI_ART } from '../lib/puzzleArt.generated'
import { play, usePlayer } from '../lib/literacyAudio'
import { EnglishStem } from './EnglishView'
import { t } from '../lib/i18n'
import { rightAnswer } from '../lib/literacyAnswer'

// The English ladder sitting's pieces that the screen, its result list and a reopened sitting (gem history, the
// parent's child page) all draw: pictures, the sound button with its ring, an option's face, and the list of
// answered items. One place, so what the child saw at the end is what anyone sees later.

export const ROSE = '#D9577A'
export const INK = '#241f3a'
export const INK_SOFT = '#8d83ad'
export const GREEN = '#4cb685'
export const FRED = "'TrRound', 'Fredoka', 'Baloo 2', sans-serif"
export const NUNITO = "'Nunito', sans-serif"

export const Picture = ({ emoji, size = 72 }) => (EMOJI_ART[emoji]
  ? <img src={EMOJI_ART[emoji]} alt="" draggable={false} style={{ width: size, height: size }} />
  : <span style={{ fontSize: size * 0.8 }}>{emoji}</span>)

// A ring that fills while its recording plays, so the child can see how much is left.
function Ring({ progress, size, color, track }) {
  const r = size / 2 - 3
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - progress)} />
    </svg>
  )
}

// 🔊 in a circle; while this button's sound plays, the circle fills and the speaker bobs. A tap plays it from the
// start again. `label` sits beside the circle (a pill), or the circle stands alone.
export function SoundButton({ urls, playKey, label, playingLabel, size = 'md', tone = 'rose', onTap }) {
  const player = usePlayer()
  const on = player.key === playKey
  const d = size === 'lg' ? 46 : size === 'sm' ? 28 : 36
  const solid = tone === 'rose'
  const fg = solid ? '#fff' : ROSE
  return (
    <button className="lt-press" aria-label={label || 'Listen'}
      onClick={(e) => { e.stopPropagation(); onTap?.(); play(urls, playKey) }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: label ? 12 : 0, border: 'none', cursor: 'pointer',
        background: solid ? ROSE : '#fff', color: fg, borderRadius: 999,
        padding: label ? (size === 'lg' ? '10px 30px 10px 12px' : '7px 18px 7px 8px') : 4,
        fontFamily: FRED, fontWeight: 600, fontSize: size === 'lg' ? 22 : size === 'sm' ? 14 : 17,
        boxShadow: solid ? '0 10px 28px rgba(170,50,85,.3)' : '0 3px 10px rgba(40,30,70,.1)',
      }}>
      <span style={{ position: 'relative', width: d, height: d, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <Ring progress={on ? player.progress : 0} size={d} color={solid ? '#fff' : ROSE} track={solid ? 'rgba(255,255,255,.3)' : 'rgba(217,87,122,.18)'} />
        <span style={{ fontSize: d * 0.42, animation: on ? 'lt-bob .6s ease-in-out infinite' : 'none' }}>🔊</span>
      </span>
      {label && <span>{on && playingLabel ? playingLabel : label}</span>}
    </button>
  )
}

// What an option looks like: its picture, its words, or (an option that is only a sound) its number.
export function OptionFace({ q, o, size = 72 }) {
  if (o.picture) return <Picture emoji={o.picture.emoji} size={size} />
  if (o.text) return o.text
  if (o.audio) return <>🔊 {q.options.indexOf(o) + 1}</>
  return null
}

const card = (i) => ({
  background: 'white', borderRadius: 16, padding: '13px 15px', boxShadow: '0 3px 12px rgba(40,30,70,.07)',
  animation: `fadeUp 0.35s ease ${0.1 + Math.min(i, 8) * 0.05}s both`,
})

// What the item asked, small: the text it came with, the picture, the words, or a button to hear it again.
function PromptLine({ item, n }) {
  const p = item.prompt || {}
  if (item.passage) return (
    <div style={{ background: '#FBF6F8', borderRadius: 12, padding: '9px 12px', fontFamily: NUNITO, fontSize: 14, color: INK, lineHeight: 1.5 }}>
      {item.passage.title && <div style={{ fontFamily: FRED, fontWeight: 600, marginBottom: 2 }}>{item.passage.title}</div>}
      {item.passage.text}
    </div>
  )
  if (p.listen) return <SoundButton urls={p.audio} playKey={`review:${n}`} label="Listen again" size="sm" tone="white" />
  if (p.stem_key) return <div><div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 15, color: INK, marginBottom: 6 }}>{t(p.stem_key, 'en')}</div><EnglishStem item={{ type: p.type, prompt: p.vr, pick: p.pick }} lang="en" /></div>
  return (
    <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 15, color: INK, lineHeight: 1.45 }}>
      {p.instruction && <div style={{ color: INK_SOFT, fontSize: 13 }}>{p.instruction}</div>}
      {p.picture && <Picture emoji={p.picture.emoji} size={56} />}
      {p.context && <div>{p.context}</div>}
      {p.text && <div style={{ fontSize: p.instruction ? 20 : 15 }}>{p.text}</div>}
      {p.stem && <div style={{ letterSpacing: 1 }}>{p.stem}</div>}
      {p.ask && <div>{p.ask}</div>}
    </div>
  )
}

// entries: [{ item, answers: { qid: chosen }, results: { qid: { correct, key, explain, explain_audio } }, skipped }]
export function LiteracyReviewList({ entries }) {
  let n = 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {entries.map((e, i) => {
        const ok = e.item.questions.every(q => e.results[q.id]?.correct)
        return (
          <div key={i} style={card(i)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 8 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{ok ? '✅' : '🔄'}</span>
              <div style={{ flex: 1, minWidth: 0 }}><PromptLine item={e.item} n={i} /></div>
            </div>
            {e.item.questions.map(q => {
              const r = e.results[q.id]
              if (!r) return null
              n++
              const chosen = [].concat(e.answers?.[q.id] ?? [])
              const ans = rightAnswer(q, r)
              return (
                <div key={q.id} style={{ marginTop: 8 }}>
                  {q.stem && <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 14.5, color: INK, marginBottom: 6 }}>{e.item.questions.length > 1 ? (r.correct ? '✅ ' : '🔄 ') : ''}{q.stem}</div>}
                  {q.mode === 'build' ? (
                    <div style={{ fontFamily: NUNITO, fontWeight: 800, fontSize: 16, color: INK }}>
                      {e.skipped ? '—' : <span style={{ color: r.correct ? GREEN : '#E2586A' }}>{chosen[0] || '—'}</span>}
                      {!r.correct && <> → <span style={{ color: GREEN }}>{r.key[0]}</span></>}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {q.options.map(o => {
                        const right = r.key.includes(o.id)
                        const bad = !right && chosen.includes(o.id)
                        const face = (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 11,
                            border: `2.5px solid ${right ? GREEN : bad ? '#E2586A' : '#DCD9EA'}`, background: right ? '#e9f8f0' : bad ? '#fdecee' : '#fff',
                            fontFamily: NUNITO, fontWeight: 800, fontSize: 13.5, color: INK,
                          }}><OptionFace q={q} o={o} size={34} /></span>
                        )
                        return o.audio && !o.text && !o.picture
                          ? <button key={o.id} onClick={() => play(o.audio, `review:${n}:${o.id}`)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}>{face}</button>
                          : <span key={o.id}>{face}</span>
                      })}
                    </div>
                  )}
                  {/* The options above already show the right words; a note only when it adds something. */}
                  {!r.correct && (ans.extra || (ans.sound && ans.text)) && (
                    <div style={{ marginTop: 8, background: '#FFF4E8', borderRadius: 12, padding: '9px 12px', fontFamily: NUNITO, fontWeight: 700, fontSize: 13.5, color: INK, lineHeight: 1.45, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 1 }}>✓ {ans.extra || ans.text}</span>
                      {ans.audio && <SoundButton urls={ans.audio} playKey={`review:${n}:explain`} size="sm" tone="white" />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
