-- ROLLBACK of 20261022100000_origins_world_marks.sql: restores standing_of exactly as 202609230001 made it (seed marks + earlier verified claims), then drops what the migration created.
-- The world marks go with their table: a player's ladder level falls back to what its claims alone give. Nothing else is touched (grants on standing_of are kept by create or replace).
begin;
create or replace function public.standing_of(account uuid, before_claim bigint) returns table (marks integer, owned jsonb) language sql stable security definer set search_path = '' as $$
  with earlier as (
    select c.id from public.loot_claims c
    where c.user_id = account and c.verified
      and (before_claim is null or (c.created_at, c.id) < (select x.created_at, x.id from public.loot_claims x where x.id = before_claim)))
  select coalesce((select s.marks from public.account_seed s where s.user_id = account), 0) + (select count(*) from earlier)::integer,
         (select coalesce(jsonb_agg(p order by p), '[]'::jsonb) from (
            select jsonb_array_elements_text(s.owned) as p from public.account_seed s where s.user_id = account
            union
            select a.piece from public.awards a join earlier e on e.id = a.claim_id) pieces)
$$;
drop function public.origins_world_marks_settle(int, numeric, int, int);
drop table public.origins_world_marks_settled;
drop table public.origins_world_marks;
commit;
