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

- **What it is:** a regular special, not a finisher. Hades (Nightborn at career rank 9) casts it in a fight; it can also land as the killing blow when it takes the opponent's last health. The game decides when it is cast and how much damage it does: 30 % of health, mid-range (inside 3.0 m), cannot be blocked, dodged or interrupted. There is no knockback and no stun beyond the hit reaction below.
- **Range:** cast inside 3.0 m; once released it always lands.
- **Order of events (FINAL, from Combat's code at 60 Hz; t=0 = the cast):**
  - 0.0–2.0 s: wind-up: hand up, cloud gathers over the target's head and darkens.
  - 1.5–2.0 s (inside the wind-up): the pull-down: the claw forms in 0.3 s, then falls in 0.2 s.
  - 2.0 s: the claw lands on the head (the hit). Target plays the head-hit reaction, 0.75 s (knees buckle, back to stance).
  - 2.0–2.75 s: recover: the claw and cloud break into smoke and fade (the "tear-away"), and Hades returns to stance.
  - If Hades is killed during the wind-up, the cloud just fades and nothing drops.
- **Your clips at 30 fps:** `Special_Windup` up to 60 frames (2.0 s) with the pull-down in its last 15 frames (no separate Release clip needed); `Special_Recover` 23 frames; `Special_HitHead` 23 frames.
- **Who joins the parts:** our Combat lane owns the timing and fires the events; our Finishers lane hangs the cloud/claw/smoke effects on those events. Your clips and claw GLB replace our placeholders if Dom prefers them.
- **Acceptance:** a video of the full move at the fight camera (behind the player, phone width), then Dom plays it on his phone from a test link. Stills alone don't pass.

## What we need from you

1. **Storyboard:** 3 frames (wind-up with cloud, claw strike, recover), same style as your character packs.
2. **Motion:** clips on OUR hero rig (65 joints). Suggested: HY-Motion 1.0 on Hugging Face (https://hf.co/tencent/HY-Motion-1.0), retargeted in Blender; other tools fine if better.
   - Caster: `Special_Windup` (60 frames, pull-down in the last 15) and `Special_Recover` (23 frames). 30 fps.
   - Target: `Special_HitHead` (driven down, recovers to stance).
   - Feet on the ground; minimal root motion.
3. **Claw:** the claw (and cloud shape) as a simple low-poly GLB, under 5k tris, plus its drop path over time (or an animated empty `ShadowClaw`), so the game can time the hit.
4. **LICENCE CHECK:** read HY-Motion's licence and say in the handover whether commercial use in a game is allowed. If not, use another method.

## Delivery

A work folder with `delivery/`: GLB clips, the claw GLB, the Blender scene, a preview video/GIF at the fight camera (behind the player, phone width), `manifest.json`, `SHA256SUMS`. Keep the rig, all existing clips and the weapon placement unchanged.

## Not in scope

In-game effects (cloud, shadow, burst) are ours; your storyboard just shows what they should look like. No new look for Hades.
