# Test Zone porting notes (zone 90, branch `zone/goblin-field-dome`)

Companion to `docs/sandbox/promotion-list.md`. **One entry per line of that list, keyed by its ID** (R = rows, C = code, A = assets), so a porter can match the two files. Each entry: what it is (functions or ids), tests that cover it, gotchas, and the checks I ran. Status lives in the list (TODO / PORTED / SUPERSEDED / DROPPED-BY-DOM), not here. If an entry here and trunk disagree, **trunk wins**.

Written during Lead's freeze (docs only). Branch state when written: live preview `dddb1db0e` plus docs commits; the branch is 1000+ commits behind trunk and conflicts in 23 files, so **never merge it; copy a piece, adapt it to trunk's shape, add its tests**.

## Checks I used (reproduce them before and after a port)

- Types: `npx tsc --noEmit -p .` (clean on the branch).
- Data layer: `npm run check:as-data -- --gate` (0 new on the branch).
- Tests (VPS, not the Mac): `node --test origins/preview/*.test.ts origins/world/*.test.ts tests/hero-regen.test.ts tests/test-zone.test.ts` (341 green at the last publish). Nine old tests in `tests/origins-world-combat.test.ts` / `origins-world-verify.test.ts` fail ON THE BRANCH ONLY (stale copy of Combat's creature motion); they pass on trunk.
- Pictures and live checks (Mac GPU, headless 375 wide): the scripts are committed under `scripts/zone-sandbox/` with a README (gear sheets, crops, troll before/after, loot, regen incl. the hunted case, claw and grip checks). `scripts/zone-look-stills.mjs` is the older still script. The browser-check hooks they use are listed at the end.
- Publish (sandbox only): build with `VITE_UNLISTED_ZONES=1`; the standard publish script strips that flag and the page then shows "There is no zone 90".

## Rows

**R01 `zone90.row.json`.** Zone 90: unlisted, level 1 (the `level` key is allowed only for unlisted zones), 16 spots on a spiral, mob looks, `spread`, camp props, start spot. Keys: `name, unlisted, defaultKind, biome, camera, names, world, level, mobLooks, spawns, kit, looks, place, notes`. Tests: `tests/test-zone.test.ts` (spawn ring inside 40 m of the camp centre, at least 12 m, at least 10 m between spots; the start at least 16 m from every creature via row `start.clear-m`), `tests/zone-sky-camp.test.ts`. Gotchas: a mob look's `scale` is the ABSOLUTE draw size (troll 1.52, goblin 1.25), not a multiplier; trunk holds an OLD 5.5 KB copy of this row, so replace, do not diff against it; `spread.<character>` needs `tints, scale, soot, burnt` even when you only want `loadouts`.

**R02 `origins/world/loadouts.json` + manifest.** Tables `pieces` and `loadouts`; 16 loadouts (4 old goblin, 8 goblin t4-t7 with `look` = `/looks/goblin-L4..L7.glb`, 4 `troll.pit.*`). Loader: `origins/world/loadouts-rules.ts` (C08). Tests: `origins/world/*.test.ts`. Gotchas: `rung` must be a career-ladder title (`TITLES` from `src/core/server.ts`); `look` must match `/^\/looks\/[\w-]+\.glb$/`; a loadout's carrier file is chosen by the PREFIX of its first piece id (`pitborn.Boots` -> `carriers-pitborn.glb`), so mixing kits in one loadout is not supported; the troll rows carry only `pitborn.Greaves` and `pitborn.Boots` by design (see C06, C09).

**R03 executioner rows.** Dropped by Dom (pitborn chosen). Do not import the `executioner.*` pieces or `loot:executioner.*` ground rows. Gotcha: `origins/preview/outfit.test.ts` asserts every piece a loadout can drop has a ground look, so drop both together.

**R04 `ground-looks.json` `loot:*` rows.** One row per droppable piece: armour as `loot:<body>.<Slot>` with `piece` = the loot.glb draw-name prefix (the loader strips dots, so `goblin.Body.Steel` is the node `goblinBodySteel`); weapons as `loot:weapon.<Slot>` with `asset` = the weapon's equip-file stem; gloves use the shared `~kit.Gloves` draws. Tests: `origins/preview/outfit.test.ts` (every droppable piece has a row), `tests/ground-looks.test.ts` on trunk. Gotchas: no `finish` on armour rows (a piece wears its rank finish via the `tier` argument of `lie()` instead); ring and beam are repeated per row because the loader requires them per row.

**R05 `sandbox-lines.json`.** One row, `kill`: a line that must contain `{creature}`. Loader: `loadSandboxKillLine` in `origins/preview/kill-apply.ts` (throws if the token is missing; tested in `kill-apply.test.ts`).

**R06 fx-rows `regen.*`, `zoneloot.*`, `start.clear-m`, `drop.reach`, `fit.*`, `grip.claw-fraction`, `mob-view.wear-max-scale`.** Values: regen 60 s health / 12 s stamina / walking x0.5 / enable row `regen.out-of-combat`; `zoneloot.take-limit` 0 (all; the Pit stays 1 in code) and `zoneloot.ring-m`; `fit.ratio-min/max`, `fit.min-len-m`, `fit.skin-min-weight`; `grip.claw-fraction`; `mob-view.wear-max-scale` 9 (any body; it was the kill switch for troll armour). Exact ids: the manifest in the list. Gotcha: `fx-rows.json` is numbers only; text goes in its own row file (R05).

**R07 `fp.*`.** First-person camera and arm: eye, forward, tilt, bob, FOV (landscape/portrait), hand/pole/blade offsets, `arm-rate`, `kick-*`. Used by C12.

**R08 `warband.*`.** Optional (only if Dom keeps the war band). Used by C14.

**R09 `gfx.*`.** Optional `?gfx=1` flag rows (bloom, grade, fog). Used by C16.

**R10 stand-back and motion rows** (`reach.*`, `mob-view.*`, `pose-blend.snap-m`, `zone1feel.*`). SUPERSEDED by Combat's #3185 / #3056: do not import.

**R11 `breath.*`.** Giant-salamander fire breath numbers (range, radius, life, counts, colours). Used by C15. Trunk's zone-fx partly overlaps: diff by id first.

**R12 `building-skins.json`, `props-defs.json`, `goblin-field-defs.json`.** World's goblin-field look rows. Tests: `tests/building-skins.test.ts`, `tests/props-rules.test.ts`, `tests/goblin-field-rules.test.ts`. Gotcha: overlaps World's biomes work (#3067/#3178); reconcile ids with their tables rather than adding a second set.

**R13 `preview-rules-defs.json`.** Extra named preview rules (test: `tests/preview-rules.test.ts`). Conflicts with trunk's file: take trunk's and re-add only the ids that are missing.

**R14 `creature-motion-defs.json`.** SUPERSEDED (Combat #3056): drop.

**R15 `camera-rules-defs.json` (`camera.combat.*`).** Combat camera framing rows (mid, perSep, perSize, shiftY, fov, zoom). Tests: `tests/camera-rules.test.ts`, `tests/combat-camera.test.ts`. Used by C13.

## Code

**C01 regen.** `src/fight/hero-regen.ts`: `regenRules(healthFullS?)`, `regenOn(unlisted)`, `regenStep(quiet, dt, rules, ctx, bars)` (pure). `src/fight/world-combat.ts`: optional dep `regen?: () => RegenRules | null`, a `quiet` clock, run once per fixed step on the hero's own fighter; `regenQuiet()` and `debugHurt()` are browser-check hooks only. Delay = the existing world rule `outOfCombat` (6 s). Resets on: a hit dealt or taken, any creature hunting him or inside `AGGRO_M`, dead. `?regen=45|60|90` overrides health-full (in `origins/preview/main.ts`). Tests: `tests/hero-regen.test.ts` (delay, walk x0.5, resets, caps, sandbox-only). Gotchas: null by default so no recorded fight and no WSV/RV move; mutates `me().health/stamina` directly, which is fine only because the world's fighter objects are not frozen. Live check I ran: hurt 80 of 150, still: 70 -> 150 in 35 s (2.5/s); with a goblin hunting: quiet timer held at 0 and health never rose.

**C02 creature motion.** SUPERSEDED (#3056). Do not port `creature-motion-rows.ts`, the `open-fight.ts` motion, or WSV 48: they are why nine old tests fail on this branch.

**C03 mob-calm.** SUPERSEDED (World tick blend / #3056). Off unless `?mobsmooth=1`.

**C04 stand-back.** SUPERSEDED (Combat #3185). Kept only so the sandbox looks right until it lands.

**C05 missing-clip fallback.** `origins/preview/mobs-view.ts` `dress()`: `clipsOwn(weapon)` checks `WEAPON_CLIPS[weapon]` against the body's clip names; a body without them (goblin-bare and cave-troll have only the generic set: no `Maul_Idle`, `Warhammer_*`, `Scythe_*`, `Trident_*`) is built on `DEFAULT_WEAPON`'s clips and the graded weapon shape is shown. Gotcha: without it `fighterClips` throws `Warrior is missing Maul_Idle` and the creature stays a pale capsule (this happened live). Proper fix: two-handed clip packs on creature bodies (Characters/Combat) and a loud failure instead of a capsule. Test: none beyond the live check (all ten gear creatures build, 0 warnings).

**C06 troll claw tracking.** `mobs-view.ts` `gripToClaw` (once, after the weapon shape is hung) and `followClaw` (every frame, from the update loop); `piece-fit.ts` `unweightedBones(body)`. Finding: the troll body has NO hand or finger bone driving any skin (the arms ride `upperarm_*` and `lowerarm_*`), and in the armed pose the hand bones sit near the chin while the drawn claws hang low, so anything hung on a hand bone floats away. Fix: remember the arm skin vertices farthest from the shoulder (`grip.claw-fraction`) and each frame move the weapon from the hand bone to their centroid, in the weapon node's own frame. Gotchas: detection is data-driven (no row): it triggers only when `hand_r` carries no skin at weight >= `fit.skin-min-weight`, so goblins are untouched; it assumes one drawn weapon near the hand and ignores the sheathed copy. Real cure: add hand and finger weights to `cave-troll.glb` (Blender, the Characters lane). Checks: before/after 375 stills; numbers in the debug fields `mobs().handMesh`, `.grips`, `.meshesOf`.

**C07 rank look and carriers.** `mobs-view.ts`: `wearRankLook` (the Pit's `loadRankLook` then `actor.wearLook`, body draw renamed `Skin` so the look's keep list keeps it), `loadCarriers` + `putOn` (carriers by piece-id prefix, `lootWorn` filter), `reshapeWeapon` (`shapeFor(weapon, level)` at the loadout's rung, `loadShape`, then `actor.reshape`). Gotchas: the look file is the armour SET, not a body (an earlier version used it as the body and looked "stuck on"); the world body must be the bare one (`goblin-bare.glb`); `row.look` unset means loose carrier pieces instead. Tests: none dedicated; live check on all gear creatures.

**C08 `origins/world/loadouts-rules.ts`.** `loadLoadouts`, `loadoutRow`, `pieceLabel`, `droppedPiece`, `loadoutIds`. Used by `origins/preview/outfit.ts` (`dropSet`, `weaponPiece`). Tests: `origins/world/*.test.ts`, `outfit.test.ts`.

**C09 piece-fit.** PORTED by Characters (#3196) as `src/fight/piece-fit.ts` plus `piece-fit-rig` rows. My copy adds: `unweightedBones` (re-skin pieces off bones the body never skins, via `fitPieces(pieces, rig, remap)`) and the rotation-safe form `invBind' = bodyInverse * T(bodyPos) * S(ratio) * T(-heroPos)`. Compare with trunk's before porting C06. Tests: `origins/preview/piece-fit.test.ts` (4: ratios, per-bone, clamps, bind-pose placement). Numbers: 6,060 tris / 11 draws per troll, about 1 ms per body, shared geometry.

**C10 loot.** `origins/preview/outfit.ts`: `dropSet(row, creatureId, limit)` (everything the body wore and carried; limit 0 = all), `weaponPiece`, `groundItemOf`, `createOutfit` (one piece per paperdoll slot, each keeps its rung, localStorage `origins-preview.outfit.v1`). `kill-drop.ts`: `createKillDrops` (ring of markers, walk onto one to take it; a piece with no lying model keeps a gem), `createFound`. `ground-item-view.ts`: `partOf` gathers all draws of a loot piece by name prefix, `lie(model, look, tier)` applies the rank finish. `main.ts`: `dressHero()` (`loadLoot` -> `actor.wear`, weapon as `reshape`) and `creatureFell`. Tests: `outfit.test.ts`, `kill-drop.test.ts`. Gotchas: SANDBOX ONLY and local to the device (no account item; promotion to account loot is Backend's); a taken weapon is VISUAL ONLY (the fight stays the longsword: there is no live weapon-swap call); the Pit's take-one rule is code in `src/main.ts`, not a row; cloth materials in `loot.glb` (Wrap) are white by design.

**C11 sandbox kill line.** `kill-apply.ts` `killToast(..., sandbox)` and `main.ts` `creatureFell`: in an unlisted zone no `kill_report` is sent and the toast is the R05 row. Open trunk PR #3204 does the same; reconcile with it. Test: `kill-apply.test.ts`.

**C12 first person.** `origins/preview/first-person-arm.ts`: two-bone IK (`solveTwoBone`, `aimBone`, `createFirstPersonArm`, `kick()`); the hero's own rig arm is aimed at a hand point, the head is collapsed (`Head` scale 0.001) so the eye is clear. `follow-camera.ts`: a `FirstPerson` branch in `update` (eye, bob). Rows R07. Tests: `first-person-arm.test.ts`. Gotcha: three earlier attempts (cloned sword, floating hand, punching-bag arm) were replaced by this; do not revive them.

**C13 combat camera.** `follow-camera.ts` combat framing (Wide auto-fit chosen by Dom), `camera.ts`, `camera-rules.ts`; rows R15. Tests: `tests/combat-camera.test.ts`, `tests/camera-rules.test.ts`. Gotcha: framing is measured against the gap and the foe's biggest dimension, so a bigger body (troll) changes it.

**C14 war band.** `origins/preview/war-band.ts` (`createWarBand`: horn-blower, rally, `fell`), hooks in `main.ts` (`warBandTick`, `warBandHit`, `inWarBand`). Optional. Tests: `war-band.test.ts`.

**C15 breath and zone fx.** `src/fight/breath.ts` (additive flame cone from the head to the hero), `zone-fx.ts` hooks; rows R11. Presentation only. Test: `tests/breath.test.ts`.

**C16 gfx lift.** `origins/preview/gfx-lift.ts`, flag `?gfx=1` (height fog, half-res bloom, grade, vignette, dither); rows R09. Optional.

**C17 frontier plan/dress/cinder.** PORTED by Web (#3212): a types-only building-skin seam, skin drawing in `frontier-greybox.ts`, collision rows. Take trunk's version.

**C18 World's goblin-field look code.** `prop-kit.ts`, `ambience.ts`, `goblin-ground.ts`, `goblin-smoke.ts`, `horizon-dome.ts` (painted dome from `look.sky`), `building-skin.ts`, `frontier.ts`, `exchange*.ts`, `creature-card.ts`, `index.html`. Tests: `origins/preview/prop-kit.test.ts`, `tests/props-rules.test.ts`, `tests/zone-sky-camp.test.ts`. Gotcha: World's open PR #3202 renders the dome from `look.sky`; take theirs.

**C19 zone schema keys.** SUPERSEDED by World's zone package (#3176) and the look fields (#3199, merged).

**C20 spawns.** `mobs.ts` `spawnAmong(f, b, specs, clearM?)`: with `clearM` the start is at least that far from every creature and the strict "among creatures" ring is skipped; `main.ts` passes `fxNum('start.clear-m')` for unlisted zones. `mob-looks.ts`: `mobVariant`/`variantLook` (a loadout per variant by hash of the creature id). Tests: `origins/preview/mobs.test.ts`, `tests/test-zone.test.ts`. Gotcha: engine x,z and the DRAWN position differ (stand-off), so measure drawn positions (`mobs().mobs[i].at`) in any check.

**C21 sandbox tooling.** `vite.config.mjs` (dev middleware serves `/world/`, `/looks/`, `/weapons/shapes/` at the site root), `scripts/zone-look-stills.mjs`, `origins-tsc.mjs`, `data-only-check.mjs`, `.claude/launch.json`. Stays with the sandbox (not ported).

## Assets

**A01 kit GLBs.** `public/world/kit/goblin-bare.glb` (8k tris, one draw, 65 joints, 25 clips; the bare body the rank looks dress), `goblin-fort-kit.glb` (Characters & Art's realistic totem and palisade), `dungeon-kit.glb`. Not on trunk. Licence and provenance: see `docs/state/zone-sandbox.md`; I cannot vouch beyond that.

**A02 painted dome.** `public/zones/goblin-fortress-{landscape.webp,portrait.webp,panorama.jpg}` (Dom's own generation route; licence per Dom). Not on trunk.

## Browser-check hooks (never promoted as features)

`originsPreview.fell(id)` (the creature falls through the real fall path), `.hurt(n)`, `.regenQuiet()`, `.heroFist()`, `.warband()`, `.fpPose`, `.mobScreen(id)`, `.tapMob(id)`, `.mobs().grips / handMesh / meshesOf / fit`, URL flags `?fit=0` (engine retarget only, for a before/after), `?gripdebug` was removed, `?regen=45|60|90`, `?fight=goblin` (isolate one goblin), `?view=first`.

## Things nobody should rediscover

1. Zone 90 needs `VITE_UNLISTED_ZONES=1` at build time.
2. Two-handed weapon clips are missing from creature bodies (C05).
3. The troll's hands carry no skin (C06): fix the asset, not each attachment.
4. A look file is an armour set over a bare body, never a body (C07).
5. `fx-rows.json` is numbers only; text belongs in its own row file.
