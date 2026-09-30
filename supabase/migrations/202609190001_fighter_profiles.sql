begin;
create table public.fighter_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24 and display_name = btrim(display_name) and display_name !~ '[[:cntrl:]]'),
  encounter text check (encounter in ('veteran', 'pitborn', 'goblin', 'nightborn', 'executioner')),
  revision bigint not null default 1 check (revision > 0)
);
alter table public.fighter_profiles enable row level security;
revoke all on public.fighter_profiles from anon, authenticated;
grant select on public.fighter_profiles to authenticated;
grant insert (user_id, display_name, encounter) on public.fighter_profiles to authenticated;
grant update (display_name, encounter) on public.fighter_profiles to authenticated;
create policy owner_read on public.fighter_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy owner_insert on public.fighter_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy owner_update on public.fighter_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create function public.bump_fighter_revision() returns trigger language plpgsql set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  return new;
end;
$$;
revoke all on function public.bump_fighter_revision() from public;
create trigger fighter_revision before update on public.fighter_profiles for each row execute function public.bump_fighter_revision();
comment on table public.fighter_profiles is 'Account-owned practice settings only. No client-reported rank, marks, results or unlock authority.';
commit;
