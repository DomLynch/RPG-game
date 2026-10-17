// The wildlife batch (Dom GO 2026-10-07: beasts first): the quadruped family's kinds as mob rows, held as `later` until their bodies land. A `later` row needs no
// look, source or registered loot table and is never generated (row.ts), so this file ships nothing the player sees. To switch a kind on: Characters lands its
// body and MOB_LOOKS entry (the ash wolf needs Combat's roster row and `bite` weapon too), Content cites it and registers its loot table, and the row loses
// `later`. Ids and bands are placeholders until then: the designs are docs/character-references/mob-families (beast-ash-wolf, beast-boar); the hound is
// named in docs/specs/origins/body-families.md. Beast behaviour is Combat's MOB_STYLE (it fights to the death: creature fleeing was cut by Dom 2026-10-11). Placeholder loot ids are not registered anywhere.
// The rows themselves are data (wildlife-defs.json + manifest, through the registry; Dom's data-layer rule 2026-10-13; tests/content-rows.test.ts pins each to the literal it replaced).
import { loadRegistry, tableFromFile, type Manifest } from '../registry.ts';
import type { MobRow } from './row.ts';
import DEFS from './wildlife-defs.json' with { type: 'json' };
import MANIFEST from './wildlife-defs.manifest.json' with { type: 'json' };

loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, DEFS, 'wildlife-defs.json')]);
export const WILDLIFE_ROWS: readonly MobRow[] = DEFS.mobs as unknown as readonly MobRow[];
