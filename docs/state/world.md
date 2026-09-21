# Visuals & world — project state

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Arena props, startup worker, crowd cull, sky environment, sparks v2 — presentation lane, 2026-09-20 (branch presentation/arena-props)
Five authored props generated on the owner's Hugging Face Pro account (TRELLIS.2 from prompted reference images) and dieted in Blender
(3–5k tris, 512–768² WebP, metallic-roughness → factors): a portcullis that replaces the procedural gate bars once loaded, a weapon rack
on the walkway, a fallen shield, a column drum and a bone pile in the sand band — 672 KB gzip after build packing, +7 MB GPU desktop /
+1.75 MB phone (maps capped 512²/256²), placement held to the exclusion volume by `tests/arena-props.test.ts` from a size table.
Startup: the arena's heavy maps generate in a Web Worker behind flat stand-ins (`buildArena` on the main thread 1,067 → 204 ms) and
`scene.ts` `ready` waits for `arena.ready` so uploads land in the loading screen (p95 18–19 ms in every window; load at trunk parity).
Crowd: spectators outside the camera frustum collapse per frame (~33 of 291 stand at the portrait lock). Sun shadow frustum ±12 m.
The environment map is the arena's own sky once it has landed (warm sand below the horizon), intensity 1.0. Banners stop casting shadows
(the slab on the fighting sand); the gate light is a wider, fainter patch. Sparks v2 on the owner's live feedback: struck off the visible
blade, 3–7, staggered, thin, pale straw → ember, tone-mapped. Evidence `artifacts/presentation/{REPORT-arena-props.md,props-v1,sparks-v2}`,
`artifacts/world/{base,props}-{full,phone}`. Not done: baked AO (needs an unwrapped lightmap pipeline), KTX2 textures (needs the
basis_universal encoder — owner's OK), the phone AA decision and one-pass post (after KTX2). check-budget counts prop GLBs as opponent
candidates: true per-fight ≈ 10.4 of 12 MB.

## Contact grit — presentation lane, 2026-09-20 (branch presentation/impact-grit)
Owner-directed small realistic contact feedback, four steps behind the existing event stream, no sim change: (1) metal sparks
(`src/clash-sparks.ts`) off the defender's guard on a blade-to-blade block or parry — steel on steel only (a shaft, wood, a kick, a landed
blow: none), 4–8 hot streaks under gravity, one bounce off the sand, out ≤ 0.45 s; (2) guard shudder (`src/camera-kick.ts`): the trunk
camera kick was applied before `lookAt` and along the view axis, so it measured 0 px; it is now a world offset applied after the look-at
for the draw only — a heavy drops the camera 6 cm and holds two frames (11 px at phone framing), a heavy block 2.8 cm (6 px), a parry
flicks 2 cm sideways (4 px), all settled within 13 frames; a heavy caught on the guard deepens the body recoil ×1.5; (3) sand puff off
the defender's rear foot on a heavy that lands or is caught (`foot-dust.ts` `puff`); (4) kill dip: exposure −6 % for two frames, eased
back over two, kill only (−2.4 % crop brightness). Harness `scripts/impact-preview.mjs` (scripted block/parry/heavy/kill through the real
`createScene`, hit-stop reproduced) with before/after strips and camera traces in `artifacts/presentation/`; 4 new test files (7 tests).
Gate 314/314 + browser gate on cbec4cd. Phone amplitudes unverified on device; the shove table is one place to halve.

## Mixed, populated crowd and stronger foot sand — world, 2026-09-19
Colour follow-up: owner approved dust size, motion and one-second life but found it grey against the sand. Live phone step capture confirmed the mismatch; a muted golden-tan tint (`#b99a68`, previously `#c9b493`) now sits closer to the lit ground. Only the particle material colour changes. Close/portrait render review and existing lifecycle test pass; release receipts: artifacts/world/warm-dust-notes.

Owner accepted the softened colours and mixed crowd, then requested busy seating around all 360 degrees including the gate, and more visible one-second foot sand. Six subdued garment dyes (dusty maroon/charcoal navy/earth tones) and five body families are assigned independently using nearby-seat diversity before GPU batching. On 291 occupied seats, only 27/844 nearby pairs repeat a body and 10/844 repeat a dye. Every 30-degree sector has at least 24 spectators and 8 on the lower two tiers; rubble, arch lip and flames retain clearance. Tread height follows tessellated stone; actual support raycasts and full-vertex play/camera clearance checks pass. Arena 114,440 triangles / 120k, unchanged meshes and 11.01 MB textures. Physical phone timing remains unmeasured.

Foot sand uses a 48-point pool, five larger denser particles per plant, low lateral curls with drag and a 1-second fade. Idle, combat-pose suppression, teleport rejection, hit-stop and disposal remain intact. Lifecycle check verifies the longer tail and lower-leg height. Existing world preview now captures 12 sectors plus normal portrait dust on/off. Focused arena/dust 11/11, lint and typecheck pass; all 12 sector renders and stronger dust at portrait combat distance reviewed. Full contract, CI and live receipts are tracked under PR #156 and artifacts/world/mixed-crowd-notes. Integrated weapons f7a1e99 and its polearm browser gate; no fighter, combat, audio, camera or lighting edits from world.

## Crowd variety and foot sand — world, 2026-09-19
Owner requested subdued ruby/navy/brown/grey and other muted clothing, stronger sizes, lower-tier audience and restrained grounded foot sand. Six garment-only dyes preserve skin; separate trousers, two stances per five roster families, independent height/build variation. 219 spectators redistribute across five tiers with gate/flame/collapse clearance. Initial render rejected bright clothes and matching trousers; refined captures in artifacts/world/crowd-dust-final. Arena 9/9 and dust lifecycle check pass; full contract receipts in artifacts/world/crowd-variety-notes. Arena 26 measured draws,92,126 triangles,11.01MB textures; physical phone p95 remains owner-only/unmeasured.

Presentation seam coordinated with lead: cached animated feet feed a 24-point pool, one transient draw, 0.55s fade, no idle or combat-pose emission. Real walking-clip preview verifies emission and expiry; hit-stop, teleport and disposal verified separately. No audio/combat/fighter asset/global light edits. All eight local contract commands passed, including npm run quality (260/260 tests), both finishers, roster, audio, estoc, counter and world render checks. Delivery tracked in PR #151; exact merge/deployment and live receipts are kept in artifacts/world/crowd-variety-notes.

## World polish — 2026-09-19 (world/crowd-grounding-light; local, not yet shipped)
Owner approved four sequential passes: roster spectators, settled debris, softer gate light, selective masonry staining.
Step 1: replace the narrow crossed cards with five opaque instanced body silhouettes: human, goblin, Pitborn, executioner, Nightborn. No fighter assets, animation clips or gameplay changed. Irregular gaps and slight depth/yaw variation; existing bounded crowd reactions retained. First judge rejected boxy torsos; refined rounded bodies, darker clothes, hair and robe silhouettes. Arena tests 8/8; first full quality 246/246 + browser gate passed; refined geometry typechecks and arena tests pass. Fixed-camera captures: artifacts/world/polish-1-crowd-refined. Cost: 88,798 triangles / 120k, 21 measured arena draws (+1), 11.01 MB textures (-0.35 MB), floor luminance 0.105 unchanged. Physical phone performance remains unmeasured.

Step 2: settle curved shields, helmet and snapped shaft into the sand; small rubble and pottery gather around three existing column drums. Preserve all five separated in-ring gear sites. Dust uses existing iron vertex colours only, no wear decals. Arena 8/8, lint/typecheck and fixed-camera debris + duel review pass; play/clamp bounds hold. Captures: artifacts/world/polish-2-debris.

Step 3: soften the existing gate shaft through a broader feathered falloff, low-contrast bar interruption and lower peak; warm ground pool and geometry unchanged. Arena 8/8, fixed gate/duel captures reviewed (artifacts/world/polish-3-gate); zero texture/draw/triangle growth.

Step 4: localized dirt at the wall foot and tapering soot above the braziers, baked into existing vertex colours; 552 extra wall triangles keep stains near the ground. Stone albedo/normal pixels unchanged. Arena 8/8 and fixed-camera review pass (artifacts/world/polish-4-masonry). Final local npm run quality: 246/246 + real browser + dependency audit + budget PASS. World preview now runs as a completion command: node scripts/arena-preview.mjs --label quality-world (passed). Final arena: 89,482 triangles, 21 measured draws, 11.01 MB textures, floor luminance 0.105. Two-pass self-review checked clearance/reaction/disposal and fixed-camera materials/readability; no audio, combat, fighter assets, global lighting or camera edits. Integrated trunk 32f783e (roster and Split Crown) preserving both completion commands. Integrated npm run quality: 250/250 plus real browser, audit and budget PASS; all three completion commands (roster routes/migration, Split Crown modes/rematch, world captures) PASS. CodeGraph refreshed in the isolated worktree. PR #145 initial CI passed; integrated newly merged estoc d3114a9 and preserved its completion gate. Revalidation/release receipts pending in artifacts/world/polish-notes.
The subsequent estoc integration passed full quality and all four completion commands. Integrated counter release 3bfb0eb, preserving its browser gate; counter release verified by its lane and window released. Integrated lead 0c7b03f, preserving its Season 1 state. World owns the next release window; final combined gates/live receipts are recorded in artifacts/world/polish-notes.

## Arena life — 2026-09-18 (world lane, owner's picks #1–#5)
Owner: "anything else we can add to make the environment more engaging?" — approved five, built in order, each audited
(tests + captures) before the next. Sound left to the audio lane. **Ash motes**: 220-Point cloud, per-pixel sprite, slow
two-frequency drift + a gust on landed blows (`motes` — Points, not Mesh: the solid-geometry rules are about camera
collision); first pass was invisible at 5 cm/35 % — the brick's luminance noise floor — so 0.14 m, light-toned, reads as
dust. **Firelight**: `fireGlow` warm vertex tint on wall+tier bands above each brazier (angular proximity × height
window; static — the coals' emissive flicker carries motion). ~~**Battle-worn sand**~~ — owner rejected the decals on
review ("3 i dont like"), dropped pre-merge; the `sandWearAtlas` lessons (decal albedo must land below sunlit sand,
≈0.8×) are recorded here in case the idea returns. **Fallen gear**: dented
helmet, snapped spear, broken blade in the iron merge (zero draw calls), yaw-only + low (camera-clamp rule). **Gate
light**: the low sun spills through the arch — beam rides the real sun direction but lives inside the passage (r ≥ 11.7;
the contract caught the first cut at 11.35 m) fading to the floor, plus an additive warm pool where it lands (y < 0.5 is
exempt). Cost: 21/40 draw calls, 21.2k tris, 11.71/12 MB textures. Captures: `artifacts/world/arena-life-*/`.

## Flames frayed — 2026-09-18 (world lane, owner's art direction)
Owner, from the phone, after flames-fatter (PR #106): flames are ~50% of the pot, too pointy, too clean — "more like 70-80% of
the pot size… less pointy at top… more frayed/jaggy, separated a bit… gritty and realistic, not fake cartoony". `flamePixels`
(textures.ts) reworks the silhouette only (quad, anchors, palette and wave motion untouched): body width 0.65 → 0.88 with a
blunter profile (pow 0.5 → 0.42), two noise slots that drift apart with height split the upper flame into separate tongues,
high-frequency fray bites the silhouette harder toward the tip, the tip dies in a ragged noise line instead of a point, and a
per-pixel grain keeps the colour gritty. Measured on the brazier close-up: 145 px vs the 200 px pot rim (72%, was 55%).
Contract 226/226, zero draw-call/triangle/texture delta (+509 B source). Captures: `artifacts/world/flames-frayed/`; brazier
close-ups (new `scripts/arena-closeup.mjs` harness — the wide/lock views render flames at ~15 px, too small to art-direct):
`artifacts/world/flames-2-closeup/`, `flames-fatter-closeup/`, `flames-frayed/brazier.png`.

Objective: live responsive longsword practice on frankendom.com, with canonical persistent-fighter RPG direction.
Success: draw/strike, light chain/heavy/riposte, dodge/roll, directional block/timed parry, stamina, moving/guarding warden, player defeat/rematch; functioning movement/camera and saved guest identity; isolated verified HTTPS deployment. No claim of a passed player/hardware or online-combat gate.
Scope: GAME_SPEC.md. Semble discovery is working; CodeGraph was initialized with owner authorization on 2026-09-13. Use both for code work, and run `codegraph sync` after edits.
Files: src/{main,scene,sim,profile}.ts, src/style.css; tests; scripts/deploy.sh; deployment vhost.
Do not inspect/change other business products or existing VPS services.
Selected approach: Vite + TypeScript + Three.js static build, no framework/backend. Babylon and native web exports rejected for additional surface in this bounded gate.
Known risks: no physical minimum-phone tests or external player feedback yet; character art is an early original pass; server storage and actual PvP belong to 0B. VPS had ~1.3 GB free at discovery; deploy only a small static build and do not clean unrelated data.
Next validation: pure simulation invariants, storage failure/reload, touch cancellation, camera edge positions, rendered desktop/mobile layout, public HTTPS and source parity.

## Flames fatter still — 2026-09-18 (world lane, owner's art direction)
Owner, from the phone, after flames v2 (PR #104): "fire fatter still, still only 50% of pot size". The flame quads widen
0.95 → 1.3 m (`arena.ts`) and the texture body 0.5 → 0.65 (`flamePixels`), keeping the ragged tongue and wave motion. The wider
quad's vertices (with the lick scale) reached 11.49 m — inside the 11.5 m camera clamp — so the flame anchors move
`wall.inner + 0.42 → +0.55`; the 13 cm offset from the coal pans is invisible. Contract 7/7, zero cost delta. Captures:
`artifacts/world/flames-fatter/` vs `flames-2/`.

## Stone relief: the wall gets its surface — 2026-09-18 (world lane, owner's art direction)
The owner, from the phone: the masonry colour is right but the wall reads flat and machine-smooth — "add some dents, or bits, or
other surface imperfections randomly". The diagnosis: the wall had albedo only, no light response; the sand reads real because it
has a normal map. `stoneNormal` (textures.ts) carves the relief the albedo prints: the ashlar layout is extracted into `ashlar()`
and shared (the albedo is proven pixel-identical by checksum — the owner-approved colour is untouched), so mortar grooves,
proud/recessed blocks, chamfers and the albedo's own cracks land exactly on their printed lines, plus erosion undulation, surface
tooth, two layers of pitted dents and knocked corners. The stone material gains the normal map at scale 1.1. Cost: +1 texture,
11.0 / 12 MB texture memory, +0.8 KB source gzip, zero draw-call or triangle growth. Contract 7/7, full gate + real-browser gate
green. Captures: `artifacts/world/stone-relief/` vs `polish-4/`.

## Arena v1 — The Ashpit — 2026-09-17 (world lane)
The courtyard is replaced behind the lead's seam (`src/arena.ts`, `scene.ts` untouched): a sand-and-gravel pit (owner's call: a
traditional coliseum floor, no tiles) to a podium wall whose inner face stands outside the camera clamp, a portcullis gate on the far
side with a dark passage, chains, six braziers with flickering emissive coals (no lights), eight torn instanced banners, five broken
tiers with fallen blocks, a ruined colonnade and parapet, 235 crowd silhouettes on the upper tiers that bob on a blow, lean in on a parry
and recoil on a kill (≤ 0.1 m / 8°, still in a hit-stop), an ash sky dome with one break of light and fogged mesas. Every texture is
generated at load from seeded noise (`src/assets/arena/textures.ts`; +9.8 KB gzip on the shell, 9.6 MB of texture memory, no
downloads, no licences). The seam gains `floor` (the sand mesh, planar UVs `x / 3, z / 3`) as the decal slot. Measured with the new
harness `scripts/arena-preview.mjs` (game renderer/lights/fog/lock camera, rigs at the start, settled camera; before/after in
`artifacts/world/{baseline,arena-v1}`): 263 → 12 meshes, 330 → 15 arena draw calls in the portrait lock, 4.4k → 19.4k triangles,
floor albedo ≈ 0.24 → 0.088 against the hero's skin sample 0.166 (fighters are now the brightest thing on screen). Contract
(`tests/arena.test.ts`, 7 tests, instances walked): exclusion volume, boundary ring, floor darker than skin with decal UVs, crowd
placement and reaction caps, ≤ 40 meshes / 120k tris / 12 MB textures; 5 mutations caught. Gate 223/223 + browser gate on the new
arena. Not done: phone frame-time and startup measurement (no route from the lane), lighting values (proposal), the rename — three names
proposed (The Ashpit · Worldsedge · The Bonehollow) in `artifacts/world/REQUESTS.md`; report in `artifacts/world/REPORT.md`.

## Arena life 2 — 2026-09-18 (owner's phone pass)
On the live build the owner approved firelight + gate light, rejected nothing new, and asked for two fixes. **Motes were
invisible in gameplay** — the phone camera looks down at busy, dark-speckled sand where a mid-grey speck has no contrast
and the drift was too slow to catch the eye: now 260 (62 % inside r 7.2), 0.2 m, 0.62 opacity, ~1.8× drift speed; owner: "too large, floating grey circles" → half size (0.1 m), kept the contrast + drift.
**Gear wanted inside the ring**: five more pieces (sunk shield, blade fragment, trodden helmet, snapped shaft) scattered
r 2.8–7.6, ≥ ~1 rad apart. The play-circle rule (nothing solid above 6 cm inside r 8.55) means everything lies flat or
squashed into the sand — the contract caught the shield boss at 7 cm. Captures: `artifacts/world/arena-life-2-tuning/`.
