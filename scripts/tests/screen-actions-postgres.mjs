process.on('uncaughtException',e=>{console.error(e.message,e.position,e.where);process.exit(1)})
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite')
import fs from 'node:fs'
import assert from 'node:assert/strict'
const db=new PGlite();const root=new URL('../../server/migrations/',import.meta.url).pathname
await db.exec(`create role anon; create role authenticated; create role service_role; create table parents(id uuid primary key); create table children(id uuid primary key,parent_id uuid references parents); create table bt_ledger(id uuid default gen_random_uuid(),child_id uuid references children, amount integer, reason text);`)
for(const file of ['2026-10-20_device_screen_time.sql','2026-10-20_screen_gem_purchases.sql'])await db.exec(fs.readFileSync(root+file,'utf8'))
const child='00000000-0000-4000-8000-000000000001',parent='00000000-0000-4000-8000-000000000002',device='00000000-0000-4000-8000-000000000003';const pkg='com.roblox.client';const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.query('insert into parents values ($1)',[parent]);await db.query('insert into children values ($1,$2)',[child,parent]);await db.query("insert into screen_devices(id,child_id,parent_id,token_hash) values($1,$2,$3,'token')",[device,child,parent]);
let policy={enabled:true,timezone:'Asia/Dubai',start:'00:00',end:'00:00',apps:{[pkg]:{mode:'timed',limit:5}},purchase:{enabled:true,gemCost:10,minutes:15,dailyMax:30}}
await db.query('insert into screen_policies values($1,$2,$3,1)',[child,parent,policy]);await db.query("insert into bt_ledger(child_id,amount,reason) values($1,25,'Earned')",[child]);
const buy=async(n,rev=1)=> (await db.query('select buy_screen_minutes($1,$2,$3,$4) result',[device,id(n),pkg,rev])).rows[0].result;

await db.exec(fs.readFileSync(new URL('../../supabase/migrations/20261020112407_device_screen_actions.sql',import.meta.url),'utf8'));
const day=(await db.query("select (now() at time zone 'Asia/Dubai')::date::text as day")).rows[0].day;
const event=async(n,kind='request')=>(await db.query('select record_screen_event($1,$2) result',[device,{id:id(n),kind,day,package:pkg,label:'Roblox',minutes:kind==='request'?15:0,budget_key:'1'}])).rows[0].result;
const grant=async(n,who=parent,request=null)=>(await db.query('select grant_screen_extra($1,$2,$3,$4,$5,$6,$7) result',[who,child,device,id(n),pkg,15,request])).rows[0].result;
assert.equal((await event(20)).status,'pending');assert.equal((await event(21)).id,id(20));
await assert.rejects(grant(30,id(99)),/device_revoked/);
assert.equal((await grant(30,parent,id(20))).minutes,15);
assert.equal((await grant(30,parent,id(20))).id,id(30));
await assert.rejects(grant(31,parent,id(20)),/request_not_pending/);
let shop=(await db.query('select screen_shop($1) result',[device])).rows[0].result;
assert.equal(shop.bonus[pkg],15);assert.equal(shop.balance,25);assert.deepEqual(shop.grants,[id(30)]);
const purchase=await buy(10);assert.equal(purchase.bonus[pkg],30);assert.equal(purchase.balance,15);
assert.equal((await event(40,'limit')).id,(await event(41,'limit')).id);
await db.query("update screen_events set day=day-1 where kind='extra'");
shop=(await db.query('select screen_shop($1) result',[device])).rows[0].result;assert.equal(shop.bonus[pkg],15);assert.equal(shop.grants.length,0);
await db.exec('set role anon');await assert.rejects(db.query('select * from screen_events'),/permission denied/);await assert.rejects(db.query('select screen_shop($1)',[device]),/permission denied/);await db.exec('reset role');
await db.query('update screen_devices set revoked_at=now() where id=$1',[device]);await assert.rejects(grant(32),/device_revoked/);
console.log('PASS: extra-time ownership, idempotency, request approval, daily expiry, Gem balance separation, combined bonus, notification dedup, anon denial and revocation');await db.close();
