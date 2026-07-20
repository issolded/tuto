-- My Drawings: reward now needs the parent's approval.
--
-- The module originally rewarded instantly (per the handoff). That changed:
-- a drawing lands as PENDING, the parent approves, and only then are gems
-- written. So `reward_amount` is no longer "what the child got on upload" —
-- it is 0 until approval, then whatever the SERVER decided at approval time.

alter table paintings
  add column if not exists status text not null default 'pending';

-- Guard the values in the database, not just in application code.
alter table paintings drop constraint if exists paintings_status_check;
alter table paintings
  add constraint paintings_status_check
  check (status in ('pending', 'approved', 'rejected'));

alter table paintings
  add column if not exists approved_at timestamptz;

-- Rows created before this change were auto-rewarded on upload, so they are
-- already settled — mark them approved rather than dropping them back into the
-- parent's queue for a reward that was paid days ago.
update paintings
set status = 'approved',
    approved_at = coalesce(approved_at, created_at)
where reward_amount > 0
  and status = 'pending';

-- The parent's pending queue, and the daily cap count, both filter on status.
create index if not exists paintings_child_status_idx
  on paintings (child_id, status, created_at desc);

-- ── Checks ───────────────────────────────────────────────────────────────────
select status, count(*), sum(reward_amount) as toplam_gem
from paintings group by status;

-- Column should be present, not null, defaulting to 'pending'.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name = 'paintings' and column_name in ('status', 'approved_at');
