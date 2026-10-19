import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Group } from 'three';
import { fighterClips } from '../src/fight/index.ts';
import type { WeaponId } from '../src/fight/index.ts';
import { digestGeneric } from '../scripts/character/add-weapon-packs.mjs';

// The clip packs of the two-handed weapons (scripts/character/add-weapon-packs.mjs): a goblin or troll the zone draws with a warhammer, maul, scythe or trident carries the
// clips fighterClips asks for, and adding them touched none of the generic clips. tests/creature-clips.test.ts walks what the zone rows give each kind today; this pins the bodies
// that can wield the rest (the bare goblin's rank looks, the troll's world and engine bodies) so a later row cannot find a body without its pack.
const ROOT = new URL('..', import.meta.url);
const BODIES: Record<string, WeaponId[]> = {
  'public/world/kit/goblin-bare.glb': ['warhammer', 'maul', 'scythe', 'trident'],
  'public/world/cave-troll.glb': ['warhammer', 'maul'],
  'public/beasts/cave-troll.glb': ['warhammer', 'maul'],
};

async function clipsOf(file: string) {
  const bytes = readFileSync(new URL(file, ROOT)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = (json.materials ?? []).map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(JSON.stringify(json), '')).animations;
}

for (const [file, weapons] of Object.entries(BODIES)) {
  test(`${file} carries the clips for ${weapons.join(', ')}`, async () => {
    const animations = await clipsOf(file);
    for (const weapon of weapons) assert.doesNotThrow(() => fighterClips({ scene: new Group(), animations }, weapon, true), `${file} cannot wield ${weapon}`);
  });

  test(`${file}: the generic clips are unchanged by the packs`, async () => {
    const baseline = JSON.parse(readFileSync(new URL('tests/creature-packs.baseline.json', ROOT), 'utf8')) as Record<string, Record<string, string>>;
    assert.deepEqual(await digestGeneric(new URL(file, ROOT).pathname), baseline[file]);
  });
}

// A hero pack on the goblin would stand its pelvis ~0.14 rig units high; the pack goes through the goblin's retarget, so its first pelvis key sits where the goblin's own Idle does.
test('goblin packs are on the goblin pelvis, not the hero\'s', async () => {
  const animations = await clipsOf('public/world/kit/goblin-bare.glb'), z = (name: string) => animations.find((a) => a.name === name)!.tracks.find((t) => t.name === 'pelvis.position')!.values[2];
  for (const name of ['Warhammer_Idle', 'Maul_Idle', 'Scythe_Idle', 'Trident_Idle']) assert.ok(Math.abs(z(name) - z('Idle')) < .03, `${name} pelvis ${z(name)} vs the goblin's Idle ${z('Idle')}`);
});
