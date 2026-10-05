// The anonymous per-fight perf beacon (Strategy via Lead, 2026-09-28; Backend owns public.perf_beacons and its insert-only RLS): once per
// fight end, or on pagehide mid-fight, the ?perf=1 fight figures and the device's own description go to Supabase. No user id, no name,
// no profile, no record: nothing that identifies a player. 100 % sampled in beta. A failed send is silent: it never retries, never
// throws, never shows. Transport: fetch with keepalive (it survives pagehide like navigator.sendBeacon, which cannot send the
// publishable key's apikey header that the REST endpoint needs).

import { rafCadence } from './quality.ts';

export type PerfFigures = {
  fightFrames: readonly number[];      // this fight's playable frame times, ms
  firstFightAt: number;                // ms from navigation to the page's first playable frame; NaN when none yet
  renderRatio: number; renderScale?: number | null; loweredFrom?: number; dprOverride?: number;
  tris: number; draws: number;
  phone: boolean; lookOn: boolean;
  revision: string | null;
  userAgent: string; screen: string; cores?: number; memoryGb?: number;
  // performance.now()-scale stamps, NaN or undefined until they happen: this fight's first playable frame, the rank look's swap
  // (rank-look.ts stamps().on; the look streams once per page, so a swap before this fight began is not this fight's) and the first
  // playable frame that was not an idle beat (rank-look.ts idleBeat): Strategy's beta bar, the look on before the first exchange.
  fightStartAt?: number; lookOnAt?: number; firstExchangeAt?: number;
  lookState?: string;   // rank-look.ts RankLookState at send time: 'loading'/'ready' = requested, not landed; 'failed' = requested, failed
};

// The row, in Backend's column names (public.perf_beacons, migration 202609280001). The server refuses the WHOLE row if any check
// fails, so every value is clamped, rounded or nulled here to its check; a row that still cannot be valid (no playable frame, no
// finite render ratio) is null: no beacon. Every field is a number, a boolean, null or a short string, so the body stays under ~1 KB
// (keepalive's limit is 64 KB).
const SCREEN = /^\d{1,5}x\d{1,5}@\d{1,2}(\.\d{1,3})?$/;   // Backend's screen check
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const inRange = (n: number | undefined, lo: number, hi: number) => (n !== undefined && Number.isFinite(n) && n >= lo && n <= hi ? n : null);
export function beaconPayload(f: PerfFigures) {
  const sorted = f.fightFrames.filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b), at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
  const ratio = inRange(f.renderRatio, 0.1, 8);
  if (!sorted.length || ratio === null) return null;
  const fps = (ms: number) => (ms > 0 ? clamp(Math.round(1000 / ms), 0, 240) : 0), p50 = fps(at(0.5));
  const lowered = inRange(f.loweredFrom, 0.1, 8), screen = SCREEN.test(f.screen) ? f.screen : '0x0@1';   // the check refuses anything else
  const firstFight = Number.isNaN(f.firstFightAt) ? null : inRange(Math.round(f.firstFightAt / 100) / 10, 0, 600);
  const cores = inRange(f.cores, 1, 1024), memory = inRange(f.memoryGb, 0.1, 1024), cadence = rafCadence(sorted);
  const swapped = Number.isFinite(f.lookOnAt) && Number.isFinite(f.fightStartAt) && f.lookOnAt! >= f.fightStartAt!;
  const lookSwap = swapped ? inRange(Math.round((f.lookOnAt! - f.fightStartAt!) / 100) / 10, 0, 3600) : null;
  return {
    revision: f.revision && /^[0-9a-f]{7,40}$/.test(f.revision) ? f.revision : null,
    fps_p50: p50, fps_p5: Math.min(p50, fps(at(0.95))), frames: Math.min(sorted.length, 1_000_000),
    fight_s: clamp(Math.round(sorted.reduce((sum, v) => sum + v, 0) / 100) / 10, 0, 3600),
    dropped: Math.min(sorted.filter((v) => v > 16.7).length, sorted.length, 1_000_000),
    first_fight_s: firstFight,
    raf_ms: inRange(cadence.medianMs ?? undefined, 5, 1000), raf_capped: cadence.capped30,   // Low Power Mode caps rAF at 30 Hz (quality.ts rafCadence)
    render_ratio: ratio, lowered_from: lowered !== null && lowered > ratio ? lowered : null, dpr_override: inRange(f.dprOverride, 0.1, 8),
    tris: clamp(Math.round(f.tris) || 0, 0, 20_000_000), draws: clamp(Math.round(f.draws) || 0, 0, 100_000),
    gfx_tier: f.phone ? 'phone' : 'full', look_on: f.lookOn,
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point: Backend's ua check refuses them
    ua: f.userAgent.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 300) || 'unknown', screen,
    cores: cores === null ? null : Math.round(cores), memory_gb: memory,
    // null when the look did not swap in this fight; before the first exchange = no exchange yet at the swap (NaN compares false)
    look_swap_s: lookSwap, swapped_before_first_exchange: lookSwap === null ? null : !(f.firstExchangeAt! <= f.lookOnAt!),
    // Lead 2026-09-29: a look this fight asked for. look_due with no look_swap_s = it never landed in the fight (the stranger-facing miss);
    // false = no look at this rung, or already on from an earlier fight on the page.
    look_due: swapped || ['loading', 'ready', 'failed'].includes(f.lookState ?? ''),
  };
}
// '<width>x<height>@<dpr>' in Backend's shape (^\d{1,5}x\d{1,5}@\d{1,2}(\.\d{1,3})?$), the ratio rounded to 3 decimals; null when the
// device's figures cannot make one (beaconPayload then sends '0x0@1', which the check accepts).
export function screenOf(width: number, height: number, ratio: number): string | null {
  const r = Math.round(ratio * 1000) / 1000;
  if (![width, height].every((n) => Number.isInteger(n) && n >= 0 && n <= 99_999) || !(r > 0 && r < 100)) return null;
  return `${width}x${height}@${r}`;
}

// Our own automation sends nothing (Lead 2026-09-29: 257 of ~300 rows were the release checks): a WebDriver-driven browser, headless
// Chrome, or a page opened with a dev/test parameter.
export const automated = (nav: { webdriver?: boolean; userAgent?: string } | null, search: string): boolean =>
  nav?.webdriver === true || /HeadlessChrome/.test(nav?.userAgent ?? '') || /[?&](debug|botSeed|tier|lookbake)\b/.test(search);

// One POST; resolves true when the server took it, false on anything else. Never rejects.
export async function sendPerfBeacon(api: { url: string; key: string } | null, body: ReturnType<typeof beaconPayload>, fetchFn: typeof fetch): Promise<boolean> {
  if (!api || !body) return false;   // no service in this build, or no valid row (no playable frame) to report
  try {
    const response = await fetchFn(`${api.url}/rest/v1/perf_beacons`, {
      method: 'POST', keepalive: true,
      headers: { apikey: api.key, Authorization: `Bearer ${api.key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch { return false; }
}
