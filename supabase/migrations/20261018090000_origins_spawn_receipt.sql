begin;
-- ROLLBACK: supabase/down/20261018090000_origins_spawn_receipt_down.sql (drops exactly what this file creates).
-- CLASS 1, ADDITIVE and Origins-only: ONE read function, no table, column, index, existing function, grant or policy is altered.
-- Why (launch gate V5, World rewards): a kill_report whose answer was lost is retried by the page's outbox and meets the 409 "engage token unknown, used or expired". The page must be able to tell
-- "this kill was PAID" from "it expired, nothing was recorded" from "not yours / never existed". The rows already hold the answer: origins_spawn_engages keeps the used token with its result
-- ('killed' paid, 'dead' closed unpaid) and the kill writes its beta-ledger row 'enc:' || token in the same transaction. This function reads them back for THIS account only and pays nothing.
-- Shape: null when the token is not this account's (unknown and another account's token are indistinguishable, nothing about it leaks); {kind:'expired'} for a closed-dead token or an open one
-- past its expiry; {kind:'paid', instance, killedAt, cp, bronze, loot} from the stored rows (cp and bronze as the ledger booked them, loot = the items minted), never recomputed; {kind:'open'} for a
-- token that is still live (the writer never asks for those: it prices them). STABLE, no lock.
create function public.origins_spawn_receipt(p_account uuid, p_token text) returns jsonb language sql stable security definer set search_path = '' as $$
  select case
    when e.result = 'killed' then jsonb_build_object('kind', 'paid', 'instance', e.instance, 'killedAt', e.used_at,
      'cp', coalesce(l.cp, 0), 'bronze', coalesce(l.bronze, 0), 'loot', coalesce(cardinality(l.item_ids), 0))
    when e.result = 'dead' or (e.used_at is null and e.expires_at <= now()) then jsonb_build_object('kind', 'expired')
    else jsonb_build_object('kind', 'open')
  end
  from public.origins_spawn_engages e
  left join public.origins_beta_ledger l on l.event_id = 'enc:' || e.token and l.account = p_account
  where e.token = p_token and e.account = p_account
$$;
-- Supabase's default privileges grant EXECUTE to anon and authenticated on creation: revoke them. The WRITER role only: the verifier's role has no business reading engage rows.
revoke all on function public.origins_spawn_receipt(uuid, text) from public, anon, authenticated;
grant execute on function public.origins_spawn_receipt(uuid, text) to frankendom_origins;
commit;
