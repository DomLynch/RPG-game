-- CLASS 1, ADDITIVE and Origins-only: ONE new function, executable by NO role (the launch checklist runs it as the database owner, once, under Lead + Strategy GO and the
-- Auditor's before/after read-back). No table, existing function, trigger, grant or policy is altered. ROLLBACK: supabase/down/202610080015_origins_beta_wipe_down.sql.
-- Why (Strategy 2026-10-08): every reward of the detached Zone 1 path (202610080014) lands in origins_beta_ledger; the pre-launch wipe reverses EXACTLY those and nothing else.
--   items:  every ledger item still live (and its split children, id || '::s<n>') is burned as origins_apply's `burn` does: an item-ledger 'burn' row and the item retired 'burn'.
--           An item already retired (merged, sold, burned) is skipped and counted: what it became is no longer beta-only.
--   bronze: the ledger's bronze is spent back through the metal ledger ('spend', event 'betawipe:<event>'), clamped at the balance (bronze already spent is counted, not driven below 0).
--   CP:     the career trigger refuses any world_credit decrease on UPDATE (O0004, the guard against a writer bug). The wipe is the one sanctioned decrease: it DELETES the row and
--           re-inserts it with world_credit - beta cp (clamped at 0), every other column equal and version + 1 (any writer holding the old version aborts as stale).
--   ledger: each row reversed gets wiped_at; a second run reverses nothing. The kill events stay (append-only history).
begin;

create function public.origins_beta_wipe() returns jsonb language plpgsql security definer set search_path = '' as $$
declare a record; r record; c public.origins_career; m public.origins_metal; take bigint; out jsonb := jsonb_build_object('accounts', 0, 'items_burned', 0, 'items_skipped', 0, 'bronze_reversed', 0, 'bronze_short', 0, 'cp_reversed', 0, 'cp_short', 0, 'rows', 0);
begin
  for a in select l.account, sum(l.cp) as cp, sum(l.bronze) as bronze, array_agg(l.event_id) as events, coalesce((select array_agg(x) from public.origins_beta_ledger l2, unnest(l2.item_ids) x where l2.account = l.account and l2.wiped_at is null), '{}') as ids   -- not array_agg(item_ids): a kill that minted nothing has '{}', which array_agg cannot stack
           from public.origins_beta_ledger l where l.wiped_at is null group by l.account order by l.account loop
    out := jsonb_set(out, '{accounts}', to_jsonb((out ->> 'accounts')::int + 1));
    -- items (and split children), live ones only
    for r in select i.* from public.origins_items i where i.id = any (a.ids) or exists (select 1 from unnest(a.ids) x where starts_with(i.id, x || '::s')) order by i.id for update loop
      if r.retired_at is not null then out := jsonb_set(out, '{items_skipped}', to_jsonb((out ->> 'items_skipped')::int + 1)); continue; end if;
      insert into public.origins_item_ledger (mint_root, delta, reason, item_id) values (r.mint_root, -r.quantity, 'burn', r.id);
      update public.origins_items set version = version + 1, retired_at = now(), retire_reason = 'burn', loc_kind = null, loc_owner = null, loc_account = null, loc_container = null, loc_index = null, loc_slot = null, loc_from = null where id = r.id;
      out := jsonb_set(out, '{items_burned}', to_jsonb((out ->> 'items_burned')::int + 1));
    end loop;
    -- bronze
    if a.bronze > 0 then
      select * into m from public.origins_metal where account = a.account for update;
      take := least(a.bronze, coalesce(m.bronze, 0));
      if take > 0 then
        update public.origins_metal set version = version + 1, bronze = bronze - take where account = a.account;
        insert into public.origins_metal_ledger (account, delta_bronze, reason, event_id) values (a.account, -take, 'spend', left('betawipe:' || a.account, 200));
      end if;
      out := jsonb_set(out, '{bronze_reversed}', to_jsonb((out ->> 'bronze_reversed')::bigint + take));
      out := jsonb_set(out, '{bronze_short}', to_jsonb((out ->> 'bronze_short')::bigint + a.bronze - take));
    end if;
    -- CP: the one sanctioned decrease (delete + re-insert; the trigger guards UPDATE only)
    if a.cp > 0 then
      select * into c from public.origins_career where account = a.account for update;
      if found then
        take := least(a.cp, c.world_credit);
        delete from public.origins_career where account = a.account;
        c.world_credit := c.world_credit - take; c.version := c.version + 1;
        insert into public.origins_career select c.*;
        out := jsonb_set(out, '{cp_reversed}', to_jsonb((out ->> 'cp_reversed')::bigint + take));
        out := jsonb_set(out, '{cp_short}', to_jsonb((out ->> 'cp_short')::bigint + a.cp - take));
      end if;
    end if;
    update public.origins_beta_ledger set wiped_at = now() where event_id = any (a.events);
    out := jsonb_set(out, '{rows}', to_jsonb((out ->> 'rows')::int + cardinality(a.events)));
  end loop;
  return out;
end $$;
revoke all on function public.origins_beta_wipe() from public, anon, authenticated;   -- and no grant: the owner runs it, at launch, once

commit;
