// Brief 5 loot file (scripts/build-warrior.mjs WARRIOR_LOOT=1): the contract the runtime attach relies on, and the fit of the one
// piece that was cut from a re-proportioned body and unscaled back (the Dwarf's greaves) against the hero's skin.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

type Gltf = { nodes: { name: string; mesh?: number; skin?: number; extras?: Record<string, string> }[]; meshes: { primitives: { attributes: Record<string, number> }[] }[]; skins: { joints: number[] }[]; accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string }[]; bufferViews: { byteOffset?: number; byteStride?: number }[] };
function glb(path: string) {
  const bytes = readFileSync(new URL(path, import.meta.url)), length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + length)) as Gltf, bin = bytes.subarray(28 + length);
  const positions = (name: string) => {
    const node = json.nodes.find(n => n.name === name)!, a = json.accessors[json.meshes[node.mesh!].primitives[0].attributes.POSITION], bv = json.bufferViews[a.bufferView];
    assert.equal(a.componentType, 5126); const stride = (bv.byteStride ?? 12) / 4, base = ((bv.byteOffset ?? 0) + (a.byteOffset ?? 0)) / 4;
    const f = new Float32Array(bin.buffer, bin.byteOffset, bin.byteLength / 4), out: number[][] = [];
    for (let k = 0; k < a.count; k++) out.push([f[base + k * stride], f[base + k * stride + 1], f[base + k * stride + 2]]);
    return out;
  };
  const jointNames = (skin: number) => json.skins[skin].joints.map(i => json.nodes[i].name);
  return { json, positions, jointNames, draws: json.nodes.filter(n => n.mesh !== undefined && n.skin !== undefined) };
}
const SLOTS = ['Helmet', 'Crest', 'Body', 'Arms', 'Gloves', 'Greaves', 'Boots'];

test('every loot draw is skinned to the hero bone order and names its opponent, slot and layer', () => {
  const hero = glb('../src/assets/warrior.glb'), loot = glb('../src/assets/loot.glb');
  const heroJoints = hero.jointNames(hero.draws[0].skin!);
  assert.ok(loot.draws.length >= 10, `expected the opponents' kits, got ${loot.draws.length} draws`);
  assert.ok(!('animations' in loot.json), 'loot carries no clips: it binds to the player');
  for (const d of loot.draws) {
    const [opponent, slot, material] = d.name.split('.');
    assert.deepEqual(d.extras, { opponent, slot, layer: d.extras?.layer }, `${d.name}: extras name the draw`);
    assert.ok(SLOTS.includes(slot), `${d.name}: slot ${slot}`);
    assert.ok(['replace', 'over'].includes(d.extras!.layer), `${d.name}: layer ${d.extras?.layer}`);
    assert.ok(material, `${d.name}: material`);
    assert.deepEqual(loot.jointNames(d.skin!), heroJoints, `${d.name}: same joints, same order, as warrior.glb`);
  }
  assert.ok(loot.draws.some(d => d.name === 'dwarf.Greaves.DwarfIron'), 'the Dwarf drops his greaves');
});

test('the Dwarf\'s greaves, unscaled from his frame, sit on the hero\'s shins', () => {
  const hero = glb('../src/assets/warrior.glb'), loot = glb('../src/assets/loot.glb');
  const skin = hero.positions('Skin'), cell = 0.03, grid = new Map<string, number[][]>();
  const key = (p: number[]) => p.map(v => Math.floor(v / cell)).join(',');
  for (const p of skin) (grid.get(key(p)) ?? grid.set(key(p), []).get(key(p))!).push(p);
  const nearest = (p: number[]) => {   // nearest skin vertex within two cells (6 cm); Infinity beyond — that is a floating piece
    let best = Infinity; const c = p.map(v => Math.floor(v / cell));
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++)
      for (const q of grid.get(`${c[0] + dx},${c[1] + dy},${c[2] + dz}`) ?? []) best = Math.min(best, Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]));
    return best;
  };
  const d = loot.positions('dwarf.Greaves.DwarfIron').map(nearest).sort((a, b) => a - b);
  const q = (f: number) => d[Math.floor(f * (d.length - 1))];
  const ys = loot.positions('dwarf.Greaves.DwarfIron').map(p => p[1]);
  assert.ok(Math.min(...ys) > 0.02 && Math.max(...ys) < 0.55, `greaves span the shins (y ${Math.min(...ys).toFixed(2)}..${Math.max(...ys).toFixed(2)} m), not the Dwarf's shorter legs`);
  assert.ok(q(0.5) < 0.015, `median ${(q(0.5) * 100).toFixed(1)} cm from the skin`);
  assert.ok(q(0.9) < 0.025, `p90 ${(q(0.9) * 100).toFixed(1)} cm from the skin`);
  assert.ok(q(1) < 0.05, `max ${(q(1) * 100).toFixed(1)} cm from the skin: nothing floats`);
});
