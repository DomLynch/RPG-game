// Zone 5 "The Bone Hollow" in the shared world (Lead 2026-10-17, beta dungeon): the real zone tables and the real warp table. Two clients warp to the dungeon gate and see each other; a client that
// warps to the Zone 1 cave mouth sees neither of them; nobody earns a strike or a snap. The landing rows must stay inside their zone rows, so a data move that drifts a warp out fails here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresence } from './server.ts';
import { warpPlace } from './warps.ts';
import { CENTRE_CM, zoneAt } from './zones.ts';
import { joinBot } from './test-client.ts';

const A = '00000000-0000-4000-8000-0000000000a1', B = '00000000-0000-4000-8000-0000000000b2', C = '00000000-0000-4000-8000-0000000000c3';
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const until = async (ok: () => boolean, ms = 3000): Promise<void> => { for (let t = 0; t < ms && !ok(); t += 25) await wait(25); };
const metres = (id: string): { x: number; z: number } => { const p = warpPlace(id)!; return { x: (p.x - CENTRE_CM) / 100, z: (p.z - CENTRE_CM) / 100 }; };
const zoneOf = (id: string): string | null => zoneAt(warpPlace(id)!.x, warpPlace(id)!.z);

test('the dungeon warp rows stand inside their zone rows: the gate in the Bone Hollow, the cave mouth in Cinder Fields', () => {
  assert.equal(zoneOf('zone5-gate'), 'bone-hollow');
  assert.equal(zoneOf('zone1-cave-mouth'), 'cinder-fields');
});

test('two clients warp to the Zone 5 gate and see each other, a client at the Zone 1 cave mouth sees neither, and nobody is struck or snapped', async () => {
  const p = createPresence({ verify: async (t) => ({ a: A, b: B, c: C } as Record<string, string>)[t] ?? null, log: () => {} });
  await new Promise<void>((r) => p.server.listen(0, '127.0.0.1', r));
  try {
    const a = await joinBot(p.port(), 'a'), b = await joinBot(p.port(), 'b'), c = await joinBot(p.port(), 'c');
    a.warp('zone5-gate'); b.warp('zone5-gate'); c.warp('zone1-cave-mouth');
    await until(() => a.hellos() === 2 && b.hellos() === 2 && c.hellos() === 2);
    const gate = metres('zone5-gate');
    assert.ok(Math.abs(a.at().x - gate.x) < 0.02 && Math.abs(a.at().z - gate.z) < 0.02, 'A stands at the gate landing');
    await until(() => a.seen().length === 1 && b.seen().length === 1 && c.seen().length === 0);
    assert.equal(a.seen().length, 1, 'A sees exactly B'); assert.equal(b.seen().length, 1, 'B sees exactly A');
    assert.equal(c.seen().length, 0, 'the client in Zone 1 sees nobody in the dungeon');
    // B walks 6 m into the dungeon at an honest pace; A follows it, C still sees nothing.
    for (let i = 1; i <= 6; i++) { b.pose(gate.x + i, gate.z); await wait(150); }
    await until(() => a.seen().some((e) => Math.abs(e.x - (gate.x + 6)) < 0.02));
    assert.ok(a.seen().some((e) => Math.abs(e.x - (gate.x + 6)) < 0.02 && Math.abs(e.z - gate.z) < 0.02), 'A sees B at the new place');
    assert.equal(c.seen().length, 0);
    const zones = [A, B, C].map((id) => { const q = p.world.byAccount.get(id)!; return [zoneAt(q.x, q.z), q.strikes]; });
    assert.deepEqual(zones, [['bone-hollow', 0], ['bone-hollow', 0], ['cinder-fields', 0]], 'each is held in its zone, with no strikes');
    const s = p.stats() as { snapped: number; strikes: number };
    assert.deepEqual([s.snapped, s.strikes], [0, 0], 'no snap and no strike counted');
    a.close(); b.close(); c.close();
  } finally { await p.close(); }
});
