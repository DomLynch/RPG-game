# Pit → live dungeon zone: what Frankendom did (for OpenTrident V2)

Lead, 2026-10-25. Facts read from DomLynch/RPG-game trunk `codex/01a09a76/task-1` (live 82a994d15) unless marked OPEN PR. "(inferred)" = not read directly. Copy, don't redesign.

## 1. From instanced to live
- **Old Pit (instanced):** one player against the ladder inside the main game scene (`src/main.ts`, `?opponent=`), with the gate-lift and skull-wall room (`docs/state/pit.md`). Live PvP went through `scripts/duel-relay.mjs`: signed two-sided rooms that only forwarded bytes peer to peer (lines 1-13). The relay never ran the fight, and room minting was off by default (`DUEL_RELAY_PLAYERS=1`, line 20). The live-zone design parked it.
- **A zone is one data row:** `origins/zone-rows/zone7.row.json`, with alias `dungeon1`, band [1,10], an entry point, an exit `yard-gate` back to the town (zone 0), `pvp:"on"`, and two areas: `yard` (safe: pvp off, no spawns) and `duel-pit` (pvp on). The validator is `origins/zones/loader.ts:46-47,132`; the row keys are in `from-row.ts:6`. **The internal id is the string `"7"`**, and spawn keys look like `z7:...`.
- **Who owns the opponents:** the writer service (`origins/server/world-spawns.ts`) together with the DB. It holds alive/respawn state per spawn key per layer (`spawn_state` l.153, `engage` l.171, which returns hp and a generation, and `kill_report`). The level rings are L1-3, L4-6 and L7-10, three legends each (e177ef0f4). Rotating legends per generation (`legendAt(pool,campKey,gen)`, DB kind `pool:<group>`) exist only in OPEN PR #3627.
- **Drop in and out:** `origins/presence/interest.ts:42-65`. A player joins a friend's layer if it has room, else the fullest layer under the soft cap, else a new layer. Soft cap 80, hard cap 100, up to 20 layers; an empty layer closes after 300 s (`presence-rules-defs.json`). Guests are allowed (64 max) and never saved (`server.ts:46,98-100`). The writer asks presence where a player is (`/internal/where`, `server.ts:148`). `spawn-janitor.ts` deletes closed layers' spawns once a minute.
- **What each side carries:** presence carries position, heading, animation, flags, enter/hello/worn frames, zone and layer, and NO creature health. The writer and DB carry spawn state, single-use engage tokens, the damage ledger and the ladder marks.
- **Rates:** presence ticks every 100 ms. Nearby players get every tick, farther tiers every 2nd and 5th tick. Heartbeat 2 s, idle 30 s. The janitor and the marks settle run every 60 s.

## 2. Shared health: what Dom remembers going wrong
- **Health lives on each phone:** "each page plays its own copy of the creature until a shared server health bar" (`origins/server/damage-share.ts:5`). The server sends `hp` at engage and only bounds-checks the kill (`world-spawns.ts:46-51`).
- **How credit is settled:** `shares()` (`damage-share.ts:12-26`) counts replay-verified damage, capped at full health.
  - A player qualifies at ≥ 0.25 of the top damager, and a hit counts for 120 s (`server-rules.json` l.127-134).
  - A late kill report can join within a 120 s window if its token was opened before the kill (migration `20261019113226_origins_damage_share.sql`, table `origins_spawn_damage`).
  - Ladder marks settle once the window closes (`world-marks.ts`, PR #3587).
- **THE BUG, still OPEN by design:** anyone whose own damage reaches full health gets 100%. Two players hitting "the same" opponent are really each fighting their own copy, so both kill it and both are paid in full. No fix exists; the fix is a server-held health bar, which also means changing `shares()` and the engage flow.
  - **Interim V1 fix (Dom 10-26):** PR #3654 removes the solo-kill exception, so a full-bar joiner gets damage/total (0.5 beside another full bar) instead of 100%. V2 rule: health lives on the server and shares always total exactly 1.
- **Other incidents, all fixed:**
  - Zone 0 silently stored as zone '1': fixed in 0eee36dc5 (#3589), live on prod per c9af03f69.
  - The settle function was granted to only one of the two writer roles ("permission denied"): fixed in ca23e46c5.
  - The rotating-camp seamless check went red: fixed inside #3627, which is NOT merged.
  - Double kills: none found. A re-sent report is refused with 409 `used`.
  - Moving to another layer mid-fight: refused as `moved` (`world-spawns.ts:203-208`).

## 3. Pieces worth copying
- **Safe yard + PvP duel room:** the zone 7 row, plus `origins/zones/pvp.ts` (`pvpAt` l.43, `applyPvp` l.51).
- **The gate pair:** yard-gate ↔ the town's outer gate (zone0/zone7 rows), plus the yard door arch (b8fd38133).
- **Dungeon framework:** room graph, encounters and boss in `origins/zones/dungeon.ts` + `dungeon-rows.json` + `dungeon-themes.json` (#3101). Enclosure walls and gate arches are in OPEN PR #3131.
- **Quiet areas:** only players inside see each other (`interest.ts:126-129`, `town-zones.json:4`).
- **Ladder marks:** `origins/server/world-marks.ts` + migration `20261022100000`.
- **Pit room art:** `docs/character-references/pit/`, `src/pit/skulls.ts`.
- **Never built:** gate bosses as a scheduled spawn, cages, live-zone spectating.
- **Design page:** `docs/specs/origins/pit-live-zone.md`, only on OPEN PR #3561.

## 4. Don't copy
- **Health per phone.** Hold opponent health on the server from day one, as one authoritative health bar per opponent per layer, and broadcast it through presence. This is the root cause above.
- **The two-service split and replay checking, at the start.** Presence + writer + definer SQL + fight-record replay is heavy (inferred). Start with one authoritative room server that runs the fight tick.
- **The parked duel relay**, which forwarded bytes without running the fight.
- **Traps if you do copy parts:**
  - `applyPvp` has no caller (`pvp.ts:2-3`), so the duel room's PvP flag isn't enforced.
  - DB spawn `kind` is fixed at the first engage, so rotation needs pool ids.
  - Every new DB function must be granted to every server role.
  - Zone ids are strings; `z01:` is refused.
  - The 80/100 caps are too big for a ~20-player yard, so a per-zone cap would be new work (inferred).
