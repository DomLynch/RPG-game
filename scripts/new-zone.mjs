// New zone: `node scripts/new-zone.mjs <N> [--biome ash-wastes] [--name "The Name"] [--from row.json]` writes origins/zones/zone<N>/ and NOTHING else (Dom 2026-10-09, plug and play).
// The registry is generated from the folders (`npm run zones`, which the vite build also runs), so the new folder is all a zone costs. Kit and looks start as Zone 2's (the node names are that kit's contract);
// spawns start empty (a zone with no rows is valid) and `world` is empty until its place.ts and world data exist. Level = the zone number (Dom 2026-10-08).
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BIOMES, DEFAULT_BIOME } from '../origins/zones/biomes.ts';
import { zoneProblems } from '../origins/zones/loader.ts';

const ZONES_DIR = fileURLToPath(new URL('../origins/zones/', import.meta.url));

// One data ROW (a JSON object with the zone's fields: name, names, world, biome, spawns, kit, looks, and optionally mobLooks and place) writes the whole folder. The row is checked by the loader's own
// zoneProblems BEFORE anything is written, so a bad row leaves nothing behind. Every file is pure literal data (one typed const + export default), so a zone row ships as a data-only PR.
const lit = (v) => JSON.stringify(v, null, 2);
function rowFiles(n, row) {
  const own = (k) => (row[k] === undefined ? [] : [k]);
  for (const k of Object.keys(row)) if (!['name', 'names', 'world', 'biome', 'id', 'spawns', 'kit', 'looks', 'mobLooks', 'place'].includes(k)) throw new Error(`row: unknown key "${k}"`);
  if (row.id !== undefined && String(row.id) !== String(n)) throw new Error(`row: id ${row.id} is not zone ${n}`);
  const head = { id: String(n), level: n, name: row.name, names: row.names ?? {}, world: row.world ?? [], ...(row.biome && row.biome !== DEFAULT_BIOME ? { biome: row.biome } : {}) };
  const files = {
    'zone.ts': `// Zone ${n} (${row.name}): the zone's own facts, from its data row (scripts/new-zone.mjs --from). \`level\` is the zone number = its base level (Dom 2026-10-08).\nconst zone: { id: string; level: number; name: string; names: Record<string, string>; world: string[]; biome?: string } = ${lit(head)};\nexport default zone;\n`,
    'spawns.ts': `// Zone ${n}'s creatures as data, from its row. A row's level must be ${n}-${n + 1}; every opener must name a row (loadZone checks both).\nimport type { MobRow } from '../../mobs/row.ts';\n\nconst spawns: { openers: Record<string, string>; rows: MobRow[] } = ${lit(row.spawns ?? { openers: {}, rows: [] })};\nexport default spawns;\n`,
    'kit.ts': `// Zone ${n}'s kit, from its row (the node names are the kit's contract).\nimport type { Zone } from '../loader.ts';\n\nconst kit: Zone['kit'] = ${lit(row.kit)};\nexport default kit;\n`,
    'look.ts': `// Zone ${n}'s looks, from its row: the preset names the page asks for.\nimport type { Zone } from '../loader.ts';\n\nconst looks: Zone['looks'] = ${lit(row.looks)};\nexport default looks;\n`,
  };
  if (own('mobLooks').length) files['mob-looks.ts'] = `// Zone ${n}'s creature looks, from its row.\nimport type { Zone } from '../loader.ts';\n\nconst mobLooks: NonNullable<Zone['mobLooks']> = ${lit(row.mobLooks)};\nexport default mobLooks;\n`;
  if (own('place').length) files['place.ts'] = `// Zone ${n} on the Region 1 map, from its row.\nimport type { Place } from '../place.ts';\n\nconst place: Place = ${lit(row.place)};\nexport default place;\n`;
  const probe = { ...head, spawns: row.spawns ?? { openers: {}, rows: [] }, kit: row.kit, looks: row.looks, ...(row.mobLooks ? { mobLooks: row.mobLooks } : {}), ...(row.place ? { place: row.place } : {}) };
  const bad = zoneProblems(probe);
  if (bad.length) throw new Error(`row for zone ${n} is invalid: ${bad.join('; ')}`);
  return files;
}

export function newZone({ n, biome = DEFAULT_BIOME, name = `Zone ${n}`, dir = ZONES_DIR, row = /** @type {Record<string, any> | undefined} */ (undefined) }) {
  if (!Number.isInteger(n) || n < 1) throw new Error(`zone number must be a positive integer, got ${n}`);
  if (row) biome = row.biome ?? DEFAULT_BIOME;
  if (!Object.hasOwn(BIOMES, biome)) throw new Error(`unknown biome ${biome} (known: ${Object.keys(BIOMES).join(', ')})`);
  if (row) name = row.name ?? '';
  if (!name.trim()) throw new Error('zone name is empty');
  const fromRow = row ? rowFiles(n, { ...row, name }) : null;   // checked before the folder exists
  const folder = `${dir}zone${n}/`;
  if (existsSync(folder)) throw new Error(`zone${n} already exists`);
  mkdirSync(folder);
  if (fromRow) { try { for (const [f, text] of Object.entries(fromRow)) writeFileSync(`${folder}${f}`, text); } catch (e) { rmSync(folder, { recursive: true, force: true }); throw e; } return folder; }
  const biomeLine = biome === DEFAULT_BIOME ? '' : `, biome: ${JSON.stringify(biome)}`;
  writeFileSync(`${folder}zone.ts`, `// Zone ${n} (${name}): the zone's own facts. \`level\` is the zone number = its base level (Dom 2026-10-08: Zone N = level N). Made by scripts/new-zone.mjs.\n`
    + `const zone: { id: string; level: number; name: string; names: Record<string, string>; world: string[]; biome?: string } = { id: '${n}', level: ${n}, name: ${JSON.stringify(name)}, names: {}, world: []${biomeLine} };\nexport default zone;\n`);
  writeFileSync(`${folder}spawns.ts`, `// Zone ${n}'s creatures as data: none yet. A row's level must be ${n}-${n + 1} (loadZone checks it); every opener must name a row. Made by scripts/new-zone.mjs.\n`
    + `import type { MobRow } from '../../mobs/row.ts';\n\nconst spawns: { openers: Record<string, string>; rows: MobRow[] } = { openers: {}, rows: [] };\nexport default spawns;\n`);
  for (const f of ['kit.ts', 'look.ts']) cpSync(`${dir}zone2/${f}`, `${folder}${f}`);
  return folder;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = (flag) => { const i = args.indexOf(flag); return i < 0 ? undefined : args[i + 1]; };
  try {
    const n = Number(args[0]);
    const from = opt('--from'), row = from ? JSON.parse(readFileSync(from, 'utf8')) : undefined;
    console.log(`wrote ${newZone({ n, biome: opt('--biome'), name: opt('--name'), row })}; run \`npm run zones\` (the build does) to register it`);
  } catch (e) { console.error(`new-zone: ${e.message}\nusage: node scripts/new-zone.mjs <N> [--biome ${DEFAULT_BIOME}] [--name "The Name"] [--from row.json]`); process.exit(1); }
}
