import test from 'node:test';
import assert from 'node:assert/strict';
import { MeshStandardMaterial, Texture } from 'three';
import { TIERS } from '../src/grades.ts';
import { tinted } from '../src/rank-tint.ts';

test('rank tint: cloth, bone and authored art are never tinted — the source itself comes back', () => {
  for (const name of ['Gambeson_veteran', 'Heraldry', 'Bone', 'Ruby', 'Wood']) {
    const source = new MeshStandardMaterial({ name });
    for (const tier of TIERS) assert.equal(tinted(source, tier), source, `${name} at ${tier}`);
  }
});

test('rank tint: metal, trim and leather get one shared clone per rung, keep their maps and colour, and share ONE shader program', () => {
  const map = new Texture();
  for (const name of ['Steel', 'Bronze', 'Antique brass', 'Leather', 'KnightIron']) {
    const source = new MeshStandardMaterial({ name, color: '#8a8a8a', map });
    const all = TIERS.map(tier => tinted(source, tier));
    assert.equal(new Set(all).size, TIERS.length, `${name}: a clone per rung`);
    for (const [i, material] of all.entries()) {
      assert.notEqual(material, source, `${name}: the source is never written`);
      assert.equal(tinted(source, TIERS[i]!), material, `${name}: cached`);
      assert.equal(material.map, map, `${name}: the map is shared, not copied or dropped`);
      assert.ok(material.color.equals(source.color), `${name}: the base colour is not repainted (the old gradeMaterial's flattening)`);
      assert.equal(material.customProgramCacheKey(), 'rank-tint', `${name}: every rung shares one program`);
      assert.equal(material.userData.rankTier, TIERS[i]);
    }
  }
});

test('rank tint: a map-less piece takes its finish toward the grade; Origin shines where Recruit is dull', () => {
  const source = new MeshStandardMaterial({ name: 'Steel', metalness: 0.5, roughness: 0.5 });
  const recruit = tinted(source, 'Recruit'), origin = tinted(source, 'Origin');
  assert.ok(recruit.roughness > source.roughness && origin.roughness < source.roughness, `roughness ${recruit.roughness} / ${origin.roughness}`);
  assert.ok(origin.metalness > recruit.metalness, `metalness ${recruit.metalness} / ${origin.metalness}`);
  assert.equal(source.metalness, 0.5, 'the source is untouched');
});
