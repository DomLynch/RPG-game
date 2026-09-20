# Trident v1 — evidence (weapons lane, 2026-09-16)

Branch `weapons/trident-v1` from trunk 86189a5 (the weapon-slot seam, PR #79). Captures by
`node scripts/character-preview.mjs --weapons --label <label> [--enemy <glb>] [--against baseline]`.

## What was built

- `scripts/build-weapon.mjs` — the trident (three silhouette variants) as a rigid part under `hand_r` with `extras.contact` on the
  tines, and its 13 clips authored offline on the rig (body from the CC0 loops, both arms re-solved onto the shaft every key; the
  left hand is the right hand's authored pole grip mirrored across the shaft, fingers included).
- `scripts/build-warrior.mjs` — `WARRIOR_WEAPON=trident [WEAPON_VARIANT=A|B|C]`: no scabbard, empty sword nodes for the loader,
  `WeaponDrawn` with the sword's transform, the trident's clips added after the sword set. Default output byte-identical.
- `src/assets/weapons/trident/veteran-trident.glb` — the Veteran carrying the trident (34 clips). Not imported by the runtime
  (the bundle does not change until the render lane switches the opponent's URL: REQUESTS.md §1).
- `src/assets/weapons/trident/trident.glb` — the part alone.
- `src/moves.ts` `TRIDENT_PATHS` / `TRIDENT_MOVES` / `TRIDENT` (real data, no longer a placeholder); `scripts/blade-manifest.json`
  entry; `src/blade-paths.ts` re-baked with the trident's own table; `tests/weapons.test.ts` (+3 tests).
- `character-preview.html` / `scripts/character-preview.mjs` — the weapon view (`?enemy=`, per-rig clip lists, weapon turntable, on-rig
  close-ups, the brief's 393×852 / 852×393 lock stills, a 6 s scripted exchange, a cost table).

## Owner's pick (2026-09-16): variant `short` — B's fat, wide fork on a 60% stick, brown shaft

Shaft 1.44 → 0.86 m (1.42 m butt to tip), the same 0.46 m tines / 0.22 m spread as B, the ash now `#64452f` (the earlier `#3b2d22`
read black). The tines' contact segment moves to 0.76–1.22 m along the node. The thrust keeps its reach on the short pole by
driving the rear arm to full extension (the classic short-spear thrust); every clip re-keyed to the shorter grips.

| | trident-v2 (A, 2.0 m) | trident-v4-short (owner's pick) | sword |
|---|---|---|---|
| thrust lands to | 2.3 m | **2.25 m** | 2.0 m |
| sweep lands to | 1.95 m | **1.75 m** | 1.7 m (cut) |
| pin lands to | 2.25 m | **2.15 m** | 2.2 m (heavy) |
| thrust tip at contact (fighter-local z) | 1.49 | 1.36 | 1.14 |
| weapon extent (rig units) | 1.68 m | 1.21 m | 0.84 m |
| opponent GLB gzip | 3,951,971 | 3,952,084 | 3,887,706 (baseline) |

`TRIDENT_MOVES` reaches are these measured numbers (thrust 2.25, sweep 1.75, pin 2.15; tests assert ±0.1 m). Sheets: `trident-v4-short/`.
Variants A/B/C stay in `build-weapon.mjs` (`WEAPON_VARIANT=A|B|C`) for comparison; `short` is the default.

## Measurements (variant A, superseded by the pick above)

| | baseline (Veteran, longsword) | trident-v2 (variant A) | Δ |
|---|---|---|---|
| opponent GLB bytes | 6,600,296 | 7,123,500 | +523,204 |
| opponent GLB gzip | 3,887,706 | 3,951,971 | +64,265 |
| weapon triangles | 364 (sword) | 652 | +288 |
| weapon extent (rig units) | 0.84 m | 1.68 m (2.00 m butt to tip, part alone) | |
| materials | Blade, Antique brass, Leather, Steel | TridentBronze, Ash, Leather (no textures) | |
| clips on the rig | 21 | 34 (21 sword + 13 Trident_*) | +13 |

Variants (same 652 triangles): A 1.90 m shaft, 0.40 m tines, 0.16 m spread (contact 1.25–1.65); B 0.46 m tines, 0.22 m spread
(1.19–1.65); C 2.05 m shaft, 0.30 m tines, 0.13 m spread (1.40–1.70).

Contact, fighter-local metres, from the bake (`node scripts/bake-blades.mjs`), over each path's active window:

| path | clip @ key | tip z (sword) | tip height |
|---|---|---|---|
| thrust | Trident_Thrust @.34 | 1.49 (1.14) | 1.15 |
| riposte / chain | Trident_ThrustChain @.34 | 1.50 (1.13) | 1.15 |
| light_* (sweep) | Trident_Sweep @.34 | 1.40 (1.10) | 0.41–0.52 |
| heavy_overhead (pin) | Trident_High @.48 | 1.35 (1.12) | 0.94 → 0.67 |

Landing frontier against a standing target (stepDuel, real tables): thrust 2.3 m (sword stab 2.0), sweep 1.95 (cut 1.7), pin 2.25
(heavy 2.2). Every `reach` in the data is that measured number (asserted ±0.1 m by tests/weapons.test.ts).

## Sheets

- `baseline/` — the Veteran with the longsword through the same view: `weapon-on-rig.png`, `weapon-clips.png`, `exchange-zoom.png`.
- `trident-v0/`, `trident-v1/`, `trident-v2/` — the three passes (v0: hip-height thrust, pole tipping down in the walk, open front
  hand; v1: chest thrust, mirrored grip; v2: pole level through walk / strafe / hit, rear hand out of the belly). v2 is the candidate.
- `variant-B/`, `variant-C/` — the owner's silhouette options.

## Not done / risks

- The trident is not visible in the game: the renderer's clip list and weapon node are the render lane's (REQUESTS.md §1).
- The opponent still fights with the longsword until combat review flips `initialDuel` (REQUESTS.md §2).
- "Weak inside the point" is a rule request, not data: the sim sweeps the tines from the wind-up pose, so a thrust lands from 0.4 m.
- Poses are procedural (two-bone reach, keyed): readable at the phone camera; not motion capture. No parry clip (a shaft has no blade).
- Phone frame time: the trident adds 288 triangles and no textures; not measured on a device.

---

# Cleaver v1 — evidence (weapons lane, 2026-09-16)

Branch `weapons/cleaver-v1` = `weapons/trident-v1` (#80) + `opp/pitborn-v1` (#81) merged, then the cleaver. Owner: "a fat scythe-type
cleaver, wider and the same length as the longsword" for the Pitborn.

## What was built
- `scripts/build-weapon.mjs` `cleaver()`: a lofted single-edged blade (centreline sweep + width envelope, wedge section, 26 rings, closes
  to a point), the sword's length (.10–.86 along the node), edge on local +x; ferrule, wooden grip, butt cap, six rivets. Materials
  procedural: pitted iron `#4c4946` (.85 / .62), dark wood. Three silhouettes A / B / C. `CLEAVER_KEYS.Heavy`: the diagonal hack.
- `WEAPON_BUILDS` table: `build-warrior.mjs` now takes `{ part, clips, keys }` per weapon; a weapon may re-key a sword clip on its own
  rig. Default output byte-identical (both shipped GLBs `cmp`'d); the trident rig byte-identical after the refactor.
- `src/assets/weapons/cleaver/{cleaver,veteran-cleaver}.glb`; `WEAPONS.cleaver` real data; manifest entry; re-bake; +3 tests;
  `tests/opponents.test.ts` placeholder assertion updated and the whiff-punisher script reads the warden's own weapon.
- `artifacts/weapons/tools/edge-check.mjs` (which side of a blade leads each cut) and `trace-punisher.mjs` (one duel, tick by tick).

## Measurements
| | sword Veteran (baseline) | cleaver-v3 (A) | Δ |
|---|---|---|---|
| opponent GLB gzip | 3,887,706 | 3,884,073 | −3,633 (no scabbard) |
| weapon triangles | 364 | 615 | +251 |
| weapon extent (rig units) | 0.84 | 0.85 | +0.01 (same length, wider) |
| clips | 21 | 21 (Heavy re-keyed) | 0 |

Edge-leading over each cut's active window (edge · tip motion; +1 = the edge leads, −1 = the spine):

| path | sword | cleaver |
|---|---|---|
| chop (Attack) | .75 | .75 |
| back of the cleaver (Return) | −.73 | −.73 (by design: the hammer) |
| hack (Heavy) | .68 | **.95** |
| heavy riposte (Heavy) | .73 | **.98** |

Landing frontier vs a standing target: chop 1.7 (cut 1.7), hack 2.2 (heavy 2.2), poke 2.05 (stab 2.0). Lunge distances equal the
sword's. Pitborn fairness battery with the real cleaver: whiff punisher 4/24 normal · 6/24 hard (gate ≥ 4); 6/24 stalls per level.

## Iterations
- v0: leaf-shaped, bend invisible. v1: sabre-like, mass mid-blade. v2/v3: centreline sweep + belly toward the tip + hook — reads.
- Data: first pass (sword stepIn, measured reaches) → whiff punisher 0/24: the longer tells walked chops through the backstep, and
  measured reaches made the AI attack from outside the script's punish range. Lunge-matched + sword reach convention → 4/24 · 6/24.

## Sheets
`cleaver-v3/` (turntable, on-rig, clips, phone lock stills, exchange), `cleaver-B/`, `cleaver-C/` (turntables), `cleaver-v0/`,
`cleaver-v1/` (the rejected shapes).

## On the Pitborn's own body (trunk after #81 part 2)
`pitborn-cleaver.glb` (his 1.13× hunched body + the cleaver; 5,545,020 bytes, gzip 3,073,283): `cleaver-pitborn/` sheets. Edge-leading on
his rig: chop .79, back −.75, hack .93. Baked from HIS rig the frontier grows 13 % (chop 1.85, hack 2.4, poke 2.2) and the whiff punisher
goes 0/24 — so the shipped bake stays at 1.0× (`veteran-cleaver.glb`, the bake source), as the Pitborn's sword is simulated today; the
scale decision is the combat lane's with these numbers (REQUESTS §6).

## Not done / risks
- On the shelf by design: `WEAPONS.cleaver` still borrows the longsword; the flip, manifest entry, bake, body rebuild, battery, rules and
  deploy are the combat lane's (REQUESTS §5–6).
- Normal-level whiff punisher is exactly at the gate's floor; 6/24 stalls — combat review.
- No sheathed cleaver, no draw (he starts armed). No parry-clip concerns: the sword's Parry plays.

---

# Knife v1 — evidence (weapons lane, 2026-09-17)

Branch `weapons/knife-v1` = `char/goblin-v1` (#86) + `weapons/cleaver-v1` (#82) + the knife. The goblin's short hooked knife: a sica.

## What was built
- `scripts/build-weapon.mjs` `knife()`: the cleaver's loft at knife scale (22 rings, wedge section, edge on +x), the hook double-edged over its
  last third; ferrule, greasy wooden grip with a cord wrap, butt cap; procedural scavenged iron / wood / cord; 943 triangles, no textures.
  Variants A sica (forward grip, default), B reverse-grip hook (`grip: 'reverse'` → `build-warrior` turns the sword transform 180° about
  its thickness axis), C long knife. `WEAPON_BUILDS.knife` re-keys `Heavy` with the cleaver's diagonal hack.
- `src/assets/weapons/knife/goblin-knife.glb`: his own rig carrying it (5.8 MB; the sword's 21 clips, Heavy re-keyed).
- `KNIFE` on the shelf (moves, paths, guard, material, fight); +4 tests.

## Measurements (his rig, hand at 0.81× world scale)
| | goblin + sword (baseline) | goblin + knife A | B reverse | C long |
|---|---|---|---|---|
| opponent GLB gzip | 3,264,111 | 3,262,003 | | |
| weapon triangles | 364 | 943 | 943 | 943 |
| weapon extent (rig units) | 0.78 | 0.50 | 0.39 | 0.55 |
| blade in the world | 0.70 m (a man's sword, scaled) | 0.42 m | 0.30 m | 0.46 m |
| lands to (sword timings): stab / slash / hack | — | 1.65 / 1.35 / 1.8 | **0 / 0 / 0** | 1.7 / 1.4 / 1.85 |
| lands to (knife timings): stab / slash / hack | | **1.45 / 1.2 / 1.55** | | |

Edge-leading on his rig (A): slash .80, backhand −.75 (the hook's sharpened back), hack .92.

## Sheets
`goblin-baseline/` (him with the sword through the weapon view), `knife-v1/` (A: turntable, on-rig, clips, phone lock stills, exchange),
`knife-B/`, `knife-C/` (turntables).

## Not done / risks
- On the shelf by design (REQUESTS §9). His knobs, battery, stance and camera are other lanes'.
- Timings are the character lane's proposal, adopted as-is except the critical's cost (26 → 20).

---

# Estoc v1 — evidence (weapons lane, 2026-09-17)

Branch `weapons/estoc-v1` from trunk 9d08824 (knife live, the ladder picker). The Nightborn's long, thin, thrust-first blade.

## What was built
- `scripts/build-weapon.mjs` `estoc()`: a square-section rod (a four-point ring, equal width and thickness — no edge) tapering to the
  point, 16 rings; black iron straight cross with finials and a side ring, a black block, a wire-wrapped grip (ten turns), a faceted
  pommel. Procedural bright steel / black-oiled iron / wire; 1,252 triangles (the brief's cap: 2k). Variants A estoc, B rapier cut, C long
  tuck. `WEAPON_BUILDS.estoc` re-keys nothing.
- `src/assets/weapons/estoc/nightborn-estoc.glb`: his own rig carrying it; every clip byte-identical to nightborn.glb (the estoc's test);
  nightborn.glb itself rebuilds byte-identical.
- `ESTOC` on the shelf; `'steel'` added to `Material`; +3 tests.

## Measurements (his rig, root 1.03)
| | Nightborn + sword (baseline) | + estoc A | B | C |
|---|---|---|---|---|
| opponent GLB gzip | 3,458,427 | 3,455,531 | | |
| weapon triangles | 364 | 1,252 | 1,252 | 1,096 |
| weapon extent (rig units) | 0.82 | 1.06 | 0.98 | 1.16 |
| lands to (sword timings): stab / cut / heavy | 2.0 / 1.7 / 2.2 (a sword) | **2.35 / 2.0 / 2.5** | | |

`reach` in the data stays the sword's (1.65 / 1.9 / 2.0) per the brief; the 0.30 m margin is reported in REQUESTS §13.

## Sheets
`nightborn-baseline/` (him with the sword through the weapon view), `estoc-v1/` (A: turntable, on-rig, clips, phone lock stills,
exchange), `estoc-B/`, `estoc-C/` (turntables).

## Not done / risks
- On the shelf by design (REQUESTS §12). His battery, stance and guard fields are the combat lane's.
- The grip is one-handed in idle and the sword clips put his left hand on the blade in the Heavy and Riposte (half-swording an estoc is
  period-correct, and the clips are his own).

# Phase 2 polish — reconstructed weapons (2026-09-20)

Owner (2026-09-20): "do the polish now for beta", "all weapons", "keep the backup so we can revert", "aaa grade", "show me the
pics of the before and after". Branch `weapons/polish-v1`. Every weapon keeps its procedural part as the revert variant; the
reconstructed part ships by default on the same contact segment, so `bake-blades` writes the same tables and combat is untouched.

## Pipeline (all in the repo)
1. `scripts/weapon-recon.py` — concept picture (FLUX.1-dev Space, prompt + seed on record) → official TRELLIS.2 Space
   (`/preprocess_image → /image_to_3d → /extract_glb`, seed 190926, 1024, 100k faces, 1024² maps) → `src/assets/source/weapons/<id>.glb`
   + `<id>.trellis.json`. The Space's extraction floor is 100,000 faces; the game-grade reduction happens in Blender.
2. `scripts/weapon-fit.py` (Blender 5.2 headless) — orientation from the principal extents (the trident stood, the cleaver lay flat),
   which end is up (`up`: wide | flat | narrow), the head landmark from the width profile ('wide' = first point outside the shaft;
   'flat' = first blade-thin slice), ONE uniform scale so head and tip land on the contract. The head keeps the reconstruction
   (decimated); the handle is a clean 16-gon lathe whose colour is baked from the reconstruction — the TRELLIS handle is a stack of
   overlapping coil shells: welding it goes non-manifold (the decimator then deletes the fork) and decimating it tears the ridges
   into spikes; both measured. Near-black rows (the concept painted the oiled ash at ≈ 0.001 linear) are authored ash grain in the
   owner's brown. Output `<id>.part.glb` + `<id>.fit.json`.
3. `scripts/build-weapon.mjs sourced()` — loads the part (images stripped for node's loader, handed to `finishMaterials` by material
   name), `WEAPON_VARIANT=<old>` still builds the primitives. `tests/weapons.test.ts` walks every reconstructed part: one
   WeaponDrawn, the fit's contact == the procedural part's, its own maps, inside the budget.

## Receipts
| weapon | rig | tris (was) | gzip Δ | revert proof | bake |
|---|---|---|---|---|---|
| trident | veteran.glb | 3,998 (652) | +221 KB | `WEAPON_VARIANT=short` rebuild == HEAD veteran.glb (cmp) | blade-paths.ts unchanged |
| cleaver | pitborn.glb | 3,979 (615) | +192 KB | `WEAPON_VARIANT=A` rebuild == HEAD pitborn.glb (cmp) | blade-paths.ts unchanged |
| knife (v2) | goblin.glb | 3,194 (943) | +134 KB | `WEAPON_VARIANT=A` rebuild == HEAD goblin.glb (cmp) | unchanged |
| estoc (v2) | nightborn.glb | 1,993 (1,252) | +112 KB | `WEAPON_VARIANT=A` rebuild == HEAD nightborn.glb (cmp) | unchanged |
| longsword (v2) | warrior.glb | 2,991 (364) | +166 KB | `WEAPON_VARIANT=procedural` == trunk code without the part (cmp; the committed hero predates the integrated Quiet-One flow) | unchanged |

Sheets: `artifacts/weapons/before-<id>/`, `after-<id>/` (harness `--weapons`), `after-<id>/before-after.png` (part alone under
identical Blender lighting + the harness's guard / in-hand / thrust frames). Tools: `tools/weapon-render.py`, `tools/before-after.py`.

## Not done / risks
- Scythe: source + part fitted (4,483 tris), the second moon cut is still wrong (both moons survive the −x delete — open) and the
  Executioner is now a creature pack whose scythe comes from the `executioner-v5` donor rig: shipping it means rebuilding that donor
  with `WARRIOR_WEAPON=scythe` and re-packing (character lane's pipeline). Not in v2.
- Maul / claws / reaper live in `build-creature-weapons.mjs` (creature lane, factor-coloured primitives injected into the creature
  GLBs); a reconstructed part there needs images added to that injector — not started.
- The creature packs (skeleton, dwarf, werewolf) inherit the donor's `WeaponDrawn` subtree at pack time: they carry the new parts
  only after `build-creatures.mjs` re-packs them (creature lane).
- The committed `warrior.glb` predates the integrated Quiet-One flow (same clips and materials, 65 more accessors in a fresh build):
  the longsword rebuild will carry that pipeline change too.
