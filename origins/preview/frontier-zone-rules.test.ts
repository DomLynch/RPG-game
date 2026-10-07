// Region 1 against the zone rules (origins/world/zone-rules.ts), unchanged: every Ash Frontier zone, from the plan the preview walks and the creatures it
// places. A zone that fails is named in the assertion message. Towns and the Concord zones are safe (no fight needed); the rest are held to all three rules.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkZone, type ZoneSketch } from '../world/zone-rules.ts';
import { FRONTIER, frontierBuild, frontierPlan } from './frontier-plan.ts';
import { mobSpecs } from './mobs.ts';

const F = frontierPlan(), SPECS = mobSpecs(F, frontierBuild(F));
// World metres. The entry is the zone's mount (the middle of its entry edge); landmarks are the stops; the creatures' homes are the creatures.
const sketch = (z: (typeof F.zones)[number]): ZoneSketch => ({
  name: z.zone, width: z.width, depth: z.depth, entry: { x: z.mount.x, z: z.mount.z },
  stops: Object.values(z.landmarks).map((l) => ({ x: l.x, z: l.z })), creatures: SPECS.filter((s) => s.zone === z.zone).map((s) => ({ x: s.home.x, z: s.home.z })),
  safe: z.town !== null || z.region !== FRONTIER,
});

test('Region 1 passes the zone rules, all three, with no exceptions: not over 45 s across, never dead for 15 s, and every unsafe zone opens with a fight inside 10 s', () => {
  const failures = F.zones.flatMap((z) => checkZone(sketch(z)));
  assert.deepEqual(failures.map((i) => i.message), [], 'every failing zone is named above');
});
