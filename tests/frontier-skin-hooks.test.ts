// The Test Zone's building-skin and clutter-thinning hooks, ported onto trunk's plan / greybox split (Web, Lead's ruling 2026-10-18; promotion-list.md). With no skin and Thin = WHOLE the build is exactly what it was
// (the digest pins below are the pre-port values); a skin changes what is DRAWN and never what a player can bump into, except that a skin which leaves a plain landmark bare leaves nothing standing there.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Piece } from '../origins/preview/exchange-plan.ts';
import { frontierBuild, frontierPlan, edgeDistance, rimScale, type Build, type BuildingSkin, type Frontier } from '../origins/preview/frontier-plan.ts';
import { frontierRule } from '../origins/preview/frontier-plan-rules.ts';
import { WHOLE, frontierDress, type Thin } from '../origins/preview/frontier-dress.ts';
import { cinderDress } from '../origins/preview/frontier-cinder.ts';

const MARK: [number, number, number] = [0.9, 0.1, 0.9];
const mk = (x: number, z: number): Piece => ({ layer: 'stone', shape: ['box', 1, 1, 1], x, y: 0.5, z, tint: MARK, rotY: 0, foot: 0 });
type Calls = { model: string[]; parts: string[]; landmark: string[] };
/** A fake skin: every question is recorded; `with` says what it answers. */
function skin(calls: Calls, answer: { model?: (kind: string, strict: boolean) => boolean; parts?: boolean; gate?: boolean; marker?: boolean }): BuildingSkin {
  return {
    model: (kind, x, z, facing, w, d, strict = false) => { calls.model.push(`${kind}${strict ? '!' : ''}`); return answer.model?.(kind, strict) ? { node: `n_${kind}`, x, z, rotY: facing, scale: Math.min(w, d) } : null; },
    parts: (kind, x, z) => { calls.parts.push(kind); return answer.parts ? [mk(x, z)] : null; },
    landmark: (kind, x, z) => { calls.landmark.push(kind); return (kind === 'gate' ? answer.gate : kind === 'marker' ? answer.marker : false) ? [mk(x, z)] : null; },
  };
}
const fresh = (): Calls => ({ model: [], parts: [], landmark: [] });
const f: Frontier = frontierPlan(true);
const base = frontierBuild(f);
const solidsKey = (b: Build) => JSON.stringify(b.solids);
const brickCount = (b: Build) => b.pieces.filter((p) => !(p.tint[0] === MARK[0] && p.tint[1] === MARK[1])).length;

test('no skin: the build is what it was (Zone 1 pins) and has no models', () => {
  assert.deepEqual([base.pieces.length, base.solids.length, base.people.length, base.boards.length, base.models.length], [175, 60, 8, 21, 0]);   // 174/59 -> 175/60 (2026-10-20, the `shrine-field` landmark's stone post and collider)
  assert.equal(JSON.stringify(frontierBuild(f, null)), JSON.stringify(base), 'null skin = default');
});

test('a skin with no models, parts or gate changes nothing but the plain landmarks it leaves bare', () => {
  const c = fresh(), b = frontierBuild(f, skin(c, {}));
  const cairn = (p: Piece) => p.shape[0] === 'box' && p.shape[1] === 0.8 && p.shape[2] === 1 && p.shape[3] === 0.8, cairnR = frontierRule('cairnR');
  assert.equal(JSON.stringify(b.pieces), JSON.stringify(base.pieces.filter((p) => !cairn(p))), 'every piece but the stone cairns');
  assert.equal(JSON.stringify(b.solids), JSON.stringify(base.solids.filter((s) => s.r !== cairnR)), 'every solid but the cairns\'');
  assert.deepEqual([b.people, b.boards, b.models], [base.people, base.boards, []]);
  assert.ok(c.model.length > 0 && c.parts.length > 0 && c.landmark.length > 0, 'the plan asked the skin about blocks, ways on and landmarks');
});

test('a skin changes what is drawn, never what is solid: footprints, gate posts and ruin posts stay put', () => {
  for (const answer of [{ parts: true, gate: true, marker: true }, { model: () => true, marker: true }, { model: (_k: string, strict: boolean) => strict, parts: true, marker: true }]) {
    const b = frontierBuild(f, skin(fresh(), answer));
    assert.equal(solidsKey(b), solidsKey(base), 'every solid identical when the skin dresses every landmark');
    assert.notEqual(JSON.stringify(b.pieces), JSON.stringify(base.pieces), 'but the drawing differs');
  }
});

test('model stands replace the brick block (models pushed, brick pieces gone), parts replace it with the skin\'s own pieces', () => {
  const m = frontierBuild(f, skin(fresh(), { model: (k, strict) => !strict && k !== 'gate', marker: true }));
  assert.ok(m.models.length > 0, 'blocks stand as model nodes');
  assert.ok(m.models.every((p) => /^n_/.test(p.node) && Number.isFinite(p.scale) && Number.isFinite(p.rotY)));
  assert.ok(brickCount(m) < brickCount(base), 'the brick boxes, eaves and door are gone where a model stands');
  const p = frontierBuild(f, skin(fresh(), { parts: true, marker: true }));
  assert.equal(p.models.length, 0);
  assert.ok(p.pieces.some((x) => x.tint[0] === MARK[0]), 'the skin\'s parts are in the build');
});

test('the gate is asked strictly (its own fit only, never the default fit), blocks are not', () => {
  const c = fresh();
  frontierBuild(f, skin(c, { parts: true, marker: true }));
  assert.ok(c.model.some((q) => q === 'gate!'), 'a gate asks strict');
  assert.ok(c.model.some((q) => q === 'house') && !c.model.some((q) => q === 'house!'), 'a block asks non-strict (default fit allowed)');
  assert.ok(c.landmark.includes('gate') && c.landmark.includes('marker'));
});

test('a skin that leaves the plain landmark bare leaves nothing to bump into; one with a marker keeps the cairn solid', () => {
  const bare = frontierBuild(f, skin(fresh(), { parts: true, gate: true })), marked = frontierBuild(f, skin(fresh(), { parts: true, gate: true, marker: true }));
  const cairns = (b: Build) => b.solids.filter((s) => s.r === frontierRule('cairnR')).length;
  assert.ok(cairns(base) > 0, 'Zone 1 has plain landmarks');
  assert.equal(cairns(bare), 0, 'bare: no cairn, no solid');
  assert.equal(cairns(marked), cairns(base), 'marked: a marker stands where the cairn stood, with the same solid');
  assert.equal(base.solids.length - bare.solids.length, cairns(base));
});

test('Thin = WHOLE is the dress as it was; a thinner dress has less of exactly the kinds it names, and reports its road strips', () => {
  const whole = frontierDress(f, base), explicit = frontierDress(f, base, WHOLE);
  assert.equal(JSON.stringify(explicit), JSON.stringify(whole), 'WHOLE = the default');
  assert.ok(whole.strips && whole.strips.length > 0, 'the worn roads and hubs are reported');
  const none: Thin = { ...WHOLE, rocks: 0, ruins: 0, fill: 0, posts: 0, walls: 0 };
  const thin = frontierDress(f, base, none);
  assert.ok(thin.pieces.length < whole.pieces.length, 'no rocks, ruins, fill or posts: fewer props');
  assert.equal(JSON.stringify(thin.strips), JSON.stringify(whole.strips), 'the roads do not thin');
  const cWhole = cinderDress(f, base, whole), cThin = cinderDress(f, base, whole, { ...WHOLE, drifts: 0, rings: 0, cracks: 0, scrub: 0, trees: 0, skyline: 0 });
  assert.ok(cThin.ground.length + cThin.pieces.length < cWhole.ground.length + cWhole.pieces.length, 'the cinder pass thins too');
});

test('the soft rim: 1 beyond the margin, easing down to `slow` at the edge; edgeDistance is negative outside the zone', () => {
  assert.equal(rimScale(10, 4, 0.5), 1); assert.equal(rimScale(4, 4, 0.5), 1); assert.equal(rimScale(0, 4, 0.5), 0.5); assert.equal(rimScale(2, 4, 0.5), 0.75); assert.equal(rimScale(-3, 4, 0.5), 0.5);
  assert.equal(rimScale(1, 0, 0.5), 1, 'no margin: no rim');
  const z = f.zones.find((q) => q.region === ('region:ash-frontier' as never))!;
  assert.ok(Number.isFinite(edgeDistance(z, z.mount.x, z.mount.z)), 'a finite distance at the zone\'s mount');
  assert.ok(edgeDistance(z, z.mount.x + 10_000, z.mount.z + 10_000) < 0, 'far outside the zone');
});
