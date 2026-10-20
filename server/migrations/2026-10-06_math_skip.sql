-- Topics a parent has asked Tuto to leave out of the maths sessions for a while
-- ([{ topic_id, set_at, until, weeks, source }]). Run in the Supabase SQL editor before deploying.
-- Until it is run the app behaves as before: nothing is skipped and the parent is told it could not be saved.
alter table children add column if not exists math_skip jsonb;
