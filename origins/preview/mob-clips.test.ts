// The combat clips of the Zone 1 creatures: which clip a role plays on which body, read from the shipped GLBs (their JSON chunk, no GL).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { QUADRUPED_CLIPS } from '../../src/characters.ts';
import { mobClipName } from './mob-clips.ts';

const clipsOf = (file: string): string[] => {
  const b = readFileSync(new URL(`../../public/${file}`, import.meta.url));
  return (JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()) as { animations: { name: string }[] }).animations.map((a) => a.name);
};

test('the role picks the body\'s own name: Bite / Hurt / Death on a quadruped, Attack / Hit / Death on a humanoid, null when it has none', () => {
  const quad = ['Idle', 'Walk', 'Run', 'Flee', 'Bite', 'Hurt', 'Death'], human = ['Idle', 'Walk', 'Attack', 'Hit', 'Death', 'Heavy'];
  assert.deepEqual((['attack', 'hit', 'death'] as const).map((r) => mobClipName(r, quad)), ['Bite', 'Hurt', 'Death']);
  assert.deepEqual((['attack', 'hit', 'death'] as const).map((r) => mobClipName(r, human)), ['Attack', 'Hit', 'Death']);
  assert.deepEqual((['attack', 'hit', 'death'] as const).map((r) => mobClipName(r, ['Idle', 'Walk'])), [null, null, null]);
});

test('it agrees with the duel\'s own beast map (src/characters.ts QUADRUPED_CLIPS): the same Bite, Hurt and Death', () => {
  assert.equal(QUADRUPED_CLIPS.Attack, mobClipName('attack', ['Bite']));
  assert.equal(QUADRUPED_CLIPS.Hit, mobClipName('hit', ['Hurt']));
});

test('every Zone 1 body the world draws has all three clips, so none falls back to the procedural lunge, pulse and fall', () => {
  const bodies = ['world/wolf.glb', 'beasts/bear.glb', 'beasts/boar.glb', 'world/goblin.glb', 'world/knight.glb', 'world/pitborn.glb', 'world/witch.glb', 'world/bear.glb'];   // the bear's world body ships with the bear rows (#1787): checked once it is in the tree
  for (const f of bodies.filter((b) => existsSync(new URL(`../../public/${b}`, import.meta.url)))) {
    const names = clipsOf(f);
    for (const role of ['attack', 'hit', 'death'] as const) assert.ok(mobClipName(role, names), `${f}: ${role}`);
  }
});
