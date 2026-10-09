// The character catalogue (src/fight/catalogue.ts): a good row passes, each fault is named, the goblin row's facts are the files' own, and the engine reads a row by id with no per-character code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalogueProblems, catalogueRowsProblems, type CatalogueRow } from '../src/fight/catalogue.ts';
import { CATALOGUE, catalogueRow } from '../src/fight/catalogue-rows.ts';
import { ROSTER } from '../src/roster.ts';
import { LOOT, LOOT_IDS } from '../src/loot.ts';
import { ROTATION } from '../src/finishers.ts';
import { LOOT_TABLES } from '../origins/region1/content.ts';

const known = {
  roster: new Set(Object.keys(ROSTER)), loot: LOOT_IDS as ReadonlySet<string>, tables: new Set((LOOT_TABLES as { id: string }[]).map((t) => t.id)),
  finishers: new Set<string>([...ROTATION, 'quietOne', 'hamstrung', 'execution']), archetypes: new Set(Object.values(ROSTER).map((r) => r.archetype)),
};
const root = (p: string) => new URL(`../${p}`, import.meta.url);
function glb(path: string) {
  const b = readFileSync(root(path)), g = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  const tris = (g.meshes as { primitives: { indices?: number }[] }[]).flatMap((m) => m.primitives).reduce((n, p) => n + (p.indices === undefined ? 0 : g.accessors[p.indices].count / 3), 0);
  const joints = new Set<string>(g.skins.flatMap((s: { joints: number[] }) => s.joints.map((i) => g.nodes[i].name)));
  return { tris, joints, clips: (g.animations as { name: string }[]).map((a) => a.name) };
}
const goblin = () => structuredClone(catalogueRow('goblin')!) as CatalogueRow & { [k: string]: unknown };

test('the catalogue is valid, ids are unique, and the goblin is row #1', () => {
  assert.deepEqual(catalogueRowsProblems(CATALOGUE, known), []);
  assert.equal(CATALOGUE[0]!.id, 'goblin');
  assert.deepEqual(catalogueRowsProblems([CATALOGUE[0]!, CATALOGUE[0]!], known).map((p) => p.code), ['dup-id']);
});

test('each fault is named', () => {
  const edit = (f: (r: CatalogueRow) => void) => { const r = goblin(); f(r); return catalogueProblems(r, known).map((p) => p.code).join(','); };
  assert.equal(edit(() => {}), '');
  assert.equal(edit((r) => { (r as { id: string }).id = 'dragon'; }), 'id');
  assert.equal(edit((r) => { r.world = { ...r.world, tris: 62000, maxTris: 62000 }; }), 'budget');
  assert.equal(edit((r) => { r.world = { ...r.world, asset: r.engine.asset }; }), 'asset');
  assert.equal(edit((r) => { (r.armour as string[]).push('goblin.Cape'); }), 'armour');
  assert.equal(edit((r) => { r.stats = { archetype: 'nope', levels: [1, 10] }; }), 'stats');
  assert.equal(edit((r) => { r.finisher.cut.neck = []; }), 'finisher');
  assert.equal(edit((r) => { r.finisher.finishers = ['decapitation']; }), 'finisher');
  assert.equal(edit((r) => { r.blood.start = 'red'; }), 'blood');
  assert.equal(edit((r) => { r.loot.table = 'loottable:nothing'; }), 'loot');
  assert.equal(edit((r) => { r.legend = { pending: '' }; }), 'legend');
});

test('the goblin row says what the files say: tri counts, clips, rig joints, the armour set', () => {
  const row = catalogueRow('goblin')!, engine = glb(row.engine.asset), world = glb(row.world.asset);
  assert.equal(Math.round(engine.tris), row.engine.tris); assert.equal(Math.round(world.tris), row.world.tris);
  assert.deepEqual([...row.animations.clips].sort(), [...engine.clips].sort()); assert.deepEqual([...engine.clips].sort(), [...world.clips].sort(), 'both assets carry every clip');
  for (const bone of [...row.finisher.cut.head, ...row.finisher.cut.neck, ...Object.values(row.finisher.cut.limbs).flat()]) assert.ok(engine.joints.has(bone) && world.joints.has(bone), `${bone} is a joint of both assets`);
  assert.deepEqual(row.armour, LOOT.goblin!.filter((id) => !id.endsWith('Knife')), 'the level-1 armour is the loot pieces without the weapon');
  assert.equal(row.rig, ROSTER.goblin.rig); assert.equal(row.stats.archetype, ROSTER.goblin.archetype);
});

test('the engine reads a row by id with no per-character code: a new character is one row', () => {
  for (const f of ['src/fight/catalogue.ts']) assert.ok(!/['"`](wolf|boar|bear|goblin|veteran|dwarf)['"`]/.test(readFileSync(root(f), 'utf8').replace(/\/\/.*$/gm, '')), `${f} names no character`);
  assert.equal(catalogueRow('dragon'), null);
  const second = { ...goblin(), id: 'knight', name: 'the Knight', rig: 'hero' as const };
  assert.ok(!catalogueProblems(second, known).some((p) => p.code === 'id' || p.code === 'asset'), 'a second row needs only data');
});
