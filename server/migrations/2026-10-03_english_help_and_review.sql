-- English help (hints, one try then help) and the review round after a sitting.
-- Run in the Supabase SQL editor. Safe to run twice.
--
-- Without this the server behaves as before: no per-question tries or hints are recorded, gems
-- fall back to the old accuracy scale, and no review is offered (the parent is told at once).

-- What each question cost: wrong tries before it was settled, and whether a hint was looked at.
alter table english_attempts add column if not exists wrong_tries int not null default 0;
alter table english_attempts add column if not exists hints_used  int not null default 0;

-- The review round: up to five fresh questions of the KINDS the child missed or needed help
-- with, offered on the result screen. One row per offer, the same shape as math_reviews, plus the
-- sheet (the server deals the questions and keeps the answers, as for a sitting) and the results.
create table if not exists english_reviews (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references children(id) on delete cascade,
  -- The english_sessions row this review follows.
  session_id    uuid not null references english_sessions(id) on delete cascade,
  -- 'offered' | 'declined' | 'done' | 'expired'. Each way out is one guarded update.
  state         text not null default 'offered' check (state in ('offered', 'declined', 'done', 'expired')),
  -- [{ idx, type, skill, earned }]: the sitting's questions the review stands in for, and what the
  -- sitting paid for each (0 wrong, 0.5 helped, 1 alone).
  picks         jsonb not null,
  -- The fresh questions, answers included. Server side only (RLS on, no policy).
  sheet         jsonb not null,
  -- [{ idx, correct, help_used, chosen }] as the child answered them.
  results       jsonb not null default '[]'::jsonb,
  -- What the held parent message is built from.
  summary       jsonb not null,
  gems          int not null default 0,
  -- Kinds the child still owes: weighted into the next sitting, once.
  carry_types   jsonb,
  carry_used_at timestamptz,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  resolved_at   timestamptz
);

create index if not exists english_reviews_open on english_reviews (created_at) where state = 'offered';
create index if not exists english_reviews_child_time on english_reviews (child_id, created_at desc);

alter table english_reviews enable row level security;
