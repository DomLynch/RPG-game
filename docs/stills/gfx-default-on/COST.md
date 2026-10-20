# gfx default on: first-playable and fps cost, 034d072e7 vs trunk 02f0af03c

Web & UI, 2026-10-20. Headless Chromium on the M5's real GPU (ANGLE Metal), 375x812 touch phone, `/preview/origins/?region=1&zone=1&presence=0` served from two local builds (trunk gfx off; the PR head gfx on by default), 5 interleaved runs per mode (trunk, then PR head, per run), 1x and 4x CPU throttle. First playable = `window.__zoneReady`; fps from a 20 s walk. Mac load average 2.4-3.5 for the whole run (under Lead's 8). Raw rows: `cost-034d072e7-vs-trunk-02f0af03c.json`. An earlier 3-run pass was taken while the Mac load reached 9.5 and is not used.

| | first playable, median (runs) | median fps | p5 fps, median (runs) | frames in 20 s |
|---|---|---|---|---|
| 1x trunk | 4642 ms (4617-4742) | 59.9 | 53.8 (53.8 x5) | 1193 |
| 1x PR head | 4763 ms (4737-4799) | 59.9 | 53.8 (53.8-54.1) | 1202 |
| 4x trunk | 7293 ms (7112-7594) | 59.9 | 12 (11.9-12) | 874 |
| 4x PR head | 7453 ms (7367-11481) | 59.9 | 12 (8.5-12) | 878 |

Read: no fps cost (median 59.9 and p5 identical in both modes at both throttles). First playable is **+121 ms (+2.6%) at 1x and +160 ms (+2.2%) at 4x**: at 1x the two runs' ranges do not overlap (4617-4742 vs 4737-4799), so it is small but real. One 4x PR-head run read 11481 ms with p5 8.5 (a single outlier, 1 of 5). Limits: desktop GPU, not a phone; no GPU memory or battery measured.
