// Dom: data-led, plug-and-play for zones 3...700, nothing per zone. Camera B (the fight frame) is the schema DEFAULT: a zone row that names no camera preset walks with B, and only a zone that
// names a preset (or its own presets map) overrides it.
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadZone } from './loader.ts';
import { resolveZone } from './resolve.ts';

const B = { back: 6.4, up: 3.5, side: 0, ahead: 2, lookY: 1.1 }, A = { back: 3.6, up: 2.1, side: 0.8, ahead: 4, lookY: 1.5 };
const bare = { name: 'Bare', level: 3 } as Parameters<typeof resolveZone>[1];

test('a zone row with no camera preset resolves to "b", with the shared a/b framings', () => {
  const v = resolveZone('3', bare).values;
  assert.equal(v['camera.preset'], 'b'); assert.deepEqual(v['camera.presets'], { a: A, b: B });
});

test('Zone 1 and Zone 2 set no camera preset or presets: the default is what they walk with', () => {
  for (const id of ['1', '2']) { const z = loadZone(id); assert.equal(z.fields!['camera.preset'], 'b', `zone ${id}`); assert.deepEqual(z.fields!['camera.presets'], { a: A, b: B }); assert.ok(!z.set?.includes('camera.preset') && !z.set?.includes('camera.presets'), `zone ${id} sets no camera preset`); }
});

test('mutation: a zone that names preset "a" overrides the default; one that names none keeps "b"', () => {
  assert.equal(resolveZone('4', { ...bare, camera: { preset: 'a' } } as Parameters<typeof resolveZone>[1]).values['camera.preset'], 'a');
  assert.equal(resolveZone('5', bare).values['camera.preset'], 'b');
});
