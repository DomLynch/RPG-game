import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fetchKinds, pickDrawn } from '../origins/preview/draw-pick.ts';

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
  assert.equal(v('mob-view.preready-kinds'), 1);   // a phone fetches only its nearest creature's kind before [zone ready] (#3520; measured on the T4 phone capture: 3 = 12,268 KB, 2 = 11,576 KB, 1 = 10,887 KB gzip before ready, the others follow right after ready closest first), deliberate
});

test("fetchKinds: before [zone ready] a phone fetches only its nearest creatures' kinds, after it every near kind, closest first", () => {
  const field = [{ x: 30, z: 0, kind: 'salamander' }, { x: 5, z: 0, kind: 'goblin@L4' }, { x: 8, z: 0, kind: 'goblin@L4' }, { x: 12, z: 0, kind: 'goblin' }, { x: 90, z: 0, kind: 'troll' }];
  assert.deepEqual(fetchKinds(field, hero, 60, true, 3), ['goblin@L4', 'goblin'], 'the three nearest creatures are two goblin looks: the salamander waits');
  assert.deepEqual(fetchKinds(field, hero, 60, false, 3), ['goblin@L4', 'goblin', 'salamander'], 'ready: every in-range kind, nearest creature first; the troll is out of range');
  assert.deepEqual(fetchKinds(field, hero, 60, true, 0), [], 'a first-K of 0 fetches nothing before ready');
  assert.deepEqual(fetchKinds([], hero, 60, true, 3), []);
});
