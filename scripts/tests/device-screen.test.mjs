import {test} from 'node:test'
import assert from 'node:assert/strict'
import {validatePolicy,validateUsage,defaultPolicy,installDeviceScreenTime} from '../../server/deviceScreenTime.js'
test('rules default off; malformed inputs are never silently accepted',()=>{
 assert.equal(defaultPolicy().enabled,false)
 assert.equal(Object.keys(validatePolicy(defaultPolicy()).apps).length,3)
 for(const patch of [{weekday:-1},{weekend:1441},{timezone:'not/a/zone'},{start:'25:00'},{end:'12:70'},{enabled:'true'},{weekendDays:[7]}])assert.throws(()=>validatePolicy({...defaultPolicy(),...patch}))
 assert.throws(()=>validatePolicy({...defaultPolicy(),apps:{netflix:{mode:'timed',limit:-1}}}))
})
test('telemetry rejects bad packages, negative usage and unbounded batches',()=>{
 assert.equal(validateUsage([{day:'2026-10-20',package:'app.tuto.mobile.preview',seconds:3600,label:'Tuto'}])[0].seconds,3600)
 for(const seconds of [-1,90001,NaN,1.2])assert.throws(()=>validateUsage([{day:'2026-10-20',package:'x',seconds,label:'x'}]))
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
