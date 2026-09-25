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
  assert.ok(loot.draws.some(d => d.name === 'dwarf.Greaves.Steel'), 'the Dwarf drops his greaves');
});

test('the Dwarf\'s greaves sit on the hero\'s shins', () => {   // built shells fitted to his shins since the #614 fix (build-warrior.mjs), no longer cut and unscaled
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
  const dwarf = fit('dwarf.Greaves.Steel'), authored = fit('veteran.Greaves.Bronze');   // the yardstick: greaves parts.py fitted to this body by recipe
  const cm = (m: number) => (m * 100).toFixed(1), report = (f: typeof dwarf) => `median ${cm(f.q(0.5))} / p90 ${cm(f.q(0.9))} / max ${cm(f.q(1))} cm from the skin, y ${Math.min(...f.ys).toFixed(2)}..${Math.max(...f.ys).toFixed(2)} m`;
  console.log(`  dwarf greaves: ${report(dwarf)}\n  veteran greaves (authored): ${report(authored)}`);
  // Span: the hero's own shin, knee (calf joint) to sole (ball joint), from warrior.glb's bind — the Dwarf's shins are 28 % shorter.
  const skin0 = hero.draws[0].skin!, knee = hero.jointY(skin0, 'calf_l'), sole = hero.jointY(skin0, 'ball_l');
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

test('the Shieldmaiden carries her own wooden board shield, bigger than the kit buckler (her signature splits wood off it: #666)', () => {
  const loot = glb('../src/assets/loot.glb'), names = loot.draws.map(d => d.name);
  assert.ok(names.includes('shieldmaiden.Shield.Wood'), 'the boards are wood, so the splinters tell the truth');
  assert.ok(names.includes('shieldmaiden.Shield.Steel'), 'an iron rim and boss');
  const [her, kit] = ['shieldmaiden.Shield.Wood', '~kit.Shield.Leather'].map(n => loot.area(name => name === n));
  assert.ok(her > kit * 1.4, `her face (${her.toFixed(3)} m²) is the Norse round, not the kit's buckler (${kit.toFixed(3)} m²)`);
});

// The launch characters' Helmet and Body carriers (2026-09-24): their TRELLIS cuts passed the 80 % area rule above while reading worn as
// torn shells — the Plague Doctor's coat as shards over a bare chest (half its faces wound inward, so a single-sided material drew half of
// it), the Shieldmaiden's tunic bare at the back. Area cannot see that; winding can. Every draw of these carriers is a built shell whose
// faces point away from the centre of the piece they belong to, ≥ 85 % of them (the built pieces measure 89–100 %, the cuts they replaced 50–53 %).
test('loot: the launch characters\' carriers (and the Knight\'s and Plague Doctor\'s whole sets) are built shells wound outward, not TRELLIS cuts', () => {
  const loot = glb('../src/assets/loot.glb'), { json } = loot, bin = readFileSync(new URL('../src/assets/loot.glb', import.meta.url));
  const jsonLength = bin.readUInt32LE(12), data = bin.subarray(28 + jsonLength);
  const manifest = JSON.parse(readFileSync(new URL('../src/assets/source/loot/loot.json', import.meta.url), 'utf8'));
  // Helmet and Body for all four; all six for the Knight and the Plague Doctor, whose every piece was a cut (Strategy: a set ships whole).
  const SIX = ['Helmet', 'Body', 'Arms', 'Gloves', 'Greaves', 'Boots'];
  const slotsOf: Record<string, string[]> = { witch: ['Helmet', 'Body'], shieldmaiden: ['Helmet', 'Body'], knight: SIX, plaguedoctor: SIX };
  for (const [opponent, slots] of Object.entries(slotsOf)) for (const slot of slots) {
    const entries = manifest[opponent].filter((e: { slot: string }) => e.slot === slot);
    assert.ok(entries.length, `${opponent} offers a ${slot}`);
    if (entries.every((e: { shared?: string }) => e.shared)) continue;   // a shared piece (the kit gloves) is built once and checked as its own draws
    for (const entry of entries) assert.ok(entry.file.startsWith('@build:'), `${opponent}.${slot} is built, not cut from ${entry.file}`);
    const draws = loot.draws.filter(d => d.name.startsWith(`${opponent}.${slot}.`));
    assert.ok(draws.length, `${opponent}.${slot} has draws`);
    for (const draw of draws) for (const prim of json.meshes[draw.mesh!].primitives) {
      const pa = json.accessors[prim.attributes.POSITION], pv = json.bufferViews[pa.bufferView], ia = json.accessors[prim.indices], iv = json.bufferViews[ia.bufferView];
      const f = new Float32Array(data.buffer.slice(data.byteOffset + (pv.byteOffset ?? 0) + (pa.byteOffset ?? 0), data.byteOffset + (pv.byteOffset ?? 0) + (pa.byteOffset ?? 0) + pa.count * 12));
      const off = data.byteOffset + (iv.byteOffset ?? 0) + (ia.byteOffset ?? 0);
      const index = ia.componentType === 5125 ? new Uint32Array(data.buffer.slice(off, off + ia.count * 4)) : new Uint16Array(data.buffer.slice(off, off + ia.count * 2));
      // Outward from the centre of each connected piece (welded by position), not the draw's: one draw can hold a left and a right piece,
      // whose inner faces would otherwise count as pointing in.
      const key = new Map<string, number>(), weld = Array.from({ length: pa.count }, (_, k) => { const id = [0, 1, 2].map(a => Math.round(f[k * 3 + a] * 1e5)).join(); if (!key.has(id)) key.set(id, key.size); return key.get(id)!; });
      const root = Array.from({ length: key.size }, (_, i) => i), find = (x: number): number => root[x] === x ? x : (root[x] = find(root[x]));
      for (let t = 0; t < index.length; t += 3) for (let j = 1; j < 3; j++) root[find(weld[index[t + j]])] = find(weld[index[t]]);
      const sum = new Map<number, number[]>();
      for (let k = 0; k < pa.count; k++) { const r = find(weld[k]), s = sum.get(r) ?? [0, 0, 0, 0]; for (let a = 0; a < 3; a++) s[a] += f[k * 3 + a]; s[3]++; sum.set(r, s); }
      let outward = 0;
      for (let t = 0; t < index.length; t += 3) {
        const s = sum.get(find(weld[index[t]]))!, c = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
        const [A, B, C] = [0, 1, 2].map(j => [0, 1, 2].map(a => f[index[t + j] * 3 + a]));
        const u = B.map((x, a) => x - A[a]), v = C.map((x, a) => x - A[a]), m = [0, 1, 2].map(a => (A[a] + B[a] + C[a]) / 3 - c[a]);
        if ((u[1] * v[2] - u[2] * v[1]) * m[0] + (u[2] * v[0] - u[0] * v[2]) * m[1] + (u[0] * v[1] - u[1] * v[0]) * m[2] > 0) outward++;
      }
      assert.ok(outward / (index.length / 3) >= .85, `${draw.name}: ${(100 * outward / (index.length / 3)).toFixed(0)} % of its faces point outward`);
    }
  }
});
