import { LANGS, childLang as childLangOf, t as childT } from '../lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PC, FONT, PCSS, TopBar, Card, Toggle, TaskIcon } from '../lib/parentUI'
import { CAP_RANGE, TASK_DEFAULTS, BONUS_TYPES, capNote } from '../lib/taskDefaults'
import { useT, useUiLang } from '../lib/parentI18n'

// Keys only. The names are the CHILD's tile names, read from the child dictionary at render
// so the parent and the child are looking at the same word for the same thing.
const TASKS = ['reading', 'math', 'writing', 'homework', 'drawing', 'puzzle', 'english']

// Every task has a daily cap and every one of them is set here. The dial was
// drawing-only for a while, on the reasoning that drawing rewards instantly with
// no approval step — but maths, reading and writing pay out unapproved too, and
// the server was already holding all four to a limit the parent never chose and
// could not see. The cap is enforced on the SERVER; this is just the dial.
const DEFAULT_SETTINGS = Object.fromEntries(
  Object.entries(TASK_DEFAULTS).map(([key, { gems, daily_cap }]) => [
    key, { active: true, gems, daily_cap },
  ])
)

function capBtn(PC) {
  return {
    width: 30, height: 30, borderRadius: 10, border: `1.5px solid ${PC.line}`, background: '#fff',
    cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 16, color: PC.inkSoft, lineHeight: 1,
  }
}

export default function TaskSettings() {
  const { id } = useParams()
  const nav = useNavigate()
  const s = useT()
  const lang = useUiLang()
  const [childName, setChildName] = useState('')
  const [childAge, setChildAge] = useState(null)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  // Lives on the child row, not in task_settings: it is not a task and task_settings is
  // rewritten wholesale on every toggle here, which would take the language with it.
  const [childLang, setChildLang] = useState('en')
  // British or American English. null is "from the family's time zone", which is what the server
  // does with null too; the zone is read so the automatic choice can be said, not guessed.
  const [englishVariety, setEnglishVariety] = useState(null)
  const [familyZone, setFamilyZone] = useState('')
  const [varietyReady, setVarietyReady] = useState(false)
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
    // `*`: english_variety arrives with a migration, and naming it before then fails the read.
    supabase.from('children').select('*').eq('id', id).single()
      .then(({ data }) => {
        if (!data) return
        setChildName(data.name)
        setChildAge(data.age)
        setChildLang(childLangOf(data))
        if (data.task_settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...data.task_settings })
        }
        setEnglishVariety(data.english_variety ?? null)
        setVarietyReady('english_variety' in data)
        if (data.parent_id) {
          supabase.from('parents').select('timezone').eq('id', data.parent_id).maybeSingle()
            .then(({ data: p }) => setFamilyZone(p?.timezone || ''))
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

  const saveLanguage = async (lang) => {
    setChildLang(lang)
    setSaving(true)
    await supabase.from('children').update({ language: lang }).eq('id', id)
    setSaving(false)
  }

  const saveVariety = async (v) => {
    setEnglishVariety(v)
    setSaving(true)
    await supabase.from('children').update({ english_variety: v }).eq('id', id)
    setSaving(false)
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
        title={s('ts_title')}
        sub={childName || undefined}
        onBack={() => nav(`/parent/child/${id}`)}
        right={saving
          ? <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12.5, color: PC.inkFaint }}>{s('saving')}</span>
          : null}
      />

      <div style={{ flex: 1, padding: '4px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card pad={16} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 15.5, color: PC.ink }}>
            {childName ? s('ts_lang_for', { name: childName }) : s('ts_lang')}
          </div>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: PC.inkSoft, lineHeight: 1.45, marginTop: -4 }}>
            {s('ts_lang_sub', { name: childName || s('ts_your_child') })}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
            {LANGS.map(l => ({ id: l.code, label: l.label, flag: l.flag })).map(o => {
              const on = childLang === o.id
              return (
                <button key={o.id} className="tc-press tc-tap" onClick={() => saveLanguage(o.id)} style={{
                  flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: on ? PC.tealBg : '#fff', border: `2px solid ${on ? PC.teal : PC.line}`,
                  borderRadius: 14, padding: '12px 10px', cursor: 'pointer',
                  fontFamily: FONT, fontWeight: 800, fontSize: 14.5, color: on ? PC.tealDeep : PC.inkSoft,
                  transition: 'border-color .16s, background .16s',
                }}>
                  <span style={{ fontSize: 18 }}>{o.flag}</span>{o.label}
                </button>
              )
            })}
          </div>
        </Card>

        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: PC.inkSoft, marginBottom: 6, padding: '0 2px' }}>
          {s('ts_intro')}
        </div>

        {TASKS.map((key) => {
          const cfg = settings[key]
          // A child row written before this screen existed has gems but no cap;
          // fall back to the same default the server would use, not to a literal.
          const cap = cfg.daily_cap ?? TASK_DEFAULTS[key].daily_cap
          const accent = PC[key] || PC.teal
          const pct = ((cfg.gems - 5) / (100 - 5)) * 100
          const trackBg = `linear-gradient(to right, ${accent} ${pct}%, ${PC.line} ${pct}%)`

          return (
            <Card key={key} pad={16} style={{ opacity: cfg.active ? 1 : 0.55, transition: 'opacity .2s' }}>
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
                  <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 15.5, color: PC.ink }}>{childT(`task_${key}`, lang)}</div>
                  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12.5, color: cfg.active ? accent : PC.inkFaint, marginTop: 2 }}>
                    {cfg.active ? s('ts_per_session', { n: cfg.gems }) : s('ts_disabled')}
                  </div>
                </div>
                <Toggle on={cfg.active} onClick={() => toggleTask(key)} />
              </div>

              {/* slider — only when active */}
              {cfg.active && (
                <div style={{ marginTop: 14 }}>
                  <input
                    type="range"
                    min={5} max={100} step={5}
                    value={cfg.gems}
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

              {/* daily cap */}
              {cfg.active && (
                <div style={{ marginTop: 14, borderTop: `1px solid ${PC.line}`, paddingTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13.5, color: PC.ink }}>{s('ts_per_day')}</div>
                      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11.5, color: PC.inkFaint, marginTop: 2 }}>
                        {capNote(key, s)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => setDailyCap(key, Math.max(CAP_RANGE.min, cap - 1))}
                        style={capBtn(PC)}>−</button>
                      <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: accent, minWidth: 18, textAlign: 'center' }}>
                        {cap}
                      </span>
                      <button onClick={() => setDailyCap(key, Math.min(CAP_RANGE.max, cap + 1))}
                        style={capBtn(PC)}>+</button>
                    </div>
                  </div>
                </div>
              )}

              {/* British or American — English only, and only once the column exists. */}
              {key === 'english' && cfg.active && varietyReady && (() => {
                const auto = /^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Adak|Boise|Detroit|Juneau|Sitka|Yakutat|Nome|Metlakatla|Menominee|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+)|Pacific\/Honolulu|US\/.+)$/.test(familyZone) ? 'us' : 'uk'
                const opts = [
                  { v: null, label: s('ts_eng_auto') },
                  { v: 'uk', label: `🇬🇧 ${s('ts_eng_uk')}` },
                  { v: 'us', label: `🇺🇸 ${s('ts_eng_us')}` },
                ]
                return (
                  <div style={{ marginTop: 14, borderTop: `1px solid ${PC.line}`, paddingTop: 12 }}>
                    <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13.5, color: PC.ink }}>{s('ts_eng_variety')}</div>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11.5, color: PC.inkFaint, marginTop: 2, lineHeight: 1.4 }}>{s('ts_eng_variety_sub')}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      {opts.map(o => {
                        const on = englishVariety === o.v
                        return (
                          <button key={String(o.v)} className="tc-press tc-tap" onClick={() => saveVariety(o.v)} style={{
                            flex: 1, minWidth: 0, background: on ? PC.englishBg : '#fff', border: `2px solid ${on ? PC.english : PC.line}`,
                            borderRadius: 12, padding: '9px 6px', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 13,
                            color: on ? PC.english : PC.inkSoft,
                          }}>{o.label}</button>
                        )
                      })}
                    </div>
                    {englishVariety === null && (
                      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11.5, color: PC.inkFaint, marginTop: 6 }}>
                        {s('ts_eng_auto_is', { v: s(auto === 'us' ? 'ts_eng_us' : 'ts_eng_uk') })}
                      </div>
                    )}
                  </div>
                )
              })()}
            </Card>
          )
        })}

        {/* The once-a-day bonus for doing every activity the parent ticks. No daily cap — it pays
            once a day by definition — and the amount runs higher than a task's, since it follows
            several of them. */}
        {(() => {
          const b = { active: true, gems: 50, ...(settings.bonus || {}) }
          const counted = Array.isArray(b.types) ? b.types : BONUS_TYPES
          const toggleCounted = (k) => {
            const next = counted.includes(k) ? counted.filter(x => x !== k) : [...counted, k]
            if (next.length >= 2) setBonus({ types: BONUS_TYPES.filter(x => next.includes(x)) })
          }
          const setBonus = (patch) => { const next = { ...settings, bonus: { ...b, ...patch } }; setSettings(next); persist(next) }
          const pct = ((b.gems - 10) / (200 - 10)) * 100
          return (
            <Card pad={16} style={{ opacity: b.active ? 1 : 0.55, transition: 'opacity .2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, background: PC.amberBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 24 }}>🏅</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 15.5, color: PC.ink }}>{s('ts_bonus_title')}</div>
                  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12.5, color: b.active ? PC.amber : PC.inkFaint, marginTop: 2 }}>
                    {b.active ? s('ts_bonus_amount', { n: b.gems }) : s('ts_disabled')}
                  </div>
                </div>
                <Toggle on={b.active} onClick={() => setBonus({ active: !b.active })} />
              </div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: PC.inkSoft, lineHeight: 1.45, marginTop: 10 }}>
                {s('ts_bonus_sub')}
                {childAge != null && childAge < 7 && <div style={{ marginTop: 6, color: PC.inkFaint }}>{s('ts_bonus_young', { name: childName })}</div>}
              </div>
              {b.active && (
                <div style={{ marginTop: 14 }}>
                  <input type="range" min={10} max={200} step={10} value={b.gems}
                    onChange={e => setBonus({ gems: Number(e.target.value) })}
                    className="tc-slider" style={{ background: `linear-gradient(to right, ${PC.amber} ${pct}%, ${PC.line} ${pct}%)` }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: PC.inkFaint }}>10</span>
                    <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: PC.inkFaint }}>200</span>
                  </div>
                </div>
              )}
              {b.active && (
                <div style={{ marginTop: 14, borderTop: `1px solid ${PC.line}`, paddingTop: 12 }}>
                  <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13.5, color: PC.ink }}>{s('ts_bonus_counts')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {BONUS_TYPES.map(k => {
                      // A task switched off above never counts, whatever is ticked here.
                      const off = settings[k]?.active === false
                      const on = counted.includes(k) && !off
                      return (
                        <button key={k} className="tc-press tc-tap" disabled={off} onClick={() => toggleCounted(k)} style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 999, cursor: off ? 'default' : 'pointer',
                          background: on ? PC.amberBg : '#fff', border: `2px solid ${on ? PC.amber : PC.line}`, opacity: off ? 0.45 : 1,
                          fontFamily: FONT, fontWeight: 800, fontSize: 12.5, color: on ? PC.ink : PC.inkSoft,
                        }}>
                          <TaskIcon type={k} size={16} />{childT(`task_${k}`, lang)}{on ? ' ✓' : ''}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11.5, color: PC.inkFaint, marginTop: 6 }}>{s('ts_bonus_min_two')}</div>
                </div>
              )}
            </Card>
          )
        })()}
      </div>
    </div>
  )
}
