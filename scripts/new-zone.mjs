// New zone: `node scripts/new-zone.mjs <N> [--biome ash-wastes] [--name "The Name"]` writes origins/zones/zone<N>/ and NOTHING else (Dom 2026-10-09, plug and play).
// The registry is generated from the folders (`npm run zones`, which the vite build also runs), so the new folder is all a zone costs. Kit and looks start as Zone 2's (the node names are that kit's contract);
// spawns start empty (a zone with no rows is valid) and `world` is empty until its place.ts and world data exist. Level = the zone number (Dom 2026-10-08).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BIOMES, DEFAULT_BIOME } from '../origins/zones/biomes.ts';

const ZONES_DIR = fileURLToPath(new URL('../origins/zones/', import.meta.url));

export function newZone({ n, biome = DEFAULT_BIOME, name = `Zone ${n}`, dir = ZONES_DIR }) {
  if (!Number.isInteger(n) || n < 1) throw new Error(`zone number must be a positive integer, got ${n}`);
  if (!Object.hasOwn(BIOMES, biome)) throw new Error(`unknown biome ${biome} (known: ${Object.keys(BIOMES).join(', ')})`);
  if (!name.trim()) throw new Error('zone name is empty');
  const folder = `${dir}zone${n}/`;
  if (existsSync(folder)) throw new Error(`zone${n} already exists`);
  mkdirSync(folder);
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
    console.log(`wrote ${newZone({ n, biome: opt('--biome'), name: opt('--name') })}; run \`npm run zones\` (the build does) to register it`);
  } catch (e) { console.error(`new-zone: ${e.message}\nusage: node scripts/new-zone.mjs <N> [--biome ${DEFAULT_BIOME}] [--name "The Name"]`); process.exit(1); }
}
