// The scene-space HUD pieces carry a tag so a full-screen look pass can leave them out (the ink look). Pure three.js objects, no renderer.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { hudPieces, markHud, withoutHud } from './hud-tag.ts';

test('hudPieces finds tagged pieces only', () => {
  const root = new THREE.Group(), tag = markHud(new THREE.Sprite(), 'tag'), plain = new THREE.Mesh();
  root.add(tag, plain);
  assert.equal(tag.userData.hud, 'tag');
  assert.deepEqual(hudPieces(root), [tag]);
});

// The pieces are made where the DOM canvas and the scene are (a canvas 2D context for the sprites), so the tagging is pinned at its source.
test('every scene-space HUD piece is tagged where it is made: name tags, "!", notice ring, ground ring', () => {
  const read = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
  assert.match(read('./label-sprite.ts'), /return markHud\(s, 'tag'\)/);
  assert.match(read('./mobs-view.ts'), /return markHud\(s, 'bang'\)/);
  assert.match(read('./mobs-view.ts'), /markHud\(ring, 'ring'\)/);
  assert.match(read('./ground-item-view.ts'), /markHud\(m, 'ground-ring'\)/);
});

test('withoutHud hides every piece for the draw and restores what each had (a hidden "!" stays hidden)', () => {
  const root = new THREE.Group(), ring = markHud(new THREE.Mesh(), 'ring'), bang = markHud(new THREE.Sprite(), 'bang'), body = new THREE.Mesh();
  bang.visible = false; root.add(ring, bang, body);
  const seen = withoutHud(root, () => [ring.visible, bang.visible, body.visible]);
  assert.deepEqual(seen, [false, false, true], 'during the draw: HUD hidden, the body drawn');
  assert.deepEqual([ring.visible, bang.visible, body.visible], [true, false, true], 'after: restored, the calm "!" still hidden');
  assert.throws(() => withoutHud(root, () => { throw new Error('x'); }), /x/);
  assert.equal(ring.visible, true, 'restored even when the draw throws');
});

test('markHud tags a whole group', () => {
  const g = new THREE.Group(), a = new THREE.Mesh(); g.add(a);
  markHud(g, 'ground-ring');
  assert.deepEqual([g.userData.hud, a.userData.hud], ['ground-ring', 'ground-ring']);
});
