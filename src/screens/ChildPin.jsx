import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'
import { supabase, getChildrenByFamilyCode } from '../lib/supabase'
import { useT } from '../lib/parentI18n'

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'

async function giveWelcomeBonus(childId) {
  // Counts rows that actually moved gems. The ledger also carries sessions that hit
  // the day's limit and earned nothing (amount 0), and one of those is not a reason
  // to decide this child has already been welcomed.
  const { count } = await supabase
    .from('bt_ledger')
    .select('*', { count: 'exact', head: true })
    .eq('child_id', childId)
    .neq('amount', 0)
  if (count === 0) {
    await supabase.from('bt_ledger').insert({ child_id: childId, amount: 10, reason: 'Welcome bonus' })
  }
}

export default function ChildPin() {
  const nav = useNavigate()
  const s = useT()
  const [pin, setPin] = useState('')
  const [selectedChildId, setSelectedChildId] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [expression, setExpression] = useState('default')
  // null = still loading, 'unreachable' = lookup failed, [] = family really has no children
  const [familyChildren, setFamilyChildren] = useState(null)
  const [forgot, setForgot] = useState(false)

  const familyCode = localStorage.getItem('family_code')

  // Load children for this family on mount
  useEffect(() => {
    if (!familyCode) { nav('/setup', { replace: true }); return }
    getChildrenByFamilyCode(familyCode).then(children => {
      setFamilyChildren(children === null ? 'unreachable' : children)
    })
  }, [])

  const addPin = (d) => {
    if (checking || pin.length >= 4 || (familyChildren?.length > 1 && !selectedChildId)) return
    const next = pin + d
    setPin(next)
    if (next.length === 4) verifyPin(next)
  }

  // Nothing is reset from here: it only tells the parent, who makes a new PIN (see /forgot-pin on the server).
  const forgotPin = async () => {
    setForgot(true)
    try {
      await fetch(`${SERVER}/api/family/${encodeURIComponent(familyCode)}/forgot-pin`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: selectedChildId || (familyChildren?.length === 1 ? familyChildren[0].id : undefined) }),
      })
    } catch { /* the child still sees that they asked; the parent hears at the next try */ }
  }

  const fail = (msg) => {
    setError(msg)
    setExpression('default')
    setPin('')
    setChecking(false)
  }

  const verifyPin = async (entered) => {
    setChecking(true)
    setError('')
    setExpression('thinking')
    try {
      // Checked on the server. It used to be compared here against pin_hash values the family
      // lookup handed over, which made a four-digit PIN 10,000 offline guesses and left no
      // point at which anything could be counted.
      const res = await fetch(`${SERVER}/api/family/${encodeURIComponent(familyCode)}/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: entered, child_id: selectedChildId || familyChildren?.[0]?.id }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data.child) {
        // task_settings decides which activities the child is shown and what each is worth;
        // language decides what they are shown in. Both come back with the row.
        localStorage.setItem('child', JSON.stringify(data.child))
        await giveWelcomeBonus(data.child.id)
        setExpression('excited')
        setTimeout(() => nav('/child/home'), 350)
      } else if (res.status === 429) {
        const mins = Math.max(1, Math.ceil((data.retry_in_seconds ?? 60) / 60))
        fail(s('cp_too_many', { n: mins }))
      } else if (typeof data.attempts_left === 'number' && data.attempts_left <= 2) {
        fail(data.attempts_left === 1 ? s('cp_wrong_left_one') : s('cp_wrong_left', { n: data.attempts_left }))
      } else {
        fail(s('cp_wrong'))
      }
    } catch (e) {
      console.error('verifyPin error:', e)
      fail(s('cp_went_wrong'))
    }
  }

  // A PIN pad is only worth showing when there is something to check it against. These two
  // cases used to fall through to it and then fail every attempt with "that's not right",
  // which blamed the child for a device that was never linked, or for a server they could
  // not reach.
  const notice = (title, cta) => (
    <div className="screen" style={{ background: '#1A1A2E', alignItems: 'center', padding: '60px 32px 40px' }}>
      <TutoMascot size={120} expression="default" />
      <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#FFD93D', textAlign: 'center', marginTop: 20, lineHeight: 1.5 }}>
        {title}
      </div>
      {cta}
    </div>
  )

  if (familyChildren === 'unreachable') return notice(
    s('cp_unreachable'),
    <button onClick={() => window.location.reload()}
      style={{ marginTop: 32, background: '#FFD93D', color: '#1A1A2E', border: 'none', borderRadius: 18, padding: '16px 40px', fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 17, fontWeight: 800, cursor: 'pointer' }}>
      {s('cp_try_again')}
    </button>
  )

  if (Array.isArray(familyChildren) && familyChildren.length === 0) return notice(
    s('cp_not_setup'),
    <button onClick={() => nav('/setup')}
      style={{ marginTop: 32, background: '#FFD93D', color: '#1A1A2E', border: 'none', borderRadius: 18, padding: '16px 40px', fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 17, fontWeight: 800, cursor: 'pointer' }}>
      {s('cp_setup_device')}
    </button>
  )

  // No family code — prompt setup
  if (!familyCode) return (
    <div className="screen" style={{ background: '#1A1A2E', alignItems: 'center', padding: '60px 32px 40px' }}>
      <TutoMascot size={120} expression="default" />
      <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#FFD93D', textAlign: 'center', marginTop: 20, lineHeight: 1.5 }}>
        {s('cp_scan_first')}
      </div>
      <button
        onClick={() => nav('/setup')}
        style={{ marginTop: 32, background: '#FFD93D', color: '#1A1A2E', border: 'none', borderRadius: 18, padding: '16px 40px', fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 17, fontWeight: 800, cursor: 'pointer' }}
      >
        {s('cp_setup_device')}
      </button>
    </div>
  )

  return (
    <div className="screen" style={{ background: '#FF6B35', alignItems: 'center', padding: '60px 32px 40px' }}>
      <button onClick={() => nav('/')} style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.2)', border: 'none', width: 40, height: 40, borderRadius: 12, fontSize: 18, color: 'white', cursor: 'pointer', marginBottom: 24 }}>←</button>
      <TutoMascot size={120} expression={expression} />
      <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontSize: 28, fontWeight: 800, color: 'white', textAlign: 'center', marginTop: 16 }}>{s('cp_hi')}</div>
      <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: 600, textAlign: 'center', marginBottom: 8, marginTop: 4 }}>{s('cp_enter_pin')}</div>
      {Array.isArray(familyChildren) && familyChildren.length > 1 && <div style={{ width: '100%', maxWidth: 320, margin: '12px 0 20px' }}>
        <label htmlFor="child-profile" style={{ display: 'block', color: 'white', marginBottom: 8, fontWeight: 800 }}>{s('cp_choose_child')}</label>
        <select id="child-profile" value={selectedChildId} disabled={checking} onChange={e => { setSelectedChildId(e.target.value); setPin(''); setError('') }} style={{ width: '100%', padding: 14, borderRadius: 14, font: 'inherit', background: 'white', color: '#1A1A2E' }}>
          <option value="">{s('cp_choose_child')}</option>
          {familyChildren.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width: 20, height: 20, borderRadius: '50%', background: pin.length > i ? 'white' : 'rgba(255,255,255,0.3)', transition: 'background 0.2s, transform 0.2s', transform: pin.length > i ? 'scale(1.1)' : 'scale(1)' }} />
        ))}
      </div>

      {error ? (
        <div style={{ color: 'white', fontSize: 13, fontWeight: 700, background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '8px 16px', marginBottom: 16 }}>{error}</div>
      ) : (
        <div style={{ height: 37, marginBottom: 16 }} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%', maxWidth: 280 }}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} onClick={() => addPin(String(n))} disabled={checking || (familyChildren?.length > 1 && !selectedChildId)} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 20, height: 72, fontSize: 24, fontWeight: 800, fontFamily: 'Nunito', color: 'white', cursor: 'pointer', transition: 'background 0.15s' }}>
            {n}
          </button>
        ))}
        <div />
        <button onClick={() => addPin('0')} disabled={checking || (familyChildren?.length > 1 && !selectedChildId)} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 20, height: 72, fontSize: 24, fontWeight: 800, fontFamily: 'Nunito', color: 'white', cursor: 'pointer' }}>0</button>
        <button onClick={() => setPin(p => p.slice(0,-1))} disabled={checking || (familyChildren?.length > 1 && !selectedChildId)} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 20, height: 72, fontSize: 20, fontWeight: 800, fontFamily: 'Nunito', color: 'white', cursor: 'pointer' }}>⌫</button>
      </div>

      {forgot ? (
        <div style={{ marginTop: 22, color: 'white', fontSize: 15, fontWeight: 700, background: 'rgba(0,0,0,0.2)', borderRadius: 14, padding: '10px 18px', textAlign: 'center', maxWidth: 300, lineHeight: 1.4 }}>{s('cp_forgot_sent')}</div>
      ) : (
        <button onClick={forgotPin} style={{ marginTop: 22, background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: 800, fontFamily: 'Nunito', textDecoration: 'underline', cursor: 'pointer' }}>{s('cp_forgot')}</button>
      )}
    </div>
  )
}
