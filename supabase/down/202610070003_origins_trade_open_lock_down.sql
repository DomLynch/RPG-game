begin;
-- Restores 0003's origins_open_trade (the up replaced it in place; nothing else changed).
create or replace function public.origins_open_trade(p_container text, p_side_a text, p_side_b text) returns void language plpgsql security definer set search_path = '' as $$
declare acct_a uuid; acct_b uuid;
begin
  select a.account, b.account into acct_a, acct_b from public.origins_characters a, public.origins_characters b where a.id = p_side_a and b.id = p_side_b;
  if acct_a is null or not public.origins_allowed(acct_a) or not public.origins_allowed(acct_b) then raise exception 'origins is not open for both sides' using errcode = 'O0007'; end if;
  if acct_a = acct_b then raise exception 'a trade is between two accounts' using errcode = 'O0012'; end if;
  if exists (select 1 from public.origins_trades t join public.origins_characters c on c.id in (t.side_a, t.side_b) where t.state = 'open' and c.account in (acct_a, acct_b)) then
    raise exception 'an account is already in an open trade' using errcode = 'O0013'; end if;
  insert into public.origins_trades (container, side_a, side_b, expires_at)
  values (p_container, p_side_a, p_side_b, now() + make_interval(secs => coalesce((select (value #>> '{}')::int from public.origins_config where key = 'trade_hard_expiry_s'), 1200)));
end $$;
commit;
