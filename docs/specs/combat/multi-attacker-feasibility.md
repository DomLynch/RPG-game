# 1v1 vs multi-attacker: feasibility note (Combat, 2026-10-07)

Ask (Dom via Strategy/Lead): a per-player PvP flag; anti-gank damage scale (2nd attacker 50%, 3rd 25%, 4th+ 10%); loot to the most damage dealt.

## What the code is today (read, not remembered)
- `Duel = { fighters: [Fighter, Fighter] }`, `stepDuel(duel, [Intent, Intent])` (src/duel.ts:57, :150). Side is 0|1; every phase, parry, posture, rear-hit and special rule reads "the other body" as `before[1 - i]`. There is no foe list anywhere in the sim.
- A fight record is ONE intent stream plus `opponent/level/seed` (src/record.ts `FightRecord`); the AI is a function of (duel, side, ai state). Replay = re-step that one pair.
- PvP (src/net/pvp.ts, verify-duel.ts) is client-reported 1v1 with rollback; the host checks a record, it does not simulate.

## Options
**(a) Second parallel 1v1 stream, shared foe health.** Each attacker runs their own `Duel` against a copy of the creature; creature health (and loot-damage ledger) lives outside the sim, in the world layer: a hit in any stream subtracts from the shared pool and scales by the rank-order factor (1.0/.5/.25/.1).
- Sim/record: none. `stepDuel` untouched, no RV. Scaling is applied to the damage number the world layer books, not inside the step. Each attacker's record replays exactly as a 1v1.
- Determinism: per-stream deterministic; the SHARED pool is not part of any record, so the server (or the first claimant) must be the arbiter of death and loot. Same trust model as today's client-reported results, plus a per-bout swap tick (already designed in).
- Cost: low sim, medium net/world (pool sync, rank order by arrival). Phone cost: each attacker only simulates their own fight; no extra body on screen needed (others are ghosts of the same creature position, render-only).
- Weakness: the creature "fights" N people at once with N independent AI states. It can hit two players at the same instant. Honest for a beast, odd for a duelist; a gank is exactly this feel, which is the point.

**(b) Creature disengages from the first fighter.** Creature picks one target at a time (aggro table by damage), the others wait or are repelled.
- Sim/record: none inside the step; it is a world-layer targeting rule plus a deterministic flee/switch cadence (the #7 flee piece). No RV.
- Determinism: easy (one live stream per creature). Cost: lowest net and phone cost. But it is NOT a gank: the second attacker gets nothing to do, which defeats the anti-gank goal (the scale 50/25/10 is moot) and feels like queueing.

**(c) True multi-foe step.** `Duel` takes N fighters; `stepDuel` resolves target choice, overlap split, rear hits from a third body, posture and parry against "a" foe.
- Sim/record: rewrite of stepDuel (all `1 - i` sites), new intent array in the record, new AI target choice, new snapshot and rollback payload. Every fight's replay path changes shape; RV with REACH for everything, plus a new SIM_DIGEST re-pin and a fight-record fixture regen. Largest by far (weeks, not days).
- Determinism: gets the best fidelity (a real gank, real flanking, third-party rear hits) but multiplies the rollback/verify surface. Phone cost: N bodies stepped per tick on every client; the heaviest.

## Recommendation
**(a) for v1**, with (b)'s aggro table used ONLY to choose which attacker's stream the creature "prefers" for its tell (render and sound), not to exclude anyone. It meets Dom's three asks with zero sim change and no RV: per-player PvP flag is world state, anti-gank is a multiplier on booked damage, loot goes to the largest ledger entry. Defer (c) until a real multi-foe fight (a boss with adds) needs it; scope it then as its own RV with a spec.

Open for rulings: who arbitrates the shared pool (host vs first claimant); whether the multiplier applies to the creature's damage to the attackers too (suggest no, only to damage dealt to the creature).
