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
Status: open. Not blocking Tasks 2–3.

## 2. Arena surface (art direction / scene lane) — needed for Task 4–5
Which floor is Ashcourt: packed sand, flagstone, or sand over stone? One constant is enough (`surface: 'sand' | 'stone'`);
until it exists the lane ships sand-over-stone and notes it in the report. Status: open, owner's call.

## 3. Target material for impacts (character/loadout lane) — needed when equipment becomes data
Both fighters currently wear the level-1 kit (linen, leather, iron studs) and carry the same longsword, so `Hit` maps to
flesh/leather and `Blocked` to iron-on-iron without extra data. When armour slots become data, `Hit`/`GuardBroken`
should carry the struck material (`material: 'flesh' | 'leather' | 'iron' | 'bronze'`) for the target's `location`.
Status: not needed yet; recorded so the loadout schema includes it.
