# Origins — S1: the one-shard bot load test (plan)

Backend lane, 2026-10-08. **Status: plan, docs only, DRAFT.** Nothing here runs in the game; it says what the load test must measure, how, and what gates launch.
Launch gate **S1** (docs/specs/origins/launch-gates.md, #1544): *the 100-bot synthetic load test on the VPS replaces every est. capacity number before the layer cap (80 soft, 100 hard)
and the add-a-host trigger are trusted* (one-shard.md §4, §5, §7). Owner: Backend. Proof that closes it: the test's report (CPU, packets/s, bytes/s per layer), attached to the gate row.

## 1. What exists

- The presence service: `origins/presence/` (#1510, flag OFF). It runs standalone, needs no database and no Supabase.
- The test: `scripts/presence-loadtest.mjs`. It starts the real service as a child process (test auth, loopback only) and connects N bots over real WebSockets that upload at 10 Hz and
  wander a square (`--crowd-m`). It reports per layer: players, packets/s, KB/s down (total and per client), upload messages/s, entities per packet, server CPU as a percent of one core,
  RSS, and the longest tick.
  `node scripts/presence-loadtest.mjs [--bots=100] [--seconds=30] [--warmup=5] [--crowd-m=60] [--layer-cap=100] [--max-layers=8]`.
- The numbers from #1510's first runs (one shared VPS, so every one is still an *estimate* for S1's purposes):

| Run | Result |
|---|---|
| 100 bots, one layer | 8.6% of one core |
| 1,000 players | 60% of one core, longest tick 82 ms of the 100 ms budget, 21 Mbit/s out |

  From those the note's rules of thumb follow: about **1,000 players per host**, and an **add-a-host trigger at about 800** (80% of the measured cap, one-shard.md §5).
  They were measured with the service alone on the box (`--crowd-m=60`, loopback), not beside the writer, verifier and relay, and not through nginx or TLS.

## 2. What S1 must settle (and what it does not)

S1 settles the **server side** numbers: per-layer CPU, memory, tick time, packets/s and bytes/s, and from them the host cap and the add-a-host trigger. It does **not** settle:

- the 40-animated-character render budget on the slowest phone (**S2**);
- interest correctness across cell borders (**S3**);
- chat load and filtering (**S4**; chat adds traffic that S1 must leave headroom for, see §5);
- real-internet latency and loss (the bots are on loopback). Latency is a separate far-test.

## 3. The runs (all on the VPS, never the Mac, never against production Supabase; `nice`d, one at a time, outside a deploy)

| # | Command shape | Question it answers |
|---|---|---|
| R1 | `--bots=100 --crowd-m=60 --layer-cap=100 --seconds=300` | Worst crowd (everyone sees everyone), one full layer, five minutes: repeats the 8.6% figure and checks it does not drift (memory growth, tick creep). |
| R2 | same with `--crowd-m=300` | The spread case: how far below R1 a normal town sits. |
| R3 | `--bots=80 --layer-cap=80`, then `--bots=100 --layer-cap=100` | The soft and hard caps themselves. |
| R4 | `--bots=300` with the default caps (80/100) | The **beta target**: 3 layers, about 300 concurrent. Reports per layer and the host total. Checks that the layer split at 80 behaves (no layer over the hard cap, new joins land on the next layer). |
| R5 | `--bots=500`, `--bots=800`, `--bots=1000` (default caps, `--max-layers` raised to fit) | The host ceiling and the 800 trigger. The first bot count at which a limit in §4 trips is the measured cap; 80% of it is the add-a-host trigger. |
| R6 | R4 with the writer, verifier and duel relay doing realistic work beside it (their own load scripts, or their normal idle plus one duel) | The cost of sharing the box. This is the number the 300-concurrent beta claim rests on. |
| R7 | R4 through nginx + TLS on the real route, bots on a second VPS or the Mac over the internet | What the proxy and real sockets add (connection count, TLS CPU, bytes out). Optional for the gate; required before the cap is quoted to Dom as a hosting number. |

Every run records the commit sha, node version, box load average before it starts, and the full JSON the script prints. A run with box load above 2 at the start is repeated.

## 4. Pass criteria (proposed; Strategy rules the thresholds)

A host cap is the highest bot count at which **all** hold for the whole measuring window:

1. Server CPU at most **70% of one core** (a spike is allowed to 85%).
2. Longest tick at most **50 ms** of the 100 ms budget, and no tick over 90 ms.
3. RSS grows by less than 10% between the end of warm-up and the end of the run (no leak).
4. Every bot stays connected and receives a packet every tick it should (the script's `connected` equals `bots`).
5. Down bandwidth per host stays inside the VPS plan's included traffic at full load (one-shard.md §4 puts a full layer at about 930 GB a month; the plan's allowance is checked against the measured figure).

The numbers in #1510's first runs already say criterion 2 trips before criterion 1 near 1,000 (tick 82 ms at 60% CPU), so the cap is more likely set by tick time than by CPU.

## 5. What gates launch

- **Beta (about 300 concurrent, 3 layers, one VPS): R1, R3, R4 and R6 must pass the §4 criteria**, with a documented margin: the measured host cap is at least **2x** the beta target. R6 is the one that matters: a number measured with the service alone does not count for a shared box.
- **The layer caps 80 soft / 100 hard stay as ruled** unless R3 shows a layer already breaches §4 at 80 or 100; then the caps are lowered, not the criteria.
- **The add-a-host trigger is set from R5 at 80% of the measured cap**, not from the 800 above, and is written into one-shard.md §5 and the runbook, with the metric to watch (CPU percent and longest tick).
- **Chat headroom:** S4's chat adds down traffic per message. Until S4 is built, S1 reserves **20%** of the cap for it; S4's own test re-checks that reserve.
- R2, R5 above the cap, and R7 are reported but do not block beta. R7 blocks quoting a hosting cost.
- Until S1's report is attached, every capacity figure in one-shard.md stays marked *est.* and the flag stays OFF for anyone outside the team.

## 6. Output

A report file `docs/state/s1-load-test-report.md` (or the gate row's link): the table of runs R1 to R7 with sha, box load, the JSON, the measured cap, the 80% trigger, which criterion set it, and the margin against 300. The one-shard.md *est.* figures are replaced in the same PR; this plan file stays as the method.

## 7. Open points for Strategy / Lead

- The thresholds in §4 (70% CPU, 50 ms tick, 2x margin, 20% chat reserve) are Backend's proposal, not a ruling.
- The bots are simple wanderers. A town crowd that clumps at a market square is what `--crowd-m=60` approximates; if Strategy expects hot spots, R2 gains a third variant with a moving cluster.
- R6 needs the writer and relay load recipes from their owners; until those exist R6 can only be "their idle plus one duel", which understates a busy evening.
