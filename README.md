# Fight HUD evidence — PR #676 (web lane, 2026-09-24)

375×812, deviceScaleFactor 2, real GPU (--use-angle=metal), vite dev server on the PR's tree, Veteran, harness clock.

- `hud-375x812.png` — THE still: the permanent rank row with the name ("Wanderer  Recruit I ▭▭▭▭▭ Legionary") under the meters,
  and the small white event line under it ("Counter right cut hit · −18"). No red banner.
- `hud-threat-375x812.png` — a frame with the Veteran's threat flag up (`data-threat=true`): no banner, no "Incoming strike" text,
  the line reads the standing guard hint; background rgba(0,0,0,0).

Probe: rank row 16,93 240×14 · name 16,93 52×14 · event line 16,116 240×14 · scrollWidth 375 · page errors none.
