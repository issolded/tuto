-- English (verbal reasoning, spelling and grammar): one row per sitting, one row per answer.
-- The same shape as puzzle_sessions / puzzle_attempts and for the same reason: the server
-- generates the questions and keeps the answers, the child's browser is sent the words and
-- nothing that says which option is right, and every answer is checked here.
--
-- The sheet is stored from the start (puzzle_sessions only gained it later): an engine fix
-- changes what a seed generates, and a sitting in progress or opened again from the gem history
-- has to be marked against the questions the child was actually shown.

create table if not exists english_sessions (
  id              uuid primary key default gen_random_uuid(),
  child_id        uuid not null references children(id) on delete cascade,
  -- '7-8' … '11-12', chosen from the child's age when the session starts.
  band            text not null,
  -- 'uk' | 'us': spelling and sound (rhyme, homophones) follow it.
  variety         text not null default 'uk',
  seed            bigint not null,
  question_count  int not null,
  -- The questions as dealt, answers included. Server-side only (RLS on, no policy).
  sheet           jsonb,
  created_at      timestamptz not null default now(),
  -- Set once, by the finish call. A session without it was abandoned part way.
  finished_at     timestamptz,
  correct         int,
  gems_earned     int,
  capped          boolean
);

create index if not exists english_sessions_child_time
  on english_sessions (child_id, created_at desc);

create table if not exists english_attempts (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references english_sessions(id) on delete cascade,
  child_id        uuid not null references children(id) on delete cascade,
  question_index  int not null,
  -- 'synonym', 'apostrophe', 'letter-code', … — the per-skill read for the parent comes from these.
  type            text not null,
  band            text not null,
  -- The option indices the child sent (two for "which TWO"), sorted.
  chosen          int[] not null,
  correct         boolean not null,
  created_at      timestamptz not null default now(),
  -- One answer per question: a second tap cannot turn a wrong answer into a right one.
  unique (session_id, question_index)
);

create index if not exists english_attempts_child_time
  on english_attempts (child_id, created_at desc);

alter table english_sessions enable row level security;
alter table english_attempts enable row level security;

-- British or American English for this child. NULL means "decide from the family's time zone"
-- (a US zone gives 'us', anything else 'uk'); the parent can set it either way.
alter table children add column if not exists english_variety text
  check (english_variety is null or english_variety in ('uk', 'us'));
