-- Run once for an existing Space Note database.
-- Personal data stays private; rows marked is_family are shared with authenticated family accounts.

alter table public.sections add column if not exists is_family boolean not null default false;
alter table public.notes add column if not exists is_family boolean not null default false;
alter table public.media add column if not exists is_family boolean not null default false;

drop policy if exists "Users manage their sections" on public.sections;
drop policy if exists "Users manage their notes" on public.notes;
drop policy if exists "Users manage their media" on public.media;
drop policy if exists "Family members manage shared sections" on public.sections;
drop policy if exists "Family members manage shared notes" on public.notes;
drop policy if exists "Family members manage shared media" on public.media;
drop policy if exists "Users manage personal and family sections" on public.sections;
drop policy if exists "Users manage personal and family notes" on public.notes;
drop policy if exists "Users manage personal and family media" on public.media;

create policy "Users manage personal and family sections" on public.sections
  for all to authenticated
  using (is_family or (select auth.uid()) = user_id)
  with check (is_family or (select auth.uid()) = user_id);

create policy "Users manage personal and family notes" on public.notes
  for all to authenticated
  using (is_family or (select auth.uid()) = user_id)
  with check (is_family or (select auth.uid()) = user_id);

create policy "Users manage personal and family media" on public.media
  for all to authenticated
  using (is_family or (select auth.uid()) = user_id)
  with check (is_family or (select auth.uid()) = user_id);

drop policy if exists "Users manage their recordings" on storage.objects;
drop policy if exists "Family members manage shared recordings" on storage.objects;
drop policy if exists "Users manage personal and family recordings" on storage.objects;

create policy "Users manage personal and family recordings" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'note-media'
    and ((storage.foldername(name))[1] = (select auth.uid()::text) or (storage.foldername(name))[1] = 'family')
  )
  with check (
    bucket_id = 'note-media'
    and ((storage.foldername(name))[1] = (select auth.uid()::text) or (storage.foldername(name))[1] = 'family')
  );