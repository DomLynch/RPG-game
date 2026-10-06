begin;
-- ROLLBACK: supabase/down/202610070003_origins_trade_open_lock_down.sql (restores 0003's origins_open_trade; drops nothing).
-- Audit finding C (Dom's GPT audit of e1ee616, verified by the Auditor): origins_open_trade checked "neither account is in an open trade" with a plain exists() and then
-- inserted, and the two partial unique indexes are per CHARACTER per side, so two concurrent openings Alice-Bob and Carol-Alice both passed the check (neither saw the
-- other's uncommitted insert) and both inserted: one account in two open trades. Fix: after the account lookup and before the check, take a transaction-scoped advisory
-- lock on BOTH accounts in a stable order (least, then greatest), so openings that share an account run one after the other and the second sees the first's row.
-- Two characters of ONE account share the account lock, so they serialise too. Same signature, same grants, same errors; 0003 is not edited.
create or replace function public.origins_open_trade(p_container text, p_side_a text, p_side_b text) returns void language plpgsql security definer set search_path = '' as $$
declare acct_a uuid; acct_b uuid;
begin
  select a.account, b.account into acct_a, acct_b from public.origins_characters a, public.origins_characters b where a.id = p_side_a and b.id = p_side_b;
  if acct_a is null or not public.origins_allowed(acct_a) or not public.origins_allowed(acct_b) then raise exception 'origins is not open for both sides' using errcode = 'O0007'; end if;
  if acct_a = acct_b then raise exception 'a trade is between two accounts' using errcode = 'O0012'; end if;
  perform pg_advisory_xact_lock(hashtextextended('origins-open-trade|' || least(acct_a::text, acct_b::text), 0));
  perform pg_advisory_xact_lock(hashtextextended('origins-open-trade|' || greatest(acct_a::text, acct_b::text), 0));
  if exists (select 1 from public.origins_trades t join public.origins_characters c on c.id in (t.side_a, t.side_b) where t.state = 'open' and c.account in (acct_a, acct_b)) then
    raise exception 'an account is already in an open trade' using errcode = 'O0013'; end if;
  insert into public.origins_trades (container, side_a, side_b, expires_at)
  values (p_container, p_side_a, p_side_b, now() + make_interval(secs => coalesce((select (value #>> '{}')::int from public.origins_config where key = 'trade_hard_expiry_s'), 1200)));
end $$;
commit;
