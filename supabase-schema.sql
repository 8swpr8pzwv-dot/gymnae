-- Run ONCE in Supabase SQL Editor as the project owner.
-- Public profiles contain no email addresses.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24)
);
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  kind text not null check (kind in ('group','dm')),
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  constraint correct_recipient check (
    (kind='group' and recipient_id is null) or
    (kind='dm' and recipient_id is not null and recipient_id <> sender_id)
  )
);
create index if not exists messages_recent on public.messages(created_at desc);
create index if not exists messages_sender on public.messages(sender_id,created_at desc);
create index if not exists messages_recipient on public.messages(recipient_id,created_at desc);
create table if not exists public.scores (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null check (game in ('tetris','2048')),
  score integer not null check (score between 0 and 10000000),
  created_at timestamptz not null default now()
);
create index if not exists scores_game on public.scores(game,score desc);

alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.scores enable row level security;

-- Drop policies when rerunning setup SQL; never turn RLS off.
drop policy if exists "profiles_read" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "messages_read_participants" on public.messages;
drop policy if exists "messages_insert_sender" on public.messages;
drop policy if exists "scores_read" on public.scores;
drop policy if exists "scores_insert_self" on public.scores;

create policy "profiles_read" on public.profiles for select to authenticated using (true);
create policy "profiles_insert_self" on public.profiles for insert to authenticated with check (id=(select auth.uid()));
create policy "profiles_update_self" on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));

create policy "messages_read_participants" on public.messages for select to authenticated
 using (kind='group' or sender_id=(select auth.uid()) or recipient_id=(select auth.uid()));
create policy "messages_insert_sender" on public.messages for insert to authenticated
 with check (sender_id=(select auth.uid()) and (kind='group' or recipient_id in (select id from public.profiles)));

create policy "scores_read" on public.scores for select to authenticated using (true);
create policy "scores_insert_self" on public.scores for insert to authenticated with check (user_id=(select auth.uid()));

-- A public API key only has the rights granted here and by RLS.
grant usage on schema public to authenticated;
grant select,insert,update on public.profiles to authenticated;
grant select,insert on public.messages to authenticated;
grant select,insert on public.scores to authenticated;
grant usage,select on all sequences in schema public to authenticated;

-- Enable change notifications for the two tables (if not already enabled).
do $$ begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
   alter publication supabase_realtime add table public.messages;
 end if;
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='scores') then
   alter publication supabase_realtime add table public.scores;
 end if;
end $$;
