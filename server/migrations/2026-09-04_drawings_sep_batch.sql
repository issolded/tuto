-- My Drawings: the September 2026 batch — 11 new guided sets.
--
-- Panels: cizims_sep2026/drawings/<turkish folder> → drawings/<id>/step-NN.webp
-- via server/scripts/prepare_drawing_set.py (which records, per set, exactly
-- which raw panels were kept and why the others were dropped), then uploaded to
-- the public `drawings` bucket with upload_drawings.mjs --all-ages.
--
-- Age bands: the same sketches under all three, the stopgap every set since
-- 2026-07-19 has used. A real 9-11 set later updates that row and its storage
-- path only — (id, age_group) is the primary key precisely so that is possible.
--
-- `difficulty` ('Easy' | 'Medium' | 'Hard') is not in 2026-07-19_drawings_module.sql:
-- it was added to the live table out of band, and DrawingsScreen filters on it
-- (shown as ★☆☆ / ★★☆ / ★★★, never as the word). Every row below sets it.
--
-- Note for whoever stocks the shelf next: this batch adds no Easy sets. The
-- Easy filter still shows only cat, dog, axolotl, fish, dolphin and panda.

insert into drawings (id, age_group, name_tr, name_en, category, step_count, difficulty, sort_order) values
  ('car',             '6-8',   'Araba',            'Car',             'Objects',    5, 'Medium', 24),
  ('airplane',        '6-8',   'Uçak',             'Airplane',        'Objects',    6, 'Medium', 25),
  ('ship',            '6-8',   'Yelkenli',         'Sailing Ship',    'Objects',    6, 'Medium', 26),
  ('globe',           '6-8',   'Dünya',            'Earth',           'Nature',     4, 'Medium', 27),
  ('adventure-map',   '6-8',   'Macera Haritası',  'Adventure Map',   'Nature',     4, 'Medium', 28),
  ('bike-hero',       '6-8',   'Bisikletli Kahraman', 'Bike Hero',    'Characters', 5, 'Medium', 29),
  ('desk-boy',        '6-8',   'Masadaki Çocuk',   'Boy at the Desk', 'Characters', 5, 'Medium', 30),
  ('girl-reading',    '6-8',   'Kitap Okuyan Kız', 'Girl Reading',    'Characters', 6, 'Hard',   31),
  ('forest-explorer', '6-8',   'Ormandaki Kâşif',  'Forest Explorer', 'Characters', 7, 'Hard',   32),
  ('big-ben',         '6-8',   'Big Ben',          'Big Ben',         'Objects',    7, 'Hard',   33),
  ('galata-tower',    '6-8',   'Galata Kulesi',    'Galata Tower',    'Objects',    7, 'Hard',   34),

  ('car',             '9-11',  'Araba',            'Car',             'Objects',    5, 'Medium', 24),
  ('airplane',        '9-11',  'Uçak',             'Airplane',        'Objects',    6, 'Medium', 25),
  ('ship',            '9-11',  'Yelkenli',         'Sailing Ship',    'Objects',    6, 'Medium', 26),
  ('globe',           '9-11',  'Dünya',            'Earth',           'Nature',     4, 'Medium', 27),
  ('adventure-map',   '9-11',  'Macera Haritası',  'Adventure Map',   'Nature',     4, 'Medium', 28),
  ('bike-hero',       '9-11',  'Bisikletli Kahraman', 'Bike Hero',    'Characters', 5, 'Medium', 29),
  ('desk-boy',        '9-11',  'Masadaki Çocuk',   'Boy at the Desk', 'Characters', 5, 'Medium', 30),
  ('girl-reading',    '9-11',  'Kitap Okuyan Kız', 'Girl Reading',    'Characters', 6, 'Hard',   31),
  ('forest-explorer', '9-11',  'Ormandaki Kâşif',  'Forest Explorer', 'Characters', 7, 'Hard',   32),
  ('big-ben',         '9-11',  'Big Ben',          'Big Ben',         'Objects',    7, 'Hard',   33),
  ('galata-tower',    '9-11',  'Galata Kulesi',    'Galata Tower',    'Objects',    7, 'Hard',   34),

  ('car',             '12-15', 'Araba',            'Car',             'Objects',    5, 'Medium', 24),
  ('airplane',        '12-15', 'Uçak',             'Airplane',        'Objects',    6, 'Medium', 25),
  ('ship',            '12-15', 'Yelkenli',         'Sailing Ship',    'Objects',    6, 'Medium', 26),
  ('globe',           '12-15', 'Dünya',            'Earth',           'Nature',     4, 'Medium', 27),
  ('adventure-map',   '12-15', 'Macera Haritası',  'Adventure Map',   'Nature',     4, 'Medium', 28),
  ('bike-hero',       '12-15', 'Bisikletli Kahraman', 'Bike Hero',    'Characters', 5, 'Medium', 29),
  ('desk-boy',        '12-15', 'Masadaki Çocuk',   'Boy at the Desk', 'Characters', 5, 'Medium', 30),
  ('girl-reading',    '12-15', 'Kitap Okuyan Kız', 'Girl Reading',    'Characters', 6, 'Hard',   31),
  ('forest-explorer', '12-15', 'Ormandaki Kâşif',  'Forest Explorer', 'Characters', 7, 'Hard',   32),
  ('big-ben',         '12-15', 'Big Ben',          'Big Ben',         'Objects',    7, 'Hard',   33),
  ('galata-tower',    '12-15', 'Galata Kulesi',    'Galata Tower',    'Objects',    7, 'Hard',   34)
on conflict (id, age_group) do update
  set name_tr    = excluded.name_tr,
      name_en    = excluded.name_en,
      category   = excluded.category,
      step_count = excluded.step_count,
      difficulty = excluded.difficulty,
      sort_order = excluded.sort_order;

-- ── Checks ───────────────────────────────────────────────────────────────────
select category, difficulty, count(*) filter (where age_group = '6-8') as sets
from drawings group by category, difficulty order by category, difficulty;

select id, step_count, difficulty from drawings
where age_group = '6-8' and sort_order >= 24 order by sort_order;

-- ── Rollback, if a name or a rating turns out wrong ──────────────────────────
-- To hide the batch without deleting it:
--   update drawings set active = false where sort_order >= 24;
-- To remove it entirely (storage files are untouched by this):
--   delete from drawings where id in ('car','airplane','ship','globe',
--     'adventure-map','bike-hero','desk-boy','girl-reading','forest-explorer',
--     'big-ben','galata-tower');
