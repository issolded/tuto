-- A session that hits the day's limit earns nothing, and until now wrote nothing:
-- bt_ledger was only written when gems > 0, so the child saw four sessions on the
-- home screen and three lines in their history, with the fourth simply gone. Those
-- sessions get a row of their own now — amount 0, capped true.
--
-- The flag is a column rather than "amount = 0" because a zero can arrive honestly:
-- a parent may approve a piece of homework for 0 gems on purpose, and that row must
-- not read as "you hit the limit". Everything that counts gems either sums `amount`
-- (a zero changes nothing) or already filters `amount > 0` (the daily cap counters,
-- the autopilot sweep), so existing readers need no change.
--
-- Run in the Supabase SQL editor. Safe to re-run.

alter table bt_ledger
  add column if not exists capped boolean not null default false;

-- The history screen now reads more rows per child than it used to (every capped
-- session is a row), and it always reads them newest-first for one child.
create index if not exists bt_ledger_child_created_idx
  on bt_ledger (child_id, created_at desc);
