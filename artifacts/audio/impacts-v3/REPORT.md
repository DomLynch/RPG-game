# Combat audio render — impacts-v3

Revision 0d092d0 (dirty tree) · seed 731 · 48000 Hz mono · audio path: sprite, formats tried in order ["opus","aac"] · rendered 2026-09-15T19:04:20.954Z through Chromium OfflineAudioContext via `node scripts/audio-preview.mjs --label impacts-v3`.

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

Exchange loudness: integrated -16.5 LUFS · phone band (> 300 Hz) -17.2 LUFS · momentary max -10.9 LUFS · peak -2.8 dBFS.

## Per-cue renders: `events/<name>.wav` (one synthetic event at 50 ms, 1.2 s render)
LUFS per ITU-R BS.1770-4 (short sounds under-read on integrated; compare rows across iterations, not against broadcast targets). Phone = the same measure after a 300 Hz high-pass: what a handset speaker can play. Onset = first sample above −60 dBFS relative to the cue tick; length = audible span above −60 dBFS. "—" = silent: the module answers no cue for that event.

| cue | LUFS-I | phone LUFS | LUFS-M max | peak dBFS | onset ms | length ms | Δ LUFS-I vs impacts-v2 | Δ phone vs impacts-v2 |
|---|---|---|---|---|---|---|---|---|
| draw | -16.6 | -16.7 | -15.8 | -5.7 | 6 | 564 | +2.8 | +2.8 |
| swing-light | -21.4 | -21.7 | -21.2 | -7.5 | 7 | 229 | +1.7 | +1.5 |
| swing-heavy | -18.7 | -19.6 | -17.7 | -6.2 | 7 | 420 | +2.4 | +1.9 |
| swing-kick | -23.6 | -23.9 | -23.5 | -9.3 | 7 | 185 | +2.5 | +2.3 |
| swing-thrust | -21.4 | -21.7 | -21.2 | -7.5 | 7 | 229 | +1.7 | +1.5 |
| attack-active | — | — | — | — | — | 0 | — | — |
| charging | — | — | — | — | — | 0 | — | — |
| charged | -16.3 | -16.5 | -14.5 | -9.4 | 8 | 700 | +1.4 | +1.3 |
| hit-light | -20.1 | -21.4 | -16.6 | -3.2 | 6 | 689 | +3.5 | +0.4 |
| hit-heavy | -18 | -19.8 | -14.1 | -2.8 | 6 | 775 | +1.2 | +3.2 |
| hit-riposte | -18 | -19.8 | -14.1 | -2.8 | 6 | 775 | +1.2 | +3.2 |
| hit-kick | -20.9 | -22.1 | -18.3 | -3.5 | 6 | 596 | +0.7 | +1.1 |
| hit-thrust | -20.1 | -21.4 | -16.6 | -3.2 | 6 | 689 | +3.5 | +0.4 |
| blocked | -19.2 | -20.1 | -17.1 | -3.3 | 6 | 719 | +4.2 | +4.4 |
| blocked-perfect | -22 | -22.2 | -19.5 | -3.5 | 6 | 637 | 0 | +0.6 |
| parried | -16.4 | -16.6 | -13.8 | -3.2 | 6 | 793 | +0.5 | +0.6 |
| guard-broken | -16.8 | -20.4 | -13.5 | -3.1 | 6 | 807 | +2.8 | +1.7 |
| guard | — | — | — | — | — | 0 | — | — |
| parry-attempt | — | — | — | — | — | 0 | — | — |
| feint | — | — | — | — | — | 0 | — | — |
| roll | -23 | -23.3 | -22.8 | -8.8 | 7 | 200 | +4.1 | +3.9 |
| backstep | — | — | — | — | — | 0 | — | — |
| dodged | — | — | — | — | — | 0 | — | — |
| missed | — | — | — | — | — | 0 | — | — |
| staggered | — | — | — | — | — | 0 | — | — |
| exhausted | — | — | — | — | — | 0 | — | — |
| killed | -14.8 | -16 | -12.1 | -2.8 | 6 | 931 | +2.7 | +4.4 |

## Payload
Shipped audio assets (src/assets/audio): 416345 B raw · 396340 B gzip (baseline 401403 B raw · 370656 B gzip; Δ 25684 B gzip). Lane budget: ≤ 1.0 MB gzip.

Determinism: single-cue renders are byte-identical run to run; the exchange can differ by ±1 LSB in a handful of samples (Chromium's threaded convolution for the room), so its figures are stable but its hash is not.

## Phone check
Not part of this render — the owner listens on the handset (device, silent switch on/off) and records the note here.
