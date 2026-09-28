import test from 'node:test';
import assert from 'node:assert/strict';
import { beaconPayload, sendPerfBeacon, type PerfFigures } from '../src/perf-beacon.ts';

// The anonymous per-fight perf beacon (Strategy via Lead 2026-09-28): exactly these columns (Backend's public.perf_beacons), nothing that
// identifies a player, a small body, and a send that never throws.
const figures = (over: Partial<PerfFigures> = {}): PerfFigures => ({
  fightFrames: [...Array(90).fill(16), ...Array(10).fill(50)], firstFightAt: 12_345, renderRatio: 1, loweredFrom: 1.25, dprOverride: undefined,
  tris: 412_000, draws: 188, phone: true, lookOn: true, revision: '026d07e40061b07a698ee16bc7b8f275ef086466',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', screen: '393x852@3', cores: 6, memoryGb: undefined, ...over,
});

test('perf beacon: the payload is exactly the agreed columns, the fight figures computed as ?perf=1 does', () => {
  const body = beaconPayload(figures());
  assert.deepEqual(Object.keys(body).sort(), ['cores', 'draws', 'dpr_override', 'dropped', 'first_fight_s', 'fight_s', 'fps_p5', 'fps_p50', 'frames',
    'gfx_tier', 'look_on', 'lowered_from', 'memory_gb', 'render_ratio', 'revision', 'screen', 'tris', 'ua'], 'no user id, name, profile or record');
  assert.deepEqual(body, {
    revision: '026d07e40061b07a698ee16bc7b8f275ef086466', fps_p50: 63, fps_p5: 20, frames: 100, fight_s: 1.9, dropped: 10, first_fight_s: 12.3,
    render_ratio: 1, lowered_from: 1.25, dpr_override: null, tris: 412_000, draws: 188, gfx_tier: 'phone', look_on: true,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', screen: '393x852@3', cores: 6, memory_gb: null,
  });
  assert.equal(beaconPayload(figures({ firstFightAt: NaN })).first_fight_s, null, 'no playable frame yet: null, never a made-up stamp');
  assert.equal(beaconPayload(figures({ phone: false })).gfx_tier, 'full');
  const long = beaconPayload(figures({ userAgent: 'x'.repeat(5000), screen: 'y'.repeat(500), revision: 'z'.repeat(500) }));
  assert.equal(long.ua.length, 300); assert.equal(long.screen.length, 40); assert.equal(long.revision!.length, 40);
  assert.ok(JSON.stringify(long).length < 1024, 'the body stays small (keepalive allows 64 KB)');
});

test('perf beacon: one keepalive POST to perf_beacons with the publishable key; nothing without a service or frames; a failed send is silent', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const ok = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return { ok: true } as Response; }) as unknown as typeof fetch;
  const api = { url: 'https://x.supabase.co', key: 'pk' }, body = beaconPayload(figures());
  assert.equal(await sendPerfBeacon(api, body, ok), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, 'https://x.supabase.co/rest/v1/perf_beacons');
  assert.equal(calls[0]!.init.method, 'POST'); assert.equal(calls[0]!.init.keepalive, true);
  assert.deepEqual(calls[0]!.init.headers, { apikey: 'pk', Authorization: 'Bearer pk', 'Content-Type': 'application/json', Prefer: 'return=minimal' });
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), body);
  assert.equal(await sendPerfBeacon(null, body, ok), false, 'a build without the service sends nothing'); assert.equal(calls.length, 1);
  assert.equal(await sendPerfBeacon(api, beaconPayload(figures({ fightFrames: [] })), ok), false, 'no playable frame: nothing to report'); assert.equal(calls.length, 1);
  const rejects = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
  assert.equal(await sendPerfBeacon(api, body, rejects), false, 'a network failure resolves false, never throws');
  const refused = (async () => ({ ok: false, status: 401 }) as Response) as unknown as typeof fetch;
  assert.equal(await sendPerfBeacon(api, body, refused), false, 'a refused insert (RLS, missing table) is false too');
});
