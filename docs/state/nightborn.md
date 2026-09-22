# Nightborn — lane state

Opponent 5 by brief number, the fourth rung: the pale duelist with the estoc, hero rig at scale 1.03, poise 0, and the only committing parry
on the ladder. Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Now — 2026-09-23 (later)

**Strategy's three rulings of 2026-09-23 01:15, which set how deliverable 1 is run:**

1. **One instrument — corrected 01:40: D1 is cut from MATTES, not plates.** A `--flat` plate needs a mesh and he has
   none, so D1 is `u2net` mattes, arms at the sides, with the slot list stated. The Executioner lane runs a
   matte-vs-plate calibration on the seven rigged fighters once #500 is on trunk; **D1's table states that delta as its
   uncertainty.** Plates from the day he has a mesh. #500 still merges first, #502 still re-cuts off plates, and **no
   table mixes the two instruments** — that is how the Knight's first ratios came out backwards.
2. **For a masked archetype the silhouette IS the kit, so the bare pass is INFORMATIONAL, not a gate.** The gate is
   in-kit at every rung. Recruit-2 for a masked archetype is therefore **Helmet + Body** — his two identity carriers —
   so no game state shows him without both and take-one removes at most one. In #490 at `9c56528`. Measure bare anyway
   so the number sits beside the Knight's. Dom may still choose a body-level feature; nothing waits on it.
3. Report line unchanged: number, head sha, both ratios bare/in-kit and against the Nightborn, when the D1 PR is READY.

**"Bare" is not one definition across the roster, and the fix is annotation, not normalisation.** Multi Chars proposes
**bare = body draws only, every loot piece off** for every figure, which is right to reject "each figure minus its own
`LOOT` row" — that measures kit completeness while looking like it measures build. But it is still not invariant,
because **what lives in the body mesh versus a loot draw is itself a per-character authoring call**: `src/loot.ts:38`
fixes `Body` as "the tunic and what hangs on it", and `src/loot.ts:44` says the Pitborn has no chest piece *because he
wears a rag sash, not a tunic* — so his sash is body geometry. Strip every loot piece from the Pitborn and he keeps a
sash; strip them from the Nightborn and his torso is bare. An invariant "bare" exists only for launch characters,
where `docs/SCOPE.md` rules nothing on the body is rig dressing. For the beta six it is a per-character fact, so **the
D1 table needs a "what survives stripping" column beside the number**, not a normalised definition that hides it.

**A trap for that measures table, found in `src/loot.ts:40-46`: the Nightborn's own LOOT row is FIVE pieces plus the
estoc — he has no `Greaves`.** The six-piece ruling binds launch characters from Legionary; the beta six predate it
(the comment at `src/loot.ts:38` fixes what `Body` means, and the Pitborn's row is the precedent that a chest piece can
be legitimately absent). So a bare Nightborn keeps his shins and a bare Plague Doctor does not. **State that in the
table or the two bare numbers are not comparable** — this is exactly the shape of error that put the Knight's first
ratios backwards.

**Deliverable 1 for Brief 18 — the silhouette test, bare and in loadout — is the next task and has not started.**
Strategy's ask (01:15, after Lead handed off at 00:50): the fighter's camera, bare and in loadout, exactly as the
Executioner lane did for the Knight in **#502**; measured; one PR; then one line back to Strategy with the number, the
head sha, and the two ratios bare/in-kit and against the Nightborn. #502 is the shape to copy —
`scripts/character/silhouette.py`, a `<NAME>-SILHOUETTE.md`, the bare source PNG, both silhouette PNGs and a
`measures.json`. His loadout pass cuts from the approved reference (#493); the **bare pass needs a bare source
generated first**, the way the Knight's `knight-bare-v1.png` was — FLUX.1-dev via `gradio_client`, seed 190926, the
route recorded below.

**#490 now names his six takeable pieces** (pushed `3d1030c`): Helmet = the beaked mask and split brim, Body = the waxed
coat, Arms = the boiled-leather sleeves and shoulder capes, Gloves = the gauntlet cuffs, Greaves = strapped shin guards,
Boots = heavy buckled boots; the longsword is not one of the six. Required before merge by the owner's 2026-09-22 23:12
ruling. **It sharpens deliverable 1: all three of his named silhouette carriers — brim, beak, coat skirt — sit in Helmet
and Body, so every one comes off.** The Knight measured that failure (0.367 → 0.246 bare, the figure read as nobody) and
he is likely to fail it worse. The brief says so and does not pre-judge the fix.

**`docs/SCOPE.md` (PR #492, branch `docs/scope-2026-09-23`) is the current dated scope and beats every older brief,
state entry or memory line.** Read it first next session. It confirms this lane owns the Plague Doctor, that he is
**launch scope, not beta**, longsword, next after the Knight in cost order, and that briefs specify **outline, not
build** (#499).

**A harness deliverable shipped tonight: PR #500, `--flat`** — the opponent alone at the game's own lock camera on a
plain flat backdrop, plus an unlit-black plate. Built for Multi Chars' reskin check in #495. Measured: corner spread 0,
max per-row left/right difference 0. **The finding worth keeping: a valid background is not a valid mask.** A bg−18 cut
of the beauty pass loses part of his head and hands — both masks cut by one rule, the plate is 204,877 px and the beauty
pass loses 5,056 (2.47%) and adds none. Two implementations agree. Use the plate for deliverable 1's measurements, not a
threshold of a beauty render. Nightborn shoulder-over-height on the plate: **0.318** (Multi Chars' band).

Open from this lane, all four mergeable, none merged: **#479** (this file), **#490** (Brief 18, +six pieces), **#493**
(the reference), **#500** (the harness).

## Now — 2026-09-23

**The lane has a second character: the Plague Doctor (Brief 18).** Dom widened the scope in this session's own words
on 09-22 — *"a masked opponent wielding the longsword… silhouette test at the fighter's camera passes before any model
work; AAA judged on a phone screenshot; one PR per deliverable; nothing ahead of the shield in Combat's queue. The
Nightborn stays yours."* A Strategy relay had tried to widen it earlier and was refused until he typed it here; that
refusal was correct and is worth repeating — **a relay cannot widen an owner-set scope.**

Open from this lane, all docs-only and all clean: **#479** (this file), **#490** (Brief 18, approved by Strategy),
**#493** (his approved reference image). Each merged current trunk to clear a stale `src/arena.ts` inherited from the
~90 minutes trunk was broken on 09-22 (`lorarii.standing` called with no import → TS2304); `git diff … -- src/arena.ts`
is now empty against trunk on all three.

**Two measured findings from Brief 18 that outlive it.** `src/characters.ts:26` — `longsword: { Thrust: 'Riposte' }`,
**one** role override, against 19 for the Witch's bladed staff and 21 for a creature family: a longsword character is
nearly free, a new weapon family is the most expensive unit in the project. And **a mask deletes the face problem** —
no scan, no KeenTools credits (still 402 since 09-17), no head pipeline at all.

**The image route Lead had briefed to three lanes was wrong and this lane fixed it.** `scripts/character/kontext.py`
is an image *edit* (`--image` required); there is no text-to-image script in `scripts/character/`. Five candidates were
generated instead from Brief 18's own text: Space `black-forest-labs/FLUX.1-dev`, `/infer` via `gradio_client`,
**seed 190926** fixed across candidates so the variation is the design and not the noise, 896×1152, guidance 3.5,
28 steps, auth reused from `kontext.py`'s `token()`. Throwaway script, scratchpad, not committed. Recipe sent to Multi
Chars and the Executioner lane; whether it becomes a real script is Lead's call once it is known not to be a one-off.

**Two techniques worth keeping, both cheap:** put each candidate's **silhouette, computed from its own pixels**
(background = median of three 60×60 corners, foreground darker than bg−18, 3×3 min filter — **per image**; one global
threshold blacked out a whole panel) directly under it, so a design that is striking in detail and shapeless in outline
disqualifies itself on the sheet; and **keep the rejects with their reasons** — one candidate was dropped because its
outline read as **the Executioner's**, which is a reskin test at silhouette level, before a model exists. Offered to
Multi Chars as a number rather than a judgement: normalise both masks to the same height, align on the feet, take IoU,
and rank.

Dom picked **"E — the patched beak"** (boiled leather, cracked and scorched, one lens plated over with a riveted iron
patch, a warped split brim). **His letter and his pasted image disagreed** — the sheet's columns were labelled C / B / E
and he answered "option c" then pasted the third panel; the image won and he confirmed. Next sheet labels A / B / C in
order.

**Next: deliverable 2, the silhouette test** at the fighter's camera, bare and kitted, against the nine — not started.
His narrow warped brim means the coat skirt and the beak carry the read rather than the wide horizontal Brief 18
originally assumed, so it is measured, not asserted. Nothing is authored before it passes.

**The Nightborn himself is unchanged and needs nothing.** His own TRELLIS face is live; other lanes have rebuilt him
since (spider-hand fix, ladder `lapse` retune) and this lane authored none of it.

## Then — 2026-09-22

Nothing building and nothing open from this lane. Worktree `frankendom-nightborn` clean, fast-forwarded to trunk
`becec83`; no open PR authored here.

**His own face is live** — #198 merged as `032e2fd`, deployed as trunk `a408b9f` on 09-20. Verified from the public side
at the time, not on the merge: `release.json` revision `a408b9f…`, entry `index-BTEtpnRT.js` referencing
`nightborn-DHVK-EOH.glb` (the stand-in build had been `nightborn-CmkJzSnx.glb`). **The served GLB's md5 never matches the
committed one** — the build applies `EXT_meshopt_compression` — so parity is checked on geometry: 59,524 tris served ==
`src/assets/nightborn.glb` at `a408b9f` (md5 `6899475349cf`). Re-checked 09-22 after Scalable Chars' rebuild: served
`nightborn-Bb2iyAc4.glb`, 60,393 tris, matching trunk's rebuilt asset (md5 `9a69a19983c4`) — still his TRELLIS face, since
`head.FIGHTERS.nightborn` on trunk still points at `nightborn-trellis-01.glb`.

**Two things about this character that bite other lanes, both already recorded elsewhere and repeated here because they
are his:**
- `src/assets/weapons/estoc/nightborn-estoc.glb` must stay **byte-identical** to `src/assets/nightborn.glb`
  (`tests/weapons.test.ts:460`). A mismatch does not fail fast — the deepEqual on two ~7 MB buffers **hangs ~280 s**.
  Rebuild the twin in the same commit as the body, always.
- His TRELLIS head `artifacts/source/keentools/nightborn-trellis-01.glb` (+ its `.json` tone report) is **gitignored and
  exists only in worktrees that were handed a copy** — this one and `frankendom-dwarf`. `parts.py` does not error when it
  is missing: `os.path.exists(HEADMOD.KT_GLB)` falls through to a generic stand-in, so a rebuild elsewhere silently ships
  a face regression. Scalable Chars hit exactly this and discarded two builds (docs/state/character.md, 09-22).

Open from this lane: none. Two cosmetic leftovers the owner has not asked for — body AO mottle on the pale skin at ~1 m,
and head faceting from `decimate: 0.14`. Both are Blender rebuilds, no code, no gameplay change.

**Scope:** the owner scoped this session to the Nightborn on 09-20 ("only work on that char"). A Strategy relay on 09-22
23:30 widened it to build the Plague Doctor (Brief 18); **held pending the owner's own word in this session** — a relay
cannot widen an owner-set scope, and the same relay asking for a standing scope note in `CLAUDE.local.md` was declined
for the same reason. Strategy agreed the hold is correct and has put the question to him. Same precedent as the
Executioner lane's Nord refusal (docs/state/executioner.md).

## Done — 2026-09-16 → 22

- **#85 — the Nightborn ships (opponent 5).** `OPPONENTS.nightborn` at `src/moves.ts:489`: scale 1.03, `RULES.health`,
  **poise 0**, and the committing guard `{ window: 16, recovery: 40, commits: true }` — the three per-opponent knobs that
  keep him from being a reskin. `GuardProfile.commits` (`src/moves.ts`) is his: a parry that must run its window, no
  action out of it, and one that met nothing always ends exposed, held or not — "a man's parry yields to any action; the
  Nightborn's does not". The read side is in `src/ai.ts` (tell-reading estimate for a committing parrier, the `parker`
  read); the two intended answers are pinned in `tests/opponents.test.ts` (`feintAndPunish`, `chargePast`). Corrections
  against the owner's draft, recorded so they are not reopened: no facial rig, so no fangs; the charged heavy IS
  parryable; `parryStun` 90 means a kick cannot interrupt the riposte.
- **#198 — his own face, credit-free (live `a408b9f`).** KeenTools returned `402 Insufficient credits` twice, so the head
  came from **TRELLIS.2** on Hugging Face instead: `scripts/character/trellis_head.py` converts a TRELLIS mesh to the
  KeenTools head contract measured off the hero scan (eye spacing 0.5755, eyeball radius 0.152, teeth centroid, face
  toward −Y) — front render + MediaPipe landmarks to place the eyes, lid openings cut through the mesh, texture tone
  matched to the portrait, donor eyeballs/teeth attached by **slot index** (imported donor materials get `.001` suffixes,
  so names cannot be trusted), materials emitted in the order `Material_0..3`. `head.FIGHTERS.nightborn` gains
  `hair: 'mesh'`, which gates seven places in `head.py` that assume a photographed head — chiefly `delight()` (median
  0.061: it drove the face charcoal for three builds), the coverage refill, and the pallor restyle. `HEAD_KT_GLB` lets
  another adapter output be tried without editing the table. Budget at merge: 9.91 / 12 MB per fight, 31.57 / 32 MB dist.
- **The no-credits pass — 2026-09-17** (full record in docs/state/character.md): before TRELLIS, the stand-in (the hero's
  scan) was restyled to his identity on its own texture — `skin_mul`, `pallor`, `dark_eyes`, sunk sockets, throat scar,
  cold-black crown strands, and pointed ears as geometry (`parts.ear_points`, two 3 cm cones on the scan's own helix
  tops). The TRELLIS head superseded the restyle; `KIT.nightborn` is `'ears': False` now that the real head carries them.
- **Rebuilt by other lanes, not this one:** Scalable Chars' spider-hand rebuild (09-22, +2,908 B, estoc twin rebuilt to
  match) and the Auditer's ladder retune `lapse .15 → .3` on the **normal** rung (09-22: the hero brain's wins against him 5 → 10 of 24, Combat signs
  off). Earlier owner retunes: easy (09-20) to a human reaction, a quarter parry and more lapses — an 8-tick reaction and
  a .45 parry had made easy as hard as hard; hard (09-20) discipline 40 → 35, pressure .5 → .6. All in
  docs/state/combat.md; this lane authors none of them.

## Open

- **Nothing.** The estoc's parked stance (#419 draft, #429) is Weapons', and its revival explicitly names this character —
  "either the Nightborn stops carrying the estoc, or the trident-vs-Nightborn fairness row is re-measured against a
  deliberately retuned Nightborn" (docs/state/weapons.md). Neither is this lane's to decide; a Nightborn-profile DECISION
  goes to Lead, never a reopened stance number.
