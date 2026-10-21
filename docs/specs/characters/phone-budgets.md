# Phone-tier asset budgets (proposal, 2026-10-21)

Owner: Characters. Status: proposal for Lead (Dom's study list, item 3). Rows + a check script (like `check:as-data`) are the PR after this note.
Donor: CS2 + Unity / Unreal mobile guides, budgets read (numbers only, no asset taken).

## 1. References

**CS2** (Dom's private reference sandbox, 10 extracted agent models, measured by `scripts/glb-budget-stats.mjs` on the VPS, numbers only): LOD0 PC characters, 13.5k-30.1k tris (median about 22k), skinned verts 9.4k-53k, **86-94 joints**, 4 influences, **5-7 draws**, 4-6 materials, 12-20 texture maps at 1024^2 or 2048^2. That is a PC ceiling, not a phone target: 4x our joints-per-draw and 2-4x our texture size, but few draws.

**Mobile guidance** (no mobile-first game is extracted in the sandbox: the mir4 and albion folders are empty, so these are engine-vendor guides, old but the only primary numbers I could source):
- Unity manual, "Modeling characters for optimal performance": mobile **300-1,500 polygons per mesh**, **under 30 bones**, **2-3 materials per character**, **one skinned mesh renderer** (two skinned meshes roughly double the render time).
- Unreal (UE3 mobile guide, UE4 content standards): default **75 bones**, **2 vertex influences**, **65,535 verts per mesh**, every mesh and every material is a draw call.
- Unverified third party (mocap vendor guide): 512 or 1024 textures per character, 1-3 draws, under 40 bones.
Those are 2011-2018 numbers for phones a fifth of today's; our measured scene runs well above them (see section 2) and still holds p5 59.5 fps at no throttle on the T4 phone tier, so the proposal below sits between the guides and what ships.

## 2. Measured today (live K6l, Zone 1, iPhone UA + coarse pointer; wire = bytes that crossed the wire, gzip, 90 s capture of 177 responses: **16.5 MB total, 13.5 MB of models, 1.3 MB images, 1.2 MB js**)

File numbers count every mesh in the GLB (a file holds pieces not all worn at once).

| Asset (file) | tris | skinned verts | joints / inf | draws | tex | wire KB |
|---|---|---|---|---|---|---|
| Hero `warrior` | 63,572 (file) | 33,669 | 65 / 4 | 19 | 31 maps, 13 mats, 256^2 png/jpg | 1,931 |
| Gear library `loot` (fetched at 5.3 s, before ready) | 104,605 | 77,831 | 65 / 4 | 99 | 26 maps, 22 mats | 2,056 |
| Ranked creature = bare `goblin-bare` + look `goblin-L4` | 8,000 + 30,527 | 9,966 + 36,754 = 46,720 | 65 / 4 | 1 + 12 | 1024^2 webp / jpeg, 5 mats | 814 + 2,038 = 2,852 |
| Plain creature `world/goblin` | 7,999 | 12,100 | 65 / 4 | 1 | 1 x 1024^2 webp | 713 |
| Weapon `longsword` | 2,991 | - | - | 2 | 512^2 jpeg | 145 |
| Weapon `gladius-crafted` | 1,884 | - | - | 1 | **1024^2 PNG (959 KB)** | **1,065** |
| Weapon `bow-v1` | 3,000 | - | - | 1 | **512^2 PNG (480 KB)** | **611** |
| Weapon `staff-v1` | 2,864 | - | - | 14 | none | 25 |
| Kit prop `goblin_hut` / `_tower` / `_gate` | 9,000 / 6,999 / 4,999 | - | - | 1 | 1 x 1024^2 jpeg | 537 / 433 / 369 |
| Kit prop `goblin_spikes` / `torch_sconce` | 9,640 / 1,472 | - | - | 1 | 512^2 jpeg / 3 x 1024^2 webp | 327 / 280 |

Runtime (T4, iPhone tier): a ranked creature near the hero draws 45,664 skinned verts (bare Skin 9,966 + look 35,698); at 30 m, with #3474, 33,932. In-camera at ready+3.5 s (before #3441/#3450 and the cap): 325,988 tris, 110 draws.

## 3. Proposed budgets (phone tier, per instance on screen)

Basis: the guides for the shape (one skinned set, few materials, bones near the rig's 65), our measured frame data for the size (phone p5 59.5 at no throttle with cap 3, 15-20 at 4x CPU, so no headroom to raise anything above today's good assets).

| Class | tris | skinned verts | joints / inf | draws | textures | wire KB (gzip) |
|---|---|---|---|---|---|---|
| Hero (drawn set) | 40,000 | 40,000 | 65 / 4 | 15 | 1024^2 max, WebP/JPEG, no PNG | 1,500 file |
| Ranked creature (bare + look, drawn) | 30,000 | 30,000 | 65 / 4 | 10 | 1024^2 max | 800 bare + 1,500 per look |
| Plain creature | 10,000 | 12,000 | 65 / 4 | 1 | 1 x 1024^2 WebP | 800 |
| Weapon | 4,000 | - | - | 3 | 512^2 (one 1024^2), WebP/JPEG, **never PNG** | 250 |
| Kit prop | 10,000 | - | - | 1 | 1 x 1024^2 | 450 |
| Gear library (per worn piece, not one file) | 6,000 per piece | - | - | 1 per piece | shared atlas | 150 per piece |

## 4. The 3 worst offenders against this budget, and what each fix saves

1. **Ranked creature look (`goblin-L4` + bare)**: 46,720 skinned verts (budget 30,000), 13 draws (10), 2,852 KB wire per creature kind (2,300). Saves: #3474 already hides 11,732 verts (-26%) on far ones. Meeting 30,000 needs 16,720 fewer verts on every drawn ranked creature: dropping the bare Skin under the look (-9,966 verts, up to -0.8 MB wire) once a face close-up proves it safe, plus about 7k off the look body (23,966 verts; decimate or remesh, -15% of the creature), or about 17k off the body alone if the Skin has to stay. **Not measured in ms** (T4 spend is closed for this note); an HF CPU or Mac phone profile before/after is the way to price it.
2. **Gear library `loot.glb`**: 2,056 KB wire, 104,605 tris, 99 draws, 22 materials, fetched at 5.3 s, before zone ready, on a phone. Saves: splitting it per worn piece (150 KB budget each) takes about **2 MB** off the first 30 s of the wire (12% of the 16.5 MB capture) and cuts the memory the phone parses before first play.
3. **Weapon PNG textures (`gladius-crafted`, `bow-v1`)**: 1,065 KB and 611 KB wire for 1,884 and 3,000 triangles; 959 KB and 480 KB of that is one PNG each. Converting the two to WebP/JPEG (the other weapons already are) saves about **1.3 MB** (to 150-250 KB each) with no geometry change. Fastest and safest of the three.

Next after those (within a few percent of budget): hero `warrior` 1,931 KB wire for 63.6k file tris and 13 materials (check the drawn set first), `goblin_hut` 537 KB (budget 450).

## 5. Proposed enforcement (the PR after this note)

Rows in a `phone-budgets.json` table (one row per class and metric, loaded through the registry), and `scripts/check-phone-budget.mjs` (built on `scripts/glb-budget-stats.mjs`, run in the quality job like `check:as-data`) that classifies each shipped GLB from the source tree (like `check-budget.mjs` does) and fails a new asset over budget; existing offenders go in an allow-list with an owner and a date so the list only shrinks. Texture format rule: no PNG under `public/` models.

Measuring scripts (this branch): `scripts/phone-budget-capture.mjs` (phone-tier network capture of a live page), `scripts/glb-budget-stats.mjs` (per-GLB numbers; run over ssh stdin on the VPS for the CS2 files, numbers only).
