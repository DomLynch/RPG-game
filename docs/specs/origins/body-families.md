# Mob body families (Characters & Art, 2026-10-07; Dom's scale ruling via Strategy/Lead)

No one-off bodies. A mob is a ROW: `family` x parametric `tint / scale / kit / dressing`. A custom shape exists only for a boss or a lair, and only through the batch job below.

## Families (9; the first six need no new art or only one body)
| id | body today | rig | used for | state |
|---|---|---|---|---|
| humanoid-s | goblin | hero-family rig (goblin BUILD.bones) | scavenger, brood, ghoul, imps | LIVE (mob-dress, #1644) |
| humanoid-m | pitborn / veteran / executioner | hero rig | thralls, bandits, cultists | LIVE |
| humanoid-l | witch / knight scaled 1.2-1.4 | hero rig | matriarch (Mere-mother), captains | LIVE as a scale; custom only if the stills fail |
| giant | NEW (design: `giant-hrungnir-b`) | hero rig, proportions x1.8-2.0, long arms (batch) | Hrungnir, ash giants, trolls | design done, TRELLIS next |
| quadruped | NEW (designs: `beast-ash-wolf`, `beast-boar`) | quadruped rig (new: spine 5, 4 legs, tail, jaw), clips idle/walk/run/bite/hurt/FLEE/death | wolves, boars, hounds | design done, TRELLIS next |
| undead | skeleton | skeleton rig | ruin ghouls' betters, bone mobs | LIVE body, no row yet |
| spirit | wraith | wraith rig | mere ghosts, wisps | LIVE body, no row yet |
| serpent | minotaur held / new | serpent rig | Lambton worm, mere eels | later |
| flyer | new | wing rig | carrion birds, bats | later |

A quadruped FLEES when hurt: the clip set carries a `Flee` run and the mob view switches to it below the row's `fleeAt` hp fraction (Expansion owns the rule; the body only supplies the clip).

## Row fields (mob-looks.ts today; Expansion owns the generator and the row format)
`family` (replaces `opponent`), `tint` (cloth/skin multiplier), `scale` (1 = family height), `kit` (weapon or none; beasts carry none), `dressing {soot, burnt}`, `variant?` (0-3: a pre-baked material swap per family), `later?`. The dressing code (mob-dress.ts `dressMob`) is family-agnostic: it dresses cloth draws and the baked `<Family>Surface` draws.

## Batch art job (scripted, never hand-run; `scripts/character/mob-batch.mjs`, next)
Input: a `families.json` of `{family, prompt, seed, size, tris, texture}`. Steps per family: FLUX.1-dev design (HF, `t2i.py`) -> A-pose/side view check -> TRELLIS.2 at MAX on HF (`trellis2.py`, 1536/50/500k/4096 per the hero-set rule) -> Blender reduce + fit on the family rig (VPS, nice, one at a time, after the deploy/load check). HF auth is the Mac's stored login; the VPS has none, so HF steps run from the Mac (cloud GPU, light), Blender on the VPS.
Auto-QA per batch, ONE sheet for Dom: (1) a 375 contact sheet of every family body at the fight camera, ready idle, dressed with its rows; (2) caps: <= 20k tris and <= 2048 px maps for a mob (<= 80k / 4096 for a boss), size <= 1.5 MB gzipped per body; (3) silhouette readability: render the alpha silhouette at 375, the area fill of the figure's bounding box and the pairwise silhouette IoU between families must stay under 0.6 (a family that reads like another fails), and the body must be taller than 25% of the frame at the fight camera.
Fail = the family is held out of the sheet and named with its reason.

## Order
1. Giant (Hrungnir) and quadruped (ash wolf) through FLUX (done, below), TRELLIS next.  2. Contact sheet to Lead BEFORE any rigging.  3. Rig the giant on the hero skeleton (long arms), build the quadruped rig.  4. The batch script + QA, then more rows from Expansion.
