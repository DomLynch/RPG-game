// Gap 8: a zone package can bring its own biome preset (biome.row.json), merged into the biome table through the generated biomes.packages.json; the shared presets in biomes.json stay hand-edited and cannot be redefined by a package.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, importFolder, loadRules, validatePackage, canon } from '../scripts/gen-packages.mjs';
import { exportPackage, loadTables } from '../scripts/zone-package.mjs';
import { BIOMES, mergeBiomes } from '../origins/zones/biomes.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SPEC = { look: { fog: { colour: '#2a1f3d', density: 0.02 } }, sound: { ambience: 'wind' } };
// a minimal NEW package on zone 91: the Bone Hollow's zone row, unlisted, naming `biome`, with no dungeon, theme or exits
function scratchWith(biome: string, brings: boolean): { root: string; folder: string } {
  const root = mkdtempSync(join(tmpdir(), 'pkgbiome-'));
  for (const d of ['origins/packages', 'origins/zones', 'origins/zone-rows', 'origins/presence', 'public/world/kit']) { mkdirSync(join(root, d), { recursive: true }); cpSync(join(ROOT, d), join(root, d), { recursive: true }); }
  const zone = { ...JSON.parse(readFileSync(join(ROOT, 'origins/zone-rows/zone5.row.json'), 'utf8')), unlisted: true, biome }; delete zone.dungeon; delete zone.spawns;
  const text = canon(zone), pkg = exportPackage('91', text, { exits: [], dungeons: [], themes: [] }, brings ? { id: biome, spec: SPEC } : null) as { files: Record<string, string>; manifest: { files: object } };
  const folder = join(root, 'incoming'); mkdirSync(folder);
  for (const [f, t] of Object.entries(pkg.files)) writeFileSync(join(folder, f), f === 'package.json' ? canon({ ...JSON.parse(t), id: 'goblin-fortress-test', unlisted: true }) : t);
  return { root, folder };
}

test('mergeBiomes: a package preset joins the shared ones; an id in both is refused', () => {
  const merged = mergeBiomes({ a: { x: 1 } }, { b: { y: 2 } });
  assert.deepEqual(Object.keys(merged), ['a', 'b']);
  assert.throws(() => mergeBiomes({ a: { x: 1 } }, { a: { y: 2 } }), /a package may not redefine a shared preset/);
  assert.ok(BIOMES['ash-wastes'] && BIOMES['drowned-marsh'], 'the shared presets are still there');
});

test('a package that brings a biome imports it unlisted, and the generated table carries it', () => {
  const { root, folder } = scratchWith('goblin-fortress-test', true);
  try {
    assert.deepEqual(importFolder(folder, root), [], 'a new unlisted package with its own biome imports');
    const table = JSON.parse(readFileSync(join(root, 'origins/zones/biomes.packages.json'), 'utf8')) as { biomes: Record<string, unknown> };
    assert.deepEqual(table.biomes, { 'goblin-fortress-test': SPEC });
    assert.equal(readFileSync(join(root, 'origins/zone-rows/zone91.row.json'), 'utf8').includes('"biome": "goblin-fortress-test"'), true, 'its zone row names the preset');
    assert.ok(Object.keys(generate(root) as object).includes('origins/zones/biomes.packages.json'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a zone that names a biome nobody carries is refused at import, and nothing is written', () => {
  const { root, folder } = scratchWith('no-such-biome', false);
  try {
    const before = readdirSync(join(root, 'origins/packages')).sort();
    assert.match((importFolder(folder, root) as string[]).join(';'), /names biome "no-such-biome", which neither biomes.json nor a package carries/);
    assert.deepEqual(readdirSync(join(root, 'origins/packages')).sort(), before, 'no package folder was written');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a package may not bring a biome that biomes.json already has, even with --replace: a shared preset is not redefined by a package', () => {
  const { root, folder } = scratchWith('ash-wastes', true);
  try {
    const before = readdirSync(join(root, 'origins/packages')).sort();
    assert.match((importFolder(folder, root) as string[]).join(';'), /biome "ash-wastes" already exists/);
    assert.match((importFolder(folder, root, new Set(['ash-wastes'])) as string[]).join(';'), /would leave the packages inconsistent.*biome "ash-wastes" already exists/, 'naming it does not help: generation refuses a package preset that shadows a shared one');
    assert.deepEqual(readdirSync(join(root, 'origins/packages')).sort(), before, 'nothing written');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the biome file must be { id, spec } and the manifest must say so', () => {
  const tables = loadTables(), base = exportPackage('91', canon({ ...JSON.parse(readFileSync(join(ROOT, 'origins/zone-rows/zone5.row.json'), 'utf8')), unlisted: true, dungeon: undefined, spawns: undefined }), { ...tables, dungeons: [], themes: [] }, { id: 'p', spec: SPEC }) as { files: Record<string, string> };
  const ctx = { rules: loadRules(), mode: 'generate', existing: { zones: new Set(), exits: new Set(), dungeons: new Set(), themes: new Set(), warps: new Set(), biomes: new Set() }, replace: new Set(), publicHas: () => true };
  const bad = (name: string, text: string) => { const m = JSON.parse(base.files['package.json']!); m.files[name] = { bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') }; return validatePackage({ ...base.files, [name]: text, 'package.json': canon(m) }, ctx) as string[]; };
  assert.deepEqual(validatePackage(base.files, ctx), []);
  assert.match(bad('biome.row.json', canon({ id: 'p', spec: [] })).join(';'), /must be \{ id: string, spec: object \}/);
  assert.match(bad('biome.row.json', canon({ id: 'p', spec: SPEC, extra: 1 })).join(';'), /holds only id and spec/);
  assert.match(bad('biome.row.json', canon({ id: 'q', spec: SPEC })).join(';'), /owns\.biome does not match/);
});
