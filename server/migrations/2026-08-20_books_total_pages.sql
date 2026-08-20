-- Give a book a length, and make current_page mean what its name says.
--
-- The library already draws a progress bar, but it is fiction: it computes current_page / 10,
-- and current_page is not a page — the reading endpoint increments it by one per finished
-- session, so it counts sessions. A child who read forty pages in two sittings is shown 20%.
--
-- total_pages is the number printed on the last page of the book, asked once when the book is
-- added and skippable, so it is nullable on purpose: no total means the library shows "page 42"
-- instead of a percentage rather than inventing one.
--
-- The update below is the part to read twice. Existing current_page values are session counts
-- under the old meaning; carrying them over would tell a child they are on page 3 of a book they
-- have barely opened. They are cleared so the next session writes a real page number. The only
-- thing lost is a count that was never shown as a count.

alter table public.books
  add column if not exists total_pages integer;

alter table public.books
  drop constraint if exists books_total_pages_check;

alter table public.books
  add constraint books_total_pages_check
  check (total_pages is null or (total_pages > 0 and total_pages <= 10000));

update public.books set current_page = 0 where coalesce(current_page, 0) > 0;
