// The goblin war band (war-band.ts): the first hit sounds the alarm, the horn-blower runs for the horn and, if he arrives, the nearest goblins rally once; killed first, the horn is never blown.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWarBand, pickRoles, type Goblin } from './war-band.ts';

const ROWS = { hornRunSpeed: 4, hornReach: 0.6, rallyCount: 3, rallySeconds: 20 };
const G: Goblin[] = [{ id: 'g1', loadout: 'goblin.scrapper', x: 0, z: 0 }, { id: 'g2', loadout: 'goblin.captain', x: 5, z: 0 }, { id: 'g3', loadout: 'goblin.guard', x: 9, z: 0 }, { id: 'g4', loadout: 'goblin.cutter', x: 3, z: 3 }];
const pieces = (l: string | undefined) => ({ 'goblin.scrapper': 2, 'goblin.cutter': 3, 'goblin.guard': 5, 'goblin.captain': 6 } as Record<string, number>)[l ?? ''] ?? 0;

test('the captain wears the most, the horn-blower the least, and they are different goblins', () => {
  assert.deepEqual(pickRoles(G, pieces), { captain: 'g2', blower: 'g1' });
  assert.deepEqual(pickRoles([G[0]!], pieces), { captain: 'g1', blower: null }); assert.deepEqual(pickRoles([], pieces), { captain: null, blower: null });
});

const run = (wb: ReturnType<typeof createWarBand>, pos: Map<string, { x: number; z: number }>, seconds: number) => {
  let rallied: readonly string[] | null = null; for (let t = 0; t < seconds * 60; t++) { const s = wb.update(1 / 60, (id) => pos.get(id) ?? null, (_x, _z, n) => ['g2', 'g3', 'g4', 'g1'].slice(0, n)); if (s.walk) pos.set(wb.blower()!, { x: s.walk.x, z: s.walk.z }); if (s.rally) rallied = s.rally; } return rallied;
};

test('nothing happens until a goblin is hit; then the horn-blower runs to the horn and the nearest goblins rally exactly once', () => {
  const wb = createWarBand(ROWS), pos = new Map(G.map((g) => [g.id, { x: g.x, z: g.z }])); wb.assign(pickRoles(G, pieces), { x: 10, z: 10 });
  assert.equal(run(wb, pos, 5), null); assert.equal(wb.phase(), 'idle');
  wb.hit('g3'); assert.equal(wb.phase(), 'alarm');
  const rallied = run(wb, pos, 6); assert.deepEqual(rallied, ['g2', 'g3', 'g4'], 'the rally is rallyCount goblins'); assert.equal(wb.phase(), 'rallied');
  assert.ok(Math.hypot(pos.get('g1')!.x - 10, pos.get('g1')!.z - 10) <= ROWS.hornReach + 0.1, 'the horn-blower is at the horn');
  assert.equal(run(wb, pos, 5), null, 'once only'); wb.hit('g4'); assert.equal(wb.phase(), 'rallied');
});

test('the run takes the distance over the speed, and a horn-blower killed on the way means the camp fights as singles', () => {
  const wb = createWarBand(ROWS), pos = new Map(G.map((g) => [g.id, { x: g.x, z: g.z }])); wb.assign(pickRoles(G, pieces), { x: 12, z: 0 }); wb.hit('g2');
  let steps = 0; while (wb.phase() === 'alarm' && steps < 2000) { const s = wb.update(1 / 60, (id) => pos.get(id) ?? null, () => []); if (s.walk) pos.set('g1', { x: s.walk.x, z: s.walk.z }); steps++; }
  assert.ok(Math.abs(steps / 60 - (12 - 0.6) / 4) < 0.1, `about ${(12 / 4).toFixed(1)} s: ${(steps / 60).toFixed(2)}`);
  const w2 = createWarBand(ROWS), p2 = new Map(G.map((g) => [g.id, { x: g.x, z: g.z }])); w2.assign(pickRoles(G, pieces), { x: 12, z: 0 }); w2.hit('g3');
  run(w2, p2, 1); w2.fell('g1'); assert.equal(w2.phase(), 'silenced'); assert.equal(run(w2, p2, 10), null, 'the horn is never blown'); w2.hit('g4'); assert.equal(w2.phase(), 'silenced');
});
