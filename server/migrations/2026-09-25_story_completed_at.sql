-- A story is dated by the day it was FINISHED, not the day its draft row was created.
-- A draft saved on Monday and completed on Wednesday used to count as Monday's story (or fall
-- outside the child's "today" entirely). The server writes completed_at on first completion
-- and reads it for daily activities; until this runs it falls back to created_at.

alter table stories add column if not exists completed_at timestamptz;

-- Existing completed stories: the creation time is the best record we have.
update stories set completed_at = created_at
 where status = 'completed' and completed_at is null;

create index if not exists stories_child_completed_at_idx
  on stories (child_id, completed_at);
