# GPT brief: Special Moves pilot — Thor's hammer throw (2026-09-29)

From Dom (owner) via Strategy. One move end to end, so we can judge the "wow" on a phone before making the other 39.

## The feature (context)

Every fighter gets ONE special move. 10 class moves (one per opponent class) + 30 boss moves (the rank 8, 9 and 10 legends, e.g. Thor, Athena, Hades) = 40.
Rules (the game code does these, not you): mid-range, cannot be blocked, dodged or interrupted; a committed ~2 s wind-up during which the caster is exposed; 20 % damage (class) / 30 % (boss); 20 s cooldown.

## The pilot: Thor, rank 10 — "Hammer Throw"

Grounded and heavy, NOT cheesy: no jumping into the air, no floating, no cartoon poses.

1. **Wind-up (~2 s, the tell):** Thor plants his feet, draws the hammer back over his shoulder, lightning crawls along the head and his arm. The pose must read clearly at a small phone size from behind the player.
2. **Throw:** a hard overarm throw. The hammer spins flat toward the target at mid-range (about 3–5 m).
3. **Impact:** hits the opponent's upper body, thunder crack, short lightning burst.
4. **Return:** it arcs back like a boomerang and Thor catches it one-handed, then returns to his fighting stance.

## What we need from you

1. **Storyboard:** 3 frames (wind-up, impact, catch), same style as your character packs.
2. **Motion:** the animation clips on OUR rig: the hero skeleton you already fit armour to (65 joints). Suggested tool: HY-Motion 1.0 on Hugging Face (https://hf.co/tencent/HY-Motion-1.0, text-to-motion), then retarget onto our skeleton in Blender. Other tools are fine if the result is better.
   - Clips: `Special_Windup` (loops cleanly for up to 2 s), `Special_Release` (throw), `Special_Catch` (catch + back to stance). 30 fps.
   - Feet stay on the ground; root motion minimal (the game positions him).
3. **Hammer path:** a simple list of hammer positions over time (out and back), or an animated empty named `ThrownWeapon`, so the game can fly the hammer and time the hit.
4. **LICENCE CHECK:** before delivering, read HY-Motion's licence (it is Tencent's own, "other") and tell us in the handover whether commercial use in a game is allowed for us. If not, say so and use another method.

## Delivery (same as your character packs)

A work folder with `delivery/` containing the GLB clips, the Blender scene, a preview video or GIF of the full move at the fight camera (behind the player, phone width), a `manifest.json` and `SHA256SUMS`. Keep the original rig, all existing 25 clips and the weapon placement unchanged.

## Not in scope

Effects in the game (lightning, thunder) are ours; your storyboard just shows what they should look like. No new character look for Thor in this pilot.
