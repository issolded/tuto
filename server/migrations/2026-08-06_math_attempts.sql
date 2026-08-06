-- Per-question maths record, and where a parent's "focus on fractions" lives.
--
-- Why a row per question: math_progress stores one accuracy figure for a session that now
-- spans eight curriculum topics, so "Ada is weak at multiplication" is not derivable from
-- anything we hold. This is the same shape as bt_ledger — the raw events are the truth and
-- every summary is computed from them on read. No mastery table: two stores of the same
-- fact means one of them eventually lies.

create table if not exists math_attempts (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references children(id) on delete cascade,
  -- Groups the questions of one sitting, so a session can be reconstructed.
  session_id   uuid not null,
  -- The curriculum id ('y5_fractions'), not a display name. Year-scoped on purpose: when a
  -- child moves up a school year the ids change, so last year's weaknesses retire by
  -- themselves and nothing has to expire them.
  topic_id     text not null,
  topic_name   text,
  -- 'template' | 'llm' — which half of the hybrid posed it. Without this we could never
  -- answer whether the model's questions go worse than the generated ones.
  source       text not null check (source in ('template', 'llm')),
  level        int  not null,
  question     text,
  child_answer text,
  correct      boolean not null,
  help_used    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Per-topic history for one child, newest first: the mastery read.
create index if not exists math_attempts_child_topic
  on math_attempts (child_id, topic_id, created_at desc);
-- "What came up today" for one child: the parent's question.
create index if not exists math_attempts_child_time
  on math_attempts (child_id, created_at desc);

-- Only the server writes or reads this. RLS on with no policy leaves the service role — which
-- bypasses it — as the only way in, so the anon key the child app carries cannot touch it.
alter table math_attempts enable row level security;

-- The focus a parent asks for in chat: {"topic_id","topic_name","set_at","source"}.
-- Deliberately NOT inside task_settings: onboarding and the settings screen both rewrite that
-- column wholesale, which would silently wipe the focus the next time a parent changed a gem
-- amount.
alter table children add column if not exists math_focus jsonb;
