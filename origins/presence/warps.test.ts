// Server-owned warps: the landmark table is data that must agree with the page's own teleports (so a data move or a zone edit that shifts a start fails here, not in a player's session), and the
// server moves a player only to a table landmark: a forged id closes the socket, a plain far pose is still a teleport, the rate is a row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { frontierBuild, frontierPlan } from '../preview/frontier-plan.ts';
import { mobSpecs, previewRows, spawnAmong } from '../preview/mobs.ts';
import DEFS from './warp-landmarks.json' with { type: 'json' };
import { createPresence } from './server.ts';
import { presenceRule } from './presence-rules.ts';
import { loadWarps, warpIds, warpPlace } from './warps.ts';
import { CENTRE_CM, clearOfTradeAreas, zoneAt } from './zones.ts';
import { joinBot } from './test-client.ts';

const m = (id: string): { x: number; z: number } => { const p = warpPlace(id)!; return { x: (p.x - CENTRE_CM) / 100, z: (p.z - CENTRE_CM) / 100 }; };
const near = (a: number, b: number, tol = 0.01): void => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const until = async (ok: () => boolean, ms = 3000): Promise<void> => { for (let t = 0; t < ms && !ok(); t += 25) await wait(25); };

test('the table: every landmark stands in a zone row and clear of the trade areas; a bad row refuses to load', () => {
  assert.deepEqual(warpIds().sort(), ['town-respawn', 'zone1-cave-mouth', 'zone1-road-end', 'zone1-start', 'zone5-gate']);
  for (const id of warpIds()) assert.ok(zoneAt(warpPlace(id)!.x, warpPlace(id)!.z), `${id} is in a zone`);
  const rows = DEFS.landmarks;
  assert.throws(() => loadWarps({ landmarks: [{ ...rows[0]!, unit: 'cm' }] }), /unit is m/);
  assert.throws(() => loadWarps({ landmarks: [{ id: 'nowhere', x: 5000, z: 5000, unit: 'm' }] }), /not inside any zone row/);
  assert.throws(() => loadWarps({ landmarks: [...rows, rows[0]!] }), /duplicate|twice|unique/i);
});

test('the rows equal the places the page teleports to (a zone or mob edit that moves one fails here)', () => {
  const F = frontierPlan(false), B = frontierBuild(F);
  for (const signedIn of [true, false]) {
    const start = spawnAmong(F, B, mobSpecs(F, B, previewRows('', signedIn)))!;
    near(m('zone1-start').x, start.x, 0.006); near(m('zone1-start').z, start.z, 0.006);   // signed in or a guest: the same start (a row is centimetres)
  }
  const r = F.road, back = { x: r.from.x + Math.sin(r.inward) * 2, z: r.from.z + Math.cos(r.inward) * 2 };   // main.ts goBack
  // The page's goBack stands at the Exchange's west gate, which is inside a trade area: a warp may not land there (Lead's rule), so the row is where presence clears it to, the Pit yard's edge.
  const cleared = clearOfTradeAreas(Math.round(CENTRE_CM + back.x * 100), Math.round(CENTRE_CM + back.z * 100));
  near(m('zone1-road-end').x, (cleared.x - CENTRE_CM) / 100, 0.006); near(m('zone1-road-end').z, (cleared.z - CENTRE_CM) / 100, 0.006);
  assert.match(readFileSync(new URL('../preview/main.ts', import.meta.url), 'utf8'), /TOWN_RESPAWN = \{ x: 0, z: 3 \}/, 'the page\'s town respawn is the town-respawn row');
  near(m('town-respawn').x, 0, 1e-9); near(m('town-respawn').z, 3, 1e-9);
});

test('the server: a warp moves the player to the landmark; a forged id, a plain far pose and a v1 client are all refused; the rate is a row', async () => {
  const p = createPresence({ verify: async (t) => ({ a: '00000000-0000-4000-8000-0000000000a1', b: '00000000-0000-4000-8000-0000000000b2', c: '00000000-0000-4000-8000-0000000000c3', d: '00000000-0000-4000-8000-0000000000d4' } as Record<string, string>)[t] ?? null, log: () => {} });
  await new Promise<void>((r) => p.server.listen(0, '127.0.0.1', r));
  try {
    const a = await joinBot(p.port(), 'a');
    near(a.at().x, 0, 30); assert.equal(a.hellos(), 1);   // a fresh join starts at the Pit spawn, never where it claims
    a.pose(m('zone1-start').x, m('zone1-start').z); await wait(250);
    const held = p.world.byAccount.get('00000000-0000-4000-8000-0000000000a1')!;
    assert.equal(zoneAt(held.x, held.z), 'pit-yard', 'a far pose is still a teleport: snapped, the player stays in the Pit');
    a.warp('zone1-start'); await until(() => a.hellos() === 2);
    near(a.at().x, m('zone1-start').x); near(a.at().z, m('zone1-start').z);
    const aId = p.world.byAccount.get('00000000-0000-4000-8000-0000000000a1')!;
    assert.equal(zoneAt(aId.x, aId.z), 'cinder-fields', 'the server holds it in the start zone');
    assert.equal(aId.strikes, 0);
    await wait(350);   // the clamp allows ~10 m/s x elapsed time: 2 m after 350 ms is ordinary walking
    a.pose(m('zone1-start').x + 2, m('zone1-start').z); await wait(250);
    near((aId.x - CENTRE_CM) / 100, m('zone1-start').x + 2);   // the speed clamp restarted at the landmark: ordinary movement from there is accepted
    // the rate: warpPerMin warps are honoured, the rest ignored (socket stays open)
    const limit = presenceRule('warpPerMin');
    for (let i = 0; i < limit + 3; i++) a.warp(i % 2 ? 'zone1-start' : 'town-respawn');
    await wait(400);
    assert.ok(a.hellos() <= 2 + limit, `no more than ${limit} warps in a minute are honoured (${a.hellos() - 2} were)`); assert.equal(a.closeCode(), null);
    // a forged id closes the socket; coordinates in the message do not exist as a field
    const bad = await joinBot(p.port(), 'c'); bad.warp('../../etc'); await until(() => bad.closeCode() !== null); assert.equal(bad.closeCode(), 1003);
    const coords = await joinBot(p.port(), 'd'); coords.raw(JSON.stringify({ t: 'warp', x: 0, z: 0 })); await until(() => coords.closeCode() !== null); assert.equal(coords.closeCode(), 1003);
  } finally { await p.close(); }
});
