// Frontier-zone presence, step 1 (docs/specs/origins/frontier-presence.md): the zone table as rows, the whole-world frame, the walkable clamp, the Pit's quiet, the v1 shim and the v2 hello.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RULES, World } from '../origins/presence/interest.ts';
import { createPresence, PROTOCOL, PROTOCOL_V2 } from '../origins/presence/server.ts';
import { CENTRE_CM, FRAME_CM, LEGACY_SHIFT_CM, PORTALS, SPAWN, ZONE_ROWS, fromLegacy, toLegacy, walkable, worldMetres, zoneAt } from '../origins/presence/zones.ts';
import { zoneIds } from '../origins/zones/loader.ts';
import { CONCORD_REGION } from '../origins/world/concord.ts';
import { frontierPlan } from '../origins/preview/frontier-plan.ts';

const acct = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const pose = (x: number, z: number) => ({ x, z, heading: 0, anim: 0, flags: 0 });
const cm = (wx: number, wz: number): [number, number] => [Math.round(CENTRE_CM + wx * 100), Math.round(CENTRE_CM + wz * 100)];
const centreOf = (id: string): [number, number] => { const r = ZONE_ROWS.find(z => z.id === id)!; const n = r.corners.length; return cm(r.corners.reduce((s, c) => s + c.x, 0) / n, r.corners.reduce((s, c) => s + c.z, 0) / n); };   // corners are world metres

test('frame: the u16 frame holds the whole world, the town square sits inside it, and the old frame is the same square shifted', () => {
  assert.ok(FRAME_CM <= 65535 && CENTRE_CM * 2 <= FRAME_CM + 1 + CENTRE_CM, 'the centre is inside a u16 frame');
  assert.deepEqual(worldMetres(CENTRE_CM, CENTRE_CM), { x: 0, z: 0 });
  assert.equal(LEGACY_SHIFT_CM, 25000);
  assert.deepEqual(toLegacy(SPAWN), { x: 15000, z: 15000 }, 'the spawn is the old frame\'s centre');
  assert.deepEqual(fromLegacy({ x: 15000, z: 15000 }), SPAWN);
  assert.equal(toLegacy({ x: 100, z: 100 }), null, 'a Frontier position has no old-frame form');
  for (const row of ZONE_ROWS) for (const c of row.corners) assert.ok(cm(c.x, c.z).every(v => v >= 0 && v <= 65535), `${row.id}: every corner fits the u16 frame`);
});

test('rows: every Frontier zone is a row named by the plan, its centre and spawn homes resolve to it, and speed and quiet are row fields (1.0x everywhere, the Pit alone quiet)', () => {
  const ids = new Set(zoneIds().flatMap(zid => frontierPlan(true, zid).zones.filter(q => q.region !== CONCORD_REGION).map(q => q.zone)));
  assert.ok(ids.size >= 9, 'the plan names the nine Frontier zones');
  for (const id of ids) {
    const row = ZONE_ROWS.find(z => z.id === id);
    assert.ok(row, `${id} is a row`);
    assert.equal(row.speed, 1, `${id}: 1.0x at launch`);
    assert.equal(row.quiet, false, `${id}: not quiet`);
    assert.ok(walkable(...centreOf(id)), `${id}: its middle is walkable`);
  }
  assert.deepEqual(ZONE_ROWS.filter(z => z.quiet).map(z => z.id), ['pit-yard'], 'quiet = the Pit only');
  assert.ok(PORTALS.length >= 2 && PORTALS.every(p => ZONE_ROWS.some(z => z.id === p.zone) && ZONE_ROWS.some(z => z.id === p.to)), 'portal rows name real zones');
  for (const id of ['cinder-fields', 'black-mere', 'blood-ruin', 'ferry-landing', 'east-road']) { const [x, z] = centreOf(id); assert.equal(zoneAt(x, z) ?? id, id, `${id}: its middle is in it`); }
});

test('zoneAt: the road and the open ground belong to no zone; the open ground of the town square and the road are walkable, the wilderness is not', () => {
  for (const [x, z] of [[100, 0], [0, 100], [0, -100]] as const) { const p = cm(x, z); assert.equal(zoneAt(...p), null, `(${x}, ${z}) is open ground`); assert.ok(walkable(...p), 'and walkable'); }
  assert.equal(zoneAt(...cm(-100, 0)), 'cinder-fields');
  assert.equal(walkable(...cm(0, 600)), false, 'far outside every zone: not walkable');
  assert.equal(walkable(0, 0), false, 'the frame\'s corner: not walkable');
});

test('clamp: a v2 pose onto walkable ground moves; one off it, or too fast, is snapped to the old pose; a legacy client is clamped to the town square instead', () => {
  const w = new World(RULES, 1);
  const open = w.join(acct(1), 0, undefined, { x: CENTRE_CM + 8000, z: CENTRE_CM })!;
  assert.equal(w.move(open, pose(open.x + 90, open.z), 100), 'ok');
  const kept = { x: open.x, z: open.z };
  assert.equal(w.move(open, pose(open.x + 5000, open.z), 200), 'snapped', 'a teleport on walkable ground');
  assert.deepEqual([open.x, open.z], [kept.x, kept.z]);
  const edge = w.join(acct(2), 0, undefined, { x: CENTRE_CM + 15000 - 50, z: CENTRE_CM + 8000 })!;
  assert.equal(w.move(edge, pose(edge.x + 30, edge.z), 100), 'ok', 'up to the east edge of the square is walkable');
  assert.equal(w.move(edge, pose(edge.x + 80, edge.z), 200), 'snapped', 'a v2 pose past it is off the ground: struck and kept');
  const old = w.join(acct(3), 0, undefined, { x: CENTRE_CM + 15000 - 50, z: CENTRE_CM + 9000 }, true)!;
  assert.equal(w.move(old, pose(old.x + 80, old.z), 100), 'ok', 'a legacy pose past the edge is clamped to it, not struck');
  assert.equal(old.x, CENTRE_CM + 15000, 'at the square\'s edge');
});

test('speed: the cap is multiplied by the speed of the zone being left, so a 1.2x zone is a row edit', () => {
  const row = ZONE_ROWS.find(z => z.id === 'cinder-fields')!;
  const [cx, cz] = centreOf('cinder-fields');
  const step = Math.round(RULES.maxSpeedCmS * RULES.speedSlack * 0.1 * 1.1);   // 10% over the 1.0x reach for a 100 ms step
  const run = (): string => { const w = new World(RULES, 1); const p = w.join(acct(1), 0, undefined, { x: cx, z: cz })!; return w.move(p, pose(cx + step, cz), 100); };
  const was = row.speed;
  try {
    assert.equal(run(), 'snapped', '1.0x: over the reach');
    row.speed = 1.2;
    assert.equal(run(), 'ok', '1.2x: inside the reach, with no code change');
  } finally { row.speed = was; }
});

test('quiet: the Pit\'s members see and are seen by only each other', () => {
  const w = new World(RULES, 1);
  const inPit = w.join(acct(1), 0)!, inPit2 = w.join(acct(2), 0)!;
  const outside = w.join(acct(3), 0, undefined, { x: CENTRE_CM + 3000, z: CENTRE_CM })!;
  assert.equal(inPit.zone?.id, 'pit-yard');
  const ids = (p: typeof inPit): number[] => [...new Set([...Array(10).keys()].flatMap(t => w.seenBy(p, t).map(e => e.id)))];
  assert.deepEqual(ids(inPit), [inPit2.id], 'the Pit sees its own');
  assert.deepEqual(ids(outside), [], 'a player outside sees nobody in the Pit');
});

const open = (port: number, token: string, proto: string): Promise<{ ws: WebSocket; hello: Record<string, unknown> }> => new Promise((resolve, reject) => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/origins/presence`, [proto, `token.${token}`]);
  ws.binaryType = 'arraybuffer';
  ws.onmessage = ev => { if (typeof ev.data === 'string') { const m = JSON.parse(ev.data); if (m.t === 'hello') resolve({ ws, hello: m }); } };
  ws.onerror = () => reject(new Error('refused'));
});

test('hello and route: v1 is told the old frame, v2 the whole-world frame and the zone-table hash, and GET /origins/presence/zones serves the table', async () => {
  const p = createPresence({ verify: async t => (/^u(\d+)$/.test(t) ? acct(Number(t.slice(1))) : null), log: () => {} });
  await new Promise<void>(r => p.server.listen(0, '127.0.0.1', r));
  try {
    const a = await open(p.port(), 'u1', PROTOCOL), b = await open(p.port(), 'u2', PROTOCOL_V2);
    assert.deepEqual([a.hello.x, a.hello.z], [15000, 15000], 'v1: the old centre');
    assert.equal(a.hello.frame, undefined);
    assert.deepEqual([b.hello.x, b.hello.z], [CENTRE_CM, CENTRE_CM], 'v2: the new centre');
    assert.deepEqual(b.hello.frame, { centreCm: CENTRE_CM, sizeCm: FRAME_CM });
    const res = await fetch(`http://127.0.0.1:${p.port()}/origins/presence/zones`);
    assert.equal(res.status, 200);
    const table = await res.json() as { frame: unknown; zones: { id: string; speed: number; quiet: boolean }[]; portals: unknown[] };
    assert.deepEqual(table.zones.map(z => z.id), ZONE_ROWS.map(z => z.id));
    assert.equal(table.portals.length, PORTALS.length);
    assert.match(String(b.hello.zones), /^[0-9a-f]{8}$/);
    a.ws.close(); b.ws.close();
  } finally { await p.close(); }
});
