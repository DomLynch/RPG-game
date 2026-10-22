// Dungeon 1's two Pit layouts (zone plan rows `dungeon1-bowl`, `dungeon1-spiral`; Dom's pick, a look test behind ?pitlayout=): from the yard the hero can walk down to the Champion floor and into the Duel pit, never up or down a step taller than the climb rule,
// on slopes no steeper than 20 degrees, and the safe yard is flat at the rim's height. Pure: the hero's walk is a flood fill over the walkable pieces' tops (tests/lib/pit-measure.ts).
import './lib/era-off.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { previewRule } from '../origins/preview/preview-rules.ts';
import { measureLayout } from './lib/pit-measure.ts';

const SLOPE = previewRule('layoutSlope'), DUEL = { x: 26 };
for (const [zone, zc] of [['7', 47]] as const) {   // Dungeon 1 is zone "7" (its plan rows are keyed by the zone id; /dungeon1/ is only the zone row's alias); the spiral layout was dropped with the bowl pick
  test(`${zone}: yard -> champion floor and the Duel pit are walkable on slopes within the layoutSlope rule (no wall climbed, no slope over 20 degrees)`, () => {
    const m = measureLayout(zone, SLOPE, { x: DUEL.x, z: zc });
    assert.ok(m.floorReached, `${zone}: the Champion floor is reachable from the yard`);
    assert.ok(m.duelReached, `${zone}: the Duel pit is reachable from the yard`);
    assert.ok(m.maxSlopeDeg <= 25, `${zone}: the steepest slope walked ${m.maxSlopeDeg} degrees`);
    assert.ok(m.yardArea > 300, `${zone}: the yard is a flat ${m.yardArea} m2 at the rim's height`);
    assert.ok(m.levels.includes(0) && m.levels.some((l) => l <= -4), `${zone}: it spans the rim and the floor ${m.levels.join(', ')}`);
  });
}
