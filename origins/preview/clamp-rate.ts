// The frame clamp's rate (Strategy ruling 2026-10-21: the 0.05 s frameDtMax clamp stays; the phone plan's exit criterion is "the clamp never binds in a fight at 4x", i.e. the game is out of slow motion).
// walkLoop clamps each frame's dt to frameDtMax before the sim sees it, so a frame slower than that makes the world run slower than the wall clock. This counts it: how many frames were clamped, and the
// game speed = sim seconds / wall seconds, so every phone PR can show it in its receipt. Cumulative counters (a harness subtracts two snapshots to get a phase); published as window.__clampRate() and
// originsPreview.clampRate(); mirrored on #debug (data-clamp-share, data-game-speed) when the page asked for ?debug. Presentation only; no sim file, no sim number.
export type ClampSnapshot = {
  frames: number;       // frames counted (a pause is not one)
  clamped: number;      // frames whose raw dt was above the clamp: the sim got less time than the wall clock gave
  paused: number;       // raw dt above the pause threshold (a hidden tab, a debugger, a stalled load): left out of every figure, so a returning tab does not read as slow motion
  wallMs: number;       // sum of the raw frame times
  simMs: number;        // sum of the clamped frame times the sim was given
  clampedShare: number; // clamped / frames, 0..1
  gameSpeed: number;    // simMs / wallMs, 0..1 (1 = real time)
};
const PERCENT = 100;   // the #debug mirror's unit: a readout scale, not a game number
export type ClampRate = { frame(raw: number, dt: number): void; snapshot(): ClampSnapshot };

/** `pauseS`: a frame longer than this is a pause, not slowness (the preview-rules row clampPauseS). `mirror`: the #debug element, or null when ?debug is off (nothing is written then). */
export function createClampRate(pauseS: number, mirror: { dataset: DOMStringMap } | null = null): ClampRate {
  let frames = 0, clamped = 0, paused = 0, wallMs = 0, simMs = 0, shown = '';
  const snapshot = (): ClampSnapshot => ({ frames, clamped, paused, wallMs: Math.round(wallMs), simMs: Math.round(simMs), clampedShare: frames ? clamped / frames : 0, gameSpeed: wallMs ? simMs / wallMs : 1 });
  return {
    frame(raw, dt) {
      if (!(raw > 0)) return;   // the clock's first frame, or a zero step
      if (raw > pauseS) { paused++; return; }
      frames++; wallMs += raw * 1000; simMs += dt * 1000;
      if (raw > dt) clamped++;
      if (mirror) {   // written only when a whole percent changes, so a ?debug page does not touch the DOM every frame
        const s = snapshot(), share = String(Math.round(s.clampedShare * PERCENT)), speed = String(Math.round(s.gameSpeed * PERCENT)), key = `${share}|${speed}`;
        if (key !== shown) { shown = key; mirror.dataset.clampShare = share; mirror.dataset.gameSpeed = speed; }
      }
    },
    snapshot,
  };
}
