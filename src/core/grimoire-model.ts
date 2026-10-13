// What the spell book lists, as data: pure, no DOM, no network. A book entry is the server's { legend, bricks }; the catalogue (spell-catalogue.ts, lazy) gives it a name, a family and a spell name.
import type { Bricks, Spell } from './grimoire-net.ts';

export type SpellInfo = { legend: string; family: string; spell: string; school: string };   // one catalogue row's display fields (spell-catalogue.ts, lazy, fills it)
export type Entry = { legend: string; name: string; family: string; spell: string; school: string; bricks: string[] };
export const EMPTY = 'Beat a legend to take their spell';
const title = (id: string): string => id.replace(/[-_:]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
export const brickLabel = title;
const slug = (v: string): string => v.toLowerCase().replace(/[^a-z0-9]/g, '');
export const bricksOf = (b: Bricks): string[] => [b.root, ...b.modifiers, ...(b.suffix ? [b.suffix] : [])].map(brickLabel);
// A legend that is its own family (most are) shows no "X family" line. An id the catalogue does not know (a legend added server-side first) still shows, by a readable form of its id.
export function entriesOf(book: readonly Spell[], info: Readonly<Record<string, SpellInfo>>): Entry[] {
  return book.map((s) => { const i = info[s.legend]; return { legend: s.legend, name: i?.legend ?? title(s.legend), family: i?.family && slug(i.family) !== slug(i.legend) ? title(i.family) : '', spell: i?.spell ?? '', school: i?.school ? title(i.school) : '', bricks: bricksOf(s.bricks) }; })
    .sort((a, b) => a.name.localeCompare(b.name) || a.legend.localeCompare(b.legend));
}
