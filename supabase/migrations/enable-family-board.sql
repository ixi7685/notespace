-- Run once for an existing Space Note database.
-- Every authenticated account in this Supabase project shares the board.

drop policy if exists "Users manage their sections" on public.sections;
drop policy if exists "Users manage their notes" on public.notes;
drop policy if exists "Users manage their media" on public.media;
drop policy if exists "Family members manage shared sections" on public.sections;
drop policy if exists "Family members manage shared notes" on public.notes;
drop policy if exists "Family members manage shared media" on public.media;

create policy "Family members manage shared sections" on public.sections
  for all to authenticated using (true) with check (true);

create policy "Family members manage shared notes" on public.notes
  for all to authenticated using (true) with check (true);

create policy "Family members manage shared media" on public.media
  for all to authenticated using (true) with check (true);

drop policy if exists "Users manage their recordings" on storage.objects;
drop policy if exists "Family members manage shared recordings" on storage.objects;

create policy "Family members manage shared recordings" on storage.objects
  for all to authenticated
  using (bucket_id = 'note-media')
  with check (bucket_id = 'note-media');
