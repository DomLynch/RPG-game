# Post-beta tuning proposal and the real-player data question (WORK IN PROGRESS, 2026-10-01)

Stats lane, for Strategy. DRAFT, not for merge as is: part 1 (per-opponent tuning knobs, sim-checked) is still being produced by a background calibration agent (its output goes to `/private/tmp/claude-501/scratch/tuning/proposal.md` and `proposal.json` on the Mac that ran it); part 2 below is written. Ask from Strategy 2026-10-01: pull every opponent inside about +-10 points of the pooled mid-skill curve at each rank, make the non-rampers (nightborn, plaguedoctor, witch, veteran) ramp with level, give Nightborn and Plague Doctor distinct behaviour (they are sim-identical), sim-checked; plus a read-only SQL for real-player win % by opponent and rank; plus the beacon migration sketch with a Dom-ask. Docs-only; the sim stays frozen for the beta (no tuning before Saturday 2026-10-03).

## Part 1: per-opponent tuning knobs

(pending the calibration agent; see the state doc's Open list)

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
