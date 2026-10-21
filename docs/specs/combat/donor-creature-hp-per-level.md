# Donor note: how EQEmu and AzerothCore scale creature HP per level (for the post-beta per-level pass)

Combat, 2026-10-21 (Lead's optional donor read; a note only, nothing built, no retune until live world kills exist). Read on the box: `/mnt/frankendom-donors/azerothcore-azerothcore-wotlk`, `/mnt/frankendom-donors/EQEmu`.

## AzerothCore: a shared curve by (level, class), one multiplier per creature
- `creature_classlevelstats(level, class, basehp0, basehp1, basehp2, basemana, basearmor, attackpower, rangedattackpower, damage_base, damage_exp1, damage_exp2, ...)`: one row per (level, class); the three `basehp` columns are the expansion tiers. A creature's template carries its class, `rank` (normal / elite / rare / boss), `HealthModifier`, `minlevel` and `maxlevel`.
- HP = `ceil(BaseHealth[expansion] x ModHealth)` (`CreatureData.h:315`): the curve is shared by every creature of that class; tuning one creature is one multiplier on its template, never a per-level number.
- Level: `Creature::SelectLevel` (`Creature.cpp:1512`) rolls `urand(minlevel, maxlevel)` per spawn, so one template spans a level band and its HP follows the curve.

## EQEmu: a scale table keyed by (type, level, zone, instance), filling only what the NPC left blank
- `npc_scale_global_base` rows are keyed by (scaling `type`, `level`, `zone_id`, `instance_version`) and carry hp, ac, accuracy, slow mitigation, attack, stats, damage, regen (`zone/npc_scale_manager.cpp`, `ScaleNPC`).
- `ScaleNPC` looks up (type, level, zone, instance) and writes a stat only when the NPC row left it at 0 (or `always_scale`): a hand-set `npc_types.hp` always wins. No row for that key: the NPC is left as built.
- The zone and instance keys are the scope: the same creature can be scaled differently in one zone or instance without touching its template.

## What it means for us (suggestion for the post-beta per-level pass, not a plan)
- Today: archetype row (`archetype-defs.json`, the base) + the L1-L46 level blend in `moves.ts opponentAt` (the novice body, anchors at 1 / 6 / 18 / 46) + RV89 `world-level-defs.json` (one (creature, level) override, world only, `worldOpponentAt`).
- AzerothCore's shape would be a HP curve per creature CLASS by level (we have it implicitly in the blend) plus ONE `healthMod` per archetype row; EQEmu's shape is a scope key on the override row: our RV89 world-vs-Pit split is exactly EQEmu's `zone_id`. Neither donor keeps per-(creature, level) hand numbers as the main mechanism: the post-beta pass should move goblin:1 (and any later L1 row) into a class-by-level curve + a per-archetype modifier, and keep a scoped override table only for exceptions.
- Keep from both: a missing row means "use the base", and a hand-set number on the creature wins over the curve (our rows already do).
