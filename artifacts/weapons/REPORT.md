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

## Measurements

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
