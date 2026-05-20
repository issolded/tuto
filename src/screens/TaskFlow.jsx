import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { evaluateTask, generateTask } from '../lib/gemini'
import { supabase } from '../lib/supabase'

const ACCENT = '#FF6B35'

const LOADING_MESSAGES = {
  math:    ['Ooh, big numbers! Let me put on my thinking cap... 🤓', 'Counting every answer carefully... 🔢', 'Double-checking the tricky ones... 🧮'],
  writing: ['A story! Let me read every word carefully... 📖', 'Reading through your composition... ✍️', 'Checking your ideas and spelling... 🌟'],
  reading: ['Let me see what you\'ve been reading... 🧐', 'Going through your summary... 📚', 'Comparing your notes to the book... 🔍'],
  chore:   ['Going to check your room now... looking around... 🔍', 'Inspecting the work you\'ve done... 🏠', 'Almost done checking... 👀'],
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
  console.log('Submission kaydediliyor...', payload)
  const { data, error } = await supabase.from('submissions').insert(payload).select('id').single()
  if (error) {
    console.error('Submission hatası:', error.message, error)
    throw error
  }
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

export default function TaskFlow() {
  const nav = useNavigate()
  const { state: task } = useLocation()
  const inputRef = useRef()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | result | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [questions, setQuestions] = useState(null) // null = loading, [] = empty, [...] = ready
  const [msgIdx, setMsgIdx] = useState(0)
  const [msgVisible, setMsgVisible] = useState(true)

  if (!task) { nav('/child/home'); return null }

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
    const child = JSON.parse(sessionStorage.getItem('tuto_child') || 'null')
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
      const child = JSON.parse(sessionStorage.getItem('tuto_child') || 'null')
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

        {/* Questions — hidden for chore */}
        {task.type !== 'chore' && (
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
        )}

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
