import test from 'node:test';
import assert from 'node:assert/strict';
import { automated, beaconPayload, screenOf, sendPerfBeacon, type PerfFigures } from '../src/perf-beacon.ts';

// The anonymous per-fight perf beacon (Strategy via Lead 2026-09-28): exactly these columns (Backend's public.perf_beacons), nothing that
// identifies a player, a small body, and a send that never throws.
const figures = (over: Partial<PerfFigures> = {}): PerfFigures => ({
  fightFrames: [...Array(90).fill(16), ...Array(10).fill(50)], firstFightAt: 12_345, renderRatio: 1, loweredFrom: 1.25, dprOverride: undefined,
  tris: 412_000, draws: 188, phone: true, lookOn: true, revision: '026d07e40061b07a698ee16bc7b8f275ef086466',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', screen: '393x852@3', cores: 6, memoryGb: undefined, ...over,
});

test('perf beacon: the payload is exactly the agreed columns, the fight figures computed as ?perf=1 does', () => {
  const body = beaconPayload(figures())!;
  assert.deepEqual(Object.keys(body).sort(), ['cores', 'dpr_override', 'draws', 'dropped', 'fight_s', 'first_fight_s', 'fps_p5', 'fps_p50', 'frames',
    'gfx_tier', 'look_due', 'look_on', 'look_swap_s', 'lowered_from', 'memory_gb', 'raf_capped', 'raf_ms', 'render_ratio', 'revision', 'screen', 'swapped_before_first_exchange', 'tris', 'ua'], 'no user id, name, profile or record');
  assert.deepEqual(body, {
    revision: '026d07e40061b07a698ee16bc7b8f275ef086466', fps_p50: 63, fps_p5: 20, frames: 100, fight_s: 1.9, dropped: 10, first_fight_s: 12.3,
    raf_ms: 16, raf_capped: false,
    render_ratio: 1, lowered_from: 1.25, dpr_override: null, tris: 412_000, draws: 188, gfx_tier: 'phone', look_on: true,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', screen: '393x852@3', cores: 6, memory_gb: null,
    look_swap_s: null, swapped_before_first_exchange: null, look_due: false,
  });
  assert.equal(beaconPayload(figures({ firstFightAt: NaN }))!.first_fight_s, null, 'no playable frame yet: null, never a made-up stamp');
  assert.equal(beaconPayload(figures({ phone: false }))!.gfx_tier, 'full');
  const long = beaconPayload(figures({ userAgent: 'x'.repeat(5000) }))!;
  assert.equal(long.ua.length, 300);
  assert.ok(JSON.stringify(long).length < 1024, 'the body stays small (keepalive allows 64 KB)');
});

// Backend's checks (migration 202609280001): the server refuses the WHOLE row on any failed check, so the client makes every value fit.
test('perf beacon: every value fits Backend\'s checks, or is null, or the row is not sent', () => {
  assert.equal(beaconPayload(figures({ fightFrames: [] })), null, 'frames 1..1e6: no playable frame, no row');
  assert.equal(beaconPayload(figures({ renderRatio: NaN })), null, 'render_ratio 0.1..8 and finite, or no row');
  assert.equal(beaconPayload(figures({ renderRatio: 12 })), null);
  const b = (over: Partial<PerfFigures>) => beaconPayload(figures(over))!;
  assert.equal(b({ revision: 'dev' }).revision, null, 'revision ^[0-9a-f]{7,40}$ or null');
  assert.equal(b({ revision: 'ABCDEF12' }).revision, null);
  assert.equal(b({ revision: '026d07e4' }).revision, '026d07e4');
  const odd = b({ fightFrames: [5, 5, 5, 400] });   // p50 5 ms clamps to 200 fps; p95 400 ms is 3 fps
  assert.ok(odd.fps_p50 <= 240 && odd.fps_p5 <= odd.fps_p50, 'fps 0..240, p5 <= p50');
  assert.equal(b({ fightFrames: [NaN, -1, Infinity, 16] }).frames, 1, 'non-finite or negative frame times are dropped');
  assert.equal(b({ fightFrames: Array(10).fill(1_000_000) }).fight_s, 3600, 'fight_s 0..3600');
  assert.equal(b({ firstFightAt: 700_000 }).first_fight_s, null, 'first_fight_s 0..600, else null');
  assert.equal(b({ loweredFrom: 1 }).lowered_from, null, 'lowered_from only when above render_ratio');
  assert.equal(b({ loweredFrom: 1.25 }).lowered_from, 1.25);
  assert.equal(b({ dprOverride: 20 }).dpr_override, null, 'dpr_override 0.1..8');
  assert.equal(b({ tris: 9e9, draws: -3 }).tris, 20_000_000); assert.equal(b({ draws: 9e9 }).draws, 100_000); assert.equal(b({ draws: -3 }).draws, 0);
  assert.equal(b({ userAgent: 'Mozilla\u0000/5.0\n' }).ua, 'Mozilla/5.0', 'no control characters');
  assert.equal(b({ userAgent: '' }).ua, 'unknown', 'ua 1..300 chars');
  assert.equal(b({ screen: 'garbage' }).screen, '0x0@1', 'screen matches the check or is the neutral 0x0@1');
  assert.equal(b({ cores: 0, memoryGb: 0 }).cores, null, 'cores 1..1024, else null'); assert.equal(b({ memoryGb: 0 }).memory_gb, null, 'memory_gb 0.1..1024');
  assert.equal(b({ cores: 6.4 }).cores, 6, 'smallint: an integer');
  const lowPower = b({ fightFrames: Array(120).fill(33.4) });
  assert.equal(lowPower.raf_ms, 33.4); assert.equal(lowPower.raf_capped, true, 'a Low Power Mode fight is marked');
  assert.equal(b({ fightFrames: [1, 2, 3] }).raf_ms, null, 'raf_ms 5..1000, else null');
});

test('perf beacon: the screen string is <w>x<h>@<ratio>, the ratio rounded to 3 decimals', () => {
  assert.equal(screenOf(393, 852, 3), '393x852@3');
  assert.equal(screenOf(412, 915, 2.625), '412x915@2.625');
  assert.equal(screenOf(360, 780, 2.6666667), '360x780@2.667');
  assert.equal(screenOf(-1, 852, 3), null); assert.equal(screenOf(393.5, 852, 3), null); assert.equal(screenOf(393, 852, NaN), null);
  assert.match(screenOf(1920, 1080, 1.25)!, /^\d{1,5}x\d{1,5}@\d{1,2}(\.\d{1,3})?$/);
});

test('perf beacon: one keepalive POST to perf_beacons with the publishable key; nothing without a service or frames; a failed send is silent', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const ok = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return { ok: true } as Response; }) as unknown as typeof fetch;
  const api = { url: 'https://x.supabase.co', key: 'pk' }, body = beaconPayload(figures())!;
  assert.equal(await sendPerfBeacon(api, body, ok), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, 'https://x.supabase.co/rest/v1/perf_beacons');
  assert.equal(calls[0]!.init.method, 'POST'); assert.equal(calls[0]!.init.keepalive, true);
  assert.deepEqual(calls[0]!.init.headers, { apikey: 'pk', Authorization: 'Bearer pk', 'Content-Type': 'application/json', Prefer: 'return=minimal' });
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), body);
  assert.equal(await sendPerfBeacon(null, body, ok), false, 'a build without the service sends nothing'); assert.equal(calls.length, 1);
  assert.equal(await sendPerfBeacon(api, beaconPayload(figures({ fightFrames: [] })), ok), false, 'no valid row (no playable frame): nothing to report'); assert.equal(calls.length, 1);
  const rejects = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
  assert.equal(await sendPerfBeacon(api, body, rejects), false, 'a network failure resolves false, never throws');
  const refused = (async () => ({ ok: false, status: 401 }) as Response) as unknown as typeof fetch;
  assert.equal(await sendPerfBeacon(api, body, refused), false, 'a refused insert (RLS, missing table) is false too');
});

// Strategy's beta bar (via Lead 2026-09-29): the rank look swaps in before the first exchange, never mid-swing. look_swap_s is seconds
// from this fight's first playable frame to the swap; null when the look did not swap in this fight (none, still loading, or swapped
// in an earlier fight on the page).
test('perf beacon: look_swap_s and swapped_before_first_exchange measure the rank look against the first exchange', () => {
  const at = (over: Partial<PerfFigures>) => { const b = beaconPayload(figures(over))!; return [b.look_swap_s, b.swapped_before_first_exchange]; };
  const due = (over: Partial<PerfFigures>) => beaconPayload(figures(over))!.look_due;
  assert.deepEqual(at({ fightStartAt: 10_000, lookOnAt: 11_240, firstExchangeAt: 13_000 }), [1.2, true], 'swapped 1.2 s in, before the first swing');
  assert.deepEqual(at({ fightStartAt: 10_000, lookOnAt: 15_000, firstExchangeAt: 13_000 }), [5, false], 'swapped after the first exchange began');
  assert.deepEqual(at({ fightStartAt: 10_000, lookOnAt: 12_000, firstExchangeAt: NaN }), [2, true], 'no exchange yet at the swap');
  assert.deepEqual(at({ fightStartAt: 10_000, lookOnAt: NaN, firstExchangeAt: 13_000 }), [null, null], 'never swapped this fight');
  assert.deepEqual(at({ fightStartAt: 10_000, lookOnAt: 4_000, firstExchangeAt: 13_000 }), [null, null], 'swapped in an earlier fight on this page');
  assert.deepEqual(at({ fightStartAt: NaN, lookOnAt: 12_000 }), [null, null], 'no playable frame: no made-up start');
  // look_due (Lead): the stranger-facing miss is a look this fight asked for that never landed; null alone cannot tell it from 'no look'.
  assert.equal(due({ fightStartAt: 10_000, lookOnAt: 11_240, lookState: 'on' }), true, 'swapped this fight: due');
  const streaming = beaconPayload(figures({ fightStartAt: 10_000, lookOnAt: NaN, firstExchangeAt: 13_000, lookState: 'loading' }))!;
  assert.deepEqual([streaming.look_due, streaming.look_swap_s, streaming.swapped_before_first_exchange], [true, null, null], 'still streaming at the fight end: due, never landed');
  assert.equal(due({ fightStartAt: 10_000, lookOnAt: NaN, lookState: 'ready' }), true, 'landed but no idle beat before the end: never on');
  assert.equal(due({ fightStartAt: 10_000, lookOnAt: NaN, lookState: 'failed' }), true, 'failed to load: due, never landed');
  assert.equal(due({ fightStartAt: 10_000, lookOnAt: NaN, lookState: 'none' }), false, 'no look at this rung');
  assert.equal(due({ fightStartAt: 10_000, lookOnAt: 4_000, lookState: 'on' }), false, 'on since an earlier fight on the page');
  assert.equal(due({}), false, 'no stream at all');
});

// Lead 2026-09-29: 257 of ~300 beacon rows were our own release checks. Automation sends nothing.
test('perf beacon: WebDriver, headless Chrome and dev/test parameters are automation; a phone is not', () => {
  const phone = { webdriver: false, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' };
  assert.equal(automated(phone, ''), false);
  assert.equal(automated(phone, '?perf=1'), false, "the ?perf=1 readout is a real player's own device");
  assert.equal(automated(null, ''), false, 'no navigator: not provably automation');
  assert.equal(automated({ ...phone, webdriver: true }, ''), true);
  assert.equal(automated({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0 Safari/537.36' }, ''), true);
  for (const q of ['?debug', '?debug=1', '?opponent=veteran&debug', '?botSeed=4', '?tier=L3', '?lookbake=off']) assert.equal(automated(phone, q), true, q);
});
