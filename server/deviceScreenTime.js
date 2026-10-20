import { randomBytes, createHash } from 'node:crypto'
const hash = s => createHash('sha256').update(s).digest('hex')
const validDay = s => typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s
const integer = (n, max) => Number.isInteger(n) && n >= 0 && n <= max
export const SCREEN_APPS = ['com.google.android.youtube', 'com.netflix.mediaclient', 'com.roblox.client']
export function validatePolicy(p) {
  if (!p || typeof p.enabled !== 'boolean' || !integer(p.weekday,1440) || !integer(p.weekend,1440)) throw Error('invalid_policy')
  if(typeof p.timezone!=='string' || !p.timezone) throw Error('invalid_timezone')
  try { new Intl.DateTimeFormat('en',{timeZone:p.timezone}).format() } catch { throw Error('invalid_timezone') }
  if (!Array.isArray(p.weekendDays) || p.weekendDays.length > 7 || p.weekendDays.some(d=>!integer(d,6))) throw Error('invalid_weekend')
  if (!/^\d{2}:\d{2}$/.test(p.start) || !/^\d{2}:\d{2}$/.test(p.end) || [p.start,p.end].some(t=>+t.slice(0,2)>23 || +t.slice(3)>59)) throw Error('invalid_hours')
  if (!p.apps || Object.keys(p.apps).length > 100) throw Error('invalid_apps')
  for (const [pkg,a] of Object.entries(p.apps)) if (!/^[a-zA-Z0-9_.]+$/.test(pkg) || !['timed','allowed','blocked'].includes(a.mode) || !integer(a.limit,1440)) throw Error('invalid_app')
  return {enabled:p.enabled,weekday:p.weekday,weekend:p.weekend,weekendDays:p.weekendDays,timezone:p.timezone,start:p.start,end:p.end,apps:p.apps}
}
export function defaultPolicy() { return {enabled:false,weekday:60,weekend:90,weekendDays:[0,6],timezone:'Asia/Dubai',start:'00:00',end:'00:00',apps:Object.fromEntries(SCREEN_APPS.map(p=>[p,{mode:'timed',limit:1440}]))} }
export function validateUsage(rows) {
  if (!Array.isArray(rows) || rows.length>3000) throw Error('invalid_usage')
  return rows.map(r=>{
    if (!validDay(r.day) || !/^[a-zA-Z0-9_.]{1,180}$/.test(r.package) || !integer(r.seconds,90000) || typeof r.label!=='string') throw Error('invalid_usage')
    return {day:r.day,package:r.package,label:r.label.slice(0,100),seconds:r.seconds}
  })
}
export function installDeviceScreenTime(app, db, parentFromBearer) {
  const checked = async q => {const {data,error}=await q;if(error) throw Error('storage_unavailable');return data}
  const route = fn => async(req,res)=>{try{await fn(req,res)}catch(e){res.status(e.status || (e.message.startsWith('invalid')?400:503)).json({error:e.status ? 'not_authorized' : e.message==='storage_unavailable'?'screen_time_not_ready':e.message})}}
  const deny = (status=403)=>{throw Object.assign(Error('denied'),{status})}
  async function parent(req) {
    const id=await parentFromBearer(req); if(!id) deny(401)
    const c=await checked(db.from('children').select('id').eq('id',req.params.childId).eq('parent_id',id).maybeSingle());if(!c) deny();return id
  }
  async function device(req) {
    const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(!/^[a-f0-9]{64}$/.test(token)) deny(401)
    const d=await checked(db.from('screen_devices').select('*').eq('token_hash',hash(token)).is('revoked_at',null).maybeSingle());if(!d) deny(401);return d
  }
  const root='/api/parent/children/:childId/device-screen'
  app.get(root,route(async(req,res)=>{
    await parent(req)
    const policy=await checked(db.from('screen_policies').select('*').eq('child_id',req.params.childId).maybeSingle())
    const devices=await checked(db.from('screen_devices').select('id,name,created_at,last_seen,status,applied_revision,revoked_at').eq('child_id',req.params.childId).order('created_at',{ascending:false}))
    res.json({policy:policy?.policy||defaultPolicy(),revision:policy?.revision||0,devices})
  }))
  app.put(root,route(async(req,res)=>{
    const id=await parent(req), policy=validatePolicy(req.body.policy)
    // Optimistic update prevents a stale parent editor from overwriting a newer rule.
    const existing=await checked(db.from('screen_policies').select('revision').eq('child_id',req.params.childId).maybeSingle())
    if(existing && existing.revision!==req.body.revision) return res.status(409).json({error:'policy_changed'})
    const revision=Math.max(Date.now(),(existing?.revision||0)+1)
    const row={child_id:req.params.childId,parent_id:id,policy,revision}
    if(existing) { const data=await checked(db.from('screen_policies').update(row).eq('child_id',req.params.childId).eq('revision',existing.revision).select('revision'));if(!data.length)return res.status(409).json({error:'policy_changed'}) }
    else await checked(db.from('screen_policies').insert(row))
    res.json({policy,revision})
  }))
  app.post(root+'/pair',route(async(req,res)=>{
    const id=await parent(req), code=randomBytes(6).toString('hex').toUpperCase()
    await checked(db.from('screen_devices').insert({parent_id:id,child_id:req.params.childId,pair_hash:hash(code),pair_until:new Date(Date.now()+600000).toISOString(),name:'Android'}))
    res.json({code,expires_in:600})
  }))
  app.post(root+'/revoke/:deviceId',route(async(req,res)=>{
    await parent(req);await checked(db.from('screen_devices').update({revoked_at:new Date().toISOString(),token_hash:null,pair_hash:null}).eq('id',req.params.deviceId).eq('child_id',req.params.childId));res.json({ok:true})
  }))
  app.get(root+'/usage',route(async(req,res)=>{
    await parent(req)
    const {from,to,device:deviceId}=req.query
    if(!validDay(from)||!validDay(to)||from>to|| (Date.parse(to)-Date.parse(from))/86400000>31) throw Error('invalid_range')
    let q=db.from('screen_usage').select('device_id,day,package,label,seconds').eq('child_id',req.params.childId).gte('day',from).lte('day',to).order('day').order('package').order('device_id')
    if(deviceId) q=q.eq('device_id',deviceId)
    const rows=[];for(let offset=0;offset<100000;offset+=1000){const page=await checked(q.range(offset,offset+999));rows.push(...page);if(page.length<1000)break}
    res.json({rows})
  }))
  app.post('/api/device-screen/enroll',route(async(req,res)=>{
    const code=String(req.body.code||'').toUpperCase().replace(/\s/g,'');if(!/^[A-F0-9]{12}$/.test(code))deny(401)
    const token=randomBytes(32).toString('hex')
    const rows=await checked(db.from('screen_devices').update({token_hash:hash(token),pair_hash:null,name:String(req.body.name||'Android').slice(0,80)}).eq('child_id',req.body.child_id).eq('pair_hash',hash(code)).is('token_hash',null).is('revoked_at',null).gt('pair_until',new Date().toISOString()).select('id,child_id'))
    if(rows.length!==1)deny(401)
    res.json({token,device_id:rows[0].id,child_id:rows[0].child_id})
  }))
  app.post('/api/device-screen/sync',route(async(req,res)=>{
    const d=await device(req), rows=validateUsage(req.body.rows||[])
    // Cumulative buckets are idempotent: retrying a batch must never add usage twice.
    if(rows.length)await checked(db.from('screen_usage').upsert(rows.map(r=>({...r,device_id:d.id,child_id:d.child_id})),{onConflict:'device_id,day,package'}))
    const status={usage_access:req.body.status?.usage_access===true,accessibility:req.body.status?.accessibility===true,notifications:req.body.status?.notifications===true,measured_since:String(req.body.status?.measured_since||'').slice(0,40),timezone:String(req.body.status?.timezone||'').slice(0,60)}
    await checked(db.from('screen_devices').update({last_seen:new Date().toISOString(),status,applied_revision:Number.isSafeInteger(req.body.applied_revision)?req.body.applied_revision:0}).eq('id',d.id))
    const p=await checked(db.from('screen_policies').select('policy,revision').eq('child_id',d.child_id).maybeSingle())
    res.json({policy:p?.policy||defaultPolicy(),revision:p?.revision||0,server_time:new Date().toISOString()})
  }))
}
