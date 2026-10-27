-- Run once for an existing Space Note database.
alter table public.notes
  add column if not exists position bigint not null default 0;