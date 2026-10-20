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
- Not measured: a real phone, GPU memory, battery. A clean answer needs a quiet Mac window or the HF T4 with the load figure in the receipt.
