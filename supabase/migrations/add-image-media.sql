-- Run once in Supabase SQL Editor for an existing Space Note database.
alter table public.media drop constraint if exists media_kind_check;
alter table public.media
  add constraint media_kind_check
  check (kind in ('audio', 'video', 'image'));
