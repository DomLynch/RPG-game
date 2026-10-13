// sandbox-mech: wounds. A wound row (stance-defs.json `wounds`: id, site, per-mille deltas on the stance quantities) marks the defender with a
// scar on the first blade wound at that site; every stanced() read then carries the scar's delta for the rest of the duel. No rows = inert.
import test from 'node:test';
import assert from 'node:assert/strict';
import STANCE_DEFS from '../src/fight/stance-defs.json' with { type: 'json' };

(STANCE_DEFS as unknown as { wounds: unknown[] }).wounds = [{ id: 'sword-arm', site: 'torso', block: 300, damage: -200 }];
const { stanced, woundsAt } = await import('../src/fight/stance.ts');

test('a wound row names its site and nothing else', () => {
  assert.deepEqual(woundsAt('torso'), ['sword-arm']);
  assert.deepEqual(woundsAt('legs'), []);
});

test('a scar scales its quantities on top of the stance; no scar is the number untouched', () => {
  assert.equal(stanced({}, 'damage', 100), 100);
  assert.equal(stanced({ scars: ['sword-arm'] }, 'damage', 100), 80);
  assert.equal(stanced({ scars: ['sword-arm'] }, 'block', 100), 130);
  assert.equal(stanced({ stance: 'aggressive', scars: ['sword-arm'] }, 'block', 1000), stanced({ scars: ['sword-arm'] }, 'block', stanced({ stance: 'aggressive' }, 'block', 1000)));
  assert.equal(stanced({ scars: ['sword-arm'] }, 'poise', 100), 100);
});
