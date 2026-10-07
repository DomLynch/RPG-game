// X2 stage 1 (docs/specs/origins/x2-presence-saved-location.md; Lead's rulings 2026-10-07): a fresh join starts at the Pit yard's centre; a first pose never places anyone;
// a reconnect lands where the server last saw the player, never where the client says; a rejoin is never inside a trade area; the memory expires and is bounded.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RULES, World, type Player } from '../origins/presence/interest.ts';
import { createPresence } from '../origins/presence/server.ts';
import { clearOfTradeAreas, inTradeArea, landmarkCm, REJOIN_EDGE, SPAWN, zoneAt } from '../origins/presence/zones.ts';
import { encodeUp } from '../origins/presence/wire.ts';

const acct = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const pose = (x: number, z: number) => ({ x, z, heading: 0, anim: 0, flags: 0 });
// Walk a player `steps` x 1 m (inside the speed clamp) toward (dx, dz) per step; the clock moves 100 ms per step.
function walk(w: World, p: Player, dx: number, dz: number, steps: number, t0: number): number {
  let t = t0;
  for (let i = 0; i < steps; i++) { t += 100; assert.equal(w.move(p, pose(p.x + dx, p.z + dz), t), 'ok'); }
  return t;
}

test('spawn: every fresh join starts at the Pit yard centre, which is in the Pit yard and outside every trade area', () => {
  const w = new World();
  const p = w.join(acct(1), 0)!;
  assert.deepEqual([p.x, p.z], [SPAWN.x, SPAWN.z]);
  assert.equal(zoneAt(SPAWN.x, SPAWN.z), 'pit-yard', 'the spawn is the Pit yard centre');
  assert.equal(inTradeArea(SPAWN.x, SPAWN.z), false, 'and never inside a trade area (Lead (c))');
  const bank = landmarkCm('exchange', 'bank'), board = landmarkCm('exchange', 'contract-board'), forge = landmarkCm('exchange', 'forge'), gate = landmarkCm('exchange', 'outer-gate');
  for (const [name, at] of [['bank', bank], ['contract board', board], ['forge', forge]] as const) assert.equal(inTradeArea(at.x, at.z), true, `the ${name} is inside the trade area, which is the whole Exchange zone`);
  assert.equal(inTradeArea(gate.x, gate.z), false, 'the outer gate sits on the shared edge, which belongs to the Pit yard');
  const q = w.join(acct(2), 0, undefined, undefined)!;
  assert.deepEqual([q.x, q.z], [SPAWN.x, SPAWN.z], 'a second fresh join starts at the same spawn');
});

test('forged pose: a first pose far from the spawn is a teleport, not a placement', () => {
  const w = new World();
  const p = w.join(acct(1), 0)!;
  assert.equal(w.move(p, pose(15000 + 20000, 15000), 100), 'snapped');
  assert.deepEqual([p.x, p.z], [SPAWN.x, SPAWN.z], 'it is still at the spawn');
  assert.equal(p.strikes, 1, 'and the forgery counts as a strike like any jump');
});

test('reconnect: a player who walked to A and left comes back at A, and a forged first pose at B does not move it (the gate\'s test)', () => {
  const w = new World();
  const p = w.join(acct(1), 0)!;
  const t = walk(w, p, 100, 0, 30, 0);   // 30 m east of the spawn, inside the Pit yard
  const A = { x: p.x, z: p.z };
  assert.deepEqual(A, { x: SPAWN.x + 3000, z: SPAWN.z });
  w.leave(p, t);
  const back = w.join(acct(1), t + 5000)!;
  assert.deepEqual([back.x, back.z], [A.x, A.z], 'the reconnect starts where the server last saw it');
  assert.equal(w.move(back, pose(2000, 2000), t + 5200), 'snapped', 'a forged first pose at B is a jump from A');
  assert.deepEqual([back.x, back.z], [A.x, A.z], 'it is still at A: a reconnect cannot pick a new spot');
});

test('reconnect: the memory is the account\'s own, expires after ten minutes, and is bounded', () => {
  const w = new World();
  const p = w.join(acct(1), 0)!;
  const t = walk(w, p, 100, 0, 20, 0);
  const A = { x: p.x, z: p.z };
  w.leave(p, t);
  const other = w.join(acct(2), t + 1)!;
  assert.deepEqual([other.x, other.z], [SPAWN.x, SPAWN.z], 'another account never inherits a spot');
  const onTime = w.join(acct(1), t + RULES.memoryMs)!;
  assert.deepEqual([onTime.x, onTime.z], [A.x, A.z], 'exactly ten minutes later it is still remembered');
  w.leave(onTime, t + RULES.memoryMs);
  const late = w.join(acct(1), t + RULES.memoryMs + RULES.memoryMs + 1)!;
  assert.deepEqual([late.x, late.z], [SPAWN.x, SPAWN.z], 'past ten minutes after the LAST leave it is the spawn again');
  assert.equal(w.memory.has(acct(1)), false, 'and the expired entry is dropped');
  const tiny = new World({ ...RULES, memoryMax: 3 });
  for (let i = 1; i <= 5; i++) { const q = tiny.join(acct(i), i)!; walk(tiny, q, 100, 0, 1, i); tiny.leave(q, i + 1000); }
  assert.deepEqual([...tiny.memory.keys()], [acct(3), acct(4), acct(5)], 'only the newest three leavers are kept');
  assert.equal(tiny.join(acct(1), 2000)!.x, SPAWN.x, 'the oldest was dropped: back to the spawn');
});

test('reconnect: a remembered position anywhere in the Exchange rejoins on the Pit side of the gate, never in the Exchange (Strategy rule f, Expansion\'s trade-area rule)', () => {
  const w = new World();
  for (const [n, name] of [[1, 'bank'], [2, 'forge'], [3, 'contract-board'], [4, 'covenant-stone']] as const) {
    const saved = landmarkCm('exchange', name);
    assert.equal(zoneAt(saved.x, saved.z), 'exchange', `the ${name} is in the Exchange`);
    const p = w.join(acct(n), 0, undefined, saved)!;   // test fixture: an explicit start at a service landmark
    w.leave(p, 100);
    const back = w.join(acct(n), 200)!;
    assert.deepEqual([back.x, back.z], [REJOIN_EDGE.x, REJOIN_EDGE.z], `a spot at the ${name} rejoins at the edge`);
    assert.equal(zoneAt(back.x, back.z), 'pit-yard', 'in the Pit yard');
    assert.equal(inTradeArea(back.x, back.z), false, 'so inZone(where, exchange) would be false: the player has to walk in fresh');
  }
  const gate = landmarkCm('exchange', 'outer-gate');
  assert.ok(Math.hypot(REJOIN_EDGE.x - gate.x, REJOIN_EDGE.z - gate.z) <= 50, 'the rejoin point is within 50 cm of the Exchange\'s outer gate, on the Pit side');
  const justInside = { x: SPAWN.x, z: SPAWN.z - 2510 }, justOutside = { x: SPAWN.x, z: SPAWN.z - 2490 };
  assert.equal(inTradeArea(justInside.x, justInside.z), true, '10 cm past the shared edge is the Exchange');
  assert.equal(inTradeArea(justOutside.x, justOutside.z), false, 'and 10 cm before it is the Pit yard');
  assert.deepEqual(clearOfTradeAreas(justOutside.x, justOutside.z), justOutside, 'a position outside the Exchange is left alone');
  assert.deepEqual(clearOfTradeAreas(justInside.x, justInside.z), REJOIN_EDGE);
});

// The real socket path: a reconnect with a forged first pose lands at the remembered spot.
const open = (port: number, token: string): Promise<WebSocket> => new Promise((resolve, reject) => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/origins/presence`, ['frankendom.presence.v1', `token.${token}`]);
  ws.binaryType = 'arraybuffer';
  ws.onmessage = ev => { if (typeof ev.data === 'string' && JSON.parse(ev.data).t === 'hello') resolve(ws); };
  ws.onerror = () => reject(new Error('refused'));
});
test('socket: reconnect with a forged first pose lands at the remembered spot, never at the forged one', async () => {
  const p = createPresence({ verify: async t => (/^u(\d+)$/.test(t) ? acct(Number(t.slice(1))) : null), log: () => {} });
  await new Promise<void>(r => p.server.listen(0, '127.0.0.1', r));
  const where = () => p.world.byAccount.get(acct(1));
  try {
    const first = await open(p.port(), 'u1');
    assert.deepEqual([where()!.x, where()!.z], [SPAWN.x, SPAWN.z], 'a fresh socket join is at the spawn before any pose');
    first.send(encodeUp(pose(SPAWN.x + 80, SPAWN.z)));
    await new Promise(r => setTimeout(r, 300));
    const A = { x: where()!.x, z: where()!.z };
    assert.equal(A.x, SPAWN.x + 80, 'its first pose, inside the clamp, moved it');
    first.close();
    await new Promise(r => setTimeout(r, 200));
    assert.equal(where(), undefined, 'it has left');
    const second = await open(p.port(), 'u1');
    assert.deepEqual([where()!.x, where()!.z], [A.x, A.z], 'the reconnect starts where the server last saw it, before any pose');
    second.send(encodeUp(pose(1000, 1000)));   // forged: the far corner of the town square
    await new Promise(r => setTimeout(r, 300));
    assert.deepEqual([where()!.x, where()!.z], [A.x, A.z], 'the forged pose did not move it');
    second.close();
  } finally { await p.close(); }
});
