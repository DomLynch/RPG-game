// The presence `announce` frame's text, as rows (origins/presence/announce-rows.json; docs/specs/origins/pit-live-zone.md, the boss shout). The server sends the frame and only the server: a client
// cannot name an announcement (a text frame other than a warp closes its socket), and a caller of the internal route names a ROW ID, never text. Pure; the table is checked once at load.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DEFS from './announce-rows.json' with { type: 'json' };
import MANIFEST from './announce-rows.manifest.json' with { type: 'json' };
import { presenceRule } from './presence-rules.ts';

export type AnnounceRow = { readonly id: string; readonly text: string };
/** The loader: rows keyed by id (a duplicate id or a missing or mistyped field is refused); a text is one line, not empty, at most `announceMaxChars` (a presence rule). */
export function loadAnnounce(raw: { rows?: readonly unknown[] }): ReadonlyMap<string, string> {
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'announce-rows.json')]);
  const out = new Map<string, string>(), max = presenceRule('announceMaxChars');
  for (const r of (raw.rows ?? []) as readonly AnnounceRow[]) {
    if (r.text.trim() === '' || /[\r\n]/.test(r.text)) throw Error(`announce-rows "${r.id}": the text is one non-empty line`);
    if (r.text.length > max) throw Error(`announce-rows "${r.id}": the text is at most ${max} characters (announceMaxChars)`);
    out.set(r.id, r.text);
  }
  return out;
}
const TEXTS = loadAnnounce(DEFS);
/** The text of an announce row, or null for an id the table does not hold. */
export const announceText = (id: string): string | null => TEXTS.get(id) ?? null;
export const announceIds = (): string[] => [...TEXTS.keys()];
