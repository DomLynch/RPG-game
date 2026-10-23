# Dungeon 1: legend rotation, the writer side (design note)

Backend & Accounts, 2026-10-22. Asked by Lead; Dom's "100 legends" (Dungeon 1's roster is the Pit ladder's legends). Status: PROPOSAL, one page, for Lead and Combat to rule on before any code.
Donor: ModernUO's champion spawn (a level of the spawn picks from a fixed type list; the next wave is a new pick) and EQEmu's spawngroup (a spawn point owns a weighted list of NPC types; each respawn rolls one). We take the shape (point owns a pool, each generation picks) and make the pick a pure function so the writer and the page cannot disagree.

## Today (read from the code at ce5dd621b)
- A zone 7 spawn is `z7:<ring>-<legend>-<camp>-<n>`; the legend is in the key, so a camp is one legend for life. 3 legends per ring are placed, 9 of the 100.
- The database pins `origins_spawns.kind` at the first engage and REFUSES a different kind (`spawn % is a %, not a %`, `origins_spawn_engage_layer`). A rotating character cannot ride in `kind` unchanged.
- A spawn's life is `generation`: the kill bumps it, the respawn timer opens the next. The damage ledger (`origins_spawn_damage`) and the marks (`origins_world_marks`, `..._settled`) are keyed by `(layer, instance, generation)`, so they already work per generation. Nothing in the settle depends on WHICH character stood there.
- `spawnState` already returns `{instance, kind, level, alive, respawnAt, generation}` per spawn; the page reads it.

## Proposal
1. **The key is the camp, not the legend:** `z7:<ring>-camp-<n>` (stable, no migration; zone 7 has no live rows yet, so renaming before K6q26 costs nothing). The database `kind` is the camp's POOL id (`pit.outer`, `pit.middle`, `pit.floor`; matches the kind check `^[a-z0-9._:-]{1,64}$`), set once and never changing. No SQL change.
2. **A pure pick:** `legendAt(pool, campKey, generation)` returns one legend of the ring's pool. Rule (a row): `cycle` = `pool[(offset(campKey) + generation) mod n]`, where `offset` is a stable hash of the camp key. Properties: a camp never shows the same legend twice running, every legend of the pool appears equally often, two camps in a ring start on different legends. The alternative `hash` (`pool[hash(campKey, generation) mod n]`) repeats and clumps, so it is not proposed.
3. **The pool is derived, not listed:** a ring's pool is every legend whose rank is inside the ring's level band (`bowl-roster.json` rings already carry `levels`: outer 1-3, middle 4-6, floor 7-10), taken from `src/fight/legend-rows.json` (10 per rank = 100) in table order. Adding a legend to the ladder adds it to the rotation with no edit here. Per-ring rows added to `bowl-roster.json`: `camps` (how many camps), `rotation` (`cycle`), and optionally `pool: [legendIds]` to override the derived pool (Dom's "which legend stands where" review).
4. **The writer resolves per generation:** `zoneSpawns` keeps one entry per camp holding the POOL; `spawnFor(instance, generation)` returns the resolved Spawn (`spec.character`, `level` = the legend's rank, `hp` from `healthOf`, the shared `loottable:pit-legend`, the ring's `respawnSeconds`). `spawnState` returns the resolved `kind` and `level` for the CURRENT generation (the one `origins_spawn_view` already reports: the next one when the timer has passed). `engage` passes the pool id as the database kind, then resolves the legend from the generation the database returns; `kill_report` resolves again from the engage record's generation, so the fight setup, reach, loot and the kill row all price the legend that actually stood there.
5. **The page needs no copy of the rule:** it reads `kind`/`level` from `spawnState` and swaps the look when `generation` changes (Combat, `mobs-view`, after #3615 ships). If the page ever wants to show the next legend ahead of the respawn, it imports the same `legendAt` (pure, page-safe, `origins/dungeon/`), never a second implementation.

## Rows (the as-data line for the code PR) and what stays in code
Rows: ring `camps`, `rotation` rule name, optional `pool`, `respawnSeconds` (exists). Code: the `cycle` function itself (a closed list of one rule, the verb with its dispatch named in `_lists.json`) and the camp-key hash (an engine detail, no tuning). No new number; `n mod` uses `pool.length`.

## Checks the code PR carries
- The ledger and settle are unchanged: a test settles generation 3 of a camp whose legend differs from generation 2 and gets one mark per qualifying account per generation.
- `legendAt` is pure: same camp and generation, same legend in the writer, in a fixture of the page's reader, and after a restart; never twice in a row; every legend of a 10-legend pool seen once in 10 generations.
- A restart mid-generation resolves the same legend (the pick depends only on the camp key and the database's generation).
- fail closed: a pool legend `fightSetup`/`healthOf` cannot price drops OUT of the pool at load (a loud load error, not a silent hole), because a camp cannot "skip" a generation.

## Open questions
- Camps per ring: today 1 camp per legend (3 per ring). With rotation, do rings keep 3 camps (each cycling the whole ring pool of 30 or 40) or more? Dom/Lead.
- Respawn is per camp (40/50/60 s by ring). Is it fine that a camp's legend changes each respawn, or should a legend hold N kills (a "streak") for the player to learn it? Proposed: every respawn.
- Hero-level gating: a rank-10 legend among a ring with rank 7-10 is a big spread inside one ring; keep or narrow bands?
