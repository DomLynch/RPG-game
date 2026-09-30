# Goblin — lane state

The fourth opponent: the pit-runner. Small, fast, mean — the hero rig **re-proportioned** (not shrunk) to 0.78× a man's
standing height, his own scan head with lofted ears, a sica knife, and a darting AI that never guards.
Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## 2026-09-30 16:18 (+04) — HANDOFF before /clear. READ FIRST, then "Now — 2026-09-27 (late)", then memory

1. **LIVE `3fab84c4`** (curl of frankendom.com/release.json at 16:18). This lane has no run in flight and holds no lock.
2. **Went live today from this lane:** nothing. Nothing was built between the 2026-09-27 clear and this handoff.
3. **NOT LIVE:** bracer rust, draft #776 (`goblin/bracer-rust`, head `f43f5e21` before this entry). Its 6 CI checks are
   green and it is MERGEABLE. **The chain block is gone:** #734, #716, #782, #896 (sash PR 2) and #728 are all merged,
   and #896 and #728 are ancestors of live `3fab84c4` (checked with `git merge-base --is-ancestor`). **It is still PARKED on
   Lead's 2026-09-27 ruling:** every rank's #918 look hides the base bracer. It comes back only if Hero Look's keep test
   shows the bracer on screen. The branch is 833 commits behind trunk, and `git merge-tree` against trunk merges clean. If it
   comes back: merge trunk, rebuild loot.glb and goblin.glb at load <30 (no lock), then PASS = check-budget green with the
   loot MB in the PR body, a 375 before/after still of the bracer in the fight frame, and the loot-layers test green. Never
   hand-merge.
4. **Sessions down:** none owed by this lane.
5. **Rulings today:** none new. Still standing: NOW/ASAP only, never invented times
   ([[feedback_no_fake_deadlines_2026-09-27]]); he never guards, skills are answered by Combat's dodge (2026-09-26);
   Multi Chars owns legends.ts (r8 = Reynard the Fox).
6. **QUEUE:** empty. Waiting on Lead for either (a) the Hero Look keep-test result on the bracer, or (b) the #918 look
   FIX items (L2/L5/L8/L9/L10, with Dom for GPT) coming back for a re-check.
7. **Crons:** none. **Folder:** session worktree `~/Desktop/Business/frankendom/.claude/worktrees/beautiful-aryabhata-fce34d`,
   branch `goblin/bracer-rust`, PR #776. Reopen on `~/Developer/frankendom-goblin` with the worktree switch off.
   **Memory files to read first:** `goblin_handoff_2026-09-25.md`, `feedback_no_fake_deadlines_2026-09-27.md`.

## Now — 2026-09-27 (late, saved for a /clear)

**READ FIRST:** nothing in this lane is building and nothing is owed. #776 is PARKED with its CI green. The looks review is with Lead and Dom.
- **#776 CI:** all 6 checks SUCCESS on `e86c2a8b` (quality, base and 4 browser checks). The earlier red `quality` was trunk's new
  tests/loot.test.ts:174. Fixed by renaming the material to `Rusted iron` (maps in source/materials, a CLASS_OF metal row). Locally:
  loot + grades tests 15/15, tsc clean.
- **#918 looks review sent to Lead** (sheets in the laughing-meitner worktree, artifacts/looks/goblin/sheet). PASS: L1, L3, L4, L6, L7.
  FIX: L2 (open collar; reads the same as L1 at the fight camera, needs one new visible piece), L5 (open collar; the cloak piles into a
  hump), L8 (open collar; the black box faceplate hides his face, wants a half mask), L9 (drop the pale slab; Hermes is never masked),
  L10 (the flat orange mask should read as shaded fire). Across the set: his ears are buried under the helmets. Lead sent the fixes to
  Dom for GPT.
- **Legends:** Strategy renamed r8 from Anansi to **Reynard the Fox** (no living peoples' folk heroes). Multi Chars owns legends.ts; this
  lane does not edit it. The "Recruit I" in the HUD is the PLAYER's rank. Legend names reach players through the win line and the
  legends card.
- **Working folder trap:** this session ran from `~/Desktop/Business/frankendom/.claude/worktrees/beautiful-aryabhata-fce34d`, because
  the app refuses edits in `~/Developer/frankendom-goblin` from a worktree session. The #776 branch was built there. Reopen on
  `~/Developer/frankendom-goblin` with the worktree switch off, and `git switch goblin/bracer-rust` there if #776 comes back.
- **Quality gate blocks under load** were the gate pile-up. Hooks' Codex-Hooks #49 (one gate per Mac) was in CI with the install to
  follow, per the hooks lane.

## Now — 2026-09-27

**Standing rule (Dom, 2026-09-27, sent to every lane via Strategy):** no invented or extended deadlines or times. The only deadline
this lane gives Dom, Lead or Strategy is NOW or ASAP. If it can't happen now, name the physical blocker (a battery running with
minutes left, a red gate, the box busy or load over 30, the deploy lock, an HF quota, a predecessor PR not live), never a time or a day.

- **Bracer rust = draft #776** (branch `goblin/bracer-rust`, trunk `edf5d93f` merged in). Lead's pick was option A: a `Rusted iron`
  material on the bracer only, with 512 px colour + ORM maps (`scripts/character/rust_maps.mjs`, 75 KB together) in
  source/materials, named in `manifest_goblin.json` for both his build and loot. NOT a `<Family>Iron`: tests/loot.test.ts:174 reads
  every `*_iron_color.jpg` in source/loot as an opponent family's bake. **PARKED (Lead, 2026-09-27)** while every rank wears a #918
  look whose keep list hides the base bracer; back if Hero Look's keep test shows it on screen. It is source only. **Blocked on:** the loot.glb chain
  #734 → #716 → Pitborn's sash PR 2 (a loot.glb Gambeson splice) → #776 → #728. Rebase and rebuild loot.glb + goblin.glb once sash PR 2
  is live and Lead gives the go. PASS = check-budget green with the loot MB in the PR body, a 375 before/after still of the bracer in
  the fight frame, and the loot-layers test green. Never hand-merge.
- **Lock camera #752 is LIVE** (merge 78e67b40, release 3e35eefd): the camera steps over the player's left shoulder against an
  opponent of scale < 1.
- **He never guards; skills are answered by a dodge.** The skills battery showed a skill lands on him every cooldown. Strategy ruled
  (2026-09-26) a dodge/back-step share in his AI profile, not a block, so GAME_SPEC.md:93 stands. Combat owns it; this lane builds
  nothing for it.

## Now — 2026-09-22 (late)

Lane parked clean for a context clear; **nothing building, nothing owned by this lane is open.** The state below still
holds. Two housekeeping facts for whoever picks this up:

- **PR #481 (this file, branch `docs/goblin-lane-state`) is OPEN, docs-only, `MERGEABLE`.** Until it merges, read this
  file from the branch — it is not on trunk yet. Lead cancelled its release-checks matrix (run `35760206714`) on Dom's
  11:30 rule, to free runners for the PR gating the release; the `quality` run (`35760206957`) was left queued. Those
  cancelled jobs will read red on the PR until re-dispatched — that is the cancellation, not a failing doc.
- **The branch was one commit behind a trunk fix and is now caught up.** Branched at `becec83`, where `src/arena.ts:446`
  called `lorarii.standing` with the import already removed (TS2304, reproduced here: `src/arena.ts(446,49): error
  TS2304: Cannot find name 'lorarii'`). It came in with the guards removal, never from this lane. Trunk fixed it;
  merging trunk `cb8ff5b` in makes `arena.ts` identical to trunk again and `npx tsc --noEmit` clean.

## Now — 2026-09-22

Nothing building and nothing open from this lane. **He is live and correct on trunk `dcb9d61`** — verified this session
on the served page, not on the merge: `?opponent=goblin` at 393×852 and 852×393 loads `goblin-BrXfJ6jo.glb`, HUD reads
`120 / 120` against the hero's 150, the fight starts, zero page errors (`artifacts/goblin/live-goblin.mjs`, exit 0).
His own suites pass on that tree: `tests/characters.test.ts` + `tests/opponents.test.ts` 57/57, standing height
ratio 0.778 against `OPPONENTS.goblin.scale` 0.78, roll floor +0.045 m, 1282 identical clip tracks / 96 hunched / 168
re-solved limbs.

**Other lanes have rebuilt his GLB twice since the polish merged and the polish survived both** — checked in a render,
not inferred: `57cfd66`/`d894364` (Weapons Phase 2, the knife as a TRELLIS.2 reconstruction) and `b9e0b35` (Character
Main's spider-hand fix, which rebuilt pitborn/goblin/nightborn through the fixed `parts.py`; goblin +3,524 B, in the
bake noise). Ears, the painted-out band behind them and the greyed body tone are all intact, and `head.py` still carries
his two `ear_fill` uses.

**Two lane documents are no longer on trunk.** `f4ff30a` stopped tracking `artifacts/`, which took
`artifacts/goblin/REQUESTS.md` (the cross-lane request list, incl. the open camera item) and
`artifacts/character/BRIEF-goblin.md` (the brief as built) with it. Both are restored on this worktree's disk from a
scratch copy; nothing in this lane depends on them being tracked, but the camera request now has no home on trunk —
recorded under Open below so it survives the file.

## Done

- **Goblin polish — #182, merge `5b70e7a`, commit `b99f779` (2026-09-20).** Ears re-lofted from nine rings (a fat lobe at
  the root, widest a third up, a torn notch on the outer rim) — the previous two-ring cones gave the leaf shaping nothing
  to act on. `skin_mul (0.77, 0.77, 0.80)`: the body read warmer than the grey face at the collar. The pink patch behind
  each ear was **not** the flattened pinna: the scan unwraps the skull band behind the ears to the tile's outer edges
  (measured on the mesh, u .86–.97 / .03–.14 at v .44–.74) and the projection painted the photographed ear onto it, past
  the reach of the crown fill's boundary feather. `head.FIGHTERS.goblin.ear_fill` marks that band and the flaps unseen and
  **forces** the fill there (`crown_fill(force=)`, blur factor must divide 2048); the scan's real ear flaps (|x| .10–.13,
  6–15 cm behind the eyes — not where the ear-canal ray lands) are flattened 92 % and re-mapped to the skull texels
  behind them. Ten Blender builds to find it; the lesson is that the baked mask must be dumped beside the tile and
  vertex→UV read from the part GLB *before* guessing boxes. Goblin-only flags; other fighters' builds untouched.
  Evidence: 308/308 tests, `quality:ci`, browser gate and the dist probe green on the merged tree; +48 KB gzip vs
  goblin-v1; sheets in `artifacts/character/goblin-polish/` (untracked since `f4ff30a`).
- **Slice X — the goblin, character lane (2026-09-16), #86/#87/#89.** `src/assets/goblin.glb` from the per-fighter
  pipeline: KeenTools scan of the owner's seven portraits (`artifacts/source/face/goblin/`, scan `01a0ab81…`). The rig is
  **re-proportioned in data, not shrunk** (`BUILD.goblin` + `reproportion` in `build-warrior.mjs`): per-bone scale about
  each joint in its rest frame, applied through every part's skin weights before binding, with rest positions and inverse
  binds rebuilt — legs ×.84, arms ×1.16, neck ×.9/.86, head ×1.17, hunch 9/9/−8/−8°, the pelvis dropped by exactly the
  legs' loss so the soles stay put, walk bob ×.84, root scale .835 → **standing 1.357 m = ×0.778** of the hero, which is
  what `OPPONENTS.goblin.scale` records (the hit capsule follows the measured height, not the root scale). Library clips
  stay the hero's to the bit; IK-authored clips re-solve on his limbs; the Roll carries a floor clamp on the arms. A
  `stride` datum on the GLB root makes `characters.ts` play his walk at his own pace. Full entry in
  `docs/state/character.md` § "Slice X"; it stays there.
- **Knife v1 — weapons lane (2026-09-17), `weapons/knife-v1` stacked on #86.** His **sica**: forward grip, inward hook,
  double-edged over the hook so the backhand cuts; 943 triangles, no textures, a 0.42 m blade in his 0.81× hand, carried
  on his own re-proportioned rig (`src/assets/weapons/knife/goblin-knife.glb`) on the sword clip family with only `Heavy`
  re-keyed. Measured on his rig: slash lands to 1.2 m, stab 1.45, hack 1.55 (a man's sword 1.7 / 2.0 / 2.2). The
  reverse-grip idea was rejected with numbers — on the sword's clips it never lands. Owner picked variant A. `WEAPONS.knife`
  is real data on trunk today (`KNIFE`/`KNIFE_MOVES`/`KNIFE_PATHS`, `guard: 'blade'`, `material: 'iron'`,
  `fight { thrustShare .4, close 1.0 }`). Weapons lane's entry lives in `docs/state/weapons.md` § "Knife v1".
- **Fight identity and rungs — combat lane.** His profile on trunk is `scale .78, health 120, poise 0, regen 1.5,
  speed 1.2`, with `parry 0` and `guard 0` on every level (he never guards) plus the darter knobs `feint / disengage /
  circle / step / interrupt / kick`. Health went 100 → 120 on the owner's call (2026-09-17). Normal is `reaction 11,
  accuracy .7` since the Auditer's Brief-1 slice (2026-09-22): the Goblin lever was handed to Combat because only
  `reaction` (+`accuracy`) moves the hero brain against him. Ladder movement is recorded in `docs/state/combat.md`
  § "Ladder slice" and § "Ladder retune"; those entries stay there.

## Open

- **Lock camera vs a 1.36 m opponent** (was `artifacts/goblin/REQUESTS.md` §8, now untracked — hence recorded here). At
  close range on 393×852 he is mostly behind the hero's back; head and ears peek over the shoulder. `cameraPose` in
  `src/scene.ts` has no opponent-height term. Suggested: the lock look-at height (and/or pitch) follows the opponent's
  scale, or a small lateral offset when the opponent is shorter than the player. Camera/Lead lane's call — this lane must
  not touch camera code.
- **Cosmetic, not started:** the iron bracer still reads leather-brown rather than rusted iron at phone size (its own 1K
  rust maps would fix it); the flattened ear flap prints a faint outline in profile.
- **Never validated by a human:** nobody has played his rung on a physical phone. The readability rule in his brief —
  feint must be distinguishable from a real wind-up at phone size — has only ever been checked in harness renders and by
  the hero-brain proxy, never by a person.
