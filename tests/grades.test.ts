// Brief 14: the grade table is factors only, covers every material the shipped kit actually uses, and reads as eight distinct grades.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { TITLES } from '../src/career.ts';
import { ROSTER } from '../src/roster.ts';
import { Color, MeshStandardMaterial } from 'three';
import { tinted } from '../src/rank-tint.ts';
import { CLASS_OF, GRADES, TIERS, WEAPON_METAL, classOf, gradeFor, houseFor, levelOf, materialOf } from '../src/grades.ts';

const draws = (() => {
  const bytes = readFileSync(new URL('../src/assets/loot.glb', import.meta.url)), length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + length)) as { nodes: { name: string; mesh?: number }[] };
  return json.nodes.filter(n => n.mesh !== undefined).map(n => n.name);
})();

test('grades: every material the shipped kit uses is classified — a new piece cannot land ungraded', () => {
  const materials = [...new Set(draws.map(materialOf))];
  assert.ok(materials.length >= 10, `loot.glb carries a palette: ${materials.length}`);
  for (const material of materials) assert.notEqual(classOf(material), undefined, `${material} is in neither a grade class nor the exemption list (src/grades.ts CLASS_OF)`);
});

test('grades: the ladder IS the career ladder — one word for a rank and its kit', () => {
  assert.deepEqual([...TIERS], [...TITLES], 'a tier is a rank title, not a parallel vocabulary that can drift from it');
  assert.equal(TIERS.length, 10);
  assert.deepEqual(Object.keys(GRADES), [...TIERS], 'the table is complete and in the ladder\'s order');
  assert.equal(levelOf('Recruit'), 1); assert.equal(levelOf('Master'), 7); assert.equal(levelOf('Origin'), 10);
});

test('grades: factors only — nothing geometric, and every number in range', () => {
  for (const [tier, grade] of Object.entries(GRADES)) {
    assert.deepEqual(Object.keys(grade), ['metal', 'trim', 'leather'], `${tier} repaints metal, trim and leather (cloth is the house dye)`);
    for (const [group, finish] of Object.entries(grade)) {
      assert.deepEqual(Object.keys(finish).sort(), ['color', 'metalness', 'roughness'], `${tier}.${group} carries colour and the two PBR factors, nothing else`);
      assert.match(finish.color, /^#[0-9a-f]{6}$/, `${tier}.${group} colour`);
      for (const key of ['metalness', 'roughness'] as const) assert.ok(finish[key] >= 0 && finish[key] <= 1, `${tier}.${group}.${key} is ${finish[key]}`);
    }
    assert.equal(grade.leather.metalness, 0, `${tier}: leather is never metal`);
  }
});

test('grades: ten grades a player can tell apart at a glance', () => {
  const metals = TIERS.map(t => GRADES[t].metal.color);
  assert.equal(new Set(metals).size, TIERS.length, `two tiers share a metal colour: ${metals}`);
  // Brightness is the ladder's read: the poor end is dull, the top three are the only ones allowed to shine.
  const lit = (t: typeof TIERS[number]) => GRADES[t].metal.metalness * (1 - GRADES[t].metal.roughness);
  for (const tier of ['Invictus', 'Origin'] as const) assert.ok(lit(tier) > lit('Recruit') * 3, `${tier} outshines a Recruit's scrap`);
  // The Gladiator's bone steps sideways, not up: it is the one rung that is lighter than the rung above it without being shinier.
  assert.ok(lit('Gladiator') < lit('Veteran'), 'bone is not a brighter metal than copper, it is a different kind of armour');
});

test('grades: a grade repaints metal and leather, never bone, authored artwork or cloth', () => {
  assert.deepEqual(gradeFor('Origin', 'Steel'), GRADES.Origin.metal);
  assert.deepEqual(gradeFor('Origin', 'Antique brass'), GRADES.Origin.trim);
  for (const material of ['Bone', 'BoneWorn', 'Ruby']) assert.equal(gradeFor('Origin', material), null, `${material} is the same at every grade (the Origin tier's ruby trim is a factor; the material 'Ruby' is the Nightborn's authored crown)`);
  for (const material of ['Gambeson_veteran', 'Heraldry', 'Wrap']) assert.equal(gradeFor('Origin', material), null, `${material} is the house dye's, not the grade's`);
  assert.equal(CLASS_OF.Bone, null, 'bone is exempt by decision, not by omission');
});

test('grades: the house dye reaches cloth and only cloth', () => {
  for (const material of ['Gambeson_veteran', 'Gambeson_goblin', 'Heraldry']) assert.equal(houseFor('#7a1f2b', material), '#7a1f2b', material);
  for (const material of ['Steel', 'Leather', 'Bone']) assert.equal(houseFor('#7a1f2b', material), null, material);
});

test('grades: the material is read off a draw name, per-opponent tunics included', () => {
  assert.equal(materialOf('veteran.Body.Antique brass'), 'Antique brass');
  assert.equal(materialOf('nightborn.Body.Gambeson_nightborn'), 'Gambeson_nightborn');
  assert.equal(classOf('Gambeson_nightborn'), 'cloth');
});

test('grades: a TRELLIS-cut family grades by its material kind with no CLASS_OF row, and a null exemption stays exempt', () => {
  assert.equal(classOf('PlaguedoctorIron'), 'metal'); assert.equal(classOf('PlaguedoctorCloth'), 'cloth'); assert.equal(classOf('WitchLeather'), 'leather');
  assert.equal(classOf('Bone'), null); assert.equal(classOf('DwarfIron'), 'metal'); assert.equal(classOf('Nonsense'), undefined);
});

// Per-rank weapon looks (characters.ts `grade`): the draws under each beta opponent's weapon node(s), read off his shipped rig.
const weaponMaterials = (body: string) => {
  const bytes = readFileSync(new URL(`../src/assets/${body}.glb`, import.meta.url)), length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + length)) as { nodes: { name: string; mesh?: number; children?: number[] }[]; meshes: { primitives: { material?: number }[] }[]; materials: { name: string }[] };
  const found = new Set<string>(), walk = (i: number) => { const node = json.nodes[i]!; if (node.mesh !== undefined) for (const p of json.meshes[node.mesh]!.primitives) found.add(json.materials[p.material!]!.name); node.children?.forEach(walk); };
  json.nodes.forEach((node, i) => { if (['WeaponDrawn', 'SwordDrawn', 'SwordSheathed'].includes(node.name)) walk(i); });
  return [...found];
};

test('grades: every beta opponent\'s weapon is classified, and each carries the rung on at least one draw', () => {
  for (const [id, recipe] of Object.entries(ROSTER)) {
    if ('hold' in recipe && recipe.hold) continue;
    const materials = weaponMaterials(recipe.body);
    assert.ok(materials.length, `${id} has a weapon draw`);
    for (const material of materials) assert.notEqual(classOf(material), undefined, `${id}'s weapon material ${material} is in neither a grade class nor the exemption list`);
    assert.ok(materials.some(m => gradeFor('Recruit', m)), `${id}'s ${recipe.weapon} carries the rung: ${materials.join('/')}`);
  }
  assert.deepEqual(gradeFor('Origin', 'WeaponCleaver'), GRADES.Origin.metal, 'a blade takes the metal row');
  assert.equal(classOf('WitchStone'), 'stone', 'the Witch\'s fire-stone has a rung row');
  assert.deepEqual(gradeFor('Origin', 'WeaponCleaverShaft'), GRADES.Origin.trim, 'a hilt takes the trim row');
  assert.equal(gradeFor('Origin', 'WeaponTridentShaft'), null, 'a wooden shaft stays wood');
});

// Lead (2026-09-27): every opponent at every rank, so rank 1 and rank 10 must differ on at least one draw of every beta weapon — the tint's
// hue/gain/strength, the finish factors, or a stone's glow. Measured on each shipped material as the runtime tints it (no map: node has no canvas).
test('grades: every beta opponent\'s weapon looks different at rank 1 and rank 10', () => {
  const look = (m: MeshStandardMaterial) => [...((m.userData.rankTint as number[] | undefined) ?? []), m.metalness, m.roughness, m.emissive.r, m.emissive.g, m.emissive.b, m.emissiveIntensity];
  for (const [id, recipe] of Object.entries(ROSTER)) {
    if ('hold' in recipe && recipe.hold) continue;
    const changed = weaponMaterials(recipe.body).filter(name => {
      const source = new MeshStandardMaterial({ name, color: new Color(.3, .3, .3), emissive: name === 'WitchStone' ? new Color(0, .48, .04) : new Color(0, 0, 0) });
      const low = look(tinted(source, 'Recruit')), high = look(tinted(source, 'Origin'));
      return low.some((v, i) => Math.abs(v - high[i]!) > .05);
    });
    assert.ok(changed.length, `${id}'s ${recipe.weapon} is identical at Recruit and Origin`);
  }
  const stone = new MeshStandardMaterial({ name: 'WitchStone', color: new Color(.01, .64, .07), emissive: new Color(.006, .48, .04), roughness: .3, metalness: 0 });
  const recruit = tinted(stone, 'Recruit'), origin = tinted(stone, 'Origin');
  assert.ok(origin.emissiveIntensity > recruit.emissiveIntensity * 3, `the fire-stone glows harder up the ladder: ${recruit.emissiveIntensity} → ${origin.emissiveIntensity}`);
  assert.equal(origin.roughness, .3, 'stone stays stone: roughness untouched'); assert.equal(origin.metalness, 0, 'and never turns metal');
});

// The weapon-metal floor (Lead 2026-10-07): a Recruit's trident fork read as tan planks. Weapon blades/heads never grade below iron; armour is untouched.
test('grades: a weapon-metal blade never grades below iron, armour metal keeps every row, and the rungs from Veteran up are unchanged', () => {
  const iron = GRADES.Praetorian.metal;
  for (const material of WEAPON_METAL) {
    assert.equal(classOf(material), 'metal', `${material} is a metal-class weapon material`);
    for (const tier of ['Recruit', 'Legionary', 'Gladiator'] as const) {
      const f = gradeFor(tier, material)!;
      assert.deepEqual(f, iron, `${tier} ${material} wears iron`);
      assert.ok(f.metalness >= iron.metalness, `${tier} ${material} metalness ${f.metalness}`);
    }
    for (const tier of TIERS.slice(3)) assert.deepEqual(gradeFor(tier, material), GRADES[tier].metal, `${tier} ${material} climbs unchanged`);
  }
  // Hard-coded pre-change Recruit/Legionary/Gladiator metal rows, which armour pieces must still wear byte for byte.
  const before = { Recruit: { color: '#6b5a48', metalness: .30, roughness: .96 }, Legionary: { color: '#5c4a38', metalness: .40, roughness: .90 }, Gladiator: { color: '#cbbd9a', metalness: .05, roughness: .72 } };
  for (const material of ['Steel', 'Bronze', 'DwarfIron', 'Blade', 'PlaguedoctorIron'])
    for (const [tier, row] of Object.entries(before)) assert.deepEqual(gradeFor(tier as typeof TIERS[number], material), row, `${tier} ${material} armour is untouched`);
  assert.deepEqual(gradeFor('Recruit', 'GladiusBronze'), GRADES.Recruit.trim, 'the guard stays trim');
  assert.equal(gradeFor('Recruit', 'WeaponTridentShaft'), null, 'wood stays wood');
});
