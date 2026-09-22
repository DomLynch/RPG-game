# Pitborn — lane state

The third opponent and the first creature: an orc-blooded pit brute on the hero rig at scale 1.13, hunched, tusked,
bare-chested, fighting with the cleaver. Rung 2 of the beta ladder. **This lane also owns the Shieldmaiden**
from 2026-09-22 (Dom's own line; Lead allocated, Strategy confirmed).
Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Now — 2026-09-22

**BLOCKED ON #478 — the Shieldmaiden.** Her design direction is picked and her body is deliberately not
started. Strategy's ruling: silhouette stage only, nothing wearable before the shield asset lands, because a
half-built character across a dependency is worse than a parked one. Her shield is **a material variant and a
size of Multi Chars' single shield asset (#478), not a second mesh**; if her round shape ever needs a
structurally different mesh that is raised with Multi Chars before authoring, never absorbed here.

- **Picked: A, the hard outline** — Dom, 2026-09-22: "i think A", then column A's own panels pasted back with
  "this one", so the pick is anchored to the images and not just the letter. Mail hauberk to mid-thigh over a
  padded wool gambeson, squared layered iron shoulder plates giving a flat hard shoulder line, broad studded
  belt, plain iron vambraces, dark trousers with straight leg wraps, hard low boots, two tight crown braids.
  Approved as a **direction, not a render**: A's panels carry generator artifacts (half-open palms in the bare
  panel) that are not part of what was picked. Sheet, prompts and method in **#498**; B and C stay in the
  sheet as the record of what A beat.
- **She was chosen on outline, not mass.** Shoulder-width ÷ figure-height off each candidate's own silhouette:
  A 0.26, B 0.28, C 0.24 bare, against the Veteran's 0.29 — the Veteran sits *inside* the candidates' spread.
  The Executioner lane measured the same shape of result on the Knight (0.39–0.40 against 0.36). Two lanes,
  two characters, same conclusion; Lead is carrying it to the Knight, Plague Doctor and Witch lanes.
- **Her brief no longer understates her cost.** #471 said *cleaver* in three places and rested a "zero new
  animation authoring" saving on the Pitborn's `Cleaver_*` set; the bearded-axe amendment removes that saving.
  Fixed by Lead at `f6af593` — verified on `origin/lead/brief-shieldmaiden`: §1 now states the axe is a NEW
  one-hand family, §2 states the cost plainly (~13 clips on Weapons and the animation pipeline, not Combat),
  §4 records ONE-HAND as the one cleaver property the axe preserves so shield and axe need no stow case.
  Combat's queue (knife → cleaver → estoc → shield) was deliberately left alone — that cleaver is their flip.
- **Next, when #478 is on trunk:** her body to direction A, one PR per deliverable, silhouette tested at the
  fighter's camera bare **and** in loadout. Bare is the real test: the shield is lootable, so an outline that
  only reads with the shield up fails the moment a player takes it.

**The Pitborn himself: nothing building and nothing open.** Every Pitborn PR is merged and live; the worktree
`~/Developer/frankendom-pitborn` is clean and detached at trunk.

**Live carries this lane's work** — verified on the served file, not on the merge. Live `05622cf` serves
`assets/pitborn-6VGMI4zq.glb`, HTTP 200, 3,473,712 B. Its bytes are **not** the source bytes: deploy meshopt-packs assets,
so compare sources, not downloads — `src/assets/pitborn.glb` is sha256 `4817820151…` at both live `05622cf` and trunk
`dcb9d61`, i.e. live is serving the current body. The 2026-09-20 roster hold is in live too (`c2f7b28` is an ancestor):
`minotaur wraith werewolf skeleton` all carry `hold: true` on trunk, so the beta ladder is the five men.

**What he is on trunk.** Recipe `pitborn: { name: 'the Pitborn', body: 'pitborn', rig: 'hero', archetype: 'pitborn',
weapon: 'cleaver' }`. Simulation `OPPONENTS.pitborn` is **combat-owned, not this lane's**: scale 1.13, health 190, poise 16;
normal `{reaction 14, accuracy .85, parry .15, dodge .1, aggression .8, pressure .7, discipline 25, lapse .1, read .6}`.
The reaction/lapse retune (18 → 14, .3 → .1) is the Combat lane's 09-20 entry — see `docs/state/combat.md` "Combat: Pitborn
tune"; tune there, not here, and re-run `tests/opponents.test.ts`.

**Another lane last rebuilt his body.** The spider-hand fix (`docs/state/character.md`, "Spider-hand fix reaches the
opponents", 2026-09-22) rebuilt pitborn/goblin/nightborn through `parts.py`. Checked after it: the texture diet survived
the rebuild — `photo_orm_1k` is still in `head.py` (3 refs) and both bare-kit guards are still in `parts.py`, and the
trunk file measures **84 MB GPU texture estimate / 3.09 MB gzip, 31 images** (was 116 MB before the diet; the ~4 MB over
the diet's 80 is that lane's finger/AO maps, not a regression).

**Open, nothing started:**
- A read-only look at the live journal picker (four greyed "(on hold)", five live) was never taken — held back under the
  ONE-DEPLOYER no-local-browser-runs rule and no FREE signal since. One headless page load when the deploy session is idle.
- Kit pass, parked after the owner's "char is good" on 09-16: iron knee plates and bone plates as **authored parts**
  rather than `build-warrior.mjs` ellipsoids, rope-textured wraps, tusk polish. The classic-body `knee()` primitive is not
  an option — it renders as black boxes on the realistic body.
- Measurement gap raised and not owned by anyone: `character-preview.html`'s texture table counts the **hero's** textures
  only, so no phone-memory number has ever included the opponent.
- His cleaver is Weapons' (`docs/state/weapons.md`, cleaver v1) and the flip was Combat's (`docs/state/combat.md`,
  "Slice W — the Pitborn fights with the cleaver"). This lane does not touch either.

## Done — 2026-09-16 → 20

- **#81 the opponent seam + his body** (merged `89c91fe`). `Opponent`/`OPPONENTS`/`Level` in moves.ts — weapon, body
  `scale`, `health`, `poise`, a profile per level, so a new opponent is a record and not an AI branch; `Fighter.scale/poise/
  maxHealth`; the blade sweep's capsule and head/torso/legs regions scale with the target; **passive poise** — a plain clean
  hit under the threshold wounds and builds posture but never staggers or knocks back (heavies, counter/stop/rear and
  charged always do). `initialDuel()` stayed byte-identical to the Veteran (deep-equal test). Body from `parts.py --fighter
  pitborn` + `BUILD.pitborn` (scale 1.13, hunch +7/+7/−7/−6 on spine_02/03, neck_01, Head) — KeenTools head from seven owner
  portraits, tusks cut on the scan, rag sash, crude iron belt, rag kilt, wraps, barefoot, no helm. Stands 1.957 m to the
  hero's 1.745. `tests/opponents.test.ts` (fairness battery at normal and hard, held guard broken in every fight, the
  off-line whiff punisher as the best honest script) and the Pitborn parity test in `tests/characters.test.ts`.
- **#84 the bone plates go dark** (merged). Owner's first look: "char is good, just make the white bone a bit darker, or
  same as the brown leather colour". Plates got their own `BoneWorn` material (`#6e5d45`, roughness .72); the tusks kept the
  ivory `Bone` so the face still reads.
- **#179 texture diet + phantom rivets → reverted → re-landed in #194.** His two 2048² maps (the rag sash's colour, the scan
  head's roughness) carried nothing a phone resolves at 3 m and ship at 1024: **116 → 80 MB GPU texture estimate**, gzip 2.94
  → 2.90 MB. Scoped to his own rows (`linen_maps(size=1024 if KIT['bare'])`, `FIGHTERS.pitborn.photo_orm_1k`) so no other
  fighter's bake path changed. The black specks on his back and chest were **not** the scars pass — they were the kit's 22
  baldric rivets, still placed along a baldric a bare fighter never wears; none for `KIT['bare']`, belt rivets kept.
  **Why it was reverted (`63f4cd9`):** the Minotaur and Werewolf are creature bakes on the Pitborn base and record its
  sha256, so a new `pitborn.glb` made them stale at release check 20. The rebuild route (#185) was closed in favour of the
  owner's call to hold them.
- **#194 the roster hold** (merged `a20a785`, live). Owner, 09-20: Minotaur, Wraith, Werewolf and Skeleton are Season 2,
  "keep them, don't delete or lose". `hold: true` on a recipe keeps it built and a valid `OpponentId` — saved encounters
  still resolve, `opponentFor` falls back to the first rung — but takes it off the ladder (`LADDER`/`nextAfter` skip it; a
  held id has **no next**, an index-0 wrap the test caught), lists it disabled "(on hold)" in the journal picker, leaves its
  GLB out of the bundle via `scene.ts`'s asset glob, and makes `creature-check`/`creature-browser-check` skip held families
  (still runnable on demand). `tests/ladder.test.ts` pins the five-man ladder, the fallback, and that the glob exclusions
  match exactly the held bodies. Dist **29.9 → 17.9 MB** gzip; no creature GLB in `dist/assets`; picker probe showed four
  disabled, five live. `.quality-gate.json` deliberately untouched (Lead's gate split #187 owns the creature-only checks).
- **#196 the release check learns the hold** (merged). Deploy #6 failed at check 2/25 — `roster-browser-check.mjs` looped
  every `ENCOUNTERS` id and asserted the opponent's health, but a held `?opponent=` renders the first rung by design
  (`actual 150, expected 190`). This lane's miss: the gate is release-only, not in `npm run quality`. The live rungs are now
  checked as fights and each held id as a **fallback** — Veteran's health, exactly two rigs fetched, and no creature GLB
  requested. Reproduced on trunk first (exit 1 at minotaur), then `"passed": true`; `npm test` 323/323.

## Pipeline — how to rebuild him (do not re-derive)

`HEAD_KT=1 blender -b -P scripts/character/parts.py -- --body realistic --fighter pitborn` (~4 min) →
`WARRIOR_FIGHTER=pitborn node scripts/build-warrior.mjs` → `node scripts/character-preview.mjs --label <x> --enemy
/src/assets/pitborn.glb`. The worktree needs all six `artifacts/source/{base,animations,animations2,human-base-meshes,
hunyuan,lps,outfits}` symlinked from the char worktree.

Traps, each paid for once:
- **Never `skeleton.pose()`** in `build-warrior.mjs` — it changes the exported rest transforms and breaks the `hand_r`
  parity test. The hunch is post-rotations about bind-pose sideways axes.
- **`tusks()`** roots at `mouth_z − 0.020`, where `mouth_z = eyes.z − 1.1 × eye spacing`: the scan is cut under the jaw, so
  the chin is not a landmark.
- **`FIGHTERS.pitborn.skin_mul (0.74, 0.80, 0.84)`** exists because the scan's neck band is lit paler and warmer than his
  grey-green cheeks; without it the body came out tan beside the head.
- **Any change to `pitborn.glb` makes creature bakes on his base stale** (`creature-check` hashes it). While the Minotaur
  and Werewolf are held this costs nothing; if either is unheld, a Pitborn body change ships with their rebuild.
