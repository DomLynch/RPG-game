// Zone 1 quality step 1 in the preview: the hills sit only in the open ground. Everything the plan and the dressing put down keeps flat ground under it, the zone edges fade to 0, the hills
// stay within the zone's relief, the build is deterministic, and ?relief=0 gives back the flat plan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { frontierBuild, frontierPlan, FRONTIER, inZone, toZone } from './frontier-plan.ts';
import { frontierDress } from './frontier-dress.ts';
import { groundAt, reliefZones, zoneHeight } from './frontier-relief.ts';

const plan = frontierPlan(), build = frontierBuild(plan), dress = frontierDress(plan, build), zones = reliefZones(plan, build, dress);

test('every Frontier zone is relieved by the region data (gentle hills, 1.5 m), and the Exchange zones are not', () => {
  const fr = plan.zones.filter((z) => z.region === FRONTIER);
  assert.ok(fr.length >= 6 && zones.length === fr.length, `${zones.length} of ${fr.length}`);
  for (const z of fr) { assert.equal(z.relief.relief, 1.5); assert.equal(z.relief.hillScale, 40); assert.ok(z.relief.seed > 0, 'the zone id seeds it'); }
  assert.ok(new Set(fr.map((z) => z.relief.seed)).size === fr.length, 'each zone its own landscape');
});

test('every landmark, building, prop and solid stands on flat ground', () => {
  let n = 0;
  for (const rz of zones) {
    const flat = (what: string, x: number, z: number) => { if (inZone(rz.zone, x, z)) { n++; assert.ok(Math.abs(groundAt(zones, x, z)) < 1e-9, `${rz.zone.zone} ${what} ${x.toFixed(1)},${z.toFixed(1)} at ${groundAt(zones, x, z)}`); } };
    for (const [name, a] of Object.entries(rz.zone.landmarks)) flat(`landmark ${name}`, a.x, a.z);
    for (const p of [...build.pieces.filter((q) => q.y > 0.05), ...dress.ground, ...dress.pieces]) flat(`${p.shape[0]} piece`, p.x, p.z);
    for (const s of [...build.solids, ...dress.solids]) flat('solid', s.x, s.z);
    for (const person of build.people) flat('person', person.x, person.z);
  }
  assert.ok(n > 200, `a real sample: ${n}`);
});

test('the open ground has hills, within the zone relief, and every zone edge is at 0', () => {
  let high = 0;
  for (const rz of zones) {
    const { zone } = rz;
    for (let i = 0; i <= 20; i++) for (let j = 0; j <= 20; j++) {
      const w = { x: (i / 20 - 0.5) * zone.width, d: (j / 20) * zone.depth }, s = Math.sin(zone.mount.heading), c = Math.cos(zone.mount.heading);
      const x = zone.mount.x - w.x * c + w.d * s, z = zone.mount.z + w.x * s + w.d * c;   // toWorld, inlined
      const p = toZone(zone, x, z); assert.ok(Math.abs(p.x - w.x) < 1e-6 && Math.abs(p.d - w.d) < 1e-6, 'the frame round-trips');
      const h = zoneHeight(rz, x, z); assert.ok(Math.abs(h) <= zone.relief.relief + 1e-9); high = Math.max(high, Math.abs(h));
      if (i === 0 || i === 20 || j === 0 || j === 20) assert.ok(Math.abs(h) < 1e-9, `edge ${zone.zone} ${i},${j}: ${h}`);
    }
  }
  assert.ok(high > 0.4, `some open ground really is hilly (highest ${high.toFixed(2)} m)`);
});

test('the build is deterministic, and outside every zone the ground is 0', () => {
  const again = reliefZones(plan, build, dress);
  for (const [x, z] of [[-50, 20], [-80, 5], [10, 10]]) assert.equal(groundAt(zones, x, z), groundAt(again, x, z));
  assert.equal(groundAt(zones, 9999, 9999), 0);
});

test('?relief=0 (flat) is the old greybox: no relief, the plane back at its old height', () => {
  const flat = frontierPlan(true), fb = frontierBuild(flat);
  assert.equal(reliefZones(flat, fb, frontierDress(flat, fb)).length, 0);
  const plane = (b: ReturnType<typeof frontierBuild>) => b.pieces.filter((p) => p.shape[0] === 'box' && p.shape[2] === 0.4).map((p) => p.y);
  assert.ok(plane(fb).every((y) => y >= -0.2 - 0.004 * 20 - 1e-9), 'flat: planes at their old heights');
  assert.ok(plane(build).some((y) => y <= -1.5), 'relieved: the planes sit 1.5 m lower under the hills');
});
