import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/parentI18n'
const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'
export default function DeviceSetup() {
 const nav=useNavigate(), s=useT()
 const [children,setChildren]=useState(null), [selected,setSelected]=useState(''), [error,setError]=useState(false), [busy,setBusy]=useState(false), [needsLogin,setNeedsLogin]=useState(false)
 useEffect(()=>{let active=true; (async()=>{
  try {
   const {data:{session}}=await supabase.auth.getSession()
   if (!session) {if(active)setNeedsLogin(true);return}
   const res=await fetch(SERVER+'/api/device/children',{headers:{Authorization:'Bearer '+session.access_token}})
   if(res.status===401){if(active)setNeedsLogin(true);return}
   if(!res.ok)throw Error()
   const data=await res.json();if(active)setChildren(data.children)
  }catch{if(active)setError(true)}
 })();return()=>{active=false}},[])
 async function bind(){
  setBusy(true);setError(false)
  try{
   const {data:{session}}=await supabase.auth.getSession()
   if(!session){setNeedsLogin(true);return}
   const res=await fetch(SERVER+'/api/device/bind',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({child_id:selected})})
   if(!res.ok)throw Error()
   const data=await res.json()
   localStorage.setItem('child_device',JSON.stringify(data))
   localStorage.setItem('family_code',data.family_code)
   localStorage.removeItem('child')
   // This browser is being handed to a child. Keep other parent devices signed in.
   const {error:signOutError}=await supabase.auth.signOut({scope:'local'})
   if(signOutError)throw signOutError
   nav('/child',{replace:true})
  }catch{setError(true)}finally{setBusy(false)}
 }
 return <main style={{maxWidth:480,margin:'0 auto',padding:'48px 24px',fontFamily:'inherit'}}>
  <h1>{s('ds_title')}</h1><p>{s('ds_explain')}</p>
  {needsLogin?<button onClick={()=>nav('/parent/login?next=device')}>{s('ds_parent_login')}</button>:children?<>
   <label htmlFor="device-child">{s('ds_owner')}</label>
   <select id="device-child" value={selected} disabled={busy} onChange={e=>setSelected(e.target.value)} style={{display:'block',width:'100%',padding:16,margin:'16px 0',font:'inherit'}}><option value="">{s('cp_choose_child')}</option>{children.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
   {!children.length&&<p>{s('cp_not_setup')}</p>}
   <button disabled={!selected||busy} onClick={bind} style={{padding:16,width:'100%',font:'inherit'}}>{busy?'…':s('ds_bind')}</button>
  </>:!error&&<p>…</p>}
  {error&&<div role="alert"><p>{s('fs_conn_error')}</p><button onClick={()=>window.location.reload()}>{s('cp_try_again')}</button></div>}
 </main>
}
