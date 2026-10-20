-- Run in Supabase SQL Editor before deploying deviceScreenTime.js.
-- Device tokens and pairing hashes are server-only; no anon/child table access.
create table if not exists public.screen_policies (
 child_id uuid primary key references public.children(id) on delete cascade,
 parent_id uuid not null references public.parents(id) on delete cascade,
 policy jsonb not null, revision bigint not null
);
create table if not exists public.screen_devices (
 id uuid primary key default gen_random_uuid(),
 child_id uuid not null references public.children(id) on delete cascade,
 parent_id uuid not null references public.parents(id) on delete cascade,
 name text not null default 'Android', token_hash text unique, pair_hash text unique,
 pair_until timestamptz, created_at timestamptz not null default now(),
 last_seen timestamptz, revoked_at timestamptz, status jsonb not null default '{}', applied_revision bigint not null default 0
);
create table if not exists public.screen_usage (
 device_id uuid not null references public.screen_devices(id) on delete cascade,
 child_id uuid not null references public.children(id) on delete cascade,
 day date not null, package text not null, label text not null, seconds integer not null check(seconds between 0 and 90000),
 primary key(device_id,day,package)
);
create index if not exists screen_usage_child_day on public.screen_usage(child_id,day);
alter table public.screen_policies enable row level security;
alter table public.screen_devices enable row level security;
alter table public.screen_usage enable row level security;
revoke all on public.screen_policies, public.screen_devices, public.screen_usage from anon, authenticated;
grant all on public.screen_policies, public.screen_devices, public.screen_usage to service_role;
