// The Frontier plan's collision and view numbers are rows (origins/preview/frontier-plan-defs.json; Web, Lead's split 2026-10-18): every default equals the literal it replaced,
// the loader refuses a broken table, and the plan's solids come out exactly as before.
import assert from 'node:assert/strict';
import test from 'node:test';
import { FRONTIER_PLAN, frontierBlock, frontierRule, loadFrontierPlanRules } from '../origins/preview/frontier-plan-rules.ts';
import { frontierBuild, frontierPlan, inFirstView, onRoad } from '../origins/preview/frontier-plan.ts';
import DEFS from '../origins/preview/frontier-plan-defs.json' with { type: 'json' };

test('every frontier plan rule equals the literal it replaced', () => {
  assert.deepEqual(['giverStand', 'roadInset', 'roadEnd', 'roadBody'].map((id) => frontierRule(id as never)), [4.5, 2.5, 0.5, 0.35]);   // standBefore's 4.5 m, onRoad's -2.5 / +0.5 / -0.35
  assert.deepEqual(['viewBehind', 'viewAhead', 'viewSide', 'viewRing'].map((id) => frontierRule(id as never)), [10, 60, 10, 14]);   // inFirstView's -10 / 60 / +10 / +14
  assert.deepEqual(['gatePostBack', 'gatePostSide', 'gatePostR', 'ruinPostSide', 'ruinPostR'].map((id) => frontierRule(id as never)), [0.4, 2.4, 0.5, 2.6, 0.8]);   // the link gate posts and the ruin's gate posts
  assert.deepEqual(['centreR', 'milestoneR', 'shrineR', 'cairnR', 'blockPad'].map((id) => frontierRule(id as never)), [1.5, 0.5, 1.3, 0.6, 0.3]);   // the solid radii (a building's is max(w, d) / 2 + blockPad)
  assert.deepEqual(['ringHouses', 'ringRadius', 'ringPhase', 'ringKeepClear', 'ringMargin'].map((id) => frontierRule(id as never)), [8, 15, 0.3, 9, 6]);   // the town's ring of houses
  assert.equal(FRONTIER_PLAN.rules.length, 23, 'a new row is a deliberate change: update this count and say why');
});

test('every building footprint equals the BLOCKS literal it replaced', () => {
  const was: Record<string, [number, number]> = { hall: [10, 8], forge: [6, 6], jail: [5, 5], healer: [6, 5], fence: [3, 1.4], house: [8, 6], boathouse: [9, 7], watchtower: [3.5, 3.5], crypt: [8, 8] };
  assert.deepEqual(Object.fromEntries(FRONTIER_PLAN.blocks.map((b) => [b.kind, [b.w, b.d]])), was);
  assert.equal(frontierBlock('hall')!.w, 10); assert.equal(frontierBlock('milestone'), undefined, 'a landmark kind that is not a block has no footprint');
});

test('a building\'s solid radius is a formula of its footprint and blockPad, never its own row', () => {
  const allowed = new Set([...FRONTIER_PLAN.blocks.map(({ w, d }) => Math.max(w, d) / 2 + frontierRule('blockPad')), ...['gatePostR', 'ruinPostR', 'centreR', 'milestoneR', 'shrineR', 'cairnR'].map((id) => frontierRule(id as never))].map((r) => Math.round(r * 1e6)));
  const solids = frontierBuild(frontierPlan(true)).solids;
  assert.ok(solids.length > 0 && solids.every((s) => allowed.has(Math.round(s.r * 1e6))), 'every solid radius is a row or the footprint formula');
  assert.equal(Math.max(10, 8) / 2 + frontierRule('blockPad'), 5.3, 'the hall: 10 x 8 -> 5.3');
  assert.ok(!DEFS.rules.some((r) => /block.*R$/i.test(r.id)), 'no per-kind radius row');
});

test('the walk and view helpers behave exactly as with the literals', () => {
  const f = frontierPlan(true), r = f.road, ux = Math.sin(r.facing), uz = Math.cos(r.facing), len = Math.hypot(r.to.x - r.from.x, r.to.z - r.from.z);
  const at = (along: number, across = 0) => ({ x: r.from.x + ux * along - uz * across, z: r.from.z + uz * along + ux * across });
  const walk = (along: number, across = 0) => onRoad(f, at(along, across).x, at(along, across).z);
  assert.deepEqual([walk(-2.6), walk(-2.4), walk(len + 0.4), walk(len + 0.6)], [false, true, true, false], 'along: from -2.5 to len + 0.5');
  assert.deepEqual([walk(10, r.width / 2 - 0.36), walk(10, r.width / 2 - 0.34)], [true, false], 'across: width / 2 - 0.35');
  const view = (along: number, across = 0) => inFirstView(f, at(along, across).x, at(along, across).z, 0);
  assert.deepEqual([view(-10.1), view(-9.9), view(59.9), view(60.1)], [false, true, true, false], 'along: -10 .. 60');
  assert.deepEqual([view(20, r.width / 2 + 9.9), view(20, r.width / 2 + 10.1)], [true, false], 'across: width / 2 + r + 10');
});

test('the loader refuses a missing named rule, a non-positive value, a bad footprint and a duplicate id', () => {
  const rules = DEFS.rules, blocks = DEFS.blocks;
  assert.throws(() => loadFrontierPlanRules({ rules: rules.filter((r) => r.id !== 'roadInset'), blocks }), /"roadInset" rule by name/);
  assert.throws(() => loadFrontierPlanRules({ rules: rules.map((r) => (r.id === 'viewAhead' ? { ...r, value: 0 } : r)), blocks }), /value is a number > 0/);
  assert.throws(() => loadFrontierPlanRules({ rules, blocks: blocks.map((b) => (b.kind === 'hall' ? { ...b, d: 0 } : b)) }), /w and d are numbers > 0/);
  assert.throws(() => loadFrontierPlanRules({ rules: [...rules, rules[0]!], blocks }), /duplicate|twice|unique/i);
  assert.throws(() => loadFrontierPlanRules({ rules, blocks: [...blocks, blocks[0]!] }), /duplicate|twice|unique/i);
});
