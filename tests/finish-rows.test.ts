// The `rust` finish row (ground-loot brief, Backend #2775): a dull brown-orange iron with low sheen, written onto a sword's metal by `finishedAs`; no new mesh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MeshStandardMaterial } from 'three';
import { finishRow } from '../src/core/finish-rows.ts';
import { finishedAs } from '../src/fight/rank-tint.ts';

test('rust is brown-orange with low sheen', () => {
  const rust = finishRow('rust');
  assert.match(rust.color, /^#[0-9a-f]{6}$/);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(rust.color.slice(i, i + 2), 16));
  assert.ok(r! > g! && g! > b! && r! > 0x70, 'a warm orange-brown, red-led');
  assert.ok(rust.metalness <= 0.3, 'little metal shine');
  assert.ok(rust.roughness >= 0.85, 'matte');
  assert.throws(() => finishRow('no-such-finish'), /no row/);
});

test('finishedAs rusts metal and trim only, shared per (source, id), and leaves leather alone', () => {
  const steel = new MeshStandardMaterial({ name: 'sword.blade.Steel', metalness: 0.9, roughness: 0.3 });
  const grip = new MeshStandardMaterial({ name: 'sword.grip.Leather', metalness: 0, roughness: 0.8 });
  const a = finishedAs(steel, 'rust');
  assert.notEqual(a, steel, 'a tinted clone');
  assert.equal(finishedAs(steel, 'rust'), a, 'one clone per source and row');
  assert.ok(a.metalness < steel.metalness && a.roughness > steel.roughness, 'duller than the steel it came from');
  assert.equal(finishedAs(grip, 'rust'), grip, 'leather keeps its own look');
});
