// Brief 5 loot file (scripts/build-warrior.mjs WARRIOR_LOOT=1): the contract the runtime attach relies on, and the fit of the one
// piece that was cut from a re-proportioned body and unscaled back (the Dwarf's greaves) against the hero's skin.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

type Gltf = { nodes: { name: string; mesh?: number; skin?: number; extras?: Record<string, string> }[]; meshes: { primitives: { indices: number; attributes: Record<string, number> }[] }[]; skins: { joints: number[]; inverseBindMatrices: number }[]; accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string }[]; bufferViews: { byteOffset?: number; byteStride?: number }[] };
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
  const ibm = (skin: number) => { const a = json.accessors[json.skins[skin].inverseBindMatrices], bv = json.bufferViews[a.bufferView], off = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0); return bin.subarray(off, off + a.count * 64); };
  const jointY = (skin: number, name: string) => {   // a joint's rest height from its inverse bind matrix: j = −Rᵀ t
    const a = json.accessors[json.skins[skin].inverseBindMatrices], bv = json.bufferViews[a.bufferView], base = ((bv.byteOffset ?? 0) + (a.byteOffset ?? 0)) / 4;
    const f = new Float32Array(bin.buffer, bin.byteOffset, bin.byteLength / 4), m = f.subarray(base + jointNames(skin).indexOf(name) * 16);
    return -(m[1] * m[12] + m[5] * m[13] + m[9] * m[14]);
  };
  // The surface a set of draws covers, in m² — how much of the man a garment actually clothes. Vertex counts and bounding boxes both
  // lie here: the Pitborn's sash spans nearly the player's tunic's height while covering a quarter of the area.
  const area = (match: (name: string) => boolean) => {
    let total = 0;
    for (const node of json.nodes.filter(n => n.mesh !== undefined && match(n.name))) for (const prim of json.meshes[node.mesh!].primitives) {
      const pa = json.accessors[prim.attributes.POSITION], pv = json.bufferViews[pa.bufferView];
      const ia = json.accessors[prim.indices], iv = json.bufferViews[ia.bufferView];
      const stride = (pv.byteStride ?? 12) / 4, base = ((pv.byteOffset ?? 0) + (pa.byteOffset ?? 0)) / 4;
      const f = new Float32Array(bin.buffer, bin.byteOffset, bin.byteLength / 4);
      const off = (iv.byteOffset ?? 0) + (ia.byteOffset ?? 0);
      const index = ia.componentType === 5125 ? new Uint32Array(bin.buffer, bin.byteOffset + off, ia.count) : new Uint16Array(bin.buffer, bin.byteOffset + off, ia.count);
      const at = (k: number) => [f[base + k * stride], f[base + k * stride + 1], f[base + k * stride + 2]] as const;
      for (let i = 0; i < index.length; i += 3) {
        const a = at(index[i]), b = at(index[i + 1]), c = at(index[i + 2]);
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        total += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
      }
    }
    return total;
  };
  return { json, positions, jointNames, jointY, ibm, area, draws: json.nodes.filter(n => n.mesh !== undefined && n.skin !== undefined) };
}
const SLOTS = ['Helmet', 'Crest', 'Body', 'Arms', 'Gloves', 'Greaves', 'Boots', 'Shield'];

test('every loot draw is skinned to the hero bone order and names its opponent, slot and layer', () => {
  const hero = glb('../src/assets/warrior.glb'), loot = glb('../src/assets/loot.glb');
  const heroJoints = hero.jointNames(hero.draws[0].skin!);
  assert.ok(loot.draws.length >= 10, `expected the opponents' kits, got ${loot.draws.length} draws`);
  assert.ok(!('animations' in loot.json), 'loot carries no clips: it binds to the player');
  for (const d of loot.draws) {
    const [opponent, slot, material] = d.name.split('.');
    // The shield carries one extra field: its `stow` transform (flat on the back), which travels as DATA rather than a second draw so
    // nothing renders twice before the loader reads Weapons' `grip` to pick off-hand versus back.
    const { stow, ...named } = (d.extras ?? {}) as Record<string, unknown>;
    assert.deepEqual(named, { opponent, slot, layer: d.extras?.layer }, `${d.name}: extras name the draw`);
    if (slot === 'Shield') { assert.ok(stow && typeof stow === 'object', `${d.name}: the shield carries its stow transform`);
      const s = stow as { bone?: string; position?: number[]; rotation?: number[] };
      assert.equal(s.bone, 'spine_03', 'stowed on the spine, not the hand');
      assert.equal(s.position?.length, 3); assert.equal(s.rotation?.length, 3); }
    else assert.equal(stow, undefined, `${d.name}: only the shield stows`);
    assert.ok(SLOTS.includes(slot), `${d.name}: slot ${slot}`);
    assert.ok(['replace', 'over'].includes(d.extras?.layer ?? ''), `${d.name}: layer ${d.extras?.layer}`);
    assert.ok(material, `${d.name}: material`);
    assert.deepEqual(loot.jointNames(d.skin!), heroJoints, `${d.name}: same joints, same order, as warrior.glb`);
    assert.ok(loot.ibm(d.skin!).equals(hero.ibm(hero.draws[0].skin!)), `${d.name}: inverse bind matrices byte-identical to the player's — the loader binds every piece with his Body bindMatrix`);
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
  const fit = (draw: string) => { const d = loot.positions(draw).map(nearest).sort((a, b) => a - b); return { q: (f: number) => d[Math.floor(f * (d.length - 1))], ys: loot.positions(draw).map(p => p[1]) }; };
  const dwarf = fit('dwarf.Greaves.DwarfIron'), authored = fit('veteran.Greaves.Bronze');   // the yardstick: greaves parts.py fitted to this body by recipe
  const cm = (m: number) => (m * 100).toFixed(1), report = (f: typeof dwarf) => `median ${cm(f.q(0.5))} / p90 ${cm(f.q(0.9))} / max ${cm(f.q(1))} cm from the skin, y ${Math.min(...f.ys).toFixed(2)}..${Math.max(...f.ys).toFixed(2)} m`;
  console.log(`  dwarf greaves: ${report(dwarf)}\n  veteran greaves (authored): ${report(authored)}`);
  // Span: the hero's own shin, knee (calf joint) to sole (ball joint), from warrior.glb's bind — the Dwarf's shins are 28 % shorter.
  const skin0 = hero.draws[0].skin!, knee = hero.jointY(skin0, 'calf_l'), sole = hero.jointY(skin0, 'ball_l');
  // …and reach the knee: on the Dwarf's own frame they stop 16 cm short of it.
  assert.ok(Math.max(...dwarf.ys) < knee + 0.05 && Math.max(...dwarf.ys) > knee - 0.10 && Math.min(...dwarf.ys) > sole - 0.05, `greaves lie between the hero's knee (${knee.toFixed(2)} m) and sole (${sole.toFixed(2)} m): y ${Math.min(...dwarf.ys).toFixed(2)}..${Math.max(...dwarf.ys).toFixed(2)}`);
  // Stand-off: no looser than the authored greaves on the same shin, with a cut piece's ragged edge allowed 2× at the tail.
  assert.ok(dwarf.q(0.5) <= 1.5 * authored.q(0.5) + 0.005, `median ${cm(dwarf.q(0.5))} cm vs authored ${cm(authored.q(0.5))} cm`);
  assert.ok(dwarf.q(0.9) <= 2 * authored.q(0.9) + 0.005, `p90 ${cm(dwarf.q(0.9))} cm vs authored ${cm(authored.q(0.9))} cm`);
  assert.ok(dwarf.q(1) < 2 * authored.q(1) + 0.01, `max ${cm(dwarf.q(1))} cm vs authored ${cm(authored.q(1))} cm: nothing floats`);
});

// Owner, 2026-09-22, after taking a Pitborn chest piece and ending up bare-chested: taking or wearing a piece must never leave the
// player less dressed than his base kit. A `replace` piece hides his own draws in that slot, so it has to cover what it hides — the
// Pitborn's Body was a 0.36 m² rag sash against his 1.36 m² tunic (26 %), which is the bug, not the "skin draw" it was taken for.
// The floor is 80 %: every piece that belongs shipped at 103–159 %, so this separates them without being tuned to squeak past.
test('loot: no `replace` piece undresses the player — each covers at least 80 % of the draws it hides', () => {
  const hero = glb('../src/assets/warrior.glb'), loot = glb('../src/assets/loot.glb');
  const SLOT_OF_HERO: Record<string, RegExp> = {   // the player's own draws in each slot the loot can replace
    Body: /^(?:Gambeson|Leather\.Body|Steel\.Body|Antique brass\.Body)$/,
    Boots: /^(?:Leather\.Boots|Wrap\.Boots)$/,
    Arms: /^Wrap$/,
  };
  const replaced = new Set(loot.draws.filter(d => d.extras?.layer === 'replace').map(d => d.extras!.slot));
  for (const slot of replaced) {
    const own = SLOT_OF_HERO[slot];
    if (!own) continue;   // Helmet and Crest hide hair, not clothing: nothing of his to undress
    const base = hero.area(name => own.test(name));
    assert.ok(base > 0, `the player has draws in ${slot}`);
    for (const opponent of new Set(loot.draws.filter(d => d.extras?.layer === 'replace' && d.extras?.slot === slot).map(d => d.extras!.opponent))) {
      const piece = loot.area(name => name.startsWith(`${opponent}.${slot}.`));
      assert.ok(piece >= 0.8 * base, `${opponent}.${slot} covers ${(100 * piece / base).toFixed(0)} % of the player's ${slot} (${piece.toFixed(2)} m² against ${base.toFixed(2)} m²) — wearing it would undress him`);
    }
  }
});
