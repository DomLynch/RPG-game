// Item display names for the kill toast, from the encounter content's registry. Names only: no loot is rolled and nothing is held here (the server's kill_report pays, origins/server/mob-rewards.ts).
import { loadEncounterContent } from '../encounters/encounters.ts';

export function itemNamer(): (id: string) => string {
  const content = loadEncounterContent();
  return (id) => (content.ok ? content.value.region.registry.items.get(id as never)?.name : undefined) ?? id;
}
