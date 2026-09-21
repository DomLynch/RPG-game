// The blade seam pin: every (rig, weapon) pair the game can put in a hand has its own baked table, with every combat path the weapon's
// moves need, and the lookup never serves another rig's sweep. A pair missing here is a fight that would throw in play (src/blade.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { bladePathsByRig } from '../src/blade-paths.ts';
import { bladeFrames, bladePose } from '../src/blade.ts';
import { createFighter, opponentFighter } from '../src/duel.ts';
import { OPPONENTS, PLAYER_WEAPONS, WEAPONS, type WeaponId } from '../src/moves.ts';
import { ROSTER } from '../src/roster.ts';
import { TARGET } from '../src/sim.ts';

const pairs = (): [string, string, string][] => [
  ...Object.values(OPPONENTS).map((o): [string, string, string] => [o.id, o.rig, o.weapon]),
  ...PLAYER_WEAPONS.map((w): [string, string, string] => ['player', 'hero', w]),
];

test('blade rig pin: every opponent (held ones too) and every weapon the player can carry has a baked table on its rig with every combat path', () => {
  for (const [who, rig, weapon] of pairs()) {
    const table = bladePathsByRig[rig]?.[weapon];
    assert.ok(table, `${who}: ${weapon} has no table on the ${rig} rig`);
    for (const kind of Object.keys(WEAPONS[weapon as WeaponId].paths)) {
      const frames = bladeFrames(rig, weapon, kind);
      assert.ok(frames.length > 1 && frames.every(f => f.length === 6), `${who}: ${weapon} ${kind} on ${rig} is a sampled path`);
    }
  }
});

test('blade rig pin: the rig is explicit data — every roster entry names one, the opponent fighter carries it, the player is the hero', () => {
  for (const [id, recipe] of Object.entries(ROSTER)) assert.ok(recipe.rig in bladePathsByRig, `${id}: rig "${recipe.rig}" has no bakes`);
  for (const o of Object.values(OPPONENTS)) assert.equal(opponentFighter(o, { ...TARGET, heading: 0, distance: 0 }).rig, o.rig, `${o.id} fights on his rig`);
  assert.equal(createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready').rig, 'hero');
  assert.equal(createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready', 'knife').rig, 'hero', 'a man with the knife sweeps the hero bake, not the goblin\'s');
});

test('blade rig pin: the lookup is strict — a weapon a rig was never baked with throws, it does not fall back to another rig', () => {
  assert.throws(() => bladePose('goblin', 'longsword', 'light_right', 0), /no blade table for longsword light_right on the goblin rig/);
  assert.throws(() => bladePose('nobody', 'longsword', 'light_right', 0), /on the nobody rig/);
  assert.throws(() => bladeFrames('hero', 'longsword', 'no_such_path'), /no blade table for longsword no_such_path on the hero rig/);
  // The same weapon on two rigs is two different sweeps: the knife the Goblin fights with is not the knife in a man's hand.
  assert.notDeepEqual(bladePathsByRig.goblin.knife, bladePathsByRig.hero.knife);
});
