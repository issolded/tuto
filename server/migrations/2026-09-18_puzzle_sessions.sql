-- Shape & pattern puzzles (NVR): one row per sitting, one row per answer.
--
-- The server generates the questions and keeps the answers. The child's browser is sent the
-- figures to draw and nothing that says which option is right, and every answer is checked here
-- against the question regenerated from (band, seed, icons) — the engine is deterministic, so the
-- seed IS the question sheet and nothing about it has to be stored but the seed. That is the
-- difference from maths, whose score is computed in the browser and believed.

create table if not exists puzzle_sessions (
  id              uuid primary key default gen_random_uuid(),
  child_id        uuid not null references children(id) on delete cascade,
  -- '5-6' … '10-11', chosen from the child's age when the session starts.
  band            text not null,
  seed            bigint not null,
  -- Whether the sheet may include icon questions: the child's browser says whether the icon font
  -- arrived. Part of what regenerates the sheet, so it is stored with the seed.
  icons           boolean not null default true,
  question_count  int not null,
  created_at      timestamptz not null default now(),
  -- Set once, by the finish call. A session without it was abandoned part way.
  finished_at     timestamptz,
  correct         int,
  gems_earned     int,
  -- Finished past the day's limit: recorded, not paid. Kept on the session so a capped sitting
  -- is still visible as a sitting — the maths/reading ledger rows it has no way to show.
  capped          boolean
);

create index if not exists puzzle_sessions_child_time
  on puzzle_sessions (child_id, created_at desc);

create table if not exists puzzle_attempts (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references puzzle_sessions(id) on delete cascade,
  child_id        uuid not null references children(id) on delete cascade,
  question_index  int not null,
  -- 'odd-one-out', 'reflection', 'glyph-trait', … and the rule it was built on ('shape',
  -- 'code:fill+size', 'trait:flies'). The per-skill read for the parent comes from these.
  type            text not null,
  rule            text,
  band            text not null,
  chosen_index    int not null,
  correct         boolean not null,
  created_at      timestamptz not null default now(),
  -- One answer per question: a second tap cannot turn a wrong answer into a right one.
  unique (session_id, question_index)
);

create index if not exists puzzle_attempts_child_time
  on puzzle_attempts (child_id, created_at desc);

-- Only the server reads or writes these. RLS on with no policy leaves the service role as the
-- only way in, so the anon key the child app carries cannot touch them.
alter table puzzle_sessions enable row level security;
alter table puzzle_attempts enable row level security;
