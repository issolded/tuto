import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PC, FONT, PCSS, TopBar, Btn, Field, GoogleMark } from '../lib/parentUI'
import { useT, uiLang } from '../lib/parentI18n'

export default function ParentSignup() {
  const nav = useNavigate()
  const s = useT()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'pcss-signup'
    el.textContent = PCSS
    if (!document.getElementById('pcss-signup')) document.head.appendChild(el)
    return () => { document.getElementById('pcss-signup')?.remove() }
  }, [])

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
      // The language they picked on the splash screen becomes the language Tuto writes to them
      // in. Merged into prefs rather than replacing it: the row already carries the column
      // default's other keys (notify_level, approval_required…) and overwriting the object
      // would quietly reset settings this screen knows nothing about.
      const { data: row } = await supabase.from('parents').select('prefs').eq('id', data.user.id).maybeSingle()
      await supabase.from('parents')
        .update({ full_name: name, prefs: { ...(row?.prefs || {}), language: uiLang() } })
        .eq('id', data.user.id)
    }
    nav('/parent/onboarding')
  }

  const googleSignup = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/parent/onboarding' } })
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
            {s('su_title')}
          </div>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 15, color: PC.inkSoft, marginTop: 6 }}>
            {s('su_sub')}
          </div>
        </div>

        <Field label={s('su_name')}>
          <input className="tc-input" type="text" placeholder={s('su_name_ph')} value={name} onChange={e => setName(e.target.value)} />
        </Field>

        <Field label={s('li_email')}>
          <input className="tc-input" type="email" placeholder="name@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        </Field>

        <Field label={s('li_password')}>
          <input className="tc-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
        </Field>

        {error && (
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13.5, color: PC.danger }}>{error}</div>
        )}

        <Btn onClick={signup} disabled={loading}>
          {loading ? s('su_creating') : s('su_create')}
        </Btn>

        {/* divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: PC.line }} />
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PC.inkFaint }}>{s('li_or')}</span>
          <div style={{ flex: 1, height: 1, background: PC.line }} />
        </div>

        <Btn variant="outline" onClick={googleSignup}>
          <GoogleMark size={20} /> {s('li_google')}
        </Btn>

        <div style={{ textAlign: 'center', fontFamily: FONT, fontWeight: 600, fontSize: 14, color: PC.inkSoft }}>
          {s('su_have_account')}{' '}
          <span style={{ color: PC.teal, fontWeight: 800, cursor: 'pointer' }} onClick={() => nav('/parent/login')}>
            {s('li_signin')}
          </span>
        </div>
      </div>
    </div>
  )
}
