import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const TASKS = [
  { key: 'reading', emoji: '📚', label: 'My Books',   bg: '#E8E0FF', color: '#7C5CBF' },
  { key: 'math',    emoji: '🔢', label: 'My Math',    bg: '#D4EDFF', color: '#4A9CC8' },
  { key: 'writing', emoji: '✏️', label: 'My Stories', bg: '#D4F5E0', color: '#2EC486' },
  { key: 'chore',   emoji: '🏠', label: 'My House',   bg: '#FFE8D4', color: '#FF6B35' },
]

const DEFAULT_SETTINGS = {
  reading: { active: true, gems: 30 },
  math:    { active: true, gems: 30 },
  writing: { active: true, gems: 30 },
  chore:   { active: true, gems: 10 },
}

const CSS = `
.task-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 5px;
  border-radius: 5px;
  outline: none;
  cursor: pointer;
  margin: 4px 0;
}
.task-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #FF6B35;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(255,107,53,0.4);
  border: 3px solid white;
}
.task-slider::-moz-range-thumb {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #FF6B35;
  cursor: pointer;
  border: 3px solid white;
  box-shadow: 0 2px 8px rgba(255,107,53,0.4);
}
`

export default function TaskSettings() {
  const { id } = useParams()
  const nav = useNavigate()
  const [childName, setChildName] = useState('')
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    if (!id) return
    supabase.from('children').select('name, task_settings').eq('id', id).single()
      .then(({ data }) => {
        if (!data) return
        setChildName(data.name)
        if (data.task_settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...data.task_settings })
        }
      })
  }, [id])

  const persist = (next) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving(true)
    saveTimer.current = setTimeout(async () => {
      await supabase.from('children').update({ task_settings: next }).eq('id', id)
      setSaving(false)
    }, 500)
  }

  const toggleTask = (key) => {
    const next = { ...settings, [key]: { ...settings[key], active: !settings[key].active } }
    setSettings(next)
    persist(next)
  }

  const setGems = (key, gems) => {
    const next = { ...settings, [key]: { ...settings[key], gems } }
    setSettings(next)
    persist(next)
  }

  return (
    <div style={{ background: '#FFF8F0', minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ background: '#FF6B35', padding: '52px 24px 28px', borderRadius: '0 0 32px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => nav(`/parent/child/${id}`)}
            style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 900, color: 'white', lineHeight: 1.1 }}>Task Settings</div>
            {childName && (
              <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{childName}</div>
            )}
          </div>
          {saving && (
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Saving…</div>
          )}
        </div>
      </div>

      {/* Task cards */}
      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#7A7A9A', marginBottom: 4 }}>
          Toggle tasks on/off and adjust gem rewards.
        </div>

        {TASKS.map(({ key, emoji, label, bg, color }) => {
          const s = settings[key]
          const pct = ((s.gems - 5) / (100 - 5)) * 100
          const trackBg = `linear-gradient(to right, #FF6B35 ${pct}%, #FFE8D4 ${pct}%)`

          return (
            <div
              key={key}
              style={{
                background: 'white',
                borderRadius: 20,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                opacity: s.active ? 1 : 0.55,
                transition: 'opacity 0.2s',
              }}
            >
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: '#2D2D2D' }}>{label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: s.active ? color : '#C0C0C0', marginTop: 1 }}>
                    {s.active ? `+${s.gems} gems per session` : 'Disabled'}
                  </div>
                </div>
                {/* Toggle */}
                <button
                  onClick={() => toggleTask(key)}
                  style={{
                    width: 48, height: 28,
                    borderRadius: 14,
                    background: s.active ? '#2EC486' : '#E0E0E0',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 0.25s',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 3,
                    left: s.active ? 23 : 3,
                    width: 22, height: 22,
                    borderRadius: '50%',
                    background: 'white',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                    transition: 'left 0.25s',
                  }} />
                </button>
              </div>

              {/* Slider — only when active */}
              {s.active && (
                <div>
                  <input
                    type="range"
                    min={5} max={100} step={5}
                    value={s.gems}
                    onChange={e => setGems(key, Number(e.target.value))}
                    className="task-slider"
                    style={{ background: trackBg }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#C0C0C0' }}>5</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#C0C0C0' }}>100</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
