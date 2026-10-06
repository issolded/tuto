-- What a parent tells Tuto they are unhappy with, or wish were different, in the chat.
-- Until now the model answered "I'll pass it to the team" with nothing behind it; the
-- submit_feedback tool writes the row, and the model may only say it was recorded if this
-- insert succeeded.
--
-- parent_words is what they actually wrote (the truth); summary is one English sentence from the
-- model (so rows can be grouped and read in one language). One row per parent, area and kind per
-- day: repeating the same complaint adds to it (repeats) instead of adding rows.

create table if not exists parent_feedback (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid not null references parents(id) on delete cascade,
  -- Set when the feedback is about one child's screen or numbers; null for the app in general.
  child_id     uuid references children(id) on delete set null,
  kind         text not null check (kind in ('complaint', 'suggestion', 'bug', 'praise')),
  -- A short English label for the part of the app: 'home screen daily quota', 'math hints',
  -- 'parent notifications', 'chat replies'.
  area         text not null,
  parent_words text not null,
  summary      text not null,
  status       text not null default 'new' check (status in ('new', 'seen', 'done', 'wontfix')),
  repeats      int  not null default 1,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists parent_feedback_status_time on parent_feedback (status, created_at desc);
create index if not exists parent_feedback_parent_day on parent_feedback (parent_id, created_at desc);

-- Server only: RLS on with no policy leaves the service role as the only way in.
alter table parent_feedback enable row level security;
