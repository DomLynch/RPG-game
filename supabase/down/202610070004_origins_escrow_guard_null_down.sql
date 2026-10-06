begin;
-- Restores 202610060003's escrow guard exactly (the NULL-unsafe version). Always safe: a function body swap, no data touched.
create or replace function public.origins_escrow_guard() returns trigger language plpgsql set search_path = '' as $$
declare entering boolean; leaving boolean;
begin
  entering := new.loc_kind = 'trade-escrow' and (tg_op = 'INSERT' or old.loc_kind is distinct from 'trade-escrow' or old.loc_container is distinct from new.loc_container);
  leaving := tg_op = 'UPDATE' and old.loc_kind = 'trade-escrow' and (new.loc_kind is distinct from 'trade-escrow' or new.loc_container is distinct from old.loc_container);
  if not (entering or leaving) then return new; end if;
  if coalesce(current_setting('origins.trade', true), '') <> 'on' then raise exception 'trade-escrow changes only inside the trade functions' using errcode = 'O0012'; end if;
  if entering then
    if not new.single_copy or new.bound_to is not null then raise exception 'item % cannot be offered (only unbound single-copy pieces)', new.id using errcode = 'O0012'; end if;
    if not exists (select 1 from public.origins_trades t where t.container = new.loc_container and t.state = 'open' and new.loc_from in (t.side_a, t.side_b)) then
      raise exception 'escrow needs an open trade the offerer is a side of' using errcode = 'O0012'; end if;
  end if;
  return new;
end $$;
commit;
