begin;
-- Down for 202610080012_origins_shop_stock.sql: drops exactly what it created. The shop events themselves stay (they are the purchase history).
drop function public.origins_shop_stock(uuid, text, text);
drop index public.origins_events_shop;
commit;
