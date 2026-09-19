# Combat audio render — takeover-before

Revision 32f783e (dirty tree) · seed 731 · 48000 Hz mono · audio path: sprite, formats tried in order ["opus","aac"] · rendered 2026-09-19T09:00:43.439Z through Chromium OfflineAudioContext via `node scripts/audio-preview.mjs --label takeover-before`.

## Exchange (829 ticks = 13.82 s, render 15.82 s): `exchange.wav`
| beat | tick | time | events on that tick |
|---|---|---|---|
| walk | 1 | 0.02 s | (no event: movement emits none) |
| draw | 102 | 1.70 s | ActionStarted(draw) |
| light | 165 | 2.75 s | AttackActive(light_right), Hit(light_right), Staggered |
| light | 212 | 3.53 s | AttackActive(light_left), Hit(light_left), Staggered |
| heavy | 271 | 4.52 s | AttackActive(heavy_overhead), Hit(heavy_overhead), Staggered |
| guard | 396 | 6.60 s | ActionStarted(guard) |
| block | 425 | 7.08 s | AttackActive(light_right), Blocked(light_right) |
| parry | 477 | 7.95 s | AttackActive(light_left), Parried(light_left), Staggered |
| riposte | 495 | 8.25 s | AttackActive(riposte), Hit(riposte), Staggered |
| hit taken | 542 | 9.03 s | AttackActive(light_right), Hit(light_right), Staggered |
| kick | 596 | 9.93 s | AttackActive(kick), StaminaExhausted, Hit(kick), Staggered |
| death | 685 | 11.42 s | AttackActive(heavy_overhead), Killed(heavy_overhead), Hit(heavy_overhead), Staggered |

Exchange loudness: integrated -15.1 LUFS · phone band (> 300 Hz) -15.9 LUFS · momentary max -9.1 LUFS · peak -2.8 dBFS.

## Per-cue renders: `events/<name>.wav` (one synthetic event at 50 ms, 1.2 s render)
LUFS per ITU-R BS.1770-4 (short sounds under-read on integrated; compare rows across iterations, not against broadcast targets). Phone = the same measure after a 300 Hz high-pass: what a handset speaker can play. Onset = first sample above −60 dBFS relative to the cue tick; length = audible span above −60 dBFS. "—" = silent: the module answers no cue for that event.

| cue | LUFS-I | phone LUFS | LUFS-M max | peak dBFS | onset ms | length ms | Δ LUFS-I vs baseline | Δ phone vs baseline |
|---|---|---|---|---|---|---|---|---|
| draw | -16.5 | -16.6 | -15.9 | -5.5 | 6 | 506 | +34.9 | NaN |
| swing-light | -22.8 | -23.1 | -22.6 | -8.6 | 7 | 184 | +28.6 | NaN |
| swing-heavy | -19.3 | -20.2 | -18.3 | -6 | 7 | 403 | +32.1 | NaN |
| swing-kick | -25.3 | -25.5 | -25.1 | -10.9 | 7 | 184 | +26.1 | NaN |
| swing-thrust | -22.8 | -23.1 | -22.6 | -8.6 | 7 | 184 |  |  |
| attack-active | — | — | — | — | — | 0 | — | — |
| charging | — | — | — | — | — | 0 | — | — |
| charged | -17 | -17.2 | -15.2 | -10.2 | 8 | 649 | +22.4 | NaN |
| hit-light | -17.8 | -19.1 | -14.2 | -2.8 | 6 | 706 | +23 | NaN |
| hit-heavy | -14.4 | -16.2 | -11.6 | -2.8 | 6 | 811 | +26.4 | NaN |
| hit-riposte | -14.4 | -16.2 | -11.6 | -2.8 | 6 | 811 | +26.4 | NaN |
| hit-kick | -18.4 | -19.6 | -15.9 | -2.8 | 6 | 614 | +22.4 | NaN |
| hit-thrust | -17.8 | -19.1 | -14.2 | -2.8 | 6 | 706 |  |  |
| blocked | -16.9 | -17.7 | -14.7 | -2.8 | 6 | 719 | +21.6 | NaN |
| blocked-perfect | -19.7 | -19.8 | -17.1 | -2.8 | 6 | 670 | +18.8 | NaN |
| parried | -14 | -14.2 | -11.3 | -2.8 | 6 | 793 | +24.3 | NaN |
| guard-broken | -14.8 | -16.9 | -11.5 | -2.8 | 6 | 796 | +26 | NaN |
| guard | — | — | — | — | — | 0 | — | — |
| parry-attempt | — | — | — | — | — | 0 | — | — |
| feint | — | — | — | — | — | 0 | — | — |
| roll | -24.4 | -24.6 | -24.2 | -10 | 7 | 184 | +27 | NaN |
| backstep | — | — | — | — | — | 0 | — | — |
| dodged | — | — | — | — | — | 0 | — | — |
| missed | — | — | — | — | — | 0 | — | — |
| staggered | — | — | — | — | — | 0 | — | — |
| posture-broken | — | — | — | — | — | 0 |  |  |
| exhausted | — | — | — | — | — | 0 | — | — |
| killed | -12.5 | -13.7 | -9.7 | -2.8 | 6 | 954 | +28.3 | NaN |

## Payload
Shipped audio assets (src/assets/audio): 577024 B raw · 544298 B gzip (baseline 0 B raw · 0 B gzip; Δ 544298 B gzip). Lane budget: ≤ 1.0 MB gzip.

Determinism: single-cue renders are byte-identical run to run; the exchange can differ by ±1 LSB in a handful of samples (Chromium's threaded convolution for the room), so its figures are stable but its hash is not.

## Phone check
Not part of this render — the owner listens on the handset (device, silent switch on/off) and records the note here.
