// A fixed-step clock the gate owns. After the page has booted for real (asset loads are machine-dependent but not timing-sensitive),
// Playwright's page.clock takes over time: requestAnimationFrame, performance.now, setTimeout only advance when the gate says so, one
// 16 ms frame at a time. A scripted press therefore lands on the same simulation tick on any machine — a MacBook at load 60, a
// GPU-less VPS, a CI runner — which is what made the old wall-clock waits ("parry 430 ms after the tell") flake or fail elsewhere.
// The game is untouched. Real-time responsiveness is the physical-phone acceptance's job, not this gate's.
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
  return { run, until };
}
