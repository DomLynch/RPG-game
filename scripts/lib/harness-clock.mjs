// A fixed-step clock the gate owns. After the page has booted for real (asset loads are machine-dependent but not timing-sensitive),
// Playwright's page.clock takes over time: requestAnimationFrame, performance.now, setTimeout only advance when the gate says so, one
// 16 ms frame at a time. A scripted press therefore lands on the same simulation tick on any machine — a MacBook at load 60, a
// GPU-less VPS, a CI runner — which is what made the old wall-clock waits ("parry 430 ms after the tell") flake or fail elsewhere.
// The game is untouched. Real-time responsiveness is the physical-phone acceptance's job, not this gate's.
export async function harnessClock(page) {
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1);   // installed clocks keep pace with real time until paused; from here only run()/until() move it
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
