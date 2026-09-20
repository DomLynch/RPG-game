# Combat audio lane — requests to other lanes

Runtime changes the audio lane needs but does not make. Audio consumes `CombatEvent[]` only; it never infers gameplay
from the renderer, the HUD or the fighter bodies. Each request names the evidence that raised it.

## 1. Locomotion events (combat lane) — needed for Task 4 (footsteps, roll/backstep landing), not for impacts
Evidence: `artifacts/audio/baseline/REPORT.md` — the `walk` beat (ticks 1–101) carries no event; the simulation emits
nothing while a fighter walks, runs, strafes, guards forward or lands a roll/backstep. Footsteps by gait and surface
cannot be placed from the event stream today.

Proposed shape (deterministic, from `stepDuel`, per fighter):
- `{ type: 'Step', actor, gait: 'walk' | 'run' | 'guard' }` when `body.distance` crosses the next stride (e.g. every
  0.7 m walking, 1.0 m running, 0.45 m guarding). Audio alternates left/right itself.
- `{ type: 'ActionEnded', actor, action: 'roll' | 'backstep' }` on the tick the phase returns to `ready`, for the landing.
Status: open — **Phase 2** under the 2026-09-20 beta freeze (footsteps/breath/voice layers are post-beta). Still the
only thing that makes footsteps possible; not needed for the beta audio set.

## 2. Arena surface (art direction / scene lane) — needed for Task 4–5
Which floor is Ashcourt: packed sand, flagstone, or sand over stone? One constant is enough (`surface: 'sand' | 'stone'`);
until it exists the lane ships sand-over-stone (the shipped roll/backstep cues are sand). Status: closed for beta — the
Ashpit is one surface; reopen with a second arena.

## 3. Target material for impacts (character/loadout lane) — needed when equipment becomes data
Both fighters currently wear the level-1 kit (linen, leather, iron studs) and carry the same longsword, so `Hit` maps to
flesh/leather and `Blocked` to iron-on-iron without extra data. When armour slots become data, `Hit`/`GuardBroken`
should carry the struck material (`material: 'flesh' | 'leather' | 'iron' | 'bronze'`) for the target's `location`.
Status: **Phase 2** — the beta roster (Veteran trident, Pitborn cleaver, Goblin knife, Nightborn estoc, Executioner scythe,
Minotaur maul) already gives impacts a weapon in `Hit.weapon`; material-aware impacts (bronze/iron/bone/wood) are the first
post-beta audio item and need the struck material, not just the weapon.

## Evidence policy (owner, 2026-09-15)
Rendered WAVs stay out of git (`artifacts/` is ignored; the harness regenerates them in seconds). Only `REPORT.md`,
`loudness.json` and `quality.log` per iteration are force-added. WAVs reach the owner as attachments.

## 4. `PostureBroken` has no sound (combat lane emitted it in slice Q) — Phase 2
Evidence: `artifacts/audio/trunk-63c57e2/REPORT.md` probe `posture-broken` is silent. Under the freeze it stays silent;
post-beta it gets a guard-break-family cue (dull, wrong) once the break has a settled presentation duration.
