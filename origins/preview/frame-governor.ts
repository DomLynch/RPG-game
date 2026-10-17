// Adaptive crowd cost (World's T4 table, Lead's ruling): when the frame time stays high with a crowd on screen, fewer remote figures get the FULL treatment; when it stays low again, the full count comes back.
// Pure: no THREE, no DOM, no clock of its own (the page passes each frame's length and the time). The p95 of the frames of the last `windowMs` decides: above `slowMs` the governor drops to LOW, and only
// below `okMs` (a gap under slowMs, so it does not flap at the edge) does it return to HIGH. It judges only once it has seen a full window since its last change, so a loading hitch or one slow second never flips it.
export type Governor = { push(frameMs: number, nowMs: number): boolean; low(): boolean; p95(): number };

export function createGovernor(o: { windowMs: number; slowMs: number; okMs: number; judgeMs: number; percentile: number }): Governor {   // judgeMs: the least time between two judgements; percentile: which frame time decides (0.95 = p95); both are preview rows
  const frames: { t: number; ms: number }[] = [];
  let low = false, since: number | undefined, last = -Infinity;
  const p95 = (): number => {
    if (!frames.length) return 0;
    const sorted = frames.map((f) => f.ms).sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * o.percentile) - 1)]!;
  };
  return {
    /** One frame; returns whether the governor is LOW (the reduced full count applies). Judged at most every `judgeMs`. */
    push(frameMs, nowMs) {
      frames.push({ t: nowMs, ms: frameMs });
      while (frames.length && nowMs - frames[0]!.t > o.windowMs) frames.shift();
      if (since === undefined) since = nowMs;   // the first window is judged once a full window has been seen
      if (nowMs - last >= o.judgeMs &&nowMs - since >= o.windowMs) {
        last = nowMs; const p = p95();
        if (!low && p > o.slowMs) { low = true; since = nowMs; } else if (low && p < o.okMs) { low = false; since = nowMs; }
      }
      return low;
    },
    low: () => low,
    p95,
  };
}
