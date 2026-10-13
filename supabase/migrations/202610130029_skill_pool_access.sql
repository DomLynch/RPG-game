begin;
-- ROLLBACK: supabase/down/202610130029_skill_pool_access_down.sql (drops exactly the two functions this file creates).
-- CLASS 1, ADDITIVE and Origins-only: two definer functions over the practice pool of 0026. origins_skill_xp has RLS on and no policy, and the writer roles (frankendom_origins, frankendom_verifier)
-- do not bypass RLS, so a plain select by the writer sees no rows: the pool is readable only through a definer function (as origins_grimoire is through origins_grimoire_get).
--   origins_skill_pool(account, character)            -> { "<skill>": { xp, focus } } for a character the account owns; null when it is not the account's.
--   origins_skill_focus(account, character, skill, on) -> the new { xp, focus } for that skill; null when not the account's; the row is created empty if the skill has none yet.
-- No table, column or data change; no existing function changes.
create function public.origins_skill_pool(p_account uuid, p_character text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.origins_allowed(p_account) or not public.origins_owns(p_character, p_account) then return null; end if;
  return coalesce((select jsonb_object_agg(skill, jsonb_build_object('xp', xp, 'focus', focus)) from public.origins_skill_xp where character = p_character), '{}'::jsonb);
end $$;

create function public.origins_skill_focus(p_account uuid, p_character text, p_skill text, p_on boolean) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.origins_skill_xp;
begin
  if not public.origins_allowed(p_account) or not public.origins_owns(p_character, p_account) then return null; end if;
  if p_skill is null or p_skill !~ '^[a-z][a-z0-9_]{0,31}$' then raise exception 'skill: a skill id' using errcode = 'O0002'; end if;
  insert into public.origins_skill_xp (character, skill, xp, focus) values (p_character, p_skill, 0, p_on)
    on conflict (character, skill) do update set focus = excluded.focus, updated_at = now() returning * into r;
  return jsonb_build_object('xp', r.xp, 'focus', r.focus);
end $$;

revoke all on function public.origins_skill_pool(uuid, text), public.origins_skill_focus(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.origins_skill_pool(uuid, text), public.origins_skill_focus(uuid, text, text, boolean) to frankendom_origins, frankendom_verifier;
commit;
