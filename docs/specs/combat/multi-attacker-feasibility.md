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

## The gauntlet: PvP and packs on today's 1v1 engine (Dom, approved 2026-10-07)
PvP is ALWAYS a Pit duel. Extra attackers (on a player, or a pack on one fighter) wait on the ring and fight ONE AT A TIME, no heal between bouts. The per-attacker multiplier is dropped. Nothing in the sim changes: each bout is an ordinary `Duel`.
What the world layer needs (all outside src/duel.ts):
- **Queue:** an ordered list of attackers per defender, FIFO by arrival; capped (suggest 6, matching the PvP hold cap). A bout ends on a kill, a death or a yield; the next starts after the pack walk-in beat.
- **Carry-over:** defender health is NOT reset between bouts (no heal); stamina and posture recover at normal rates over the walk-in beat only (the ruling already made for packs). A bout therefore starts a `Duel` from a carried `Fighter` (health, wound site, leg wound), the one new constructor input; the record header names the carried state or the replay cannot start (RV, small, only for records that carry a non-fresh fighter).
- **Ring and turn order:** waiting attackers stand on the ring rim, render-only (crowd actors); order is the queue order; the open world never pauses (the encounter path does not call the Pit pause).
- **Arbiter:** the server, the same authority as every world write (encounter token + replay verify per bout). In client-only previews the first claimant hosts. Never a peer client.
- **Loot:** creature kills go to the largest damage-dealt ledger entry (PvE shared pool only, below); a duel kill goes to the killer.
- **Cost:** sim none, record small (carried-state header), phone none (one `Duel` live at a time). Order: with packs (#4); not blocked on anything in the engine.

## Option (a) still applies in one place: a second player joins a PvE creature fight
Parallel 1v1 streams against the same creature, shared creature health, loot to the largest ledger entry, no damage multiplier, the creature's tells go to its aggro target's stream. Server arbitrates the pool. Sim/record none; weakness: the creature can hit two players on one tick (fine for a beast).

## Large-scale battles / sieges: options from cheap to a true engine
**B1. Many concurrent 1v1 duels on one battlefield plus a crowd (M&B / For Honor style).** Each fighter is pinned to one foe at a time (a pairing table owned by the world layer); every pairing is a normal `Duel`; the crowd is render-only actors. The local client steps only its own pairing; others are replayed or interpolated from the server.
- Sim: none. Record: none per duel; a battle log (pairings, area events) is new world data. Replay: each duel exact; cross-pairing events are in the server log only. RV: none for duels. Phone: one `stepDuel` + N cheap crowd actors (budget by culling, the existing crowd cull). Risk: no flanking, no formations; a third man cannot help your duel except by swapping pairings.
**B2. B1 + world-layer area events.** Rams, stones, cleaves that hit several bodies book damage into several ledgers with no parry/posture interaction; a swap rule lets an idle fighter take over a pairing. Sim none. Record: server event log. RV none. Phone: low. Risk: fairness at the seams (two streams hit one creature on one tick), so every outcome goes through the server arbiter.
**B3. B2 + 2v1 pairing in the sim (one fighter sees two foes).** `Duel` gains an optional second foe only for the defender (rear hit from the second man, split attention); everything else stays 1v1. Sim: a large touch in stepDuel (every `1 - i` read), new AI target choice. Record: new intent stream per extra fighter; RV with REACH for every fight that uses it (none of the old ones). Replay: exact if both streams are in the record. Phone: 3 bodies stepped. Risk: SIM_DIGEST re-pin, rollback payload grows, and the pairing code from B1/B2 must be rewritten to allow it.
**B4. True multi-foe engine (N fighters per step, formations, shield walls).** Rewrite of stepDuel and Practice, new record shape, new AI. RV on everything, fixture regen, rollback/verify surface multiplied. Weeks, and phone cost scales with N. Only worth it if the pillar names formations as a core fight.
**Order vs beta:** none of B1-B4 is in the beta. The gauntlet ships first (it is the engine's current shape). B1 is the first siege and needs no engine change, so it can be scoped as a world-lane feature the moment the pillar has a map; B2 follows. Decide B3/B4 only after B1 is played: formations and flanking are the two things B1 cannot do, so a playtest of B1 tells us whether anyone misses them.
