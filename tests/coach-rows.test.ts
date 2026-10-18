// The coach's stance brains, per-foe lapse and stance scale are rows (src/coach-defs.json): every value equals the literal it replaced in src/coach.ts, and the loader refuses a broken row.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRegistry, tableFromFile, type Manifest } from '../src/core/registry.ts';
import DEFS from '../src/coach-defs.json' with { type: 'json' };
import MANIFEST from '../src/coach-defs.manifest.json' with { type: 'json' };
import { COACH_BRAINS, FOE_LAPSE, FOE_LAPSE_SCALE } from '../src/coach.ts';

test('the coach rows equal the literals they replaced', () => {
  assert.deepEqual(COACH_BRAINS, {
    neutral: { lapse: 0.5, read: 0.5 },
    aggressive: { aggression: 0.9, parry: 0.2, lapse: 0.6, read: 0.45 },
    defensive: { parry: 0.7, dodge: 0.1, aggression: 0.35, guard: 1, lapse: 0.4, read: 0.6 },
    trickster: { feint: 0.5, kick: 0.6, aggression: 0.7, parry: 0.2, lapse: 0.5, read: 0.5 },
  });
  assert.deepEqual(FOE_LAPSE, { goblin: 0.15, nightborn: 0.08, executioner: 0.2, dwarf: 0.25, knight: 0.18, shieldmaiden: 0.08, plaguedoctor: -0.1 });
  assert.deepEqual(FOE_LAPSE_SCALE, { neutral: 1, aggressive: 1.8, defensive: 0.35, trickster: 0.8 });
});

test('the loader accepts the rows and refuses a duplicate id and a missing field', () => {
  const tables = (d: unknown) => MANIFEST.tables.map((t) => tableFromFile(t as unknown as Manifest, d as never, 'coach-defs.json'));
  loadRegistry(tables(DEFS));
  assert.throws(() => loadRegistry(tables({ ...DEFS, coachFoe: [...DEFS.coachFoe, DEFS.coachFoe[0]] })));
  assert.throws(() => loadRegistry(tables({ ...DEFS, coachStance: [{ id: 'coach-neutral', stance: 'neutral', brain: {} }] })));
});
