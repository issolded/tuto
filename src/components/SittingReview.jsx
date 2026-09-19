import { t } from '../lib/i18n'
import { Figure, Prompt, CodeChip } from './PuzzleView'

// One finished sitting, question by question: the card at the end of a puzzle sitting, and the
// same card when a sitting is opened again from the gem history (the child's) or the child's
// card (the parent's). Kept in one place so what a child saw at the end is what anyone sees later.

const INK = '#241f3a'
const GREEN = '#4cb685'
const ORANGE = '#f79433'
const FRED = "'TrRound', 'Fredoka', 'Baloo 2', sans-serif"
const COLORS = { ok: '#4cb685', bad: '#E2586A', dim: '#8d83ad' }

const card = (i) => ({
  background: 'white', borderRadius: 16, padding: '13px 15px',
  boxShadow: '0 3px 12px rgba(31,122,114,.07)',
  animation: `fadeUp 0.35s ease ${0.1 + Math.min(i, 8) * 0.05}s both`,
})

const heading = (ok, text) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 10 }}>
    <span style={{ fontSize: 18, flexShrink: 0 }}>{ok ? '✅' : '🔄'}</span>
    <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 15, color: INK, lineHeight: 1.4 }}>{text}</div>
  </div>
)

// questions: the public sheet; answers[i]: { chosen_index, correct_index, correct, why } or null.
export function PuzzleReviewList({ questions, answers, lang, px = 40 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {answers.map((a, i) => {
        const pq = questions[i]
        if (!a || !pq) return null
        return (
          <div key={i} style={card(i)}>
            {heading(a.correct, `${i + 1}. ${t(pq.stem_key, lang)}`)}
            <Prompt q={pq} px={px} colors={COLORS} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {pq.options.map((o, j) => {
                const mine = j === a.chosen_index
                const right = j === a.correct_index
                const state = right ? 'ok' : mine ? 'bad' : null
                return (
                  <div key={j} style={{ textAlign: 'center', opacity: state ? 1 : 0.55 }}>
                    {o.spec ? <Figure spec={o.spec} px={px} state={state} colors={COLORS} />
                      : <CodeChip code={o.code} px={px - 8} state={state} colors={COLORS} />}
                    <div style={{ fontWeight: 800, fontSize: 11, marginTop: 2, minHeight: 14, color: right ? GREEN : ORANGE }}>
                      {mine ? t('puzzle_you', lang) : right ? t('math_answer_was', lang) : ''}
                    </div>
                  </div>
                )
              })}
            </div>
            {!a.correct && a.why && (
              <div style={{ marginTop: 8, background: '#FFF4E8', borderRadius: 12, padding: '9px 12px', fontWeight: 700, fontSize: 13.5, color: INK, lineHeight: 1.45 }}>
                💡 {a.why}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// items: { question, child_answer, correct, correct_answer, help_used }. The right answer is
// shown for a miss when it was recorded — maths sittings from before 2026-09-19 did not keep it.
export function MathReviewList({ items, lang }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((r, i) => (
        <div key={i} style={card(i)}>
          {heading(r.correct, `${i + 1}. ${r.question || '—'}`)}
          <div style={{ fontWeight: 700, fontSize: 13, color: r.correct ? GREEN : '#8d83ad', marginLeft: 27 }}>
            {t('math_your_answer', lang)} {r.child_answer ?? '—'}
          </div>
          {!r.correct && r.correct_answer != null && (
            <div style={{ fontWeight: 700, fontSize: 13, color: ORANGE, marginTop: 2, marginLeft: 27 }}>
              {t('math_answer_was', lang)} {r.correct_answer} 💡
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
