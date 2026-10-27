-- Run once for an existing Space Note database.
alter table public.sections
  add column if not exists parent_id uuid references public.sections(id) on delete cascade;

create index if not exists sections_parent_id_idx
  on public.sections(parent_id);