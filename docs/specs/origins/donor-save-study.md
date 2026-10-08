# Donor save study: how legendary MMO servers save players and the world

Strategy lane, 2026-10-08. Read-only study of six donor servers, then a design for Frankendom's writer. Every claim cites the donor file and line as read
on the VPS library (`/mnt/frankendom-donors`, EQEmu at 4aceae1, ModernUO at 261ea01) or the Mac (`~/Developer/donors/world-of-claudecraft`).
**Licence:** EQEmu, ModernUO, AzerothCore and forgottenserver are GPL, so they are study-only: this doc describes their designs and pastes none of their
code. World of Claudecraft (WoC) is MIT (`LICENSE`, "Copyright (c) 2026 Levy Street") and may be copied with its notice. Note: both RuneScape servers
also ship an MIT `LICENSE` (2004Scape-Server, LostCityRS-Engine-TS), which is looser than the brief assumed; this doc still treats them as study-only
until Dom rules otherwise.

## 1. EQEmu (EverQuest)

- **What:** one `Client::Save` (zone/client.cpp:981) writes position (988-993), HP/mana (997-1012), currency (1015), binds (1020), buffs (1023), pet
  (1045-1057), tribute and tasks (1073-1074), then the character row (1089). Inventory is NOT in that function.
- **When, timer:** `Character:AutosaveIntervalS = 300` (common/ruletypes.h:75); the timer is built from it (zone/client.cpp:148, 456) and
  `Save(0)` fires on it in the client loop (zone/client_process.cpp:542-543).
- **When, events:** destructor save "because the client might be zoning" (zone/client.cpp:782), camp (client_process.cpp:193-199), link-dead (159-161),
  kick (564). Merchant buy/sell call `Save(1)` straight after (client_packet.cpp:2189, 2403, 2737, 2913, 14583).
- **Immediate writes:** every money change rewrites the whole currency row at once (`TakeMoneyFromPP`/`AddMoneyToPP`, zone/client.cpp:2797-2959;
  `SaveCurrency`, client.h:479, a replace in zonedb.cpp:1194-1200). Every inventory slot change is written as it happens (`PutItemInInventory` ends in
  `SaveInventory`, zone/inventory.cpp:1077). So EQEmu's real model is "valuables write-through, soft state on the 5-minute timer".
- **Atomicity:** almost none. `Save` has no transaction; the only `TransactionBegin` calls are corpse creation on death (zone/corpse.cpp:369-402),
  `Handle_OP_MoveItem` (client_packet.cpp:10931-10950) and two admin paths in common/. A trade (`FinishTrade`, zone/trading.cpp:319) pays money
  (331) and moves each item (348, 409, 483) as separate writes. Looting adds the item to the looter first (corpse.cpp:1690) and only then deletes it
  from the corpse row (1705-1712): a crash between the two duplicates the item.
- **Dupe guard:** in memory only: one looter per corpse (`m_being_looted_by_entity_id`, corpse.cpp:1164-1174, set at 1229). Optional inventory
  snapshots for GM rollback, off by default (ruletypes.h:163-166).
- **Quality:** pragmatic and battle-tested, but the safety comes from write-through plus single-threaded zones, not from the database. Do not copy the
  "item in, then item out" ordering.

## 2. ModernUO (Ultima Online)

- **What:** the whole world (every item, mobile, guild and registered system) in one binary snapshot; there is no per-player save and no database.
- **When:** every 5 minutes (`autosave.saveDelay`, Projects/UOContent/World Saves/AutoSave.cs:38), aligned to the wall clock (57-63), checked on a 1 s
  timer (65) and skipped while a save is already running (76). Optional broadcast warning (78-82, 92-112).
- **How it avoids a long pause:** `World.Save` waits for the previous disk write, marks PendingSave and pre-allocates worker heaps off-thread
  (Projects/Server/World/World.cs:260-272, 274-290). The game loop then runs the snapshot between ticks (Main.cs:740-746): the world IS frozen
  ("The world is frozen from here", World.cs:311) but only while entities are serialized into memory buffers, spread over `ProcessorCount - 1`
  workers plus the main thread (World.cs:221-235), largest systems first so none extends the freeze (Persistence.cs:110-125). Writing to disk happens
  after the game resumes, on a thread-pool thread (World.cs:371-372, 390-414).
- **Crash safety:** the snapshot is written to a temp folder, moved to `Saves.next`, the old save is set aside (never deleted) and `.next` becomes `Saves`
  (World.cs:424-452); a boot or the next save finishes an interrupted publish (459-474). A crash loses up to 5 minutes for everyone, but consistently.
- **Dupe guard:** consistency by snapshot. A trade or loot is a pure memory change, and the next snapshot captures both sides at one instant, so a crash
  rolls both sides back together. Dirty tracking is switched off (World.cs:55; `MarkDirty` is an empty TODO, Serialization/ISerializableExtensions.cs:25-28).
- **Quality:** excellent engineering for its model (staged publish, freeze measured and minimised). The model itself does not fit us: we are on Postgres
  and Dom wants valuables durable at once, not within 5 minutes.

## 3. AzerothCore (World of Warcraft 3.3.5)

- **What:** `Player::SaveToDB` writes the character row, mail, inventory, quests, talents, spells, cooldowns, auras, skills, achievements, reputation,
  glyphs and settings, all in ONE transaction (src/server/game/Entities/Player/PlayerStorage.cpp:7231-7238 opens and commits it, 7240-7297 fills it).
- **When:** `PlayerSaveInterval = 900000` ms, 15 min (src/server/apps/worldserver/worldserver.conf.dist:1799-1803); the first save of a session is
  randomised to between 0.5x and 1.5x the interval so players do not all save on the same tick (PlayerStorage.cpp:5436-5438); counted down in
  `Player::Update` (PlayerUpdates.cpp:325-336); any save resets the countdown (PlayerStorage.cpp:7243). Logout saves (Server/WorldSession.cpp:810). A far
  teleport defers the save until the player lands (PlayerStorage.cpp:7246-7250).
- **AdditionalSaves:** a config bitmask (conf.dist:1822-1833, default 0) for "save this part a moment after an important change": inventory+gold after
  a rare loot (PlayerStorage.cpp:2654), quest status (PlayerQuest.cpp:643, 1941), achievements. It arms a 2000 ms timer (PlayerStorage.cpp:7303-7311)
  and then writes only those parts in one transaction (PlayerUpdates.cpp:2467-2510). The code calls the inventory+gold save the "fast save function for
  item/money cheating preventing" (PlayerStorage.cpp:7313).
- **Trades:** both players' items and gold are swapped in memory (Handlers/TradeHandler.cpp:583, 598-601), then BOTH players' inventory and gold are saved
  in ONE transaction (664-669, with the comment at 665). Cross-realm trades cannot share a transaction and save each side separately (652-661).
- **Async:** a commit does not block the game: `CommitTransaction` pushes a task on a producer/consumer queue that worker threads drain
  (src/server/database/Database/DatabaseWorkerPool.cpp:258-277, 474-476). A deadlocked transaction is retried for up to 1 minute
  (Database/Transaction.cpp:30, 103-118). Only changed rows are written: items carry NEW/CHANGED/REMOVED states (PlayerStorage.cpp:2767, 2804, 2928).
- **Dupe guard:** the paired-save transaction for trades, the per-item dirty state, and the 2 s AdditionalSaves for loot. There is no idempotency key: a
  crash before the async queue drains loses the trade on both sides together (consistent), which is the same trade-off as ModernUO, per trade.
- **Quality:** the most complete reference for our shape (memory world + SQL + async writer). Mature, large, C++; the async queue means "committed" is
  not known to the game at the moment it tells the player.

## 4. 2004Scape-Server and LostCityRS-Engine-TS (RuneScape 2, TypeScript)

The two are close forks; LostCityRS lines first, 2004Scape where it differs.
- **What:** one binary blob per player: magic 0x2004 and a version (src/engine/entity/PlayerLoading.ts:11-12; 2004Scape version 6 at :14), position,
  look, run energy, playtime, 21 stats, the permanent vars, permanent inventories, AFK zones, chat modes, last login, then a CRC32 of the whole blob
  (src/engine/entity/Player.ts:189-273, CRC at 272). Temporary vars and inventories are skipped by scope (Player.ts:215, 222, 233).
- **When:** every 1500 ticks of 600 ms, 15 min (World.ts:120, 124; loop at 425-428; 2004Scape World.ts:124, 454-456), and on logout
  (`flushPlayer`, World.ts:1623, 2365-2371). Nothing saves on trade or loot: the only two `player.save()` calls are the autosave and logout
  (World.ts:1244, 2366; 2004Scape 1262, 2336).
- **How:** the game thread builds the blob and posts it to a login worker thread (World.ts:1239-1247), which sends it over a WebSocket to a login server
  that writes `data/players/<profile>/<user>.sav` (src/server/login/LoginServer.ts:415-424 logout, 458-467 autosave). A plain overwrite, not temp-file
  plus rename. Accounts and login state are in SQL (Kysely `db`, LoginServer.ts:427-447, account_login update at 438).
- **Crash safety and dupes:** a save is refused if its CRC is bad or its playtime went backwards (`wouldResetSaveFile`, LoginServer.ts:124-139), so a stale
  save can never overwrite a newer one. A logout save is re-sent every 15 s until the login server acknowledges it (World.ts:795-804, cleared on success
  at 1963-1969), and the same user cannot log in while their logout is still in flight (812-815). That last rule is the main dupe guard.
- **The world** is not persisted: no `writeFile` exists anywhere in src/engine of either repo; NPCs, ground items and shops reset from the cache on boot.
- **Quality:** small, readable, closest to our stack. Weak where we need strength: up to 15 minutes of loot and trades are lost on a crash.

## 5. forgottenserver (Tibia), briefly

- `IOLoginData::savePlayer` (src/iologindata.cpp:616) writes the player in one `DBTransaction` (737, commit 887). It runs on logout with 3 tries
  (src/player.cpp:1281, 1324-1330) and in the global save (`Game::saveGameState`, src/game.cpp:151-170: every online player, then `Map::save()`
  for houses, then flush the DB task queue, under GAME_STATE_MAINTAIN). That global save runs ONCE A DAY at 09:55 after a 5-minute warning
  (data/scripts/globalevents/server_save.lua:38-48) and by default shuts the server down (config.lua.dist:128). There is no periodic per-player autosave.
- Market buys for an offline player save that player at once (game.cpp:5477-5478; iomarket.cpp:171).
- Quality: simple, and the daily-restart culture covers the gap. Too coarse for us.

## 6. World of Claudecraft (TypeScript + Postgres, MIT, may be copied)

- **What and when:** every online character's JSON blob, plus realm market, mail and shared Rift state, every 30 s (`AUTOSAVE_SECONDS = 30`,
  server/game.ts:518; flush at 2689-2700). The flush is fire-and-forget and never awaited inside the 20 Hz tick, each write in its own try so one
  failure costs only itself (server/periodic_save_flush.ts:25-40, 114-138). It openly says the character, market and mail writes are separate transactions,
  so a crash between them can tear a market escrow (42-52).
- **One FIFO per character:** every write for a character goes through a keyed serial queue, so commits land in the order they were queued and a stale
  snapshot can never overwrite a newer one; the snapshot is read inside the queued job (server/serial_writer.ts:1-8, 20-46, 48-75).
- **Lease and fence (the cross-process dupe guard):** a `character_leases` row says which process holds a character; TTL 90 s, renewed on every autosave
  (server/character_lease_db.ts:22-26, 105-113); each join stamps a fresh nonce (48-74); every save is `UPDATE characters ... WHERE id = $1 AND EXISTS
  (lease with my holder AND my nonce AND not expired)` (server/character_save_statement.ts:151-161), so a displaced or zombie session's save writes 0 rows.
- **Bounded transactions:** `BEGIN` then `SET LOCAL statement_timeout`, `lock_timeout = '2s'`, `idle_in_transaction_session_timeout = '10s'`
  (server/character_save_transaction.ts:36-58).
- **Idempotent rewards:** `INSERT ... ON CONFLICT (realm, attempt_id) DO NOTHING RETURNING`, and on a conflict it checks the stored payload is the same
  before answering "already committed" (server/vault_rewards_db.ts:265-295). An audited item grant forces an immediate save instead of waiting 30 s
  (server/game.ts:5720-5725).
- **Quality:** the most defensive of the six and directly in our language, but heavy: game.ts is 9,811 lines and db.ts 4,515; comments are longer than the
  code. Take the small modules (lease, fence, serial writer), not the monolith.

## 7. Comparison

| | Soft state cadence | Valuables | Atomic unit | Async? | Dupe / double-pay guard | Crash loses |
|---|---|---|---|---|---|---|
| EQEmu | 5 min timer + zone/camp/linkdead | write-through per row (money, each slot) | none (rows one by one) | no | one looter per corpse, in memory | soft state up to 5 min; a mid-loot crash can dupe |
| ModernUO | whole world every 5 min | same snapshot | whole world | disk write yes, serialize frozen | consistent snapshot | everything up to 5 min, consistently |
| AzerothCore | 15 min, jittered, + logout | trade: one txn for both; loot: optional 2 s | one player (or both traders) | yes, worker queue | paired txn, per-item dirty state | up to 15 min (or 2 s), consistently |
| 2004Scape / LostCity | 15 min + logout | same blob | one player file | yes, worker thread | CRC, playtime-never-backwards, no login mid-logout | up to 15 min |
| forgottenserver | daily global + logout | offline market only | one player | DB task queue | daily restart | up to a day |
| WoC | 30 s + leave | forced immediate save for grants | one character (market separate) | yes, fire-and-forget FIFO | lease + nonce fence, `ON CONFLICT` keys | up to 30 s; escrow can tear |
| **Frankendom today** | location: leave + 60 s designed (origins/server/location.ts:4), not yet called by presence | `origins_commit` batch, one txn | one account batch | no (awaited psql per call) | `origins_events` pk, item `version`, conservation trigger (server-save-schema.md §1) | soft state not yet saved |

Lesson in one line: the old servers buy consistency with ROLLBACK (lose everything since the last save, together); none of them gives what Dom asked for,
which is valuables that are durable before the player is told, and paid once. Our existing `origins_commit` + `origins_events` design already does that;
the donors add the soft-state queue, the lease fence and the logout handshake around it.

## 8. Recommendation for Frankendom

Dom's rulings, restated: the live world runs in the writer's (and presence's) memory. Position and soft state save every 5-10 minutes and on logout and
zone change. Kill reward, loot, bronze and trades save at once, in ONE transaction, and can never be paid twice.

### 8.1 Two lanes, never mixed

1. **Valuables lane (synchronous, at once).** Everything that creates, moves or destroys value: kill reward, loot pick-up, bronze spend or gain, trade settle,
   quest reward, upgrade. One HTTP op = one `origins_commit` (or `origins_encounter_settle` / `origins_settle_trade`) call = one Postgres transaction.
   The player sees the result only after COMMIT returns (AzerothCore's async commit is the thing NOT to copy here). Keep it as built: `origins_events`
   insert first, item `version` checks, the deferred conservation trigger (server-save-schema.md §1), metal ledger for bronze
   (migration 202610070007).
2. **Soft-state lane (asynchronous, batched).** Position, zone, facing, HP if it persists, cooldown leftovers, settings, play time, "last seen". It never
   carries value, so losing up to one interval is acceptable and costs nothing that can be duplicated.

The rule that keeps the two apart: **nothing in a soft-state row may be spendable**. If a field can be traded, sold, or turned into CP, it belongs in lane 1.

### 8.2 The save queue (lane 2)

- **Dirty set, not a full sweep.** The in-memory character keeps a `dirty` flag (AzerothCore's per-item state idea). Only dirty characters are written.
- **Cadence:** every character gets its own deadline, `interval = 5 min`, first deadline jittered to 0.5x-1.5x (AzerothCore PlayerStorage.cpp:5436-5438),
  so saves spread evenly instead of landing on one tick. A 1 s ticker collects the characters whose deadline passed.
- **Batch:** one statement per tick for all due characters: `update ... from jsonb_to_recordset($batch)`, with the newer-wins guard
  (`where saved_at <= excluded.saved_at`, already the shape of `origins_save_location`, migration 202610070009:54-56) and the lease fence below. Today the
  writer spawns one `psql` per call (origins/server/db.ts:15-34); a batched statement keeps that cost at one spawn per tick, and a pooled driver
  can come later without changing the queue.
- **Per-character FIFO:** copy WoC's keyed serial writer (MIT, server/serial_writer.ts:48-75): lane-1 commits and lane-2 saves for the same character run
  in order, and the snapshot is read inside the queued job, so an older snapshot can never land after a newer one.
- **Forced flushes (jump the queue for that character):** logout, zone change, server shutdown, and right after any lane-1 commit that also moved the
  character (cheap: the row is already locked). Never block the game loop on lane 2: fire, catch, log (WoC periodic_save_flush.ts:114-138).
- **Logout handshake:** copy the RuneScape rule as a design: a logout save is retried every 15 s until acknowledged, and a new join of the same character is
  refused while a logout save is in flight (LostCityRS World.ts:795-815). Combined with the lease, this is what stops "log out, log in elsewhere,
  both copies alive".

### 8.3 Idempotency keys (lane 1)

- Keys are built by the server from facts it holds, never sent by the client, as today: `enc:<token>` for a settled fight, `quest:<character>:<quest>:<stage>`,
  `pit:<claim>`, `boss:<character>:<boss>` (server-save-schema.md §1). Add:
  - loot pick-up: `loot:<encounter token>:<drop index>` (the drop table is rolled once at settle from the token's seed, so the index is stable);
  - trade: `trade:<container>` (one settle per trade container, already unique);
  - bronze: every ledger line carries the event id of the op that caused it, unique, so a retried spend books nothing.
- **Same key, same payload:** on a duplicate key, compare the stored payload with the new one; equal means "already done, return the original receipt"
  (`origins_event`, migration 202610060002), different means a bug, refuse loudly (WoC vault_rewards_db.ts:265-295 is the MIT pattern).
- **Order inside the transaction:** insert the event row FIRST, then mint/move/burn. A duplicate aborts before any value moves. Never EQEmu's "give, then
  remove" across two statements outside a transaction.

### 8.4 One live copy: the lease fence

Copy WoC's lease and nonce fence (MIT, server/character_lease_db.ts:48-113, character_save_statement.ts:151-161) into a small migration:
`origins_character_lease(character pk, holder, nonce, expires_at)`, TTL 90 s, heartbeat on the soft-state ticker. Every lane-2 write and every lane-1
commit checks "my holder, my nonce, not expired" in the same statement. This covers the cases our single writer still has: a deploy where the old and
new writer overlap, a reconnect racing a logout, a zombie socket. A fenced-out write changes 0 rows and is logged, never retried blindly.

### 8.5 The crash window, stated plainly

| What crashes | What is lost | What can be duplicated |
|---|---|---|
| writer dies after a lane-1 COMMIT, before the reply | nothing; the client retries, the event key answers "already done" with the original receipt | nothing |
| writer dies before a lane-1 COMMIT | the op never happened; the client retries and it runs once | nothing |
| writer dies between soft-state flushes | at most 5 min of position and soft state (the player reappears where last saved) | nothing (no value in lane 2) |
| Postgres down | lane 1 refuses (503), the player is told; lane 2 keeps dirty flags in memory and retries | nothing |
| two writers alive during a deploy | the fenced one writes 0 rows | nothing |

Bounded transactions on both lanes: `SET LOCAL lock_timeout = '2s'`, a statement timeout, and an idle-in-transaction timeout (WoC
character_save_transaction.ts:52-56), so a stuck save can never hold a player's rows for long.

### 8.6 What not to take

- ModernUO's whole-world snapshot (we are on Postgres, and valuables cannot wait 5 minutes).
- AzerothCore's async commit for valuables (the player is told before the database knows).
- EQEmu's unpaired row-by-row writes for trades and loot.
- WoC's 30 s cadence and its separate market transaction (Dom ruled 5-10 min for soft state, and every valuable shares one transaction).

### 8.7 Build order (proposal, for Lead)

1. Lease table + fence on `origins_commit` and `origins_save_location` (small additive migration, down-script, Auditor probe).
2. Presence calls `writerSaveLocation` on leave and zone change (helpers exist, origins/server/location.ts:103-111; no caller outside tests today).
3. The soft-state queue in the writer (dirty set, jittered 5 min deadline, batched statement, per-character FIFO), with a test that kills the process
   mid-batch and proves no row goes backwards.
4. The loot and trade event keys of 8.3 as those features land; a probe that replays each op twice and checks it paid once.
