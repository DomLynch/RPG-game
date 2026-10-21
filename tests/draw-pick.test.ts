import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickDrawn } from '../origins/preview/draw-pick.ts';

const hero = { x: 0, z: 0 }, RANGE = 60, at = (...d: number[]) => d.map((x) => ({ x, z: 0 }));

test('with nothing that must be drawn, the phone cap fills with the nearest creatures in range', () => {
  assert.deepEqual(pickDrawn(at(30, 5, 20, 10, 70), hero, 3, RANGE, new Set()), [1, 3, 2]);
});
test('a fourth creature fighting the hero is drawn at cap 3, ahead of nearer idle ones', () => {
  const picked = pickDrawn(at(2, 3, 4, 50), hero, 3, RANGE, new Set([3]));
  assert.ok(picked.includes(3), 'the far fighter is drawn');
  assert.equal(picked.length, 3, 'the cap is still the total: the fighter takes an idle creature\'s place');
  assert.deepEqual(picked, [3, 0, 1]);
});
test('creatures that must be drawn go above the cap, nearest first, and leave no idle fill', () => {
  assert.deepEqual(pickDrawn(at(9, 8, 7, 6, 1), hero, 3, RANGE, new Set([0, 1, 2, 3])), [3, 2, 1, 0]);
});
test('a must creature outside the range is still drawn; an idle one outside is not', () => {
  assert.deepEqual(pickDrawn(at(100, 90), hero, 3, RANGE, new Set([0])), [0]);
});
test('the phone cap is 3 and a player\'s reach is a row (desktop keeps TUNING.cap)', () => {
  const rows = (JSON.parse(readFileSync(new URL('../src/fight/fx-rows.json', import.meta.url), 'utf8')) as { fxRows: { id: string; fields: { value: number } }[] }).fxRows;
  const v = (id: string) => rows.find((r) => r.id === id)?.fields.value;
  assert.equal(v('mob-view.phone-cap'), 3);
  assert.equal(v('mob-view.player-reach'), 8);
});
