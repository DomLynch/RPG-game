// inkverse.json: the look row loads through the registry, the loader refuses a bad row, an unknown id leaves the plain frame, and the blue tag is wired (a row, an empty list) but unused.
import test from 'node:test';
import assert from 'node:assert/strict';
import ROWS from './inkverse.json' with { type: 'json' };
import { inkLook, loadInkLooks } from './inkverse.ts';

test('the shipped row loads and names its tags', () => {
  const look = inkLook('light');
  assert.ok(look, 'the light row exists');
  assert.ok(look.tone.low < look.tone.high, 'the tone curve has a width');
  assert.ok(look.edges.thicknessPx <= 1, 'lines are thin');
  assert.ok(look.tags.red.materials.length + look.tags.red.objects.length > 0, 'red tags something');
  assert.equal(look.tags.blue.materials.length + look.tags.blue.objects.length, 0, 'blue is wired and unused');
});

test('an unknown or absent id is no look', () => {
  assert.equal(inkLook(null), null);
  assert.equal(inkLook('no-such-look'), null);
});

test('the loader refuses a row with a missing number, a short colour or no tags', () => {
  const row = (patch: (f: Record<string, unknown>) => void) => { const f = structuredClone(ROWS.inkLooks[0]!.fields) as Record<string, unknown>; patch(f); return { inkLooks: [{ id: 'x', fields: f }] }; };
  assert.throws(() => loadInkLooks(row((f) => { delete (f.tone as Record<string, unknown>).high; })), /tone\.high/);
  assert.throws(() => loadInkLooks(row((f) => { f.paper = [1, 1]; })), /paper/);
  assert.throws(() => loadInkLooks(row((f) => { delete f.tags; })), /tags/);
});
