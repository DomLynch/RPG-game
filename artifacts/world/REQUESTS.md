# Requests to the lead (files this lane will not touch)

0. **Browser gate: the two in-window screenshots should be JPEG (`scripts/browser-check.mjs`, lead's).** With this arena the gate passed
   3 of 6 runs (trunk 4 of 4). Root cause, measured: `page.screenshot()` pauses the page's frame source while Chromium reads back and
   PNG-encodes the frame; sand and gravel are high-entropy (the parry PNG is 1.07 MB vs 323 KB on trunk), so the encode takes ~150 ms —
   two stalls of 150 ms land between the riposte and the kick, `main.ts` clamps `dt` to 0.1 s so the simulation loses time, the walk-and-kick
   timing shifts, and the warden's deterministic decision flips to kicking first ("Kicked · −5", enemy 126). Not a runtime cost: frame
   pacing through the same window is median 16.7 ms, max 18 ms, zero stalls; the game's own readout is 60 fps · p95 17–18 ms (trunk 17).
   Bisected across anisotropy, normal map, sky, crowd, shadows, texture size (64² still stalls), mipmaps and canvas textures: only the
   textured sand matters, and only through the capture. With `{ type: 'jpeg', quality: 85 }` on `browser-parry` and `browser-riposte`
   the stalls vanish and the gate passed 3 of 3 (kick at 5.29–5.30 s after Draw sword, trunk 5.37). One-line change each; the PNGs are
   diagnostics, not evidence the gate asserts on. Until it lands, expect the pre-deploy gate to need a re-run on this arena.

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
