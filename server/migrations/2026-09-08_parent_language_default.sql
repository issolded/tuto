-- The language Tuto writes to a parent in now defaults to English, not Turkish.
--
-- Turkish was the default because the first family was Turkish. That stops being a reason the
-- moment anyone else signs up, and the default was invisible: until the picker landed on the
-- dashboard there was no way to change it at all, so a new parent got Turkish notifications
-- and nothing to do about it.
--
-- Two statements, in this order, and the first one matters. Every row created since the
-- 2026-08-31 migration already carries 'language' explicitly (the column default wrote it in),
-- so the flip below moves nobody. The backfill is for anything older or hand-inserted that
-- lacks the key: those rows read as Turkish today, through the code's fallback, and would
-- silently become English when the fallback changed. Write what they are already getting.

update parents
set prefs = coalesce(prefs, '{}'::jsonb) || jsonb_build_object('language', 'tr')
where prefs is null or not (prefs ? 'language');

alter table parents alter column prefs set default jsonb_build_object(
  'language', 'en',
  'tone', null,
  'bot_name', null,
  'notify_level', 'all',
  'notify_per_task', true,
  'quiet_hours', null,
  'approval_required', jsonb_build_object('contribution', true, 'submission', true, 'drawing', true),
  'daily_proactive_limit', 20,
  'daily_reply_limit', 60
);

-- Check: nobody left without a language, and no existing parent changed language.
-- select prefs->>'language' as language, count(*) from parents group by 1;
