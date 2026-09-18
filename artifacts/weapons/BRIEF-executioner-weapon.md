# Brief — the Executioner's weapon (hand-off: character lane → weapons lane, 2026-09-18)

> **Status correction first:** the Executioner is ON TRUNK and LIVE (merged as PR #111, 2026-09-18; revision `9587019`).
> `char/executioner-v1` is not empty — if you can't see it, `git fetch` (the branch went to origin and was merged). Everything
> below is on `codex/01a09a76/task-1` now. The character lane reserved the weapon slot for you; the final flip is one line in
> `moves.ts`. Character-lane build details: `artifacts/character/BRIEF-executioner.md`.

## The owner brief

Owner, 2026-09-18, to the weapons dev: **"a scythe or axe"** for the Executioner (the giant in the iron mask, fifth opponent,
ladder's last rung — 20 % over the Pitborn, scale 1.36). His original reference portraits show a huge sword on his back
(`artifacts/source/face/executioner/reference/masked-0{1..7}.png` — git-ignored, local to any frankendom checkout on this
Mac: copy from `~/Developer/frankendom-executioner/` if your worktree lacks them). The scythe/axe call supersedes the sword.

## What already exists for him (grounded in trunk)

- `src/assets/executioner.glb` — 6.22 MB raw / 3.70 MB gzip, 53,839 skinned tris, 21 clips + the weapon clip slots.
- `moves.ts` `OpponentId 'executioner'`, `OPPONENTS.executioner { weapon: 'longsword' /* YOUR FLIP */, scale 1.36, health 160,
  poise 12, profiles: PROFILES }` — he fights with the longsword's data as the placeholder.
- `scene.ts OPPONENT_GLB.executioner`, `ladder.ts` fifth rung. Live and playable now.
- Weapon seams, proven four times: trident (`artifacts/weapons/REPORT.md` — the template), cleaver, estoc, knife. The build
  speaks `WARRIOR_WEAPON=<id>`; blade paths bake from `extras.contact`; tests assert measured reaches ±0.1 m.
- Budget headroom: per-fight cap 10 MB gzip, live at ~8.36 MB; his GLB is 0.25 MB gzip under the Veteran's.

## The choice — scythe or axe (owner decides the art; combat decides the stats)

| | **War scythe** (recommended) | Axe |
|---|---|---|
| Fight identity | Edge-arc, zero thrust — a gap nobody owns (longsword all-rounder · trident point · cleaver chop · knife short/fast · estoc thrust). A war scythe physically can't thrust (no point, edge faces inward), so the identity comes free from the shape. | The Pitborn's cleaver IS the chopper: slow tells, heavy chops, guard chip, clumsy poke. An executioner axe is the same grammar, longer handle — a reskin by the spec's own rule (an opponent that doesn't change how the fight is played is not added). |
| Roster theft | None. | The axe is the Northman Origin's planned identity (GAME_SPEC line ~47, "fur, axe, aggression") and a planned player family — spending it on an NPC now costs the Northman his silhouette. |
| Phone-size silhouette | Instantly distinct from every shipped weapon. | Next to the cleaver reads "another chopper". |
| Clip cost | Own family — a scythe can't ride the sword set. Trident template: ~13 clips authored on the rig, two-handed grip re-solved every key, strafe-clearance audit. This is the real work either way. | Own family too, but cleaver-adjacent — some keys may borrow. |
| Contract | Haft along local Y, `extras.contact` at the head (~1.6–2.0 m) samples the blade's arc through the bake like the trident's tines. **Wrinkle:** the frozen contract gives one contact segment per weapon, so Stab has no natural home (a butt-spike jab's contact is at the wrong end of the shaft). Proposal: short hooking heel-jab, contact stays at the head — needs the combat lead's nod. | Same seam; Stab is natural (the poll or a spike). |

## Scale warning — he is 1.36×

Reach numbers are fighter-local and the sim scales with him. The trident's measured table (thrust 2.25 / sweep 1.75 / pin 2.15 m,
"fighter-local z" extents) was a 1.0-scale man. At 1.36 the same weapon lands ~⅓ farther in world space — measure against
`src/assets/executioner.glb` directly (`character-preview --weapons --enemy src/assets/executioner.glb`), not the veteran,
and sanity-check the reach against his stride in the audit sheet. Dead-inside distance matters most: the trident's lesson
(kill zone outside, weakness inside ~1 m) inverts beautifully for a scythe — the arc can't develop inside ~1.2 m, where he
has shaft-shove or kick. That inversion is the fight.

## Ship path (the established one)

1. Branch `weapons/scythe-v1` (or `weapons/axe-v1`) off fresh trunk; `scripts/build-weapon.mjs` pattern; bake; `moves.ts` path/moves
   tables + manifest + `tests/weapons.test.ts`; the audit harness is already wired for weapons.
2. The flip: `OPPONENTS.executioner.weapon` `'longsword' → '<id>'` (one line, whoever lands last does it — coordinate).
3. Character lane then re-renders his evidence with the real blade and updates the ladder blurbs if any.
4. Quality gate + budget + PR to trunk; combat reviews the numbers (timing/reach = gameplay change, same as every weapon).

## Open questions (owner / combat lead)

1. **Scythe or axe** — owner's art call. (If scythe: full-length war scythe ~2.0–2.2 m reach, or the shorter garden-tooled
   variant? The "fat" instincts from the trident pick suggest full-length reads better at his scale.)
2. **The Stab button** on a scythe — heel-hook jab with head-contact (proposal) vs combat-lane alternative.
3. **His back-sword** — drop entirely, or does the scythe/axe ride on his back when unarmed? (The Draw clip carries whatever
   `WeaponDrawn` holds; a back-mounted scythe at 1.36× must clear the hood's silhouette — character lane checks the render.)
