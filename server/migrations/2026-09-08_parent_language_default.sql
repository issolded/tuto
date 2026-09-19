-- The language Tuto writes to a parent in now defaults to English, not Turkish.
--
-- Turkish was the default because the first family was Turkish. That stops being a reason the
-- moment anyone else signs up. Signup and onboarding both write the language the parent picked
-- on the first screen into prefs.language, so this default only decides a row created some other
-- way (a hand insert, a sign-up that fails before its update lands).
--
-- Two statements, in this order.
--
-- 1. Backfill. Any row without the key reads as Turkish today through the code's fallback, and
--    would silently become English when the fallback flips. Write what it is already getting.
--    (Checked 2026-09-19: every parent row already has 'language' = 'tr', so this moves nobody.)
update parents
set prefs = coalesce(prefs, '{}'::jsonb) || jsonb_build_object('language', 'tr')
where prefs is null or not (prefs ? 'language');

-- 2. Flip ONLY the language key inside the live column default. The first draft of this file
--    rewrote the whole default from a copy written on 2026-09-08; anything added to the default
--    since (or tuned in the dashboard) would have been silently replaced. This reads the default
--    that is actually there and changes one key of it.
do $$
declare
  cur text;
begin
  select pg_get_expr(d.adbin, d.adrelid) into cur
  from pg_attrdef d
  join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
  where d.adrelid = 'public.parents'::regclass and a.attname = 'prefs';

  if cur is null then
    raise notice 'parents.prefs has no default; leaving it alone';
  else
    execute format(
      'alter table public.parents alter column prefs set default ((%s) || jsonb_build_object(''language'', ''en''))',
      cur);
  end if;
end $$;

-- Check: the default should now end in ... || jsonb_build_object('language', 'en')
-- select pg_get_expr(d.adbin, d.adrelid) from pg_attrdef d join pg_attribute a
--   on a.attrelid = d.adrelid and a.attnum = d.adnum
--   where d.adrelid = 'public.parents'::regclass and a.attname = 'prefs';
