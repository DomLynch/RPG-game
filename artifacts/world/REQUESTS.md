# Requests to the lead (files this lane will not touch)

**Status 2026-09-18: #0–#3 are fulfilled and live (trunk `1afa0cb`). #4/#5 stay open until the owner's phone p95 reading.**

0. **DONE — shipped in PR #92 (`5c405f0`).** `scripts/browser-check.mjs` now captures `browser-parry`/`browser-riposte` as JPEG
   (`type:'jpeg',quality:85`); the gate went 3/3 green and has passed on every deploy since. Original note: the two in-window PNG
   screenshots stalled the page ~150 ms on the high-entropy sand frame, flipping the warden's deterministic kick.

1. **DONE — owner's call, shipped in PR #93.** The owner declined all three proposals and named the place **Origins Arena**
   (eyebrow *THE PROVING GROUND*; opponent *ARENA WARDEN*; brand *FRANKENDOM / ORIGINS*). The proposals above are recorded as declined.
2. **`floor` is on the seam now.** `buildArena` returns `{ group, floor, update, dispose }`: `floor` is the sand mesh, planar UVs
   `u = x / SAND_TILE, v = z / SAND_TILE` (SAND_TILE = 3 m, also in `floor.userData.tile`). The presentation lane's blood decals can target
   it; `scene.ts` needs no change. AGENTS.md's seam line could add `floor`.
3. **DONE — applied in PR #94 and iterated with the owner on live captures (#95, #97).** `scene.ts` now carries hemisphere 1.6
   `#c9cfc6` / `#4a4238` and the ash fog; the sky dome was re-baked to match. The owner art-directed further passes on top (greyer
   gravel sand, hand-laid mixed-stone ashlar at half-strength hues, the arched gate, pit debris).
4. **Phone loop.** Fight-ready is 8.254 MB gzip (+9.8 KB for the arena). The lane has no route onto the owner's iPhone; a preview build per
   PR (or a deploy of this PR) is needed for the p95 frame-time note. Desktop Chromium: arena-only 15 draw calls, 27.6k triangles rendered
   in the portrait lock; `update` 0.016 ms/frame; the sand textures generate in ~176 ms on the desktop at load (once).
5. **Startup cost note.** `buildArena` runs synchronously inside `createScene` before the rigs load; the 1024² sand albedo is ~150 ms of that
   on the desktop, likely 0.4–0.7 s on a phone. If the phone measurement shows it, the generator can drop to 512² (a one-line change,
   `sandAlbedo(512)`) or run in a worker; not done pre-emptively.

## Owner direction — 2026-09-18 (via lead, flames iteration on live trunk `2c5585a`)

6. **Brazier flames, next pass.** Owner, from the phone, on the just-deployed "fatter" flames (currently ~50% of pot width): wants
   **~70–80% of pot width**, **less pointy at the top**, and **more frayed/jagged — flame tongues separated and irregular, not one clean
   outline**. Tone stays gritty and realistic — explicitly **not** fake-cartoony. Baseline numbers on trunk: pot top diameter 0.76 m
   (`cylinder(0.38, 0.24, 0.32)`), flame quads 1.3 m wide, `flamePixels` body `w = 0.65 * …`, anchors at `wall.inner + 0.55` (pushed out
   for the 11.5 m camera clamp — re-check that reach when widening). Reference capture: `artifacts/world/flames-fatter/wide.png`;
   owner's screenshot in Downloads (`Frankendom Origins 9.png`) shows the target feel.
