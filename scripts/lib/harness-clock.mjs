// A fixed-step clock the gate owns. After the page has booted for real (asset loads are machine-dependent but not timing-sensitive),
// Playwright's page.clock takes over time: requestAnimationFrame, performance.now, setTimeout only advance when the gate says so, one
// 16 ms frame at a time. A scripted press therefore lands on the same simulation tick on any machine — a MacBook at load 60, a
// GPU-less VPS, a CI runner — which is what made the old wall-clock waits ("parry 430 ms after the tell") flake or fail elsewhere.
// The game is untouched. Real-time responsiveness is the physical-phone acceptance's job, not this gate's.
//
// The clock persists across navigations. A win reloads the next rung as a fresh document (main.ts reset-button →
// location.reload), and that document boots with the fake clock already installed and PAUSED: nothing rAF- or timer-driven
// runs in it until the gate advances time, so a plain evaluate loop (or waitForFunction, which polls on rAF) sees a page
// that never writes its debug data. Pattern (quiet-one-browser-check.mjs): arm page.waitForEvent('framenavigated') before
// the press; if it fires, wait on REAL time (Node-side sleep + evaluate) for the new document's assets/ready flag — boot is
// promise-driven and needs no page time — then continue with run()/until() on the new document as with the old one.
export async function harnessClock(page) {
  // The fake performance.now() restarts from 0 at install (probed: real 3021 ms → fake 60000 after a 60 s jump), while the game already
  // holds frame timestamps taken from the real clock before install; if page time sits below them the game sees negative frame time
  // and the simulation stands still until it catches up — on a runner whose boot took over a minute, never within a gate's budget.
  // So the pause target is the real page uptime plus a margin: page time lands ahead of every timestamp the game captured, and the
  // margin also covers the install→pause round-trip (an installed clock keeps pace with real time until paused; 1 s lost once to
  // "Cannot fast-forward to the past" on CI). The jump fires each due timer at most once, so it costs one frame. From here only
  // run()/until() move time.
  const uptime = await page.evaluate(() => performance.now());
  const start = Date.now();
  await page.clock.install({ time: start });
  await page.clock.pauseAt(start + Math.ceil(uptime) + 60_000);
  const run = ms => page.clock.runFor(ms);
  // Advance whole frames until the page predicate holds. `ms` is a budget in page time, never wall time.
  const until = async (predicate, ms = 5000, arg) => {
    for (let t = 0; ; t += 16) {
      if (await page.evaluate(predicate, arg)) return t;
      if (t >= ms) throw new Error(`harness clock: not met within ${ms} ms of page time: ${String(predicate).slice(0, 140)}`);
      await run(16);
    }
  };
  return { run, until, untilTicks: tickWaiter(page, run) };
}

/** Reads the sim's tick from the game's ?debug=1 element (main.ts writes data-tick each frame); NaN when the element is absent. Exported so a test can stand in for the page. */
export const READ_TICK = () => Number(document.querySelector('#debug')?.dataset.tick ?? NaN);

/**
 * A wait whose budget is SIM TICKS, not page milliseconds (the Auditor's follow-up on K3g's tell wait): a starved runner can run frames, and advance page time,
 * without the sim ticking (main.ts paused(): hidden document, graphics lost, a sheet up), so a page-ms budget burns down against a standing sim and fails for the
 * wrong reason. Here the budget (`ticks`) is spent only when the tick advances; if the tick does not move for `stallMs` of page time the wait fails at once and
 * says so (the receipt.sim in browser-check.mjs then names why). Returns the ticks it took.
 */
export function tickWaiter(page, run) {
  return async (predicate, ticks = 1200, arg, stallMs = 5000) => {
    const first = await page.evaluate(READ_TICK);
    if (Number.isNaN(first)) throw new Error('harness clock: no sim tick to count (#debug data-tick missing: is ?debug=1 on?)');
    let last = first, still = 0;
    for (;;) {
      if (await page.evaluate(predicate, arg)) return last - first;
      if (last - first >= ticks) throw new Error(`harness clock: not met within ${ticks} sim ticks: ${String(predicate).slice(0, 140)}`);
      if (still >= stallMs) throw new Error(`harness clock: the sim did not tick for ${stallMs} ms of page time (tick ${last}); waiting for: ${String(predicate).slice(0, 140)}`);
      await run(16);
      const now = await page.evaluate(READ_TICK);
      if (now > last) { last = now; still = 0; } else still += 16;
    }
  };
}

// Frames without pictures, for a stretch a gate only needs to get through (a scripted duel to reach the kill screen). On a GPU-less
// runner every stepped frame is a software-GL draw (~0.5 s on CI), so a 90 s duel budget ran past the 30 min job cap (rows 37/38, CI
// run 36324591308). While `on`, the WebGL draw calls return at once: the simulation, input, DOM and timers run exactly as before, the
// canvas just stops being painted. Switch it off and step a few frames before any screenshot or pixel read.
const gateDraws = (on) => {
  for (const gl of [globalThis.WebGLRenderingContext, globalThis.WebGL2RenderingContext]) {
    if (!gl || gl.prototype.__drawsGated) continue;
    gl.prototype.__drawsGated = true;
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) {
      const real = gl.prototype[name];
      if (real) gl.prototype[name] = function (...args) { if (!globalThis.__skipDraws) return real.apply(this, args); };
    }
  }
  globalThis.__skipDraws = on;
};
export const skipDraws = (page, on) => page.evaluate(gateDraws, on);
/** The same gate installed before every document of a context (a row that reloads or navigates keeps it): draws are off from the first frame; skipDraws(page, false) lifts it on the current page. */
export const skipDrawsOnLoad = (context) => context.addInitScript(gateDraws, true);
