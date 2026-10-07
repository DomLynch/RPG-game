import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ADDITIVE_ROLES, QUADRUPED_CLIPS, ROLES, buildWarriors, isQuadruped } from '../src/characters.ts';

// The seven clips scripts/character/quadruped_rig.py exports.
const WOLF = ['Idle', 'Walk', 'Run', 'Flee', 'Bite', 'Hurt', 'Death'];

test('quadruped role map: every role the renderer asks for lands on one of the seven wolf clips', () => {
  for (const role of ROLES) {
    const clip = QUADRUPED_CLIPS[role];
    assert.ok(clip && WOLF.includes(clip), `${role} -> ${clip}`);
  }
  for (const role of ADDITIVE_ROLES) assert.equal(QUADRUPED_CLIPS[role], undefined, `${role}: an appended scene the beast does not carry stays unmapped`);
  for (const strike of ['Attack', 'Return', 'Heavy', 'Riposte', 'Thrust'] as const) assert.equal(QUADRUPED_CLIPS[strike], 'Bite', `${strike} is the bite`);
  assert.equal(QUADRUPED_CLIPS.Hit, 'Hurt');
  assert.equal(QUADRUPED_CLIPS.Roll, 'Flee', 'the backstep/roll role plays the Flee');
  assert.equal(QUADRUPED_CLIPS.Jog, 'Walk');
});

async function hero() {
  const bytes = readFileSync(new URL('../src/assets/warrior.glb', import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}

test('a rig with the beast clip set builds through buildWarriors (the one loader path); the humanoid set is untouched', async () => {
  const asset = await hero();
  assert.equal(isQuadruped(asset), false, 'the hero is not a quadruped');
  const stand = (from: string, to: string) => { const c = asset.animations.find(a => a.name === from)!.clone(); c.name = to; return c; };
  const beast = { ...asset, animations: [stand('Idle', 'Idle'), stand('Walk', 'Walk'), stand('Run', 'Run'), stand('Roll', 'Flee'), stand('Attack', 'Bite'), stand('Hit', 'Hurt'), stand('Death', 'Death')] };
  assert.equal(isQuadruped(beast), true);
  assert.throws(() => buildWarriors({ ...asset, animations: beast.animations.filter(a => a.name !== 'Bite') }), /Warrior is missing/, 'without the Bite clip the beast map is off and the humanoid roles are required');
  const { player } = buildWarriors(beast);
  assert.ok(player, 'the beast rig is built with only its seven clips');
});
