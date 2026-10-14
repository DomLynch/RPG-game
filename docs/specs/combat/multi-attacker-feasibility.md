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

## Update 2026-10-14: the same questions read against trunk (WSV 37 / RV 62)

Lead asked for the PvP flag, the 50/25/10 anti-gank shares and loot-to-most-damage costed against what trunk now does. **Dom's 2026-10-07 ruling still stands and answers the first two:** PvP is always a duel and the shares are dropped. What changed since 10-07 is that more of option (a) exists than the text above says. Facts read on trunk (file:line):

- **PvP is one-on-one by construction.** `Fighter.pvp` is set by the server each step; two players fight only if both are attackable, neither is shielded and they are within `MAX_LEVEL_GAP` (`src/fight/world.ts:36`, `:131-132`). Bouts are pairs and each player enters `inFight` once (`world.ts:158-163`), so a third player can never join a bout between two others. The one-way 10-level band is still a TODO test (`tests/world-rules.test.ts` neighbours; the PvP band test is the known todo in the suite).
- **Many creatures on one player works, capped at three.** `MAX_ATTACKERS` is the `maxAttackers` world-rules row (3): the nearest creature is his foe, the rest are joiners running their own ordinary duel against the same player (his health and posture carry through the world `Fighter`; his blows go to his foe only) (`world.ts:178-212`). A fourth holds off at the ring.
- **Option (a)'s pool is built but not wired into the world.** RV39 shared creature health: `pack.ts` `startStreams` / `groupKill` (`pack.ts:81`, `:113`), `Duel.incoming` (`duel.ts:609`), and `src/group-verify.ts`, which cross-checks every stream's record against its siblings and pays "on proven shares only". `groupKill` is the last hit (ties by join index), and each stream's `log.dealt` is already a per-attacker damage ledger. Nothing in the open-world loop calls `startStreams`: in the world a creature fights exactly one player (the `foes` / `claimed` sets, `world.ts:166-176`).
- **Loot today is the first valid kill report.** The writer's engage token is one per instance per account, at most four open per account; `kill_report {token, hits}` consumes it and pays CP, loot and bronze rolled server-side (`origins/server/world-spawns.ts:4-6`). A second account's report on a spawn already dead gets 409. Hit counts are client-reported, not a verified ledger.
- **Token cost:** the preview keeps `MAX_ATTACKERS` of the four open tokens free for creatures fighting the hero (`origins/preview/engage-ahead.ts`); a bout's roll seed is `hash32(engage token, join step)`.

### Costs, per question
| Question | Sim | Record / replay | RV / WSV | Phone |
|---|---|---|---|---|
| PvP flag, strict duel (ruled) | none | none | none | none |
| 50/25/10 shares | **dropped by ruling.** If ever revived: one per-mille damage delta by join rank (the `stanced` shape) in `duel.ts` | joins must carry rank; the defender's inputs must reach every joiner's replay (not true today) | RV bump + WSV bump | every client steps the defender; needs multi-human lockstep, which the world does not do (not traced here: unverified) |
| Loot to most damage (PvE, shared creature) | none: argmax over `log.dealt` sums, which `group-verify` already derives | none new: `RecordGroup` exists from RV39 | WSV bump to wire the pool into `world.ts` (world digest); likely no RV | each phone sims its own stream and gets one damage sum per tick (the RV39 design, one tick of latency) |

The bigger piece is the server: `kill_report` must become a *group settle* ("settle once, pay by proven share") instead of "first report wins, the second gets 409". That is Backend's, not Combat's.

### Donor precedent (read, reuse-first)
- **ModernUO (Ultima Online):** `BaseCreature.GetLootingRights(DamageEntries, HitsMax)` (`Projects/UOContent/Mobiles/BaseCreature.cs:3344`) ranks looting rights from a per-creature *damage ledger*, summing damage by the responsible player (pets and summons roll up to their master) and crediting only player-flagged damagers. This is the "loot to most damage" model, and it says to keep a ledger on the creature, never trust the kill blow.
- **AzerothCore (WoW):** `Creature::SetLootRecipient` (`src/server/game/Entities/Creature/Creature.cpp:1324`) is the other model: the first player or group to damage the creature *taps* it and owns the loot right. Trivial and deterministic, prevents kill-stealing, but rewards the first hit, not the work.
- **Anti-gank shares:** I found no donor that scales damage by attacker rank. UO answers gank with notoriety and guards, WoW with the PvP flag and level-banded zones. So 50/25/10 has no precedent I can cite, which is one more reason the ruling to drop it is sound.

### Recommendation (unchanged in direction, sharper in detail)
1. **PvP stays a strict duel with the gauntlet queue** (Dom's ruling). Nothing to build for the flag; the open items are the one-way level band (a TODO test) and the chase-after-the-bout case.
2. **If shared PvE kills are wanted, build option (a) as the damage-ledger piece:** wire one creature group into `world.ts` behind a row, pay by `log.dealt` argmax with a minimum-share floor (UO ignores tiny contributions; this stops tap-and-run), and make `kill_report` a group settle. Order: after packs. Cost: a WSV bump, likely no RV, Backend's settle change.
3. **Between tap and most-damage:** the tap (AzerothCore) is cheapest and most predictable; the verified ledger makes most-damage almost as cheap and fairer. Recommend most-damage with the floor.
4. **Not built from this note alone:** it is a ruling input for Strategy and Dom.

**Not verified here:** the multi-human netcode topology (who steps the world and how remote inputs reach it), whether PvP bouts are record-verified at all, and Backend's settle rules for a shared kill. Each can move the costs in the table; they come from the sim and verifier code only.
