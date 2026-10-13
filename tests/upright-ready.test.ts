import test from 'node:test';
import assert from 'node:assert/strict';
import { readyOffset, slouchFrom } from '../src/fight/upright-ready.ts';

test('upright ready: on by default, ?look=slouch is the only off-switch', () => {
  assert.equal(slouchFrom(''), false);
  assert.equal(slouchFrom('?look=silhouette'), false);
  assert.equal(slouchFrom('?look=upright'), false);
  assert.equal(slouchFrom('?look=slouch'), true);
});

test('upright ready: one mild row per body, radians from degree rows', () => {
  for (const id of ['hero', 'executioner', 'veteran']) assert.ok(readyOffset(id), id);
  assert.equal(readyOffset('goblin'), undefined);
  assert.equal(readyOffset('hero-full'), undefined, 'the full-gap rows are gone: Dom picked mild');
  const h = readyOffset('hero')!;
  assert.ok(Math.abs(h.spine2 + 8 * Math.PI / 180) < 1e-9 && Math.abs(h.spine3 + 8 * Math.PI / 180) < 1e-9 && Math.abs(h.neck - 10 * Math.PI / 180) < 1e-9);
});

test('upright ready: every opponent on the shared hero rig has a mild row, the same offsets as the player', async () => {
  const { OPPONENTS } = await import('../src/fight/moves.ts');
  const heroRig = Object.values(OPPONENTS).filter((o) => o.rig === 'hero').map((o) => o.id);
  assert.ok(heroRig.length >= 10);
  for (const id of heroRig) assert.deepEqual(readyOffset(id), readyOffset('hero'), id);
  for (const id of Object.values(OPPONENTS).filter((o) => o.rig !== 'hero').map((o) => o.id)) assert.equal(readyOffset(id), undefined, `${id} has its own rig`);
});
