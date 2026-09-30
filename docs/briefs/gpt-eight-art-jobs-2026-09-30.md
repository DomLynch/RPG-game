# Frankendom — eight art jobs for GPT (Strategy, 2026-09-30, Dom pastes this)

Same shape as the four-jobs pack you delivered today (`frankendom-art-four-jobs-20260930`): that pack was
accepted, so keep its layout, receipts, validation and README style. Deliver as one folder per job under one
dated pack, with a `README.md`, `manifest.json`, per-file receipts and an offline audit. Execute in numbered
order; ship each job the moment it is done, do not hold finished jobs for later ones.

## Ground rules for every job

- The game is Frankendom (frankendom.com), a phone-first sword duel. Everything is judged at 375 × 812 CSS px,
  portrait, on a real phone, over a stone arena in two lights: pale sand (day) and the Night Pit (red-brown,
  torch lit). Test every raster against captures of both; put the comparison in `review/`.
- Style: painted, worn, real. Irregular edges, varied thickness and opacity, nothing evenly repeated, nothing
  glossy, no glow, no lens flare, no saturated neon. The owner's words on a code-drawn effect today: "uniform,
  fake, low quality Korean/Chinese MMO". Your blood strips were accepted because they look painted. Match that.
- Rasters: PNG RGBA source at the size stated, plus a webp at the shipped size stated. Transparent background
  unless stated. No premultiplied halos. Give exact bytes in the receipt.
- Meshes: GLB, metre scale, Y up, floor-centred origin, named meshes, one PBR material set per piece with
  1024 source maps (albedo, normal, roughness, metallic). Khronos validator zero errors and zero warnings.
  Triangle caps are per job below. Front, side and rear proof renders of the exported GLB, not the Blender scene.
- Budgets are gzipped bytes. Our game compresses textures to 512 and packs on intake, so ship 1024 sources and
  state the triangle and byte numbers; we own the final compression.
- Receipts: prompts, seeds where exposed, hashes, validation JSON, cloud cost estimate. No runtime code, no PR,
  no deployment; integration is ours (World, Pit, Web, Finishers, Nightborn, Weapons).
- Do not invent lore, names or creatures. Character names and ranks come from the files we give you or the
  live game only.

## Job 0 — Fix four pieces from the four-jobs pack (do this first, same day)

Placed in the Pit at the fight camera, four of the six dressing pieces fall below the bar; the whetstone wheel, the water bucket and
the gate machinery are in. Re-do these four to the same specs (≤ 1,600 triangles, 1024 maps, floor-centred):

- **Coal brazier**: reads as a plain bowl. It needs an iron tripod or legs, a visible coal bed with a few
  embers painted into the albedo and emissive mask (we light it), soot on the rim.
- **Straw bedding**: reads as a flat slab. It needs loose straw silhouette at the edges (alpha-cut cards are
  fine), a hollow where a body lay, a rag or two.
- **Chained manacles**: a thin chain from a small wall plate, too fine to read at the fight camera. Thicker
  chain links, a larger iron wall plate with bolts, two cuffs hanging at different heights.
- **Broken weapons**: does not read as weapons. Each piece must be a recognisable sword blade, spear haft or
  axe head at phone size: longer, thinner, fewer, with one clear broken edge each and rust.

## Job 1 — Shields (six GLBs)

Two characters carry shields. Deliver six shields, one per rank band, each a separate GLB with its own texture
set, plus a 2 × 3 contact sheet.

| # | Carrier | Ranks | Shape | Max size | Look |
|---|---|---|---|---|---|
| 1 | Shieldmaiden | 1–3 | round | Ø 0.60 m | planked lime wood, rawhide rim, iron boss, worn paint |
| 2 | Shieldmaiden | 4–7 | round | Ø 0.70 m | tighter planks, riveted iron rim, painted device half worn away |
| 3 | Shieldmaiden | 8–10 | kite | 0.75 × 0.60 m | iron-bound kite, dark stained wood, battered boss line |
| 4 | Centurion | 2–3 | round | Ø 0.60 m | legion round, red-brown paint, brass boss, scarred |
| 5 | Centurion | 4–7 | round | Ø 0.70 m | legion round, reinforced rim, faded wing device |
| 6 | Centurion | 8–10 | tower | 0.88 m tall × 0.55 m | curved scutum, red with worn gold border, dented brass spine |

- No Recruit shield for the Centurion (rank 1 fights without one).
- ≤ 6,000 triangles per shield, ≤ 0.9 MB gzipped per shield including textures at 1024.
- Painted in the texture, no tint expected from the game, no emissive.
- Origin at the centre of the boss on the back face, grip axis along +Y, front face toward −Z, so we can bolt
  it to the left forearm without re-pivoting.
- Include a `fit.json` per shield: bounding box in metres, grip point, rim thickness.

## Job 2 — Painted textures for the special moves (sprite sources)

We are building 50 special moves as presentation-only effects. Code-drawn strokes were rejected; we want painted
sprite sources the lanes animate. Deliver three sets now, for the Nightborn's three boss moves, each set as
PNG RGBA sources plus a `review/` composite over both arena captures.

1. **Red Wind** (Set, rank 8): the arena's own sand and grit spirals up from a ring at the target's feet
   through a column around the body. Deliver 8 wind-streak sprites (each 512 × 128, horizontal, torn ends,
   varied length, width and opacity, grey with a darker grey core, semi-transparent, no red, no glow) and
   4 ring-dust sprites (512 × 512, radial, clumped not even). The fighter must stay readable through the column.
2. **Hades' Shadow** (Hades, rank 9): a black cloud gathers above the target's head and drops over it. No claw,
   no hands, no faces. Deliver 6 cloud-body sprites (1024 × 1024, soft irregular edges, black to deep
   charcoal, semi-transparent, layered so three overlapped read as one mass) and 4 wisp sprites (512 × 256).
3. **Nyx Nightfall** (Nyx, rank 10): the arena light drains and a veil of darkness sweeps through the target.
   Deliver 4 veil sprites (2048 × 512, horizontal, one soft edge and one torn edge, black with faint violet-grey
   variation, no stars, no sparkles) and 2 fringe sprites (1024 × 256) for the veil's leading edge.

Rules: one clean idea per move, atmosphere only, no added objects, no symbols, no runes, no light rays.
Every sprite set ships with a 4-frame contact sheet showing suggested layering at wind-up, peak and fade over
the sand capture and the Night Pit capture. Budget: ≤ 250 KB webp per move once we compress; state what
you expect at 512 and 1024.

## Job 3 — The arena seen through the Pit gate (one painted still)

After a win in the Pit the camera turns to the arena gate, which opens over five seconds. Behind the bars the
player must see the next fight's arena: a light shaft, dust in the air, the far wall and floor, a hint of the
crowd's shadow. It is a still on a plane, not a live scene, so it must look right with slight parallax and
shimmer applied by us.

- Deliver 5 stills, one per arena look we have in play: pale sand day, pale sand dusk, Night Pit, rain, and a
  neutral overcast. Each 1024 × 1024 PNG source and 512 × 512 webp ≤ 90 KB.
- Camera: eye height 1.6 m, looking through an arch 2.4 m wide, arena floor 8 m beyond the gate, so the
  perspective matches a standing player at the bars.
- Painted, not a 3D render; readable at 375 wide through the gate bars with a torch-lit foreground.
- Inputs: `pit/` captures and the gate GLB from your own four-jobs pack; the arena captures in `inputs/`.

## Job 4 — Floor decals (painted, tileable set)

Painted decals we scatter on the arena and Pit floors so the ground looks fought on.

- 6 blood pools (512 × 512, RGBA, dark dried and fresh variants, irregular, no symmetry).
- 4 scorch marks (512 × 512, for Witch-fire and the brazier).
- 6 sand scuffs and drag marks (1024 × 256, for footwork and bodies dragged out).
- 4 cracked flagstone overlays (1024 × 1024, alpha-masked cracks only, no fill).
- 3 rust and damp stains for the Pit walls (1024 × 512).
- All ≤ 40 KB webp each at shipped size; sources at 2× as PNG. Show 3 of each over both arena captures.

## Job 5 — Gear sheet final pieces (waits on the owner's pick)

The owner will pick one of your three concepts: Kit belt, Open pack or Fitting rail. When he names it, deliver
the final UI pieces for that concept only:

- Slot tiles at rest, hovered and filled, 3 states × 2 sizes (128 and 192 px square), painted leather or iron
  in the concept's style, RGBA.
- Frame or belt background pieces cut as 9-slice PNGs with the slice guides stated in the receipt.
- The crest tile (shown only when a crest is worn), 192 × 192.
- The Swap and Store buttons in rest and pressed, 88 × 44 minimum tap size at 1× (deliver at 2× and 3×).
- Typography stays ours (Cinzel and Cormorant are already in the game); do not paint text into pieces.
- Show the assembled sheet over a sand capture and a Night Pit capture at 375 × 812, five stored pieces filled.

## Job 6 — Icons: special moves and loot

- 11 special-move icons for the skill button, one per move currently in the game: Anvil Stomp, Butcher's
  (name as in the loot file), Dirty Jab, Estoc Lunge, Iron Rush, Miasma, Pommel Strike, Reaping Blow,
  Scutum Shove, Shield-Hewer, Witch-fire. Painted monochrome bone-white on transparent, one silhouette each,
  readable at 44 px, delivered at 256 × 256 PNG and 128 webp ≤ 12 KB.
- Loot icons: we will attach the current item list (name, slot, tier). Same style, plus a 2-px worn edge so
  they sit on the tiles from Job 5. Until the list lands, deliver the 11 move icons and a style sheet of 6
  sample loot icons (helm, cuirass, greaves, gauntlets, sword, shield) so we can approve the style first.
- Contact sheet of all icons on both arena captures at 44 px and 88 px.

## Job 7 — Legend portraits, consistency pass (optional, low priority)

We already have 100 legend portraits live (public/legends/<character>-<rank>.webp) made from your earlier
sheets. Job 7 is a review, not a redo: look at the 100, flag every portrait that breaks framing, light
direction, head size or palette against its own character sheet, and re-paint only the flagged ones at the
same size and framing as the neighbours. Deliver a flagged list with a one-line reason each, before painting
anything. Also deliver 10 skull-wall variants (one per character, 256 × 256 RGBA, painted skull with that
character's one identifying element: horns, helm rim, tusks and so on) for the defeat record wall.

## Job 8 — More dressing: Pit set two and arena wall pieces

Same rules as your Pit dressing job (≤ 1,600 triangles per small piece, ≤ 3,200 per large, 1024 maps,
floor-centred origins, Khronos clean).

- Pit set two, six pieces: hanging cage, rack of practice blades, sand barrel with scoop, chain pile,
  stool with a whetstone, bloodied cloth bundle.
- Arena wall pieces, five: torch sconce with bracket (no flame mesh, we add the light), faction banner on
  a pole (painted cloth, two colourways as textures), iron ring set in stone, wall-mounted skull rail (empty),
  broken spear in the wall.
- Total pack ≤ 2.5 MB gzipped as shipped; state per-piece bytes. In-room proof renders over the Pit capture.

## What comes back to us

One pack, jobs in folders `01-shields/` … `08-dressing-two/`, each with `README.md`, receipts, `review/`
composites over both captures, and validation JSON. Tell us what you could not do and why, per job, instead
of stretching a job to look complete. Nothing you deliver goes live until the owner has seen it in the room
on a phone; say that in your README as you did today.
