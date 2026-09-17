# Requests to the lead (runtime/spec changes this lane will not make)

1. **GAME_SPEC.md art direction is stale vs the Origins brief.** The repo text still says "grounded medieval fantasy… ESO /
   Black Desert Warrior references". The character brief (owner-locked) says ruined arena at the edge of worlds, bronze / iron /
   bone / leather / stone / ash / blood, Ryse / 300 / Gladiator / For Honor references. Please replace the section so the two
   cannot drift. Logged 2026-09-14.

2. **Presentation lane, later**: evaluate N8AO (screen-space AO) on/off at the lock camera once the fighter is final. Needs the
   `postprocessing` peer dependency and a phone frame-time check; its licence metadata (CC0 root vs ISC package) must be
   resolved before adoption. Character lane will not add runtime dependencies.
3. **Combat lane**: UAL2 (CC0) sword strikes are candidates for Attack/Return/Heavy/Riposte. They move the blade during
   contact, so each is a GAMEPLAY CHANGE with a re-bake; the character lane will prepare side-by-side captures and leave
   the decision to combat review.

4. **Owner downloads (CC0, free, from the creator's own pages — the character lane cannot fetch itch.io):**
   - `Universal Animation Library 2 [Standard].zip` (17 MB) → `artifacts/source/animations2.zip`
   - `Modular Character Outfits – Fantasy [Standard].zip` → `artifacts/source/outfits.zip`
   The lane records SHA-256s in src/assets/README.md and keeps archives untracked, as with UAL1/UBC.
5. **Runtime (lead): equipment slots.** The GLB now carries one skinned draw per (slot, material) with `extras.slot` ∈
   Helmet/Body/Arms/Gloves/Legs/Boots/Shield ('' = built-in). Showing/hiding a slot is `object.visible` by `userData.slot`;
   swapping a slot is loading another part GLB and binding it to the same skeleton. No runtime change made by this lane.

6. **Combat review — UAL2 attack candidates (GAMEPLAY CHANGE).** `WARRIOR_UAL2_ATTACKS=1 node scripts/build-warrior.mjs`
   replaces Attack/Return/Heavy/Riposte with UAL2 strikes (Sword_Regular_A+Rec, Sword_Regular_B+Rec, Sword_Regular_C,
   Sword_Dash), each retimed so the blade's most-forward instant lands on the contract contact fraction. Evidence:
   `artifacts/character/ual2-attacks/sheet.png`, the variant GLB and its baked `blade-paths-ual2-attacks.ts` in the same folder.
   With the variant, `npm test` fails 3/71: the backhand's contact tip sits 0.94 m to the side (test allows ±0.45 m) and two
   combat-sim expectations change (enemy health 100 vs 60; 50 vs 0) because the swept paths land differently. The heavy
   candidate leaves the ground. Nothing is shipped; the default build is unchanged. Decision: adopt per clip with re-tuned
   contact windows, or keep the authored strikes.

7. **Triangle ceiling raised 40k → 60k per fighter** in `tests/characters.test.ts` on the owner's instruction (2026-09-14:
   "we can increase the size, 40k is nothing"). The measured phone gate (iPhone 12 / Pixel 6, median ≥55 fps) is unchanged and
   still unpassed; the lead measures it on device.
8. **Creatures**: CC0 Bestiary – Dungeon Monsters Kit [Standard] (Puglin, Imp; PBR + emissive) is in
   `~/Downloads/Bestiary - Dungeon Monsters Kit[Standard]` for future opponents. Not integrated by this lane.

9. **Helmet height vs the locomotion bounds test.** `tests/characters.test.ts` asserts `bounds.max.y < 1.87` for Idle/Walk/Jog/Run,
   written for a bare head. A crested helm on this 1.8 m fighter reaches ~1.91 m. The shipped build (no helmet) still passes; when
   helmet items ship through runtime slots, raise the ceiling to 2.0 (`WARRIOR_ITEMS=ranger,helmet_bronze npm test` shows the one
   failure). Not changed by this lane without a decision. **Done 2026-09-16:** ceiling 2.0 with the Veteran's crested helm (`veteran.glb`).

## 10. Triangle ceiling for the realistic head (2026-09-14)
`WARRIOR_BODY=realistic` with hair/brow/lash cards measures 54,164 mesh triangles per fighter before the kit's arm re-fit;
the hair layer planned next adds ~5k. `tests/characters.test.ts` caps at 60,000 (owner-approved 2026-09-14, #7). Request:
raise to 72,000 when the realistic body becomes the default build, or accept the cards as a quality-tier toggle.
Evidence: `artifacts/character/realistic-v2/stats.json`.

## 11. The Nightborn (opponent 5) — what this lane left open (2026-09-16, branch brief/nightborn-v1)
Brief: `artifacts/character/BRIEF-nightborn.md`. Shipped: the opponent seam (`OPPONENTS.nightborn`, the committing guard), the kit
(closed black tunic with sleeves, standing collar, hose, boots, black leather, dull iron), posture (`BUILD.nightborn`), `nightborn.glb`,
tests, the per-fight budget gate.
1. **The head is a STAND-IN.** `head.FIGHTERS.nightborn.kt_glb` points at the hero's scan: the KeenTools job on the seven portraits
   (`artifacts/source/face/nightborn/nightborn-01..07.png`, uploaded 2026-09-16 23:0x) stopped at `402 Insufficient credits` after the
   uploads. Owner: top up at keentools.io, then `set -a; . ./.env.keentools.local; set +a; node scripts/create-head.mjs artifacts/source/keentools
   artifacts/source/face/nightborn/nightborn-0{1,6,7,2,3,4,5}.png`, point `kt_glb` at the new GLB (cams are already in that upload order),
   rebuild (`HEAD_KT=1 blender -b -P scripts/character/parts.py -- --body realistic --fighter nightborn && WARRIOR_FIGHTER=nightborn node
   scripts/build-warrior.mjs`), expect a `skin_mul` pass (pale grey-white: the portraits carry it; `keentools_skin_tone` follows the face).
2. **Hair fall.** The portraits show black hair to the shoulders, swept back; the pipeline paints the scalp (`hair: 'full'`) and grows fur
   shells on it. A hair fall is a new part: an `extract` shell over the back of the scanned head and the nape (two meshes — the KT head and
   the body below the scan cut), `Hair` material dyed black (`hair_maps` × ~0.4). Do it with the real head; rigid on `Head` so nothing sims.
3. **Pointed ears.** Owner-locked by the portraits. Two small cones rooted at the ear tips, rigid on `Head` — the `tusks()` pattern with the
   ear positions read from the scan's widest points at eye height. With the real head.
4. **Idle stillness.** Not done: the parity test wants every non-posture track byte-identical, so the plan is a GLB datum `idleScale` (≈.6,
   the Goblin's `stride` pattern) with a one-line read in `characters.ts` (`Idle`/`Armed` action `timeScale`). Renderer lane.
5. **Reproportion.** Long limbs / narrow shoulders were to come from the Goblin's `reproportion` (uncommitted in his worktree at the time);
   he ships on root scale 1.03 + the base frame. When the Goblin merges: `BUILD.nightborn` bones `{ legs ×1.04, arms ×1.06, clavicles ×.92 }`,
   root 1.0, re-measure `OPPONENTS.nightborn.scale`.
6. **Parry re-key.** One clip re-key (Parry, higher and wider) is allowed by the brief for phone-size readability; not done in v1.
