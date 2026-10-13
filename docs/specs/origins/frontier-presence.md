# Origins — frontier-zone presence (design spec)

Backend lane, 2026-10-13, for Lead / Strategy / Web. Status: **design, nothing built**. Lead rules; Web builds the client side. Numbers marked *est.* are planning figures.

**Problem.** Presence (`origins/presence`) knows one 300 m square (`zoneCm 30000`, frame centre `CENTRE_CM 15000`, Pit yard at the middle) and `zoneAt` knows only `pit-yard` and `exchange`. The frontier plan (`origins/preview/frontier-plan.ts`, 9 zones mounted on the town) lies outside that square: world x -334..25 m, z -205..150 m. A client standing there is clamped back into the town, `Where.zone` is blind, and saved locations fail the DB check `x between 0 and 30000`. So no server gate (kill_report reach, boss presence, Exchange) can be strict outside the town.

## 1. Donors, and what we take

| Donor | How it does it | Take |
|---|---|---|
| 2004Scape (`BuildArea.ts`, `ZoneMap.ts`) | World is 8x8-tile zones. Each player holds a `loadedZones` / `activeZones` set rebuilt around their centre zone; entities are indexed per zone and a player is only sent what is in their active set. | Per-zone entity index, and an interest set derived from the player's zone neighbourhood, not a global scan. We already do this with the 16 m cell grid; it is kept unchanged. |
| AzerothCore (`GridDefines.h`, `MapDefines.h`, `ObjectDefines.h`) | Map = 64x64 grids of 533.33 yd, each 8x8 cells; visibility is a per-object radius (about 100 to 250 yd) and a grid is loaded only while someone is in it. A map is an instance of a continent. | Zone-as-region on one continuous map, a visibility radius rather than "everything in the zone", and the instance/layer idea: a layer is a whole-world shard (town plus frontier), not a per-zone copy. We do **not** take lazy grid load (all zones are small and always resident). |

## 2. World frame

- One **layer** = the whole world (town + frontier), one frame, one grid. Layer cap (80 soft / 100 hard) is unchanged and counts the whole layer.
- Frame is metres with the Pit yard at world (0,0), as today. Only the **offset** moves: `CENTRE_CM 15000 -> 40000`. u16 cm then covers world x,z in -400..+255 m, which holds the town (-150..150) and the frontier union (x -334..150, z -205..150) with about 66 m margin on the long side. `zoneCm` becomes `65535` (the frame, not a zone).
- **Zones are rectangles in world metres**, listed in one table (`origins/presence/zones.ts`, generated from `frontier-plan.ts` mounts so the client and server cannot disagree): `{ id, rect, kind }`. `zoneAt(x,z)` returns the first containing rect, else `road` (a passage), else `null`. The saved `zone` string is that id (`frontier-<n>`), so `where()` and `inZone()` work for every existing caller unchanged.
- **Persistence.** Saved locations stay in the frame they were written in. Migration `00xx` relaxes `x,z between 0 and 30000` to `0 and 65535` and adds `frame smallint not null default 1`; rows with frame 1 are shifted by +25000 cm on read in the writer. No data is rewritten.

## 3. Clamp and speed, per zone

Same speed model as today (`maxSpeedCmS`, `speedSlack`, strike window), now with a **per-zone cap** `{ walkCmS, runCmS }` (e.g. 0.8x in swamp, 1.0x town; *est.*).

1. A pose must lie in the town square, a frontier zone, or the west-road passage. Else the player **keeps the last accepted pose** (the same "snapped" answer as a speed breach) and it counts one strike; there is no nearest-point projection.
2. Distance since the previous accepted pose is checked against the cap of the zone being **left** (the more permissive of the two at a boundary); over it = strike, same drop rule.
3. **Portals** (night boat, gates; `kind: portal`) are the only legal discontinuity: a pose jump is accepted if it goes between the two paired landmarks of one portal, at most once per 10 s, and only for an account whose last pose was within 5 m of the source landmark. Anything else is a teleport strike.
4. Pose age and "checked / unchecked" semantics are unchanged: the server reports `checked` when the account has a pose under 5 s old, which is what `kill_report`, boss presence and the Exchange read.

## 4. Interest and broadcast, per zone

- The 16 m cell grid is laid over the whole frame (4096 x 4096 cells fit `u16`; stored sparse, only occupied cells exist). Visual radius 40 m, tiered rates (10/5/2 Hz at 12/25/40 m) and the 40-entity nearest-first cap are **unchanged**; crossing a zone border does not change who you see, so two players either side of a road see each other.
- Zones add two **per-zone overrides**: `radiusM` (a cave or ring may shrink it to 25 m) and `quiet: true` (no broadcast out of the zone, used by the Pit and instanced-feeling spaces). Both default to the global rule.
- Speech keeps its radii (say 20 m, shout 40 m) and is not stopped by a zone border.
- A client leaving a zone gets a `zone` event once (below) so the HUD and audio can swap; no entity bookkeeping is sent.

## 5. Wire format (`frankendom.presence.v2`)

Binary, little-endian, as v1. The subprotocol string is bumped; the server offers v1 for the old town-only clients until Web ships, answered with the old frame (town 300 m square, poses clamped there).

| Frame | Dir | Bytes | Fields | Change from v1 |
|---|---|---|---|---|
| `hello` (JSON text) | down | n/a | `proto`, `frame:{centreCm:40000,sizeCm:65535}`, `zoneTableHash` (u32 hex), `selfId` | adds `frame`, `zoneTableHash` |
| `UP` pose | up | 8 | u16 x, u16 z (cm, **new origin**), u8 heading, u8 anim, u8 flags, u8 seq | none (offset only) |
| `DOWN` header | down | 4 | u8 type, u8 count, u16 tick | none |
| `DOWN` entity | down | 11 | u16 id, u16 x, u16 z, u8 heading, u8 anim, u8 flags, u16 seq-tick | none (offset only) |
| `zone` event | down | 4 | u8 type=0x20, u8 zoneIdx, u16 tick | **new**: sent to the owner when `zoneAt` changes |
| `portal` | up | 4 | u8 type=0x21, u8 portalIdx, u16 seq | **new**: asks to jump a paired portal |
| `snap` | down | 6 | u8 type=0x22, u16 x, u16 z, u8 reason (1 out of zone, 2 speed, 3 portal refused) | **new**: authoritative correction; client rebases |

`zoneIdx` / `portalIdx` index the zone table whose hash is in `hello`; a client whose own table hash differs must fetch `GET /origins/presence/zones` (JSON) before sending. Sizes of the hot path (UP, DOWN) are unchanged, so the bandwidth numbers in `one-shard.md` §2 still hold.

## 6. Order of work

**Data, not code (Strategy).** Per-zone speed multiplier, `quiet`, and portal pairs are **rows** (zone-row fields and a portal table in the zone table), so a new zone or a 1.2x zone is a data edit. Launch values: speed 1.0 everywhere, `quiet` only on the Pit, portals only the boat/gate landmarks `frontier-plan.ts` names.

**Acceptance test.** A bot sends v2 frontier poses. With `ORIGINS_SPAWN_REFUSE_UNCHECKED=1`, a kill reported from inside a Frontier zone still pays, and a kill reported from outside that zone is refused. Step 1 proves it in a test; the production flip waits for Web's v2 client.

1. Zone table + `zoneAt` + frame constant + clamp rewrite, with the v1 shim and tests (presence side, one PR).
2. Migration relaxing the location check + frame column; writer read shift (own migration, own PRE).
3. Web: v2 client, zone table fetch, `snap` handling.
4. Flip `kill_report` and boss presence `refuseUnchecked` to strict once frontier poses are `checked` in production.

**Ruled (Lead, 2026-10-13):** 1.0x speed in every zone at launch; portals are only the boat/gate landmarks `frontier-plan.ts` names; `quiet` = the Pit only.

**Limits.** The v2 frame ends at +255 m (x or z). Anything east of that, or any layer wider than 655 m, needs a v3 frame.
