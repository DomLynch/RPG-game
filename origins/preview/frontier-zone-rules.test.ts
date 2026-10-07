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

// Region 1 as authored does NOT pass all three rules today. These two are named, not hidden: the build stays green only while exactly these fail, so a new
// failure fails it, and fixing one (more creatures, or ferry-landing marked safe, Strategy's call) fails it until the entry is removed here.
const KNOWN: Record<string, string> = {
  'late-fight ferry-landing': 'an unsafe zone with no creature (a landing and its houses); either it is safe or it needs a creature near the entry',
  'late-fight cinder-fields': 'the nearest creature is 52.1 m from the entry, a hair over the 52 m limit; one scavenger a few metres nearer fixes it',
};

test('Region 1 against the zone rules: no zone is over 45 s across and none is dead for 15 s; the two known late-fight misses are exactly the ones named above', () => {
  const failures = F.zones.flatMap((z) => checkZone(sketch(z)));
  const got = failures.map((i) => `${i.code} ${i.zone}`).sort();
  assert.deepEqual(got, Object.keys(KNOWN).sort(), `each failure is named: ${failures.map((i) => i.message).join(' | ')}`);
});
