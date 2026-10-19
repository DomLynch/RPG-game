import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { Group, Mesh, MeshStandardMaterial, BoxGeometry, Texture } from 'three';
import { SHARED_MAPPED } from '../src/fight/character-looks-rows.ts';
import { awaitShared, rigMaterials, sourceMaterial } from '../src/fight/characters.ts';

// The troll's white leg wraps (pitborn.Greaves / pitborn.Boots, Wrap material): loot.glb's `Wrap` has no map, `wear` swaps in the wearer's mapped Wrap, and the troll
// has none (one `WorldBody` material), so the piece stayed white. A name listed in character-looks-defs.json `sharedmapped` falls back to the first mapped copy any rig showed.

const mapped = (name: string) => new MeshStandardMaterial({ name, map: new Texture() });
const rigWith = (...materials: MeshStandardMaterial[]) => { const root = new Group(); for (const m of materials) root.add(new Mesh(new BoxGeometry(), m)); return root; };
const piece = (name: string, opponent: string) => { const m = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name })); m.userData.opponent = opponent; return m; };

// The rows are only right if the shared name's map really is one texture everywhere: the image bytes of every shipped rig that maps it.
test('a shared mapped name is one texture on every shipped rig that maps it', () => {
  assert.ok(SHARED_MAPPED.length > 0, 'the sharedmapped rows exist');
  const files = readdirSync(new URL('../src/assets/', import.meta.url)).filter((f) => f.endsWith('.glb') && f !== 'loot.glb');
  for (const name of SHARED_MAPPED) {
    const hashes = new Map<string, string>();
    for (const file of files) {
      const bytes = readFileSync(new URL(`../src/assets/${file}`, import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
      const m = (json.materials ?? []).find((x: { name: string }) => x.name === name), t = m?.pbrMetallicRoughness?.baseColorTexture;
      if (!t) continue;
      const texture = json.textures[t.index], image = json.images[texture.source ?? texture.extensions?.EXT_texture_webp?.source], view = json.bufferViews[image.bufferView];
      const start = 28 + size + (view.byteOffset ?? 0);
      hashes.set(file, createHash('sha1').update(bytes.subarray(start, start + view.byteLength)).digest('hex'));
    }
    assert.ok(hashes.size >= 2, `${name}: at least two rigs map it (${[...hashes.keys()]})`);
    assert.equal(new Set(hashes.values()).size, 1, `${name}: the same image on ${[...hashes.keys()].join(', ')}`);
  }
});

test('a wearer with no mapped copy of a shared name wears the first copy any rig showed; an unshared name keeps the piece\'s own', () => {
  const troll = rigWith(mapped('WorldBody')), wrap = piece('Wrap', 'pitborn'), steel = piece('Steel', 'pitborn');
  assert.equal(sourceMaterial(wrap, rigMaterials(troll)), wrap.material, 'no rig has shown a mapped Wrap yet: the piece keeps its own');
  // A cold load: the troll wears its leg wrap (plain, and at a rank tint) before any rig has shown a mapped Wrap. Both wait, and neither stays white.
  const worn = new Mesh(new BoxGeometry(), wrap.material), tintedWorn = new Mesh(new BoxGeometry(), wrap.material), stray = new Mesh(new BoxGeometry(), wrap.material);
  new Group().add(worn, tintedWorn);   // worn pieces hang on a parent; `stray` has none (taken off)
  awaitShared(worn, wrap, wrap.material, undefined); awaitShared(tintedWorn, wrap, wrap.material, 'Champion'); awaitShared(stray, wrap, wrap.material, undefined);
  assert.equal(worn.material, wrap.material, 'still the mapless white until a rig shows the copy');
  const hero = rigWith(mapped('Wrap'), mapped('Steel')), heroWrap = rigMaterials(hero).get('Wrap');
  assert.ok(heroWrap, 'the hero rig maps Wrap');
  assert.equal(worn.material, heroWrap, 'the first rig to show a mapped Wrap settles the waiting piece');
  assert.ok(tintedWorn.material instanceof MeshStandardMaterial && tintedWorn.material.map === heroWrap.map, 'the tinted piece takes the shared map at its rank tint');
  assert.equal(stray.material, wrap.material, 'a piece that was taken off is left alone');
  assert.equal(sourceMaterial(wrap, rigMaterials(troll)), heroWrap, 'the troll\'s pitborn Wrap is now the shared mapped copy');
  assert.equal(sourceMaterial(steel, rigMaterials(troll)), steel.material, 'Steel is not a shared name: a rig that maps nothing of it leaves the piece its own');
  const own = mapped('Wrap');
  assert.equal(sourceMaterial(wrap, rigMaterials(rigWith(own))), own, 'a wearer that maps its own Wrap keeps wearing it');
});
