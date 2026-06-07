import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PC, FONT, PCSS, TopBar, Btn, Field, GoogleMark } from '../lib/parentUI'

export default function ParentLogin() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'pcss-login'
    el.textContent = PCSS
    if (!document.getElementById('pcss-login')) document.head.appendChild(el)
    return () => { document.getElementById('pcss-login')?.remove() }
  }, [])

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
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100dvh',
      background: PC.bg, fontFamily: FONT,
    }}>
      <TopBar onBack={() => nav('/')} />

      <div style={{ flex: 1, padding: '8px 26px 48px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 440, width: '100%', margin: '0 auto' }}>
        {/* heading */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: PC.ink, letterSpacing: '-.5px', lineHeight: 1.15 }}>
            Welcome back 👋
          </div>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 15, color: PC.inkSoft, marginTop: 6 }}>
            Sign in to your account
          </div>
        </div>

        <Field label="Email">
          <input className="tc-input" type="email" placeholder="name@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        </Field>

        <Field label="Password">
          <input className="tc-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
        </Field>

        {error && (
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13.5, color: PC.danger }}>{error}</div>
        )}

        <Btn onClick={login} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Btn>

        {/* divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: PC.line }} />
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.inkFaint }}>or</span>
          <div style={{ flex: 1, height: 1, background: PC.line }} />
        </div>

        <Btn variant="outline" onClick={googleLogin}>
          <GoogleMark size={20} /> Continue with Google
        </Btn>

        <div style={{ textAlign: 'center', fontFamily: FONT, fontWeight: 600, fontSize: 14, color: PC.inkSoft }}>
          No account?{' '}
          <span style={{ color: PC.teal, fontWeight: 800, cursor: 'pointer' }} onClick={() => nav('/parent/signup')}>
            Sign up free
          </span>
        </div>
      </div>
    </div>
  )
}
