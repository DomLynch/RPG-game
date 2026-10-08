begin;
-- ROLLBACK: supabase/down/202610080005_origins_open_to_all_down.sql (restores 202610060001's origins_allowed body and removes the config key).
-- Dom's ruling 2026-10-08 08:2x (via Strategy and Lead): Origins opens to EVERY signed-in account, not an allowlist. CLASS 2: it REPLACES the live
-- origins_allowed (202610060001), the one gate every origins_* function checks. Inert as applied: the new key starts false, so who is allowed is unchanged
-- until a separate, GO'd data step sets it (and origins_enabled) to true.
-- origins_allowed(p) = origins_enabled AND ( p is in origins_access  OR  ( origins_open_to_all AND p is a real, non-anonymous auth.users account ) ).
-- A Supabase anonymous sign-in (auth.users.is_anonymous) is NOT admitted by open-to-all; a guest with no session never reaches the writer at all (401).
-- CREATE OR REPLACE keeps the function's owner, grants and revokes exactly as 202610060001 set them; the body changes (now plpgsql, so the steps run in order).
insert into public.origins_config (key, value) values ('origins_open_to_all', 'false'::jsonb);
create or replace function public.origins_allowed(p_account uuid) returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce((select value = 'true'::jsonb from public.origins_config where key = 'origins_enabled'), false) then return false; end if;
  if exists (select 1 from public.origins_access where account = p_account) then return true; end if;
  if not coalesce((select value = 'true'::jsonb from public.origins_config where key = 'origins_open_to_all'), false) then return false; end if;
  -- Read only when open-to-all is on (plpgsql, in this order), so test clusters whose stub auth.users has no is_anonymous column never touch it.
  return exists (select 1 from auth.users u where u.id = p_account and not coalesce(u.is_anonymous, false));
end $$;
commit;
