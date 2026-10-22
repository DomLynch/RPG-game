// The Exchange greybox is ROWS (origins/preview/exchange-rows.json): the plan built from them equals the frozen code that used to build it (tests/lib/exchange-oracle.ts), exactly at the shipped anchors and within a hair
// when any anchor or rule value moves, so every landmark still carries its pieces. The loader refuses a broken row. Pure.
import './lib/era-off.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { exchangeAnchors, exchangePlan, FORGE_HALF, KERB_INSET, STONE_RADIUS, type Anchors } from '../origins/preview/exchange-plan.ts';
import { anchorValues, EXCHANGE_ROWS, loadExchangeRows, planFromRows, type Knobs } from '../origins/preview/exchange-rows.ts';
import DEFS from '../origins/preview/exchange-rows.json' with { type: 'json' };
import { oraclePlan } from './lib/exchange-oracle.ts';

const A = exchangeAnchors(), K: Knobs = { kerb: KERB_INSET, stone: STONE_RADIUS, forgeX: FORGE_HALF.x, forgeZ: FORGE_HALF.z };
const close = (x: unknown, y: unknown, path: string): void => {
  if (typeof x === 'number' && typeof y === 'number') return assert.ok(Math.abs(x - y) < 1e-9, `${path}: ${x} vs ${y}`);
  if (Array.isArray(x) && Array.isArray(y)) { assert.equal(x.length, y.length, `${path}: length`); return x.forEach((v, i) => close(v, y[i], `${path}[${i}]`)); }
  if (x && y && typeof x === 'object' && typeof y === 'object') { assert.deepEqual(Object.keys(x).sort(), Object.keys(y).sort(), `${path}: keys`); for (const k of Object.keys(x)) close((x as Record<string, unknown>)[k], (y as Record<string, unknown>)[k], `${path}.${k}`); return; }
  assert.equal(x, y, path);
};
const moveBy = (name: string, d: number): { a: Anchors; k: Knobs } => {
  const v = anchorValues(A, K); v[name] = v[name]! + d;
  return { a: { passage: { halfWidth: v['passage.halfWidth']!, from: v['passage.from']!, to: v['passage.to']! }, gate: { x: v['gate.x']!, z: v['gate.z']! }, halfWidth: v.halfWidth!, stone: { x: v['stone.x']!, z: v['stone.z']! },
    board: { x: v['board.x']!, z: v['board.z']! }, forge: { x: v['forge.x']!, z: v['forge.z']! }, bank: { x: v['bank.x']!, z: v['bank.z']! } }, k: { kerb: v.kerb!, stone: v.stone!, forgeX: v.forgeX!, forgeZ: v.forgeZ! } };
};

test('at the shipped anchors the rows build exactly what the code built', () => {
  assert.deepEqual(exchangePlan(), oraclePlan(A, K));
  assert.equal(EXCHANGE_ROWS.pieces.length, 215);
});
test('every anchor and rule value, moved a little, moves the same pieces by the same amounts as the code did', () => {
  for (const row of EXCHANGE_ROWS.anchors) for (const d of [0.05, -0.05]) {
    const { a, k } = moveBy(row.id, d);
    close(planFromRows(a, k), oraclePlan(a, k), `${row.id} ${d}`);
  }
});
test('every anchor and rule value moved together still matches the code', () => {
  let a = A, k = K;
  for (const [i, row] of EXCHANGE_ROWS.anchors.entries()) { const m = (() => { const v = anchorValues(a, k); v[row.id] = v[row.id]! + 0.03 * (i % 3 + 1); return v; })(); a = { passage: { halfWidth: m['passage.halfWidth']!, from: m['passage.from']!, to: m['passage.to']! }, gate: { x: m['gate.x']!, z: m['gate.z']! }, halfWidth: m.halfWidth!, stone: { x: m['stone.x']!, z: m['stone.z']! }, board: { x: m['board.x']!, z: m['board.z']! }, forge: { x: m['forge.x']!, z: m['forge.z']! }, bank: { x: m['bank.x']!, z: m['bank.z']! } }; k = { kerb: m.kerb!, stone: m.stone!, forgeX: m.forgeX!, forgeZ: m.forgeZ! }; }
  close(planFromRows(a, k), oraclePlan(a, k), 'all moved');
});
test('the loader refuses a duplicate id, a mistyped field, and a follow that names no anchor', () => {
  const rows = DEFS as unknown as Record<string, unknown[]>;
  assert.throws(() => loadExchangeRows({ ...rows, braziers: [...rows.braziers!, rows.braziers![0]!] }), /duplicate|brazier-000/i);
  assert.throws(() => loadExchangeRows({ ...rows, people: [{ id: 'p', x: 'no', z: 1, color: '#000' }] }), /people|exchange-person|number/i);
  assert.throws(() => loadExchangeRows({ ...rows, braziers: [{ id: 'b', x: 1, z: 1, follow: { x: { 'no.such': 1 } } }] }), /no anchor row/);
});
