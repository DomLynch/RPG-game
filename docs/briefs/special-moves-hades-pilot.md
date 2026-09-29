# GPT brief: Special Moves pilot — Hades' Shadow Claw (2026-09-29)

From Dom (owner) via Strategy. Dom picked Hades as the first special to try. The same brief goes to our in-house dev (Combat lane) and to you; we compare both.

## The feature (context)

Every fighter gets ONE special move: 10 class moves + 30 boss moves (the rank 8, 9 and 10 legends) = 40.
Rules (the game code does these, not you): mid-range, cannot be blocked, dodged or interrupted; a committed ~2 s wind-up during which the caster is exposed (he can be hit and killed; if he dies the move fizzles); boss damage 30 %; 20 s cooldown.

## The move: Hades (Nightborn, rank 9) — "Shadow Claw"

Dom's words: a black cloud, a shadow claw from above, to the head. Grounded and dark, NOT cheesy: no jumping, no floating, no cartoon poses.

1. **Wind-up (~2 s, the tell):** Hades plants his feet and raises his free hand, palm up, toward the sky over the target; a black cloud gathers above the opponent's head. The pose and the cloud must read clearly at phone size from behind the player.
2. **Strike:** he closes his hand into a fist and pulls down; a huge shadow claw drops out of the cloud onto the opponent's head.
3. **Impact:** the target is driven down (knees buckle), a dark burst at the head.
4. **Recover:** the cloud tears apart and fades; Hades returns to his fighting stance, estoc still in his other hand.

## Gameplay and timing (answers to GPT's questions, 2026-09-29)

- **What it is:** a regular special, not a finisher. Hades (Nightborn at career rank 9) casts it in a fight; it can also land as the killing blow when it takes the opponent's last health. The game decides when it is cast and how much damage it does: 30 % of health, mid-range (about 3–5 m), cannot be blocked, dodged or interrupted. There is no knockback and no stun beyond the hit reaction below.
- **Order of events (targets; Combat's code sets the final numbers and you match them):**
  - 0.0–2.0 s: `Special_Windup`: hand up, cloud gathers over the target's head and darkens.
  - 2.0–2.3 s: `Special_Release`: the fist pulls down; the claw drops out of the cloud.
  - 2.3 s: the claw lands on the head (the hit). Target plays `Special_HitHead` (~0.8 s: knees buckle, back to stance).
  - 2.3–3.0 s: `Special_Recover`: the claw and cloud break into smoke and fade (this is the "tear-away"), and Hades returns to stance.
  - If Hades is killed during the wind-up, the cloud just fades and nothing drops.
- **Who joins the parts:** our Combat lane owns the timing and fires the events; our Finishers lane hangs the cloud/claw/smoke effects on those events. Your clips and claw GLB replace our placeholders if Dom prefers them.
- **Acceptance:** a video of the full move at the fight camera (behind the player, phone width), then Dom plays it on his phone from a test link. Stills alone don't pass.

## What we need from you

1. **Storyboard:** 3 frames (wind-up with cloud, claw strike, recover), same style as your character packs.
2. **Motion:** clips on OUR hero rig (65 joints). Suggested: HY-Motion 1.0 on Hugging Face (https://hf.co/tencent/HY-Motion-1.0), retargeted in Blender; other tools fine if better.
   - Caster: `Special_Windup` (loops cleanly up to 2 s), `Special_Release` (the pull-down), `Special_Recover` (back to stance). 30 fps.
   - Target: `Special_HitHead` (driven down, recovers to stance).
   - Feet on the ground; minimal root motion.
3. **Claw:** the claw (and cloud shape) as a simple low-poly GLB, under 5k tris, plus its drop path over time (or an animated empty `ShadowClaw`), so the game can time the hit.
4. **LICENCE CHECK:** read HY-Motion's licence and say in the handover whether commercial use in a game is allowed. If not, use another method.

## Delivery

A work folder with `delivery/`: GLB clips, the claw GLB, the Blender scene, a preview video/GIF at the fight camera (behind the player, phone width), `manifest.json`, `SHA256SUMS`. Keep the rig, all existing clips and the weapon placement unchanged.

## Not in scope

In-game effects (cloud, shadow, burst) are ours; your storyboard just shows what they should look like. No new look for Hades.
