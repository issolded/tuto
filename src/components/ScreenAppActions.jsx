import {useState} from 'react'
import {protectedPackage} from '../../server/screenAppRules'
export default function ScreenAppActions({app,policy,devices,defaultDevice,lang,busy,onSave,onExtra,onClose}) {
 const tr=lang==='tr',es=lang==='es',say=(en,t,s)=>tr?t:es?s:en
 const old=policy.apps[app.package]||{mode:'timed',limit:30}
 const [mode,setMode]=useState(old.mode),[limit,setLimit]=useState(old.limit),[hidden,setHidden]=useState((policy.report?.hidden||[]).includes(app.package)),[device,setDevice]=useState(defaultDevice||devices.find(d=>d.last_seen&&!d.revoked_at)?.id||'')
 const protectedApp=protectedPackage(app.package)
 return <div className="ds-modal-backdrop" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="app-action-title" className="ds-modal" onClick={e=>e.stopPropagation()}>
  <button className="ds-modal-close" onClick={onClose} aria-label={say('Close','Kapat','Cerrar')}>×</button>
  <h2 id="app-action-title">{app.label}</h2>
  <p>{say('Daily limits apply separately on each linked device.','Günlük limit her bağlı cihazda ayrı uygulanır.','Los límites diarios se aplican por dispositivo.')}</p>
  {!protectedApp?<><label>{say('Rule','Kural','Regla')}<select value={mode} onChange={e=>setMode(e.target.value)}><option value="timed">{say('Daily limit','Günlük limit','Límite diario')}</option><option value="blocked">{say('Block','Engelle','Bloquear')}</option><option value="allowed">{say('Allow','İzin ver','Permitir')}</option></select></label>
  {mode==='timed'&&<label>{say('Minutes per day','Günlük dakika','Minutos al día')}<input type="number" min="0" max="1440" value={limit} onChange={e=>setLimit(e.target.value)}/></label>}</>:<p>{say('Learning and essential system apps cannot be blocked here.','Öğrenme ve temel sistem uygulamaları buradan engellenemez.','No se bloquean aquí las apps de aprendizaje y del sistema.')}</p>}
  <label><input type="checkbox" checked={hidden} onChange={e=>setHidden(e.target.checked)}/>{say('Hide from the main report','Ana raporda gizle','Ocultar del informe principal')}</label>
  <small>{say('Hiding an app does not change its limits.','Gizlemek, uygulamanın limitlerini değiştirmez.','Ocultarla no cambia sus límites.')}</small>
  <button disabled={busy||!Number.isInteger(Number(limit))||Number(limit)<0||Number(limit)>1440} onClick={()=>onSave({mode:protectedApp?'allowed':mode,limit:Number(limit),label:app.label},hidden)}>{say('Save rule','Kuralı kaydet','Guardar regla')}</button>
  {!protectedApp&&policy.apps[app.package]?.mode==='timed'&&policy.enabled&&<><hr/><h3>{say('Extra time today','Yalnızca bugün ek süre','Tiempo extra hoy')}</h3><select aria-label={say('Device','Cihaz','Dispositivo')} value={device} onChange={e=>setDevice(e.target.value)}>{devices.filter(d=>d.last_seen&&!d.revoked_at).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select><div className="ds-action-row">{[15,30].map(m=><button key={m} disabled={busy||!device} onClick={()=>onExtra(device,m)}>+{m} {say('min','dk','min')}</button>)}</div><small>{say('Expires tonight. Applies after the tablet syncs; allowed hours still apply.','Gece sona erer. Tablet eşitlenince uygulanır; izin saatleri geçerlidir.','Caduca esta noche. Se aplica al sincronizar; se mantienen los horarios.')}</small></>}
 </section></div>
}
