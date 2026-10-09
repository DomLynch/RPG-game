begin;
-- ROLLBACK: supabase/down/202610080006_origins_last_paid_kill_down.sql (drops exactly what this file creates).
-- CLASS 1, ADDITIVE and Origins-only: ONE new read function and ONE partial index. No table, existing function, grant or policy is altered.
-- Why (Lead, Dom's animal rule 2026-10-08): the farming bound on paid world kills (one paid kill per account per fight per respawn window) lived in the writer's
-- memory, so a restart reset it. The settle already writes the kill's `enc:<token>` event in the SAME transaction as its rewards; the writer now records the fight
-- id and whether the kill paid in that event's payload, and this reads back the time since the account's last PAID kill of a fight, on the database clock.
create index origins_events_paid_mob on public.origins_events (account, (payload ->> 'fight'), at desc) where kind = 'mob' and payload ->> 'paid' = 'true';
create function public.origins_last_paid_kill(p_account uuid, p_fight text) returns bigint language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.origins_allowed(p_account) then raise exception 'origins is not open for this account' using errcode = 'O0007'; end if;
  -- milliseconds since the newest paid kill of this fight by this account; null when there is none
  return (select (extract(epoch from (now() - e.at)) * 1000)::bigint from public.origins_events e
          where e.account = p_account and e.kind = 'mob' and e.payload ->> 'fight' = p_fight and e.payload ->> 'paid' = 'true' order by e.at desc limit 1);
end $$;
-- Supabase's default privileges grant EXECUTE to anon and authenticated on creation (the trap #1639 hit): revoke them, then grant the two writer roles only.
revoke all on function public.origins_last_paid_kill(uuid, text) from public, anon, authenticated;
grant execute on function public.origins_last_paid_kill(uuid, text) to frankendom_origins, frankendom_verifier;
commit;
