# Duel health for gate 4 (Backend, 2026-10-02)

Strategy's brief via Lead: one read-only query over `public.duel_metrics` for Dom's device test on Saturday.
The query is [`duel-health.sql`](duel-health.sql). It is a single SELECT: no view, no migration, no grant, so nothing is applied to
production and there is nothing for Dom to approve. Backend runs it (Supabase MCP `execute_sql` or the SQL editor) after the test and
sends the one-row result to Lead and Strategy. Set the window in `params` first.

## What each column answers

| Gate-4 question | Column(s) | How |
|---|---|---|
| Did both phones get a duel going? | `duels`, `both_sides_reported`, `one_side_only` | One row per side per duel (src/net/lobby.ts). A duel with one side only means the other page never reported. |
| Relay or direct? | `direct_duels`, `relayed_duels`, `candidates` | A duel counts as relayed if either side ended on the relay; `candidates` is the ICE pair type per side. |
| Do the two sides agree on the result? | `results_agree`, `results_disagree`, `results_missing`, `disagreeing_rooms` | Agree = finished/finished, no-contest/no-contest, or forfeit-win against forfeit-loss. |
| Forfeits | `duels_forfeited`, `results_by_side` | A duel where either side reports a forfeit. |
| Play quality | `duels_with_desync`, `median_duel_rtt_p95_ms`, `worst_stalls_per_min`, `worst_rollbacks_per_min` | Worst side per duel. |
| Which devices | `devices` | ios / android / desktop from the user agent. |

If a side posted twice (the page hid, then the duel ended), only its last row counts.

## What it cannot answer (gaps, not bugs)

- **Reconnects.** `duel_metrics` has no reconnect column; the client retries for 30 s (`RECONNECT` in src/net/transport.ts) and
  records nothing about it. Stalls per minute is the nearest signal. A real count needs a `reconnects` column (a migration plus a
  client change, Duel's call, Dom's yes), so for Saturday the tester notes reconnects by hand.
- **Connect failures.** A duel that never plays a frame writes no row. Duels started = the relay's `minted` counts in its
  once-a-minute journal line on the VPS (`journalctl -u frankendom-duel-relay`; the unit is not installed on the VPS as of 2026-10-02), so connect success = `duels` / rooms minted in the
  same window. The relay logs counts only, never a room id, so this is a ratio, not a per-room join.

## Tested

Against twelve synthetic rows in a VALUES list (run read-only on the hosted project, no table touched): 6 duels, 5 two-sided, 1
one-sided, 1 relayed, 3 agree, 1 disagree (finished vs no-contest, named in `disagreeing_rooms`), 1 missing result, and an
earlier null row for a side ignored in favour of its later row. Against the real table on 2026-10-02: runs, 0 rows.
