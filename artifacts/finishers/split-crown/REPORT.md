# Split Crown — skull split, 2026-09-19

Owner accepted: head splits down the centre, halves open slightly, body collapses intact.

## Implementation
- Clip the current head bake at its own sagittal plane. Face, scalp/hair and headgear remain the fighter's own materials.
- Closed, textured cut faces; opening follows the existing finisher clock and Head bone.
- Blood off restores the intact head; dark/red change the cut material; rematch disposes geometry/material/texture.
- No damage, collision, attack timing, rotation selection, GLB or blade-path changes. Decapitation's extraction/ballistics are unchanged.

## Verification and caught failures
- All six shipped rigs: finite half geometry, no triangles crossing the split, closed cut surfaces, animated bone attachment,
  blood-mode cycling, resource disposal, isolated opponent state, and subsequent decapitation.
- Reproduced a render-order failure at a translated/rotated fighter: `updateWorldMatrix` alone left the skin bind inverse stale.
  Regression failed before the fix, then passed after refreshing `SkinnedMesh.updateMatrixWorld` before extraction.
- Five opponents: real seeded sim kills through the production scene, portrait contact/drop/settle, landscape and rear captures,
  red/dark/off, toggles on the corpse, rematch. Machine receipts: opponent-checks.json (working-tree captures based on 938a84f).
- Selection tests pass; existing plain/player/draw/kick exclusions remain intact.
- The first full gate passed 247 node tests but missed the browser's timed parry while capture jobs were also rendering.
  Run the complete gate alone; do not weaken the timing assertion. Confirming receipt: full isolated `npm run quality` exits 0 (247/247 tests, build/audit, 8,361,824/10 MB gzip, browser passed:true); the `.quality-gate.json` finisher completion command also exits 0.

## Boundaries
- These are automated browser captures, not a physical iPhone performance acceptance.
- The inherited Run Through alignment failure remains on its separate worktree/branch; it is not included here.
- Existing Sentry fetch/texture/WebGL initialization issues remain open; this visual feature does not resolve them.

Visual review: contact split visible on Veteran, Pitborn, Nightborn and Executioner. The smaller Goblin is occluded at the normal contact angle; geometric/scene attachment checks pass. Rear-contact view added to the repeatable gate for an unobstructed inspection.
