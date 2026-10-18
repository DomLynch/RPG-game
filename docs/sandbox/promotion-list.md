# Test Zone promotion list (zone 90, branch `zone/goblin-field-dome`)

Strategy's ruling (2026-10-18): this branch is Dom's test bed and is **never merged wholesale** into trunk (it is 1003 commits behind and 23 files conflict). Its way into the main game is the **zone package** (alpha item 1, World's #3174/#3176): the ROWS go in as an unlisted zone; the CODE below is promoted piece by piece by the owning lane as trunk PRs with the battery. This list is the work order, and the archive check: the sandbox may be archived only on Dom's own word, once every line is **PORTED** or **DROPPED-BY-DOM** (or SUPERSEDED with the winner named). **Keep it current with every commit.**

Lead's ruling (2026-10-18): zone 90 enters trunk as an unlisted package import (World); code lines are ported by the owner lanes named; my FREEZE starts when Dom can play the imported zone 90 on trunk (until then rows only, no new systems); after that I answer porters' questions.

**Status values** (Strategy 2026-10-18): `PORTED (PR, merged, live revision named)` · `IN PR #n` · `NOT STARTED (owner)` · `SUPERSEDED (the PR that delivers the same thing)`. Every line is PORT except SUPERSEDED; the sandbox is archived when NOT STARTED and IN PR are both zero. Owner lanes and the sandbox author keep this current; the sha of this file is sent to Strategy with each change.

Gate for this branch = the tests of the sandbox's own files. Nine old world tests (`tests/origins-world-combat`, `origins-world-verify`) fail HERE because of the stale creature-motion copy and pass on trunk head; they are not part of this gate.

Kind: **row** = data, comes in with the zone package. **code** = promoted by the owner as a trunk PR.

## Rows (come in with the zone package; the exact ids are in the manifest below)

| Path | Kind | Owner | Trunk already has | Status |
|---|---|---|---|---|
| **R01** `origins/zone-rows/zone90.row.json` (the zone, camp, mob looks, spread, loadouts, start) | row | World | zone package import (#3174/#3176); trunk still holds my OLD 5.5 KB row (1feaaca5a), not the current 13.8 KB one | PORTED (#3213 merged; the zone row on trunk is the current 13.8 KB one; live revision: named by Deploy at the next release) |
| **R02** `origins/world/loadouts.json` + manifest (goblin rank loadouts t4-t7 with `look`, troll kit `troll.pit.*` = the pitborn kit, Dom's choice 2026-10-18 because the executioner's hood covers the face, pieces; the troll rows carry shin wraps and boots only until Characters' bake) | row | Characters | no (new table) | IN PR #3216 (Characters) |
| **R03** executioner piece rows and `loot:executioner.*` ground rows | row | Characters | no | SUPERSEDED (Dom chose the pitborn kit; no executioner rows are needed, #3216 carries the pitborn loadouts) [needs Strategy to confirm this is not a drop] |
| **R04** `origins/preview/ground-looks.json` (`loot:*` rows: a dropped piece lies as itself) | row | Characters | extends the existing ground-looks table | NOT STARTED (sandbox author; staged on zone/port-loot, opens after #3216 merges; the drop looks are their own table, drop-looks.json) |
| **R05** `origins/preview/sandbox-lines.json` + manifest (the unlisted-zone kill line) | row | Web | no | PORTED (#3204 merged) |
| **R06** `src/fight/fx-rows.json` ids `regen.*`, `zoneloot.*`, `start.clear-m`, `drop.reach`, `fit.*`, `grip.claw-fraction`, `mob-view.wear-max-scale` | row | Combat (regen, reach, fit/grip with Characters) | none exist on trunk | IN PR #3226 (start.clear-m, drop.reach, zoneloot.*, mob-view.wear-max-scale); regen.* IN PR #3210 (Combat); fit.* PORTED #3196; grip.claw-fraction SUPERSEDED (#3224) |
| **R07** `src/fight/fx-rows.json` ids `fp.*` | row | Web | none exist on trunk | IN PR #3225 (Web) |
| **R08** `src/fight/fx-rows.json` ids `warband.*` | row | Combat | no | IN PR #3235 (sandbox author; stacked on #3216; Combat reviews) |
| **R09** `src/fight/fx-rows.json` ids `gfx.*` | row | World | no | NOT STARTED (sandbox author: gfx lift PR) |
| **R10** `src/fight/fx-rows.json` ids `reach.*`, `reach.dir-tau`, `mob-view.lateral-tau/radial-tau/turn-dps/snap-m/max-orbit-dps/max-lag-m`, `pose-blend.snap-m`, `zone1feel.*` | row | Combat | the stand-back is reused by Combat (#3185) | SUPERSEDED (#3185 stand-back and goblin 1.25; #3215 troll 1.52; #3221 height ladder) |
| **R11** `src/fight/fx-rows.json` ids `breath.*` | row | Combat | partly (trunk's zone-fx) | IN PR #3232 (sandbox author; Combat reviews) |
| **R12** `origins/world/building-skins.json`, `props-defs.json`, `goblin-field-defs.json` + manifests | row | World | partly (World's biomes.json, #3067) | NOT STARTED (World; #3213 brought the biome and package) |
| **R13** `origins/preview/preview-rules-defs.json` | row | Web | extends trunk's table | IN PR #3225 (Web) |
| **R14** `src/fight/creature-motion-defs.json` + manifest | row | Combat | **#3056 supersedes my copy** | SUPERSEDED (#3056) |
| **R15** `src/fight/camera-rules-defs.json` (combat camera `camera.combat.*`) | row | Combat | no | SUPERSEDED (trunk 16b851ef2: the Wide camera is Zone 1's default); the pitch-with-foe-size + camera.fightBack variant NOT STARTED (sandbox author, own PR) |

## Code (owner promotes as trunk PRs)

| Path | What | Owner | Trunk already has | Status |
|---|---|---|---|---|
| **C01** `src/fight/hero-regen.ts` + `tests/hero-regen.test.ts`, the `regen` hook, `regenQuiet` and `debugHurt` in `src/fight/world-combat.ts` | out-of-combat regeneration (sim rule, once per fixed step; null = none; Dom picked 60 s) | Combat | no; Strategy accepted it as built, promotion = Combat via Lead, battery unchanged (out-of-combat only) | IN PR #3210 (Combat) |
| **C02** `src/fight/creature-motion-rows.ts`, `src/fight/open-fight.ts` motion, `src/fight/world-record.ts` WSV 48 | stand-and-face, turn cap | Combat | **#3056 supersedes: do not promote** | SUPERSEDED (#3056) |
| **C03** `origins/preview/mob-calm.ts` (+test), `world-combat-blend.test.ts` | creature pose smoothing, off unless `?mobsmooth=1` | Combat | World's tick blend landed | SUPERSEDED (#3056 / World tick blend) |
| **C04** `origins/preview/mobs-view.ts` stand-back (`backOff`, `reach.*`) | creature stand-off at the hero | Combat | Combat ported it as #3185 | SUPERSEDED (#3185, open: stand-back; #3215 troll 1.52) |
| **C05** `origins/preview/mobs-view.ts` missing-clip fallback (two-handed weapon on a creature body builds on the default weapon's clips) | stops capsule creatures | Characters | no; the proper fix is two-handed clip packs on creature bodies (Characters/Combat, routed via Lead) | NOT STARTED (Characters; MissingClip stays fail-loud per Strategy) |
| **C06** `origins/preview/mobs-view.ts` `gripToClaw`/`followClaw` + `piece-fit.ts` `unweightedBones` (+ rows `grip.claw-fraction`, `fit.skin-min-weight`) | the troll's skin has NO hand/finger bone driver (arms ride the upper-arm bones), so a weapon on the hand bone floats away from the drawn claw: the claw's skin vertices are tracked each frame and the weapon is held there; pieces bound to unskinned bones are re-skinned to the nearest skinned ancestor | Characters (rig fix: add hand/finger weights to cave-troll.glb is the real cure) | no; the troll's rig bug is in the creature asset, not trunk code | SUPERSEDED (#3224, the fixed troll GLB: hand and finger skin weights) |
| **C07** `origins/preview/mobs-view.ts` rank look (`wearLook`), carriers by piece-id prefix, `reshapeWeapon` (per-rank weapon shape) | dress creatures with the Pit's own armour and weapon shapes | Characters | uses trunk's `loadRankLook`/`wearLook`/`shapeFor` | IN PR #3216 for the loadout rows and pickLoadout; the dressing code (wearRankLook, carriers, reshapeWeapon) NOT STARTED (Characters, S3) |
| **C08** `origins/world/loadouts-rules.ts` | loadout loader and checks | Characters | no | IN PR #3216 (pickLoadout) |
| **C09** `origins/preview/piece-fit.ts` (+test), `fit.*` rows | per-bone refit of hero-rig loot pieces to a re-proportioned body (the troll); live for the troll's shin wraps and boots; helmet, torso, arms and gloves of the pitborn kit need Characters' bake (or the cave-troll.glb rig fix) | Characters (belongs next to `loadLoot`/`wear`; Lead: Characters is porting it) | the engine's own #606 retarget (piece inverse binds) is the base this adds to | PORTED (#3196 piece-fit); unweightedBones/remap SUPERSEDED (#3224) |
| **C10** `origins/preview/outfit.ts` (+test), `kill-drop.ts` (+test), `ground-item-view.ts` (loot-piece prefix, rank finish) | take-everything loot, the hero's outfit, drops lying as real items | Characters + Backend (any promotion to account loot is Backend's, never from the zone) | uses trunk's `loadLoot`/`wear`; the take-limit stays code in the Pit | NOT STARTED (sandbox author; staged on zone/port-loot, opens after #3216; per-slot override, page memory only) |
| **C11** `origins/preview/kill-apply.ts` (`sandbox` toast) + `main.ts` (no `kill_report` from an unlisted zone) | sandbox kill line | Backend | no | PORTED (#3204 merged) |
| **C12** `origins/preview/first-person-arm.ts` (+test), first-person branch in `src/fight/follow-camera.ts` | first-person view with the hero's own arm (IK) | Combat | no | IN PR #3230 (sandbox author; stacked on #3225; Web reviews) |
| **C13** `src/fight/follow-camera.ts` combat framing, `src/fight/camera.ts`, `camera-rules.ts` | combat camera (Wide auto-fit) | Combat | no | SUPERSEDED (trunk 16b851ef2); the pitch-with-foe-size + fightBack reader variant NOT STARTED (sandbox author) |
| **C14** `origins/preview/war-band.ts` (+test), war-band hooks in `main.ts` | horn-blower, rally | Combat | no | IN PR #3235 (sandbox author; stacked on #3216; Combat reviews the fight hooks) |
| **C15** `src/fight/breath.ts`, `src/fight/zone-fx.ts` | salamander fire breath, contact effects | Combat | partly (trunk's zone-fx) | IN PR #3232 (sandbox author; Combat reviews) |
| **C16** `origins/preview/gfx-lift.ts` | `?gfx=1` fog, bloom, grade | World | no | NOT STARTED (sandbox author: gfx lift PR) |
| **C17** `origins/preview/frontier-plan.ts`, `frontier-dress.ts`, `frontier-cinder.ts` (building-skin seam, `edgeDistance`/`rimScale`, `Thin`/`Dress.strips`) | goblin-field hooks in the frontier plan, dress and cinder | Web | ported by Web & UI as a types-only skin seam (`frontier-skin.ts`), skin drawing in `frontier-greybox.ts`, collision rows in `frontier-plan-defs.json`; take trunk's version of these three files, the dome's `frontierBuild` BLOCKS/`block()`/`stand()` shape no longer exists | IN PR #3212 (Web) |
| **C18** `origins/preview/prop-kit.ts`, `ambience.ts`, `goblin-ground.ts`, `goblin-smoke.ts`, `horizon-dome.ts`, `building-skin.ts` (the skin TABLE and renderer: World's slice B fills the seam), `frontier.ts` and the other `frontier*.ts`, `exchange*.ts`, `creature-card.ts`, `index.html` | goblin-field look, props, dome, ground | World | World's biomes work (#3067) overlaps; reconcile with them | horizon-dome.ts PORTED (#3202 merged); the rest NOT STARTED (World) |
| **C19** `origins/zones/schema.ts`, `loader.ts`, `from-row.ts`, `biomes-data.ts` | zone row keys (`look.sky`, `look.props.*`, unlisted) | World | **World's zone package supersedes** | SUPERSEDED (#3176 zone package; look fields #3199 merged) |
| **C20** `origins/preview/mobs.ts` (`spawnAmong` `clearM`, spawn rules), `mob-looks.ts` | start clear of every creature, looks | World | no | NOT STARTED (World) |
| **C21** `origins/preview/vite.config.mjs`, `scripts/zone-look-stills.mjs`, `scripts/origins-tsc.mjs`, `scripts/data-only-check.mjs`, `.claude/launch.json` | the sandbox's own dev/preview tooling | Web | keep sandbox-only | SUPERSEDED (the sandbox's own dev/preview tooling: trunk has its own; the check scripts are kept for porters in scripts/zone-sandbox on the donor branch) [needs Strategy to confirm this is not a drop] |

## Assets committed on the branch (not on trunk)

| Path | Owner | Status |
|---|---|---|
| **A01** `public/world/kit/goblin-bare.glb`, `goblin-fort-kit.glb`, `dungeon-kit.glb` | World / Characters & Art | NOT STARTED (World / Characters & Art; goblin-bare.glb is in Characters' S2) |
| **A02** `public/zones/goblin-fortress-landscape.webp`, `-portrait.webp`, `-panorama.jpg` (the painted dome; Dom's own generation route, licence per Dom) | World | PORTED (#3213 merged: public/zones/goblin-fortress-*.webp and panorama.jpg are on trunk) |

## Row id manifest (exact ids, generated 2026-10-18 at the freeze start; World imports and diffs by id)

### fx-rows.json ids added since the fork (src/fight/fx-rows.json) (86)

`reach.hero-edge`, `reach.gap`, `reach.full-scale`, `reach.default`, `reach.giant-salamander`, `breath.giant-salamander`, `breath.range`, `breath.radius`, `breath.life`, `breath.tongues`, `breath.smoke`, `breath.embers`, `breath.tongue-opacity`, `breath.smoke-opacity`, `breath.tip`, `breath.body`, `breath.core`, `drop.reach`, `start.clear-m`, `mob-view.wear-max-scale`, `grip.claw-fraction`, `fit.skin-min-weight`, `fit.min-len-m`, `fit.ratio-min`, `fit.ratio-max`, `regen.out-of-combat`, `regen.health-full`, `regen.stamina-full`, `regen.move-mult`, `regen.move-eps`, `zoneloot.take-limit`, `zoneloot.ring-m`, `warband.horn-run-speed`, `warband.horn-reach`, `warband.rally-count`, `warband.rally-seconds`, `warband.rally-aggro`, `warband.rally-run-speed`, `warband.rally-engage`, `warband.captain-drops`, `warband.horn-dx`, `warband.horn-dz`, `fp.eye`, `fp.forward`, `fp.tilt`, `fp.look-down`, `fp.bob-amp`, `fp.bob-step`, `fp.bob-speed-cap`, `fp.hand-right`, `fp.hand-up`, `fp.hand-forward`, `fp.pole-right`, `fp.pole-up`, `fp.pole-forward`, `fp.blade-right`, `fp.blade-up`, `fp.blade-forward`, `fp.arm-rate`, `fp.kick-rest`, `fp.kick-roll`, `fp.kick-yaw`, `fp.kick-lunge`, `fp.fov-landscape`, `fp.fov-portrait`, `reach.dir-tau`, `zone1feel.spread`, `zone1feel.keep.giant-salamander`, `mob-view.lateral-tau`, `mob-view.radial-tau`, `mob-view.turn-dps`, `mob-view.snap-m`, `mob-view.max-orbit-dps`, `mob-view.max-lag-m`, `gfx.bloom.strength`, `gfx.bloom.radius`, `gfx.bloom.threshold`, `gfx.grade.contrast`, `gfx.grade.saturation`, `gfx.grade.shadow-teal`, `gfx.grade.highlight-warm`, `gfx.grade.vignette`, `gfx.fog.ground-boost`, `gfx.fog.height-falloff`, `gfx.fog.sky-keep`, `pose-blend.snap-m`

### loadout piece ids (origins/world/loadouts.json `pieces`) (18)

`goblin.Helmet`, `goblin.Body`, `goblin.Arms`, `goblin.Gloves`, `goblin.Greaves`, `goblin.Boots`, `executioner.Helmet`, `executioner.Body`, `executioner.Arms`, `executioner.Gloves`, `executioner.Greaves`, `executioner.Boots`, `pitborn.Helmet`, `pitborn.Body`, `pitborn.Arms`, `pitborn.Gloves`, `pitborn.Greaves`, `pitborn.Boots`

### loadout ids (origins/world/loadouts.json `loadouts`) (16)

`goblin.scrapper`, `goblin.cutter`, `goblin.guard`, `goblin.captain`, `goblin.t4.gladius`, `goblin.t4.cleaver`, `goblin.t5.scythe`, `goblin.t5.trident`, `goblin.t6.warhammer`, `goblin.t6.maul`, `goblin.t7.longsword`, `goblin.t7.estoc`, `troll.pit.t4.cleaver`, `troll.pit.t6.warhammer`, `troll.pit.t5.maul`, `troll.pit.t7.cleaver`

### ground-looks ids added (origins/preview/ground-looks.json, the `loot:*` rows) (27)

`loot:goblin.Helmet`, `loot:goblin.Body`, `loot:goblin.Arms`, `loot:goblin.Greaves`, `loot:goblin.Boots`, `loot:executioner.Helmet`, `loot:executioner.Body`, `loot:executioner.Arms`, `loot:executioner.Greaves`, `loot:executioner.Boots`, `loot:pitborn.Helmet`, `loot:pitborn.Body`, `loot:pitborn.Arms`, `loot:pitborn.Greaves`, `loot:pitborn.Boots`, `loot:goblin.Gloves`, `loot:executioner.Gloves`, `loot:pitborn.Gloves`, `loot:weapon.Longsword`, `loot:weapon.Knife`, `loot:weapon.Cleaver`, `loot:weapon.Gladius`, `loot:weapon.Estoc`, `loot:weapon.Maul`, `loot:weapon.Warhammer`, `loot:weapon.Scythe`, `loot:weapon.Trident`

### sandbox-lines ids (origins/preview/sandbox-lines.json) (1)

`kill`

### zone90.row.json top-level keys (origins/zone-rows/zone90.row.json) (14)

`name`, `unlisted`, `defaultKind`, `biome`, `camera`, `names`, `world`, `level`, `mobLooks`, `spawns`, `kit`, `looks`, `place`, `notes`

## Test-only hooks (browser checks, never promoted as features)

`originsPreview.fell(id)`, `.hurt(n)`, `.regenQuiet()`, `.heroFist()`, `.warband()`, `.fpPose`, the `mobs().grips` / `handMesh` / `meshesOf` / `fit` debug fields, `?fit=0`, `?gripdebug`, `world-combat.debugHurt`. DROPPED-BY-DOM is not needed: they are never ported.

## Publish recipe (sandbox only)

VPS `/srv/dev-jobs/zone-sandbox-preview/repo`, build with `VITE_UNLISTED_ZONES=1` (the standard publish script strips that flag: a build without it shows "There is no zone 90"). Details in `docs/state/zone-sandbox.md`.
