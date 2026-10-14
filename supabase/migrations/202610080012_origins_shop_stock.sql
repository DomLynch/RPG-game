begin;
-- ROLLBACK: supabase/down/202610080012_origins_shop_stock_down.sql (drops exactly what this file creates).
-- CLASS 1, ADDITIVE and Origins-only: ONE new read function and ONE partial index. No table, existing function, grant or policy is altered.
-- Why (Town plan A2, the shop buy settle): a shop's shelf is per account in beta, and each buy's `shop:<character>:<op>` event (kind 'metal': a buy is a bronze spend, so no new event kind and no constraint change; written in the SAME origins_apply
-- batch as the bronze spend and the minted items) carries the shelf after that buy in payload.stock {count, at}. This reads back the newest such shelf for one
-- (account, shop, item) plus the database clock, so the writer's restock (origins/shops/shop.ts stockNow) runs on the database's time, never the request's.
create index origins_events_shop on public.origins_events (account, (payload ->> 'shop'), (payload ->> 'item'), at desc) where kind = 'metal' and payload ? 'shop';
create function public.origins_shop_stock(p_account uuid, p_shop text, p_item text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  return jsonb_build_object('now', (extract(epoch from now()) * 1000)::bigint,
    'stock', (select e.payload -> 'stock' from public.origins_events e
              where e.account = p_account and e.kind = 'metal' and e.payload ->> 'shop' = p_shop and e.payload ->> 'item' = p_item order by e.at desc limit 1));
end $$;
-- Supabase's default privileges grant EXECUTE to anon and authenticated on creation (the trap #1639 hit): revoke them, then grant the two writer roles only.
revoke all on function public.origins_shop_stock(uuid, text, text) from public, anon, authenticated;
grant execute on function public.origins_shop_stock(uuid, text, text) to frankendom_origins, frankendom_verifier;
commit;
