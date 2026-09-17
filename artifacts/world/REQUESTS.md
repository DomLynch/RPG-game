# Requests to the lead (files this lane will not touch)

1. **Rename the place** (`index.html` `.place`, `#opponent-name`, `data-mobile`; `feedback.ts` reverb comment; PROJECT_STATE). *Ashcourt / The
   Old Keep* is the retired keep. Three names, in preference order, with the eyebrow line each would carry:
   - **The Ashpit** — *at the edge of worlds*. The crowd's word for it: a pit of ash the dead civilisations are pulled into. Reads in one
     glance on a phone; the opponent becomes *THE ASHPIT WARDEN* (mobile: *Warden*, unchanged).
   - **Worldsedge** — *the pit at Worldsedge*. The setting line as a place; the arena is one pit of several at that edge (later arenas keep
     the name and change the dressing, as the spec allows).
   - **The Bonehollow** — *where the old world fights on*. The sunk hollow, bone in the sand; heavier, more Norse.
   The lane's evidence uses **The Ashpit** provisionally. Logged 2026-09-17.
2. **`floor` is on the seam now.** `buildArena` returns `{ group, floor, update, dispose }`: `floor` is the sand mesh, planar UVs
   `u = x / SAND_TILE, v = z / SAND_TILE` (SAND_TILE = 3 m, also in `floor.userData.tile`). The presentation lane's blood decals can target
   it; `scene.ts` needs no change. AGENTS.md's seam line could add `floor`.
3. **Lighting proposal (lead-owned values in `scene.ts`).** The set now carries its own contact shade and ash tints, but the hemisphere fill
   (2.5, `#d2e0e4` / `#575c4c`) still flattens verticals. Proposed, to be judged on captures with `node scripts/arena-preview.mjs`:
   hemisphere 1.6 with sky `#c9cfc6` and ground `#4a4238` (warm bounce off sand), sun `#ffe2b8` 4.2, fog colour `#a9a89c` (ash, warmer than
   today's grey-green `#9ca8a6`; the sky dome's horizon is painted to the fog colour and should be re-baked to match: one constant in
   `arena.ts` `skyPixels`), environment intensity 0.45. Not applied by this lane; the sky dome is built for today's fog colour.
4. **Phone loop.** Fight-ready is 8.254 MB gzip (+9.8 KB for the arena). The lane has no route onto the owner's iPhone; a preview build per
   PR (or a deploy of this PR) is needed for the p95 frame-time note. Desktop Chromium: arena-only 15 draw calls, 27.6k triangles rendered
   in the portrait lock; `update` 0.016 ms/frame; the sand textures generate in ~176 ms on the desktop at load (once).
5. **Startup cost note.** `buildArena` runs synchronously inside `createScene` before the rigs load; the 1024² sand albedo is ~150 ms of that
   on the desktop, likely 0.4–0.7 s on a phone. If the phone measurement shows it, the generator can drop to 512² (a one-line change,
   `sandAlbedo(512)`) or run in a worker; not done pre-emptively.
