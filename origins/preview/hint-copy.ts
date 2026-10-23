// The first-load hint box (Dom 2026-10-22: the town told the player to "walk up to a creature and tap STRIKE", and the box sat over a sixth of the view until a thumb moved). Its words are chosen by a TRAIT of the
// zone, derived from the zone's own rows (does it spawn anything?), never by a zone id; a zone's own override row (legend-copy.json zoneHints, via zoneHint) wins; the words and the dismiss time are rows
// (hint-copy.json). Pure.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/index.ts';
import COPY from './hint-copy.json' with { type: 'json' };
import MANIFEST from './hint-copy.manifest.json' with { type: 'json' };
import { zoneHint } from './legend-copy.ts';

const [TRAIT_MANIFEST, TIMING_MANIFEST] = MANIFEST.tables as unknown as Manifest[];
const TRAITS = tableFromFile(TRAIT_MANIFEST!, COPY, 'hint-copy.json'), TIMING = tableFromFile(TIMING_MANIFEST!, COPY, 'hint-copy.json');
loadRegistry([TRAITS, TIMING]);
const BY_TRAIT = new Map(TRAITS.rows.map((r) => [r.id as string, r as unknown as { walk: string; watch: string }]));

/** What a zone is, for its hint: from its spawn rows. */
export const hintTrait = (zone: { readonly spawns: { readonly rows: readonly unknown[] } }): 'creatures' | 'noCreatures' => (zone.spawns.rows.length > 0 ? 'creatures' : 'noCreatures');

/** The hint line (`walk` after the walk's kit has loaded, `watch` on arrival) for a zone: its own override row, else the line for its trait. */
export function hintLine(zoneId: string, zone: { readonly spawns: { readonly rows: readonly unknown[] } }, which: 'walk' | 'watch'): string {
  const own = zoneHint(zoneId, which); if (own !== undefined) return own;
  const row = BY_TRAIT.get(hintTrait(zone)); if (!row) throw Error(`hint-copy.json: no trait row for "${hintTrait(zone)}"`);
  return row[which];
}

/** Seconds the hint stays up with no thumb moved (hint-copy.json timing.hint.dismissSec). */
export const hintDismissSec = (): number => { const r = TIMING.rows.find((x) => x.id === 'hint'); if (!r) throw Error('hint-copy.json: no timing row "hint"'); return r.dismissSec as number; };
