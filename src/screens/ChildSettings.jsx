import { useNavigate, Navigate } from 'react-router-dom'
import { t, childLang } from '../lib/i18n'
import Shell from '../components/Shell'
import { Icon } from '../lib/parentUI'
import { SAMPLE_APPS, status, canRedeem } from '../lib/screenControl'
import { useCachedDemoRules, useScreenDemo } from '../lib/screenControlDemo'

const FRED = "'TrRound', 'Fredoka', 'Baloo 2', sans-serif"
const NAMES = { roblox: 'Roblox', youtube: 'YouTube', minecraft: 'Minecraft', tuto: 'Tuto' }
function ChildDemo({ child, theme }) {
  const lang = childLang(child), c = key => t(key, lang)
  const { rules, configured } = useCachedDemoRules(child.id)
  const [demo, act] = useScreenDemo(child.id, rules, true)
  const info = status(rules, demo)
  const button = { ...theme.card, padding: '15px 18px', font: 'inherit', fontWeight: 700, cursor: 'pointer', color: theme.ink, width: '100%' }
  return <div style={{ display: 'grid', gap: 16 }}>
    <div style={{ ...theme.card, padding: 18 }}><strong>{c('sc_demo')}</strong><p style={{ lineHeight: 1.65, fontSize: 14 }}>{c('sc_child_notice')}</p>{!configured && <p style={{ fontSize: 14 }}>{c('sc_sample_rules')}</p>}</div>
    <div style={{ ...theme.card, padding: 22, background: '#FFF1CF' }}>
      <div>{c('sc_remaining')}</div><div style={{ fontSize: 48, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} data-testid="child-remaining">{Math.floor(info.remaining / 60)}:{String(info.remaining % 60).padStart(2, '0')}</div>
      <div>{c('sc_demo_gems')}: <strong data-testid="child-gems">{demo.gems}</strong></div>
    </div>
    <label style={{ display: 'grid', gap: 8 }}>{c('sc_apps')}<select value={demo.app} style={button} onChange={e => act({ type: 'app', app: e.target.value })}>{SAMPLE_APPS.map(app => <option key={app} value={app}>{NAMES[app]}</option>)}</select></label>
    <div role="status" style={{ ...theme.card, padding: 18, background: info.playable ? '#d4eed9' : '#fce4cf' }}>{c(`sc_status_${info.reason}`)}</div>
    <button style={{ ...button, background: theme.accent, color: '#fff', opacity: !info.playable && !demo.running ? .5 : 1 }} disabled={!info.playable && !demo.running} onClick={() => act({ type: 'play' })}>{c(demo.running ? 'sc_stop' : 'sc_play')}</button>
    <button style={{ ...button, opacity: canRedeem(rules, demo) ? 1 : .5 }} disabled={!canRedeem(rules, demo)} onClick={() => act({ type: 'request' })}>{c(rules.approval ? 'sc_request' : 'sc_redeem').replace('%n%', rules.gemsPerMinute * 5)}</button>
    {demo.pending && <p role="status">{c('sc_waiting')}</p>}
    <p style={{ fontSize: 13, lineHeight: 1.6 }}>{c('sc_request_hint')}</p>
  </div>
}
export default function ChildSettings({ screenControl = false }) {
  const nav = useNavigate()
  let child
  try { child = JSON.parse(localStorage.getItem('child') || 'null') } catch { child = null }
  if (!child?.id) return <Navigate to="/child" replace />
  const lang = childLang(child), mid = child.age >= 9 && child.age <= 11, mature = child.age >= 12
  const theme = {
    bg: mature ? '#f5f6f8' : mid ? '#f6f4fb' : '#e7ddf6',
    ink: mature ? '#1b1f2a' : mid ? '#20201e' : '#241f3a', accent: mature ? '#5860d8' : '#f79433',
    card: { borderRadius: mature ? 16 : 20, background: '#fff', border: mature ? '1.5px solid #e7e9ef' : mid ? '2px solid #20201e' : 'none', boxShadow: mid ? '0 4px 0 #20201e' : '0 4px 12px rgba(40,30,70,.07)' },
  }
  return <Shell active="home" background={theme.bg}>
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '32px 22px 110px', color: theme.ink, fontFamily: mature ? "'Manrope', 'Nunito', sans-serif" : FRED }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <button aria-label={t('dr_back', lang)} onClick={() => nav(screenControl ? '/child/settings' : '/child/home')} style={{ ...theme.card, width: 46, height: 46, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="back" /></button>
        <h1 style={{ fontSize: 24, margin: 0 }}>{t(screenControl ? 'sc_title' : 'sc_settings', lang)}</h1>
      </div>
      {screenControl ? <ChildDemo child={child} theme={theme} /> : <button onClick={() => nav('/child/settings/screen-control')} style={{ ...theme.card, width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: 20, textAlign: 'left', font: 'inherit', color: theme.ink, cursor: 'pointer' }}>
        <Icon name="clock" color={theme.accent} /><span style={{ flex: 1 }}><strong>{t('sc_title', lang)}</strong><span style={{ display: 'block', fontSize: 13, marginTop: 5 }}>{t('sc_demo', lang)}</span></span><Icon name="chevron" />
      </button>}
    </div>
  </Shell>
}
