# Combat audio render — impacts-v3

Revision 808c564 (dirty tree) · seed 731 · 48000 Hz mono · audio path: sprite, formats tried in order ["opus","aac"] · rendered 2026-09-16T02:33:20.381Z through Chromium OfflineAudioContext via `node scripts/audio-preview.mjs --label impacts-v3`.

## Exchange (932 ticks = 15.53 s, render 17.53 s): `exchange.wav`
| beat | tick | time | events on that tick |
|---|---|---|---|
| walk | 1 | 0.02 s | (no event: movement emits none) |
| draw | 102 | 1.70 s | ActionStarted(draw) |
| light | 159 | 2.65 s | AttackActive(light_right), Hit(light_right), Staggered |
| light | 198 | 3.30 s | AttackActive(light_left), Hit(light_left), Staggered |
| heavy | 253 | 4.22 s | AttackActive(heavy_overhead), Hit(heavy_overhead), Staggered |
| guard | 414 | 6.90 s | ActionStarted(guard) |
| block | 435 | 7.25 s | AttackActive(light_right), Blocked(light_right) |
| parry | 475 | 7.92 s | AttackActive(light_left), Parried(light_left), Staggered |
| riposte | 493 | 8.22 s | AttackActive(riposte), Hit(riposte), Staggered |
| hit taken | 532 | 8.87 s | AttackActive(light_right), Hit(light_right), Staggered |
| kick | 608 | 10.13 s | AttackActive(kick), StaminaExhausted, Hit(kick), Staggered |
| death | 788 | 13.13 s | AttackActive(heavy_overhead), Killed(heavy_overhead), Hit(heavy_overhead), Staggered |

Exchange loudness: integrated -14.9 LUFS · phone band (> 300 Hz) -15.6 LUFS · momentary max -8.7 LUFS · peak -2.8 dBFS.

## Per-cue renders: `events/<name>.wav` (one synthetic event at 50 ms, 1.2 s render)
LUFS per ITU-R BS.1770-4 (short sounds under-read on integrated; compare rows across iterations, not against broadcast targets). Phone = the same measure after a 300 Hz high-pass: what a handset speaker can play. Onset = first sample above −60 dBFS relative to the cue tick; length = audible span above −60 dBFS. "—" = silent: the module answers no cue for that event.

| cue | LUFS-I | phone LUFS | LUFS-M max | peak dBFS | onset ms | length ms | Δ LUFS-I vs impacts-v2 | Δ phone vs impacts-v2 |
|---|---|---|---|---|---|---|---|---|
| draw | -16.5 | -16.6 | -15.9 | -5.5 | 6 | 506 | +2.9 | +2.9 |
| swing-light | -22.8 | -23.1 | -22.6 | -8.6 | 7 | 184 | +0.3 | +0.1 |
| swing-heavy | -19.3 | -20.2 | -18.3 | -6 | 7 | 403 | +1.8 | +1.3 |
| swing-kick | -25.3 | -25.5 | -25.1 | -10.9 | 7 | 184 | +0.8 | +0.7 |
| swing-thrust | -22.8 | -23.1 | -22.6 | -8.6 | 7 | 184 | +0.3 | +0.1 |
| attack-active | — | — | — | — | — | 0 | — | — |
| charging | — | — | — | — | — | 0 | — | — |
| charged | -17 | -17.2 | -15.2 | -10.2 | 8 | 649 | +0.7 | +0.6 |
| hit-light | -17.8 | -19.1 | -14.2 | -2.8 | 6 | 706 | +5.8 | +2.7 |
| hit-heavy | -14.4 | -16.2 | -11.6 | -2.8 | 6 | 811 | +4.8 | +6.8 |
| hit-riposte | -14.4 | -16.2 | -11.6 | -2.8 | 6 | 811 | +4.8 | +6.8 |
| hit-kick | -18.4 | -19.6 | -15.9 | -2.8 | 6 | 614 | +3.2 | +3.6 |
| hit-thrust | -17.8 | -19.1 | -14.2 | -2.8 | 6 | 706 | +5.8 | +2.7 |
| blocked | -16.9 | -17.7 | -14.7 | -2.8 | 6 | 719 | +6.5 | +6.8 |
| blocked-perfect | -19.7 | -19.8 | -17.1 | -2.8 | 6 | 670 | +2.3 | +3 |
| parried | -14 | -14.2 | -11.3 | -2.8 | 6 | 793 | +2.9 | +3 |
| guard-broken | -14.8 | -16.9 | -11.5 | -2.8 | 6 | 796 | +4.8 | +5.2 |
| guard | — | — | — | — | — | 0 | — | — |
| parry-attempt | — | — | — | — | — | 0 | — | — |
| feint | — | — | — | — | — | 0 | — | — |
| roll | -24.4 | -24.6 | -24.2 | -10 | 7 | 184 | +2.7 | +2.6 |
| backstep | — | — | — | — | — | 0 | — | — |
| dodged | — | — | — | — | — | 0 | — | — |
| missed | — | — | — | — | — | 0 | — | — |
| staggered | — | — | — | — | — | 0 | — | — |
| exhausted | — | — | — | — | — | 0 | — | — |
| killed | -12.5 | -13.7 | -9.7 | -2.8 | 6 | 954 | +5 | +6.7 |

## Payload
Shipped audio assets (src/assets/audio): 577024 B raw · 544298 B gzip (baseline 401403 B raw · 370656 B gzip; Δ 173642 B gzip). Lane budget: ≤ 1.0 MB gzip.

Determinism: single-cue renders are byte-identical run to run; the exchange can differ by ±1 LSB in a handful of samples (Chromium's threaded convolution for the room), so its figures are stable but its hash is not.

## Phone check
Not part of this render — the owner listens on the handset (device, silent switch on/off) and records the note here.
