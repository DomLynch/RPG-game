import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Group } from 'three';
import { fighterClips } from '../src/fight/index.ts';
import type { WeaponId } from '../src/fight/index.ts';
import { ROW, digestGeneric, readClip, readGlb } from '../scripts/character/add-weapon-packs.mjs';

// The clip packs of the two-handed weapons (scripts/character/add-weapon-packs.mjs; the row is scripts/character/weapon-packs.json): a goblin or troll the zone draws with a warhammer, maul, scythe or trident
// carries the clips fighterClips asks for, and adding them touched none of the generic clips. tests/creature-clips.test.ts walks what the zone rows give each kind today; this pins the bodies
// that can wield the rest (the bare goblin's rank looks, the troll's world body) so a later row cannot find a body without its pack.
const ROOT = new URL('..', import.meta.url);
const BODIES = ROW.bodies as { file: string; weapons: WeaponId[]; retarget: string }[];
const PREFIX = (weapon: string) => weapon[0].toUpperCase() + weapon.slice(1) + '_';

async function clipsOf(file: string) {
  const bytes = readFileSync(new URL(file, ROOT)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = (json.materials ?? []).map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(JSON.stringify(json), '')).animations;
}

test('the pack row names a donor for every weapon a body carries, and a retarget for every body', () => {
  assert.ok(BODIES.length > 0);
  for (const { file, weapons, retarget } of BODIES) {
    assert.ok(ROW.retargets[retarget], `${file}: unknown retarget ${retarget}`);
    for (const weapon of weapons) assert.ok(ROW.donors[weapon], `${file}: no donor for ${weapon}`);
  }
});

for (const { file, weapons } of BODIES) {
  test(`${file} carries the clips for ${weapons.join(', ')}`, async () => {
    const animations = await clipsOf(file);
    for (const weapon of weapons) assert.doesNotThrow(() => fighterClips({ scene: new Group(), animations }, weapon, true), `${file} cannot wield ${weapon}`);
  });

  test(`${file}: the generic clips are unchanged by the packs`, async () => {
    const baseline = JSON.parse(readFileSync(new URL('tests/creature-packs.baseline.json', ROOT), 'utf8')) as Record<string, Record<string, string>>;
    assert.deepEqual(await digestGeneric(new URL(file, ROOT).pathname), baseline[file]);
  });
}

// A hero pack on a re-proportioned body would stand its pelvis ~0.14 rig units high (the hero's rests at .949, the goblin's at .808). The pack goes through the body's retarget: every pelvis key is
// rest_body + bob * (donor key - rest_donor), the build's own rule for the body's generic clips, so the test recomputes it from the donor and compares every key.
const pelvisKeys = (g: Awaited<ReturnType<typeof readGlb>>, clip: string) => readClip(g, clip)!.tracks.get('pelvis.translation')!.values;
const pelvisRest = (g: Awaited<ReturnType<typeof readGlb>>) => g.json.nodes.find((n: { name: string }) => n.name === 'pelvis').translation as number[];
for (const { file, weapons, retarget } of BODIES.filter((b) => ROW.retargets[b.retarget].bob !== undefined)) {
  test(`${file}: its packs are on the body's pelvis, not the hero's (${retarget} retarget)`, async () => {
    const body = await readGlb(new URL(file, ROOT).pathname), { bob } = ROW.retargets[retarget] as { bob: number }, mine = pelvisRest(body);
    for (const weapon of weapons) {
      const donor = await readGlb(new URL(ROW.donors[weapon], ROOT).pathname), theirs = pelvisRest(donor);
      for (const role of ['Idle', 'Walk', 'Slash', 'Reap', 'Sweep']) {
        const name = `${PREFIX(weapon)}${role}`; if (!body.json.animations.some((a: { name: string }) => a.name === name)) continue;
        const have = pelvisKeys(body, name), was = pelvisKeys(donor, name);
        assert.equal(have.length, was.length, `${name}: key count`);
        for (let i = 0; i < have.length; i++) assert.ok(Math.abs(have[i] - (mine[i % 3] + bob * (was[i] - theirs[i % 3]))) < ROW.pelvisTolerance, `${name} pelvis key ${i}: ${have[i]}`);
      }
    }
  });
}
