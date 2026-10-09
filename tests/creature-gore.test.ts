// Every creature has a complete gore row, the rows match the rigs on disk, and the finisher path has no per-creature code: a new creature is one row (src/creature-gore.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CREATURE_GORE, creatureGore, type CreatureGore } from '../src/creature-gore.ts';
import { ROSTER } from '../src/roster.ts';
import { ROTATION, type FinisherId } from '../src/finishers.ts';

const root = (p: string) => new URL(`../${p}`, import.meta.url);
function joints(path: string): Set<string> {
  const b = readFileSync(root(path)), g = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  return new Set((g.skins[0].joints as number[]).map((i) => g.nodes[i].name));
}
const HEX = /^#[0-9a-f]{6}$/i, FINISHERS = new Set<FinisherId>([...ROTATION, 'quietOne', 'hamstrung', 'execution']);
// A creature is a roster row that bites (a beast) or stands on the goblin rig; a held one still needs its row.
const creatures = Object.entries(ROSTER).filter(([, r]) => r.weapon === 'bite' || r.rig === 'goblin').map(([id]) => id);

test('every creature in the roster has a gore row, and no row is for a non-roster id', () => {
  assert.deepEqual(creatures.sort(), Object.keys(CREATURE_GORE).sort());
  for (const id of Object.keys(CREATURE_GORE)) assert.ok(id in ROSTER, `${id} is a roster id`);
});

test('a row is complete: shape, a head and a neck to cut, limbs, a blood colour and amount, finishers from the Pit set ending in plainDeath', () => {
  for (const [id, row] of Object.entries(CREATURE_GORE) as [string, CreatureGore][]) {
    assert.ok(row.shape === 'quadruped' || row.shape === 'biped', `${id}: shape`);
    assert.ok(row.cut.head.length && row.cut.neck.length, `${id}: a usable head and neck bone`);
    assert.ok(Object.keys(row.cut.limbs).length >= 4 && Object.values(row.cut.limbs).every((b) => b.length), `${id}: four limbs`);
    assert.ok(HEX.test(row.blood.start) && HEX.test(row.blood.end), `${id}: blood colours are #rrggbb`);
    assert.ok(row.blood.amount > 0 && row.blood.amount <= 2, `${id}: blood amount in (0, 2]`);
    assert.ok(row.finishers.length && row.finishers.every((f) => FINISHERS.has(f)), `${id}: finishers are Pit finishers`);
    assert.equal(row.finishers.at(-1), 'plainDeath', `${id}: the safe fallback is last`);
    assert.equal(new Set(row.finishers).size, row.finishers.length, `${id}: no duplicate finisher`);
  }
});

test('the bones are the rig\'s own: every named bone is a skin joint of the row\'s GLB, and the roster body agrees', () => {
  for (const [id, row] of Object.entries(CREATURE_GORE) as [string, CreatureGore][]) {
    const have = joints(row.glb);
    for (const bone of [...row.cut.head, ...row.cut.neck, ...Object.values(row.cut.limbs).flat()]) assert.ok(have.has(bone), `${id}: ${bone} is not a joint of ${row.glb}`);
    assert.ok(row.glb.includes(ROSTER[id as keyof typeof ROSTER].body), `${id}: the GLB is the roster body`);
  }
});

test('no per-creature code on the finisher path: it names no creature, and a new creature is one row read through creatureGore', () => {
  for (const f of ['src/finishers.ts', 'src/finisher-blood.ts']) {
    const src = readFileSync(root(f), 'utf8').replace(/\/\/.*$/gm, '');
    assert.ok(!/['"`](wolf|boar|bear|goblin)['"`]/.test(src), `${f}: names a creature; put it in a row`);
  }
  assert.equal(creatureGore('boar'), CREATURE_GORE.boar, 'a known id reads its row');
  assert.equal(creatureGore('dragon'), null, 'an id with no row is null, not a crash');
});
