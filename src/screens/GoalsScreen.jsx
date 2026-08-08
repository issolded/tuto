import { useEffect, useState } from 'react'
import { t, childLang } from '../lib/i18n'
import { getChildRewards, getChildGems, getRewardClaims, claimReward } from '../lib/supabase'
import TutoMascot from '../components/TutoMascot'
import Shell from '../components/Shell'

const ANIM = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes glow {
  0%, 100% { box-shadow: 0 0 0 2.5px #2EC486, 0 6px 20px rgba(46,196,134,0.20); }
  50%       { box-shadow: 0 0 0 2.5px #2EC486, 0 6px 28px rgba(46,196,134,0.40); }
}
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

export default function GoalsScreen() {
  const child = JSON.parse(localStorage.getItem('child') || 'null')
  const [rewards, setRewards] = useState(null)
  const [gems, setGems] = useState(null)
  const [claims, setClaims] = useState([])
  const [claimingId, setClaimingId] = useState(null)

  useEffect(() => {
    if (!child?.id) { setRewards([]); setGems(0); return }
    Promise.all([
      getChildRewards(child.id),
      getChildGems(child.id),
      getRewardClaims(child.id),
    ]).then(([rewardData, gemCount, claimData]) => {
      setRewards(rewardData)
      setGems(gemCount)
      setClaims(claimData)
    })
  }, [])

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
          My Goals 🏆
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
        ) : rewards.length === 0 ? (
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
      </div>

    </Shell>
  )
}
