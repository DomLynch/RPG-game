# Test Zone promotion list (zone 90, branch `zone/goblin-field-dome`)

Strategy's ruling (2026-10-18): this branch is Dom's test bed and is **never merged wholesale** into trunk (it is 1003 commits behind and 23 files conflict). Its way into the main game is the **zone package** (alpha item 1, World's #3174/#3176): the ROWS go in as an unlisted zone; the CODE below is promoted piece by piece by the owning lane as trunk PRs with the battery. This list is the work order. **Keep it current with every commit** (one line per thing changed: path, rows or code, owner lane, whether trunk already has an equivalent).

Gate for this branch = the tests of the sandbox's own files. Nine old world tests (`tests/origins-world-combat`, `origins-world-verify`) fail HERE because of the stale creature-motion copy and pass on trunk head; they are not part of this gate.

Kind: **row** = data, comes in with the zone package. **code** = promoted by the owner as a trunk PR.

## Rows (come in with the zone package)

| Path | Kind | Owner | Trunk already has |
|---|---|---|---|
| `origins/zone-rows/zone90.row.json` (the zone, camp, mob looks, spread, loadouts, start) | row | World | zone package import (#3174/#3176) |
| `origins/world/loadouts.json` + manifest (goblin rank loadouts t4-t7 with `look`, troll kit `troll.pit.*` = the pitborn kit, Dom's choice 2026-10-18 because the executioner's hood covers the face, pieces) | row | Characters | no (new table) |
| `origins/preview/ground-looks.json` (`loot:*` rows: a dropped piece lies as itself) | row | Characters | extends the existing ground-looks table |
| `origins/preview/sandbox-lines.json` + manifest (the unlisted-zone kill line) | row | Web | no |
| `src/fight/fx-rows.json` rows: `regen.*`, `zoneloot.*`, `start.clear-m`, `fp.*`, `warband.*`, `drop.reach`, `gfx.*`, `mob-view.*` (incl. `mob-view.wear-max-scale`: hero-sized pieces are worn only by bodies up to that scale; the troll shows its weapon only until carriers-troll exists), `reach.dir-tau`, `reach.full-scale`, `zone1feel.*` | row | Combat (regen, reach, mob-view), World (gfx), Web (fp) | none of these ids exist on trunk |
| `origins/world/building-skins.json`, `props-defs.json`, `goblin-field-defs.json` + manifests | row | World | partly (World's biomes.json, #3067) |
| `origins/preview/preview-rules-defs.json` | row | Web | extends trunk's table |
| `src/fight/creature-motion-defs.json` + manifest | row | Combat | **#3056 supersedes my copy: drop mine** |
| `src/fight/camera-rules-defs.json` (combat camera `camera.combat.*`) | row | Combat | no |

## Code (owner promotes as trunk PRs)

| Path | What | Owner | Trunk already has |
|---|---|---|---|
| `src/fight/hero-regen.ts` + `tests/hero-regen.test.ts`, the `regen` hook and `debugHurt` in `src/fight/world-combat.ts` | out-of-combat regeneration (sim rule, once per fixed step; null = none) | Combat | no; Strategy accepted it as built, promotion = Combat via Lead, battery unchanged (out-of-combat only) |
| `src/fight/creature-motion-rows.ts`, `src/fight/open-fight.ts` motion, `src/fight/world-record.ts` WSV 48 | stand-and-face, turn cap | Combat | **#3056 supersedes: do not promote** |
| `origins/preview/mob-calm.ts` (+test), `world-combat-blend.test.ts` | creature pose smoothing, off unless `?mobsmooth=1` | Combat | World's tick blend landed; drop when #3056 is live |
| `origins/preview/mobs-view.ts` stand-back (`backOff`, `reach.*`) | creature stand-off at the hero | Combat | **Combat is reusing it today** |
| `origins/preview/mobs-view.ts` missing-clip fallback (two-handed weapon on a creature body builds on the default weapon's clips) | stops capsule creatures | Characters | no; the proper fix is two-handed clip packs on creature bodies (Characters/Combat, routed via Lead) |
| `origins/preview/mobs-view.ts` rank look (`wearLook`), carriers by piece-id prefix, `reshapeWeapon` (per-rank weapon shape) | dress creatures with the Pit's own armour and weapon shapes | Characters | uses trunk's `loadRankLook`/`wearLook`/`shapeFor` |
| `origins/world/loadouts-rules.ts` | loadout loader and checks | Characters | no |
| `origins/preview/piece-fit.ts` (+test), `fit.*` rows | per-bone refit of hero-rig loot pieces to a re-proportioned body (the troll); LIVE for the troll (pitborn wraps, belt, arms, gloves, shin wraps sit on the body); the helmet is left off the troll rows because the troll's head sits forward of a human's. A Characters bake of carriers-troll replaces it later | Characters (belongs next to `loadLoot`/`wear`) | the engine's own #606 retarget (piece inverse binds) is the base this adds to |
| `origins/preview/outfit.ts` (+test), `kill-drop.ts` (+test), `ground-item-view.ts` (loot-piece prefix, rank finish) | take-everything loot, the hero's outfit, drops lying as real items | Characters + Backend (any promotion to account loot is Backend's, never from the zone) | uses trunk's `loadLoot`/`wear`; the take-limit stays code in the Pit |
| `origins/preview/kill-apply.ts` (`sandbox` toast) + `main.ts` (no `kill_report` from an unlisted zone) | sandbox kill line | Backend | no |
| `origins/preview/first-person-arm.ts` (+test), first-person branch in `src/fight/follow-camera.ts` | first-person view with the hero's own arm (IK) | Combat | no |
| `src/fight/follow-camera.ts` combat framing, `src/fight/camera.ts`, `camera-rules.ts` | combat camera (Wide auto-fit) | Combat | no |
| `origins/preview/war-band.ts` (+test), war-band hooks in `main.ts` | horn-blower, rally | Combat | no |
| `src/fight/breath.ts`, `src/fight/zone-fx.ts` | salamander fire breath, contact effects | Combat | partly (trunk's zone-fx) |
| `origins/preview/gfx-lift.ts` | `?gfx=1` fog, bloom, grade | World | no |
| `origins/preview/prop-kit.ts`, `ambience.ts`, `goblin-ground.ts`, `goblin-smoke.ts`, `horizon-dome.ts`, `building-skin.ts`, `frontier*.ts`, `exchange*.ts`, `creature-card.ts`, `index.html` | goblin-field look, props, dome, ground | World | World's biomes work (#3067) overlaps; reconcile with them |
| `origins/zones/schema.ts`, `loader.ts`, `from-row.ts`, `biomes-data.ts` | zone row keys (`look.sky`, `look.props.*`, unlisted) | World | **World's zone package supersedes** |
| `origins/preview/mobs.ts` (`spawnAmong` `clearM`, spawn rules), `mob-looks.ts` | start clear of every creature, looks | World | no |
| `origins/preview/vite.config.mjs`, `scripts/zone-look-stills.mjs`, `scripts/origins-tsc.mjs`, `scripts/data-only-check.mjs`, `.claude/launch.json` | the sandbox's own dev/preview tooling | Web | keep sandbox-only |

## Test-only hooks (browser checks, never promoted as features)

`originsPreview.fell(id)`, `originsPreview.hurt(n)`, `originsPreview.warband()`, `originsPreview.fpPose`, `world-combat.debugHurt`.

## Publish recipe (sandbox only)

VPS `/srv/dev-jobs/zone-sandbox-preview/repo`, build with `VITE_UNLISTED_ZONES=1` (the standard publish script strips that flag: a build without it shows "There is no zone 90"). Details in `docs/state/zone-sandbox.md`.
