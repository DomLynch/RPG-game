# The Pit as a live zone: one-page design (Lead, 2026-10-21)

Dom's ruling of 10-21 19:4x-19:5x (docs/SCOPE.md, item 7): the gladiator Pit becomes a walled live area like Zones 1-2. It is ONE zone with TWO rooms:
- a SAFE boss yard where new players start, with bosses spawning at the gates;
- a walkable PvP duel room.

Town is always PvP off. Every other zone is per-player PvP opt-in, which can be changed once per 24 h and never during combat. The instanced live-duel stack is parked. This page fixes the shape before lanes start. Every number below is a data row, never a literal in code.

## What exists today (trunk, read 2026-10-21)
- `origins/zones/schema.ts:53` declares `safeAreas` (list) and `pvp` (`off|on|opt-in`). **Nothing reads either one**, and no row sets them.
- The older `origins/world/schema.ts:114` `rules.safe` IS read: a safe zone gets no creatures (`origins/mobs/populate.ts:26`).
- **The Pit has no zone row.** `pit-yard` is a safe zone with 0 creatures inside `origins/world/concord.json:17`. The Pit fight itself is the main-game scene (`src/main.ts:320`, `?opponent=`).
- **Respawns** are per row (`respawnSeconds`, server clock in `origins/server/world-spawns.ts`, dynamic respawn floor 15 s). There is **no scheduled boss spawn and no world shout** (presence has no system message).
- **Ladder marks** come only from verified Pit `loot_claims` (`supabase/migrations/202609230001_server_awards.sql:99` `standing_of`). World kills are verified and damage-share credited in `kill_report` (`world-spawns.ts:244-294`), but they never become a mark.
- **Open-world PvP code** exists but is switched off: `src/fight/world.ts:78` has a per-fighter `pvp` flag, and `:149` `attackable` checks the level gap and the newcomer shield. Nothing sets the flag, and nothing handles `Aggressed`.
- **Duel links** (`src/net/lobby.ts:13`, `?duel=<token>`) open the relay duel inside the Pit scene.

## The design
1. **One zone row, "The Pit"** (`origins/zone-rows/`), on the zone-row path like Zones 1-2. It holds walls, the bridge entrance from town, the gate points and a walkable exit to the duel room. The zone's `pvp` is `on`. The yard is a `safeAreas` entry with `pvp: off`, so the default is PvP and the yard is the carve-out. Donor: rathena mapflags (a town/nopvp volume inside a pvp map).
   - safeArea entry shape (new, data): `{ id, name, shape: "rect", min: [x,z], max: [x,z], pvp: "off", spawnsAllowed: true }`.
   - The server decides which area a player is in from the position presence already holds. The client only draws the border.
2. **Gate bosses** are a new spawn-row kind, `scheduled`: `{ kind: "scheduled", rotation: [opponent ids], gate: <point>, everySeconds: 300, despawnSeconds, shout: <text row id>, level: <ladder level> }`.
   - The beta rotation is the 5 bosses of ladder levels 1-2. The Centurion (`veteran`) comes first, so a new player's first boss is the same one as fight 1 today.
   - The server's world-spawns clock schedules the bosses; it is the same table, with one more column for the rotation index.
   - Skeletons between gates are ordinary spawn rows. Donors: EQ/WoW spawn timers, and ModernUO champion spawns (minions around a timed boss, leash to the area). Pass on UO's waves and skull bar for beta.
3. **The shout** is a new presence frame `announce`, sent by the server only, with its text from a row. It reaches everyone in the zone and layer about 10 s before the gate opens. The client shows a one-line banner (Web).
4. **Loot and credit:** the existing damage-share credit, unchanged. Whoever earns the kill gets the loot.
5. **Yard boss kill = one ladder win.** In `kill_report`, after the verdict passes, write a `world_marks` row:
   - one per (account, spawn kill) for each player whose share is at least half the top share (ModernUO's qualify rule, relative to the top damager; the threshold is a row);
   - `standing_of` adds `world_marks` as a second source. It is capped by the beta max-rank row (levels 1-2), so it can't be farmed past the beta ladder.
   - This needs a migration, so APPLY-READY and Dom's own act on prod.
6. **Duel room:** PvP on, using the existing `attackable` rules (level gap and newcomer shield). The server sets `pvp` when a player enters the room and clears it when they leave; in the yard it is always off.
   - The share/duel link (`?duel=`) gains zone + layer and lands the invitee at the duel-room gate on the inviter's layer.
   - The relay duel stays parked, not deleted.
7. **Other zones (opt-in):** a per-player flag on the server with `changed_at`.
   - The flag can change once per 24 h (row), and the change is refused inside the aggro window (`world.ts:45` `AGGRO_WINDOW_S`). Donor: WoW's PvP-flag timer.
   - Town stays `rules.safe`. This is the last slice and not needed for the Pit itself.
8. **Phone budget:** the yard holds about 20 hunters per layer (the 10-19 ruling). The boss and its skeletons count against the same crowd budget as Zone 1, and the p95 ≤ 50 ms gate on Dom's phone applies to the yard too.

## Slices, owners, order (after Zone 2's look; each is its own PR)
| # | Slice | Owner | Notes |
|---|---|---|---|
| A | Wire `pvp` + `safeAreas`: the server sets the fighter `pvp` flag by area, plus tests | Backend | no visuals, unblocks B and F |
| B | Pit zone row: walls, bridge entrance, gates, yard safeArea, duel-room exit, entry point = new-player start | World | stills in chat for Dom, no preview URL |
| C | `scheduled` spawn kind + rotation + skeleton rows; re-pin the Pit byte-identical guard (`origins/combat/open-world.test.ts:38`) under an RV bump | Combat | era-on twins for the live rule |
| D | `announce` frame + `world_marks` source in `standing_of` | Backend | migration: APPLY-READY, then Dom applies |
| E | Shout banner; duel link lands at the room gate | Web | 375 portrait stills |
| F | Opt-in flag with the 24 h lock in other zones | Backend + Web | after the Pit ships |

**Decided here (Lead):**
- Credit for a boss kill uses ModernUO's relative threshold (½ of the top share), not a fixed percentage.
- The yard is the safeArea, rather than making the duel room the PvP area, so that PvP is the zone default and the carve-out is the safe place.

**For Dom:** nothing blocks the start. His Zone 2 look pick comes first in the order.
