# 1v1 vs multi-attacker: feasibility note (Combat, 2026-10-07)

Ask (Dom via Strategy/Lead): a per-player PvP flag; anti-gank damage scale (2nd attacker 50%, 3rd 25%, 4th+ 10%); loot to the most damage dealt.

**Superseded by Dom's approved PvP direction (afa6dee1, Strategy ruling 2026-10-07):** PvP is ALWAYS a duel; extra attackers on a player wait on the ring and fight one at a time (the pack rule). So option (a) below does NOT apply to PvP, and the 1.0/.5/.25/.1 multiplier is DROPPED everywhere. (a) is for the PvE case only: a second player joins someone's creature fight. Where the text below still says "anti-gank multiplier", read "no multiplier".

## What the code is today (read, not remembered)
- `Duel = { fighters: [Fighter, Fighter] }`, `stepDuel(duel, [Intent, Intent])` (src/duel.ts:57, :150). Side is 0|1; every phase, parry, posture, rear-hit and special rule reads "the other body" as `before[1 - i]`. There is no foe list anywhere in the sim.
- A fight record is ONE intent stream plus `opponent/level/seed` (src/record.ts `FightRecord`); the AI is a function of (duel, side, ai state). Replay = re-step that one pair.
- PvP (src/net/pvp.ts, verify-duel.ts) is client-reported 1v1 with rollback; the host checks a record, it does not simulate.

## Options
**(a) Second parallel 1v1 stream, shared foe health.** Each attacker runs their own `Duel` against a copy of the creature; creature health (and loot-damage ledger) lives outside the sim, in the world layer: a hit in any stream subtracts from the shared pool and scales by the rank-order factor (1.0/.5/.25/.1).
- Sim/record: none. `stepDuel` untouched, no RV. No damage multiplier. Each attacker's record replays exactly as a 1v1.
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
**(a) for v1, PvE only** (a second player joins someone's creature fight), with (b)'s aggro table used ONLY to route the creature's tells to its aggro target's stream, not to exclude anyone. Zero sim change, no RV: parallel 1v1 streams, shared creature health, loot to the largest ledger entry, no damage multiplier. PvP stays a strict duel (queue on the ring, one at a time). Defer (c) until a real multi-foe fight (a boss with adds) needs it; scope it then as its own RV with a spec.

**Pool arbiter (ruled):** the server, the same authority as every world write (encounter token + replay). In client-only previews the first claimant hosts. A peer client is never the authority in the shared world.

## Large-scale battles (input to the new pillar)
Is "many concurrent 1v1 streams + crowd actors" ((a) at scale) enough for sieges? Enough for: a wall of individual duels, each fighter pinned to one foe at a time, with crowd actors (render-only, no sim) filling the field and an outcome ledger per front. Cheap on a phone: one stepDuel per local player, crowd is animation.
Where it breaks:
- **Formations / flanking:** a shield wall, a rear hit from a second man, pinning two on one all need a fighter to read MORE than one foe. A stream pairing never produces them; they are (c) territory.
- **Area attacks:** a ram, a catapult stone, a cleave through a rank hit several bodies in one tick; a 1v1 stream has one target, so they must be a world-layer event that books damage into several ledgers (no parry/posture interaction).
- **Fairness at the seams:** two streams on one creature can hit two players on the same tick; at siege scale that is the normal case, so every outcome needs the server arbiter, not just loot.
- **Rollback/verify:** per-stream replays stay exact, but anything that crosses streams (area damage, a man leaving one pairing for another) is not in any record and needs its own server log.
Verdict: (a) at scale is a good first siege (many duels plus world-layer area events); real formations need (c) and its own RV, specified when the pillar names a feature that requires a fighter to see two foes.
