import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import TutoMascot from '../components/TutoMascot'
import { supabase } from '../lib/supabase'

const ANIM = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.06); }
}
`

// Read ?code= synchronously — before any render
const codeFromUrl = new URLSearchParams(window.location.search).get('code')

export default function FamilySetup() {
  const nav = useNavigate()
  const [status, setStatus] = useState(codeFromUrl ? 'success' : 'idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [manualError, setManualError] = useState('')
  const [manualLoading, setManualLoading] = useState(false)
  const scannerRef = useRef(null)
  const mountedRef = useRef(true)

  // If code came from URL, save it and redirect immediately
  useEffect(() => {
    if (codeFromUrl) {
      console.log('[FamilySetup] code from URL:', codeFromUrl)
      localStorage.setItem('family_code', codeFromUrl)
      setTimeout(() => nav('/child'), 1400)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopScanner()
    }
  }, [])

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState()
        // state 2 = SCANNING
        if (state === 2) await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch (_) {}
      scannerRef.current = null
    }
  }

  const startScanner = async () => {
    setStatus('scanning')
    setErrorMsg('')

    await stopScanner()

    const scanner = new Html5Qrcode('qr-reader')
    scannerRef.current = scanner

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          if (!mountedRef.current) return
          await stopScanner()

          let familyCode = decodedText.trim()
          // Support JSON payload: { family_code: "..." }
          try {
            const parsed = JSON.parse(decodedText)
            if (parsed.family_code) familyCode = parsed.family_code
          } catch (_) {}

          console.log('[FamilySetup] scanned family_code:', familyCode)
          localStorage.setItem('family_code', familyCode)

          if (mountedRef.current) {
            setStatus('success')
            setTimeout(() => nav('/child'), 1600)
          }
        },
        () => {} // frame errors — ignore
      )
    } catch (e) {
      console.error('[FamilySetup] camera error:', e)
      if (mountedRef.current) {
        setStatus('error')
        setErrorMsg('Camera not available. Check permissions and try again.')
      }
    }
  }

  const submitManualCode = async () => {
    const code = manualCode.trim().toUpperCase()
    if (code.length !== 8) return
    setManualLoading(true)
    setManualError('')
    const { data } = await supabase.from('parents').select('id').eq('family_code', code).single()
    if (data) {
      localStorage.setItem('family_code', code)
      setStatus('success')
      setTimeout(() => nav('/child'), 1400)
    } else {
      setManualError('Code not found. Try again.')
      setManualLoading(false)
    }
  }

  return (
    <div style={{ background: '#1A1A2E', minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 28px 40px', color: 'white' }}>
      <style>{ANIM}</style>

      <div style={{ animation: status === 'success' ? 'pulse 0.6s ease' : 'none' }}>
        <TutoMascot size={110} expression={status === 'success' ? 'excited' : 'default'} />
      </div>

      <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, fontWeight: 900, marginTop: 20, textAlign: 'center', color: '#FFD93D' }}>
        Family Setup
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginTop: 6, textAlign: 'center', lineHeight: 1.6 }}>
        Scan the QR code from your parent's dashboard
      </div>

      {/* QR scanner container — always in DOM while scanning */}
      <div
        id="qr-reader"
        style={{
          width: '100%', maxWidth: 300,
          marginTop: 32,
          borderRadius: 20,
          overflow: 'hidden',
          display: status === 'scanning' ? 'block' : 'none',
          background: '#000',
        }}
      />

      {/* Success state */}
      {status === 'success' && (
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, animation: 'fadeUp 0.4s ease both' }}>
          <div style={{ fontSize: 64 }}>✅</div>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#2EC486', textAlign: 'center' }}>
            Connected! ✅ Code: {localStorage.getItem('family_code')}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
            Now enter your PIN
          </div>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div style={{ marginTop: 24, background: 'rgba(255,59,48,0.15)', borderRadius: 14, padding: '14px 18px', fontSize: 14, fontWeight: 700, color: '#FF6B6B', textAlign: 'center', animation: 'fadeUp 0.3s ease both' }}>
          {errorMsg}
        </div>
      )}

      {/* Buttons */}
      {status !== 'success' && (
        <div style={{ marginTop: 32, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={status === 'scanning' ? () => { stopScanner(); setStatus('idle') } : startScanner}
            style={{
              width: '100%', padding: '18px', border: 'none', borderRadius: 18,
              background: status === 'scanning' ? '#FF6B35' : '#FFD93D',
              color: '#1A1A2E', fontFamily: "'Baloo 2', cursive",
              fontSize: 17, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(255,211,61,0.3)',
            }}
          >
            {status === 'scanning' ? 'Cancel' : '📷 Scan QR Code'}
          </button>

          {/* Manual code entry */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>
              Or enter code manually
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={manualCode}
                onChange={e => {
                  setManualError('')
                  setManualCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8))
                }}
                onKeyDown={e => e.key === 'Enter' && submitManualCode()}
                placeholder="XXXXXXXX"
                maxLength={8}
                style={{
                  flex: 1, padding: '14px 16px', border: '2px solid rgba(255,255,255,0.15)',
                  borderRadius: 14, background: 'rgba(255,255,255,0.08)', color: 'white',
                  fontFamily: 'monospace', fontSize: 18, fontWeight: 800,
                  letterSpacing: 3, outline: 'none', textAlign: 'center',
                  caretColor: '#FFD93D',
                }}
              />
              <button
                onClick={submitManualCode}
                disabled={manualCode.length !== 8 || manualLoading}
                style={{
                  padding: '14px 18px', border: 'none', borderRadius: 14,
                  background: manualCode.length === 8 && !manualLoading ? '#FFD93D' : 'rgba(255,255,255,0.1)',
                  color: manualCode.length === 8 && !manualLoading ? '#1A1A2E' : 'rgba(255,255,255,0.3)',
                  fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800,
                  cursor: manualCode.length === 8 && !manualLoading ? 'pointer' : 'not-allowed',
                  transition: 'background 0.2s, color 0.2s', whiteSpace: 'nowrap',
                }}
              >
                {manualLoading ? '...' : 'Connect →'}
              </button>
            </div>
            {manualError && (
              <div style={{ background: 'rgba(255,59,48,0.15)', borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#FF6B6B', textAlign: 'center' }}>
                {manualError}
              </div>
            )}
          </div>

          <button
            onClick={() => nav('/')}
            style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 18, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  )
}
