begin;
-- DRAFT, NOT FOR APPLY. CLASS 2: the events-kind constraint is an ALTER of a live table (origins_events), so Strategy's standing rule makes this a joint GO WITH DOM
-- (plus Strategy + Lead), on top of the Auditor's PRE. Everything else in 0005 applies without this file.
-- ROLLBACK: supabase/down/202610070006_origins_trade_reversal_down.sql (valid only while no 'trade-reversal'/'trade-hold'/'metal' event exists).
-- docs/specs/origins/trading.md §6 M11 (three more event kinds) and the M14 reversal that writes one of them.

-- ---- M11: the event kinds (an Origins table constraint replace) --------------------------------------------------------------------------
alter table public.origins_events drop constraint origins_events_kind_check;
alter table public.origins_events add constraint origins_events_kind_check
  check (kind in ('career-snapshot', 'pit', 'boss', 'mob', 'quest-stage', 'story-step', 'talk', 'mint', 'burn', 'upgrade', 'paid', 'trade', 'trade-cancel', 'trade-reversal', 'trade-hold', 'metal'));

-- Reverse a settled trade (Dom, or Strategy on Dom's say; decision 18 of the spec): the reviewer must be in public.admins. Each put sends a piece the receiver
-- STILL holds back to the sender, and this function writes the {kind:'reversal'} history entry itself (a client-built put may not carry history_append). A piece
-- that has moved on since is not touched: the writer reports it. One reversal per trade: the event id carries the container, so a second hits O0001.
create function public.origins_reverse_trade(p_container text, p_reviewer uuid, p_reason text, p_batch jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.origins_trades; accts uuid[]; op jsonb; it public.origins_items; trade_entry jsonb; ops jsonb := '[]'::jsonb; acct uuid;
begin
  if not exists (select 1 from public.admins a where a.user_id = p_reviewer) then raise exception 'reviewer % is not an admin', p_reviewer using errcode = 'O0007'; end if;
  if p_reason is null or char_length(p_reason) not between 3 and 500 then raise exception 'a reversal needs a reason of 3 to 500 characters' using errcode = 'O0012'; end if;
  select * into t from public.origins_trades where container = p_container and state = 'settled' for update;
  if not found then raise exception 'trade % is not settled', p_container using errcode = 'O0002'; end if;
  accts := array(select account from public.origins_characters where id in (t.side_a, t.side_b));
  if cardinality(accts) <> 2 then raise exception 'trade % lost a side: nothing to reverse to', p_container using errcode = 'O0002'; end if;
  for op in select * from jsonb_array_elements(p_batch) loop
    if op ->> 'op' <> 'put' then raise exception 'op % is not allowed in a reversal', op ->> 'op' using errcode = 'O0012'; end if;
    if op ?| array['upgrade_level', 'tier', 'bound_to', 'history_append'] then raise exception 'a reversal put moves a piece only' using errcode = 'O0012'; end if;
    select * into it from public.origins_items where id = op ->> 'id';
    if not found or it.retired_at is not null then raise exception 'put of % is not a live piece', op ->> 'id' using errcode = 'O0012'; end if;
    select e into trade_entry from jsonb_array_elements(it.history) e where e ->> 'kind' = 'trade' and e ->> 'trade' = p_container limit 1;
    if trade_entry is null then raise exception 'item % was not moved by trade %', it.id, p_container using errcode = 'O0012'; end if;
    if it.loc_kind not in ('pack', 'bank') or it.loc_owner is distinct from trade_entry ->> 'to' then raise exception 'item % is no longer held by the receiver', it.id using errcode = 'O0012'; end if;
    if (op #>> '{loc,kind}') not in ('pack', 'bank') or (op #>> '{loc,owner}') is distinct from trade_entry ->> 'from' then raise exception 'item % goes back to the sender''s pack or bank', it.id using errcode = 'O0012'; end if;
    ops := ops || jsonb_build_array(op || jsonb_build_object('history_append', jsonb_build_array(jsonb_build_object('kind', 'reversal', 'trade', p_container, 'from', it.loc_owner, 'to', op #>> '{loc,owner}', 'at', now()))));
  end loop;
  foreach acct in array accts loop
    ops := ops || jsonb_build_array(jsonb_build_object('op', 'event', 'event_id', 'trade-reversal:' || p_container || ':' || acct, 'kind', 'trade-reversal', 'account', acct,
      'payload', jsonb_build_object('trade', p_container, 'reviewer', p_reviewer, 'reason', p_reason)));
  end loop;
  return public.origins_apply(ops, accts);
end $$;

revoke all on function public.origins_reverse_trade(text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.origins_reverse_trade(text, uuid, text, jsonb) to frankendom_origins;
commit;
