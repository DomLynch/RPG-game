// The combat clips of the Zone 1 creatures: which clip a role plays on which body, read from the shipped GLBs (their JSON chunk, no GL).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { attackTimeScale, mobClipName } from './mob-clips.ts';

const clipsOf = (file: string): { name: string }[] => {
  const b = readFileSync(new URL(`../../public/${file}`, import.meta.url));
  return (JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()) as { animations: { name: string }[] }).animations;
};

const named = (...n: string[]) => n.map((name) => ({ name }));
test('the Pit\'s role map picks the clip: Bite / Hurt / Death on a quadruped, Attack / Hit / Death on a humanoid, null when the body has none', () => {
  const quad = named('Idle', 'Walk', 'Run', 'Flee', 'Bite', 'Hurt', 'Death'), human = named('Idle', 'Walk', 'Attack', 'Hit', 'Death', 'Heavy');
  assert.deepEqual((['attack', 'hit', 'death'] as const).map((r) => mobClipName(r, quad)), ['Bite', 'Hurt', 'Death']);
  assert.deepEqual((['attack', 'hit', 'death'] as const).map((r) => mobClipName(r, human)), ['Attack', 'Hit', 'Death']);
  assert.deepEqual((['attack', 'hit', 'death'] as const).map((r) => mobClipName(r, named('Idle', 'Walk'))), [null, null, null]);
});

test('every Zone 1 body the world draws has all three clips, so none falls back to the procedural lunge, pulse and fall', () => {
  const bodies = ['world/wolf.glb', 'beasts/bear.glb', 'beasts/boar.glb', 'world/goblin.glb', 'world/knight.glb', 'world/pitborn.glb', 'world/witch.glb', 'world/bear.glb'];   // the bear's world body ships with the bear rows (#1787): checked once it is in the tree
  for (const f of bodies.filter((b) => existsSync(new URL(`../../public/${b}`, import.meta.url)))) {
    const names = clipsOf(f);
    for (const role of ['attack', 'hit', 'death'] as const) assert.ok(mobClipName(role, names), `${f}: ${role}`);
  }
});

test('the attack clip is sped so its contact frame lands on the sim\'s strike: the plain bite about 1x, the heavy blows slowed to a heavier wind-up, never crawling or snapping', () => {
  const at = (windupMs: number) => attackTimeScale('Bite', 0.93, windupMs);
  assert.ok(Math.abs(at(400) - 1.07) < 0.02, `plain bite ${at(400)}`);   // contact at .43 s of the clip vs a .4 s windup
  assert.ok(at(500) < at(400) && at(700) < at(500) && at(900) < at(700), 'longer windup, slower clip');
  assert.ok(Math.abs(at(900) - 0.47) < 0.02, `bear heavy ${at(900)}`);
  assert.ok(Math.abs((0.46 * 0.93) / at(900) - 0.9) < 0.03, 'contact meets the end of a 0.9 s windup');
  assert.ok(attackTimeScale('Attack', 1, 400) > 0.8 && attackTimeScale('Attack', 1, 400) < 0.9, 'a humanoid Attack (the Pit\'s .34 contact) at a 0.4 s windup');
  assert.equal(attackTimeScale('Bite', 0.93, 5000), 0.45); assert.equal(attackTimeScale('Bite', 0.93, 50), 2);
  assert.ok(Math.abs((0.46 * 0.93) / attackTimeScale('Bite', 0.93, 14 / 60 * 1000) - 14 / 60) < 0.02, 'the Pit\'s 14-tick bite tell: contact still meets the strike');
});
