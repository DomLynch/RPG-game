import test from 'node:test';
import assert from 'node:assert/strict';
import { readyOffset, uprightFrom } from '../src/fight/upright-ready.ts';

test('upright ready: flag is inert unless ?look=upright', () => {
  assert.equal(uprightFrom(''), undefined);
  assert.equal(uprightFrom('?look=silhouette'), undefined);
  assert.equal(uprightFrom('?look=upright'), 'upright');
  assert.equal(uprightFrom('?look=upright-full'), 'upright-full');
});

test('upright ready: one row per body, radians from degree rows', () => {
  for (const id of ['hero', 'executioner', 'veteran']) assert.ok(readyOffset(id), id);
  assert.equal(readyOffset('goblin'), undefined);
  assert.ok(Math.abs(readyOffset('hero')!.spine3 + 8 * Math.PI / 180) < 1e-9);
  assert.ok(Math.abs(readyOffset('veteran', 'upright-full')!.spine3 + 16 * Math.PI / 180) < 1e-9);
});
