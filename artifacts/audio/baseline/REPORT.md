# Combat audio render — baseline

Revision 225106f (dirty tree) · seed 731 · 48000 Hz mono · rendered 2026-09-15T15:45:39.180Z through Chromium OfflineAudioContext via `node scripts/audio-preview.mjs --label baseline`.

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

Exchange loudness: integrated -37.7 LUFS · momentary max -33.8 LUFS · peak -16.7 dBFS.

## Per-cue renders: `events/<name>.wav` (one synthetic event at 50 ms, 1.2 s render)
LUFS per ITU-R BS.1770-4 (short sounds under-read on integrated; compare rows across iterations, not against broadcast targets). Onset = first sample above −60 dBFS relative to the cue tick; length = audible span above −60 dBFS. "—" = silent: the module answers no cue for that event.

| cue | LUFS-I | LUFS-M max | peak dBFS | onset ms | length ms |
|---|---|---|---|---|---|
| draw | -51.4 | -51.4 | -30.1 | 4 | 97 |
| swing-light | -51.4 | -51.4 | -30.1 | 4 | 97 |
| swing-heavy | -51.4 | -51.4 | -30.1 | 4 | 97 |
| swing-kick | -51.4 | -51.4 | -30.1 | 4 | 97 |
| attack-active | — | — | — | — | 0 |
| charging | — | — | — | — | 0 |
| charged | -39.4 | -37 | -19.4 | 0 | 261 |
| hit-light | -40.8 | -38.2 | -18.5 | 0 | 206 |
| hit-heavy | -40.8 | -38.2 | -18.5 | 0 | 206 |
| hit-riposte | -40.8 | -38.2 | -18.5 | 0 | 206 |
| hit-kick | -40.8 | -38.2 | -18.5 | 0 | 206 |
| blocked | -38.5 | -35.9 | -17 | 0 | 221 |
| blocked-perfect | -38.5 | -35.9 | -17 | 0 | 221 |
| parried | -38.3 | -35.8 | -16.7 | 0 | 216 |
| guard-broken | -40.8 | -38.2 | -18.5 | 0 | 206 |
| guard | — | — | — | — | 0 |
| parry-attempt | — | — | — | — | 0 |
| feint | — | — | — | — | 0 |
| roll | -51.4 | -51.4 | -30.1 | 4 | 97 |
| backstep | — | — | — | — | 0 |
| dodged | — | — | — | — | 0 |
| missed | — | — | — | — | 0 |
| staggered | — | — | — | — | 0 |
| exhausted | — | — | — | — | 0 |
| killed | -40.8 | -38.2 | -18.5 | 0 | 206 |

## Payload
Shipped audio assets (src/assets/audio): 0 B raw · 0 B gzip. Lane budget: ≤ 1.0 MB gzip.

## Phone check
Not part of this render — the owner listens on the handset (device, silent switch on/off) and records the note here.
