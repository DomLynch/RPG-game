# Weekly GPU-row sweep (Mac)

Lead, 2026-10-22: the release rows that need a GPU (`GPU_ONLY` in `scripts/lib/row-placement.mjs`: rows 5, 7, 16, 21, 28, 34 and 36) run on the Mac once a week in a quiet window. They also run whenever a release's diff scopes them. CI never runs them, and the nightly full run on GitHub leaves them out. There's no workflow cron and no T4: the waterfall says Mac first, and T4 spend is Dom's call.

**Who:** the Auditor (code-quality lane). **When:** once a week, in the quiet hours, and never during a publish.

```bash
bash scripts/gpu-rows-weekly.sh
```

- It refuses to start when the Mac's 1-minute load is over 6 (exit 2): try again later. GPU rows time on a real GPU, so a busy Mac reads as red.
- It runs only the GPU rows, one at a time, at the trunk checkout's head.
- The receipt goes to `artifacts/gpu-rows-weekly.json`, with logs in `artifacts/gpu-rows-weekly/`. It never touches `artifacts/release-checks.json`, which deploy.sh's `--full-age` reads.
- A red row is a fix-forward ticket for the row's owner, filed with the row's log. A row that fails, passes on its one retry, and fails again the next week is flaky: ask Lead whether to fix it or demote it.
- Record each run in the Auditor's state doc as one line: date, head, rows, pass/fail.
