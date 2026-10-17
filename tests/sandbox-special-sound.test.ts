// sandbox specialSound rows: a melee special's own sounds. `on: start` rows play when it is committed (the swing's whoosh), the rest when it lands on the foe; a spell, a self-heal and a skill with no rows add nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const rows = (DEFS as unknown as { specialSound: object[] }).specialSound;
const { cuesFor } = await import('../src/fight/sound/cues.ts');
const started = (extra: object = {}) => ({ tick: 1, type: 'SpecialStarted', actor: 0, move: 'skill_reaping', ...extra }) as never;
const landed = (extra: object = {}) => ({ tick: 2, type: 'SpecialLanded', actor: 0, target: 1, move: 'skill_reaping', damage: 10, ...extra }) as never;
const names = (events: never[]) => cuesFor(events).map((c) => c.name);

test('with no rows (trunk) a special adds no sound', () => {
  assert.deepEqual(names([started(), landed()]), []);
});

test('start rows whoosh when the special is committed; land rows sound when it lands', () => {
  rows.push({ id: 'reaping', cue: 'whoosh_heavy', gain: 600, room: 200, delay: 120, on: 'start' }, { id: 'reaping', cue: 'whoosh_heavy', gain: 750, room: 200, delay: 300, on: 'start' }, { id: 'reaping', cue: 'hit_heavy', gain: 750, room: 300, delay: 0 }, { id: 'reaping', cue: 'flesh_cut', gain: 550, room: 200, delay: 0 });
  const swing = cuesFor([started()]), hit = cuesFor([landed()]);
  assert.deepEqual(swing.map((c) => c.name), ['whoosh_heavy', 'whoosh_heavy']);
  assert.deepEqual(swing.map((c) => c.delay), [0.12, 0.3]);
  assert.deepEqual(hit.map((c) => c.name), ['hit_heavy', 'flesh_cut']);
  assert.deepEqual(names([started({ spell: 'x' })]), [], 'a spell is not a melee special');
  assert.deepEqual(names([landed({ target: 0 })]), [], 'a heal on yourself makes no impact sound');
  rows.length = 0;
});
