# Combat audio render — impacts-v1

Revision a1e0185 (dirty tree) · seed 731 · 48000 Hz mono · audio path: sprite, formats tried in order ["opus","aac"] · rendered 2026-09-15T17:29:51.926Z through Chromium OfflineAudioContext via `node scripts/audio-preview.mjs --label impacts-v1`.

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

Exchange loudness: integrated -20.8 LUFS · momentary max -14.2 LUFS · peak -3.5 dBFS.

## Per-cue renders: `events/<name>.wav` (one synthetic event at 50 ms, 1.2 s render)
LUFS per ITU-R BS.1770-4 (short sounds under-read on integrated; compare rows across iterations, not against broadcast targets). Onset = first sample above −60 dBFS relative to the cue tick; length = audible span above −60 dBFS. "—" = silent: the module answers no cue for that event.

| cue | LUFS-I | LUFS-M max | peak dBFS | onset ms | length ms | Δ LUFS-I vs baseline |
|---|---|---|---|---|---|---|
| draw | -22.4 | -22.1 | -7.1 | 7 | 385 | +29 |
| swing-light | -24.3 | -24.2 | -8.1 | 8 | 173 | +27.1 |
| swing-heavy | -21.8 | -20.7 | -6.7 | 9 | 334 | +29.6 |
| swing-kick | -27.4 | -27.3 | -10.9 | 8 | 172 | +24 |
| swing-thrust | -24.3 | -24.2 | -8.1 | 8 | 173 |  |
| attack-active | — | — | — | — | 0 | — |
| charging | — | — | — | — | 0 | — |
| charged | -20.8 | -19.7 | -10.8 | 8 | 567 | +18.6 |
| hit-light | -23.5 | -23.5 | -4.2 | 6 | 309 | +17.3 |
| hit-heavy | -22.7 | -20.6 | -4.1 | 6 | 436 | +18.1 |
| hit-riposte | -22.7 | -20.6 | -4.1 | 6 | 436 | +18.1 |
| hit-kick | -24.2 | -24.2 | -4.4 | 6 | 255 | +16.6 |
| hit-thrust | -23.5 | -23.5 | -4.2 | 6 | 309 |  |
| blocked | -26.1 | -23.4 | -4.5 | 6 | 319 | +12.4 |
| blocked-perfect | -24 | -24 | -4.1 | 6 | 330 | +14.5 |
| parried | -19.5 | -18.2 | -4.4 | 6 | 424 | +18.8 |
| guard-broken | -24.2 | -21.9 | -3.3 | 6 | 397 | +16.6 |
| guard | — | — | — | — | 0 | — |
| parry-attempt | — | — | — | — | 0 | — |
| feint | — | — | — | — | 0 | — |
| roll | -28.4 | -28.3 | -11.8 | 8 | 171 | +23 |
| backstep | — | — | — | — | 0 | — |
| dodged | — | — | — | — | 0 | — |
| missed | — | — | — | — | 0 | — |
| staggered | — | — | — | — | 0 | — |
| exhausted | — | — | — | — | 0 | — |
| killed | -20.2 | -17.5 | -3.8 | 6 | 490 | +20.6 |

## Payload
Shipped audio assets (src/assets/audio): 395117 B raw · 360942 B gzip (baseline 0 B raw · 0 B gzip; Δ 360942 B gzip). Lane budget: ≤ 1.0 MB gzip.

Determinism: single-cue renders are byte-identical run to run; the exchange can differ by ±1 LSB in a handful of samples (Chromium's threaded convolution for the room), so its figures are stable but its hash is not.

## Phone check
Not part of this render — the owner listens on the handset (device, silent switch on/off) and records the note here.
