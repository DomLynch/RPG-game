# Tactical bot: debug versus limited observation

Pinned game `976caee2`; both modes used Pitborn and Executioner on Easy, seeds 731, 2230671998 and 2504048581, reaction 180 ms, step 64 ms, no video. Command: `node scripts/player-bot.mjs --strategy=tactical --observation=MODE --opponents=pitborn,executioner --fights=3 --seed=731 --step-ms=64 --no-video --out=artifacts/combat/MODE-compare-3`. Both modes won all six fights; all 12 had Heavy at or below 20%, clean input release and no runner errors. The JSON receipts live in the named artifact directories.

| Opponent · seed | Debug damage taken · Heavy/attacks | Limited damage taken · Heavy/attacks |
| --- | ---: | ---: |
| Pitborn · 731 | 62 · 2/15 | 42 · 1/16 |
| Pitborn · 2230671998 | 21 · 2/12 | 73 · 1/14 |
| Pitborn · 2504048581 | 40 · 2/13 | 115 · 2/14 |
| Executioner · 731 | 11 · 1/12 | 67 · 0/16 |
| Executioner · 2230671998 | 30 · 0/14 | 67 · 0/16 |
| Executioner · 2504048581 | 30 · 0/14 | 38 · 0/17 |

First decisive difference, Pitborn seed 2230671998: debug thrust started at tick 103 and hit for 11 at 119; enemy light began at 133; the bot guarded at 148, parried at 155 and riposted for 24 at 180. Limited mode started a light at 114 and hit for 14 at 134; enemy light began at 135 and hit the player for 21 at 157. The limited bot was committed to its attack near that tell. These are matched seeds, not a frame-identical replay, so the damage difference cannot be attributed solely to delayed observation.

On Executioner seed 2230671998, debug mode saw two `Charged` events and rolled both overheads; limited mode had no `Charged` event in its fight and thus no eligible charged-roll window. Its two uncharged overheads produced one hit and one block. Zero limited rolls here do not prove a late reaction to a charge.

`limitedObservation` delays and rounds gap/radius, and delays opponent phase/state and combat events. It still reads exact current own health, stamina, phase and legal-action availability, current enemy health, and labelled engine events after their delay. It is constrained telemetry, not visual perception. A cautious policy choice under coarse range is the next bot hypothesis to test; the player-facing question is whether a new viewer can name the incoming cut or charge before contact in clean normal-speed footage. No policy or game balance change follows from this small comparison alone.

Tactic opportunity scan over the prior 27 debug fights: 17 player thrusts met an enemy block, but several guards immediately became counters, so a blocked thrust alone is not a safe kick trigger. No enemy guard/parry action appeared inside the first 10 ticks of a player light or first 11 ticks of a player Heavy, so the required early defensive response for a purposeful feint was not observed. One Nightborn thrust hit five ticks after the bot's 11-tick tell reaction; a 12-tick short step has no demonstrated clearance there. A close, sustained guard is the only grounded candidate for a bounded kick test; step and feint remain unproven rather than mandatory move quotas.
