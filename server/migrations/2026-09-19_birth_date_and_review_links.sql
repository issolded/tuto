-- Three columns, all additive; nothing reads them until the code that follows this file ships.

-- 1. The child's birth date. children.age stays, and the server keeps it in step with this once
--    an hour (syncAgesFromBirthDates) — every reader of age, from the maths year to the puzzle
--    band, moves up on the birthday without being changed. Null for a child set up before this:
--    they keep the age their parent typed, and their card asks for the date.
alter table children add column if not exists birth_date date;

-- 2. Which sitting a ledger row pays for — a puzzle_sessions.id or a math session_id. The gem
--    history links a row to its questions through this. Rows written before it are matched by
--    time instead (the row is written in the same request that finishes the sitting).
alter table bt_ledger add column if not exists ref_id uuid;
create index if not exists bt_ledger_ref_idx on bt_ledger (ref_id) where ref_id is not null;

-- 3. The right answer to each maths question, as shown. The review can say "the answer was 30"
--    for sittings from here on; older ones show the question and what the child wrote.
alter table math_attempts add column if not exists correct_answer text;

-- 4. The sheet a puzzle sitting was dealt, answers included — server-side only (RLS on, no
--    policy). The seed regenerates it only while the engine is unchanged, so a deploy mid-sitting
--    marked the rest of the answers against different questions, and an old sitting reopened
--    from the gem history would show questions the child never saw. Older sittings keep
--    regenerating, and the review refuses one whose regenerated sheet no longer matches.
alter table puzzle_sessions add column if not exists sheet jsonb;
