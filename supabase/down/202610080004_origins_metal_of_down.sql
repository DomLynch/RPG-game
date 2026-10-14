begin;
-- Drops exactly what 202610080004_origins_metal_of.sql creates. Nothing depends on it; no table, other function or grant is touched.
drop function public.origins_metal_of(uuid);
commit;
