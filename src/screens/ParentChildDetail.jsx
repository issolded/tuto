import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TutoMascot from '../components/TutoMascot'

const TASK_LABELS = {
  math:    { label: 'My Math',    emoji: '🔢' },
  reading: { label: 'My Books',   emoji: '📚' },
  writing: { label: 'My Stories', emoji: '✏️' },
  chore:   { label: 'My House',   emoji: '🏠' },
  story:   { label: 'My Stories', emoji: '📖' },
  bonus:   { label: 'Bonus Gift', emoji: '🎁' },
}

function isToday(dateStr) {
  return new Date(dateStr).toDateString() === new Date().toDateString()
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, color: '#2D2D2D', marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  )
}

function EmptyCard({ text }) {
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', fontSize: 13, fontWeight: 700, color: '#7A7A9A', textAlign: 'center' }}>
      {text}
    </div>
  )
}

function SubmissionCard({ sub, onApprove, onReject }) {
  const meta = TASK_LABELS[sub.task_type] || { label: 'Task', emoji: '⭐' }
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 24 }}>{meta.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#2D2D2D' }}>{meta.label}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#B0A090' }}>
            {sub.created_at ? new Date(sub.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#FF6B35' }}>+{sub.gems_earned ?? 0} ⭐</div>
      </div>
      {sub.media_url && (
        <img src={sub.media_url} alt="submission" style={{ width: '100%', borderRadius: 10, maxHeight: 200, objectFit: 'cover' }} />
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onApprove}
          style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 12, background: '#2EC486', color: 'white', fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
        >✓ Approve</button>
        <button
          onClick={onReject}
          style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 12, background: '#FF3B30', color: 'white', fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
        >✕ Reject</button>
      </div>
    </div>
  )
}

export default function ParentChildDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [child, setChild] = useState(null)
  const [gems, setGems] = useState(null)
  const [submissions, setSubmissions] = useState(null)
  const [rewards, setRewards] = useState(null)

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('children').select('*').eq('id', id).single(),
      supabase.from('bt_ledger').select('amount').eq('child_id', id),
      supabase.from('submissions').select('*').eq('child_id', id).order('created_at', { ascending: false }),
      supabase.from('rewards').select('*').eq('child_id', id).order('gems'),
    ]).then(([{ data: childData }, { data: ledgerData }, { data: subData }, { data: rewardData }]) => {
      setChild(childData)
      setGems((ledgerData || []).reduce((sum, r) => sum + (r.amount || 0), 0))
      setSubmissions(subData || [])
      setRewards(rewardData || [])
    })
  }, [id])

  const loading = !child || gems === null || submissions === null || rewards === null

  const pending   = (submissions || []).filter(s => s.status === 'pending')
  const todayDone = (submissions || []).filter(s => s.status === 'approved' && isToday(s.created_at))

  async function handleApprove(sub) {
    await Promise.all([
      supabase.from('submissions').update({ status: 'approved' }).eq('id', sub.id),
      supabase.from('bt_ledger').insert({ child_id: id, amount: sub.gems_earned ?? 30, reason: sub.task_type || 'task' }),
    ])
    setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'approved' } : s))
    setGems(prev => (prev ?? 0) + (sub.gems_earned ?? 30))
  }

  async function handleReject(subId) {
    await supabase.from('submissions').update({ status: 'rejected' }).eq('id', subId)
    setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, status: 'rejected' } : s))
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#FFF8F0' }}>
      <TutoMascot size={100} />
    </div>
  )

  return (
    <div style={{ background: '#FFF8F0', minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: '#FF6B35', padding: '52px 24px 28px', borderRadius: '0 0 32px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <button
            onClick={() => nav('/parent/dashboard')}
            style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >←</button>
          <div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, fontWeight: 900, color: 'white', lineHeight: 1.1 }}>{child.name}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{child.age} years old</div>
          </div>
        </div>

        {/* Gem balance */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.25)', borderRadius: 20, padding: '8px 18px' }}>
          <span style={{ fontSize: 20 }}>⭐</span>
          <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: 'white' }}>{gems} Gems</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '24px 20px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Pending approvals */}
        <Section title={`⏳ Pending Approvals${pending.length > 0 ? ` (${pending.length})` : ''}`}>
          {pending.length === 0 ? (
            <EmptyCard text="No pending tasks — all caught up! ✅" />
          ) : (
            pending.map(sub => (
              <SubmissionCard
                key={sub.id}
                sub={sub}
                onApprove={() => handleApprove(sub)}
                onReject={() => handleReject(sub.id)}
              />
            ))
          )}
        </Section>

        {/* Today's completed tasks */}
        <Section title="✅ Completed Today">
          {todayDone.length === 0 ? (
            <EmptyCard text="Nothing completed yet today." />
          ) : (
            todayDone.map(sub => {
              const meta = TASK_LABELS[sub.task_type] || { label: 'Task', emoji: '⭐' }
              return (
                <div key={sub.id} style={{ background: 'white', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <span style={{ fontSize: 22 }}>{meta.emoji}</span>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 800, color: '#2D2D2D' }}>{meta.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#2EC486' }}>+{sub.gems_earned ?? 0} ⭐</div>
                </div>
              )
            })
          )}
        </Section>

        {/* Reward goals */}
        <Section title="🏆 Reward Goals">
          {rewards.length === 0 ? (
            <EmptyCard text="No reward goals set yet." />
          ) : (
            rewards.map(r => {
              const pct = r.gems > 0 ? Math.min(100, Math.round((gems / r.gems) * 100)) : 0
              const ready = gems >= r.gems
              return (
                <div key={r.id} style={{ background: 'white', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 26 }}>{r.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#2D2D2D' }}>{r.name}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#C8900A' }}>⭐ {r.gems} gems needed</div>
                    </div>
                    {ready && <span style={{ fontSize: 20 }}>🎉</span>}
                  </div>
                  <div style={{ background: '#F5F0D0', borderRadius: 8, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: ready ? '#2EC486' : 'linear-gradient(90deg, #FF6B35, #FFD93D)', borderRadius: 8, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: ready ? '#2EC486' : '#7A7A9A' }}>
                    {ready ? 'Ready to claim! 🎉' : `${Math.max(0, r.gems - gems)} more gems to go`}
                  </div>
                </div>
              )
            })
          )}
        </Section>

        {/* Settings */}
        <button
          onClick={() => nav(`/parent/child/${id}/settings`)}
          style={{ background: 'white', border: '2px solid #FFD3C2', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        >
          <span style={{ fontSize: 22 }}>⚙️</span>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: '#2D2D2D' }}>Task Settings</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#7A7A9A', marginTop: 2 }}>Adjust gem amounts per task</div>
          </div>
          <span style={{ fontSize: 18, color: '#C0C0D0' }}>›</span>
        </button>
      </div>
    </div>
  )
}
