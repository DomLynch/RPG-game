// Brief 14: the grade table is factors only, covers every material the shipped kit actually uses, and reads as eight distinct grades.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { TITLES } from '../src/career.ts';
import { CLASS_OF, GRADES, TIERS, classOf, gradeFor, houseFor, levelOf, materialOf } from '../src/grades.ts';

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
