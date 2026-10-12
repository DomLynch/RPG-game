// The item and service vocabularies that are data (origins/contracts/definitions.json): rarities, materials, loot presentations and what a service accepts. A new value is one row; an unknown id still rejects; the
// lists whose values select code (CATEGORIES, STORY, BINDINGS, POWERS, LOCATION/PROVENANCE/HISTORY kinds, ROLL_MODES, SERVICE_KINDS, DISTRIBUTIONS) stay code. 'common' is pinned: loot-catalogue.ts and the fixtures assign it.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { buildTables, checkTables } from '../src/core/server.ts';
import defs from '../origins/contracts/definitions.json' with { type: 'json' };
import manifest from '../origins/contracts/definitions.manifest.json' with { type: 'json' };
import { BINDINGS, CATEGORIES, DISTRIBUTIONS, HISTORY_KINDS, LOCATION_KINDS, MATERIALS, POWERS, PRESENTATIONS, PROVENANCE_KINDS, RARITIES, ROLL_MODES, STORY } from '../origins/contracts/items.ts';
import { SERVICE_ACCEPTS, SERVICE_KINDS } from '../origins/contracts/economy.ts';

const problems = (d: unknown) => checkTables(buildTables(manifest.tables.map((m) => ({ manifest: m as never, parsed: d, file: 'definitions.json' })))).problems.map((p) => `${p.id} ${p.rule}: ${p.message}`);

test('the lists the old code held as const arrays are the rows, in the same order', () => {
  assert.deepEqual(RARITIES, ['common', 'fine', 'rare', 'relic']);
  assert.deepEqual(MATERIALS, ['iron', 'steel', 'bronze', 'gold', 'leather', 'cloth', 'bone', 'wood', 'stone', 'none']);
  assert.deepEqual(PRESENTATIONS, ['take-one', 'collect']);
  assert.deepEqual(SERVICE_ACCEPTS, ['armour', 'weapons', 'all']);
  assert.deepEqual(defs.serviceAccepts, { armour: { armour: true, weapons: false }, weapons: { armour: false, weapons: true }, all: { armour: true, weapons: true } }, 'the flags are the old branch: armour refuses weapons, weapons refuses armour, all takes both');
});

test("'common' is a pinned row (code assigns it), and the code-selecting lists are still code", () => {
  assert.ok(RARITIES.includes('common') && MATERIALS.includes('none'), 'the default rows exist');
  assert.deepEqual([...CATEGORIES], ['gear', 'material', 'quest', 'cosmetic']); assert.deepEqual([...STORY], ['none', 'notable', 'story-critical']); assert.deepEqual([...BINDINGS], ['none', 'on-acquire', 'on-equip']);
  assert.deepEqual([...POWERS], ['slot-weight', 'none']); assert.equal(LOCATION_KINDS.length, 6); assert.equal(PROVENANCE_KINDS.length, 7); assert.deepEqual([...HISTORY_KINDS], ['trade', 'upgrade']);
  assert.deepEqual([...ROLL_MODES], ['independent', 'weighted']); assert.deepEqual([...SERVICE_KINDS], ['upgrade']); assert.deepEqual([...DISTRIBUTIONS], ['personal']);
});

test('the registry manifest holds for the real rows, and the loader names a missing flag and a wrong type', () => {
  assert.deepEqual(problems(defs), []);
  const bad = structuredClone(defs) as Record<string, Record<string, Record<string, unknown>>>;
  delete bad.serviceAccepts!.all!.weapons; bad.rarities!.fine!.order = 'two';
  const text = problems(bad).join('; ');
  assert.match(text, /all missing-field: weapons is required/); assert.match(text, /fine wrong-type: order must be integer/);
});

test('a new rarity, material, presentation and service acceptance is ONE ROW in a copy of the tree, no code; an unknown id still rejects; a gap in the new rarity\'s ladder is caught', () => {
  const dir = mkdtempSync(join(tmpdir(), 'item-defs-'));
  try {
    cpSync('origins', join(dir, 'origins'), { recursive: true });
    for (const link of ['src', 'scripts', 'package.json', 'node_modules']) symlinkSync(resolve(link), join(dir, link));
    const file = join(dir, 'origins/contracts/definitions.json'), rows = JSON.parse(readFileSync(file, 'utf8'));
    rows.rarities.mythic = { order: 4 }; rows.materials.mithril = { order: 10 }; rows.presentations.pile = {}; rows.serviceAccepts.rings = { armour: false, weapons: false };
    writeFileSync(file, JSON.stringify(rows));
    writeFileSync(join(dir, 'probe.ts'), `import * as F from './origins/contracts/fixtures.ts';
import { parseItemDefinition, parseLootTable, RARITIES, MATERIALS } from './origins/contracts/items.ts';
import { parseServiceDefinition, parseUpgradeCostTable } from './origins/contracts/economy.ts';
const item = (rarity: string, material: string) => parseItemDefinition({ ...F.helmetDef(), rarity, material }).ok;
const loot = (presentation: string) => parseLootTable({ ...F.bossLoot(), presentation }).ok;
const service = (accepts: string) => parseServiceDefinition({ ...F.blacksmith(), accepts }).ok;
const costs = F.forgeCosts() as { rows: { level: number; rarity: string; coin: number; materials: unknown[] }[] };
const gap = parseUpgradeCostTable({ ...costs, rows: [...costs.rows, { level: 2, rarity: 'mythic', coin: 9, materials: [] }] });
console.log(JSON.stringify({ item: item('mythic', 'mithril'), unknownRarity: item('legendary', 'iron'), unknownMaterial: item('common', 'adamant'), loot: loot('pile'), unknownLoot: loot('heap'), service: service('rings'), unknownService: service('all-of-it'), gap: gap.ok, rarities: RARITIES.length, materials: MATERIALS.length }));`);
    const out = spawnSync(process.execPath, ['probe.ts'], { cwd: dir, encoding: 'utf8' });
    assert.equal(out.status, 0, out.stderr);
    assert.deepEqual(JSON.parse(out.stdout.trim().split('\n').pop()!), { item: true, unknownRarity: false, unknownMaterial: false, loot: true, unknownLoot: false, service: true, unknownService: false, gap: false, rarities: 5, materials: 11 });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
