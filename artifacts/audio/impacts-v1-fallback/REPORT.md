# Combat audio render — impacts-v1-fallback

Revision 16fd5fb (dirty tree) · seed 731 · 48000 Hz mono · audio path: synth fallback (--fallback) · rendered 2026-09-15T17:25:53.413Z through Chromium OfflineAudioContext via `node scripts/audio-preview.mjs --label impacts-v1-fallback`.

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

Exchange loudness: integrated -24.3 LUFS · momentary max -20.1 LUFS · peak -5.3 dBFS.

## Per-cue renders: `events/<name>.wav` (one synthetic event at 50 ms, 1.2 s render)
LUFS per ITU-R BS.1770-4 (short sounds under-read on integrated; compare rows across iterations, not against broadcast targets). Onset = first sample above −60 dBFS relative to the cue tick; length = audible span above −60 dBFS. "—" = silent: the module answers no cue for that event.

| cue | LUFS-I | LUFS-M max | peak dBFS | onset ms | length ms | Δ LUFS-I vs baseline |
|---|---|---|---|---|---|---|
| draw | -40.1 | -37.5 | -17.2 | 7 | 146 | +11.3 |
| swing-light | -40.1 | -37.5 | -17.2 | 7 | 146 | +11.3 |
| swing-heavy | -40.1 | -37.5 | -17.2 | 7 | 146 | +11.3 |
| swing-kick | -40.1 | -37.5 | -17.2 | 7 | 146 | +11.3 |
| attack-active | — | — | — | — | 0 | — |
| charging | — | — | — | — | 0 | — |
| charged | -25.3 | -23.5 | -6.9 | 6 | 299 | +14.1 |
| hit-light | -27 | -24.8 | -6.7 | 6 | 240 | +13.8 |
| hit-heavy | -27 | -24.8 | -6.7 | 6 | 240 | +13.8 |
| hit-riposte | -27 | -24.8 | -6.7 | 6 | 240 | +13.8 |
| hit-kick | -27 | -24.8 | -6.7 | 6 | 240 | +13.8 |
| blocked | -25.1 | -22.9 | -5.7 | 6 | 240 | +13.4 |
| blocked-perfect | -25.1 | -22.9 | -5.7 | 6 | 240 | +13.4 |
| parried | -24.9 | -22.8 | -5.6 | 6 | 240 | +13.4 |
| guard-broken | -27 | -24.8 | -6.7 | 6 | 240 | +13.8 |
| guard | — | — | — | — | 0 | — |
| parry-attempt | — | — | — | — | 0 | — |
| feint | — | — | — | — | 0 | — |
| roll | -40.1 | -37.5 | -17.2 | 7 | 146 | +11.3 |
| backstep | — | — | — | — | 0 | — |
| dodged | — | — | — | — | 0 | — |
| missed | — | — | — | — | 0 | — |
| staggered | — | — | — | — | 0 | — |
| exhausted | — | — | — | — | 0 | — |
| killed | -27 | -24.8 | -6.7 | 6 | 240 | +13.8 |

## Payload
Shipped audio assets (src/assets/audio): 395117 B raw · 360942 B gzip (baseline 0 B raw · 0 B gzip; Δ 360942 B gzip). Lane budget: ≤ 1.0 MB gzip.

## Phone check
Not part of this render — the owner listens on the handset (device, silent switch on/off) and records the note here.
