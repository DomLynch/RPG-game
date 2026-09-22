// Brief 13: the arena guard file (scripts/build-warrior.mjs WARRIOR_GUARD=1) — the contract the world lane instances six times.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import test from 'node:test';

type Gltf = { nodes: { name: string; mesh?: number; skin?: number }[]; meshes: { primitives: { indices: number; attributes: Record<string, number> }[] }[]; skins: { joints: number[] }[]; accessors: { count: number; type: string }[]; animations: { name: string; samplers: { input: number }[] }[]; images?: unknown[] };
function glb(path: string) {
  const bytes = readFileSync(new URL(path, import.meta.url)), length = bytes.readUInt32LE(12);
  return { bytes, json: JSON.parse(bytes.toString('utf8', 20, 20 + length)) as Gltf };
}
const triangles = (json: Gltf) => json.nodes.filter(n => n.mesh !== undefined).reduce((n, node) => n + json.meshes[node.mesh!].primitives.reduce((m, p) => m + json.accessors[p.indices].count / 3, 0), 0);

// `skip` while the asset is unbuilt: the file is produced by `blender ... guard_body.py` then `WARRIOR_GUARD=1 node scripts/build-warrior.mjs`,
// and this worktree builds it in a booked window on the shared Mac (one deployer). The same shape as tests/loot-data.test.ts's skip:
// the check runs for real the moment the file is there, and a missing asset never reads as a pass.
const GUARD_GLB = new URL('../src/assets/guard.glb', import.meta.url);
test('guard.glb: the hero rig\'s bones, five clips, under the triangle budget, no eyes or hair, a whip and a cap on it', { skip: !existsSync(GUARD_GLB) && 'src/assets/guard.glb is not built yet (Brief 13: bake + WARRIOR_GUARD=1 build)' }, () => {
  const guard = glb('../src/assets/guard.glb'), hero = glb('../src/assets/warrior.glb');
  const names = (g: { json: Gltf }, skin: number) => g.json.skins[skin].joints.map(i => g.json.nodes[i].name);
  const skinned = guard.json.nodes.filter(n => n.skin !== undefined);
  assert.ok(skinned.length >= 2, 'the body and its kit are skinned draws');
  for (const node of skinned) assert.deepEqual(names(guard, node.skin!), names(hero, hero.json.nodes.find(n => n.skin !== undefined)!.skin!), `${node.name}: warrior.glb's bones in warrior.glb's order`);
  assert.deepEqual(guard.json.animations.map(a => a.name), ['Pace', 'Stand', 'Turn', 'Raise', 'Lash']);
  const duration = (name: string) => { const a = guard.json.animations.find(a => a.name === name)!; return Math.max(...a.samplers.map(s => (guard.json.accessors[s.input] as { max?: number[] }).max![0])); };
  assert.ok(Math.abs(duration('Turn') - .6) < .02, `Turn is 0.6 s: ${duration('Turn')}`); assert.ok(Math.abs(duration('Lash') - .6) < .02, `Lash is 0.6 s: ${duration('Lash')}`);
  assert.ok(guard.json.animations.find(a => a.name === 'Turn')!.samplers.length > 0);
  const draws = guard.json.nodes.filter(n => n.mesh !== undefined).map(n => n.name);
  assert.ok(!draws.some(n => /Eyes|Hair|Sword|Weapon/.test(n)), `no eyes, hair or sword: ${draws}`);
  assert.ok(draws.some(n => /Leather/.test(n)) && draws.some(n => /Gambeson/.test(n)) && draws.some(n => /Skin/.test(n)), `skin, tunic and leather (cap, whip): ${draws}`);
  const tris = triangles(guard.json);
  assert.ok(tris <= 14000, `${tris} triangles, budget 14,000 (six instances on a phone)`);
  assert.ok(tris > 5000, `${tris} triangles: a body is still there`);
  assert.ok(gzipSync(guard.bytes).length <= 400_000, `${gzipSync(guard.bytes).length} B gzip of the source file; the served, meshopt-packed file is smaller still (check-budget caps it at 400 KB)`);
});
