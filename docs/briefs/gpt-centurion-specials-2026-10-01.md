# GPT brief — Centurion boss special moves, three takes each (2026-10-01)

Paste everything below the line to GPT.

---

Frankendom: the Centurion's three boss special moves (ranks 8, 9, 10). The owner has picked the moves.
Your job is painted art and reference clips, three takes per move. Our lanes build the in-game versions
in parallel and will use your painted pieces where they are better.

## COMPUTE RULE (owner, read first)

- Use ONLY the Hugging Face CPU box: cpu-upgrade (8 vCPU, 32 GB RAM, about $0.03 an hour).
  The Blender Space frankendom-blender is that box. It is paused: resume it when you start, pause it when you finish.
- NO GPU of any kind. No ZeroGPU, no T4, L4, A10G or A100, no GPU Jobs, no inference endpoints.
  No TRELLIS, FLUX, Kontext or any other GPU model Space. The last pack overspent on ZeroGPU; this one must not.
- Paint the effects (2D) and composite the clips in Blender on CPU. No AI image or video generation on a GPU.
- Hard cap: stop and report if the spend reaches $1.00. Write the hours and dollars used per move in the receipt.

## The three moves

The Centurion carries a gladius and a tower shield at these ranks. Every move is unblockable, ~2 s
wind-up in the game, and reads at a glance: Ajax from below, Alexander across the ground, Mars everywhere.

1. **Rank 8, Ajax — Shield Quake.** He lifts the tower shield and drives its rim into the sand. A ripple of
   sand runs along the ground to the opponent and bursts up under them.
   - Take A: a thin fast seam in the sand, then a tight vertical burst of sand and grit.
   - Take B: a wide crescent wave that lifts the sand in a sheet and drops it on the opponent.
   - Take C: a cracked ground line that spits clods and dust puffs in sequence toward the opponent.
2. **Rank 9, Alexander — The Charge.** No horse is shown. A line of dust and trembling sand races across
   the arena at the opponent; he arrives out of the dust with the blow. (Our Audio lane makes the hooves.)
   - Take A: a low dust line with hoof-strike puffs chewing toward the opponent.
   - Take B: a rolling wall of dust with torn streaks, swallowing the gap between them.
   - Take C: separate dust bursts like hoofbeats, accelerating, the last one at the opponent's feet.
3. **Rank 10, Mars — Blood Tithe.** The arena light turns red, the crowd roars. Red dust lifts from the
   sand everywhere and pours into his blade, then one strike.
   - Take A: thin dark-red wisps rising everywhere and spiralling into the blade.
   - Take B: mostly a red light shift with fewer particles; the blade darkens and drinks it.
   - Take C: irregular red clumps torn off the sand and dragged in streaks into the blade, like the blood.

## The owner's taste (learned on the Nightborn set — non-negotiable)

- Grounded and real: the arena's own sand, dust and light. Painted and irregular, never evenly drawn.
- No glow, no neon, no fire, no clean geometric shapes, no symmetric stars, no "low-quality MMO" look.
- Fast build-up: about half a second from start to payoff. Slow 1–2 s build-ups were rejected.
- Semi-transparent where it is air or dust. It must not hide both fighters for long.
- No props: no horse, no spears, no hammer, no floating objects.

## Deliverables

Folder: `~/Desktop/Business/artifacts/frankendom-centurion-specials-20261001/` with a README.
Per move, per take (9 takes):
- Painted RGBA sprite strips or sheets (PNG or WebP, transparent), sized for a phone: under 100 KB each.
- One 3–4 s reference clip (mp4) composited over the arena at the phone fight camera (375 wide), day arena.
- One still sheet: wind-up | payoff | aftermath.
Plus one contact sheet per move showing takes A, B and C side by side.
Receipts: the compute used and cost per move, file hashes. No runtime code, no PR, no deployment.
