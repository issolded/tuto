import { useEffect, useState } from 'react'
import { t, childLang } from '../lib/i18n'
import { getChildRewards, getChildGems, getRewardClaims, claimReward, getRewardSuggestions, suggestReward } from '../lib/supabase'
import TutoMascot from '../components/TutoMascot'
import Shell from '../components/Shell'

const ASK_EMOJIS = ['🎁', '🛹', '🧸', '🎮', '📚', '🚲', '🍕', '🎨', '⚽', '🎧']

const ANIM = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes glow {
  0%, 100% { box-shadow: 0 0 0 2.5px #2EC486, 0 6px 20px rgba(46,196,134,0.20); }
  50%       { box-shadow: 0 0 0 2.5px #2EC486, 0 6px 28px rgba(46,196,134,0.40); }
}
.goal-ask-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 12px; border-radius: 8px; outline: none; }
.goal-ask-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 28px; height: 28px; border-radius: 50%; background: #FFD93D; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.18); cursor: pointer; }
.goal-ask-slider::-moz-range-thumb { width: 28px; height: 28px; border-radius: 50%; background: #FFD93D; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.18); cursor: pointer; }
`

function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0
  return (
    <div style={{ background: '#F5F0D0', borderRadius: 10, height: 10, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #FF6B35, #FFD93D)', borderRadius: 10, transition: 'width 0.7s ease' }} />
    </div>
  )
}

function RewardCard({ reward, currentGems, index, claimStatus, claiming, onClaim }) {
  const lang = childLang(JSON.parse(localStorage.getItem('child') || 'null'))
  const needed = reward.bt_cost || 0
  const ready = needed > 0 && currentGems >= needed
  const remaining = Math.max(0, needed - currentGems)
  const pending = claimStatus === 'pending'

  return (
    <div style={{
      background: 'white',
      borderRadius: 24,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      animation: `${ready && !pending ? 'glow' : 'fadeUp'} ${ready && !pending ? '2s ease infinite' : `0.4s ease ${index * 0.07}s both`}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: '#FFF8E0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
          {reward.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#2D2D2D', marginBottom: 2 }}>{reward.name}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#C8900A' }}>⭐ {needed} Gems needed</div>
        </div>
        {ready && !pending && <div style={{ fontSize: 26, animation: 'fadeUp 0.3s ease both' }}>🎉</div>}
      </div>

      <ProgressBar current={currentGems} total={needed} />

      {pending ? (
        <div style={{ fontSize: 13, fontWeight: 700, color: '#C8900A' }}>⏳ Waiting for your parent to approve</div>
      ) : ready ? (
        <button
          onClick={onClaim}
          disabled={claiming}
          style={{
            border: 'none', borderRadius: 14, padding: '11px', width: '100%',
            fontSize: 14, fontWeight: 800, color: 'white', cursor: claiming ? 'default' : 'pointer',
            background: claiming ? '#9ED9BE' : '#2EC486', boxShadow: claiming ? 'none' : '0 6px 16px rgba(46,196,134,0.35)',
          }}
        >
          {claiming ? t('goal_claiming', lang) : t('goal_claim', lang)}
        </button>
      ) : (
        <div style={{ fontSize: 13, fontWeight: 700, color: '#7A7A9A' }}>
          {remaining} more Gems to go!
        </div>
      )}
    </div>
  )
}

// What the child asked for, still waiting. Deliberately quieter than a real goal card:
// there is no progress bar and no number in gems, because nothing has been decided yet
// and a figure shown here would read as a price the child had already been granted.
function PendingAskCard({ suggestion, index, lang }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.65)', borderRadius: 24, padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 14,
      border: '2px dashed #E8D9A0',
      animation: `fadeUp 0.4s ease ${index * 0.07}s both`,
    }}>
      <div style={{ width: 46, height: 46, borderRadius: 15, background: '#FFF8E0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 25, flexShrink: 0, opacity: 0.75 }}>
        {suggestion.icon || '🎁'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#7A7A9A', marginBottom: 2 }}>{suggestion.name}</div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#A9A9BE' }}>⏳ {t('goal_asked_waiting', lang)}</div>
      </div>
    </div>
  )
}

function AskSheet({ lang, onClose, onSubmit }) {
  const [icon, setIcon] = useState('🎁')
  const [name, setName] = useState('')
  const [gems, setGems] = useState(100)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    if (!name.trim()) return setError(t('goal_ask_needname', lang))
    setSending(true); setError('')
    try {
      await onSubmit({ name: name.trim(), icon, gems })
    } catch (err) {
      setError(err.message === 'too many pending requests' ? t('goal_ask_toomany', lang) : err.message)
      setSending(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(45,45,45,0.45)', zIndex: 60, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#FFF8E0', width: '100%', borderRadius: '28px 28px 0 0', padding: '24px 22px 30px',
        display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '88vh', overflowY: 'auto',
        animation: 'fadeUp 0.28s ease both',
      }}>
        <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 23, fontWeight: 900, color: '#2D2D2D' }}>
          {t('goal_ask_title', lang)}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ASK_EMOJIS.map(e => (
            <button key={e} onClick={() => setIcon(e)} style={{
              width: 46, height: 46, borderRadius: 15, fontSize: 24, cursor: 'pointer',
              border: `3px solid ${icon === e ? '#2EC486' : 'transparent'}`,
              background: icon === e ? 'white' : 'rgba(255,255,255,0.6)',
            }}>{e}</button>
          ))}
        </div>

        <div>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#7A7A9A', marginBottom: 7 }}>{t('goal_ask_name', lang)}</div>
          <input value={name} onChange={e => { setName(e.target.value); setError('') }} maxLength={60}
            placeholder={t('goal_ask_name_ph', lang)}
            style={{ width: '100%', boxSizing: 'border-box', border: 'none', borderRadius: 16, padding: '14px 16px', fontSize: 16, fontWeight: 700, color: '#2D2D2D', outline: 'none', background: 'white' }} />
        </div>

        <div>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#7A7A9A', marginBottom: 7 }}>{t('goal_ask_gems', lang)}</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#C8900A', marginBottom: 6 }}>⭐ {gems}</div>
          <input type="range" min={10} max={1000} step={10} value={gems}
            onChange={e => setGems(Number(e.target.value))}
            className="goal-ask-slider"
            style={{ background: `linear-gradient(to right, #FFD93D ${((gems - 10) / 990) * 100}%, #F5F0D0 ${((gems - 10) / 990) * 100}%)` }} />
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#A9A9BE', marginTop: 6, lineHeight: 1.5 }}>
            {t('goal_ask_note', lang)}
          </div>
        </div>

        {error && <div style={{ fontSize: 13.5, fontWeight: 800, color: '#E5484D' }}>{error}</div>}

        <button onClick={send} disabled={sending} style={{
          border: 'none', borderRadius: 18, padding: '15px', width: '100%', fontSize: 16, fontWeight: 900,
          color: 'white', cursor: sending ? 'default' : 'pointer',
          background: sending ? '#9ED9BE' : '#2EC486', boxShadow: sending ? 'none' : '0 6px 16px rgba(46,196,134,0.35)',
        }}>{sending ? t('goal_ask_sending', lang) : t('goal_ask_send', lang)}</button>
        <button onClick={onClose} style={{
          border: 'none', borderRadius: 18, padding: '13px', width: '100%', fontSize: 15, fontWeight: 800,
          color: '#7A7A9A', background: 'transparent', cursor: 'pointer',
        }}>{t('goal_ask_cancel', lang)}</button>
      </div>
    </div>
  )
}

export default function GoalsScreen() {
  const lang = childLang(JSON.parse(localStorage.getItem('child') || 'null'))
  const child = JSON.parse(localStorage.getItem('child') || 'null')
  const [rewards, setRewards] = useState(null)
  const [gems, setGems] = useState(null)
  const [claims, setClaims] = useState([])
  const [claimingId, setClaimingId] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    if (!child?.id) { setRewards([]); setGems(0); return }
    Promise.all([
      getChildRewards(child.id),
      getChildGems(child.id),
      getRewardClaims(child.id),
      getRewardSuggestions(child.id),
    ]).then(([rewardData, gemCount, claimData, suggestionData]) => {
      setRewards(rewardData)
      setGems(gemCount)
      setClaims(claimData)
      setSuggestions(suggestionData)
    })
  }, [])

  async function handleAsk({ name, icon, gems: wanted }) {
    const suggestion = await suggestReward(child.id, { name, icon, gems: wanted })
    setSuggestions(prev => [suggestion, ...prev])
    setAsking(false)
  }

  const loading = rewards === null || gems === null

  // Only the pending ones block re-claiming — a rejected claim shouldn't stop
  // the child from trying again once they've earned more gems.
  const pendingByReward = Object.fromEntries(
    claims.filter(c => c.status === 'pending').map(c => [c.reward_id, c])
  )

  async function handleClaim(reward) {
    if (!child?.id || claimingId) return
    setClaimingId(reward.id)
    try {
      const claim = await claimReward(child.id, reward.id)
      setClaims(prev => [claim, ...prev.filter(c => c.id !== claim.id)])
      // Escrow: the server deducts the gems immediately, at claim time (not
      // waiting for parent approval) — this button only ever renders when no
      // claim is already pending for this reward, so a successful call here
      // is always a fresh deduction, never a repeat of an existing one.
      setGems(prev => (prev ?? 0) - reward.bt_cost)
    } catch (err) {
      console.error('[claimReward]', err.message)
    } finally {
      setClaimingId(null)
    }
  }

  return (
    <Shell active="goals" background="#FFF8E0">
      <style>{ANIM}</style>

      {/* Header */}
      <div style={{ background: '#FFD93D', padding: '52px 24px 28px', borderRadius: '0 0 32px 32px' }}>
        <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 28, fontWeight: 900, color: '#2D2D2D', lineHeight: 1.1 }}>
          {t('goals_title', lang)}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(45,45,45,0.60)', marginTop: 4 }}>
          {gems !== null ? `⭐ ${gems} Gems available` : ' '}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px 20px 80px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? (
          [0, 1, 2].map(i => (
            <div key={i} style={{ background: 'white', borderRadius: 24, height: 116, opacity: 0.4 + i * 0.15 }} />
          ))
        ) : rewards.length === 0 && suggestions.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, paddingTop: 40 }}>
            <TutoMascot size={150} expression="default" style={{ animation: 'fadeUp 0.4s ease both' }} />
            <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: '#2D2D2D', textAlign: 'center', lineHeight: 1.6, animation: 'fadeUp 0.4s ease 0.1s both' }}>
              No goals yet!<br />Ask your parent to add some 🎯
            </div>
          </div>
        ) : (
          rewards.map((reward, i) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              currentGems={gems}
              index={i}
              claimStatus={pendingByReward[reward.id]?.status}
              claiming={claimingId === reward.id}
              onClaim={() => handleClaim(reward)}
            />
          ))
        )}

        {!loading && suggestions.map((s, i) => (
          <PendingAskCard key={s.id} suggestion={s} index={i} lang={lang} />
        ))}

        {!loading && (
          <button onClick={() => setAsking(true)} style={{
            border: '2.5px dashed #E8D9A0', background: 'rgba(255,255,255,0.5)', borderRadius: 24,
            padding: '16px', width: '100%', fontSize: 15, fontWeight: 800, color: '#7A7A9A',
            cursor: 'pointer', animation: 'fadeUp 0.4s ease 0.15s both',
          }}>
            ✨ {t('goal_ask', lang)}
          </button>
        )}
      </div>

      {asking && <AskSheet lang={lang} onClose={() => setAsking(false)} onSubmit={handleAsk} />}

    </Shell>
  )
}
