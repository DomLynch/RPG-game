# Creature movement in melee: what 30 donor games do (2026-10-17, sandbox lane)

## Two-column summary for the rows (stop distance and turn cap, as the donors state them; a dash = not found)

| Donor | Stops at (share of melee reach) | Turn cap |
|---|---|---|
| World of Claudecraft | 80% (4 of 5 yd) | facing set straight at the target (none) |
| AzerothCore | 100% (max range = melee reach, contact 0.5 yd) | none (SetFacing) |
| TrinityCore | 100% of reach (pets: behind +-45 deg) | none |
| EQEmu | 100% (RunTo, FaceTarget) | ~214 deg/s walking, running instant |
| AC Emulator | 0.75 m melee range | per-creature, from its motion table |
| ModernUO | 1 tile | - |
| OpenDAoC | follow min 37.5% of melee range | - |
| Daggerfall Unity | back off under 1.7 m, pursue beyond 2.75 x that (hysteresis) | ~320 deg/s (20 deg per 0.0625 s) |
| Quake 2 | melee-class range | 100-200 deg/s (yaw_speed 10-20 per 0.1 s) |
| DOOM | melee range | 45 deg per tic (snapped, 8 directions) |
| dhewm3 | attack cone 70 deg | 360 deg/s (per monster) |
| Warcraft Arena Unity | - | 180 deg/s moving, 360 charging |
| L2J Unity client / shnok | - | eased, time constant ~0.1-0.2 s (dt x 5-10) |
| knight-duel | per-style engage/retreat pair (hysteresis) | - |

Strategy's ruled rows (2026-10-17): circleChance 0, stopAtReach 0.85 with a 0.8/1.1 hysteresis band, turnRateCap 180 deg/s with lunges exempt, circleRedecide 2-4 s plus strafeSpeedCap only where circleChance > 0, maxAttackers 3.

Why: Dom reports world creatures move like a twitch FPS on a phone (the salamander is right then left in under a second). Our engine (src/fight/ai.ts) picks mode `circle` with a random side and re-decides every 36-81 ticks, so a creature flips direction about once a second; headless probe (`scripts/probe-world-creature-motion.ts`, branch `sandbox/creature-motion-probe`): sweep around the hero avg 6-28 deg/s, max 61-73 deg/s, direction flips 0.16-0.41 per second, speed bursts to 6 m/s, facing snaps up to 180 degrees in one 30 Hz step.

Read from the code on the VPS (/mnt/frankendom-donors), not from memory; a dash means not found. Licence matters for reuse: copy code only from MIT/CC0/Apache; everything else is design reference.

| Game | Where | In melee range | Numbers | Attackers at once | Band | Licence |
|---|---|---|---|---|---|---|
| World of Claudecraft | src/sim/mob_combat.ts:17-24 | closes to 80% of reach, then stands; never strafes | 20 ticks/s, reach 5 yd | none | stop 4 yd, reach 5 | MIT |
| AzerothCore | Movement/MovementGenerators/TargetedMovementGenerator.cpp:276-384 | moves to melee range, stops, SetFacing(target); leads a moving target by half its speed | re-check 400 ms | none | contact 0.5, melee 5 yd | GPL |
| TrinityCore | ChaseMovementGenerator.cpp:127-160 | faces target; pets keep ChaseAngle(pi, pi/4) behind | range check 100 ms | none | pet band +-45 deg | GPL |
| cmangos classic | TargetedMovementGenerator.cpp:202,242 | chase, re-check | 250 ms | none | not read | GPL |
| EQEmu | zone/mob_movement_manager.cpp:45-118, mob_ai.cpp:1341 | RunTo(target), FaceTarget when rooted, no flanking | turn 16*19 = 304 units/s of 512 = ~214 deg/s walking, running instant; AI 50 ms, move 100 ms | none | - | GPL-3 |
| AC Emulator | Monster_Navigation.cs:28-110 | chase, melee 0.75 m, re-path every 2-4 s | tick 0.2 s; turn delay from the creature's motion table | none | stop 0.75 m | GPL |
| ModernUO | AI/MeleeAI.cs:53-58 | MoveTo(combatant, RangeFight) and stand | 0.25-0.5 s per tile | none | 1 tile | GPL |
| 2004Scape | engine/entity/Npc.ts:858-870 | one tile per 0.6 s, stops inside attackrange | 600 ms tick | 1 per target in combat | attackrange (data) | MIT |
| Open-RSC | NpcBehavior.java:44,215,285 | walks, stops; will not attack a target already in combat | 640 ms tick | 1:1 | adjacent | GPL |
| OpenDAoC | GameNPC.cs:782, NpcMovementComponent.cs:630 | Follow(target, min 37.5% of melee range) | - | none found | 0.375 x melee | GPL |
| rAthena | map/mob.cpp:2139-2155 | stops (USW_FIXPOS), attacks per attack delay | AI 100 ms | none | weapon range | GPL |
| SWGEmu Core3 | AiAgentImplementation.cpp:3010 | behaviour interval 400 ms in combat; direction snaps only over 0.05 rad | 400/700/1000 ms | none | - | GPL |
| L2J Unity client (gawric) | CombatFacingService.cs:38,239 | client eases facing: Slerp(dt x 10) in combat, dt x 5 otherwise (time constant 0.1-0.2 s) | - | - | - | Apache-2.0 |
| Warcraft Arena Unity | MovementUtils.cs:29 | boss turn cap | 180 deg/s moving, 360 charging | - | - | public domain |
| Daggerfall Unity | EnemyMotor.cs:639-648,1316-1350 | stands and faces; strafes only in 'enhanced AI': every 1-2 s a 25% roll, random side | 0.2-0.8 s reaction delay before each state change; turn 20 deg per 0.0625 s = ~320 deg/s | none | back off under 1.7 m, pursue beyond 2.75x | MIT |
| OpenMW | mwmechanics/aicombat.cpp:567-590, :504 | stands; short dodge 0.1-0.2 s with 25% chance when in weapon range; smoothTurn, 3 deg tolerance | - | none | weapon reach | GPL-3 |
| OpenGothic | common/game/fightalgo.cpp:39,125 | fight moves from script tables; strafe is one pick among run/back-jump/parry/wait/attack, 50/50 side | timings in script data | none in code | in data | MIT |
| Quake 2 | game/g_ai.c:643-690, m_move.c:305 | ground melee turn in place and swing; only flyers slide (30%) | yaw_speed 10-20 deg per 0.1 s = 100-200 deg/s; melee chance 20%/think; swing cooldown 0-2 s | none | melee/near/mid/far classes | GPL-2 |
| DOOM | p_enemy.c:356,700-770 | stand and attack; chase in 8 fixed directions | new direction every 0-15 tics (<= 0.43 s); never attacks twice in a row | none | - | GPL-2 |
| Barony | monster.hpp:731, actmonster.cpp:6403-6650 | melee closes and stands; only ranged/retreating strafe | swing every 45 ticks (~0.9 s); a strafe is held until a 1-in-10 roll each 10 ticks (~2 s) | none found (no attack-slot ring found) | ranged backs up at 64-100 units | no top-level licence |
| Veloren | server/agent/src/attack.rs:7891-7960 | default melee zeroes movement and attacks inside 60 deg and range; one orbit handler rotates 90 deg | orbit direction re-rolled every random 0-5 s (mean 2.5 s), only inside 3 m; neighbours pushed apart inside 10 m | none found (no token found) | closes to 3 m | GPL-3 |
| dhewm3 | neo/game/ai/AI.cpp:297,738,4105 | turns to face, attacks inside a 70 deg cone | turn_rate 360 deg/s default, per monster | none | - | GPL-3 |
| Half-Life / Source SDK | dlls/squadmonster.h:26-47, ai_squadslot.h:16 | squad slots | 2 attack slots, 1-2 chase slots; fast zombie melee cooldown 0.5 s | **2 attack, 1-2 chase** | - | Valve SDK licences |
| OpenEnroth | Actor.cpp:1011-1078 | stops dead, snaps to face, swings | recoveryTime stat; pursuit every 64 ticks | none | - | LGPL-3 |
| DevilutionX | Source/monster.cpp:2079-2142 | adjacent: attacks or waits | attack chance 2*int+20 %, else waits 2*(5-int)+rand(0..9) ticks | none | adjacent (<2) | source-available, not open |
| flare-engine | src/EntityBehavior.cpp:154-322 | no strafing | turn_delay, flee/pursue chance are data rows; global action cooldown | none | threat_range, flee_range (data) | GPL-3 |
| knight-duel (browser) | src/main.ts:74-96,1661-1760 | 4 of 6 AI styles never strafe; others a continuous sine sway | period ~3.5 s, half force, only inside 4.5 body lengths; swing timer 1.1-1.9 s | 1 opponent | engage/retreat pair per style (hysteresis) | GPL-3 |

## What the evidence says
1. No server-side mob AI read strafes or circles a player in melee. They close to a stop distance (about 80-100% of reach), stand, face and swing. Strafing exists only as a rare, short, optional behaviour (Daggerfall 25% rolls, OpenMW 0.1-0.2 s dodge, Barony ranged, Veloren orbit inside 3 m).
2. Where there is a sideways move it is held for 2-3.5 s or more, never flipped about once a second.
3. Turn is capped or eased: EQEmu ~214 deg/s, Daggerfall ~320, Quake 2 100-200, dhewm3 360, Warcraft Arena 180; clients ease with time constants of 0.1-0.2 s.
4. Attackers at once: only the Half-Life/Source squad slots cap it (2 attack, 1-2 chase) and the RuneScape family locks 1:1. Barony's attack-slot ring, Veloren's token and Gothic's semicircle were not found in the code read.

## Proposal for rows (Combat's call)
Per archetype: circle re-decide interval (world creatures 2-4 s, duel keeps its own), turn-rate cap deg/s (about 120 for world creatures), strafe-speed cap m/s, and `stand and face` as the default inside reach (stop at about 0.8 of reach, band to avoid a twitch at one boundary: Daggerfall 1.7 m / 2.75x).
