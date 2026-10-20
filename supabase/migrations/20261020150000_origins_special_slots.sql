begin;
-- ROLLBACK: supabase/down/20261020150000_origins_special_slots_down.sql (drops exactly what this file creates).
-- CLASS 1, ADDITIVE and Origins-only: one table, two definer functions. The signed-in side of the two SPECIAL slots (SPECIAL 1 / SPECIAL 2, career-rules.json betaCut specialSlots 2): which of the beta's `specialPick` skills a character
-- carries into a fight. Until now the page kept the pick per device in localStorage; this keeps it per character so it follows the player to another device.
-- Donor: AzerothCore character_action (guid, button, action): one stored id per button, no logic in the table; what a button may hold is the game's rule. Same split here: the table stores the skill id, the WRITER judges the pick
-- (origins/server/special-slots.ts: the id must be in the betaCut pick list, the same list the record and claim judging use), and this file only keeps the id's shape sane.
-- Two nullable columns, not two rows: a swap (a skill already in the other slot MOVES) is one atomic write, and null means "not picked yet", so the client reads the row defaults (slot2Default) as the fallback.
-- NOT part of the append-only build: the build is versioned because a fight record names a build version; a slot pick is a preference the server judges per record (specialsRefusal), so it has no history.
-- RLS on, no policy, no client grant: only the definer functions below touch it.
--   origins_special_slots_get(account, character)                 -> { slot1, slot2 } (each a skill id or null); null when the character is not the account's. No row = both null.
--   origins_special_slots_set(account, character, slot1, slot2)   -> the stored { slot1, slot2 }; null when not the account's; O0002 on a malformed id or the same skill in both slots.
create table public.origins_special_slots (
  character text primary key references public.origins_characters (id) on delete cascade,
  slot1 text check (slot1 is null or slot1 ~ '^[a-z][a-z0-9_]{0,31}$'),
  slot2 text check (slot2 is null or slot2 ~ '^[a-z][a-z0-9_]{0,31}$'),
  updated_at timestamptz not null default now(),
  check (slot1 is null or slot2 is null or slot1 <> slot2)
);
alter table public.origins_special_slots enable row level security;
revoke all on public.origins_special_slots from public, anon, authenticated;

create function public.origins_special_slots_get(p_account uuid, p_character text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r public.origins_special_slots;
begin
  if not public.origins_allowed(p_account) or not public.origins_owns(p_character, p_account) then return null; end if;
  select * into r from public.origins_special_slots where character = p_character;
  if not found then return jsonb_build_object('slot1', null, 'slot2', null); end if;
  return jsonb_build_object('slot1', r.slot1, 'slot2', r.slot2);
end $$;

create function public.origins_special_slots_set(p_account uuid, p_character text, p_slot1 text, p_slot2 text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.origins_special_slots;
begin
  if not public.origins_allowed(p_account) or not public.origins_owns(p_character, p_account) then return null; end if;
  if (p_slot1 is not null and p_slot1 !~ '^[a-z][a-z0-9_]{0,31}$') or (p_slot2 is not null and p_slot2 !~ '^[a-z][a-z0-9_]{0,31}$') then raise exception 'special slot: a skill id' using errcode = 'O0002'; end if;
  if p_slot1 is not null and p_slot1 = p_slot2 then raise exception 'special slot: two different skills' using errcode = 'O0002'; end if;
  insert into public.origins_special_slots (character, slot1, slot2) values (p_character, p_slot1, p_slot2)
    on conflict (character) do update set slot1 = excluded.slot1, slot2 = excluded.slot2, updated_at = now() returning * into r;
  return jsonb_build_object('slot1', r.slot1, 'slot2', r.slot2);
end $$;

revoke all on function public.origins_special_slots_get(uuid, text), public.origins_special_slots_set(uuid, text, text, text) from public, anon, authenticated;
-- Both writer roles (the writer service connects as frankendom_verifier in production, frankendom_origins in the harness: reference_writer_db_role).
grant execute on function public.origins_special_slots_get(uuid, text), public.origins_special_slots_set(uuid, text, text, text) to frankendom_origins, frankendom_verifier;
commit;
