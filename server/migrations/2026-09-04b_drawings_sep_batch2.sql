-- My Drawings: the second September drop — 5 more guided sets, all easy but one.
--
-- Same pipeline as 2026-09-04_drawings_sep_batch.sql: panels prepared with
-- server/scripts/prepare_drawing_set.py, uploaded with upload_drawings.mjs
-- --all-ages, words in src/lib/drawingSteps.js.
--
-- Two things this drop fixes as a side effect:
--
--   * Butterfly, Alien, Rocket and Sun were the four names DrawingsScreen has
--     been showing as locked "Soon" tiles since the module shipped. They are
--     real now, and the LOCKED list in that file is empty.
--   * The first batch added no Easy sets and the ★☆☆ shelf held only
--     cat/dog/axolotl/fish/dolphin/panda. Four of these five are Easy.

insert into drawings (id, age_group, name_tr, name_en, category, step_count, difficulty, sort_order) values
  ('butterfly', '6-8',   'Kelebek', 'Butterfly', 'Animals',    6, 'Easy',   35),
  ('alien',     '6-8',   'Uzaylı',  'Alien',     'Characters', 6, 'Easy',   36),
  ('rocket',    '6-8',   'Roket',   'Rocket',    'Objects',    5, 'Easy',   37),
  ('sun',       '6-8',   'Güneş',   'Sun',       'Nature',     8, 'Easy',   38),
  ('koala',     '6-8',   'Koala',   'Koala',     'Animals',    6, 'Medium', 39),

  ('butterfly', '9-11',  'Kelebek', 'Butterfly', 'Animals',    6, 'Easy',   35),
  ('alien',     '9-11',  'Uzaylı',  'Alien',     'Characters', 6, 'Easy',   36),
  ('rocket',    '9-11',  'Roket',   'Rocket',    'Objects',    5, 'Easy',   37),
  ('sun',       '9-11',  'Güneş',   'Sun',       'Nature',     8, 'Easy',   38),
  ('koala',     '9-11',  'Koala',   'Koala',     'Animals',    6, 'Medium', 39),

  ('butterfly', '12-15', 'Kelebek', 'Butterfly', 'Animals',    6, 'Easy',   35),
  ('alien',     '12-15', 'Uzaylı',  'Alien',     'Characters', 6, 'Easy',   36),
  ('rocket',    '12-15', 'Roket',   'Rocket',    'Objects',    5, 'Easy',   37),
  ('sun',       '12-15', 'Güneş',   'Sun',       'Nature',     8, 'Easy',   38),
  ('koala',     '12-15', 'Koala',   'Koala',     'Animals',    6, 'Medium', 39)
on conflict (id, age_group) do update
  set name_tr    = excluded.name_tr,
      name_en    = excluded.name_en,
      category   = excluded.category,
      step_count = excluded.step_count,
      difficulty = excluded.difficulty,
      sort_order = excluded.sort_order;

-- ── Checks ───────────────────────────────────────────────────────────────────
-- The ★☆☆ shelf should now be ten sets deep, not six.
select difficulty, count(*) as sets, string_agg(id, ', ' order by sort_order) as ids
from drawings where age_group = '6-8' group by difficulty order by difficulty;

-- Every row must have a Turkish name: the child's card and title now read it.
select id from drawings where name_tr is null or name_tr = '' order by id;

-- ── Rollback ─────────────────────────────────────────────────────────────────
--   update drawings set active = false where sort_order between 35 and 39;
--   delete from drawings where id in ('butterfly','alien','rocket','sun','koala');
