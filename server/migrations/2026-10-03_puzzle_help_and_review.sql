-- Puzzle (NVR) help and the review round, the twin of 2026-10-03_english_help_and_review.sql.
-- Run in the Supabase SQL editor. Safe to run twice. Without it the server behaves as before.

alter table puzzle_attempts add column if not exists wrong_tries int not null default 0;
alter table puzzle_attempts add column if not exists hints_used  int not null default 0;

create table if not exists puzzle_reviews (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references children(id) on delete cascade,
  session_id    uuid not null references puzzle_sessions(id) on delete cascade,
  state         text not null default 'offered' check (state in ('offered', 'declined', 'done', 'expired')),
  -- [{ idx, topic_id: 'type|attr', topic_name, earned }]
  picks         jsonb not null,
  -- The fresh puzzles, answers included. Server side only (RLS on, no policy).
  sheet         jsonb not null,
  -- [{ q, idx, correct, chosen_index, help_used, help_shown }] as the child answered them.
  results       jsonb not null default '[]'::jsonb,
  summary       jsonb not null,
  gems          int not null default 0,
  carry_types   jsonb,
  carry_used_at timestamptz,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  resolved_at   timestamptz
);

create index if not exists puzzle_reviews_open on puzzle_reviews (created_at) where state = 'offered';
create index if not exists puzzle_reviews_child_time on puzzle_reviews (child_id, created_at desc);
alter table puzzle_reviews enable row level security;
