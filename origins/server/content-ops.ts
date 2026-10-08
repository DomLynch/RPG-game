// The writer's item ops (consume, apply_upgrade) from the loaded content. The entry point (scripts/origins-writer.mjs) loads Region 1 once and passes `itemOps` in; nothing here reads the
// env or a file. Item definitions are Region 1's registry (lookupOf, origins/encounters). The smith is DATA, never invented here: it is the first service-definition of kind 'upgrade'
// whose cost table is in the registry; Region 1 ships none today, so apply_upgrade answers 501 "there is no smith in this content" until a service and its cost table are authored, and
// then it just works. `consume` needs only the item definitions.
import type { Result } from '../contracts/core.ts';
import { lookupOf, type EncounterContent } from '../encounters/encounters.ts';
import type { Content } from './holdings.ts';
import { handlers, withContent, type Handler } from './handlers.ts';
import { REGION1_SHOPS } from '../region1/shops.ts';
import { REGION1_NPCS } from '../region1/npcs.ts';
import { shopCounters } from '../npcs/row.ts';

export function itemContent(content: EncounterContent): Content {
  const { services, costTables } = content.region.registry;
  const service = [...services.values()].filter((s) => s.service === 'upgrade' && costTables.has(s.costTable)).sort((a, b) => (a.id < b.id ? -1 : 1))[0];
  return { lookup: lookupOf(content), shops: REGION1_SHOPS, counters: shopCounters(REGION1_NPCS), ...(service ? { smith: { service, costs: costTables.get(service.costTable)! } } : {}) };
}

// `content` is the Result of loadEncounterContent(). One that does not load leaves the writer on its base ops (the item ops are then absent, as before): a content problem must not take
// the whole writer down, and `warn` says so.
export function itemOps(loaded: Result<EncounterContent>, warn: (message: string) => void = console.warn): Record<string, Handler> {
  if (!loaded.ok) { warn(`origins-writer: Region 1 content does not load (${loaded.issues.map((i) => i.message).join('; ')}): consume and apply_upgrade are not served`); return handlers; }
  return withContent(itemContent(loaded.value));
}
