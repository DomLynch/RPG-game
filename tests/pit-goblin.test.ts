// The Zone 1 Pit goblin camp's data (Characters, 2026-10-09): the creature wears the Pit's own rank-1 goblin body and level-1 armour (no new art), its camp size is a data field, and
// the armour it drops is the six pieces the file wears. World's mobs-view reads MobLook.body ('pit') to fetch src/assets/goblin.glb once and clone it for every camp member.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOB_LOOKS } from '../origins/preview/mob-looks.ts';
import { loadZone } from '../origins/zones/loader.ts';
import { ROSTER } from '../src/roster.ts';
import { LOOT } from '../src/loot.ts';

const root = (p: string) => new URL(`../${p}`, import.meta.url);
function nodeNames(path: string): string[] {
  const b = readFileSync(root(path)), g = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  return (g.nodes as { name?: string; mesh?: number }[]).filter((n) => n.mesh !== undefined).map((n) => n.name ?? '');
}
const ID = 'character:pit-goblin';

test('the Pit goblin\'s look is the Pit\'s own goblin body, undyed, at native height', () => {
  const look = MOB_LOOKS[ID]!;
  assert.equal(look.body, 'pit'); assert.equal(look.opponent, 'goblin');
  assert.ok(ROSTER.goblin.body === 'goblin', 'the roster body the Pit fights');
  assert.deepEqual([look.tint, look.scale, look.dressing], [0xffffff, 1, { soot: 0, burnt: 0 }]);
  assert.ok(Object.entries(MOB_LOOKS).every(([id, l]) => id === ID || l.body === undefined), 'only the Pit goblin asks for the Pit body');
});

test('the file he is drawn from already wears the level-1 armour, and the six loot pieces are in the carriers file', () => {
  const worn = nodeNames('src/assets/goblin.glb');
  for (const part of ['Steel.Helmet', 'Steel.Body', 'Steel.Greaves', 'Wrap.Boots', 'Gambeson', 'Leather.Body']) assert.ok(worn.includes(part), `${part} is drawn on the Pit goblin`);
  const pieces = LOOT.goblin!.filter((id) => !id.endsWith('Knife'));
  assert.deepEqual(pieces, ['goblin.Helmet', 'goblin.Body', 'goblin.Arms', 'goblin.Greaves', 'goblin.Boots', 'goblin.Gloves']);
  const carriers = nodeNames('src/assets/loot/carriers-goblin.glb');
  for (const id of pieces.filter((p) => !p.endsWith('Gloves'))) assert.ok(carriers.some((n) => n.startsWith(`${id}.`)), `${id} has a part in carriers-goblin.glb`);
  assert.ok(carriers.some((n) => n.includes('Gloves')), 'the shared gloves are in the carriers file');
});

test('Zone 1 has his row: level 1-2, camp size a data field of 2, bronze-only table for now', () => {
  const row = loadZone('1').spawns.rows.find((r) => r.id === ID)!;
  assert.deepEqual(row.level, [1, 2]); assert.deepEqual(row.behaviour.campSize, [2, 2]); assert.equal(row.loot, 'loottable:pit-goblin');
});
