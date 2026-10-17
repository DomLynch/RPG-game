// Adaptive crowd cost (World's T4 table, Lead's ruling): when the frame time stays high with a crowd on screen, fewer remote figures get the FULL treatment and the cheap ones are posed less often; when it stays low again, the cost comes back.
// Pure: no THREE, no DOM, no clock of its own (the page passes each frame's length and the time). The p95 of the frames of the last `windowMs` decides: above `slowMs` the governor steps ONE rung down a ladder (crowd-ladder.json: rung 0 is
// the full treatment, the last rung the cheapest), and only below `okMs` (a gap under slowMs, so it does not flap at the edge) does it step ONE rung back up. It judges only once it has seen a full window since its last change, so a loading hitch
// or one slow second never flips it, and each step has to earn its own window.
export type Governor = { push(frameMs: number, nowMs: number): boolean; low(): boolean; level(): number; p95(): number };

export function createGovernor(o: { windowMs: number; slowMs: number; okMs: number; judgeMs: number; percentile: number; rungs?: number }): Governor {   // judgeMs: the least time between two judgements; percentile: which frame time decides (0.95 = p95); rungs: how many steps the ladder has (default 2: the old full / reduced pair)
  const frames: { t: number; ms: number }[] = [], top = Math.max(1, (o.rungs ?? 2) - 1);   // top: the last rung's index
  let level = 0, since: number | undefined, last = -Infinity;
  const p95 = (): number => {
    if (!frames.length) return 0;
    const sorted = frames.map((f) => f.ms).sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * o.percentile) - 1)]!;
  };
  return {
    /** One frame; returns whether the governor is below rung 0 (`level()` says which rung). Judged at most every `judgeMs`. */
    push(frameMs, nowMs) {
      frames.push({ t: nowMs, ms: frameMs });
      while (frames.length && nowMs - frames[0]!.t > o.windowMs) frames.shift();
      if (since === undefined) since = nowMs;   // the first window is judged once a full window has been seen
      if (nowMs - last >= o.judgeMs && nowMs - since >= o.windowMs) {
        last = nowMs; const p = p95();
        // A step clears the window: the next rung is judged on the frames it has actually run (the slow frames that earned this step must not earn the next one too).
        if (level < top && p > o.slowMs) { level++; since = nowMs; frames.length = 0; } else if (level > 0 && p < o.okMs) { level--; since = nowMs; frames.length = 0; }
      }
      return level > 0;
    },
    low: () => level > 0,
    level: () => level,
    p95,
  };
}
