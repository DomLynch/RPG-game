// The Pit's rack shows a loot piece as it will read on him (Lead, #1122 stills: goblin.Boots hung flat white): the rack resolves a piece's
// material with the same rule `wear` does, so a mapless palette material takes his rig's mapped one where the source rig maps that name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, MeshStandardMaterial, BoxGeometry, Texture } from 'three';
import { rigMaterials, sourceMaterial } from '../src/characters.ts';

test('a rack piece takes his mapped Wrap (goblin maps it), keeps its own where the source does not, and skips his worn copies', () => {
  const rig = new Group(), mappedWrap = new MeshStandardMaterial({ name: 'Wrap', map: new Texture() });
  const worn = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: 'Bronze', map: new Texture() }));
  rig.add(new Mesh(new BoxGeometry(), mappedWrap), worn);
  const materials = rigMaterials(rig, new Set([worn]));
  assert.deepEqual([...materials.keys()], ['Wrap']);
  const piece = (opponent: string, name: string) => Object.assign(new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name })), { userData: { opponent } });
  assert.equal(sourceMaterial(piece('goblin', 'Wrap'), materials), mappedWrap);
  const veteranWrap = piece('veteran', 'Wrap');   // the Veteran's rig maps only Bronze: his Wrap keeps its own (ruling C)
  assert.equal(sourceMaterial(veteranWrap, materials), veteranWrap.material);
});
