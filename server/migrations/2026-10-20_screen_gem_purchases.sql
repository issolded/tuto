-- Apply after 2026-10-20_device_screen_time.sql. No existing Gems are modified.
create table if not exists public.screen_purchases (
 id uuid primary key, child_id uuid not null references public.children(id) on delete cascade,
 device_id uuid not null references public.screen_devices(id) on delete cascade,
 day date not null, package text not null, minutes integer not null check(minutes>0),
 gems integer not null check(gems>0), created_at timestamptz not null default now()
);
create index if not exists screen_purchases_child_day on public.screen_purchases(child_id,day);
alter table public.screen_purchases enable row level security;
revoke all on public.screen_purchases from anon,authenticated;
grant all on public.screen_purchases to service_role;

-- Serialize all negative ledger inserts, including existing reward/parent spend paths.
-- Without this guard, a reward claim and a screen purchase could spend the same balance.
create schema if not exists tuto_private;
revoke all on schema tuto_private from public,anon,authenticated;
create or replace function tuto_private.guard_gem_debit() returns trigger
language plpgsql security definer set search_path=public as $$
declare balance bigint;
begin
 if new.amount < 0 then
  perform 1 from public.children where id=new.child_id for update;
  select coalesce(sum(amount),0) into balance from public.bt_ledger where child_id=new.child_id;
  if balance + new.amount < 0 then raise exception 'insufficient_gems'; end if;
 end if;
 return new;
end; $$;
revoke all on function tuto_private.guard_gem_debit() from public,anon,authenticated;
drop trigger if exists guard_gem_debit on public.bt_ledger;
create trigger guard_gem_debit before insert on public.bt_ledger for each row execute function tuto_private.guard_gem_debit();

create or replace function public.screen_shop(p_device uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare d public.screen_devices; p jsonb; rev bigint; today date; balance bigint; used integer; bonus jsonb;
begin
 select * into d from public.screen_devices where id=p_device and revoked_at is null and token_hash is not null;
 if not found then raise exception 'device_revoked'; end if;
 select policy,revision into p,rev from public.screen_policies where child_id=d.child_id;
 today := (now() at time zone coalesce(p->>'timezone','Asia/Dubai'))::date;
 select coalesce(sum(amount),0) into balance from public.bt_ledger where child_id=d.child_id;
 select coalesce(sum(minutes),0) into used from public.screen_purchases where child_id=d.child_id and day=today;
 select coalesce(jsonb_object_agg(package,total),'{}'::jsonb) into bonus from
  (select package,sum(minutes) total from public.screen_purchases where device_id=d.id and day=today group by package) b;
 return jsonb_build_object('day',today,'balance',balance,'purchased_today',used,'bonus',bonus,'revision',coalesce(rev,0),
  'offer',coalesce(p->'purchase','{"enabled":false,"gemCost":10,"minutes":15,"dailyMax":60}'::jsonb));
end; $$;

create or replace function public.buy_screen_minutes(p_device uuid,p_request uuid,p_package text,p_revision bigint) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare d public.screen_devices; receipt public.screen_purchases; p jsonb; rev bigint; offer jsonb;
 today date; clock_text text; budget integer; cost integer; mins integer; used integer; balance bigint;
begin
 select * into d from public.screen_devices where id=p_device and revoked_at is null and token_hash is not null for update;
 if not found then raise exception 'device_revoked'; end if;
 perform 1 from public.children where id=d.child_id for update;
 select * into receipt from public.screen_purchases where id=p_request;
 if found then
  if receipt.device_id<>d.id or receipt.package<>p_package then raise exception 'request_conflict'; end if;
  return public.screen_shop(d.id) || jsonb_build_object('receipt',to_jsonb(receipt));
 end if;
 select policy,revision into p,rev from public.screen_policies where child_id=d.child_id for share;
 if rev is distinct from p_revision then raise exception 'offer_changed'; end if;
 offer:=p->'purchase';
 if not coalesce((p->>'enabled')::boolean,false) or not coalesce((offer->>'enabled')::boolean,false) then raise exception 'purchases_disabled'; end if;
 if p->'apps'->p_package->>'mode' is distinct from 'timed' then raise exception 'app_not_eligible'; end if;
 today:=(now() at time zone (p->>'timezone'))::date;
 clock_text:=to_char(now() at time zone (p->>'timezone'),'HH24:MI');
 if p->>'start' <> p->>'end' and not (case when p->>'start'<p->>'end' then clock_text>=p->>'start' and clock_text<p->>'end' else clock_text>=p->>'start' or clock_text<p->>'end' end) then raise exception 'outside_allowed_hours'; end if;
 cost:=(offer->>'gemCost')::integer; mins:=(offer->>'minutes')::integer; budget:=(offer->>'dailyMax')::integer;
 if cost is null or cost<1 or cost>10000 or mins is null or mins<1 or mins>120 or budget is null or budget<mins or budget>240 then raise exception 'invalid_offer'; end if;
 select coalesce(sum(minutes),0) into used from public.screen_purchases where child_id=d.child_id and day=today;
 if used+mins>budget then raise exception 'purchase_daily_limit'; end if;
 select coalesce(sum(amount),0) into balance from public.bt_ledger where child_id=d.child_id;
 if balance<cost then raise exception 'insufficient_gems'; end if;
 insert into public.bt_ledger(child_id,amount,reason) values(d.child_id,-cost,'Screen time: +'||mins||' min · '||p_package);
 insert into public.screen_purchases(id,child_id,device_id,day,package,minutes,gems) values(p_request,d.child_id,d.id,today,p_package,mins,cost) returning * into receipt;
 return public.screen_shop(d.id) || jsonb_build_object('receipt',to_jsonb(receipt));
end; $$;
revoke all on function public.screen_shop(uuid),public.buy_screen_minutes(uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.screen_shop(uuid),public.buy_screen_minutes(uuid,uuid,text,bigint) to service_role;
