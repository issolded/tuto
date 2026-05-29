import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { evaluateTask, generateTask, evaluateChore } from '../lib/gemini'
import { supabase } from '../lib/supabase'

const ACCENT = '#FF6B35'
const CHORE_ACCENT = '#FF8C42'
const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'

const FLOAT_CSS = `
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-10px); }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
`

const LOADING_MESSAGES = {
  math:    ['Ooh, big numbers! Let me put on my thinking cap... 🤓', 'Counting every answer carefully... 🔢', 'Double-checking the tricky ones... 🧮'],
  writing: ['A story! Let me read every word carefully... 📖', 'Reading through your composition... ✍️', 'Checking your ideas and spelling... 🌟'],
  reading: ['Let me see what you\'ve been reading... 🧐', 'Going through your summary... 📚', 'Comparing your notes to the book... 🔍'],
}

async function addToLedger(childId, amount, reason) {
  if (!childId) return
  await supabase.from('bt_ledger').insert({ child_id: childId, amount, reason })
}

async function uploadPhoto(file, childId) {
  const path = `${childId ?? 'anonymous'}/${Date.now()}.jpg`
  const { error } = await supabase.storage
    .from('submissions')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('submissions').getPublicUrl(path)
  return data.publicUrl
}

async function saveSubmission(childId, taskType, result, photoUrl) {
  const payload = {
    child_id: childId || null,
    task_type: taskType,
    score: result.score ?? null,
    gems_earned: Math.round(result.gem_earned ?? 0),
    feedback: result.feedback ?? null,
    generated_questions: result.generated_questions ?? [],
    photo_urls: photoUrl ? [photoUrl] : [],
  }
  const { data, error } = await supabase.from('submissions').insert(payload).select('id').single()
  if (error) throw error
  console.log('Submission kaydedildi, id:', data?.id)
}

function ResultCard({ result, taskType }) {
  const gems = Math.round(result.gem_earned ?? 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'white', borderRadius: 24, padding: '24px 20px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: '#FFF0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, fontWeight: 800, color: ACCENT, lineHeight: 1 }}>{result.score ?? '—'}</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#7A7A9A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>score</div>
        </div>
        <div style={{ flex: 1 }}>
          {taskType === 'math' && (
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 4 }}>
              {result.correct} / {result.total} doğru
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 600, color: '#7A7A9A', lineHeight: 1.5 }}>{result.feedback}</div>
        </div>
      </div>
      <div style={{ background: ACCENT, borderRadius: 24, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 8px 24px rgba(255,107,53,0.35)' }}>
        <div style={{ fontSize: 40 }}>💎</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>You earned!</div>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 30, fontWeight: 800, color: 'white', lineHeight: 1 }}>+{gems} Gem</div>
        </div>
      </div>
      <button className="btn btn-ghost" onClick={() => window.history.back()}>Back to Home</button>
    </div>
  )
}

// ── ChoreFlow ─────────────────────────────────────────────────────────────────

function ChoreFlow({ task }) {
  const nav = useNavigate()
  const child = JSON.parse(localStorage.getItem('child') || 'null')
  const inputRef = useRef()
  const pollRef = useRef(null)

  const [step, setStep] = useState('idle')
  // idle | evaluating | inappropriate | confirm_recent | child_note | sending | waiting | approved | rejected
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [evaluation, setEvaluation] = useState(null)
  const [childNote, setChildNote] = useState('')
  const [approvedGems, setApprovedGems] = useState(null)
  const [parentNote, setParentNote] = useState(null)
  const [sendError, setSendError] = useState('')

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const handlePhoto = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    runEvaluation(f)
  }

  const runEvaluation = async (f) => {
    setStep('evaluating')

    // file.lastModified = fotoğrafın çekilme zamanı (EXIF'ten daha erişilebilir,
    // iOS/Android kamera uygulamalarında güvenilir)
    const THREE_HOURS = 3 * 60 * 60 * 1000
    const photoAgeMs = Date.now() - f.lastModified
    const fileIsRecent = photoAgeMs < THREE_HOURS
    console.log(
      `[CHORE] lastModified=${new Date(f.lastModified).toISOString()} ` +
      `age=${Math.round(photoAgeMs / 60000)}min recent=${fileIsRecent}`
    )

    try {
      const result = await evaluateChore(f, child?.age)
      setEvaluation(result)
      if (!result.appropriate) {
        setStep('inappropriate')
      } else if (!fileIsRecent) {
        setStep('confirm_recent')
      } else {
        setStep('child_note')
      }
    } catch {
      setEvaluation({ appropriate: true, task_description: 'Ev görevi', suggested_gems: 20, encouragement: 'Harika iş! 🌟' })
      if (!fileIsRecent) {
        setStep('confirm_recent')
      } else {
        setStep('child_note')
      }
    }
  }

  const handleSend = async () => {
    setStep('sending')
    setSendError('')
    try {
      const photoUrl = await uploadPhoto(file, child?.id)
      const res = await fetch(`${SERVER}/api/notify-parent-chore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId: child?.id,
          photoUrl,
          taskDescription: evaluation?.task_description || 'Ev görevi',
          suggestedGems: evaluation?.suggested_gems || 20,
          qualityScore: evaluation?.quality_score || 50,
          childNote: childNote.trim() || null,
        }),
      })
      const data = await res.json()
      if (!data.submissionId) throw new Error(data.error || 'Gönderim başarısız')
      setStep('waiting')
      startPolling(data.submissionId)
    } catch (err) {
      setSendError(err.message)
      setStep('child_note')
    }
  }

  const startPolling = (subId) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${SERVER}/api/submissions/${subId}`)
        const data = await res.json()
        if (data.status === 'approved') {
          clearInterval(pollRef.current)
          setApprovedGems(data.gems_earned ?? data.suggested_gems ?? 20)
          setParentNote(data.parent_note)
          setStep('approved')
        } else if (data.status === 'rejected') {
          clearInterval(pollRef.current)
          setParentNote(data.parent_note)
          setStep('rejected')
        }
      } catch {}
    }, 5000)
  }

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    setStep('idle')
    setFile(null)
    setPreview(null)
    setEvaluation(null)
    setChildNote('')
    setSendError('')
  }

  const dots = (
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: CHORE_ACCENT, opacity: 0.3 + i * 0.35 }} />
      ))}
    </div>
  )

  return (
    <div style={{ background: '#FFF3E0', minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <style>{FLOAT_CSS}</style>

      {/* Header */}
      <div style={{ background: CHORE_ACCENT, padding: '56px 24px 32px', borderRadius: '0 0 40px 40px' }}>
        <button
          onClick={() => nav('/child/home')}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', width: 40, height: 40, borderRadius: 12, fontSize: 18, color: 'white', cursor: 'pointer', marginBottom: 20 }}
        >←</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: task.bg || '#FFE8D4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flexShrink: 0 }}>
            🏠
          </div>
          <div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 24, fontWeight: 800, color: 'white', lineHeight: 1.2 }}>My House</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 600, marginTop: 2 }}>+{task.gem ?? 10} Gems to earn</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '32px 24px', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {step === 'idle' && (
          <>
            <div style={{ textAlign: 'center', paddingTop: 8 }}>
              <div style={{ fontSize: 64, marginBottom: 8 }}>🏠</div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#2D2560' }}>Bugün evde ne yaptın?</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#9B8FC0', marginTop: 4 }}>Görevini tamamla ve fotoğraf çek!</div>
            </div>
            <div
              onClick={() => inputRef.current.click()}
              style={{ background: 'white', borderRadius: 24, border: '2px dashed #FFD3C2', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            >
              <div style={{ fontSize: 56 }}>📷</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1A1A2E' }}>Fotoğraf Çek</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#7A7A9A', textAlign: 'center' }}>Yaptığın ev görevini fotoğrafla</div>
            </div>
            <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhoto} />
          </>
        )}

        {step === 'evaluating' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 64 }}>🔍</div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: '#2D2560' }}>Fotoğrafın inceleniyor...</div>
            {dots}
          </div>
        )}

        {step === 'inappropriate' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 64 }}>😕</div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#2D2560' }}>Bu ev görevi gibi görünmüyor</div>
            {evaluation?.inappropriate_reason && (
              <div style={{ fontSize: 14, fontWeight: 600, color: '#7A7A9A', maxWidth: 280, lineHeight: 1.5 }}>{evaluation.inappropriate_reason}</div>
            )}
            <button
              onClick={reset}
              style={{ background: CHORE_ACCENT, border: 'none', borderRadius: 16, padding: '14px 32px', color: 'white', fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, cursor: 'pointer', marginTop: 8 }}
            >Tekrar Dene 📷</button>
          </div>
        )}

        {step === 'confirm_recent' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {preview && <img src={preview} alt="preview" style={{ width: '100%', borderRadius: 20, maxHeight: 240, objectFit: 'cover' }} />}
            <div style={{ background: 'white', borderRadius: 20, padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: '#2D2560', marginBottom: 6 }}>Bu fotoğraf az önce çekilmiş mi?</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#7A7A9A', lineHeight: 1.5 }}>Lütfen şu an yaptığın görevin fotoğrafını gönder</div>
            </div>
            <button
              onClick={() => setStep('child_note')}
              style={{ background: CHORE_ACCENT, border: 'none', borderRadius: 16, padding: '14px', color: 'white', fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, cursor: 'pointer' }}
            >Evet, az önce çektim ✅</button>
            <button
              onClick={reset}
              style={{ background: 'white', border: `2px solid ${CHORE_ACCENT}`, borderRadius: 16, padding: '14px', color: CHORE_ACCENT, fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, cursor: 'pointer' }}
            >Yeni Fotoğraf Çek 📷</button>
          </div>
        )}

        {step === 'child_note' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {preview && <img src={preview} alt="preview" style={{ width: '100%', borderRadius: 20, maxHeight: 200, objectFit: 'cover' }} />}
            {evaluation && (
              <div style={{ background: 'white', borderRadius: 20, padding: '16px 20px' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#2D2560', marginBottom: 4 }}>{evaluation.task_description}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#7A7A9A', lineHeight: 1.5 }}>{evaluation.encouragement}</div>
                <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FFF0E8', borderRadius: 10, padding: '5px 12px' }}>
                  <span>🤖</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: CHORE_ACCENT }}>+{evaluation.suggested_gems} Gem önerisi</span>
                </div>
              </div>
            )}
            <div style={{ background: 'white', borderRadius: 20, padding: '16px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#7A7A9A', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                Ebeveynine bir not bırak (isteğe bağlı)
              </div>
              <textarea
                value={childNote}
                onChange={e => setChildNote(e.target.value)}
                placeholder="Ne yaptığını anlat..."
                rows={2}
                style={{ width: '100%', border: '2px solid #FFE8D4', borderRadius: 12, padding: '10px 12px', fontSize: 14, fontFamily: 'Nunito, sans-serif', fontWeight: 600, resize: 'none', outline: 'none', boxSizing: 'border-box', color: '#2D2560' }}
              />
            </div>
            {sendError && (
              <div style={{ background: '#FFF0EE', borderRadius: 12, padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#D63030' }}>⚠️ {sendError}</div>
            )}
            <button
              onClick={handleSend}
              style={{ background: CHORE_ACCENT, border: 'none', borderRadius: 16, padding: '16px', color: 'white', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 20px rgba(255,140,66,0.35)' }}
            >Gönder 🚀</button>
          </div>
        )}

        {step === 'sending' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 64 }}>🚀</div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: '#2D2560' }}>Görev gönderiliyor...</div>
            {dots}
          </div>
        )}

        {step === 'waiting' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 72, animation: 'float 2s ease-in-out infinite' }}>⏳</div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#2D2560' }}>Ebeveynin onay veriyor...</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#9B8FC0', maxWidth: 260, lineHeight: 1.5 }}>Onayladığında seni hemen haberdar edeceğiz!</div>
            {dots}
          </div>
        )}

        {step === 'approved' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 80 }}>🎉</div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 28, fontWeight: 900, color: '#2D2560' }}>Tebrikler!</div>
            <div style={{ background: CHORE_ACCENT, borderRadius: 24, padding: '20px 40px', boxShadow: '0 8px 24px rgba(255,140,66,0.35)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>Kazandın!</div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 38, fontWeight: 900, color: 'white', lineHeight: 1 }}>+{approvedGems} Gem ⭐</div>
            </div>
            {parentNote && (
              <div style={{ background: 'white', borderRadius: 16, padding: '14px 20px', maxWidth: 280, fontSize: 14, fontWeight: 600, color: '#2D2560', lineHeight: 1.5, fontStyle: 'italic' }}>
                💬 &ldquo;{parentNote}&rdquo;
              </div>
            )}
            {evaluation?.encouragement && !parentNote && (
              <div style={{ fontSize: 15, fontWeight: 700, color: '#7A7A9A', maxWidth: 280, lineHeight: 1.5 }}>{evaluation.encouragement}</div>
            )}
            <button
              onClick={() => nav('/child/home')}
              style={{ background: '#EDE8FF', border: 'none', borderRadius: 16, padding: '14px 32px', color: '#2D2560', fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, cursor: 'pointer', marginTop: 4 }}
            >Ana Sayfaya Dön 🏠</button>
          </div>
        )}

        {step === 'rejected' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 64 }}>😕</div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#2D2560' }}>Bu sefer olmadı</div>
            {parentNote && (
              <div style={{ background: 'white', borderRadius: 16, padding: '14px 20px', maxWidth: 280, fontSize: 14, fontWeight: 600, color: '#2D2560', lineHeight: 1.5, fontStyle: 'italic' }}>
                💬 &ldquo;{parentNote}&rdquo;
              </div>
            )}
            <div style={{ fontSize: 14, fontWeight: 600, color: '#9B8FC0' }}>Tekrar dene ve daha iyi yap! 💪</div>
            <button
              onClick={reset}
              style={{ background: CHORE_ACCENT, border: 'none', borderRadius: 16, padding: '14px 32px', color: 'white', fontFamily: "'Baloo 2', cursive", fontSize: 16, fontWeight: 800, cursor: 'pointer' }}
            >Tekrar Dene 💪</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── RegularTaskFlow ───────────────────────────────────────────────────────────

function RegularTaskFlow({ task }) {
  const nav = useNavigate()
  const inputRef = useRef()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [questions, setQuestions] = useState(null)
  const [msgIdx, setMsgIdx] = useState(0)
  const [msgVisible, setMsgVisible] = useState(true)

  useEffect(() => {
    if (status !== 'loading') return
    setMsgIdx(0)
    setMsgVisible(true)
    const msgs = LOADING_MESSAGES[task.type] || LOADING_MESSAGES.math
    const interval = setInterval(() => {
      setMsgVisible(false)
      setTimeout(() => {
        setMsgIdx(i => (i + 1) % msgs.length)
        setMsgVisible(true)
      }, 350)
    }, 2500)
    return () => clearInterval(interval)
  }, [status])

  const calledRef = useRef(false)
  useEffect(() => {
    if (calledRef.current) return
    calledRef.current = true
    const child = JSON.parse(localStorage.getItem('child') || 'null')
    generateTask(child?.id, task.type, child?.age, child?.language)
      .then(data => setQuestions(data.questions ?? []))
      .catch(() => setQuestions([]))
  }, [])

  const handlePhoto = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleSubmit = async () => {
    if (!file) return
    setStatus('loading')
    setError('')
    try {
      const child = JSON.parse(localStorage.getItem('child') || 'null')
      const [res, photoUrl] = await Promise.all([
        evaluateTask(file, task.type, child?.age, child?.language),
        uploadPhoto(file, child?.id),
      ])
      res.gem_earned = res.gem_earned ?? res.gems_earned ?? 0
      const gems = Math.round(res.gem_earned)
      await Promise.all([
        gems > 0 ? addToLedger(child?.id, gems, task.name) : Promise.resolve(),
        saveSubmission(child?.id, task.type, res, photoUrl),
      ])
      setResult(res)
      setStatus('result')
    } catch (err) {
      setError(err.message || 'Bir hata oluştu.')
      setStatus('error')
    }
  }

  return (
    <div style={{ background: '#FFF8F0', minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <style>{FLOAT_CSS}</style>

      {/* Header */}
      <div style={{ background: ACCENT, padding: '56px 24px 32px', borderRadius: '0 0 40px 40px' }}>
        <button
          onClick={() => nav('/child/home')}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', width: 40, height: 40, borderRadius: 12, fontSize: 18, color: 'white', cursor: 'pointer', marginBottom: 20 }}
        >←</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: task.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flexShrink: 0 }}>
            {task.emoji}
          </div>
          <div>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 24, fontWeight: 800, color: 'white', lineHeight: 1.2 }}>{task.name}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 600, marginTop: 2 }}>+{task.gem} Gems to earn</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
        <div style={{ background: 'white', borderRadius: 24, padding: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#7A7A9A', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Task</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E', lineHeight: 1.5 }}>{task.desc}</div>
        </div>

        <div style={{ background: 'white', borderRadius: 24, padding: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#7A7A9A', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Questions</div>
          {questions === null ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#7A7A9A', fontSize: 14, fontWeight: 600 }}>
              <div style={{ width: 16, height: 16, border: '2px solid #FFD3C2', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Preparing questions...
            </div>
          ) : questions.length === 0 ? null : (
            <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {questions.map((q, i) => (
                <li key={i} style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', lineHeight: 1.5, paddingLeft: 4 }}>{q}</li>
              ))}
            </ol>
          )}
        </div>

        {status === 'idle' || status === 'error' ? (
          <>
            {preview ? (
              <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                <img src={preview} alt="preview" style={{ width: '100%', display: 'block', maxHeight: 300, objectFit: 'cover' }} />
                <button
                  onClick={() => { setFile(null); setPreview(null); setStatus('idle') }}
                  style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 10, width: 36, height: 36, color: 'white', fontSize: 16, cursor: 'pointer' }}
                >✕</button>
              </div>
            ) : (
              <div
                onClick={() => inputRef.current.click()}
                style={{ background: 'white', borderRadius: 24, border: '2px dashed #FFD3C2', padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'pointer' }}
              >
                <div style={{ fontSize: 48 }}>📷</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1A1A2E' }}>Add Photo</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#7A7A9A', textAlign: 'center' }}>Complete your task and take a photo</div>
              </div>
            )}
            <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhoto} />
            {status === 'error' && (
              <div style={{ background: '#FFF0EE', borderRadius: 16, padding: '14px 16px', fontSize: 14, fontWeight: 700, color: '#D63030' }}>
                ⚠️ {error}
              </div>
            )}
            <button className="btn btn-ghost" onClick={() => inputRef.current.click()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              📷 Take Photo
            </button>
            <button className="btn btn-orange" onClick={handleSubmit} disabled={!file} style={{ opacity: file ? 1 : 0.45 }}>
              Submit
            </button>
          </>
        ) : status === 'loading' ? (
          <div style={{ background: 'white', borderRadius: 24, padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', flex: 1, justifyContent: 'center' }}>
            <div style={{ fontSize: 64, animation: 'float 2s ease-in-out infinite' }}>🔍</div>
            <div style={{
              fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: '#1A1A2E',
              textAlign: 'center', lineHeight: 1.4, minHeight: 56,
              opacity: msgVisible ? 1 : 0,
              transition: 'opacity 0.35s ease',
            }}>
              {(LOADING_MESSAGES[task.type] || LOADING_MESSAGES.math)[msgIdx]}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: ACCENT, opacity: 0.3 + i * 0.35 }} />
              ))}
            </div>
          </div>
        ) : (
          <ResultCard result={result} taskType={task.type} />
        )}
      </div>
    </div>
  )
}

// ── TaskFlow entry point ──────────────────────────────────────────────────────

export default function TaskFlow() {
  const nav = useNavigate()
  const { state: task } = useLocation()
  if (!task) { nav('/child/home'); return null }
  if (task.type === 'chore') return <ChoreFlow task={task} />
  return <RegularTaskFlow task={task} />
}
