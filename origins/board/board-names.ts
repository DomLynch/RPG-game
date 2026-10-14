// The names the board screen reads aloud, from the content that already holds them: the Region 1 registry (characters and items), the catalogue (a ladder family is an opponent row) and the zone rows (a zone's own name).
import { catalogueRow } from '../../src/fight/index.ts';
import { loadEncounterContent } from '../encounters/encounters.ts';
import { loadZone } from '../zones/loader.ts';
import type { Namer } from './board-view.ts';

// A discovery row names its zone as `zone<N>`; the zone loader is keyed by the bare N.
const zoneKey = (id: string): string => id.replace(/^zone/, '');
export function boardNamer(): Namer {
  const content = loadEncounterContent(), registry = content.ok ? content.value.region.registry : null;
  return {
    character: (id) => registry?.characters.get(id as never)?.name ?? id,
    item: (id) => registry?.items.get(id as never)?.name ?? id,
    family: (id) => catalogueRow(id)?.name ?? id,
    zone: (id) => loadZone(zoneKey(id)).name,
  };
}
