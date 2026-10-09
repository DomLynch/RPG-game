# Creature targeting and threat: EQEmu and rathena (Proof 3 donor read)

Combat lane, 2026-10-09. Both are GPL-3.0 (`LICENSE.md` in each repo): SHAPE ONLY, no code copied. Read at `/mnt/frankendom-donors`.

## EQEmu hate list (`zone/hate_list.cpp`)
- **Per creature, one list** of `{ entity, hatelist_damage, stored_hate_amount, last_modified, oor_count }`. Damage and hate are separate numbers: hate picks the target, damage picks who gets credit (`GetDamageTopOnHateList`, `:107`).
- **Add** (`AddEntToHateList :205`): refuses a corpse or a dead client; an existing entry accumulates, a new one is appended and fires the one "hate list changed" event (`EVENT_HATE_LIST`, "1" on enter, "0" on leave). That is the donor shape for our single fight-started event.
- **Pick** (`GetMobWithMostHateOnList :348`): scan, skip the excluded and the unattackable (mezzed, sanctuary, divine aura rank below any live target), take the highest hate; ties and in-range preference are rule flags (`SmartAggroList`).
- **Forget** (`RemoveStaleEntries :854`): an entry goes after `time_ms` untouched, or after being out of range on TWO consecutive sweeps (`oor_count == 2`; one sweep of range is forgiven, the counter resets when back in range).
- **Take:** a small per-creature list with two numbers per attacker (threat, damage), a top-threat pick, an add event fired once on first entry, stale and out-of-range pruning with a two-strike counter. **Not:** frenzy flags, mez/feign rules, faction hits, spell AoE walks.

## rathena mob AI (`src/map/mob.cpp`)
- **One target id per mob** (`target_id`) plus `attacked_id` (last attacker); the 100 ms think (`MIN_MOBTHINKTIME`) validates the target, then considers a switch.
- **Switch gate** (`mob_can_changetarget :1229`): a state switch (idle/follow/angry may change; berserk only if the mob can and was hit by a normal attack; rush only if it chases). So a mob mid-attack does not flip to every poke.
- **Hit-back** (`mob_ai_sub_hard :1930-1990`): the attacker becomes the target if it is an enemy, in the visual area and reachable; if it cannot be reached the mob counts "rude attacked" strikes and uses a skill after a threshold instead of switching.
- **Active search** (`mob_ai_sub_hard_activesearch :1314`) picks the first attackable thing in the aggro area when it has none; `changechase :1369` retargets only to something already in melee range.
- **Take (shape; of these only the one-current-target + stickiness is built):** one current target, a state-gated switch rule (do not flip mid-swing; NOT built), "attacker in range wins when idle" (NOT built), a give-up counter for an unreachable attacker (NOT built; the unseen clock covers a player who leaves). **Not:** the skill-state machine, loot/slave/link targeting.

## What this means for Frankendom (Proof 3)
1. Creature-initiated: when the creature decides to engage (aggro ring, or hit by a player), it sets its target; the FIRST swing/hit that connects the pair emits ONE `FightStarted` (creature, player) event. The fight itself still runs on the existing per-pair bout; nothing is built at engage.
2. Threat list on the creature: `{ id, threat, damage, last }`; target = top threat inside leash; stale after N s or two out-of-range sweeps. Damage field decides loot/credit (Dom: most damage), threat decides who it swings at. Anti-gank multipliers (.5/.25/.1 for 2nd/3rd/4th+) apply to the damage share, as agreed on #1814.
3. NOT BUILT (struck after the Auditor's LOW on #1940): rathena's state-gated switch (a mid-attack mob does not flip target). What exists is only stickiness: a creature keeps the player it is fighting while he stays inside ENGAGE_OUT_M and picks by threat only among free players, so it never flips mid-fight today. A real gate comes with last-hit retarget, which Lead ruled is not needed for Proof 3.
