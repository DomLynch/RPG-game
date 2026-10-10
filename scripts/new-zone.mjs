// New zone: `node scripts/new-zone.mjs <N> [--biome ash-wastes] [--name "The Name"] [--from row.json]` writes origins/zones/zone<N>/ and NOTHING else (Dom 2026-10-09, plug and play).
// The registry is generated from the folders (`npm run zones`, which the vite build also runs), so the new folder is all a zone costs. Kit and looks start as Zone 2's (the node names are that kit's contract);
// spawns start empty (a zone with no rows is valid) and `world` is empty until its place.ts and world data exist. Level = the zone number (Dom 2026-10-08).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BIOMES, DEFAULT_BIOME } from '../origins/zones/biomes.ts';
import { zoneProblems } from '../origins/zones/loader.ts';

const ZONES_DIR = fileURLToPath(new URL('../origins/zones/', import.meta.url));

// One data ROW (a JSON object with the zone's fields: name, names, world, biome, spawns, kit, looks, and optionally mobLooks and place) writes the whole folder. The row is checked by the loader's own
// zoneProblems BEFORE anything is written, so a bad row leaves nothing behind. Every file is one typed literal const + export default. zone/spawns/kit/look are on the data-only path list; mob-looks and place are pure literals too but are not on it yet (the Auditor adds them), so a row that has them is reviewed until then.
// The top two levels one entry per line, everything deeper on its line (a creature row is one line), so a zone folder stays under the 300-line data budget (tests/k7-engine-parity.test.ts).
const lit = (v, d = 0) => {
  if (v === null || typeof v !== 'object' || d >= 2) return JSON.stringify(v);
  const pad = '  '.repeat(d + 1), end = '  '.repeat(d);
  if (Array.isArray(v)) return v.length ? `[\n${v.map((x) => pad + lit(x, d + 1)).join(',\n')}\n${end}]` : '[]';
  const e = Object.entries(v);
  return e.length ? `{\n${e.map(([k, x]) => `${pad}${JSON.stringify(k)}: ${lit(x, d + 1)}`).join(',\n')}\n${end}}` : '{}';
};
const hdr = (row, key, dflt) => `${(row.notes?.[key] ?? dflt).split(/\r\n|[\n\r\u2028\u2029]/).map((l) => `// ${l}`.trimEnd()).join('\n')}\n`;   // row.notes[file] carries a file's header comment (a row is JSON: it cannot hold comments itself)
function rowFiles(n, row) {
  const own = (k) => (row[k] === undefined ? [] : [k]);
  for (const k of Object.keys(row)) if (!['name', 'names', 'world', 'biome', 'id', 'spawns', 'kit', 'looks', 'mobLooks', 'place', 'camera', 'notes'].includes(k)) throw new Error(`row: unknown key "${k}"`);
  if (row.id !== undefined && String(row.id) !== String(n)) throw new Error(`row: id ${row.id} is not zone ${n}`);
  const head = { id: String(n), level: n, name: row.name, names: row.names ?? {}, world: row.world ?? [], ...(row.biome && row.biome !== DEFAULT_BIOME ? { biome: row.biome } : {}), ...(row.camera ? { camera: row.camera } : {}) };
  const files = {
    'zone.ts': `${hdr(row, 'zone', `Zone ${n} (${row.name}): the zone's own facts, from its data row (scripts/new-zone.mjs --from). \`level\` is the zone number = its base level (Dom 2026-10-08).`)}const zone: { id: string; level: number; name: string; names: Record<string, string>; world: string[]; biome?: string; camera?: Record<string, unknown> } = ${lit(head)};\nexport default zone;\n`,
    'spawns.ts': `${hdr(row, 'spawns', `Zone ${n}'s creatures as data, from its row. A row's level must be ${n}-${n + 1}; every opener must name a row (loadZone checks both).`)}import type { MobRow } from '../../mobs/row.ts';\n\nconst spawns: { openers: Record<string, string>; rows: MobRow[] } = ${lit(row.spawns ?? { openers: {}, rows: [] })};\nexport default spawns;\n`,
    'kit.ts': `${hdr(row, 'kit', `Zone ${n}'s kit, from its row (the node names are the kit's contract).`)}import type { Zone } from '../loader.ts';\n\nconst kit: Zone['kit'] = ${lit(row.kit)};\nexport default kit;\n`,
    'look.ts': `${hdr(row, 'look', `Zone ${n}'s looks, from its row: the preset names the page asks for.`)}import type { Zone } from '../loader.ts';\n\nconst looks: Zone['looks'] = ${lit(row.looks)};\nexport default looks;\n`,
  };
  if (own('mobLooks').length) files['mob-looks.ts'] = `${hdr(row, 'mobLooks', `Zone ${n}'s creature looks, from its row.`)}import type { Zone } from '../loader.ts';\n\nconst mobLooks: NonNullable<Zone['mobLooks']> = ${lit(row.mobLooks)};\nexport default mobLooks;\n`;
  if (own('place').length) files['place.ts'] = `${hdr(row, 'place', `Zone ${n} on the Region 1 map, from its row.`)}import type { Place } from '../place.ts';\n\nconst place: Place = ${lit(row.place)};\nexport default place;\n`;
  for (const k of ['kit', 'looks']) if (row[k] === undefined) throw new Error(`row for zone ${n}: "${k}" is required`);   // zoneProblems would throw a TypeError on a missing kit; say it plainly instead
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
  try {
    const biomeLine = biome === DEFAULT_BIOME ? '' : `, biome: ${JSON.stringify(biome)}`;
    writeFileSync(`${folder}zone.ts`, `// Zone ${n} (${name}): the zone's own facts. \`level\` is the zone number = its base level (Dom 2026-10-08: Zone N = level N). Made by scripts/new-zone.mjs.\n`
      + `const zone: { id: string; level: number; name: string; names: Record<string, string>; world: string[]; biome?: string } = { id: '${n}', level: ${n}, name: ${JSON.stringify(name)}, names: {}, world: []${biomeLine} };\nexport default zone;\n`);
    writeFileSync(`${folder}spawns.ts`, `// Zone ${n}'s creatures as data: none yet. A row's level must be ${n}-${n + 1} (loadZone checks it); every opener must name a row. Made by scripts/new-zone.mjs.\n`
      + `import type { MobRow } from '../../mobs/row.ts';\n\nconst spawns: { openers: Record<string, string>; rows: MobRow[] } = { openers: {}, rows: [] };\nexport default spawns;\n`);
    // Kit and looks start as Zone 2's: their first line is the template's, so it is rewritten to say what this file is (Auditor nit on #2047).
    for (const [f, what] of [['kit.ts', 'kit'], ['look.ts', 'looks']]) {
      const [, ...rest] = readFileSync(`${dir}zone2/${f}`, 'utf8').split('\n');
      writeFileSync(`${folder}${f}`, [`// Zone ${n}'s ${what}: a copy of Zone 2's until Characters ship this zone's own (the kit's node names are a contract). Made by scripts/new-zone.mjs. Read through loadZone only.`, ...rest].join('\n'));
    }
  } catch (e) { rmSync(folder, { recursive: true, force: true }); throw e; }   // a failed copy leaves no half-made folder (Auditor nit on #2047)
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
