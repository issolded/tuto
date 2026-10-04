-- The app's "Ask Tuto" tab: one row per question, with its answer when it comes.
--
-- The question used to live only inside the open screen; a parent who asked and switched tabs
-- lost the answer even though the server had produced it. Now the server writes the question
-- here, answers it in the background, and fills the row — so the answer is there when they come
-- back, on any device, and a notification can later point at it.
--
-- This is the app's own view. The shared transcript (messages) still gets both sides, through
-- handleMessage, exactly as before; Telegram and WhatsApp do not read or write this table.
--
-- Until this has run the server answers in the request itself (the old behaviour), and the app
-- keeps its history on the device.

create table if not exists parent_app_chat (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid not null references parents(id) on delete cascade,
  question    text not null,
  answer      text,
  -- Signed photo links from the two photo-resend tools; they expire within the hour.
  photos      jsonb not null default '[]'::jsonb,
  status      text not null default 'pending' check (status in ('pending', 'answered', 'failed')),
  created_at  timestamptz not null default now(),
  answered_at timestamptz
);

create index if not exists parent_app_chat_parent_time on parent_app_chat (parent_id, created_at desc);

-- Server only: RLS on with no policy leaves the service role as the only way in.
alter table parent_app_chat enable row level security;
