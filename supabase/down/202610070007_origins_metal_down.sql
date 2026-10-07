begin;
do $g$ begin if exists (select 1 from public.origins_metal) or exists (select 1 from public.origins_metal_ledger) then raise exception 'metal exists: purge or settle it before rolling 0007 back'; end if; end $g$;
-- Drops exactly what 202610070007_origins_metal.sql creates and restores 0001's origins_apply and 0005's origins_purge_account. Valid only while no origins_metal row or
-- ledger line exists (the tables go with their rows).
create or replace function public.origins_apply(p_batch jsonb, p_accounts uuid[]) returns jsonb language plpgsql security definer set search_path = '' as $$
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
create or replace function public.origins_purge_account(p_account uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare chars int; evs int; its int;
begin
  perform set_config('origins.purge', 'on', true);
  select count(*) into its from public.origins_items where holder_account = p_account and retired_at is null;
  delete from public.origins_events where account = p_account;
  get diagnostics evs = row_count;
  delete from public.origins_trade_audit where account = p_account;
  delete from public.origins_characters where account = p_account;
  get diagnostics chars = row_count;
  delete from public.origins_career where account = p_account;
  delete from public.origins_access where account = p_account;
  perform set_config('origins.purge', 'off', true);
  return jsonb_build_object('characters', chars, 'events', evs, 'live_items', its);
end $$;
drop table public.origins_metal_ledger;
drop table public.origins_metal;
drop function public.origins_metal_conserved();
commit;
