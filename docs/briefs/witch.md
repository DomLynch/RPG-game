# Brief 16 — the Witch (working name)

Owner: multi-chars lane. Written 2026-09-22 for Strategy's review. **Not on the beta-critical path**: it sits behind the loot schema
(#461), the gloves (#461) and the shield asset, and it must not take Combat's time before the shield lands.

Roster context (Dom, 22:00): launch goes to **ten archetypes** — six live, the Nord (Executioner lane: cleaver + round shield, the
game's shield-bearer), this Witch, and two to name. Brief 14's "6 × 10" becomes **10 × 10**; the kit library work is unchanged and tiers
stay material variants per rig family.

## What she is
Female opponent, hooded. Profile on feints and punishes: *"she never blocks, she is never where the cut lands."* Identity test:
**feint-and-punish wins at hard.** If she can be beaten at hard by standing still and swinging, she is a reskin and the brief has failed,
whatever she looks like.

**Weapon: a new BLADED STAFF, two-hand, spear family** (Dom, superseding the knife). Longest reach in the game, useless inside — which is
the same idea as her defence, expressed in steel: she keeps you at the point.

### What the weapon change actually costs — and the number is smaller than the routing brief assumed
The brief that reached me said this turns her into "a 13-clip family". Measured on trunk instead (`src/characters.ts` `WEAPON_CLIPS`):

| family | role-clip overrides |
|---|---|
| longsword, cleaver, knife, estoc | **1** each — they share the sword family |
| trident, scythe, warhammer | **19** each — their own family |
| maul, reaper (creature) | 21 each |

So the expensive unit is **19 role clips, not 13** — but the decisive point is that **the trident *is* the spear family, and it already
exists.** If the bladed staff can hang on the trident's 19 clips, the new-family cost is zero and what remains is a weapon part, its blade
tables and its data rows. It only costs a family if its silhouette demands one, and that is a question for the Weapons lane, not an
assumption to build on.

By the lane split, **the 13-clip/19-clip family and the staff part are the Weapons lane's shelf**; this estimate covers the character side.

### The estimate, so Strategy can take a number to Dom rather than a feeling
- **Character side (mine): about one lane-week** — body on the chosen rig + the silhouette frame, six kit slots through the shared
  library, fairness battery, finisher fits measured per finisher, ladder rung.
- **Weapon side (Weapons'): ~zero if the staff reuses the trident's family; about one lane-week if it needs its own 19 clips.**
- **Her own blade tables either way:** 10 per (rig, weapon) — one `bake-blades.mjs` run.
- **So: it lands a lane-week beyond the Nord only in the new-family case.** Answer that question first — it is one conversation with the
  Weapons lane and it decides whether Strategy needs to take anything to Dom at all. Not absorbed silently, per the instruction.

## The decision: (a) a new rig, or (b) the hero rig with female proportions in the mesh

**Recommendation: (b), with a named condition under which we pay for (a).** Strategy has since made this framing — build, render the
fighting-camera frame beside the others, look — **deliverable 1's pass condition for all four new characters**, before any texture work.
That raises the stakes here rather than lowering them: see "What would make this brief wrong".

The game has no female rig. `RigId` is `'hero' | 'goblin' | 'nightborn' | 'minotaur' | 'wraith'` (`src/roster.ts:8`) — five, of which
three are creatures. I own both re-proportioning routes (the Goblin's `BUILD.bones`, the Dwarf's inverse-field unscale), so here is what
(a) actually costs, measured rather than guessed:

| cost of a new RigId | measured today |
|---|---|
| Blade-path bake, her own | 10 tables for one weapon. Every rig has exactly 10 per weapon: hero 7 weapons / 70 tables, goblin, nightborn, minotaur and wraith 1 weapon / 10 each (`src/blade-paths.ts`). The lookup is **strict** — `bladePathsByRig[rig]?.[weapon]?.[kind]` (`src/blade.ts:34`) — so a missing table is a hole, not a fallback. |
| Brief 14 kit | **+1 rig family**, and tiers are material variants *per family*, so the shared six-slot library is fitted again for her. This is the big one and it is mine. |
| Finisher fits | measured per finisher; four carry their own framing (`src/camera.ts:42`: `runThrough`, `splitCrown`, `quietOne`, `opened`). |
| The re-proportioning itself | `BUILD.bones` per-bone scale through the skin weights, rebuilt inverse binds, pelvis/floor clamp, stride datum — the Goblin route, which works, plus its own verification pass. |

The blade bake is small: one weapon, one run of `scripts/bake-blades.mjs`. **The kit multiplication is what makes (a) expensive**, and it
gets worse, not better, as the roster goes to ten — every future shared piece is authored and raycast-fitted once more, for one fighter.

So (b) unless she reads wrong at the fighter's camera. **The condition, stated so it can be tested rather than argued:** build her body on
the hero rig with female proportions in the mesh, render the versus still and a fighting-camera frame, and put them next to the Veteran's.
If she reads as a man in a hood at that distance, (a) is justified and I will cost it properly; if she reads as a woman, the skeleton was
never the thing carrying the silhouette. **Shoulder width and hip-to-waist do most of that work in the mesh, and neither needs a bone
scale** — the Goblin's re-proportioning exists because his *limb lengths* are wrong for a man's skeleton, which is not her problem.

**The honest risk in (b):** the hero skeleton's shoulder joints sit at a man's width, so a mesh narrowed past a point will show the
deltoid sliding off the joint in the guard poses. That is a mesh-weighting problem with a mesh-weighting fix, and it is the thing to look
for in the first render, not a reason to start on (a).

## Two corrections to the routing brief, verified rather than repeated
1. **The creature hazard is narrower than either of us said, and my own earlier version was the broader error.** `scripts/creature-check.mjs:39`
   pairs each creature with its base: minotaur→`pitborn`, werewolf→`pitborn`, wraith→`nightborn`, but **skeleton→`source/backups/veteran-v1`**,
   executioner→`source/backups/executioner-v5`, dwarf→`source/creatures/dwarf-donor`. So the Skeleton keys on a **frozen backup**, not on
   the live Veteran fight GLB — rebuilding the Veteran would *not* make it stale, contrary to what I told the lead earlier today. Further,
   the rows that *do* key on live fight GLBs (minotaur, werewolf, wraith) are all `hold: true` and the check filters held families out
   (`.filter(([id]) => !ROSTER[id].hold)`), so rebuilding `pitborn.glb` would not fail `creature-check` **today** — it would leave a
   latent re-bake debt that bites when Season 2 unholds them. Loot-only remains right for the gloves and the shield, but for that reason
   and not because the gate would go red.
   A brand-new Witch GLB is a new family on the hero rig and touches no donor under either (a) or (b).
2. **`parts.py` carries `fit_finger_bones`** (verified present on trunk `f480728`), so any new humanoid built through it gets correct
   knuckles automatically. She inherits the fix rather than repeating the spider-hand rescue.

## Deliverables, in order
1. Body on the chosen rig + versus still — **and the side-by-side silhouette frame, which is the pass condition, before any texture work.**
2. Kit, six slots, per Brief 14 — shared pieces, tiers as material variants.
3. Fairness battery against every offered player weapon (longsword, warhammer, trident, scythe today).
4. Finisher fits measured per finisher.
5. Ladder rung.

## What would make this brief wrong
If Strategy wants her to read as *physically smaller* rather than differently shaped — a lighter, shorter fighter — then it is the Goblin
problem after all and (b) will not carry it, because limb length is a bone fact. Say so now and I will cost (a) properly instead of
discovering it at deliverable 1.

This is now the live risk, not a footnote: the silhouette bar plus Dom's worry about plain humanoids means "does she read as a woman at
fighting distance" is judged before texture can rescue it. (b) is still my recommendation — the mesh carries shoulder width and
hip-to-waist without a bone scale — but the test is the answer, not the argument, and I will build it to be looked at early rather than
defended late.
