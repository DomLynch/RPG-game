# Arena & rendering audit — "AAA on a phone" — 2026-09-20 (presentation lane)

Trunk `cf49f00`. Measured with `scripts/arena-preview.mjs` (game renderer, lights, fog, settled lock camera, both rigs) at the full and
phone tiers (`?gfx=phone`), and the game's own `fps · p95` readout in headless Chromium on the owner's Mac (Apple M5). Nothing here was
measured on an iPhone; the phone-tier numbers are what the phone *loads*, not how fast it draws them.

## What the numbers say

| | Arena v1 (09-17) | trunk full tier | trunk phone tier |
|---|---|---|---|
| arena meshes / draw calls (portrait, with shadows) | 12 / 15 | 20 / 26 | 20 / 26 |
| arena triangles | 19,428 | **114,440** (cap 120k) | 114,440 |
| crowd | 235 crossed quads | **313 three-dimensional silhouettes ≈ 95k tris** | same |
| arena texture memory with mips | 9.6 MB | 11.0 MB | 3.1 MB |
| sand albedo / normal / shadow map | 1024² / 512² / 1024² | 1024² / 512² / 1024² | **512² / 256² / 512²** |
| pixel ratio cap | 1.5 | 1.5 | **1.25** |
| `buildArena` on the main thread | 176 ms | **1,482 ms** | 508 ms |
| page load → fight-ready (headless, this Mac) | 1.07 s | **6.8 s** | 6.0 s |
| frame time (M5, headless) | 60 fps · p95 17 ms | 60 · 17–18 | 60 · 18 |
| floor albedo vs skin 0.166 | 0.088 | 0.105 | 0.106 |

Renderer today: WebGL2, MSAA on, ACES 1.3, PCF shadows (sun frustum ±15 m), hemisphere 1.6 + RoomEnvironment 0.45 + one sun, exponential
fog, **no post-processing**. `quality.ts` records the real phone ceiling: **GPU memory** — fighters ~110 MB of uncompressed textures, the
MSAA framebuffer ~200 MB at dpr 1.5 — which is why the phone tier halves everything. On the phone the sand loses its gravel and grain
(`trunk-phone-portrait.png` vs `trunk-full-portrait.png`), shadows go soft and blocky, and the image is 1.25× not 1.5×. "Sharpen" and
"higher res" are therefore not dials to turn up; they are what falls out once memory is fixed.

## Ranked findings (what an AAA eye sees at the lock camera, cost, and what it buys)

1. **Uncompressed textures are the ceiling — move to GPU-compressed KTX2 (ASTC on iPhone, ETC2/BC elsewhere).** RGBA8 at 1024² with mips is
   5.3 MB of VRAM; ASTC 4×4 is 1.3 MB and needs no decode. Fighters 110 MB → ~15 MB, arena 11 → ~2 MB. That alone lets the phone tier keep
   1024² sand, a 1024 shadow map and dpr 1.5, and it cuts load time (no PNG/JPEG decode on the main thread). Cost: `KTX2Loader` +
   the Basis transcoder that ships inside the three package (~250 KB gzip, no new dependency); an offline conversion step for fighter
   textures (`toktx`/`basisu`, dev-time); the arena's generated maps become pre-baked KTX2 files (~150–300 KB each) — a deliberate trade
   of ~0.6 MB download for 5× less VRAM and ~1 s less startup. Fight-ready is 9.73 MB of 12: it fits. **This is the enabler for
   everything below on the phone.**
2. **Startup: 1.5 s of arena build on the main thread** (0.5 s phone tier), up from 176 ms — the crowd silhouettes and texture generation.
   Bake the arena offline (the brief's `scripts/build-arena.mjs`) or generate textures in a Worker and cache the pixels in IndexedDB.
   Target < 200 ms. Page load to fight-ready is 6.8 s on a desktop-class machine; a phone on cellular will be worse.
3. **Crowd triangles are spent where nobody looks.** 95k of the 114k triangles are 313 spectators that are ~40 px tall behind the wall in
   the lock view and mostly off-screen. Impostor quads in the lock framing (the v1 approach) with the 3-D figures only on the two nearest
   tiers: −80k triangles, −1 s build, no visible loss at 393×852. The wide view is never seen in play.
4. **Shadows: tighten the sun's frustum from ±15 m to ±11 m.** Only the play circle needs sharp shadows; the wall's shadow edge is outside
   it. 1.4× effective resolution on both tiers for free; with (1) the phone tier can go back to 1024.
5. **Environment: RoomEnvironment is a studio box.** Bronze, iron and wet blood reflect a white studio; a small equirect sky matching the ash
   dome (256×128, ~60 KB) through PMREM gives correct cool sky fill and warm ground bounce. Cheapest realism win for the metal
   (materials rule: worn metal must still respond to light).
6. **Ambient occlusion is vertex-tinted, not baked.** With Blender connected we can bake an AO lightmap for the wall base, gate and tiers
   (`aoMap` on a second UV set, 512² KTX2 ≈ 150 KB). Grounding is the single biggest "AAA" tell after lighting; SSAO as a post effect
   costs a full-res render target we cannot afford on the phone yet.
7. **Defects visible in today's captures** (`trunk-full-portrait.png`): (a) the banner/pole shadow reads as a floating black rectangle on the
   sand (mid-left) — the cloth's cut mask is not reaching the shadow pass, or a plank casts a sharp slab; (b) the gate "sunlight" is a
   hard-edged bright ellipse with a beam — a stage spotlight, not sunlight; soften to a faint warm patch or drop it; (c) brazier flames
   are white blobs from any distance; (d) gravel and grain vanish on the phone tier (item 1). (a) and (b) are small fixes now.
8. **Anti-aliasing vs memory.** WebGL2's `antialias: true` is 4× MSAA — the ~200 MB item. Options to measure on the device once (1) lands:
   MSAA off at dpr 1.5 (supersampling by dpr costs a quarter of MSAA's memory) or a single-pass FXAA. Not decidable from a desktop.
9. **Post-processing (bloom on coals and sparks, vignette, a colour LUT)** is the last 10 % of the AAA look and costs one full-res render
   target (~30–60 MB at 1.25×) plus a pass. Defer until (1) and (8) free the memory, then one combined shader (FXAA + vignette + LUT +
   cheap bloom threshold) — never a chain of passes.
10. **Sharpen filters**: not recommended. A sharpen pass needs the post RT above and reads as ringing on a phone; the sharpness the eye wants
    comes from 1024² sand + 1024 shadows + dpr 1.5, all unlocked by (1).

## New tooling proven today
- **Blender connector** (5.2.1 LTS, Draco + meshoptimizer available): modelled a broken fluted column via `bpy`, exported a 27 KB / 680-tri
  GLB, rendered it — the pipeline for authored props and for baking AO/lightmaps (item 6).
- **TRELLIS.2 (Hugging Face, anonymous)**: text → image (10 s) → 3-D (46 s). A rusted iron brazier came out at 48k tris / 4.5 MB gzip; one
  pass through Blender (decimate to 2,500 tris, textures to 512² WebP) made it a **177 KB game prop** with rust and form intact
  (`brazier-input.png`, `brazier-game.png`, `brazier-game.glb`). Use for hero-visible objects only — the gate, a weapons rack, fallen
  shields, rubble inside the clamp band: 3–5 props ≈ 0.7 MB of the 2.3 MB headroom. Not for the 6 braziers 12 m away.

## Order I would do it in
1 KTX2 textures (fighters + arena) → 2 arena startup (bake / worker) → 3 crowd LOD → 4 shadow frustum + phone 1024 → 5 sky environment →
6 baked AO via Blender → 7a/7b banner shadow + gate spotlight fixes (small, can go first) → 8 AA decision on the device → 9 single-pass post.
Each step gets the same before/after treatment (`arena-preview.mjs` / `impact-preview.mjs`) and a phone check by the owner.
