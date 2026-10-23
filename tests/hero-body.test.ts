import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { heroBodyFile, heroBodyFiles } from '../src/fight/hero-body-rows.ts';

// The hero body is ONE row (src/fight/hero-body-rows.json): the Mixamo Exo Gray ('warrior.glb') or the classic hero ('hero-classic.glb'), flipped by editing `body`. Both must meet the same rig contract, so a flip is safe.
const dir = new URL('../src/assets/', import.meta.url);
const parse = (file: string) => { const buf = readFileSync(new URL(file, dir)), n = buf.readUInt32LE(12); return { json: JSON.parse(buf.subarray(20, 20 + n).toString()) as any, bin: buf.subarray(28 + n) }; };
const jointNames = (d: { json: any }): string[] => d.json.skins[0].joints.map((i: number) => d.json.nodes[i].name);

test('the hero-body row names a file that exists, and every file it can name exists', () => {
  assert.ok(heroBodyFiles().length >= 2, 'exo and classic');
  for (const f of heroBodyFiles()) assert.ok(existsSync(new URL(`${f}.glb`, dir)), `src/assets/${f}.glb`);
  assert.ok(heroBodyFiles().includes(heroBodyFile()));
});

test('every hero body is the same rig: 65 joints in one order, the same 27 clips, a skinned Steel with base and normal maps, both sword nodes', () => {
  const [exo, classic] = ['warrior.glb', 'hero-classic.glb'].map(parse);
  assert.equal(jointNames(classic).length, 65);
  assert.deepEqual(jointNames(exo), jointNames(classic), 'joint names and order');
  assert.deepEqual(exo.json.animations.map((a: { name: string }) => a.name).sort(), classic.json.animations.map((a: { name: string }) => a.name).sort(), 'clip names');
  for (const d of [exo, classic]) {
    const steel = d.json.nodes.find((n: { name: string }) => n.name === 'Steel');
    assert.ok(steel && steel.mesh !== undefined && steel.skin !== undefined, 'a skinned node named Steel');
    const material = d.json.materials[d.json.meshes[steel.mesh].primitives[0].material];
    assert.ok(material.pbrMetallicRoughness?.baseColorTexture && material.normalTexture, 'Steel has a base map and a normal map (characters.ts missingMap)');
    for (const name of ['SwordDrawn', 'SwordSheathed']) assert.ok(d.json.nodes.some((n: { name: string }) => n.name === name), name);
  }
});

test('the Exo rig keeps the classic rest rotations, so every clip authored on the classic rig (execution, hamstring, weapon packs) binds', () => {
  const [exo, classic] = ['warrior.glb', 'hero-classic.glb'].map(parse), byName = (d: { json: any }) => new Map<string, any>(d.json.nodes.map((n: any) => [n.name, n]));
  const a = byName(exo), b = byName(classic);
  for (const name of jointNames(classic)) {
    const q = a.get(name).rotation ?? [0, 0, 0, 1], r = b.get(name).rotation ?? [0, 0, 0, 1];
    const dot = Math.abs(q[0] * r[0] + q[1] * r[1] + q[2] * r[2] + q[3] * r[3]);
    assert.ok(dot > 0.99999, `${name}: rest rotation differs from the classic hero's`);
  }
});

test('the Exo hero wears no loot (scene extras noLoot), the classic hero does', () => {
  assert.equal(parse('warrior.glb').json.scenes[0].extras?.noLoot, true);
  assert.equal(parse('hero-classic.glb').json.scenes[0].extras?.noLoot, undefined);
});

test('the Exo hero\'s clips are in place: the pelvis keeps its height but not its forward travel, except in the Death_* falls', () => {
  const { json, bin } = parse('warrior.glb');
  const parent = new Array<number>(json.nodes.length).fill(-1);
  json.nodes.forEach((n: any, i: number) => (n.children ?? []).forEach((c: number) => { parent[c] = i; }));
  const qmul = (p: number[], q: number[]) => [p[3] * q[0] + p[0] * q[3] + p[1] * q[2] - p[2] * q[1], p[3] * q[1] - p[0] * q[2] + p[1] * q[3] + p[2] * q[0], p[3] * q[2] + p[0] * q[1] - p[1] * q[0] + p[2] * q[3], p[3] * q[3] - p[0] * q[0] - p[1] * q[1] - p[2] * q[2]];
  const worldQ = (i: number): number[] => (parent[i] < 0 ? json.nodes[i].rotation ?? [0, 0, 0, 1] : qmul(worldQ(parent[i]), json.nodes[i].rotation ?? [0, 0, 0, 1]));
  const rotate = (q: number[], v: number[]) => { const r = qmul(qmul(q, [v[0], v[1], v[2], 0]), [-q[0], -q[1], -q[2], q[3]]); return [r[0], r[1], r[2]]; };
  const pelvis = json.nodes.findIndex((n: any) => n.name === 'pelvis'), up = worldQ(parent[pelvis]);
  for (const an of json.animations as { name: string; samplers: any[]; channels: any[] }[]) {
    if (/^Death/.test(an.name)) continue;
    const ch = an.channels.find((c) => c.target.node === pelvis && c.target.path === 'translation'); assert.ok(ch, `${an.name} moves the pelvis`);
    const acc = json.accessors[an.samplers[ch.sampler].output], view = json.bufferViews[acc.bufferView];
    const f = new Float32Array(bin.buffer.slice(bin.byteOffset + (view.byteOffset ?? 0) + (acc.byteOffset ?? 0), bin.byteOffset + (view.byteOffset ?? 0) + (acc.byteOffset ?? 0) + acc.count * 12));
    const w = Array.from({ length: acc.count }, (_, i) => rotate(up, [f[i * 3], f[i * 3 + 1], f[i * 3 + 2]]));
    const travel = Math.max(...w.map((p) => Math.hypot(p[0] - w[0][0], p[2] - w[0][2])));
    assert.ok(travel < 0.02, `${an.name}: the pelvis travels ${travel.toFixed(2)} m horizontally (the game moves the actor)`);
  }
});
