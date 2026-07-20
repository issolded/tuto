-- Optional photo on contribution cards.
--
-- The child taps a card ("I made my bed") and the entry is logged in one tap;
-- if the card allows it, the new pending row then offers "📷 Add a photo".
-- Some contributions can't meaningfully be photographed (tooth brushing), so
-- this is per-card rather than per-category — "I made my bed" and
-- "diş fırçalama" are both self_care.
--
-- Default is TRUE: a new card offers the photo unless it's turned off.

alter table contribution_cards
  add column if not exists photo_ok boolean not null default true;

-- Turn it off for the cards where a photo makes no sense. Adjust the list to
-- taste; matching is case-insensitive and substring-based on the label.
update contribution_cards
set photo_ok = false
where label ilike '%diş fırçala%'
   or label ilike '%dis fircala%'
   or label ilike '%brush%teeth%'
   or label ilike '%teeth%brush%';

-- Check the result.
select label, category, photo_ok
from contribution_cards
order by photo_ok desc, category, label;
