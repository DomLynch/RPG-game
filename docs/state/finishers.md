# Finishers & gore — project state

## Now (Finishers & Gore lane, 2026-09-25 late night; Lead orders the queue: (1) row-23 split, (2) Rivet A, (3) #752 redo)

**Now — release row 23 (blood gate) split (Lead, speed job)**: branch `finishers/row23-split` @ 12f28328 on trunk 3e35eefd (pushed, NO PR yet). Row 23 took 520.6 s of the 570 s release wall (Deploy's receipt). `.quality-gate.json`: the one row becomes three with disjoint `--only` sets, same flags (`--blood-check --durations --no-video`), labels blood-gate-a/b/c: splitCrown+plainDeath, decapitation+opened, runThrough+quietOne. Everything in the row is per finisher (durations loop, 3 mode stills, held-blood asserts), so no assertion is lost. Test `tests/finishers.test.ts` (+1): the blood rows cover `Object.keys(FINISHER_SECONDS)` exactly once, same flags, no --opponent/--seed, unique labels; mutation-checked (drop quietOne → red; plainDeath in two rows → red). finishers.test 8/8, release-checks.test 8/8; release triggers unchanged (`finisher-preview:first` = row 1). Old row passes on trunk (exit 0, 624 s at load 80–100 — not a valid timing). Per-finisher marks from that run: ~37 s startup, then splitCrown ~100, decap ~75, runThrough ~100, quietOne ~100, opened ~120, plainDeath ~85 s → each new row ≈ 190–235 s.
Still owed: (a) the timing receipt at load < 30 — `$TMPDIR/row23-time.sh after` then `before` (script in $TMPDIR; logs `$TMPDIR/t-{a,b,c,before}.log`; if $TMPDIR is gone, rerun by hand: the three rows in parallel, then the old row alone, one FREE box); (b) tsc + `npm test` on 12f28328; (c) open the PR and send Lead the head + before/after row times. Known: release-checks.mjs orders unknown commands at the median duration, so the first deploy after merge may start the new rows late; from the second run they are known and start first.

**Next — Rivet A (Strategy ruled the dent (a) FAILS on the full frame: failure two)**: #764 CLOSED `parked` by Lead, branch `finishers/knight-dent-b` kept (soft-decal work reusable). Build Rivet A as the Knight's signature; before merge ONE full 375×812 frame 0.3 s after the blow → Strategy via Lead; same test: visible without hunting, never a disc. Also in this file: the dark "puck" floating beside the Knight's chest (≈(470,520) in the 750×1624 frame) is identical before and after #764, so it is NOT B's dent; World confirms it is not an arena prop. Likely one of the other signature marks (4 fired: 3 on spine_03 ~0.26 m off the bone, 1 thigh_l). Debug-render the marks (texture forced opaque red) to find it. Frames: scratchpad `knight-dent-{before,after}-375-full.png` (session bc25cae1, may be gone); regenerate with the harness patch in lane-notes/.

**Next — #752 redo (Lead/Strategy, Goblin lane dark)**: short-opponent lock camera (Strategy's ruling C: scale < 1 lifts the camera + an over-the-left-shoulder step near contact, camera.ts cameraPose + scene.ts; old branch goblin/lock-camera-height @ d76c917a). It failed release row 25 (`finisher-preview --only decapitation --opponent goblin --label decap-front-goblin-gate`: "headless corpse is seen past the killer", maxCameraStep .0077, side .109) and was reverted by #757; row 25 passes without it. Redo off trunk: keep C for the FIGHT and give the finisher its own framing (for example, fade both terms once a finish starts). Before READY: the finisher-preview release rows locally for Goblin AND Dwarf (decap + the other beta finishers), plus a fresh pair of 375 stills matching C.

**Then — kill-camera sweep**: branch `finishers/kill-camera-hold-r` @ f7906420 (pushed). Lead's rule: the body stays clear of the loot panel AND its Take/Leave buttons (measured boxes; the 40 % line is dropped). quiet-one-browser-check now logs panel/button boxes and samples overlap every 0.5 s for 10 s of page time (stills at 5 s / 10 s). At open (375×812, vs goblin): panel y 148–351.5, buttons y 721–761, body y ≈ 408–565. Sweep so far: runThrough and decapitation 0 px² overlap in 21/21 samples; splitCrown, opened, plainDeath still owed. If all clear: NO camera change; one PR that turns it into an assertion inside the existing quiet-one row (no new release row). Killer occlusion of the corpse (the decap still: the hero stands in front of the goblin) is its own later item.

**Done today (2026-09-25)**: #748 (Auditer's applyBoneTransform override) reviewed by reading against three 0.186.0: the same maths minus the spread, so the wound re-glue is unchanged. Grey blood on the hero's tunic (live cc27cce5) reproduced and closed as NOT gore: the blood stays red on the worn Knight set with and without env reflection; the grey-blue is the Knight carrier drawn flat and untextured (routed by Lead to Character Main / #709).

**Open**: Nightborn head-slot mark −2.7 cm (parked). Hero chest wounds are hidden from the behind-the-hero camera (parked).

**Gotchas (09-25)**: macOS has no `timeout`/`gtimeout`, so use a bash until-loop. The PreToolUse deploy guard blocks the WHOLE compound command, including appends/edits, if it holds `node --test`; it even blocks single-file tests during a deploy. quiet-one-browser-check's default opponent (veteran) no longer yields a kill (scripted player loses 3/3), so use `--opponent goblin` like the release rows; its later Quiet-One clip assertion fails for runThrough/splitCrown/plainDeath, but the framing lines print first. The finisher-preview harness runs signatures OFF: pass `view.setSignature('?signature=B', null, true)`. Inside the harness's page template you cannot use backticks (it is itself a template literal). Signature body marks are lit metal (metalness .6) with depthTest off; dark at .6 over mid-grey steel reads as nothing at 375. Hold browser runs until load < 30 and no deploy lock (Lead's standing rule).

## Earlier Now (2026-09-23 afternoon)

**Now**: PR #571 `finishers/floor-blood-real` @ 6efc7d3 (floor blood stains the sand). Handed to Lead for the batch with the shield and zoom fixes; the local blood gate and wounds gate both exit 0. Next is Dom's verdict on the phone once it is live. After that, the parked kill-camera framing (`finishers/kill-camera-hold`, measurement only, a separate PR per Lead's sequencing), then briefing Lead on the `characters.ts` finisher-geometry interface scope before touching that file.

**Done today**: #544 (B/C/D body-wound art rotating per hit, tint off black, floor stars gone) MERGED; #549 (drops from the body to the sand, CPU ×4 receipt) MERGED; #546 (quiet-one check waits for a live Rematch) MERGED. Step 0: the hero's runs are NOT clamped by `surfaceReach`; all 5 marks are uncapped (asserted in the wounds gate).

**Open**: Nightborn head-slot mark −2.7 cm at 0.3 s and MISS at 1.5/3 s, cause unknown (bind-pose sphere disproved). The hero's chest wounds are mostly hidden from the play camera behind him by the facing test; that is correct, but Dom may read it as "no blood on me".

**Gotchas**: `finisher-preview.mjs` `option('x')` reads the NEXT arg, so a bare `--wounds` as the last arg is silently off; use the release row's argument order. `play()` kept one frame cursor across windows until #549 (a second window stepped on from the first one's index). `rear()` renders one frame without advancing the wounds, so a probe after it reads stale facing. The PreToolUse deploy guard blocks a WHOLE compound command if it contains `node --test`, including the file edits in it. Never start a browser gate from a chained command that could outlive FREE: a deploy started mid-run on 09-23 and I had to kill my own blood gate.

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Blood that reads real: body art, drops, floor (owner 2026-09-23: "paint-ball graffiti stickers", then "cartoon-ish" on the floor)

`src/gore.ts`. Body: Dom picked B/C/D of four FLUX candidates (scratchpad `gen.py`, white paper → alpha-cut); `WOUND_ART` rotates per hit from its own seed, drawn after the runs so their seeds hold; upright ±0.2 rad, top edge at the cut; `FRESH` #7a2a2c → #e0a0a0 (the multiply over the photo read as soot). Drops (`DROPS`): the first run of a stopped wound sheds a drop every 3–6 s until half dry; caps 8 falling / 24 spots; pooled. Floor (`multiplyOnto`, `scripts/blood/floor-textures.py`): the kill pool, hit splashes and drop spots MULTIPLY onto the sand, `dst × lerp(1, tex, a·opacity)` through premultiplied custom blending, so the grain shows and fades go to "no change"; near-black core, translucent rim, noise-drawn silhouette (lobes drew a star again), one-sided spatter; stains darken over 8 s.

Evidence: #544 test:all 537/0/2, wounds gate exit 0; #549 gore 17/17, CPU ×4 red p50 1.3 / p95 2.0 vs off 1.1 / 1.7 ms; #571 test:all 563/0/2, blood gate + wounds gate exit 0, same-frame before/after `artifacts/character/floor-after/floor-pool-before-after.png` (375×812, hero killed at frame 2196, +3 s). Remaining: Dom's eye on the phone for #571.

## Blood conforms to the body it lands on (owner 2026-09-22, on a live fight: "blood is still floating on bodies... not joined to the gear or opponent")

`src/gore.ts`, branch `finishers/blood-conform` on c43c677. Diagnosed by instrumenting the close-up probe to raycast from 30 cm outside each mark back along its own normal and report the gap to the first skin or cloth. On trunk: Veteran 0.9 cm at 0.3 s drifting to **5.8 cm** by 1.5 s; Nightborn **−2.7 cm** (mark behind the face mesh, painted over it because depth is off) and frames with no surface under the mark at all. Three faults, not one: (1) the mark's plane used the site table's guessed direction, not the struck face's normal, so a flat 9.6 cm quad sat crooked on the cloth; (2) skin and cloth deform away from the bone after the hit — anchoring once is what turned 0.9 cm into 5.8 cm; (3) strands hang straight down in the mark's plane, so past a cape hem or the underside of an arm they ran into open air.

Fixes: `surfaceHit()` keeps the point the ray met AND that face's own normal, both in the struck bone's frame; one mark is re-measured per frame round robin (≤10 in the pool → each re-glued ~6×/s for one ray a frame, skin list cached per rig, no per-frame allocation); `surfaceReach()` caps each wound's run at hit time to where the surface still continues under it (4 short rays per hit, none per frame); the facing test goes 0 → −0.15 so a grazing mark on a silhouette does not blink out. Depth test and depth write untouched.

After: Veteran and Executioner **0.4–0.5 cm** at 0.3 / 1.5 / 3 s — the 4 mm proud, i.e. on the surface. Evidence: gore.test 14/14; `test:all` 504 pass / 0 fail / 2 skipped; `quality:stop` exit 0; wounds gate veteran exit 0 (0.06 → 0.12 → 0.13 m, the 8 cm floor survives the reach cap) and goblin exit 0 (0.04 → 0.09 → 0.09 m); release rows 1, 2, 13, 14, 29, 31 (what `scripts/release-rows-for.mjs` says this change triggers) all exit 0; stills `artifacts/character/blood-closeup-veteran/closeup-side-{0.3s,1.5s}.png`.

Open, stated not hidden: on the Nightborn the probe still reports **−2.7 cm** at 0.3 s for a head-slot mark (behind the face mesh) and **MISS** at 1.5 s and 3 s — no surface within ±30 cm of the mark along its normal, so the re-glue keeps its last good anchor and that mark can hang off the body on those frames. A padded bind-pose bounding sphere was tried as a cause and **disproved** (numbers unchanged), so the cause is still unknown. Not a regression from this change; the Veteran and Executioner numbers are.

## Blood on arms and wrists + marks on the actual skin (owner 2026-09-22: "run down the leg and arms", "a lot of skin ... wrists", "it floats off the chars")

`src/gore.ts`, branch `finishers/blood-limbs` on b67281e. (1) `woundSite(hit, limb, mirror)`: a side cut across the torso now lands on the near arm for a seeded `ARM_SHARE` (.5) of hits — half upper arm (`upperarm_l/r`), half the wrist end of the forearm (`lowerarm_l/r`); a rig without arm bones falls back to the flank. The overhead cut's shoulder mirrors per hit, so on the Veteran it lands on the bare shoulder as often as the cloak. Legs were already routed (sim `legs` → thigh). All drawn from the same LCG as the runs: replays land the same limb. (2) `surfaceRadius()`: the mark's offset from the bone is measured per hit by a raycast against the rig's own skinned meshes along the wound normal (4 mm proud, clamped to .35–1.5× the slot's table value; the table value stands with no skin/under node) — the fixed .22 shoulder guess hung in the air on a bare shoulder. Evidence: gore.test 14/14 (arm/wrist/flank bones + seeded determinism + no-arm fallback; skinned-box raycast → .104 not .22, fallback, clamp, end-to-end through `hit()`); wounds harness veteran exit 0 (0.06 → 0.12 → 0.13 m), goblin exit 0 (0.04 → 0.09 → 0.09 m); stills `artifacts/character/blood-closeup-veteran/closeup-pick2-1.5s.png` (wrist), `closeup-side-1.5s.png` veteran + goblin (mark on the surface, side-on). Remaining: PR's own release-checks run.

## Blood runs v2: it drips, it does not stretch — lit photo decals over the armour (owner 2026-09-22, "like a tap with a slow leak", "no paintball sticker")

What changed (`src/gore.ts` `createBodyWounds`, branch `finishers/blood-runs` on dcb9d61):
- Runs GROW: each strand is seeded from the hit (`woundSeed`, `lcg`), starts as a bead within 0.3 s, lengthens with `ease(t)=1-(1-t)^2` over 1.5–3 s to a ceiling of 11–19 cm × rig scale, then stops and never shrinks. No cycling. Replays draw identical geometry.
- Dry-out: from the last stopped run, 20 s from wet (roughness .42, fresh crimson) to matte (roughness .75, dried tone). Dark mode multiplies; blood off hides; rematch clears.
- Material: `MeshStandardMaterial` (lit) with FLUX-generated splat + drip photo textures and luminance normals (`src/assets/blood/*.png`, 4 files, ~110 KB), tinted `#7a2a2c` over the photo reds — the raw texture read neon ("paintball sticker"). Canvas tint stands in until the PNGs land and under node.
- Over the armour (Lead ruling 2026-09-22, Dom: "leaks through, over"): `depthTest:false`, no polygonOffset, so a cloak or the Goblin's pauldron never hides a wound. Through-body bleed is stopped by a facing test in `update()` — a mark whose bone-frame surface normal faces away from the eye (`camera.position`, passed from scene.ts) is hidden; its clock keeps running. Overhead shoulder slot radius .16 → .22.
- Known limit: with depth off, a wound on the far fighter can draw over the near fighter's limb when the limb crosses exactly in front of it. Glossy-material pass = separate follow-up ticket (Strategy), no wet-shader work.

Evidence (all on the PR head, 2026-09-22):
- `node --test tests/gore.test.ts` 12/12 — growth (bead at 0.3 s, ≥1.5× at 1.5 s, ≥ 8 cm, never shrinks), world-down across 5 bone rotations, seeded determinism, dry-out, depth-off + facing + goblin ≥ 8 cm at scale .78. `test:all` 469 pass / 0 fail / 2 skipped; `quality:stop` exit 0.
- Wounds harness (`finisher-preview.mjs --wounds`): veteran exit 0, runs 0.3 s 0.06 m → 1.5 s 0.12 m → 3 s 0.13 m; goblin exit 0, 0.04 → 0.09 → 0.09 m (the 8 cm assertion now includes the goblin, pauldron in place). Stills `artifacts/character/blood-runs-{veteran,goblin}/wounds-{0.3s,1.5s,3s}-{front,rear}.png`; close-ups `artifacts/character/blood-closeup-{veteran,goblin}/closeup-*.png`.
- Release rows 0 (run-through), 22 (blood-gate), 28 (record-replay), 29 (wounds-gate), 30 (kill-link), 32 (endgame-hud) all exit 0 locally.
- Phone-tier cost: 10 marks / 22 live runs, `update()` 0.004 ms/frame over 18 000 frames under node, heap delta after gc constant at 6 000 vs 18 000 frames (no per-frame allocation).

Remaining validation: PR's own release-checks run green (rows 22/29/32 on the GitHub runner); Dom's eye on the phone after deploy.

## Body wounds v1: blood from every landed blow, not just the death screen (owner go 2026-09-21, "blood dripping ... after a heavy hit")
Owner: marks from every landed blade blow on any fighter (hero through Dwarf), sided to where the swing came from, showing once
that fighter is at 60% health or below and darkening toward death — separate from the existing finisher/death gore.

`gore.ts` `createBodyWounds` (new, alongside the existing splat pool / throat-cut decal / blade blood): a 5-mark pool per
fighter, presentation only — the simulation decides the hit, damage and location; this only draws it. `woundSite(hit)` maps
the sim's own `HitLocation` (head/torso/legs) + swing `Direction` (right/left/overhead/thrust/low) to a bone and a local
direction in the STRUCK fighter's own frame: a right-hand swing crosses to the victim's left (torso `spine_02`/`spine_03`
for overhead, legs mirror the same side onto `thigh_l`/`thigh_r`, thrust/low sit centred). `scene.ts` calls `bodyWounds.hit`
on every landed `Hit` event (never a kick), skips the same `hasBlood(opponentId)` no-blood gate the splats already use, and
scales the mark by `OPPONENTS[id].scale` for the bigger creatures. Marks ride their bone every frame; severity (opacity +
drip length) scales linearly from 0 at 60% health to full at 0%; a finisher's own gore (opened cut lines, the throat, the
plain death's blade tint) takes over the killed side's marks so they don't fight the finisher's own effect — the plain
death keeps his wounds visible, `bloodMode 'off'` hides everything like the rest of the gore system, rematch clears the pool.

Tests: `gore.test.ts` — `woundSite` direction/location table, `createBodyWounds` (pooled hit registers on a missing bone as
false, threshold show/hide, follows the bone, `off` hides, severity scaling on opacity and drip, rematch clear); mutation on
the threshold comparison caught. `test:all` 412/412. Harness: `finisher-preview.mjs` gained an opt-in `--wounds` still
(a scripted duel to the first landed blow at ≤60% health, +30 settle frames) + a dedicated `wounds-gate` release row
(`--only plainDeath --wounds`) so the other 7 finisher-preview rows don't pay the extra page load. `wounds-gate` ran green
(exit 0; `wounds: warden 4 mark(s) showing (opacity 0.58, drip 0.58); off → 0`) on the goblin harness and again on the
release-row fixture; owner reviewed the rendered stills (`artifacts/character/wounds-gate/wounds-phone-rear.png`) before
the PR went up.

**Audit follow-up (2026-09-22):** peer review of the pushed head (`fcc835b`) found three real items, fixed here: (1)
`bodyWounds.update` re-ran a recursive `root.getObjectByName(mark.bone)` every frame for every used mark (≤10) — `hit()`
already resolves the bone, so it's now cached on the mark at hit time and reused, dropping the per-frame search entirely
(mutation-checked: nulling the cache assignment fails the existing test). (2) `.quality-gate.json` had lost its trailing
newline — restored. (3) Check 5 (`fatal-crowd-browser-check.mjs`) failed on the pushed head with the same wall-clock
timeout signature as an unrelated PR's (#366) known-flaky run, and trunk's own baseline for that check is cancelled, so
flake vs. this PR's heavier per-frame cost wasn't settled by the auditor's read alone — re-running it locally, alone, with
no deploy in flight, to get a clean receipt before pushing the fix. Also: the "mutation caught" claims throughout this
entry are a manual verification step done during development (temporarily break the assertion's target, confirm the test
fails, revert) — not an automated mutation-testing framework wired into the repo; noting this since the audit read it as
possibly a claim about tooling that doesn't exist here.

## Run Through hold: two-handed grip, the off-hand rides the hilt (2026-09-21, owner: "giving the middle finger")
Owner, on the phone hold: the killer's left hand read as a raised open palm / middle finger. Two causes. (1) Rig: the
hold froze the Riposte contact frame's thrown-out left hand; even after moving it to the hilt the Armed pose's fingers
are OPEN (tips 15–18 cm from the wrist), so on the hilt it still read as a raised palm. `build-warrior.mjs` now closes the
off-hand on the grip 7 cm behind the sword hand with the RIGHT hand's fist mirrored onto the left fingers ((x,−y,−z,w)
on the mirrored finger bones; tips 5–10 cm, matching the right). (2) Runtime: `aimBladeAt` turns only the sword arm
onto the victim's chest, so the fist stayed where the clip left it — hanging by the face. `characters.ts` re-solves the
left arm (two-bone reach, the clip's own elbow bend) onto the hilt after the aim, restored each frame like the aim itself.
Rigs: hero rebuilt; goblin rebuilt from cached parts (only the 17 hold left-arm channels changed, mesh/texture bytes
identical); Veteran/Pitborn/Nightborn/Executioner + their weapon twins (estoc, cleaver, warhammer, scythe ×5) took the
hero's 18 left-arm hold keys in place (bytes overwritten inside the binary chunk, file length unchanged — the parity
tests demand identical Fin_RunThrough tracks on the shared skeleton; the estoc twin stays byte-identical to nightborn).
Creatures/Dwarf untouched (own skeletons, never the killer, tests green). Receipts: test:all 402/402 (new off-hand
assertion in the hold-aim test; mutation without the re-solve fails it); release row 0 exit 0; harness
`artifacts/character/runthrough-fist2` settled/rear/landscape stills show both fists stacked on the hilt.
Remaining: owner look on the phone; row 22 (blood-gate, all outcomes) not rerun on this head.

## Finisher side view: measured reach for Quiet One too, foreshortened fit, rate-limited back-off (2026-09-21)
Deploy #57 on fdd6032 (#303 anti-turtling) failed release checks 17 and 20: the passive test Executioner is now lashed off the
wall and dies at heading π nearer the wall. Quiet One's body left the portrait frame (x −40); Opened's reach-driven back-off
stepped 0.267 in one frame (> .25). Fixes (camera.ts, scene.ts): the fallen rig's world bounds feed `finish.reach` for
Quiet One as they already did for Opened's pieces; reach growth is capped at 1.5 cm/frame; the side-view half-width uses
the foreshortened axis (gap/2·sin angle + beyond) — the unforeshortened ask pushed the fit past the 11.5 m arena clamp,
which silently undid it; Quiet One (and any measured reach) gets the inward front-quarter camera candidates near the wall.
Receipts: checks 17 and 20 exit 0 locally on this head; camera/creature-opened/characters 50/50 (the characters test now
feeds the measured reach like the scene does).

## Opened side view fits the landed pieces (2026-09-21)
Release check 17 (`finisher-preview --only opened --opponent executioner`) failed on trunk after #262 (directional guard):
the harness duel now kills at heading 0.99 instead of 1.86 and the 1.36× body's leg half slid under the portrait margin
(x −0.3 vs > 5). Fix is framing, not a seed re-bake: the scene measures the farthest horizontal reach of the Opened pieces
from the fallen's origin (world bounds, monotonic) and hands it to the camera as `finish.reach`; `finisherSidePose` fits
`max(1.5·bodyScale, reach + 0.3)`. Same authorized dolly — no cut, no FOV change; Decapitation's no-push rule untouched.
Verified locally: opened on executioner, veteran, pitborn, goblin, nightborn, dwarf all exit 0 (worst maxCameraStep 0.227).
Minotaur/Wraith opened checks fail on clean trunk too on "waist separation obeys blood mode" — a stale blood-toggle
expectation since #228, on held bodies in the extended list; separate item.

## Dwarf finishers enabled (2026-09-20)
Owner won two fights against the Dwarf and got plain deaths: the roster entry shipped with `finishers: []` (the rule for
reconstructed bodies — only validated finishers, listed explicitly). The Dwarf rig already carries every finisher clip.
Validated on him with the finisher harness (real kills, blood modes, rematch, camera): Split Crown, Decapitation, Run
Through, Opened, plain death — now listed. The Quiet One (picker-only) failed its spray check on him and stays off.

## Finisher rotation: even pool, never the same ceremony twice in a row (2026-09-20)
Owner: "random, but the same finish can't appear twice in a row — keeps it fresh". Measured before the change: the
seeded pick was already even (19.6–20.6 % each over 20 000 kill events) but memoryless (19.9 % back-to-back repeats).
`selectFinisher(finish, weapons, previous)` now excludes the previous fight's ceremony from the pool; the scene keeps
that memory (`lastFinisher`, rolled at rematch) and hands it to the audio resolver via `view.previousFinisher()`, so
scene and audio still agree. Presentation state only; replays with the same history are identical. The preview harness
resets the memory per captured window. Test: 20 000-event sweep asserts no repeat, 16–24 % share each, determinism.

## Beta rotation: five outcomes, The Quiet One picker-only (2026-09-20)
Owner (directly to the finishers lane, 2026-09-20): Split Crown, Decapitation, Run Through and Opened stay; The Quiet One
leaves the automatic rotation (`selectFinisher` now `% 5`). Its clip, pose, gore and audio stay shipped and the dev picker
can still force it ("The Quiet One (test only)"). The finisher preview harness reaches outcomes outside the rotation through
the production picker override on a real kill and labels the window as such; the Quiet One release checks keep passing
that way. No new finishers until beta metrics.

## Finisher cameras — Split Crown front-quarter, Decapitation corpse+head framing (2026-09-20)
Owner phone review: the Split Crown side reveal turned the victim into profile and hid the skull seam; Decapitation's
front camera let the killer's back hide the headless corpse. Split Crown now reveals on a raised 45° front-quarter
(`finisherSidePose`); Decapitation keeps its front view with a camera-right slide and a look at the corpse/head midpoint.
The deploy gate's blood-gate check (decapitation "detached head stays visible above portrait controls") failed on trunk
63f4cd9 independent of this work — the head landed at the portrait edge on Veteran and Pitborn; the midpoint framing
clears it on Veteran, Pitborn, Goblin and Executioner. Harness now asserts the victim's chest/skull are not hidden behind
the killer (camera ray). Run Through alignment (owner: blade reads off-centre) remains open.

## Creature Opened correction — 2026-09-19
Owner reports Opened silently using ordinary death on Wraith and Minotaur. Per-finisher capability and a shared scene/audio resolver now allow only Opened on these creatures. Reuse each actual mesh waist bake; Wraith cut surfaces retain spectral shading with owned materials and a readable3.6-second hold before1.4-second fade. A physical dropped weapon remains; the clawed Wraith has no separate weapon prop. Actual-mesh CPU tests cover grounding, portrait bounds, pause, materials, source preservation and rematch; a Wraith crop found by the new test is corrected with a size-aware Opened camera margin and inward front-quarter option near arena walls. Owner also requests Decapitation retain the original front view: its generic dolly/side slide is removed and a detached-head portrait regression is added. That probe exposed stale skin bind inverses after actor movement, spawning the head6.8m away; the bake now refreshes them and the same all-six-rig regression passes. Creature camera transitions are slowed enough to preserve the existing continuity bound. Exact Minotaur scene rerun passes. Decapitation’s restored front camera exposed an overlong head throw behind portrait controls; a short lateral impulse keeps the head nearby and clear of the victor, and the same contact/drop/settled framing plus raycast-occlusion checks pass. Other creature finishers remain disabled. No simulation, GLB, dependency or input changes. Integrated the maul/claw weapons and ordered cleanup. Claws exposed a non-finite empty-prop support calculation; the same actual-rig regression now passes with finite transforms and no phantom dropped weapon. Full combined gates and public receipts remain pending in artifacts/finishers/creature-opened/.

## Finisher blood upgrade — 2026-09-19 (PR #165)
Owner requests substantially more blood at actual finishing wounds and floor spills beside the body. New fixed pool:160 ballistic droplets and80 growing floor stains, two draw calls; source locations follow neck/head, separated waist faces, jugular or chest entry/exit. Jets taper to drips and stop; red/dark/off and rematch apply. No simulation, input, GLB or dependency changes. CPU source/ballistic/resource checks pass; Integrated published Wraith c757d87 with its arm correction and creature guards preserved; Independent source/lifecycle and refined motion-frame review pass; small/large Decapitation, Opened and Quiet One red/dark/off/hold/rematch checks pass. Final24-command release validation and public receipts are maintained in artifacts/finishers/blood/.

## Opened waist finisher — 2026-09-19 (PR #163)
Owner explicitly authorized a horizontal waist separation: torso slides sideways and falls; legs hold briefly and
fall separately. Own-model static geometry is sliced and capped during loading/reset, outside the killing frame;
closed cut surfaces, original exterior maps, arms retained with torso, victim weapon released to the sand, cached floor supports.
Blood-off keeps the intact collapse. Red/dark/off changes and rematch restore the rig cleanly. Six-way deterministic
pool and journal option; early side camera and two timed landing cues reuse existing resources. No GLB, simulation,
input or dependency change. New creature bodies remain outside finisher support until their separate anatomy review.
Initial CPU checks pass275/275, lint/typecheck/build/audit, 8,933,674-byte worst-fight budget. Tests cover all six
humanoids, grounded halves, held pose, source geometry preservation, mode changes including late enable, and disposal.
First visual review rejected limb-propped landing and portrait crop. A bounded broad-rest-face search, cached floor
supports, one outer cut cap per half, and a wider/higher side view correct them. Stronger tests measure the waist
itself as well as floor contact. Lower-half pivot and resting orientation are fitted at the waist; the victim weapon drops flat independently. All-six CPU checks and Goblin/Pitborn/Nightborn/Executioner final image reviews pass. Corrected Veteran real-scene red/dark/off, portrait/landscape, reduced motion and
rematch checks pass. Integrated creature597ee849 retains spectral rendering and supportsFinishers guards before
both selecting and preparing the effect. The sixth Auto outcome exposed Quiet One large-rig portrait cropping at seed741; its lateral camera margin is widened and that exact real kill is pinned in the existing gate. Small/large, mode/reset/reduced-motion and arena-edge checks pass. Combined budget9,325,213 bytes gzip per fight. The complete23-command
contract includes Opened normal/large-rig scene checks and real phone-size UI victory/hold/rematch. Final integrated
validation, review, exact-head CI and public publication receipts are maintained in artifacts/finishers/opened/;
use public release.json as the served revision authority. Physical-phone feel remains owner-only.

## The Quiet One — 2026-09-19 (PR #159)
Owner authorized the next finisher: restrained neck reaction, left hand at throat, failing backward step, held beat,
knee buckle and right-side collapse. Additive `Death_QuietOne` on all six live fighters and four shelf/bake rigs;
2.4 s authored / 3.2 s presented, final pose held until rematch. The five-way deterministic rotation includes plain death.
Small animated neck wound reuses the existing pool, red/dark/off apply, earlier side camera exposes the held beat,
and existing quieter contact/voice plus delayed body/gasp cues complete the scene. No simulation or input change.

Original offline authoring in `scripts/build-quiet-one.mjs`, also called by the full warrior builder. Binary append
preserves all old clips, meshes, skinning, textures and weapon elbow repairs; preservation verified against f7a1e99
on all ten GLBs. Blade rebake is unchanged. Initial visual review corrected inward elbow, knee/foot ground clipping
and portrait crop; baked skin-envelope clearance accommodates each body. Initial full quality passes 268/268 plus build,
lint, dependency audit, per-fight budget and game browser. All-rig tests cover throat alignment, upright beat,
intact head, ground contact and held corpse; additive-builder test verifies preservation, idempotence and rejection
of a later appended clip. Camera edge/aspect tests include the new ending. Earlier rigid-clip comparison tests now
exempt only the separately authored Quiet One values while retaining clip names, tracks/times and legacy assertions.

Real-scene Veteran/Goblin/Executioner captures cover red/dark/off, portrait/landscape, reduced motion and rematch.
Final sequence video and phone UI/contract gate receipts: `artifacts/finishers/quiet-one/` and
`artifacts/character/quiet-final-scene/`. Two-pass review: pure simulation/input unchanged; then rendered poses,
continuity, modes and reset behavior. All 11 initial completion commands passed, including a real phone-size UI victory/hold/rematch.
A whole-body portrait bound now guards the large Executioner ending as an additional completion command.
Decoded audio QC verifies a silent held beat, late fall/gasp, cancellation and <= -1.54 dBTP fatal peaks;
Quiet One measures -12.2 LUFS against decapitation -10.7 LUFS on the integrated phone mix.
Integrated world/audio 03282b0, Google account e5339e9 and approved dust tint 6bf1399, preserving all account gates/settings.
Final combined checks, exact-head CI, deployment and live playback receipts are recorded in
`artifacts/finishers/quiet-one/`; public `release.json` identifies the served revision. The lead allocated this
release after AUTH FREE; later lanes must wait for its RELEASE FREE. Physical-phone feel remains owner-only.
Sentry inspection found existing asset-fetch/texture/WebGL issues (5/6/A/9/8 and older), not evidence about this
finisher at the time of inspection. No claim of a clean live error stream or public publication.

## Split Crown visible skull split — 2026-09-19 (finishers lane, local gate passed)
Owner approved a skull-only centre split: the halves open slightly and the body collapses intact. Work is isolated from
both the lead checkout and the unfinished Run Through alignment worktrees. Runtime path: real Killed event → existing
selection/clock → `characters.splitCrown` → `skull.splitSkull`; no simulation, weapon data or GLB changes.
Selected triangle clipping with closed cut faces from the existing head bake; rejected a blood-only decal (no silhouette
change) and shader-only separation (faces bridge the gap). The split follows the Head bone as a sibling, using the victim's
own exterior materials; blood off restores the intact head, red/dark toggle the cut, rematch disposes the split resources.
Discovery: three Semble queries plus CodeGraph impact review, with direct review of the sever/rematch and scene seams.
Checks: all six shipped rigs pass geometry/mode/rematch/decapitation regression checks. All five opponents pass real-scene
phone/landscape/rear captures, mode cycling and rematch. Before integrating roster #143, full quality: 247/247 tests, build, audit, 8,361,824/10 MB budget,
Playwright gate PASS; dedicated finisher completion gate PASS. Added the translated/rotated, pre-render head-bake regression.
The initial timed-parry browser failure under concurrent capture load is closed by a full isolated quality pass.
CodeGraph refreshed; two-pass review covered geometry/resource isolation, render placement and browser cleanup.
Evidence: artifacts/finishers/split-crown/REPORT.md. Physical iPhone performance and owner visual acceptance remain unclaimed.
Existing Sentry issues 6/A/5/9/8 concern fetch, texture loading and WebGL initialization; no skull-split event predates this
change. They remain unresolved and outside this visual feature's scope; this change does not claim to repair them.
At the Split Crown release, Run Through remained separate. Its repair is recorded in the Run Through section below;
the inherited failure and earlier partial alignment worktrees remain preserved as historical evidence.

## Finishers & gore milestone authorized — 2026-09-17 (lead, owner's call)
The owner authorized the finishers milestone the 2026-09-13 blood layer deferred ("mortal kombat closers, but gritty,
realistic"; the flat fall-backwards death is the target). Spec: GAME_SPEC.md "Owner-authorized finishers & gore —
2026-09-17" — selection is a pure function of the deterministic `Killed` event (victim/location/move/heading +
weapons), simulation untouched (`RULES.death`, the 220 ms Killed hit-stop, "death has no tail" stand); six v1
finishers (Split Crown, Run Through, The Quiet One, Opened, Hamstrung, Execution); a slow camera push-in over the
death window authorized (no cuts/FOV punch/slow-mo); gore upgrades on the existing pooled systems under the
red/dark/off modes; the 21 clip names/durations stay frozen, finisher clips additive (`Death_*`); NO split
geometry/detachable limbs in v1. Budget: per-fight cap 9 → 10 MB gzip in `scripts/check-budget.mjs` (11 MB needs
further owner sign-off); mesh compression (~half) is the approved later lever. The roadmap deferral line drops
finishers and wounds. Handover brief for the new lane: `artifacts/character/BRIEF-finishers.md` (suggested lane
`finishers/gore-v1`, ship Split Crown end-to-end first for the owner's phone judgment). No code, asset or behaviour
change beyond the budget constant.

## Run Through repair — 2026-09-19 (implementation and local gates passed)
Goal: keep the blade through the animated torso and visible behind the kneeling opponent, until rematch.
Scope: characters.ts pose/aim, scene.ts post-pose alignment, rig regression and finisher-preview completion gate.
Fresh branch from trunk 3bfb0eb; inherited and partial alignment worktrees remain untouched.
Candidates: re-key every rig (fixed spacing still fails); rotate shoulder toward tip (reproduced 0.572 m miss);
grounded render-only step plus blade-midpoint alignment (selected). No new GLBs, dependencies or simulation data.
Failure F1 closed: the original inherited test reproduces a 0.572 m miss; both corrected regression tests and full quality pass.
Hold clip must be one-shot; reset post-mixer corrections before repeated/zero-dt evaluation and rematch.
Passed: all five real torso rigs, translated/rotated parents, variable frame times, red/dark/off, rematch,
real-scene captures and initial full quality (252/252). Both disabled-aim and loop-only mutations fail the regression.
Integrated quality passed 253/253 with lint/typecheck/build/audit, 8,366,568-byte per-fight budget and browser gate.
After the arena merge, configured browser checks and release receipts are recorded in artifacts/finishers/run-through/.
PR #149 carries the scoped fix; production verification is required before any live-resolution claim.
Sentry: unresolved 5/6/A/9/8 are asset fetch/texture/WebGL errors; no evidence linking them to pose alignment.
Three Semble searches + CodeGraph impact completed. No disputed graph edges or performance incident;
Tree-sitter/CPU profiler are not relevant. No cross-agent handoff or new agents.

## Finisher side view — 2026-09-19 (implementation and visual checks passed)
Owner screenshot: hero shoulder hides Run Through and Split Crown at their settled ending. Success: smooth late side
move exposes both fighters in portrait, stays within arena, respects reduced motion/free camera and resets for next fight.
Scope: scene.ts camera endpoint and late blend; camera.test.ts; existing finisher-preview completion checks. No rigs/combat.
Candidates: more fixed lateral offset (unreliable with distance), snap to side (breaks continuous camera), smooth late
move to a fitted side view (selected). Reuse the current camera and presentation clock; no new module or dependency.
Three Semble queries + CodeGraph camera impact reviewed. F1 closed: before correction, the real-scene side-angle assertion
fails; after correction, the same assertion passes for Run Through and Split Crown on Veteran, Goblin and Executioner.
Visual review: both finishers expose the victim in portrait and landscape; red/dark/off, reduced motion, manual orbit and
normal camera return on rematch pass. Late motion stays continuous (maximum measured step 0.077 m/frame at 60 Hz).
Geometric tests cover both finishers around all arena edges, varied headings/spacings and portrait/landscape fields of view.
Evidence: artifacts/character/side-camera-{veteran,goblin,executioner}/ and artifacts/finishers/side-camera/REPORT.md.
Two-pass review: simulation/input/rig behavior untouched; actual rendered victims and existing finisher effects verified.
Local quality passed 261/261 after the arena merge; all seven configured completion commands passed. The subsequent fatal-audio
merge changed no camera/rig code; its new production build passed roster, Split Crown, audio, estoc, counter and arena gates.
PR #154; release quality reruns all tests on the final merge. Deployment and live-UI receipts are recorded separately in
artifacts/finishers/side-camera/ so the served revision remains the authority for publication.
