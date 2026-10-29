# V3 live zone brief (Strategy, 2026-10-27)

Dom's direction (10-27, to Strategy): V3 is not an instant single-player duel. A player loads into a free-roam,
real-time zone; bosses are placed at spots; several players share the screen; boss health is shared; credit is by
contribution (damage share), never last hit. Post-kill freeze goes away as a consequence. Everything on the data
layer, minimal code.

Donors surveyed today (receipts: paths below, checked in code, not from memory).
- **V1** `~/Developer/frankendom-main` (Zone 1 / Dungeon 1): the live loop and the zone-as-data shape. Weakness: boss
  health lives on each phone, which paid two players 100% each (PR #3654 was the band-aid).
- **Armagedom** `~/Developer/armagedom`: server-held shared health + damage-share paid in one transaction, built but
  switched off; no respawn at all in the shipped game.
- Take: V1's loop and data rows, Armagedom's server-held health. Credit rule is the same in both (proportional, no
  first/last-hit bonus).

## Phase 1, Dom-visible this week: zone loop, single player (V3 Dev; Physics for corpse/cut cue)
1. **Zone row** `data/zones/zone1.row.json` in V1's shape: `origins/zone-rows/zone7.row.json` (alias, band, pvp,
   areas, `respawn` point, spawn rows with `respawnSeconds`, `roster`, `behaviour` {aggro, leash, roam, campSize}).
   Loader pattern `origins/zones/loader.ts:173`, generated registry `origins/zones/registry.ts`.
2. **Open fight loop**, no start, no end, no ring: `src/fight/world.ts:1-5`, `src/fight/open-fight.ts` (duel engine
   with `OPEN_RADIUS`), `src/fight/world-combat.ts` (fixed 1/60 tick, death fall over the `fall` rule, then `onKill`).
   Kill = toast, nothing pauses (`origins/preview/main.ts:994`). Hero death = 2 s "You died", warp to the zone
   `respawn` point at full health, keep everything (`main.ts:1030`).
3. **Respawn/corpse rows**: `src/fight/world-rules-defs.json` (campMax 4, respawnDefault 300, maxAttackers 3),
   client hide `clientRespawn` 90 s (`preview-rules-defs.json:8`), cut piece lifetime 12 s (`feel-rules.json:39`).
   V3 adds `corpse.keepSeconds` and `corpse.tapCutCue` rows; Physics owns the cue and the tap cut.
4. **Difficulty/profile rows** (already in flight) are what a spawn row's `kind` points at.
5. Rematch button goes. `?zone=` and `?spawn=` toggles only for test rows.
Gate: Dom's phone, "I kill the Minotaur, walk off, it comes back; I die, I'm back in the yard."

## Phase 2: other players on screen (V3 Dev)
Lift V1's presence service whole: `origins/presence/server.ts` (WebSocket, positions in memory, 100 ms tick, 80/100
caps, 20 layers, `presence-rules-defs.json`), page side `origins/preview/presence-client.ts`, `remote-track.ts`,
`remote-heroes.ts`. Others have no collider and play no part in the fight. Layer choice `origins/presence/interest.ts:42`.
Gate: two phones see each other walking.

## Phase 3: shared boss health + damage-share credit (V3 Dev, Backend help if needed)
- Server owns alive/dead/respawn: V1 writer ops `origins/server/world-spawns.ts` (`spawn_state`, `engage` one-use
  token, `touch`, `kill_report` with min hits, min time, reach vs presence, `moved` refusal, server-side replay
  `world-verify.ts`).
- Shared health: Armagedom's shape, not V1's: `supabase/migrations/20261024000002_arma_world.sql` (hp in the DB,
  `arma_spawn_hit_batch` per tick, phone only claims damage capped by weapon rows `server/presence/caps.js`,
  everyone in the area gets the hp back each tick, `respawn_at = now()+respawn_s`).
- Credit: proportional damage per life, floor `min_share_pct` (Armagedom 5%, V1 0.25 of top damager, pick one row),
  hit expiry 120 s, kill caps per minute/hour, no last-hit bonus. V1 `origins/server/damage-share.ts:12`,
  Armagedom `…arma_world.sql:63-73,162-183`.
- Rules rows: V1 `server-rules.json:127-134`, Armagedom `arma_world_config`, `arma_weapon_rules`.
Gate: two phones on one Minotaur, both see one bar, both get paid by share.

## Traps recorded by the donors (do not re-learn)
- Per-phone health pays twice (V1 `damage-share.ts:5`). Server-held from day one in V3.
- Every new DB function granted to every writer role in the same migration (both repos).
- Zone ids are strings; `z01:` refused; zone 0 keys once stored as zone 1 (V1 migration 20261022110000).
- A failed hit batch is never retried (double damage) (Armagedom `server.js:141`).
- Weapon damage caps must rise with progression or upgraded hits get refused (Armagedom `world-rows.js:53`).
- Seamless: compile every loadout program before the zone says ready (V1 `scripts/origins-seamless-check.mjs`).
- Layer change mid-fight = `moved`; spawn `kind` fixed at first engage, rotation needs pool ids.
- Phone loading and feel are judged on a phone, never desktop emulation (Armagedom AGENTS.md:35).

## Owners and order
V3 Dev: phases 1 to 3 in order, each its own PR set, Dom's phone gates each. Physics Dev: corpse tap cue, cut rows,
limb flight. OpenTrident: bodies only. No armour, no stage work. Every number a row; `check:as-data` style gate from
day one (V1 has it, Armagedom's is narrower; take V1's).
