// The anonymous per-fight perf beacon (Strategy via Lead, 2026-09-28; Backend owns public.perf_beacons and its insert-only RLS): once per
// fight end, or on pagehide mid-fight, the ?perf=1 fight figures and the device's own description go to Supabase. No user id, no name,
// no profile, no record: nothing that identifies a player. 100 % sampled in beta. A failed send is silent: it never retries, never
// throws, never shows. Transport: fetch with keepalive (it survives pagehide like navigator.sendBeacon, which cannot send the
// publishable key's apikey header that the REST endpoint needs).

export type PerfFigures = {
  fightFrames: readonly number[];      // this fight's playable frame times, ms
  firstFightAt: number;                // ms from navigation to the page's first playable frame; NaN when none yet
  renderRatio: number; loweredFrom?: number; dprOverride?: number;
  tris: number; draws: number;
  phone: boolean; lookOn: boolean;
  revision: string | null;
  userAgent: string; screen: string; cores?: number; memoryGb?: number;
};

// The row, in Backend's column names. Every field is a number, a boolean, null or a short string, so the body stays under ~1 KB (keepalive's
// limit is 64 KB).
export function beaconPayload(f: PerfFigures) {
  const sorted = [...f.fightFrames].sort((a, b) => a - b), at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
  const fps = (ms: number) => (ms > 0 ? Math.min(240, Math.round(1000 / ms)) : 0);
  const finite = (n: number | undefined) => (n !== undefined && Number.isFinite(n) ? n : null);
  return {
    revision: f.revision ? f.revision.slice(0, 40) : null,
    fps_p50: fps(at(0.5)), fps_p5: fps(at(0.95)), frames: sorted.length,
    fight_s: Math.round(f.fightFrames.reduce((sum, v) => sum + v, 0) / 100) / 10,
    dropped: sorted.filter((v) => v > 16.7).length,
    first_fight_s: Number.isNaN(f.firstFightAt) ? null : Math.round(f.firstFightAt / 100) / 10,
    render_ratio: f.renderRatio, lowered_from: finite(f.loweredFrom), dpr_override: finite(f.dprOverride),
    tris: f.tris, draws: f.draws,
    gfx_tier: f.phone ? 'phone' : 'full', look_on: f.lookOn,
    ua: f.userAgent.slice(0, 300), screen: f.screen.slice(0, 40), cores: finite(f.cores), memory_gb: finite(f.memoryGb),
  };
}

// One POST; resolves true when the server took it, false on anything else. Never rejects.
export async function sendPerfBeacon(api: { url: string; key: string } | null, body: ReturnType<typeof beaconPayload>, fetchFn: typeof fetch): Promise<boolean> {
  if (!api || body.frames === 0) return false;   // no service in this build, or no playable frame to report
  try {
    const response = await fetchFn(`${api.url}/rest/v1/perf_beacons`, {
      method: 'POST', keepalive: true,
      headers: { apikey: api.key, Authorization: `Bearer ${api.key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch { return false; }
}
