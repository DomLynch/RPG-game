# origins/world — world parameters as data

How Frankendom: Origins builds a world of any size from data. A zone is the defaults plus whatever its region and its own file change.
Every number that sets scale, layout and feel is a typed, ranged, defaulted field in one table, `SCHEMA` in `schema.ts`. Pure TypeScript.
Nothing here ships yet: the greybox and the server will read it later.

| file | what |
|---|---|
| `schema.ts` | the 15 groups (fields, units, ranges, defaults), cross-field `CHECKS`, the read-only `CAMERA` |
| `resolve.ts` | `loadWorld` (version and migrations), `resolveZone` (the layering), `resolveRegion` (zones and the links between them) |
| `derive.ts` | `toMetres`, `place`, `toWorld`: relative layout → metres → world |
| `generate.ts` | `generateZone(template, seed, overrides)`, `generateRegion(template, seed, n)` (seeded, deterministic) |
| `concord.ts` | content: the Pit yard and the Concord Exchange, matching today's greybox to 1 cm |

Tests: `node --test tests/origins-world.test.ts`.

## The 15 groups

Units: **u** is a world unit. It goes through `scale.metresPerUnit`, so place lengths rescale together. **m** is metres. It does not
rescale, because body, camera and ground heights are real sizes (the hero stays 1.8 m). Layout is never in metres: a landmark is (u, v)
in 0..1 of its zone.

| # | group.field | unit | default | range | drives |
|---|---|---|---|---|---|
| 1 | scale.metresPerUnit | m/u | 1 | 0.25–4 | every place length (zone size, layout, passages) |
| 2 | movement.walkSpeed | m/s | 2.3 | 0.5–6 | walk speed (greybox WALK) |
| | movement.runSpeed | m/s | 4.6 | 1–12 | run speed, must be ≥ walk |
| | movement.turnRate | rad/s | 1.9 | 0.5–6 | turn rate (greybox TURN) |
| 3 | reach.interactRadius | m | 3 | 0.5–10 | talk/open prompt (greybox: 3 m from forge and bank) |
| | reach.pickupRadius | m | 1.5 | 0.25–5 | loot pickup |
| 4 | zoneSize.width / depth | u | 50 / 50 | 10–2000 | zone footprint (x across; depth from the entry edge) |
| 5 | layout.‹name›.u / v | 0..1 | 0.5 / 0.5 | 0–1 | landmark position in the zone |
| | layout.‹name›.facing | deg | 0 | −180–180 | 0 faces inward, +90 faces left |
| 6 | passages.‹id›.from | landmark | (required) | — | the corridor starts there and runs along the landmark's facing |
| | passages.‹id›.width / length | u | 2.5 / 10 | 1–50 / 0–500 | gate and corridor size; width ≤ zone width |
| 7 | view.drawDistance | m | 180 | 20–180 | cull/LOD distance; capped by the frozen camera far plane |
| | view.fogNear / fogFar | m | 5 / 107 | 0–500 / 1–1000 | fog ramp; near < far |
| | view.backdropRadius | m | 40 | 10–180 | painted far-world ring; ≤ drawDistance |
| 8 | density.npcs / props / creatures | per 100 m² | 0.5 / 0.5 / 0.2 | 0–10 / 0–20 / 0–10 | how full the zone is (counts = density × real area) |
| 9 | spawns.respawnSeconds | s | 300 | 5–86400 | respawn delay |
| | spawns.boss | landmark | none | — | boss anchor |
| 10 | ambience.preset / weather / sound | id | ash-pit / dust / wind | id | look and sound only, never rules |
| | ambience.dayNightSpeed | × | 0 | 0–1000 | day/night clock vs real time (0 = frozen) |
| 11 | connections.‹id›.to | zone | (required) | zone in region | linked zone |
| | connections.‹id›.kind | enum | gate | gate, road, portal | link kind |
| | connections.‹id›.here / there | landmark | (required) | — | the landmark on each side |
| | connections.‹id›.twoWay | bool | true | — | the target must link back between the same landmarks |
| 12 | terrain.biome / ground | id | ash-waste / sand | id | biome, ground surface |
| | terrain.heightMin / heightMax | m | 0 / 0 | −500–2000 | ground height range; min ≤ max |
| 13 | rules.safe / pvp | bool | false / false | — | no PvP or hostile spawns / open PvP; never both |
| | rules.restAllowed / tradeAllowed / mountsAllowed | bool | true / true / false | — | what the zone allows |
| 14 | difficulty.levelMin / levelMax | level | 1 / 1 | 1–100 | the creature level band (the one band; spawns does not repeat it) |
| | difficulty.lootTier | tier | 1 | 1–10 | loot tier, the ten title tiers |
| 15 | economy.vendorTier | tier | 1 | 1–10 | vendor stock tier |
| | economy.buyMultiplier / sellMultiplier | × | 1 / 0.5 | 0.1–10 / 0–10 | prices; sell ≤ buy |

Ids (presets, biomes, landmarks, zones) are lowercase `a-z0-9-` and start with a letter. Regions are `region:` ids (`origins/contracts/ids.ts`).

**Camera: read-only.** Dom froze the camera. `CAMERA` exposes today's framing as frozen constants: fov 51°, near 0.1 and far 180
(`src/scene.ts`), the walker's follow camera (back 5.2, height 2.7, look 3 m ahead at 1.5 m) and the passage camera (back 3.4, height 2.1,
`src/camera.ts` GATE_CAM). No world data can change them. `view.drawDistance` and `view.backdropRadius` are capped by the far plane.

## Layering

`resolveZone(data, regionId, zoneId)` merges four layers: the schema defaults, then `data.world`, then the region's `params`, then the
zone. Each layer is a partial object and is deep-merged field by field. Landmarks, passages and connections merge by name, and field by
field inside one entry. The merged result is validated as a whole: unknown groups or fields, wrong types, out-of-range values, dangling
landmark refs and the cross-field rules all come back as `Result` issues with paths (`origins/contracts/core.ts`). Unknown or hostile ids
(`__proto__`, `constructor`, a bad namespace) are refused. Lookups use `Object.hasOwn`, and a JSON `"__proto__"` key is refused as data.
`resolveRegion` resolves every zone and then checks the links: the target exists, its far landmark exists, and a two-way link is answered.

## Adding a region or zone

Write data, not code. Add the region under `regions` with an optional `params` layer and its `zones`. In each zone, write only what
differs from the defaults: size, landmarks as (u, v, facing) and anything else it needs (see `concord.ts`). Run the tests. A seeded zone is
`generateZone({ base, vary: { 'zoneSize.width': [60, 400], … }, jitter }, seed, overrides)`. Any numeric field can vary within its
range, landmarks jitter by ±jitter, and the result is validated like authored data. The same seed always gives the same zone.

## Adding group #16

Add one entry to `SCHEMA`: the group, its fields, and a default for each. Nothing else changes. Validation, layering, defaults and
generation read the table. Existing zone files do not mention the group, so they resolve with its defaults, untouched; `resolve.test.ts`
proves this with a dummy group. Add a `CHECKS` line only for a rule that spans fields. Bump `SCHEMA_VERSION` and add a `MIGRATIONS[v]`
function only when stored data changes meaning: a rename, a unit change or a split. A new group with defaults needs neither.

The greybox reads this data: `origins/preview/exchange-plan.ts` places the walk out from `concordMounts()` and the Exchange's
landmarks, and `origins/preview/exchange.test.ts` pins every piece to the pre-switch greybox within 1 cm.

## Not done

- Server-side world data: storing and serving it, and server authority over `rules`, `difficulty` and `economy`.
- Links across regions: connections are inside one region; the contracts' `RegionDefinition.portals` cover the region graph.
