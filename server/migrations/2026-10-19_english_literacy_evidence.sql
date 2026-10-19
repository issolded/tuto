-- English literacy evidence (rev. 3, docs/ENGLISH-SKILL-LADDERS.md "Navigasyon ve sözel akıl yürütme").
-- Run in the Supabase SQL editor. Safe to run twice. Nothing reads these tables yet: the ladder engine
-- (src/lib/literacy/ladder.js) is not wired to the server, so running this changes no behaviour today.
--
-- Two kinds of record, kept apart on purpose:
--   english_literacy_attempts  raw answers. Levels and "secure" are NEVER stored: the server rebuilds them from
--                              these rows with ladder.js replay(), so a rule change re-reads the same history.
--   english_parent_events      what was said to or decided by the parent (an offer sent, refused, "don't ask
--                              again", VR switched on or off). These are facts, not readings: they are never
--                              recomputed, so a threshold change cannot make Tuto forget an offer and send it again.

-- One row per answer the child gave on the English ladder.
create table if not exists english_literacy_attempts (
  id               uuid primary key default gen_random_uuid(),
  child_id         uuid not null references children(id) on delete cascade,
  -- The sitting the answer belongs to, and the child's local calendar day (family time zone, set by the server):
  -- "secure" counts days, not sittings.
  session_id       uuid,
  day              date not null,
  -- Where on the ladder: track A | B | Ca | Cd | D | E, step number, and the skill inside the step.
  track            text not null check (track in ('A', 'B', 'Ca', 'Cd', 'D', 'E')),
  step             smallint not null check (step between 1 and 6),
  skill            text not null,
  -- What makes answers depend on each other: one reading text, one word family. One unit of evidence per
  -- (step, skill, grp); the same grp on a later day is a delayed repeat. `grp` because `group` is reserved.
  grp              text not null,
  -- The kind of question (generator type or bank), for "at least two families".
  family           text not null,
  item             text,
  format           text,
  correct          boolean not null,
  -- First try, no hint, no help. Helped answers are stored and shown as practice, never counted as evidence.
  independent      boolean not null,
  hints_used       smallint not null default 0,
  wrong_tries      smallint not null default 0,
  -- The content revision the item came from and the rule version it was judged under (ladder.js RULES_VERSION).
  content_version  text,
  rule_version     text not null,
  created_at       timestamptz not null default now()
);

create index if not exists english_literacy_attempts_child on english_literacy_attempts (child_id, created_at);

-- Server only: answers and keys never go to the browser from here.
alter table english_literacy_attempts enable row level security;

-- Parent-facing facts. Append only.
create table if not exists english_parent_events (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references children(id) on delete cascade,
  kind          text not null check (kind in (
                  'vr_trial_offered',      -- "Word puzzles" trial suggested after a strong first probe
                  'vr_offered',            -- VR suggested because the families' prerequisites are met
                  'vr_offer_declined',     -- parent said not now
                  'vr_offer_unanswered',   -- no answer by the time the next offer would be due
                  'vr_no_more_offers',     -- parent said don't ask again
                  'vr_enabled',            -- VR switched on (detail.source: existing | parent | trial | offer)
                  'vr_disabled',           -- VR switched off by the parent
                  'struggle_noticed'       -- the one-time "struggling at the basics" observation was sent
                )),
  -- Which VR level / tier or which skill the event is about, when it is about one.
  subject       text,
  -- Free detail: the sentence pattern used, the channel, the source of an enable.
  detail        jsonb not null default '{}'::jsonb,
  rule_version  text,
  created_at    timestamptz not null default now()
);

create index if not exists english_parent_events_child on english_parent_events (child_id, created_at);

alter table english_parent_events enable row level security;

-- Append only, enforced by the database rather than by care: an event cannot be edited or deleted.
-- (Deleting the child still removes its events through the foreign key.)
create or replace function english_parent_events_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'english_parent_events is append only';
end;
$$;

drop trigger if exists english_parent_events_no_update on english_parent_events;
create trigger english_parent_events_no_update
  before update on english_parent_events
  for each row execute function english_parent_events_append_only();

drop trigger if exists english_parent_events_no_delete on english_parent_events;
create trigger english_parent_events_no_delete
  before delete on english_parent_events
  for each row when (pg_trigger_depth() = 0)
  execute function english_parent_events_append_only();

-- VR switch per child, for a fast read. The events above are the record; this is their latest state.
alter table children add column if not exists english_vr jsonb;

-- Children who already played the English (VR) card keep it: switched on, source 'existing', one event each.
-- Runs once per child: the event is only written where the column was still empty.
with had as (
  update children c
     set english_vr = jsonb_build_object('enabled', true, 'source', 'existing')
   where c.english_vr is null
     and exists (select 1 from english_sessions s where s.child_id = c.id)
  returning c.id
)
insert into english_parent_events (child_id, kind, detail, rule_version)
select id, 'vr_enabled', jsonb_build_object('source', 'existing'), 'migration-2026-10-19' from had;
