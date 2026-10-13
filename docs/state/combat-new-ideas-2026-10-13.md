# New combat-feel ideas (Combat Sandbox, 2026-10-13)

Three readers (Sonnet agents) went through the VPS donor library for ideas NOT already harvested (see combat-research-2026-10-13.md). Code-read items carry file:line; the closed-game list is from memory (unverified). GPL/AGPL = ideas only, no code.

## From fighting engines (Ikemen-GO MIT, OpenBOR MIT, Veloren GPL) — code read
1. Defender-only hit shake: the victim vibrates 1px on odd ticks while the attacker stays still; separate pause per side (ikemen src/char.go:13580, 11702).
2. Shake scaled by the hit (frequency, amplitude, decay, direction) and a second shake when the body lands (ikemen char.go:681-708, system.go:6798-6818).
3. Down-bounce off the floor on heavy knockdowns, once (ikemen data/common1.cns.zss:771-788).
4. Repeat knockdowns: defence x1.5 each, lie-down time halves, invulnerable at <=10 ticks (ikemen char.go:335, 12908-12923).
5. Hit snap: the blow pins the victim at a fixed spot a few ticks (ikemen char.go:11866).
6. Hit spark at the real contact point, rotated and scaled by the hit (ikemen char.go:11285-11380).
7. Victim tint for a few ticks per hit (ikemen char.go:12194).
8. Wounded blink / dying colour by health band (openbor openbor.c:34280).
9. Knocked bodies hit others; landing damage (openbor.c:33080, 38905).
10. Take-off and landing dust per action (openbor.h:3205).
Lower: afterimages (arcade, skip), footwork AI circling/backoff (CPR Circling_Hook.cpp:5), combo counter with decay (Veloren, GPL), knockback direction types (Veloren).

## From MMO/RPG servers — code read
1. Hit height + direction picks one of 12 blood/dust splat variants (ACE Creature_Combat.cs:551-575).
2. Split swing from impact: attacker anim at tick 0, defender flinch ~0.4 s later, damage queued 2 ticks (2004Scape player_melee.rs2:36).
3. Hit reaction by outcome (crit heavy flinch, shield jolt); no flinch while mid-swing; layered upper body (AzerothCore Unit.cpp:2033, OpenMW character.cpp:400-447).
4. Bleed: 5 ticks at 2 s, decaying, drip + grunt each (ModernUO BleedAttack.cs:54-113).
5. Wind-up power bar: power 0..1, damage x0.5..1.5, recovery = power x base, power picks the animation (ACE Player_Combat.cs:374, Player_Melee.cs:366).
6. Crits take max damage (deterministic); a risky mid-bar zone gives bonus dealt and taken (ACE DamageEvent.cs:287, Player_Combat.cs:659).
7. Style chains: follow-up needs a landed styled hit; blocked styled swing costs half stamina (DOLSharp StyleProcessor.cs:84-554).
8. Block cost = weapon weight x swing strength; clang by shield material (OpenMW combat.cpp:111-170).
9. Strikes aimed at a pool: leg -> stamina, head -> third pool, hit-location fly text (SWGEmu CombatManager.cpp:1469-1544).
10. Disarm: weapon drops, 5 s re-equip lock (ModernUO Disarm.cs:49-76).
11. Rage from damage dealt/taken (AzerothCore Unit.cpp:1117).
12. Procs per minute scaled by weapon delay, deterministic accumulator (EQEmu attack.cpp:4874).
13. Mirror-image decoy (ModernUO MirrorImage.cs).
14. Effect packaging: one sprite recoloured per school, child impact on arrival, body anchors (UltimaXNA EffectManager.cs:33-75).

## From closed games (memory, UNVERIFIED)
Directional hit spark/blood plus sand decals; three-layer hit sound (whoosh, material thud, body thump); fixed anticipation tells (heavy 12-24 ticks, light ~8); red perilous-attack warning for unblockable attacks; kill-hit stop; slow-mo on the killing blow only after the result is decided; camera kick along the blow; chamber parry; stamina feints; counter-hit bonus; ki-pulse stamina recovery; execution camera framing; stage hazards.

## Fits Dom's gritty / no-time-effects rules best (my pick order)
Contact-point sparks + hit-direction splats; victim-only shake; sound layering; split swing/impact; knockdown bounce + repeat-knockdown scaling; bleed tick stream; wind-up power bar.
