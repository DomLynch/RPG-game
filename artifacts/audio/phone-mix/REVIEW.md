# Phone volume balance

Owner target: ordinary sound effects x0.5; fatal impact/death/crowd x1.5 versus a8e72e6. These are amplitude changes, not a claim that perceived loudness is linear.

## Decision

Keep the existing source tone and event timing. Apply levels after the existing compressor so compression cannot undo the requested balance. Use the finishing level from the lethal event through the delayed voice, collapse and crowd. Empty simulation ticks preserve it; new combat, quiet and mute reset it. Music and gameplay are unchanged.

One additional gain and one oversampled safety shaper are created once per audio context. Ordinary audio stays below the shaper's knee. The final peak guard gently restrains the sharpest boosted transients; no audio assets or dependencies are added.

## Measured review

- 17 ordinary probes: -6.0 to -6.1 LUFS, matching half amplitude within rounding tolerance.
- Eight crowd-tail windows: +3.52 dB within 0.15 dB, matching x1.5. Fatal mixes: +2.8 to +3.3 LUFS after peak protection.
- All 29 audible probes checked with FFmpeg's oversampled true-peak meter: maximum reported -1.0 dBTP. The browser's independent 4x reconstructed fatal check reports -1.54 dBFS.
- A first version passed sample-peak checks but failed true-peak review at +2.2 dBTP. Oversampling and extra limiter headroom corrected this; the stronger browser check is now required by the existing audio gate.
- Five spectral bands (0–250, 250–1000, 1000–4000, 4000–8000, >8000 Hz), 2048-sample Hann windows: largest band-energy-share change 1.67 percentage points. Ordinary maximum 1.37 points comes from oversampling filtering. No broad EQ change was justified by these comparisons.
- The 300 Hz high-pass loudness proxy confirms the balance change survives removal of deep bass. It does not model the owner's phone response.
- Three deterministic exchange renders agree within one PCM unit. AAC and Opus decode all 73 regions; forced primary-format failure recovers. Empty death ticks, mute/quiet cancellation and fresh-duel restoration pass in the real offline Web Audio graph.
- Audio payload remains 996,816 bytes gzip.

This is a measured recommendation, not a subjective listening or physical-phone test. Handset/silent-switch audition remains the owner's final check.

## Reproduction

Baseline: run `node scripts/audio-preview.mjs --label phone-mix-before --check` from a8e72e6. Its frozen levels are in reference.json. Keep its generated WAVs locally.

Current: run `node scripts/audio-preview.mjs --label phone-mix-after --against phone-mix-before --check`, then `python3 artifacts/audio/phone-mix/analyse.py` (NumPy and FFmpeg). The script writes frequency.json with spectral, loudness and independently measured true peaks.

The baseline and after loudness receipts are retained alongside this review; WAVs are generated artifacts. Full quality passed 264/264 tests, lint, build, audit, budget and the main game browser check. All eight configured completion commands passed; command receipts are in gates.json. Native gameplay confirmed player death, voice/body/crowd scheduling, delayed cheer and menu cancellation without replay. Two-pass review found no simulation/input changes and no audio lifecycle regression. Live verification belongs to the coordinated release, which is still held by the lead.
