// New zone: `node scripts/new-zone.mjs <N> [--biome ash-wastes] [--name "The Name"] [--from row.json]` writes origins/zone-rows/zone<N>.row.json and NOTHING else (Dom 2026-10-09, plug and play; 2026-10-11 the row IS the zone).
// The registry is generated from the rows (`npm run zones`, which the vite build also runs), so the row is all a zone costs. Without --from the row starts as a skeleton: Zone 2's kit and looks (the node names are that
// kit's contract), no spawns (a zone with no rows is valid) and an empty `world` until its place and world data exist. Level = the zone number (Dom 2026-10-08).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { BIOMES, DEFAULT_BIOME } from '../origins/zones/biomes.ts';
import { zoneFromRow } from '../origins/zones/from-row.ts';
import { zoneProblems } from '../origins/zones/loader.ts';
import { ROWS_DIR } from './gen-zones.mjs';

/** The text of a row file: two-space JSON, so a diff of a row is a diff of its data. */
export const rowText = (row) => `${JSON.stringify(row, null, 2)}\n`;

export function newZone({ n, biome = DEFAULT_BIOME, name = `Zone ${n}`, dir = ROWS_DIR, row = /** @type {Record<string, any> | undefined} */ (undefined) }) {
  if (!Number.isInteger(n) || n < 1) throw new Error(`zone number must be a positive integer, got ${n}`);
  if (row) { biome = row.biome ?? DEFAULT_BIOME; name = row.name ?? ''; }
  if (!Object.hasOwn(BIOMES, biome)) throw new Error(`unknown biome ${biome} (known: ${Object.keys(BIOMES).join(', ')})`);
  if (!name.trim()) throw new Error('zone name is empty');
  const file = `${dir}zone${n}.row.json`;
  if (existsSync(file)) throw new Error(`zone${n} already exists`);
  let made = row ? { ...row, name } : null;
  if (!made) {
    const base = JSON.parse(readFileSync(`${ROWS_DIR}zone2.row.json`, 'utf8'));
    made = { name, ...(biome === DEFAULT_BIOME ? {} : { biome }), names: {}, world: [], spawns: { openers: {}, rows: [] }, kit: base.kit, looks: base.looks,
      notes: { zone: `Zone ${n} (${name}): made by scripts/new-zone.mjs. \`level\` is the zone number = its base level (Dom 2026-10-08).`, kit: `Zone ${n}'s kit: a copy of Zone 2's until Characters ship this zone's own (the kit's node names are a contract).` } };
  }
  const bad = zoneProblems(zoneFromRow(n, made));   // checked before anything is written: a bad row leaves nothing behind
  if (bad.length) throw new Error(`row for zone ${n} is invalid: ${bad.join('; ')}`);
  writeFileSync(file, rowText(made));
  return file;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2), opt = (flag) => { const i = args.indexOf(flag); return i < 0 ? undefined : args[i + 1]; };
  try {
    const n = Number(args[0]);
    const from = opt('--from'), row = from ? JSON.parse(readFileSync(from, 'utf8')) : undefined;
    console.log(`wrote ${newZone({ n, biome: opt('--biome'), name: opt('--name'), row })}; run \`npm run zones\` (the build does) to register it`);
  } catch (e) { console.error(`new-zone: ${e.message}\nusage: node scripts/new-zone.mjs <N> [--biome ${DEFAULT_BIOME}] [--name "The Name"] [--from row.json]`); process.exit(1); }
}
