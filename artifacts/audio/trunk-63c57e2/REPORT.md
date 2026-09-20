# Combat audio render — trunk-63c57e2

Revision 63c57e2 · seed 731 · 48000 Hz mono · audio path: sprite, formats tried in order ["opus","aac"] · rendered 2026-09-20T03:35:02.006Z through Chromium OfflineAudioContext via `node scripts/audio-preview.mjs --label trunk-63c57e2`.

## Exchange (829 ticks = 13.82 s, render 17.82 s): `exchange.wav`
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

Exchange loudness: integrated -14 LUFS · phone band (> 300 Hz) -14.4 LUFS · momentary max -7.2 LUFS · peak -1.9 dBFS.

## Per-cue renders: `events/<name>.wav` (one synthetic event at 50 ms, 1.2 s render; fatal probes 4.5 s)
LUFS per ITU-R BS.1770-4 (short sounds under-read on integrated; compare rows across iterations, not against broadcast targets). Phone = the same measure after a 300 Hz high-pass; a rough proxy, not a specific handset response. Onset = first sample above −60 dBFS relative to the cue tick; length = audible span above −60 dBFS. "—" = silent: the module answers no cue for that event.

| cue | LUFS-I | phone LUFS | LUFS-M max | peak dBFS | onset ms | length ms | Δ LUFS-I vs impacts-v3 | Δ phone vs impacts-v3 |
|---|---|---|---|---|---|---|---|---|
| draw | -22.5 | -22.6 | -21.9 | -11.6 | 10 | 633 | -6 | -6 |
| swing-light | -28.8 | -29.1 | -28.7 | -14.7 | 12 | 324 | -6 | -6 |
| swing-heavy | -25.3 | -26.2 | -24.3 | -12.1 | 11 | 495 | -6 | -6 |
| swing-kick | -31.2 | -31.5 | -31.1 | -17 | 12 | 294 | -5.9 | -6 |
| swing-thrust | -28.8 | -29.1 | -28.7 | -14.7 | 12 | 324 | -6 | -6 |
| attack-active | — | — | — | — | — | 0 | — | — |
| charging | — | — | — | — | — | 0 | — | — |
| charged | -23 | -23.2 | -21.2 | -15.8 | 12 | 829 | -6 | -6 |
| hit-light | -23.7 | -25 | -20.3 | -8.8 | 10 | 624 | -5.9 | -5.9 |
| hit-heavy | -20.3 | -22.1 | -17.6 | -8.8 | 10 | 685 | -5.9 | -5.9 |
| hit-riposte | -20.3 | -22.1 | -17.6 | -8.8 | 10 | 685 | -5.9 | -5.9 |
| hit-kick | -24.4 | -25.5 | -21.9 | -8.9 | 10 | 554 | -6 | -5.9 |
| hit-thrust | -23.7 | -25 | -20.3 | -8.8 | 10 | 624 | -5.9 | -5.9 |
| blocked | -22.8 | -23.6 | -20.7 | -8.8 | 10 | 628 | -5.9 | -5.9 |
| blocked-perfect | -25.6 | -25.8 | -23.1 | -8.8 | 10 | 575 | -5.9 | -6 |
| parried | -19.9 | -20.1 | -17.4 | -8.8 | 10 | 707 | -5.9 | -5.9 |
| guard-broken | -20.6 | -22.6 | -17.3 | -8.8 | 10 | 678 | -5.8 | -5.7 |
| guard | — | — | — | — | — | 0 | — | — |
| parry-attempt | — | — | — | — | — | 0 | — | — |
| feint | — | — | — | — | — | 0 | — | — |
| roll | -34.9 | -35.3 | -33.6 | -17.3 | 11 | 255 | -10.5 | -10.7 |
| backstep | -39.8 | -40.1 | -39.8 | -20.3 | 10 | 118 | — | — |
| dodged | — | — | — | — | — | 0 | — | — |
| missed | — | — | — | — | — | 0 | — | — |
| staggered | — | — | — | — | — | 0 | — | — |
| posture-broken | — | — | — | — | — | 0 |  |  |
| exhausted | — | — | — | — | — | 0 | — | — |
| killed | -10.9 | -11.6 | -7.8 | -2.1 | 10 | 3013 | +1.6 | +2.1 |
| finish-plainDeath | -10.9 | -11.6 | -7.8 | -2.1 | 10 | 3013 |  |  |
| finish-plainDeath-blood-off | -10.9 | -11.6 | -7.9 | -2.1 | 10 | 2977 |  |  |
| finish-splitCrown | -10.8 | -11.6 | -7.8 | -2.1 | 10 | 2873 |  |  |
| finish-splitCrown-blood-off | -11 | -11.7 | -7.9 | -2.1 | 10 | 2977 |  |  |
| finish-decapitation | -10.7 | -11.4 | -7.5 | -2.1 | 10 | 2873 |  |  |
| finish-decapitation-blood-off | -11 | -11.7 | -7.9 | -2.1 | 10 | 2977 |  |  |
| finish-runThrough | -10.4 | -10.9 | -8 | -2.1 | 10 | 3056 |  |  |
| finish-runThrough-blood-off | -11.6 | -12.2 | -7.9 | -2.1 | 10 | 2977 |  |  |
| finish-quietOne | -12.2 | -13.6 | -8.4 | -2.1 | 10 | 3516 |  |  |
| finish-quietOne-blood-off | -12.1 | -13.4 | -8.5 | -2.1 | 10 | 3570 |  |  |
| finish-opened | -11 | -11.8 | -7.5 | -2.1 | 10 | 3322 |  |  |
| finish-opened-blood-off | -11 | -11.7 | -7.9 | -2.1 | 10 | 2977 |  |  |
| player-death | -11.1 | -11.7 | -9 | -1.5 | 10 | 3013 |  |  |
| kick-death | -11.1 | -11.7 | -8.7 | -2.2 | 10 | 2977 |  |  |
| double-death | -9.2 | -10.2 | -8 | -2.3 | 41 | 1475 |  |  |

## Payload
Shipped audio assets (src/assets/audio): 1046013 B raw · 996816 B gzip (baseline 577024 B raw · 544298 B gzip; Δ 452518 B gzip). Lane budget: ≤ 1.0 MB gzip.

Browser checks: not requested (use --check for repeated renders, AAC/Opus region decoding, format fallback and stacked ceiling).

## Phone check
Not part of this render — the owner listens on the handset (device, silent switch on/off) and records the note here.
