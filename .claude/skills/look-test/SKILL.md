---
name: look-test
description: The 5-minute way to let Dom judge a visual direction on his phone before anyone builds it for real. A style flag on the existing scene, published to the /preview/ folder with no release rows and no lock. Use for any art-direction question (silhouette, grade, rim, tint) before committing a lane to it. World or Web builds the flag, Deploy publishes the preview.
---

# Look test (learned 2026-09-27: silhouette closed in one afternoon)

Dom's Shadow-Fight silhouette idea: World added `?look=silhouette` to the existing scene, Deploy built with a base path and copied it into `current/preview/look/`, Dom opened it on his phone. Verdict in five minutes: "the surroundings don't match". Direction closed; no lane had built a single asset for it.

## Steps
1. Build the reference LITERALLY first. When Dom points at an image, match it (flat black cut-out), not your reading of it (rimmed near-black). The first brief here was wrong for two hours.
2. Add the look as a URL flag on the live scene; never touch the default path.
3. Deploy: `vite build --base /preview/<name>/`, copy into the served `current/preview/<name>/`. No release rows, no deploy lock, the live revision does not change.
4. Send Dom the link only, one line of what to look for, nothing about how it was made.
5. Record the verdict in the state doc with Dom's words, and close or open the direction the same hour.

## Rules
- A flag that survives becomes a real PR through the normal gate; the preview folder is never the ship path.
- Deploy may drop the preview folder with the next release.
- If the look needs the world to change too (a stylised cut-out in a photoreal arena), say so in the brief before the test: fighters alone cannot carry a style.

## Experiments are preview-only (Dom, 2026-10-07, after the Ash Wolf)
Dom asked for a wolf as a FAST experiment; it took an evening. It went through the full release path (record version bump, blade bake, DB migration + joint GO, a fold release, every gate), and the model came out half size (0.64 m against a ~1.3 m hit capsule) because it skipped the root-scale step every other foe gets and nobody measured it on screen.
- An experiment (a new creature, prop, mechanic look) is a preview only, by this skill's path. No RV bump, no migration, no fold release, no full stills/battery.
- Use a ready-made rigged and animated asset (CC0 or properly licensed) dropped in as-is. No custom generate-and-rig pipeline for a try-out.
- Before anyone says "done", measure it in the browser at the phone camera: on-screen height against the hit capsule, and its distance and placement from the hero. Put the numbers in the message.
- The real build (own rig, RV, migration, release) starts only when Dom says the experiment graduates into the game.
