-- The review round after a maths session: up to five fresh questions on what the child missed,
-- offered on the result screen. One row per offer.
--
-- Why a table and not a flag on math_progress: the parent's message for the session is HELD until
-- the offer is settled (done, declined, or left alone for 30 minutes), and the message has to be
-- rebuilt later from facts the row carries. It is also where the skills to lean on next session
-- live, and the review's own answers — kept out of math_attempts on purpose, because the ladder
-- reads the newest attempts of a session to judge the level and a review must not become "the
-- last session".
--
-- Without this table the server behaves as before: no offer, the parent is told at once.

create table if not exists math_reviews (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references children(id) on delete cascade,
  -- The math_attempts.session_id of the sitting this review follows.
  session_id    uuid not null,
  -- 'offered' | 'declined' | 'done' | 'expired'. Each way out is a single guarded update, so a
  -- double tap or a retry cannot pay twice or message twice.
  state         text not null default 'offered' check (state in ('offered', 'declined', 'done', 'expired')),
  -- [{ idx, topic_id, topic_name, earned }] — the questions chosen and what the first round paid.
  picks         jsonb not null,
  -- What the held parent message is built from: name-free facts
  -- { correct, total, gems, capped, daily_cap, kind: 'rewarded' | 'capped' | null, note, total_gems_max }.
  summary       jsonb not null,
  -- [{ idx, correct, help_used }] as the child answered the review.
  result        jsonb,
  gems          int not null default 0,
  -- Skills the child still owes: weighted into the next session, once.
  carry_topics  jsonb,
  carry_used_at timestamptz,
  created_at    timestamptz not null default now(),
  -- Set when the child opens the review, so 30 minutes counts from then.
  started_at    timestamptz,
  resolved_at   timestamptz
);

create index if not exists math_reviews_open
  on math_reviews (created_at) where state = 'offered';
create index if not exists math_reviews_child_time
  on math_reviews (child_id, created_at desc);

-- Server only, like math_attempts: RLS on with no policy leaves the service role as the way in.
alter table math_reviews enable row level security;
