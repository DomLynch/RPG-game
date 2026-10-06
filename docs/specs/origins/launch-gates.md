# Origins launch gates

(Strategy, 2026-10-07.) This file is the one home for every "before X opens" gate in Origins.

A **gate** is a condition that must hold before a surface opens to players. Nothing in a section opens until every gate in that section
is closed with its proof. A gate closes only when the proof is recorded in its row (a receipt: a sha, a command's output, a PR, or a
ruling with its date). Add new gates here, not in other docs; other docs link here.

Each row: ID | gate | owner (the lane that closes it) | proof that closes it | status (open or closed, with the receipt).

---

## Player trade

Source: [trading.md](trading.md) §6, "Before player trade opens".

| ID | Gate | Owner | Proof that closes it | Status |
|---|---|---|---|---|
| G1 | Migration 0005 (`202610070005_origins_trade_limits.sql`, draft #1522) is applied: every settle writes the `trade` history entry, and so the hop count, in the database | Backend | The applied migration's prod version, read back, plus `scripts/origins-trade-limits-check.mjs` green on the applied sha | open |
| G2 | The per-item cooldown is checked in the database (0005's cooldown guard), not only in the writer | Backend | A cooling piece refused at escrow entry by the DB guard, on the applied sha | open |
| G3 | The tradeable scope ("rare and up, or a Pit piece", trading.md D5) is in the contract or DB check, with a test. The writer applies it alone today | Expansion | A merged PR with the check and its test | open: the DB half is in 0005 (#1522 @fe7773b1, rare/relic ids from config or provenance arena-award/legacy-unlock; a missing row cools every piece), awaiting the Auditor; the contract half (Expansion) still to do |
| G4 | Dom confirms the per-account rate caps (trading.md §5.5: config, a safety net, 10 settled trades a day to start) or says to remove them. On Dom's morning list via Strategy | Dom | Dom's answer recorded with its date | open |
| G5 | 0008 (`202610070008_origins_trade_reversal.sql`, draft #1522) is class 2: it alters the live `origins_events` kind check (adds `trade-reversal`, `trade-hold`, `metal`) and adds `origins_reverse_trade`. It applies only on Dom's yes at the exact sha. Trade reversals (trading.md §5.7) and auto-hold events (§5.11) cannot run before it | Dom | Dom's yes naming the sha, then the applied prod version | open |
| G6 | `trade_cooldown_scope.items` (in 0005) is generated from the real rare/relic gear catalog and drift-guarded against it, before trade opens (Backend, 2026-10-07) | Backend | The generated list merged with its drift-guard check green, on the applied sha | open |

## Writer route

| ID | Gate | Owner | Proof that closes it | Status |
|---|---|---|---|---|
| W1 | #1463 (`ops/install-origins-writer.sh`, nginx route and limits) is installed by Deploy | Deploy | The install run's output and the route answering on the VPS | open |
| W2 | The `frankendom_origins` role password is set by Dom: Dom runs `bash /root/origins-writer-setup.sh` on the VPS and pastes the printed `alter role` line into the Supabase SQL editor. A lane never sets it | Dom | Dom says it is done; the writer connects as the role | open |
| W3 | `/etc/frankendom/origins-writer.env` is present with mode 0600 | Dom | `stat` of the file on the VPS showing 600 | open |
| W4 | The flag is on for Dom only first | Deploy | The allowlist read back with Dom's account as the only row | open |

## Flag GO

| ID | Gate | Owner | Proof that closes it | Status |
|---|---|---|---|---|
| F1 | Strategy and Lead give a joint GO for the hidden `/origins` route: signed-in only, flag OFF for the public | Strategy, Lead | The GO recorded in both state docs with its date and sha | open |
| F2 | Dom gives the GO for anyone beyond Dom | Dom | Dom's GO recorded with its date | open |

## One-shard / chat

Source: [one-shard.md](one-shard.md). It names Backend as owner of the chat list (§6a) and gives no owner for the measurements, so
Backend (its author) holds them until Lead assigns them.

| ID | Gate | Owner | Proof that closes it | Status |
|---|---|---|---|---|
| S1 | The 100-bot synthetic load test on the VPS replaces every *est.* capacity number before the layer cap (80 soft, 100 hard) and the add-a-host trigger are trusted (one-shard.md §4, §5, §7) | Backend | The test's report: CPU, packets/s and bytes/s per layer | open |
| S2 | 40 animated characters hold 30 fps on the slowest test phone before the 40-entity cap is fixed (one-shard.md §4 item 1, §7) | Backend | The render test's result on the named phone | open |
| S3 | A test drives bots across cell borders and checks each pair that should see each other does, in both directions (one-shard.md §6, "Interest bugs") | Backend | The test green in the first build | open |
| S4 | Chat is protected from day one: the server-side filter, clear hits blocked before display, auto-report, mute, block and a report button, no links, the rate limit (one-shard.md §6a) | Backend | Each piece live behind the flag, with its tests | open |

## Patrons in the arena

Source: [patron-perks-sim.md](patron-perks-sim.md) and [living-world.md](living-world.md) §10. Until these close, a clan is identity
only in the arena (living-world.md, phasing).

| ID | Gate | Owner | Proof that closes it | Status |
|---|---|---|---|---|
| P1 | No `src/` work on the patron hook starts until fatigue (#1483) and the 50 levels (#1470/#1475) are live (patron-perks-sim.md, top) | Combat | Both live, with the release receipts | **closed** (Strategy, 2026-10-07): 50 levels live in `a928c586` (#1470 `5bdc87a2`, #1475 `6cbda3c0`), fatigue live in `5ef33243` (#1483 `e403f3f5`); merge-base checked |
| P2 | Combat's patron hook ships with the `RECORD_VERSION` bump to 28 and its proofs: no-patron fights byte-identical, the #1402 fingerprint 0 changed cells (patron-perks-sim.md, "Proof that no-patron fights are unchanged") | Combat | The merged PR with the proofs green | open |
| P3 | The verifier host carries the v28 decoder in a release before any client can write v28 (patron-perks-sim.md, "Release order") | Deploy | The verifier release receipt, dated before the client release | open |
| P4 | Every template is measured on the battery before it ships; the ladder anchors stay in their bands with the worst-case template (patron-perks-sim.md, "Balance gate") | Combat | The battery report | open |
| P5 | Combat runs the win-rate-by-patron check before and after release, with its battery and ladder sweeps; a template drifting beyond 1 percentage point is retuned (living-world.md §10, "Checked"; Combat owns it as no Stats lane runs, Strategy, 2026-10-07) | Combat | The check's report before release | open |
