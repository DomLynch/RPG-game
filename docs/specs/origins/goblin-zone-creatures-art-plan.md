# Goblin zone creatures: art plan (Characters & Art, 2026-10-16)

Status: PLAN. Nothing is generated and no paid job has run. Inputs: `docs/briefs/goblin-zone-creatures.md` and the reference picture `docs/briefs/references/goblin-zone-troll-and-salamander.png` (both on branch `zone/goblin-field-dome`), Dom's two pictures as the designs, Strategy's rulings (Cave Troll = Zone 1 named boss, level 3; Giant Salamander = a camp creature beside the goblins), and `body-families.md` (no one-off bodies; a custom shape only for a boss or a lair).

Order (Lead, 2026-10-16): the troll first, then the salamander, then camp props. Props are not planned here.

## What the pictures say
- **Cave Troll** (left picture): a hulking humanoid, hunched, 2.5-3x a goblin's height, stone-plated hide with moss and lichen, a green glow behind it, very long thick arms ending in huge fists, short bowed legs with clawed toes, tusked underbite, a ragged dark loincloth. Brief adds: chained collar, "chained war beast".
- **Giant Salamander** (right picture): a low armoured quadruped seen from the side, red overlapping scales over the back and flanks, a pale ribbed belly and throat, a row of blue-grey spikes from head to tail tip, a long thick tail that curves up in a blue-grey fin, a wide crocodile-like jaw, thick splayed legs with dark claws.

## Reuse first (rig families, from `body-families.md`)
- **Troll = the `giant` family**: the hero 65-bone rig with proportions x1.8-2.0 and long arms. All 37 hero clips play (the same reason the humanoid recipe fits our rig). It is a named boss, so a custom body is allowed (cap 80k tris, 4096 px).
- **Salamander = the `quadruped` family**: the new rig (spine 5, four legs, tail, jaw; clips idle, walk, run, bite, hurt, Flee, death) that the ash wolf and boar are waiting on. Do not build a third rig: the salamander rides the same one, with a longer tail chain. It is a mob (cap 20k tris, 2048 px) unless Strategy makes it a boss.
- The donor-games rule: EQEmu spawn rows and 2004Scape NPC definitions both separate the model from the stat row; the body is data on a family, the fight rules are Combat's and the spawn rows Backend/World's. This plan is bodies and rigs only.

## FLUX prompts (FLUX.1-Krea-dev, seed 190926, 832x1216, 28 steps; our own wording, the pictures inspire it)
Troll (front, A-pose so the hero-rig fit works):
> Full-body character concept art of a cave troll, front view, standing in an A-pose with arms slightly away from the body and empty open hands. A hulking hunched brute about two and a half times human height, skin like mossy grey stone plates with lichen and hanging moss, very long thick arms, huge fists, short bowed legs with heavy clawed toes, a tusked underbite and small deep-set eyes, a ragged dark leather loincloth, a rusted iron chain collar with a broken chain hanging from it and iron shackle cuffs on both wrists, faint green glow in the cracks of the stone. Painterly dark-fantasy game concept art, even soft light, plain neutral grey background, no weapon.

Salamander (side view, neutral stance, mouth slightly open, legs apart so the four legs read):
> Full-body side-view creature concept art of a giant cave salamander, a low heavy armoured quadruped standing in a neutral pose with all four legs visible and apart. Overlapping red scales across the back and flanks, a pale cream ribbed belly and throat, a row of spiked blue-grey dorsal spines running from the head down to the tail, a very long thick blue-grey tail with a fin ridge that curves upward at the tip, a broad crocodile-like jaw with small teeth, thick splayed legs with dark claws. Painterly dark-fantasy game concept art, even soft light, plain neutral grey background.

Why these shapes: TRELLIS.2 reads a clean silhouette on a plain background; the troll's chain and loincloth are the cloth-bone parts (the known weak spot), so they stay close to the body; the salamander's tail and dorsal spikes stay attached to one continuous mesh so they skin on the tail chain.

## Pipeline per creature (recipe in `character-build-recipe`)
1. FLUX concept: 3-4 seeds each; Dom or Lead picks one before any 3D (rule: TRELLIS only after a concept is picked).
2. TRELLIS.2 at max (1536 / 500k faces / 4096 texture).
3. Blender on the VPS: reduce to the cap, then fit.
   - Troll: `fit_tmax_to_knight_rig.py` (hero rig, copy skin weights from our knight, scale x1.8-2.0, arms lengthened). Cloth bones: loincloth skirt chain, the collar chain as a short bone chain. Pose stress test (any tearing = not done), then the arena still at 375 with our knight for scale.
   - Salamander: the quadruped rig, once it exists (it does not yet; the wolf and boar are on it). Weights: Blender's automatic weights from the rig bones, then a data-transfer pass from the quadruped reference mesh; the tail gets 5-6 bones, the dorsal spikes ride the spine bones. UniRig stays out unless the quadruped rig is not ready (recorded verdict: a starter skeleton for rigless creatures only after Proof 3).
4. Auto-QA sheet (tri and texture caps, gzip size under 1.5 MB, alpha silhouette at 375) before anything is wired to a row.

## Money (Dom's $1 total for goblin-zone art: relayed by Lead, not yet confirmed by Dom in chat)
- FLUX on the free Space and TRELLIS.2 on ZeroGPU (Dom's Pro) cost $0 per the recipe, if the quota is there. Blender on the VPS is free. Those are the paths to try first.
- Fallback if a Space is down or out of quota: an HF job on an L4 (about $0.80/h). Estimate: a TRELLIS.2 max run is about 15-20 min on an L4, so about $0.25-0.30 per creature, about $0.60 for both, inside $1 with room for one retry.
- No paid job starts until Dom confirms the budget in chat. Each job's `cost_usd` and a running total go in the PR body; stop and tell Lead before any job that would pass $1.
- Known gate: the HF T4 hit the daily cost guard on 2026-10-14 ($5.76 spent, $5 stop). Do not work around it.

## Open questions
1. Salamander: camp creature (mob caps) or boss caps? Strategy's ruling says camp creature.
2. Does the quadruped rig exist in time? Without it the salamander waits behind the wolf and boar.
3. Troll special and the chain as a gameplay prop are Combat's; the body only needs the collar chain to move.
4. Who picks the concept: Dom, or Lead for him?
