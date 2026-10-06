// The first frame, drawn behind the versus card. The fight is not rendered while the card is up (main.ts paused()), so the first real draw landed the
// instant it lifted and uploaded every map and buffer of both rigs and the arena in one 2-3 s long task (Chromium, 375 x 812, 4x CPU, software GL: veteran
// 3005 ms, pitborn 2259 ms, setfoot 3242 ms). Here the maps go up one per frame, then one whole draw, all before the card may lift; a slow device
// stops waiting after `budgetMs` and the card lifts anyway (the rest of the warm-up is dropped). Pixels are untouched: the draw is what the first frame was.
export type FirstFrame = {
  textures: readonly unknown[];               // every map in the scene
  upload(texture: unknown): void;             // renderer.initTexture
  draw(): void;                               // renderer.render(scene, camera)
  frame(): Promise<void>;                     // next animation frame
  budgetMs: number;
  lost(): boolean;                            // the GL context is gone: skip, as the rank-look warm-up does
};
export async function warmFirstFrame(w: FirstFrame): Promise<'done' | 'timeout' | 'skipped'> {
  if (w.lost()) return 'skipped';
  let over = false, timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => { timer = setTimeout(() => { over = true; resolve('timeout'); }, w.budgetMs); });
  const work = (async (): Promise<'done' | 'skipped'> => {
    for (const texture of w.textures) { await w.frame(); if (over || w.lost()) return 'skipped'; w.upload(texture); }
    await w.frame(); if (over || w.lost()) return 'skipped';
    w.draw(); return 'done';
  })().catch((): 'skipped' => 'skipped');   // a warm-up that throws only costs the warm-up: the first real frame pays as before
  const result = await Promise.race([work, timeout]); clearTimeout(timer); return result;
}
