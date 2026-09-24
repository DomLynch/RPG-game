# SKILL button — BUILT, web/skill-button @ 56544225, 375x812 (iPhone 12/13 mini insets)

Local build of the branch, the real pit and HUD, drawn and armed. Headless Chromium reports safe-area insets as 0, so the built CSS was
served with a 375x812 iPhone's portrait insets substituted for env() (top 50, bottom 34, sides 0). The frames are drawn in the 44 pt
screen corners, with the insets hatched.

| file | state |
|---|---|
| skill-ready.png | SKILL READY: same glass, ring, face and case as the six |
| skill-cooling.png | SKILL COOLING: the cluster's own dim (aria-disabled, opacity .5), same footprint, no ring, no countdown |
| skill-trunk-layout.png | trunk's six (184 px cluster), same emulation, for the shift |
| skill-sheet.png | the three in phone frames, labelled |
| skill-clearance.png | READY with the measurements drawn on it |
| skill-cluster-crop.png | the cluster, ready vs cooling |

**Diameters (px):** SKILL 58 (= HEAVY 58) · STAB 56 · SLASH 60 · KICK 44 · STEP 56 · GUARD 64. The six are unchanged.
**Gaps, rim to rim (px):** SKILL–STAB **32.0**, SKILL–HEAVY **32.0**. The six's nearest-neighbour gaps: HEAVY–KICK 17.6, STAB–SLASH 18.3,
GUARD–KICK 22.4, STEP–KICK 30.2 (widest), so SKILL–STAB beats every one. STAB–HEAVY is 19.7.
**Centre to centre (px):** SKILL–STAB 89.0, SKILL–HEAVY 90.0 (STAB–HEAVY 76.7).
**Shift:** the cluster widens 184 → 221 px and is right-anchored, so all six move **37 px left**. Vertical positions are unchanged.
**Clearance on screen:** SKILL x 301–359, y 538–596: 16 px to the right edge (the 16 px gutter; right inset 0), 172 px above the
bottom corner curve. GUARD's bottom edge sits on the 34 px home-bar inset, as on trunk. STEP keeps 19 px from the joystick (trunk 56).
Cooling was set through the built contract (data-cooling + aria-disabled), since no skill is wired in the sim yet.
