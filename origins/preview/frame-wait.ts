// A frame wait that survives a hidden tab. requestAnimationFrame never fires in a background tab (or the in-app pane while it is hidden), so every
// `await nextFrame()` in the warm-up chain and the walk loop that drives [zone ready] stalled there: the page sat on the Pit shell for good.
// The wait resolves on the next frame, or, when the page is hidden (now, or by the time `hiddenCheckMs` has passed), on a timer. Pure: the
// clock, the frame source and the visibility are passed in, so the test drives it without a browser.
export type FrameEnv = {
  raf: (cb: () => void) => void;
  timer: (cb: () => void, ms: number) => void;
  hidden: () => boolean;
};
/** The hidden tab's walk driver, for the warm-up only: a tick runs `walk` while the page is hidden AND nothing holds it (`held`: a duel owns the canvas, or [zone ready] has been reached). After ready a hidden tab is idle again, as before:
 *  nothing steps the world (no combat, spawn network or presence ticks, no kill reports) for as long as the tab stays hidden. Pure. */
export function hiddenDriver(env: { hidden: () => boolean; held: () => boolean }, walk: () => void): () => void {
  return () => { if (env.hidden() && !env.held()) walk(); };
}
export function waitFrame(env: FrameEnv, hiddenTickMs: number, hiddenCheckMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const fin = () => { if (!done) { done = true; resolve(); } };
    env.raf(fin);
    if (env.hidden()) env.timer(fin, hiddenTickMs);
    else env.timer(() => { if (env.hidden()) fin(); }, hiddenCheckMs);   // hidden after the request: the frame will never come
  });
}
