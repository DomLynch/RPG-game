# Clip spike — SCOPE 5b (2026-09-25, Auditer)

**Question.** Can a phone record the game canvas + WebAudio in the browser, and hand the file to the share sheet?

**Method.** `probe.html` (standalone: 2D canvas at rAF + oscillator → `canvas.captureStream(30)` + `AudioContext.createMediaStreamDestination()` → `MediaRecorder`, 5 s, then `navigator.canShare({ files })`), served by `collect.mjs`, which stores each browser's report and clip in `out/`. `fight-clip.mjs`: the real game (trunk build) in headless Chromium, phone tier, `?perf=1`; the game's master bus is captured by wrapping `AudioNode.prototype.connect` from an init script (no src change), recorded for 5 s mid-fight vs the Executioner.

**Results (this Mac, load 26–40 while running — fps numbers are indicative only).**

| browser | captureStream / MediaRecorder | mp4 (h264+aac) | webm | audio in file | canShare({files}) | notes |
|---|---|---|---|---|---|---|
| Chromium 1234 headless, real fight | yes | **yes** `video/mp4;codecs=avc1.420020,mp4a.40.2` | yes | **yes** (aac, game master bus) | n/a headless | 5 s = 698 KB, 490×1064 vertical; rAF 58 → 51 fps during, 44 after (load 40, not the recorder) |
| Chrome desktop | yes | yes when asked for `avc1`; a bare `video/mp4` request silently yields **vp9+opus in an mp4 box** (iOS cannot play it) | yes | yes | **true** | 5 s = 470 KB, 60 fps while recording |
| Safari desktop | pending — page open on the Mac, needs one human click on Start (`do JavaScript` is off, browsers are read-only to this session's tools) | | | | | |
| iOS Safari (Dom's iPhone) | **pending** — `http://192.168.1.71:4323/probe?name=iphone`, tap Start 5 s test | | | | | the only answer that counts for the share sheet |

**Recorder fps cost, real fight, Chromium phone tier (`fight-clip.mjs`, `NOREC=1` = same windows without a recorder), interleaved at load 19–26.** rAF fps before / during / after the 5 s window: recorder 49.8 / 41.1 / 32.7 and 54.6 / 48.4 / 42.4; control 56.0 / 49.5 / 39.1 and 57.2 / 53.0 / 37.9. The fight itself gets heavier as blood and sparks accumulate (every run's "after" is its lowest, recorder or not), so the recorder's own cost is the during/before ratio: recorder 0.83 and 0.89, control 0.88 and 0.93 — about **5 % (2–4 fps at ~50)** on the Mac's software GL, inside the run-to-run drift. The phone's GPU cost is the iPhone probe's `fpsWhileRecording`.

**Files.** `out/chromium-fight.mp4` (the 5 s real-fight clip, ffprobe: h264 490×1064 + aac, 4.99 s), `out/chrome-desktop.mp4` (probe clip), `out/*.json` (reports).

**Hard requirements for the real feature (Lead, 2026-09-25).**
1. Always request the mimeType explicitly as `video/mp4;codecs="avc1.42E01E,mp4a.40.2"` (fall back to webm only when `isTypeSupported` says no): a bare `video/mp4` lets Chrome write VP9+Opus into an mp4 box, which iOS cannot play.
2. Start the recorder (and resume the AudioContext) from the tap that starts the fight, never later on a timer: otherwise Safari keeps the context suspended and the file has no audio.

**Read-out so far.** The pipeline works end to end in Chromium with the game's own audio, as h264+aac mp4 straight from MediaRecorder — no transcoding step. Two traps for the real feature: always pass an explicit `avc1…,mp4a.40.2` mimeType (Chrome puts VP9 in an mp4 box otherwise), and the recorder must be started from the tap that starts the fight or the AudioContext stays suspended on Safari. iOS answers (mp4 support, audio track, share sheet, fps) are Dom's probe run.
