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

### The cast — short-range magic as a MOVE, not a system
Dom's addition, Strategy's construction. It is a normal `MoveDef` on the bladed-staff family — its signature slot, the way the scythe has
its heel jab. Reach, wind-up, active, recovery, damage, posture. **No projectiles, no new sim phase, no timers outside the tick.**

- Reach **no longer than the kick's**.
- Wind-up **longer than any heavy in the game** — the most readable tell on the roster.
- A **held guard does not stop it** (kick class): the answer to a turtle at her range.
- A **roll or backstep beats it clean.**
- Stamina like a heavy; heavy posture damage, moderate health damage.
- **Longest recovery of her moves** — a whiffed cast is the punish window.

Presentation: glow on the staff head through the wind-up, a sprite burst on the active tick (not per-frame particles, for the phone
budget), the audio lane's existing landed-heavy crowd sound. **No screen shake** — Dom plays on a phone.

**The loot consequence is intended and it is not free.** Loot v2 makes every weapon takeable, so the player who takes her staff casts it
too. The battery covers the cast like any other move, with **no exception rows for magic**. What that means in build terms, and it was not
in the instruction: a clip name in `WEAPON_CLIPS` must exist in **every GLB that uses the weapon**, so the cast is authored on **her rig
and on `warrior.glb`**, and blade tables are per (rig, weapon) — **10 for her staff and 10 for the hero's**, not 10 total. The player
casting is a second fairness surface, not a reskin of hers.

**It also ends the free reuse of the trident family.** A cast clip is a 20th role clip: the staff can still borrow the trident's 19 rather
than author its own, but it needs at least one clip of its own on top. One added clip is not nineteen — the reuse is still worth having —
but "zero new clips" is no longer available.

**Not mine to build:** the VFX burst is the Visuals lane's and the sound is the Audio lane's. My estimate covers the clip, the rig work,
the tables and the battery rows.

### The estimate, so Strategy can take a number to Dom rather than a feeling
- **Character side (mine): about one lane-week** — body on the chosen rig + the silhouette frame, six kit slots through the shared
  library, fairness battery, finisher fits measured per finisher, ladder rung.
- **The cast, on top: about half a lane-week** — one clip authored on **two** rigs (hers and the hero's, because the player takes the
  staff), the move's data and tuning to the six rules above, and the battery rows for both sides of it. The VFX and sound are other lanes'.
- **Weapon side (Weapons'): ~zero extra clips if the staff borrows the trident's 19, plus the one cast clip it must add either way; about
  one lane-week if it needs its own family.**
- **Blade tables: 20, not 10** — 10 per (rig, weapon), and the staff now lives on two rigs.
- **Where that leaves her against the Nord — the third scope change tonight, so here is the number rather than a shrug.** The Nord is a
  cleaver and a round shield on existing families: call it a lane-week. The Witch is now **~1.5 lane-weeks of character work, or ~2.5 if
  the staff needs its own clip family**, plus VFX and audio in other lanes. **She is materially past the Nord in every case, and by more
  than double in the worst one.** The single question that decides which is whether the staff can borrow the trident's family — one
  conversation with the Weapons lane, worth having before anything is taken to Dom.

## The decision: (a) a new rig, or (b) the hero rig with female proportions in the mesh

**There are now TWO female characters, not one** (Brief 15's Nord is a Viking woman, "the Shieldmaiden"; roster rule two women, eight
men). That changes this decision's weight in both directions: under **(b)** one decision covers both and the shared six-slot library
carries them with no new rig family; under **(a)** the new family is amortised across two characters — cheaper per head than when I
costed it — but the Brief 14 library is then authored and raycast-fitted a second time for a family holding two of ten archetypes.

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
1. Body on the chosen rig + versus still — **and the silhouette frame, which is the pass condition, before any texture work.** It is a
   **three-way**: the Witch, the Shieldmaiden and a male archetype at the fighting camera, as black shapes. If two women on one rig read
   as the same person, that is worth knowing before either gets textured.

   **Run it twice — bare, and in loadout — because they answer different questions.** In loadout the read is almost certainly carried by
   the kit and the weapon: a hooded figure with a long staff and a mailed figure behind a round shield will never be confused, whatever
   their bodies do. The bare pass is the honest one: it says whether the *bodies* are distinguishable, and if only the loadout separates
   them then any stripped or disarmed state collapses them into one person. A three-way that is only run in loadout will pass for the
   wrong reason and we would not find out until something took the shield away.
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
