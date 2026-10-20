# ?gfx=1 cost read on live /zone1/ (2026-10-20, Web & UI, for Dom's "on by default?" decision)

Live revision when I started: 4b0de269c (read from release.json; it may have moved during the two passes). Mac M5 real GPU (renderer "ANGLE (Apple, ANGLE Metal Renderer: Apple M5"), headless Chromium via Playwright (script in this folder: `gfx-cost.mjs`), 375x812 at DPR 2, iPhone-style touch context.
Per run: first-playable = ms from navigation to `window.__zoneReady`; then 12 s settle; then 20 s of walking in a circle on the joystick while a requestAnimationFrame sampler records frame times. 3 runs per mode, with and without a 4x CPU throttle (CDP `Emulation.setCPUThrottlingRate`). Two full passes (`results-run1.json`, `results-run2.json`).

## Stills (same framing, no input after load)
- `zone1-off-375.png`: live Zone 1, no flag.
- `zone1-gfx1-375.png`: the same with `?gfx=1` (warmer haze, bloom on the torch and the horizon, softer far fence).

## Numbers (median of 3 runs; "fps" is the median of the per-second frame counts during the walk, 60 = the display cap)
| Pass | Mode | First-playable | fps 1x | fps 4x throttle |
|---|---|---|---|---|
| 1 | off | 18.1 s | 60 | 35 |
| 1 | gfx=1 | 16.1 s | 57 | 19 |
| 2 | off | 17.2 s | 51.5 | 15 |
| 2 | gfx=1 | 17.2 s | 48 | 12 |

## How far to trust it (read this before the numbers)
The Mac was NOT quiet: load average 10 to 15 during pass 2 (above Lead's under-8 rule) and other lanes' WebKit/Chromium jobs were running; in pass 1 I ran a type check and a gate on the same Mac during some runs. The per-run spread inside one mode (e.g. 60 / 60 / 50.5 fps for "off" at 1x) is as large as the gap between modes. So:
- At 1x on an M5, neither mode is visibly below the 60 fps cap; gfx=1 is at most a few fps lower in these runs, inside the noise.
- At 4x CPU throttle the gap points the same way (gfx=1 lower, 19 vs 35 and 12 vs 15) but pass 1's third "off" run (18 fps) and pass 2's spread make it unproven.
- First-playable shows no cost from the flag (16 to 26 s either way; spread larger than the difference).
- Pass 3 (below) is the clean one and supersedes the 4x numbers above.
- Not measured: a real phone, GPU memory, battery. A clean answer needs a quiet Mac window or the HF T4 with the load figure in the receipt.

## Pass 3: the 4x-throttle pair on a quieter Mac (Lead: rerun to settle it; Mac only if load under 8)
Mac 1-minute load was 5.4 at the start and 4.0 at the end (the 5-minute average fell from 8.8 to 5.9); no other browser job of mine ran. Headless Chromium, M5 real GPU, 4x CPU throttle, 5 runs per mode, interleaved off / gfx=1, same script (`THROTTLES=4 RUNS=5`). Raw runs: `results-run3-4x-quiet.json`. This pass supersedes the 4x numbers above.

| Mode | per-second fps median, each run | median | p5 fps median | frames in 20 s (median) | first-playable (median) |
|---|---|---|---|---|---|
| off | 43, 39, 21.5, 31, 33.5 | 33.5 | 7.5 | 656 | 20.8 s |
| gfx=1 | 38, 30.5, 32, 32, 40 | 32 | 7.5 | 657 | 19.9 s |

Verdict: on the quieter Mac the two modes are the same within the run-to-run spread (frames 656 vs 657, p5 7.5 vs 7.5, median fps 33.5 vs 32, first-playable 20.8 s vs 19.9 s). The earlier "gfx=1 lower under throttle" signal came from the loaded Mac. At 375 wide under a 4x CPU throttle gfx=1 costs no measurable frame rate or load time here. Still a throttled desktop GPU, not a real phone; GPU memory and battery were not measured.
