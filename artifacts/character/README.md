# Character lane — evidence and notes

Branch `char/hero-v1`, worktree `~/Developer/frankendom-char`, baseline `60e94b3`.
Owner direction (2026-09-14): mobile-first, AAA-grade visual fidelity, "wow factor". Blender 5.2.1 LTS installed
(Homebrew cask) for authoring; every asset stays reproducible from committed sources + one command.

## Review harness (Task 1)
- `character-preview.html` + `scripts/character-preview.mjs`. Not part of the build (no vite.config → only index.html builds).
- Uses the game's own `loadWarriors()` and `update()` contract, `cameraPose()` lock camera, combat tick durations from
  `src/combat.ts`, and the renderer settings from `src/scene.ts` (ACES, exposure 1.3, ratio ≤1.5, PCF 1024, RoomEnvironment 0.04 @0.65,
  hemisphere + sun, fog). Lighting fidelity was checked against the real gate screenshot `artifacts/browser-riposte.png`.
- Studio view is a FROZEN neutral rig (grey, key/rim/hemisphere, RoomEnvironment @1.0, exposure 1.0). Do not change it to flatter an asset.
- All still captures step the fighters at a fixed 1/60 s; identical input → identical pixels on this machine (SwiftShader).
- Commands:
  - `node scripts/character-preview.mjs --label <name>` → `artifacts/character/<name>/`
  - `node scripts/character-preview.mjs --label <name> --against baseline` → same, plus a Δ table
  - `node scripts/character-preview.mjs --serve` → dev server for manual review (turntable, clip scrub, lock views)

Outputs per label: `inspection-turntable.png` (8 angles, both fighters, Armed t=0), `details.png` (12 close-ups: head, neck, shoulder,
armpit, guard, grip ×2, sword, feet ×2, hips), `clips.png` (24 key frames across all 21 clips),
`gameplay-{portrait,landscape}-{ready,attack}.png` (true lock camera at 390×844 / 844×390 @1.5), `sequence.png` (6 s combat
sequence, 24 frames @0.25 s, true framing), `sequence-zoom.png` (same frames, 2× crop around the fighters), `sequence.webm`
(real-time playback, feel reference only), `stats.json`.

Mood board (Task 2): `node scripts/character-preview.mjs --label moodboard --moodboard` → `scripts/character-moodboard.js` renders
procedural material swatches under the arena lighting (near + at lock distance) and a primitive silhouette blockout on the real rig.
Audit: `audit/DEFECTS.md`. Direction proposal: `moodboard/DIRECTION.md` (owner pick pending).

## Labels
`baseline` (60e94b3 tin-can knight) · `base-source` (raw CC0 body via `--src`) · `level1-kit-raw` (kit parts alone) ·
`humanoid-v1…v5` (iterations; v5 = weapon pass, committed 131cd52) · `motion-v1` (UAL2 Guard sheet) · `ual2-attacks` (opt-in strike candidates + variant GLB) · `ual2-block` (raw UAL2 key frames) · `level1-kit-raw` · `moodboard` (direction pick) · `realistic-v1` (Blender Studio head, painted) · `realistic-v2` (face tile, sculpted normal, hair/brow/lash cards; `face.png`, `eyes-zoom.png`) · `humanoid-v10` (= realistic pass 2b at 4270e9f, the owner's review copy) · `realistic-v3` / `humanoid-v11` (photo-projected albedo — rejected: baked shadows) · `humanoid-v12` (painted, photo off) · `realistic-v5` / `humanoid-v13` (painted face, eyes with lid shadow + wet cornea, lids 20°, seam-free buzz-cut shells, healthy skin; audit crops `zoom-*.png`) · `humanoid-v14` (painted, sides covered) · `realistic-v9` / `humanoid-v15` (geometry from the owner's five GPT portraits: 468-landmark head fit, midline profile depth, eyeballs seated to his openings, five-view projection) · `humanoid-v18` (raw KeenTools turntable) · `humanoid-v19` (A/B KeenTools vs Hunyuan3D-2mv, `AB-RESULTS.md`) · `realistic-v10…v17` / `humanoid-v20` (KeenTools head on the rig: `face.png`, `head-audit.png` 8 angles, `zoom-*.png`) · `realistic-v18…v19` / `humanoid-v21` (full fighter: arms laid onto the bones so the hands grip, wrist bracers, bare-toe sandals) · `realistic-v20` / `humanoid-v22` (shipped: kit cut on the exact cut curves, bowed kilt strips, thumb swung onto its bone, flat seam band) · `realistic-v22` / `humanoid-v23` (head sized by the body's own head height, 1.16× — `head-size-before-after.png`) · `realistic-v23…v24` / `humanoid-v24` (polish pass: eyes, skin variation, thumb, wraps, collar; `eyes-before-after.png`, `head-audit.png`) · `realistic-v25` / `humanoid-v25` (head +10% on top of the height match, nape hair down to one hairline, tile tones matched; `head-size-and-nape.png`) · `realistic-v26` / `humanoid-v26` (chin restored: collar band fixed in scan units; legs and feet laid onto the bones — the ankle hinges at the ankle; `feet-audit.png`) · `realistic-v27` / `humanoid-v27` (one flat sandal sole — no heel block; the photographed under-chin kept; `chin-feet-audit.png`) · `realistic-v28` / `humanoid-v28` (a sculpted chin: the scan's was flat; `chin-before-after.png`, `chin-audit.png`) · `realistic-v29` / `humanoid-v29` (nape band fixed: the portraits' grey backdrop had leaked through the projection at the back; `nape-before-after.png`) · `realistic-v30` / `humanoid-v30` (chin: the jaw's underside extended forward and down instead of a boss under the lip; nape band fixed; `chin-v20-v28-v30.png`) · `humanoid-v31` (interim: the scan's own jaw, no chin pushes — v28–v30 all read wrong in profile; nape fix kept; `face-front/left/right.png`) · `humanoid-v32` (re-scan from eight portraits — the five plus three from below — gives the jaw KeenTools never had; `profile-before-after.png`, `face-front/left/right.png`) · `humanoid-v33` (a strong, longer chin: down/forward fields below the lip crease on the eight-view scan, underside blended to the throat; `chin-v32-v33.png`, `face-front/left/right/low.png`, `geometry.png`) · `humanoid-v34` (the chin's bottom edge 2.3 cm lower at the centre in a U, per the owner's sketch; `chin-v33-v34.png`) · `humanoid-v35` (mouth levelled — the scan's corners were 1.8 mm off; the stretched chin re-covered with quilted, squeezed stubble from beside it; the chin edge no longer scalloped; `chin-mouth-v34-v35.png`, `face-sheet.png`, `face-front/mouth/left.png`) · `keentools-raw2` (raw turntable) · `proof-*` (pipeline proofs, deleted).

## Baseline resource table (60e94b3)
| resource | baseline |
|---|---|
| GLB raw / gzip | 3,386,704 / 1,097,236 B |
| triangles per fighter (asset) | 35,330 |
| draw calls, two fighters (incl. shadow pass) | 36 |
| triangles rendered, two fighters (incl. shadow pass) | 140,408 |
| texture memory (with mips) | 1,398,100 B — four 256×256 maps |
| bones | 65 |
| materials | Gambeson[map,normal] Steel[map,normal,rough,metal] Leather[—] Antique brass[—] Heraldry[map,normal] |
| clips | 21 |

Note: Gambeson and Heraldry share the same two 256² textures; Steel's roughness/metalness is one packed 256² map.
Leather and Antique brass are untextured flat PBR. The whole character is effectively untextured at phone resolution.

## Sequence definition
`SEQUENCE` in character-preview.html: armed walk → strafe left → light attack (opponent guards/blocks) → heavy (opponent hit) →
guard → block (opponent light) → parry (opponent deflected) → riposte (opponent hit) → opponent light → death. 360 ticks = 6.0 s.
Phase lengths are the game's own recovery/reaction constants.
