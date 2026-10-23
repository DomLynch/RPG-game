# Ground loot: brief (Backend, 2026-10-14)

Dom via Strategy via Lead: a **ground-item row kind** (a loot row plus a spawn point), using the existing tap-to-take and the server-checked award. Low-value starter gear only. The first one is a rusty sword on the path to the goblin camp in Zone 1 (World is building the camp's look). This is a brief, not a build: nothing here was run, and Lead OKs the build from it. Facts below were read off trunk `5a2ced7dd` and the donor repos with git and grep; where I am inferring, it says so.

## What exists and gets reused (read, not built)
- **Spawn state with a server clock** (EverQuest's spawn2 pattern): `origins_spawns` (migration `202610080014_origins_world_spawns.sql`: `instance`, `kind`, `generation`, `alive`, `respawn_at`, `killed_by`), served by `origins/server/world-spawns.ts` (`spawn_state`, `engage`, `touch`, `kill_report`). Kill switch `ORIGINS_SPAWNS=0`; nothing in a request body names a reward, a level, a seed or an account.
- **The award path:** `origins/server/mob-rewards.ts` pays a verified kill through `origins_apply`'s `mint` op in ONE transaction, with a `mint_key` (`MINT_KEY_PATTERN`, `src/core/contracts/core.ts`) so a retry mints nothing twice; `intoBackpack` and `inventory.receive` refuse a full pack; the one-of-each rule (`checkOneOfEach`, `src/core/contracts/items.ts`) refuses a second copy of a piece.
- **Reach:** presence's pose, recorded "checked" or "unchecked" and refused when unchecked only if `refuseUnchecked` is on (same as `kill_report`); `reach.pickupRadius` (default 1.5 m, 0.25-5) already exists in the world schema (`origins/world/schema.ts:48`).
- **Tap-to-take on the page:** the prompt's `NEAR` map in `origins/preview/main.ts:226` ("Take the ore") opens what you stand near. Today the town ore pile is **client-local** (`play.takeOre()` sets a flag); nothing is minted. A ground item is the first take that is server-checked.
- **Zone data is rows:** `origins/zone-rows/zone1.row.json` (places, mobs, loot tables), checked by the zone loader. There is **no rusty sword item definition** on trunk (grep `rusty` finds nothing in src, origins or specs).

## Donors (reuse-first)
- **EQEmu `ground_spawns`** (`zone/object.cpp`): the object carries `m_ground_spawn`; a `respawn_timer.Check()` re-rolls it back into the world; the pickup path checks lore (our one-of-each) and logs a `GROUNDSPAWN_PICKUP` player event (our `event` ledger line). Taken: server-owned respawn timer, lore check on pickup, a logged pickup. Not taken: EQEmu re-rolls the position inside a box each respawn; ours is a fixed point (an authored path, not a random roll).
- **2004Scape `Obj`** (`src/engine/entity/Obj.ts`, `EntityLifeCycle.ts`): an object has a lifecycle (`RESPAWN`: picked up, goes inactive, reappears after N ticks). Taken: the pick-up-then-reappear shape. Not taken: it is shared first-come and tick-driven in memory; ours is persisted and keyed by account.

## Proposed design
1. **Row kind `ground-item`** (a data table with a manifest, loaded through the registry; no literal in code, `check:as-data --gate` clean). Fields: `id` (`ground:zone1.rusty-sword-1`), `zone`, `at` (a named place on the path, or x,z in metres), `item` (an item id), `qty` (1), `respawnSec`, `radiusM` (absent = `reach.pickupRadius`), `scope` (`account`). Starter rows only; a row that names anything above the starter tier is refused by the loader (the rule goes in the manifest, not in code).
2. **One new item definition row**, `item:starter.rusty-sword` (weapon slot, common, `binding: pickup` so it is not tradable, no sell value). **Expansion's / World's:** its art (`appearance.asset`), name and stats; Backend needs only an id that parses.
3. **Scope = per account (recommended), not shared first-come.** Everyone who reaches the point can take it once per respawn window, so nobody camps a spot and no one is griefed out of the sword. The alternative (shared, one `origins_spawns` row, first taker wins until `respawn_at`) is simpler but invites camping on a path every new player walks. **Lead to choose.**
4. **Server op `POST /origins/ground_take {character, instance}`** (a new handler `origins/server/ground-take.ts`, beside `world-spawns.ts`). The body names no item, quantity or account. The handler, in this order and all before anything is written: kill switch (`ORIGINS_GROUND=0` gives 503 `off`); the row exists and is loaded from the server's own copy; presence reach within `radiusM` plus slack (checked/unchecked as `kill_report` does); not already held (one-of-each: 409 `have-it`); the pack has room (409 `full`, nothing consumed); then ONE transaction: claim the take, mint the item, append the event.
5. **Anti-dupe is the claim.** A new table `origins_ground_takes (account uuid, instance text, taken_at timestamptz, n int, primary key (account, instance))` and one SQL function `origins_ground_take(...)` (security definer, like `origins_spawn_engage`): `insert ... on conflict (account, instance) do update set taken_at = now(), n = n + 1 where origins_ground_takes.taken_at + respawn <= now() returning n` is atomic, so two concurrent taps cannot both win. The mint key is `ground:<instance>:<account>:<n>` (fits `MINT_KEY_PATTERN`; inference: I did not check the length against the longest instance id), so a retried request after a lost response mints once. Rate limit: reuse the per-minute pattern from `origins_world_config` with a new `takes_per_min` column.
6. **Respawn** is the same row: available again for that account when `taken_at + respawnSec <= now()` (the server's clock; the client never sees a timer it can edit). One-of-each refuses a second copy while the player still holds one; `binding: pickup` plus no sell value closes resale. **Economy's call if Expansion wants it sellable.**
7. **Client:** the page asks a new read, `ground_state {zone}`, for the rows available to this account (like `spawn_state`), draws only those, adds a `ground` kind to the prompt (`Take the rusty sword`) and posts `ground_take` on tap. Signed out: shown, with "sign in to take" (nothing is awarded locally; the ore pile's client-only take is not the pattern to copy).

## What the writer needs (and who does what)
- A migration for `origins_ground_takes`, `origins_ground_take()` and the `takes_per_min` column: Backend writes it, **apply-ready review, then Dev/Deploy applies at the deploy that carries the client change** (the lane rule for migrations).
- The handler registered in the writer's route table and a **writer reinstall by Deploy** (`ops/install-origins-writer.sh`) with closure parity checked; a new env flag `ORIGINS_GROUND` in the writer's env file (default on; Deploy sets).
- The writer-check gains the take path (claim once, retry once, full pack, have-it, unreachable, off); a disposable-cluster SQL check like `scripts/awards-database-check.mjs` covers the concurrent claim.

## Slices (each its own PR, each gated)
1. **Rows + loader + item definition** (data only; `check:registry`, `check:as-data --gate`, a loader test that rejects a non-starter row). No behaviour.
2. **Migration + `ground_take` handler + tests** (handler tests with the fake db as in `world-spawns.test.ts`; the SQL check; writer-check). No client.
3. **`ground_state` + the page prompt** (a prompt test beside the existing `NEAR` ones; a browser check on the VPS, 375 wide, with stills per the visual-PR rule), after World's camp look lands so the point is on the path.

## Open questions for Lead
- Per account (recommended) or shared first-come?
- Bound and unsellable (recommended), or sellable?
- Signed-out players: see it but cannot take (recommended), or hide it?
- Expansion owns the item's art and stats; Backend owns the row, the claim and the award. Confirm nothing else is Expansion's.
