// The writer's `resolve` for encounter_start: Expansion's fightSetup (origins/encounters) reduced to what the server holds and re-simulates. The foe, level, pool and twist flags come from the
// loaded Region 1 content, never from the client. No mob layer and no shared creature instance yet (Combat's layer ids and the pool arbiter are not on trunk): both stay null.
import { legendBoss } from '../boss/legend-boss.ts';
import { fightSetup, loadEncounterContent } from '../encounters/encounters.ts';
import { legendOfFight } from './grimoire.ts';
import type { Resolved } from './encounter.ts';

export function resolveFromRegion1(): (who: { account: string; character: string }, encounter: string) => Resolved | null {
  const content = loadEncounterContent();
  if (!content.ok) throw new Error(`encounter content does not load: ${content.issues.map((i) => i.message).join('; ')}`);   // the writer does not start with the flag on
  return (_who, encounter) => {
    // A legend boss (`boss:<legend>`, the fight id the grimoire grants a spell on): its family's body at its rank's top level, no twist flags and no health bar. Only a legend with a spell row resolves.
    const legend = legendOfFight(encounter), boss = legend === null ? null : legendBoss(legend);
    if (boss) return { enemy: boss.enemy, level: boss.level, bar: null, flags: [], layer: null, instance: null };
    const setup = fightSetup(encounter, content.value);
    if (!setup.ok) return null;
    const { opponent, combatFlags } = setup.value;
    return { enemy: opponent.body, level: opponent.level, bar: combatFlags.some((f) => f.kind === 'one-health-bar') ? setup.value.bar : null, flags: combatFlags, layer: null, instance: null };
  };
}
