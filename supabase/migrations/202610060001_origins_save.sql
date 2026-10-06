begin;
-- ROLLBACK: supabase/down/202610060001_origins_save_down.sql (drops exactly what this file creates).
-- Origins server save and verify (docs/specs/origins/server-save-schema.md, PR #1449; Strategy rulings 2026-10-06).
-- ADDITIVE and Origins-only: new tables, functions, one role. No existing table is altered, dropped or backfilled; two existing tables
-- (fighter_profiles, loot_claims/awards) are only READ by security-definer functions. Feature flag OFF: nothing works until an
-- origins_access row exists AND origins_config.origins_enabled is true.
-- Who writes: nobody but the frankendom_origins role, through the functions below (one server-side writer runs the pure TS modules and
-- commits their results). A client reads its own rows through RLS and can write nothing. The role's password is set out of band.
-- What the database refuses by itself, whatever the writer sends: two items in one place, a minted key twice, a stack whose live quantity
-- differs from its mint/burn ledger, a second copy of a single-copy item on one account, a slot past the character's grid, a stale write,
-- an edited provenance or history, a lost journal line, a reward event paid twice.

create role frankendom_origins login;

create table public.origins_config (key text primary key, value jsonb not null);
insert into public.origins_config (key, value) values ('origins_enabled', 'false'::jsonb);
create table public.origins_access (account uuid primary key references auth.users (id) on delete cascade, granted_at timestamptz not null default now());

create function public.origins_allowed(p_account uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select value = 'true'::jsonb from public.origins_config where key = 'origins_enabled'), false)
     and exists (select 1 from public.origins_access where account = p_account)
$$;

create table public.origins_characters (
  id text primary key check (id ~ '^pc:[A-Za-z0-9_-]{1,64}$'),
  account uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 32),
  schema_version int not null default 1,
  pack_slots int not null default 64 check (pack_slots between 1 and 64),
  bank_slots int not null default 1000 check (bank_slots between 0 and 1000),
  created_at timestamptz not null default now(),
  unique (account, name)
);
create index origins_characters_account on public.origins_characters (account);

create function public.origins_owns(p_character text, p_account uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.origins_characters where id = p_character and account = p_account)
$$;

-- The two helpers the RLS policies call as the READER (a policy's functions run with the reader's own privileges): they take no account argument and
-- answer only about the caller (auth.uid()), so they cannot be used to probe another account. The writer-side forms above stay writer-only.
create function public.origins_me_allowed() returns boolean language sql stable security definer set search_path = '' as $$
  select public.origins_allowed((select auth.uid()))
$$;
create function public.origins_me_owns(p_character text) returns boolean language sql stable security definer set search_path = '' as $$
  select public.origins_owns(p_character, (select auth.uid()))
$$;

-- One career per account (world.ts). Total CP is DERIVED, never stored: seed_credit (the frozen snapshot of creditFromMarks(marks) taken once at the first
-- open, never recomputed) + the CP of every verified Pit win AFTER the snapshot (priced by the #1428 weights, the cp in each 'pit' event) + world_credit.
-- world_credit is the only credit this row accumulates; origins_total_credit() is the one place the sum is made.
create table public.origins_career (
  account uuid primary key references auth.users (id) on delete cascade,
  seed_credit bigint not null check (seed_credit >= 0),
  world_credit bigint not null default 0 check (world_credit >= 0),
  rested bigint not null default 0 check (rested >= 0),
  rested_at bigint not null default 0,
  heat jsonb not null default '{}'::jsonb,
  beaten text[] not null default '{}',
  story text[] not null default '{}',
  version int not null default 1
);

-- The idempotency ledger. Ids are derived server-side (boss:<pc>:<boss>, quest:<pc>:<quest>:<stage>, story:<pc>:<step>, pit:<claim>,
-- career-snapshot:<account>); a retried event hits the primary key and the whole batch aborts with O0001 (the writer reads that as "already paid").
create table public.origins_events (
  event_id text primary key check (char_length(event_id) between 3 and 200),
  kind text not null check (kind in ('career-snapshot', 'pit', 'boss', 'mob', 'quest-stage', 'story-step', 'talk', 'mint')),
  account uuid not null references auth.users (id) on delete cascade,
  character text references public.origins_characters (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index origins_events_account on public.origins_events (account, at desc);

-- Solo world fights use the Pit pattern: the server issues the encounter (seed, enemy, level, expiry), the client returns replay + hash, the
-- writer re-simulates before any CP or loot. No token, no award. Single use.
create table public.origins_encounters (
  token text primary key check (token ~ '^[A-Za-z0-9_-]{16,128}$'),
  account uuid not null references auth.users (id) on delete cascade,
  character text not null references public.origins_characters (id) on delete cascade,
  seed bigint not null,
  enemy text not null check (enemy ~ '^[a-z0-9._:-]{1,64}$'),
  enemy_level int not null check (enemy_level between 1 and 200),
  expires_at timestamptz not null,
  used_at timestamptz
);

create table public.origins_items (
  id text primary key check (char_length(id) between 3 and 120),
  item text not null check (char_length(item) between 1 and 120),
  version int not null default 1 check (version >= 1),
  quantity int not null check (quantity between 1 and 9999),
  tier text,
  upgrade_level int not null default 0 check (upgrade_level between 0 and 9),
  loc_kind text check (loc_kind in ('equipped', 'pack', 'bank', 'account-vault', 'guild-vault', 'trade-escrow')),
  loc_owner text references public.origins_characters (id) on delete cascade,
  loc_account uuid references auth.users (id) on delete cascade,
  loc_container text,
  loc_index int check (loc_index between 0 and 999),
  loc_slot text,
  loc_from text references public.origins_characters (id) on delete cascade,
  bound_to text references public.origins_characters (id) on delete cascade,
  mint_key text not null unique,
  mint_root text generated always as (split_part(mint_key, '::s', 1)) stored,
  provenance jsonb not null,
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array'),
  single_copy boolean not null default false,
  holder_account uuid,
  retired_at timestamptz,
  retire_reason text check (retire_reason in ('merge', 'burn')),
  -- Exactly the fields of the kind are set; a retired row has no location at all (origins_items_retired_shape below).
  constraint origins_items_location_fields check (
    case loc_kind
      when 'equipped' then loc_owner is not null and loc_slot is not null and loc_index is null and loc_account is null and loc_container is null and loc_from is null
      when 'pack' then loc_owner is not null and loc_index is not null and loc_slot is null and loc_account is null and loc_container is null and loc_from is null
      when 'bank' then loc_owner is not null and loc_index is not null and loc_slot is null and loc_account is null and loc_container is null and loc_from is null
      when 'account-vault' then loc_account is not null and loc_index is not null and loc_owner is null and loc_slot is null and loc_container is null and loc_from is null
      when 'guild-vault' then loc_container is not null and loc_index is not null and loc_owner is null and loc_slot is null and loc_account is null and loc_from is null
      when 'trade-escrow' then loc_container is not null and loc_from is not null and loc_owner is null and loc_index is null and loc_slot is null and loc_account is null
      else loc_owner is null and loc_index is null and loc_slot is null and loc_account is null and loc_container is null and loc_from is null
    end
  )
);
alter table public.origins_items add constraint origins_items_retired_shape check ((retired_at is null) = (loc_kind is not null) and (retired_at is null) = (retire_reason is null));
create unique index origins_items_pack_place on public.origins_items (loc_owner, loc_index) where retired_at is null and loc_kind = 'pack';
create unique index origins_items_bank_place on public.origins_items (loc_owner, loc_index) where retired_at is null and loc_kind = 'bank';
create unique index origins_items_worn_place on public.origins_items (loc_owner, loc_slot) where retired_at is null and loc_kind = 'equipped';
create unique index origins_items_vault_place on public.origins_items (loc_account, loc_index) where retired_at is null and loc_kind = 'account-vault';
create unique index origins_items_guild_place on public.origins_items (loc_container, loc_index) where retired_at is null and loc_kind = 'guild-vault';
-- One of each, account-wide, wherever the copy sits (worn, pack, bank, vault, or offered in an open trade: escrow counts for the offering account).
create unique index origins_items_one_of_each on public.origins_items (holder_account, item) where single_copy and retired_at is null and holder_account is not null;
create index origins_items_root on public.origins_items (mint_root) where retired_at is null;
create index origins_items_holder on public.origins_items (holder_account) where retired_at is null;

create table public.origins_item_ledger (
  id bigint generated always as identity primary key,
  mint_root text not null,
  delta int not null check (delta <> 0),
  reason text not null check (reason in ('mint', 'burn')),
  item_id text not null,
  at timestamptz not null default now()
);
create index origins_item_ledger_root on public.origins_item_ledger (mint_root);

create table public.origins_trades (
  container text primary key check (char_length(container) between 3 and 120),
  side_a text references public.origins_characters (id) on delete set null,   -- an erased character leaves the trade open with a null side: the survivor's escrow is released by origins_cancel_trade
  side_b text references public.origins_characters (id) on delete set null,
  state text not null default 'open' check (state in ('open', 'settled', 'cancelled')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  check (side_a <> side_b)
);

create table public.origins_quest_state (
  character text not null references public.origins_characters (id) on delete cascade,
  quest text not null check (char_length(quest) between 1 and 120),
  story_version int not null check (story_version >= 1),
  stage text not null,
  status text not null check (status in ('active', 'finished', 'failed')),
  flags jsonb not null default '{}'::jsonb,
  rewarded text[] not null default '{}',
  version int not null default 1,
  primary key (character, quest)
);
create table public.origins_quest_journal (
  character text not null,
  quest text not null,
  seq int not null check (seq >= 0),
  stage text not null,
  text text not null check (char_length(text) <= 2000),
  at timestamptz not null,
  primary key (character, quest, seq),
  foreign key (character, quest) references public.origins_quest_state (character, quest) on delete cascade
);
create table public.origins_talk (
  character text primary key references public.origins_characters (id) on delete cascade,
  told text[] not null default '{}',
  flags jsonb not null default '{}'::jsonb,
  version int not null default 1
);

-- ---- triggers: the invariants the database holds by itself ---------------------------------------------------------------------

create function public.origins_no_change() returns trigger language plpgsql set search_path = '' as $$
begin raise exception '% is append-only', tg_table_name using errcode = 'O0003'; end $$;
create trigger origins_events_append_only before update or delete on public.origins_events for each row when (pg_trigger_depth() = 0 and coalesce(current_setting('origins.purge', true), '') <> 'on') execute function public.origins_no_change();
create trigger origins_item_ledger_append_only before update or delete on public.origins_item_ledger for each row when (pg_trigger_depth() = 0 and coalesce(current_setting('origins.purge', true), '') <> 'on') execute function public.origins_no_change();
create trigger origins_quest_journal_append_only before update or delete on public.origins_quest_journal for each row
  when (pg_trigger_depth() = 0) execute function public.origins_no_change();   -- depth 0: a cascade from deleting the quest state's character is the account's own erasure

create function public.origins_career_credit_up() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.world_credit < old.world_credit then raise exception 'career credit never decreases (% -> %)', old.world_credit, new.world_credit using errcode = 'O0004'; end if;
  if new.seed_credit <> old.seed_credit then raise exception 'the career seed is frozen' using errcode = 'O0004'; end if;
  if new.version <> old.version + 1 then raise exception 'stale career write (version % -> %)', old.version, new.version using errcode = 'O0002'; end if;
  return new;
end $$;
create trigger origins_career_credit_up before update on public.origins_career for each row execute function public.origins_career_credit_up();

create function public.origins_versioned() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.version <> old.version + 1 then raise exception '% stale write (version % -> %)', tg_table_name, old.version, new.version using errcode = 'O0002'; end if;
  return new;
end $$;
create trigger origins_quest_state_versioned before update on public.origins_quest_state for each row execute function public.origins_versioned();
create trigger origins_talk_versioned before update on public.origins_talk for each row execute function public.origins_versioned();

-- An item row: the holder account follows the location, the slot must exist on that character's grid, provenance and the mint key never
-- change, history only grows, a retired row never changes again, every change bumps the version by one.
create function public.origins_item_guard() returns trigger language plpgsql set search_path = '' as $$
declare acct uuid; packs int; banks int; n int;
begin
  if tg_op = 'UPDATE' then
    if old.retired_at is not null then raise exception 'item % is retired' , old.id using errcode = 'O0003'; end if;
    if new.mint_key <> old.mint_key or new.item <> old.item or new.provenance <> old.provenance or new.id <> old.id then
      raise exception 'item % provenance, mint key and kind are fixed at mint', old.id using errcode = 'O0003'; end if;
    if new.version <> old.version + 1 then raise exception 'item % stale write (version % -> %)', old.id, old.version, new.version using errcode = 'O0002'; end if;
    n := jsonb_array_length(old.history);
    if jsonb_array_length(new.history) < n or
       (select coalesce(jsonb_agg(e order by o), '[]'::jsonb) from jsonb_array_elements(new.history) with ordinality as t (e, o) where o <= n) <> old.history then
      raise exception 'item % history is append-only', old.id using errcode = 'O0003'; end if;
  end if;
  if new.retired_at is null then
    acct := case new.loc_kind
      when 'equipped' then (select account from public.origins_characters where id = new.loc_owner)
      when 'pack' then (select account from public.origins_characters where id = new.loc_owner)
      when 'bank' then (select account from public.origins_characters where id = new.loc_owner)
      when 'account-vault' then new.loc_account
      when 'trade-escrow' then (select account from public.origins_characters where id = new.loc_from)
      else null end;
    new.holder_account := acct;
    if new.loc_kind in ('pack', 'bank') then
      select pack_slots, bank_slots into packs, banks from public.origins_characters where id = new.loc_owner;
      n := case new.loc_kind when 'pack' then packs else banks end;
      if new.loc_index >= n then
        raise exception 'slot % is past this character''s %', new.loc_index, new.loc_kind using errcode = 'O0005'; end if;
    end if;
  else
    new.holder_account := null;
  end if;
  return new;
end $$;
create trigger origins_item_guard before insert or update on public.origins_items for each row execute function public.origins_item_guard();
-- Items are retired, never deleted, EXCEPT by erasure: a cascade from deleting a character or an account (trigger depth above 0), or origins_purge_account (flag).
-- The deletion books a burn for the live quantity it removes, so conservation still holds for every other holder of the same mint root.
create trigger origins_item_no_delete before delete on public.origins_items for each row when (pg_trigger_depth() = 0 and coalesce(current_setting('origins.purge', true), '') <> 'on') execute function public.origins_no_change();
create function public.origins_item_erased() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.retired_at is null then insert into public.origins_item_ledger (mint_root, delta, reason, item_id) values (old.mint_root, -old.quantity, 'burn', old.id); end if;
  return null;
end $$;
create trigger origins_item_erased after delete on public.origins_items for each row execute function public.origins_item_erased();

-- Conservation, per mint root, at COMMIT: live quantity of the root's rows = the ledger's sum for it. Deferred, so a batch may move
-- quantity between rows (split, merge) in any order and only its end state is judged.
-- security definer: a deferred trigger runs at COMMIT as the session's user (the writer role), after the definer function that wrote has returned.
create function public.origins_conserved() returns trigger language plpgsql security definer set search_path = '' as $$
declare root text; live bigint; booked bigint;
begin
  root := case when tg_table_name = 'origins_item_ledger' then new.mint_root else coalesce(new.mint_root, old.mint_root) end;
  select coalesce(sum(quantity), 0) into live from public.origins_items where mint_root = root and retired_at is null;
  select coalesce(sum(delta), 0) into booked from public.origins_item_ledger where mint_root = root;
  if live <> booked then raise exception 'conservation: % holds % live but the ledger says %', root, live, booked using errcode = 'O0006'; end if;
  return null;
end $$;
create constraint trigger origins_items_conserved after insert or update on public.origins_items deferrable initially deferred for each row execute function public.origins_conserved();
create constraint trigger origins_ledger_conserved after insert on public.origins_item_ledger deferrable initially deferred for each row execute function public.origins_conserved();

-- ---- RLS: a signed-in account reads its own rows while the flag lets it; nothing is writable by a client ---------------------------

alter table public.origins_config enable row level security;
alter table public.origins_access enable row level security;
alter table public.origins_characters enable row level security;
alter table public.origins_career enable row level security;
alter table public.origins_events enable row level security;
alter table public.origins_encounters enable row level security;
alter table public.origins_items enable row level security;
alter table public.origins_item_ledger enable row level security;
alter table public.origins_trades enable row level security;
alter table public.origins_quest_state enable row level security;
alter table public.origins_quest_journal enable row level security;
alter table public.origins_talk enable row level security;
revoke all on public.origins_config, public.origins_access, public.origins_characters, public.origins_career, public.origins_events, public.origins_encounters,
  public.origins_items, public.origins_item_ledger, public.origins_trades, public.origins_quest_state, public.origins_quest_journal, public.origins_talk
  from public, anon, authenticated;
revoke all on function public.origins_allowed(uuid), public.origins_owns(text, uuid), public.origins_me_allowed(), public.origins_me_owns(text), public.origins_no_change(), public.origins_career_credit_up(),
  public.origins_versioned(), public.origins_item_guard(), public.origins_conserved() from public, anon, authenticated;
grant execute on function public.origins_me_allowed(), public.origins_me_owns(text) to authenticated;   -- the policies below call them as the reader; they answer only about the caller

grant select on public.origins_characters, public.origins_career, public.origins_items, public.origins_quest_state, public.origins_quest_journal, public.origins_talk to authenticated;
grant select (event_id, kind, at) on public.origins_events to authenticated;
create policy "an account reads its own characters" on public.origins_characters for select to authenticated using (account = (select auth.uid()) and public.origins_me_allowed());
create policy "an account reads its own career" on public.origins_career for select to authenticated using (account = (select auth.uid()) and public.origins_me_allowed());
create policy "an account reads its own events" on public.origins_events for select to authenticated using (account = (select auth.uid()) and public.origins_me_allowed());
create policy "an account reads its own items" on public.origins_items for select to authenticated using (holder_account = (select auth.uid()) and public.origins_me_allowed());
create policy "an account reads its own quests" on public.origins_quest_state for select to authenticated using (public.origins_me_owns(character) and public.origins_me_allowed());
create policy "an account reads its own journal" on public.origins_quest_journal for select to authenticated using (public.origins_me_owns(character) and public.origins_me_allowed());
create policy "an account reads its own talk" on public.origins_talk for select to authenticated using (public.origins_me_owns(character) and public.origins_me_allowed());
-- config, access, encounters, the ledger and trades have no policy and no grant: only the definer functions below touch them.

-- ---- the writer's functions (security definer; execute for frankendom_origins only) -------------------------------------------------

create function public.origins_create_character(p_account uuid, p_name text) returns text language plpgsql security definer set search_path = '' as $$
declare cid text;
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  if (select count(*) from public.origins_characters where account = p_account) >= 5 then raise exception 'character cap reached' using errcode = 'O0008'; end if;
  cid := 'pc:' || replace(gen_random_uuid()::text, '-', '');
  insert into public.origins_characters (id, account, name) values (cid, p_account, p_name);
  return cid;
end $$;

-- The first open snapshots the account's Pit credit ONCE. The writer reads the marks (origins_open returns them with career = null), computes
-- creditFromMarks, and calls origins_snapshot, which refuses unless the marks it was computed from are still the account's marks. Never recomputed.
create function public.origins_snapshot(p_account uuid, p_marks int, p_credit bigint) returns void language plpgsql security definer set search_path = '' as $$
declare marks int;
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  select coalesce(victory_marks, 0) into marks from public.fighter_profiles where user_id = p_account;
  if not found then marks := 0; end if;
  if marks <> p_marks then raise exception 'marks moved (% vs %): open again', marks, p_marks using errcode = 'O0002'; end if;
  insert into public.origins_events (event_id, kind, account, payload) values ('career-snapshot:' || p_account, 'career-snapshot', p_account, jsonb_build_object('marks', marks, 'credit', p_credit));
  insert into public.origins_career (account, seed_credit) values (p_account, greatest(p_credit, 0));
exception when unique_violation then null;   -- already snapshotted: the first one stands
end $$;

-- One consistent snapshot for the writer, career row locked. `career` is null until origins_snapshot has run.
create function public.origins_open(p_account uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare marks int;
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  select coalesce(victory_marks, 0) into marks from public.fighter_profiles where user_id = p_account;
  perform 1 from public.origins_career where account = p_account for update;
  return jsonb_build_object(
    'marks', coalesce(marks, 0),
    'career', (select to_jsonb(c) || jsonb_build_object('total_credit', public.origins_total_credit(p_account)) from public.origins_career c where account = p_account),
    'characters', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.origins_characters c where account = p_account), '[]'),
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.origins_items i where holder_account = p_account and retired_at is null), '[]'),
    'quests', coalesce((select jsonb_agg(to_jsonb(q)) from public.origins_quest_state q join public.origins_characters c on c.id = q.character where c.account = p_account), '[]'),
    'journal', coalesce((select jsonb_agg(to_jsonb(j) order by j.at, j.seq) from public.origins_quest_journal j join public.origins_characters c on c.id = j.character where c.account = p_account), '[]'),
    'talk', coalesce((select jsonb_agg(to_jsonb(t)) from public.origins_talk t join public.origins_characters c on c.id = t.character where c.account = p_account), '[]'));
end $$;

-- Total career CP, derived: the one place the sum is made.
create function public.origins_total_credit(p_account uuid) returns bigint language sql stable security definer set search_path = '' as $$
  select c.seed_credit + c.world_credit + coalesce((select sum((e.payload ->> 'cp')::bigint) from public.origins_events e where e.account = p_account and e.kind = 'pit'), 0)
  from public.origins_career c where c.account = p_account
$$;

-- Verified Pit claims of this account that have not been imported yet: verified AFTER the snapshot (a win the snapshot's marks already counted
-- is in the seed, never paid twice) and with no pit:<claim> event. The writer decodes each record for its level, runs #1428 award() with the legend
-- weights on the derived total, and commits the pit event {cp, legend} (+ beaten via career_set, + the arena-award mint when the claim has a piece).
create function public.origins_pit_pending(p_account uuid) returns table (claim_id bigint, opponent text, record text, piece text, tier smallint, at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.opponent, c.record, a.piece, a.tier, c.created_at
  from public.loot_claims c left join public.awards a on a.claim_id = c.id
  where c.user_id = p_account and c.verified and public.origins_allowed(p_account)
    and c.checked_at > (select e.at from public.origins_events e where e.event_id = 'career-snapshot:' || p_account)
    and not exists (select 1 from public.origins_events e where e.event_id = 'pit:' || c.id)
  order by c.id
$$;

-- Encounters (solo world fights): issue, then consume once.
create function public.origins_issue_encounter(p_account uuid, p_character text, p_token text, p_seed bigint, p_enemy text, p_level int, p_ttl_s int)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.origins_allowed(p_account) or not public.origins_owns(p_character, p_account) then raise exception 'origins is not open for this character' using errcode = 'O0007'; end if;
  insert into public.origins_encounters (token, account, character, seed, enemy, enemy_level, expires_at) values (p_token, p_account, p_character, p_seed, p_enemy, p_level, now() + make_interval(secs => least(greatest(p_ttl_s, 30), 3600)));
end $$;
create function public.origins_consume_encounter(p_account uuid, p_token text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare e public.origins_encounters;
begin
  update public.origins_encounters set used_at = now() where token = p_token and account = p_account and used_at is null and expires_at > now() returning * into e;
  if not found then raise exception 'encounter token unknown, used or expired' using errcode = 'O0009'; end if;
  return to_jsonb(e);
end $$;

-- The one write path. p_batch is a JSON array of ops, applied in order in ONE transaction; any failure (a stale version, a second reward, a
-- full slot, a broken conservation at commit) aborts all of it. p_accounts are the accounts whose items and characters it may touch.
create function public.origins_apply(p_batch jsonb, p_accounts uuid[]) returns jsonb language plpgsql security definer set search_path = '' as $$
declare op jsonb; kind text; r public.origins_items; l jsonb; n int; out jsonb := '[]'; acct uuid; cnt int; root text;
begin
  for op in select * from jsonb_array_elements(p_batch) loop
    kind := op ->> 'op';
    if kind = 'mint' then
      l := op -> 'item';
      insert into public.origins_items (id, item, quantity, tier, upgrade_level, loc_kind, loc_owner, loc_account, loc_container, loc_index, loc_slot, loc_from, bound_to, mint_key, provenance, history, single_copy)
      values (l ->> 'id', l ->> 'item', (l ->> 'quantity')::int, l ->> 'tier', coalesce((l ->> 'upgrade_level')::int, 0), l #>> '{loc,kind}', l #>> '{loc,owner}', (l #>> '{loc,account}')::uuid,
              l #>> '{loc,container}', (l #>> '{loc,index}')::int, l #>> '{loc,slot}', l #>> '{loc,from}', l ->> 'bound_to', l ->> 'mint_key', l -> 'provenance', coalesce(l -> 'history', '[]'), coalesce((l ->> 'single_copy')::boolean, false))
      returning * into r;
      if r.holder_account is null or not (r.holder_account = any (p_accounts)) then raise exception 'mint outside this batch''s accounts' using errcode = 'O0010'; end if;
      insert into public.origins_item_ledger (mint_root, delta, reason, item_id) values (r.mint_root, r.quantity, 'mint', r.id);
      out := out || jsonb_build_object('minted', r.id);
    elsif kind = 'put' then   -- move / equip / unequip / bind / upgrade / trade hop: the new location and the history entries to append
      select * into r from public.origins_items where id = op ->> 'id' for update;
      if not found or r.retired_at is not null or r.version <> (op ->> 'expected_version')::int then raise exception 'item % is stale or unknown', op ->> 'id' using errcode = 'O0002'; end if;
      if not (r.holder_account = any (p_accounts)) then raise exception 'item % is not this batch''s to move', r.id using errcode = 'O0010'; end if;
      l := op -> 'loc';
      update public.origins_items set version = version + 1,
        loc_kind = l ->> 'kind', loc_owner = l ->> 'owner', loc_account = (l ->> 'account')::uuid, loc_container = l ->> 'container', loc_index = (l ->> 'index')::int, loc_slot = l ->> 'slot', loc_from = l ->> 'from',
        bound_to = case when op ? 'bound_to' then op ->> 'bound_to' else bound_to end,
        upgrade_level = coalesce((op ->> 'upgrade_level')::int, upgrade_level),
        tier = case when op ? 'tier' then op ->> 'tier' else tier end,
        history = history || coalesce(op -> 'history_append', '[]')
      where id = r.id;
      if not exists (select 1 from public.origins_items where id = r.id and holder_account = any (p_accounts)) then raise exception 'item % would leave this batch''s accounts', r.id using errcode = 'O0010'; end if;
    elsif kind = 'split' then   -- parent keeps the rest; the child is a new row under parent::s<version> with the same root
      select * into r from public.origins_items where id = op ->> 'id' for update;
      n := (op ->> 'count')::int;
      if not found or r.retired_at is not null or r.version <> (op ->> 'expected_version')::int or n < 1 or n >= r.quantity or not (r.holder_account = any (p_accounts)) then
        raise exception 'split of % refused (stale, unknown, or bad count)', op ->> 'id' using errcode = 'O0002'; end if;
      l := op -> 'loc';
      update public.origins_items set version = version + 1, quantity = quantity - n where id = r.id;
      insert into public.origins_items (id, item, quantity, tier, upgrade_level, loc_kind, loc_owner, loc_account, loc_container, loc_index, loc_slot, loc_from, bound_to, mint_key, provenance, history, single_copy)
      values (op ->> 'new_id', r.item, n, r.tier, r.upgrade_level, l ->> 'kind', l ->> 'owner', (l ->> 'account')::uuid, l ->> 'container', (l ->> 'index')::int, l ->> 'slot', l ->> 'from', r.bound_to,
              r.mint_key || '::s' || (r.version + 1), r.provenance, r.history, r.single_copy);
    elsif kind = 'merge' then   -- from retires into into: quantity moves, nothing is minted or lost
      select * into r from public.origins_items where id = op ->> 'from_id' for update;
      if not found or r.retired_at is not null or r.version <> (op ->> 'from_version')::int or not (r.holder_account = any (p_accounts)) then raise exception 'merge source % refused', op ->> 'from_id' using errcode = 'O0002'; end if;
      update public.origins_items set version = version + 1, quantity = quantity + r.quantity where id = op ->> 'into_id' and version = (op ->> 'into_version')::int and item = r.item and retired_at is null and holder_account = any (p_accounts);
      get diagnostics cnt = row_count;
      if cnt <> 1 then raise exception 'merge target % refused', op ->> 'into_id' using errcode = 'O0002'; end if;
      update public.origins_items set version = version + 1, retired_at = now(), retire_reason = 'merge', loc_kind = null, loc_owner = null, loc_account = null, loc_container = null, loc_index = null, loc_slot = null, loc_from = null where id = r.id;
    elsif kind = 'burn' then   -- consumed or sold: the ledger books it
      select * into r from public.origins_items where id = op ->> 'id' for update;
      n := (op ->> 'count')::int;
      if not found or r.retired_at is not null or r.version <> (op ->> 'expected_version')::int or n < 1 or n > r.quantity or not (r.holder_account = any (p_accounts)) then
        raise exception 'burn of % refused', op ->> 'id' using errcode = 'O0002'; end if;
      insert into public.origins_item_ledger (mint_root, delta, reason, item_id) values (r.mint_root, -n, 'burn', r.id);
      if n = r.quantity then
        update public.origins_items set version = version + 1, quantity = quantity, retired_at = now(), retire_reason = 'burn', loc_kind = null, loc_owner = null, loc_account = null, loc_container = null, loc_index = null, loc_slot = null, loc_from = null where id = r.id;
      else update public.origins_items set version = version + 1, quantity = quantity - n where id = r.id; end if;
    elsif kind = 'event' then   -- a duplicate id is the "already paid" abort
      begin
        insert into public.origins_events (event_id, kind, account, character, payload) values (op ->> 'event_id', op ->> 'kind', (op ->> 'account')::uuid, op ->> 'character', coalesce(op -> 'payload', '{}'));
      exception when unique_violation then raise exception 'event % already settled', op ->> 'event_id' using errcode = 'O0001'; end;
      if not ((op ->> 'account')::uuid = any (p_accounts)) then raise exception 'event outside this batch''s accounts' using errcode = 'O0010'; end if;
    elsif kind = 'career_set' then
      acct := (op ->> 'account')::uuid;
      if not (acct = any (p_accounts)) then raise exception 'career outside this batch''s accounts' using errcode = 'O0010'; end if;
      update public.origins_career set version = version + 1, world_credit = (op ->> 'world_credit')::bigint, rested = (op ->> 'rested')::bigint, rested_at = (op ->> 'rested_at')::bigint,
        heat = op -> 'heat', story = array(select jsonb_array_elements_text(op -> 'story')), beaten = array(select jsonb_array_elements_text(op -> 'beaten'))
      where account = acct and version = (op ->> 'expected_version')::int;
      get diagnostics cnt = row_count;
      if cnt <> 1 then raise exception 'career write is stale' using errcode = 'O0002'; end if;
    elsif kind = 'quest_set' then   -- the state row, plus the journal lines to append (seq continues from the stored count)
      if not exists (select 1 from public.origins_characters where id = op ->> 'character' and account = any (p_accounts)) then raise exception 'quest outside this batch''s accounts' using errcode = 'O0010'; end if;
      if (op ->> 'expected_version') is null then
        insert into public.origins_quest_state (character, quest, story_version, stage, status, flags, rewarded) values (op ->> 'character', op ->> 'quest', (op ->> 'story_version')::int, op ->> 'stage', op ->> 'status', op -> 'flags', array(select jsonb_array_elements_text(op -> 'rewarded')));
      else
        update public.origins_quest_state set version = version + 1, story_version = (op ->> 'story_version')::int, stage = op ->> 'stage', status = op ->> 'status', flags = op -> 'flags', rewarded = array(select jsonb_array_elements_text(op -> 'rewarded'))
        where character = op ->> 'character' and quest = op ->> 'quest' and version = (op ->> 'expected_version')::int;
        get diagnostics cnt = row_count;
        if cnt <> 1 then raise exception 'quest write is stale' using errcode = 'O0002'; end if;
      end if;
      select count(*) into n from public.origins_quest_journal where character = op ->> 'character' and quest = op ->> 'quest';
      insert into public.origins_quest_journal (character, quest, seq, stage, text, at)
        select op ->> 'character', op ->> 'quest', n + (o - 1)::int, e ->> 'stage', e ->> 'text', (e ->> 'at')::timestamptz from jsonb_array_elements(coalesce(op -> 'journal_append', '[]')) with ordinality as t (e, o);
    elsif kind = 'talk_set' then
      if not exists (select 1 from public.origins_characters where id = op ->> 'character' and account = any (p_accounts)) then raise exception 'talk outside this batch''s accounts' using errcode = 'O0010'; end if;
      if (op ->> 'expected_version') is null then
        insert into public.origins_talk (character, told, flags) values (op ->> 'character', array(select jsonb_array_elements_text(op -> 'told')), op -> 'flags');
      else
        update public.origins_talk set version = version + 1, told = array(select jsonb_array_elements_text(op -> 'told')), flags = op -> 'flags' where character = op ->> 'character' and version = (op ->> 'expected_version')::int;
        get diagnostics cnt = row_count;
        if cnt <> 1 then raise exception 'talk write is stale' using errcode = 'O0002'; end if;
      end if;
    else
      raise exception 'unknown op %', kind using errcode = 'O0011';
    end if;
  end loop;
  return out;
end $$;

create function public.origins_commit(p_account uuid, p_batch jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  return public.origins_apply(p_batch, array[p_account]);
end $$;

-- A trade settles in one transaction over both sides' accounts; the writer computed the end state (settleTrade fills only the receiver's real free slots).
create function public.origins_open_trade(p_container text, p_side_a text, p_side_b text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.origins_characters a, public.origins_characters b where a.id = p_side_a and b.id = p_side_b and public.origins_allowed(a.account) and public.origins_allowed(b.account)) then
    raise exception 'origins is not open for both sides' using errcode = 'O0007'; end if;
  insert into public.origins_trades (container, side_a, side_b) values (p_container, p_side_a, p_side_b);
end $$;
create function public.origins_settle_trade(p_container text, p_batch jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.origins_trades; accts uuid[]; out jsonb;
begin
  select * into t from public.origins_trades where container = p_container and state = 'open' for update;
  if not found then raise exception 'trade % is not open', p_container using errcode = 'O0002'; end if;
  if t.side_a is null or t.side_b is null then raise exception 'trade % lost a side: cancel it' , p_container using errcode = 'O0002'; end if;
  accts := array(select account from public.origins_characters where id in (t.side_a, t.side_b));
  out := public.origins_apply(p_batch, accts);
  update public.origins_trades set state = 'settled', settled_at = now() where container = p_container;
  return out;
end $$;
create function public.origins_cancel_trade(p_container text, p_batch jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.origins_trades; accts uuid[]; out jsonb;
begin
  select * into t from public.origins_trades where container = p_container and state = 'open' for update;
  if not found then raise exception 'trade % is not open', p_container using errcode = 'O0002'; end if;
  accts := array(select account from public.origins_characters where id in (t.side_a, t.side_b));
  out := public.origins_apply(p_batch, accts);   -- the escrowed items go back to their owners
  update public.origins_trades set state = 'cancelled', settled_at = now() where container = p_container;
  return out;
end $$;

-- Erasure must never be blocked. Deleting an account (auth.users) cascades through every origins_ table by itself. This function does the same for one
-- account while keeping the login (a reset, or an erasure request handled before the account is deleted): characters (and with them items, quests,
-- journal, talk, encounters), events, career and the allowlist row, in one transaction. Items booked out of the ledger as burns; trades the account was
-- in stay open with a null side for the other party to cancel. Returns what it removed.
create function public.origins_purge_account(p_account uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare chars int; evs int; its int;
begin
  perform set_config('origins.purge', 'on', true);
  select count(*) into its from public.origins_items where holder_account = p_account and retired_at is null;
  delete from public.origins_events where account = p_account;
  get diagnostics evs = row_count;
  delete from public.origins_characters where account = p_account;
  get diagnostics chars = row_count;
  delete from public.origins_career where account = p_account;
  delete from public.origins_access where account = p_account;
  perform set_config('origins.purge', 'off', true);
  return jsonb_build_object('characters', chars, 'events', evs, 'live_items', its);
end $$;

revoke all on function public.origins_create_character(uuid, text), public.origins_open(uuid), public.origins_snapshot(uuid, int, bigint), public.origins_total_credit(uuid), public.origins_pit_pending(uuid),
  public.origins_issue_encounter(uuid, text, text, bigint, text, int, int), public.origins_consume_encounter(uuid, text), public.origins_apply(jsonb, uuid[]),
  public.origins_commit(uuid, jsonb), public.origins_open_trade(text, text, text), public.origins_settle_trade(text, jsonb), public.origins_cancel_trade(text, jsonb), public.origins_purge_account(uuid), public.origins_item_erased()
  from public, anon, authenticated;
grant execute on function public.origins_create_character(uuid, text), public.origins_open(uuid), public.origins_snapshot(uuid, int, bigint), public.origins_total_credit(uuid), public.origins_pit_pending(uuid),
  public.origins_issue_encounter(uuid, text, text, bigint, text, int, int), public.origins_consume_encounter(uuid, text),
  public.origins_commit(uuid, jsonb), public.origins_open_trade(text, text, text), public.origins_settle_trade(text, jsonb), public.origins_cancel_trade(text, jsonb), public.origins_purge_account(uuid)
  to frankendom_origins;   -- origins_apply is internal: only the functions above call it
grant usage on schema public to frankendom_origins;

commit;
