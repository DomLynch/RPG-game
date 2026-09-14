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
