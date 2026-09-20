# Combat audio render — pitch-v1

Revision 49f415c (dirty tree) · seed 731 · 48000 Hz mono · audio path: sprite, formats tried in order ["opus","aac"] · rendered 2026-09-20T08:30:43.139Z through Chromium OfflineAudioContext via `node scripts/audio-preview.mjs --label pitch-v1`.

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

Exchange loudness: integrated -14.5 LUFS · phone band (> 300 Hz) -15.1 LUFS · momentary max -7.7 LUFS · peak -2.4 dBFS.

## Per-cue renders: `events/<name>.wav` (one synthetic event at 50 ms, 1.2 s render; fatal probes 4.5 s)
LUFS per ITU-R BS.1770-4 (short sounds under-read on integrated; compare rows across iterations, not against broadcast targets). Phone = the same measure after a 300 Hz high-pass; a rough proxy, not a specific handset response. Onset = first sample above −60 dBFS relative to the cue tick; length = audible span above −60 dBFS. "—" = silent: the module answers no cue for that event.

| cue | LUFS-I | phone LUFS | LUFS-M max | peak dBFS | onset ms | length ms | Δ LUFS-I vs trunk-63c57e2 | Δ phone vs trunk-63c57e2 |
|---|---|---|---|---|---|---|---|---|
| draw | -23.2 | -23.5 | -22.6 | -11.2 | 10 | 614 | -0.7 | -0.9 |
| swing-light | -29.7 | -30.3 | -29.5 | -15.1 | 12 | 316 | -0.9 | -1.2 |
| swing-heavy | -26.1 | -27.6 | -25.1 | -11.8 | 12 | 495 | -0.8 | -1.4 |
| swing-kick | -32.1 | -32.7 | -32 | -17.4 | 12 | 294 | -0.9 | -1.2 |
| swing-thrust | -29.7 | -30.3 | -29.5 | -15.1 | 12 | 316 | -0.9 | -1.2 |
| attack-active | — | — | — | — | — | 0 | — | — |
| charging | — | — | — | — | — | 0 | — | — |
| charged | -23.7 | -24.5 | -21.9 | -16.2 | 12 | 883 | -0.7 | -1.3 |
| hit-light | -24.2 | -26.5 | -20.6 | -8.8 | 10 | 621 | -0.5 | -1.5 |
| hit-heavy | -21 | -23.5 | -18.1 | -8.8 | 10 | 685 | -0.7 | -1.4 |
| hit-riposte | -21 | -23.5 | -18.1 | -8.8 | 10 | 685 | -0.7 | -1.4 |
| hit-kick | -25.1 | -27.1 | -22.6 | -8.9 | 10 | 548 | -0.7 | -1.6 |
| hit-thrust | -24.2 | -26.5 | -20.6 | -8.8 | 10 | 621 | -0.5 | -1.5 |
| blocked | -22.7 | -24.2 | -20.6 | -8.8 | 10 | 610 | +0.1 | -0.6 |
| blocked-perfect | -26.2 | -26.6 | -23.6 | -8.9 | 10 | 581 | -0.6 | -0.8 |
| parried | -20.4 | -20.8 | -17.8 | -8.8 | 10 | 736 | -0.5 | -0.7 |
| guard-broken | -21.2 | -24.3 | -17.8 | -8.9 | 10 | 758 | -0.6 | -1.7 |
| guard | — | — | — | — | — | 0 | — | — |
| parry-attempt | — | — | — | — | — | 0 | — | — |
| feint | — | — | — | — | — | 0 | — | — |
| roll | -35.7 | -36.4 | -34.3 | -16.9 | 11 | 255 | -0.8 | -1.1 |
| backstep | -40 | -40.5 | -40 | -19.7 | 10 | 118 | -0.2 | -0.4 |
| dodged | — | — | — | — | — | 0 | — | — |
| missed | — | — | — | — | — | 0 | — | — |
| staggered | — | — | — | — | — | 0 | — | — |
| posture-broken | — | — | — | — | — | 0 | — | — |
| exhausted | — | — | — | — | — | 0 | — | — |
| killed | -11.3 | -12.4 | -8.3 | -2.4 | 10 | 2983 | -0.4 | -0.8 |
| finish-plainDeath | -11.3 | -12.4 | -8.3 | -2.4 | 10 | 2983 | -0.4 | -0.8 |
| finish-plainDeath-blood-off | -10.8 | -11.9 | -8.4 | -2.5 | 10 | 3038 | +0.1 | -0.3 |
| finish-splitCrown | -11.3 | -12.8 | -8.2 | -2.4 | 10 | 2864 | -0.5 | -1.2 |
| finish-splitCrown-blood-off | -10.9 | -12.1 | -8.4 | -2.5 | 10 | 3038 | +0.1 | -0.4 |
| finish-decapitation | -11.2 | -12.5 | -8.2 | -2.4 | 10 | 2864 | -0.5 | -1.1 |
| finish-decapitation-blood-off | -10.9 | -12.1 | -8.4 | -2.5 | 10 | 3038 | +0.1 | -0.4 |
| finish-runThrough | -10.7 | -11.5 | -8.5 | -2.6 | 10 | 3041 | -0.3 | -0.6 |
| finish-runThrough-blood-off | -11.3 | -12.3 | -8.4 | -2.5 | 10 | 3038 | +0.3 | -0.1 |
| finish-quietOne | -12.8 | -15.1 | -9 | -2.4 | 10 | 3544 | -0.6 | -1.5 |
| finish-quietOne-blood-off | -12.6 | -14.8 | -9 | -2.5 | 10 | 3542 | -0.5 | -1.4 |
| finish-opened | -11.6 | -12.9 | -7.9 | -2.4 | 10 | 3315 | -0.6 | -1.1 |
| finish-opened-blood-off | -10.9 | -12.1 | -8.4 | -2.5 | 10 | 3038 | +0.1 | -0.4 |
| player-death | -11.4 | -12.5 | -9.5 | -2.5 | 10 | 2983 | -0.3 | -0.8 |
| kick-death | -10.9 | -12 | -9 | -2.7 | 10 | 3038 | +0.2 | -0.3 |
| double-death | -9.9 | -11.7 | -8.6 | -2.9 | 41 | 1475 | -0.7 | -1.5 |

## Payload
Shipped audio assets (src/assets/audio): 1031825 B raw · 984385 B gzip (baseline 1046013 B raw · 996816 B gzip; Δ -12431 B gzip). Lane budget: ≤ 1.0 MB gzip.

Browser checks: not requested (use --check for repeated renders, AAC/Opus region decoding, format fallback and stacked ceiling).

## Phone check
Not part of this render — the owner listens on the handset (device, silent switch on/off) and records the note here.
