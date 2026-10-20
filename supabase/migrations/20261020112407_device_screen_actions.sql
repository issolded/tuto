-- Apply after server/migrations/2026-10-20_screen_gem_purchases.sql.
-- Device credentials and parent ownership are checked by the API and again in grant RPC.
create table public.screen_events (
 id uuid primary key,
 parent_id uuid not null references public.parents(id) on delete cascade,
 child_id uuid not null references public.children(id) on delete cascade,
 device_id uuid not null references public.screen_devices(id) on delete cascade,
 kind text not null check(kind in ('limit','request','extra','purchase')),
 day date not null, package text not null, label text not null,
 minutes integer not null default 0 check(minutes between 0 and 120),
 gems integer not null default 0 check(gems>=0),
 event_key text not null,
 status text not null default 'recorded' check(status in ('recorded','pending','approved','rejected')),
 request_id uuid references public.screen_events(id),
 created_at timestamptz not null default now(), decided_at timestamptz,
 applied_at timestamptz, notice_claimed_at timestamptz, notice_error boolean not null default false,
 unique(device_id,event_key)
);
create index screen_events_child_time on public.screen_events(child_id,created_at desc);
alter table public.screen_events enable row level security;
revoke all on public.screen_events from public,anon,authenticated;
grant all on public.screen_events to service_role;

create or replace function public.record_screen_event(p_device uuid,p_event jsonb) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare d screen_devices; e screen_events; p jsonb; k text; event_day date; receipt screen_purchases;
begin
 select * into d from screen_devices where id=p_device and revoked_at is null and token_hash is not null for update;
 if not found then raise exception 'device_revoked'; end if;
 select policy into p from screen_policies where child_id=d.child_id;
 event_day:=(p_event->>'day')::date;
 if event_day > (now() at time zone coalesce(p->>'timezone','Asia/Dubai'))::date or event_day < (now() at time zone coalesce(p->>'timezone','Asia/Dubai'))::date-2 then raise exception 'invalid_event_day'; end if;
 if p_event->>'kind'='purchase' then
  select * into receipt from screen_purchases where id=(p_event->>'id')::uuid and device_id=d.id;
  if not found then raise exception 'invalid_receipt'; end if;
  k:='purchase:'||receipt.id;
 elsif p_event->>'kind' in ('request','limit') then
  if p->'apps'->(p_event->>'package')->>'mode' is distinct from 'timed' then raise exception 'app_not_eligible'; end if;
  if p_event->>'kind'='request' and (p_event->>'minutes')::int not in (15,30) then raise exception 'invalid_minutes'; end if;
  k:=(p_event->>'kind')||':'||event_day||':'||(p_event->>'package');
  if p_event->>'kind'='limit' then k:=k||':'||coalesce(p_event->>'budget_key','');
  else
   select * into e from screen_events where device_id=d.id and package=p_event->>'package' and day=event_day and kind='request' and status='pending';
   if found then return to_jsonb(e); end if;
   k:=k||':'||(p_event->>'id');
  end if;
 else raise exception 'invalid_event_kind'; end if;
 insert into screen_events(id,parent_id,child_id,device_id,kind,day,package,label,minutes,gems,event_key,status)
 values((p_event->>'id')::uuid,d.parent_id,d.child_id,d.id,p_event->>'kind',event_day,p_event->>'package',left(p_event->>'label',100),coalesce((p_event->>'minutes')::int,0),coalesce((p_event->>'gems')::int,0),k,case when p_event->>'kind'='request' then 'pending' else 'recorded' end)
 on conflict(device_id,event_key) do nothing returning * into e;
 if e.id is null then select * into e from screen_events where device_id=d.id and event_key=k; end if;
 return to_jsonb(e);
end; $$;

create or replace function public.grant_screen_extra(p_parent uuid,p_child uuid,p_device uuid,p_id uuid,p_package text,p_minutes int,p_request uuid default null) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare d screen_devices; e screen_events; r screen_events; p jsonb; today date; used int;
begin
 if p_minutes not in (15,30) then raise exception 'invalid_minutes'; end if;
 select * into d from screen_devices where id=p_device and child_id=p_child and parent_id=p_parent and revoked_at is null and token_hash is not null for update;
 if not found then raise exception 'device_revoked'; end if;
 perform 1 from children where id=p_child and parent_id=p_parent;
 if not found then raise exception 'not_authorized'; end if;
 select * into e from screen_events where id=p_id;
 if found then
  if e.kind<>'extra' or e.device_id<>p_device or e.package<>p_package or e.minutes<>p_minutes then raise exception 'request_conflict'; end if;
  return to_jsonb(e);
 end if;
 select policy into p from screen_policies where child_id=p_child for share;
 if not coalesce((p->>'enabled')::boolean,false) or p->'apps'->p_package->>'mode' is distinct from 'timed' then raise exception 'app_not_eligible'; end if;
 today:=(now() at time zone (p->>'timezone'))::date;
 if p_request is not null then
  select * into r from screen_events where id=p_request and child_id=p_child and device_id=p_device and package=p_package and kind='request' for update;
  if not found or r.status<>'pending' or r.day<>today then raise exception 'request_not_pending'; end if;
 end if;
 select coalesce(sum(minutes),0) into used from screen_events where device_id=p_device and day=today and kind='extra';
 if used+p_minutes>240 then raise exception 'extra_daily_limit'; end if;
 insert into screen_events(id,parent_id,child_id,device_id,kind,day,package,label,minutes,event_key,status,request_id)
 values(p_id,p_parent,p_child,p_device,'extra',today,p_package,coalesce(r.label,p->'apps'->p_package->>'label',p_package),p_minutes,'extra:'||p_id,'approved',p_request) returning * into e;
 if p_request is not null then update screen_events set status='approved',decided_at=now() where id=p_request; end if;
 return to_jsonb(e);
end; $$;

-- Extends the existing Gem shop response without changing the Gem ledger or quoted offer.
create or replace function public.screen_shop(p_device uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare d screen_devices; p jsonb; rev bigint; today date; balance bigint; used integer; bonus jsonb; grants jsonb;
begin
 select * into d from screen_devices where id=p_device and revoked_at is null and token_hash is not null;
 if not found then raise exception 'device_revoked'; end if;
 select policy,revision into p,rev from screen_policies where child_id=d.child_id;
 today:=(now() at time zone coalesce(p->>'timezone','Asia/Dubai'))::date;
 select coalesce(sum(amount),0) into balance from bt_ledger where child_id=d.child_id;
 select coalesce(sum(minutes),0) into used from screen_purchases where child_id=d.child_id and day=today;
 select coalesce(jsonb_object_agg(package,total),'{}'::jsonb) into bonus from (
  select package,sum(minutes) total from (
   select package,minutes from screen_purchases where device_id=d.id and day=today
   union all select package,minutes from screen_events where device_id=d.id and day=today and kind='extra'
  ) t group by package
 ) b;
 select coalesce(jsonb_agg(id),'[]'::jsonb) into grants from screen_events where device_id=d.id and day=today and kind='extra';
 return jsonb_build_object('day',today,'balance',balance,'purchased_today',used,'bonus',bonus,'grants',grants,'revision',coalesce(rev,0),'offer',coalesce(p->'purchase','{"enabled":false,"gemCost":10,"minutes":15,"dailyMax":60}'::jsonb));
end; $$;
revoke all on function public.record_screen_event(uuid,jsonb),public.grant_screen_extra(uuid,uuid,uuid,uuid,text,int,uuid),public.screen_shop(uuid) from public,anon,authenticated;
grant execute on function public.record_screen_event(uuid,jsonb),public.grant_screen_extra(uuid,uuid,uuid,uuid,text,int,uuid),public.screen_shop(uuid) to service_role;
