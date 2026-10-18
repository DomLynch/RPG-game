// The load cover (Lead's ruling, 2026-10-18): the page opens under a plain cover and lifts it at the FIRST STYLED frame (the hero's body and the zone's kit are both in and a frame has been drawn), so a player never sees the
// half-built scene (the sand backdrop, the unstyled HUD, the capsule walker). A max-hold keeps a stuck load from looking like a hang: past it the cover fades anyway and says why. The fade time and the max hold are
// rows (preview-rules: loadCoverFadeMs, loadCoverHoldMs). Pure: the page's fade, removal and warning are passed in, so the test drives it without a browser.
export type CoverEnv = { fade(ms: number): void; later(cb: () => void, ms: number): void; remove(): void; warn(message: string): void };
export type CoverState = { readonly reason: 'styled' | 'max-hold' | null; readonly atMs: number };
export type Cover = { frame(now: number, missing: readonly string[]): void; state(): CoverState; lifted(): boolean };
export function createCover(env: CoverEnv, fadeMs: number, maxHoldMs: number): Cover {
  let reason: CoverState['reason'] = null, atMs = -1;
  const lift = (why: 'styled' | 'max-hold', now: number): void => { reason = why; atMs = Math.round(now); env.fade(fadeMs); env.later(() => env.remove(), fadeMs); };
  return {
    // Called after each drawn frame with what the first styled frame is still waiting for (empty: it is this one).
    frame(now, missing) {
      if (reason) return;
      if (!missing.length) lift('styled', now);
      else if (now >= maxHoldMs) { env.warn(`load cover: no styled frame after ${maxHoldMs} ms; still waiting for ${missing.join(', ')}`); lift('max-hold', now); }
    },
    state: () => ({ reason, atMs }),
    lifted: () => reason !== null,
  };
}
