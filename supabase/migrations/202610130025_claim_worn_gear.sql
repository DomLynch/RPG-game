begin;
-- ROLLBACK: supabase/down/202610130025_claim_worn_gear_down.sql (drops exactly what this file creates).
-- CLASS 1, ADDITIVE: one nullable column and one BEFORE INSERT trigger on each of loot_claims and daily_results.
-- A fight record's sheet carries the dial deltas of the gear the character wore. The sweeps check that sheet against the gear the ledger holds, and the ledger moves on: a player who wins geared and then equips new loot would
-- otherwise fail an honest record. So the gear is FROZEN when the row is posted: worn_gear = { "<character id>": [{ "item", "tier", "slot" }, ...] } for every equipped piece of every character the poster owns, read from origins_items by
-- a definer trigger. The client cannot set it (the trigger overwrites whatever was sent). Rows posted before this file have null, which the sweeps read as no gear held.
alter table public.loot_claims add column worn_gear jsonb check (worn_gear is null or jsonb_typeof(worn_gear) = 'object');
alter table public.daily_results add column worn_gear jsonb check (worn_gear is null or jsonb_typeof(worn_gear) = 'object');

create function public.freeze_worn_gear() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select coalesce(jsonb_object_agg(g.character, g.pieces), '{}'::jsonb) into new.worn_gear from (
    select i.loc_owner as character, jsonb_agg(jsonb_build_object('item', i.item, 'tier', i.tier, 'slot', i.loc_slot) order by i.id) as pieces
    from public.origins_items i join public.origins_characters c on c.id = i.loc_owner
    where i.loc_kind = 'equipped' and i.retired_at is null and c.account = new.user_id group by i.loc_owner) g;
  return new;
end$$;
revoke all on function public.freeze_worn_gear() from public, anon, authenticated;
create trigger loot_claims_freeze_worn_gear before insert on public.loot_claims for each row execute function public.freeze_worn_gear();
create trigger daily_results_freeze_worn_gear before insert on public.daily_results for each row execute function public.freeze_worn_gear();

grant select (worn_gear) on public.loot_claims to frankendom_verifier;
grant select (worn_gear) on public.daily_results to frankendom_verifier;
commit;
