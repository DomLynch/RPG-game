# Combat audio render — fatal-crowd

Revision f5129ea (dirty tree) · seed 731 · 48000 Hz mono · audio path: sprite, formats tried in order ["opus","aac"] · rendered 2026-09-19T09:50:16.695Z through Chromium OfflineAudioContext via `node scripts/audio-preview.mjs --label fatal-crowd`.

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

Exchange loudness: integrated -14.8 LUFS · phone band (> 300 Hz) -15.4 LUFS · momentary max -9.2 LUFS · peak -2.8 dBFS.

## Per-cue renders: `events/<name>.wav` (one synthetic event at 50 ms, 1.2 s render; fatal probes 4.5 s)
LUFS per ITU-R BS.1770-4 (short sounds under-read on integrated; compare rows across iterations, not against broadcast targets). Phone = the same measure after a 300 Hz high-pass: what a handset speaker can play. Onset = first sample above −60 dBFS relative to the cue tick; length = audible span above −60 dBFS. "—" = silent: the module answers no cue for that event.

| cue | LUFS-I | phone LUFS | LUFS-M max | peak dBFS | onset ms | length ms | Δ LUFS-I vs fatal-before | Δ phone vs fatal-before |
|---|---|---|---|---|---|---|---|---|
| draw | -16.5 | -16.6 | -15.8 | -5.6 | 6 | 693 | 0 | 0 |
| swing-light | -22.8 | -23.1 | -22.6 | -8.7 | 7 | 439 | 0 | 0 |
| swing-heavy | -19.3 | -20.2 | -18.3 | -6.1 | 7 | 611 | 0 | 0 |
| swing-kick | -25.3 | -25.5 | -25.1 | -11 | 7 | 368 | 0 | 0 |
| swing-thrust | -22.8 | -23.1 | -22.6 | -8.7 | 7 | 439 | 0 | 0 |
| attack-active | — | — | — | — | — | 0 | — | — |
| charging | — | — | — | — | — | 0 | — | — |
| charged | -17 | -17.2 | -15.1 | -9.8 | 8 | 927 | 0 | 0 |
| hit-light | -17.8 | -19.1 | -14.2 | -2.8 | 6 | 706 | 0 | 0 |
| hit-heavy | -14.4 | -16.2 | -11.6 | -2.8 | 6 | 811 | 0 | 0 |
| hit-riposte | -14.4 | -16.2 | -11.6 | -2.8 | 6 | 811 | 0 | 0 |
| hit-kick | -18.4 | -19.6 | -15.9 | -2.8 | 6 | 644 | 0 | 0 |
| hit-thrust | -17.8 | -19.1 | -14.2 | -2.8 | 6 | 706 | 0 | 0 |
| blocked | -16.9 | -17.7 | -14.7 | -2.8 | 6 | 719 | 0 | 0 |
| blocked-perfect | -19.7 | -19.8 | -17.1 | -2.8 | 6 | 670 | 0 | 0 |
| parried | -14 | -14.2 | -11.3 | -2.8 | 6 | 793 | 0 | 0 |
| guard-broken | -14.7 | -16.7 | -11.3 | -2.8 | 6 | 796 | 0 | 0 |
| guard | — | — | — | — | — | 0 | — | — |
| parry-attempt | — | — | — | — | — | 0 | — | — |
| feint | — | — | — | — | — | 0 | — | — |
| roll | -29 | -29.4 | -27.5 | -11.3 | 7 | 295 | 0 | 0 |
| backstep | -33.8 | -34.1 | -33.8 | -14.2 | 6 | 166 | 0 | 0 |
| dodged | — | — | — | — | — | 0 | — | — |
| missed | — | — | — | — | — | 0 | — | — |
| staggered | — | — | — | — | — | 0 | — | — |
| posture-broken | — | — | — | — | — | 0 | — | — |
| exhausted | — | — | — | — | — | 0 | — | — |
| killed | -13.8 | -14.7 | -10.1 | -2.8 | 6 | 2985 | -1.1 | -0.7 |
| finish-plainDeath | -13.8 | -14.7 | -10.1 | -2.8 | 6 | 2985 |  |  |
| finish-plainDeath-blood-off | -14 | -14.8 | -10.2 | -2.8 | 6 | 2943 |  |  |
| finish-splitCrown | -13.8 | -14.7 | -10.1 | -2.8 | 6 | 2835 |  |  |
| finish-splitCrown-blood-off | -14.1 | -14.9 | -10.2 | -2.8 | 6 | 2943 |  |  |
| finish-decapitation | -13.6 | -14.4 | -9.9 | -2.8 | 6 | 2835 |  |  |
| finish-decapitation-blood-off | -14.1 | -14.9 | -10.2 | -2.8 | 6 | 2943 |  |  |
| finish-runThrough | -13.7 | -14.2 | -10.3 | -2.8 | 6 | 3010 |  |  |
| finish-runThrough-blood-off | -14.9 | -15.6 | -10.2 | -2.8 | 6 | 2943 |  |  |
| player-death | -14.2 | -14.9 | -11.4 | -2.8 | 6 | 2985 |  |  |
| kick-death | -14.3 | -14.9 | -11.3 | -2.8 | 6 | 2943 |  |  |
| double-death | -12 | -13 | -10.8 | -2.8 | 37 | 1427 |  |  |

## Payload
Shipped audio assets (src/assets/audio): 1046013 B raw · 996816 B gzip (baseline 641783 B raw · 605004 B gzip; Δ 391812 B gzip). Lane budget: ≤ 1.0 MB gzip.

Browser checks: {"maxRepeatDelta":1,"codecs":{"aac":{"seconds":36.67197916666667,"regions":73},"opus":{"seconds":36.65139583333333,"regions":73},"fallback":true},"stackedPeakDbfs":-2.8492865798551277,"fatalCancellation":true,"fatalPeakDbfs":-2.8492865798551277}.

## Phone check
Not part of this render — the owner listens on the handset (device, silent switch on/off) and records the note here.
