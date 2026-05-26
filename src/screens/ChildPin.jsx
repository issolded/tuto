import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'
import { supabase } from '../lib/supabase'
import { hashPin } from '../lib/hash'

async function giveWelcomeBonus(childId) {
  const { count } = await supabase
    .from('bt_ledger')
    .select('*', { count: 'exact', head: true })
    .eq('child_id', childId)
  if (count === 0) {
    await supabase.from('bt_ledger').insert({ child_id: childId, amount: 10, reason: 'Welcome bonus' })
  }
}

export default function ChildPin() {
  const nav = useNavigate()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [expression, setExpression] = useState('default')

  const addPin = (d) => {
    if (checking || pin.length >= 4) return
    const next = pin + d
    setPin(next)
    if (next.length === 4) verifyPin(next)
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
      const pin_hash = await hashPin(entered)
      const { data: children, error: dbError } = await supabase
        .from('children')
        .select('id, name, age')
        .eq('pin_hash', pin_hash)
      if (dbError) {
        console.error('PIN lookup error:', dbError)
        fail("Something went wrong. Try again! 🤔")
        return
      }
      if (children && children.length > 0) {
        const child = children[0]
        sessionStorage.setItem('tuto_child', JSON.stringify(child))
        await giveWelcomeBonus(child.id)
        setExpression('excited')
        setTimeout(() => nav('/child/home'), 350)
      } else {
        fail("Hmm, that's not right! Try again 🤔")
      }
    } catch (e) {
      console.error('verifyPin error:', e)
      fail("Something went wrong. Try again! 🤔")
    }
  }

  return (
    <div className="screen" style={{ background: '#FF6B35', alignItems: 'center', padding: '60px 32px 40px' }}>
      <button onClick={() => nav('/')} style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.2)', border: 'none', width: 40, height: 40, borderRadius: 12, fontSize: 18, color: 'white', cursor: 'pointer', marginBottom: 24 }}>←</button>
      <TutoMascot size={120} expression={expression} />
      <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 28, fontWeight: 800, color: 'white', textAlign: 'center', marginTop: 16 }}>Hi! I'm Tuto 👋</div>
      <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: 600, textAlign: 'center', marginBottom: 32, marginTop: 4 }}>Enter your PIN to start!</div>

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
          <button key={n} onClick={() => addPin(String(n))} disabled={checking} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 20, height: 72, fontSize: 24, fontWeight: 800, fontFamily: 'Nunito', color: 'white', cursor: 'pointer', transition: 'background 0.15s' }}>
            {n}
          </button>
        ))}
        <div />
        <button onClick={() => addPin('0')} disabled={checking} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 20, height: 72, fontSize: 24, fontWeight: 800, fontFamily: 'Nunito', color: 'white', cursor: 'pointer' }}>0</button>
        <button onClick={() => setPin(p => p.slice(0,-1))} disabled={checking} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 20, height: 72, fontSize: 20, fontWeight: 800, fontFamily: 'Nunito', color: 'white', cursor: 'pointer' }}>⌫</button>
      </div>
    </div>
  )
}
