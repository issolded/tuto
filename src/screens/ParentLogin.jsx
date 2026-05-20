import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ParentLogin() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = async () => {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else nav('/parent/dashboard')
  }

  const googleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/parent/dashboard' } })
  }

  return (
    <div className="screen" style={{ background: 'white' }}>
      <div style={{ background: '#4D96FF', padding: '56px 28px 40px', borderRadius: '0 0 40px 40px' }}>
        <button onClick={() => nav('/')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', width: 40, height: 40, borderRadius: 12, fontSize: 18, color: 'white', cursor: 'pointer', marginBottom: 20 }}>←</button>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 30, fontWeight: 800, color: 'white', marginBottom: 4 }}>Welcome back 👋</div>
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: 600 }}>Sign in to your account</div>
      </div>
      <div style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="input-wrap">
          <label>Email</label>
          <input type="email" placeholder="name@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="input-wrap">
          <label>Password</label>
          <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && <div style={{ color: '#FF6B35', fontSize: 14, fontWeight: 600 }}>{error}</div>}
        <button className="btn btn-primary" onClick={login} disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#7A7A9A', fontSize: 13, fontWeight: 700 }}>
          <div style={{ flex: 1, height: 1, background: '#E8E8F0' }} />veya<div style={{ flex: 1, height: 1, background: '#E8E8F0' }} />
        </div>
        <button className="btn btn-ghost" onClick={googleLogin}>🔵 Continue with Google</button>
        <div style={{ textAlign: 'center', color: '#7A7A9A', fontSize: 14, fontWeight: 600 }}>
          No account? <span style={{ color: '#4D96FF', fontWeight: 800, cursor: 'pointer' }} onClick={() => nav('/parent/signup')}>Sign up free</span>
        </div>
      </div>
    </div>
  )
}
