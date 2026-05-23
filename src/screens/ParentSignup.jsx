import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ParentSignup() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const signup = async () => {
    setLoading(true); setError('')
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    if (signUpError) { setError(signUpError.message); setLoading(false); return }
    // Email onayı beklenmeden oturum aç
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) { setError(signInError.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, full_name: name })
    }
    nav('/parent/onboarding')
  }

  const googleSignup = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/parent/onboarding' } })
  }

  return (
    <div className="screen" style={{ background: 'white' }}>
      <div style={{ background: '#2EC486', padding: '56px 28px 40px', borderRadius: '0 0 40px 40px' }}>
        <button onClick={() => nav('/')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', width: 40, height: 40, borderRadius: 12, fontSize: 18, color: 'white', cursor: 'pointer', marginBottom: 20 }}>←</button>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 30, fontWeight: 800, color: 'white', marginBottom: 4 }}>Create account 🌱</div>
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: 600 }}>Sign up for free, get started now</div>
      </div>
      <div style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="input-wrap">
          <label>Full Name</label>
          <input type="text" placeholder="Your Name" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="input-wrap">
          <label>Email</label>
          <input type="email" placeholder="name@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="input-wrap">
          <label>Password</label>
          <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && <div style={{ color: '#FF6B35', fontSize: 14, fontWeight: 600 }}>{error}</div>}
        <button
          className="btn btn-primary"
          onClick={signup}
          disabled={loading}
          style={{ background: '#2EC486', borderColor: '#2EC486' }}
        >
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#7A7A9A', fontSize: 13, fontWeight: 700 }}>
          <div style={{ flex: 1, height: 1, background: '#E8E8F0' }} />veya<div style={{ flex: 1, height: 1, background: '#E8E8F0' }} />
        </div>
        <button className="btn btn-ghost" onClick={googleSignup}>🔵 Continue with Google</button>
        <div style={{ textAlign: 'center', color: '#7A7A9A', fontSize: 14, fontWeight: 600 }}>
          Already have an account? <span style={{ color: '#2EC486', fontWeight: 800, cursor: 'pointer' }} onClick={() => nav('/parent/login')}>Sign In</span>
        </div>
      </div>
    </div>
  )
}
