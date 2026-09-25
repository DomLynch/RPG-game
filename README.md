# SKILL, revised layout: #719 @ f94d6c00

Built from f94d6c00 (`vite build` + `vite preview`), 375x812, deviceScaleFactor 2, insets top 50 / bottom 34 substituted for env().
Supersedes the placement-A stills (7b8f18d9, where the cluster widened and the six moved 37 px left).

- `skill-sheet.png`: trunk today | SKILL ready | SKILL cooling.
- `skill-clearance.png`: ready frame in the phone mask, measured.
- `skill-cluster-crop.png`: ready vs cooling, the cluster region.

Measured in the page (getBoundingClientRect, CSS px):
- The six are **unmoved**: every rect in the SKILL frame equals the trunk-layout frame (STAB 253,562 · SLASH 188,603 · HEAVY 301,620 · KICK 253,668 · STEP 180,706 · GUARD 295,714).
- SKILL 58x58 at 301,486, in HEAVY's column (HEAVY x 301).
- Top HUD rows: `.combat-hud` 50–165; `#fight-rank` 128–142; `#combat-status` (event line) 151–165. **SKILL top 486 → 321 px clear** of the lowest HUD row. The only element above SKILL in its column is the menu button (header, bottom 94).
- SKILL right edge 359 → 16 px to the screen edge.
- Cooling: `aria-disabled=true`, opacity 0.5, same rect: the cluster's own dim, no ring, no countdown.
- Page errors: none.
