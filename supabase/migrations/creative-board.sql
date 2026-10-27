-- Run once for an existing Space Note database.
-- This migration fixes: column sections.is_creative does not exist.
alter table public.sections add column if not exists is_creative boolean not null default false;
alter table public.notes add column if not exists is_creative boolean not null default false;
alter table public.media add column if not exists is_creative boolean not null default false;

update public.sections set is_creative = false where is_creative is null;
update public.notes set is_creative = false where is_creative is null;
update public.media set is_creative = false where is_creative is null;

-- Allow personal, family, and creative storage roots.
drop policy if exists "Users manage personal and family recordings" on storage.objects;
drop policy if exists "Users manage personal family and creative recordings" on storage.objects;
create policy "Users manage personal family and creative recordings" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'note-media'
    and ((storage.foldername(name))[1] = (select auth.uid()::text)
      or (storage.foldername(name))[1] in ('family', 'creative'))
  )
  with check (
    bucket_id = 'note-media'
    and ((storage.foldername(name))[1] = (select auth.uid()::text)
      or (storage.foldername(name))[1] in ('family', 'creative'))
  );
