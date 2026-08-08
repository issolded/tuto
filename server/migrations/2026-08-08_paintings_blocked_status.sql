-- Let a painting row record an image the safety screen refused.
--
-- paintings.status has a CHECK that predates this and allows only the approval states. A
-- refused image is not awaiting approval — there is nothing to approve — but it is held for a
-- week so a parent who was told about it can ask to see it, and it needs a status that says
-- so. Without this the insert fails with 23514, the hold silently does not happen, and the
-- parent is told the image is gone.
--
-- Written to find the existing constraint by name rather than assuming one, so it works
-- whether the column was created with an inline CHECK or a named one.

do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where rel.relname = 'paintings'
      and ns.nspname = 'public'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.paintings drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.paintings
  add constraint paintings_status_check
  check (status in ('pending', 'approved', 'rejected', 'blocked'));

-- Held images are read by child and status when a parent asks, and swept by age.
create index if not exists paintings_blocked_lookup
  on public.paintings (child_id, status, created_at desc);
