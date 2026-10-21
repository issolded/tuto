-- A finished English ladder sitting, stored as the child saw it, so the gem history (and the parent's child page)
-- can open it again: each item's public question (no key until answered), what was chosen, and the marks.
-- Run in the Supabase SQL editor. Safe to run twice. Until it is run, sittings are not stored and an English
-- row in the gem history simply does not open; nothing else changes.
--
-- Not evidence: the ladder reads english_literacy_attempts only. This is a copy for showing, written once when the
-- sitting ends (server/literacyLab.js storeSitting). Practice rounds are not stored.

create table if not exists english_literacy_sittings (
  id          uuid primary key,                     -- the sitting id, also bt_ledger.ref_id of its gem row
  child_id    uuid not null references children(id) on delete cascade,
  correct     smallint not null,
  total       smallint not null,
  -- [{ track, step, item: <public item>, skipped, answers: { qid: chosen }, results: { qid: { correct, key, explain, explain_audio } } }]
  items       jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists english_literacy_sittings_child on english_literacy_sittings (child_id, created_at desc);

-- The server writes with the service role; nothing in the browser reads this table directly.
alter table english_literacy_sittings enable row level security;
