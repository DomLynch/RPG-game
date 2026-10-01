// The gate machinery's pose (src/pit/machinery.ts): the file's own rest poses at 0, the counterweight on the floor and the chain still joining it to
// the drum at 1, and one smooth path between. Pure numbers; room.ts applies them (tests/pit-room.test.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraSpots, machineryPose } from '../src/pit/machinery.ts';

const near = (a: number, b: number, why: string) => assert.ok(Math.abs(a - b) < 1e-6, `${why}: ${a} vs ${b}`);

test('at rest every node is where the file has it: no rotation, no stretch, the counterweight up', () => {
  const p = machineryPose(0);
  near(p.drum, 0, 'drum'); near(p.side.y, 2.385, 'side chain'); near(p.side.scaleY, 1, 'side stretch'); assert.equal(p.side.visible, true);
  near(p.weight, 1.78, 'counterweight'); near(p.weightChain.y, 2.425, 'weight chain'); near(p.weightChain.scaleY, 1, 'weight chain stretch');
});

test('seated (1): the counterweight stands on the floor, its chain still hangs from the drum to it, the side chains are wound up', () => {
  const p = machineryPose(1);
  near(p.weight - 0.29, 0, 'the counterweight\'s foot on the floor');
  const top = p.weightChain.y + (0.7428 * p.weightChain.scaleY) / 2, bottom = p.weightChain.y - (0.7428 * p.weightChain.scaleY) / 2;
  near(top, 2.425 + 0.7428 / 2, 'the chain\'s top stays at the drum'); near(bottom, p.weight + 0.29, 'its foot meets the counterweight');
  assert.equal(p.side.visible, false, 'the side chains are wound on the drum');
  assert.ok(p.drum < -8, `the drum has turned about ${(-p.drum / (2 * Math.PI)).toFixed(1)} turns for the bars' 2.3 m`);
});

test('a smooth path: the drum and the counterweight move one way as the bars rise, the side chains shorten then vanish', () => {
  let drum = 0, weight = 1.78, side = 1;
  for (let p = 0.05; p <= 1.0001; p += 0.05) {
    const pose = machineryPose(p);
    assert.ok(pose.drum <= drum + 1e-9 && pose.weight <= weight + 1e-9 && pose.side.scaleY <= side + 1e-9, `monotonic at ${p.toFixed(2)}`);
    drum = pose.drum; weight = pose.weight; side = pose.side.scaleY;
  }
  assert.deepEqual(machineryPose(-1), machineryPose(0), 'clamped below'); assert.deepEqual(machineryPose(3), machineryPose(1), 'clamped above');
});

test('the floor pieces stand inside the room, off the walking floor\'s middle, clear of the gate\'s opening', () => {
  const hw = 5, hd = 3.75;
  for (const [x, z] of Object.values(extraSpots(hw, hd))) {
    assert.ok(Math.abs(x) < hw - 0.3 && z > -hd && z < -hd + 1.2, `(${x}, ${z}) is in the gate wall's foot strip`);
    assert.ok(Math.abs(x) > 0.9 + 0.3 || z > -hd + 0.4, 'not in the way out');
  }
});
