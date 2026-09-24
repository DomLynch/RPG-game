# Executioner — lane state

The sixth opponent: the giant in the iron half-mask, scythe, hero rig at scale 1.36.
Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Now — 2026-09-24 05:0x UTC: #643 waits on DOM's yes (steel shells vs his dark iron); #603 is superseded

**Now (next session):** #643 (`knight/body-cover` @ `0726db15`, MERGEABLE) passed Lead on Body/Arms/Greaves; the helm is fixed
(`loot.json` `scale` [1,1,.72] about Head: visor 0.8 cm, back 2.3 cm). It is NOT READY until Dom says yes to the comparison
(https://github.com/DomLynch/RPG-game/pull/643#issuecomment-5807801460, images on evidence/knight-643 @ 17e14d00). If Dom asks
for dark iron, give the three shells a KnightIron-coloured untextured material; the ringHull shells carry no UVs.

**Also queued (Lead, 2026-09-24 ~05:30): the live 'grey rectangle' Dom saw on the Knight is his MAUL HEAD** — an untextured
WeatheredStone cube (#6e6a63, scripts/build-weapon.mjs:712), reading near-white at chest height. Not #643: trunk's knight.glb is
byte-identical to #643's. WEAPONS fixes the head (material + bevel) in build-weapon.mjs and hands over the rebuilt donor; THIS LANE then
rebuilds knight.glb (`node scripts/build-creatures.mjs knight`, not creature_pack.py alone: a pack-only rerun gives 5.27 MB vs the
shipped 6.68 MB) and posts idle + mid-swing before/after stills at 375x812 for Dom before READY. Before still: artifacts/character/knight-live-idle/sheet.png.
Answer Lead/Veteran/Combat questions. If Lead or Dom wants the great helm smaller, that's the next change (see Open).
Do not push to #603 (`knight/six-r` @ `1db7afd5`): it's in #643's history and was held out of Run 4.

**Done today**
- `9a182321` → `1db7afd5` (#603): the Knight's rebuild plus phase-r de650b76 merged in. loot_dwarf.py: phase-r's island drop and
  outward winding run for every family; the Knight's Gloves/Boots own-slot re-pose skinning is kept ahead of the winding.
- **#643** `ea512119`, `440ddc92`: worn by the player, the Knight's Body `replace` left him bare-chested (the plate's front sat
  inside the player's chest, the sides hung behind like wings); Arms/Greaves read as shards (Lead, 07:20 on run4-knight-front.png).
  Now `@build:knight-chest/-arms/-greaves` in build-warrior.mjs: ringHull shells over `triGrid(await playerWorn())`, all `over`.
  Breastplate spine_01→spine_03 at stations 0–1.46 with `pick:'outer'`, skinBySpine (lifted out of the Witch block); rerebraces,
  vambraces, closed greaves; no cuisses. loot.json gains a per-entry `bone` (knight.Helmet → Head).
- Receipts: suites 108/108; loot-layers exit 0; check-budget PASS (loot 2,537,949 / 3.5M); version guard 4/4;
  ladder/roster/loot-data/graphics 66/66; tsc clean.
- SIM_DIGEST re-pinned at 9 WITHOUT a bump (8c13363f…): trunk's v9 pin was taken with the Knight held, and `hold` isn't read by
  any sim file; `record-replay-check --strict` passes on the merged tree.

**Open**
- The top and back of the player's scalp show above the helm crown (the great helm cut is open at the back; same on #603).
- The steel shells read lighter and bluer than the Knight's own dark iron (named in the PR for Dom).

**Gotchas**
- **A bad render from your own harness is evidence, not an artifact.** My scratch paperdoll showed the bare chest at 01:0x and I
  put it down to the harness; Lead's frame proved it real. Only a fight-rig still disagreeing with it *and* a view that can show
  the defect clears it. worn-loot-check's arena still was too small to show a bare chest.
- `loot-layers` renders front-on and orthographic: it can't see a depth error (the helm) or a plate buried under the tunic.
  Use Veteran's `wearAll` render page (orbit plus ArmedWalk; copied to the worktree root, deleted after).
- spine_01→spine_03 is a SHORT axis: stations .2–1.12 fit a rib band. A breastplate needs about 0–1.46.
- `timeout` doesn't exist on macOS (exit 127). The Stop gate times out at 420 s under load 80+; a manual run took 356 s.
- Deploys ran back to back overnight; wait on `~/.claude/state/deploy_in_flight.json` with an until-loop, never assume FREE.

## Now — 2026-09-23 18:45: the Knight is HELD (#594); next is the depth-aware ARM RE-WEIGHT (target 23:00 Phase L)

**Progress 18:5x — `knight/six` @ 6451d4b7 (pushed; not a PR):** the arm split is DONE and works. For the Knight, `arm_mix` compares
a vertex's distance to the posed arm segments with its distance to the trunk/leg segments (`body_segments`, `segment_distance`),
biased 2 cm to the trunk over a 6 cm band. spine_02 is gone from the arms (was 8,482). On the attack sheet
(`artifacts/character/knight-seg2/sheet.png`) the hands stay on the haft through Maul_Heavy/Slash and the skirt stays still.
**Next: pale patches at the hip/underarm mid-swing.** They are NOT texture (only 0.35 % of the 2048 map has lum > .5; the plate median
is .25/.22/.20). So it's geometry: back faces or tearing where the fused arm and torso surfaces separate. Check whether the material is
single-sided and where the stretched faces are, then the six pieces (recipe below), the un-hold, and the mid-swing still in ONE PR.
Merge origin/phase-r in before the next Stop once #593 (the targeted Stop gate) lands (Strategy).

**Now (next session):** re-weight the Knight's arms in `scripts/character/creatures.py`, then land in ONE PR: the un-hold +
the new `knight.glb` + his six loot pieces + a MID-SWING still. Dom accepted the four new characters on live 7b277fd; "add the
weapons" = the Knight back with a SWINGING maul.
- **The defect:** `src/assets/knight.glb` (since 322bb1d) weighted his arms to `spine_02`: 8,482 of the vertices past |x| .25,
  and ~220 on the arm bones. His gauntlets hang at his hips while the maul swings. Cause: my `edge = 0.185*1.18 + max(0, 1.4*1.18 - z)*.26`
  line put the arm cut-off outside his tight arms. Diagnose with `scratchpad bones.py`-style dominant-bone histograms.
- **Tried (branch `knight/six`, WIP 1 commit):** the default edge .27/.055 moves the arms but smears the chest like a cape;
  edge .225/ramp .03 moves the arms but drags the skirt/belt, because his fists hang beside the skirt at the same x/z. **The fix
  needs depth (y), or a nearest-bone-segment transfer restricted by region**, not an |x| edge. Render the check with
  `node scripts/character-preview.mjs --src /src/assets/knight.glb --sheet 'Maul_Heavy:0,.35,.6;Maul_Slash:.4' --azimuth 60`.
- **Loot recipe (Lead, via Nightborn):** Nightborn's weld on every path (`char/loot-weld-textures` @ 37e44a2) + his own maps
  (no --material Steel) + decimate ratio **.5** (.12 and .3 shred) + one 512 atlas per opponent. Use `--boots` (knight/six adds it:
  foot/ball → Boots). His pieces currently render TOO HIGH/cropped in the paperdoll: his 1.18 root is not unscaled, so fix that too.
  No Arms/Gloves patches can exist until the arms are weighted to arm bones. LOOT cap is 3.5 MB (#585).
- **#594 (hold)** is open against phase-r @ 01ff59e5: hold: true, scene.ts glob, ladder/graphics tests, SIM_DIGEST re-pinned
  WITHOUT a bump (#439 rule; replay check cmp-identical). The un-hold reverts the hold and the glob line and restores the ladder tests.

## Now — 2026-09-24 (assigned by Lead, 2026-09-23 evening): the Knight to SIX takeable armour pieces, LIVE target 14:00

Dom's priority 1 (via Strategy): every opponent wears and offers six takeable armour pieces plus its weapon, Recruit rag and
scrap first. **This lane owns the Knight:** Helmet, Body, Arms, Gloves, Greaves, Boots (he keeps `knight.Maul`). The
Executioner's own set is already six.
- **Build on Nightborn's WELDED pipeline once it lands (~09:00)**: the seam weld is on `char/plague-doctor-loot` @ `817828e`,
  plus textures. **No quick cuts**: the unwelded `loot_dwarf.py --family knight --ratio .12 --material Steel` cut renders as
  shards (see the 17:0x correction below).
- **One PR.** Its body lists the six pieces, triangle counts, loot.glb size (check-budget, cap 2.0 MB gzip), and a
  same-frame phone still of the Knight WEARING them. `node scripts/loot-layers.mjs` must be green, and look at its renders
  before pushing.
- Open at handoff: `record-version-guard` is red on roster-v0 (RECORD_VERSION 7, sim digest moved). Combat's bump; not this lane's.

## Now — 2026-09-23 16:40: the KNIGHT is on roster-v0 (beta), complete

**Correction 17:0x — roster-v0 @ c725dce: knight.Helmet + knight.Body are PULLED (Lead).** loot-layers.test was red on
knight.Helmet, and the layer render showed the .12 Steel cut as shards (the TRELLIS mesh is split at every UV seam) with an
empty Helmet layer. loot.glb is back byte-identical to 636ce4d; `knight.Maul` stays. The carriers return post-beta on
Nightborn's seam weld (char/plague-doctor-loot @ 817828e) + textures. **Never ship a loot cut without running
`node scripts/loot-layers.mjs` and looking at the render.** Checks: 74/74 (incl. loot-layers); tsc clean.

**Now (next session):** nothing open on the Knight in this lane. Watch Combat's 21:15 re-pin (ARCHETYPES.knight) and the
21:20 roster publish; answer questions. Post-beta: textured own-plate loot, finisher validation, the Recruit-2 extras.

**Done today** (all merged into `roster-v0` by fast-forward merges, never force):
- `322bb1d`: his own body. `src/assets/knight.glb` = TRELLIS.2 on a hero-rig donor at `BUILD.knight` 1.18; ROSTER.knight is the
  LAST rung (after the Plague Doctor) so no career shifts; `ARCHETYPES.knight` = verbatim Executioner copy at scale 1.18
  (placeholder for Combat); finishers `['plainDeath']`; versus still `public/versus/knight.webp`.
- Arm solved to **84 / 1.10**: the posed WeaponDrawn origin is 0.2 mm off his right palm, which the reference puts at ~(-0.30, 0.82).
  The 79 / 1.0 seed sat 13.6 mm off. Solver: sweep angle x stretch, then gap to surface AND nearness to the reference palm.
- **TRELLIS fused the reference's grounded maul into the body**; `creatures.py` now cuts the head (a box in front of the
  boots) and the haft (a tube under the left fist), located on ortho front/side renders.
- `c07400d`: loot. `knight.Helmet` + `knight.Body` cut from his plate by `loot_dwarf.py --family knight --ratio 0.12
  --material Steel` (Body 2,863 / Helmet 429 tris). check-budget loot 1,535,953 of 2,000,000 (Auditer raised the cap, 636ce4d).
- `78657a9`: the MAUL. Donor rebuilt with WARRIOR_WEAPON=maul (#572's Maul_* family), so drawn = sim; `knight.Maul` is takeable.
- Targeted `node --test` (loot, loot-data, ladder, roster, graphics, characters, player-weapons, weapons, gear-stats): 146/146; tsc clean.

**Open:**
- `record-version-guard` was already failing on roster-v0 before these pushes (the sim digest moved); RECORD_VERSION is Combat's.
- `char/knight-body` and `knight/body-v0` are superseded by roster-v0; leave them, never delete a branch.

**Gotchas:**
- These tests are `node:test`. **vitest reports "No test suite found" on every file**; run `node --test --test-reporter=tap`.
- `scripts/warrior-recipe.mjs` refuses a fighter that isn't a ROSTER id, so **the roster entry lands before the donor build**.
- A reference that holds a prop gets that prop fused into the TRELLIS mesh. Look at an ortho render before binding.
- Loot is 1.5 → 2.0 MB gzip and every piece counts. Own baked maps cost ~110 KB of JPEG, so shared untextured Steel is the default.
- The deploy lock is `~/.claude/state/deploy_in_flight.json`. Check its pid is alive before believing either "free" or "busy".

## Now — 2026-09-23 (later): Knight body PAUSED, lanes report to Lead

**Lead, 2026-09-23: Knight body work is paused.** Dom's beta list makes the four new characters post-beta. Resume
deliverable 2 from `char/knight-body` at `951c9be` (parked, no PR) when Lead or Strategy lifts the pause.

- **#502 is MERGED** (`52dffed`); deliverable 1 is on trunk. Its local `quality:stop` has still never run (a deploy
  was in flight every time), so run it on trunk as a post-merge receipt.
- **#494 is closed, replaced by #526** (`char/knight-reference-v2`, `388d43a`, off trunk `2d614dc`): the same image,
  byte-identical, with the Knight section's withdrawn ratios corrected in `PROMPTS.md`. #494 conflicted, and a
  force-push is excluded.
- **Standing order (Dom, 08:50):** instructions from Strategy (`Frankendom - Strategy - Fable 5.1`) and Lead carry
  his approval. Excluded: force-push or branch delete, rolling back live, dropping data. See lane memory.

## Now — 2026-09-23

**The lane is the Knight.** The Executioner is done and live (#398, `01b6642`); nothing open on him.

**Deliverable 1, the silhouette test, is shipped — PR #502** (`char/knight-silhouette`). Bare and in loadout, from the
approved reference (#494). The finding: **stripped, the Knight is nobody** — shoulder-over-height 0.367 in kit to
**0.246** bare, widest point 0.41 to 0.257, and no feature of the bare outline is his, because helm, pauldrons, skirt and
greaves are his whole identity and all six slots come off. The Pitborn lane measured the same failure on the
Shieldmaiden's direction A (0.284 → 0.240, #498), where the flat shoulder line A was chosen *for* is the lootable
shoulder plates.

**That bar is now withdrawn, and the finding stands anyway.** Lead and Strategy ruled the gate **in-kit at every rung**,
the bare pass **informational**, because the game has no stripped state: take-one removes at most one piece per kill, the
opponent respawns kitted, and `src/grades.ts:1` says a grade is a material variant on a shared mesh, so his Recruit
`Helmet` and `Body` carry the same outline as his Origin ones. Brief 17 §5a records the number with its re-read
condition — **it goes live again if `take-one` ever removes more than one piece**.

**My own earlier ratios are withdrawn** (Executioner 0.36, Knight 0.39–0.40, in `PROMPTS.md`). They came off threshold
masks that fused arms into the torso, which inflates a plate figure and barely touches a bare-armed one, so the direction
was an artifact. Corrected off u2net mattes: **Knight 0.367, Executioner 0.374, Veteran 0.360** — three humans inside
0.014, the Knight marginally *narrower*. Lead replaced both rows of #499 and Strategy fixed SCOPE.md on #492.

**Deliverable 2 is under way — `char/knight-body`, head `951c9be`, no PR yet.**

- `08965ee` the TRELLIS.2 reconstruction: 4,508,492 B, sha256 `1c683e97…`, seed 190926, 1024/100k/2048, one attempt.
- `8cf4bae` the pipeline wiring: `BUILD.knight = scale 1.18` and 1.85 m, **provisional**, a tie-break on the 0.367
  midpoint judged by Dom on the versus still (Strategy, 2026-09-23); a change is one number in each file.
- `951c9be` bounds the donor step at 30 min — the quality gate caught it as a third unbounded `spawnSync` against a
  ratchet allowing two.

## Open

- **The maul: #509 IS merged (`3ff9097`) but it is a RECIPE, not a mesh.** Its content commit `4f55780` adds 41 lines to
  `scripts/build-weapon.mjs` and nothing else — `git ls-tree` on trunk finds no maul file at all, so the part must be
  produced before anything can reference it. (The sha reported to this lane, `4e34fa3`, is
  `Revert "Merge pull request #488 from DomLynch/stats/lane"`, not the maul.)
- **The hero rig has no `Maul_*` clips.** `src/moves.ts:406` still reads `paths: creaturePaths(CLEAVER_PATHS, 'Maul')` —
  the Minotaur's creature clips. Weapons is authoring the `Maul_*` family on the hero skeleton (their `Warhammer_*`
  precedent). Until that lands, **the donor step and the fit proceed on the warhammer stand-in as wired**; only the arm
  re-solve and the versus still wait.
- **The arm solve is blocked on the maul reaching trunk.** `creatures.py`'s `arm_angle` is seeded at **79** and is a
  *starting point*, not a measurement. Strategy's ship gate: the body PR carries the **solved** value against the **real**
  maul part (`weapons/maul-part`, `4f55780`), never the warhammer stand-in or the seed. The donor step itself is not
  blocked — identical `WEAPONS` reaches and the maul crowns at .76 like the warhammer's.
- **Remaining, in order:** donor step, Blender fit, pack, arm re-solve, versus still, then the generator-hash rebuild of
  `dwarf`, `executioner` and `veteran` **in the same PR**, each accessor-equivalent to trunk (§5, Dwarf v2 precedent).
- **`npm run quality:stop` on #502 has never run** — a deploy was in flight every time. Ruff clean, no release rows.
  Ask Deploy for the window.
- **Calibration owed to Strategy:** matte vs plate on the seven figures that have both a rig and a reference PNG, once
  #500 is on trunk. Small delta → #502 stands with the delta as its stated uncertainty and mattes are the instrument for
  reference-only characters; large delta → no cross-instrument comparison at all, which would hit the Shieldmaiden and
  the Witch too.
- **#469, this file's own PR, is still unmerged**, while four lanes are told to copy it as their worked example.

## Gotchas

- **Silhouettes need a subject matte, not a threshold.** Three threshold attempts failed: the backdrop is a *radial*
  vignette so a per-row left/right estimate sags mid-image; a closing wide enough to erase the figure over-reaches across
  that gradient; and **polished plate mirrors the backdrop** at its own luminance (163–171 against a 162–166 grey) — the
  same failure Pitborn hit on the shield face. The harness is `scripts/character/silhouette.py` (#502).
- **A border flood-fill is right for a hollow figure and wrong for plate.** An arm/hip gap is an *enclosed* hole, so the
  flood closes exactly the articulated outline the test exists to judge.
- **Do not re-run the outer-arm-edge fit as a measurement of `arm_angle`.** It reads **68.9° for both** the Veteran
  (solved 62) and the Executioner (solved 64). A method that cannot separate two known values cannot fix an unknown one.
  Only the *gap* survives: the Knight reads 84.7°, ~16° closer to vertical than either.
- **Never upscale a short mask to the comparison height** (#499) — it invents edge detail on one side of the pair only.
  My own sheet did it before `84195a4`.
- **Stance before breadth** (Pitborn's rule, #499): a comparison is only valid between figures in the same stance, and no
  measurement code can detect it — the shoulder-line finder is blind to what the arms are doing.
- **The 80 % coverage floor is not a silhouette measure.** `tests/loot.test.ts:95` compares **mesh surface area in m²**
  against the *player's* own draws in that slot. It cannot be taken from a reference or a mask; it runs the first time
  the draw exists.
- **After fast-forwarding onto trunk `fe0d8e0`, run `npm ci` before the gate.** A worktree whose `node_modules` is the
  old 2026-09-17 install fails `npm run quality:stop` on a missing `@types/node`; that is a stale install, not a
  breakage (World, relayed by Strategy 2026-09-23 — their gate went green immediately after). This lane's own gate ran
  green on its current install, so it bites on the next fast-forward, not today.
- **The one-deployer hook scans the whole command string** — a heredoc containing "build" or "deploy" trips it even for a
  plain `git commit`. Write the message to a file and `git commit -F`.

## Now — 2026-09-22

Nothing building and nothing open from this lane. **#398 merged (`01b6642`) and is live** — verified on the served file,
not on the merge: `assets/executioner-9s1ZxRnx.glb`, HTTP 200, 4,414,104 B, carrying
`KHR_materials_specular { specularFactor: 0.4 }`, 38 clips, generator `54999ae9`.

**The owner widened this lane on 2026-09-22:** *"Your scope now includes the Knight (Brief 17): a masked heavy opponent
wielding the maul, two-hand … The Executioner stays yours."* Terms: brief first, **silhouette test at the fighter's camera
passes before any model work**, AAA judged on a **phone screenshot** (Dom plays on an iPhone — a Mac render is not the
instrument), **one PR per deliverable with its receipt**, report to Lead, **nothing ahead of the shield in Combat's queue**.

**The Knight's reference is APPROVED and landed — #494** (`docs/character-references/knight-source-v1.png`, lean plate + great helm, owner-picked 2026-09-22). **Deliverable 1, the silhouette test, is unblocked and is the next action.** Keep one finding from the approval: differentiation from the Executioner is **not** about mass (measured shoulder/height — Executioner 0.36, Knight 0.39-0.40) but about **soft outline versus hard** — his hood, bare arms and falling cloth against the Knight's squared pauldrons, flat plate edges and articulated limbs. The build must keep that contrast; "bulkier than the Veteran, thinner than the Executioner" is a build-spec number the reference does not settle.

~~Blocked on the reference image.~~ It gated deliverables 1 and 2 (for a masked character the
silhouette *is* the design) and is now satisfied. Brief 17 is landed as **PR #489** (`docs/briefs/knight.md`), approved by Strategy with
its §7 rulings written in.

**When the image arrives, deliverable 1 is the silhouette harness** — black shapes at the fighter's camera beside the
other nine, run **bare and in loadout**, the bare pass being the honest one (armour is takeable, and a full-plate
closed-helm figure reads in kit and vanishes stripped). One PR per deliverable, each with its receipt image; AAA is judged
on a **phone screenshot**, never a viewport render.

The Shieldmaiden (Brief 15, written here as "the Nord") is **not** this lane's — it stays with Lead. Brief 15 (written as
"the Nord", since renamed **the Shieldmaiden** and amended by Lead: a woman, and a new one-hand bearded axe family in
place of the cleaver) is moving to `docs/briefs/shieldmaiden.md` in PR #471. Brief 17 **the Knight** is landed in **#489**
as `docs/briefs/knight.md`, which creates `docs/briefs/` (so does #471 — different files, no conflict).
Brief only, nothing built, and **the owner has not confirmed the lane expansion** — this session was scoped to the
Executioner on 09-20 ("only work on that char"). Lead agreed the refusal is correct: writing the brief was in bounds
because it changes nothing; building is not. Do not start the Nord on a peer's say-so.

The Knight's own finding, worth keeping: **the maul is not a shelf-ready hero-rig weapon.** `moves.ts:406` makes `MAUL` a
cleaver spread with a two-hand grip and cleaver paths under a creature prefix, and no maul asset exists in the repo — the
geometry sits inside the **held** `minotaur.glb`. Promoting it is a real Weapons deliverable. And because a two-hander
stows the shield, the Knight has no shield; "cannot be cut" must come from plate and guard rules, which is Combat's to
define, not a character brief's to invent.

Lead's rulings on the Shieldmaiden (09-22), so the next session does not reopen them: the **shield asset is Multi Chars'** (the Nord is
its second consumer, he does not author it); **if Combat's shield slice misses beta freeze the Nord does not ship, and
must not ship shieldless** — his shield is always-on, so the Veteran's "start at Gladiator" fallback does not transfer;
the kit ships **Recruit-2 first** rather than waiting on the shared library; and an **owner reference image is a required
input**, not a nice-to-have. Scope fence: the hero rig and the hero's assets belong to Character Main — the Nord reads
the hero skeleton and clips, it never edits them.

## Done — 2026-09-20 → 22

- **#177 the scythe's haft** (live). `setBladeBlood` tinted every mesh of a two-handed `WeaponDrawn`, and every shipped
  two-hander ships its handle as its own material, so the whole scythe went red after a kill. `bloodiesMaterial(name,
  twoHanded)` in `finisher-blood.ts` bloodies the blade and never a handle (`/haft|handle|grip|wrap|leather|cord|wire|^ash$/`).
  Fixed the trident, cleaver, knife, estoc and maul hafts at the same time.
- **#206 the TRELLIS rebuild** (live `fefb8fe`, merge `60fccd4`). The procedural v5 body replaced by a fitted TRELLIS.2
  reconstruction; **v5 kept byte-for-byte at `src/assets/source/backups/executioner-v5.glb`** and used as his own donor, so
  the 1.32× root, the scythe `WeaponDrawn` and all 38 clips are inherited. 45,471 tris, 3.16 MB gzip (v5 3.69).
- **#293 the scythe's blade** (live `5debe58`). Owner, 09-21: "still turns red". The haft was fixed; the crescent was not —
  a broad metallic blade took the 55 % lerp toward `#7a1410` as a *red mirror*. Two-handed weapons now take the dark tone
  `#2a1516` with `metalness ≤ .3 / roughness ≥ .7` (a wet dark film); the sword path is unchanged. In `src/gore.ts`.
- **#398 surface specular + donor hold keys** (live, merge `01b6642`, release `607126a`). Skin-strength specular on the
  Executioner surface kills the wet-plastic sheen a normal-map-less reconstruction takes; `sync-hold-keys.mjs` puts
  `cb1ee6a`'s Run Through hold channels into the `executioner-v5` and `veteran-v1` donors, so a creature rebuild stops
  silently regressing the raised-palm hold. Dwarf and Veteran rebuilt in the same PR for the generator hash.

## Open

- **The Nord** — blocked on the owner confirming the lane expansion, then on an owner-approved reference image, Multi
  Chars' kit schema, and Combat's shield slice. All four are in the brief.
- **The mask reads dark under the hood in game.** A relit source was tried and **rejected**: the mask is recessed, so
  TRELLIS bakes it dark whatever the source lighting, and that bake shifted his skin red. It reads acceptably at gameplay
  distance; if it is ever revisited, the lever is geometry or a material, not the source image.
- **FLUX.1 [dev] is a non-commercial licence** (`src/assets/README.md`) — the owner confirms its terms on output use
  before commercial launch. TRELLIS.2 itself is MIT.

## Gotchas — the expensive ones

- **Any edit to `creatures.py` or `creature_pack.py` moves the generator hash**, and `creature-check` then reads every
  live creature as stale. Rebuild all of them in the same PR (today: dwarf, executioner, veteran) and show each
  accessor-equivalent to trunk. Measured on trunk `beb3120`: baseline passes `dwarf, executioner, veteran`; adding one
  family entry to `creature_pack.py`'s `base` map and re-running gives `Stale creature: rebuild with build-creatures.mjs`
  (`creature-check.mjs:11` digests both scripts into the pinned `generator` hash). **Adding a new character through the
  creature pipeline therefore costs a rebuild of every live creature** — plan it into the PR, it is not a defect.
- **`cb1ee6a` patched the Run Through hold keys into the shipped rigs but not into the creature donors**, so any creature
  rebuild silently regressed the raised-palm hold — `tests/characters.test.ts` catches it on the Veteran only.
  `scripts/character/sync-hold-keys.mjs <donor> <shipped>` syncs the 17 left-arm `Fin_RunThrough` channels. Applied to
  `executioner-v5` and `veteran-v1`; the dwarf donor already matched.
- **The `build-warrior` donor step is not byte-reproducible across machines.** Restore a donor from trunk and re-run
  fit/pack/Quiet-One instead of regenerating it, or the diff is noise you will chase.
- **`Death_QuietOne` is authored per body** on its own skin envelope, so it is the one clip a creature does not inherit
  verbatim; the donor's corpse sank the new body 0.21 m. `creature-check` excludes it from the inherited-clip comparison.
- **Solve a fitted arm against the reconstruction's PALM, not its hand centroid.** Palm-solving took the scythe grip gap
  from 0.04–0.08 m to 0.019 m. `keep_fingers` keeps the donor's finger weights so the clips curl his fingers on the haft.
- **A reconstruction ships no normal map**, so its smooth surface takes the full dielectric specular as a wet-plastic
  sheen. `SURFACE_EXTENSIONS` in `creature_pack.py` stamps skin-strength specular (the hand-built heads use 0.5 / 0.35).
- **The TRELLIS route is `gradio_client` + the local HF token** (`~/.cache/huggingface/token`, PRO). The HF MCP has
  `gradio=none` so `invoke` is disabled; the hf.co Space iframe is invisible to the Chrome extension; the direct
  `*.hf.space` URL freezes the tab. ~90 s per reconstruction at seed 190926 / 1024 / 100k faces / 2048 textures.
- **Playwright's default `waitForFunction` polling never fires on the game page** — pass `polling: 250`, or a passing run
  looks exactly like a frozen game (cost 40 minutes). `page.goto` needs `waitUntil: 'commit'`; headless GL is ~0.25 s a
  frame, so render only the frames that carry a blow.
- **Gate every browser run on `pgrep -f "bash scripts/deploy.sh"`.** One capture went out during a deploy on 09-22
  because the check and the run were chained in one command instead of the run being conditional on the check.
