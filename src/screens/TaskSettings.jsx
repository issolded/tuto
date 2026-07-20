import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PC, FONT, PCSS, TopBar, Card, Toggle, TaskIcon } from '../lib/parentUI'

const TASKS = [
  { key: 'reading', label: 'My Books' },
  { key: 'math',    label: 'My Math' },
  { key: 'writing', label: 'My Stories' },
  { key: 'chore',   label: 'My House' },
  { key: 'homework', label: 'My Homework' },
  { key: 'drawing', label: 'My Drawings' },
]

// My Drawings rewards instantly, with no approval step — so it is the one task
// with a daily cap. The cap is enforced on the SERVER; this is just the dial.
const CAPPED_TASKS = { drawing: { min: 1, max: 10 } }

const DEFAULT_SETTINGS = {
  reading: { active: true, gems: 30 },
  math:    { active: true, gems: 30 },
  writing: { active: true, gems: 30 },
  chore:   { active: true, gems: 10 },
  homework: { active: true, gems: 25 },
  drawing: { active: true, gems: 20, daily_cap: 2 },
}

function capBtn(PC) {
  return {
    width: 30, height: 30, borderRadius: 10, border: `1.5px solid ${PC.line}`, background: '#fff',
    cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 16, color: PC.inkSoft, lineHeight: 1,
  }
}

export default function TaskSettings() {
  const { id } = useParams()
  const nav = useNavigate()
  const [childName, setChildName] = useState('')
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'pcss-task-settings'
    el.textContent = PCSS
    if (!document.getElementById('pcss-task-settings')) document.head.appendChild(el)
    return () => { document.getElementById('pcss-task-settings')?.remove() }
  }, [])

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

  const setDailyCap = (key, daily_cap) => {
    const next = { ...settings, [key]: { ...settings[key], daily_cap } }
    setSettings(next)
    persist(next)
  }

  return (
    <div style={{ background: PC.bg, minHeight: '100dvh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      <TopBar
        title="Task settings"
        sub={childName || undefined}
        onBack={() => nav(`/parent/child/${id}`)}
        right={saving
          ? <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12.5, color: PC.inkFaint }}>Saving…</span>
          : null}
      />

      <div style={{ flex: 1, padding: '4px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: PC.inkSoft, marginBottom: 6, padding: '0 2px' }}>
          Toggle tasks on/off and adjust gem rewards.
        </div>

        {TASKS.map(({ key, label }) => {
          const s = settings[key]
          const accent = PC[key] || PC.teal
          const pct = ((s.gems - 5) / (100 - 5)) * 100
          const trackBg = `linear-gradient(to right, ${accent} ${pct}%, ${PC.line} ${pct}%)`

          return (
            <Card key={key} pad={16} style={{ opacity: s.active ? 1 : 0.55, transition: 'opacity .2s' }}>
              {/* top row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 14,
                  background: PC[key + 'Bg'] || PC.tealBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <TaskIcon type={key} size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 15.5, color: PC.ink }}>{label}</div>
                  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12.5, color: s.active ? accent : PC.inkFaint, marginTop: 2 }}>
                    {s.active ? `+${s.gems} gems per session` : 'Disabled'}
                  </div>
                </div>
                <Toggle on={s.active} onClick={() => toggleTask(key)} />
              </div>

              {/* slider — only when active */}
              {s.active && (
                <div style={{ marginTop: 14 }}>
                  <input
                    type="range"
                    min={5} max={100} step={5}
                    value={s.gems}
                    onChange={e => setGems(key, Number(e.target.value))}
                    className="tc-slider"
                    style={{ background: trackBg }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: PC.inkFaint }}>5</span>
                    <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: PC.inkFaint }}>100</span>
                  </div>
                </div>
              )}

              {/* daily cap — only for tasks that reward without approval */}
              {s.active && CAPPED_TASKS[key] && (
                <div style={{ marginTop: 14, borderTop: `1px solid ${PC.line}`, paddingTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13.5, color: PC.ink }}>Rewarded per day</div>
                      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11.5, color: PC.inkFaint, marginTop: 2 }}>
                        Extra drawings are still saved, just without gems.
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => setDailyCap(key, Math.max(CAPPED_TASKS[key].min, (s.daily_cap ?? 2) - 1))}
                        style={capBtn(PC)}>−</button>
                      <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: accent, minWidth: 18, textAlign: 'center' }}>
                        {s.daily_cap ?? 2}
                      </span>
                      <button onClick={() => setDailyCap(key, Math.min(CAPPED_TASKS[key].max, (s.daily_cap ?? 2) + 1))}
                        style={capBtn(PC)}>+</button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
