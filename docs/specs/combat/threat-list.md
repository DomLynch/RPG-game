# Threat list for N attackers (seamless step 5) — design note, Combat, 2026-10-08

Status: design only, no code. For Backend (loot/verify) and World (aggro/leash). Donor: **AzerothCore** `src/server/game/Combat/ThreatManager.{h,cpp}` (AddThreat, ReselectVictim, taunt/fixate, online states) and `CombatManager` (SetInCombatWith). Taken: the *shape* (one list per creature, damage adds threat, target switches only past a hysteresis margin, a cap on the list). Not taken: spell schools, threat modifiers, redirects, the 1 s update timer (our sim ticks are the clock). Clean-room rewrite in TS; no code copied.

## What the donor does (read this turn)
- Each creature owns a list of `ThreatReference {victim, amount, onlineState, tauntState}`. `AddThreat(target, amount)` on every damage event.
- Current victim changes only when another entry beats it by **110 %** (melee) or **130 %** (ranged); between 110 and 130 a melee entry still wins. That hysteresis is what stops a creature ping-ponging between two players.
- States: ONLINE / SUPPRESSED (immune, CC'd: usable but disfavoured) / OFFLINE (dead, out of reach, evading). A fixate or taunt overrides the sort.
- `SetInCombatWith` is the symmetrical "engaged set": entering combat adds both sides to each other's lists.

## Frankendom mapping
1. **Engaged set (World).** A creature's list holds every player fighter inside its aggro radius that is flagged attackable (PvP flag rules unchanged). Join on first hostile act or on entering aggro; drop on death, on leaving the leash, or on the creature evading. **v1 (World, origins/preview/mobs.ts):** creatures do not chase, so there is no real leash; the drop is the existing aggro exit (hero beyond `aggro` + `TUNING.hold`), which for one local hero equals evade. Join is the aggro-mode flip or the player's `engage()` tap (Backend's #1813 keeps cap 7 and engage order); a hit by another player joins only once the sim carries it. A real leash waits for chasing creatures. **List cap 7** (Lead's number); an 8th joiner is ignored until a slot frees. Order of joining is kept: the anti-gank scale below reads it.
2. **Threat = damage.** `AddThreat(attacker, hitDamage)` from the sim's `Hit` events (heal/support threat later). No other source in v1; a taunt/fixate is a later row.
3. **Target choice.** The creature fights **one** attacker at a time (the sim is a two-fighter duel). It keeps its current target until another entry exceeds it by **110 %**; casters use 130 % (they have no melee entries to prefer). Ties go to the earlier joiner. SUPPRESSED (an attacker mid-roll invulnerability, stunned, or fled out of reach for <2 s) is skipped when an ONLINE entry exists.
4. **The others wait.** Non-target attackers are *queued attackers*, not idle spectators: they may hit the creature (that is what feeds threat) but only the target's duel is stepped by the sim. Mechanism is the open feasibility choice from the TOP10 row 2 note — (a) second parallel 1v1 stream sharing the foe's health, (b) disengage, (c) true multi-foe step. This note fixes only the *rules around* that choice, so any of the three can implement it.
5. **Attack-token cap** 3-4 concurrent hitters, from the earlier pack design, applies to *creatures* attacking one player, the mirror of the list cap.

## Anti-gank and loot (Backend)
- Reward share per attacker = their damage / creature max health. Anti-gank multiplier by **join order**: 1st attacker 1.0, 2nd .5, 3rd .25, 4th and later .1 (Dom via Strategy). Loot goes to the **most damage dealer**; ties to the earlier joiner.
- The verifier needs, per creature kill: the attacker ids in join order and each one's damage. Both are derivable from the replay events plus the record header's attacker list (the RV-class bump from the pack row; not this note). Until then N-attacker fights are never awarded.

## Determinism
The list lives *outside* the duel state, in the pack layer (`src/pack.ts`, outside SIM_FILES like `src/mobkit.ts`): a pure function of the tick-ordered event stream, ties by join order then fighter id, no RNG. Absent list (one attacker) = today's 1v1 fight byte for byte.

## Open questions
- Which of (a)/(b)/(c) for rule 4 (needs the Auditor and Lead; (a) is my pick: smallest sim change, shared foe health).
- 110 % vs a flat margin: with our damage scale a heavy hit is ~30 % of health, so 110 % flips targets after one exchange; may need an absolute floor (e.g. +10 % of max health). Tune with the 2-v-1 slice battery.
- Should a roll/backstep make an attacker SUPPRESSED? Probably not (it is a normal fight move); only stun/fled/dead.
