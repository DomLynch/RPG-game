// A zone's plan is ROWS (origins/zones/plan-rows.json, any zone can carry one; the Concord Exchange is the first): the plan built from them equals the frozen code that used to build it (tests/lib/exchange-oracle.ts), exactly at the
// shipped anchors and within a hair when any anchor source moves, so every landmark still carries its pieces. The loader refuses a broken row; a zone with no rows has no plan. Pure.
import './lib/era-off.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { exchangeAnchors, exchangePlan, exchangeSources, FORGE_HALF, KERB_INSET, STONE_RADIUS, type Anchors, type Knobs } from '../origins/preview/exchange-plan.ts';
import { loadPlanRows, PLAN_ROWS, planFor, planSources, planZones } from '../origins/zones/plan.ts';
import DEFS from '../origins/zones/plan-rows.json' with { type: 'json' };
import { oraclePlan } from './lib/exchange-oracle.ts';

const A = exchangeAnchors(), K: Knobs = { kerb: KERB_INSET, stone: STONE_RADIUS, forgeX: FORGE_HALF.x, forgeZ: FORGE_HALF.z };
const close = (x: unknown, y: unknown, path: string): void => {
  if (typeof x === 'number' && typeof y === 'number') return assert.ok(Math.abs(x - y) < 1e-9, `${path}: ${x} vs ${y}`);
  if (Array.isArray(x) && Array.isArray(y)) { assert.equal(x.length, y.length, `${path}: length`); return x.forEach((v, i) => close(v, y[i], `${path}[${i}]`)); }
  if (x && y && typeof x === 'object' && typeof y === 'object') { assert.deepEqual(Object.keys(x).sort(), Object.keys(y).sort(), `${path}: keys`); for (const k of Object.keys(x)) close((x as Record<string, unknown>)[k], (y as Record<string, unknown>)[k], `${path}.${k}`); return; }
  assert.equal(x, y, path);
};
/** The anchors and rule values as the source map says (the inverse of exchangeSources), so the oracle can be built from a moved map. */
const fromSources = (m: Record<string, number>): { a: Anchors; k: Knobs } => ({
  a: { passage: { halfWidth: m['passage:gladiator-gate.halfWidth']!, from: m['passage:gladiator-gate.from']!, to: m['passage:gladiator-gate.to']! }, gate: { x: m['landmark:outer-gate.x']!, z: m['landmark:outer-gate.z']! }, halfWidth: m['width:half']!,
    stone: { x: m['landmark:covenant-stone.x']!, z: m['landmark:covenant-stone.z']! }, board: { x: m['landmark:contract-board.x']!, z: m['landmark:contract-board.z']! }, forge: { x: m['landmark:forge.x']!, z: m['landmark:forge.z']! }, bank: { x: m['landmark:bank.x']!, z: m['landmark:bank.z']! } },
  k: { kerb: m['rule:stage.kerbInset']!, stone: m['rule:stage.stoneRadius']!, forgeX: m['rule:preview.forgeHalfX']!, forgeZ: m['rule:preview.forgeHalfZ']! },
});
const base = exchangeSources(A, K), sources = planSources('exchange');
// The oracle is the greybox as the code built it: the kit's `skin` / `cover` / `scale` fields (the town 3D kit, plan-rows.json) are rows on top of it, so they come off before the pin.
const greybox = <T extends { pieces: readonly object[]; people: readonly object[] }>(plan: T): T => ({ ...plan, pieces: plan.pieces.map((p) => { const { skin: _s, cover: _c, scale: _k, skinOff: _o, ...rest } = p as Record<string, unknown>; return rest; }), people: plan.people.map((f) => { const { npc: _n, ...rest } = f as Record<string, unknown>; return rest; }) }) as unknown as T;   // + a person's `npc` (their body row, town people)
const compare = (m: Record<string, number>, what: string) => { const { a, k } = fromSources(m); close(greybox(planFor('exchange', (s) => m[s]!)!), oraclePlan(a, k), what); };

test('the Exchange carries a plan; every source its anchors name is one its world data answers, and none is left unread', () => {
  assert.deepEqual(planZones(), ['exchange']);
  assert.deepEqual([...sources].sort(), Object.keys(base).sort());
});
test('at the shipped anchors the rows build exactly what the code built', () => {
  assert.deepEqual(greybox(exchangePlan()), oraclePlan(A, K));
  assert.equal(PLAN_ROWS.pieces.filter((p) => p.zone === 'exchange').length, 215);
});
test('every source, moved a little, moves the same pieces by the same amounts as the code did', () => {
  for (const s of sources) for (const d of [0.05, -0.05]) compare({ ...base, [s]: base[s]! + d }, `${s} ${d}`);
});
test('every source moved together still matches the code', () => {
  const m = { ...base }; sources.forEach((s, i) => { m[s] = m[s]! + 0.03 * ((i % 3) + 1); });
  compare(m, 'all moved');
});
test('a zone with no plan rows has no plan', () => { assert.equal(planFor('zone-701', () => 0), null); });
test('a minimal zone: one anchor, one piece, no frieze, no hearth, no figures; it loads and builds, and the marks are simply absent', () => {
  const rows = loadPlanRows({
    anchors: [{ id: 'mini/gate.x', zone: 'mini', source: 'landmark:gate.x', base: 10 }],
    pieces: [{ id: 'mini/wall-0', zone: 'mini', layer: 'stone', shape: ['box', 2, 3, 4], x: 10, y: 1.5, z: 0, tint: [1, 1, 1], rotY: 0, foot: 0, follow: { x: { 'gate.x': 1 } } }],
    awnings: [], people: [], braziers: [], marks: [],
  });
  const plan = planFor('mini', (s) => (s === 'landmark:gate.x' ? 12.5 : NaN), rows)!;
  assert.equal(plan.pieces.length, 1); assert.equal(plan.pieces[0]!.x, 12.5, 'the wall followed its gate');
  assert.equal(plan.frieze, undefined); assert.equal(plan.hearth, undefined);
  assert.deepEqual([plan.awnings, plan.people, plan.braziers], [[], [], []]);
});
test('the loader refuses a duplicate id, a mistyped field, an id outside its zone, and a follow that names no anchor of the zone', () => {
  const rows = DEFS as unknown as Record<string, unknown[]>;
  assert.throws(() => loadPlanRows({ ...rows, braziers: [...rows.braziers!, rows.braziers![0]!] }), /duplicate|brazier-000/i);
  assert.throws(() => loadPlanRows({ ...rows, people: [{ id: 'exchange/p', zone: 'exchange', x: 'no', z: 1, color: '#000' }] }), /people|plan-person|number/i);
  assert.throws(() => loadPlanRows({ ...rows, braziers: [{ id: 'town/b', zone: 'exchange', x: 1, z: 1 }] }), /starts with its zone/);
  assert.throws(() => loadPlanRows({ ...rows, braziers: [{ id: 'exchange/b', zone: 'exchange', x: 1, z: 1, follow: { x: { 'no.such': 1 } } }] }), /no anchor row of zone/);
});
