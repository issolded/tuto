import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useT, adoptAccountLang } from '../lib/parentI18n'
import { childLang, t } from '../lib/i18n'
import { cacheDemoRules, useScreenDemo } from '../lib/screenControlDemo'
import { updateParentPrefs } from '../lib/parentPrefs'
import { SAMPLE_APPS, readRules, validRules, status, canRedeem } from '../lib/screenControl'
import { PC, PCSS, FONT, TopBar, Card, Btn, Pill } from '../lib/parentUI'

const APP_NAMES = { roblox: 'Roblox', youtube: 'YouTube', minecraft: 'Minecraft', tuto: 'Tuto' }
const CSS = `${PCSS}
.sc-page{max-width:1100px;margin:auto;min-height:100dvh;background:${PC.bg};font-family:${FONT};color:${PC.ink};padding-bottom:40px}
.sc-body{padding:0 22px;display:grid;gap:18px}.sc-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}
.sc-stack{display:grid;gap:16px}.sc-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.sc-row>*{min-width:0}
.sc-field{display:grid;gap:8px;font-size:13px;font-weight:700}.sc-field input,.sc-field select{min-width:0}
.sc-help{font-size:13px;line-height:1.65;color:${PC.inkSoft};margin:0}.sc-title{font-size:18px;margin:0;font-weight:800}
.sc-tabs{display:flex;gap:8px}.sc-tab{flex:1;padding:14px;border:1px solid ${PC.line};border-radius:14px;background:white;color:${PC.ink};font:inherit;font-weight:700;cursor:pointer}.sc-tab[aria-selected=true]{background:${PC.tealDeep};color:white}
.sc-page button:focus-visible,.sc-page input:focus-visible,.sc-page select:focus-visible{outline:3px solid ${PC.teal};outline-offset:3px}
.sc-check{display:flex;gap:12px;align-items:center;font-size:14px;font-weight:700}.sc-check input{width:22px;height:22px;accent-color:${PC.tealDeep}}
.sc-stat{padding:20px;border-radius:20px;background:${PC.tealBg};flex:1;text-align:center}.sc-stat strong{display:block;font-size:36px;font-variant-numeric:tabular-nums;margin-top:8px}
@media(max-width:700px){.sc-grid{grid-template-columns:1fr}.sc-body{padding:0 14px}.sc-stat strong{font-size:30px}}
`
function NumberField({ label, value, onChange, max = 480, min = 0 }) {
  return <label className="sc-field">{label}<input className="tc-input" type="number" min={min} max={max} step="1" value={value} onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))} /></label>
}
function Schedule({ s, rules, change, name, start, end, labelKey }) {
  return <div className="sc-stack">
    <label className="sc-check"><input type="checkbox" checked={rules[name]} onChange={e => change(name, e.target.checked)} />{s(labelKey)}</label>
    {rules[name] && <div className="sc-grid">
      <label className="sc-field">{s('sc_start')}<input className="tc-input" type="time" value={rules[start]} onChange={e => change(start, e.target.value)} /></label>
      <label className="sc-field">{s('sc_end')}<input className="tc-input" type="time" value={rules[end]} onChange={e => change(end, e.target.value)} /></label>
    </div>}
  </div>
}
function dateInput(now) {
  const d = new Date(now)
  return new Date(now - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function Demo({ rules, child }) {
  const s = useT()
  const c = key => t(key, childLang(child))
  const [demo, act] = useScreenDemo(child.id, rules, true)
  const info = status(rules, demo)
  const remaining = `${Math.floor(info.remaining / 60)}:${String(info.remaining % 60).padStart(2, '0')}`
  const base = [0, 6].includes(new Date(demo.now).getDay()) ? rules.weekend : rules.weekday
  const approveOK = demo.pending && canRedeem(rules, { ...demo, pending: null }) && demo.gems >= demo.pending.cost
  return <div className="sc-stack">
    <div className="sc-grid">
      <Card style={{ background: '#FFF8E0' }}><div className="sc-stack">
        <div className="sc-row"><Pill>{s('sc_demo_child')}</Pill><strong>{child.name}</strong></div>
        <div className="sc-row">
          <div className="sc-stat"><span>{c('sc_remaining')}</span><strong data-testid="remaining">{remaining}</strong></div>
          <div className="sc-stat" style={{ background: '#F1E9FC' }}><span>{c('sc_demo_gems')}</span><strong data-testid="gems">{demo.gems}</strong></div>
        </div>
        <label className="sc-field">{c('sc_apps')}<select className="tc-input" value={demo.app} onChange={e => act({ type: 'app', app: e.target.value })}>{SAMPLE_APPS.map(app => <option key={app} value={app}>{APP_NAMES[app]}</option>)}</select></label>
        <div role="status" style={{ padding: 16, borderRadius: 14, background: info.playable ? PC.greenBg : PC.peachBg, fontWeight: 800 }}>{c(`sc_status_${info.reason}`)}</div>
        <Btn onClick={() => act({ type: 'play' })} disabled={!info.playable && !demo.running}>{c(demo.running ? 'sc_stop' : 'sc_play')}</Btn>
        <Btn variant="outline" onClick={() => act({ type: 'request' })} disabled={!canRedeem(rules, demo)}>{c(rules.approval ? 'sc_request' : 'sc_redeem').replace('%n%', 5 * rules.gemsPerMinute)}</Btn>
        <p className="sc-help">{c('sc_request_hint')}</p>
      </div></Card>
      <Card><div className="sc-stack">
        <h2 className="sc-title">{s('sc_parent_actions')}</h2>
        <p className="sc-help">{s('sc_used', { n: Math.floor(demo.used / 60), earned: demo.earned })}</p>
        <Btn variant="soft" onClick={() => act({ type: 'pause' })}>{s(demo.paused ? 'sc_resume' : 'sc_pause')}</Btn>
        <Btn variant="outline" disabled={base + demo.earned + demo.bonus >= rules.cap} onClick={() => act({ type: 'bonus' })}>{s('sc_add')}</Btn>
        {demo.pending && <div className="sc-stack" style={{ background: PC.peachBg, borderRadius: 16, padding: 16 }}>
          <p role="status" className="sc-help">{s('sc_pending', { n: demo.pending.cost })}</p>
          <Btn disabled={!approveOK} onClick={() => act({ type: 'approve' })}>{s('sc_approve')}</Btn>
          <Btn variant="outline" onClick={() => act({ type: 'reject' })}>{s('sc_reject')}</Btn>
        </div>}
        <label className="sc-field">{s('sc_clock')}<input className="tc-input" type="datetime-local" value={dateInput(demo.now)} onChange={e => { const now = new Date(e.target.value).getTime(); if (Number.isFinite(now)) act({ type: 'clock', now }) }} /></label>
        <Btn variant="outline" disabled={!demo.running || !info.playable} onClick={() => act({ type: 'tick', seconds: 60 })}>{s('sc_advance')}</Btn>
        <Btn variant="ghost" onClick={() => act({ type: 'reset' })}>{s('sc_reset')}</Btn>
      </div></Card>
    </div>
    <p className="sc-help">{s('sc_session')}</p>
    <Card><div className="sc-stack"><h2 className="sc-title">{s('sc_history')}</h2>
      {!demo.history.length && <p className="sc-help">{s('sc_history_empty')}</p>}
      {demo.history.map((event, i) => <div key={i} className="sc-row"><span>{new Date(event.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span>{s(`sc_event_${event.type}`, { n: event.n })}</span></div>)}
    </div></Card>
  </div>
}

export default function ScreenControlSettings() {
  const s = useT(), nav = useNavigate()
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(false)
  const [children, setChildren] = useState([]), [childId, setChildId] = useState('')
  const [parentId, setParentId] = useState(''), [saved, setSaved] = useState({})
  const [rules, setRules] = useState(() => readRules()), [tab, setTab] = useState('rules')
  const [saving, setSaving] = useState(false), [message, setMessage] = useState('')
  async function load() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('auth')
      const [family, parent] = await Promise.all([
        supabase.from('children').select('id,name,language').eq('parent_id', user.id).order('created_at'),
        supabase.from('parents').select('prefs').eq('id', user.id).single(),
      ])
      if (family.error || parent.error) throw family.error || parent.error
      adoptAccountLang(parent.data.prefs?.language)
      const stored = parent.data.prefs?.screen_control_web || {}
      family.data.forEach(child => { if (stored[child.id]) cacheDemoRules(child.id, readRules(stored[child.id])) })
      setParentId(user.id); setChildren(family.data); setSaved(stored)
      setChildId(family.data[0]?.id || ''); setRules(readRules(stored[family.data[0]?.id]))
    } catch { setLoadError(true) }
    finally { setLoading(false) }
  }
  // load() awaits auth and database reads before updating state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])
  const child = children.find(c => c.id === childId)
  const dirty = JSON.stringify(rules) !== JSON.stringify(readRules(saved[childId]))
  const valid = validRules(rules)
  const change = (key, value) => { setRules(r => ({ ...r, [key]: value })); setMessage('') }
  async function save() {
    if (!valid || saving) return
    setSaving(true); setMessage('')
    try {
      const prefs = await updateParentPrefs(parentId, current => ({ ...current, screen_control_web: { ...(current.screen_control_web || {}), [childId]: rules } }))
      cacheDemoRules(childId, rules)
      setSaved(prefs.screen_control_web); setMessage('sc_saved')
    } catch { setMessage('sc_save_error') }
    finally { setSaving(false) }
  }
  return <div className="sc-page"><style>{CSS}</style>
    <TopBar title={s('sc_title')} onBack={() => nav('/parent/settings')} />
    <main className="sc-body">
      <Card style={{ background: PC.tealBg }}><div className="sc-stack"><Pill>{s('sc_demo')}</Pill><p className="sc-help">{s('sc_notice')}</p></div></Card>
      {loading ? <p role="status">{s('loading')}</p> : loadError ? <Card><p role="alert">{s('sc_load_error')}</p><Btn onClick={() => { setLoading(true); setLoadError(false); load() }}>{s('sc_retry')}</Btn></Card> : !child ? <p>{s('sc_no_child')}</p> : <>
        <label className="sc-field">{s('sc_child')}<select className="tc-input" value={childId} disabled={saving || dirty} onChange={e => { setChildId(e.target.value); setRules(readRules(saved[e.target.value])); setMessage('') }}>{children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {dirty && <div className="sc-row"><p role="status" className="sc-help">{s('sc_unsaved')}</p><Btn full={false} variant="ghost" disabled={saving} onClick={() => { setRules(readRules(saved[childId])); setMessage('') }}>{s('cancel')}</Btn></div>}
        <div className="sc-tabs" role="tablist" aria-label={s('sc_title')}>
          {['rules','preview'].map(id => <button key={id} role="tab" aria-selected={tab === id} className="sc-tab" disabled={id === 'preview' && !valid} onClick={() => setTab(id)}>{s(`sc_${id}`)}</button>)}
        </div>
        {tab === 'rules' ? <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><div className="sc-grid">
          <div className="sc-stack">
            <Card><div className="sc-stack"><h2 className="sc-title">{s('sc_limits')}</h2>
              {['weekday','weekend','cap'].map(key => <NumberField key={key} label={s(`sc_${key}`)} value={rules[key]} onChange={v => change(key, v)} />)}
            </div></Card>
            <Card><div className="sc-stack"><h2 className="sc-title">{s('sc_rewards')}</h2>
              <NumberField label={s('sc_rate')} value={rules.gemsPerMinute} min={1} max={100} onChange={v => change('gemsPerMinute', v)} />
              <NumberField label={s('sc_earned_cap')} value={rules.earnedCap} onChange={v => change('earnedCap', v)} />
              <label className="sc-check"><input type="checkbox" checked={rules.approval} onChange={e => change('approval', e.target.checked)} />{s('sc_approval')}</label>
            </div></Card>
          </div>
          <div className="sc-stack">
            <Card><div className="sc-stack"><h2 className="sc-title">{s('sc_schedules')}</h2>
              <Schedule s={s} rules={rules} change={change} name="bedtime" start="bedStart" end="bedEnd" labelKey="sc_bedtime" />
              <Schedule s={s} rules={rules} change={change} name="school" start="schoolStart" end="schoolEnd" labelKey="sc_school" />
              <p className="sc-help">{s('sc_timezone', { zone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</p>
            </div></Card>
            <Card><div className="sc-stack"><h2 className="sc-title">{s('sc_apps')}</h2><p className="sc-help">{s('sc_apps_note')}</p>
              {SAMPLE_APPS.map(app => <label key={app} className="sc-field">{APP_NAMES[app]}<select className="tc-input" value={rules.apps[app]} disabled={app === 'tuto'} onChange={e => change('apps', { ...rules.apps, [app]: e.target.value })}>{['timed','allowed','blocked'].map(mode => <option key={mode} value={mode}>{s(`sc_${mode}`)}</option>)}</select></label>)}
            </div></Card>
          </div>
        </div></fieldset> : <Demo key={childId} rules={rules} child={child} />}
        {!valid && <p role="alert" style={{ color: PC.danger }}>{s('sc_invalid')}</p>}
        {message && <p role="status" style={{ color: message === 'sc_saved' ? PC.tealDeep : PC.danger }}>{s(message)}</p>}
        <Btn onClick={save} disabled={!valid || saving}>{s(saving ? 'saving' : 'save')}</Btn>
      </>}
    </main>
  </div>
}
