-- My Drawings module: guided-step catalogue + the child's own paintings.
--
-- Two tables with very different sensitivity:
--   drawings  — generic pencil sketches, no child data. Public, cacheable.
--   paintings — photos the child took of their own drawing. Sensitive.
--
-- No blobs in Postgres. The sketch panels live in the public `drawings`
-- Storage bucket and their URLs are DERIVED, never stored:
--   {SUPABASE_URL}/storage/v1/object/public/drawings/{id}/{age_group}/step-{n}.webp

-- ── Catalogue ────────────────────────────────────────────────────────────────
-- Composite PK (id, age_group): the 9-11 "cat" is a DIFFERENT set of sketches
-- than the 6-8 "cat", not a resize — so each age band is its own row with its
-- own step_count, and the age group is part of the storage path.
create table if not exists drawings (
  id          text not null,                 -- "cat"
  age_group   text not null,                 -- "6-8" | "9-11" | "12-15"
  name_tr     text not null,
  name_en     text not null,
  category    text,                          -- Animals | Characters | Objects | Nature
  step_count  int  not null check (step_count > 0),
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  primary key (id, age_group)
);

-- Only the 6-8 sets exist today; 9-11 rows drop in later with no schema change.
insert into drawings (id, age_group, name_tr, name_en, category, step_count, sort_order) values
  ('cat',   '6-8', 'Kedi',  'Cat',   'Animals',    8, 1),
  ('dog',   '6-8', 'Köpek', 'Dog',   'Animals',    8, 2),
  ('robot', '6-8', 'Robot', 'Robot', 'Characters', 8, 3)
on conflict (id, age_group) do update
  set name_tr = excluded.name_tr,
      name_en = excluded.name_en,
      category = excluded.category,
      step_count = excluded.step_count,
      sort_order = excluded.sort_order;

-- The catalogue is not secret, but it is not client-writable either.
alter table drawings enable row level security;

drop policy if exists "drawings readable by everyone" on drawings;
create policy "drawings readable by everyone"
  on drawings for select
  to anon, authenticated
  using (active);
-- No insert/update/delete policy: only the service role (server) may write.

-- ── The child's paintings ────────────────────────────────────────────────────
-- NOTE ON user_id: the handoff spec says `user_id uuid references auth.users`.
-- That cannot work here — children have NO Supabase session (they sign in with
-- a PIN; the child client is always anon, see src/lib/supabase.js). An
-- auth.uid()-based policy therefore cannot tell one child from another. The key
-- is the child row, and privacy is enforced the way homework photos already are:
-- the bucket is private, clients get NO read policy at all, and every read goes
-- through the server, which mints a short-lived signed URL only after checking
-- the caller (parent JWT + ownership, or the child's own id).
create table if not exists paintings (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references children(id) on delete cascade,
  drawing_id    text,                        -- null = "Draw my own idea"
  age_group     text,                        -- which sketch set was followed
  photo_path    text not null,               -- paintings/{child_id}/{uuid}.webp
  reward_amount int  not null default 0,     -- what the SERVER actually awarded
  created_at    timestamptz not null default now()
);

create index if not exists paintings_child_created_idx
  on paintings (child_id, created_at desc);

-- Daily-cap lookups count today's rewarded rows for one child.
create index if not exists paintings_child_rewarded_idx
  on paintings (child_id, created_at) where reward_amount > 0;

alter table paintings enable row level security;

-- Deliberately NO policies for anon/authenticated. With RLS enabled and no
-- policy, every direct client read and write is denied — including one child
-- trying to read another child's row. The service role bypasses RLS, so the
-- server remains the only way in, and it checks ownership on every call.
drop policy if exists "paintings are server-only" on paintings;

-- ── Storage policies for the private `paintings` bucket ─────────────────────
-- NONE, on purpose.
--
-- An earlier draft granted anon INSERT so the child app could upload straight
-- to the bucket (the pattern homework and chore photos use). That was a hole:
-- child ids are discoverable via GET /api/family/:code/children, so a family
-- code was enough to write arbitrary files into a child's folder and then have
-- the server forward them to the parent.
--
-- The bytes now go through POST /api/children/:id/paintings, which screens the
-- image and writes with the service role. The service role bypasses RLS, so
-- with no policies at all: no client can read, write, or list this bucket, and
-- reads only ever happen as short-lived signed URLs minted by the server.
--
-- If you ran the earlier version of this file, drop that policy:
drop policy if exists "paintings upload by child folder" on storage.objects;
drop policy if exists "paintings readable by owner" on storage.objects;

-- ── Checks ───────────────────────────────────────────────────────────────────
select id, age_group, name_en, step_count from drawings order by sort_order;

-- Both should report rowsecurity = true, and the only policy listed should be
-- the drawings read policy — nothing for paintings.
select tablename, rowsecurity from pg_tables where tablename in ('drawings','paintings');
select tablename, policyname from pg_policies where tablename in ('drawings','paintings');

-- And no storage policy may mention the paintings bucket. Expect zero rows.
select policyname, qual::text, with_check::text
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and (qual::text like '%paintings%' or with_check::text like '%paintings%');

-- ── 2026-07-19 ek: house seti + geçici olarak her yaş grubunda aynı setler ───
-- Yaşa özel çizimler henüz yok. Şema (id, age_group) bileşik anahtarlı olduğu
-- için, aynı görselleri üç bandın da altına koymak şemayı değiştirmiyor: 9-11
-- için gerçek set çizildiğinde sadece o satır ve o storage yolu güncellenir.
insert into drawings (id, age_group, name_tr, name_en, category, step_count, sort_order) values
  ('cat',   '6-8',   'Kedi',  'Cat',   'Animals',    8, 1),
  ('dog',   '6-8',   'Köpek', 'Dog',   'Animals',    8, 2),
  ('robot', '6-8',   'Robot', 'Robot', 'Characters', 8, 3),
  ('house', '6-8',   'Ev',    'House', 'Objects',    8, 4),
  ('cat',   '9-11',  'Kedi',  'Cat',   'Animals',    8, 1),
  ('dog',   '9-11',  'Köpek', 'Dog',   'Animals',    8, 2),
  ('robot', '9-11',  'Robot', 'Robot', 'Characters', 8, 3),
  ('house', '9-11',  'Ev',    'House', 'Objects',    8, 4),
  ('cat',   '12-15', 'Kedi',  'Cat',   'Animals',    8, 1),
  ('dog',   '12-15', 'Köpek', 'Dog',   'Animals',    8, 2),
  ('robot', '12-15', 'Robot', 'Robot', 'Characters', 8, 3),
  ('house', '12-15', 'Ev',    'House', 'Objects',    8, 4)
on conflict (id, age_group) do update
  set name_tr = excluded.name_tr,
      name_en = excluded.name_en,
      category = excluded.category,
      step_count = excluded.step_count,
      sort_order = excluded.sort_order;

select age_group, count(*) as set_sayisi, string_agg(id, ', ' order by sort_order) as setler
from drawings group by age_group order by age_group;
