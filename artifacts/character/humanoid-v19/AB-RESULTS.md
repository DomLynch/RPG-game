# A/B: KeenTools vs Hunyuan3D multi-view — same five GPT portraits (2026-09-14)

| | A · KeenTools Cloud | B · Hunyuan3D-2mv (HF Space, anonymous) |
|---|---|---|
| Input | 5 views (front, ±35°, ±90°) | front + left + right (its slots; no back view given, it hallucinates one) |
| Output | 59,426 tris, 4 materials, 4 × 2048² photographed textures | 733,696 tris (o256) / 1.68M (o384), no UVs, no texture |
| Likeness | Strong: it is the man in the portraits (brows, nose, jaw, stubble, hair) | Soft "mannequin": face longer/narrower, brows a faint ridge, chin recedes in profile, eyes closed lumps |
| Hair / stubble | Photographed, in the texture | None (surface only) |
| Back of skull | Un-photographed: black — now filled (see zoom-back.png) | Complete, plausible, clean |
| Ears | Fair | Good (helix/lobe readable) |
| Time / cost | ~4 min, paid API credit | 26 s shape (free quota, 99 s cap); textured run refused on anonymous quota |
| Phone-ready | Yes — decimated to 15.6k tris + 2K/1K maps in this build | No — 12–28× budget, untextured, needs retopo + UVs |

Verdict for the FACE: KeenTools. Likeness is the whole point and Hunyuan loses before texture is even considered.
Hunyuan is worth one textured trial for props/body (no likeness requirement; clean closed mesh + auto-texture in ~2 min) —
needs a free Hugging Face login (`hf auth login`) or a paid host (Replicate ≈ $0.10/run, fal.ai ≈ $0.02/run).
Reusable client: `scripts/character/hunyuan.py` (args: --front/--left/--right/--back or --image, --name, --endpoint).

Files: `ab-keentools-vs-hunyuan.png` (raw turntables side by side), `face.png` / `zoom-*.png` (KeenTools head integrated on the rig).
