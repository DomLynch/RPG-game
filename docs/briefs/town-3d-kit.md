# Concord Exchange (zone 0): 3D kit to replace the greybox (Characters, 2026-10-22)

Style reference: Dom's 2D plate (`docs/art/town-backdrop-dom-2026-10-21.png`, `lead/town-plate`): pale weathered marble, aged bronze and gold trim, crimson banners with a crest, gilded fire bowls, stone balustrades, armoured heraldic lions.
Route (same as the Zone 2 creatures): FLUX.1-dev picture (`scripts/character/t2i.py`) -> TRELLIS.2 (`scripts/character/trellis2.py`) -> Blender remesh + atlas bake to a phone LOD (`scripts/character/kit_lod.py`, `kit-lod-color.mjs`) -> `pack-world-body.mjs` (meshopt). Both models are free ZeroGPU Spaces driven from the Mac: no HF dollars, no T4.

## Inventory (from `origins/zones/plan-rows.json`, zone `exchange`: 215 pieces, 4 awnings, 14 figures, 6 braziers, 2 marks)

Anchors (world metres, Pit centre = origin, gate toward -z): outer gate z -25; covenant stone z -45; contract board; forge (smithy) x -12 z -62; bank z -67/-72.

| # | Kit piece (row id) | What the greybox has | Count | Footprint / height (m) | Style source |
|---|---|---|---|---|---|
| 1 | `town-column` fluted column + stepped plinth | stoa colonnades: 16 plinths + 16 shafts (r 0.3, h 4.4) + 16 capitals, both stoas (x +-12..14, z -30 to -60) | 16 | 1.4 x 1.4 x 5.2 | plate: colonnades flanking the steps |
| 2 | `town-pier` heavy pier | 8 big piers (r 0.5, h 8.2) at the bank front | 8 | 1.5 x 1.5 x 8.2 | plate: tall pillars either side of the arch |
| 3 | `town-brazier` gilded bowl on marble pedestal | 6 braziers (iron cylinders + coal) at the gates, stone and bank | 6 | 1.0 x 1.0 x 2.0 | plate: fire bowls on pedestals |
| 4 | `town-lion` armoured bronze lion on plinth | none yet (stone/bank flanks) | 2 | 3.0 x 2.0 x 4.5 | plate: the two lions (signature, Dom's designers later) |
| 5 | `town-banner` crimson standard on pole | 24 iron spheres + 16 thin poles (2.3 m) | 16 | 0.8 x 0.2 x 3.5 | plate: banners on every column |
| 6 | `town-stoa-wall` back wall + cornice + balustrade run | two long walls (31.5 m, 5.2 m high) and kerb | 2 modular runs | 3.0 m module x 5.2 | plate: stone balustrades |
| 7 | `town-steps` bank steps (4 tiers) + pediment | bank front: 4 stepped slabs 26 x 12 m, pediment, frieze board | 1 set | 26 x 12 x 3.4 | plate: central stair |
| 8 | `town-bank` facade | box 24 x 12.5 x 6, 13.8 m high with arches | 1 | 24 x 6 x 12.5 | plate: central temple |
| 9 | `town-stone` Covenant Stone dais + obelisk | 2 discs r 2.6/1.9, pillar 1.1x6.2, cone | 1 | r 2.6 x 7.9 | plate: glowing core under the arches |
| 10 | `town-smithy` forge | 13 pieces: back wall, hearth, chimney, anvil, rack | 1 | 5.6 x 6 x 7.5 | warm, bronze + soot |
| 11 | `town-stall` market stall + awning | 4 awnings (crimson) over counters | 4 | 2.6 x 1.2 x 2.35 | plate: cloth + wood |
| 12 | `town-gate-arch` outer gate + passage portal | 4 box passage + gate lintel at z -25 | 1+1 | 3.9 x 9.6 x 5.8 | plate: arched gates |
| 13 | `town-board` contract board | thin board + posts | 1 | 3.1 x 1.5 x 1.5 | wood + iron |
| 14 | paving (`town-paving-a/b/c`) | 18 flat pavers + the 40 x 47.5 slab | tiles | 1.2-2.8 m | plate: cracked marble with glow seams |

Not for this lane: the 14 figures (NPC rows, World/Characters humanoid route), the frieze text mark, the sky plate (exists).
Instanced pieces (1, 2, 3, 5, 6, 14) are the phone win: a handful of meshes drawn 16-18 times. One-offs (4, 7-13) are the signature set Dom's designers may redo later; we ship the AI version first.

## Data layer (Dom, standing 2026-10-13): no placement or number in code

Placement already lives in plan rows (`origins/zones/plan-rows.json`: each piece = x, y, z, rotY, shape, tint). The change is that a plan row may name a `kit` model instead of a box shape:

- `origins/world/building-skins.json` models[] (existing, registry-loaded, manifest `optional: { lod: object }`): one row per kit piece = `{ id, url, nodes, lod: { url, dist }, budget: { tris, textureKb } }`; `budget` is checked by `npm run check:phone-budget`.
- A plan piece row gets `"skin": "<model id>"` and keeps its x/y/z/rotY/scale; the greybox `shape` stays as the fallback when the glb is missing, and is the collision/footprint source until World re-pins.
- Engine change (Web/World owns it: `exchange.ts` draws a skinned piece through the same InstancedMesh path the Zone 1 kit uses). I own the glbs and the rows only, same split as the Zone 1 kit LODs.

## Budgets (as the Zone 2 LODs)

Near mesh <= 4000 tris (instanced), LOD <= 1200 tris at `dist` 35, one 512-2048 atlas per piece, total town kit <= the phone-budget line for a zone (Web names the cap; start at the Zone 1 kit's). One-offs: bank facade <= 9000 near / 2500 LOD.

## Order of work

1. Style proof (this PR draft): column, brazier, lion stills + GLBs.
2. Instanced set: column, pier, banner, brazier, balustrade module, paving.
3. One-offs: steps, bank, stone, smithy, stalls, gate arch, board; lions re-rolled to bronze to match the plate.
4. Rows + budgets + as-data gate line first in the PR body; evidence stills at 375 wide.
