// Zone 1 in the shared world: two v2 clients stand by the troll cave, well outside the 300 m Concord square, and each sees the other, pose by pose; a v1 client (town square only) sees nobody there.
// The same joinBot helper (test-client.ts) is what the release row drives, so the row and this test cannot drift apart.
import test from 'node:test';
import assert from 'node:assert/strict';
import { frontierPlan } from '../preview/frontier-plan.ts';
import { zoneIds } from '../zones/loader.ts';
import { createPresence } from './server.ts';
import { CENTRE_CM, LEGACY_SHIFT_CM, zoneAt } from './zones.ts';
import { joinBot } from './test-client.ts';

const A = '00000000-0000-4000-8000-0000000000a1', B = '00000000-0000-4000-8000-0000000000b2', V1 = '00000000-0000-4000-8000-0000000000c3';
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const until = async (ok: () => boolean, ms = 3000): Promise<void> => { for (let t = 0; t < ms && !ok(); t += 50) await wait(50); };

// The troll cave's place in the Concord frame (metres), from the zone data: the same numbers the page walks on.
const cave = (() => {
  for (const id of zoneIds()) for (const z of frontierPlan(true, id).zones) { const l = z.landmarks['troll-cave']; if (l) return { x: l.x, z: l.z }; }
  throw new Error('no troll-cave landmark in any zone package');
})();
const spot = (dx: number): { x: number; z: number } => ({ x: Math.round(CENTRE_CM + (cave.x + dx) * 100), z: Math.round(CENTRE_CM + cave.z * 100) });

test('the troll cave is a Zone 1 place far outside the v1 square', () => {
  assert.ok(Math.abs(cave.x) > 150 || Math.abs(cave.z) > 150, `cave at ${cave.x},${cave.z}`);
  const s = spot(0); assert.ok(zoneAt(s.x, s.z), 'inside a Zone 1 zone row');
});

test('two v2 clients at the troll cave see each other and follow each other\'s moves; a v1 client sees nobody', async () => {
  const accounts: Record<string, string> = { a: A, b: B, v1: V1 };
  const places: Record<string, { x: number; z: number }> = { [A]: spot(0), [B]: spot(12) };   // saved spots (the writer serves the old frame)
  const p = createPresence({ verify: async (t) => accounts[t] ?? null, log: () => {},
    locate: async (a) => (places[a] ? { x: places[a]!.x - LEGACY_SHIFT_CM, z: places[a]!.z - LEGACY_SHIFT_CM } : null) });
  await new Promise<void>((r) => p.server.listen(0, '127.0.0.1', r));
  try {
    const a = await joinBot(p.port(), 'a'), b = await joinBot(p.port(), 'b'), old = await joinBot(p.port(), 'v1', { v1: true });
    assert.deepEqual(a.frame, { centreCm: CENTRE_CM, sizeCm: 65535 }, 'the hello names the whole-world frame');
    assert.ok(Math.abs(a.at().x - cave.x) < 0.01 && Math.abs(a.at().z - cave.z) < 0.01, 'a v2 join lands at its saved spot in Zone 1, not the Pit');
    await until(() => a.seen().some((e) => Math.abs(e.x - (cave.x + 12)) < 0.02) && b.seen().some((e) => Math.abs(e.x - cave.x) < 0.02));
    assert.equal(a.seen().length, 1, 'A sees exactly B'); assert.equal(b.seen().length, 1, 'B sees exactly A');
    assert.ok(Math.abs(a.seen()[0]!.z - cave.z) < 0.02);
    // A walks 9 m toward B at an honest pace (one metre per pose, a pose every 150 ms is ~6.7 m/s, under the speed clamp).
    for (let i = 1; i <= 9; i++) { a.pose(cave.x + i, cave.z); await wait(150); }
    await until(() => b.seen().some((e) => Math.abs(e.x - (cave.x + 9)) < 0.02));
    assert.ok(b.seen().some((e) => Math.abs(e.x - (cave.x + 9)) < 0.02 && Math.abs(e.z - cave.z) < 0.02), 'B sees A at the new place');
    assert.equal(old.seen().length, 0, 'a v1 client (the Concord square) sees nobody at the cave');
    assert.equal(p.world.byAccount.get(V1)!.legacy, true);
    a.close(); b.close(); old.close();
  } finally { await p.close(); }
});
