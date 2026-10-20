import {useEffect,useState,useCallback} from 'react'
import {useNavigate,useSearchParams} from 'react-router-dom'
import {supabase} from '../lib/supabase'
import {useT,adoptAccountLang} from '../lib/parentI18n'
import {deviceScreenCall,reportRange,usageTotals} from '../lib/deviceScreenTime'
import {PC,FONT,PCSS,TopBar,Card} from '../lib/parentUI'
import ParentNav from '../components/ParentNav'
const NAMES={'com.google.android.youtube':'YouTube','com.netflix.mediaclient':'Netflix','com.roblox.client':'Roblox'}
const duration=s=>`${Math.floor(s/3600)}h ${Math.floor(s%3600/60)}m`
export default function ParentScreenTime(){
 const s=useT(),nav=useNavigate(),[params]=useSearchParams()
 const wanted=params.get('child')
 const [children,setChildren]=useState([]),[child,setChild]=useState(''),[error,setError]=useState('')
 useEffect(()=>{let alive=true;(async()=>{try{
  const {data:{user}}=await supabase.auth.getUser();if(!user)return nav('/parent/login')
  const [kids,parent]=await Promise.all([supabase.from('children').select('id,name').eq('parent_id',user.id).order('created_at'),supabase.from('parents').select('prefs').eq('id',user.id).single()])
  if(kids.error||parent.error)throw Error('load');if(!alive)return
  adoptAccountLang(parent.data?.prefs?.language);setChildren(kids.data);setChild(kids.data.some(c=>c.id===wanted)?wanted:kids.data[0]?.id||'')
 }catch{if(alive)setError('sc_load_error')}})();return()=>{alive=false}},[nav,wanted])
 return <div className="tc-col" style={{background:PC.bg,minHeight:'100dvh',fontFamily:FONT}}><style>{PCSS}</style><TopBar title={s('st_title')}/><main style={{padding:'16px 18px 112px'}}>
 {error&&<p role="alert">{s(error)}</p>}
 <label>{s('sc_child')}<select className="tc-input" value={child} onChange={e=>setChild(e.target.value)}>{children.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 {child&&<DevicePanel key={child} child={child}/>}
 </main><ParentNav/></div>
}
function DevicePanel({child}){
 const s=useT(),[state,setState]=useState(null),[policy,setPolicy]=useState(null),[report,setReport]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[code,setCode]=useState(''),[saved,setSaved]=useState(false)
 const [period,setPeriod]=useState('day'),[day,setDay]=useState(new Date().toLocaleDateString('en-CA')),[device,setDevice]=useState('')
 const range=reportRange(day,period)
 const call=useCallback((suffix='',method='GET',body)=>deviceScreenCall(child,suffix,method,body),[child])
 const reportKey=`${child}|${range.from}|${range.to}|${device}`
 const rows=report?.key===reportKey?report.rows:null
 async function load(){const j=await call();setState(j);setPolicy(j.policy)}
 useEffect(()=>{let alive=true;call().then(j=>{if(alive){setState(j);setPolicy(j.policy);setDay(new Intl.DateTimeFormat('en-CA',{timeZone:j.policy.timezone}).format(new Date()))}}).catch(()=>{if(alive)setError('ds_unavailable')});return()=>{alive=false}},[call])
 useEffect(()=>{let alive=true;call(`/usage?from=${range.from}&to=${range.to}${device?'&device='+encodeURIComponent(device):''}`).then(j=>{if(alive)setReport({key:reportKey,rows:j.rows})}).catch(()=>{if(alive)setError('ds_unavailable')});return()=>{alive=false}},[call,range.from,range.to,device,reportKey])
 async function act(fn){setBusy(true);setError('');try{await fn()}catch(e){setError(e.message==='policy_changed'?'ds_conflict':'ds_unavailable')}finally{setBusy(false)}}
 function edit(p){setPolicy({...policy,...p});setSaved(false)}
 const totals=rows?usageTotals(rows):null
 if(!state)return <p role="status">{error?s(error):s('loading')}</p>
 return <div style={{display:'grid',gap:16,marginTop:16}}>
 {error&&<p role="alert">{s(error)}</p>}
 <Card><h2>{s('ds_usage')}</h2><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{['day','week','month'].map(v=><button className="tc-btn" key={v} aria-pressed={period===v} onClick={()=>setPeriod(v)}>{s('ds_'+v)}</button>)}</div>
 <input aria-label={s('ds_date')} type="date" value={day} onChange={e=>e.target.value&&setDay(e.target.value)}/><p>{range.from} — {range.to}</p>
 <select aria-label={s('ds_device')} value={device} onChange={e=>setDevice(e.target.value)}><option value="">{s('ds_all_devices')}</option>{state.devices.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>
 {totals?<><h3>{duration(totals.total)}</h3>{!rows.length?<p>{s('ds_no_data')}</p>:<>{totals.apps.map(([pkg,a])=><div key={pkg} style={{margin:'14px 0'}}><div style={{display:'flex',justifyContent:'space-between',gap:10,overflowWrap:'anywhere'}}><span>{NAMES[pkg]||a.label}</span><strong>{duration(a.seconds)}</strong></div><meter style={{width:'100%'}} min="0" max={totals.total||1} value={a.seconds}/></div>)}<h3>{s('ds_daily')}</h3>{Object.entries(totals.days).map(([date,seconds])=><p key={date}>{date} · {duration(seconds)}</p>)}</>}</>:<p>{s('loading')}</p>}
 <small>{s('ds_measure_note')}</small></Card>
 <Card><h2>{s('ds_devices')}</h2>{state.devices.map(d=><div key={d.id} style={{borderBottom:'1px solid #ddd',padding:'12px 0'}}><strong>{d.name}</strong><p>{d.last_seen?new Date(d.last_seen).toLocaleString():s('ds_never')}</p><p>{d.revoked_at?s('ds_revoked'):d.last_seen&&d.applied_revision===state.revision?s('ds_applied'):s('ds_pending')}</p><p>{s('ds_usage_permission')}: {d.status?.usage_access?'✓':'—'} · {s('ds_protection')}: {d.status?.accessibility?'✓':'—'}</p>{!d.revoked_at&&<button disabled={busy} onClick={()=>{if(window.confirm(s('ds_revoke_confirm')))act(async()=>{await call('/revoke/'+d.id,'POST',{});await load()})}}>{s('ds_revoke')}</button>}</div>)}
 <button disabled={busy} onClick={()=>act(async()=>setCode((await call('/pair','POST',{})).code))}>{s('ds_pair')}</button>{code&&<p><strong style={{letterSpacing:2}}>{code}</strong><br/>{s('ds_pair_note')}</p>}</Card>
 <Card><h2>{s('ds_rules')}</h2><fieldset disabled={busy} style={{border:0,padding:0,display:'grid',gap:14}}>
 <label><input type="checkbox" checked={policy.enabled} onChange={e=>edit({enabled:e.target.checked})}/>{s('ds_enabled')}</label>
 {['weekday','weekend'].map(k=><label key={k}>{s('sc_'+k)}<input className="tc-input" type="number" min="0" max="1440" value={policy[k]} onChange={e=>edit({[k]:Number(e.target.value)})}/></label>)}
 <label>{s('ds_timezone')}<input className="tc-input" value={policy.timezone} onChange={e=>edit({timezone:e.target.value})}/></label>
 <label>{s('ds_weekend')}<select value={policy.weekendDays.join(',')} onChange={e=>edit({weekendDays:e.target.value.split(',').map(Number)})}><option value="0,6">{s('ds_sat_sun')}</option><option value="5,6">{s('ds_fri_sat')}</option></select></label>
 <label>{s('ds_start')}<input type="time" value={policy.start} onChange={e=>edit({start:e.target.value})}/></label><label>{s('ds_end')}<input type="time" value={policy.end} onChange={e=>edit({end:e.target.value})}/></label><small>{s('ds_hours_note')}</small>
 {Object.entries(policy.apps).map(([pkg,a])=><div key={pkg}><strong>{NAMES[pkg]||pkg}</strong><select value={a.mode} onChange={e=>edit({apps:{...policy.apps,[pkg]:{...a,mode:e.target.value}}})}>{['timed','allowed','blocked'].map(m=><option key={m} value={m}>{s('sc_'+m)}</option>)}</select>{a.mode==='timed'&&<label>{s('ds_app_limit')}<input type="number" min="0" max="1440" value={a.limit} onChange={e=>edit({apps:{...policy.apps,[pkg]:{...a,limit:Number(e.target.value)}}})}/></label>}</div>)}
 <button onClick={()=>act(async()=>{const j=await call('','PUT',{policy,revision:state.revision});setState({...state,...j});setSaved(true)})}>{s('save')}</button>{saved&&<p role="status">{s('ds_saved')}</p>}
 </fieldset><p>{s('ds_local_note')}</p></Card></div>
}
