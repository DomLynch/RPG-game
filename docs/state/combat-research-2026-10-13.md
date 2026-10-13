# Combat donor research (Combat Sandbox lane, 2026-10-13)

Readers read the VPS donor library (/mnt/frankendom-donors) for Dom: WoW (AzerothCore, vmangos, cmangos), UO (ModernUO), EverQuest (EQEmu), RuneScape (2004Scape, Open-RSC), SWG (swgemu-Core3, SWG-Source), Veloren, Asheron's Call (ACE), DAoC (OpenDAoC), Lineage 2 (L2Dn), AAEmu, and fighting engines (Ikemen-GO MIT, OpenBOR). Closed games (Sekiro, Souls, For Honor, Mordhau, Tekken, Street Fighter, Mortal Kombat) are from memory, marked unverified. GPL donors: ideas only. Not in the library: Neverwinter Nights, MUGEN, any closed game's code.

## Final top 10 (Dom to rank)
1. Defensive-result follow-ups: DAoC style chains + WoW Revenge/Overpower (5 s window) + EQEmu riposte. After a parry, dodge or perfect block, a named follow-up unlocks (own fixed tell). Have: riposte after parry, 20-tick guard-counter after block. Missing: after dodge/roll.
2. Wounds with costs + battle fatigue: UO Mortal Strike (no heal 6 s), Bleed (5 ticks), Disarm (5 s lock); SWG wounds cut the pool max, fatigue (0-1000) throttles healing/recovery, death leaves +100 wounds, camps heal. Have: stamina-ceiling attrition, leg wound, arm wound (sandbox).
3. Execution via posture break + poise multiplier: Veloren extra poise damage becomes health damage x0.1/0.25/0.5/1.0 by state; Ikemen dizzy once per combo; Sekiro (memory). Have: unparryable critical in the break window, 5 finishers.
4. Armour heavy/medium/light: SWG encumbrance cuts stat maximums, weapon-vs-armour piercing x1.25/step vs x0.5/step; Veloren per-class protection + poise resilience + stamina/stealth; DAoC absorb 0/10/19/27/34; UO strength needs 25/35/60/95; WoW a/(1+a) capped 75%. Have: gear rows.
5. Damage kinds: Veloren slash drains 0.5 x damage stamina, crush adds poise damage, pierce ignores 0.75 of armour. Have: 3 kind rows.
6. Anti-gank: RuneScape single/multi-combat zone flag + 8-tick combat lock; Dom's 50/30 many-on-one rows (no donor has it); For Honor outnumbered buff (memory). Have: pack cap, swarm rows, attackers rows in the sandbox panel.
7. Stuns fade: WoW 100/50/25/immune, reset 15 s; SWG second knockdown within 30 s only stands you up; DAoC NPC duration/(2 x count); Ikemen dizzy once per combo.
8. Positioning: WoW stunned/casting defender has no parry/dodge/block, front arc; DAoC positional bands; L2 back/side bonus; SWG/ACE hit locations (make it deterministic by swing height).
9. Bosses: AAEmu phase-row shape (health range, time range, dice, telegraph delay, max adds), EQEmu rampage (max 3) and enrage, Veloren breath cone with exposure ramp.
10. Spells: WoW pushback 0.5 s x2 and school lockout, DAoC 3 s interrupt, UO armour allowance on casting.

## Rejected
UO Paralyzing Blow (moves timing), percentage dodge/parry rolls (not deterministic), Veloren stun durations (move recovery), parry freeze / hit-stop on live zones (Dom: no time effects), status badge with time ring (Dom: too dated).

## Notes
- Spectacle that rides on top: visible guard shatter (Ikemen guard bar: 1.5 x damage, refill after 60 frames), wall splat (we already have wall impact).
- Art direction: gritty gladiator, muted (see memory).
