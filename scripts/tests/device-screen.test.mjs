import {test} from 'node:test'
import assert from 'node:assert/strict'
import {validatePolicy,validateUsage,defaultPolicy,installDeviceScreenTime} from '../../server/deviceScreenTime.js'
test('rules default off; malformed inputs are never silently accepted',()=>{
 assert.equal(defaultPolicy().enabled,false)
 assert.equal(Object.keys(validatePolicy(defaultPolicy()).apps).length,3)
 for(const patch of [{weekday:-1},{weekend:1441},{timezone:'not/a/zone'},{timezone:null},{timezone:undefined},{start:'25:00'},{end:'12:70'},{enabled:'true'},{weekendDays:[7]}])assert.throws(()=>validatePolicy({...defaultPolicy(),...patch}))
 assert.throws(()=>validatePolicy({...defaultPolicy(),apps:{netflix:{mode:'timed',limit:-1}}}))
})
test('telemetry rejects bad packages, negative usage and unbounded batches',()=>{
 assert.equal(validateUsage([{day:'2026-10-20',package:'app.tuto.mobile.preview',seconds:3600,label:'Tuto'}])[0].seconds,3600)
 for(const seconds of [-1,90001,NaN,1.2])assert.throws(()=>validateUsage([{day:'2026-10-20',package:'x',seconds,label:'x'}]))
 for(const day of ['2026-02-30','2026-13-01','not-a-day'])assert.throws(()=>validateUsage([{day,package:'x',seconds:1,label:'x'}]))
 assert.throws(()=>validateUsage(Array(3001).fill({})))
})
function harness(user,child){
 const routes={};let reads=0
 const app=Object.fromEntries(['get','put','post'].map(m=>[m,(path,fn)=>{routes[m+' '+path]=fn}]))
 const db={from(){reads++;return {select(){return this},eq(){return this},maybeSingle(){return Promise.resolve({data:child,error:null})}}}}
 installDeviceScreenTime(app,db,async()=>user)
 async function request(route,req={}){let result;const res={code:200,status(code){this.code=code;return this},json(body){result={status:this.code,body};return this}};await routes[route]({headers:{},params:{childId:'child'},...req},res);return result}
 return {request,get reads(){return reads}}
}
test('parent ownership is enforced before reports or rules are read',async()=>{
 const anonymous=harness(null,null)
 assert.equal((await anonymous.request('get /api/parent/children/:childId/device-screen')).status,401)
 assert.equal(anonymous.reads,0)
 const stranger=harness('other-parent',null)
 assert.equal((await stranger.request('get /api/parent/children/:childId/device-screen')).status,403)
 assert.equal(stranger.reads,1)
})
test('device sync does not accept parent JWTs or missing device tokens',async()=>{
 const h=harness('parent',{})
 assert.equal((await h.request('post /api/device-screen/sync',{headers:{authorization:'Bearer parent-jwt'}})).status,401)
 assert.equal(h.reads,0)
})

// In-memory PostgREST semantics exercise the real routes without touching a family.
function integrationHarness(){
 const tables={children:[{id:'child',parent_id:'parent'}],screen_policies:[],screen_devices:[],screen_usage:[]};let serial=0
 const db={from(name){let action='select',payload,filters=[],single=false,columns='*',conflict='';const q={
  select(c='*'){columns=c;return this},eq(k,v){filters.push(r=>r[k]===v);return this},is(k,v){filters.push(r=>(r[k]??null)===v);return this},gt(k,v){filters.push(r=>r[k]>v);return this},gte(k,v){filters.push(r=>r[k]>=v);return this},lte(k,v){filters.push(r=>r[k]<=v);return this},order(){return this},range(){return this},maybeSingle(){single=true;return this},insert(p){action='insert';payload=p;return this},update(p){action='update';payload=p;return this},upsert(p,o){action='upsert';payload=p;conflict=o.onConflict;return this},
  then(resolve){let rows=tables[name].filter(r=>filters.every(f=>f(r)));if(action==='insert'){rows=(Array.isArray(payload)?payload:[payload]).map(r=>({id:'id'+ ++serial,...r}));tables[name].push(...rows)}if(action==='update')rows.forEach(r=>Object.assign(r,payload));if(action==='upsert'){rows=payload.map(r=>{const old=tables[name].find(x=>conflict.split(',').every(k=>x[k]===r[k]));if(old){Object.assign(old,r);return old}tables[name].push({...r});return r})}const data=rows.map(r=>columns==='*'?{...r}:Object.fromEntries(columns.split(',').map(k=>[k,r[k]])));return Promise.resolve({data:single?data[0]||null:data,error:null}).then(resolve)}
 };return q}}
 const routes={},app=Object.fromEntries(['get','put','post'].map(m=>[m,(p,fn)=>{routes[m+' '+p]=fn}]))
 installDeviceScreenTime(app,db,async req=>req.headers.authorization==='Bearer parent-session'?'parent':null)
 async function request(method,path,body={},token='parent-session',params={}){let answer;const res={code:200,status(n){this.code=n;return this},json(body){answer={status:this.code,body};return this}};await routes[method+' '+path]({headers:{authorization:'Bearer '+token},params:{childId:'child',...params},query:{from:'2026-10-20',to:'2026-10-20'},body},res);return answer}
 return {request,tables}
}
const root='/api/parent/children/:childId/device-screen'
test('pair once, sync cumulative usage twice, report once, revoke device',async()=>{
 const {request}=integrationHarness()
 const pair=await request('post',root+'/pair');assert.equal(pair.status,200)
 const enroll=await request('post','/api/device-screen/enroll',{code:pair.body.code,child_id:'child',name:'Test tablet'},'')
 assert.equal(enroll.status,200);assert.match(enroll.body.token,/^[a-f0-9]{64}$/)
 assert.equal((await request('post','/api/device-screen/enroll',{code:pair.body.code,child_id:'child'},'')).status,401)
 const data={rows:[{day:'2026-10-20',package:'com.roblox.client',label:'Roblox',seconds:120}],status:{usage_access:true},applied_revision:0}
 for(let i=0;i<2;i++)assert.equal((await request('post','/api/device-screen/sync',data,enroll.body.token)).status,200)
 const report=await request('get',root+'/usage');assert.equal(report.body.rows.length,1);assert.equal(report.body.rows[0].seconds,120)
 await request('post',root+'/revoke/:deviceId',{},'parent-session',{deviceId:enroll.body.device_id})
 assert.equal((await request('post','/api/device-screen/sync',data,enroll.body.token)).status,401)
})
test('parent saves rule and stale revision cannot overwrite it',async()=>{
 const {request}=integrationHarness();const policy={...defaultPolicy(),enabled:true,weekday:25}
 const first=await request('put',root,{policy,revision:0});assert.equal(first.status,200)
 const second=await request('put',root,{policy:{...policy,weekday:10},revision:first.body.revision});assert.equal(second.status,200);assert.ok(second.body.revision>first.body.revision)
 assert.equal((await request('put',root,{policy,revision:first.body.revision})).status,409)
 assert.equal((await request('get',root)).body.policy.weekday,10)
})
