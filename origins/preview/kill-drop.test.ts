// The sandbox kill drop (kill-drop.ts): the Found list is page memory only; a piece lies as itself and is picked up by walking onto it, once; a piece with no look row is loud.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFound, createKillDrops } from './kill-drop.ts';

test('the Found list counts per piece in page memory only: a new list (a reload) starts empty and nothing touches localStorage', () => {
  const touched: string[] = [], real = (globalThis as { localStorage?: unknown }).localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => void touched.push('get'), setItem: () => void touched.push('set') } });
  try {
    const a = createFound(); a.add('goblin.Body', 'Goblin breastplate', 'Pit goblin'); a.add('goblin.Body', 'Goblin breastplate', 'Pit goblin'); a.add('goblin.Boots', 'Goblin boots', 'Pit goblin');
    assert.equal(a.count(), 3); assert.deepEqual(a.list().map((i) => [i.piece, i.n]), [['goblin.Body', 2], ['goblin.Boots', 1]]);
    assert.equal(createFound().count(), 0, 'a reload starts empty'); a.clear(); assert.equal(a.count(), 0);
    assert.deepEqual(touched, [], 'no storage read or write');
  } finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: real }); }
});

test('a drop waits on the ground and is taken once, by walking within reach', () => {
  const found = createFound(), picked: string[] = [], shown: string[] = [], hidden: string[] = []; let changes = 0;
  const view = { show: (id: string, item: string) => void shown.push(`${id}=${item}`), hide: (id: string) => void hidden.push(id) };
  const drops = createKillDrops({ view, itemOf: (p) => `loot:${p}`, found, reach: 1.4, onPick: (d) => void picked.push(d.piece), onChange: () => void changes++ });
  drops.drop('goblin.Helmet', 'Goblin helmet', 'Pit goblin', 5, 5); assert.equal(drops.waiting(), 1); assert.deepEqual(shown, ['drop:1=loot:goblin.Helmet'], 'the piece lies as itself');
  drops.update({ x: 0, z: 0 }); assert.equal(drops.waiting(), 1, 'far away: it stays'); assert.equal(found.count(), 0);
  drops.update({ x: 4.2, z: 5 }); assert.deepEqual(picked, ['goblin.Helmet']); assert.equal(found.count(), 1); assert.equal(drops.waiting(), 0); assert.equal(changes, 1);
  drops.update({ x: 4.2, z: 5 }); assert.equal(found.count(), 1, 'taken once'); assert.deepEqual(hidden, ['drop:1'], 'its lying model goes with it');
});

test('a piece with no look row is loud: the view throws and nothing is left waiting', () => {
  const view = { show: () => { throw new Error('no row'); }, hide: () => undefined };
  const drops = createKillDrops({ view, itemOf: (p) => p, found: createFound(), reach: 1.4, onPick: () => undefined, onChange: () => undefined });
  assert.throws(() => drops.drop('goblin.Gloves', 'Goblin gloves', 'Pit goblin', 0, 0), /no row/);
  assert.equal(drops.waiting(), 0);
});
