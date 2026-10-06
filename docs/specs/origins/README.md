# Origins specs (clean room, ruling 8)

These behaviour specs are the only material that crosses from the donor-research side into this repository. Analysts wrote them from reading donor engines and emulators (OpenMW, OpenGothic, ModernUO, EQEmu); they hold prose, formulas, constants and hand-derived golden cases, never donor code. Implementers build Frankendom TypeScript from these files alone, modernise freely, and list every deliberate divergence beside their code. Amendments arrive here as new spec revisions after each completeness-audit round.

Round 1, 2026-10-06. Goldens are hand-derived from the source and not yet captured from a running emulator.

| Area | Spec | Feeds |
|---|---|---|
| Frankendom today | [frankendom-baseline.md](frankendom-baseline.md) | O1 contracts: rank, ids, persistence, replay gates |
| Quests | [openmw-quest-journal.md](openmw-quest-journal.md), [modernuo-quests.md](modernuo-quests.md) | O2 quest journal |
| Dialogue | [openmw-dialogue-conditions.md](openmw-dialogue-conditions.md), [gothic-dialogue.md](gothic-dialogue.md) | story module |
| Factions and standing | [openmw-factions-disposition.md](openmw-factions-disposition.md), [gothic-guilds-attitudes.md](gothic-guilds-attitudes.md), [eqemu-faction.md](eqemu-faction.md), [modernuo-virtues.md](modernuo-virtues.md) | story / world |
| NPC routines | [gothic-routines.md](gothic-routines.md) | world module |
| Progression (ruling 7) | [openmw-levelling-skills.md](openmw-levelling-skills.md), [gothic-progression.md](gothic-progression.md), [eqemu-experience.md](eqemu-experience.md), [modernuo-skill-stat-gain.md](modernuo-skill-stat-gain.md) | the one-progression proposal |
| Loot | [eqemu-loot.md](eqemu-loot.md) | O2 staged boss event rewards |
| Items and storage | [eqemu-inventory.md](eqemu-inventory.md), [modernuo-bank.md](modernuo-bank.md), [modernuo-secure-trade.md](modernuo-secure-trade.md) | O2 inventory transfer, O3 Exchange |
| Crafting | [modernuo-crafting.md](modernuo-crafting.md) | O6 |
| Public events | [modernuo-champion-spawns.md](modernuo-champion-spawns.md) | O2 staged boss event |
| Region 1 content (ours, not donor) | [region1-ash-frontier.md](region1-ash-frontier.md) | Ash Frontier zones, chapter one *The Stolen Name* as a Feud (provisional), Bounties, bosses, loot, bundle files |
| Offline formats | [gothic-zenkit-reference.md](gothic-zenkit-reference.md) | tooling reference only |

Fixed spine: Frankendom's damage and weapon rules and gear scoring (Attack/RES caps 1.15 / 0.80, resolved before the fight, timing untouched) are not replaced by any donor rule.
