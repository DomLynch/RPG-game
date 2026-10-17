// The remote heroes' far tiers (origins/preview/remote-tiers.ts, remote-impostor-rules.ts): who is drawn how, which baked view faces the camera, and the rows the tiers read.
import assert from 'node:assert/strict';
import test from 'node:test';
import { impostorRule, loadImpostorRules } from '../origins/preview/remote-impostor-rules.ts';
import DEFS from '../origins/preview/remote-impostor-defs.json' with { type: 'json' };
import { assignTiers, viewCell } from '../origins/preview/remote-tiers.ts';

const at = (id: number, d: number) => ({ id, x: d, z: 0 });
const hero = { x: 0, z: 0 };

test('the nearest take the full figure, the next the middle tier, the rest the impostor, and anything past the range is not drawn', () => {
  const list = [at(7, 90), at(1, 3), at(2, 5), at(3, 7), at(4, 9), at(5, 11), at(6, 13), at(8, 79)];
  const t = assignTiers(list, hero, { full: 2, mid: 2, range: 80 });
  assert.deepEqual(t.full, [1, 2]);
  assert.deepEqual(t.mid, [3, 4]);
  assert.deepEqual(t.far, [5, 6, 8]);
  assert.deepEqual(t.dropped, [7]);
});

test('a tie in distance breaks by id, so a figure never flips tier between two frames of the same positions', () => {
  const a = assignTiers([at(9, 5), at(2, 5), at(4, 5)], hero, { full: 1, mid: 1, range: 80 }), b = assignTiers([at(4, 5), at(9, 5), at(2, 5)], hero, { full: 1, mid: 1, range: 80 });
  assert.deepEqual(a, b);
  assert.deepEqual(a.full, [2]);
});

test('the shipped rows keep the nearest 8 full and draw nothing past 80 m, and 40 figures split 8 / 16 / 16', () => {
  assert.deepEqual([impostorRule('tierFull'), impostorRule('tierMid'), impostorRule('tierRange')], [8, 16, 80]);
  const list = Array.from({ length: 40 }, (_, i) => at(i + 1, 4 + i));
  const t = assignTiers(list, hero, { full: impostorRule('tierFull'), mid: impostorRule('tierMid'), range: impostorRule('tierRange') });
  assert.deepEqual([t.full.length, t.mid.length, t.far.length, t.dropped.length], [8, 16, 16, 0]);
});

test('viewCell: seen from the front is cell 0, from behind is half the cells round, and it wraps', () => {
  assert.equal(viewCell(0, 0, 8), 0);
  assert.equal(viewCell(0, Math.PI, 8), 4);
  assert.equal(viewCell(0, Math.PI / 4, 8), 1);
  assert.equal(viewCell(Math.PI / 4, 0, 8), 7, 'the figure turned a cell the other way: the viewer is a cell back');
  assert.equal(viewCell(0, Math.PI * 2 - 0.01, 8), 0, 'just under a full turn rounds back to the front');
  assert.equal(viewCell(-3 * Math.PI, 0.1, 8), viewCell(Math.PI, 0.1, 8), 'angles beyond a turn wrap');
});

test('the rules loader refuses a missing named row, a non-positive value and a duplicate id', () => {
  const rows = DEFS.rules;
  assert.throws(() => loadImpostorRules({ rules: rows.filter((r) => r.id !== 'tierRange') }), /"tierRange" rule by name/);
  assert.throws(() => loadImpostorRules({ rules: rows.map((r) => (r.id === 'tierFull' ? { ...r, value: 0 } : r)) }), /value is a number > 0/);
  assert.throws(() => loadImpostorRules({ rules: [...rows, rows[0]!] }), /duplicate|twice|unique/i);
});
