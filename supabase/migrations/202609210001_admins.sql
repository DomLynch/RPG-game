begin;
-- Admin roster (owner 2026-09-21): the journal's test tools (finisher override, damage numbers, tempo, combat debug) show only to
-- accounts listed here. The owner inserts rows in SQL; a signed-in client can read its own row and nothing else. No write path.
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
grant select (user_id) on public.admins to authenticated;
create policy self_read on public.admins for select to authenticated using ((select auth.uid()) = user_id);
comment on table public.admins is 'Accounts allowed the journal test tools. Owner-managed in SQL; the client reads only its own membership.';
commit;
