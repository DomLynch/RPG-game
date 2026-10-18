// A frame wait that survives a hidden tab. requestAnimationFrame never fires in a background tab (or the in-app pane while it is hidden), so every
// `await nextFrame()` in the warm-up chain and the walk loop that drives [zone ready] stalled there: the page sat on the Pit shell for good.
// The wait resolves on the next frame, or, when the page is hidden (now, or by the time `hiddenCheckMs` has passed), on a timer. Pure: the
// clock, the frame source and the visibility are passed in, so the test drives it without a browser.
export type FrameEnv = {
  raf: (cb: () => void) => void;
  timer: (cb: () => void, ms: number) => void;
  hidden: () => boolean;
};
export function waitFrame(env: FrameEnv, hiddenTickMs: number, hiddenCheckMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const fin = () => { if (!done) { done = true; resolve(); } };
    env.raf(fin);
    if (env.hidden()) env.timer(fin, hiddenTickMs);
    else env.timer(() => { if (env.hidden()) fin(); }, hiddenCheckMs);   // hidden after the request: the frame will never come
  });
}
