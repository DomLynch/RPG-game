# Weapons — project state

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Takeable weapons — loot ids for every warden's weapon (weapons lane, 2026-09-22)
Owner (via Strategy, 12:55): "any item can be taken, armour or weapon." Shelf side in `src/loot.ts`: `WEAPON_SLOTS` (Trident, Cleaver,
Knife, Estoc, Scythe, Warhammer) join `ARMOUR_SLOTS` in `LOOT_SLOTS`; `PAPERDOLL.main = WEAPON_SLOTS`; ids `veteran.Trident`,
`pitborn.Cleaver`, `goblin.Knife`, `nightborn.Estoc`, `executioner.Scythe`, `dwarf.Warhammer` appended to `LOOT`; `weaponOf(id)` = the slot
lower-cased (`isWeaponLoot`, `isWeaponSlot`). `dropFor` filters to armour: a weapon is never dropped, it is TAKEN (the lead's kill-screen
"Take one" reads `LOOT[opponent]` minus owned). No loot.glb draw for a weapon — the visual is its equip file `src/assets/weapons/player/
<weapon>.glb` (#309 contract) loaded when `equipped.main` is set; that runtime step and the fight-with-it seam (`playerWeapon` from
`equipped.main`) are the lead's/Combat's. Tests: the loot.glb pin now compares ARMOUR ids to the file's draws (loot-data + loot-wear);
a sibling pin walks every weapon piece → PLAYER_WEAPONS member, main-hand paperdoll, its opponent's roster weapon, equip file present
with WeaponDrawn and its WEAPON_CLIPS family; every ladder warden's weapon is a piece; `dropFor` never returns a weapon; a taken weapon
cleans/wears/unwears only in `main`. Whether a weapon is OFFERED stays `PLAYER_WEAPONS_OFFERED` (Combat's fairness table), untouched.
Shelf status for the lead's (b): all six equip files ship complete as wieldable since #309 — cleaver/knife/estoc on the sword family
(+ a re-keyed Heavy for cleaver/knife; the estoc re-keys nothing by design), scythe/trident/warhammer with their 13/13/12-clip families;
every one has a hero bake pinned by `tests/blade-rig.test.ts`. No family is missing; what gates each weapon is the runtime equip + fairness.

## Flat blade table dropped — `bladePathsByRig` is the only export (weapons lane, 2026-09-22)
The seam PR landed (`src/blade.ts` reads `bladePathsByRig[rig][weapon]`, `tests/blade-rig.test.ts` pins every pair), so
`bake-blades.mjs` no longer writes the transitional flat `bladePaths[weapon]` (the first manifest entry per weapon) — `src/blade-paths.ts`
496 KB → 270 KB, `bladePathsByRig` byte-identical. The last readers were tests: repointed to the rig each one means (hero for
longsword/trident/cleaver/scythe, goblin.knife, nightborn.estoc, minotaur.maul, wraith.reaper); the manifest test now checks every bake
carries all of its weapon's paths and every non-placeholder weapon is baked on some rig. The dead placeholder-borrowing loop in the
bake (no `placeholder` weapon exists) went with it. Closes auditer finding #6 on the merged weapons PRs.

## Player-wieldable weapons — equip files + blade tables by rig (weapons lane, Brief 5, 2026-09-21)
Six loot weapons on the shelf as their own files, `src/assets/weapons/player/<id>.glb` (`scripts/build-player-weapon.mjs`): the
hero build's `WeaponDrawn` in `hand_r`, the skeleton as empties, and only the clips the weapon owns (family + re-keyed `Heavy` for the
cleaver/knife + the Quiet One solved from the weapon) — packed 209–884 KB, nothing in `warrior.glb`, per-fight budget unchanged
(8,817,201 gzip). `blade-manifest.json` gained `rig` and `attach`; `bake-blades.mjs` emits `bladePathsByRig[rig][weapon]` beside the
unchanged flat table (Combat's nested lookup + `Fighter.rig` + the pin land from their lane; until then the flat export is what the sim
reads). Facts: cleaver/warhammer/trident/scythe in the player's hand bake identically to their shipped tables; knife (Goblin rig,
0.816 m off) and estoc (Nightborn body, 0.148 m off) have new `hero` tables baked from the equip files on `warrior.glb`; each equip
file's bake equals a full hero-rig bake (verified all six). Draw vs armed: owner "go" on armed + ready stance (Strategy session).
Open: Combat's runtime equip + sim lookup; the per-weapon battery per rung (Combat); `warrior.glb` lags a rebuild in `Death_QuietOne`.

## Dwarf warhammer — integration of the weapons lane's shelf package (2026-09-20)
Owner: the Dwarf gets a warhammer instead of the Veteran's trident. Weapons shipped `warhammer` on the shelf (#233, weapons/warhammer-v1:
part, 12 `Warhammer_*` clips on the base humanoid rig, WEAPON_CLIPS, `WEAPONS.warhammer = {...MAUL, placeholder}`). Character lane
(`char/dwarf-warhammer`, on top of #233): the donor is rebuilt with `WARRIOR_WEAPON=warhammer`, the Dwarf refitted and packed (37 clips,
185 finite poses, both hands on the haft < 0.08 m, source maps retained; sha 82dab728…), roster `weapon: 'warhammer'`, the creature
browser check keys on the `Warhammer_*` family, and the role-table test maps the warhammer to dwarf.glb. Still Combat's: the reach band and
lifting the `placeholder` flag (the sim uses the maul's numbers until then); the browser gate and the deploy stay with the deployer.

## Warhammer — the Dwarf's, on the shelf (weapons lane, 2026-09-20)
Owner: "Create the dwarf hammer / war hammer - should be medium size". Part (0.93 m, square face on +x, back-spike, langets), the
12-clip `Warhammer_*` family on the humanoid rig (the trident's machinery shared as `twoHandFamily()`, Veteran byte-identical),
`WEAPONS.warhammer` = the maul's set, PLACEHOLDER (Combat sets the .78-fighter reach), `WEAPON_CLIPS.warhammer`, manifest + baked
table, shelf rig `veteran-warhammer.glb`, pose sheets. Grip check at the Dwarf's .78: both wrists ≤ 0.071 m from the haft on the five
grip roles. Next: character lane integrates (donor rebuild `WARRIOR_WEAPON=warhammer` → refit → roster `weapon: 'warhammer'`).

## Weapons Phase 2 polish — reconstructed parts, in progress (weapons lane, 2026-09-20)
Owner reversed the freeze for weapons: polish all of them now for beta, keep the procedural parts as the revert. Trident (Veteran)
and cleaver (Pitborn) ship as TRELLIS.2 reconstructions fitted by `scripts/weapon-fit.py` on the unchanged contact segments
(`bake-blades` tables identical; `WEAPON_VARIANT=short|A` rebuilds byte-identical to the previous rigs). Knife (Goblin), estoc
(Nightborn) and longsword (hero, hand + scabbard) followed in v2 the same way; the scythe part is fitted but not on a rig (the
Executioner's donor re-pack is the character lane's) and maul/claws/reaper (creature injector) are not started. Skeleton,
dwarf and werewolf pick the new parts up on their next creature pack. Evidence: `artifacts/weapons/REPORT.md` "Phase 2 polish".

## Wraith reaper scythe — weapons lane, in progress
Owner replaces claws with a massive two-handed reaper, explicitly distinct from Executioner. New crescent geometry, dark swept haft, twelve Reaper clips and dedicated blade-edge contact marker; original25 base/finisher clips, body maps/skin and1.5 spectral scale retained. Minotaur differs only in shared generator provenance; all seven non-Wraith baked paths unchanged. CPU grip, torso, exact animation/contact, inner/outer reach and AI approach/escape tests pass; visual acceptance and public deployment remain pending the lead-coordinated GPU/release window. Evidence: artifacts/weapons/wraith-reaper/. PR167 finisher repair integrated; rerun Wraith Opened split/fade/ground behavior before release.

## Creature weapons — weapons lane, 2026-09-19
Owner enables stone maul for Minotaur and bare claws for Wraith. Additive offline authoring preserves original creature surfaces/maps/weights and old clips. Twelve new clips per creature cover ready/gaits/attacks/guard/reactions/death/roll/kick. Maul front hand slides within reach; Wraith contact is derived from actual hand/finger vertices and includes its existing 1.5 presentation scale in the bake. Maul shove samples the haft, other attacks sample the stone head. New geometry/contact regression covers all new clips, exact baked/rendered paths, close hits and measured outer misses. Existing head-region grid now uses each weapon's actual timing instead of the sword clock; all previous expected regions remain pinned. All26 configured local gates passed, including real-game creature damage/death/rematch. Integrated draw-bell trunk e8670fa; full quality293/293 and both affected audio gates pass. Final front/side/rear pose sheets reviewed. Creature browser gate now selects full Chromium consistently with the combat gate; default headless-shell timing failures and diagnostics are retained. GitHub Actions did not start because of account billing/spending limits; no CI success claimed. Full contract and deployment receipts: artifacts/weapons/creature-weapons/. Public release authority remains release.json plus live/receipt.json; physical handset review remains owner-only.

## Polearm rear-arm visibility — weapons, 2026-09-19
Owner's rear/front phone captures exposed a second pose defect after PR157: the rear hand was authored on +X (the rig's left side), sending the right elbow through the torso. Both arms and their skin weights were present. Reauthored ready, gait, guard, attack and reaction goals keep the rear grip on the right side; the raised attack passes in front of the shoulder, and supporting-hand slides stay reachable. The shared polearm IK bends outward and forward while retaining the anatomical hinge constraint.

Both live rigs and the canonical scythe bake rig are rebuilt, with collision paths rebaked. New 120 Hz regression samples both upper/lower arms against the posed torso core in all clips; the old shipped rig fails it. Existing hinge, grip, contact-height, head-region and reach pins pass. Mesh attributes, material definitions, texture pixels and 2,354 non-arm tracks per rig remain unchanged. A new completion gate captures front, side and rear views at eight ready/gait/guard/attack poses. Initial full quality: 267/267 plus build/audit/budget/browser PASS; account-integrated CPU quality: 270/270. Integrated Quiet One and warm dust trunk 1ee616d, regenerated the three rigs with Death_QuietOne retained, and made its append-preservation fixture cover full exports and additive rigs. All 16 contract commands, final gates and release receipts are recorded in artifacts/weapons/polearm-rear-arm. Sentry FRANKENDOM-5 latest event is texture loading on 714e969; FRANKENDOM-6 is a stackless load failure on f7a1e99. Neither explains the reproduced offline pose; neither is claimed resolved. Physical-phone review remains owner-only.

## Polearm elbow correction — weapons, 2026-09-19
Owner reproduced inward, twisted elbows on the Executioner and Veteran in the live game. Their correct polearm gait clips were already selected. Offline IK used reversed left/right bend poles for this rig and shortest-arc bone aiming left axial roll unconstrained. Polearm-only authoring now places elbows outward and aligns the anatomical hinge from the library stance; sword authoring and all combat timings stay unchanged. The Executioner slides his supporting hand down the haft during the raised wind-up to stay within reach.

Both live rigs and the canonical scythe bake rig are rebuilt, with collision paths rebaked. A 120 Hz shipped-rig regression checks every polearm clip for hinge direction and front-wrist distance, plus outward elbows throughout ready gaits. Original shipped rigs fail this regression. Mesh attributes, material definitions, texture pixels and all 2,354 non-arm animation tracks per live rig are unchanged (procedural PNG compression bytes vary on rebuild). Close-up render evidence and validation logs: `artifacts/weapons/polearm-elbows`; delivery is tracked in PR #157. Integrated camera/audio trunk `a8e72e6`: full quality 265/265, build, audit, budget and browser PASS. New real-game desktop/phone-viewport polearm gate verifies served asset hashes and actual polearm playback. Physical-phone validation remains owner-only.

## Button-consistent parry counters — weapons, 2026-09-19
Owner authorized fix and deployment. After a successful parry, Slash selects `slash_riposte` with each weapon's cut clip
and a separately baked collision path; Stab retains `riposte`; Heavy retains `heavy_riposte` (or the earned posture critical).
The counter cut keeps that weapon's existing riposte damage, stamina and timing. The scythe reap retains its 1.4 m dead band;
the trident counter sweep uses its low direction. Ordinary blocks still yield normal Slash/Stab and the existing Heavy counter.
No new control or GLB. Field Journal now describes the actual buttons. Audio's fixed thrust exchange explicitly presses Stab.
Verification: real-touch browser captured the hero's Slash/Attack/24, Stab/Riposte/24 and Heavy/Heavy/30 after actual parries.
Regression checks all light inputs, Stab and Heavy after a real parry, reward consumption, costs, damage and ordinary blocks.
Restoring the old forced-thrust selector fails the regression. Render/bake tests include the new path across weapon families.
The first full run exposed two old assumptions: the AI opener filter counted earned counter cuts as ordinary openers, and
an audio fixture pressed Slash to request its fixed thrust. Those fixtures now name the correct moves; focused 83/83 pass.
Integrated full quality passes 250/250 tests, lint, build, audit, budget and the shared browser gate. Estoc #142 is merged
as d3114a9 with Split Crown #144 preserved. All earlier blade tables are byte-identical; only the new counter paths are added.
Completion and release receipts: `artifacts/weapons/counter-buttons/`. Public deployment remains pending.

## Estoc A activation — 2026-09-19 — PR #142, NOT DEPLOYED
Weapons branch `weapons/estoc-live`, based on trunk `d383b66`. Variant A is built on the current Nightborn,
with matching render/bake GLBs, manifest entry, real ESTOC data, rebaked paths and flipped shelf receipts. Existing clips,
body geometry and textures preserved; all five other weapon trajectory tables unchanged. Preview `--azimuth` added.
The longer point initially registered head hits on the upright Nightborn. The estoc part now carries a 10-degree grip tilt,
composed with the hand attachment by the builder. Only WeaponDrawn's quaternion changes in the GLB: geometry, animations,
textures and every other node remain identical. The unchanged head-region rule passes; no contact remapping or clip edits.
A new real-duel regression checks non-head contacts and measured cut/heavy/thrust frontiers of 2.0/2.5/2.3 m.
Restoring the old blade paths makes that regression fail. The .75 thrust share remains necessary: .70 still fails the unchanged
roll-and-punish cap (3/24 untouched); .75 passes both fairness batteries. AI-vs-AI median 20.9 s, hero wins 9/24.
No AI, damage, timing or spacing edits. Full `npm run quality`: 246/246 tests, build, audit, budget and browser gate PASS.
Estoc browser completion verifies the served rig SHA, WeaponDrawn, portrait/landscape layout and an opponent hit.
Evidence: `artifacts/weapons/estoc-live/` (logs, browser JSON, probes), `estoc-aim/` (reviewed captures).
Lead owns roster integration and deployment; no weapons-lane deployment was attempted. Physical-phone validation outstanding.
Sentry still has earlier unresolved load/texture/WebGL issues (6/A/5/9/8); this unshipped branch cannot resolve those.

## Trident v1 — the weapons lane — 2026-09-16
- Branch `weapons/trident-v1` from trunk 86189a5 (slice U). The Veteran's short trident: a rigid part under `hand_r` (`WeaponDrawn`,
  `extras.contact` on the tines, 652 triangles, no textures) and 13 original clips on the rig (`Trident_Idle/Walk/StrafeLeft/StrafeRight/
  Thrust/ThrustChain/Sweep/High/Guard/BlockImpact/Deflected/Hit/Death`), all two-handed; built by `scripts/build-weapon.mjs` through
  `build-warrior.mjs` (`WARRIOR_WEAPON=trident`, default output byte-identical) into `src/assets/weapons/trident/veteran-trident.glb`
  (not imported by the runtime: the bundle is unchanged until the render lane switches the opponent).
- Data: `WEAPONS.trident` is real (`TRIDENT_MOVES` / `TRIDENT_PATHS`, guard `shaft`, material `bronze`), baked from its own rig via
  `scripts/blade-manifest.json`. Slash = low sweep, Stab = thrust (chains into a second thrust), Heavy = the overhead pin. Measured
  against a standing target with the owner's pick (variant `short`: B's wide fork on a 60% stick, 1.42 m, brown shaft; the thrust reaches
  by driving the rear arm to full extension): thrust lands to 2.25 m (sword stab 2.0), sweep 1.75 (cut 1.7), pin 2.15 (heavy 2.2);
  every `reach` is that number (tests assert ±0.1 m). All numbers provisional — GAMEPLAY CHANGE for combat review; nothing changes on trunk (`initialDuel`
  still longsword vs longsword).
- Harness: `scripts/character-preview.mjs --weapons [--enemy <glb>]` — weapon turntable, on-rig close-ups, clip sheet, 393×852 /
  852×393 lock stills, a 6 s scripted exchange, a cost table; baseline and three passes under `artifacts/weapons/` (REPORT.md).
- Evidence: tests/weapons.test.ts 8 tests (rig + contact segment + clip set, clips agree with the data's contact keys, reach frontier);
  quality gate per the PR. Requests to other lanes in `artifacts/weapons/REQUESTS.md`: the renderer's per-weapon clip list and weapon
  node (the trident is not visible in the game until then), the combat flip and review, a rule for "weak inside the point" (the sim
  sweeps the tines from the wind-up pose, so a thrust lands from 0.4 m like the sword's), the shaft guard profile. Silhouette picked
  by the owner 2026-09-16 (`short`); A/B/C remain as `WEAPON_VARIANT` options.

## Cleaver v1 — the weapons lane — 2026-09-16
- Branch `weapons/cleaver-v1` (stacked on #80 trident + #81 Pitborn seam). The Pitborn's cleaver: "a fat scythe-type cleaver, wider and
  the same length as the longsword" (owner). A procedural single-edged loft (0.19 m belly toward a hooked tip, 0.20 m forward sweep, 615
  triangles, no textures; silhouette A picked by the owner 2026-09-17, B/C remain options) under `hand_r` as `WeaponDrawn` (contact = the edge .14–.86). It rides
  the **sword's clip family** — same 21 clips, same order; only `Heavy` is re-keyed on its rig as a diagonal hack so the edge leads
  (edge·motion .95 vs the sword's .68) — so the renderer needs nothing; `pitborn-cleaver.glb` is his own body carrying it, and the
  shipped `pitborn.glb` takes it with the build flag + one test relaxation (REQUESTS §5). Baked at 1.0× like his sword; at his real
  1.13× the chop reaches 1.85 and the whiff punisher goes 0/24 — the scale call is the combat lane's (REQUESTS §6). `build-warrior.mjs` takes a per-weapon `{ part, clips, keys }` table; default output byte-identical.
- ON THE SHELF (the lanes' split): `CLEAVER` is exported real data — the chop (17, chip .2), the back of the cleaver (the backhand leads
  with the spine: 9 dmg, posture 34 — a hammer), the hack (26, chip .5, posture 42), the poke (7) — but `WEAPONS.cleaver` still borrows the
  longsword and there is no manifest entry: the Pitborn is unchanged until the combat lane flips it (REQUESTS §5). Measured for that flip:
  with lunges equal to the sword's and the sword's reach convention, the Pitborn battery passes 4/24 normal · 6/24 hard with 6/24 stalls at a
  1.0× bake; at his 1.13× the whiff punisher goes 0/24 (REQUESTS §6). The whiff-punisher script now reads the warden's own weapon table.
- Evidence: tests/weapons.test.ts +3 (rig + clip set + edge segment; edge-leading per cut; reach and lunge parity with the sword),
  169/169; `artifacts/weapons/REPORT.md` (cleaver section), sheets under `artifacts/weapons/cleaver-v3/`, `cleaver-B/`, `cleaver-C/`.

## Knife v1 — the weapons lane — 2026-09-17
- Branch `weapons/knife-v1` (stacked on #86 goblin + #82 cleaver). The goblin's short hooked knife: a **sica** — forward grip, inward hook,
  double-edged over the hook so the backhand cuts — 943 triangles, no textures, a 0.42 m blade in his 0.81× hand; his own re-proportioned rig
  carries it (`src/assets/weapons/knife/goblin-knife.glb`) on the sword's clip family, only `Heavy` re-keyed (the diagonal hack). On the shelf:
  `KNIFE` exported (the character lane's proposed timings: wind-ups ≥ 12, feints ≈ 40 % of the wind-up, damage/cost below a sword's; the
  critical's cost 26 → 20), `WEAPONS.knife` still the placeholder, no manifest entry.
- Measured on his rig with the knife's timings: slash lands to 1.2 m, stab 1.45, hack 1.55 (a man's sword 1.7 / 2.0 / 2.2; his placeholder
  today swings the man's table). The character lane's reverse-grip suggestion rejected with numbers: on the sword's clips it never lands (0 m
  at every gap) — it would need its own clips. Owner picked A, the sica (2026-09-17); C stays an option (REQUESTS §11).
- Evidence: tests/weapons.test.ts +4 (193/193 on the merged tree), `artifacts/weapons/REPORT.md` (knife section), sheets `knife-v1/`,
  `knife-B/`, `knife-C/`, `goblin-baseline/`. Hand-off to the combat lane: REQUESTS §9–10.

## Estoc v1 — the weapons lane — 2026-09-17
- Branch `weapons/estoc-v1` from trunk 9d08824. The Nightborn's estoc: a long, thin, thrust-first square-section blade with no edge,
  black iron cross + side ring, wire grip — 1,252 triangles, no textures, contact = the last 40 cm (the point); his own rig carries it
  (`src/assets/weapons/estoc/nightborn-estoc.glb`) with EVERY clip byte-identical to nightborn.glb (nothing re-keyed). On the shelf:
  `ESTOC` exported (the sword's timings and lunges exactly; cuts weaker, no chip; the thrust stronger and chaining; the riposte his payoff;
  `fight.thrustShare .7`; material `'steel'`, a new word in `Material` for audio), `WEAPONS.estoc` still the placeholder, no manifest entry.
- Measured on his rig: the blade lands 0.30 m past the sword everywhere (thrust 2.35, cut 2.0, heavy 2.5); `reach` stays the sword's
  conservative numbers per his brief, the margin reported for combat review. Owner's pick pending: A estoc (default), B rapier cut, C long
  tuck (REQUESTS §14). Hand-off: REQUESTS §12–13. Tests: 224/224.

## Scythe v1 — the weapons lane — 2026-09-18
- Branch `weapons/scythe-v1` from trunk 7ee6e34. The Executioner's scythe (owner picked B over axe, 2026-09-18: the axe duplicated the
  Pitborn's cleaver): 1.32 m haft, 0.74 m blade, sweep .30, iron `#4c4946` — 495 triangles, no textures, contact = the head (1.22–1.32 m).
  His own 1.36× rig carries it (`src/assets/weapons/scythe/executioner-scythe.glb`) with a 13-clip `Scythe_*` family authored on it (the
  trident's two-hand grip solver, per-key blade roll so the crescent reads from the game camera). On the shelf: `SCYTHE` exported,
  `WEAPONS.scythe` still the placeholder, no manifest entry; the combat lane's flip is REQUESTS §15–17 and every part of it is a
  GAMEPLAY CHANGE (new timings, shaft guard profile, chip profile, the arc's dead band).
- Measured on the man-scale bake rig `warrior-scythe.glb` (the cleaver convention — his own 1.36× GLB bakes over a man's capsule and
  everything whiffs): reap lands 1.40–2.10 m, the headsman's high 2.30, the heel-jab 2.05; `reach` = the conservative spacing estimates
  1.8 / 2.0 / 1.8. The dead band is 1.40 m, not the brief's ~1 m — flagged for combat review. The bake caught and the rig test now pins:
  the striking segment must sit ON the target line at the clip's contact key (the first reap keyed it 0.7 m past the crossing and the
  whole active window whiffed).
- Evidence: tests/weapons.test.ts +4 (231/231 on the branch; shelf state, rig contract, contact-pose regression guard, data rules),
  `artifacts/weapons/scythe-notes.md`, sheets `scythe-A/`, `sche-B/…`, `scythe-C/`, `scythe-v1…v5/`, `executioner-baseline/`.
- 2026-09-18 (world lane): motes doubled 260 → 520 per owner live feedback ("motes are good. just double their number") after the
  half-size deploy (PR #123). Size stays 0.1 m, opacity 0.62, drift and gust unchanged — same specks, twice the air.
