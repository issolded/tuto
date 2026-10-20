process.on('uncaughtException',e=>{console.error(e.message,e.position,e.where);process.exit(1)})
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite')
import fs from 'node:fs'
import assert from 'node:assert/strict'
const db=new PGlite();const root=new URL('../server/migrations/',import.meta.url)
await db.exec(`create role anon; create role authenticated; create role service_role; create table parents(id uuid primary key); create table children(id uuid primary key,parent_id uuid references parents); create table bt_ledger(id uuid default gen_random_uuid(),child_id uuid references children, amount integer, reason text);`)
for(const file of ['2026-10-20_device_screen_time.sql','2026-10-20_screen_gem_purchases.sql'])await db.exec(fs.readFileSync(new URL(file,root),'utf8'))
const child='00000000-0000-4000-8000-000000000001',parent='00000000-0000-4000-8000-000000000002',device='00000000-0000-4000-8000-000000000003';const pkg='com.roblox.client';const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.query('insert into parents values ($1)',[parent]);await db.query('insert into children values ($1,$2)',[child,parent]);await db.query("insert into screen_devices(id,child_id,parent_id,token_hash) values($1,$2,$3,'token')",[device,child,parent]);
let policy={enabled:true,timezone:'Asia/Dubai',start:'00:00',end:'00:00',apps:{[pkg]:{mode:'timed',limit:5}},purchase:{enabled:true,gemCost:10,minutes:15,dailyMax:30}}
await db.query('insert into screen_policies values($1,$2,$3,1)',[child,parent,policy]);await db.query("insert into bt_ledger(child_id,amount,reason) values($1,25,'Earned')",[child]);
const buy=async(n,rev=1)=> (await db.query('select buy_screen_minutes($1,$2,$3,$4) result',[device,id(n),pkg,rev])).rows[0].result;
let a=await buy(10);assert.equal(a.balance,15);assert.equal(a.bonus[pkg],15);
a=await buy(10);assert.equal(a.balance,15);assert.equal(a.bonus[pkg],15);
await assert.rejects(buy(11,0),/offer_changed/);assert.equal((await buy(11)).balance,5);
await assert.rejects(buy(12),/purchase_daily_limit/);
assert.equal((await db.query('select count(*) n from screen_purchases')).rows[0].n,2);
await assert.rejects(db.query("insert into bt_ledger(child_id,amount) values($1,-6)",[child]),/insufficient_gems/);
// Higher cap must still reject insufficient Gems with no receipt/minutes written.
policy.purchase.dailyMax=60;await db.query('update screen_policies set policy=$1',[policy]);await assert.rejects(buy(12),/insufficient_gems/);
assert.equal((await db.query('select count(*) n from screen_purchases')).rows[0].n,2);
policy.purchase.enabled=false;await db.query('update screen_policies set policy=$1',[policy]);await assert.rejects(buy(12),/purchases_disabled/);assert.equal((await buy(11)).balance,5);
policy.purchase.enabled=true;policy.apps[pkg].mode='blocked';await db.query('update screen_policies set policy=$1',[policy]);await assert.rejects(buy(12),/app_not_eligible/);
policy.apps[pkg].mode='timed';const clock=(await db.query("select to_char((now() at time zone 'Asia/Dubai')+interval '2 hours','HH24:MI') a,to_char((now() at time zone 'Asia/Dubai')+interval '3 hours','HH24:MI') b")).rows[0];policy.start=clock.a;policy.end=clock.b;await db.query('update screen_policies set policy=$1',[policy]);await assert.rejects(buy(12),/outside_allowed_hours/);
// A database failure after the debit must roll the whole purchase back.
policy.start='00:00';policy.end='00:00';await db.query('update screen_policies set policy=$1',[policy]);
await db.query("insert into bt_ledger(child_id,amount) values($1,20)",[child]);
await db.exec("create function fail_receipt() returns trigger language plpgsql as $$ begin raise exception 'receipt_failure'; end $$; create trigger fail_receipt before insert on screen_purchases for each row execute function fail_receipt();");
await assert.rejects(buy(12),/receipt_failure/);
assert.equal((await db.query('select sum(amount) n from bt_ledger where child_id=$1',[child])).rows[0].n,25);
await db.exec('drop trigger fail_receipt on screen_purchases');
await db.query("insert into screen_devices(id,child_id,parent_id,token_hash) values($1,$2,$3,'second')",[id(4),child,parent]);
await assert.rejects(db.query('select buy_screen_minutes($1,$2,$3,1)',[id(4),id(10),pkg]),/request_conflict/);
await db.query('update screen_purchases set day=day-1');
const tomorrow=(await db.query('select screen_shop($1) result',[device])).rows[0].result;assert.deepEqual(tomorrow.bonus,{});assert.equal(tomorrow.purchased_today,0);
await db.exec('set role anon');await assert.rejects(db.query('select screen_shop($1)',[device]),/permission denied/);await db.exec('reset role');
await db.query("update screen_devices set revoked_at=now() where id=$1",[device]);await assert.rejects(buy(11),/device_revoked/);
console.log('PASS: migrations; real PostgreSQL transaction, idempotency, revision, cap, balance, ledger guard, disabled/blocked/hours, revocation');await db.close()
