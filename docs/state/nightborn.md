# Nightborn — lane state

Opponent 5 by brief number, the fourth rung: the pale duelist with the estoc, hero rig at scale 1.03, poise 0, and the only committing parry
on the ladder. Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

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
