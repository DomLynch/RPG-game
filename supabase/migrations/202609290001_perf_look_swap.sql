begin;
-- The rank look's swap timing on the anonymous perf beacon (Lead 2026-09-29, for Strategy's beta bar: "the rank look swaps in before the
-- first exchange, never mid-swing"). Two nullable columns, both null when the look did not swap in that fight (no look at the rung, still
-- loading at the fight's end, or already swapped in an earlier fight on the page):
--   look_swap_s: seconds from the fight's first playable frame to the swap (0..3600, one decimal from the client);
--   swapped_before_first_exchange: no exchange (a playable frame that was not an idle beat, rank-look.ts idleBeat) had begun at the swap.
-- Neither identifies anyone. The client roles may insert them; nothing else about the table's rights, caps or retention changes.
alter table public.perf_beacons
  add column look_swap_s real check (look_swap_s between 0 and 3600),
  add column swapped_before_first_exchange boolean,
  add constraint perf_beacons_look_swap_pair check ((look_swap_s is null) = (swapped_before_first_exchange is null));
grant insert (look_swap_s, swapped_before_first_exchange) on public.perf_beacons to anon, authenticated;
commit;
