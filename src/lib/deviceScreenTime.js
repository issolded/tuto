import { supabase } from './supabase'
const SERVER=import.meta.env.VITE_SERVER_URL||'https://tuto-production-d1db.up.railway.app'
export async function deviceScreenCall(childId,suffix='',method='GET',body) {
 const {data:{session}}=await supabase.auth.getSession()
 if(!session)throw Error('auth')
 const r=await fetch(`${SERVER}/api/parent/children/${encodeURIComponent(childId)}/device-screen${suffix}`,{method,headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined})
 const data=await r.json();if(!r.ok)throw Error(data.error||'request_failed');return data
}
export function reportRange(day,period) {
 const d=new Date(day+'T12:00:00Z')
 if(period==='week')d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7)
 if(period==='month')d.setUTCDate(1)
 const from=d.toISOString().slice(0,10)
 if(period==='week')d.setUTCDate(d.getUTCDate()+6)
 if(period==='month'){d.setUTCMonth(d.getUTCMonth()+1);d.setUTCDate(0)}
 return {from,to:d.toISOString().slice(0,10)}
}
export function usageTotals(rows) {
 const apps={},days={}
 for(const r of rows){const a=apps[r.package] ||= {label:r.label,seconds:0};a.seconds+=r.seconds;days[r.day]=(days[r.day]||0)+r.seconds}
 return {apps:Object.entries(apps).sort((a,b)=>b[1].seconds-a[1].seconds),days,total:Object.values(days).reduce((a,b)=>a+b,0)}
}
