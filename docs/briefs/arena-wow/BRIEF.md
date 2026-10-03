# Brief: one "wow" arena — 2026-10-03 (Dom → Strategy → Lead)

**Owner:** World, Pit & Audio (scene). Lead drives and judges progress; Web & UI only if the HUD/menus need to change around it. Strategy advises on request.

**Goal:** the **default arena** (the one every new player fights in first) goes from Dom's 6/10 to the look of `target-landscape.webp` / `target-portrait.webp` (phone portrait is the real target). One arena only; the others are untouched. Same fights, same camera, same gameplay.

**Why:** the first 30 minutes decide retention; this arena is on screen for most of them.

## Order of work (judge on Dom's phone after EACH step; stop when it's good enough)

1. **Light and atmosphere (biggest lever, code + settings).** Low golden-hour sun from one side, long hard shadows across the floor, warm key / cool shadow, soft bloom on fire, light shafts through haze, drifting dust + embers, a fog band at the arena rim. Bake what you can into lightmaps for phones.
2. **Layered painted backdrop.** Sky, clouds, cliffs, waterfalls, distant temples as 2–3 parallax layers (not one flat card); the fog band hides where 3D ends. Dom rejected the earlier single-image arenas (world.md 2026-10-03), so the bar is: it must read as depth, not a picture. Show Dom a still before wiring it in.
3. **Modular stone architecture.** Walls, stands, columns, arches, the eagle gate: kitbash from licensed Roman/classical modular sets (Quixel / Poly Haven / Sketchfab CC0 or paid), not AI-generated meshes. Record each source + licence in the PR.
4. **6–8 hero props via Meshy / Tripo / TRELLIS:** two spear statues, the seated god, eagle finials, braziers, shield + spear racks, banner poles. Instanced, LOD'd.
5. **Floor and motion.** Sand with rake rings and dried blood decals; banners with a cheap wind sway; brazier fire.

## Hard limits

- Phone first: 375 portrait at DPR 2 must hold the current frame budget on a mid phone; no new per-frame cost the perf rows reject. Desktop gets the same scene.
- Fighters stay readable: nothing bright behind them at fight height; the hero and opponent must pop against the floor (contrast check on stills).
- One owner touches the scene files; no other lane edits them while this runs.
- Token budget: Dom is at 90% of the weekly limit (resets Monday 10 PM). Until then: step 1 only, minimal LOC (lighting/fog/particles as settings, no new systems), one still to Dom. Steps 2–5 after the reset.

## Done means

Live on frankendom.com, Dom looks at it on his phone and says it's the wow he wanted. Before/after stills at 375 portrait and desktop, day only, in each PR.
