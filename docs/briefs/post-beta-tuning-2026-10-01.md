# Post-beta tuning proposal and the real-player data question (2026-10-02)

Stats lane, for Strategy. Docs-only; analysis only, no `src/` change; the sim stays frozen for the beta (no tuning before Saturday 2026-10-03). Part 1 is sim-measured on the live revision `e2e70ab1` on the VPS; the full per-opponent tables, gates and raw numbers are in `docs/briefs/post-beta-tuning-data-2026-10-02.md`. Part 2 is the real-player query and the beacon migration. Ask from Strategy 2026-10-01: pull every opponent inside about +-10 points of the pooled mid-skill curve at each rank, make the non-rampers (nightborn, plaguedoctor, witch, veteran) ramp with level, give Nightborn and Plague Doctor distinct behaviour (they are sim-identical), sim-checked; plus a read-only SQL for real-player win % by opponent and rank; plus the beacon migration sketch with a Dom-ask. Docs-only; the sim stays frozen for the beta (no tuning before Saturday 2026-10-03).

## Part 1: per-opponent tuning knobs

Method: a harness re-implements `profileAt`/`opponentAt` without the id cache so a tuned variant is a plain object; every number is a measured win rate (baseline 30 seeds, proposal 40 seeds, levels 1-46, mid and mastery bots, no skill, no special). Target is the pooled curve (mid about 33 % flat after rank 2, mastery about 73 % flat). "In band" is the per-rank mean within +-10 points.

| opponent | change (existing levers only) | mid ranks in band | mastery ranks in band |
|---|---|---|---|
| veteran | health 150 to 180, feint ramp | 10/10 | 7/10 |
| nightborn | health 188, parry +0.1, feint ramp, guard recovery 40 to 28 | 10/10 | 1/10 |
| plaguedoctor | new identity (below), health 195 | 9/10 | 1/10 |
| witch | health 173, feint ramp | 10/10 | 0/10 |
| goblin | health 156, aggression -0.1 | 10/10 | 0/10 |
| pitborn | health 114, pressure +0.15 | 9/10 | 1/10 |
| executioner | health 96, aggression +0.1, feint 0.1 | 9/10 | 3/10 |
| dwarf | health 128, pressure +0.2 | 9/10 | 8/10 |
| knight | health 80, aggression +0.15, pressure down | 7/10 | 0/10 |
| shieldmaiden | health 175, pressure +0.1 | 10/10 | 3/10 |

What the numbers say (details in the data file):
1. **Health is the lever.** Win rate moves in steps with health (dwarf 112/119/128 and knight 96/112 give identical curves), so it cannot be fine-tuned. Parry, dodge, reaction, accuracy, lapse, read and poise do not move a bot curve at all (they matter to a human, not measured here); aggression, pressure, feint and the Nightborn's guard recovery do.
2. **Mid is fitted, mastery is not.** A perfect-parry script beats the fast-blade bodies 90-100 % even when the mid bot is held to 33 %. The goblin is the extreme: at the health that fits mid, mastery is about 28 % (target 73).
3. **Ramp is partial.** Mastery now falls with level for veteran, executioner and weakly witch; it stays flat for nightborn, plaguedoctor and knight. A stronger aggression/feint ramp did not beat the milder feint ramp, so the milder one is proposed.
4. **Nightborn and Plague Doctor** today give byte-identical curves and behaviour counts. Proposed: Nightborn stays the committing parry duelist; Plague Doctor becomes the non-committing evasive pressure fighter (about 3-4 backsteps a fight against none, more lights, fights 15-25 % longer). The bots cannot see most of this: it needs a human playtest or the Combat battery before anyone trusts the feel.
5. **Tap-attack L1 gate:** 24/24 for all but the goblin (22/24, same as today); the executioner improves 21 to 24.
6. **No-strategy guard (no no-skill strategy over 80 %).** "Anywhere" cannot be literal: L1-5 is the novice ladder where the tap attack must win. At L6 and above it already fails today. The proposal clears veteran (5 rows to 1) and nightborn (1 to 0) and WORSENS pitborn (7 to 12), knight (5 to 12), dwarf (2 to 5), executioner (0 to 4), shieldmaiden (6 to 8), plaguedoctor (0 to 1), because the thinner body that lifts the mid bot is what lets light spam win.
7. **Rank 1 (L1-3)** overshoots for pitborn, executioner, dwarf and plaguedoctor (the novice blend sets it, not these levers); accepted, not fit. **The knight is unresolved** (its row is the Executioner's placeholder).

**Decisions for Lead/Strategy (not made here):** (a) exempt pitborn, knight, dwarf, executioner and shieldmaiden from the guard at L6-12, or find a lever the bots do not expose; (b) accept mid-fit-only (mastery stays 10-27 points above target) or ask for a separate mastery pass; (c) whether to build the Plague Doctor split at all before a human playtest. Not tested: weapon changes, equipped skills, the boss/class special (sim frozen, no special in these runs), other player weapons, seeds beyond 40. A mid-skill bot is "a player who answers swings with parries", not a median player.

## Part 2: real-player win % by opponent and rank: what the database holds, and the query

Checked 2026-10-01 against the hosted project "Frankendom Origins" (table list and row counts only; no rows were read):

| table | rows | what it can say |
|---|---|---|
| `loot_claims` | 6 | one row per signed-in ladder WIN (`opponent`, `verified`, the fight `record`); no losses |
| `awards` | 1 | the piece a verified win awarded, with `tier` = the rank (1-10) he was met at |
| `fight_records` | 11 | fights a player chose to SHARE, any outcome, with `opponent` and the gzipped `record` (level and outcome are inside it) |
| `daily_results` | 0 | the daily warden was removed (2026-09-29); empty |
| `perf_beacons` | 363 | one row per fight with frame timing; no opponent, level or outcome |
| `fighter_profiles`, `account_seed` | 2, 2 | marks and settings, no per-fight data |

**So a real win % cannot be computed from what the server stores today.** A win rate needs the attempts, and the server never sees a lost attempt: claims are wins only, shares are self-selected (a player shares what he is proud of), and the beacon carries no result. The scorecard (`fights`, `wins`, `losses` per opponent) is device-local and never synced. What can be read now is below; the fix is one small addition after Saturday.

### Query A, available now: verified ladder wins by opponent and rank (not a rate)

Read-only; run as the database owner (the client roles cannot read `loot_claims` of others). `a.tier` is the rank he was met at; it is null for a proven win that awarded no piece.

```sql
select c.opponent,
       a.tier                                  as rank_at_win,
       count(*)                                as verified_wins,
       count(distinct c.user_id)               as accounts
from public.loot_claims c
left join public.awards a on a.claim_id = c.id
where c.verified
group by 1, 2
order by 1, 2 nulls last;
```
It shows which opponents players are actually beating at which rank, and how many accounts. It cannot say how often they lose.

### Query B, available now: shared fights (any outcome), win % with its bias

`fight_records` carries the losses a player chose to share. The outcome and the level are inside the gzipped record, so this is an export plus a decode step. Export (database owner; the anon role can read only `id, opponent, record`):

```sql
select id, opponent, record, created_at from public.fight_records order by created_at;
```
then decode each `record` with `decodeRecord` from `src/record.ts` (it returns `opponent`, `weapon`, `level`, `outcome`, `ticks`) and group by opponent and rank, where rank = `least(10, (level - 1) / 5 + 1)` (R1 = levels 1-5 ... R9 = 41-45, R10 = 46) and a win is `outcome = 'killed'`:

```js
// node --experimental-strip-types decode-shared.mts < export.json   (export.json = the rows above as JSON)
import { decodeRecord } from './src/record.ts';
const rows = JSON.parse(await new Response(process.stdin as any).text());
const cell: Record<string, { n: number; w: number }> = {};
for (const r of rows) { try { const f = await decodeRecord(r.record); const k = `${f.opponent}|R${Math.min(10, Math.floor((f.level - 1) / 5) + 1)}`; (cell[k] ??= { n: 0, w: 0 }).n++; if (f.outcome === 'killed') cell[k].w++; } catch { /* a retired record version */ } }
console.table(Object.entries(cell).map(([k, v]) => ({ cell: k, n: v.n, wins: v.w, winPct: Math.round(100 * v.w / v.n) })));
```
(Field names checked against `src/record.ts`; not run on live rows.) Read it as a lower-bound sanity check only: the sample is self-selected, includes practice fights from a kill link's PLAY NOW (the record header has no mode), and holds 11 rows today.

### The missing piece: one row per fight with the result (post-beta, a few lines)

The game already sends one beacon per fight at its end (`src/main.ts sendBeacon`, once per fight, bots and replays excluded, rate-limited by `perf_beacons_rate`). Add four fields to that same insert and the question becomes a plain query. Proposed migration (after Saturday; not applied, not tested):

```sql
alter table public.perf_beacons
  add column opponent text check (opponent ~ '^[a-z]{1,32}$'),
  add column level    smallint check (level between 1 and 46),
  add column outcome  text check (outcome in ('killed','died','draw','abandoned')),
  add column mode     text check (mode in ('career','practice','sparring')),
  add column attempt  smallint check (attempt between 1 and 1000);   -- the scorecard's fights against him, so a first try can be told from a grind
grant insert (opponent, level, outcome, mode, attempt) on public.perf_beacons to anon, authenticated;
```
The client change is in `beaconPayload` (`src/perf-beacon.ts`): pass `opponent.id`, `match.level`, the fight's outcome, `match.mode`, and the scorecard's fight count. Nothing identifying is added (no user id), so the privacy shape stays what it is.

Privacy and retention: the row carries no user id, no account and no name, so no identifying data is added; opponent and level are game content, outcome/mode/attempt are counts. Suggested retention: delete rows older than 90 days (`delete from public.perf_beacons where created_at < now() - interval '90 days';`, run weekly; `created_at` is in `supabase/migrations/202609280001_perf_beacons.sql`).

**Dom-ask (post-beta, after Saturday):** "OK to add these five columns to the beacon (opponent, level, outcome, mode, attempt) right after Saturday, so the first week of real play collects win rates?"

### Query C, after that: win % by opponent and rank, with a confidence interval

```sql
with cell as (
  select opponent,
         least(10, (level - 1) / 5 + 1)              as rank,
         count(*)                                     as n,
         count(*) filter (where outcome = 'killed')   as w
  from public.perf_beacons
  where mode = 'career' and opponent is not null and level is not null and attempt = 1   -- first tries: a fresh player's difficulty; drop attempt = 1 for all tries
  group by 1, 2
)
select opponent, rank, n, w,
       round(100.0 * w / n)                                                                                         as win_pct,
       round(100 * ((w::numeric / n + 1.92 / n) - 1.96 * sqrt(w::numeric / n * (1 - w::numeric / n) / n + 0.9604 / (n * n))) / (1 + 3.84 / n)) as wilson_lo,
       round(100 * ((w::numeric / n + 1.92 / n) + 1.96 * sqrt(w::numeric / n * (1 - w::numeric / n) / n + 0.9604 / (n * n))) / (1 + 3.84 / n)) as wilson_hi
from cell
where n >= 20
order by opponent, rank;
```
The sim's per-opponent-rank numbers (the difficulty-curve section above) are the comparison: flag a cell where the real win % sits outside the sim's mid-skill band by more than the interval.
Caveats: only rendering, non-automated browsers send a beacon, guests included (a fight that never rendered frames sends none), and an abandoned page may send `abandoned` or nothing; check the `abandoned` share before trusting a cell.
