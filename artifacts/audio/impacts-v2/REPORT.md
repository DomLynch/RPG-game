# Combat audio render — impacts-v2

Revision 86ea4c3 (dirty tree) · seed 731 · 48000 Hz mono · audio path: sprite, formats tried in order ["opus","aac"] · rendered 2026-09-15T18:21:28.056Z through Chromium OfflineAudioContext via `node scripts/audio-preview.mjs --label impacts-v2`.

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

Exchange loudness: integrated -18.8 LUFS · phone band (> 300 Hz) -19.7 LUFS · momentary max -12.4 LUFS · peak -3.1 dBFS.

## Per-cue renders: `events/<name>.wav` (one synthetic event at 50 ms, 1.2 s render)
LUFS per ITU-R BS.1770-4 (short sounds under-read on integrated; compare rows across iterations, not against broadcast targets). Phone = the same measure after a 300 Hz high-pass: what a handset speaker can play. Onset = first sample above −60 dBFS relative to the cue tick; length = audible span above −60 dBFS. "—" = silent: the module answers no cue for that event.

| cue | LUFS-I | phone LUFS | LUFS-M max | peak dBFS | onset ms | length ms | Δ LUFS-I vs impacts-v1 | Δ phone vs impacts-v1 |
|---|---|---|---|---|---|---|---|---|
| draw | -19.4 | -19.5 | -18.9 | -6.9 | 6 | 433 | +3 | +2.9 |
| swing-light | -23.1 | -23.2 | -23 | -7.7 | 7 | 174 | +1.2 | +1.1 |
| swing-heavy | -21.1 | -21.5 | -20.1 | -6.5 | 8 | 335 | +0.7 | +0.4 |
| swing-kick | -26.1 | -26.2 | -26 | -10.4 | 8 | 173 | +1.3 | +1.2 |
| swing-thrust | -23.1 | -23.2 | -23 | -7.7 | 7 | 174 | +1.2 | +1.1 |
| attack-active | — | — | — | — | — | 0 | — | — |
| charging | — | — | — | — | — | 0 | — | — |
| charged | -17.7 | -17.8 | -15.9 | -10.3 | 7 | 595 | +3.1 | +3 |
| hit-light | -23.6 | -21.8 | -20.7 | -4.7 | 6 | 365 | -0.1 | +6.1 |
| hit-heavy | -19.2 | -23 | -17.2 | -4.4 | 6 | 426 | +3.5 | +7.7 |
| hit-riposte | -19.2 | -23 | -17.2 | -4.4 | 6 | 426 | +3.5 | +7.7 |
| hit-kick | -21.6 | -23.2 | -21.6 | -4.8 | 6 | 304 | +2.6 | +13.4 |
| hit-thrust | -23.6 | -21.8 | -20.7 | -4.7 | 6 | 365 | -0.1 | +6.1 |
| blocked | -23.4 | -24.5 | -20.7 | -4.6 | 6 | 388 | +2.7 | +1.8 |
| blocked-perfect | -22 | -22.8 | -22 | -4.4 | 6 | 365 | +2 | +1.2 |
| parried | -16.9 | -17.2 | -15.6 | -4.1 | 6 | 484 | +2.6 | +2.3 |
| guard-broken | -19.6 | -22.1 | -18 | -4 | 6 | 460 | +4.6 | +7.2 |
| guard | — | — | — | — | — | 0 | — | — |
| parry-attempt | — | — | — | — | — | 0 | — | — |
| feint | — | — | — | — | — | 0 | — | — |
| roll | -27.1 | -27.2 | -27 | -11.3 | 8 | 173 | +1.3 | +1.2 |
| backstep | — | — | — | — | — | 0 | — | — |
| dodged | — | — | — | — | — | 0 | — | — |
| missed | — | — | — | — | — | 0 | — | — |
| staggered | — | — | — | — | — | 0 | — | — |
| exhausted | — | — | — | — | — | 0 | — | — |
| killed | -17.5 | -20.4 | -14.4 | -3.4 | 6 | 613 | +2.7 | +12.9 |

## Payload
Shipped audio assets (src/assets/audio): 401403 B raw · 370656 B gzip (baseline 395117 B raw · 360942 B gzip; Δ 9714 B gzip). Lane budget: ≤ 1.0 MB gzip.

Determinism: single-cue renders are byte-identical run to run; the exchange can differ by ±1 LSB in a handful of samples (Chromium's threaded convolution for the room), so its figures are stable but its hash is not.

## Phone check
Not part of this render — the owner listens on the handset (device, silent switch on/off) and records the note here.
