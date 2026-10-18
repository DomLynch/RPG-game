// The load cover (Lead's ruling, 2026-10-18): the page opens under a plain cover and lifts it at the FIRST STYLED frame (the hero's body and the zone's kit are both in and a frame has been drawn), so a player never sees the
// half-built scene (the sand backdrop, the unstyled HUD, the capsule walker). A max-hold keeps a stuck load from looking like a hang: it is a WALL-CLOCK timer started when the cover goes up, not a frame count, so it fires
// even when no frame ever draws (the stuck case it is for); past it the cover fades anyway and says why. The fade time and the max hold are rows (preview-rules: loadCoverFadeMs, loadCoverHoldMs). Pure: the page's timer,
// fade, removal, warning and clock are passed in, so the test drives it without a browser.
export type CoverEnv = {
  fade(ms: number): void; later(cb: () => void, ms: number): void; remove(): void; warn(message: string): void;
  now(): number;                  // ms since the page began (performance.now)
  missing(): readonly string[];   // what the first styled frame is still waiting for, right now
};
export type CoverState = { readonly reason: 'styled' | 'max-hold' | null; readonly atMs: number };
export type Cover = { frame(): void; state(): CoverState; lifted(): boolean };
export function createCover(env: CoverEnv, fadeMs: number, maxHoldMs: number): Cover {
  let reason: CoverState['reason'] = null, atMs = -1;
  const lift = (why: 'styled' | 'max-hold'): void => { reason = why; atMs = Math.round(env.now()); env.fade(fadeMs); env.later(() => env.remove(), fadeMs); };
  env.later(() => {   // the wall-clock hold: no frame has to draw for it to fire
    if (reason) return;
    env.warn(`load cover: no styled frame after ${maxHoldMs} ms; still waiting for ${env.missing().join(', ') || 'a drawn frame'}`); lift('max-hold');
  }, Math.max(0, maxHoldMs - env.now()));   // counted from the page's start, not from this call: the cover has been up since the first paint
  return {
    frame() { if (!reason && !env.missing().length) lift('styled'); },   // called after each drawn frame: the first one with nothing missing lifts the cover
    state: () => ({ reason, atMs }),
    lifted: () => reason !== null,
  };
}
