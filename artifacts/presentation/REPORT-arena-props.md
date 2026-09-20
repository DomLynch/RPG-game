# Arena presentation batch — 2026-09-20 (branch presentation/arena-props)

Owner's brief: use TRELLIS.2 on the Pro account properly, then the audit's recommendations one by one, each audited; AAA grade, gritty
and realistic. Trunk a408b9f. Harness: `scripts/arena-preview.mjs` (`--phone` for the phone tier), `scripts/impact-preview.mjs`.

| step | done | evidence / numbers |
|---|---|---|
| Props (TRELLIS.2 → Blender) | 5 hero-visible props: portcullis (replaces the procedural bars), weapon rack, fallen shield, column drum, bone pile. Generated on the owner's HF Pro account at the remesher's 50k target, decimated 10–15× in Blender (a first 60–80× pass destroyed the shield, skull and drum — redone), base maps 768/512² WebP, metallic-roughness dropped for factors. | `props-v1/inputs.png`, `lit-review.png`, `diet.json`; build-packed **672 KB gzip** for the five; GPU memory **+7 MB desktop / +1.75 MB phone** (maps capped 512²/256²) |
| Sparks v2 (owner's live feedback) | struck off the visible blade (grip → entry into the defender), 3–7, staggered over frames, thin (0.055, six-point streak), pale straw → dull ember, tone-mapped | `sparks-v2/block.png`, `parry.png` |
| Startup | sand/stone/sky maps generated in a Web Worker; flat stand-ins first; `arena.ready`; combat waits for it | `buildArena` main thread **1,067 → 204 ms** full, 424 → 159 ms phone; load 6.0 s full / 4.5–6.2 s phone vs trunk 5.5 s; p95 18–19 ms every window |
| Crowd LOD | spectators outside the camera frustum collapse to a zero matrix each frame (`update(dt, events, camera)`); the portrait lock stands ~33 of 291 | test: culled > standing at the lock camera; everybody stands without a camera |
| Shadow frustum | sun ±15 → ±12 m (pit floor to the wall's foot) | 1.25× shadow resolution on the sand, both tiers |
| Sky environment | the arena's equirect sky (warm sand below the horizon) → PMREM environment once landed; RoomEnvironment only until then; intensity 1.0 | metal reflects this place |
| Defect: banner shadow | banners no longer cast (the 3 m slab crossing the fighting sand) | `props-full/lock-portrait.png` vs `base-full/lock-portrait.png` |
| Defect: gate spotlight | pool 1.75 → 2.4 radius, opacity 0.55 | same captures |
| Baked AO | **not done** — needs an unwrapped lightmap pipeline on the merged stone (own step) | — |
| Compressed textures (KTX2) | **blocked on a download**: `brew install basis_universal` (Binomial's encoder) — owner's OK needed | — |
| AA decision, one-pass post | after KTX2 and a phone measurement | — |

Budget: check-budget counts `.glb` files as opponent candidates, so its per-fight figure (9.73 MB) excludes the props; the true number is
≈ 10.4 of 12 MB. Gate: `npm run quality:ci` 327/327 at the props commit, rerun at the tip (see PR); `npm run test:browser` passed at a0b7032.
Not measured: the owner's iPhone.
