# Proposed direction — "The Ashen Champion" (one direction, owner picks)

Evidence: `swatches-near.png`, `swatches-far.png`, `silhouette-studio.png`, `silhouette-lock-portrait.png`,
`silhouette-lock-landscape.png`. All rendered by the harness under the game's own lighting and lock camera.
The blockout is primitives on the real rig — a silhouette test, not the asset. Nothing here ships.

## The idea in one line
A human longsword fighter dressed by a dead civilisation's arena: **bronze that has been fought in, blackened iron, oiled
leather, bone, ash — and one dyed crest that is the only colour on the body.**

## Why this one
1. **It wins the phone camera.** The lock camera sees head, shoulders, back, and the weapon from above. A crested helm,
   one heavy asymmetric shoulder, a belt with hanging pteruges and bronze greaves change the outline from every angle
   (`silhouette-lock-portrait.png`, right half) without touching proportions — poses stay exaggerated, anatomy stays human.
2. **Warm against cool.** Bronze, leather and blood separate from the grey floor at fight distance; blue steel and ash-grey
   sink into it (`swatches-far.png`). Legibility comes from the material rule itself, not from outlines or glow.
3. **Two fighters, one mesh, instantly different.** The crest is the `Heraldry` surface: red-black for the player, bone-white for
   the opponent. It is on the head, so it is visible in every pose and from behind — unlike the current chest panel.
4. **It fits the locked art direction** (bronze, iron, bone, leather, stone, ash, blood; no polished plate, no glow, no cartoon)
   and the references (Ryse kit, 300 bronze restraint, Gladiator ceremony, For Honor silhouette) without copying any of them.
5. **It keeps the contract.** Same skeleton, same 21 clips and durations, same `SwordDrawn`/`SwordSheathed` attachments and
   blade; helmet/shoulder/skirt/greaves are attachments and skinned shells, not rig changes.

## Kit (what v1 would actually build)
- **Helm**: closed bronze helm with cheek guards and a narrow T-slot; horsehair-style crest plate in the Heraldry dye. Gorget/
  aventail closes the neck.
- **Sword arm**: one heavy shoulder — bronze cap on the clavicle, two lames on the upper arm — and a bronze vambrace.
- **Off arm**: bare, leather-wrapped forearm; ash-dusted skin. Asymmetry is the silhouette.
- **Torso**: leather subarmalis with a worn bronze scale or muscled-plate front (decided at the material pass), iron belt.
- **Hips/legs**: 12 leather pteruges over a short leather skirt; bronze greaves; sandal-boots with an actual sole.
- **Weapon**: same blade path; add fuller, a proper crossguard and pommel, leather-wrapped grip, scabbard with a throat and chape.
- **Materials**: 2K max per set, packed ORM, normal maps carry the wear; blood as roughness (wet) not colour.

## What it is not
Not a Roman legionary costume (no lorica, no gladius, no scutum), not a monster, not an Origins variant, not a new rig.
No cloth simulation: pteruges are rigid strips skinned to the pelvis/thighs.

## Budget intent
Hold or reduce: triangles go from the hidden superhero body into the kit (target ≤ 35k per fighter), textures 2K→ mobile-
resampled at build time, draw calls held by keeping the five material names and merging shells per material.

## Decision needed from the owner
Pick this direction, or say what to change (helm shape, how much skin, crest vs plume, colour of the opponent's crest).
Modelling starts after the pick.
