# Fight HUD evidence — PR #676 (web lane, 2026-09-24)

375×812, deviceScaleFactor 2, real GPU (--use-angle=metal), vite dev server on the PR head (fa4a3d38), harness clock.

## HUD stills (Veteran), re-taken on the final head
- `hud-375x812.png` — the rank row with the name ("Wanderer  Recruit I ▭▭▭▭▭ Legionary") under the meters, the white event line
  under it ("Counter right cut hit · −18"). No red banner.
- `hud-threat-375x812.png` — `data-threat=true`: the line is BLANK (''), background rgba(0,0,0,0), box 16,116 240×14 kept
  (min-height 1.4em, nothing below moves). No banner, no "Incoming strike", no idle hint.
Probe: rank row 16,93 240×14 · name 16,93 52×14 · event line 16,116 240×14 · scrollWidth 375 · page errors none.

## Witch strip: charge → guard break → line
Player holds an overhead guard (Q + ArrowUp). Events: AttackStarted(heavy_overhead) → Charging → Charged → GuardBroken{charged:true}.
- `witch-1-windup.png` — 100 ms after her Charged event. **The wind-up does not read as a charge without text**: the trident is
  up behind her, mostly hidden by the player's body and blade, and nothing distinguishes it from an ordinary heavy. The line
  shows "Guarding · release to recover stamina" (to be trimmed to "Guarding" in the strings-only follow-up).
- `witch-2-break.png` — the GuardBroken frame: "Guard broken: a charged heavy breaks guard." · WOUND on the stamina label.
- `witch-3-line.png` — 250 ms later, the line holds.
Sound during the charge: the `charge` sprite cue on the Charged event (src/audio/cues.ts:56, gain 0.1, room 0.4; synth fallback
131+196 Hz, 0.3 s in src/feedback.ts). It fires on either fighter's Charged.
