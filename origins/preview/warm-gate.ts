// The wall-clock bound on a warm-up gate (Lead/Auditor, 2026-10-08: EVERY reveal/compile gate has an explicit bound; Claudecraft's gates have a watchdog only). If `work` has not settled within
// `boundMs`, the gate resolves 'late' anyway so the caller reveals, and logs `warmup timeout <archetype> <ms>`; the caller still awaits `work` before starting the next one (one in flight).
export type GateResult = 'ok' | 'failed' | 'late';
export async function gateWithBound(archetype: string, work: Promise<unknown>, boundMs: number, log: (line: string) => void = console.warn): Promise<{ result: GateResult; settled: Promise<unknown> }> {
  const t0 = Date.now(), done = work.then(() => 'ok' as const, (error: unknown) => { log(`warmup failed ${archetype} ${String(error).slice(0, 120)}`); return 'failed' as const; });
  let timer: ReturnType<typeof setTimeout> | undefined; const bound = new Promise<'late'>((r) => { timer = setTimeout(() => r('late'), boundMs); });
  const result = await Promise.race([done, bound]); clearTimeout(timer);
  if (result === 'late') log(`warmup timeout ${archetype} ${Date.now() - t0}`);
  return { result, settled: done };
}
