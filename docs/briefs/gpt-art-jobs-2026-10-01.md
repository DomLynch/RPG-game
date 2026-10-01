# GPT brief — four art jobs (2026-10-01)

Paste everything below the line to GPT. Special moves are NOT GPT's: our Claude lanes build those.

---

Frankendom: four art jobs, in this order. Special-move effects are not yours this time; leave them out.

## COMPUTE RULE (owner, read first)

- Use ONLY the Hugging Face CPU box: cpu-upgrade (8 vCPU, 32 GB RAM, about $0.03 an hour).
  The Blender Space frankendom-blender is that box. It is paused: resume it when you start, pause it when you finish.
- NO GPU of any kind. No ZeroGPU, no T4, L4, A10G or A100, no GPU Jobs, no inference endpoints.
  No TRELLIS, FLUX, Kontext or any other GPU model Space. The last pack overspent on ZeroGPU; this one must not.
- 3D pieces are modelled by hand in Blender on that CPU box. 2D art is painted, not generated on a GPU.
- Hard cap: stop and report if the spend reaches $1.00. Write the hours and dollars used per job in the receipt.

## Job 1 — Gear screen pieces (the "Fitting rail" concept the owner picked, your 03)

Paint the UI pieces for the gear screen. The mannequin is the live 3D character; text is ours.
CHANGE from the earlier list: the owner KEPT the bottom bar. It is the app nav "The Pit | Gear & pack | Arena",
pinned to the foot of the screen, Gear & pack active with a gold underline, exactly as in your 03 concept.
Stats and Settings are header links at the top right. There is no Options tab.

Paint, as transparent PNG at @3x for a 375-wide phone, 9-slice where it is a frame:
- A. Sheet ground: dark stone/iron, tileable 256 × 256, a 1 px gold hairline and a 2 px section rule.
  Palette: #0a0908 / #12100d, gold #c8a45e, pale gold #e7cf93.
- B. Stage vignette 375 × 464 over the 3D view: soft dark edges, warm light behind the figure, a floor shadow. Centre clear.
- C. Rail tile frame 68 × 48: rest, selected (gold left bar), pressed, empty (dim, dashed), previewing (pale gold ring).
- D. Empty-slot glyphs 32 × 32, two tones: Head, Crest, Chest, Arms, Hands, Legs, Feet, Main hand, Off hand.
- E. Stored row frame 343 × 64: with a piece (rest, pressed), empty, locked (padlock plate). Chevron 20 × 20.
- F. Buttons 48 tall: "Wear this" gold (rest, pressed, disabled), "Cancel" outline, "Store" quiet (rest, pressed, disabled).
- G. Fitting panel ground 375 × 150.
- H. Icons 24 × 24: edit pencil, close X, padlock, a "worn" dot.
- I. Rank chip 40 × 16, ten plain plates (no numerals; we set the text).
- J. NEW: the bottom bar. A 375 × 64 bar ground with safe-area padding below it, three tab states
  (rest, active with the gold underline, dimmed for The Pit when its gate is closed), 48 tall tap targets.
Do not paint the mannequin, armour on it, or any text. Every tap target at least 44 × 44.
The whole screen's art under 400 KB gzipped. Show the assembled screen over a sand and a Night Pit capture at 375 × 812.

## Job 2 — Fix four Pit pieces (from your four-jobs pack)

The wheel, bucket and gate machinery are live in the game. These four fell below the bar at the fight camera.
Redo them, ≤ 1,600 triangles each, 1024 maps, floor-centred:
- Coal brazier: iron legs or tripod, a visible coal bed with painted embers and an emissive mask, soot on the rim.
- Straw bedding: loose straw at the edges (alpha cards fine), a hollow where a body lay, a rag or two.
- Chained manacles: thicker links, a larger bolted iron wall plate, two cuffs hanging at different heights.
- Broken weapons: a recognisable sword blade, spear haft and axe head at phone size, one clear break each, rust.
In-room proof renders over the Pit capture at the fight camera.

## Job 3 — Icons for the special-move button

Painted monochrome bone-white on transparent, one clear silhouette each, readable at 44 px.
256 × 256 PNG and 128 × 128 WebP ≤ 12 KB each. The six boss moves first:
Red Wind, Hades' Shadow, Nyx Nightfall (the Nightborn's), Shield Quake, The Charge, Blood Tithe (the Centurion's).
Then the eleven class moves: Anvil Stomp, Butcher's (exact name as in the loot file), Dirty Jab, Estoc Lunge, Iron Rush, Miasma,
Pommel Strike, Reaping Blow, Scutum Shove, Shield-Hewer, Witch-fire.

## Job 4 — More Pit dressing, set two (only after jobs 1–3)

Six pieces, same rules as Job 2: hanging cage, rack of practice blades, sand barrel with scoop, chain pile,
stool with a whetstone, bloodied cloth bundle. Pack ≤ 2.5 MB gzipped; state bytes per piece. In-room proof renders.

## The owner's taste

Grounded and worn, painted, irregular. No glow, no neon, no plastic look, no clean "mobile game" gloss.

## What comes back

Folder: `~/Desktop/Business/artifacts/frankendom-art-jobs-20261001/` with a README per job.
Receipts: compute and cost per job, file hashes, triangle counts and bytes. No runtime code, no PR, no deployment;
our lanes integrate (Web for Job 1, World and Pit for Jobs 2 and 4, Combat for Job 3).
