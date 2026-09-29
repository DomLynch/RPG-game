// The Pit's lazy chunk entry (assets/pit-<hash>.js, check-budget.mjs PIT). Only src/pit-coordinator.ts loads it. The seam PR carries
// the lifecycle alone: hide the arena, stand the hero, give it all back. The room, rack and trophies come in their own PRs.
import type { Entry, Pit, Stage } from './stage.ts';

export function enter(stage: Stage, entry: Entry): Pit {
  stage.setArenaVisible(false);
  const at = entry === 'defeat' ? { x: -2, z: -1 } : { x: 0, z: 0 };   // the rack for a defeat, the gate's foot for a win
  let shown = true;
  const leave = () => { if (!shown) return; shown = false; stage.setArenaVisible(true); };
  return {
    frame(dt) { if (shown) stage.hero.place(at.x, at.z, 0, 0, dt); },
    leave,
    dispose: leave,   // nothing built yet; the room PR frees its own geometry, materials and textures here
  };
}
