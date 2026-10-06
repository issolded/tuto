-- Run once in Supabase SQL Editor before deploying the story writer.
begin;
alter table public.stories
  add column if not exists writing_source text not null default 'upload',
  add column if not exists draft_assessment jsonb,
  add column if not exists revision integer not null default 0,
  add column if not exists updated_at timestamptz;
update public.stories set updated_at = coalesce(created_at, now()) where updated_at is null;
alter table public.stories alter column updated_at set default now(),
  alter column updated_at set not null;
create or replace function public.bump_story_revision()
returns trigger language plpgsql set search_path = public as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists stories_revision on public.stories;
create trigger stories_revision before update on public.stories
for each row execute function public.bump_story_revision();
commit;
