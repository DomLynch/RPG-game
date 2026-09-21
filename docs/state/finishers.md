# Finishers & gore — project state

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

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
(`--only plainDeath --wounds`) so the other 7 finisher-preview rows don't pay the extra page load. Not yet run against a
live browser (deploy #70 BUSY at the time of this entry) — release row not yet green, stills not yet reviewed by the owner.
Remaining: run `wounds-gate` once FREE, screenshot review, PR.

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
