-- note-space initial schema
-- Run this once in the Supabase SQL Editor after removing old note-space tables.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_-]{3,30}$')
);

create unique index profiles_username_lowercase_key
  on public.profiles (lower(username));

create table public.sections (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.sections(id) on delete cascade,
  name text not null,
  icon text not null,
  position bigint not null,
  is_family boolean not null default false,
  is_creative boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  title text not null default '',
  text text not null default '',
  position bigint not null default 0,
  is_family boolean not null default false,
  is_creative boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  kind text not null check (kind in ('audio', 'video', 'image')),
  mime_type text not null,
  storage_path text not null unique,
  is_family boolean not null default false,
  is_creative boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.sections enable row level security;
alter table public.notes enable row level security;
alter table public.media enable row level security;

create policy "Users read their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "Users update their own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

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

create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, lower(new.raw_user_meta_data ->> 'username'));
  return new;
end;
$$;

create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

insert into storage.buckets (id, name, public)
values ('note-media', 'note-media', false)
on conflict (id) do nothing;

drop policy if exists "Users manage their recordings" on storage.objects;

create policy "Users manage personal family and creative recordings" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'note-media'
    and ((storage.foldername(name))[1] = (select auth.uid()::text) or (storage.foldername(name))[1] in ('family', 'creative'))
  )
  with check (
    bucket_id = 'note-media'
    and ((storage.foldername(name))[1] = (select auth.uid()::text) or (storage.foldername(name))[1] in ('family', 'creative'))
  );
