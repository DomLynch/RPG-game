# Per-layer spawns: design note (docs only, no code)

Backend, 2026-10-19. Lead's brief: you lead, World co-writes the zone/spawn-row side. Dom reads this before any code. Builds on `one-shard.md` §5 (layers) and the launch load tests (receipts 1-7 on #3282). Every number below is either a measured receipt (named) or arithmetic from a stated input; guesses are marked *est.*

## Summary (Lead's two lines, and Dom's kill-credit ruling)

**Dom's ruling, 2026-10-19:** kill credit (XP, loot, quest count) is split **in proportion to damage dealt**: no first-hit claim, no last-hit, no most-damage-takes-all. Section 3c is now a damage-share settle (replacing the earlier winner-first claim/settle), built first and on its own; thresholds, tag timeout and group pooling are rows. One reading for Strategy to confirm: quest count is given in full to every contributor above the minimum share (a count is not used up by sharing).

1. **Production presence `maxLayers` is 8, so one presence process is capped at 640 players (80 per layer) today. That is the real ceiling now, lower than the 1,000-player mark.**
2. **The 30 kills/h per hunter target in section 4 is an ASSUMPTION for Dom to set**, as is the 25% hunting share; the tables scale linearly with both.

World writes the zone/spawn-row section after Z1b ships. This PR stays docs-only; no code until Dom has read it.

## 0. The problem in four numbers

1. **Zone 1 has 24 spawns, respawn 75-300 s.** If every spawn were killed the instant it respawned, the whole zone yields **0.148 kills/s = 8.9 a minute = 533 an hour**, however many players are online (24 spawns / 0.148 per second = a 162 s average cycle). Real yield is lower (walking, 13.5 s to 20 min fights).
2. **Today every player shares that one pool.** At 100 players with a quarter hunting: 25 hunters, 21 kills/h each. At 1,000 players: 250 hunters, **2.1 kills/h each**. Supply does not grow with the crowd, so the crowd starves.
3. **Presence already splits the crowd into layers** (soft 80, hard 100 players, fill-first, closed after 300 s empty; `origins/presence/interest.ts`), but **spawn state ignores layers**: `origins_spawns` is keyed by the creature id alone, so all layers fight over the same 24 rows.
4. **The writer replays every kill_report that holds an open token before the database picks the winner** (and the first report takes the whole kill, which Dom has ruled out: credit is split by damage, section 3c): 12 / 22 / 45 replays per paid kill at 200 / 400 / 800 arrivals/s (receipt 6), the 1-worker queue (16) overflowed at 800/s with **100 of 1,091 replays 'busy' (9%)**.

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

### 3c. Damage-share settle (replaces winner-first; the 12 / 22 / 45 problem)

**Dom's ruling (2026-10-19, via Strategy):** credit for a kill (XP, loot, quest count) is split in proportion to damage dealt. No first-hit claim, no last-hit, no most-damage-takes-all: nobody steals a kill by landing the last blow. Thresholds, tag timeout and group pooling are **rows**, not code constants (the rows are listed below with proposed values, all *est.*).

**What today does.** `kill_report` queues the replay (`void run()`), then `origins_spawn_kill` makes the first valid report the only winner; the other N-1 already burned a replay (a refused replay costs about as much CPU as an accepted one: 55 ms against 44 ms) and get `dead`. That is both the unfairness Dom ruled out and the abuse surface (12 / 22 / 45 replays per paid kill).

**A fact the design must start from.** The world fight is played on each player's own page (`world-spawns.ts` header); the server holds the creature's life (alive / respawn clock), **not its health**. A player's damage therefore exists only in that player's own record, which the server replays. So "damage dealt" = the damage the hero dealt to the creature in the account's **replayed, verified record**, capped at the creature's health. The replay result must start returning it (`Replayed` today returns kills and ticks, not damage): a verifier change, small, in the code PR, not here.

**The settle (one settlement per spawn per generation):**

1. **Tag.** An engage token on (layer, instance, generation) is a *contributor* while it is open and touched within `tagTimeoutS` (est. 30 s; the token itself still lives `engage_ttl_s`, 120 s). Nothing is decided at engage.
2. **First report opens the settlement.** The first kill_report on a generation marks the spawn dead (respawn clock starts now, so no second kill of it) and reads its open sibling contributors. **No siblings: settle at once, share 100%, the same latency as today** (the solo case stays instant). **Siblings: hold** until each has reported or dropped out (token expired or untouched past `tagTimeoutS`), at most `settleWindowS` (est. 20 s). A sibling's kill_report during the hold **joins** the settlement (it does not answer `dead`).
3. **Replay every admitted contribution** (not only one): at most `maxContributors` per settlement (est. 8); a report beyond it answers `full` **before any replay is queued**; per-account cap on queued replays 2 (max open engages is 4 today). Replays per settled kill therefore equal the contributors, not the number of bogus tokens: bounded at 8 against the 12 / 22 / 45 measured, and **1.00 for a solo kill** (receipt 7: 1.00 / 1.04 / 2.03 at 20 / 50 / 100 clone cycles a second, the 2.03 being a burst queued behind the 1-worker pool).
4. **Share** of contributor i = min(d_i, HP) / sum over verified contributors of min(d_j, HP), where d is the verified damage. A contributor whose replay fails (`strict` row on) is dropped and its damage leaves the denominator. A share under `minShare` (est. 10%) earns nothing (a one-hit tag is not a contribution); the dropped share is re-spread over the rest.
5. **Pay, in one transaction** (`origins_spawn_settle`, idempotent: the first contributor who finds the window closed settles for all; every contributor's answer carries its own receipt, which the V5 receipt read already serves if an answer is lost):
   - **CP / XP and bronze** (divisible): each contributor gets share x the amount the kill rolls. Rounding: floors, the remainder to the largest share (ties: earliest tag); the sum is exactly the rolled amount.
   - **Loot** (items are indivisible): the kill rolls its drops **once** (server seed, as today); each drop goes to one contributor by a weighted draw on the shares from the same seed. Expected value is proportional to damage; no one is paid twice for one item. Row `lootSplit`: `weighted` (proposed) or `top-share` (rejected by Dom's ruling: most-damage-takes-all).
   - **Quest count:** a count is not consumed by being shared, so every contributor above `minShare` gets the +1 (row `questSplit`: `all-qualifying`, proposed, or `weighted`). **This is the one reading of Dom's "split in proportion" I am unsure of: a flag for Strategy.**
6. **Group pooling:** row `groupPool` (default off: parties and guilds are Dom's call and not built). When on, members of one party count as a single contributor whose damage is the sum, and split their slice by the same rule inside the party.

Not used anywhere: who reported first, who landed the last blow, who has the biggest share. Report order only decides who finds the window closed and runs the (idempotent) settle.

**Rows (all in `server-rules.json`, none a constant in code; values est., World/Combat set the real ones):** `tagTimeoutS` 30, `settleWindowS` 20, `maxContributors` 8, `minShare` 0.10, `lootSplit` weighted, `questSplit` all-qualifying, `groupPool` off, `queuedReplaysPerAccount` 2.

**Limits Dom should know before he builds on this (honest, not blockers):**
- Because each page runs its own copy of the creature, two players who each killed their own copy alone each show a damage of one full creature, so each gets **50%**: the creature died once and its reward is shared. They will not see each other's hits (presence carries no combat). That is correct for "split in proportion to damage", but it will feel like a halved reward for the same fight; whether a shared server-side health bar is wanted is a Combat/Dom question and is **not** in this design.
- Contributors are only players whose token was open **before the first report**; a player who engages after the creature is settling gets `dead`. That is the line between "was in the fight" and "arrived after".
- A solo hunter is untouched; the delay (up to `settleWindowS`) falls only on a report that meets open siblings.
- An alt-account sybil gains nothing: its share comes out of its owner's other account, and per-account kill caps still bind.

**Replay load against the 9% busy figure.** Receipt 6 queued 1,091 replays for 24 paid kills at 800 arrivals/s and 100 came back `busy` (9%, 1-worker queue of 16): replays nobody needed. With the settle the pool sees at most 24 settlements x `maxContributors` and in practice about one per solo kill, and the `full` answer costs no replay.

**Strict flip.** Today the kill pays now and the replay is advisory (flag off). The settle pays only after the contributions are replayed, so **strict is a row on step 4 (drop unverified), not a redesign**; the order is tag, replay, settle. Lead's sizing rule (workers = kills/s x replay seconds, with 2x margin, at the real fight mix) is in section 4c, now times the mean contributors per kill.

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
- **Replay capacity at that supply** (Lead's rule, kills/s x replay seconds x 2): 13 layers = 6,929/h = **1.9 kills/s**. At receipt 4's 0.022 ms per tick, a 30 s fight (1,800 ticks) replays in about 40 ms: 1.9 x 0.04 x 2 = **0.15 worker**, so one worker holds with room (times the mean contributors per kill: at 2, 0.3 worker; solo kills are 1.0). **The unmeasured tail is long fights:** a 20-minute fight is 72,000 ticks, about **1.6 s per replay** at the same rate, close to the 3 s job timeout; if every kill were that long, 1.9 x 1.6 x 2 = **6.1 workers**. The real fight-length mix is the missing input; it comes from the soak's `world record verified (N ticks)` log lines, and the worker count is set from it before any strict flip.

## 5. Sizing and opening/closing a layer (d)

- **Open:** presence opens a layer when every existing one is at the soft cap of 80 (fill-first), up to `maxLayers`. Spawn rows appear on first engage (section 2). Nothing in the database is created ahead of players.
- **Close:** presence closes a layer after 300 s with no players; the writer's janitor then deletes its spawn rows (section 2).
- **Size of a layer** is set by presence's render/bandwidth reasoning (`one-shard.md` §4), not by the spawn economy: 80 soft / 100 hard. The economy knob is **how many spawns a layer holds** (a data row per zone, World's side) and their respawn; per layer that is the 533/h ceiling above.
- **Process ceiling:** about **1,500 players per presence process** (tick p99 62 ms of 100, 75% of a core), hard ceiling near 2,000 (p99 84 ms) and over budget at 3,000 (receipts 2, 3, 5). At 80 per layer: 18.75 layers per process at 1,500. **Required rule change: `maxLayers` from 8 to 20** for the first process (it now stops at 640). The Lead's second-process trigger (sharded by layer group, ready before 1,000 concurrent) needs **globally unique layer ids across processes**: process k allocates ids from k x 1000, so (layer) stays one integer in the database and a layer is never confused with another process's. That is a presence change in the sharding PR, not this one.
- **Where the writer asks:** with one process, one URL. Once sharded, `where` and `layers` go through a router by layer group; the database never learns about processes.

## 5b. Zone and spawn rows (World)

World, 2026-10-19. This is the zone-data side: which rows hold the numbers, what a layer copies, and the starter-tier values for Zone 1. **Rows only; no code.** The kill-rate figures are ceilings (every spawn killed the moment it stands, a hunter always waiting), not measured rates.

### Where the numbers live (all data, none in code)

- **Respawn** is the creature row's `respawnSeconds` (`origins/zone-rows/zone<N>.row.json`, `spawns.rows[]`). A row without one takes the `respawnDefault` world rule, **300 s** (`src/fight/world-rules-defs.json`). The legal range is `respawnMin` 30 to `respawnMax` 300 s (`src/core/world/wildlife-rules-defs.json`); `validateMobRow` rejects anything outside it. The same number is the paid-kill window the server binds (`mob-rewards.ts` `respawnRows`), so 3b's "one paid kill per account per spawn id per respawn window" follows the row.
- **A creature has one respawn in every zone.** The server builds one `creature id -> ms` map across all zones (`respawnRows`), so Zone 1's ash boar and Zone 2's ash boar cannot have different clocks, and `mob-rewards.test.ts` pins every zone's row to it. Per-layer or per-zone clocks would need a `(zone, id)` or `(layer, id)` key: a code change for Backend's build order (section 6 step 2), not a row.
- **Spawn count** per zone is the sum of its camps: each `place.spawns[]` group stands one camp at one landmark, sized by the row's `behaviour.campSize` (min..max), plus one opener per zone. A camp is at most **4** (`campMax`; 6 only on a `bossCamp` row). So density is a row-and-group edit (more groups at landmarks, or a larger `campSize` up to 4), never code.
- **A layer copies exactly this list.** Layer N of a zone holds the same spawn ids with the same rows; it adds nothing to the zone row. A zone's spawn count therefore **multiplies by the number of open layers** and the zone row stays the single source (section 2: the layer is a column, not part of the creature id).
- **Named creatures** (`named: true` rows, bounty foes, the matriarch, the cave troll at 300 s) keep their long clocks and are not part of the starter tier.

### Zone 1 today (counted from the preview spawn list, `origins/preview/mobs.golden.json`)

24 spawns. The starter tier, the level-1 creatures a new hunter fights first (Cinder Fields and the East Road):

| row | spawns | respawn today |
|---|---|---|
| cinder scavenger (camp of 4 + the Cinder Fields opener) | 5 | **300 s** (no row value: the default) |
| ash wolf (camp 2..3, the golden list has 2) | 2 | 75 s |
| ash boar | 1 | 75 s |
| pit goblin (camp of 2, East Road) | 2 | 75 s |
| **starter tier** | **10** | |

At the ceiling that is 5 x 3600 / (300 + 15) + 5 x 3600 / (75 + 15) = 57 + 200 = **257 kills/h for the whole tier**, so 20 hunters get **12.9 kills/h each**. (15 s = one fight; the first fight measured 13.5 s.) The tier already holds the 8-10 spawns that 2004Scape's chicken pen has (9 chickens at 30 s, about 1,080 kills/h: the 9 is Lead's count; the clock is read from 2004Scape-Server `data/src/scripts/_unpack/all.npc:1074`, `[chicken]` `respawnrate=50` ticks of 0.6 s = 30 s); what it lacks is the pen's respawn clock.

### The proposal: respawn, not density

Starter-tier respawn goes to the 30-60 s band; the spawn count stays at 10 (the golden list, no new groups, no `campSize` change):

| row | spawns | respawn | cycle (respawn + 15 s fight) | ceiling per spawn | tier ceiling |
|---|---|---|---|---|---|
| cinder scavenger | 5 | 40 s | 55 s | 65 /h | 327 /h |
| ash boar | 1 | 45 s | 60 s | 60 /h | 60 /h |
| pit goblin | 2 | 45 s | 60 s | 60 /h | 120 /h |
| ash wolf | 2 | 60 s | 75 s | 48 /h | 96 /h |
| **starter tier** | **10** | | | | **603 /h** |

603 / 20 hunters = **30.2 kills/h each**, which is the target at the ceiling. The wolf stays the slowest (it is the strongest starter, aggro 9 and a pack). One spawn per hunter is **0.5**, so a hunter is never short of a target at a 20-hunter layer; the pen's 9 spawns serve its crowd the same way.

**Why not 8-10 spawns per hunter.** Read literally that is 160-200 spawns per layer, 16-20 times the starter tier and 7-8 times the whole zone. The 4-per-camp cap alone would need about 45 camps, and at 45 s (a 60 s cycle) the ceiling would be 160-200 x 60 = 9,600-12,000 kills/h per layer, 16-20 times the 600 the target needs. The pen reading (8-10 spawns per area at a 20-hunter layer) gives the target with the respawn change alone. If Dom meant more spawns, it is a groups edit in the zone row, and Backend's 120 kills/h per account cap is the real bound.

### What this means for the layer economy

- **Per layer** the starter tier is now **603 kills/h at the ceiling** (was 257). The rest of Zone 1 (brood, ghouls, ferry opener and the troll at 300 s, salamander 90 s, bear 75 s; the four bounty and matriarch encounters left out) adds about 165/h at the same 15 s fight, so a Zone 1 layer is about **770 kills/h** (was about 420).
- **A full layer (80 players, 25% hunting = 20 hunters)** gets about 30 kills/h each from the starter tier. A **partial layer** is richer, as 4c says: 5 hunters get 120/h each, which meets the 120 kills/h account cap. That is the number to watch on the per-layer readout, and the occupancy-scaled respawn in section 6 step 5 is the knob if it mints out of line.
- **Cost to the replay worker:** 13 layers x 770 = about 10,000 kills/h = 2.8 kills/s at the ceiling, against the 1.9 kills/s in 4c. At 0.04 s a replay and the x2 rule that is 2.8 x 0.04 x 2 = **0.22 worker**, still one worker (the long-fight tail in 4c is unchanged).
- **Loot per kill is unchanged**; only the number of kills moves.

### What I am NOT claiming (World)

- The 15 s fight and the "hunter always waiting" are assumptions; real walking between spawns lowers the rate, so 30 kills/h is the top of the range, not the expected value.
- The new clocks (40 / 45 / 45 / 60 s) are mine, chosen inside the legal band to land the arithmetic on 30; Dom or Strategy can set others, the table scales linearly.
- Zone 2 and the L2 Zone 1 rows (brood 300 s, ghouls 300 s, bear 75 s, salamander 90 s) are untouched here.

## 6. Build order (after Dom's yes)

1. **The damage-share settle (section 3c) + per-account replay cap**, on the current single layer (no schema change to the spawn key). **Dom ruled this goes first, on its own.** It stands alone: it ends first-report-takes-all, fixes the abuse surface and the 9% busy at today's single copy, and is the order the strict flip needs. Pieces: the verifier returns damage dealt; a contributions table (token, damage, verdict, share) and an idempotent `origins_spawn_settle`; the eight rows in `server-rules.json`; the writer's tag/hold/replay loop. Migration: one table + functions, additive (the old `origins_spawn_kill` stays for the flag-off path).
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
- The eight settle rows (3c) are my proposals; none is measured. Whether the replay can report damage dealt cheaply is read from the code (it returns kills and ticks today), not tested.
- The WoW layering abuse history (section 1) is not from a donor repo.
