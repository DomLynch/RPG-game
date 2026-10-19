# Per-layer spawns: design note (docs only, no code)

Backend, 2026-10-19. Lead's brief: you lead, World co-writes the zone/spawn-row side. Dom reads this before any code. Builds on `one-shard.md` §5 (layers) and the launch load tests (receipts 1-7 on #3282). Every number below is either a measured receipt (named) or arithmetic from a stated input; guesses are marked *est.*

## Summary (Lead's two lines)

1. **Production presence `maxLayers` is 8, so one presence process is capped at 640 players (80 per layer) today. That is the real ceiling now, lower than the 1,000-player mark.**
2. **The 30 kills/h per hunter target in section 4 is an ASSUMPTION for Dom to set**, as is the 25% hunting share; the tables scale linearly with both.

World writes the zone/spawn-row section after Z1b ships. This PR stays docs-only; no code until Dom has read it.

## 0. The problem in four numbers

1. **Zone 1 has 24 spawns, respawn 75-300 s.** If every spawn were killed the instant it respawned, the whole zone yields **0.148 kills/s = 8.9 a minute = 533 an hour**, however many players are online (24 spawns / 0.148 per second = a 162 s average cycle). Real yield is lower (walking, 13.5 s to 20 min fights).
2. **Today every player shares that one pool.** At 100 players with a quarter hunting: 25 hunters, 21 kills/h each. At 1,000 players: 250 hunters, **2.1 kills/h each**. Supply does not grow with the crowd, so the crowd starves.
3. **Presence already splits the crowd into layers** (soft 80, hard 100 players, fill-first, closed after 300 s empty; `origins/presence/interest.ts`), but **spawn state ignores layers**: `origins_spawns` is keyed by the creature id alone, so all layers fight over the same 24 rows.
4. **The writer replays every kill_report that holds an open token before the database picks the winner**: 12 / 22 / 45 replays per paid kill at 200 / 400 / 800 arrivals/s (receipt 6), the 1-worker queue (16) overflowed at 800/s with **100 of 1,091 replays 'busy' (9%)**.

Two layer-sized facts the plan must carry:

- The production presence rule `maxLayers` is **8**, so one process holds at most **640 players at the soft cap (800 at the hard cap)**, below the 1,000-player mark where Lead wants the second process ready. Receipt 2 hit exactly this: 8 full layers = 800 players, the other 200 refused. Raising it is a rule row (`presence-rules-defs.json`), not code; one process measured fine to about 1,500 (receipt 5), which is 19 layers at 80.
- Layer ids are **per process and not durable**: they count up from 1 after every presence restart. Spawn state is only timers, so this is harmless (section 1d), but a spawn row must never be read as "belongs to those players".

## 1. Donors: what we take

- **AzerothCore / TrinityCore (WoW server):** creature respawn state lives in `creature_respawn` and is cleared per instance; an instance is a separate copy of a map with its own respawn clocks, and its rows are dropped when the instance resets. **We take: the key shape (instance id beside the spawn id) and drop-on-close.** Our layer is that instance id.
- **EQEmu (EverQuest):** `respawn_times (id, start, duration, instance_id)` is the same idea: the spawn point's timer is per instance. Our `origins_spawns` is already modelled on EQ's spawn2 (migration `202610080014`); this adds the instance column EQ always had.
- **WoW Classic layering (the player-facing feature):** game assigns the copy on join, a party invite pulls you onto the inviter's copy, copies are invisible to players, and the abuse that followed was **hopping between copies to farm rare spawns**. **We take: assign on join + join-friend only (already built in presence, Dom's ruling in `one-shard.md` §5: no player-chosen layer). We do not take: a hop that is free and repeatable.** Section 3b closes it with a rule that does not depend on blocking the hop.
- Not taken: EQEmu/AC full dungeon-instance lifecycles (instance owners, lockouts, timers to expire an instance). Our layers are open-world copies, not owned instances.

Read on the VPS (`/mnt/frankendom-donors`, 2026-10-19): EQEmu `utils/sql/svn/612_instance_changes.sql` adds `instance_id` to `respawn_times` and changes its primary key to `(id, instance_id)`, the same migration shape as section 2; azerothcore `InstanceSaveMgr.cpp:277` deletes `creature_respawn` rows for instances that no longer exist, the same as the janitor in section 2. The WoW Classic layering account is from public knowledge, not from a donor repo.

## 2. Schema (a)

**The layer is a column, never part of the creature id.** Creature ids (`wolves-1`, `z2:...`) stay exactly as they are, so the 96-character key check, `zoneOfKey`, the zone key rules and above all **a recorded kill's binding to its spawn id** (receipt 7: a record replayed under another id reads 'no kill') are untouched. The replay verifier needs no layer at all.

```
origins_spawns          PK (layer, instance)   layer int not null default 1
origins_spawn_engages   + layer int not null default 1; the FK to origins_spawns(instance) is replaced by a plain (layer, instance) pair
```

- **Migration from today's single row:** add `layer` with default 1; every existing row becomes layer 1 (presence's first layer, where today's players already are). Engages and the beta ledger keep their rows (the receipt read by token, `origins_spawn_receipt`, keeps working unchanged).
- **Rows are still created lazily on first engage** (today's behaviour), so **a new layer needs no setup: no row means all 24 spawns alive, generation 0.** A fresh layer starts full, which is what a player expects of a new copy.
- **Expand then contract, so the writer and database can deploy in either order:** the migration adds new functions taking `p_layer` (`origins_spawn_state/engage/engage_get/touch/kill` v2) and leaves today's functions in place, delegating to layer 1. The writer switches to v2 in the PR that carries it; a later migration drops v1. Class: **not purely additive** (it changes a primary key and an FK), so it needs the Auditor's apply-ready review and a rehearsal on a copy of prod data; the rollback file restores the single-column key after deleting layers > 1.
- **Cleanup when a layer closes:** presence closes a layer after 300 s empty. The spawn rows of a closed layer are deleted by a janitor run by the writer once a minute: `delete from origins_spawns where layer = any($closed)`. Deleting is safe because the state is only "dead until T"; a new layer reusing that id starts all-alive, the same as any fresh layer. Open engages cannot exist for a layer empty 300 s (token ttl 120 s). The janitor learns the live layer ids from presence (`GET /internal/layers`, a small read-only endpoint, one more route on the existing internal key) so it never deletes a layer in use. If presence is unreachable it deletes nothing. Row count is bounded: 24 spawns x layers (19 at 1,500 players = 456 rows).
- **Row-level numbers:** 24 rows per layer; the hot path (`origins_spawn_state`, one read of 24 keys) was 1.2 ms p50 and stayed single digits to 400 arrivals/s (receipt 6); the primary key still resolves each row by index.

## 3. Verifier keying (b)

### 3a. How kill_report and the replay carry the layer

- **The body never names a layer.** Like reward and level, the layer is the server's word (the instruction in `world-spawns.ts`: "nothing in a body names a reward, a level, a seed or an account").
- **engage:** the writer asks presence where the account stands (it already does this in `kill_report` via `reachOf`; this is the same loopback read, about one more per engage). `where.layer` is stored on the token (`origins_spawn_engages.layer`). If presence cannot be reached, the engage falls back to **layer 1** (today's single shared pool): a presence outage degrades to today's behaviour, it does not stop kills.
- **spawn_state:** reads the caller's layer the same way and returns that layer's 24 rows. This is the one place the page learns anything about layers, and it learns only alive/dead for its own copy.
- **kill_report:** the layer is read from the token, not from the request. If presence says the account is now on a different layer, the kill is refused `moved` (409, writes nothing, the token stays open until it expires) so a hop mid-fight cannot carry a fight across copies. If presence cannot answer, the kill pays on the token's own layer (unchecked, as reach already is).
- **The replay** takes `spawn: {spec}` and the record; it needs nothing new. Its verdict logging gains the layer in the log line for the soak.

### 3b. Anti-abuse: layer hopping to farm

A hopper's gain is dodging scarcity: kill `wolves-1` in layer 3, move, kill it again in layer 5. Presence has no in-session hop (the `?friend=` join is at connect time; the "about 30 s cooldown" in `one-shard.md` §5 is a spec line, not built), so a hop is a reconnect, rate-limited to 30 joins a minute per address. That friction is not a defence. The defence is a **rule on the kill, independent of layers:**

> **One paid kill per account per spawn id per respawn window, across all layers.** `origins_spawn_kill` refuses (`cooldown`, 422, writes nothing) when the account already has `result = 'killed'` on the same `instance` (any layer) inside `p_respawn_s`.

Why it works: it is exactly the rule a single shared copy gave every player implicitly (the creature was dead for everyone), restated per account. Cost: an index `origins_spawn_engages (account, instance, used_at desc) where result = 'killed'`, one indexed read inside the existing kill transaction. The existing per-account caps (6 a minute, 120 an hour, migration defaults; I have not re-read the live row for this note) stay the hard ceiling on minting per account, so **layers raise a player's reachable supply, never his ceiling.**

Also: the token binds the layer (3a), so there is no way to engage in one copy and report in another; and a fresh account added to a layer has nothing to farm that an older account does not.

### 3c. Winner-first replay (the 12 / 22 / 45 problem)

Today: `kill_report` queues the replay (`void run()`), then `origins_spawn_kill` decides the winner. Only one of N reports on a creature wins; the other N-1 already burned a replay (a refused replay costs about as much CPU as an accepted one: 55 ms against 44 ms). That is the abuse surface: open many tokens on one creature, report them all.

**Fix: split the kill into claim and settle.**

1. `origins_spawn_claim(account, token, layer...)`: one short transaction takes the spawn's row lock, checks alive + generation (+ the hit/time/cap/cooldown refusals the database already owns) and writes a **claim** on the spawn (`claimed_by token, claim_expires = now() + 5 s`, longer than a full queue wait (16 jobs x about 18 ms) plus the 3 s job timeout). The loser answers `dead` here **before any replay is queued**.
2. The writer replays **only the claim holder's record**.
3. `origins_spawn_settle(token, verdict)`: on success it does today's kill (mark dead, respawn clock, pay, ledger) in one transaction. On a failed replay it **releases the claim** (the spawn stays alive for everyone else; the cheater gets the 'unverified' tally and, under the strict flip, no reward). An expired claim is released by the next claim attempt (no timer job).
4. **Per-account cap on queued replays: 2** (max open engages is 4 today). A fifth open token cannot become five replays.

Numbers beside the 9% busy figure: with the claim step, replays per paid kill is **1.00** by construction (receipt 7 measured 1.00 / 1.04 / 2.03 at 20 / 50 / 100 clone cycles per second, 2.03 because the burst queued behind the 1-worker pool), against 12 / 22 / 45 on one shared creature (receipt 6). Receipt 6's 100 busy verdicts at 800 arrivals/s were replays that should never have been queued: at 24 paid kills the pool sees 24 jobs, not 1,091.

**The claim also fits the strict flip.** Today the kill pays now and the replay is advisory (flag off). Under strict (pay only if verified) the order must be replay, then pay; winner-first without a claim cannot do that (two reports would both replay, then race). With the claim the order is claim, replay, settle, so strict is a flag on step 3, not a redesign. Lead's sizing rule (workers = kills/s x replay seconds, with 2x margin, at the real fight mix) is computed in section 4c.

## 4. Loot per layer: the economy (c)

### 4a. Supply per layer and per player

One layer (24 spawns, ceiling **533 kills/h**, 8.9/min):

| hunting share of a full layer (80 players) | hunters | kills/h each, at the ceiling |
|---|---|---|
| 100% | 80 | 6.7 |
| 50% | 40 | 13.3 |
| 25% | 20 | 26.7 |
| 10% | 8 | 66.6 (the 120/h account cap is not reached) |

A target of **30 kills/h per hunter** (one every 2 minutes, *est.*, Dom/Strategy to set) is served by 533 / 30 = **17.8 continuous hunters per layer**, a quarter of a full 80-player layer.

### 4b. Shared today against per-layer, by crowd size (25% hunting)

| concurrent | layers (fill-first, soft 80) | hunters | shared pool: kills/h each | per-layer: total kills/h | per-layer: kills/h each |
|---|---|---|---|---|---|
| 100 | 2 (80 + 20) | 25 | 21.3 | 1,066 | 21.3 (full layer 26.7, partial 106) |
| 300 | 4 | 75 | 7.1 | 2,132 | 28.4 |
| 1,000 | 13 | 250 | 2.1 | 6,929 | 27.7 |
| 1,500 | 19 | 375 | 1.4 | 10,127 | 27.0 |

(All "per-layer" rows are ceilings: the zone's 533/h per layer assumes every spawn is killed on respawn.)

### 4c. Effect on loot supply

- **Total minting scales with layers, i.e. with concurrent players:** 13x the 533/h at 1,000 players. **Per player it is flat** (about 27 kills/h at a quarter hunting once layers are full), where today it falls 10x between 100 and 1,000. Loot per kill is unchanged (`mobBatch` and the loot tables are not touched by this note).
- **The hard bound on minting is unchanged by layers:** `kills_per_hour` 120 and `kills_per_min` 6 per account (database), and the new one-paid-kill-per-spawn-per-window rule. At 1,000 accounts that is at most 120,000 kills/h, against a layer ceiling of 6,929/h: the economy ceiling is the layer supply, not the cap.
- **The partial layer is rich.** Fill-first leaves the newest layer short of players, and its 24 spawns serve few hunters: the 20-player layer in the 100-player row gives 106 kills/h each, 4x a full layer. That is today's night-time situation too (a lone player today owns all 533/h), not a new inflation vector, but it is the number to watch; a later knob is occupancy-scaled respawn (respawn x max(1, 80 / players present)). **Not in v1**: v1 ships the same respawn rows per layer, and a kill-rate readout per layer (ledger `at` grouped by layer) decides whether the knob is needed.
- **Replay capacity at that supply** (Lead's rule, kills/s x replay seconds x 2): 13 layers = 6,929/h = **1.9 kills/s**. At receipt 4's 0.022 ms per tick, a 30 s fight (1,800 ticks) replays in about 40 ms: 1.9 x 0.04 x 2 = **0.15 worker**, so one worker holds with room. **The unmeasured tail is long fights:** a 20-minute fight is 72,000 ticks, about **1.6 s per replay** at the same rate, close to the 3 s job timeout; if every kill were that long, 1.9 x 1.6 x 2 = **6.1 workers**. The real fight-length mix is the missing input; it comes from the soak's `world record verified (N ticks)` log lines, and the worker count is set from it before any strict flip.

## 5. Sizing and opening/closing a layer (d)

- **Open:** presence opens a layer when every existing one is at the soft cap of 80 (fill-first), up to `maxLayers`. Spawn rows appear on first engage (section 2). Nothing in the database is created ahead of players.
- **Close:** presence closes a layer after 300 s with no players; the writer's janitor then deletes its spawn rows (section 2).
- **Size of a layer** is set by presence's render/bandwidth reasoning (`one-shard.md` §4), not by the spawn economy: 80 soft / 100 hard. The economy knob is **how many spawns a layer holds** (a data row per zone, World's side) and their respawn; per layer that is the 533/h ceiling above.
- **Process ceiling:** about **1,500 players per presence process** (tick p99 62 ms of 100, 75% of a core), hard ceiling near 2,000 (p99 84 ms) and over budget at 3,000 (receipts 2, 3, 5). At 80 per layer: 18.75 layers per process at 1,500. **Required rule change: `maxLayers` from 8 to 20** for the first process (it now stops at 640). The Lead's second-process trigger (sharded by layer group, ready before 1,000 concurrent) needs **globally unique layer ids across processes**: process k allocates ids from k x 1000, so (layer) stays one integer in the database and a layer is never confused with another process's. That is a presence change in the sharding PR, not this one.
- **Where the writer asks:** with one process, one URL. Once sharded, `where` and `layers` go through a router by layer group; the database never learns about processes.

## 6. Build order (after Dom's yes)

1. **Winner-first claim/settle + per-account replay cap**, on the current single layer (no schema change to the key). It stands alone: it fixes the abuse surface and the 9% busy at today's single copy, and is the order the strict flip needs. Migration: one column + two functions, additive.
2. **Layer column + v2 functions + janitor + `/internal/layers`**, behind a flag (`ORIGINS_SPAWN_LAYERS=0` keeps layer 1 for everyone, exactly today's behaviour). Rehearsed on a prod-shaped copy.
3. **`maxLayers` 8 to 20**, and a per-layer kill-rate readout.
4. Second presence process and layer-id ranges when concurrency nears 1,000.
5. Occupancy-scaled respawn only if the readout shows the partial layer minting out of line.

## 7. What I am NOT claiming

- The 533/h and 0.148/s are ceilings from the respawn rows, not measured kill rates; the live kill rate per layer does not exist yet.
- The hunting share (25%) and the 30 kills/h target are assumptions for the tables; change them and the rows scale linearly.
- Replay cost per tick (0.022 ms) is from receipt 4 on a busy HF host, an upper bound, at short fights; long fights and the real mix are unmeasured (section 4c).
- Layer-hopping behaviour of real players is unknown; the cross-layer cooldown (3b) is designed to hold whatever it is, but it has not been tried against a live hop.
- The kill caps are the migration defaults; the live `origins_world_config` row was not re-read for this note.
- The WoW layering abuse history (section 1) is not from a donor repo.
