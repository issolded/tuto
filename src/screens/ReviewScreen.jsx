import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { t, childLang, formatDay } from '../lib/i18n'
import { useUiLang } from '../lib/parentI18n'
import { useIsTablet } from '../components/Shell'
import { PuzzleReviewList, MathReviewList } from '../components/SittingReview'
import { ensureIconFont } from '../lib/puzzleIcons'

// A finished maths or puzzle sitting, opened again. The child reaches it from a gem history row,
// the parent from the child's card — the same questions and marks either way, because what a
// parent is looking at when their child asks "why was that wrong?" should be what the child saw.
//
//   /child/review/:ledgerId           the child's own, in the child's language
//   /parent/child/:id/review/:ledgerId the parent's, in the parent's language

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'
const INK = '#241f3a'
const INK_SOFT = '#8d83ad'
const FRED = "'TrRound', 'Fredoka', 'Baloo 2', sans-serif"
const ANIM = '@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }'

export default function ReviewScreen({ parent = false }) {
  const nav = useNavigate()
  const { id, ledgerId } = useParams()
  const isTablet = useIsTablet()
  const parentLang = useUiLang()
  const stored = JSON.parse(localStorage.getItem('child') || 'null')
  const childId = parent ? id : stored?.id
  const lang = parent ? parentLang : childLang(stored)
  const [data, setData] = useState(null)      // the server's review, or { error } when there is none

  useEffect(() => {
    if (!childId || !ledgerId) return
    let gone = false
    // Puzzle sheets can carry icons; their font is what draws them.
    Promise.all([
      fetch(`${SERVER}/api/children/${childId}/review/${ledgerId}?lang=${lang}`).then(r => r.json()),
      ensureIconFont().catch(() => {}),
    ]).then(([j]) => { if (!gone) setData(j) }, () => { if (!gone) setData({ error: 'failed' }) })
    return () => { gone = true }
  }, [childId, ledgerId, lang])

  const back = () => (parent ? nav(`/parent/child/${id}`) : nav('/child/gems'))
  const title = data?.kind === 'puzzle' ? t('task_puzzle', lang) : data?.kind === 'math' ? t('task_math', lang) : ''
  const score = data?.kind === 'puzzle' ? `${data.correct ?? 0}/${data.total ?? 0}`
    : data?.kind === 'math' ? `${data.items.filter(r => r.correct).length}/${data.items.length}` : ''

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(172deg,#E8F8F6 0%,#CDEEEA 100%)',
      maxWidth: isTablet ? 900 : 480, margin: '0 auto', display: 'flex', flexDirection: 'column',
    }}>
      <style>{ANIM}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px 8px' }}>
        <button onClick={back} aria-label={t('dr_back', lang)} style={{
          width: 42, height: 42, borderRadius: 14, background: 'rgba(255,255,255,0.85)', border: 'none',
          fontSize: 19, color: INK, fontWeight: 800, cursor: 'pointer', boxShadow: '0 3px 10px rgba(40,30,70,.1)',
        }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FRED, fontWeight: 600, fontSize: 19, color: INK }}>{title}</div>
          {data?.at && <div style={{ fontWeight: 700, fontSize: 12.5, color: INK_SOFT }}>{formatDay(data.at, lang)} · {score}</div>}
        </div>
      </div>

      <div style={{ padding: '8px 18px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!data ? (
          <div style={{ textAlign: 'center', color: INK_SOFT, fontWeight: 700, padding: 40 }}>{t('review_loading', lang)}</div>
        ) : data.kind === 'puzzle' && data.questions ? (
          <PuzzleReviewList questions={data.questions} answers={data.answers} lang={lang} px={isTablet ? 56 : 40} />
        ) : data.kind === 'math' && data.items?.length ? (
          <MathReviewList items={data.items} lang={lang} />
        ) : (
          // A sitting from before the sheets were kept, or a row nothing can be found behind:
          // said plainly, with the score where there is one, rather than an empty page.
          <div style={{ background: 'white', borderRadius: 16, padding: '18px 16px', fontWeight: 700, fontSize: 14, color: INK, lineHeight: 1.5, textAlign: 'center' }}>
            {data.reason === 'sheet_changed' ? t('review_sheet_gone', lang) : t('review_none', lang)}
          </div>
        )}
      </div>
    </div>
  )
}
