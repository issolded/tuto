import { useEffect, useState } from 'react'
import { childLang, formatDay, localeFor, t } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import TutoMascot from '../components/TutoMascot'
import Shell from '../components/Shell'

const ANIM = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
`

const REASON_LABELS = {
  math:            'My Math 🔢',
  reading:         'My Books 📚',
  writing:         'My Stories ✏️',
  homework:        'My Homework 📸',
  drawing:         'My Drawings 🎨',
  bonus:           'Bonus Gift 🎁',
  story:           'My Stories ✏️',
  adjustment:      'Adjustment ⚖️',
  'Welcome bonus': 'Welcome Bonus 🎉',
  welcome:         'Welcome Bonus 🎉',
}

const REASON_EMOJI = {
  math: '🔢', reading: '📚', writing: '✏️',
  homework: '📸', drawing: '🎨', bonus: '🫴', story: '📖',
  adjustment: '🫳',
  'Welcome bonus': '🎉', welcome: '🎉',
}

function formatDate(dateStr, lang) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return t('gems_today', lang)
  if (d.toDateString() === yesterday.toDateString()) return t('gems_yesterday', lang)
  return formatDay(d, lang, { month: 'short', day: 'numeric' })
}

export default function GemsScreen() {
  const child = JSON.parse(localStorage.getItem('child') || 'null')
  const lang = childLang(child)
  const [ledger, setLedger] = useState(null)

  useEffect(() => {
    if (!child?.id) { setLedger([]); return }
    supabase
      .from('bt_ledger')
      .select('*')
      .eq('child_id', child.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        setLedger(data || [])
      })
  }, [])

  const loading = ledger === null
  const total = (ledger || []).reduce((sum, r) => sum + (r.amount || 0), 0)

  return (
    <Shell active="gems" background="#FFF8E0">
      <style>{ANIM}</style>

      {/* Balance card */}
      <div style={{ background: 'linear-gradient(135deg, #FFD93D 0%, #FFB347 100%)', padding: '52px 24px 36px', borderRadius: '0 0 40px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(45,45,45,0.50)', letterSpacing: '1px', textTransform: 'uppercase' }}>
          Your Gem Balance
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
          <span style={{ fontSize: 48 }}>⭐</span>
          <span style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 58, fontWeight: 900, color: '#2D2D2D', lineHeight: 1 }}>
            {loading ? '—' : total}
          </span>
        </div>
      </div>

      {/* Transaction history */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 20px 80px' }}>
        <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: '#2D2D2D', marginBottom: 14 }}>
          {t('gems_history', lang)}
        </div>

        {loading ? (
          [0, 1, 2, 3].map(i => (
            <div key={i} style={{ background: 'white', borderRadius: 16, height: 64, marginBottom: 10, opacity: 0.35 + i * 0.12 }} />
          ))
        ) : ledger.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingTop: 36, animation: 'fadeUp 0.4s ease both' }}>
            <TutoMascot size={150} expression="default" />
            <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: '#2D2D2D', textAlign: 'center', lineHeight: 1.6 }}>
              {t('gems_none_title', lang)}<br />{t('gems_none_body', lang)}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ledger.map((row, i) => {
              const key = row.reason || row.source || ''
              const isPositive = (row.amount || 0) >= 0
              // Free-text reasons (a reward's own name, a book title, a
              // parent's optional note on a deduction) aren't in the map by
              // design — show them as-is instead of flattening every one of
              // them into a generic "Task", which would hide exactly the
              // detail these were written for.
              // Activity names come from the same dictionary the home tiles use, so a child
              // does not see "My Math" here and "Matematiğim" one screen back. A free-text
              // reason (a reward's own name, a parent's note) is shown as written.
              const TASK_KEYS = { math: 'task_math', reading: 'task_reading', writing: 'task_writing',
                                  story: 'task_writing', homework: 'task_homework', drawing: 'task_drawing' }
              const label = TASK_KEYS[key] ? t(TASK_KEYS[key], lang) : (REASON_LABELS[key] || key || 'Task ⭐')
              const emoji = REASON_EMOJI[key] || (isPositive ? '🫴' : '🫳')
              return (
                <div
                  key={row.id ?? i}
                  style={{ background: 'white', borderRadius: 18, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', animation: `fadeUp 0.35s ease ${Math.min(i, 8) * 0.05}s both` }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: '#FFF8E0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    {emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#2D2D2D' }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#B0A090', marginTop: 2 }}>
                      {row.created_at ? formatDate(row.created_at, lang) : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: isPositive ? '#2EC486' : '#FF6B35', fontFamily: "'TrRound', 'Baloo 2', cursive", whiteSpace: 'nowrap' }}>
                    {isPositive ? '+' : ''}{row.amount} 💎
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </Shell>
  )
}
