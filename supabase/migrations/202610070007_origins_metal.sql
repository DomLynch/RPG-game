begin;
-- ORDER: 0007 replaces origins_purge_account with 0005's body plus the metal deletes, and 0005's body deletes from origins_trade_audit, which 0005 creates. Apply 0005 first
-- (0008, class 2, is independent of this file and may follow whenever Dom rules it). The guard makes a wrong order fail loudly instead of leaving a purge that errors.
do $g$ begin if to_regclass('public.origins_trade_audit') is null then raise exception '0007 needs 0005 applied first (its purge deletes the trade audit rows)'; end if; end $g$;
-- DRAFT, NOT FOR APPLY. No PRE and no apply until Strategy + Lead's joint GO. Class per statement is in the PR body (0007 is class 1: new Origins tables + replaces of two Origins functions).
-- ROLLBACK: supabase/down/202610070007_origins_metal_down.sql (valid only while no metal row or ledger line exists; restores 0001's origins_apply and 0005's purge).
-- docs/specs/origins/trading.md §6 M15, decision 8 option B: bound metals are an ACCOUNT balance, never an item, and never move between accounts (no transfer reason exists).
-- Materials-only at beta, so nothing calls the op yet. The balance row and the ledger must agree at every commit (deferred conservation, like the item ledger); the op
-- joins the one write path (origins_apply) so an item burn and a metal spend share one transaction. origins_apply below is 0001's text with ONE new branch (`metal`) and
-- one new declared variable; scripts/origins-trade-limits-check.mjs proves that by diffing the two definitions line by line.

create table public.origins_metal (
  account uuid primary key references auth.users (id) on delete cascade,
  bronze bigint not null default 0 constraint origins_metal_bronze_check check (bronze between 0 and 1000000000),
  version int not null default 1 check (version >= 1)
);
create table public.origins_metal_ledger (
  id bigint generated always as identity primary key,
  account uuid not null references auth.users (id) on delete cascade,
  delta_bronze bigint not null check (delta_bronze <> 0),
  reason text not null check (reason in ('award', 'spend', 'refund')),   -- no 'transfer': metal cannot change accounts
  event_id text check (char_length(event_id) <= 200),
  at timestamptz not null default now()
);
create index origins_metal_ledger_account on public.origins_metal_ledger (account, at desc);
create trigger origins_metal_ledger_append_only before update or delete on public.origins_metal_ledger for each row when (pg_trigger_depth() = 0 and coalesce(current_setting('origins.purge', true), '') <> 'on') execute function public.origins_no_change();

-- The balance equals the sum of the ledger at every commit: a write to either table without the other aborts.
create function public.origins_metal_conserved() returns trigger language plpgsql security definer set search_path = '' as $$
declare bal bigint; booked bigint;
begin
  select coalesce((select bronze from public.origins_metal where account = new.account), 0) into bal;
  select coalesce(sum(delta_bronze), 0) into booked from public.origins_metal_ledger where account = new.account;
  if bal <> booked then raise exception 'conservation: account % holds % bronze but the ledger says %', new.account, bal, booked using errcode = 'O0006'; end if;
  return null;
end $$;
create constraint trigger origins_metal_conserved after insert or update on public.origins_metal deferrable initially deferred for each row execute function public.origins_metal_conserved();
create constraint trigger origins_metal_ledger_conserved after insert on public.origins_metal_ledger deferrable initially deferred for each row execute function public.origins_metal_conserved();

alter table public.origins_metal enable row level security;
alter table public.origins_metal_ledger enable row level security;
revoke all on public.origins_metal, public.origins_metal_ledger from public, anon, authenticated;
revoke all on function public.origins_metal_conserved() from public, anon, authenticated;
create policy "an account reads its own metal" on public.origins_metal for select to authenticated using (account = (select auth.uid()) and public.origins_me_allowed());
create policy "an account reads its own metal ledger" on public.origins_metal_ledger for select to authenticated using (account = (select auth.uid()) and public.origins_me_allowed());
grant select on public.origins_metal, public.origins_metal_ledger to authenticated;

-- 0001's origins_apply with one new branch.
create or replace function public.origins_apply(p_batch jsonb, p_accounts uuid[]) returns jsonb language plpgsql security definer set search_path = '' as $$
declare op jsonb; kind text; r public.origins_items; l jsonb; n int; out jsonb := '[]'; acct uuid; cnt int; root text; delta bigint;
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
    elsif kind = 'metal' then   -- the account's bound-metal balance (bronze): awarded by a verified source, spent, refunded; never moved between accounts
      acct := (op ->> 'account')::uuid; delta := (op ->> 'delta_bronze')::bigint;
      if not (acct = any (p_accounts)) then raise exception 'metal outside this batch''s accounts' using errcode = 'O0010'; end if;
      if coalesce(op ->> 'reason', '') not in ('award', 'spend', 'refund') or delta is null or delta = 0 or (op ->> 'reason' = 'spend') <> (delta < 0) then
        raise exception 'metal % with delta % is not valid (award and refund add, spend subtracts)', op ->> 'reason', delta using errcode = 'O0012'; end if;
      if (op ->> 'expected_version') is null then
        begin
          insert into public.origins_metal (account, bronze) values (acct, delta);
        exception when unique_violation then raise exception 'metal row exists: send its expected_version' using errcode = 'O0002';
        end;
      else
        update public.origins_metal set version = version + 1, bronze = bronze + delta where account = acct and version = (op ->> 'expected_version')::int;
        get diagnostics cnt = row_count;
        if cnt <> 1 then raise exception 'metal write is stale' using errcode = 'O0002'; end if;
      end if;
      insert into public.origins_metal_ledger (account, delta_bronze, reason, event_id) values (acct, delta, op ->> 'reason', op ->> 'event_id');
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

-- 0005's purge with the metal rows added.
create or replace function public.origins_purge_account(p_account uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare chars int; evs int; its int;
begin
  perform set_config('origins.purge', 'on', true);
  select count(*) into its from public.origins_items where holder_account = p_account and retired_at is null;
  delete from public.origins_events where account = p_account;
  get diagnostics evs = row_count;
  delete from public.origins_trade_audit where account = p_account;
  delete from public.origins_metal_ledger where account = p_account;
  delete from public.origins_metal where account = p_account;
  delete from public.origins_characters where account = p_account;
  get diagnostics chars = row_count;
  delete from public.origins_career where account = p_account;
  delete from public.origins_access where account = p_account;
  perform set_config('origins.purge', 'off', true);
  return jsonb_build_object('characters', chars, 'events', evs, 'live_items', its);
end $$;
commit;
