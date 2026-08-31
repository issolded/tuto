-- The exit gate (sendGate in server/index.js) now reads prefs, so the keys it reads need a
-- known shape. Until today nothing read them: nine keys sat in every parents.prefs row as a
-- column default that no code ever wrote and no parent ever chose.
--
-- allowed_hours goes rather than gets honoured. Every row says 08:00–21:30 because that is the
-- column default, not because a parent chose it, and reading it would have silenced a maths
-- session finished at 21:45 for twelve families. The gate reads `quiet_hours` instead — a key
-- no row has yet — so this migration and the deploy do not have to be ordered against each
-- other. quiet_hours states the window the parent actually says: don't write between these.
--
-- gem_values goes rather than gets implemented: it says 20 for maths in every row while the
-- server pays task_settings.math.gems, which says 30. A second copy of a number that has
-- already drifted from the real one is not a preference, it is a bug with a settings screen.

update parents
set prefs = (coalesce(prefs, '{}'::jsonb) - 'gem_values' - 'allowed_hours') || jsonb_build_object(
      -- 'quiet' = safety only, 'required' = + approvals, 'all' = + finished activities.
      -- Existing families keep hearing everything, which is what they have today.
      'notify_level', coalesce(prefs->>'notify_level', 'all'),
      -- null = never quiet. The parent turns it on from the dashboard or by message.
      'quiet_hours', 'null'::jsonb,
      -- Honoured by the approval gate; true everywhere is today's behaviour. Reward claims and
      -- goal requests are deliberately absent — those spend real-world things and are not
      -- switchable.
      'approval_required', jsonb_build_object('contribution', true, 'submission', true, 'drawing', true)
    );

alter table parents alter column prefs set default jsonb_build_object(
  'language', 'tr',
  'tone', null,
  'bot_name', null,
  'notify_level', 'all',
  'notify_per_task', true,
  'quiet_hours', null,
  'approval_required', jsonb_build_object('contribution', true, 'submission', true, 'drawing', true),
  'daily_proactive_limit', 20,
  'daily_reply_limit', 60
);

-- Check: notify_level=all everywhere, quiet_hours null, neither dead key left behind.
-- select id, prefs->>'notify_level', prefs->'quiet_hours',
--        prefs ? 'gem_values' as has_gem_values, prefs ? 'allowed_hours' as has_allowed_hours
-- from parents;
