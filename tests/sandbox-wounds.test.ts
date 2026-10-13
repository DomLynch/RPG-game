// sandbox-mech: wounds. A wound row (stance-defs.json `wounds`: id, site, per-mille deltas on the stance quantities) marks the defender with a
// scar on the first blade wound at that site; every stanced() read then carries the scar's delta for the rest of the duel. No rows = inert.
import test from 'node:test';
import assert from 'node:assert/strict';
import STANCE_DEFS from '../src/fight/stance-defs.json' with { type: 'json' };

(STANCE_DEFS as unknown as { wounds: unknown[] }).wounds = [{ id: 'sword-arm', site: 'torso', block: 300, damage: -200, ceil: 10, below: 10 }];
const { stanced, woundsAt } = await import('../src/fight/stance.ts');

test('a wound row names its site and nothing else', () => {
  assert.deepEqual(woundsAt('torso', 10), ['sword-arm']);
  assert.deepEqual(woundsAt('torso', 11), [], 'a `below` row waits for the health step');
  assert.deepEqual(woundsAt('torso'), [], 'no health given = full health');
  assert.deepEqual(woundsAt('legs'), []);
});

test('a scar scales its quantities on top of the stance; no scar is the number untouched', () => {
  assert.equal(stanced({}, 'damage', 100), 100);
  assert.equal(stanced({ scars: ['sword-arm'] }, 'damage', 100), 80);
  assert.equal(stanced({ scars: ['sword-arm'] }, 'block', 100), 130);
  assert.equal(stanced({ stance: 'aggressive', scars: ['sword-arm'] }, 'block', 1000), stanced({ scars: ['sword-arm'] }, 'block', stanced({ stance: 'aggressive' }, 'block', 1000)));
  assert.equal(stanced({ scars: ['sword-arm'] }, 'poise', 100), 100);
});

test('the notice fires once per new scar, and a new fight (a shorter list) starts again', async () => {
  const { gained } = await import('../src/fight/wound-notice.ts');
  assert.deepEqual(gained(0, undefined), { ids: [], seen: 0 });
  assert.deepEqual(gained(0, ['sword-arm']), { ids: ['sword-arm'], seen: 1 });
  assert.deepEqual(gained(1, ['sword-arm']), { ids: [], seen: 1 });
  assert.deepEqual(gained(1, undefined), { ids: [], seen: 0 });
  assert.deepEqual(gained(1, ['sword-arm', 'x']), { ids: ['x'], seen: 2 });
});

test('a wound row\'s ceil column is its stamina-ceiling cost', async () => {
  const { woundCeil } = await import('../src/fight/stance.ts');
  assert.equal(woundCeil('sword-arm'), 10);
  assert.equal(woundCeil('nothing'), 0);
});
