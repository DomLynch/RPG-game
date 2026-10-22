// The zone pages a release row must open (scripts/zone-pages-check.mjs), read from the zone registry's rows and nothing else: origins/zone-rows/zone<N>.row.json (the same files scripts/gen-zones.mjs turns into the
// registry). A zone is a row, so a new zone is on the list the moment its row exists; no zone id, name or alias is written here. Pure but for reading the rows' folder.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Not scripts/gen-zones.mjs: its source holds import-shaped template strings, which the release placement (vps-receipts.mjs sourceWithImports) follows to files that do not exist and then files this row Mac-only. The naming rule is the same one.
export const ROWS_DIR = fileURLToPath(new URL('../../origins/zone-rows/', import.meta.url));
/** The zone rows under `dir` by number: zone<N>.row.json, N a number without a leading zero ("0" is the town). Any other .row.json name is an error, never skipped. */
export function zoneRows(dir = ROWS_DIR) {
  return readdirSync(dir).filter((f) => f.endsWith('.row.json')).map((file) => {
    const m = /^zone(0|[1-9][0-9]*)\.row\.json$/.exec(file);
    if (!m) throw new Error(`${file} is not a zone row name (zone<N>.row.json, N a number without a leading zero; 0 itself is the town)`);
    return { file, id: m[1], n: Number(m[1]) };
  }).sort((a, b) => a.n - b.n);
}

/** One entry per zone row: its id, display name, whether it is unlisted, and the short addresses that open its page: `/zone<N>/` (the same for every row) and `/<alias>/` when the row names an alias. Zone-number order. */
export function zonePages(dir = ROWS_DIR) {
  return zoneRows(dir).map(({ file, id }) => {
    const row = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    if (typeof row.name !== 'string' || !row.name.trim()) throw new Error(`${file}: a zone row has a display name`);
    if (row.alias !== undefined && !/^[a-z][a-z0-9]*$/.test(row.alias)) throw new Error(`${file}: alias "${row.alias}" is not a short link name (lower-case letters and digits)`);
    return { id, name: row.name, unlisted: row.unlisted === true, paths: [`/zone${id}/`, ...(row.alias ? [`/${row.alias}/`] : [])] };
  });
}

/** The pages to open: every listed zone's, or every zone's with `all` (an unlisted zone opens only on a build made with VITE_UNLISTED_ZONES=1). */
export const pagesToOpen = (zones, all = false) => zones.filter((z) => all || !z.unlisted).flatMap((z) => z.paths.map((path) => ({ id: z.id, name: z.name, path })));

/** The tab title a zone's page sets from its row (origins/preview/main.ts: `Frankendom — <zone name>`). */
export const titleOf = (name) => `Frankendom — ${name}`;

/** The short addresses a static server must answer with the built page (the nginx rule's job on the live box): every zone's `paths`. */
export const shortPaths = (zones) => zones.flatMap((z) => z.paths);
