# Arena v1 — The Ashpit (world lane, 2026-09-17)

Branch `world/arena-v1` on trunk `codex/01a09a76/task-1` at 9d08824. Owner direction: sand and gravel like a traditional coliseum floor,
no tiles. Files: `src/arena.ts`, `src/assets/arena/textures.ts`, `scripts/arena-preview.mjs`, `tests/arena.test.ts`, `src/assets/README.md`,
`artifacts/world/**`, PROJECT_STATE. Nothing else touched; `scene.ts` unchanged.

## Before / after (identical camera, exposure, rigs, settle; `scripts/arena-preview.mjs`)
| | baseline (`baseline/`) | arena v1 (`arena-v1/`) |
|---|---|---|
| portrait lock 393×852 | `baseline/lock-portrait.png` | `arena-v1/lock-portrait.png` |
| landscape lock 852×393 | `baseline/lock-landscape.png` | `arena-v1/lock-landscape.png` |
| establishing | `baseline/wide.png` | `arena-v1/wide.png` |
| plan (exclusion volume by eye) | `baseline/plan.png` | `arena-v1/plan.png` |
| mood board | — | `moodboard/swatches.png` |

| resource | baseline | arena v1 | cap |
|---|---|---|---|
| shell gzip (check-budget, clean builds) | 783,978 | 793,768 (**+9,790**) | arena ≤ 600 KB |
| fight-ready gzip | 8,244,187 | 8,253,977 | < 9,000,000 |
| meshes (= draw calls before shadows) | 263 | **12** (+235 crowd instances in 4 meshes, 8 banners in 1) | ≤ 40 |
| draw calls, arena only, portrait lock (with shadow pass) | 330 | **15** | — |
| draw calls, arena only, wide | 486 | 15 | — |
| triangles built | 4,424 | 19,428 | ≤ 120,000 |
| triangles rendered, arena only, portrait | 6,048 | 27,608 | — |
| textures / memory with mips | 0 | 6 / 9.6 MB | ≤ 12 MB |
| floor albedo (texture × material colour × mean vertex tint) | ≈ 0.24 (`#878579`) | **0.088** | < skin 0.166, < 0.35 |
| `buildArena` (desktop) | 3 ms | 176 ms (texture generation) | — |
| `update` per frame (Node, 235 spectators + 8 banners) | 0 | 0.016 ms | — |

## What was built
- **Sand and gravel floor** (the owner's call): a 1024² generated albedo (dusty ochre, damp mottling, grain, ~2,600 grey/brown pebbles, a few
  bone chips) and a 512² normal map (ripples + the same pebbles as domes), tiled every 3 m, on a 36-ring disc whose vertex colour carries
  large-scale mottle and contact darkening toward the wall's foot. Under test 2 nothing may rise inside the play circle, so gravel and
  half-buried stone inside 8.55 m are texture only; real rubble sits in the band 9.9–11.4 m under 0.5 m. The boundary is a dark trodden inlay
  at the play radius. `floor` is exposed for decals.
- **Podium wall** (inner face 11.7 m, outside the camera clamp; 2.6 m) of generated ashlar with ash tint and soot; the **gate** on the far side
  (posts, lintel, iron portcullis, dark passage), **chains** with shackles on the wall, **six braziers** with emissive coals that flicker and
  flare on a blow (no lights), **eight torn banners** (instanced; blood and bone cloths) swaying on iron poles.
- **Five broken tiers** climbing from the wall to 6.6 m with collapse driven by a periodic noise (upper tiers fall away, fallen blocks on the
  collapsed treads), a **ruined colonnade** on the top walkway (whole columns with capitals, broken stumps, gaps where the ruin is deep),
  and a **parapet** with a broken top.
- **Crowd**: 235 silhouettes (crossed alpha-cut quads, four outlines, per-instance ash tints with a few blood/ochre cloths) on the upper
  three tiers only — the two lowest are broken and empty, which keeps every spectator ≥ 5 m from the lock camera. Reactions from the
  event stream: a bob on Hit / GuardBroken / PostureBroken, a lean-in on Parried, a recoil on Killed; ≤ 0.1 m and ≤ 8° (tested), still in a
  hit-stop (dt 0, tested), an idle murmur of 1.2 cm.
- **Sky**: an ash dome (unfogged; horizon painted the fog colour, one break of light at the sun's azimuth, no pole vertex) and two rings of
  fogged mesas on an ash plain that now runs under the tiers.
- All static geometry merged per material (sand, boundary, stone, iron, coals, plain, sky); everything generated from code — no downloads,
  no licences, no runtime dependencies (`three/addons` BufferGeometryUtils only).

## Contract (tests/arena.test.ts, 7 tests; 5 mutations caught)
Play radius = sim RADIUS · nothing above the floor inside the circle and nothing 0.5–6 m high inside the clamp, **every crowd/banner instance
included** (a pillar at 2 m: caught; wall moved to 11 m: caught) · a boundary RingGeometry at the radius · floor is sand, albedo product below
the skin sample and below 0.35 (white material + 1.5× tint: caught), flat to the clamp, planar decal UVs · crowd on the tiers outside the
clamp, reactions within 0.1 m / 8° (0.16 m bob: caught), a hit-stop holds it (time advancing at dt 0: caught) · update/dispose · ≤ 40 meshes,
≤ 120k triangles, ≤ 12 MB textures.

## Gate
`npm run quality` 223/223, `npm audit` 0, budget PASS, real-browser gate passed on the new arena (parry, riposte, kick, GPU loss/restore,
blood modes, controls). Sand generation and the crowd's per-frame matrices are the only runtime costs added; both measured above.

## Not done / next
- Phone measurement (no route from this lane; REQUESTS.md #4). The two numbers to watch: startup (texture generation) and fill rate of the
  sand disc + sky dome.
- Lighting values are the lead's; proposal in REQUESTS.md #3. Baked lightmaps are not needed for v1 (contact shade is in vertex colour).
- Rename (REQUESTS.md #1). Crowd silhouettes are deliberately crude at ≥ 15 m; a second atlas row and seated poses are a v2 item.
- Names proposed: **The Ashpit** (used provisionally), Worldsedge, The Bonehollow.

## Self-audit (one pass, after the PR opened)
Found and fixed in the same PR: the banner cut mask sat in the alpha channel only (three.js reads an `alphaMap` from green — the cloths
rendered as rectangles); a see-through gap above the gate where tier 0's riser was skipped; a UV seam at angle 0 on every riser (the arc
UV now closes on a whole tile); `dispose()` did not release the instanced buffers (`InstancedMesh.dispose()`). Recaptured; numbers unchanged.
Frame time in headless Chromium on the owner's Mac: baseline 60 fps · p95 17 ms, arena v1 60 fps · p95 17–18 ms; load 797 → 1072 ms.
Browser gate on this arena: 3 of 6 runs against trunk's 4 of 4 — traced to the gate's own PNG screenshots pausing the page ~150 ms
each on this high-entropy frame (REQUESTS.md #0, with the measurements); with JPEG diagnostics 3 of 3. Arena runtime cost is not the cause.
